-- =============================================================================
-- Phase 7B.2: extended no-mutation proofs for the experience (pgTAP).
-- Proposal §29, §30; ADR-0067 to ADR-0072. The read models and dossiers
-- change nothing; keeping writes only the inference, its basis and (when
-- judging) its judgment; judging writes only the judgment. Architecture
-- Intelligence never mutates governed DSA state.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(14);

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

-- Every table in public: name, row count and an order-independent content
-- hash. Taken as the database owner, so RLS hides nothing.
create function pg_temp.fingerprint(except_tables text[] default '{}') returns text language plpgsql as $$
declare t record; h text; acc text := '';
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> all (except_tables)
           order by c.relname loop
    execute format('select count(*) || '':'' || coalesce(md5(string_agg(md5(x::text), '''' order by md5(x::text))), '''') from public.%I x', t.relname)
      into h;
    acc := acc || t.relname || '=' || h || ';';
  end loop;
  return md5(acc);
end;
$$;

-- Run a statement as the current role and report its SQLSTATE ('ok' when it
-- succeeded). Never lets an error abort the test.
create function pg_temp.try(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

\set M '''e0000000-0000-4000-8000-000000000001'''
\set H '''e0000000-0000-4000-8000-000000000003'''
\set CAP '''b3000000-0000-4000-8000-000000000204'''
\set CAP1 '''b3000000-0000-4000-8000-000000000201'''

select id as rev from public.architecture_elements where engagement_id = :H and reference_code = 'REV-001' \gset

-- 0. Static: every 7B.2 read model is STABLE and contains no write, dynamic
-- SQL or guard switch.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('architecture_intelligence_availability',
             'current_architecture_inference', 'architecture_inference_detail', 'suggested_interpretations',
             'kept_architecture_inferences', 'review_dossier', 'element_supports_and_exposures')
             and (p.provolatile <> 's'
                  or p.prosrc ~* '\m(insert|update|delete|merge|truncate|copy|execute|set_config|nextval|setval)\M')), 0,
  'the read models and dossiers are STABLE and contain no write');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname in ('ai_availability_rule', 'inference_matches',
             'latest_kept_inference', 'ai_basis_label', 'ai_element_governance_date', 'ai_person_name',
             'same_inference_subject', 'inference_latest_judgment', 'inference_is_current', 'verify_inference_basis')
             and p.prosrc ~* '\m(insert|update|delete|merge|truncate|copy|execute|set_config|nextval|setval)\M'), 0,
  'their helpers, and basis verification, contain no write');
select set_eq($$ select distinct (regexp_matches(p.prosrc, '\m(?:insert\s+into|update|delete\s+from)\s+public\.(\w+)', 'gi'))[1]
                 from pg_proc p where p.proname in ('keep_architecture_inference', 'insert_architecture_inference',
                   'record_inference_judgment_row', 'record_architecture_inference_judgment') $$,
  array['architecture_inferences', 'architecture_inference_basis', 'architecture_inference_judgments',
        'pending_architecture_inferences'],
  'keeping and judging name only the inference, its basis, its judgment and the held output');
select ok(not exists (select 1 from pg_trigger where tgrelid in ('public.architecture_inference_judgments'::regclass,
  'public.pending_architecture_inferences'::regclass) and not tgisinternal and tgfoid::regproc::text like '%activity%'),
  'neither new table writes to the activity log');

select pg_temp.act_as('principal@tplco.test');
select public.set_engagement_ai_authorization(:M, 'authorized',
  array['published_architecture', 'working_architecture', 'project_intelligence', 'evidence_metadata'], 'fake', 'us',
  'synthetic_evaluation', 'Step A acceptance', null, 25);

