-- =============================================================================
-- Phase 7A: substantive revision (pgTAP). Proposal §12, Q30, ADR-0053.
-- A version is a substantive revision when its snapshot differs from the one
-- before after removing the kind's status and lifecycle paths. The change
-- summary is never read. Run with: pnpm db:test
-- =============================================================================
begin;

select plan(20);

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
create function pg_temp.latest(p_element uuid) returns text language sql as $$
  select change_type from private.element_revision_rows(
    (select engagement_id from public.architecture_elements where id = p_element), p_element)
  order by version_no desc limit 1;
$$;

-- Every kind: each excluded path, changed alone, leaves the reduced snapshot
-- unchanged; a content path changes it.
select is((select count(*)::int
           from unnest(enum_range(null::public.element_kind)) k
           cross join lateral unnest(private.substantive_detail_exclusions(k)) p
           where private.substantive_snapshot(k, jsonb_build_object('title', 't', 'details', jsonb_build_object(p, 'a')))
              <> private.substantive_snapshot(k, jsonb_build_object('title', 't', 'details', jsonb_build_object(p, 'b')))),
  0, 'every excluded detail path, for every kind, is proven excluded');
select is((select count(*)::int
           from unnest(enum_range(null::public.element_kind)) k
           cross join unnest(array['ai_review_state', 'ai_reviewed_by', 'ai_reviewed_at']) p
           where private.substantive_snapshot(k, jsonb_build_object('title', 't', p, 'a'))
              <> private.substantive_snapshot(k, jsonb_build_object('title', 't', p, 'b'))),
  0, 'the AI review gate''s state is excluded for every kind');
select is(private.snapshot_changed_paths(
            private.substantive_snapshot('risk', '{"statements":[{"body":"b","ai_review_state":"pending"}]}'),
            private.substantive_snapshot('risk', '{"statements":[{"body":"b","ai_review_state":"accepted"}]}')),
  '{}'::text[], 'a statement''s AI review state is excluded');
select is((select count(*)::int
           from unnest(enum_range(null::public.element_kind)) k
           where private.substantive_snapshot(k, '{"title":"a","details":{"category":"x"}}')
               = private.substantive_snapshot(k, '{"title":"a","details":{"category":"y"}}')),
  0, 'a content field in details is never excluded');
select ok(not ('details.maturity' <> all (private.substantive_excluded_paths('object'))),
  'maturity is excluded from the diff (OD-1)');

-- The seed.
select is(pg_temp.latest(pg_temp.h('IMP-001')), 'status_publication', 'IMP-001''s v2 (operational) is a status publication (F2)');
select is(pg_temp.latest(pg_temp.h('IMP-002')), 'status_publication', 'IMP-002''s v2 (validated) is a status publication');
select is((select change_type from private.element_revision_rows('e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-001'))
           where version_no = 1), 'first_publication', 'a v1 is a first publication');
select is(pg_temp.latest(pg_temp.h('APP-001')), 'substantive_revision', 'Harbor APP-001''s v2 is substantive');
select is((select changed_paths from private.element_revision_rows('e0000000-0000-4000-8000-000000000003', pg_temp.h('APP-001'))
           where version_no = 2), array['statements', 'summary'], 'and says which paths changed');
select is(pg_temp.latest(pg_temp.m('CAP-001')), 'substantive_revision', 'Meridian CAP-001''s v2 is substantive (statements)');

-- Fixtures, per kind.
select pg_temp.as_user('architect@tplco.test');
select private.begin_architecture_operation();
update public.risks set risk_status = 'mitigating' where element_id = pg_temp.m('RSK-002');
select private.end_architecture_operation();
select public.publish_element_version(pg_temp.m('RSK-002'), 'Complete redesign of the risk and its mitigation.');
select is(pg_temp.latest(pg_temp.m('RSK-002')), 'status_publication',
  'risk: a status-only change is a status publication, whatever the change summary says');
update public.risks set mitigation = 'Deputy roles in stage 1.' where element_id = pg_temp.m('RSK-002');
select public.publish_element_version(pg_temp.m('RSK-002'), 'Typo.');
select is(pg_temp.latest(pg_temp.m('RSK-002')), 'substantive_revision',
  'risk: one content field is a substantive revision, whatever the change summary says');

update public.architecture_objects set maturity = 'emerging', maturity_rationale = 'Interviews complete.'
where element_id = pg_temp.m('CAP-003');
select public.publish_element_version(pg_temp.m('CAP-003'), 'Maturity advanced.');
select is(pg_temp.latest(pg_temp.m('CAP-003')), 'status_publication', 'object: a maturity change alone is not substantive (OD-1)');
update public.architecture_elements set title = 'Site acquisition and negotiation' where id = pg_temp.m('CAP-003');
select public.publish_element_version(pg_temp.m('CAP-003'), '');
select is(pg_temp.latest(pg_temp.m('CAP-003')), 'substantive_revision', 'object: a title change is substantive');

-- The seed changed ASM-001's confidence after v1 without publishing; publish
-- that content first so the next version differs by status alone.
select public.publish_element_version(pg_temp.m('ASM-001'), 'Confidence recorded.');
select is(pg_temp.latest(pg_temp.m('ASM-001')), 'substantive_revision', 'assumption: a confidence change is content');
select private.begin_architecture_operation();
update public.assumptions set validation_status = 'validated', validation_note = 'Confirmed.'
where element_id = pg_temp.m('ASM-001');
select private.end_architecture_operation();
select public.publish_element_version(pg_temp.m('ASM-001'), 'Validated.');
select is(pg_temp.latest(pg_temp.m('ASM-001')), 'status_publication', 'assumption: validation status is not substantive');

select public.update_implementation_status(pg_temp.h('IMP-003'), 'stalled', 'Paused.', true, 'Stalled.');
select is(pg_temp.latest(pg_temp.h('IMP-003')), 'status_publication', 'initiative: implementation status is not substantive');

-- The public read model agrees and is internal.
select is((select change_type from public.element_revisions('e0000000-0000-4000-8000-000000000003', pg_temp.h('APP-001'))
           where version_no = 2), 'substantive_revision', 'element_revisions returns the same classification');
select ok(pg_get_functiondef('private.element_revision_rows(uuid, uuid)'::regprocedure) !~* 'change_summary\s*(~|like|ilike|similar)',
  'the classification never pattern-matches the change summary (Q30)');

select * from finish();
rollback;
