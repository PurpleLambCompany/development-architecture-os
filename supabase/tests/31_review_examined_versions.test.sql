-- =============================================================================
-- Phase 7A: Review examined-version capture and the closed examined set
-- (pgTAP). Proposal §11, OD-7, ADR-0054. Run with: pnpm db:test
-- =============================================================================
begin;

select plan(21);

create function pg_temp.as_user(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(user_email);
  execute 'set local role authenticated';
end;
$$;
create function pg_temp.h(p_code text) returns uuid language sql as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000003' and reference_code = p_code;
$$;
grant execute on function pg_temp.h(text) to authenticated;

-- The seed's REV-001, held with a backdated held_at after its agenda was set.
select is((select string_agg(e.reference_code || ' v' || coalesce(v.version_no::text, '-'), ', ' order by e.reference_code)
           from public.review_examined_versions c
           join public.architecture_elements e on e.id = c.element_id
           left join public.element_versions v on v.id = c.element_version_id
           where c.review_element_id = pg_temp.h('REV-001')),
  'APP-001 v1, IMP-002 v1', 'REV-001 captured the versions it examined when it was held');
select ok((select bool_and(c.captured_at > r.held_at) from public.review_examined_versions c
           join public.reviews r on r.element_id = c.review_element_id
           where c.review_element_id = pg_temp.h('REV-001')),
  'the capture is system time, independent of the backdated held_at (F1)');

-- The capture is written only by hold_review, and never changed.
select throws_ok($$ insert into public.review_examined_versions (engagement_id, review_element_id, element_id)
                    values ('e0000000-0000-4000-8000-000000000003', pg_temp.h('REV-002'), pg_temp.h('APP-001')) $$,
  '42501', null, 'a capture cannot be inserted outside hold_review');
select throws_ok($$ update public.review_examined_versions set element_version_id = null
                    where review_element_id = pg_temp.h('REV-001') $$,
  '23514', null, 'a capture cannot be changed');
select throws_ok($$ delete from public.review_examined_versions where review_element_id = pg_temp.h('REV-001') $$,
  '23514', null, 'a capture cannot be deleted');

-- The examined set closes at hold (OD-7).
select pg_temp.as_user('architect@tplco.test');
select throws_ok($$ insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id,
                      relationship_type, description, provenance, client_visibility)
                    values ('e0000000-0000-4000-8000-000000000003', pg_temp.h('REV-001'), pg_temp.h('IMP-001'),
                            'examines', '', 'architect_judgment', 'internal') $$,
  '23514', 'The examined set closed when this Review was held. Use a later Review for further examination.',
  'a held Review cannot examine anything more');
select throws_ok($$ update public.architecture_relationships
                    set retired_at = now(), retirement_reason = 'Out of scope'
                    where source_element_id = pg_temp.h('REV-001') and target_element_id = pg_temp.h('APP-001')
                      and relationship_type = 'examines' $$,
  '23514', null, 'nor retire what it examined');
select throws_ok($$ select public.retire_relationship(
                      (select id from public.architecture_relationships
                       where source_element_id = pg_temp.h('REV-001') and relationship_type = 'examines'
                         and target_element_id = pg_temp.h('APP-001')), 'Out of scope') $$,
  '23514', null, 'nor through the retire operation');
select throws_ok($$ delete from public.architecture_relationships
                    where source_element_id = pg_temp.h('REV-001') and relationship_type = 'examines' $$,
  '23514', null, 'nor delete it');
select is((select count(*)::int from public.architecture_relationships
           where source_element_id = pg_temp.h('REV-001') and relationship_type = 'examines' and retired_at is null),
  2, 'REV-001''s examined set is unchanged');
select ok((select count(*) from public.architecture_relationships
           where source_element_id = pg_temp.h('REV-001') and relationship_type = 'validates') = 1,
  'its other relationships are untouched');

-- A scheduled Review is open: it may examine more, and retire what it examines.
select lives_ok($$ select pg_temp.h('IMP-003') $$, 'setup');
insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type,
                                               description, provenance, client_visibility)
