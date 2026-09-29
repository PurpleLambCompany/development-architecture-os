-- =============================================================================
-- Phase 1 RLS tests (pgTAP). Run with: pnpm db:test
--
-- Covers every acceptance check in DSA_OS_MASTER_BUILD_SPEC.md §30, plus
-- tenant isolation, least-privilege writes, and Method/IP isolation.
-- Depends on supabase/seed.sql.
-- =============================================================================
begin;

select plan(45);

-- Impersonate a seeded user by email (or clear to act as anon).
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
-- Anonymous callers see nothing
-- -----------------------------------------------------------------------------
select pg_temp.act_as_anon();
select throws_ok($$ select count(*) from public.engagements $$, '42501', null, 'anon cannot read engagements');
select throws_ok($$ select count(*) from public.method_assets $$, '42501', null, 'anon cannot read method assets');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Client isolation: Meridian contributor
-- -----------------------------------------------------------------------------
select pg_temp.act_as('contributor@meridian.test');
select results_eq(
  $$ select slug from public.engagements order by slug $$,
  $$ values ('meridian-innovation-district'::text) $$,
  'client contributor sees only the engagement they are assigned to'
);
select is((select count(*)::int from public.engagements where slug like 'harbor-%'), 0,
  'client contributor sees no other tenant''s engagements');
select is((select count(*)::int from public.method_assets), 0,
  'client contributor cannot read Method/IP');
select results_eq(
  $$ select slug from public.organizations $$,
  $$ values ('meridian-development-authority'::text) $$,
  'client contributor sees only their own organization'
);
select is((select count(*)::int from public.activity_log), 0,
  'client contributor cannot read the activity log');
select is((select count(*)::int from public.profiles where email = 'sponsor@harbor.test'), 0,
  'client contributor cannot read another tenant''s profiles');
select is((select count(*)::int from public.profiles where email = 'principal@tplco.test'), 1,
  'client contributor can read profiles of people on their engagement');
select throws_ok(
  $$ insert into public.engagements (client_organization_id, title, slug, engagement_type)
     values ('a0000000-0000-4000-8000-000000000002', 'X', 'x-contributor', 'custom') $$,
  '42501', null, 'client contributor cannot create engagements'
);
select is_empty(
  $$ update public.engagements set title = 'Changed' where slug = 'meridian-innovation-district' returning id $$,
  'client contributor cannot edit engagements'
);
select is_empty(
  $$ update public.organizations set name = 'Changed' returning id $$,
  'client contributor cannot edit their organization'
);
select throws_ok(
  $$ insert into public.organizations (name, slug, type) values ('Rogue', 'rogue', 'client') $$,
  '42501', null, 'client contributor cannot create organizations'
);
select throws_ok(
  $$ update public.profiles set status = 'suspended' where email = 'contributor@meridian.test' $$,
  '42501', null, 'client user cannot change their own profile status'
);
select lives_ok(
  $$ update public.profiles set first_name = 'Sam' where email = 'contributor@meridian.test' $$,
  'client user can edit their own name'
);
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Other client roles
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.engagements), 2,
  'Meridian sponsor sees both engagements they are assigned to');
select is((select count(*)::int from public.method_assets), 0, 'executive sponsor cannot read Method/IP');
select pg_temp.reset_actor();

select pg_temp.act_as('finance@harbor.test');
select is((select count(*)::int from public.engagements), 0,
  'unassigned client user sees no engagements, even in their own organization');
select pg_temp.reset_actor();

select pg_temp.act_as('viewer@harbor.test');
select results_eq(
  $$ select slug from public.engagements $$,
  $$ values ('harbor-community-expansion'::text) $$,
  'Harbor viewer sees only the Harbor engagement'
);
select is((select count(*)::int from public.engagement_members
           where engagement_id = 'e0000000-0000-4000-8000-000000000001'), 0,
  'Harbor viewer cannot see Meridian engagement team');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Internal least privilege
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select is((select count(*)::int from public.engagements), 1, 'researcher sees only assigned engagements');
select is((select count(*)::int from public.method_assets), 2, 'researcher can read Method/IP');
select throws_ok(
  $$ insert into public.organizations (name, slug, type) values ('R Org', 'r-org', 'client') $$,
  '42501', null, 'researcher cannot create organizations'
);
select is_empty(
  $$ update public.engagements set title = 'Changed' returning id $$,
  'researcher cannot edit engagements'
);
select pg_temp.reset_actor();

select pg_temp.act_as('finance@tplco.test');
select is((select count(*)::int from public.engagements), 1, 'finance administrator sees only assigned engagements');
select is((select count(*)::int from public.activity_log), 0, 'finance administrator cannot read the activity log');
select pg_temp.reset_actor();

