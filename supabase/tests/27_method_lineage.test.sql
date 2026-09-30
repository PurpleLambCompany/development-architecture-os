-- =============================================================================
-- Phase 6 typed method lineage and the narrow methodology_derived (pgTAP).
-- Run with: pnpm db:test
--
-- Lineage pins an exact published version and a verb the form allows: a
-- Model is instantiated into a core object, a Deliverable is produced from a
-- Template of its type, a Standard is judged against by a Review, core
-- object or Implementation Initiative (D18). Methods and Instruments are
-- never lineage. Pre-Phase 6 rows stay as legacy history. Publishing
-- methodology_derived content needs instantiates lineage (D19). Lineage is
-- internal; clients never read it (ADR-0022).
-- =============================================================================
begin;

select plan(46);

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
grant all on pg_temp.ids to authenticated;
create function pg_temp.id(target text) returns uuid language sql as $$ select id from pg_temp.ids where name = target $$;
create function pg_temp.draft(asset uuid) returns uuid language sql security definer as $$
  select id from public.method_asset_versions where asset_id = asset and lifecycle = 'draft'
$$;
create function pg_temp.harbor(code text) returns uuid language sql security definer as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000003' and reference_code = code
$$;
create function pg_temp.lineage_count(element uuid) returns int language sql security definer as $$
  select count(*)::int from public.element_method_lineage where element_id = element
$$;

-- -----------------------------------------------------------------------------
-- Setup: one published asset of each form, and a Model left in draft
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('model', public.create_method_asset('ladder', 'Capability Ladder', 'model', 'strategic_models'));
insert into pg_temp.ids values ('model-v', pg_temp.draft(pg_temp.id('model')));
select public.update_method_asset_version(pg_temp.id('model-v'), '{"architectural_question": "Q", "applicability": "A", "change_summary": "First"}');
select public.set_method_version_outputs(pg_temp.id('model-v'), '[{"output_kind": "object", "object_type_key": "capability_gap"}]');
insert into pg_temp.ids values ('draft-model', public.create_method_asset('unready', 'Unready Model', 'model', 'strategic_models'));
insert into pg_temp.ids values ('draft-model-v', pg_temp.draft(pg_temp.id('draft-model')));
insert into pg_temp.ids values ('standard', public.create_method_asset('bar', 'Evidence Bar', 'standard', 'measurement_frameworks'));
insert into pg_temp.ids values ('standard-v', pg_temp.draft(pg_temp.id('standard')));
select public.update_method_asset_version(pg_temp.id('standard-v'), '{"architectural_question": "Q", "applicability": "A", "change_summary": "First"}');
select public.set_standard_version_criteria(pg_temp.id('standard-v'), '[{"key": "sourced", "statement": "Every claim is sourced"}]');
select public.set_standard_version_judged_in(pg_temp.id('standard-v'), '{review}');
insert into pg_temp.ids values ('template', public.create_method_asset('brief', 'Executive Summary Template', 'template', 'templates'));
insert into pg_temp.ids values ('template-v', pg_temp.draft(pg_temp.id('template')));
select public.update_method_asset_version(pg_temp.id('template-v'), '{"architectural_question": "Q", "applicability": "A", "change_summary": "First"}');
select public.set_template_version_spec(pg_temp.id('template-v'), 'executive_summary', '[{"title": "Position"}]');
insert into pg_temp.ids values ('instrument', public.create_method_asset('guide', 'Leader Interview Guide', 'instrument', 'question_libraries'));
insert into pg_temp.ids values ('instrument-v', pg_temp.draft(pg_temp.id('instrument')));
select public.update_method_asset_version(pg_temp.id('instrument-v'), '{"architectural_question": "Q", "applicability": "A",
  "change_summary": "First", "practitioner_instructions": "Ask."}');
select public.set_instrument_version_evidence_types(pg_temp.id('instrument-v'), '{interview}');
insert into pg_temp.ids values ('method', public.create_method_asset('scan', 'Readiness Scan', 'method', 'diagnostic_frameworks'));
insert into pg_temp.ids values ('method-v', pg_temp.draft(pg_temp.id('method')));
select public.update_method_asset_version(pg_temp.id('method-v'), '{"architectural_question": "Q", "applicability": "A",
  "change_summary": "First", "modes": ["assess"], "completion_criteria": "Done"}');
select public.set_method_version_stages(pg_temp.id('method-v'), '[{"key": "scan", "title": "Scan"}]');
select public.set_method_version_outputs(pg_temp.id('method-v'), '[{"output_kind": "object", "object_type_key": "capability_gap"}]');

select pg_temp.act_as('principal@tplco.test');
select public.publish_method_asset_version(pg_temp.id(k), '1.0')
from unnest(array['model-v', 'standard-v', 'template-v', 'instrument-v', 'method-v']) k;
insert into pg_temp.ids
select 'summary', public.create_deliverable('e0000000-0000-4000-8000-000000000001', 'executive_summary', 'Board Summary');
insert into pg_temp.ids
select 'map', public.create_deliverable('e0000000-0000-4000-8000-000000000001', 'capability_map', 'Capability Map');

