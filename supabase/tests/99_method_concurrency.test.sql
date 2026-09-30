-- =============================================================================
-- Phase 6 Method Library concurrency (pgTAP). Run with: pnpm db:test. Runs last.
--
-- Two real database sessions (dblink):
--   1. publish the same draft version twice at once: the asset lock
--      serializes them, and the second finds nothing left to publish;
--   2. publish a DAM release while a member is being changed: the release
--      lock serializes them, and the edit finds the release frozen;
--   3. start two Method Applications at the same moment: MUS codes come from
--      the locked reference counter, so they are distinct and sequential;
--   4. agree a criterion while another session supersedes it: the criterion
--      lock serializes them, so the supersession sees the agreement; then
--      supersede the same criterion twice at once: the second is refused.
--
-- The racing sessions COMMIT, so this file removes exactly what they wrote at
-- the end (with triggers disabled for the cleanup only) and restores
-- DAM 1.0 as the published release.
-- =============================================================================
create temporary table started as select clock_timestamp() as at;

-- -----------------------------------------------------------------------------
-- Committed setup: a published Model and Method, a second Model's draft, a
-- draft DAM 1.1, and two criteria on a published Meridian object.
-- -----------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'architect@tplco.test'), 'role', 'authenticated')::text,
  true);
set local role authenticated;
select public.create_method_asset('conc-model-a', 'Concurrency Model A', 'model', 'strategic_models') as model_a \gset
select public.create_method_asset('conc-model-b', 'Concurrency Model B', 'model', 'strategic_models') as model_b \gset
select public.create_method_asset('conc-method', 'Concurrency Method', 'method', 'diagnostic_frameworks') as method \gset
select id as model_a_v from public.method_asset_versions where asset_id = :'model_a' \gset
select id as model_b_v from public.method_asset_versions where asset_id = :'model_b' \gset
select id as method_v from public.method_asset_versions where asset_id = :'method' \gset
select public.update_method_asset_version(v, '{"architectural_question": "Q", "applicability": "A", "change_summary": "First"}')
from unnest(array[:'model_a_v', :'model_b_v']::uuid[]) v;
select public.set_method_version_outputs(v, '[{"output_kind": "object", "object_type_key": "capability_gap"}]')
from unnest(array[:'model_a_v', :'model_b_v', :'method_v']::uuid[]) v;
select public.update_method_asset_version(:'method_v', '{"architectural_question": "Q", "applicability": "A",
  "change_summary": "First", "modes": ["assess"], "completion_criteria": "Done"}');
select public.set_method_version_stages(:'method_v', '[{"key": "one", "title": "One"}]');
select public.propose_acceptance_criterion('b3000000-0000-4000-8000-000000000205', 'Concurrency criterion one') as crit_1 \gset
select public.propose_acceptance_criterion('b3000000-0000-4000-8000-000000000205', 'Concurrency criterion two') as crit_2 \gset
select set_config('request.jwt.claims',
  json_build_object('sub', '10000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);  -- Principal Architect
select public.publish_method_asset_version(:'model_a_v', '1.0');
select public.publish_method_asset_version(:'method_v', '1.0');
select public.create_dam_release('1.1', 'Concurrency release', 'Concurrency test') as release_id \gset
select public.set_dam_release_member(:'release_id', :'model_a_v');
select public.agree_acceptance_criterion(:'crit_2', 'Executive Sponsor', current_date);
commit;

begin;

create extension if not exists dblink with schema extensions;

select plan(14);

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

select pg_temp.connect('a', 'principal@tplco.test');
select pg_temp.connect('b', 'principal@tplco.test');

-- -----------------------------------------------------------------------------
-- 1. The same draft published twice at once
-- -----------------------------------------------------------------------------
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', format($sql$
  select public.publish_method_asset_version(%L::uuid, '1.0')::text $sql$, :'model_b_v')) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', format($sql$
  select public.publish_method_asset_version(%L::uuid, '1.1') $sql$, :'model_b_v')),
  'a second publication of the same draft waits');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'Only a draft version can be published', 'and is then refused');
select is((select string_agg(version_label || ':' || lifecycle, ',') from public.method_asset_versions where asset_id = :'model_b'),
  '1.0:published', 'the asset has exactly one published version');

