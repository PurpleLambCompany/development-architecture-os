-- =============================================================================
-- V1-A Workstream A: practice administration and authority (pgTAP).
-- Run with: pnpm db:test. Depends on supabase/seed.sql.
--
--   D1, D4  administer_practice is a practice capability, held by default by
--           Principal Architects and System Administrators, delegable.
--   D2      only an active Principal Architect creates architectural
--           authority (Principal Architect, Architect, Researcher), by any
--           route: invitation, role change, restoring a membership, restoring
--           a profile. Never for themselves.
--   D3      an internal engagement role is the TPLCo role; role changes
--           follow, overrides are kept.
--   D5      no self role or status change; the last active Principal
--           Architect and practice administrator remain.
--   A6      the practice organization is edited by practice administrators;
--           its type and status do not change from the app.
-- Concurrency is covered by 99_practice_concurrency.test.sql.
-- =============================================================================
begin;

select plan(83);

create function pg_temp.act_as(user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  execute 'reset role';
  select id into uid from auth.users where email = user_email;
  if uid is null then
    raise exception 'No user %', user_email;
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

-- A person with an account and no membership (as an invitation creates).
create function pg_temp.new_person(user_email text)
returns uuid
language sql
as $$
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
          user_email, '{}', '{}')
  returning id;
$$;

create function pg_temp.uid(user_email text)
returns uuid
language sql
security definer
as $$
  select id from auth.users where email = user_email;
$$;

create function pg_temp.member(user_email text)
returns uuid
language sql
security definer
as $$
  select m.id from public.organization_members m
  join public.organizations o on o.id = m.organization_id and o.type = 'tplco'
  where m.user_id = pg_temp.uid(user_email);
$$;

create function pg_temp.practice_role(user_email text)
returns public.app_role
language sql
security definer
as $$
  select m.role from public.organization_members m where m.id = pg_temp.member(user_email);
$$;

create function pg_temp.engagement_role(engagement uuid, user_email text)
returns public.app_role
language sql
security definer
as $$
  select role from public.engagement_members where engagement_id = engagement and user_id = pg_temp.uid(user_email);
$$;

create function pg_temp.administers()
returns boolean
language sql
as $$
  select 'administer_practice' = any (array(select public.my_practice_capabilities()));
$$;

create function pg_temp.invite(user_email text, member_role public.app_role, member_status public.record_status default 'invited')
returns void
language sql
as $$
  insert into public.organization_members (organization_id, user_id, role, status)
  values ('a0000000-0000-4000-8000-000000000001', pg_temp.uid(user_email), member_role, member_status);
$$;

select pg_temp.new_person(format('person%s@practice.test', n)) from generate_series(1, 9) n;

-- -----------------------------------------------------------------------------
-- D1, D4: the capability and its defaults
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select ok(pg_temp.administers(), 'a Principal Architect administers the practice by default');
select pg_temp.act_as('sysadmin@tplco.test');
select ok(pg_temp.administers(), 'a System Administrator administers the practice by default');
select pg_temp.act_as('sponsor@meridian.test');
select ok(not pg_temp.administers(), 'a client never administers the practice');
select pg_temp.reset_actor();
select is(private.practice_capability_holder_count('administer_practice'), 2,
  'nobody else holds it: Architects, Researchers, Project and Finance Administrators do not');
select is(
  array(select r from unnest(enum_range(null::public.app_role)) r where public.is_architecture_authority_role(r) order by r),
  array['principal_architect', 'architect', 'researcher']::public.app_role[],
  'the architectural authority-bearing roles are Principal Architect, Architect and Researcher');
select is(
  array(select distinct d.role from public.role_capability_defaults d
        where public.is_architecture_authority_capability(d.capability) order by d.role),
  array(select r from unnest(enum_range(null::public.app_role)) r where public.is_architecture_authority_role(r) order by r),
  'they are exactly the roles whose engagement defaults carry architecture authority');

-- -----------------------------------------------------------------------------
-- A1, A2: inviting into the practice
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select pg_temp.invite('person1@practice.test', 'architect') $$,
  'a Principal Architect invites an Architect');
