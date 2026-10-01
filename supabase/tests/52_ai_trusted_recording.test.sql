-- Phase 7B.2 (Kerrick's Step A review, ADR-0069): recording is server-only.
-- No browser session can create a request, a pending interpretation or an
-- inference, so no model text can come from a browser. The one recording
-- path is executable only by service_role, records as a real requester with
-- every check of the recording operation, and cannot cross engagements.
begin;
select plan(35);

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

create function pg_temp.auth() returns uuid language sql security definer as $$
  select id from public.engagement_ai_authorizations
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' order by sequence_no desc limit 1;
$$;
create function pg_temp.request(outcome text, mode text default 'ephemeral') returns jsonb language sql as $$
  select jsonb_build_object('outcome', outcome, 'mode', mode, 'inference_kind', 'explanation',
    'subject_type', 'impact_trace', 'subject_element_id', 'b3000000-0000-4000-8000-000000000204',
    'authorization_id', pg_temp.auth(), 'prompt_id', 'explanation', 'prompt_version', 'v2',
    'generation_policy_version', 'v2', 'tool_contract_version', '2', 'provider_key', 'fake',
    'requested_model', 'dsa-fake-model-1', 'resolved_model', 'dsa-fake-model-1',
    'input_tokens', 1200, 'output_tokens', 300, 'estimated_cost_usd', 0.01,
    'manifest', '[{"record_type": "element_working"}]'::jsonb, 'tool_calls', '[]'::jsonb);
$$;
-- Built as the test owner: the basis is what DSA would emit to the requester (the
-- server key itself executes no Tool Contract function).
create function pg_temp.inference(assertion text default 'CAP-004 bears on the founding team.') returns jsonb
language sql security definer as $$
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
  select pg_temp.record_as_server('e0000000-0000-4000-8000-000000000001',
    pg_temp.request('returned'), pg_temp.inference(assertion));
$$;
create function pg_temp.counts() returns text language sql security definer as $$
  select (select count(*) from public.architecture_intelligence_requests) || '/'
      || (select count(*) from public.pending_architecture_inferences) || '/'
      || (select count(*) from public.architecture_inferences);
$$;
select pg_temp.counts() as before \gset

-- Privileges: only the server's key can record, and only through the one path.
select ok(not has_function_privilege('authenticated', 'public.record_architecture_intelligence_request(uuid, jsonb, jsonb)', 'execute'),
  'a signed-in user cannot call the recording operation');
select ok(not has_function_privilege('anon', 'public.record_architecture_intelligence_request(uuid, jsonb, jsonb)', 'execute'),
  'nor can anon');
select ok(not has_function_privilege('service_role', 'public.record_architecture_intelligence_request(uuid, jsonb, jsonb)', 'execute'),
  'nor the server key, except through the recording path');
select ok(not has_function_privilege('authenticated', 'public.record_architecture_intelligence_request_for(uuid, uuid, jsonb, jsonb)', 'execute'),
  'a signed-in user cannot call the server recording path');
select ok(not has_function_privilege('anon', 'public.record_architecture_intelligence_request_for(uuid, uuid, jsonb, jsonb)', 'execute'),
  'nor can anon');
select ok(has_function_privilege('service_role', 'public.record_architecture_intelligence_request_for(uuid, uuid, jsonb, jsonb)', 'execute'),
  'the server key can');
select is((select count(*)::int from information_schema.role_table_grants
           where grantee in ('service_role', 'authenticated', 'anon') and table_schema = 'public'
             and table_name in ('architecture_intelligence_requests', 'architecture_inferences', 'architecture_inference_basis',
                                'pending_architecture_inferences', 'architecture_inference_judgments')
             and privilege_type <> 'SELECT'), 0,
  'no API role, the server key included, can write or truncate an AI table directly');
select is((select count(*)::int from information_schema.role_table_grants
           where grantee = 'service_role' and table_schema = 'public'
             and table_name in ('architecture_intelligence_requests', 'architecture_inferences', 'architecture_inference_basis',
                                'pending_architecture_inferences', 'architecture_inference_judgments',
                                'engagement_ai_authorizations')), 0,
  'the server key holds no privilege on the AI tables at all');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname ~ '^ai_context_|architecture_intelligence|architecture_inference|^set_engagement_ai_authorization$|^suggested_interpretations$|^kept_architecture_inferences$'
             and p.proname <> 'record_architecture_intelligence_request_for'
             and has_function_privilege('service_role', p.oid, 'execute')), 0,
  'nor can it execute any other Architecture Intelligence function');

-- An ordinary holder cannot manufacture a pending interpretation from the browser.
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select public.record_architecture_intelligence_request(%L, %L::jsonb, %L::jsonb) $$,
  :M, pg_temp.request('returned'), pg_temp.inference('Manufactured in the browser.')), '42501', null,
  'a holder calling the recording operation directly is refused');
select throws_ok(format($$ select public.record_architecture_intelligence_request_for(auth.uid(), %L, %L::jsonb, %L::jsonb) $$,
  :M, pg_temp.request('returned'), pg_temp.inference('Manufactured in the browser.')), '42501', null,
  '... and calling the server path directly is refused');
select throws_ok(format($$ insert into public.pending_architecture_inferences (request_id, engagement_id, requested_by, inference, expires_at)
  values (gen_random_uuid(), %L, auth.uid(), '{}', now() + interval '1 minute') $$, :M), '42501', null,
  '... and writing a pending interpretation directly is refused');
select throws_ok(format($$ select public.record_architecture_intelligence_request(%L, %L::jsonb) $$, :M,
  pg_temp.request('nothing_to_add')), '42501', null, '... as is forging an audit row');