select pg_temp.act_as('sysadmin@tplco.test');
select is((select count(*)::int from public.engagements), 3, 'system administrator sees every engagement');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Spec §30: internal user creates org, engagement, assigns users
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select is((select count(*)::int from public.engagements), 3, 'principal architect sees every engagement');
select lives_ok(
  $$ insert into public.organizations (id, name, slug, type)
     values ('a0000000-0000-4000-8000-0000000000aa', 'Northgate Institute', 'northgate-institute', 'client') $$,
  'internal user can create a client organization'
);
select throws_ok(
  $$ insert into public.organizations (name, slug, type) values ('Second TPLCo', 'tplco-2', 'tplco') $$,
  '42501', null, 'nobody can create a second TPLCo organization through the API'
);
select lives_ok(
  $$ insert into public.engagements (id, client_organization_id, title, slug, engagement_type)
     values ('e0000000-0000-4000-8000-0000000000aa', 'a0000000-0000-4000-8000-000000000002',
             'Meridian Governance Review', 'meridian-governance-review', 'custom') $$,
  'internal user can create an engagement'
);
select lives_ok(
  $$ insert into public.engagement_members (engagement_id, user_id, side, role)
     values ('e0000000-0000-4000-8000-0000000000aa', '20000000-0000-4000-8000-000000000005', 'client', 'client_viewer') $$,
  'internal user can assign a client user to an engagement'
);
select throws_ok(
  $$ insert into public.engagement_members (engagement_id, user_id, side, role)
     values ('e0000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', 'client', 'client_contributor') $$,
  '23514', null, 'a client user cannot be assigned to another tenant''s engagement'
);
select throws_ok(
  $$ insert into public.engagement_members (engagement_id, user_id, side, role)
     values ('e0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'internal', 'architect') $$,
  '23514', null, 'a client user cannot be assigned an internal role'
);
select throws_ok(
  $$ insert into public.organization_members (organization_id, user_id, role)
     values ('a0000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 'system_administrator') $$,
  '42501', null, 'principal architect cannot grant internal roles'
);
select pg_temp.reset_actor();

select pg_temp.act_as('viewer@meridian.test');
select is((select count(*)::int from public.engagements where slug = 'meridian-governance-review'), 1,
  'newly assigned client user can see the engagement');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Project Administrator: creates, is auto-assigned, cannot archive
-- -----------------------------------------------------------------------------
select pg_temp.act_as('projectadmin@tplco.test');
select is((select count(*)::int from public.engagements where slug like 'harbor-%'), 0,
  'project administrator does not see unassigned engagements');
select lives_ok(
  $$ insert into public.engagements (id, client_organization_id, title, slug, engagement_type)
     values ('e0000000-0000-4000-8000-0000000000bb', 'a0000000-0000-4000-8000-000000000003',
             'Harbor Board Review', 'harbor-board-review', 'custom') $$,
  'project administrator can create an engagement'
);
select is((select count(*)::int from public.engagements where slug = 'harbor-board-review'), 1,
  'project administrator is automatically assigned to what they create');
select lives_ok(
  $$ insert into public.engagement_members (engagement_id, user_id, side, role)
     values ('e0000000-0000-4000-8000-0000000000bb', '30000000-0000-4000-8000-000000000002', 'client', 'client_project_lead') $$,
  'project administrator can assign members to their engagement'
);
select throws_ok(
  $$ update public.engagements set status = 'archived' where slug = 'harbor-board-review' $$,
  '42501', null, 'project administrator cannot archive an engagement'
);
select throws_ok(
  $$ delete from public.engagements where slug = 'harbor-board-review' $$,
  '42501', null, 'engagements cannot be deleted through the API'
);
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Revocation takes effect immediately
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sysadmin@tplco.test');
update public.organization_members set status = 'suspended'
  where user_id = '20000000-0000-4000-8000-000000000002';
select pg_temp.reset_actor();

select pg_temp.act_as('lead@meridian.test');
select is((select count(*)::int from public.engagements), 0,
  'suspending an organization membership removes engagement access');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Audit trail
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sysadmin@tplco.test');
select ok(
  exists (select 1 from public.activity_log
          where entity_type = 'engagements' and action_type = 'insert'
            and entity_id = 'e0000000-0000-4000-8000-0000000000aa'
            and actor_user_id = '10000000-0000-4000-8000-000000000002'),
  'engagement creation is recorded in the activity log with its actor'
);
select throws_ok(
  $$ delete from public.activity_log $$,
  '42501', null, 'the activity log cannot be modified'
);
select pg_temp.reset_actor();

select * from finish();
rollback;
