-- =============================================================================
-- Phase 7B.2: availability, suppression, reuse, Suggested interpretations,
-- the kept register and the deterministic dossiers (pgTAP). Proposal §7 to
-- §9, §16, §20, §26; PD-7, PD-9, PD-13a, PD-14 to PD-16; ADR-0067, ADR-0068,
-- ADR-0072.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(38);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

\set M '''e0000000-0000-4000-8000-000000000001'''
\set H '''e0000000-0000-4000-8000-000000000003'''
\set CAP '''b3000000-0000-4000-8000-000000000204'''
\set CAP1 '''b3000000-0000-4000-8000-000000000201'''

create function pg_temp.request(kind text, subject_type text, el uuid, resolved text default 'dsa-fake-model-1')
returns jsonb language sql as $$
  select jsonb_build_object('outcome', 'returned', 'mode', 'ephemeral', 'inference_kind', kind,
    'subject_type', subject_type, 'subject_element_id', el,
    'authorization_id', (select id from public.engagement_ai_authorizations
      where engagement_id = 'e0000000-0000-4000-8000-000000000001' order by sequence_no desc limit 1),
    'prompt_id', kind, 'prompt_version', 'v2', 'generation_policy_version', 'v2', 'tool_contract_version', '1',
    'provider_key', 'fake', 'requested_model', 'dsa-fake-model-1', 'resolved_model', resolved,
    'input_tokens', 1200, 'output_tokens', 300, 'estimated_cost_usd', 0.01,
    'manifest', '[{"record_type": "element_working"}]'::jsonb, 'tool_calls', '[]'::jsonb);
$$;
create function pg_temp.inference(el uuid, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('output_schema_version', '2', 'assertion', 'A suggested reading.',
    'prompt_content_hash', repeat('a', 64), 'uncertainty', '',
    'claims', '[{"text": "It reads the record.", "cites": ["R1"]}]'::jsonb,
    'examination', '[]'::jsonb, 'payload', '{}'::jsonb,
    'basis', (select jsonb_build_array(jsonb_build_object('handle', 'R1', 'record_type', x.record_type,
      'record_id', x.record_id, 'version_id', x.version_id, 'data_class', x.data_class, 'digest', x.digest,
      'origin', 'anchor'))
      from public.ai_context_element('e0000000-0000-4000-8000-000000000001', el, 'working') x)) || extra;
$$;
-- Interpret and keep, as the signed-in user.
create function pg_temp.keep(kind text, subject_type text, el uuid, extra jsonb default '{}',
  resolved text default 'dsa-fake-model-1') returns uuid language sql as $$
  select public.keep_architecture_inference('e0000000-0000-4000-8000-000000000001',
    public.record_architecture_intelligence_request('e0000000-0000-4000-8000-000000000001',
      pg_temp.request(kind, subject_type, el, resolved), pg_temp.inference(el, extra)));
$$;
create function pg_temp.avail(kind text, subject jsonb) returns text language sql as $$
  select a.rule_holds::text || '/' || coalesce(a.latest_state, '-') || '/' || a.suppressed::text
  from public.architecture_intelligence_availability('e0000000-0000-4000-8000-000000000001', kind, subject) a;
$$;
create function pg_temp.reuse(subject jsonb) returns uuid language sql as $$
  select inference_id from public.current_architecture_inference('e0000000-0000-4000-8000-000000000001',
    'explanation', subject, 'v2', 'fake', 'dsa-fake-model-1');
$$;

select private.business_today() as today \gset

-- The seed's authorization names openai; Step A acceptance authorizes the fake provider.
select pg_temp.act_as('principal@tplco.test');
select public.set_engagement_ai_authorization(:M, 'authorized',
  array['published_architecture', 'working_architecture', 'project_intelligence', 'evidence_metadata'], 'fake', 'us',
  'synthetic_evaluation', 'Step A acceptance', null, 25);

-- Availability rules (§9), computed in the database.
select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.avail('explanation', jsonb_build_object('type', 'revision', 'element_id', :CAP1, 'version_id',
  (select id from public.element_versions where element_id = :CAP1 and version_no = 2))),
  'true/-/false', 'a substantive revision that changed statements is offered');
