-- =============================================================================
-- V1-A Increment 6 (Workstream D, D2): publishing relationships between
-- already-published elements (pgTAP). Run with: pnpm db:test
--
-- public.publish_relationships stamps published_at/published_by on a
-- relationship whose both ends are already published, mirroring the exact
-- eligibility rule publish_element_version's own side effect already uses.
-- These tests cover: an eligible relationship publishes with no element
-- version created as a side effect; an ineligible one (one end
-- unpublished, already published, retired) is refused; unauthorized and
-- cross-engagement refusal; the client-readability invariant (both ends
-- and the relationship itself must be client-visible); duplicate ids;
-- the array-size cap.
--
-- Seed: Meridian district e...01 (architect@tplco.test holds
-- edit_architecture + publish_architecture; researcher@tplco.test holds
-- edit_architecture only); Workforce e...02 (architect@tplco.test is not a
-- member at all; principal@tplco.test is).
-- =============================================================================
begin;

select plan(14);

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

-- security definer, same pattern as pg_temp.member elsewhere: authenticated
-- has no direct select on auth.users, so a top-level query under that role
-- (as opposed to one inside an already-definer helper) needs this.
create function pg_temp.user_id(user_email text)
returns uuid
language sql
security definer
as $$
  select id from auth.users where email = user_email;
$$;
grant execute on function pg_temp.user_id(text) to authenticated;

