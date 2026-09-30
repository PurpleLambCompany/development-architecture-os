-- =============================================================================
-- Phase 7A: the rule catalog and the relationship-impact matrix (pgTAP).
-- Proposal §5, §10, §24.1. Run with: pnpm db:test
-- =============================================================================
begin;

select plan(17);

select is((select count(*)::int from private.edge_rules()), 42, 'the catalog has 42 rules');
select is((select count(*)::int from private.edge_rules() where origin = 'new'), 31, '31 of them new');
select is((select count(*)::int from private.edge_rules() where origin = 'existing'), 11, '11 of them existing');
select is((select count(distinct rule_key)::int from private.edge_rules()), 42, 'keys are unique');

-- The existing rows carry exactly the keys the two signal functions produce.
select set_eq(
  $$ select rule_key from private.edge_rules() where origin = 'existing' $$,
  $$ values ('assumption_unvalidated_underpins_published'), ('assumption_invalidated_still_underpins'),
            ('risk_high_without_mitigation'), ('dependency_blocking_unsatisfied'), ('decision_past_needed_by'),
            ('opportunity_window_closing'), ('opportunity_window_closed'), ('review_overdue'),
            ('client_action_overdue'), ('record_untriaged'), ('implementation_past_target') $$,
  'the existing rules are the Phase 4 and Phase 5 signal keys');
select ok((select bool_and(exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                   where n.nspname in ('public', 'private') and p.proname like '%signal%'
                                     and p.proname not like 'edge%' and p.prosrc like '%''' || rule_key || '''%'))
           from private.edge_rules() where origin = 'existing'),
  'each existing key is produced by one of the signal functions');

select is((select count(*)::int from private.edge_rules() where epistemic_status not in ('recorded', 'derived', 'worth_considering')),
  0, 'no rule is suggested (7B) or unlabeled');
select is((select count(*)::int from private.edge_rules() where resolving_act is null or lens is null or home is null),
  0, 'every rule names a lens, a home and a resolving act');

-- The matrix.
select is((select count(*)::int from public.relationship_impact_rules), 112, '39 types and 17 off-spine links, both ways');
select is((select count(*)::int from public.relationship_types t
           where (select count(*) from public.relationship_impact_rules r where r.link_key = t.key) <> 2),
  0, 'every vocabulary relationship type has exactly one row per direction');
select set_eq(
  $$ select link_key, direction from public.relationship_impact_rules where propagation = 'recursive' $$,
  $$ values ('part_of', 'target_to_source'), ('specializes', 'target_to_source'), ('requires', 'target_to_source') $$,
  'only the three governed walks recurse');
select is((select max(max_depth) from public.relationship_impact_rules), 2, 'no walk goes past depth two');
select is((select count(*)::int from public.relationship_impact_rules where assessment = 'no' and propagation <> 'never'),
  0, 'a No link never propagates');

select set_config('request.jwt.claims',
  json_build_object('sub', '10000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
select cmp_ok((select count(*)::int from public.architecture_elements e
               cross join lateral public.impact_trace(e.id, 'on_demand') t), '>', 50,
  'the trace reads as the Principal Architect');
-- A never link is never traversed, in either mode, from any element.
select is((select count(*)::int
           from public.architecture_elements e
           cross join (values ('on_demand'), ('edge')) m (mode)
           cross join lateral public.impact_trace(e.id, m.mode) t
           join public.relationship_impact_rules r on r.link_key = t.link_key and r.direction = t.direction
           where r.propagation = 'never'),
  0, 'impact_trace never follows a never link');

select is((select count(*)::int from information_schema.role_table_grants
           where table_schema = 'public' and table_name = 'relationship_impact_rules'
             and grantee in ('authenticated', 'anon') and privilege_type <> 'SELECT'),
  0, 'the matrix has no write grants');
select is((select count(*)::int from information_schema.role_routine_grants
           where routine_schema = 'private' and routine_name like 'edge_rules%' and grantee in ('authenticated', 'anon')),
  0, 'the private rule functions are not callable by users');

select * from finish();
rollback;
