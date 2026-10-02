-- =============================================================================
-- Phase 7A: judgments (pgTAP). Proposal §15, OD-9, ADR-0056, and S7.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(44);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;
create function pg_temp.h(p_code text) returns uuid language sql security definer as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000003' and reference_code = p_code;
$$;
create function pg_temp.m(p_code text) returns uuid language sql security definer as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' and reference_code = p_code;
$$;
grant execute on function pg_temp.h(text), pg_temp.m(text) to authenticated;
create function pg_temp.fp(p_engagement uuid, p_rule text, p_subject uuid) returns text language sql as $$
  select fingerprint from public.edge_items(p_engagement, null, null, null, true)
  where rule_key = p_rule and subject_id = p_subject limit 1;
$$;
create function pg_temp.listed(p_engagement uuid, p_rule text, p_subject uuid) returns boolean language sql as $$
  select exists (select 1 from public.edge_items(p_engagement) where rule_key = p_rule and subject_id = p_subject);
$$;
grant execute on function pg_temp.fp(uuid, text, uuid), pg_temp.listed(uuid, text, uuid) to authenticated;

\set H '''e0000000-0000-4000-8000-000000000003'''
\set M '''e0000000-0000-4000-8000-000000000001'''

-- Capability: edit_architecture judges. A Researcher whose edit_architecture
-- is withdrawn by override reads the Edge but cannot judge (S11).
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
select id, 'edit_architecture', false from public.engagement_members
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000004';
select pg_temp.act_as('researcher@tplco.test');
select ok(pg_temp.listed(:M, 'conflict_unresolved', pg_temp.m('APP-003')), 'a Researcher reads the Edge');
select throws_ok(format($$ select public.record_edge_judgment(%L, 'conflict_unresolved', 'element', %L, %L,
                                                             'investigating') $$,
                        'e0000000-0000-4000-8000-000000000001', pg_temp.m('APP-003'),
                        pg_temp.fp(:M, 'conflict_unresolved', pg_temp.m('APP-003'))),
  '42501', null, 'but cannot judge (S11)');

select pg_temp.act_as('architect@tplco.test');

-- Investigating keeps it listed, attributed.
select lives_ok(format($$ select public.record_edge_judgment(%L, 'realization_without_evidence', 'element', %L, %L,
                                                            'investigating', 'Asking the council for minutes.') $$,
                       'e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-001'),
                       pg_temp.fp(:H, 'realization_without_evidence', pg_temp.h('IMP-001'))),
  'an Architect records Investigating');
select is((select judgment_kind || ':' || judged_by_name from public.edge_items(:H)
           where rule_key = 'realization_without_evidence' and subject_id = pg_temp.h('IMP-001')),
  'investigating:' || (select first_name || ' ' || last_name from public.profiles
                        where id = '10000000-0000-4000-8000-000000000003'),
  'Investigating stays listed, with who and when');

-- Not material needs a reason and leaves the list until the fingerprint changes.
select throws_ok(format($$ select public.record_edge_judgment(%L, 'realization_without_evidence', 'element', %L, %L,
                                                             'not_material') $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-002'),
                        pg_temp.fp(:H, 'realization_without_evidence', pg_temp.h('IMP-002'))),
  '23514', 'Say why', 'Not material needs a reason');
select lives_ok(format($$ select public.record_edge_judgment(%L, 'realization_without_evidence', 'element', %L, %L,
                                                            'not_material', 'The study itself is the evidence.') $$,
                       'e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-002'),
                       pg_temp.fp(:H, 'realization_without_evidence', pg_temp.h('IMP-002'))),
  'with a reason it is recorded');
select ok(not pg_temp.listed(:H, 'realization_without_evidence', pg_temp.h('IMP-002')), 'and the item leaves the list');
select ok(exists (select 1 from public.edge_items(:H, null, null, null, true)
                  where rule_key = 'realization_without_evidence' and subject_id = pg_temp.h('IMP-002') and judged),
  'the judged view still shows it, with the judgment');

