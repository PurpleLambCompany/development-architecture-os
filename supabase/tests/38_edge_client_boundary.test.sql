-- =============================================================================
-- Phase 7A: the client boundary (pgTAP). Proposal §18, S10. A client user
-- gets nothing from any new function or table. Run with: pnpm db:test
-- =============================================================================
begin;

select plan(14);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

\set H '''e0000000-0000-4000-8000-000000000003'''

select pg_temp.act_as('lead@harbor.test');
select is((select count(*)::int from public.edge_items(:H)), 0, 'no Edge item');
select is((select count(*)::int from public.edge_items(:H, null, 'element', 'b3000000-0000-4000-8000-000000000a01')), 0,
  'no contextual item');
select is((select count(*)::int from public.edge_rule_catalog()), 0, 'no rule catalog');
select is((select count(*)::int from public.relationship_impact_rules), 0, 'no impact matrix');
select is((select count(*)::int from public.impact_trace('b3000000-0000-4000-8000-000000000a01')), 0, 'no impact trace');
select is((select count(*)::int from public.element_revisions(:H)), 0, 'no revision classification');
select is((select count(*)::int from public.development_changes(:H)), 0, 'no development changes');
select is((select count(*)::int from public.review_examined_versions), 0, 'no Review capture');
select is((select count(*)::int from public.edge_judgments), 0, 'no judgment');
select is((select count(*)::int from public.method_practice_counts(
             (select id from public.method_assets where key = 'capability-readiness-diagnostic'))), 0,
  'no practice counts (Method IP)');
select throws_ok(format($$ select public.record_edge_judgment(%L, 'conflict_unresolved', 'element', %L, 'x', 'investigating') $$,
                        'e0000000-0000-4000-8000-000000000003', 'b3000000-0000-4000-8000-000000000a01'),
  null, 'no judging');
select throws_ok(format($$ select public.record_edge_event_judgment(%L, 'x', 'not_material', 'x') $$,
                        'e0000000-0000-4000-8000-000000000003'),
  null, 'no event judging');
select throws_ok(format($$ select public.mark_briefed_through(%L, now() - interval '1 minute') $$,
                        'e0000000-0000-4000-8000-000000000003'),
  null, 'no briefing');
select pg_temp.act_as('sponsor@harbor.test');
select is((select count(*)::int from public.edge_items(:H)), 0, 'nor for the sponsor');

select * from finish();
rollback;