select pg_temp.act_as('principal@tplco.test');
select throws_ok(format($$ select public.record_architecture_intelligence_request(%L, %L::jsonb, %L::jsonb) $$,
  :M, pg_temp.request('persisted', 'persist'), pg_temp.inference('Manufactured.')), '42501', null,
  'a Principal Architect cannot either, in persist mode');
reset role;
select is(pg_temp.counts(), :'before', 'nothing was written by any attempt');

-- The server key, too, cannot write a pending interpretation except through the path.
set local role service_role;
select throws_ok(format($$ insert into public.pending_architecture_inferences (request_id, engagement_id, requested_by, inference, expires_at)
  values (gen_random_uuid(), %L, '10000000-0000-4000-8000-000000000003', '{}', now() + interval '1 minute') $$, :M),
  '42501', null, 'the server key cannot write a pending interpretation directly');
select throws_ok($$ truncate public.architecture_inferences $$, '42501', null, '... nor truncate an AI table');
reset role;

-- The path records only for a real person who could have made the request.
select pg_temp.act_as('architect@tplco.test');
set local role service_role;
select throws_ok(format($$ select public.record_architecture_intelligence_request_for(gen_random_uuid(), %L, %L::jsonb, %L::jsonb) $$,
  :M, pg_temp.request('returned'), pg_temp.inference()), '42501', null, 'not for an unknown person');
select throws_ok(format($$ select public.record_architecture_intelligence_request_for(
  '20000000-0000-4000-8000-000000000002', %L, %L::jsonb, %L::jsonb) $$,
  :M, pg_temp.request('returned'), pg_temp.inference()), 'P0002', null, 'not for a client');
select throws_ok(format($$ select public.record_architecture_intelligence_request_for(
  '10000000-0000-4000-8000-000000000005', %L, %L::jsonb, %L::jsonb) $$,
  :M, pg_temp.request('returned'), pg_temp.inference()), '42501', null, 'not for a reader without the use capability');
-- Cross-engagement: the architect is not a member of the proposed engagement,
-- and a basis from one engagement does not verify on another.
select throws_ok(format($$ select public.record_architecture_intelligence_request_for(
  '10000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000003', %L::jsonb, %L::jsonb) $$,
  pg_temp.request('returned'), pg_temp.inference()), 'P0002', null, 'not on an engagement the person cannot read');
select throws_ok(format($$ select public.record_architecture_intelligence_request_for(
  '10000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003', %L::jsonb, %L::jsonb) $$,
  pg_temp.request('returned'), pg_temp.inference()), null, null,
  'not on another engagement with this engagement''s authorization and basis');
reset role;
select is(auth.uid(), '10000000-0000-4000-8000-000000000003'::uuid,
  'a refused recording leaves the session''s identity as it was');
select is(pg_temp.counts(), :'before', 'still nothing written');

-- The legitimate path: held for its requester only, and kept exactly.
select pg_temp.act_as('architect@tplco.test');
select pg_temp.record_as_server(:M, pg_temp.request('returned'), pg_temp.inference('Exactly what the Gateway validated.')) as r1 \gset
reset role;
select is((select requested_by from public.pending_architecture_inferences where request_id = :'r1'),
  '10000000-0000-4000-8000-000000000003'::uuid, 'held for the verified requester');
select pg_temp.act_as('principal@tplco.test');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r1'), '23514', null,
  'another holder cannot keep it');
select pg_temp.act_as('architect@tplco.test');
select lives_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r1'), 'the requester keeps it');
reset role;
select is((select assertion from public.architecture_inferences where request_id = :'r1'),
  'Exactly what the Gateway validated.', 'the kept text is exactly the recorded text');
select is((select requested_by from public.architecture_inferences where request_id = :'r1'),
  '10000000-0000-4000-8000-000000000003'::uuid, 'attributed to the requester');
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'r1'), '23514', null,
  'and only once');

-- Keep and keep-with-judgment take no text from the browser.
select is(pg_get_function_arguments('public.keep_architecture_inference(uuid, uuid, jsonb)'::regprocedure),
  'p_engagement_id uuid, p_request_id uuid, p_judgment jsonb DEFAULT NULL::jsonb',
  'Keep names a request and an optional judgment, never text');
select pg_temp.record_as_server(:M, pg_temp.request('returned'), pg_temp.inference('Validated text, judged on keeping.')) as r2 \gset
select throws_ok(format($$ select public.keep_architecture_inference(%L, %L, %L::jsonb) $$, :M, :'r2',
  '{"kind": "investigating", "assertion": "Text from the browser."}'), '23514', null,
  'text smuggled into a judgment is refused');
select public.keep_architecture_inference(:M, :'r2', '{"kind": "investigating"}'::jsonb);
reset role;
select is((select assertion from public.architecture_inferences where request_id = :'r2'),
  'Validated text, judged on keeping.', 'judging keeps exactly the recorded text');

-- The requester's identity never outlives the recording call.
select pg_temp.act_as('principal@tplco.test');
set local role service_role;
select public.record_architecture_intelligence_request_for('10000000-0000-4000-8000-000000000003', :M,
  pg_temp.request('returned'), pg_temp.inference('Recorded for the Architect.')) as r3 \gset
reset role;
select is((select requested_by from public.pending_architecture_inferences where request_id = :'r3'),
  '10000000-0000-4000-8000-000000000003'::uuid, 'the server records for the person it names');
select is(auth.uid(), '10000000-0000-4000-8000-000000000002'::uuid,
  'and the calling session''s identity is restored afterwards');

select * from finish();
rollback;
