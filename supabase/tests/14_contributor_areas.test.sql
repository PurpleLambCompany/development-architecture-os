-- =============================================================================
-- Phase 4 contributor areas (pgTAP). Run with: pnpm db:test
--
-- A client member without view_full_architecture sees only the published
-- architecture in their areas: a domain, or an element and everything
-- published as part of it; Project Intelligence records through the objects
-- they concern or their domains; engagement-wide records only when assigned
-- directly. Areas are assigned by those who manage the engagement team.
--
-- Seed (supabase/seed.sql, "Phase 4"), Meridian e...01: the Client
-- Contributor has the Capability domain; the multi-organization advisor (a
-- Contributor at Meridian, Client Project Lead at Harbor e...03) has APP-005
-- District operating model b3...405, of which APP-001 and APP-006 are part.
-- =============================================================================
begin;

select plan(27);

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

-- The engagement membership of a seeded user (Meridian unless named).
create function pg_temp.member(user_email text, engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language sql
security definer
as $$
  select m.id from public.engagement_members m join auth.users u on u.id = m.user_id
  where m.engagement_id = engagement and u.email = user_email;
$$;

-- Reads a value as the database owner, whatever the current actor.
create function pg_temp.status_of(p_element uuid)
returns text
language sql
security definer
as $$
  select private.intelligence_record_status(p_element);
$$;

create function pg_temp.seen()
returns text
language sql
as $$
  select coalesce(string_agg(reference_code, ',' order by reference_code), '')
  from public.client_architecture('e0000000-0000-4000-8000-000000000001');
$$;

create table pg_temp.ids (key text primary key, id uuid);
grant all on pg_temp.ids to authenticated;

-- -----------------------------------------------------------------------------
-- What an area shows
-- -----------------------------------------------------------------------------
select pg_temp.act_as('contributor@meridian.test');
select is(pg_temp.seen(), 'CAP-001,CAP-002,CAP-003,CAP-004,CAP-005,CAP-006,OPP-001,REC-001,RSK-001,RSK-002',
  'the Client Contributor sees the Capability domain and the records that concern it');
select ok(not exists (select 1 from public.client_architecture_relationships('e0000000-0000-4000-8000-000000000001') r
                      where not exists (select 1 from public.client_architecture('e0000000-0000-4000-8000-000000000001') c
                                        where c.element_id in (r.source_element_id, r.target_element_id))),
  'and only relationships touching what they can see');
select is((select count(*)::int from public.element_versions
           where element_id = 'b3000000-0000-4000-8000-000000000301'), 0,
  'published versions outside their areas are not readable');
select is((select count(*)::int from public.architecture_approvals), 2,
  'approvals only on what is in their areas');
select is((select count(*)::int from public.engagement_member_areas), 1, 'they read their own area');
select pg_temp.reset_actor();

select pg_temp.act_as('advisor@consulting.test');
select is(pg_temp.seen(), 'APP-001,APP-005,APP-006,DEC-001,DEP-001',
  'an element area shows the element, what is published as part of it, and the records that concern them');
select is((select count(*)::int from public.client_architecture('e0000000-0000-4000-8000-000000000003')), 2,
  'the same person, as Client Project Lead at Harbor, sees all of Harbor''s architecture');
select pg_temp.reset_actor();

select pg_temp.act_as('lead@meridian.test');
select is((select count(*)::int from public.client_architecture('e0000000-0000-4000-8000-000000000001')), 34,
  'the Client Project Lead holds view_full_architecture and sees everything published');
select is((select count(*)::int from public.engagement_member_areas), 0, 'and does not read others'' areas');
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.engagement_member_areas), 2, 'TPLCo readers see every area');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Assigning areas
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.assign_member_area(pg_temp.member('contributor@meridian.test'), 'knowledge') $$,
  '42501', null, 'an Architect who does not manage the engagement cannot assign areas');
select pg_temp.reset_actor();
select pg_temp.act_as('lead@meridian.test');
select throws_ok($$ select public.assign_member_area(pg_temp.member('contributor@meridian.test'), 'knowledge') $$,
  'P0002', null, 'nor can a client');
select throws_ok($$ insert into public.engagement_member_areas (engagement_id, engagement_member_id, domain)
                   values ('e0000000-0000-4000-8000-000000000001', pg_temp.member('lead@meridian.test'), 'knowledge') $$,
  '42501', null, 'and areas are never written directly');
select pg_temp.reset_actor();

select pg_temp.act_as('projectadmin@tplco.test');
select throws_ok($$ select public.assign_member_area(pg_temp.member('researcher@tplco.test'), 'knowledge') $$,
  '23514', null, 'areas are for client members');
select throws_ok($$ select public.assign_member_area(pg_temp.member('contributor@meridian.test'), 'knowledge',
  'b3000000-0000-4000-8000-000000000101') $$, '23514', null, 'an area is a domain or an element, not both');
select throws_ok($$ select public.assign_member_area(pg_temp.member('contributor@meridian.test'), 'capability') $$,
  '23514', null, 'and is assigned once');
select lives_ok($$ insert into pg_temp.ids select 'k', public.assign_member_area(pg_temp.member('contributor@meridian.test'), 'knowledge') $$,
  'an assigned Project Administrator gives the Client Contributor the Knowledge domain');
select lives_ok($$ insert into pg_temp.ids select 'c', public.assign_member_area(pg_temp.member('contributor@meridian.test'), null,
  'b3000000-0000-4000-8000-000000000504') $$, 'and an engagement-wide constraint directly');
select pg_temp.reset_actor();

select pg_temp.act_as('contributor@meridian.test');
select ok(pg_temp.seen() like '%KNW-001%' and pg_temp.seen() like '%KNW-010%', 'the Knowledge domain appears at once');
select ok(pg_temp.seen() like '%CNS-001%', 'as does the engagement-wide record assigned to them');
select ok(pg_temp.seen() not like '%STR-%', 'the Strategic Model is still outside their areas');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.remove_member_area((select id from pg_temp.ids where key = 'k')) $$,
  'the Principal Architect removes an area');
select pg_temp.reset_actor();
select pg_temp.act_as('contributor@meridian.test');
select ok(pg_temp.seen() not like '%KNW-%', 'and it disappears from the client view at once');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- view_full_architecture decides whether areas apply
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted, reason)
values (pg_temp.member('viewer@meridian.test'), 'view_full_architecture', false, 'Board observer: operating model only');
select lives_ok($$ select public.assign_member_area(pg_temp.member('viewer@meridian.test'), null,
  'b3000000-0000-4000-8000-000000000405') $$, 'a Client Viewer limited by override is given one area');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted, reason)
values (pg_temp.member('contributor@meridian.test'), 'view_full_architecture', true, 'Now leads the whole review');
select pg_temp.reset_actor();

select pg_temp.act_as('viewer@meridian.test');
select is(pg_temp.seen(), 'APP-001,APP-005,APP-006,DEC-001,DEP-001', 'and sees only that area');
select pg_temp.reset_actor();
select pg_temp.act_as('contributor@meridian.test');
select is((select count(*)::int from public.client_architecture('e0000000-0000-4000-8000-000000000001')), 34,
  'a Client Contributor granted view_full_architecture sees everything published');
select pg_temp.reset_actor();

-- A request about an element outside the Viewer's area is refused even
-- though the Viewer could see it before the override.
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.client_architecture('e0000000-0000-4000-8000-000000000001')
           where reference_code like 'STR-%'), 5, 'the Executive Sponsor still sees the Strategic Model');
select pg_temp.reset_actor();

select * from finish();
rollback;