-- -----------------------------------------------------------------------------
-- 2. A release published while a member is being changed
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('b');
select pg_temp.connect('b', 'principal@tplco.test');
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', format($sql$
  select public.publish_dam_release(%L::uuid, 'Adds Concurrency Model A')::text $sql$, :'release_id')) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', format($sql$
  select public.set_dam_release_member(%L::uuid, %L::uuid) $sql$, :'release_id', :'model_b_v')),
  'a member change waits for the release being published');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'A published DAM release is frozen', 'and is then refused');
select is((select count(*)::int from public.dam_release_members where release_id = :'release_id'), 1,
  'the published release has exactly the members it was published with');

-- -----------------------------------------------------------------------------
-- 3. Two Method Applications started at the same moment
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
select pg_temp.connect('a', 'architect@tplco.test');
select pg_temp.connect('b', 'architect@tplco.test');
select extensions.dblink_exec('a', 'begin');
select is((select r.id is not null from extensions.dblink('a', format($sql$
    select public.start_method_application('e0000000-0000-4000-8000-000000000001', %L::uuid,
      'Concurrent application A', 'Race', '', 'Concurrency test')
  $sql$, :'method_v')) as r(id uuid)), true, 'Session A starts an application (not yet committed)');
select ok(pg_temp.start_and_check_blocked('b', format($sql$
    select public.start_method_application('e0000000-0000-4000-8000-000000000001', %L::uuid,
      'Concurrent application B', 'Race', '', 'Concurrency test')
  $sql$, :'method_v')), 'Session B, starting another, waits for session A''s reference code');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, 'Session B then succeeds');
select is((select array_agg(reference_code order by title) from public.method_applications
  where title like 'Concurrent application %'), array['MUS-001', 'MUS-002'],
  'the two applications get distinct, sequential codes');

-- -----------------------------------------------------------------------------
-- 4. Agree and supersede one criterion; supersede another twice
-- -----------------------------------------------------------------------------
select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', format($sql$
  select public.agree_acceptance_criterion(%L::uuid, 'Executive Sponsor', current_date)::text $sql$, :'crit_1')) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', format($sql$
  select public.supersede_acceptance_criterion(%L::uuid, 'Concurrency criterion one, revised', 'Refined') $sql$, :'crit_1')),
  'a supersession waits for the agreement in progress');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, 'and then supersedes the agreed criterion');

select extensions.dblink_exec('a', 'begin');
select * from extensions.dblink('a', format($sql$
  select public.supersede_acceptance_criterion(%L::uuid, 'Concurrency criterion two, revised', 'Refined')::text $sql$,
  :'crit_2')) as r(v text);
select ok(pg_temp.start_and_check_blocked('b', format($sql$
  select public.supersede_acceptance_criterion(%L::uuid, 'Concurrency criterion two, again', 'Again') $sql$, :'crit_2')),
  'a second supersession of the same criterion waits');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), 'Only an agreed criterion is superseded; edit a proposal directly',
  'and is then refused');

select * from finish();

-- -----------------------------------------------------------------------------
-- Cleanup of committed test data
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
rollback;

begin;
set local session_replication_role = replica;
create temporary table conc_versions on commit drop as
  select v.id from public.method_asset_versions v join public.method_assets a on a.id = v.asset_id where a.key like 'conc-%';
create temporary table conc_apps on commit drop as
  select id from public.method_applications where title like 'Concurrent application %';
delete from public.method_application_practitioners where application_id in (select id from conc_apps);
delete from public.method_application_contexts where application_id in (select id from conc_apps);
delete from public.method_application_domains where application_id in (select id from conc_apps);
delete from public.method_applications where id in (select id from conc_apps);
delete from public.acceptance_criteria
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and created_at >= (select at from started);
delete from public.dam_release_members where release_id in (select id from public.dam_releases where version_label = '1.1');
delete from public.dam_releases where version_label = '1.1';
update public.dam_releases set status = 'published' where version_label = '1.0';
delete from public.method_version_outputs where version_id in (select id from conc_versions);
delete from public.method_version_stages where version_id in (select id from conc_versions);
delete from public.method_version_domains where version_id in (select id from conc_versions);
delete from public.method_version_contexts where version_id in (select id from conc_versions);
update public.method_assets set current_version_id = null where key like 'conc-%';
delete from public.method_asset_versions where id in (select id from conc_versions);
delete from public.method_assets where key like 'conc-%';
delete from public.architecture_reference_counters
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and prefix in ('MUS', 'ACR');
delete from public.activity_log where created_at >= (select at from started);
commit;
drop table started;
