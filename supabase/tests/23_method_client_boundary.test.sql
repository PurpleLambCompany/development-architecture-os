-- =============================================================================
-- Phase 6 client boundary (pgTAP). Run with: pnpm db:test
--
-- "Client users must never access Method/IP content." With every Phase 6
-- table populated, no client role, licensed or consulting advisor, or
-- anonymous session reads a single row or storage object from the Method
-- Library or the practice tables, or anything through the internal read
-- models. The only client-readable methodology is the release label and
-- title (D21), architect-authored approach statements under existing
-- statement rules (D22), and agreed criteria through
-- client_acceptance_criteria, never the informing Standard (D24). Client
-- snapshots keep their pre-Phase 6 key set (ADR-0022).
-- =============================================================================
begin;

select plan(47);

create function pg_temp.act_as(user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  execute 'reset role';
  select id into uid from auth.users where email = user_email;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.reset_actor()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create table pg_temp.ids (name text primary key, id uuid);
grant all on pg_temp.ids to authenticated, anon;
create function pg_temp.id(target text) returns uuid language sql as $$ select id from pg_temp.ids where name = target $$;
create function pg_temp.draft(asset uuid) returns uuid language sql security definer as $$
  select id from public.method_asset_versions where asset_id = asset and lifecycle = 'draft'
$$;
create function pg_temp.el(eng uuid, code text) returns uuid language sql security definer as $$
  select id from public.architecture_elements where engagement_id = eng and reference_code = code
$$;

-- Every Phase 6 table, plus element_method_lineage.
create table pg_temp.phase6_tables (name text primary key);
grant select on pg_temp.phase6_tables to authenticated, anon;
insert into pg_temp.phase6_tables values
  ('acceptance_criteria'), ('dam_release_members'), ('dam_releases'), ('development_context_revisions'),
  ('development_contexts'), ('element_method_lineage'), ('engagement_development_contexts'),
  ('instrument_version_evidence_types'), ('method_application_addenda'), ('method_application_assets'),
  ('method_application_contexts'), ('method_application_domains'), ('method_application_elements'),
  ('method_application_evidence'), ('method_application_practitioners'), ('method_application_stage_notes'),
  ('method_applications'), ('method_asset_categories'), ('method_asset_rights_holders'), ('method_asset_versions'),
  ('method_assets'), ('method_version_components'), ('method_version_contexts'), ('method_version_domains'),
  ('method_version_files'), ('method_version_learning_sources'), ('method_version_outputs'), ('method_version_stages'),
  ('practice_member_capability_overrides'), ('practice_role_capability_defaults'), ('standard_version_criteria'),
  ('standard_version_judged_in'), ('template_version_sections'), ('template_version_specs'), ('validation_criteria');

-- Rows the current session reads across all of them, plus Method Library
-- storage objects. A refused select counts as nothing read.
create function pg_temp.phase6_rows_visible()
returns int
language plpgsql
as $$
declare
  t text;
  n int;
  total int := 0;
begin
  for t in select name from pg_temp.phase6_tables loop
    begin
      execute format('select count(*)::int from public.%I', t) into n;
      total := total + n;
    exception when insufficient_privilege then
      null;
    end;
  end loop;
  begin
    select count(*)::int into n from storage.objects where bucket_id = 'method-library';
    total := total + n;
  exception when insufficient_privilege then
    null;
  end;
  return total;
end;
$$;

create function pg_temp.empty_phase6_tables()
returns text
language plpgsql
as $$
declare
  t text;
  n int;
  empty text[] := '{}';
begin
  for t in select name from pg_temp.phase6_tables order by name loop
    execute format('select count(*)::int from public.%I', t) into n;
    if n = 0 then empty := array_append(empty, t); end if;
  end loop;
  return array_to_string(empty, ',');
end;
$$;

-- -----------------------------------------------------------------------------
-- Setup: populate every Phase 6 table
-- -----------------------------------------------------------------------------
insert into pg_temp.ids select 'researcher-membership', m.id from public.organization_members m
  join auth.users u on u.id = m.user_id join public.organizations o on o.id = m.organization_id
  where u.email = 'researcher@tplco.test' and o.type = 'tplco';
select pg_temp.act_as('principal@tplco.test');
insert into pg_temp.ids values ('ctx', public.create_development_context('regional_cluster', 'Regional industry cluster',
  'A region developing a concentration of related firms and institutions.'));
select public.revise_development_context(pg_temp.id('ctx'), 'Regional industry cluster',
  'A region developing a concentration of related firms, institutions and talent.', 'Talent added');
select public.set_practice_capability_override(
  pg_temp.id('researcher-membership'), 'author_methodology', true, 'Drafting the interview guides');

select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('instrument', public.create_method_asset('leader-guide', 'Leader Interview Guide', 'instrument', 'question_libraries'));
insert into pg_temp.ids values ('iv', pg_temp.draft(pg_temp.id('instrument')));
select public.update_method_asset_version(pg_temp.id('iv'), '{"architectural_question": "Q", "applicability": "A",
  "change_summary": "First", "practitioner_instructions": "Ask about decision rights."}');
select public.set_instrument_version_evidence_types(pg_temp.id('iv'), '{interview}');
insert into pg_temp.ids values ('standard', public.create_method_asset('evidence-bar', 'Evidence Bar', 'standard', 'measurement_frameworks'));
insert into pg_temp.ids values ('sv', pg_temp.draft(pg_temp.id('standard')));
select public.update_method_asset_version(pg_temp.id('sv'), '{"architectural_question": "Q", "applicability": "A", "change_summary": "First"}');
select public.set_standard_version_criteria(pg_temp.id('sv'), '[{"key": "quorum", "statement": "Proprietary quorum rule"}]');
select public.set_standard_version_judged_in(pg_temp.id('sv'), '{review}');
insert into pg_temp.ids values ('template', public.create_method_asset('board-brief', 'Board Brief', 'template', 'templates'));
insert into pg_temp.ids values ('tv', pg_temp.draft(pg_temp.id('template')));
select public.update_method_asset_version(pg_temp.id('tv'), '{"architectural_question": "Q", "applicability": "A", "change_summary": "First"}');
select public.set_template_version_spec(pg_temp.id('tv'), 'executive_summary', '[{"title": "Position"}]');
select pg_temp.act_as('principal@tplco.test');
select public.publish_method_asset_version(pg_temp.id(k), '1.0') from unnest(array['iv', 'sv', 'tv']) k;
select public.record_method_rights_holder(pg_temp.id('standard'), null, 'Regional Standards Council', 'licensor', 'LIC-7');

select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('method', public.create_method_asset('readiness-diagnostic', 'Proprietary Readiness Diagnostic',
  'method', 'diagnostic_frameworks'));
insert into pg_temp.ids values ('mv', pg_temp.draft(pg_temp.id('method')));
select public.update_method_asset_version(pg_temp.id('mv'), '{"architectural_question": "How ready is the region?",
  "applicability": "A", "change_summary": "First", "modes": ["assess"], "completion_criteria": "All leaders interviewed",
  "practitioner_instructions": "Secret practitioner instructions", "identity_disclosure": "may_be_named",
  "disclosable_name": "Capability Readiness Diagnostic"}');
select public.set_method_version_stages(pg_temp.id('mv'), '[{"key": "interview", "title": "Interview"}]');
select public.set_method_version_outputs(pg_temp.id('mv'), '[{"output_kind": "object", "object_type_key": "capability_gap"}]');
select public.set_method_version_domains(pg_temp.id('mv'), '{capability}');
select public.set_method_version_contexts(pg_temp.id('mv'), array[pg_temp.id('ctx')]);
select public.set_method_version_components(pg_temp.id('mv'), jsonb_build_array(jsonb_build_object('component_version_id', pg_temp.id('iv'))));
select pg_temp.act_as('principal@tplco.test');
select public.publish_method_asset_version(pg_temp.id('mv'), '1.0');
insert into pg_temp.ids values ('release', public.create_dam_release('1.1', 'Development Architecture Method™ 1.1', 'Adds the diagnostic'));
select public.set_dam_release_member(pg_temp.id('release'), pg_temp.id('mv'));

-- A Meridian application, complete with its links
select pg_temp.act_as('architect@tplco.test');
select public.set_engagement_development_contexts('e0000000-0000-4000-8000-000000000001', array[pg_temp.id('ctx')], pg_temp.id('ctx'));
insert into pg_temp.ids values ('app', public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Readiness of the acquisition function', 'The board asked how ready the team is', 'How ready is acquisition?',
  'Piloting ahead of DAM 1.1'));