-- A stale fingerprint is refused.
select throws_ok(format($$ select public.record_edge_judgment(%L, 'realization_without_evidence', 'element', %L,
                                                             'stale', 'not_material', 'x') $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-001')),
  '23514', 'This item has changed since it was shown. Reload it and judge it again.', 'a stale screen cannot judge');

-- Deferred needs a future date and returns when it expires.
select throws_ok(format($$ select public.record_edge_judgment(%L, 'operational_not_validated', 'element', %L, %L,
                                                             'deferred', 'After the council meets.', (now() at time zone 'America/Chicago')::date) $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-001'),
                        pg_temp.fp(:H, 'operational_not_validated', pg_temp.h('IMP-001'))),
  '23514', 'A deferral needs a future date', 'a deferral needs a future date');
select lives_ok(format($$ select public.record_edge_judgment(%L, 'operational_not_validated', 'element', %L, %L,
                                                            'deferred', 'After the council meets.', current_date + 7) $$,
                       'e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-001'),
                       pg_temp.fp(:H, 'operational_not_validated', pg_temp.h('IMP-001'))),
  'Defer until a date');
select ok(not pg_temp.listed(:H, 'operational_not_validated', pg_temp.h('IMP-001')), 'it leaves the list until then');
select ok(exists (select 1 from public.edge_items(:H, current_date + 8) where rule_key = 'operational_not_validated'
                    and subject_id = pg_temp.h('IMP-001')),
  'and returns once the date passes');

-- Promote names a governed promotion target: a closed kind (Risk, Decision,
-- Review, acceptance criterion) and a record of exactly that kind created on
-- this engagement.
select throws_ok(format($$ select public.record_edge_judgment(%L, 'decision_not_reflected', 'element', %L, %L,
                                                             'promoted', null, null, 'risk', %L) $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('DEC-001'),
                        pg_temp.fp(:H, 'decision_not_reflected', pg_temp.h('DEC-001')), pg_temp.m('RSK-001')),
  '23514', null, 'a promotion cannot name another engagement''s record');
select throws_ok(format($$ select public.record_edge_judgment(%L, 'decision_not_reflected', 'element', %L, %L,
                                                             'promoted', null, null, 'deliverable', %L) $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('DEC-001'),
                        pg_temp.fp(:H, 'decision_not_reflected', pg_temp.h('DEC-001')), pg_temp.h('DLV-001')),
  '23514', 'Promote only to a Risk, a Decision, a Review or an acceptance criterion',
  'the promotion target vocabulary is closed');
select throws_ok(format($$ select public.record_edge_judgment(%L, 'decision_not_reflected', 'element', %L, %L,
                                                             'promoted', null, null, 'risk', %L) $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('DEC-001'),
                        pg_temp.fp(:H, 'decision_not_reflected', pg_temp.h('DEC-001')), pg_temp.h('REV-001')),
  '23514', 'Promote only to a governed record of that kind created on this engagement',
  'the target must be a record of the named kind');
select throws_ok(format($$ select public.record_edge_judgment(%L, 'decision_not_reflected', 'element', %L, %L,
                                                             'promoted') $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('DEC-001'),
                        pg_temp.fp(:H, 'decision_not_reflected', pg_temp.h('DEC-001'))),
  '23514', null, 'a promotion must name its target');
select throws_ok(format($$ select public.record_edge_judgment(%L, 'decision_not_reflected', 'element', %L, %L,
                                                             'investigating', null, null, 'review', %L) $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('DEC-001'),
                        pg_temp.fp(:H, 'decision_not_reflected', pg_temp.h('DEC-001')), pg_temp.h('REV-001')),
  '23514', 'Only a promotion names a governed target', 'and only a promotion names one');

-- Promotion into a Risk: the Risk was recorded by its own operation.
select lives_ok(format($$ select public.record_edge_judgment(%L, 'conflict_unresolved', 'element', %L, %L,
                                                            'promoted', null, null, 'risk', %L) $$,
                       'e0000000-0000-4000-8000-000000000001', pg_temp.m('APP-003'),
                       pg_temp.fp(:M, 'conflict_unresolved', pg_temp.m('APP-003')), pg_temp.m('RSK-003')),
  'an item is promoted to a Risk');
select is((select promotion_target_kind || ':' || promotion_target_code from public.edge_items(:M, null, null, null, true)
           where rule_key = 'conflict_unresolved' and subject_id = pg_temp.m('APP-003')),
  'risk:RSK-003', 'the item reads back its typed promotion target');