-- An interpretation held for keeping (the audit row and the hold are the
-- recording operation's writes, proved in 7B.1 and test 48).
select pg_temp.act_as('architect@tplco.test');
select pg_temp.record_as_server(:M,
  jsonb_build_object('outcome', 'returned', 'mode', 'ephemeral', 'inference_kind', 'explanation',
    'subject_type', 'impact_trace', 'subject_element_id', :CAP,
    'authorization_id', (select id from public.engagement_ai_authorizations where engagement_id = :M
      order by sequence_no desc limit 1),
    'prompt_id', 'explanation', 'prompt_version', 'v2', 'generation_policy_version', 'v2', 'tool_contract_version', '2',
    'provider_key', 'fake', 'requested_model', 'dsa-fake-model-1', 'resolved_model', 'dsa-fake-model-1',
    'input_tokens', 1200, 'output_tokens', 300, 'estimated_cost_usd', 0.01,
    'manifest', '[{"record_type": "element_working"}]'::jsonb, 'tool_calls', '[]'::jsonb),
  jsonb_build_object('output_schema_version', '2', 'assertion', 'A reading.', 'prompt_content_hash', repeat('a', 64),
    'uncertainty', '', 'claims', '[{"text": "It reads it.", "cites": ["R1"]}]'::jsonb, 'examination', '[]'::jsonb,
    'payload', '{}'::jsonb,
    'basis', (select jsonb_build_array(jsonb_build_object('handle', 'R1', 'record_type', x.record_type,
      'record_id', x.record_id, 'version_id', x.version_id, 'data_class', x.data_class, 'digest', x.digest,
      'origin', 'anchor')) from public.ai_context_element(:M, :CAP, 'working') x))) as req \gset

-- 1. Every read model, as a holder, a non-holder and a client: nothing changes.
reset role;
select pg_temp.fingerprint() as before_reads \gset
create temp table reads (sql text);
grant all on reads to authenticated;
insert into reads select format(s, :M, :H, :CAP, :CAP1, :'rev') from (values
  ($$select * from public.architecture_intelligence_availability(%1$L, 'explanation', jsonb_build_object('type', 'impact_trace', 'element_id', %3$L))$$),
  ($$select * from public.architecture_intelligence_availability(%1$L, 'tension', jsonb_build_object('type', 'element_pair', 'element_id', %4$L, 'second_element_id', %3$L))$$),
  ($$select * from public.current_architecture_inference(%1$L, 'explanation', jsonb_build_object('type', 'impact_trace', 'element_id', %3$L), 'v2', 'fake', 'dsa-fake-model-1', '2')$$),
  ($$select * from public.suggested_interpretations(%1$L)$$),
  ($$select * from public.kept_architecture_inferences(%1$L)$$),
  ($$select public.element_supports_and_exposures(%1$L, %4$L)$$),
  ($$select public.review_dossier(%2$L, %5$L)$$),
  ($$select * from public.architecture_inference_state(%1$L)$$)
) t (s);
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from reads where pg_temp.try(sql) not in ('ok', 'P0002')), 0, 'a holder''s reads succeed');
select pg_temp.act_as('researcher@tplco.test');
select is((select count(*)::int from reads where pg_temp.try(sql) not in ('ok', 'P0002', '42501')), 0,
  'a non-holder''s reads return or refuse');
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from reads where pg_temp.try(sql) = 'ok'), 0, 'a client''s reads all refuse');
reset role;
select is(pg_temp.fingerprint(), :'before_reads', 'after every read, every public table is unchanged');

-- 2. Keeping and judging write only their own tables.
select pg_temp.fingerprint(array['architecture_inferences', 'architecture_inference_basis',
  'architecture_inference_judgments', 'pending_architecture_inferences']) as before_keep \gset
select pg_temp.act_as('architect@tplco.test');
select public.keep_architecture_inference(:M, :'req', '{"kind": "investigating"}') as kept \gset
select ok(:'kept' is not null, 'kept and judged');
reset role;
select is(pg_temp.fingerprint(array['architecture_inferences', 'architecture_inference_basis',
  'architecture_inference_judgments', 'pending_architecture_inferences']), :'before_keep',
  'keeping and judging changed no governed table, no Edge judgment, no audit row');
select pg_temp.fingerprint(array['architecture_inference_judgments']) as before_judge \gset
select pg_temp.act_as('principal@tplco.test');
select ok(public.record_architecture_inference_judgment(:M, :'kept', 'not_material', 'Known.') is not null, 'judged');
reset role;
select is(pg_temp.fingerprint(array['architecture_inference_judgments']), :'before_judge',
  'judging changed nothing but the judgment table');

-- 3. A refused keep changes nothing at all.
select pg_temp.fingerprint() as before_refused \gset
select pg_temp.act_as('principal@tplco.test');
select is(pg_temp.try(format($$ select public.keep_architecture_inference(%L, %L) $$, :M, :'req')), '23514',
  'a second keep is refused');
reset role;
select is(pg_temp.fingerprint(), :'before_refused', '... and changes nothing');

select * from finish();
rollback;
