-- =============================================================================
-- Phase 7B.1: the request audit and the engagement budget (pgTAP).
-- Proposal §20, §21; B-21, B-22; OD-10; ADR-0066.
-- Every invocation leaves one metadata-only row; only authorizers read it;
-- the only aggregate is per engagement, never per person.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(34);

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

create function pg_temp.req(outcome text, cost numeric default 0, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('outcome', outcome, 'mode', 'ephemeral', 'inference_kind', 'explanation',
    'subject_type', 'element', 'subject_element_id', 'b3000000-0000-4000-8000-000000000204',
    'provider_key', 'openai', 'requested_model', 'm', 'resolved_model', 'm',
    'input_tokens', case when cost > 0 then 1000 else 0 end, 'estimated_cost_usd', cost) || extra;
$$;
create function pg_temp.rec(outcome text, cost numeric default 0, extra jsonb default '{}') returns uuid language sql as $$
  select public.record_architecture_intelligence_request('e0000000-0000-4000-8000-000000000001',
    pg_temp.req(outcome, cost, extra));
$$;

-- Shape: metadata only.
select hasnt_column('public', 'architecture_intelligence_requests', 'prompt', 'no prompt');
select hasnt_column('public', 'architecture_intelligence_requests', 'response', 'no response');
select hasnt_column('public', 'architecture_intelligence_requests', 'context', 'no context content');
select hasnt_column('public', 'architecture_intelligence_requests', 'error_message', 'no provider error body');

-- Every model outcome an Architect can record.
select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ select pg_temp.rec(o, 0.02) from unnest(array['returned', 'provider_error', 'refusal', 'invalid_output',
  'unknown_citation', 'model_not_evaluated', 'authorization_withdrawn']) o $$, 'every model outcome is recorded');
select lives_ok($$ select pg_temp.rec(o) from unnest(array['refused_mode', 'refused_capability', 'refused_authorization',
  'refused_class', 'refused_budget', 'subject_not_found']) o $$, 'every refusal is recorded');
select throws_ok($$ select pg_temp.rec('refused_budget', 0.5) $$, '23514', null, 'a refusal carries no cost');
select throws_ok($$ select pg_temp.rec('completed') $$, '23514', null, 'an unknown outcome is refused');
select throws_ok($$ select pg_temp.rec('returned', 0.01, jsonb_build_object('requested_at', now() - interval '40 days')) $$,
  '23514', null, 'a request cannot be backdated out of the budget month');
select throws_ok($$ select pg_temp.rec('returned', 0.01, jsonb_build_object('requested_at', clock_timestamp() + interval '1 hour')) $$,
  '23514', null, '... nor placed in the future');
select throws_ok($$ select pg_temp.rec('returned', 0.01, '{"requested_by": "10000000-0000-4000-8000-000000000002"}') $$,
  '23514', null, 'an unknown field is refused');
select throws_ok($$ select pg_temp.rec('returned', 0, '{"error_class": "stack trace: ..."}') $$, '23514', null,
  'an error is only a class');
select throws_ok($$ select pg_temp.rec('returned', 0, '{"manifest": [{"record_type": "element_working", "content": "x"}]}') $$,
  '23514', null, 'the manifest carries no content');
select throws_ok($$ select pg_temp.rec('returned', 0, '{"tool_calls": [{"name": "get_relationships", "result": "x"}]}') $$,
  '23514', null, 'the tool-call log carries no results');
select is((select count(*)::int from public.architecture_intelligence_requests), 0, 'the Architect reads no audit row');
select ok((select monthly_budget_usd from public.architecture_intelligence_budget(:M)) = 25,
  'the Architect sees the engagement budget');
select is((select month_to_date_usd from public.architecture_intelligence_budget(:M)), 0.14::numeric,
  '... and month-to-date cost: 7 × 0.02');

-- A Researcher records refusals only.
select pg_temp.act_as('researcher@tplco.test');
select lives_ok($$ select pg_temp.rec('refused_capability') $$, 'S4: a Researcher''s attempt is audited');
select throws_ok($$ select pg_temp.rec('returned', 0.02) $$, '42501', null, '... but nothing that called a model');
select throws_ok($$ select * from public.architecture_intelligence_budget('e0000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'a Researcher does not see the budget');

select is((select can_use::text || '/' || can_authorize::text || '/' || authorization_state
           from public.architecture_intelligence_standing('e0000000-0000-4000-8000-000000000001')),
  'false/false/authorized', 'a Researcher''s standing: neither use nor authorize');

-- Who reads the audit: authorizers only.
select pg_temp.act_as('principal@tplco.test');
select is((select can_use::text || '/' || can_authorize::text || '/' || data_origin
           from public.architecture_intelligence_standing(:M)), 'true/true/synthetic', 'the Principal Architect''s standing');
select is((select count(*)::int from public.architecture_intelligence_requests where engagement_id = :M), 14,
  'the Principal Architect (authorizer) reads every row');
select is((select requested_by from public.architecture_intelligence_requests where outcome = 'refused_capability'
           and requested_by = '10000000-0000-4000-8000-000000000004'), '10000000-0000-4000-8000-000000000004'::uuid,
  'attributed to who asked, from the session, not the payload');
select is((select count(*)::int from public.architecture_intelligence_requests where engagement_id = :H), 0,
  'nothing on another engagement');
select throws_ok($$ update public.architecture_intelligence_requests set estimated_cost_usd = 0 $$, '42501', null,
  'append-only: no update');
select throws_ok($$ delete from public.architecture_intelligence_requests $$, '42501', null, 'append-only: no delete');
reset role;
select throws_ok($$ update public.architecture_intelligence_requests set estimated_cost_usd = 0 $$, '23514', null,
  'append-only even for the database owner, unless triggers are disabled');
select pg_temp.act_as('projectadmin@tplco.test');
select is((select count(*)::int from public.architecture_intelligence_requests), 0, 'a Project Administrator reads none');
select throws_ok($$ select * from public.architecture_intelligence_budget('e0000000-0000-4000-8000-000000000001') $$,
  '42501', null, '... and no budget');
select pg_temp.act_as('finance@tplco.test');
select is((select count(*)::int from public.architecture_intelligence_requests), 0, 'Finance reads none');

-- Never aggregated per person: no function returns request data grouped by
-- requester, and the only read model over requests is the budget.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosrc ilike '%architecture_intelligence_requests%'),
  2, 'only the budget and the recording operation touch the request audit');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'private') and p.prosrc ilike '%architecture_intelligence_requests%'
             and p.prosrc ~* 'group\s+by[^;]*requested_by'), 'nothing groups requests by person');
select is((select count(*)::int from pg_views where definition ilike '%architecture_intelligence_requests%'), 0,
  'no view over the request audit');

select * from finish();
rollback;
