-- =============================================================================
-- Phase 6 Method Applications (pgTAP). Run with: pnpm db:test
--
-- Only published Methods are applied (D2, D9); applications are internal,
-- off-spine records with MUS codes (D13, D14), stages as guidance and a
-- freeze at closure (D17). Element links keep their captured identity when
-- a linked unpublished draft is later deleted, including after closure (D30).
-- =============================================================================
begin;

select plan(65);

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
create function pg_temp.harbor_element(target_kind public.element_kind) returns uuid
language sql security definer as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000003' and kind = target_kind
  order by reference_code limit 1
$$;
create function pg_temp.meridian_element(target_kind public.element_kind, published boolean) returns uuid
language sql security definer as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' and kind = target_kind
    and (latest_version_id is not null) = published and lifecycle <> 'retired'
  order by reference_code limit 1
$$;

-- -----------------------------------------------------------------------------
-- Setup: a published Method with an Instrument component, and a Standard
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('instrument', public.create_method_asset('guide', 'Interview Guide', 'instrument', 'question_libraries'));
insert into pg_temp.ids values ('iv', pg_temp.draft(pg_temp.id('instrument')));
select public.update_method_asset_version(pg_temp.id('iv'), '{"architectural_question": "Q", "applicability": "A",
  "change_summary": "First", "practitioner_instructions": "Ask."}');
select public.set_instrument_version_evidence_types(pg_temp.id('iv'), '{interview}');
insert into pg_temp.ids values ('standard', public.create_method_asset('scale', 'Readiness Scale', 'standard', 'measurement_frameworks'));
insert into pg_temp.ids values ('sv', pg_temp.draft(pg_temp.id('standard')));
select public.update_method_asset_version(pg_temp.id('sv'), '{"architectural_question": "Q", "applicability": "A", "change_summary": "First"}');
select public.set_standard_version_criteria(pg_temp.id('sv'), '[{"key": "lead", "statement": "Leadership in place"}]');
select public.set_standard_version_judged_in(pg_temp.id('sv'), '{assessment}');
insert into pg_temp.ids values ('method', public.create_method_asset('diag', 'Readiness Diagnostic', 'method', 'diagnostic_frameworks'));
insert into pg_temp.ids values ('mv', pg_temp.draft(pg_temp.id('method')));
select public.update_method_asset_version(pg_temp.id('mv'), '{"architectural_question": "How ready?", "applicability": "A",
  "change_summary": "First", "modes": ["assess"], "completion_criteria": "All leaders interviewed"}');
select public.set_method_version_stages(pg_temp.id('mv'), '[{"key": "interview", "title": "Interview"}, {"key": "assess", "title": "Assess"}]');
select public.set_method_version_outputs(pg_temp.id('mv'), '[{"output_kind": "object", "object_type_key": "capability_gap"}]');
select pg_temp.act_as('principal@tplco.test');
select public.publish_method_asset_version(pg_temp.id('iv'), '1.0');
select public.publish_method_asset_version(pg_temp.id('sv'), '1.0');
select pg_temp.act_as('architect@tplco.test');
select public.set_method_version_components(pg_temp.id('mv'), jsonb_build_array(jsonb_build_object('component_version_id', pg_temp.id('iv'))));
insert into pg_temp.ids values ('unpublished-method', pg_temp.id('mv'));
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Readiness', 'Because') $$, '23514', null, 'a draft Method cannot be applied');
select pg_temp.act_as('principal@tplco.test');
select public.publish_method_asset_version(pg_temp.id('mv'), '1.0');

-- A context on the engagement, snapshotted at start.
insert into pg_temp.ids values ('ctx', public.create_development_context('regional_cluster', 'Region', 'A region.'));
select public.set_engagement_development_contexts('e0000000-0000-4000-8000-000000000001', array[pg_temp.id('ctx')], pg_temp.id('ctx'));

-- -----------------------------------------------------------------------------
-- Starting: Methods only, reason required, release recorded
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('sv'),
  'Judging', 'Because', '', 'Pilot') $$, '23514', 'This needs a method, not a standard',
  'a Standard is judged against, never applied');
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('iv'),
  'Interviews', 'Because', '', 'Pilot') $$, '23514', 'This needs a method, not a instrument',
  'an Instrument is used within an application, never applied alone');
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001',
  (select id from public.method_asset_versions where legacy limit 1), 'Legacy', 'Because', '', 'Pilot') $$, '23514', null,
  'a legacy version cannot be applied');
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Readiness', 'Because') $$, '23514', null, 'a version outside the engagement''s release needs a reason');
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Readiness', ' ', '', 'Pilot') $$, '23514', null, 'the selection reason is required');
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Readiness', 'Because', '', 'Pilot') $$, '42501', null, 'a System Administrator without edit_architecture cannot apply it');
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Readiness', 'Because', '', 'Pilot') $$, 'P0002', null, 'nor can a client');

