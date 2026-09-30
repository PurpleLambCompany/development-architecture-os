-- =============================================================================
-- Phase 7A: narrow Practice Intelligence (pgTAP). Proposal §17, OD-5, S12.
-- Counts with their n, always; a proportion only at n >= 5; no engagement,
-- client or free text. Run with: pnpm db:test
-- =============================================================================
begin;

select plan(9);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;
create function pg_temp.asset(asset_key text) returns uuid language sql security definer as $$
  select id from public.method_assets where key = asset_key;
$$;
grant execute on function pg_temp.asset(text) to authenticated;

select is(private.practice_min_n(), 5, 'the minimum n is 5 (OD-5)');

select pg_temp.act_as('researcher@tplco.test');
create temporary table pc as select * from public.method_practice_counts(pg_temp.asset('capability-readiness-diagnostic'));
select is((select count(distinct version_label)::int from pc where measure = 'stage_treatment'), 1,
  'S12: only versions with closed applications are counted');
select is((select distinct n from pc where measure = 'stage_treatment'), 1, 'S12: n = 1 for the Diagnostic 1.1');
select is((select count(*)::int from pc where proportion is not null), 0, 'S12: no proportion below the minimum');
select is((select count from pc where stage_key = 'interview' and treatment = 'adapted'), 1, 'the counts are there');
select is((select count(*)::int from information_schema.parameters p join information_schema.routines r using (specific_name)
           where r.routine_name = 'method_practice_counts' and p.parameter_mode = 'OUT'
             and (p.parameter_name ~ 'engagement|client|note|body|name')),
  0, 'no engagement, client or free text in the output');

-- At n >= 5 a proportion appears.
select pg_temp.act_as('principal@tplco.test');
create temporary table n5 as select * from public.method_practice_counts(pg_temp.asset('capability-readiness-diagnostic'));
reset role;
-- Test support only: four more closed applications of the same version,
-- written with triggers off (nothing here is possible through the app).
set local session_replication_role = replica;
insert into public.method_applications (engagement_id, reference_code, method_asset_version_id, dam_release_id,
                                        version_in_release, title, selection_reason, state, started_on, closed_on,
                                        completion_statement, retrospective)
select a.engagement_id, 'MUS-90' || g, a.method_asset_version_id, a.dam_release_id, a.version_in_release,
       a.title, a.selection_reason, 'completed', a.started_on, a.closed_on, a.completion_statement, a.retrospective
from public.method_applications a cross join generate_series(1, 4) g
where a.state = 'completed' and a.method_asset_version_id in (select version_id from n5);
set local session_replication_role = origin;
select pg_temp.act_as('principal@tplco.test');
select is((select distinct n from public.method_practice_counts(pg_temp.asset('capability-readiness-diagnostic'))
           where measure = 'stage_treatment'), 5, 'five closed applications');
select ok((select bool_and(proportion is not null) from public.method_practice_counts(pg_temp.asset('capability-readiness-diagnostic'))
           where measure = 'stage_treatment'), 'then proportions are shown');

select pg_temp.act_as('lead@harbor.test');
select is((select count(*)::int from public.method_practice_counts(pg_temp.asset('capability-readiness-diagnostic'))), 0,
  'clients read nothing');

select * from finish();
rollback;
