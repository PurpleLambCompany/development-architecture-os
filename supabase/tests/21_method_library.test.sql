-- =============================================================================
-- Phase 6 Method Library core (pgTAP). Run with: pnpm db:test
--
-- Forms with enforced behavior (D1, D2), immutable versions (D5, D6),
-- categories (D4), rights recorded append-only (D23), protected files, and
-- the author/publish split of practice capabilities (D10, D11).
-- =============================================================================
begin;

select plan(70);

create function pg_temp.act_as(user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  execute 'reset role';
  select id into uid from auth.users where email = user_email;
  if uid is null then
    raise exception 'No seeded user %', user_email;
  end if;
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

-- -----------------------------------------------------------------------------
-- Access: internal read, nothing for clients, no direct writes
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select is((select count(*)::int from public.method_asset_categories), 12, 'internal users read the categories');
select is((select count(*)::int from public.method_assets), 2, 'and the Method Assets');
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.method_asset_categories), 0, 'clients read no categories');
select is((select count(*)::int from public.method_assets), 0, 'clients read no Method Assets');
select throws_ok($$ insert into public.method_assets (title) values ('x') $$, '42501', null,
  'nobody writes Method Assets directly');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ insert into public.method_asset_versions (asset_id, version_no)
  select id, 9 from public.method_assets limit 1 $$, '42501', null, 'not even a methodology authority');
select throws_ok($$ update public.method_assets set title = 'x' $$, '42501', null, 'or updates them directly');

-- -----------------------------------------------------------------------------
-- Authoring: author_methodology drafts; others cannot
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ select public.create_method_asset('x', 'X', 'method', 'other') $$, '42501', null,
  'a System Administrator cannot author methodology');
select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.create_method_asset('x', 'X', 'method', 'other') $$, '42501', null,
  'nor can a Researcher by default');
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok($$ select public.create_method_asset('x', 'X', 'method', 'other') $$, '42501', null,
  'nor any client');

select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.create_method_asset('x', 'X', 'method', 'no_such_category') $$, '23514', null,
  'a category must be one of the governed categories');
insert into pg_temp.ids values ('method', public.create_method_asset(
  'stakeholder-diagnostic', 'Stakeholder Readiness Diagnostic', 'method', 'diagnostic_frameworks'));
select is((select lifecycle::text || ':' || version_no from public.method_asset_versions where asset_id = pg_temp.id('method')),
  'draft:1', 'an Architect authors a new Method with a first draft');
select is((select status || ':' || origin from public.method_assets where id = pg_temp.id('method')),
  'active:tplco_developed', 'TPLCo owns methodology by default');
insert into pg_temp.ids values ('mdraft', pg_temp.draft(pg_temp.id('method')));

select throws_ok($$ select public.create_method_asset('stakeholder-diagnostic', 'Again', 'model', 'other') $$,
  '23505', null, 'keys are unique');
select throws_ok($$ select public.update_method_asset_version(pg_temp.id('mdraft'), '{"architectural_questoin": "x"}') $$,
  '22023', null, 'unknown content fields are refused, never dropped');

-- Standards, Instruments, Templates and a Model to work with.
insert into pg_temp.ids values ('standard', public.create_method_asset('readiness-scale', 'Readiness Scale', 'standard', 'measurement_frameworks'));
insert into pg_temp.ids values ('sdraft', pg_temp.draft(pg_temp.id('standard')));
insert into pg_temp.ids values ('instrument', public.create_method_asset('leader-interviews', 'Leader Interview Guide', 'instrument', 'question_libraries'));
insert into pg_temp.ids values ('idraft', pg_temp.draft(pg_temp.id('instrument')));
insert into pg_temp.ids values ('template', public.create_method_asset('capability-map', 'Capability Map Template', 'template', 'templates'));
insert into pg_temp.ids values ('tdraft', pg_temp.draft(pg_temp.id('template')));
insert into pg_temp.ids values ('model', public.create_method_asset('anchor-cluster', 'Anchor-led Cluster Model', 'model', 'strategic_models'));
insert into pg_temp.ids values ('modraft', pg_temp.draft(pg_temp.id('model')));

-- -----------------------------------------------------------------------------
-- Forms are not labels: each holds only its own structure
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.set_method_version_stages(pg_temp.id('sdraft'), '[{"key": "a", "title": "A"}]') $$,
  '23514', null, 'a Standard has no stages');
