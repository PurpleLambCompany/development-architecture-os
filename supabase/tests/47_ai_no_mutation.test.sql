-- =============================================================================
-- Phase 7B.1: ARCHITECTURE INTELLIGENCE CANNOT MUTATE GOVERNED DSA STATE
-- (pgTAP, adversarial). Kerrick's 7B.1 approval; proposal §9, §12; ADR-0063.
--
-- STABLE volatility is defense in depth only. The invariant is proven here
-- by the engine and by state comparison, not by declarations:
--   1. the whole Tool Contract runs inside a READ ONLY transaction, where the
--      engine itself refuses any write, while the recording operation cannot;
--   2. a fingerprint of every table in the public schema is identical before
--      and after adversarial calls by a holder, across engagements, after
--      authorization revocation, after use-capability revocation, through an
--      unauthorized data class, and through functions outside the contract;
--   3. the recording operation writes only its three tables;
--   4. statically, no Tool Contract function or helper contains DML, dynamic
--      SQL or a guard switch, and nothing outside the contract is callable.
-- The Gateway side (only registered tools dispatch; no route reaches any
-- other function) is proven in src/domain/architecture-intelligence tests.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(41);

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
\set KNW '''b3000000-0000-4000-8000-000000000101'''

select id as rev from public.architecture_elements where engagement_id = :H and reference_code = 'REV-001' \gset
select id as imp from public.architecture_elements where engagement_id = :H and reference_code = 'IMP-001' \gset
select id as hel from public.architecture_elements where engagement_id = :H order by reference_code limit 1 \gset
select pg_temp.act_as('architect@tplco.test');
select rule_key as rule, subject_id as edge_el, fingerprint as fp
from public.edge_items(:M, null, null, null, true) where subject_type = 'element' order by item_key limit 1 \gset
reset role;

-- The Tool Contract called every way: valid, cross-engagement, unknown,
-- null, wrong kind, hostile strings and every state and variant.
create temp table calls (valid boolean, sql text);
grant all on calls to authenticated;
insert into calls select v, format(s, :M, :H, :CAP, :KNW, :'rev', :'imp', :'hel', :'rule', :'edge_el', :'fp') from (values
  (true, $$select * from public.ai_context_element(%1$L, %3$L)$$),
  (true, $$select * from public.ai_context_element(%1$L, %3$L, 'working')$$),
  (false, $$select * from public.ai_context_element(%1$L, %3$L, 'published; delete from public.engagements')$$),
  (false, $$select * from public.ai_context_element(%1$L, %7$L)$$),
  (false, $$select * from public.ai_context_element(%2$L, %3$L)$$),
  (false, $$select * from public.ai_context_element(%1$L, gen_random_uuid())$$),
  (false, $$select * from public.ai_context_element(%1$L, null)$$),
  (false, $$select * from public.ai_context_element(null, %3$L)$$),
  (true, $$select * from public.ai_context_relationships(%1$L, %3$L)$$),
  (false, $$select * from public.ai_context_relationships(%1$L, %7$L)$$),
  (true, $$select * from public.ai_context_impact(%1$L, %3$L)$$),
  (false, $$select * from public.ai_context_impact(%2$L, %7$L)$$),
  (true, $$select * from public.ai_context_revision(%1$L, %3$L)$$),
  (false, $$select * from public.ai_context_revision(%1$L, %3$L, gen_random_uuid())$$),
  (true, $$select * from public.ai_context_edge_item(%1$L, %8$L, %9$L, %10$L)$$),
  (false, $$select * from public.ai_context_edge_item(%1$L, 'x''); update public.architecture_elements set title = ''x''; --', %9$L, %10$L)$$),
  (false, $$select * from public.ai_context_edge_item(%1$L, %8$L, %9$L, repeat('f', 100000))$$),
  (true, $$select * from public.ai_context_evidence(%1$L, %4$L)$$),
  (true, $$select * from public.ai_context_evidence(%1$L, %4$L, true)$$),
  (true, $$select * from public.ai_context_intelligence(%1$L, %3$L)$$),
  (true, $$select * from public.ai_context_criteria(%1$L, %3$L)$$),
  (true, $$select * from public.ai_context_review(%2$L, %5$L)$$),
  (false, $$select * from public.ai_context_review(%1$L, %5$L)$$),
  (false, $$select * from public.ai_context_review(%2$L, %6$L)$$),
  (true, $$select * from public.ai_context_implementation(%2$L, %6$L)$$),
  (false, $$select * from public.ai_context_implementation(%1$L, %6$L)$$)
) t (v, s);
create function pg_temp.call_all() returns text[] language sql as $$
  select array_agg(pg_temp.try(sql) order by sql) from calls;