select pg_temp.act_as('architect@tplco.test');
insert into public.architecture_elements (id, engagement_id, kind, title, provenance) values
  ('c8000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'object', 'Ladder gap', 'methodology_derived'),
  ('c8000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'object', 'Judged gap', 'architect_judgment'),
  ('c8000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'object', 'Plain gap', 'architect_judgment');
insert into public.architecture_objects (element_id, object_type) values
  ('c8000000-0000-4000-8000-000000000001', 'capability_gap'),
  ('c8000000-0000-4000-8000-000000000002', 'capability_gap'),
  ('c8000000-0000-4000-8000-000000000003', 'capability_gap');
insert into public.architecture_statements (element_id, statement_kind, body, provenance)
values ('c8000000-0000-4000-8000-000000000002', 'definition', 'Rungs follow the practice ladder.', 'methodology_derived');

-- -----------------------------------------------------------------------------
-- Seed: the anchor-led object keeps its legacy row and instantiates a Model
-- -----------------------------------------------------------------------------
select is((select string_agg(l.lineage_role || ':' || a.key || ':' || l.method_version, ', ' order by l.lineage_role)
  from public.element_method_lineage l join public.method_assets a on a.id = l.method_asset_id
  where l.element_id = 'b3000000-0000-4000-8000-000000000302'),
  'instantiates:anchor-led-cluster-development-model:1.0, legacy_derived_from:strategic-model-library-index:DAM 1.0',
  'the seeded anchor-led object instantiates its Model and keeps the Index as legacy lineage');

-- -----------------------------------------------------------------------------
-- Form, verb and kind (D18)
-- -----------------------------------------------------------------------------
select lives_ok($$ insert into pg_temp.ids select 'l-model', public.record_method_lineage('c8000000-0000-4000-8000-000000000001',
  pg_temp.id('model-v'), 'instantiates', 'Ladder applied') $$, 'a Model is instantiated into a core object');
select is((select l.method_asset_id || ':' || l.method_version from public.element_method_lineage l where l.id = pg_temp.id('l-model')),
  pg_temp.id('model') || ':1.0', 'the row pins the asset and the published version label');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000001', pg_temp.id('model-v'), 'instantiates') $$,
  '23505', null, 'the same lineage is recorded once');
select throws_ok($$ select public.record_method_lineage(pg_temp.id('summary'), pg_temp.id('model-v'), 'instantiates') $$,
  '23514', 'Only a Model is instantiated, and only into a core object', 'a Model is not instantiated into a Deliverable');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('standard-v'), 'instantiates') $$,
  '23514', 'Only a Model is instantiated, and only into a core object', 'a Standard is not instantiated');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('model-v'), 'judged_against') $$,
  '23514', null, 'a Model is not judged against');

select lives_ok($$ select public.record_method_lineage(pg_temp.id('summary'), pg_temp.id('template-v'), 'produced_from') $$,
  'a Deliverable is produced from a Template of its type');
select throws_ok($$ select public.record_method_lineage(pg_temp.id('map'), pg_temp.id('template-v'), 'produced_from') $$,
  '23514', 'This Template produces a different kind of Deliverable', 'but not from a Template for another deliverable type');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('template-v'), 'produced_from') $$,
  '23514', 'Only a Deliverable is produced from a Template', 'a core object is not produced from a Template');
select throws_ok($$ select public.record_method_lineage(pg_temp.id('summary'), pg_temp.id('model-v'), 'produced_from') $$,
  '23514', 'Only a Deliverable is produced from a Template', 'a Deliverable is produced only from a Template');

select lives_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('standard-v'), 'judged_against') $$,
  'a core object is judged against a Standard');
select lives_ok($$ select public.record_method_lineage(pg_temp.harbor('REV-001'), pg_temp.id('standard-v'), 'judged_against') $$,
  'so is a Review');
select lives_ok($$ select public.record_method_lineage(pg_temp.harbor('IMP-001'), pg_temp.id('standard-v'), 'judged_against') $$,
  'and an Implementation Initiative');
select throws_ok($$ select public.record_method_lineage(pg_temp.id('summary'), pg_temp.id('standard-v'), 'judged_against') $$,
  '23514', null, 'but not a Deliverable');

select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('method-v'), 'instantiates') $$,
  '23514', null, 'a Method is never lineage: instantiates');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('method-v'), 'judged_against') $$,
  '23514', null, 'nor judged_against');
select throws_ok($$ select public.record_method_lineage(pg_temp.id('summary'), pg_temp.id('method-v'), 'produced_from') $$,
  '23514', null, 'nor produced_from');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('instrument-v'), 'judged_against') $$,
  '23514', null, 'an Instrument is never lineage');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('instrument-v'), 'instantiates') $$,
  '23514', null, 'in any verb');

-- -----------------------------------------------------------------------------
-- Only current published proper versions; legacy is history only
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('draft-model-v'), 'instantiates') $$,
  '23514', 'Only the current published version of an active asset can be used', 'an unpublished Model version is not lineage');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003',
  (select v.id from public.method_asset_versions v join public.method_assets a on a.id = v.asset_id
   where a.key = 'strategic-model-library-index'), 'instantiates') $$,
  '23514', 'A legacy version cannot be used, cited or instantiated; adopt the asset first', 'a legacy version is not new lineage');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('model-v'), 'legacy_derived_from') $$,
  '23514', 'legacy_derived_from is only for pre-Phase 6 lineage', 'legacy_derived_from is never written again');