select throws_ok($$ select public.update_method_asset_version(pg_temp.id('sdraft'), '{"completion_criteria": "Done"}') $$,
  '23514', null, 'completion criteria belong only to a Method');
select throws_ok($$ select public.set_standard_version_criteria(pg_temp.id('mdraft'), '[{"key": "a", "statement": "A"}]') $$,
  '23514', null, 'a Method has no Standard criteria');
select throws_ok($$ select public.set_template_version_spec(pg_temp.id('idraft'), 'capability_map', '[]') $$,
  '23514', null, 'an Instrument produces no deliverable type');
select throws_ok($$ select public.set_instrument_version_evidence_types(pg_temp.id('tdraft'), '{interview}') $$,
  '23514', null, 'a Template gathers no evidence');
select throws_ok($$ select public.set_method_version_outputs(pg_temp.id('modraft'), '[{"output_kind": "risk"}]') $$,
  '23514', null, 'a Model is applied into architecture objects only');
select throws_ok($$ select public.attach_method_version_file(pg_temp.id('mdraft'), 'guide.pdf', 'application/pdf', 100) $$,
  '23514', null, 'only Templates and Instruments carry protected files');

-- -----------------------------------------------------------------------------
-- Publication: publish_methodology only, and only when the form's
-- requirements are met
-- -----------------------------------------------------------------------------
select public.update_method_asset_version(pg_temp.id('sdraft'),
  '{"architectural_question": "How ready is the capability?", "applicability": "Any capability", "change_summary": "First version"}');
select throws_ok($$ select public.publish_method_asset_version(pg_temp.id('sdraft'), '1.0') $$, '42501', null,
  'an Architect authors but cannot publish');

select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.publish_method_asset_version(pg_temp.id('sdraft'), '1.0') $$, '23514',
  'This standard cannot be published yet. It needs at least one criterion, where it is judged',
  'a Standard needs criteria and settings');
select pg_temp.act_as('architect@tplco.test');
select public.set_standard_version_criteria(pg_temp.id('sdraft'),
  '[{"key": "leadership", "statement": "Leadership is in place"}, {"key": "talent", "statement": "Talent is available", "scale": "1-5"}]');
select public.set_standard_version_judged_in(pg_temp.id('sdraft'), '{review,assessment}');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.publish_method_asset_version(pg_temp.id('sdraft'), '') $$, '23514', null,
  'a published version needs a label');
select lives_ok($$ select public.publish_method_asset_version(pg_temp.id('sdraft'), '1.0') $$,
  'a Principal Architect publishes the Standard');
select is((select lifecycle::text || ':' || version_label from public.method_asset_versions where id = pg_temp.id('sdraft')),
  'published:1.0', 'the version is published under its label');
select is((select current_version_id from public.method_assets where id = pg_temp.id('standard')), pg_temp.id('sdraft'),
  'and becomes the asset''s current version');

-- Instrument, Template, Model requirements.
select pg_temp.act_as('architect@tplco.test');
select public.update_method_asset_version(pg_temp.id(d),
  '{"architectural_question": "Q", "applicability": "A", "change_summary": "First version"}')
from unnest(array['idraft', 'tdraft', 'modraft', 'mdraft']) d;
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.publish_method_asset_version(pg_temp.id('idraft'), '1.0') $$, '23514',
  'This instrument cannot be published yet. It needs the evidence types it gathers, usage guidance',
  'an Instrument needs evidence types and usage guidance');
select throws_ok($$ select public.publish_method_asset_version(pg_temp.id('tdraft'), '1.0') $$, '23514',
  'This template cannot be published yet. It needs the deliverable type it produces, a section outline',
  'a Template needs its deliverable type and outline');
select throws_ok($$ select public.publish_method_asset_version(pg_temp.id('modraft'), '1.0') $$, '23514',
  'This model cannot be published yet. It needs at least one object type it is applied into',
  'a Model needs the object types it is applied into');
select throws_ok($$ select public.publish_method_asset_version(pg_temp.id('mdraft'), '1.0') $$, '23514',
  'This method cannot be published yet. It needs at least one stage, at least one mode, at least one expected output, completion criteria',
  'a Method needs stages, modes, expected outputs and completion criteria');