$$;
-- The valid calls, which must succeed.
create temp view valid_calls as select sql from calls where valid;
grant all on valid_calls to authenticated;

-- 0. Static: the contract and its helpers contain no write, no dynamic SQL
-- and no guard switch; nothing else of the AI surface is callable.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where ((n.nspname = 'public' and p.proname like 'ai\_context\_%')
                  or (n.nspname = 'private' and p.proname like 'ai\_%'))
             and p.prosrc ~* '\m(insert|update|delete|merge|truncate|copy|execute|set_config|nextval|setval|lock)\M'
             and p.proname <> 'ai_emit'), 0,
  'no Tool Contract function or helper writes, runs dynamic SQL, switches a guard or takes a lock');
select is((select count(*)::int from pg_proc where proname = 'ai_emit'
           and prosrc ~* '\m(insert|update|delete|merge|truncate|copy|set_config|nextval)\M'), 0,
  'ai_emit neither writes nor switches a guard');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'ai\_context\_%' and p.provolatile <> 's'), 0,
  'every contract function is STABLE (defense in depth only)');
select set_eq($$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'private' and p.proname like 'ai\_%'
                   and has_function_privilege('authenticated', p.oid, 'execute') $$,
  array['ai_data_classes', 'ai_element_class', 'ai_inference_kinds', 'ai_ip_excluded', 'ai_is_intelligence_kind'],
  'of the private AI helpers, only five pure constants are callable');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname like 'ai\_%' and p.provolatile <> 'i'
             and has_function_privilege('authenticated', p.oid, 'execute')), 0, '... and they are IMMUTABLE');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private'
             and p.proname in ('ai_resolve', 'ai_emit', 'ai_project_snapshot', 'ai_strip_people', 'require_ai_context',
                               'ai_element_in', 'current_ai_authorization', 'ai_class_authorized', 'ai_digest')
             and has_function_privilege('authenticated', p.oid, 'execute')), 0,
  'the resolver, emitter and gates are not callable outside the contract');
select set_eq($$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prosrc ~ 'private\.(ai_emit|ai_resolve)' $$,
  array['ai_context_element', 'ai_context_relationships', 'ai_context_impact', 'ai_context_revision',
        'ai_context_edge_item', 'ai_context_evidence', 'ai_context_intelligence', 'ai_context_criteria',
        'ai_context_review', 'ai_context_implementation', 'architecture_inference_state'],
  'no other public function reaches governed content through the AI resolver');
select set_eq($$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prosrc ~ 'private\.verify_inference_basis' $$,
  array['record_architecture_intelligence_request', 'keep_architecture_inference'],
  '... and only recording and keeping verify a basis through it (7B.2)');
select is((select count(*)::int from information_schema.role_table_grants
           where grantee in ('authenticated', 'anon') and table_schema = 'public'
             and table_name in ('architecture_inferences', 'architecture_inference_basis',
                                'architecture_intelligence_requests', 'engagement_ai_authorizations')
             and privilege_type <> 'SELECT'), 0, 'no direct write privilege on any AI table');

-- 1. The engine: the whole contract runs in a READ ONLY transaction.
select pg_temp.act_as('architect@tplco.test');
savepoint ro;
set local transaction_read_only = on;
select is((select count(*)::int from valid_calls where pg_temp.try(sql) <> 'ok'), 0,
  'every valid contract call succeeds inside a READ ONLY transaction');
select is(pg_temp.try($$ select public.record_architecture_intelligence_request('e0000000-0000-4000-8000-000000000001',
  '{"outcome": "refused_mode", "mode": "ephemeral", "inference_kind": "explanation"}') $$), '25006',
  '... where the recording operation, which does write, is refused by the engine');
select is(pg_temp.try($$ select public.retire_relationship(gen_random_uuid(), 'x') $$) in ('25006', 'P0002', '42501'), true,
  '... as would any governed operation');
rollback to savepoint ro;

