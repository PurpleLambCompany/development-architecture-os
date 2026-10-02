-- =============================================================================
-- V1-A Workstream A concurrency (pgTAP). Run with: pnpm db:test. Runs last.
--
-- Two real database sessions (dblink):
--   1. two practice administrators revoke each other's administer_practice
--      at once: the practice lock serializes them, the second no longer
--      holds the capability, and one administrator remains (D5);
--   2. two sessions suspend the only two active Principal Architects at
--      once: the second waits, then is refused, so one remains (D5);
--   3. a Principal Architect is demoted while they promote someone: the
--      promotion waits, then is refused because its author is no longer a
--      Principal Architect (D2).
--
-- The racing sessions COMMIT, so this file restores the seed's practice
-- memberships, profiles, overrides and engagement roles at the end.
-- =============================================================================
create temporary table started as select clock_timestamp() as at;
create temporary table saved_members as
  select m.* from public.organization_members m
  join public.organizations o on o.id = m.organization_id and o.type = 'tplco';
create temporary table saved_profiles as select id, status from public.profiles;

-- Committed setup: the Architect becomes a second Principal Architect.
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', '10000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
update public.organization_members set role = 'principal_architect'
where user_id = '10000000-0000-4000-8000-000000000003';
commit;

begin;

create extension if not exists dblink with schema extensions;

select plan(9);

create function pg_temp.connect(name text, user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = user_email;
  perform extensions.dblink_connect(name, format(
    'dbname=%s host=%s port=%s user=postgres password=postgres',
    current_database(), host(inet_server_addr()), inet_server_port()));
  perform extensions.dblink_exec(name, format(
    'set request.jwt.claims to %L',
    json_build_object('sub', uid, 'role', 'authenticated')::text));
  perform extensions.dblink_exec(name, 'set role authenticated');
end;
$$;

create function pg_temp.start_and_check_blocked(name text, sql text)
returns boolean
language plpgsql
as $$
begin
  perform extensions.dblink_send_query(name, sql);
  perform pg_sleep(0.5);
  return extensions.dblink_is_busy(name) = 1;
end;
$$;

create function pg_temp.finish_query(name text)
returns text
language plpgsql
as $$
declare
  msg text;
begin
  begin
    perform * from extensions.dblink_get_result(name) as r(result text);
  exception when others then
    msg := sqlerrm;
  end;
  begin
    perform * from extensions.dblink_get_result(name, false) as r(result text);
  exception when others then
    null;
  end;
  return msg;
end;
$$;

create function pg_temp.member(user_id uuid)
returns uuid
language sql
as $$
  select m.id from public.organization_members m
  join public.organizations o on o.id = m.organization_id and o.type = 'tplco'
  where m.user_id = member.user_id;
$$;

-- -----------------------------------------------------------------------------
-- 1. Two administrators revoke each other's administer_practice at once.
--    Administrators now: System Administrator, and both Principal
--    Architects. The Architect-turned-Principal steps aside first, through
--    the System Administrator, so exactly two remain.
-- -----------------------------------------------------------------------------
select pg_temp.connect('a', 'sysadmin@tplco.test');
select * from extensions.dblink('a', format($sql$
  select public.set_practice_capability_override(%L::uuid, 'administer_practice', false, 'Setup')::text $sql$,
  pg_temp.member('10000000-0000-4000-8000-000000000003'))) as r(v text);
select pg_temp.connect('b', 'principal@tplco.test');

select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', format($sql$
  select public.set_practice_capability_override(%L::uuid, 'administer_practice', false, 'Race')::text $sql$,
  pg_temp.member('10000000-0000-4000-8000-000000000002'))) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', format($sql$
  select public.set_practice_capability_override(%L::uuid, 'administer_practice', false, 'Race') $sql$,
  pg_temp.member('10000000-0000-4000-8000-000000000001'))),
  'a revocation of administration waits for the other administrator''s revocation in progress');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'You do not hold administer_practice',
  'and is then refused, because its author no longer administers the practice');
select is(private.practice_capability_holder_count('administer_practice'), 1,
  'exactly one practice administrator remains');

-- -----------------------------------------------------------------------------
-- 2. The two active Principal Architects suspended at once by the remaining
--    administrator (the System Administrator), from two sessions.
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('b');
select pg_temp.connect('b', 'sysadmin@tplco.test');
select extensions.dblink_exec('a', 'begin');
select extensions.dblink_exec('a', format(
  $sql$ update public.organization_members set status = 'suspended' where id = %L $sql$,
  pg_temp.member('10000000-0000-4000-8000-000000000002')));
select ok(pg_temp.start_and_check_blocked('b', format(
  $sql$ update public.organization_members set status = 'suspended' where id = %L $sql$,
  pg_temp.member('10000000-0000-4000-8000-000000000003'))),
  'suspending the other Principal Architect waits for the suspension in progress');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'At least one active Principal Architect must remain',
  'and is then refused');
select is(private.active_principal_architect_count(), 1, 'exactly one active Principal Architect remains');

-- -----------------------------------------------------------------------------
-- 3. A Principal Architect promotes someone while being demoted. Restore
--    the first Principal Architect and their administration (as the
--    trusted operator) so there are two again.
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
select extensions.dblink_connect('setup', format(
  'dbname=%s host=%s port=%s user=postgres password=postgres',
  current_database(), host(inet_server_addr()), inet_server_port()));
select extensions.dblink_exec('setup', format(
  $sql$ update public.organization_members set status = 'active' where id = %L $sql$,
  pg_temp.member('10000000-0000-4000-8000-000000000002')));
select extensions.dblink_exec('setup', $sql$ delete from public.practice_member_capability_overrides
  where capability = 'administer_practice' $sql$);
select extensions.dblink_disconnect('setup');

select pg_temp.connect('a', 'principal@tplco.test');
select pg_temp.connect('b', 'architect@tplco.test');
select extensions.dblink_exec('a', 'begin');
select extensions.dblink_exec('a', format(
  $sql$ update public.organization_members set role = 'project_administrator' where id = %L $sql$,
  pg_temp.member('10000000-0000-4000-8000-000000000003')));
select ok(pg_temp.start_and_check_blocked('b', format(
  $sql$ update public.organization_members set role = 'architect' where id = %L $sql$,
  pg_temp.member('10000000-0000-4000-8000-000000000005'))),
  'a promotion waits while its author is being demoted');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'Only a practice administrator manages TPLCo staff',
  'and is then refused, because its author no longer holds the authority to make it');
select is((select role::text from public.organization_members where id = pg_temp.member('10000000-0000-4000-8000-000000000005')),
  'project_administrator', 'the Project Administrator was not promoted');

select * from finish();

select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
rollback;

-- -----------------------------------------------------------------------------
-- Cleanup of committed test data (as the trusted operator, so the guards
-- stand aside; role propagation restores the engagement roles too).
-- -----------------------------------------------------------------------------
begin;
update public.organization_members m set role = s.role, status = s.status
from saved_members s where s.id = m.id;
update public.profiles p set status = s.status from saved_profiles s where s.id = p.id;
delete from public.practice_member_capability_overrides where created_at >= (select at from started);
delete from public.activity_log where created_at >= (select at from started);
commit;
drop table started;
drop table saved_members;
drop table saved_profiles;
