-- =============================================================================
-- Phase 7B.1: the Tool Contract's database layer (pgTAP). Proposal §8, §9,
-- §12, §15, §22; B-2, B-19, B-20; OD-5, OD-6, OD-13; ADR-0063.
-- What can be read, by whom, of which class, and what is never produced.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(48);

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
\set KNW '''b3000000-0000-4000-8000-000000000101'''
\set CAP '''b3000000-0000-4000-8000-000000000204'''
\set DEC '''b3000000-0000-4000-8000-000000000506'''

-- Start from no authorization: the seed's synthetic-evaluation
-- authorizations are removed inside this rolled-back transaction.
alter table public.engagement_ai_authorizations disable trigger user;
delete from public.engagement_ai_authorizations;
alter table public.engagement_ai_authorizations enable trigger user;

-- The approved set, exactly.
select set_eq($$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname like 'ai\_context\_%' $$,
  array['ai_context_element', 'ai_context_relationships', 'ai_context_impact', 'ai_context_revision',
        'ai_context_edge_item', 'ai_context_evidence', 'ai_context_intelligence', 'ai_context_criteria',
        'ai_context_review', 'ai_context_implementation'],
  'the Tool Contract has exactly the ten approved functions');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'ai\_context\_%'
             and p.provolatile = 's' and p.prosecdef and p.proconfig @> array['search_path=""']), 10,
  'each is STABLE, SECURITY DEFINER, with an empty search_path');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'ai\_context\_%'
             and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon executes none');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'ai\_context\_%'
             and has_function_privilege('authenticated', p.oid, 'execute')), 10, 'authenticated executes all ten');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname in ('ai_resolve', 'ai_emit', 'require_ai_context', 'ai_digest',
                                                          'current_ai_authorization', 'ai_class_authorized')
             and has_function_privilege('authenticated', p.oid, 'execute')), 0,
  'no private helper is executable by authenticated');

-- Fixtures on KNW-001 (Meridian): an approach statement naming a method; a
-- Method/IP source; a licensed source; an ordinary source carrying notes,
-- a URL, a locator and a person's name; a decision decided by a named person.
select pg_temp.act_as('architect@tplco.test');
insert into public.architecture_statements (element_id, statement_kind, body, provenance, sort_order)
values (:KNW, 'approach', 'Assessed with the Proprietary Readiness Diagnostic', 'architect_judgment', 90);
insert into public.evidence_sources (id, engagement_id, title, source_type, provenance, ip_classification, summary)
values ('f7b10000-0000-4000-8000-000000000001', :M, 'Method source', 'internal_analysis', 'architect_judgment',
        'tplco_method_ip', 'Method summary'),
       ('f7b10000-0000-4000-8000-000000000002', :M, 'Licensed market report', 'publication', 'public_source',
        'licensed_third_party_source', 'Licensed summary');
insert into public.evidence_sources (id, engagement_id, title, source_type, provenance, notes, url, publisher_author,
                                     reference, summary)
values ('f7b10000-0000-4000-8000-000000000003', :M, 'Interview with the district board', 'interview', 'client_source',
        'PRIVATE-NOTE', 'https://private.example/x', 'Dr Private Person', 'REF-PRIVATE', 'Board supports phasing');
insert into public.element_evidence_links (element_id, evidence_source_id, stance, locator, note)
values (:KNW, 'f7b10000-0000-4000-8000-000000000001', 'supports', 'p. 4', 'LINK-NOTE'),
       (:KNW, 'f7b10000-0000-4000-8000-000000000002', 'context', 'p. 9', ''),
       (:KNW, 'f7b10000-0000-4000-8000-000000000003', 'supports', 'LOCATOR-PRIVATE', 'LINK-NOTE');
reset role;
alter table public.decisions disable trigger user;
update public.decisions set external_decider_name = 'Zed Decider', external_evidence = 'EXT-EVIDENCE' where element_id = :DEC;
alter table public.decisions enable trigger user;

-- Gate: use capability, authorization, engagement.
select pg_temp.act_as('principal@tplco.test');
select throws_ok(format($$ select * from public.ai_context_element(%L, %L) $$, 'e0000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000204'), '42501', null, 'no authorization: refused (S7)');
select lives_ok(format($$ select public.set_engagement_ai_authorization(%L, 'authorized',
  array['published_architecture', 'working_architecture', 'project_intelligence'], 'openai', 'us',
  'synthetic_evaluation', 'Seed evaluation', null, 25) $$, 'e0000000-0000-4000-8000-000000000001'),
  'authorize Meridian without evidence metadata');
