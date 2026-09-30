-- =============================================================================
-- Engagement capabilities (pgTAP). Run with: pnpm db:test
--
-- Roles supply default capabilities; per-member overrides grant or revoke
-- one capability on one engagement without changing the role. Financial
-- visibility is separate from project visibility.
--
-- Seed: lead@meridian.test has a view_financials override on the Regional
-- Innovation District only.
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

create function pg_temp.act_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
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

create function pg_temp.caps(engagement uuid)
returns text[]
language sql
as $$
  select coalesce(array_agg(c::text order by c::text), '{}')
  from public.my_engagement_capabilities(engagement) as c;
$$;

-- Engagement ids (seed)
--   district  e...01  Meridian, full team
--   workforce e...02  Meridian, sponsor only on the client side
--   harbor    e...03  Harbor

-- -----------------------------------------------------------------------------
-- Client role defaults
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sponsor@meridian.test');
select is(
  pg_temp.caps('e0000000-0000-4000-8000-000000000001'),
  array['approve_architecture', 'approve_change_orders', 'manage_client_team', 'pay_invoices',
        'view_architecture', 'view_confidential_deliverables', 'view_financials'],
  'Executive Sponsor: all client capabilities, including financial visibility and architecture'
);
select pg_temp.reset_actor();

select pg_temp.act_as('finance@meridian.test');
select is(
  pg_temp.caps('e0000000-0000-4000-8000-000000000001'),
  array['pay_invoices', 'view_financials'],
  'Client Finance: financial visibility and payment, no architecture viewing or approval'
);
select pg_temp.reset_actor();

select pg_temp.act_as('lead@harbor.test');
select is(
  pg_temp.caps('e0000000-0000-4000-8000-000000000003'),
  array['approve_architecture', 'manage_client_team', 'view_architecture', 'view_confidential_deliverables'],
  'Client Project Lead: project authority and architecture, no financial visibility by default'
);
select pg_temp.reset_actor();

select pg_temp.act_as('contributor@meridian.test');
select is(pg_temp.caps('e0000000-0000-4000-8000-000000000001'), array['view_architecture'],
  'Client Contributor: sees published architecture only');
select pg_temp.reset_actor();

select pg_temp.act_as('viewer@meridian.test');
select is(pg_temp.caps('e0000000-0000-4000-8000-000000000001'), array['view_architecture'],
  'Client Viewer: sees published architecture only');
select is(pg_temp.caps('e0000000-0000-4000-8000-000000000003'), '{}'::text[],
  'no capabilities on another tenant''s engagement');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Overrides change one member on one engagement, not the role
-- -----------------------------------------------------------------------------
select pg_temp.act_as('lead@meridian.test');
select ok('view_financials' = any (pg_temp.caps('e0000000-0000-4000-8000-000000000001')),
  'a Project Lead granted view_financials by override has it on that engagement');
select is((select count(*)::int from public.engagement_member_capability_overrides), 1,
  'a member can see their own override');
select pg_temp.reset_actor();

select pg_temp.act_as('contributor@meridian.test');
select is((select count(*)::int from public.engagement_member_capability_overrides), 0,
  'a client cannot see other members'' overrides');
select pg_temp.reset_actor();

select pg_temp.act_as('advisor@consulting.test');
select is(
  pg_temp.caps('e0000000-0000-4000-8000-000000000003'),
  array['approve_architecture', 'manage_client_team', 'view_architecture', 'view_confidential_deliverables'],
  'a multi-organization person gets Project Lead capabilities at Harbor'
);
select is(pg_temp.caps('e0000000-0000-4000-8000-000000000001'), array['view_architecture'],
  'and only Contributor capabilities at Meridian: roles never carry across organizations');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Internal finance: portfolio financial access without project access
-- -----------------------------------------------------------------------------
select pg_temp.act_as('finance@tplco.test');
select is(
  pg_temp.caps('e0000000-0000-4000-8000-000000000003'),
  array['manage_financials', 'view_financials'],
  'Finance Administrator has financial visibility and management on an engagement they are not assigned to'
);
select ok(private.can_view_engagement_financials('e0000000-0000-4000-8000-000000000002'),
  'Finance Administrator passes the Phase 2 financial check portfolio-wide');
select is((select count(*)::int from public.engagements where id = 'e0000000-0000-4000-8000-000000000003'), 0,
  'but cannot read that engagement''s project content');
select is((select count(*)::int from public.engagement_members
           where engagement_id = 'e0000000-0000-4000-8000-000000000003'), 0,
  'nor its team');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select is(pg_temp.caps('e0000000-0000-4000-8000-000000000001'),
  array['edit_architecture', 'view_confidential_deliverables'],
  'Researcher: drafts architecture, no financial visibility on an assigned engagement');