select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('app', public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Leadership readiness', 'The district''s capability gaps are unassessed', 'Is leadership ready?', 'Piloting the new diagnostic'));
select is((select reference_code || ':' || state || ':' || version_in_release from public.method_applications where id = pg_temp.id('app')),
  'MUS-001:planned:false', 'an Architect starts MUS-001, recorded as outside the release');
select is((select dam_release_id from public.method_applications where id = pg_temp.id('app')),
  (select dam_release_id from public.engagements where id = 'e0000000-0000-4000-8000-000000000001'),
  'with the engagement''s release at start');
select is((select count(*)::int from public.method_application_contexts where application_id = pg_temp.id('app')), 1,
  'and a snapshot of the engagement''s contexts');
select is((select role from public.method_application_practitioners where application_id = pg_temp.id('app')), 'lead',
  'the caller leads it');
select is((select count(*)::int from public.architecture_elements where reference_code like 'MUS-%'), 0,
  'it is not an architecture element');

-- In the release: no reason needed.
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('r11', public.create_dam_release('1.1', 'DAM 1.1'));
select public.set_dam_release_member(pg_temp.id('r11'), pg_temp.id('mv'));
select pg_temp.act_as('principal@tplco.test');
select public.publish_dam_release(pg_temp.id('r11'), 'Adds the diagnostic');
select public.set_engagement_dam_release('e0000000-0000-4000-8000-000000000001', pg_temp.id('r11'), 'Adopting DAM 1.1');
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('app2', public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Second pass', 'Follow-up'));
select is((select reference_code || ':' || version_in_release from public.method_applications where id = pg_temp.id('app2')),
  'MUS-002:true', 'a release member needs no exception reason');

-- -----------------------------------------------------------------------------
-- Stages are guidance; components and links follow form and kind rules
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.set_method_application_stage_note(pg_temp.id('app'),
  (select id from public.method_version_stages where version_id = pg_temp.id('mv') and key = 'assess'), 'skipped', '', '') $$,
  '23514', null, 'skipping a stage needs a reason');
select lives_ok($$ select public.set_method_application_stage_note(pg_temp.id('app'),
  (select id from public.method_version_stages where version_id = pg_temp.id('mv') and key = 'interview'), 'adapted',
  'Small leadership team', 'Three interviews instead of eight') $$, 'a stage note records an adaptation');
select throws_ok($$ select public.set_method_application_stage_note(pg_temp.id('app'),
  (select id from public.method_version_stages where version_id <> pg_temp.id('mv') limit 1), 'followed', null, '') $$,
  '23514', null, 'only stages of the pinned version');
select is((select count(*)::int from information_schema.columns where table_name = 'method_application_stage_notes'
  and column_name in ('assignee', 'due_on', 'status', 'percent_complete', 'assigned_to')), 0,
  'stages carry no assignee, date, status or percent complete');

select throws_ok($$ select public.set_method_application_asset(pg_temp.id('app'), pg_temp.id('mv')) $$, '23514', null,
  'a Method is not used as a component');
select lives_ok($$ select public.set_method_application_asset(pg_temp.id('app'), pg_temp.id('sv'), 'Not declared by the Method') $$,
  'the Standard actually used is recorded, with its deviation');

-- Role and kind rules, on a Harbor application (Harbor holds the Reviews and initiatives).
insert into pg_temp.ids values ('happ', public.start_method_application('e0000000-0000-4000-8000-000000000003', pg_temp.id('mv'),
  'Harbor readiness', 'Readiness before expansion', '', 'Piloting'));
select throws_ok($$ select public.link_method_application_element(pg_temp.id('happ'), pg_temp.harbor_element('review'), 'produced') $$,
  '23514', null, 'Reviews are convened, never produced by method work');
select throws_ok($$ select public.link_method_application_element(pg_temp.id('happ'),
  pg_temp.harbor_element('implementation_initiative'), 'produced') $$, '23514', null,
  'Implementation Initiatives are initiated, never produced');
select lives_ok($$ select public.link_method_application_element(pg_temp.id('happ'), pg_temp.harbor_element('review'), 'informed') $$,
  'a Review can be informed');
select lives_ok($$ select public.link_method_application_element(pg_temp.id('happ'), pg_temp.harbor_element('deliverable'), 'produced') $$,
  'a Deliverable can be produced');
select throws_ok($$ select public.link_method_application_element(pg_temp.id('app'), pg_temp.meridian_element('object', true), 'informed') $$,
  '23514', null, 'core objects are not merely informed');
select throws_ok($$ select public.link_method_application_element(pg_temp.id('app'),
  (select id from public.architecture_elements where engagement_id <> 'e0000000-0000-4000-8000-000000000001' limit 1), 'examined') $$,
  'P0002', null, 'links never cross engagements');
select lives_ok($$ select public.link_method_application_element(pg_temp.id('app'), pg_temp.meridian_element('object', true), 'examined') $$,
  'any element can be examined');
select lives_ok($$ select public.link_method_application_element(pg_temp.id('app'), pg_temp.meridian_element('risk', true), 'examined') $$,
  'and a risk examined');
select throws_ok($$ select public.link_method_application_element(pg_temp.id('app'), pg_temp.meridian_element('object', true), 'examined') $$,
  '23505', null, 'one row per element and role');
select is((select captured_reference_code from public.method_application_elements
  where application_id = pg_temp.id('app') and element_id = pg_temp.meridian_element('object', true)),
  (select reference_code from public.architecture_elements where id = pg_temp.meridian_element('object', true)),
  'the link captures the element''s identity');

select throws_ok($$ select public.link_method_application_evidence(pg_temp.id('app'),
  (select id from public.evidence_sources where engagement_id = 'e0000000-0000-4000-8000-000000000001' limit 1),
  'gathered', pg_temp.id('sv')) $$, '23514', null, 'only an Instrument gathers evidence');
select lives_ok($$ select public.link_method_application_evidence(pg_temp.id('app'),
  (select id from public.evidence_sources where engagement_id = 'e0000000-0000-4000-8000-000000000001' limit 1),
  'gathered', pg_temp.id('iv'), 'Interview notes') $$, 'evidence names the declared Instrument that gathered it');
select is((select count(*)::int from public.architecture_relationships r
  where r.created_at >= (select created_at from public.method_applications where id = pg_temp.id('app'))), 0,
  'no architecture relationship is written');

-- A draft element produced by the work (D30 scenario, step 1).
insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
values ('c6000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'object',
        'Advising capacity for adult learners', 'architect_judgment');
insert into public.architecture_objects (element_id, object_type) values ('c6000000-0000-4000-8000-000000000001', 'capability_gap');
insert into pg_temp.ids values ('draft-code', null);
select lives_ok($$ select public.link_method_application_element(pg_temp.id('app'), 'c6000000-0000-4000-8000-000000000001', 'produced') $$,
  'the work produces a draft Capability Gap');
select is((select captured_kind::text || ':' || captured_object_type_key || ':' || captured_title
  from public.method_application_elements where element_id = 'c6000000-0000-4000-8000-000000000001'),
  'object:capability_gap:Advising capacity for adult learners', 'captured with its kind, type and title');

-- -----------------------------------------------------------------------------
-- Lifecycle and closure
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.complete_method_application(pg_temp.id('app'), 'Done') $$, '23514', null,
  'a planned application must begin before it completes');
