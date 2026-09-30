-- =============================================================================
-- Phase 3 concurrency (pgTAP). Run with: pnpm db:test. Runs last.
--
-- Two real database sessions (dblink) create elements, publish the same
-- element and build a structural cycle at the same moment. Reference codes
-- come from a locked counter, publication locks the element, and acyclic
-- relationship inserts serialize on the engagement's relationship lock.
--
-- The racing sessions COMMIT, on the seeded Workforce Capability Program
-- (e...02, no seeded architecture), so this file removes what they wrote at
-- the end (with triggers disabled for the cleanup only).
-- =============================================================================
begin;

create extension if not exists dblink with schema extensions;

select plan(10);

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

-- Creates a knowledge area in one statement (element and object together).
create function pg_temp.create_area_sql(p_id uuid, p_title text)
returns text
language sql
as $$
  select format($f$
    with e as (
      insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
      values (%L, 'e0000000-0000-4000-8000-000000000002', 'object', %L, 'architect_judgment')
      returning id
    )
    insert into public.architecture_objects (element_id, object_type) select id, 'knowledge_area' from e
  $f$, p_id, p_title);
$$;

select pg_temp.connect('a', 'principal@tplco.test');
select pg_temp.connect('b', 'principal@tplco.test');

-- -----------------------------------------------------------------------------
-- 1. Two people create elements at the same moment
-- -----------------------------------------------------------------------------
select extensions.dblink_exec('a', 'begin');
select extensions.dblink_exec('a', pg_temp.create_area_sql('b9000000-0000-4000-8000-000000000001', 'Concurrent area A'));
select ok(
  pg_temp.start_and_check_blocked('b', pg_temp.create_area_sql('b9000000-0000-4000-8000-000000000002', 'Concurrent area B')),
  'Session B, creating a knowledge area, waits for session A''s reference code');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, 'Session B then succeeds');
select is(
  (select array_agg(reference_code order by title) from public.architecture_elements
   where id in ('b9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000002')),
  array['KNW-001', 'KNW-002'], 'the two elements get distinct, sequential codes');

-- -----------------------------------------------------------------------------
-- 2. Two publishers publish the same element at once
-- -----------------------------------------------------------------------------
select extensions.dblink_exec('a', 'begin');
select is(
  (select r.id is not null from extensions.dblink('a', $$
     select public.publish_element_version('b9000000-0000-4000-8000-000000000001', 'From A') $$) as r(id uuid)),
  true, 'Session A publishes (not yet committed)');
select ok(
  pg_temp.start_and_check_blocked('b', $$
    select public.publish_element_version('b9000000-0000-4000-8000-000000000001', 'From B') $$),
  'Session B, publishing the same element, waits for session A');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, 'Session B then publishes');
select is(
  (select string_agg(version_no || ':' || change_summary, ',' order by version_no) from public.element_versions
   where element_id = 'b9000000-0000-4000-8000-000000000001'),
  '1:From A,2:From B', 'the versions are numbered 1 and 2, in commit order');

-- -----------------------------------------------------------------------------
-- 3. Two people close a part_of cycle from both ends at once
-- -----------------------------------------------------------------------------
select extensions.dblink_exec('a', 'begin');
select extensions.dblink_exec('a', $$
  insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000002', 'b9000000-0000-4000-8000-000000000001',
          'b9000000-0000-4000-8000-000000000002', 'part_of', 'architect_judgment') $$);
select ok(
  pg_temp.start_and_check_blocked('b', $$
    insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
    values ('e0000000-0000-4000-8000-000000000002', 'b9000000-0000-4000-8000-000000000002',
            'b9000000-0000-4000-8000-000000000001', 'part_of', 'architect_judgment') $$),
  'Session B, adding the reverse part_of, waits on the engagement''s relationship lock');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), '"is part of" relationships cannot form a cycle',
  'after A commits, B sees A''s link and is refused');
select is(
  (select count(*)::int from public.architecture_relationships where engagement_id = 'e0000000-0000-4000-8000-000000000002'),
  1, 'only one direction exists');

select * from finish();

-- -----------------------------------------------------------------------------
-- Cleanup of committed test data
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
rollback;

begin;
set local session_replication_role = replica;
delete from public.activity_log where engagement_id = 'e0000000-0000-4000-8000-000000000002'
  and entity_type in ('architecture_elements', 'architecture_objects', 'architecture_relationships', 'element_versions');
delete from public.architecture_relationships where engagement_id = 'e0000000-0000-4000-8000-000000000002';
delete from public.element_versions where engagement_id = 'e0000000-0000-4000-8000-000000000002';
delete from public.architecture_objects where engagement_id = 'e0000000-0000-4000-8000-000000000002';
delete from public.architecture_elements where engagement_id = 'e0000000-0000-4000-8000-000000000002';
delete from public.architecture_reference_counters where engagement_id = 'e0000000-0000-4000-8000-000000000002';
commit;