select is(pg_temp.caps('e0000000-0000-4000-8000-000000000003'), '{}'::text[],
  'Researcher: nothing on an unassigned engagement');
select ok(not private.can_view_engagement_financials('e0000000-0000-4000-8000-000000000001'),
  'Researcher fails the financial check');
select pg_temp.reset_actor();

select pg_temp.act_as('sysadmin@tplco.test');
select ok('view_financials' = any (pg_temp.caps('e0000000-0000-4000-8000-000000000003')),
  'System Administrator has portfolio financial visibility');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Who may change capabilities
-- -----------------------------------------------------------------------------
select pg_temp.act_as('projectadmin@tplco.test');
select throws_ok(
  $$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
     select id, 'view_financials', true from public.engagement_members
     where engagement_id = 'e0000000-0000-4000-8000-000000000001'
       and user_id = '20000000-0000-4000-8000-000000000004' $$,
  '42501', null, 'a Project Administrator cannot grant financial visibility'
);
select lives_ok(
  $$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
     select id, 'approve_architecture', true from public.engagement_members
     where engagement_id = 'e0000000-0000-4000-8000-000000000001'
       and user_id = '20000000-0000-4000-8000-000000000004' $$,
  'a Project Administrator can grant a non-financial capability on their engagement'
);
select throws_ok(
  $$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
     select id, 'approve_architecture', true from public.engagement_members
     where engagement_id = 'e0000000-0000-4000-8000-000000000001'
       and user_id = '10000000-0000-4000-8000-000000000005' $$,
  '42501', null, 'nobody but a System Administrator can change their own capabilities'
);
select pg_temp.reset_actor();

select pg_temp.act_as('contributor@meridian.test');
select ok('approve_architecture' = any (pg_temp.caps('e0000000-0000-4000-8000-000000000001')),
  'the granted override takes effect for that member');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select throws_ok(
  $$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
     select id, 'pay_invoices', true from public.engagement_members
     where engagement_id = 'e0000000-0000-4000-8000-000000000001'
       and user_id = '10000000-0000-4000-8000-000000000003' $$,
  '23514', null, 'client-only capabilities cannot be granted to internal members'
);
select lives_ok(
  $$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted, reason)
     select id, 'view_financials', false, 'Sponsor delegated finance to Client Finance' from public.engagement_members
     where engagement_id = 'e0000000-0000-4000-8000-000000000001'
       and user_id = '20000000-0000-4000-8000-000000000001' $$,
  'a Principal Architect can revoke a default capability for one member'
);
select lives_ok(
  $$ delete from public.engagement_member_capability_overrides
     where capability = 'view_financials' and granted
       and engagement_id = 'e0000000-0000-4000-8000-000000000001' $$,
  'a Principal Architect can remove an override'
);
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select ok(not ('view_financials' = any (pg_temp.caps('e0000000-0000-4000-8000-000000000001'))),
  'the revoked capability is gone on that engagement');
select ok('view_financials' = any (pg_temp.caps('e0000000-0000-4000-8000-000000000002')),
  'but the same person keeps it on their other engagement');
select is((select count(*)::int from public.role_capability_defaults where role = 'executive_sponsor'), 7,
  'the Executive Sponsor role definition is unchanged');
select throws_ok(
  $$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
     select id, 'view_financials', true from public.engagement_members
     where user_id = '20000000-0000-4000-8000-000000000001' limit 1 $$,
  '42501', null, 'client users cannot change capabilities'
);
select throws_ok(
  $$ insert into public.role_capability_defaults (role, capability) values ('client_viewer', 'view_financials') $$,
  '42501', null, 'nobody can change role definitions through the API'
);
select pg_temp.reset_actor();

select pg_temp.act_as('lead@meridian.test');
select ok(not ('view_financials' = any (pg_temp.caps('e0000000-0000-4000-8000-000000000001'))),
  'removing the override returns the Project Lead to the role default');
select pg_temp.reset_actor();

select pg_temp.act_as('finance@tplco.test');
select throws_ok(
  $$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
     values ('00000000-0000-0000-0000-000000000000', 'view_financials', true) $$,
  null, null, 'portfolio financial access does not allow managing capabilities on unseen engagements'
);
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Suspension removes capabilities immediately
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sysadmin@tplco.test');
update public.organization_members set status = 'suspended'
  where user_id = '30000000-0000-4000-8000-000000000001';
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@harbor.test');
select is(pg_temp.caps('e0000000-0000-4000-8000-000000000003'), '{}'::text[],
  'a suspended client member holds no capabilities');
select pg_temp.reset_actor();

select * from finish();
rollback;