select public.set_method_application_contexts(pg_temp.id('app'), array[pg_temp.id('ctx')]);
select public.set_method_application_domains(pg_temp.id('app'), '{capability}');
select public.set_method_application_asset(pg_temp.id('app'), pg_temp.id('iv'), 'Shortened for the board');
select public.begin_method_application(pg_temp.id('app'));
select public.set_method_application_stage_note(pg_temp.id('app'),
  (select id from public.method_version_stages where version_id = pg_temp.id('mv')), 'adapted', 'Two leaders only', 'Internal note');
select public.link_method_application_element(pg_temp.id('app'), 'b3000000-0000-4000-8000-000000000205', 'examined', 'Examined the gap');
select public.link_method_application_evidence(pg_temp.id('app'), 'b3000000-0000-4000-8000-000000000702', 'drew_on');
-- An approach statement, published on a client-visible object
insert into public.architecture_elements (id, engagement_id, kind, title, provenance, client_visibility)
values ('c9000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'object',
        'Acquisition readiness gap', 'architect_judgment', 'client');
insert into public.architecture_objects (element_id, object_type) values ('c9000000-0000-4000-8000-000000000001', 'capability_gap');
insert into public.architecture_statements (id, element_id, statement_kind, body, provenance, client_visible) values
  ('c9000000-0000-4000-8000-000000000011', 'c9000000-0000-4000-8000-000000000001', 'approach',
   'Assessed using TPLCo''s Capability Readiness Diagnostic, through leadership interviews.', 'architect_judgment', true),
  ('c9000000-0000-4000-8000-000000000012', 'c9000000-0000-4000-8000-000000000001', 'approach',
   'Internal approach note naming the Proprietary Readiness Diagnostic.', 'architect_judgment', false);