select throws_ok($$ select public.remove_method_lineage((select id from public.element_method_lineage
  where element_id = 'b3000000-0000-4000-8000-000000000302' and lineage_role = 'legacy_derived_from')) $$,
  '23514', 'Pre-Phase 6 lineage is kept as history', 'legacy lineage cannot be removed');

-- -----------------------------------------------------------------------------
-- Writes only through the operations; authority is edit_architecture
-- -----------------------------------------------------------------------------
select throws_ok($$ insert into public.element_method_lineage (element_id, method_asset_id, method_asset_version_id, lineage_role)
  values ('c8000000-0000-4000-8000-000000000003', pg_temp.id('model'), pg_temp.id('model-v'), 'instantiates') $$,
  '42501', null, 'an Architect cannot insert lineage directly');
select throws_ok($$ update public.element_method_lineage set note = 'x' where id = pg_temp.id('l-model') $$,
  '42501', null, 'or update it');
select throws_ok($$ delete from public.element_method_lineage where id = pg_temp.id('l-model') $$,
  '42501', null, 'or delete it');
select pg_temp.reset_actor();
select throws_ok($$ update public.element_method_lineage set method_asset_version_id = pg_temp.id('standard-v') where id = pg_temp.id('l-model') $$,
  '42501', null, 'even the table owner changes lineage only through the operations');

select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000003', pg_temp.id('model-v'), 'instantiates') $$,
  '42501', null, 'a System Administrator without edit_architecture cannot record lineage');
select throws_ok($$ select public.remove_method_lineage(pg_temp.id('l-model')) $$,
  '42501', null, 'or remove it');
select pg_temp.act_as('researcher@tplco.test');
select ok(pg_temp.lineage_count('c8000000-0000-4000-8000-000000000001') = 1
  and (select count(*) from public.element_method_lineage where element_id = 'c8000000-0000-4000-8000-000000000001') = 1,
  'an assigned internal reader sees the lineage');

-- -----------------------------------------------------------------------------
-- Clients never read lineage or write it (ADR-0022)
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.element_method_lineage), 0, 'a full-architecture client reads no lineage');
select is((select count(*)::int from public.method_assets), 0, 'and no Method Assets');
select throws_ok($$ select public.record_method_lineage('b3000000-0000-4000-8000-000000000301',
  (select id from pg_temp.ids where name = 'model-v'), 'instantiates') $$,
  'P0002', null, 'a client cannot record lineage');
select throws_ok($$ select public.remove_method_lineage((select id from pg_temp.ids where name = 'l-model')) $$,
  'P0002', null, 'or remove it');
select throws_ok($$ insert into public.element_method_lineage (element_id, method_asset_id, method_asset_version_id, lineage_role)
  values ('b3000000-0000-4000-8000-000000000301', (select id from pg_temp.ids where name = 'model'),
          (select id from pg_temp.ids where name = 'model-v'), 'instantiates') $$,
  '42501', null, 'or insert it directly');
select pg_temp.act_as('contributor@meridian.test');
select is((select count(*)::int from public.element_method_lineage), 0, 'an area-limited Client Contributor reads no lineage');

-- -----------------------------------------------------------------------------
-- D19: methodology_derived publishes only with instantiates lineage
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.publish_element_version('c8000000-0000-4000-8000-000000000002') $$,
  '23514', 'Methodology-derived content must record the Model it instantiates before it is published',
  'a methodology_derived statement blocks publication without instantiates lineage');
select public.record_method_lineage('c8000000-0000-4000-8000-000000000002', pg_temp.id('standard-v'), 'judged_against');
select throws_ok($$ select public.publish_element_version('c8000000-0000-4000-8000-000000000002') $$,
  '23514', null, 'judged_against lineage does not satisfy it');
select lives_ok($$ select public.publish_element_version('c8000000-0000-4000-8000-000000000001') $$,
  'a methodology_derived object with instantiates lineage publishes');
select lives_ok($$ select public.publish_element_version('c8000000-0000-4000-8000-000000000003') $$,
  'content that is not methodology_derived needs no lineage');
select lives_ok($$ select public.record_method_lineage('c8000000-0000-4000-8000-000000000002', pg_temp.id('model-v'), 'instantiates') $$,
  'recording the Model it instantiates');
select lives_ok($$ select public.publish_element_version('c8000000-0000-4000-8000-000000000002') $$,
  'lets it publish');

-- Removal after publication leaves the published version alone
select lives_ok($$ select public.remove_method_lineage(pg_temp.id('l-model')) $$,
  'an Architect removes typed lineage');
select is(pg_temp.lineage_count('c8000000-0000-4000-8000-000000000001'), 0, 'and it is gone');
select is((select count(*)::int from public.element_versions where element_id = 'c8000000-0000-4000-8000-000000000001'), 1,
  'the published version is untouched');

select * from finish();
rollback;
