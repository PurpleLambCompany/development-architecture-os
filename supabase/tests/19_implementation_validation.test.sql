-- =============================================================================
-- Phase 5 the validation gate (pgTAP). Run with: pnpm db:test
--
-- The most important correctness property in Phase 5 (§7.5, D5): a review
-- validates an implementation initiative only if it is held, already
-- examines the initiative (or a core object it implements), and has not
-- already validated it; and resolve_implementation_initiative refuses
-- "validated" without a qualifying validates relationship already recorded.
-- Meridian, e...01.
-- =============================================================================
begin;

select plan(34);

create function pg_temp.act_as(user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
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

create table pg_temp.ids (key text primary key, id uuid);
grant all on pg_temp.ids to authenticated;

select pg_temp.act_as('architect@tplco.test');

-- Two initiatives, implementing different published core objects.
insert into pg_temp.ids (key, id)
select 'init', public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Acquisition rollout', array['b3000000-0000-4000-8000-000000000201'::uuid]);
insert into pg_temp.ids (key, id)
select 'init2', public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Partnership rollout', array['b3000000-0000-4000-8000-000000000202'::uuid]);

-- Review A: scheduled, then held, examines the object 'init' implements.
insert into pg_temp.ids (key, id)
select 'a', public.create_review('e0000000-0000-4000-8000-000000000001', 'architecture_review', 'Review A');
select lives_ok($$ insert into public.architecture_relationships
  (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000001', (select id from pg_temp.ids where key = 'a'),
    'b3000000-0000-4000-8000-000000000201', 'examines', 'architect_judgment') $$,
  'Review A examines the object the initiative implements');

-- Review B: held, examines something unrelated (a skill, not implemented by 'init').
insert into pg_temp.ids (key, id)
select 'b', public.create_review('e0000000-0000-4000-8000-000000000001', 'architecture_review', 'Review B');
select lives_ok($$ insert into public.architecture_relationships
  (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000001', (select id from pg_temp.ids where key = 'b'),
    'b3000000-0000-4000-8000-000000000203', 'examines', 'architect_judgment') $$,
  'Review B examines something unrelated to the initiative');
select lives_ok($$ select public.hold_review((select id from pg_temp.ids where key = 'b')) $$,
  'Review B is held');

-- -----------------------------------------------------------------------------
-- Refusal 1: the review is not held
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.record_review_validation(
  (select id from pg_temp.ids where key = 'a'), (select id from pg_temp.ids where key = 'init')) $$,
  '23514', 'Only a held review may validate an initiative',
  'refused: Review A is only scheduled, not held');
select lives_ok($$ select public.hold_review((select id from pg_temp.ids where key = 'a')) $$,
  'Review A is now held');

-- -----------------------------------------------------------------------------
-- Refusal 2: the review does not examine the initiative (or what it implements)
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.record_review_validation(
  (select id from pg_temp.ids where key = 'b'), (select id from pg_temp.ids where key = 'init')) $$,
  '23514', 'The review must examine this initiative, or an object it implements, before validating it',
  'refused: Review B examines something else entirely');

-- -----------------------------------------------------------------------------
-- Kind checks
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.record_review_validation(
  'b3000000-0000-4000-8000-000000000201', (select id from pg_temp.ids where key = 'init')) $$,
  '23514', 'Only a review validates an initiative', 'the first argument must be a review');
select throws_ok($$ select public.record_review_validation(
  (select id from pg_temp.ids where key = 'a'), 'b3000000-0000-4000-8000-000000000201') $$,
  '23514', 'Only an implementation initiative is validated', 'the second argument must be an initiative');

-- -----------------------------------------------------------------------------
-- Success, then refusal 3: already validated
-- -----------------------------------------------------------------------------
select lives_ok($$ select public.record_review_validation(
  (select id from pg_temp.ids where key = 'a'), (select id from pg_temp.ids where key = 'init')) $$,
  'Review A, held and examining the implemented object, validates the initiative');
select is((select count(*)::int from public.architecture_relationships
           where source_element_id = (select id from pg_temp.ids where key = 'a')
             and target_element_id = (select id from pg_temp.ids where key = 'init')
             and relationship_type = 'validates' and retired_at is null), 1,
  'exactly one validates relationship is recorded');
select throws_ok($$ select public.record_review_validation(
  (select id from pg_temp.ids where key = 'a'), (select id from pg_temp.ids where key = 'init')) $$,
  '23514', 'This review has already validated this initiative', 'refused: already validated by this review');

-- record_review_validation requires publish_architecture
select pg_temp.reset_actor();
select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.record_review_validation(
  (select id from pg_temp.ids where key = 'b'), (select id from pg_temp.ids where key = 'init2')) $$,
  '42501', null, 'a Researcher holds no publish_architecture and cannot record a validation');
select pg_temp.reset_actor();
select pg_temp.act_as('architect@tplco.test');

-- -----------------------------------------------------------------------------
-- resolve_implementation_initiative: validated needs a qualifying relationship
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.resolve_implementation_initiative(
  (select id from pg_temp.ids where key = 'init2'), 'validated', 'Ready.') $$,
  '23514', 'A held review must validate this initiative before it can be marked validated',
  'refused: init2 has no validates relationship yet');
select throws_ok($$ select public.resolve_implementation_initiative(
  (select id from pg_temp.ids where key = 'init'), 'validated', '') $$,
  '23514', 'A rationale is required', 'resolving requires a rationale');