select public.link_method_application_element(pg_temp.id('app'), 'c9000000-0000-4000-8000-000000000001', 'produced');
select public.complete_method_application(pg_temp.id('app'), 'Assessed', 'Internal retrospective');
select public.add_method_application_addendum(pg_temp.id('app'), 'Internal addendum');
insert into pg_temp.ids values ('mv2', public.create_method_asset_version(pg_temp.id('method')));
select public.add_method_version_learning_source(pg_temp.id('mv2'), pg_temp.id('app'), 'Shorter interviews');
insert into pg_temp.ids values ('iv2', public.create_method_asset_version(pg_temp.id('instrument')));
select public.attach_method_version_file(pg_temp.id('iv2'), 'guide.pdf', 'application/pdf', 1024);
select public.record_method_lineage('b3000000-0000-4000-8000-000000000205', pg_temp.id('sv'), 'judged_against');
select public.record_method_lineage(pg_temp.el('e0000000-0000-4000-8000-000000000003', 'REV-001'), pg_temp.id('sv'), 'judged_against');
select pg_temp.reset_actor();
insert into storage.objects (bucket_id, name)
select 'method-library', object_path from public.method_version_files where version_id = pg_temp.id('iv2');

-- Acceptance criteria: in and outside the Meridian Contributor's area, one
-- internal, one proposed, and one captured by a Harbor validation.
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('c-cap', public.propose_acceptance_criterion('b3000000-0000-4000-8000-000000000205',
  'The acquisition team is staffed', pg_temp.id('sv'), 'quorum'));
