-- =============================================================================
-- Phase 6 engagement acceptance criteria (pgTAP). Run with: pnpm db:test
--
-- ACR-coded governance records on an Implementation Initiative or a core
-- object (D20, D33): proposed, agreed (text frozen), superseded or withdrawn;
-- never deleted once agreed; never a verdict. record_review_validation
-- captures the agreed criteria in force, with the ADR-0036 gate unchanged
-- (D34).
-- =============================================================================
begin;
\ir support/phase6_pristine.psql

select plan(45);

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
create function pg_temp.el(code text) returns uuid language sql security definer as $$
  select id from public.architecture_elements where engagement_id = 'e0000000-0000-4000-8000-000000000003' and reference_code = code
$$;
create function pg_temp.code(criterion uuid) returns text language sql security definer as $$
  select reference_code from public.acceptance_criteria where id = criterion
$$;

-- A published Standard to inform criteria.
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('standard', public.create_method_asset('council-standard', 'Council Standard', 'standard', 'other'));
insert into pg_temp.ids values ('sv', (select id from public.method_asset_versions where asset_id = pg_temp.id('standard')));
select public.update_method_asset_version(pg_temp.id('sv'), '{"architectural_question": "Q", "applicability": "A", "change_summary": "First"}');
select public.set_standard_version_criteria(pg_temp.id('sv'), '[{"key": "quorum", "statement": "A quorum meets monthly"}]');
select public.set_standard_version_judged_in(pg_temp.id('sv'), '{review}');

-- -----------------------------------------------------------------------------
-- Proposing
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.propose_acceptance_criterion(pg_temp.el('IMP-001'), 'x', pg_temp.id('sv'), 'quorum') $$,
  '23514', null, 'only a published Standard can inform a criterion');
select pg_temp.act_as('principal@tplco.test');
select public.publish_method_asset_version(pg_temp.id('sv'), '1.0');
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.propose_acceptance_criterion(pg_temp.el('IMP-001'), 'x', pg_temp.id('sv'), 'nope') $$,
  '23514', null, 'and only through one of its criteria');
select throws_ok($$ select public.propose_acceptance_criterion(pg_temp.el('REV-001'), 'x') $$, '23514', null,
  'a Review is not governed by acceptance criteria');
insert into pg_temp.ids values ('c1', public.propose_acceptance_criterion(pg_temp.el('IMP-001'),
  'The Expansion Council meets monthly with a quorum', pg_temp.id('sv'), 'quorum'));
select is(pg_temp.code(pg_temp.id('c1')), 'ACR-001', 'an Architect proposes ACR-001 on an initiative');
insert into pg_temp.ids values ('c2', public.propose_acceptance_criterion(pg_temp.el('APP-001'),
  'Council decisions are published within two weeks'));
select is(pg_temp.code(pg_temp.id('c2')), 'ACR-002', 'and ACR-002 on the core object it implements');
insert into pg_temp.ids values ('c3', public.propose_acceptance_criterion(pg_temp.el('IMP-001'), 'Working draft'));
select lives_ok($$ select public.update_acceptance_criterion(pg_temp.id('c3'), 'Working draft, revised') $$,
  'a proposal can be edited');
select lives_ok($$ select public.delete_acceptance_criterion(pg_temp.id('c3')) $$, 'and deleted');
select is((select count(*)::int from public.architecture_elements where reference_code like 'ACR-%'), 0,
  'a criterion is not an architecture element');
select pg_temp.act_as('lead@harbor.test');
select throws_ok($$ select public.propose_acceptance_criterion(pg_temp.el('IMP-001'), 'Client wording') $$, 'P0002', null,
  'clients do not write criteria');
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ insert into public.acceptance_criteria (engagement_id, reference_code, governed_element_id, governed_kind, body)
  values ('e0000000-0000-4000-8000-000000000003', 'ACR-999', pg_temp.el('IMP-001'), 'implementation_initiative', 'x') $$,
  '42501', null, 'nor does anyone insert them directly');

-- A proposal on a draft goes with the draft.
insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
values ('c7000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'object',
        'Draft capability gap', 'architect_judgment');
