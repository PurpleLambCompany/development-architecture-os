-- =============================================================================
-- Phase 6 Method Library core (pgTAP). Run with: pnpm db:test
--
-- Forms with enforced behavior (D1, D2), immutable versions (D5, D6),
-- categories (D4), rights recorded append-only (D23), protected files, and
-- the author/publish split of practice capabilities (D10, D11).
-- =============================================================================
begin;

select plan(116);

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
select is((select count(*)::int from public.method_assets), 3, 'and the Method Assets');
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

-- =============================================================================
-- DAM releases (D7, D8, D22, D27)
-- =============================================================================
select pg_temp.reset_actor();
select is((select string_agg(r.version_label || ':' || r.status || ':' || (select count(*) from public.dam_release_members m where m.release_id = r.id), ',')
  from public.dam_releases r), '1.0:published:2', 'the pre-Phase 6 methodology is release 1.0, with both legacy versions');
select is((select string_agg(distinct methodology_version, ',') from public.engagements
  where dam_release_id = (select id from public.dam_releases where version_label = '1.0')), 'DAM 1.0',
  'engagements carrying DAM 1.0 are conducted under release 1.0');
select ok((select jsonb_array_length(vocabulary_record -> 'object_types') = (select count(*) from public.architecture_object_types)
  from public.dam_releases where version_label = '1.0'), 'a release documents the vocabulary in force');

select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.dam_releases) + (select count(*)::int from public.dam_release_members), 0,
  'clients read no release rows');
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ select public.create_dam_release('1.1', 'DAM 1.1') $$, '42501', null,
  'a System Administrator cannot draft a release');
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('r11', public.create_dam_release('1.1', 'Development Architecture Method™ 1.1'));
select is((select count(*)::int from public.dam_release_members where release_id = pg_temp.id('r11')), 0,
  'legacy versions do not carry into a new release');
select throws_ok($$ select public.create_dam_release('1.2', 'Another') $$, '23514', null, 'one draft release at a time');
select throws_ok($$ select public.set_dam_release_member(pg_temp.id('r11'),
  (select id from public.method_asset_versions where legacy limit 1)) $$, '23514', null,
  'a legacy version cannot join a new release');
select throws_ok($$ select public.set_dam_release_member(pg_temp.id('r11'),
  (select id from public.method_asset_versions where lifecycle = 'retired' and not legacy limit 1)) $$, '23514', null,
  'nor a retired version');
select lives_ok($$ select public.set_dam_release_member(pg_temp.id('r11'), pg_temp.id('sdraft')) $$,
  'an author adds an exact published version');
select lives_ok($$ select public.set_dam_release_member(pg_temp.id('r11'), pg_temp.id('mdraft')) $$,
  'including a superseded version, pinned exactly');
select public.set_dam_release_member(pg_temp.id('r11'), pg_temp.id('idraft'));
select public.set_dam_release_member(pg_temp.id('r11'), pg_temp.id('idraft'));
select is((select count(*)::int from public.dam_release_members where release_id = pg_temp.id('r11')), 3,
  'at most one version per asset');
select throws_ok($$ select public.publish_dam_release(pg_temp.id('r11'), 'Adds the Method Library') $$, '42501', null,
  'an author cannot publish a release');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.publish_dam_release(pg_temp.id('r11')) $$, '23514', null, 'a release needs a change summary');
select lives_ok($$ select public.publish_dam_release(pg_temp.id('r11'), 'Adds the first governed assets') $$,
  'a methodology authority publishes release 1.1');
select is((select string_agg(version_label || ':' || status, ',' order by version_label) from public.dam_releases),
  '1.0:superseded,1.1:published', 'which supersedes 1.0');
select throws_ok($$ select public.set_dam_release_member(pg_temp.id('r11'), pg_temp.id('tdraft')) $$, '23514', null,
  'a published release is frozen');
select throws_ok($$ select public.delete_dam_release(pg_temp.id('r11')) $$, '23514', null, 'and permanent');
insert into pg_temp.ids values ('r09', public.create_dam_release('0.9', 'Out of order'));
select public.set_dam_release_member(pg_temp.id('r09'), pg_temp.id('sdraft'));
select throws_ok($$ select public.publish_dam_release(pg_temp.id('r09'), 'x') $$, '23514', null,
  'a release must follow the latest published release');
select lives_ok($$ select public.delete_dam_release(pg_temp.id('r09')) $$, 'a draft release can be deleted');
select is((select count(*)::int from public.engagements where methodology_version = 'DAM 1.1'), 0,
  'publishing a release moves no engagement');

-- Engagements move only deliberately.
select throws_ok($$ update public.engagements set dam_release_id = pg_temp.id('r11')
  where id = 'e0000000-0000-4000-8000-000000000001' $$, '42501', null, 'the release is never changed directly');
select throws_ok($$ update public.engagements set methodology_version = 'DAM 9'
  where id = 'e0000000-0000-4000-8000-000000000001' $$, '23514', null, 'nor the methodology version');
select throws_ok($$ select public.set_engagement_dam_release('e0000000-0000-4000-8000-000000000001',
  (select id from public.dam_releases where version_label = '1.0'), 'Back') $$, '23514', null,
  'an engagement moves only to the published release');
select throws_ok($$ select public.set_engagement_dam_release('e0000000-0000-4000-8000-000000000001', pg_temp.id('r11'), '') $$,
  '23514', null, 'and with a reason');
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok($$ select public.set_engagement_dam_release('e0000000-0000-4000-8000-000000000001', pg_temp.id('r11'), 'x') $$,
  'P0002', null, 'clients cannot move an engagement');
