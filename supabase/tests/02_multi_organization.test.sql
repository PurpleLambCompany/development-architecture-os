-- =============================================================================
-- Multi-organization membership (pgTAP). Run with: pnpm db:test
--
-- One person may belong to several organizations with a different role in
-- each. These tests prove that holding memberships in two client
-- organizations never lets anyone see across tenants.
--
-- Seed: advisor@consulting.test is a Client Contributor at Meridian
-- (assigned to Regional Innovation District) and a Client Project Lead at
-- Harbor (assigned to Community Expansion Architecture).
-- =============================================================================
begin;

select plan(19);

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

-- -----------------------------------------------------------------------------
-- The multi-organization person sees exactly what each membership allows
-- -----------------------------------------------------------------------------
select pg_temp.act_as('advisor@consulting.test');
select results_eq(
  $$ select slug from public.organizations order by slug $$,
  $$ values ('harbor-commons-foundation'::text), ('meridian-development-authority'::text) $$,
  'a person in two client organizations sees both, and only those'
);
select results_eq(
  $$ select slug from public.engagements order by slug $$,
  $$ values ('harbor-community-expansion'::text), ('meridian-innovation-district'::text) $$,
  'they see the assigned engagement in each organization, and no others'
);
select results_eq(
  $$ select e.slug, em.role::text from public.engagement_members em
     join public.engagements e on e.id = em.engagement_id
     where em.user_id = '40000000-0000-4000-8000-000000000001' order by e.slug $$,
  $$ values ('harbor-community-expansion'::text, 'client_project_lead'::text),
            ('meridian-innovation-district'::text, 'client_contributor'::text) $$,
  'they hold a different role on each engagement'
);
select is((select count(*)::int from public.organization_members m
           join public.organizations o on o.id = m.organization_id where o.type = 'tplco'), 0,
  'they cannot see TPLCo staff memberships');
select is((select count(*)::int from public.method_assets), 0, 'they cannot read Method/IP');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Their colleagues in one organization learn nothing about the other
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sponsor@meridian.test');
select results_eq(
  $$ select o.slug from public.organization_members m join public.organizations o on o.id = m.organization_id
     where m.user_id = '40000000-0000-4000-8000-000000000001' $$,
  $$ values ('meridian-development-authority'::text) $$,
  'a Meridian user sees the advisor''s Meridian membership only, not their Harbor membership'
);
select is((select count(*)::int from public.organizations), 1, 'a Meridian user still sees only Meridian');
select is((select count(*)::int from public.engagement_members
           where engagement_id = 'e0000000-0000-4000-8000-000000000003'), 0,
  'a Meridian user cannot see the Harbor engagement team through the shared advisor');
select is((select count(*)::int from public.profiles where email = 'lead@harbor.test'), 0,
  'a Meridian user cannot see Harbor people the advisor works with');
select is((select count(*)::int from public.profiles where email = 'advisor@consulting.test'), 1,
  'a Meridian user can see the advisor, who is on their engagement');
select pg_temp.reset_actor();

select pg_temp.act_as('viewer@harbor.test');
select results_eq(
  $$ select slug from public.organizations $$,
  $$ values ('harbor-commons-foundation'::text) $$,
  'a Harbor user still sees only Harbor'
);
select is((select count(*)::int from public.engagements where slug like 'meridian-%'), 0,
  'a Harbor user cannot see Meridian engagements through the shared advisor');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Adding a second membership
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select lives_ok(
  $$ insert into public.organization_members (organization_id, user_id, role)
     values ('a0000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000005', 'client_viewer') $$,
  'an existing Meridian user can be added to Harbor as a second organization'
);
select throws_ok(
  $$ insert into public.organization_members (organization_id, user_id, role)
     values ('a0000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000005', 'client_finance') $$,
  '23505', null, 'a person holds at most one membership per organization'
);
select pg_temp.reset_actor();

select pg_temp.act_as('viewer@meridian.test');
select is((select count(*)::int from public.organizations), 2, 'the new membership shows the second organization');
select is((select count(*)::int from public.engagements where slug like 'harbor-%'), 0,
  'membership alone grants no engagement access in the second organization');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Suspending one membership leaves the other intact
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sysadmin@tplco.test');
update public.organization_members set status = 'suspended'
  where user_id = '40000000-0000-4000-8000-000000000001'
    and organization_id = 'a0000000-0000-4000-8000-000000000002';
select pg_temp.reset_actor();

select pg_temp.act_as('advisor@consulting.test');
select results_eq(
  $$ select slug from public.engagements $$,
  $$ values ('harbor-community-expansion'::text) $$,
  'suspending the Meridian membership removes Meridian access only'
);
select results_eq(
  $$ select slug from public.organizations $$,
  $$ values ('harbor-commons-foundation'::text) $$,
  'the suspended organization disappears; the other remains'
);
select is(
  (select count(*)::int from public.engagement_members where engagement_id = 'e0000000-0000-4000-8000-000000000001'),
  0,
  'a stale assignment in the suspended organization exposes nothing'
);
select pg_temp.reset_actor();

select * from finish();
rollback;