select throws_ok($$ delete from public.architecture_elements where id = pg_temp.m('RSK-003') $$,
  '23503', null, 'a promotion target is kept, even while it is a draft');

-- Promotion into an acceptance criterion: the criterion is proposed through
-- the ordinary operation, and promotion records it; nothing agrees it.
select throws_ok(format($$ select public.record_edge_judgment(%L, 'implemented_element_revised', 'element', %L, %L,
                                                             'promoted', null, null, 'acceptance_criterion', %L) $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-003'),
                        pg_temp.fp(:H, 'implemented_element_revised', pg_temp.h('IMP-003')),
                        (select id from public.acceptance_criteria where reference_code = 'ACR-001'
                           and engagement_id = 'e0000000-0000-4000-8000-000000000003')),
  '23514', 'Promote only to a proposed criterion created on this engagement',
  'a promotion never names an agreed criterion');
select lives_ok(format($$ select public.record_edge_judgment(%L, 'implemented_element_revised', 'element', %L, %L,
                                                            'promoted', null, null, 'acceptance_criterion',
                                                            public.propose_acceptance_criterion(%L,
                                                              'Raised from the Development Edge: the revised object is still met.')) $$,
                       'e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-003'),
                       pg_temp.fp(:H, 'implemented_element_revised', pg_temp.h('IMP-003')), pg_temp.h('IMP-003')),
  'a criterion proposed through the ordinary operation is recorded as the promotion target');
select is((select state::text || ':' || coalesce(agreed_with, '-') from public.acceptance_criteria
           where id = (select promotion_target_criterion_id from public.edge_judgments
                       where promotion_target_kind = 'acceptance_criterion')),
  'proposed:-', 'the promoted criterion stays proposed: promotion never agrees it');
select is((select promotion_target_kind || ':' || promotion_target_code || ':' || judged::text
           from public.edge_items(:H, null, null, null, true)
           where rule_key = 'implemented_element_revised' and subject_id = pg_temp.h('IMP-003')),
  'acceptance_criterion:' || (select reference_code from public.acceptance_criteria
                              where governed_element_id = pg_temp.h('IMP-003') and state = 'proposed'
                              order by created_at desc limit 1) || ':true',
  'the item reads "promoted to" the criterion''s code, with the originating rule and fingerprint kept');
select ok(not pg_temp.listed(:H, 'implemented_element_revised', pg_temp.h('IMP-003')), 'and leaves the list');
select throws_ok(format($$ select public.delete_acceptance_criterion(%L) $$,
                        (select promotion_target_criterion_id from public.edge_judgments
                         where promotion_target_kind = 'acceptance_criterion')),
  '23503', null, 'the promoted proposal is kept as the promotion''s record');

-- The table itself holds the typed reference: the kind column is enforced by
-- the foreign keys, not only by the operation.
reset role;
select set_config('dsa.edge_judgment', 'on', true);
select set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-000000000003')::text, true);
select throws_ok(format($$ insert into public.edge_judgments (engagement_id, rule_key, subject_type, element_id,
                             fingerprint, judgment_kind, promotion_target_kind, promotion_target_element_id)
                           values (%L, 'conflict_unresolved', 'element', %L, 'x', 'promoted', 'risk', %L) $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('APP-001'), pg_temp.h('DEC-001')),
  '23503', null, 'a Risk target that is really a Decision is refused by the foreign key');
select throws_ok(format($$ insert into public.edge_judgments (engagement_id, rule_key, subject_type, element_id,
                             fingerprint, judgment_kind, promotion_target_kind, promotion_target_element_id)
                           values (%L, 'conflict_unresolved', 'element', %L, 'x', 'promoted', 'acceptance_criterion', %L) $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('APP-001'), pg_temp.h('APP-001')),
  '23514', null, 'a criterion target must use the criterion reference');
select set_config('dsa.edge_judgment', 'off', true);

