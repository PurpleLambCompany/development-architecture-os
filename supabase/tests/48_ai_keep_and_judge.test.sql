-- =============================================================================
-- Phase 7B.2: keeping an ephemeral interpretation and judging inferences
-- (pgTAP). Proposal §14.3, §15, §18; PD-3 to PD-6, PD-18, PD-21; ADR-0069,
-- ADR-0070. Exact shown text is the persisted text: keep names only the
-- request, and the database supplies the output it held. Keep and judgment
-- are one transaction.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(43);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

\set M '''e0000000-0000-4000-8000-000000000001'''
\set CAP '''b3000000-0000-4000-8000-000000000204'''

create function pg_temp.auth() returns uuid language sql as $$
  select id from public.engagement_ai_authorizations
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' order by sequence_no desc limit 1;
$$;
create function pg_temp.request(outcome text, mode text default 'ephemeral') returns jsonb language sql as $$
  select jsonb_build_object('outcome', outcome, 'mode', mode, 'inference_kind', 'explanation',
    'subject_type', 'impact_trace', 'subject_element_id', 'b3000000-0000-4000-8000-000000000204',
    'authorization_id', pg_temp.auth(), 'prompt_id', 'explanation', 'prompt_version', 'v2',
    'generation_policy_version', 'v2', 'tool_contract_version', '1', 'provider_key', 'fake',
    'requested_model', 'dsa-fake-model-1', 'resolved_model', 'dsa-fake-model-1',
    'input_tokens', 1200, 'output_tokens', 300, 'estimated_cost_usd', 0.01,
    'manifest', '[{"record_type": "element_working"}]'::jsonb, 'tool_calls', '[]'::jsonb);
$$;
create function pg_temp.inference(assertion text default 'CAP-004 bears on the founding team.') returns jsonb
language sql as $$
  select jsonb_build_object('output_schema_version', '2', 'assertion', assertion,
    'prompt_content_hash', repeat('a', 64), 'uncertainty', 'Not recorded: timing.',
    'claims', '[{"text": "It is required by the team.", "cites": ["R1"]}]'::jsonb,
    'examination', '["Examine CAP-004"]'::jsonb, 'payload', '{"connection": "x"}'::jsonb,
    'basis', (select jsonb_build_array(jsonb_build_object('handle', 'R1', 'record_type', x.record_type,
      'record_id', x.record_id, 'version_id', x.version_id, 'data_class', x.data_class, 'digest', x.digest,
      'origin', 'anchor'))
      from public.ai_context_element('e0000000-0000-4000-8000-000000000001',
        'b3000000-0000-4000-8000-000000000204', 'working') x));
$$;
-- An ephemeral interpretation returned to its requester: held, not an inference.
create function pg_temp.returned(assertion text default 'CAP-004 bears on the founding team.') returns uuid
language sql as $$
  select public.record_architecture_intelligence_request('e0000000-0000-4000-8000-000000000001',
    pg_temp.request('returned'), pg_temp.inference(assertion));
$$;
create function pg_temp.kept_count() returns int language sql as $$
  select count(*)::int from public.architecture_inferences where kept_at is not null;
$$;

-- Shape.
select has_column('public', 'architecture_inferences', 'kept_at', 'a kept inference records when it was kept');
select has_column('public', 'architecture_intelligence_requests', 'interpret_again', 'interpret again is a request flag (PD-20)');
select is((select count(*)::int from pg_trigger where tgrelid = 'public.architecture_inference_judgments'::regclass
  and not tgisinternal and tgfoid::regproc::text like '%activity%'), 0, 'judgments are not in the activity log (PD-18)');
select hasnt_column('public', 'architecture_inference_judgments', 'score', 'no score on a judgment');
select ok(not has_table_privilege('authenticated', 'public.pending_architecture_inferences', 'select'),
  'nobody reads a held output directly');
select ok(not has_table_privilege('authenticated', 'public.pending_architecture_inferences', 'insert'),
  '... or writes one');

