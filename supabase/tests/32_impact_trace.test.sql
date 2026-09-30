-- =============================================================================
-- Phase 7A: impact_trace (pgTAP). Proposal §10, OD-8, ADR-0055.
-- Direction comes from the governed matrix; only three walks recurse, to depth
-- two; terminal hops reach initiatives, Reviews, Deliverables, criteria,
-- client actions and open Method Applications. Run with: pnpm db:test
-- =============================================================================
begin;

select plan(22);

create function pg_temp.as_user(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.m(p_code text) returns uuid language sql as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' and reference_code = p_code;
$$;
create function pg_temp.h(p_code text) returns uuid language sql as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000003' and reference_code = p_code;
$$;
create function pg_temp.reached(p_element uuid, p_mode text) returns text language sql as $$
  select string_agg(coalesce(reference_code, reached_type), ',' order by coalesce(reference_code, reached_type))
  from public.impact_trace(p_element, p_mode);
$$;
create function pg_temp.reaches(p_element uuid, p_mode text, p_code text) returns boolean language sql as $$
  select exists (select 1 from public.impact_trace(p_element, p_mode) where reference_code = p_code);
$$;
create function pg_temp.child(p_id uuid, p_title text, p_parent uuid) returns void language sql as $$
  insert into public.architecture_elements (id, engagement_id, kind, title, summary, provenance, client_visibility, owner_user_id)
  values (p_id, 'e0000000-0000-4000-8000-000000000001', 'object', p_title, '.', 'architect_judgment', 'internal',
          '10000000-0000-4000-8000-000000000003');
  insert into public.architecture_objects (element_id, domain, object_type) values (p_id, 'application', 'application_format');
  insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type,
                                                 description, provenance, client_visibility)
  values ('e0000000-0000-4000-8000-000000000001', p_id, p_parent, 'part_of', '', 'architect_judgment', 'internal');
$$;

select pg_temp.as_user('principal@tplco.test');

-- F6 regressions: what the legacy traces missed.
select ok(pg_temp.reaches(pg_temp.m('CAP-001'), 'on_demand', 'RSK-001'), 'CAP-001 reaches RSK-001, which threatens it (F6)');
select ok(pg_temp.reaches(pg_temp.m('CAP-001'), 'on_demand', 'CAP-005'), 'and CAP-005, a gap in it (F6)');
select is(pg_temp.reached(pg_temp.h('APP-001'), 'edge'), 'ACR-001,ACR-002,DLV-001,IMP-001,IMP-003,REV-001,REV-002',
  'Harbor APP-001 reaches its initiatives, their criteria, its Reviews and its Deliverable');
select ok(not exists (select 1 from public.impact_trace(pg_temp.h('APP-001'), 'on_demand') where reached_type = 'method_application'),
  'Harbor''s completed MUS-001 is not reached: open applications only');
select ok(pg_temp.reaches(pg_temp.m('APP-001'), 'edge', 'MUS-001'), 'Meridian''s open MUS-001 is reached');
select is((select category from public.impact_trace(pg_temp.h('APP-001'), 'edge') where reference_code = 'ACR-001'),
  'criteria', 'criteria are reached through the implementing initiative');

-- Weak links only on demand; never links never.
select ok(pg_temp.reaches(pg_temp.m('APP-001'), 'on_demand', 'APP-005'), 'a weak link (part_of, upward) appears on demand');
select is((select assessment from public.impact_trace(pg_temp.m('APP-001'), 'on_demand') where reference_code = 'APP-005'),
  'weak', 'labeled weak');
select ok(not pg_temp.reaches(pg_temp.m('APP-001'), 'edge', 'APP-005'), 'and never feeds the Edge');
select is(pg_temp.reached(pg_temp.m('KNW-004'), 'on_demand'), null, 'a specialization does not reach its general concept');

-- Direction: requires reaches upward only.
select ok(pg_temp.reaches(pg_temp.m('CAP-004'), 'edge', 'CAP-001'), 'CAP-004 reaches CAP-001, which requires it (S6)');
select ok(not pg_temp.reaches(pg_temp.m('CAP-004'), 'edge', 'STR-001'), 'but not CAP-001''s outcome: serves does not recurse');
select ok(not pg_temp.reaches(pg_temp.m('CAP-001'), 'edge', 'CAP-004'), 'CAP-001 does not reach what it requires');

-- Recursion: same-link walks to depth two, and no further.
select pg_temp.child('f7320000-0000-4000-8000-000000000001', 'Intake step', pg_temp.m('APP-001'));
select pg_temp.child('f7320000-0000-4000-8000-000000000002', 'Intake sub-step', 'f7320000-0000-4000-8000-000000000001');
select is((select depth from public.impact_trace(pg_temp.m('APP-005'), 'edge') where reached_id = 'f7320000-0000-4000-8000-000000000001'),
  2, 'part_of recurses downward to depth two');
select ok(not exists (select 1 from public.impact_trace(pg_temp.m('APP-005'), 'edge')
                      where reached_id = 'f7320000-0000-4000-8000-000000000002'),
  'and stops there');
select is((select max(t.depth) from public.architecture_elements e cross join lateral public.impact_trace(e.id, 'on_demand') t),
  2, 'no trace anywhere goes past depth two');
select ok(not pg_temp.reaches(pg_temp.m('KNW-002'), 'edge', 'KNW-004'),
  'a walk does not change link type midway (part_of then specializes)');

-- Invalidated underpins continues one step upward along part_of and requires.
insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type,
                                               description, provenance, client_visibility)
values ('e0000000-0000-4000-8000-000000000001', pg_temp.m('ASM-001'), pg_temp.m('CAP-004'), 'underpins', '',
        'architect_judgment', 'internal');
select ok(not pg_temp.reaches(pg_temp.m('ASM-001'), 'edge', 'CAP-001'),
  'an unvalidated assumption reaches only what it underpins');
select private.begin_architecture_operation();
update public.assumptions set validation_status = 'invalidated' where element_id = pg_temp.m('ASM-001');
select private.end_architecture_operation();
select ok(pg_temp.reaches(pg_temp.m('ASM-001'), 'edge', 'CAP-001'),
  'an invalidated one continues through what it underpins');

-- On-demand extras and the legacy functions.
select ok(exists (select 1 from public.impact_trace(pg_temp.m('KNW-001'), 'on_demand') where reached_type = 'evidence_source'),
  'on demand, evidence citing the element is listed');
select lives_ok($$ select * from public.intelligence_impact(pg_temp.m('CAP-001'), 3) $$,
  'the legacy intelligence_impact still works (kept, off the UI path)');
select alike(obj_description('public.intelligence_impact(uuid, int)'::regprocedure, 'pg_proc'), '%egacy%',
  'and is documented as legacy');

select * from finish();
rollback;