select pg_temp.act_as('researcher@tplco.test');
select throws_ok(format($$ select * from public.ai_context_element(%L, %L) $$, 'e0000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000204'), '42501', null, 'S4: a Researcher without use is refused');
select pg_temp.act_as('projectadmin@tplco.test');
select throws_ok(format($$ select * from public.ai_context_relationships(%L, %L) $$, 'e0000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000204'), '42501', null, 'a Project Administrator is refused');
select pg_temp.act_as('lead@meridian.test');
select throws_ok(format($$ select * from public.ai_context_element(%L, %L) $$, 'e0000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000204'), 'P0002', null, 'a client cannot even see the engagement');
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select * from public.ai_context_element(%L, %L) $$, 'e0000000-0000-4000-8000-000000000001',
  (select id from public.architecture_elements where engagement_id = 'e0000000-0000-4000-8000-000000000003' limit 1)),
  'P0002', null, 'another engagement''s element is not found');
select throws_ok(format($$ select * from public.ai_context_element(%L, %L, 'everything') $$,
  'e0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000204'), '23514', null, 'state is published or working');

-- Element projection.
select is((select count(*)::int from public.ai_context_element(:M, :CAP)), 1, 'one published element row');
select is((select record_type || '/' || data_class from public.ai_context_element(:M, :CAP)),
  'element_version/published_architecture', 'published: pinned version, published class');
select is((select version_id from public.ai_context_element(:M, :CAP)),
  (select latest_version_id from public.architecture_elements where id = :CAP), 'pinned to the latest version');
select is((select record_type || '/' || data_class from public.ai_context_element(:M, :CAP, 'working')),
  'element_working/working_architecture', 'working copy: working class');
select is((select data_class from public.ai_context_element(:M, :DEC, 'working')), 'project_intelligence',
  'a Decision is Project Intelligence');
select is((select digest from public.ai_context_element(:M, :CAP)),
  (select encode(sha256(convert_to(content::text, 'UTF8')), 'hex') from public.ai_context_element(:M, :CAP)),
  'digest is SHA-256 of exactly the content (OD-13)');
select is((select digest from public.ai_context_element(:M, :CAP)), (select digest from public.ai_context_element(:M, :CAP)),
  'digests are deterministic');

-- Never produced.
select ok((select content::text from public.ai_context_element(:M, :KNW, 'working')) !~ 'Proprietary Readiness Diagnostic',
  'an approach statement is never produced (ADR-0049)');
select ok((select content::text from public.ai_context_element(:M, :KNW, 'working')) ~ 'statement_kind',
  '... while other statements are');
select ok((select content::text from public.ai_context_element(:M, :DEC, 'working')) !~ 'Zed Decider|EXT-EVIDENCE',
  'a decider''s name and external evidence are never produced');
select ok((select string_agg(content::text, '') from (
           select content from public.ai_context_element(:M, :CAP, 'working')
           union all select content from public.ai_context_element(:M, :DEC, 'working')
           union all select content from public.ai_context_relationships(:M, :CAP)) x)
          !~ '10000000-0000-4000-8000|owner|_by"|methodology|lineage|source_reference|ip_classification|client_visibility',
  'no user ids, owners, attributions, methodology, lineage, source references or visibility');

-- Data class withheld when not authorized.
select is((select count(*)::int from public.ai_context_evidence(:M, :KNW, true) where not withheld), 0,
  'evidence_metadata not authorized: every evidence row withheld');
select is((select count(*)::int from public.ai_context_evidence(:M, :KNW, true)
           where withheld and content is null and digest is null), (select count(*)::int from public.ai_context_evidence(:M, :KNW, true)),
  'withheld rows carry no content and no digest');

select pg_temp.act_as('principal@tplco.test');
select lives_ok(format($$ select public.set_engagement_ai_authorization(%L, 'authorized',
  array['published_architecture', 'working_architecture', 'project_intelligence', 'evidence_metadata'], 'openai', 'us',
  'synthetic_evaluation', 'Seed evaluation', null, 25) $$, 'e0000000-0000-4000-8000-000000000001'),
  'authorize evidence metadata too');
select pg_temp.act_as('architect@tplco.test');
select is((select withheld_reason from public.ai_context_evidence(:M, :KNW, true) x
           join public.element_evidence_links l on l.id = x.record_id
           where l.evidence_source_id = 'f7b10000-0000-4000-8000-000000000001'), 'ip_excluded',
  'TPLCo Method/IP evidence is withheld by its classification (OD-6)');
select is((select withheld_reason from public.ai_context_evidence(:M, :KNW, true) x
           join public.element_evidence_links l on l.id = x.record_id
           where l.evidence_source_id = 'f7b10000-0000-4000-8000-000000000002'), 'ip_excluded',
  'licensed third-party evidence is withheld by its classification (OD-6)');
select ok((select string_agg(content::text, '') from public.ai_context_evidence(:M, :KNW, true))
          !~ 'PRIVATE-NOTE|private\.example|Dr Private Person|REF-PRIVATE|LOCATOR-PRIVATE|LINK-NOTE|Method summary|Licensed summary',
  'never notes, URLs, publishers or authors, references, locators, link notes, or excluded summaries');