select lives_ok($$ select public.begin_method_application(pg_temp.id('app')) $$, 'it begins');
select is((select state::text || ':' || (started_on is not null) from public.method_applications where id = pg_temp.id('app')),
  'in_progress:true', 'and records when');
select throws_ok($$ select public.complete_method_application(pg_temp.id('app'), ' ') $$, '23514', null,
  'completion needs a statement of how the criteria were met');
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok($$ select public.complete_method_application(pg_temp.id('app'), 'Done') $$, 'P0002', null,
  'a client cannot close it');
select pg_temp.act_as('architect@tplco.test');
update public.architecture_elements set title = 'Advising capacity for adult learners (revised)'
where id = 'c6000000-0000-4000-8000-000000000001';
select lives_ok($$ select public.complete_method_application(pg_temp.id('app'), 'Every leader interviewed',
  'Interviews ran long for small teams') $$, 'it completes');
select is((select captured_title || ':' || coalesce(observed_version_id::text, 'draft')
  from public.method_application_elements where element_id = 'c6000000-0000-4000-8000-000000000001'),
  'Advising capacity for adult learners (revised):draft', 'closure refreshes the captured title; a draft has no observed version');
select ok((select bool_and(observed_version_id is null) from public.method_application_elements
  where application_id = pg_temp.id('app') and role = 'examined'), 'examined links record no observed version');

-- Frozen.
select throws_ok($$ select public.update_method_application(pg_temp.id('app'), 'x', 'y', '', false) $$, '23514', null,
  'a closed application cannot be edited');
select throws_ok($$ select public.link_method_application_element(pg_temp.id('app'), pg_temp.meridian_element('risk', false), 'examined') $$,
  '23514', null, 'nor linked');