select lives_ok($$ select pg_temp.invite('person2@practice.test', 'researcher') $$,
  'a Principal Architect invites a Researcher');
select lives_ok($$ select pg_temp.invite('person3@practice.test', 'principal_architect') $$,
  'a Principal Architect invites another Principal Architect');
select lives_ok($$ select pg_temp.invite('person4@practice.test', 'project_administrator') $$,
  'a Principal Architect invites a Project Administrator');

select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ select pg_temp.invite('person5@practice.test', 'architect') $$, '42501', null,
  'a System Administrator cannot invite an Architect');
select throws_ok($$ select pg_temp.invite('person5@practice.test', 'researcher') $$, '42501', null,
  'nor a Researcher');
select throws_ok($$ select pg_temp.invite('person5@practice.test', 'principal_architect') $$, '42501', null,
  'nor a Principal Architect');
select lives_ok($$ select pg_temp.invite('person5@practice.test', 'project_administrator') $$,
  'a System Administrator invites a Project Administrator');
select lives_ok($$ select pg_temp.invite('person6@practice.test', 'system_administrator') $$,
  'and another System Administrator');
select lives_ok($$ select pg_temp.invite('person7@practice.test', 'finance_administrator') $$,
  'and a Finance Administrator');

select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select pg_temp.invite('person8@practice.test', 'finance_administrator') $$, '42501', null,
  'a Researcher, who does not administer the practice, cannot invite anyone');
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select pg_temp.invite('person8@practice.test', 'finance_administrator') $$, '42501', null,
  'nor can an Architect');
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok($$ select pg_temp.invite('person8@practice.test', 'finance_administrator') $$, '42501', null,
  'nor a client');

-- -----------------------------------------------------------------------------
-- A2: no other route creates architectural authority
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ update public.organization_members set role = 'architect' where id = pg_temp.member('projectadmin@tplco.test') $$,
  '42501', null, 'a System Administrator cannot change someone into an Architect');
select throws_ok($$ update public.organization_members set role = 'principal_architect' where id = pg_temp.member('finance@tplco.test') $$,
  '42501', null, 'nor into a Principal Architect');
select throws_ok($$ update public.organization_members set role = 'architect' where id = pg_temp.member('researcher@tplco.test') $$,
  '42501', null, 'nor move someone between authority-bearing roles');
select lives_ok($$ update public.organization_members set role = 'finance_administrator' where id = pg_temp.member('person5@practice.test') $$,
  'a System Administrator changes roles that carry no architectural authority');
select lives_ok($$ update public.organization_members set role = 'project_administrator' where id = pg_temp.member('researcher@tplco.test') $$,
  'and may remove architectural authority');
select is(pg_temp.engagement_role('e0000000-0000-4000-8000-000000000001', 'researcher@tplco.test'), 'project_administrator',
  'the person''s internal engagement role follows their practice role');
select throws_ok($$ update public.organization_members set role = 'researcher' where id = pg_temp.member('researcher@tplco.test') $$,
  '42501', null, 'but cannot give it back');
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.organization_members set role = 'researcher' where id = pg_temp.member('researcher@tplco.test') $$,
  'a Principal Architect gives it back');
select is(pg_temp.engagement_role('e0000000-0000-4000-8000-000000000001', 'researcher@tplco.test'), 'researcher',
  'and the engagement role follows again');

select pg_temp.act_as('sysadmin@tplco.test');
select lives_ok($$ update public.organization_members set status = 'suspended' where id = pg_temp.member('architect@tplco.test') $$,
  'a System Administrator suspends an Architect');
select throws_ok($$ update public.organization_members set status = 'active' where id = pg_temp.member('architect@tplco.test') $$,
  '42501', null, 'but cannot restore their authority');
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.organization_members set status = 'active' where id = pg_temp.member('architect@tplco.test') $$,
  'a Principal Architect restores them');

