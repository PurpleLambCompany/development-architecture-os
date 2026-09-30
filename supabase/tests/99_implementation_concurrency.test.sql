-- =============================================================================
-- Phase 5 implementation concurrency (pgTAP). Run with: pnpm db:test. Runs last.
--
-- Two real database sessions (dblink):
--   1. create two initiatives at the same moment: IMP codes come from the
--      locked reference counter, so they are distinct and sequential;
--   2. resolve the same initiative twice at once (abandoned): the element
--      lock serializes them, and the second finds it already resolved;
--   3. record the same review's validation of the same initiative twice at
--      once: both element locks (review and initiative) serialize them, and
--      the second finds the validates relationship already recorded.
--
-- The racing sessions COMMIT on Meridian (e...01), so this file removes
-- exactly what they wrote at the end (with triggers disabled for the
-- cleanup only).
-- =============================================================================
-- When the committed sessions start, to find what they wrote afterwards. A
-- session temp table, created outside the test transaction so it survives.
create temporary table started as select clock_timestamp() as at;

-- -----------------------------------------------------------------------------
-- Committed setup: one held review examining a core object, and one
-- initiative implementing it, so the record_review_validation race (3) has
-- something to validate. Committed (not inside the test transaction) so the
-- dblink sessions, which are separate connections, can see and lock it.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'architect@tplco.test'), 'role', 'authenticated')::text,
  true);
set local role authenticated;
select public.create_review('e0000000-0000-4000-8000-000000000001', 'architecture_review',
  'Concurrency test review') as review_id \gset
insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
values ('e0000000-0000-4000-8000-000000000001', :'review_id', 'b3000000-0000-4000-8000-000000000201', 'examines', 'architect_judgment');
select public.hold_review(:'review_id') as held;
select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Concurrency test initiative', array['b3000000-0000-4000-8000-000000000201'::uuid]) as init_id \gset
select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Concurrency test initiative 2', array['b3000000-0000-4000-8000-000000000202'::uuid]) as init2_id \gset
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

select pg_temp.connect('a', 'architect@tplco.test');
select pg_temp.connect('b', 'principal@tplco.test');

-- -----------------------------------------------------------------------------
-- 1. Two initiatives created at the same moment
-- -----------------------------------------------------------------------------
select extensions.dblink_exec('a', 'begin');
select is((select r.id is not null from extensions.dblink('a', $sql$
    select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
      'Concurrent initiative A', array['b3000000-0000-4000-8000-000000000201'::uuid])
  $sql$) as r(id uuid)), true, 'Session A creates an initiative (not yet committed)');
select ok(pg_temp.start_and_check_blocked('b', $sql$
    select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
      'Concurrent initiative B', array['b3000000-0000-4000-8000-000000000202'::uuid])
  $sql$), 'Session B, creating another, waits for session A''s reference code');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, 'Session B then succeeds');
select is(
  (select array_agg(reference_code order by title) from public.architecture_elements
   where title in ('Concurrent initiative A', 'Concurrent initiative B')),
  array['IMP-003', 'IMP-004'], 'the two initiatives get distinct, sequential codes');

-- -----------------------------------------------------------------------------
-- 2. The same initiative resolved twice at once
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('b');
select pg_temp.connect('b', 'architect@tplco.test');
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', format($sql$
  select public.resolve_implementation_initiative(%L::uuid, 'abandoned', 'Vendor withdrew.')::text $sql$,
  :'init2_id')) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', format($sql$
  select public.resolve_implementation_initiative(%L::uuid, 'abandoned', 'Duplicate resolution attempt.') $sql$,
  :'init2_id')),
  'a second resolution of the same initiative waits');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'The initiative is already resolved; reopen it first', 'and is then refused');
select is((select implementation_status::text from public.implementation_initiatives
           where element_id = :'init2_id'), 'abandoned', 'it is abandoned exactly once');

-- -----------------------------------------------------------------------------
-- 3. The same review validation recorded twice at once
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('b');
select pg_temp.connect('b', 'architect@tplco.test');
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', format($sql$
  select public.record_review_validation(%L::uuid, %L::uuid)::text $sql$, :'review_id', :'init_id')) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', format($sql$
  select public.record_review_validation(%L::uuid, %L::uuid) $sql$, :'review_id', :'init_id')),
  'a second, concurrent validation of the same review and initiative waits');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'This review has already validated this initiative', 'and is then refused');

select * from finish();

-- -----------------------------------------------------------------------------
-- Cleanup of committed test data
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
rollback;

begin;
set local session_replication_role = replica;
delete from public.review_examined_versions where captured_at >= (select at from started);
delete from public.architecture_relationships
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and created_at >= (select at from started);
delete from public.implementation_status_changes
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and changed_at >= (select at from started);
delete from public.implementation_stewardship
where element_id in (
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000001'
    and (title like 'Concurrent initiative %' or title = 'Concurrency test initiative'
         or title = 'Concurrency test initiative 2')
);
delete from public.implementation_initiatives
where element_id in (
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000001'
    and (title like 'Concurrent initiative %' or title = 'Concurrency test initiative'
         or title = 'Concurrency test initiative 2')
);
delete from public.reviews
where element_id in (
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' and title = 'Concurrency test review'
);
delete from public.architecture_elements
where engagement_id = 'e0000000-0000-4000-8000-000000000001'
  and (title like 'Concurrent initiative %' or title = 'Concurrency test initiative'
       or title = 'Concurrency test initiative 2' or title = 'Concurrency test review');
delete from public.architecture_reference_counters
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and prefix in ('IMP', 'REV');
delete from public.activity_log
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and created_at >= (select at from started);
commit;
drop table started;