select throws_ok($$ select public.unlink_method_application_element(
  (select id from public.method_application_elements where application_id = pg_temp.id('app') and role = 'examined' limit 1)) $$,
  '23514', null, 'nor unlinked');
select throws_ok($$ select public.set_method_application_stage_note(pg_temp.id('app'),
  (select id from public.method_version_stages where version_id = pg_temp.id('mv') and key = 'assess'), 'followed', null, '') $$,
  '23514', null, 'nor given stage notes');
select pg_temp.reset_actor();
select private.begin_methodology_operation();
select throws_ok($$ update public.method_applications set retrospective = 'Rewritten' where id = pg_temp.id('app') $$,
  '23514', null, 'the database refuses changes even inside an operation');
select throws_ok($$ delete from public.method_application_evidence where application_id = pg_temp.id('app') $$,
  '23514', null, 'including to its links');
select private.end_methodology_operation();
select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ select public.add_method_application_addendum(pg_temp.id('app'), 'The gap was later judged out of scope.') $$,
  'later insight goes in an addendum');
select throws_ok($$ select public.add_method_application_addendum(pg_temp.id('app2'), 'Too early') $$, '23514', null,
  'addenda follow closure');

-- -----------------------------------------------------------------------------
-- D30: produce draft -> close -> delete draft -> still interpretable
-- -----------------------------------------------------------------------------
select lives_ok($$ delete from public.architecture_elements where id = 'c6000000-0000-4000-8000-000000000001' $$,
  'the unpublished draft is still disposable after the application closed');
select is((select (element_id is null)::text || ':' || (element_removed_at is not null) || ':' || captured_kind || ':'
  || captured_object_type_key || ':' || captured_title || ':' || role
  from public.method_application_elements where captured_title like 'Advising capacity%'),
  'true:true:object:capability_gap:Advising capacity for adult learners (revised):produced',
  'the closed application still says what it produced, and that the draft was removed');
select ok((select captured_reference_code ~ '^[A-Z]{3}-[0-9]{3,}$' from public.method_application_elements
  where captured_title like 'Advising capacity%'), 'including the draft''s permanent reference code');
select is((select state::text from public.method_applications where id = pg_temp.id('app')), 'completed',
  'and remains completed and frozen');

-- The same on an open application.
insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
values ('c6000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'risk', 'Draft risk', 'architect_judgment');
select public.link_method_application_element(pg_temp.id('app2'), 'c6000000-0000-4000-8000-000000000002', 'produced');
delete from public.architecture_elements where id = 'c6000000-0000-4000-8000-000000000002';
select is((select captured_title from public.method_application_elements where application_id = pg_temp.id('app2') and element_id is null),
  'Draft risk', 'a removed draft stays named on an open application too');
delete from public.architecture_elements where id = pg_temp.meridian_element('object', true);
select ok(pg_temp.meridian_element('object', true) is not null, 'published elements are still never deleted');

-- -----------------------------------------------------------------------------
-- Discontinue and continue; learning sources
-- -----------------------------------------------------------------------------
select lives_ok($$ select public.discontinue_method_application(pg_temp.id('app2'), 'Moving to the revised version') $$,
  'an application can be discontinued with a reason');
select throws_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Continued', 'Continuing', '', null, null, pg_temp.id('app')) $$, '23514', null, 'only a discontinued application is continued');
select lives_ok($$ select public.start_method_application('e0000000-0000-4000-8000-000000000001', pg_temp.id('mv'),
  'Continued', 'Continuing the discontinued work', '', null, null, pg_temp.id('app2')) $$,
  'a new application continues it');

insert into pg_temp.ids values ('mv2', public.create_method_asset_version(pg_temp.id('method')));
select throws_ok($$ select public.add_method_version_learning_source(pg_temp.id('mv2'),
  (select id from public.method_applications where title = 'Continued'), 'x') $$, '23514', null,
  'learning comes only from closed applications');
select lives_ok($$ select public.add_method_version_learning_source(pg_temp.id('mv2'), pg_temp.id('app'),
  'Interview stage too long for small teams') $$, 'a new draft cites the application that motivated it');

-- -----------------------------------------------------------------------------
-- Visibility: internal architecture readers only
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select ok((select count(*) from public.method_applications) >= 0, 'internal readers query applications without error');
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.method_applications) + (select count(*)::int from public.method_application_elements)
  + (select count(*)::int from public.method_application_stage_notes) + (select count(*)::int from public.method_application_addenda),
  0, 'clients see no application, link, stage note or addendum');
select pg_temp.act_as('contributor@meridian.test');
select is((select count(*)::int from public.method_applications) + (select count(*)::int from public.method_application_elements), 0,
  'nor does an area-limited Contributor');
select pg_temp.reset_actor();

select * from finish();
rollback;