select throws_ok($$ select public.resolve_implementation_initiative(
  (select id from pg_temp.ids where key = 'init'), 'in_progress', 'x') $$,
  '23514', null, 'resolve only reaches validated or abandoned, not a working status');
select lives_ok($$ select public.resolve_implementation_initiative(
  (select id from pg_temp.ids where key = 'init'), 'validated',
  'Review A confirmed the acquisition process is operating as designed.') $$,
  'init, now validated by Review A, is marked validated');
select is((select implementation_status::text from public.implementation_initiatives
           where element_id = (select id from pg_temp.ids where key = 'init')), 'validated',
  'its status is validated');
select is((select actual_operational_on is not null from public.implementation_initiatives
           where element_id = (select id from pg_temp.ids where key = 'init')), true,
  'and its actual operational date is set');
select throws_ok($$ select public.resolve_implementation_initiative(
  (select id from pg_temp.ids where key = 'init'), 'abandoned', 'Change of mind.') $$,
  '23514', 'The initiative is already resolved; reopen it first', 'a resolved initiative cannot be resolved again');

-- -----------------------------------------------------------------------------
-- abandoned needs no qualifying relationship
-- -----------------------------------------------------------------------------
select lives_ok($$ select public.resolve_implementation_initiative(
  (select id from pg_temp.ids where key = 'init2'), 'abandoned',
  'The partnership talks did not proceed.') $$, 'init2 is abandoned without ever being validated');
select is((select implementation_status::text from public.implementation_initiatives
           where element_id = (select id from pg_temp.ids where key = 'init2')), 'abandoned',
  'its status is abandoned');

-- -----------------------------------------------------------------------------
-- Defect 2 fix: resolve_implementation_initiative's optional p_publish
-- follows the same opt-in-only rule as update_implementation_status.
-- -----------------------------------------------------------------------------
insert into pg_temp.ids (key, id)
select 'init_pub', public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Vendor onboarding rollout', array['b3000000-0000-4000-8000-000000000201'::uuid]);
select lives_ok($$ update public.architecture_elements set client_visibility = 'client'
  where id = (select id from pg_temp.ids where key = 'init_pub') $$, 'init3 is made client-visible');
select lives_ok($$ select public.publish_element_version(
  (select id from pg_temp.ids where key = 'init_pub'), 'First publication.') $$, 'and published, at not_started');
select is((select implementation_status::text from public.client_implementation('e0000000-0000-4000-8000-000000000001')
           where reference_code = (select reference_code from public.architecture_elements
                                    where id = (select id from pg_temp.ids where key = 'init_pub'))),
  'not_started', 'the client sees not_started');
select lives_ok($$ select public.resolve_implementation_initiative(
  (select id from pg_temp.ids where key = 'init_pub'), 'abandoned', 'Superseded before it began.', false) $$,
  'init3 is abandoned with p_publish = false');
select is((select implementation_status::text from public.client_implementation('e0000000-0000-4000-8000-000000000001')
           where reference_code = (select reference_code from public.architecture_elements
                                    where id = (select id from pg_temp.ids where key = 'init_pub'))),
  'not_started', 'the client-facing snapshot still shows not_started: the resolution was not published');
select lives_ok($$ select public.reopen_implementation_initiative(
  (select id from pg_temp.ids where key = 'init_pub'), 'Reconsidering before publishing.') $$,
  'init3 is reopened (still unpublished as abandoned) so it can be resolved again');
select lives_ok($$ select public.resolve_implementation_initiative(
  (select id from pg_temp.ids where key = 'init_pub'), 'abandoned', 'Superseded before it began.', true,
  'Abandoned and published.') $$,
  'init3 is abandoned again, this time with p_publish = true');
select is((select implementation_status::text from public.client_implementation('e0000000-0000-4000-8000-000000000001')
           where reference_code = (select reference_code from public.architecture_elements
                                    where id = (select id from pg_temp.ids where key = 'init_pub'))),
  'abandoned', 'the client-facing snapshot now shows abandoned: the explicit publish updated it');

-- -----------------------------------------------------------------------------
-- reopen_implementation_initiative
-- -----------------------------------------------------------------------------
select pg_temp.reset_actor();
select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.reopen_implementation_initiative(
  (select id from pg_temp.ids where key = 'init'), 'Reconsidering.') $$, '42501', null,
  'a Researcher holds no publish_architecture and cannot reopen');
select pg_temp.reset_actor();
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.reopen_implementation_initiative(
  (select id from pg_temp.ids where key = 'init'), '') $$, '23514', null, 'reopening requires a rationale');
insert into pg_temp.ids (key, id)
select 'init3', public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Never resolved', array['b3000000-0000-4000-8000-000000000201'::uuid]);
select throws_ok($$ select public.reopen_implementation_initiative(
  (select id from pg_temp.ids where key = 'init3'), 'x') $$, '23514', null,
  'only a resolved initiative is reopened');

select lives_ok($$ select public.reopen_implementation_initiative(
  (select id from pg_temp.ids where key = 'init'), 'The client asked to revisit the design.') $$,
  'init is reopened');
select is((select implementation_status::text from public.implementation_initiatives
           where element_id = (select id from pg_temp.ids where key = 'init')), 'in_progress',
  'reopening returns it to in_progress');
select pg_temp.reset_actor();

select * from finish();
rollback;