-- Returning an interpretation holds it for its requester only.
select pg_temp.act_as('architect@tplco.test');
select pg_temp.returned('Exactly this text was shown.') as r1 \gset
select is((select count(*)::int from public.architecture_inferences), 0, 'returning creates no inference (IX-12)');
reset role;
select is((select count(*)::int from public.pending_architecture_inferences where request_id = :'r1'), 1,
  'the output is held against its request');
select ok((select expires_at <= created_at + interval '30 minutes' from public.pending_architecture_inferences
  where request_id = :'r1'), 'for at most thirty minutes');
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select public.record_architecture_intelligence_request(%L, pg_temp.request('returned', 'persist'),
  pg_temp.inference()) $$, 'e0000000-0000-4000-8000-000000000001'), '23514', null,
  'only an ephemeral request is held for keeping');
select throws_ok(format($$ select public.record_architecture_intelligence_request(%L, pg_temp.request('nothing_to_add'),
  pg_temp.inference()) $$, 'e0000000-0000-4000-8000-000000000001'), '23514', null,
  'nothing to add carries no inference');
select lives_ok(format($$ select public.record_architecture_intelligence_request(%L, pg_temp.request('nothing_to_add')) $$,
  'e0000000-0000-4000-8000-000000000001'), 'nothing to add is audited');
select lives_ok(format($$ select public.record_architecture_intelligence_request(%L,
  pg_temp.request('returned') || '{"interpret_again": true}') $$, 'e0000000-0000-4000-8000-000000000001'),
  'interpret again is recorded on the request');
select throws_ok(format($$ select public.record_architecture_intelligence_request(%L,
  pg_temp.request('returned') || '{"interpret_again": "yes"}') $$, 'e0000000-0000-4000-8000-000000000001'),
  '23514', null, '... only as a boolean');

-- PD-5: only the requester may keep.
select pg_temp.act_as('principal@tplco.test');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r1'), '23514',
  'This interpretation can no longer be kept. Interpret again.', 'another holder cannot keep it');
select pg_temp.act_as('researcher@tplco.test');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r1'), '42501', null,
  'a non-holder cannot keep it');

-- Keep: the persisted text is exactly the held text.
select pg_temp.act_as('architect@tplco.test');
select public.keep_architecture_inference(:M, :'r1') as k1 \gset
select is((select assertion from public.architecture_inferences where id = :'k1'), 'Exactly this text was shown.',
  'invariant 1: the kept assertion is the text that was shown');
select ok((select kept_at is not null and request_id = :'r1' from public.architecture_inferences where id = :'k1'),
  'kept, naming the returned request');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r1'), '23514',
  'This interpretation can no longer be kept. Interpret again.', 'a held output is kept once');
reset role;
select is((select count(*)::int from public.pending_architecture_inferences where request_id = :'r1'), 0,
  'keeping removes the held output');

-- Expiry.
select pg_temp.act_as('architect@tplco.test');
select pg_temp.returned() as r2 \gset
reset role;
alter table public.pending_architecture_inferences disable trigger user;
update public.pending_architecture_inferences set created_at = created_at - interval '31 minutes',
  expires_at = expires_at - interval '31 minutes' where request_id = :'r2';
alter table public.pending_architecture_inferences enable trigger user;
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r2'), '23514',
  'This interpretation can no longer be kept. Interpret again.', 'an expired hold cannot be kept');

-- Atomic keep and judgment (PD-3): an invalid judgment keeps nothing.
select pg_temp.returned() as r3 \gset
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L, '{"kind": "not_material"}') $$, :M, :'r3'),
  '23514', null, 'a judgment without its reason is refused');
select is(pg_temp.kept_count(), 1, '... and nothing was kept');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L, '{"kind": "promoted"}') $$, :M, :'r3'),
  '23514', null, 'promotion is not a keep-time judgment');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L, '{"kind": "investigating", "who": "x"}') $$,
  :M, :'r3'), '23514', null, 'an unknown judgment field is refused');
select public.keep_architecture_inference(:M, :'r3', '{"kind": "investigating"}') as k3 \gset
select is((select judgment_kind from public.architecture_inference_judgments where inference_id = :'k3'), 'investigating',
  'kept and judged together');

