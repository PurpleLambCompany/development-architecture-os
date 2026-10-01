-- =============================================================================
-- Phase 7B.1 concurrency (pgTAP). Run with: pnpm db:test. Runs last.
--
-- Two real database sessions (dblink):
--   1. two Principal Architects change Meridian's authorization at the same
--      moment: the engagement's authorization lock serializes them, so the
--      sequence numbers are distinct and consecutive;
--   2. a revocation races an inference being recorded: the recording waits
--      for the revocation to commit and then refuses, so no inference is
--      ever recorded under an authorization that was already withdrawn.
--
-- The racing sessions COMMIT on Meridian (e...01), so this file removes
-- exactly what they wrote at the end (with triggers disabled for the cleanup
-- only).
-- =============================================================================
create temporary table started as select clock_timestamp() as at;

begin;

create extension if not exists dblink with schema extensions;

select plan(6);

create function pg_temp.connect(name text, user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = user_email;
  perform extensions.dblink_connect(name, format(
    'dbname=%s host=%s port=%s user=postgres password=postgres',
    current_database(), host(inet_server_addr()), inet_server_port()));
  perform extensions.dblink_exec(name, format(
    'set request.jwt.claims to %L',
    json_build_object('sub', uid, 'role', 'authenticated')::text));
  perform extensions.dblink_exec(name, 'set role authenticated');
end;
$$;

create function pg_temp.finish_query(name text)
returns text
language plpgsql
as $$
declare
  msg text;
begin
  begin
    perform * from extensions.dblink_get_result(name) as r(result text);
  exception when others then
    msg := sqlerrm;
  end;
  begin
    perform * from extensions.dblink_get_result(name, false) as r(result text);
  exception when others then
    null;
  end;
  return msg;
end;
$$;

create function pg_temp.authorize_sql(note text) returns text language sql as $$
  select format($f$select public.set_engagement_ai_authorization('e0000000-0000-4000-8000-000000000001', 'authorized',
    array['published_architecture', 'working_architecture'], 'openai', 'us', 'synthetic_evaluation', %L, null, 25)::text$f$,
    note);
$$;

select pg_temp.connect('a', 'principal@tplco.test');
select pg_temp.connect('b', 'principal@tplco.test');
select pg_temp.connect('c', 'architect@tplco.test');

-- 1. Two authorization changes at the same moment.
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', pg_temp.authorize_sql('Race A')) as r(x text);
select extensions.dblink_send_query('b', pg_temp.authorize_sql('Race B'));
select pg_sleep(0.5);
select ok(extensions.dblink_is_busy('b') = 1, 'the second change waits for the first');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, '... then completes');
select is((select array_agg(sequence_no order by sequence_no) from public.engagement_ai_authorizations
           where engagement_id = 'e0000000-0000-4000-8000-000000000001' and basis_reference like 'Race%'),
  array[2, 3], 'distinct, consecutive sequence numbers');

-- 2. A revocation racing an inference's recording.
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', $f$select public.set_engagement_ai_authorization('e0000000-0000-4000-8000-000000000001',
  'not_authorized', '{}', null, null, null, null, 'Client paused external processing.', null)::text$f$) as r(x text);
select extensions.dblink_send_query('c', $f$select public.record_architecture_intelligence_request('e0000000-0000-4000-8000-000000000001',
  jsonb_build_object('outcome', 'persisted', 'mode', 'persist', 'inference_kind', 'explanation', 'subject_type', 'element',
    'subject_element_id', 'b3000000-0000-4000-8000-000000000204',
    'authorization_id', (select id from public.engagement_ai_authorizations
      where engagement_id = 'e0000000-0000-4000-8000-000000000001' order by sequence_no desc limit 1),
    'prompt_id', 'explanation', 'prompt_version', 'v1', 'generation_policy_version', 'v1', 'tool_contract_version', '1',
    'provider_key', 'fake', 'requested_model', 'f', 'resolved_model', 'f'),
  jsonb_build_object('output_schema_version', '1', 'assertion', 'A.', 'prompt_content_hash', repeat('a', 64),
    'claims', '[{"text": "c", "cites": ["R1"]}]'::jsonb,
    'basis', (select jsonb_agg(jsonb_build_object('handle', 'R1', 'record_type', record_type, 'record_id', record_id,
      'version_id', version_id, 'data_class', data_class, 'digest', digest, 'origin', 'anchor'))
      from public.ai_context_element('e0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000204'))))::text$f$);
select pg_sleep(0.5);
select ok(extensions.dblink_is_busy('c') = 1, 'the recording waits for the revocation');
select extensions.dblink_exec('a', 'commit');
select ok(pg_temp.finish_query('c') is not null, '... then refuses');
select is((select count(*)::int from public.architecture_inferences
           where engagement_id = 'e0000000-0000-4000-8000-000000000001' and created_at >= (select at from started)), 0,
  'no inference was recorded under a withdrawn authorization');

select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
select extensions.dblink_disconnect('c');

select * from finish();
rollback;

-- Remove what the committed sessions wrote.
begin;
alter table public.architecture_inference_basis disable trigger user;
alter table public.architecture_inferences disable trigger user;
alter table public.architecture_intelligence_requests disable trigger user;
alter table public.engagement_ai_authorizations disable trigger user;
delete from public.architecture_inference_basis b using public.architecture_inferences i
where b.inference_id = i.id and i.created_at >= (select at from started);
delete from public.architecture_inferences where created_at >= (select at from started);
delete from public.architecture_intelligence_requests where completed_at >= (select at from started);
delete from public.engagement_ai_authorizations where authorized_at >= (select at from started);
alter table public.architecture_inference_basis enable trigger user;
alter table public.architecture_inferences enable trigger user;
alter table public.architecture_intelligence_requests enable trigger user;
alter table public.engagement_ai_authorizations enable trigger user;
commit;
