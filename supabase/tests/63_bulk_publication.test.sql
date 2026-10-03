-- =============================================================================
-- V1-A Increment 5 (Workstream D, D8): bulk publication (pgTAP).
-- Run with: pnpm db:test
--
-- public.submit_elements_for_review and public.publish_element_versions
-- compose the existing single-element functions. These tests exercise the
-- composition directly at the database level: authorized bulk publication,
-- unauthorized attempts, cross-engagement ids, a client (area-limited,
-- capability-less) attempt, an already-ineligible record, duplicate ids,
-- version/audit behaviour, deterministic partial-success reporting, the
-- array-size cap, and a 150-element scale fixture.
--
-- Seed: Meridian district e...01 (architect@tplco.test holds
-- edit_architecture + publish_architecture; researcher@tplco.test holds
-- edit_architecture only); Workforce e...02 (architect@tplco.test is not a
-- member at all).
-- =============================================================================
begin;

select plan(32);

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

-- A fresh draft "object" element (object-kind elements need no domain scope).
create function pg_temp.new_object(p_title text, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
  values (new_id, p_engagement, 'object', p_title, 'architect_judgment');
  insert into public.architecture_objects (element_id, object_type) values (new_id, 'capability');
  return new_id;
end;
$$;
grant execute on function pg_temp.new_object(text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Authorized bulk publication: straightforward success.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');

create temp table draft_ids (id uuid);
insert into draft_ids select pg_temp.new_object('Bulk draft ' || g) from generate_series(1, 5) g;

select is(
  (select count(*)::int from public.publish_element_versions(array(select id from draft_ids)) r where r.published),
  5, '1. all five drafts publish');
select is(
  (select count(*)::int from public.publish_element_versions(array(select id from draft_ids))),
  5, '   and the result has exactly one row per input id (a second call republishes all five again)');
select is(
  (select count(*)::int from public.element_versions where element_id in (select id from draft_ids)),
  10, '   each element now has two versions (published twice)');
select is(
  (select lifecycle from public.architecture_elements where id = (select id from draft_ids limit 1)),
  'published', '   lifecycle is published');

select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 2. Submit-for-review composition.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table review_ids (id uuid);
insert into review_ids select pg_temp.new_object('Bulk review ' || g) from generate_series(1, 4) g;
select is(
  (select count(*)::int from public.submit_elements_for_review(array(select id from review_ids)) r where r.submitted),
  4, '2. all four drafts submit for review');
select is(
  (select lifecycle from public.architecture_elements where id = (select id from review_ids limit 1)),
  'in_review', '   lifecycle moved to in_review');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 3. Unauthorized: a Researcher (edit_architecture, no publish_architecture)
--    cannot gain publish authority through the bulk path.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table unauth_ids (id uuid);
insert into unauth_ids select pg_temp.new_object('Unauthorized target ' || g) from generate_series(1, 3) g;
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select is(
  (select count(*)::int from public.publish_element_versions(array(select id from unauth_ids)) r where not r.published),
  3, '3. a Researcher refused publish_architecture fails on every element');
select is(
  (select count(distinct error_code)::int from public.publish_element_versions(array(select id from unauth_ids))),
  1, '   with one consistent error code');
select is(
  (select error_code from public.publish_element_versions(array(select id from unauth_ids)) limit 1),
  '42501', '   specifically 42501, the same code the single-element function raises');
select pg_temp.reset_actor();
select is(
  (select count(*)::int from public.architecture_elements where id in (select id from unauth_ids) and lifecycle = 'published'),
  0, '   and none of them were actually published');

-- -----------------------------------------------------------------------------
-- 4. Cross-engagement: an id architect@tplco.test cannot even read (not a
--    member of e...02) surfaces as "not found", mixed with valid ids from
--    e...01 that still succeed (partial success, not all-or-nothing).
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
create temp table other_engagement_ids (id uuid);
insert into other_engagement_ids
  select pg_temp.new_object('Workforce-only element', 'e0000000-0000-4000-8000-000000000002');
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
create temp table mixed_ids (id uuid);
insert into mixed_ids select pg_temp.new_object('Mixed-selection target ' || g) from generate_series(1, 2) g;
insert into mixed_ids select id from other_engagement_ids;

select is(
  (select count(*)::int from public.publish_element_versions(array(select id from mixed_ids)) r where r.published),
  2, '4. the two elements in the architect''s own engagement still publish');
select is(
  (select r.error_code from public.publish_element_versions(array(select id from mixed_ids)) r
   where r.element_id = (select id from other_engagement_ids)),
  'P0002', '   the cross-engagement id is refused as not found, not leaked as a permission denial');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 5. A client member -- area-assigned or not -- never holds
--    publish_architecture; bulk publication grants nothing extra.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('contributor@meridian.test');
select is(
  (select count(*)::int from public.publish_element_versions(array(select id from unauth_ids)) r where not r.published),
  3, '5. a client contributor (area-assigned, view_architecture only) is refused on every element');
select is(
  (select r.error_code from public.submit_elements_for_review(array['b3000000-0000-4000-8000-000000000207'::uuid]) r),
  'P0002', '   and a client cannot even submit, since can_read_architecture requires an internal member');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 6. Already-ineligible records: a retired element fails with its usual
--    23514, alongside drafts that still succeed.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table retired_mix (id uuid);
insert into retired_mix select pg_temp.new_object('Will be retired') ;
select public.retire_element((select id from retired_mix), 'No longer relevant');
insert into retired_mix select pg_temp.new_object('Still a draft ' || g) from generate_series(1, 2) g;

select is(
  (select count(*)::int from public.publish_element_versions(array(select id from retired_mix)) r where r.published),
  2, '6. the two drafts still publish');
select is(
  (select r.error_code from public.publish_element_versions(array(select id from retired_mix)) r
   join public.architecture_elements e on e.id = r.element_id where e.lifecycle = 'retired'),
  '23514', '   the retired element is refused with the single-element function''s own error');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 7. Duplicate ids collapse to one row, processed once.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table dup_target (id uuid);
insert into dup_target select pg_temp.new_object('Duplicate-id target');
select is(
  (select count(*)::int from public.publish_element_versions(
     array[(select id from dup_target), (select id from dup_target), (select id from dup_target)])),
  1, '7. three repeats of the same id return exactly one row');
select is(
  (select count(*)::int from public.element_versions where element_id = (select id from dup_target)),
  1, '   and exactly one version was created, not three');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 8. Audit: each published element gets its own activity row.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table audited_ids (id uuid);
insert into audited_ids select pg_temp.new_object('Audited element ' || g) from generate_series(1, 3) g;
select * from public.publish_element_versions(array(select id from audited_ids));
select is(
  (select count(*)::int from public.architecture_activity('e0000000-0000-4000-8000-000000000001', null, 5000) a
   where a.event = 'version_published' and a.element_id in (select id from audited_ids)),
  3, '8. each of the three published elements has its own version_published activity row');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 9. Array-size cap: more than 500 ids is refused outright, before any row
--    is touched.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table cap_probe (id uuid);
insert into cap_probe select pg_temp.new_object('Cap probe ' || g) from generate_series(1, 1) g;
select throws_ok(
  $$ select * from public.publish_element_versions(array(select gen_random_uuid() from generate_series(1, 501))) $$,
  '23514', 'At most 500 elements can be published in one request', '9. more than 500 ids is refused');
select is(
  (select lifecycle from public.architecture_elements where id = (select id from cap_probe)),
  'draft', '   an oversized request touches nothing, including unrelated drafts in the same transaction');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 10. Scale: a fixture of at least 150 drafts submitted and published
--     together, matching Gate A.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table scale_ids (id uuid);
insert into scale_ids select pg_temp.new_object('Scale element ' || g) from generate_series(1, 160) g;

select is((select count(*)::int from scale_ids), 160, '10. 160 drafts exist');
select is(
  (select count(*)::int from public.submit_elements_for_review(array(select id from scale_ids)) r where r.submitted),
  160, '    all 160 submit for review in one call');
select is(
  (select count(*)::int from public.architecture_elements where id in (select id from scale_ids) and lifecycle = 'in_review'),
  160, '    and all 160 are now in_review');
select is(
  (select count(*)::int from public.publish_element_versions(array(select id from scale_ids)) r where r.published),
  160, '    all 160 publish in one call');
select is(
  (select count(*)::int from public.architecture_elements where id in (select id from scale_ids) and lifecycle = 'published'),
  160, '    and all 160 are now published');
select is(
  (select count(*)::int from public.element_versions where element_id in (select id from scale_ids)),
  160, '    exactly one version per element');
select is(
  (select count(distinct published_by)::int from public.element_versions where element_id in (select id from scale_ids)),
  1, '    all published by the same actor');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 11. Empty and null input are no-ops, not errors.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.publish_element_versions(array[]::uuid[])), 0,
  '11. an empty array returns no rows');
select is((select count(*)::int from public.publish_element_versions(null)), 0,
  '    neither does null');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 12. Individual publication is unchanged: still works exactly as before,
--     side by side with the bulk path in the same engagement.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table single_target (id uuid);
insert into single_target select pg_temp.new_object('Still works individually');
select lives_ok(
  $$ select public.publish_element_version((select id from single_target), 'Individual publish still works') $$,
  '12. single-element publish_element_version still works unmodified');
select is(
  (select lifecycle from public.architecture_elements where id = (select id from single_target)),
  'published', '    and published the element');
select pg_temp.reset_actor();

select * from finish();
rollback;