select pg_temp.act_as('sysadmin@tplco.test');
select lives_ok($$ select pg_temp.invite('person8@practice.test', 'architect', 'suspended') $$,
  'a suspended authority-bearing membership carries no authority');
select throws_ok($$ update public.organization_members set status = 'active' where id = pg_temp.member('person8@practice.test') $$,
  '42501', null, 'and a System Administrator cannot activate it');
select throws_ok($$ update public.organization_members set status = 'invited' where id = pg_temp.member('person8@practice.test') $$,
  '42501', null, 'or turn it into an invitation');

-- -----------------------------------------------------------------------------
-- A5: revoking; memberships are not moved or deleted once accepted
-- -----------------------------------------------------------------------------
select lives_ok($$ delete from public.organization_members where id = pg_temp.member('person7@practice.test') $$,
  'a practice administrator revokes a pending invitation');
select throws_ok($$ delete from public.organization_members where id = pg_temp.member('finance@tplco.test') $$,
  '23514', null, 'an accepted member is suspended, not deleted');
select throws_ok($$ update public.organization_members set user_id = pg_temp.uid('person9@practice.test') where id = pg_temp.member('person6@practice.test') $$,
  '23514', null, 'a membership cannot be moved to another person');

-- -----------------------------------------------------------------------------
-- D5: never on oneself
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ update public.organization_members set role = 'architect' where id = pg_temp.member('principal@tplco.test') $$,
  '42501', null, 'a Principal Architect cannot change their own role');
select throws_ok($$ update public.organization_members set status = 'suspended' where id = pg_temp.member('principal@tplco.test') $$,
  '42501', null, 'or their own status');
select throws_ok($$ delete from public.organization_members where id = pg_temp.member('principal@tplco.test') $$,
  '42501', null, 'or remove their own membership');
select throws_ok($$ update public.profiles set status = 'suspended' where id = pg_temp.uid('principal@tplco.test') $$,
  '42501', null, 'or their own profile status');
select throws_ok($$ update public.organization_members set status = 'active' where user_id = pg_temp.uid('principal@tplco.test') or id = pg_temp.member('person4@practice.test') $$,
  '42501', null, 'not even within a statement that also changes someone else');
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ update public.organization_members set role = 'principal_architect' where id = pg_temp.member('sysadmin@tplco.test') $$,
  '42501', null, 'a System Administrator cannot make themselves a Principal Architect');
select throws_ok($$ update public.organization_members set role = 'project_administrator' where id = pg_temp.member('sysadmin@tplco.test') $$,
  '42501', null, 'or change their own role at all');

select pg_temp.act_as('person1@practice.test');
select lives_ok($$ select public.accept_invitation() $$, 'an invited person still accepts their own invitation');
select is(pg_temp.practice_role('person1@practice.test'), 'architect'::public.app_role,
  'with the role a Principal Architect gave them');
select pg_temp.reset_actor();
select is((select status from public.organization_members where id = pg_temp.member('person1@practice.test')),
  'active'::public.record_status, 'and the membership is active');

-- -----------------------------------------------------------------------------
-- D5: the last Principal Architect and the last practice administrator
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ update public.organization_members set role = 'project_administrator' where id = pg_temp.member('principal@tplco.test') $$,
  '23514', 'At least one active Principal Architect must remain', 'the last active Principal Architect cannot be changed to another role');
select throws_ok($$ update public.organization_members set status = 'suspended' where id = pg_temp.member('principal@tplco.test') $$,
  '23514', 'At least one active Principal Architect must remain', 'or suspended');
select throws_ok($$ update public.profiles set status = 'suspended' where id = pg_temp.uid('principal@tplco.test') $$,
  '23514', 'At least one active Principal Architect must remain', 'or have their profile suspended');

-- With a second active Principal Architect, either may be suspended.
select pg_temp.act_as('person3@practice.test');
select public.accept_invitation();
select pg_temp.act_as('sysadmin@tplco.test');
select lives_ok($$ update public.organization_members set status = 'suspended' where id = pg_temp.member('person3@practice.test') $$,
  'a Principal Architect who is not the last may be suspended');
