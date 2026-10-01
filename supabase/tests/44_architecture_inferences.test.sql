-- =============================================================================
-- Phase 7B.1: inferences, pinned basis, the recording operation and
-- staleness (pgTAP). Proposal §13 to §16, §20, §23; B-7, B-12, B-31; OD-11,
-- OD-13; ADR-0064, ADR-0066.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(45);

-- Recording is server-only (ADR-0069): record as the current test user through
-- the service role's one recording path, then return to the caller's role.
create function pg_temp.record_as_server(eng uuid, req jsonb, inf jsonb default null) returns uuid
language plpgsql as $rec$
declare
  r uuid;
  sub uuid := (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
  prior text := current_user;
begin
  execute 'reset role';
  execute 'set local role service_role';
  r := public.record_architecture_intelligence_request_for(sub, eng, req, inf);
  execute format('set local role %I', prior);
  return r;
end;
$rec$;

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

-- A request envelope and an inference over one basis row, as the Gateway
-- builds them.
create function pg_temp.request(outcome text, auth uuid, mode text default 'persist') returns jsonb language sql as $$
  select jsonb_build_object('outcome', outcome, 'mode', mode, 'inference_kind', 'explanation',
    'subject_type', 'impact_trace', 'subject_element_id', 'b3000000-0000-4000-8000-000000000204',
    'authorization_id', auth, 'prompt_id', 'explanation', 'prompt_version', 'v1', 'generation_policy_version', 'v1',
    'tool_contract_version', '1', 'provider_key', 'fake', 'requested_model', 'fake-model', 'resolved_model', 'fake-model',
    'input_tokens', case when outcome like 'refused%' then 0 else 1200 end,
    'output_tokens', case when outcome like 'refused%' then 0 else 300 end,
    'estimated_cost_usd', case when outcome like 'refused%' then 0 else 0.01 end,
    'manifest', '[{"record_type": "element_working"}]'::jsonb, 'tool_calls', '[{"name": "get_relationships"}]'::jsonb);
$$;
create function pg_temp.inference(basis jsonb, cites jsonb default '["R1"]') returns jsonb language sql as $$
  select jsonb_build_object('output_schema_version', '1', 'assertion', 'CAP-004 bears on the founding team.',
    'prompt_content_hash', repeat('a', 64), 'uncertainty', 'Not recorded: timing.',
    'claims', jsonb_build_array(jsonb_build_object('text', 'It is required by the team.', 'cites', cites)),
    'examination', '["Examine CAP-004"]'::jsonb, 'payload', '{"connection": "x"}'::jsonb, 'basis', basis);
$$;
create function pg_temp.basis_for(eng uuid, el uuid, state text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('handle', 'R1', 'record_type', x.record_type, 'record_id', x.record_id,
    'version_id', x.version_id, 'data_class', x.data_class, 'digest', x.digest, 'origin', 'anchor'))
  from public.ai_context_element(eng, el, state) x;
$$;
-- The first relationship of an element, as a second basis row.
create function pg_temp.with_relationship(basis jsonb, eng uuid, el uuid) returns jsonb language sql as $$
  select basis || jsonb_build_array(jsonb_build_object('handle', 'R2', 'record_type', x.record_type,
    'record_id', x.record_id, 'anchor_id', x.anchor_id, 'data_class', x.data_class, 'digest', x.digest,
    'origin', 'tool_call'))
  from (select * from public.ai_context_relationships(eng, el) where not withheld limit 1) x;
$$;
create function pg_temp.record(basis jsonb, kind text default 'explanation') returns uuid language sql as $$
  select pg_temp.record_as_server('e0000000-0000-4000-8000-000000000001',
    jsonb_set(pg_temp.request('persisted', (select id from public.engagement_ai_authorizations
      where engagement_id = 'e0000000-0000-4000-8000-000000000001' order by sequence_no desc limit 1)),
      '{inference_kind}', to_jsonb(kind)),
    pg_temp.inference(basis));
$$;
create function pg_temp.state_of(request uuid) returns text language sql as $$
  select s.state || coalesce(':' || nullif(array_to_string(s.stale_reasons, ','), ''), '')
  from public.architecture_inferences i,
       public.architecture_inference_state('e0000000-0000-4000-8000-000000000001', i.id) s
  where i.request_id = request;
$$;

select (select id from public.engagement_ai_authorizations where engagement_id = :M) as auth \gset

-- Shape.
select col_default_is('public', 'architecture_inferences', 'epistemic_status', 'suggested', 'epistemic status is suggested');
select col_default_is('public', 'architecture_inferences', 'producer', 'model', 'producer is model');
select is((select count(*)::int from pg_trigger where tgrelid in ('public.architecture_inferences'::regclass,
  'public.architecture_inference_basis'::regclass, 'public.architecture_intelligence_requests'::regclass)
  and not tgisinternal and tgfoid::regproc::text like '%activity%'), 0, 'none of the three tables is in the activity log (OD-10)');
select hasnt_column('public', 'architecture_inferences', 'confidence', 'no confidence field');
select hasnt_column('public', 'architecture_inferences', 'significance', 'no significance field');
select hasnt_column('public', 'architecture_inferences', 'score', 'no score field');
select hasnt_column('public', 'architecture_intelligence_requests', 'prompt_text', 'the audit keeps no prompt text');

-- Record a persisted inference over the working state of CAP-004 and one
-- of its relationships.
select pg_temp.act_as('architect@tplco.test');
select pg_temp.with_relationship(pg_temp.basis_for(:M, :CAP, 'working'), :M, :CAP) as basis \gset
select lives_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('persisted', %L),
  pg_temp.inference(%L)) $$, 'e0000000-0000-4000-8000-000000000001', :'auth', :'basis'), 'an Architect records an inference');