insert into public.architecture_objects (element_id, object_type) values ('c7000000-0000-4000-8000-000000000001', 'capability_gap');
insert into pg_temp.ids values ('c-draft', public.propose_acceptance_criterion('c7000000-0000-4000-8000-000000000001', 'Draft criterion'));
select throws_ok($$ select public.agree_acceptance_criterion(pg_temp.id('c-draft'), 'Steering committee', current_date) $$,
  '23514', 'A criterion is agreed only on a published element', 'a criterion is agreed only on a published element');
delete from public.architecture_elements where id = 'c7000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.acceptance_criteria where id = pg_temp.id('c-draft')), 0,
  'deleting the draft removes its proposal');

-- -----------------------------------------------------------------------------
-- Agreement freezes the text
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.agree_acceptance_criterion(pg_temp.id('c1'), ' ', current_date) $$, '23514', null,
  'agreement records who agreed');
select lives_ok($$ select public.agree_acceptance_criterion(pg_temp.id('c1'), 'Executive Sponsor and steering committee',
  current_date - 3) $$, 'a publish_architecture holder records the agreement');
select is((select state::text || ':' || agreed_with || ':' || (agreed_recorded_by is not null)
  from public.acceptance_criteria where id = pg_temp.id('c1')),
  'agreed:Executive Sponsor and steering committee:true', 'with the party, the date and the recorder');
select public.agree_acceptance_criterion(pg_temp.id('c2'), 'Executive Sponsor', current_date - 3);
select throws_ok($$ select public.update_acceptance_criterion(pg_temp.id('c1'), 'Changed after agreement') $$, '23514', null,
  'agreed text is frozen');
select throws_ok($$ select public.delete_acceptance_criterion(pg_temp.id('c1')) $$, '23514', null,
  'an agreed criterion is never deleted');
select throws_ok($$ select public.agree_acceptance_criterion(pg_temp.id('c1'), 'Again', current_date) $$, '23514', null,
  'agreement happens once');
select pg_temp.reset_actor();
select private.begin_methodology_operation();
select throws_ok($$ update public.acceptance_criteria set body = 'Tampered' where id = pg_temp.id('c1') $$, '23514', null,
  'the database refuses a change to agreed text even inside an operation');
select throws_ok($$ update public.acceptance_criteria set state = 'proposed' where id = pg_temp.id('c1') $$, '23514', null,
  'or a return to proposed');
select private.end_methodology_operation();

-- -----------------------------------------------------------------------------
-- Validation captures the criteria in force (D34); the gate is unchanged
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids values ('c4', public.propose_acceptance_criterion(pg_temp.el('IMP-001'), 'Still only a proposal'));
insert into pg_temp.ids values ('c5', public.propose_acceptance_criterion(pg_temp.el('IMP-003'), 'Another initiative''s criterion'));
select public.agree_acceptance_criterion(pg_temp.id('c5'), 'Executive Sponsor', current_date);
select is((select string_agg(reference_code, ',' order by reference_code) from public.criteria_in_force(pg_temp.el('IMP-001'))),
  'ACR-001,ACR-002', 'the criteria in force are the initiative''s own and those on objects it implements, agreed only');

select throws_ok($$ select public.record_review_validation(pg_temp.el('REV-001'), pg_temp.el('IMP-002')) $$, '23514',
  'This review has already validated this initiative', 'the ADR-0036 gate is unchanged');
insert into pg_temp.ids values ('validation', public.record_review_validation(pg_temp.el('REV-001'), pg_temp.el('IMP-001')));
select is((select string_agg(pg_temp.code(criterion_id), ',' order by pg_temp.code(criterion_id)) from public.validation_criteria
  where validation_relationship_id = pg_temp.id('validation')), 'ACR-001,ACR-002',
  'the validation captures exactly the agreed criteria in force');
select is((select count(*)::int from information_schema.columns where table_name = 'validation_criteria'
  and column_name in ('verdict', 'passed', 'result', 'score', 'met')), 0, 'with no verdict of any kind');
select is((select count(*)::int from public.validation_criteria v join public.architecture_relationships x
  on x.id = v.validation_relationship_id where x.source_element_id = pg_temp.el('REV-001') and x.target_element_id = pg_temp.el('IMP-002')),
  0, 'the earlier validation, made before any criteria, remains valid with none');