select throws_ok($$ update public.organization_members set status = 'suspended' where id = pg_temp.member('principal@tplco.test') $$,
  '23514', 'At least one active Principal Architect must remain', 'and then the remaining one may not');

-- Delegation and the administrator backstop.
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.set_practice_capability_override(pg_temp.member('projectadmin@tplco.test'),
  'administer_practice', true, 'Runs onboarding') $$, 'a practice administrator delegates administration');
select pg_temp.act_as('projectadmin@tplco.test');
select ok(pg_temp.administers(), 'the delegate now administers the practice');
select lives_ok($$ select pg_temp.invite('person9@practice.test', 'finance_administrator') $$,
  'and invites a Finance Administrator');
select throws_ok($$ select pg_temp.invite('person9@practice.test', 'architect') $$, '42501', null,
  'but, not being a Principal Architect, creates no architectural authority');
select throws_ok($$ select public.set_practice_capability_override(pg_temp.member('projectadmin@tplco.test'),
  'administer_practice', false, 'Done') $$, '42501', null, 'and cannot change their own administration');
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.set_practice_capability_override(pg_temp.member('researcher@tplco.test'),
  'administer_practice', true, 'Helping') $$, '42501', null,
  'someone who does not administer the practice cannot delegate it');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.set_practice_capability_override(pg_temp.member('principal@tplco.test'),
  'administer_practice', false, 'Stepping back') $$, '42501', null, 'a holder cannot revoke their own administration');
select lives_ok($$ select public.set_practice_capability_override(pg_temp.member('sysadmin@tplco.test'),
  'administer_practice', false, 'Operations only') $$, 'administration can be revoked from another holder');
select pg_temp.act_as('sysadmin@tplco.test');
select ok(not pg_temp.administers(), 'who then no longer administers the practice');
select throws_ok($$ select pg_temp.invite('person9@practice.test', 'project_administrator') $$, '42501', null,
  'and can no longer invite');
select pg_temp.reset_actor();
update public.practice_member_capability_overrides set granted = false where capability = 'administer_practice';
insert into public.practice_member_capability_overrides (organization_member_id, capability, granted, reason)
  values (pg_temp.member('principal@tplco.test'), 'administer_practice', false, 'Backstop check');
select throws_ok($$ select private.assert_practice_holders_remain(false, true, false) $$,
  '23514', 'At least one active practice administrator must remain',
  'the last-administrator backstop refuses a state with no administrator');
delete from public.practice_member_capability_overrides
  where organization_member_id = pg_temp.member('principal@tplco.test') and capability = 'administer_practice';
update public.practice_member_capability_overrides set granted = true
  where organization_member_id = pg_temp.member('projectadmin@tplco.test') and capability = 'administer_practice';

-- -----------------------------------------------------------------------------
-- D2, D5: profile status
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select is_empty($$ update public.profiles set status = 'suspended' where id = pg_temp.uid('lead@harbor.test') returning id $$,
  'someone who does not administer the practice cannot change another profile''s status');
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.profiles set status = 'suspended' where id = pg_temp.uid('architect@tplco.test') $$,
  'a practice administrator suspends a profile');
select pg_temp.act_as('projectadmin@tplco.test');
select throws_ok($$ update public.profiles set status = 'active' where id = pg_temp.uid('architect@tplco.test') $$,
  '42501', null, 'a delegated administrator cannot restore a profile that carries architectural authority');
select lives_ok($$ update public.profiles set status = 'suspended' where id = pg_temp.uid('lead@harbor.test') $$,
  'but administers other profiles');
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.profiles set status = 'active' where id = pg_temp.uid('architect@tplco.test') $$,
  'a Principal Architect restores it');

-- -----------------------------------------------------------------------------
-- A6: the practice organization
-- -----------------------------------------------------------------------------
select lives_ok($$ update public.organizations set name = 'The Purple Lamb Company LLC' where type = 'tplco' $$,
  'a practice administrator edits the practice organization');
select throws_ok($$ update public.organizations set status = 'archived' where type = 'tplco' $$,
  '23514', null, 'but cannot archive it from the app');