select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ select public.set_engagement_dam_release('e0000000-0000-4000-8000-000000000001', pg_temp.id('r11'),
  'Adopting the Method Library') $$, 'a publish_architecture holder moves the engagement to 1.1');
select is((select methodology_version from public.engagements where id = 'e0000000-0000-4000-8000-000000000001'),
  'DAM 1.1', 'and the methodology version follows');
select pg_temp.reset_actor();
select is((select metadata_json ->> 'reason' from public.activity_log where action_type = 'dam_release_changed'),
  'Adopting the Method Library', 'the move is logged with its reason');
insert into public.engagements (client_organization_id, title, slug, engagement_type)
select client_organization_id, 'New work', 'new-work-under-dam', engagement_type
from public.engagements where id = 'e0000000-0000-4000-8000-000000000001';
select is((select methodology_version from public.engagements where slug = 'new-work-under-dam'), 'DAM 1.1',
  'a new engagement starts on the current published release');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.retire_dam_release((select id from public.dam_releases where version_label = '1.0'), 'Old') $$,
  '23514', null, 'a release cannot be retired while engagements in progress use it');

-- =============================================================================
-- Development Context (D15, D16)
-- =============================================================================
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.create_development_context('college', 'College', 'A college developing a capability') $$,
  '42501', null, 'Development Contexts are governed by publish_methodology holders');
select pg_temp.act_as('principal@tplco.test');
insert into pg_temp.ids values ('college', public.create_development_context('college_capability',
  'College developing an institutional capability', 'A college building a capability it does not yet have.'));
insert into pg_temp.ids values ('region', public.create_development_context('regional_cluster',
  'Region developing an industry cluster', 'A region growing an industry cluster.'));
insert into pg_temp.ids values ('district', public.create_development_context('planned_district',
  'District being planned', 'A real-estate district being planned.'));
select throws_ok($$ select public.revise_development_context(pg_temp.id('college'), 'College', 'Redefined', ' ') $$,
  '23514', null, 'a redefinition needs a reason');
select public.revise_development_context(pg_temp.id('college'), 'College building a capability',
  'A college building a capability.', 'Shorter label');
select is((select prior_label from public.development_context_revisions where context_id = pg_temp.id('college')),
  'College developing an institutional capability', 'the prior definition is kept');
select public.retire_development_context(pg_temp.id('district'), 'Folded into another context');
select throws_ok($$ select public.revise_development_context(pg_temp.id('district'), 'x', 'y', 'z') $$, '23514', null,
  'a retired context stays as it was');
select pg_temp.reset_actor();
select private.begin_methodology_operation();
select throws_ok($$ update public.development_contexts set key = 'renamed' where id = pg_temp.id('college') $$, '23514', null,
  'context keys are permanent');
select throws_ok($$ delete from public.development_contexts where id = pg_temp.id('district') $$, '23514', null,
  'contexts are never deleted');
select private.end_methodology_operation();

select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.set_engagement_development_contexts('e0000000-0000-4000-8000-000000000001',
  array[pg_temp.id('college'), pg_temp.id('region')], null) $$, '23514', null, 'one context is primary');
select throws_ok($$ select public.set_engagement_development_contexts('e0000000-0000-4000-8000-000000000001',
  array[pg_temp.id('district')], pg_temp.id('district')) $$, '23514', null, 'a retired context cannot be added');
select lives_ok($$ select public.set_engagement_development_contexts('e0000000-0000-4000-8000-000000000001',
  array[pg_temp.id('region'), pg_temp.id('college')], pg_temp.id('region')) $$,
  'an edit_architecture holder declares the engagement''s contexts');
select is((select string_agg(c.key || ':' || x.is_primary, ',' order by c.key) from public.engagement_development_contexts x
  join public.development_contexts c on c.id = x.context_id where x.engagement_id = 'e0000000-0000-4000-8000-000000000001'),
  'college_capability:false,regional_cluster:true', 'with one primary');
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.engagement_development_contexts) + (select count(*)::int from public.development_contexts),
  0, 'contexts are internal classification: clients see none');
select throws_ok($$ select public.set_engagement_development_contexts('e0000000-0000-4000-8000-000000000001', '{}', null) $$,
  'P0002', null, 'and cannot set them');

-- Declared applicability on versions.
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('m3', public.create_method_asset_version(pg_temp.id('method')));
select throws_ok($$ select public.set_method_version_contexts(pg_temp.id('m3'), array[pg_temp.id('district')]) $$,
  '23514', null, 'a version declares only active contexts');
select lives_ok($$ select public.set_method_version_contexts(pg_temp.id('m3'), array[pg_temp.id('college')]) $$,
  'a draft declares where it applies');
select throws_ok($$ select public.set_method_version_contexts(pg_temp.id('sdraft'), array[pg_temp.id('college')]) $$,
  '23514', null, 'a published version''s contexts are frozen');

-- Clients never reach the new content, files included.
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.method_asset_versions) + (select count(*)::int from public.method_version_files)
  + (select count(*)::int from public.method_asset_rights_holders) + (select count(*)::int from public.standard_version_criteria),
  0, 'clients read no versions, files, rights or criteria');
select ok(not private.can_read_method_file((select pg_temp.id('tdraft')::text || '/x/map.docx')),
  'and no protected file');

select * from finish();
rollback;
