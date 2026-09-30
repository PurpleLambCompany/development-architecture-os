-- =============================================================================
-- Phase 7A concurrency (pgTAP). Run with: pnpm db:test. Runs last.
--
-- Two real database sessions (dblink):
--   1. a publication and a hold race on an examined element: the hold waits
--      for the publication's element lock, then captures the new version;
--   2. an examines insert races a hold of the same Review: the insert waits,
--      then is refused because the examined set has closed (OD-7);
--   3. two judgments of the same item at once: the engagement's judgment lock
--      serializes them, and both are recorded, in order.
--
-- The racing sessions COMMIT on Harbor (e...03), so this file removes exactly
-- what it wrote at the end (with triggers disabled for the cleanup only) and
-- restores Harbor's reference counters.
-- =============================================================================
create temporary table started as select clock_timestamp() as at;
create temporary table counters as
  select * from public.architecture_reference_counters where engagement_id = 'e0000000-0000-4000-8000-000000000003';

-- Committed setup: one published element and two scheduled Reviews that
-- examine it.
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'architect@tplco.test'), 'role', 'authenticated')::text,
  true);
insert into public.architecture_elements (id, engagement_id, kind, title, summary, provenance, client_visibility, owner_user_id)
values ('f7990000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'object', 'Concurrency fixture',
        'Version one.', 'architect_judgment', 'internal', '10000000-0000-4000-8000-000000000003');
insert into public.architecture_objects (element_id, domain, object_type)
values ('f7990000-0000-4000-8000-000000000001', 'knowledge', 'knowledge_area');
set local role authenticated;
select public.publish_element_version('f7990000-0000-4000-8000-000000000001', 'First published version');
select public.create_review('e0000000-0000-4000-8000-000000000003', 'architecture_review', 'Concurrency review one',
  now() + interval '3 days') as r1 \gset
select public.create_review('e0000000-0000-4000-8000-000000000003', 'architecture_review', 'Concurrency review two',
  now() + interval '3 days') as r2 \gset
insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
values ('e0000000-0000-4000-8000-000000000003', :'r1', 'f7990000-0000-4000-8000-000000000001', 'examines', 'architect_judgment'),
       ('e0000000-0000-4000-8000-000000000003', :'r2', 'f7990000-0000-4000-8000-000000000001', 'examines', 'architect_judgment');
commit;

begin;

create extension if not exists dblink with schema extensions;

select plan(8);

create function pg_temp.connect(name text, user_email text) returns void language plpgsql as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = user_email;
  perform extensions.dblink_connect(name, format(
    'dbname=%s host=%s port=%s user=postgres password=postgres',
    current_database(), host(inet_server_addr()), inet_server_port()));
  perform extensions.dblink_exec(name, format('set request.jwt.claims to %L',
    json_build_object('sub', uid, 'role', 'authenticated')::text));
  perform extensions.dblink_exec(name, 'set role authenticated');
end;
$$;
create function pg_temp.start_and_check_blocked(name text, sql text) returns boolean language plpgsql as $$
begin
  perform extensions.dblink_send_query(name, sql);
  perform pg_sleep(0.5);
  return extensions.dblink_is_busy(name) = 1;
end;
$$;
create function pg_temp.finish_query(name text) returns text language plpgsql as $$
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

-- 1. Publication and hold.
select extensions.dblink_exec('a', 'begin');
select extensions.dblink_exec('a', $sql$
  update public.architecture_elements set summary = 'Version two.' where id = 'f7990000-0000-4000-8000-000000000001' $sql$);
select * from extensions.dblink('a', $sql$
  select public.publish_element_version('f7990000-0000-4000-8000-000000000001', 'Second')::text $sql$) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', format($sql$ select public.hold_review(%L::uuid) $sql$, :'r1')),
  'holding a Review waits for a publication of an element it examines');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, 'and then succeeds');
select is((select v.version_no from public.review_examined_versions c join public.element_versions v on v.id = c.element_version_id
           where c.review_element_id = :'r1'), 2, 'capturing the version that was published first');

-- 2. An examines insert and a hold of the same Review.
select extensions.dblink_disconnect('a');
select pg_temp.connect('a', 'principal@tplco.test');
select extensions.dblink_disconnect('b');
select pg_temp.connect('b', 'architect@tplco.test');
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', format($sql$ select public.hold_review(%L::uuid)::text $sql$, :'r2')) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', format($sql$
  insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000003', %L, 'b3000000-0000-4000-8000-000000000a02', 'examines', 'architect_judgment') $sql$,
  :'r2')), 'adding to a Review''s agenda waits for a hold in progress');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'),
  'The examined set closed when this Review was held. Use a later Review for further examination.',
  'and is then refused: the examined set closed');

-- 3. Two judgments of the same item.
select extensions.dblink_disconnect('a');
select pg_temp.connect('a', 'architect@tplco.test');
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', $sql$
  select public.record_edge_judgment('e0000000-0000-4000-8000-000000000003', i.rule_key, i.subject_type, i.subject_id,
                                     i.fingerprint, 'investigating', 'First look.')::text
  from public.edge_items('e0000000-0000-4000-8000-000000000003') i
  where i.rule_key = 'realization_without_evidence' and i.subject_reference_code = 'IMP-002' $sql$) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', $sql$
  select public.record_edge_judgment('e0000000-0000-4000-8000-000000000003', i.rule_key, i.subject_type, i.subject_id,
                                     i.fingerprint, 'not_material', 'The study is the evidence.')
  from public.edge_items('e0000000-0000-4000-8000-000000000003', null, null, null, true) i
  where i.rule_key = 'realization_without_evidence' and i.subject_reference_code = 'IMP-002' $sql$),
  'a second judgment of the same item waits');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, 'and is then recorded');
select is((select string_agg(judgment_kind, ',' order by judged_at) from public.edge_judgments
           where judged_at >= (select at from started)), 'investigating,not_material', 'both, in order');

select * from finish();

select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
rollback;

-- Cleanup of committed test data.
begin;
set local session_replication_role = replica;
delete from public.edge_judgments where judged_at >= (select at from started);
delete from public.review_examined_versions where captured_at >= (select at from started);
delete from public.architecture_relationships
where engagement_id = 'e0000000-0000-4000-8000-000000000003' and created_at >= (select at from started);
delete from public.reviews where element_id in (
  select id from public.architecture_elements where title in ('Concurrency review one', 'Concurrency review two'));
update public.architecture_elements set latest_version_id = null
where id = 'f7990000-0000-4000-8000-000000000001'
   or title in ('Concurrency review one', 'Concurrency review two');
delete from public.element_versions where published_at >= (select at from started);
delete from public.architecture_objects where element_id = 'f7990000-0000-4000-8000-000000000001';
delete from public.architecture_elements
where id = 'f7990000-0000-4000-8000-000000000001' or title in ('Concurrency review one', 'Concurrency review two');
delete from public.architecture_reference_counters where engagement_id = 'e0000000-0000-4000-8000-000000000003';
insert into public.architecture_reference_counters select * from counters;
delete from public.activity_log
where engagement_id = 'e0000000-0000-4000-8000-000000000003' and created_at >= (select at from started);
commit;
drop table started;
drop table counters;