insert into pg_temp.ids values ('c-knw', public.propose_acceptance_criterion('b3000000-0000-4000-8000-000000000101',
  'The market study is refreshed yearly'));
insert into pg_temp.ids values ('c-internal', public.propose_acceptance_criterion('b3000000-0000-4000-8000-000000000205',
  'Internal-only criterion', null, null, false));
insert into pg_temp.ids values ('c-proposed', public.propose_acceptance_criterion('b3000000-0000-4000-8000-000000000205',
  'Still only a proposal'));
select public.agree_acceptance_criterion(pg_temp.id(k), 'Executive Sponsor', current_date)
from unnest(array['c-cap', 'c-knw', 'c-internal']) k;
insert into pg_temp.ids values ('h-crit', public.propose_acceptance_criterion(
  pg_temp.el('e0000000-0000-4000-8000-000000000003', 'IMP-001'), 'The Expansion Council meets monthly'));
select public.agree_acceptance_criterion(pg_temp.id('h-crit'), 'Executive Sponsor', current_date);
insert into pg_temp.ids values ('validation', public.record_review_validation(
  pg_temp.el('e0000000-0000-4000-8000-000000000003', 'REV-001'), pg_temp.el('e0000000-0000-4000-8000-000000000003', 'IMP-001')));
select public.set_validation_criterion_note(pg_temp.id('validation'), pg_temp.id('h-crit'), 'Minutes reviewed');

select public.publish_element_version('c9000000-0000-4000-8000-000000000001', 'First published version');
select pg_temp.reset_actor();

select is(pg_temp.empty_phase6_tables(), '', 'setup populated every Phase 6 table');
select ok(pg_temp.phase6_rows_visible() > 0, 'and the storage bucket');

-- -----------------------------------------------------------------------------
-- No client or anonymous session reads any Phase 6 row
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sponsor@meridian.test');
select is(pg_temp.phase6_rows_visible(), 0, 'a Meridian Executive Sponsor reads no Phase 6 row or object');
select pg_temp.act_as('lead@meridian.test');
select is(pg_temp.phase6_rows_visible(), 0, 'nor does a Client Project Lead');
select pg_temp.act_as('contributor@meridian.test');
select is(pg_temp.phase6_rows_visible(), 0, 'nor an area-limited Client Contributor');
select pg_temp.act_as('viewer@meridian.test');
select is(pg_temp.phase6_rows_visible(), 0, 'nor a Client Viewer');
select pg_temp.act_as('finance@meridian.test');
select is(pg_temp.phase6_rows_visible(), 0, 'nor Client Finance');
select pg_temp.act_as('advisor@consulting.test');
select is(pg_temp.phase6_rows_visible(), 0, 'nor an outside advisor in two client organizations');
select pg_temp.act_as('lead@harbor.test');
select is(pg_temp.phase6_rows_visible(), 0, 'nor a Harbor client');
select pg_temp.reset_actor();
set local role anon;
select is(pg_temp.phase6_rows_visible(), 0, 'nor an anonymous session');
select pg_temp.reset_actor();

-- Internal read models return nothing to a client
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.method_library()), 0, 'method_library returns nothing to a client');
select is((select count(*)::int from public.method_usage(pg_temp.id('method'))), 0, 'nor method_usage');
select is((select count(*)::int from public.method_application_register('e0000000-0000-4000-8000-000000000001')), 0,
  'nor the application register');
select is((select count(*)::int from public.element_practice_context('b3000000-0000-4000-8000-000000000205')), 0,
  'nor the Practice panel');
select is((select count(*)::int from public.element_practice_context('b3000000-0000-4000-8000-000000000302')), 0,
  'including lineage on the anchor-led object');
select throws_ok($$ select public.method_version_publish_gaps((select id from pg_temp.ids where name = 'mv2')) $$,
  'P0002', null, 'nor the publish gaps of a version');
select is((select count(*)::int from public.criteria_in_force('b3000000-0000-4000-8000-000000000205')), 0,
  'nor the internal criteria in force');