-- 2. A holder, adversarially: nothing changes.
reset role;
select pg_temp.fingerprint() as before_all \gset
select pg_temp.act_as('architect@tplco.test');
select ok((select count(*) from valid_calls) = 12, 'a broad set of valid calls is exercised');
select is((select string_agg(pg_temp.try(sql) || ' ' || sql, E'\n') from valid_calls where pg_temp.try(sql) <> 'ok'), null, 'the valid calls succeed');
select ok(array_length(pg_temp.call_all(), 1) = (select count(*) from calls), 'every hostile call returns or refuses');
select is((select count(*)::int from calls where pg_temp.try(sql) not in ('ok', 'P0002', '42501', '23514', '22P02', '22023')), 0,
  'hostile calls fail only with the contract''s own refusals');
select is(pg_temp.try($$ select * from public.ai_context_element('e0000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000a01') $$), 'P0002', 'across engagements: another engagement''s element is not found');
reset role;
select is(pg_temp.fingerprint(), :'before_all', 'after every call by a holder, every public table is unchanged');

-- 3. Directly: the holder cannot write the AI tables or governed tables
-- through any AI surface; direct DML on AI tables is refused.
select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.try($$ insert into public.architecture_inferences (engagement_id) values ('e0000000-0000-4000-8000-000000000001') $$),
  '42501', 'no direct insert of an inference');
select is(pg_temp.try($$ update public.architecture_inference_basis set digest = repeat('0', 64) $$), '42501',
  'no direct change of a basis');
select is(pg_temp.try($$ delete from public.architecture_intelligence_requests $$), '42501', 'no direct deletion of the audit');
select is(pg_temp.try($$ insert into public.engagement_ai_authorizations (engagement_id, sequence_no, state, effective_from, authorized_by)
  values ('e0000000-0000-4000-8000-000000000001', 99, 'authorized', current_date, auth.uid()) $$), '42501',
  'no direct authorization');

-- 4. The recording operation writes its three tables and nothing else.
reset role;
select pg_temp.fingerprint(array['architecture_intelligence_requests', 'architecture_inferences',
                                 'architecture_inference_basis']) as before_record \gset
select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.try(format($$ select public.record_architecture_intelligence_request(%L,
  jsonb_build_object('outcome', 'persisted', 'mode', 'persist', 'inference_kind', 'explanation', 'subject_type', 'element',
    'subject_element_id', %L, 'authorization_id', (select id from public.engagement_ai_authorizations
      where engagement_id = %L order by sequence_no desc limit 1),
    'prompt_id', 'explanation', 'prompt_version', 'v1', 'generation_policy_version', 'v1', 'tool_contract_version', '1',
    'provider_key', 'fake', 'requested_model', 'f', 'resolved_model', 'f'),
  jsonb_build_object('output_schema_version', '1', 'assertion', 'A.', 'prompt_content_hash', repeat('a', 64),
    'claims', '[{"text": "c", "cites": ["R1"]}]'::jsonb,
    'basis', (select jsonb_agg(jsonb_build_object('handle', 'R1', 'record_type', record_type, 'record_id', record_id,
      'version_id', version_id, 'data_class', data_class, 'digest', digest, 'origin', 'anchor'))
      from public.ai_context_element(%L, %L))))
  $$, 'e0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000204',
  'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000204')), 'ok', 'an inference is recorded');
reset role;
select is(pg_temp.fingerprint(array['architecture_intelligence_requests', 'architecture_inferences',
                                    'architecture_inference_basis']), :'before_record',
  'recording an inference changed no other table, governed or not');
select is((select count(*)::int from public.architecture_inferences), 1, 'the inference exists');

-- 5. After use-capability revocation.
select pg_temp.act_as('principal@tplco.test');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
select id, 'use_architecture_intelligence', false from public.engagement_members
where engagement_id = :M and user_id = '10000000-0000-4000-8000-000000000003';
reset role;
select pg_temp.fingerprint() as before_use_revoked \gset
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from calls where sql like '%e0000000-0000-4000-8000-000000000001%'
             and pg_temp.try(sql) not in ('42501', 'P0002')), 0,
  'after use revocation, every Meridian contract call is refused');
select is(pg_temp.try($$ select public.record_architecture_intelligence_request('e0000000-0000-4000-8000-000000000001',
  '{"outcome": "returned", "mode": "ephemeral", "inference_kind": "explanation"}') $$), '42501',
  '... and no model outcome can be recorded');