select throws_ok($$ update public.organizations set type = 'client' where type = 'tplco' $$,
  '23514', null, 'or change its type');
select pg_temp.act_as('researcher@tplco.test');
select is_empty($$ update public.organizations set name = 'Renamed' where type = 'tplco' returning id $$,
  'someone who does not administer the practice cannot edit it');

-- -----------------------------------------------------------------------------
-- D3: internal engagement roles are practice roles
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ insert into public.engagement_members (engagement_id, user_id, side, role)
  values ('e0000000-0000-4000-8000-000000000002', pg_temp.uid('researcher@tplco.test'), 'internal', 'principal_architect') $$,
  '23514', null, 'staffing cannot give a Researcher the Principal Architect role');
select throws_ok($$ insert into public.engagement_members (engagement_id, user_id, side, role)
  values ('e0000000-0000-4000-8000-000000000002', pg_temp.uid('researcher@tplco.test'), 'internal', 'project_administrator') $$,
  '23514', null, 'or any role other than their practice role');
select lives_ok($$ insert into public.engagement_members (engagement_id, user_id, side, role)
  values ('e0000000-0000-4000-8000-000000000002', pg_temp.uid('researcher@tplco.test'), 'internal', 'researcher') $$,
  'staffing with the practice role succeeds');
select throws_ok($$ update public.engagement_members set role = 'architect'
  where engagement_id = 'e0000000-0000-4000-8000-000000000002' and user_id = pg_temp.uid('researcher@tplco.test') $$,
  '23514', null, 'an internal engagement role cannot be edited away from the practice role');

select pg_temp.act_as('projectadmin@tplco.test');
select throws_ok($$ update public.engagement_members set role = 'principal_architect'
  where engagement_id = 'e0000000-0000-4000-8000-000000000002' and user_id = pg_temp.uid('projectadmin@tplco.test') $$,
  '23514', null, 'an engagement Project Administrator cannot raise their own engagement role');
select throws_ok($$ insert into public.engagement_members (engagement_id, user_id, side, role)
  values ('e0000000-0000-4000-8000-000000000002', pg_temp.uid('architect@tplco.test'), 'internal', 'principal_architect') $$,
  '23514', null, 'or staff someone above their practice role');
select lives_ok($$ insert into public.engagement_members (engagement_id, user_id, side, role)
  values ('e0000000-0000-4000-8000-000000000002', pg_temp.uid('architect@tplco.test'), 'internal', 'architect') $$,
  'but staffs them in their practice role');

select pg_temp.act_as('principal@tplco.test');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted, reason)
select id, 'publish_architecture', true, 'Covering the publication rota'
from public.engagement_members
where engagement_id = 'e0000000-0000-4000-8000-000000000002' and user_id = pg_temp.uid('researcher@tplco.test');
select lives_ok($$ update public.organization_members set role = 'architect' where id = pg_temp.member('researcher@tplco.test') $$,
  'a Principal Architect changes a Researcher into an Architect');
select is(
  array(select role from public.engagement_members where user_id = pg_temp.uid('researcher@tplco.test') and side = 'internal'),
  array['architect', 'architect']::public.app_role[],
  'every internal engagement row follows, with no remove-and-re-add');
select is((select count(*)::int from public.engagement_member_capability_overrides o
           join public.engagement_members em on em.id = o.engagement_member_id
           where em.user_id = pg_temp.uid('researcher@tplco.test')
             and em.engagement_id = 'e0000000-0000-4000-8000-000000000002'
             and o.capability = 'publish_architecture' and o.granted), 1,
  'and the engagement capability override is kept');
select pg_temp.reset_actor();
select ok(not exists (
    select 1 from public.engagement_members em
    where em.side = 'internal'
      and em.role <> (select m.role from public.organization_members m
                      join public.organizations o on o.id = m.organization_id and o.type = 'tplco'
                      where m.user_id = em.user_id)
  ), 'no internal engagement member holds a role other than their practice role');

select * from finish();
rollback;