values ('e0000000-0000-4000-8000-000000000003', pg_temp.h('REV-002'), pg_temp.h('IMP-003'), 'examines', '',
        'architect_judgment', 'internal');
select ok(exists (select 1 from public.architecture_relationships where source_element_id = pg_temp.h('REV-002')
                    and target_element_id = pg_temp.h('IMP-003') and relationship_type = 'examines'),
  'a scheduled Review can examine an element REV-001 also examined, or a new one');
insert into public.architecture_elements (id, engagement_id, kind, title, summary, provenance, client_visibility, owner_user_id)
values ('f7310000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'object', 'District partner roster',
        'Unpublished.', 'architect_judgment', 'internal', '10000000-0000-4000-8000-000000000003');
insert into public.architecture_objects (element_id, domain, object_type)
values ('f7310000-0000-4000-8000-000000000001', 'application', 'stakeholder');
insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type,
                                               description, provenance, client_visibility)
values ('e0000000-0000-4000-8000-000000000003', pg_temp.h('REV-002'), 'f7310000-0000-4000-8000-000000000001',
        'examines', '', 'architect_judgment', 'internal');

-- Holding REV-002 captures each examined element's latest published version.
select pg_temp.as_user('principal@tplco.test');
select public.hold_review(pg_temp.h('REV-002'), now() - interval '10 days', 'Council membership reviewed.');
select is((select string_agg(e.reference_code || ' v' || coalesce(v.version_no::text, '-'), ', '
                             order by e.reference_code)
           from public.review_examined_versions c
           join public.architecture_elements e on e.id = c.element_id
           left join public.element_versions v on v.id = c.element_version_id
           where c.review_element_id = pg_temp.h('REV-002')),
  'APP-001 v2, IMP-001 v2, IMP-003 v1, KNW-002 v-',
  'REV-002 captured the current versions, and null for an unpublished element');
select is((select count(*)::int from public.review_examined_versions where review_element_id = pg_temp.h('REV-001')),
  2, 'REV-001''s capture is unchanged by a later hold');

-- A later capture at the current version resolves the earlier Review's item
-- and the initiative's.
select ok(not exists (select 1 from public.edge_items('e0000000-0000-4000-8000-000000000003', null, null, null, true)
                      where rule_key = 'examined_element_revised_since_review' and subject_id = pg_temp.h('REV-001')),
  'REV-002''s capture of APP-001 v2 resolves REV-001''s revision item');
select ok(not exists (select 1 from public.edge_items('e0000000-0000-4000-8000-000000000003', null, null, null, true)
                      where rule_key = 'implemented_element_revised' and subject_id = pg_temp.h('IMP-001')),
  'and IMP-001''s implemented_element_revised item');

-- Publishing the unpublished element after the hold is a revision since review.
select pg_temp.as_user('architect@tplco.test');
select public.publish_element_version('f7310000-0000-4000-8000-000000000001', 'First published version');
select ok(exists (select 1 from public.edge_items('e0000000-0000-4000-8000-000000000003', null, null, null, true)
                  where rule_key = 'examined_element_revised_since_review' and subject_id = pg_temp.h('REV-002')
                    and trigger_subject_id = 'f7310000-0000-4000-8000-000000000001'),
  'an element unpublished at hold counts as revised once published');

-- Historical Reviews (held before 7A, no capture) are judged only through a
-- frozen baseline, never held_at.
set local session_replication_role = replica;
delete from public.review_examined_versions where review_element_id = pg_temp.h('REV-001');
set local session_replication_role = origin;
select ok(not exists (select 1 from public.edge_items('e0000000-0000-4000-8000-000000000003', null, null, null, true)
                      where rule_key = 'examined_element_revised_since_review' and subject_id = pg_temp.h('REV-001')),
  'a historical Review without a capture or baseline produces nothing (no held_at inference)');

-- Clients read no capture.
select pg_temp.act_as('lead@harbor.test');
select is((select count(*)::int from public.review_examined_versions), 0, 'a client reads no capture');
select pg_temp.act_as('architect@tplco.test');
select cmp_ok((select count(*)::int from public.review_examined_versions), '>', 0, 'an internal reader on Harbor does');

select * from finish();
rollback;
