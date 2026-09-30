-- =============================================================================
-- Phase 4 concurrency (pgTAP). Run with: pnpm db:test. Runs last.
--
-- Two real database sessions (dblink):
--   1. send client requests at the same moment: ACT codes come from the
--      locked reference counter, so they are distinct and sequential;
--   2. withdraw a request while the client responds to it: the request row
--      is locked, so the response waits and then sees the withdrawal;
--   3. resolve the same record twice: the element lock serializes them, and
--      the second finds it already resolved.
--
-- The racing sessions COMMIT on Meridian (e...01), so this file removes
-- exactly what they wrote and restores what they changed at the end (with
-- triggers disabled for the cleanup only).
-- =============================================================================
-- When the committed sessions start, to find what they wrote afterwards. A
-- session temp table, created outside the test transaction so it survives.
create temporary table started as select clock_timestamp() as at;

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

create function pg_temp.send_sql(p_title text)
returns text
language sql
as $$
  select format($f$
    select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question', %L, 'Concurrency test.',
      (select id from public.engagement_members where engagement_id = 'e0000000-0000-4000-8000-000000000001'
         and user_id = '20000000-0000-4000-8000-000000000002'))
  $f$, p_title);
$$;

select pg_temp.connect('a', 'architect@tplco.test');
select pg_temp.connect('b', 'principal@tplco.test');

-- -----------------------------------------------------------------------------
-- 1. Two requests sent at the same moment
-- -----------------------------------------------------------------------------
select extensions.dblink_exec('a', 'begin');
select is((select r.id is not null from extensions.dblink('a', pg_temp.send_sql('Concurrent request A')) as r(id uuid)),
  true, 'Session A sends a request (not yet committed)');
select ok(pg_temp.start_and_check_blocked('b', pg_temp.send_sql('Concurrent request B')),
  'Session B, sending another, waits for session A''s reference code');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, 'Session B then succeeds');
select is(
  (select array_agg(reference_code order by title) from public.client_actions
   where title in ('Concurrent request A', 'Concurrent request B')),
  array['ACT-007', 'ACT-008'], 'the two requests get distinct, sequential codes');

-- -----------------------------------------------------------------------------
-- 2. A request withdrawn while the client responds
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('b');
select pg_temp.connect('b', 'lead@meridian.test');
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', $$
  select public.withdraw_client_action(
    (select id from public.client_actions
     where engagement_id = 'e0000000-0000-4000-8000-000000000001' and reference_code = 'ACT-002'),
    'Answered in the board session.')::text $$) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', $$
  select public.respond_to_client_action(
    (select id from public.client_actions
     where engagement_id = 'e0000000-0000-4000-8000-000000000001' and reference_code = 'ACT-002'),
    'The Executive Director signs.') $$),
  'the Client Project Lead''s response waits for the withdrawal');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'This request is withdrawn', 'and is then refused');
select is((select count(*)::int from public.client_action_responses r join public.client_actions a on a.id = r.action_id
           where a.engagement_id = 'e0000000-0000-4000-8000-000000000001' and a.reference_code = 'ACT-002'), 0,
  'no response is stored on the withdrawn request');

-- -----------------------------------------------------------------------------
-- 3. The same record resolved twice at once
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('b');
select pg_temp.connect('b', 'principal@tplco.test');
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', $$
  select public.resolve_intelligence_record('b3000000-0000-4000-8000-000000000502', 'closed', 'Deputies named.')::text $$)
  as r(v text);
select ok(pg_temp.start_and_check_blocked('b', $$
  select public.resolve_intelligence_record('b3000000-0000-4000-8000-000000000502', 'accepted', 'We accept it.') $$),
  'a second resolution of the same risk waits');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'The record is already closed; reopen it first', 'and is then refused');
select is((select count(*)::int from public.intelligence_status_changes
           where element_id = 'b3000000-0000-4000-8000-000000000502' and field = 'risk_status'
             and changed_at >= (select at from started)), 1,
  'the history holds one resolution');

select * from finish();

-- -----------------------------------------------------------------------------
-- Cleanup of committed test data
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
rollback;

begin;
set local session_replication_role = replica;
delete from public.client_action_events e using public.client_actions a
where a.id = e.action_id and a.engagement_id = 'e0000000-0000-4000-8000-000000000001'
  and (a.title like 'Concurrent request %' or (a.reference_code = 'ACT-002' and e.event = 'withdrawn'));
delete from public.client_actions
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and title like 'Concurrent request %';
update public.client_actions
set status = 'open', closed_by = null, closed_at = null, close_note = null
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and reference_code = 'ACT-002';
update public.architecture_reference_counters set last_value = 6
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and prefix = 'ACT';
update public.risks set risk_status = 'open' where element_id = 'b3000000-0000-4000-8000-000000000502';
delete from public.intelligence_status_changes
where element_id = 'b3000000-0000-4000-8000-000000000502' and changed_at >= (select at from started);
delete from public.activity_log
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and created_at >= (select at from started);
commit;
drop table started;