select pg_temp.act_as('architect@tplco.test');
select public.set_instrument_version_evidence_types(pg_temp.id('idraft'), '{interview,meeting_notes}');
select public.update_method_asset_version(pg_temp.id('idraft'), '{"practitioner_instructions": "Ask each leader the core questions."}');
select public.set_template_version_spec(pg_temp.id('tdraft'), 'capability_map', '[{"title": "Capabilities"}, {"title": "Gaps"}]');
select public.set_method_version_outputs(pg_temp.id('modraft'), '[{"output_kind": "object", "object_type_key": "strategic_model"}]');
select lives_ok($$ select public.attach_method_version_file(pg_temp.id('tdraft'), 'map.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 2048) $$,
  'an author registers a protected Template file on a draft');
select ok(private.can_upload_method_file((select object_path from public.method_version_files where version_id = pg_temp.id('tdraft'))),
  'and may upload it to its registered path');
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.publish_method_asset_version(pg_temp.id(d), '1.0')
  from unnest(array['idraft', 'tdraft', 'modraft']) d $$, 'complete Instruments, Templates and Models publish');

-- The Method, with components.
select pg_temp.act_as('architect@tplco.test');
select public.set_method_version_stages(pg_temp.id('mdraft'),
  '[{"key": "interview", "title": "Interview leaders"}, {"key": "assess", "title": "Assess readiness"}]');
select public.set_method_version_outputs(pg_temp.id('mdraft'),
  '[{"output_kind": "object", "object_type_key": "capability_gap"}, {"output_kind": "risk"}, {"output_kind": "deliverable", "deliverable_type": "capability_map"}]');
select public.update_method_asset_version(pg_temp.id('mdraft'),
  format('{"modes": ["discover", "assess"], "completion_criteria": "Every leader interviewed", "completion_standard_version_id": "%s"}',
         pg_temp.id('sdraft'))::jsonb);
select throws_ok($$ select public.set_method_version_components(pg_temp.id('mdraft'),
  jsonb_build_array(jsonb_build_object('component_version_id', pg_temp.id('mdraft')))) $$, '23514', null,
  'a draft is never a component');
select lives_ok($$ select public.set_method_version_components(pg_temp.id('mdraft'), jsonb_build_array(
  jsonb_build_object('component_version_id', pg_temp.id('idraft')),
  jsonb_build_object('component_version_id', pg_temp.id('sdraft')),
  jsonb_build_object('component_version_id', pg_temp.id('tdraft')))) $$,
  'a Method names the exact Instrument, Standard and Template versions it normally uses');
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.publish_method_asset_version(pg_temp.id('mdraft'), '1.0') $$, 'the Method publishes');

-- -----------------------------------------------------------------------------
-- Immutability
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.update_method_asset_version(pg_temp.id('mdraft'), '{"summary": "Edited"}') $$,
  '23514', null, 'a published version cannot be edited');
select throws_ok($$ select public.set_method_version_stages(pg_temp.id('mdraft'), '[]') $$, '23514', null,
  'nor its stages');
select throws_ok($$ select public.delete_method_asset_version(pg_temp.id('mdraft')) $$, '23514', null,
  'nor deleted');
select throws_ok($$ select public.update_method_asset(pg_temp.id('method'), 'Stakeholder Readiness Diagnostic',
  'diagnostic_frameworks', null, null, 'model') $$, '23514', null, 'a form is fixed once published');
select pg_temp.reset_actor();
select private.begin_methodology_operation();
select throws_ok($$ update public.method_asset_versions set summary = 'Tampered' where id = pg_temp.id('mdraft') $$,
  '23514', null, 'the database refuses content changes even inside an operation');
select throws_ok($$ delete from public.method_version_stages where version_id = pg_temp.id('mdraft') $$,
  '23514', null, 'and changes to any child row');
select throws_ok($$ update public.method_asset_versions set lifecycle = 'draft' where id = pg_temp.id('mdraft') $$,
  '23514', null, 'a published version never returns to draft');
select throws_ok($$ delete from public.method_asset_versions where id = pg_temp.id('mdraft') $$,
  '23514', null, 'and is never deleted');
select private.end_methodology_operation();

-- -----------------------------------------------------------------------------
-- New versions, supersession, drafts are disposable
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('m2', public.create_method_asset_version(pg_temp.id('method')));
select is((select count(*)::int from public.method_version_stages where version_id = pg_temp.id('m2')), 2,
  'a new draft starts from the published content');
select is((select derived_from_version_id from public.method_asset_versions where id = pg_temp.id('m2')),
  pg_temp.id('mdraft'), 'and records what it derives from');
select throws_ok($$ select public.create_method_asset_version(pg_temp.id('method')) $$, '23514', null,
  'one draft per asset');