select is((select count(*)::int from public.architecture_inferences), 1, 'one inference');
select is((select epistemic_status || '/' || producer from public.architecture_inferences), 'suggested/model',
  'suggested, model');
select is((select requested_by from public.architecture_inferences), '10000000-0000-4000-8000-000000000003'::uuid,
  'attributed to the requester');
select is((select authorization_id from public.architecture_inferences), :'auth'::uuid, 'under the authorization in force');
select is((select string_agg(handle || ':' || cited || ':' || digest_version, ',' order by handle)
           from public.architecture_inference_basis), 'R1:true:1,R2:false:1',
  'two basis rows, digest version 1, only the cited one marked cited');
select is((select element_id from public.architecture_inference_basis where handle = 'R1'), :CAP::uuid,
  'typed element identity kept');
select is((select count(*)::int from public.architecture_intelligence_requests), 0,
  'the Architect cannot read the request audit (authorizers only)');
select is((select state from public.architecture_inference_state(:M)), 'current', 'current');
select request_id as first_request from public.architecture_inferences \gset

-- Refusals on recording.
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('persisted', %L),
  pg_temp.inference(%L)) $$, 'e0000000-0000-4000-8000-000000000001', :'auth',
  jsonb_set(:'basis'::jsonb, '{0,digest}', to_jsonb(repeat('b', 64)))), '23514', null,
  'a basis whose digest is not what DSA provided is refused');
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('persisted', %L),
  pg_temp.inference(%L)) $$, 'e0000000-0000-4000-8000-000000000001', :'auth',
  jsonb_set(:'basis'::jsonb, '{0,data_class}', '"evidence_metadata"')), '23514', null, 'a relabelled class is refused');
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('persisted', %L),
  pg_temp.inference(%L)) $$, 'e0000000-0000-4000-8000-000000000001', :'auth',
  jsonb_set(:'basis'::jsonb, '{0,record_id}', '"b3000000-0000-4000-8000-000000000a01"')), '23514', null,
  'another engagement''s record cannot be a basis');
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('persisted', %L),
  pg_temp.inference(%L, '["R9"]')) $$, 'e0000000-0000-4000-8000-000000000001', :'auth', :'basis'), '23514', null,
  'a claim citing something not provided is refused');
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('persisted', %L),
  pg_temp.inference(%L, '[]')) $$, 'e0000000-0000-4000-8000-000000000001', :'auth', :'basis'), '23514', null,
  'an uncited claim is refused');
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('persisted', %L),
  pg_temp.inference('[]')) $$, 'e0000000-0000-4000-8000-000000000001', :'auth'), '23514', null,
  'an inference without basis is refused');
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('returned', %L),
  pg_temp.inference(%L)) $$, 'e0000000-0000-4000-8000-000000000001', :'auth', :'basis'), '23514', null,
  'only a persisted outcome carries an inference');
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('persisted', %L, 'ephemeral'),
  pg_temp.inference(%L)) $$, 'e0000000-0000-4000-8000-000000000001', :'auth', :'basis'), '23514', null,
  'an ephemeral request never persists');
select throws_ok(format($$ select pg_temp.record_as_server(%L,
  jsonb_set(pg_temp.request('persisted', %L), '{inference_kind}', '"link_suggestion"'), pg_temp.inference(%L)) $$,
  'e0000000-0000-4000-8000-000000000001', :'auth', :'basis'), '23514', null,
  'link_suggestion is not an approved kind (B-15)');