select is(pg_temp.avail('explanation', jsonb_build_object('type', 'revision', 'element_id', :CAP1, 'version_id',
  (select id from public.element_versions where element_id = :CAP1 and version_no = 1))),
  'false/-/false', 'a first publication is not a revision');
select is((select reason from public.architecture_intelligence_availability(:M, 'explanation',
  jsonb_build_object('type', 'revision', 'element_id', :CAP1, 'version_id',
  (select id from public.element_versions where element_id = :CAP1 and version_no = 2)))),
  'v2 of CAP-001 changed its statements', 'the reason is shown as written by the rule');
select throws_ok(format($$ select pg_temp.avail('ranking', '{"type": "element", "element_id": "%s"}') $$, :CAP),
  '23514', null, 'no other kind');
select pg_temp.act_as('researcher@tplco.test');
select throws_ok(format($$ select pg_temp.avail('explanation', '{"type": "impact_trace", "element_id": "%s"}') $$, :CAP),
  '42501', null, 'IX-18: availability does not answer a non-holder');
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok(format($$ select pg_temp.avail('explanation', '{"type": "impact_trace", "element_id": "%s"}') $$, :CAP),
  'P0002', null, '... nor a client');

-- Reuse (IX-13, PD-13a).
select pg_temp.act_as('architect@tplco.test');
select pg_temp.keep('explanation', 'impact_trace', :CAP) as k1 \gset
select is(pg_temp.reuse(jsonb_build_object('type', 'impact_trace', 'element_id', :CAP)), :'k1'::uuid,
  'a current kept interpretation with the same prompt and model is reused');
select is((select inference_id from public.current_architecture_inference(:M, 'explanation',
  jsonb_build_object('type', 'impact_trace', 'element_id', :CAP), 'v1', 'fake', 'dsa-fake-model-1')), null,
  'not across a prompt version');
select is((select inference_id from public.current_architecture_inference(:M, 'explanation',
  jsonb_build_object('type', 'impact_trace', 'element_id', :CAP), 'v2', 'openai', 'dsa-fake-model-1')), null,
  'not across a provider');
select is(pg_temp.reuse(jsonb_build_object('type', 'element', 'element_id', :CAP)), null, 'not across a subject');
-- The same requested model now resolves to another model: reuse ends (invariant 2).
select public.record_architecture_intelligence_request(:M,
  pg_temp.request('explanation', 'impact_trace', :CAP1, 'dsa-fake-model-2') || '{"outcome": "nothing_to_add"}');
select is(pg_temp.reuse(jsonb_build_object('type', 'impact_trace', 'element_id', :CAP)), null,
  'invariant 2: never reused across a resolved-model change');
select public.record_architecture_intelligence_request(:M,
  pg_temp.request('explanation', 'impact_trace', :CAP1, 'dsa-fake-model-1') || '{"outcome": "nothing_to_add"}');
select is(pg_temp.reuse(jsonb_build_object('type', 'impact_trace', 'element_id', :CAP)), :'k1'::uuid,
  '... and resumes only when the requested model resolves to the same model again');

-- Suppression (IX-14, PD-14): engagement-wide until the basis changes.
select public.record_architecture_inference_judgment(:M, :'k1', 'not_material', 'Known.');
select ok((select suppressed and latest_state = 'current' from public.architecture_intelligence_availability(:M,
  'explanation', jsonb_build_object('type', 'impact_trace', 'element_id', :CAP))), 'not material suppresses');
select pg_temp.act_as('principal@tplco.test');
select ok((select suppressed from public.architecture_intelligence_availability(:M, 'explanation',
  jsonb_build_object('type', 'impact_trace', 'element_id', :CAP))), '... for every holder on the engagement');
reset role;
update public.architecture_elements set summary = summary || ' Revised.' where id = :CAP;
select pg_temp.act_as('architect@tplco.test');
select ok(not (select suppressed from public.architecture_intelligence_availability(:M, 'explanation',
  jsonb_build_object('type', 'impact_trace', 'element_id', :CAP))), 'a basis change ends suppression');
select is(pg_temp.reuse(jsonb_build_object('type', 'impact_trace', 'element_id', :CAP)), null, 'and a stale one is not reused');

-- Suggested interpretations (IX-17).
select pg_temp.keep('tension', 'element_pair', :CAP1,
  jsonb_build_object('subject_second_element_id', 'b3000000-0000-4000-8000-000000000204')) as t1 \gset