select lives_ok($$ select public.set_validation_criterion_note(pg_temp.id('validation'), pg_temp.id('c1'),
  'Minutes of three consecutive monthly meetings') $$, 'a per-criterion note records how the evidence addressed it');
select throws_ok($$ select public.set_validation_criterion_note(pg_temp.id('validation'), pg_temp.id('c5'), 'x') $$, 'P0002', null,
  'only for criteria the validation captured');
select pg_temp.reset_actor();
select throws_ok($$ delete from public.validation_criteria where validation_relationship_id = pg_temp.id('validation') $$,
  '23514', null, 'what a validation was judged against is permanent');
select throws_ok($$ insert into public.validation_criteria (validation_relationship_id, criterion_id, engagement_id)
  values (pg_temp.id('validation'), pg_temp.id('c5'), 'e0000000-0000-4000-8000-000000000003') $$, '42501', null,
  'and captured only by the validation itself');

-- Captures survive supersession of the criterion.
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.supersede_acceptance_criterion(pg_temp.id('c1'), 'Meets monthly, quorum of five', ' ') $$,
  '23514', null, 'supersession needs a reason');
select throws_ok($$ select public.supersede_acceptance_criterion(pg_temp.id('c4'), 'x', 'y') $$, '23514', null,
  'only an agreed criterion is superseded');
insert into pg_temp.ids values ('c6', public.supersede_acceptance_criterion(pg_temp.id('c1'), 'Meets monthly with a quorum of five',
  'Council enlarged', 'Executive Sponsor', current_date));
select is((select state::text || ':' || closure_reason from public.acceptance_criteria where id = pg_temp.id('c1')),
  'superseded:Council enlarged', 'the old criterion is closed with its reason');
select is((select pg_temp.code(supersedes_criterion_id) || '->' || reference_code || ':' || state
  from public.acceptance_criteria where id = pg_temp.id('c6')), 'ACR-001->ACR-007:agreed',
  'the replacement has its own code and records what it supersedes');
select is((select informing_criterion_key from public.acceptance_criteria where id = pg_temp.id('c6')), 'quorum',
  'and keeps the informing Standard');
select throws_ok($$ select public.supersede_acceptance_criterion(pg_temp.id('c1'), 'Again', 'Again') $$, '23514', null,
  'a superseded criterion stays superseded');
select is((select count(*)::int from public.validation_criteria where criterion_id = pg_temp.id('c1')), 1,
  'the validation still points at the text it was judged against');
select lives_ok($$ select public.withdraw_acceptance_criterion(pg_temp.id('c2'), 'No longer applicable') $$,
  'an agreed criterion can be withdrawn with a reason');
select is((select string_agg(reference_code, ',' order by reference_code) from public.criteria_in_force(pg_temp.el('IMP-001'))),
  'ACR-007', 'criteria in force follow supersession and withdrawal');

-- -----------------------------------------------------------------------------
-- Visibility: internal readers only; clients through the read model later
-- -----------------------------------------------------------------------------
select pg_temp.act_as('lead@harbor.test');
select is((select count(*)::int from public.acceptance_criteria) + (select count(*)::int from public.validation_criteria), 0,
  'clients read no criteria rows directly');
select is((select count(*)::int from public.criteria_in_force(pg_temp.el('IMP-001'))), 0,
  'nor the internal criteria-in-force list');
select throws_ok($$ select public.agree_acceptance_criterion(pg_temp.id('c4'), 'Us', current_date) $$, 'P0002', null,
  'nor agree criteria');
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.acceptance_criteria), 0, 'other clients see nothing');
select pg_temp.act_as('architect@tplco.test');
select ok((select count(*) from public.acceptance_criteria where engagement_id = 'e0000000-0000-4000-8000-000000000003') >= 5,
  'internal architecture readers see the history');
select is((select count(*)::int from public.acceptance_criteria where state = 'proposed' and id = pg_temp.id('c4')), 1,
  'proposals remain proposals until agreed');
select pg_temp.reset_actor();
select ok((select count(*) from public.activity_log where entity_type = 'acceptance_criteria' and action_type = 'update') > 0,
  'including agreement and closure');

select * from finish();
rollback;