-- PD-6: judging needs edit_architecture as well as use.
select pg_temp.act_as('principal@tplco.test');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
select id, 'edit_architecture', false from public.engagement_members
where engagement_id = :M and user_id = '10000000-0000-4000-8000-000000000003';
select pg_temp.act_as('architect@tplco.test');
select pg_temp.returned() as r4 \gset
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L, '{"kind": "investigating"}') $$, :M, :'r4'),
  '42501', null, 'a holder without edit_architecture cannot keep by judging');
select is(pg_temp.kept_count(), 2, '... and nothing was kept');
select throws_ok(format($$ select public.record_architecture_inference_judgment(%L, %L, 'investigating') $$, :M, :'k1'),
  '42501', null, '... nor judge a kept one');
select public.keep_architecture_inference(:M, :'r4') as k4 \gset
select ok(:'k4' is not null, '... but can keep');
reset role;
delete from public.engagement_member_capability_overrides o using public.engagement_members m
where o.engagement_member_id = m.id and m.engagement_id = :M and m.user_id = '10000000-0000-4000-8000-000000000003';

-- Judgments are append-only, require a reason, and are read by holders only.
select pg_temp.act_as('principal@tplco.test');
select throws_ok(format($$ select public.record_architecture_inference_judgment(%L, %L, 'investigating') $$, :M, :'k1'),
  '23514', 'A newer interpretation of this has been kept. Judge that one.', 'a superseded inference cannot be judged');
select throws_ok(format($$ select public.record_architecture_inference_judgment(%L, %L, 'disagree') $$, :M, :'k4'),
  '23514', null, 'disagree needs a reason');
select throws_ok(format($$ select public.record_architecture_inference_judgment(%L, %L, 'deferred', 'Later') $$, :M, :'k4'),
  '23514', null, 'a deferral needs a date');
select lives_ok(format($$ select public.record_architecture_inference_judgment(%L, %L, 'not_material', 'Known already.') $$,
  :M, :'k4'), 'not material, with a reason');
select throws_ok($$ update public.architecture_inference_judgments set reason = 'x' $$, '42501', null, 'no update');
select throws_ok($$ delete from public.architecture_inference_judgments $$, '42501', null, 'no delete');
select pg_temp.act_as('researcher@tplco.test');
select is((select count(*)::int from public.architecture_inference_judgments), 0, 'a non-holder reads no judgment');
select pg_temp.act_as('architect@tplco.test');
select ok((select count(*)::int from public.architecture_inference_judgments) >= 2, 'a holder reads them');

-- A basis change between interpretation and keep refuses the keep.
select pg_temp.returned() as r5 \gset
reset role;
update public.architecture_elements set summary = summary || ' Revised.' where id = :CAP;
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r5'), '23514',
  'This interpretation''s basis has changed. Interpret again.', 'a changed basis cannot be kept');
-- ... and a stale inference cannot be judged.
select throws_ok(format($$ select public.record_architecture_inference_judgment(%L, %L, 'investigating') $$, :M, :'k4'),
  '23514', 'This interpretation is stale: its basis has changed. Interpret again.', 'a stale inference cannot be judged');

-- A new authorization version discards every hold on the engagement.
select pg_temp.returned() as r6 \gset
select pg_temp.act_as('principal@tplco.test');
select public.set_engagement_ai_authorization(:M, 'authorized',
  array['published_architecture', 'working_architecture', 'project_intelligence', 'evidence_metadata'], 'fake', 'us',
  'synthetic_evaluation', 'Re-authorised', null, 25);
reset role;
select is((select count(*)::int from public.pending_architecture_inferences where request_id = :'r6'), 0,
  'a new authorization discards held outputs');
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r6'), '23514', null,
  '... so they cannot be kept');

-- Capability loss between interpretation and keep.
select pg_temp.returned() as r7 \gset
select pg_temp.act_as('principal@tplco.test');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
select id, 'use_architecture_intelligence', false from public.engagement_members
where engagement_id = :M and user_id = '10000000-0000-4000-8000-000000000003';
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r7'), '42501', null,
  'losing the capability ends keeping');

select * from finish();
rollback;