select lives_ok($$ select public.delete_method_asset_version(pg_temp.id('m2')) $$, 'a draft can be deleted');
delete from pg_temp.ids where name = 'm2';
insert into pg_temp.ids values ('m2', public.create_method_asset_version(pg_temp.id('method')));
select public.update_method_asset_version(pg_temp.id('m2'), '{"change_summary": "Adds a workshop stage"}');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.publish_method_asset_version(pg_temp.id('m2'), '1.0') $$, '23514', null,
  'version labels are unique per asset');
select lives_ok($$ select public.publish_method_asset_version(pg_temp.id('m2'), '1.1') $$, 'version 1.1 publishes');
select is((select string_agg(version_label || ':' || lifecycle, ',' order by version_no)
  from public.method_asset_versions where asset_id = pg_temp.id('method')),
  '1.0:superseded,1.1:published', 'and supersedes 1.0, which stays readable');

-- -----------------------------------------------------------------------------
-- Retirement
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.retire_method_asset_version(pg_temp.id('m2'), 'Unsound') $$, '42501', null,
  'retirement needs publish_methodology');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.retire_method_asset_version(pg_temp.id('m2'), ' ') $$, '23514', null,
  'and a reason');
select throws_ok($$ select public.retire_method_asset_version(pg_temp.id('mdraft'), 'Old') $$, '23514', null,
  'only the published version can be retired');
select lives_ok($$ select public.retire_method_asset_version(pg_temp.id('m2'), 'Found unsound in use') $$,
  'the published version is retired');
select is((select current_version_id from public.method_assets where id = pg_temp.id('method')), null,
  'leaving the asset with no current version');
select lives_ok($$ select public.retire_method_asset(pg_temp.id('model'), 'Replaced by a better model') $$,
  'an asset can be retired');
select is((select a.status || ':' || v.lifecycle from public.method_assets a
  join public.method_asset_versions v on v.asset_id = a.id where a.id = pg_temp.id('model')),
  'retired:retired', 'which retires its current version');
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.create_method_asset_version(pg_temp.id('model')) $$, '23514', null,
  'a retired asset takes no new versions');

-- -----------------------------------------------------------------------------
-- Origin and rights: recorded, append-only
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.record_method_rights_holder(pg_temp.id('standard'), null, 'Harbor Authority', 'co_owner') $$,
  '42501', null, 'recording rights needs publish_methodology');
select pg_temp.act_as('principal@tplco.test');
select public.set_method_asset_origin(pg_temp.id('standard'), 'co_developed', 'Developed with the Harbor team');
insert into pg_temp.ids values ('right', public.record_method_rights_holder(
  pg_temp.id('standard'), null, 'Harbor Authority', 'co_owner', 'MSA 2026-04'));
select throws_ok($$ select public.record_method_rights_holder(pg_temp.id('standard'), null, null, 'owner') $$,
  '23514', null, 'a rights record names exactly one holder');
select lives_ok($$ select public.supersede_method_rights_holder(pg_temp.id('right'), 'Agreement amended',
  null, 'Harbor Regional Authority', 'co_owner', 'MSA 2026-04 amendment 1') $$,
  'a correction supersedes the prior record');
select throws_ok($$ select public.supersede_method_rights_holder(pg_temp.id('right'), 'Again') $$, '23514', null,
  'a superseded record is final');
select is((select count(*)::int from public.method_asset_rights_holders where asset_id = pg_temp.id('standard')), 2,
  'history is kept');
select pg_temp.reset_actor();
select is((select metadata_json ->> 'reason' from public.activity_log
  where entity_id = pg_temp.id('standard') and action_type = 'origin_changed'), 'Developed with the Harbor team',
  'an origin change is logged with its reason');
select private.begin_methodology_operation();
select throws_ok($$ delete from public.method_asset_rights_holders where id = pg_temp.id('right') $$, '23514', null,
  'rights records are never deleted');
select private.end_methodology_operation();

-- Clients never reach the new content, files included.
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.method_asset_versions) + (select count(*)::int from public.method_version_files)
  + (select count(*)::int from public.method_asset_rights_holders) + (select count(*)::int from public.standard_version_criteria),
  0, 'clients read no versions, files, rights or criteria');
select ok(not private.can_read_method_file((select pg_temp.id('tdraft')::text || '/x/map.docx')),
  'and no protected file');

select * from finish();
rollback;