select throws_ok($$ update public.architecture_inferences set assertion = 'changed' $$, '42501', null, 'no update privilege');
select throws_ok($$ delete from public.architecture_inference_basis $$, '42501', null, 'no delete privilege');
select throws_ok($$ insert into public.architecture_inferences (engagement_id) values ('e0000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'never inserted directly');

-- A Researcher without use: only a refusal can be recorded, and nothing read.
select pg_temp.act_as('researcher@tplco.test');
select lives_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('refused_capability', null, 'ephemeral')) $$,
  'e0000000-0000-4000-8000-000000000001'), 'S4: the refusal is audited');
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('returned', %L, 'ephemeral')) $$,
  'e0000000-0000-4000-8000-000000000001', :'auth'), '42501', null, '... but not a model outcome');
select is((select count(*)::int from public.architecture_inferences), 0, 'OD-11: a Researcher reads no inference');
select is((select count(*)::int from public.architecture_inference_basis), 0, '... and no basis');
select throws_ok($$ select * from public.architecture_inference_state('e0000000-0000-4000-8000-000000000001') $$,
  '42501', null, '... and no staleness');

-- The authorization changes during a request.
select pg_temp.act_as('principal@tplco.test');
select public.set_engagement_ai_authorization(:M, 'authorized',
  array['published_architecture', 'working_architecture', 'project_intelligence', 'evidence_metadata'], 'openai', 'us',
  'synthetic_evaluation', 'Budget raised', null, 50);
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select pg_temp.record_as_server(%L, pg_temp.request('persisted', %L),
  pg_temp.inference(%L)) $$, 'e0000000-0000-4000-8000-000000000001', :'auth', :'basis'), '42501', null,
  'a new authorization during the request refuses persistence');
select lives_ok(format($$ select pg_temp.record_as_server(%L,
  pg_temp.request('authorization_withdrawn', %L, 'persist')) $$, 'e0000000-0000-4000-8000-000000000001', :'auth'),
  '... and the withdrawal is audited');

-- Staleness (§16.4), computed on read.
reset role;
update public.architecture_elements set updated_at = updated_at + interval '1 second' where id = :CAP;
select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.state_of(:'first_request'), 'current', 'a change outside the projection: still current');
reset role;
update public.architecture_elements set summary = summary || ' Revised.' where id = :CAP;
select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.state_of(:'first_request'), 'stale:basis_changed', 'a projected change: stale, basis_changed');

-- Supersession: a later inference of the same kind on the same subject.
select pg_temp.record(pg_temp.basis_for(:M, :CAP, 'working')) as second_request \gset
select is(pg_temp.state_of(:'second_request'), 'current', 'the new inference is current');
select pg_temp.record(pg_temp.basis_for(:M, :CAP, 'working')) as third_request \gset
select is(pg_temp.state_of(:'second_request'), 'superseded', 'the earlier one is superseded, not deleted');

-- A pinned published version goes stale when a newer one is published.
select pg_temp.record(pg_temp.basis_for(:M, :CAP, 'published'), 'tension') as published_request \gset
select is(pg_temp.state_of(:'published_request'), 'current', 'pinned to the latest published version: current');
select public.publish_element_version(:CAP, 'A further revision.');
select is(pg_temp.state_of(:'published_request'), 'stale:newer_version_published', 'newer_version_published');

-- A relationship in the basis is retired: basis_removed.
select pg_temp.record(pg_temp.with_relationship(pg_temp.basis_for(:M, :CAP, 'working'), :M, :CAP), 'review_brief')
  as rel_request \gset
select public.retire_relationship((select record_id from public.architecture_inference_basis b
  join public.architecture_inferences i on i.id = b.inference_id where i.request_id = :'rel_request' and b.handle = 'R2'),
  'Superseded in review.');
select is(pg_temp.state_of(:'rel_request'), 'stale:basis_removed', 'basis_removed');

-- A class is no longer authorized.
select pg_temp.act_as('principal@tplco.test');
select public.set_engagement_ai_authorization(:M, 'authorized', array['published_architecture'], 'openai', 'us',
  'synthetic_evaluation', 'Narrowed', null, 50);
select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.state_of(:'third_request'), 'stale:class_no_longer_authorised', 'class_no_longer_authorised');

-- OD-11: when the use capability is revoked, the inferences are no longer
-- readable by that person; they are not deleted.
select pg_temp.act_as('principal@tplco.test');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
select id, 'use_architecture_intelligence', false from public.engagement_members
where engagement_id = :M and user_id = '10000000-0000-4000-8000-000000000003';
select is((select count(*)::int from public.architecture_inferences), 5, 'the Principal Architect still reads them');
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.architecture_inferences), 0, 'the Architect, revoked, reads none');

select * from finish();
rollback;
