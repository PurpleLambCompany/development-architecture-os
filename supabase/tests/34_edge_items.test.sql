-- =============================================================================
-- Phase 7A: the envelope, tiers and the existing signals (pgTAP).
-- Proposal §6, §9, §26 and acceptance scenarios S3, S5, S9.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(23);

create function pg_temp.as_user(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.h(p_code text) returns uuid language sql as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000003' and reference_code = p_code;
$$;
create function pg_temp.m(p_code text) returns uuid language sql as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' and reference_code = p_code;
$$;

select pg_temp.as_user('principal@tplco.test');
create temporary table items as
  select 'meridian' as eng, * from public.edge_items('e0000000-0000-4000-8000-000000000001', null, null, null, true)
  union all
  select 'harbor', * from public.edge_items('e0000000-0000-4000-8000-000000000003', null, null, null, true);

-- The envelope (§6.2).
select cmp_ok((select count(*)::int from items), '>', 30, 'both seeded engagements produce items');
select is((select count(*)::int from items where epistemic_status not in ('recorded', 'derived', 'worth_considering')),
  0, 'every item has exactly one 7A epistemic status');
select is((select count(*)::int from items where producer <> 'rule'), 0, 'the producer is always a rule');
select is((select count(*)::int from items where lens is null or resolving_act is null or tier is null or tier_reason is null
                                         or fingerprint is null or trigger_key is null or item_key is null),
  0, 'every item names its lens, resolving act, tier and keys');
select is((select count(*)::int from items where rule_key <> 'change_reaches'
             and rule_key not in (select rule_key from private.edge_rules())), 0, 'every rule key is in the catalog');
select is((select count(*)::int from items i join public.architecture_elements e on e.id = i.subject_id
           where i.subject_type = 'element' and e.lifecycle in ('retired', 'superseded')),
  0, 'no item bears on a retired or superseded subject');
-- The Phase 4 assumption signal carries the assumption's recorded confidence
-- field unchanged (§26); no rule computes a confidence.
select is((select count(*)::int from items where (details::text ~* 'confidence' and rule_key not like 'assumption_%')
                                            or basis::text ~* '"body"'),
  0, 'no computed confidence value and no content in the basis');
select is((select count(*)::int from (select item_key from items group by item_key having count(*) > 1) d),
  0, 'item keys are unique');

-- Tiers (§9.2): human_flagged only from human-set state.
select is((select count(*)::int from items where tier = 'human_flagged'
             and tier_reason not in ('attention_critical', 'open_escalation')),
  0, 'only a human act places an item in the human-flagged tier');
select is((select count(*)::int from items i join private.edge_rules() c using (rule_key)
           where c.list_tier = 'ambient' and i.tier = 'elevated'),
  0, 'an Ambient rule is never elevated');
select is((select count(*)::int from items i join private.edge_rules() c using (rule_key)
           where c.list_tier = 'ambient' and i.tier <> 'ambient'
             -- release_moved is the one variant listed at Attention (§5.2 #22).
             and i.variant is distinct from 'release_moved'),
  0, 'an Ambient rule stays Ambient, even on a flagged record (§16)');

-- S3: one revision of APP-001, one event.
select is((select count(distinct trigger_key)::int from items where eng = 'harbor' and trigger_subject_id = pg_temp.h('APP-001')
             and trigger_type = 'substantive_revision'),
  1, 'S3: APP-001''s revision is one event');
select is((select string_agg(distinct coalesce(subject_reference_code, ''), ',')
           from items where eng = 'harbor' and trigger_subject_id = pg_temp.h('APP-001') and trigger_type = 'substantive_revision'),
  'ACR-001,ACR-002,DLV-001,IMP-001,IMP-003,REV-001,REV-002',
  'S3: reaching IMP-001, IMP-003, their criteria, REV-001, REV-002 and DLV-001, and not MUS-001');

-- S5: REV-002 within the horizon elevates the event's items on what it examines.
select is((select order_facts ->> 'governance_reference_code' from items
           where eng = 'harbor' and rule_key = 'implemented_element_revised' and subject_id = pg_temp.h('IMP-001')),
  'REV-002', 'S5: the governance date is REV-002''s');
select is((select tier from items where eng = 'harbor' and rule_key = 'implemented_element_revised'
             and subject_id = pg_temp.h('IMP-001')),
  'elevated', 'S5: and it is Elevated');
select is((select tier_reason from items where eng = 'harbor' and rule_key = 'implemented_element_revised'
             and subject_id = pg_temp.h('IMP-001')),
  'governance_within_horizon', 'with that reason');
select is((select tier from items where eng = 'harbor' and rule_key = 'implemented_element_revised'
             and subject_id = pg_temp.h('IMP-003')),
  'human_flagged', 'IMP-003''s open escalation places its item in the human-flagged tier');

-- The existing signals, unchanged, through the envelope (§26).
select set_eq(
  $$ select rule_key, coalesce(element_id, client_action_id) from public.intelligence_signals('e0000000-0000-4000-8000-000000000001') $$,
  $$ select rule_key, subject_id from items where eng = 'meridian'
       and rule_key in (select rule_key from private.edge_rules() where origin = 'existing') and not judged $$,
  'every Phase 4 signal appears once in the envelope with its own subject');
select set_eq(
  $$ select rule_key, element_id from public.implementation_signals('e0000000-0000-4000-8000-000000000003') $$,
  $$ select rule_key, subject_id from items where eng = 'harbor'
       and rule_key in (select rule_key from private.edge_rules() where origin = 'existing') and not judged $$,
  'and every Phase 5 signal');
select is((select fingerprint from items where eng = 'meridian' and rule_key = 'review_overdue'),
  (select fingerprint from public.intelligence_signals('e0000000-0000-4000-8000-000000000001') where rule_key = 'review_overdue'),
  'with the signal''s own fingerprint');

-- D-35: ASM-001's attention is high, so its item is Elevated. S9: a person
-- marks it critical and it moves to the human-flagged tier.
select is((select tier from items where eng = 'meridian' and rule_key = 'assumption_unvalidated_underpins_published'),
  'elevated', 'D-35: attention high elevates the assumption''s item');
select public.triage_intelligence_record(pg_temp.m('ASM-001'), 'critical', current_date + 5, 'Board meets Friday.');
select is((select tier || ':' || tier_reason from public.edge_items('e0000000-0000-4000-8000-000000000001')
           where rule_key = 'assumption_unvalidated_underpins_published'),
  'human_flagged:attention_critical', 'S9: critical attention, a human act, places it in the human-flagged tier');

-- Deterministic.
select results_eq(
  $$ select item_key from public.edge_items('e0000000-0000-4000-8000-000000000003') $$,
  $$ select item_key from public.edge_items('e0000000-0000-4000-8000-000000000003') $$,
  'the same inputs give the same order');

select * from finish();
rollback;