select is((select count(*)::int from public.architecture_inferences), 0, '... and no inference is readable');
reset role;
select is(pg_temp.fingerprint(), :'before_use_revoked', 'nothing changed after use revocation');
select pg_temp.act_as('principal@tplco.test');
delete from public.engagement_member_capability_overrides
where capability = 'use_architecture_intelligence'
  and engagement_member_id in (select id from public.engagement_members where engagement_id = :M);

-- 6. Through an unauthorized data class: withheld, never sent, never
-- recordable.
select public.set_engagement_ai_authorization(:M, 'authorized', array['published_architecture'], 'openai', 'us',
  'synthetic_evaluation', 'Narrowed', null, 25);
reset role;
select pg_temp.fingerprint() as before_class \gset
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.ai_context_element(:M, :CAP, 'working') where not withheld or content is not null
           or digest is not null), 0, 'working architecture is withheld without content or digest');
select is((select count(*)::int from public.ai_context_evidence(:M, :KNW) where content is not null), 0,
  'evidence metadata is withheld');
select is(pg_temp.try(format($$ select public.record_architecture_intelligence_request(%L,
  jsonb_build_object('outcome', 'persisted', 'mode', 'persist', 'inference_kind', 'explanation', 'subject_type', 'element',
    'subject_element_id', %L, 'authorization_id', (select id from public.engagement_ai_authorizations
      where engagement_id = %L order by sequence_no desc limit 1),
    'prompt_id', 'p', 'prompt_version', 'v1', 'generation_policy_version', 'v1', 'tool_contract_version', '1',
    'provider_key', 'fake', 'requested_model', 'f', 'resolved_model', 'f'),
  jsonb_build_object('output_schema_version', '1', 'assertion', 'A.', 'prompt_content_hash', repeat('a', 64),
    'claims', '[{"text": "c", "cites": ["R1"]}]'::jsonb,
    'basis', jsonb_build_array(jsonb_build_object('handle', 'R1', 'record_type', 'element_working', 'record_id', %L,
      'data_class', 'working_architecture', 'digest', repeat('c', 64), 'origin', 'anchor'))))
  $$, 'e0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000204',
  'e0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000204')), '23514',
  'an inference resting on an unauthorized class cannot be recorded');
reset role;
select is(pg_temp.fingerprint(), :'before_class', 'nothing changed through an unauthorized class');

-- 7. After authorization revocation.
select pg_temp.act_as('principal@tplco.test');
select public.set_engagement_ai_authorization(:M, 'not_authorized', '{}', null, null, null, null,
  'Client asked to pause external processing.', null);
reset role;
select pg_temp.fingerprint() as before_revoked \gset
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from calls where sql like '%e0000000-0000-4000-8000-000000000001%'
             and pg_temp.try(sql) not in ('42501', 'P0002')), 0,
  'after revocation, every Meridian contract call is refused');
select pg_temp.act_as('principal@tplco.test');
select is((select count(*)::int from calls where sql like '%e0000000-0000-4000-8000-000000000001%'
             and pg_temp.try(sql) not in ('42501', 'P0002')), 0, '... for the Principal Architect too');
reset role;
select is(pg_temp.fingerprint(), :'before_revoked', 'nothing changed after revocation');

-- 8. A client, and a member without the capability, through every call.
reset role;
select pg_temp.fingerprint() as before_others \gset
select pg_temp.act_as('sponsor@harbor.test');
select is((select count(*)::int from calls where pg_temp.try(sql) not in ('42501', 'P0002')), 0,
  'a client is refused every call');
select pg_temp.act_as('researcher@tplco.test');
select is((select count(*)::int from calls where pg_temp.try(sql) not in ('42501', 'P0002')), 0,
  'a Researcher is refused every call');
select pg_temp.act_as('finance@tplco.test');
select is((select count(*)::int from calls where pg_temp.try(sql) not in ('42501', 'P0002')), 0,
  'Finance is refused every call');
reset role;
select is(pg_temp.fingerprint(), :'before_others', 'nothing changed');

-- The fingerprint does detect a governed change (the comparison is not vacuous).
update public.architecture_elements set title = title || ' ' where id = :CAP;
select isnt(pg_temp.fingerprint(), :'before_others', 'a governed change does alter the fingerprint');

select * from finish();
rollback;