-- A fresh published "object" element, standing in as a published end.
create function pg_temp.new_published_object(p_title text, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
  values (new_id, p_engagement, 'object', p_title, 'architect_judgment');
  insert into public.architecture_objects (element_id, object_type) values (new_id, 'capability');
  perform public.publish_element_version(new_id, 'Seed for 64_publish_relationships');
  return new_id;
end;
$$;
grant execute on function pg_temp.new_published_object(text, uuid) to authenticated;

-- A fresh draft "object" element, standing in as an unpublished end.
create function pg_temp.new_draft_object(p_title text, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001')
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
grant execute on function pg_temp.new_draft_object(text, uuid) to authenticated;

-- A plain (unpublished) relationship between two given ends, as the acting
-- user; 'part_of' is a valid pairing between two capability objects.
create function pg_temp.new_relationship(p_source uuid, p_target uuid, p_engagement uuid, p_visibility public.client_visibility)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into public.architecture_relationships (
    engagement_id, source_element_id, target_element_id, relationship_type, provenance, client_visibility
  ) values (p_engagement, p_source, p_target, 'part_of', 'architect_judgment', p_visibility)
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function pg_temp.new_relationship(uuid, uuid, uuid, public.client_visibility) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Eligible: both ends already published, relationship itself unpublished.
--    Publishes, with no element version created as a side effect. A second
--    call is then refused: already published.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');

create temp table ends_1 as
  select pg_temp.new_published_object('Eligible end A') as a, pg_temp.new_published_object('Eligible end B') as b;
create temp table rel_1 as
  select pg_temp.new_relationship(a, b, 'e0000000-0000-4000-8000-000000000001', 'client') as id from ends_1;

select is(
  (select r.published from public.publish_relationships(array[(select id from rel_1)]) r),
  true, '1. an eligible relationship (both ends published) publishes');
select isnt(
  (select published_at from public.architecture_relationships where id = (select id from rel_1)),
  null, '   published_at is set');
select is(
  (select published_by from public.architecture_relationships where id = (select id from rel_1)),
  pg_temp.user_id('architect@tplco.test'),
  '   published_by is the acting architect');
select is(
  (select count(*)::int from public.element_versions where element_id in (select a from ends_1 union select b from ends_1)),
  2, '   no new element version was created for either end (still one each)');
select is(
  (select r.error_code from public.publish_relationships(array[(select id from rel_1)]) r),
  '23514', '   calling it again is refused: the relationship is already published');

select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 2. Ineligible: one end still a draft.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table ends_2 as
  select pg_temp.new_published_object('Published end') as published_end, pg_temp.new_draft_object('Draft end') as draft_end;
create temp table rel_2 as
  select pg_temp.new_relationship(published_end, draft_end, 'e0000000-0000-4000-8000-000000000001', 'internal') as id
  from ends_2;

select is(
  (select r.published from public.publish_relationships(array[(select id from rel_2)]) r),
  false, '2. a relationship with one unpublished end is refused (23514), and stays unpublished');
select is(
  (select published_at from public.architecture_relationships where id = (select id from rel_2)),
  null, '   and stays unpublished');

select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 3. Ineligible: a retired relationship.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table ends_3 as
  select pg_temp.new_published_object('Retired-rel end A') as a, pg_temp.new_published_object('Retired-rel end B') as b;
create temp table rel_3 as
  select pg_temp.new_relationship(a, b, 'e0000000-0000-4000-8000-000000000001', 'internal') as id from ends_3;
select public.publish_relationships(array[(select id from rel_3)]);
select public.retire_relationship((select id from rel_3), 'No longer relevant');

select is(
  (select r.error_code from public.publish_relationships(array[(select id from rel_3)]) r),
  '23514', '3. a retired relationship cannot be published');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 4. Unauthorized: a Researcher (edit_architecture, no publish_architecture).
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table ends_4 as
  select pg_temp.new_published_object('Unauth end A') as a, pg_temp.new_published_object('Unauth end B') as b;
create temp table rel_4 as
  select pg_temp.new_relationship(a, b, 'e0000000-0000-4000-8000-000000000001', 'internal') as id from ends_4;
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select is(
  (select r.error_code from public.publish_relationships(array[(select id from rel_4)]) r),
  '42501', '4. a Researcher (no publish_architecture) is refused');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 5. Cross-engagement: an id architect@tplco.test cannot even read (not a
--    member of e...02) is refused as not found, mixed with a valid id from
--    e...01 that still succeeds (partial success, not all-or-nothing).
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
create temp table ends_5 as
  select pg_temp.new_published_object('Workforce end A', 'e0000000-0000-4000-8000-000000000002') as a,
         pg_temp.new_published_object('Workforce end B', 'e0000000-0000-4000-8000-000000000002') as b;
create temp table rel_5_other as
  select pg_temp.new_relationship(a, b, 'e0000000-0000-4000-8000-000000000002', 'internal') as id from ends_5;
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
create temp table ends_5_own as
  select pg_temp.new_published_object('Mixed end A') as a, pg_temp.new_published_object('Mixed end B') as b;
update public.architecture_elements set client_visibility = 'client'
  where id in (select a from ends_5_own union select b from ends_5_own);
create temp table rel_5_own as
  select pg_temp.new_relationship(a, b, 'e0000000-0000-4000-8000-000000000001', 'client') as id from ends_5_own;

select is(
  (select r.published from public.publish_relationships(
     array[(select id from rel_5_own), (select id from rel_5_other)]) r
   where r.relationship_id = (select id from rel_5_own)),
  true, '5. the relationship in the architect''s own engagement still publishes');
select is(
  (select r.error_code from public.publish_relationships(
     array[(select id from rel_5_own), (select id from rel_5_other)]) r
   where r.relationship_id = (select id from rel_5_other)),
  'P0002', '   the cross-engagement relationship is refused as not found');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 6. Client-readability invariant: a relationship is client-readable only
--    once published AND client_visibility = client AND both ends are
--    client-readable. element_client_readable's own visibility OR-condition
--    is actor-dependent (can_read_architecture / view_full_architecture /
--    element_in_my_areas all read the current actor), so this check needs an
--    actor in context -- the architect, who satisfies can_read_architecture.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is(
  (select private.relationship_client_readable((select id from rel_5_own))),
  true, '6. the published, client-visible relationship between two client-visible ends is client-readable');
select is(
  (select private.relationship_client_readable((select id from rel_4))),
  false, '   an unpublished relationship is not client-readable regardless of its client_visibility flag');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 7. Duplicate ids collapse to one result row each; a nonexistent id still
--    yields its own row (refused P0002, same as submit_elements_for_review /
--    publish_element_versions, D8/ADR-0077): one row per distinct input id,
--    success or refusal, never zero.
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.publish_relationships(
     array[(select id from rel_5_own), (select id from rel_5_own), gen_random_uuid()])),
  2, '7. a duplicated id collapses to one row, and an unknown id still yields its own refused row');

select * from finish();
rollback;