select ok((select string_agg(content::text, '') from public.ai_context_evidence(:M, :KNW, true)) ~ 'Board supports phasing',
  'the architect-written summary when the plan permits it (OD-5)');
select ok((select string_agg(coalesce(content::text, ''), '') from public.ai_context_evidence(:M, :KNW, false))
          !~ 'Board supports phasing', '... and never otherwise');
select isnt((select digest from public.ai_context_evidence(:M, :KNW, true) x join public.element_evidence_links l on l.id = x.record_id
             where l.evidence_source_id = 'f7b10000-0000-4000-8000-000000000003'),
            (select digest from public.ai_context_evidence(:M, :KNW, false) x join public.element_evidence_links l on l.id = x.record_id
             where l.evidence_source_id = 'f7b10000-0000-4000-8000-000000000003'),
  'the digest pins the exact variant sent');
select is((select data_class from public.ai_context_evidence(:M, :KNW, true) where not withheld limit 1), 'evidence_metadata',
  'evidence is evidence_metadata');

-- Element classified as Method/IP is withheld.
reset role;
update public.architecture_elements set ip_classification = 'tplco_method_ip', client_visibility = 'internal' where id = :KNW;
select pg_temp.act_as('architect@tplco.test');
select is((select withheld_reason from public.ai_context_element(:M, :KNW, 'working')), 'ip_excluded',
  'an element classified tplco_method_ip is withheld');
select is((select content from public.ai_context_element(:M, :KNW, 'working')), null, '... with no content');
reset role;
update public.architecture_elements set ip_classification = 'project_work_product' where id = :KNW;

-- Digest changes exactly when projected content changes.
select pg_temp.act_as('architect@tplco.test');
create temporary table d0 as select digest from public.ai_context_element(:M, :CAP, 'working');
reset role;
update public.architecture_elements set source_reference = 'not projected' where id = :CAP;
select pg_temp.act_as('architect@tplco.test');
select is((select digest from public.ai_context_element(:M, :CAP, 'working')), (select digest from d0),
  'an unprojected change leaves the digest unchanged');
reset role;
update public.architecture_elements set summary = summary || ' Revised.' where id = :CAP;
select pg_temp.act_as('architect@tplco.test');
select isnt((select digest from public.ai_context_element(:M, :CAP, 'working')), (select digest from d0),
  'a projected change changes the digest');

-- The other tools.
select ok((select count(*) from public.ai_context_relationships(:M, :CAP)) > 0, 'relationships of an element');
select ok((select bool_and(record_type = 'relationship' and anchor_id = :CAP) from public.ai_context_relationships(:M, :CAP)),
  'relationship rows are anchored on the element');
select ok((select count(*) from public.ai_context_impact(:M, :CAP)) > 0, 'governed impact reach');
select is((select (content ->> 'change_type') from public.ai_context_revision(:M, :CAP)), 'substantive_revision',
  'the latest revision');
select is((select count(*)::int from public.ai_context_edge_item(:M, 'change_reaches',
  'b3000000-0000-4000-8000-000000000502', 'not-the-fingerprint')), 0, 'a changed Edge fingerprint returns nothing');
select ok((select count(*) from public.ai_context_intelligence(:M, :CAP)) >= 0, 'related Project Intelligence reads');
select throws_ok(format($$ select * from public.ai_context_review(%L, %L) $$, 'e0000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000204'), '23514', null, 'a Review tool needs a Review');

-- Harbor: Reviews and Implementation.
select pg_temp.act_as('principal@tplco.test');
select lives_ok(format($$ select public.set_engagement_ai_authorization(%L, 'authorized',
  array['published_architecture', 'working_architecture', 'project_intelligence'], 'openai', 'us',
  'synthetic_evaluation', 'Seed evaluation', null, 25) $$, 'e0000000-0000-4000-8000-000000000003'), 'authorize Harbor');
select ok((select content -> 'examined' is not null from public.ai_context_review(:H,
  (select id from public.architecture_elements where engagement_id = :H and reference_code = 'REV-001'))),
  'a Review''s examined set');
select ok((select count(*) from public.ai_context_implementation(:H,
  (select id from public.architecture_elements where engagement_id = :H and reference_code = 'IMP-001'))) > 0,
  'an initiative''s checkpoints and implements links');

-- OD-3 at read time.
reset role;
update public.engagements set status = 'completed' where id = :H;
select pg_temp.act_as('principal@tplco.test');
select throws_ok(format($$ select * from public.ai_context_review(%L, %L) $$, 'e0000000-0000-4000-8000-000000000003',
  (select id from public.architecture_elements where engagement_id = 'e0000000-0000-4000-8000-000000000003'
     and reference_code = 'REV-001')), '42501', null, 'a completed engagement is refused');

select * from finish();
rollback;