select pg_temp.keep('explanation', 'impact_trace', :CAP1) as e1 \gset
select is((select array_agg(inference_kind) from public.suggested_interpretations(:M)), array['tension'],
  'only tension, bearing and comparison kinds; never an explanation');
select is((select count(*)::int from public.suggested_interpretations(:M) where inference_id = :'k1'), 0,
  'a stale one is not suggested');
select public.record_architecture_inference_judgment(:M, :'t1', 'investigating');
select is((select judgment_kind from public.suggested_interpretations(:M) where inference_id = :'t1'), 'investigating',
  'PD-15: investigating stays listed');
select public.record_architecture_inference_judgment(:M, :'t1', 'deferred', 'Later.', :'today'::date + 7);
select is((select count(*)::int from public.suggested_interpretations(:M)), 0, 'a deferral removes it until its date');
reset role;
alter table public.architecture_inference_judgments disable trigger user;
update public.architecture_inference_judgments set expires_on = private.business_today() where inference_id = :'t1'
  and judgment_kind = 'deferred';
alter table public.architecture_inference_judgments enable trigger user;
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.suggested_interpretations(:M)), 1, 'PD-15: an expired deferral returns');
select is((select count(*)::int from public.edge_items(:M) where producer = 'model'), 0,
  'the Edge envelope is unchanged: nothing from a model in it');
select hasnt_column('public', 'architecture_inferences', 'tier', 'a kept interpretation has no tier');
select pg_temp.act_as('researcher@tplco.test');
select is((select count(*)::int from public.suggested_interpretations(:M)), 0, 'nothing for a non-holder');
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok($$ select * from public.suggested_interpretations('e0000000-0000-4000-8000-000000000001') $$,
  'P0002', null, '... and nothing for a client');

-- The register (PD-16).
select pg_temp.act_as('principal@tplco.test');
select is((select count(*)::int from public.kept_architecture_inferences(:M)), 3, 'every kept interpretation is listed');
select is((select count(*)::int from public.kept_architecture_inferences(:M, null, 'stale')), 1, 'filterable by state');
select is((select count(*)::int from public.kept_architecture_inferences(:M, 'tension')), 1, '... and by kind');
select hasnt_column('public', 'architecture_inference_judgments', 'rank', 'no ranking');
select pg_temp.act_as('researcher@tplco.test');
select is((select count(*)::int from public.kept_architecture_inferences(:M)), 0, 'the register is empty for a non-holder');
select throws_ok(format($$ select public.architecture_inference_detail(%L, %L) $$, :M, :'t1'), '42501', null,
  '... and an interpretation''s detail is refused');

-- Review briefs (PD-7): visible to every holder; the newest supersedes.
select pg_temp.act_as('architect@tplco.test');
select pg_temp.keep('review_brief', 'element', :CAP) as b1 \gset
select pg_temp.act_as('principal@tplco.test');
select pg_temp.keep('review_brief', 'element', :CAP) as b2 \gset
select is((select state from public.architecture_inference_state(:M, :'b1')), 'superseded',
  'a newer kept brief supersedes the older for display');
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.architecture_inferences where id in (:'b1', :'b2')), 2,
  '... the history is kept, and every holder reads it');

-- Deterministic dossiers (PD-9, §8): every internal reader, never a client.
select pg_temp.act_as('researcher@tplco.test');
select ok((select jsonb_typeof(public.element_supports_and_exposures(:M, :CAP1) -> 'evidence') = 'array'),
  'supports and exposures for any internal reader');
select ok(jsonb_array_length(public.element_supports_and_exposures(:M, :CAP1) -> 'evidence') > 0,
  '... with the evidence linked to it');
select pg_temp.act_as('principal@tplco.test');
select is((public.review_dossier(:H, (select id from public.architecture_elements where engagement_id = :H
  and reference_code = 'REV-001')) -> 'review' ->> 'status'), 'held', 'the Review dossier for an internal reader');
select is(jsonb_array_length(public.review_dossier(:H, (select id from public.architecture_elements
  where engagement_id = :H and reference_code = 'REV-001')) -> 'examined'), 2, '... in the examined set as captured');
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok(format($$ select public.element_supports_and_exposures(%L, %L) $$, :M, :CAP1), 'P0002', null,
  'never for a client');

select * from finish();
rollback;