-- Clients never see or make promotions.
select pg_temp.act_as('sponsor@harbor.test');
select is((select count(*)::int from public.edge_judgments), 0, 'a client reads no judgments or promotion targets');
select throws_ok(format($$ select public.record_edge_judgment(%L, 'decision_not_reflected', 'element', %L, 'x',
                                                             'promoted', null, null, 'decision', %L) $$,
                        'e0000000-0000-4000-8000-000000000003', pg_temp.h('DEC-001'), pg_temp.h('DEC-001')),
  'P0002', null, 'and cannot promote');
select pg_temp.act_as('architect@tplco.test');

-- S7: judge the APP-001 event as a whole.
select is(public.record_edge_event_judgment(:H,
            (select trigger_key from public.edge_items(:H) where trigger_type = 'substantive_revision'
               and trigger_subject_id = pg_temp.h('APP-001') limit 1),
            'not_material', 'Membership change is procedural.'),
  (select count(*)::int from public.edge_items(:H) where trigger_type = 'substantive_revision'
     and trigger_subject_id = pg_temp.h('APP-001')),
  'S7: judging the event records one judgment per item in it');
select is((select count(*)::int from public.edge_items(:H) where trigger_type = 'substantive_revision'
             and trigger_subject_id = pg_temp.h('APP-001')), 0, 'S7: all of its items leave the list');
select is((select count(distinct (reason, trigger_key))::int from public.edge_judgments
           where trigger_key like 'rev:' || pg_temp.h('APP-001') || ':%' and judgment_kind = 'not_material'),
  1, 'S7: read back as one act with one reason');

select pg_temp.act_as('architect@tplco.test');
update public.architecture_elements set summary = 'The council, with rotating partner seats.' where id = pg_temp.h('APP-001');
select public.publish_element_version(pg_temp.h('APP-001'), 'Rotating seats recorded.');
select is((select count(distinct subject_id)::int from public.edge_items(:H) where trigger_type = 'substantive_revision'
             and trigger_subject_id = pg_temp.h('APP-001')),
  7, 'S7: a second substantive revision brings every consequence back');

-- Append-only.
select throws_ok($$ update public.edge_judgments set reason = 'Edited' $$, '42501', null, 'a judgment cannot be edited');
select throws_ok($$ delete from public.edge_judgments $$, '42501', null, 'or deleted');
select throws_ok($$ insert into public.edge_judgments (engagement_id, rule_key, subject_type, element_id, fingerprint,
                      judgment_kind, reason, judged_by)
                    values ('e0000000-0000-4000-8000-000000000003', 'conflict_unresolved', 'element', pg_temp.h('APP-001'),
                            'x', 'not_material', 'x', '10000000-0000-4000-8000-000000000003') $$,
  '42501', null, 'or written outside the operation');

-- The existing rules: not_material and deferred still go to the existing
-- dismissal tables (OD-9), so the Signals page and the Edge agree.
select lives_ok(format($$ select public.record_edge_judgment(%L, 'review_overdue', 'element', %L, %L, 'not_material',
                                                            'Reviewed at the board meeting.') $$,
                       'e0000000-0000-4000-8000-000000000001', pg_temp.m('DEP-001'),
                       pg_temp.fp(:M, 'review_overdue', pg_temp.m('DEP-001'))),
  'Not material on an existing rule');
select ok(not exists (select 1 from public.intelligence_signals(:M) where rule_key = 'review_overdue'),
  'is a dismissal the Signals page honors');
select is((select judgment_source from public.edge_items(:M, null, null, null, true) where rule_key = 'review_overdue'),
  'signal_dismissal', 'and the Edge reads it from there');
select lives_ok(format($$ select public.dismiss_intelligence_signal(%L, 'opportunity_window_closing', %L, null, %L,
                                                                   'Proposal already submitted.') $$,
                       'e0000000-0000-4000-8000-000000000001', pg_temp.m('OPP-001'),
                       pg_temp.fp(:M, 'opportunity_window_closing', pg_temp.m('OPP-001'))),
  'a dismissal made on the Signals page');
select ok(not pg_temp.listed(:M, 'opportunity_window_closing', pg_temp.m('OPP-001')), 'is honored by the Edge');

-- Judgments are professional records: logged, attributed.
select pg_temp.act_as('principal@tplco.test');
select cmp_ok((select count(*)::int from public.activity_log where entity_type = 'edge_judgments'), '>', 0,
  'judgments are recorded in the activity log');

select * from finish();
rollback;
