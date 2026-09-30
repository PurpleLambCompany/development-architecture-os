-- =============================================================================
-- Phase 5 acceptance-review fix, Defect 4 (pgTAP). Run with: pnpm db:test
--
-- Area-limited Client Contributors previously saw ZERO Phase 5 records
-- (reviews, deliverables, implementation initiatives) regardless of their
-- assigned area, because private.element_in_member_areas's `concerned` walk
-- did not recognize Phase 5's structural relationship vocabulary
-- (implements/documents/examines). See ADR-0040. This suite exercises the
-- fixed private.element_in_member_areas (via client_implementation,
-- client_reviews, client_deliverables) against Harbor's seeded Phase 5
-- fixtures, e...03:
--   IMP-001 "Expansion Council stand-up"      implements APP-001 (application)
--   IMP-002 "Regional demand study rollout"   implements KNW-001 (knowledge)
--   IMP-003 "Third-region governance..."      implements APP-001, internal-only
--   REV-001 "Expansion Readiness Review"      examines APP-001 directly,
--                                              and examines IMP-002 (validates it)
--   DLV-001 "Community Expansion: Executive Strategy Deck" documents APP-001
--                                              and KNW-001
-- =============================================================================
begin;

select plan(18);

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

create function pg_temp.member(user_email text, engagement uuid default 'e0000000-0000-4000-8000-000000000003')
returns uuid
language sql
security definer
as $$
  select m.id from public.engagement_members m join auth.users u on u.id = m.user_id
  where m.engagement_id = engagement and u.email = user_email;
$$;

create function pg_temp.imp_codes(p_engagement uuid)
returns text
language sql
as $$
  select coalesce(string_agg(reference_code, ',' order by reference_code), '')
  from public.client_implementation(p_engagement);
$$;

create function pg_temp.review_codes(p_engagement uuid)
returns text
language sql
as $$
  select coalesce(string_agg(reference_code, ',' order by reference_code), '')
  from public.client_reviews(p_engagement);
$$;

create function pg_temp.deliverable_codes(p_engagement uuid)
returns text
language sql
as $$
  select coalesce(string_agg(reference_code, ',' order by reference_code), '')
  from public.client_deliverables(p_engagement);
$$;

-- -----------------------------------------------------------------------------
-- Fixture: contributor@harbor.test (already a member of Harbor's client
-- organization, per seed, but not yet an engagement member) joins Harbor's
-- engagement as a Client Contributor and is given the application area —
-- self-contained to this suite, rolled back with it.
-- -----------------------------------------------------------------------------
insert into public.engagement_members (engagement_id, user_id, side, role, status)
select 'e0000000-0000-4000-8000-000000000003', u.id, 'client', 'client_contributor', 'active'
from auth.users u where u.email = 'contributor@harbor.test';

select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.assign_member_area(pg_temp.member('contributor@harbor.test'), 'application') $$,
  'the Principal Architect gives the new Harbor Contributor the Application area');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 1. A full-architecture client user sees every published, client-visible
--    Phase 5 record for the engagement (view_full_architecture, unaffected
--    by areas) -- this already worked and must keep working.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('lead@harbor.test');
select is(pg_temp.imp_codes('e0000000-0000-4000-8000-000000000003'), 'IMP-001,IMP-002',
  'the Client Project Lead (view_full_architecture) sees both client-visible initiatives, not the internal-only IMP-003');
select is(pg_temp.review_codes('e0000000-0000-4000-8000-000000000003'), 'REV-001',
  'and the published review');
select is(pg_temp.deliverable_codes('e0000000-0000-4000-8000-000000000003'), 'DLV-001',
  'and the published deliverable');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 2 & 3. An area-limited Contributor sees Phase 5 records structurally
--    connected to their assigned area, and nothing else -- previously this
--    was empty regardless of area (the bug); now it must match the area
--    exactly.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('contributor@harbor.test');
select is(pg_temp.imp_codes('e0000000-0000-4000-8000-000000000003'), 'IMP-001',
  'the Application-area Contributor sees IMP-001 (implements an Application object) but not IMP-002 (Knowledge)');
select is(pg_temp.review_codes('e0000000-0000-4000-8000-000000000003'), 'REV-001',
  'and REV-001 (examines an Application object directly)');
select is(pg_temp.deliverable_codes('e0000000-0000-4000-8000-000000000003'), 'DLV-001',
  'and DLV-001 (documents an Application object)');
select pg_temp.reset_actor();

-- Reassign to a domain with no Phase 5 connection at all: the Contributor
-- should then see nothing from Phase 5, proving this is genuine area
-- scoping and not blanket visibility.
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.remove_member_area(
  (select id from public.engagement_member_areas
   where engagement_member_id = pg_temp.member('contributor@harbor.test') and domain = 'application')) $$,
  'the Application area is removed');
select lives_ok($$ select public.assign_member_area(pg_temp.member('contributor@harbor.test'), 'strategic_model') $$,
  'and the unrelated Strategic Model area is assigned instead');
select pg_temp.reset_actor();

select pg_temp.act_as('contributor@harbor.test');
select is(pg_temp.imp_codes('e0000000-0000-4000-8000-000000000003'), '', 'no initiative is in the Strategic Model area');
select is(pg_temp.review_codes('e0000000-0000-4000-8000-000000000003'), '', 'no review is in the Strategic Model area');
select is(pg_temp.deliverable_codes('e0000000-0000-4000-8000-000000000003'), '', 'no deliverable is in the Strategic Model area');
select pg_temp.reset_actor();

-- The Review->examines->Initiative path: assign Knowledge (KNW-001, what
-- IMP-002 implements) and confirm REV-001 becomes visible purely because it
-- examines IMP-002, which is itself now in-area -- with no direct examines
-- link from REV-001 to a Knowledge object.
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.remove_member_area(
  (select id from public.engagement_member_areas
   where engagement_member_id = pg_temp.member('contributor@harbor.test') and domain = 'strategic_model')) $$,
  'the Strategic Model area is removed');
select lives_ok($$ select public.assign_member_area(pg_temp.member('contributor@harbor.test'), 'knowledge') $$,
  'and the Knowledge area is assigned');
select pg_temp.reset_actor();

select pg_temp.act_as('contributor@harbor.test');
select is(pg_temp.imp_codes('e0000000-0000-4000-8000-000000000003'), 'IMP-002',
  'the Knowledge-area Contributor sees IMP-002 (implements a Knowledge object)');
select is(pg_temp.review_codes('e0000000-0000-4000-8000-000000000003'), 'REV-001',
  'and sees REV-001 too, solely through examining the now-visible IMP-002 (it has no direct link to a Knowledge object)');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 4. Cross-engagement / cross-organization isolation still holds.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.client_implementation('e0000000-0000-4000-8000-000000000003')), 0,
  'a Meridian client (no membership of Harbor''s engagement) sees none of Harbor''s Phase 5 records');
select pg_temp.reset_actor();

select pg_temp.act_as('contributor@meridian.test');
select is((select count(*)::int from public.client_reviews('e0000000-0000-4000-8000-000000000003')), 0,
  'and an area-limited Contributor on a different engagement cannot see Harbor''s reviews regardless of their own area');
select pg_temp.reset_actor();

select * from finish();
rollback;