select throws_ok($$ select public.create_method_asset('x', 'Client method', 'model', 'strategic_models') $$,
  '42501', null, 'a client cannot author methodology');
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001',
  (select id from pg_temp.ids where name = 'mv'), 'x', 'y') $$, 'P0002', null, 'or start an application');

-- -----------------------------------------------------------------------------
-- The release label and title, and nothing else (D21)
-- -----------------------------------------------------------------------------
select is((select release_label || ' | ' || release_title from public.client_engagement_methodology('e0000000-0000-4000-8000-000000000001')),
  '1.0 | Development Architecture Method™ 1.0', 'a client reads the release label and title of their engagement');
select is(pg_get_function_result('public.client_engagement_methodology(uuid)'::regprocedure),
  'TABLE(release_label text, release_title text)', 'and the read model has no other column');
select pg_temp.act_as('contributor@meridian.test');
select is((select count(*)::int from public.client_engagement_methodology('e0000000-0000-4000-8000-000000000001')), 1,
  'every member of the engagement reads it');
select pg_temp.act_as('lead@harbor.test');
select is((select count(*)::int from public.client_engagement_methodology('e0000000-0000-4000-8000-000000000001')), 0,
  'a member of another engagement does not');
select pg_temp.reset_actor();
set local role anon;
select throws_ok($$ select * from public.client_engagement_methodology('e0000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'nor does an anonymous session');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Acceptance criteria reach clients only as agreed text (D24)
-- -----------------------------------------------------------------------------
select ok(pg_get_function_result('public.client_acceptance_criteria(uuid)'::regprocedure) !~* 'standard|informing|agreed_with|note',
  'client_acceptance_criteria has no informing Standard, party or note column');
select pg_temp.act_as('sponsor@meridian.test');
select is((select string_agg(governed_reference_code || ':' || body, ', ' order by reference_code)
  from public.client_acceptance_criteria('e0000000-0000-4000-8000-000000000001')),
  'CAP-005:The acquisition team is staffed, KNW-001:The market study is refreshed yearly',
  'a full-architecture client reads agreed, client-visible criteria only');
select pg_temp.act_as('contributor@meridian.test');
select is((select string_agg(governed_reference_code, ', ') from public.client_acceptance_criteria('e0000000-0000-4000-8000-000000000001')),
  'CAP-005', 'an area-limited Contributor reads only criteria on elements in their area');
select pg_temp.act_as('lead@harbor.test');
select is((select count(*)::int from public.client_acceptance_criteria('e0000000-0000-4000-8000-000000000001')), 0,
  'another engagement''s client reads none');
select is((select reference_code || ':' || cardinality(validation_relationship_ids)
  from public.client_acceptance_criteria('e0000000-0000-4000-8000-000000000003') where criterion_id = pg_temp.id('h-crit')),
  'ACR-001:0', 'an agreed criterion reaches the client without the internal validation that captured it');
-- Validations are recorded internal today; exercise the visible case directly.
select pg_temp.reset_actor();
set local session_replication_role = replica;
update public.architecture_relationships set client_visibility = 'client', published_at = now() where id = pg_temp.id('validation');
set local session_replication_role = origin;
select pg_temp.act_as('lead@harbor.test');
select is((select validation_relationship_ids from public.client_acceptance_criteria('e0000000-0000-4000-8000-000000000003')
  where criterion_id = pg_temp.id('h-crit')), array[pg_temp.id('validation')],
  'a client-visible validation lists the criteria it captured');
select pg_temp.act_as('sponsor@meridian.test');
select ok((select bool_and(r.state = 'agreed') from public.client_acceptance_criteria('e0000000-0000-4000-8000-000000000001') r),
  'proposed criteria never reach a client');

-- -----------------------------------------------------------------------------
-- Approach statements follow statement rules; snapshots keep their shape
-- -----------------------------------------------------------------------------
select is((select string_agg(s ->> 'statement_kind' || ':' || (s ->> 'body'), ', ')
  from public.client_architecture('e0000000-0000-4000-8000-000000000001') c, jsonb_array_elements(c.client_snapshot -> 'statements') s
  where c.element_id = 'c9000000-0000-4000-8000-000000000001'),
  'approach:Assessed using TPLCo''s Capability Readiness Diagnostic, through leadership interviews.',
  'a published, client-visible approach statement reaches the client; an internal one does not');
select is((select string_agg(k, ',' order by k) from public.client_architecture('e0000000-0000-4000-8000-000000000001') c,
  jsonb_object_keys(c.client_snapshot) k where c.element_id = 'c9000000-0000-4000-8000-000000000001'),
  'details,domains,element_id,engagement_wide,evidence,evidence_source_ids,kind,provenance,reference_code,statements,summary,title',
  'the client snapshot key set is unchanged');
select is((select string_agg(distinct k, ',' order by k) from public.client_architecture('e0000000-0000-4000-8000-000000000001') c,
  jsonb_array_elements(c.client_snapshot -> 'statements') s, jsonb_object_keys(s) k),
  'body,evidence,id,provenance,statement_kind', 'and so is the statement key set');
select is((select count(*)::int from public.client_architecture('e0000000-0000-4000-8000-000000000001') c
  where c.client_snapshot::text ~* 'method_asset|lineage|instantiates|judged_against|MUS-|Proprietary|anchor-led-cluster-development-model'),
  0, 'no client snapshot carries Method Library identity, lineage or application codes');
select is((select count(*)::int from public.client_architecture('e0000000-0000-4000-8000-000000000003') c
  where c.client_snapshot::text ~* 'method_asset|lineage|judged_against|ACR-|Minutes reviewed'), 0,
  'nor on Harbor, where a validation captured criteria');
select pg_temp.reset_actor();
select is((select count(*)::int from public.element_versions v where v.client_snapshot::text ~* 'method_asset|lineage_role|MUS-'), 0,
  'no stored client snapshot anywhere carries them');

-- Engagements expose the release id, which resolves to nothing for a client
select pg_temp.act_as('sponsor@meridian.test');
select ok((select dam_release_id is not null from public.engagements where id = 'e0000000-0000-4000-8000-000000000001'),
  'a client reads the engagement''s release id');
select is((select count(*)::int from public.dam_releases), 0, 'but not the release row itself');

-- -----------------------------------------------------------------------------
-- Internal readers
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select ok((select count(*) from public.method_library() where key = 'readiness-diagnostic') = 1,
  'an internal reader browses the library');
select is((select application_count || ':' || release_labels::text from public.method_library() where key = 'readiness-diagnostic'),
  '1:{1.1}', 'with use counts and release membership');
select is((select jsonb_array_length(applications) from public.method_usage(pg_temp.id('method')) where version_no = 1), 1,
  'method_usage lists the application on an engagement the reader is assigned to');
select is((select string_agg(source || ':' || role, ',' order by source, role)
  from public.element_practice_context('b3000000-0000-4000-8000-000000000205')), 'application:examined,lineage:judged_against',
  'the Practice panel lists the application link and the lineage');
select is((select reference_code || ':' || state || ':' || element_link_count
  from public.method_application_register('e0000000-0000-4000-8000-000000000001')), 'MUS-001:completed:2',
  'the register lists the application with its link count');
select pg_temp.act_as('sysadmin@tplco.test');
select ok((select count(*) from public.method_library()) > 0,
  'a System Administrator reads the library without holding methodology authority');
select throws_ok($$ select public.create_method_asset('y', 'Admin method', 'model', 'strategic_models') $$,
  '42501', null, 'but cannot author it');
select pg_temp.act_as('researcher@tplco.test');
select is((select lineage_count || ':' || jsonb_array_length(lineage) from public.method_usage(pg_temp.id('standard'))
  where version_no = 1), '2:1',
  'an internal reader not on Harbor sees the count across engagements but only the lineage they can read');

select * from finish();
rollback;
