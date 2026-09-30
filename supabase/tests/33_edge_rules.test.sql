-- =============================================================================
-- Phase 7A: the 31 deterministic rules (pgTAP). Run with: pnpm db:test
--
-- Each rule has one positive and one negative case, from the seed where the
-- seed already shows it and from a fixture built here through the same
-- operations and tables the seed uses. Also the F1 regression (a backdated
-- held_at and agreed_on produce nothing) and the F2 regression (IMP-001's
-- status publication produces nothing). Proposal §5.2, §24.1, §25.2.
-- =============================================================================
begin;

select plan(68);

-- Fixtures are written as the database owner with a signed-in user's claims,
-- as supabase/seed.sql does; the Edge is read through public.edge_items.
create function pg_temp.as_user(user_email text)
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text,
    true);
end;
$$;

create function pg_temp.eid(p_engagement uuid, p_code text) returns uuid language sql as $$
  select id from public.architecture_elements where engagement_id = p_engagement and reference_code = p_code;
$$;
create function pg_temp.m(p_code text) returns uuid language sql as $$
  select pg_temp.eid('e0000000-0000-4000-8000-000000000001', p_code);
$$;
create function pg_temp.h(p_code text) returns uuid language sql as $$
  select pg_temp.eid('e0000000-0000-4000-8000-000000000003', p_code);
$$;

-- Does the rule hold for the subject? Judged items included, so a judgment
-- never hides a rule's behavior here.
create function pg_temp.fires(p_engagement uuid, p_rule text, p_subject uuid) returns boolean language sql as $$
  select exists (select 1 from public.edge_items(p_engagement, null, null, null, true)
                 where rule_key = p_rule and subject_id = p_subject);
$$;
create function pg_temp.mf(p_rule text, p_subject uuid) returns boolean language sql as $$
  select pg_temp.fires('e0000000-0000-4000-8000-000000000001', p_rule, p_subject);
$$;
create function pg_temp.hf(p_rule text, p_subject uuid) returns boolean language sql as $$
  select pg_temp.fires('e0000000-0000-4000-8000-000000000003', p_rule, p_subject);
$$;

create function pg_temp.el(
  p_id uuid, p_kind public.element_kind, p_title text, p_provenance public.provenance_type,
  p_engagement uuid default 'e0000000-0000-4000-8000-000000000001'
) returns void language sql as $$
  insert into public.architecture_elements (id, engagement_id, kind, title, summary, provenance, client_visibility, owner_user_id)
  values (p_id, p_engagement, p_kind, p_title, p_title || '.', p_provenance, 'internal', '10000000-0000-4000-8000-000000000003');
$$;
create function pg_temp.rel(p_source uuid, p_type text, p_target uuid) returns uuid language sql as $$
  insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type,
                                                 description, provenance, client_visibility)
  select e.engagement_id, p_source, p_target, p_type, '', 'architect_judgment', 'internal'
  from public.architecture_elements e where e.id = p_source
  returning id;
$$;
create function pg_temp.revise(p_element uuid, p_summary text) returns void language plpgsql as $$
begin
  update public.architecture_elements set summary = p_summary where id = p_element;
  perform public.publish_element_version(p_element, 'Revised for the rule tests.');
end;
$$;

select pg_temp.as_user('architect@tplco.test');

-- -----------------------------------------------------------------------------
-- Integrity
-- -----------------------------------------------------------------------------
select ok(pg_temp.mf('statement_contradicted_by_evidence', pg_temp.m('KNW-001')),
  '1+ statement_contradicted_by_evidence: a published statement carries contradicting evidence');
select ok(not pg_temp.mf('statement_contradicted_by_evidence', pg_temp.m('KNW-002')),
  '1- an element without contradicting evidence has none');

select ok(not pg_temp.mf('relationship_to_replaced_element', pg_temp.m('CAP-001')),
  '2- relationship_to_replaced_element: nothing while every end is live');
select public.retire_element(pg_temp.m('CAP-005'), 'Gap closed for the rule tests.');
select ok(pg_temp.mf('relationship_to_replaced_element', pg_temp.m('CAP-001')),
  '2+ a live element related to a retired one');

select ok(pg_temp.mf('conflict_unresolved', pg_temp.m('APP-003')),
  '3+ conflict_unresolved: an unretired conflicts_with between published elements');
select ok(not pg_temp.mf('conflict_unresolved', pg_temp.m('APP-005')), '3- an element in no conflict');

select pg_temp.el('f7000000-0000-4000-8000-000000000001', 'object', 'Derived without a model', 'methodology_derived');
insert into public.architecture_objects (element_id, domain, object_type)
values ('f7000000-0000-4000-8000-000000000001', 'knowledge', 'concept');
select ok(pg_temp.mf('methodology_derived_without_model', 'f7000000-0000-4000-8000-000000000001'),
  '4+ methodology_derived_without_model: methodology-derived provenance and no instantiates lineage');
select ok(not pg_temp.mf('methodology_derived_without_model', pg_temp.m('KNW-003')),
  '4- architect-judgment provenance produces nothing');

select ok(pg_temp.mf('measurement_gap', pg_temp.m('STR-001')),
  '5+ measurement_gap: a published Intended Outcome with no measured_by');
select ok(not pg_temp.mf('measurement_gap', pg_temp.m('APP-002')), '5- a Metric that measures something');

select ok(pg_temp.mf('capability_serves_no_outcome', pg_temp.m('CAP-002')),
  '6+ capability_serves_no_outcome: a Capability that serves no Intended Outcome');
select ok(not pg_temp.mf('capability_serves_no_outcome', pg_temp.m('CAP-001')), '6- a Capability that serves one');

select ok(pg_temp.hf('governance_allocation_gap', pg_temp.h('APP-001')),
  '7+ governance_allocation_gap: a Governance Body that governs nothing');
select ok(not pg_temp.mf('governance_allocation_gap', pg_temp.m('APP-004')), '7- a Decision Right that is held');

-- -----------------------------------------------------------------------------
-- Realization
-- -----------------------------------------------------------------------------
select ok(pg_temp.mf('approved_without_pathway', pg_temp.m('CAP-002')),
  '8+ approved_without_pathway: a published Capability with no pathway');
select ok(not pg_temp.mf('approved_without_pathway', pg_temp.m('CAP-001')),
  '8- a Capability implemented_through an Application Format');

select ok(pg_temp.hf('operational_not_validated', pg_temp.h('IMP-001')),
  '9+ operational_not_validated: IMP-001 is operational with no validates');
select ok(not pg_temp.hf('operational_not_validated', pg_temp.h('IMP-002')), '9- IMP-002 is validated');
select is((select trigger_type from public.edge_items('e0000000-0000-4000-8000-000000000003')
           where rule_key = 'operational_not_validated' and subject_id = pg_temp.h('IMP-001')),
  'status_change', '9  it is triggered by the recorded status change');

select ok(pg_temp.hf('implemented_element_revised', pg_temp.h('IMP-001')),
  '11+ implemented_element_revised: APP-001 was substantively revised after IMP-001 implemented it');
select ok(not pg_temp.hf('implemented_element_revised', pg_temp.h('IMP-002')),
  '11- IMP-002 is validated, so rule 12 speaks for it instead');

select ok(pg_temp.hf('validated_element_revised', pg_temp.h('IMP-002')),
  '12+ validated_element_revised: KNW-001 was revised after IMP-002 was validated');
select ok(not pg_temp.hf('validated_element_revised', pg_temp.h('IMP-001')), '12- IMP-001 is not validated');

select ok(pg_temp.hf('realization_without_evidence', pg_temp.h('IMP-001')),
  '13+ realization_without_evidence: operational with no evidence');
select ok(not pg_temp.hf('realization_without_evidence', pg_temp.h('IMP-003')), '13- IMP-003 is not yet operational');

select ok(not pg_temp.hf('checkpoint_past_target', pg_temp.h('IMP-003')),
  '14- checkpoint_past_target: nothing without a missed checkpoint');
insert into public.implementation_checkpoints (engagement_id, implementation_element_id, checkpoint_type, title, target_on)
values ('e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-003'), 'agreement_executed', 'Charter signed', current_date - 3);
select ok(pg_temp.hf('checkpoint_past_target', pg_temp.h('IMP-003')),
  '14+ a checkpoint not achieved whose target date has passed');

select ok(not pg_temp.hf('criteria_without_review_path', pg_temp.h('IMP-001')),
  '15- criteria_without_review_path: IMP-001''s criteria have REV-002 examining it');
select pg_temp.as_user('principal@tplco.test');
select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001', 'Acquisition desk',
  array[pg_temp.m('CAP-002')], 'other', null, null, 'Stands up the acquisition desk.');
select pg_temp.as_user('architect@tplco.test');
select public.publish_element_version(pg_temp.m('IMP-001'), 'First published version');
select public.propose_acceptance_criterion(pg_temp.m('IMP-001'), 'The desk closes one site.');
select public.agree_acceptance_criterion(
  (select id from public.acceptance_criteria where body = 'The desk closes one site.'), 'The Authority', current_date);
select ok(pg_temp.mf('criteria_without_review_path', pg_temp.m('IMP-001')),
  '15+ agreed criteria in force with no scheduled or held Review examining the initiative');

-- -----------------------------------------------------------------------------
-- Change
-- -----------------------------------------------------------------------------
-- F2: IMP-001's v2 is a status publication, so its agreed criteria do not
-- predate a revision.
select ok(not pg_temp.hf('criteria_predate_revision',
                         (select id from public.acceptance_criteria where reference_code = 'ACR-001'
                            and engagement_id = 'e0000000-0000-4000-8000-000000000003')),
  '16- criteria_predate_revision: IMP-001''s status publication produces nothing (F2)');

select ok(pg_temp.hf('examined_element_revised_since_review', pg_temp.h('REV-001')),
  '17+ examined_element_revised_since_review: APP-001 was revised after REV-001 captured it');
select is((select string_agg(details ->> 'examined_reference_code', ',')
           from public.edge_items('e0000000-0000-4000-8000-000000000003')
           where rule_key = 'examined_element_revised_since_review'), 'APP-001',
  '17- IMP-002, captured and never revised since, produces nothing (F1: held_at is not the basis)');

select ok(not pg_temp.hf('evidence_after_review', pg_temp.h('REV-001')),
  '18- evidence_after_review: nothing before new evidence');
insert into public.evidence_sources (id, engagement_id, title, source_type, provenance, summary, ip_classification,
                                     client_visibility)
values ('f7000000-0000-4000-8000-000000000701', 'e0000000-0000-4000-8000-000000000003', 'Demand survey addendum',
        'publication', 'client_source', 'An addendum to the demand study.', 'client_confidential', 'internal');
insert into public.element_evidence_links (engagement_id, element_id, evidence_source_id, stance, locator)
values ('e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-002'), 'f7000000-0000-4000-8000-000000000701',
        'contradicts', 'Table 2');
select ok(pg_temp.hf('evidence_after_review', pg_temp.h('REV-001')),
  '18+ evidence linked to a captured element after the capture');
select is((select tier from public.edge_items('e0000000-0000-4000-8000-000000000003')
           where rule_key = 'evidence_after_review'), 'attention',
  '18  contradicting evidence lifts it from Ambient');

select ok(pg_temp.hf('decision_not_reflected', pg_temp.h('DEC-001')),
  '19+ decision_not_reflected: decided after APP-001''s latest version');
select ok(not pg_temp.mf('decision_not_reflected', pg_temp.m('DEC-001')), '19- a decision not yet decided');

select ok(pg_temp.hf('deliverable_documents_revised', pg_temp.h('DLV-001')),
  '20+ deliverable_documents_revised: DLV-001 documents elements revised after its approval');
select is((select count(distinct trigger_subject_id)::int from public.edge_items('e0000000-0000-4000-8000-000000000003')
           where rule_key = 'deliverable_documents_revised'), 2,
  '20- only the documented, revised elements (APP-001 and KNW-001) trigger it');

insert into public.client_contributions (engagement_id, element_id, element_version_id, submitted_by, body)
select 'e0000000-0000-4000-8000-000000000003', v.element_id, v.id, '30000000-0000-4000-8000-000000000002', 'On v' || v.version_no
from public.element_versions v
where (v.element_id = pg_temp.h('APP-001') and v.version_no = 1)
   or (v.element_id = pg_temp.h('KNW-001') and v.version_no = 2);
select ok(pg_temp.hf('contribution_on_prior_version', pg_temp.h('APP-001')),
  '21+ contribution_on_prior_version: a contribution on v1 of a since-revised element');
select ok(not pg_temp.hf('contribution_on_prior_version', pg_temp.h('KNW-001')),
  '21- a contribution on the current version');

select ok(pg_temp.fires('e0000000-0000-4000-8000-000000000001', 'method_basis_superseded',
                        'e0000000-0000-4000-8000-000000000001'),
  '22+ method_basis_superseded: Meridian''s open application started under a release that has moved');
select ok(not pg_temp.fires('e0000000-0000-4000-8000-000000000003', 'method_basis_superseded',
                            'e0000000-0000-4000-8000-000000000003'),
  '22- Harbor has no open application');

select ok(not pg_temp.mf('approval_behind_published', pg_temp.m('CAP-001')),
  '23- approval_behind_published: CAP-001''s latest version is the approved one');
select pg_temp.revise(pg_temp.m('CAP-001'), 'The district''s ability to acquire and hold sites at pace.');
select ok(pg_temp.mf('approval_behind_published', pg_temp.m('CAP-001')),
  '23+ a substantive revision published after the approved version');

-- -----------------------------------------------------------------------------
-- Exposure
-- -----------------------------------------------------------------------------
select ok(not pg_temp.mf('dependencies_converge', pg_temp.m('APP-003')),
  '24- dependencies_converge: one blocking dependency is not convergence');
select pg_temp.el('f7000000-0000-4000-8000-000000000002', 'dependency', 'Council seat before board', 'architect_judgment');
insert into public.dependencies (element_id, from_element_id, to_element_id, dependency_type, blocking)
values ('f7000000-0000-4000-8000-000000000002', pg_temp.m('APP-005'), pg_temp.m('APP-003'), 'prerequisite', true);
select ok(pg_temp.mf('dependencies_converge', pg_temp.m('APP-003')),
  '24+ two blocking, unsatisfied dependencies on one element');

select ok(not pg_temp.mf('escalation_before_review', pg_temp.m('RSK-001')),
  '25- escalation_before_review: no scheduled Review examines what RSK-001 threatens');
select pg_temp.el('f7000000-0000-4000-8000-000000000003', 'risk', 'Partner withdrawal', 'architect_judgment',
  'e0000000-0000-4000-8000-000000000003');
insert into public.risks (element_id, category, probability, impact, mitigation)
values ('f7000000-0000-4000-8000-000000000003', 'external', 3, 4, 'Two partners per seat.');
select pg_temp.rel('f7000000-0000-4000-8000-000000000003', 'threatens', pg_temp.h('APP-001'));
insert into public.intelligence_escalations (engagement_id, element_id, level, reason)
values ('e0000000-0000-4000-8000-000000000003', 'f7000000-0000-4000-8000-000000000003', 'principal_architect',
        'Partners signalled they may withdraw.');
select ok(pg_temp.hf('escalation_before_review', 'f7000000-0000-4000-8000-000000000003'),
  '25+ an open escalation on a risk threatening an element REV-002 examines');
select is((select tier from public.edge_items('e0000000-0000-4000-8000-000000000003')
           where rule_key = 'escalation_before_review'), 'human_flagged',
  '25  human-flagged because an escalation is a human act');

select ok(not pg_temp.mf('materialized_risk_still_threatens', pg_temp.m('RSK-002')),
  '26- materialized_risk_still_threatens: RSK-002 has not materialized');
select private.begin_architecture_operation();
update public.risks set risk_status = 'materialized' where element_id = pg_temp.m('RSK-002');
select private.end_architecture_operation();
select ok(pg_temp.mf('materialized_risk_still_threatens', pg_temp.m('RSK-002')),
  '26+ a materialized risk still threatening a live element');

-- -----------------------------------------------------------------------------
-- Potential
-- -----------------------------------------------------------------------------
select ok(not pg_temp.mf('opportunity_advances_unrealized', pg_temp.m('OPP-001')),
  '27- opportunity_advances_unrealized: OPP-001 advances an Intended Outcome only');
select pg_temp.rel(pg_temp.m('OPP-001'), 'advances', pg_temp.m('CAP-001'));  -- CAP-002 now has the desk
select ok(pg_temp.mf('opportunity_advances_unrealized', pg_temp.m('OPP-001')),
  '27+ an open opportunity advancing a Capability no initiative implements');

select pg_temp.el('f7000000-0000-4000-8000-000000000004', 'opportunity', 'Shared lab consortium', 'architect_judgment');
insert into public.opportunities (element_id, category, value, feasibility, pursuit_approach, opportunity_status)
values ('f7000000-0000-4000-8000-000000000004', 'partnership', 3, 3, 'Convene the anchor tenants.', 'evaluating');
select ok(pg_temp.mf('opportunity_without_carrier', 'f7000000-0000-4000-8000-000000000004'),
  '28+ opportunity_without_carrier: evaluating with no pursues');
select pg_temp.rel(pg_temp.m('CAP-001'), 'pursues', 'f7000000-0000-4000-8000-000000000004');
select ok(not pg_temp.mf('opportunity_without_carrier', 'f7000000-0000-4000-8000-000000000004'),
  '28- once a capability pursues it');

-- -----------------------------------------------------------------------------
-- Learning
-- -----------------------------------------------------------------------------
select ok(not pg_temp.hf('repeated_realization_difficulty', pg_temp.h('APP-001')),
  '29- repeated_realization_difficulty: no difficulty recorded yet');
select public.update_implementation_status(pg_temp.h('IMP-003'), 'stalled', 'Partners paused.');
select public.update_implementation_status(pg_temp.h('IMP-003'), 'in_progress', 'Resumed.');
select ok(not pg_temp.hf('repeated_realization_difficulty', pg_temp.h('APP-001')), '29- one difficulty is not repetition');
select public.update_implementation_status(pg_temp.h('IMP-003'), 'stalled', 'Paused again.');
select ok(pg_temp.hf('repeated_realization_difficulty', pg_temp.h('APP-001')),
  '29+ two recorded difficulties on what implements APP-001');
select is((select epistemic_status from public.edge_items('e0000000-0000-4000-8000-000000000003')
           where rule_key = 'repeated_realization_difficulty'), 'worth_considering',
  '29  worded as worth considering: recurrence is not cause');

select ok(pg_temp.fires('e0000000-0000-4000-8000-000000000003', 'application_outputs_absent',
                        (select id from public.method_applications where engagement_id = 'e0000000-0000-4000-8000-000000000003')),
  '30+ application_outputs_absent: Harbor''s completed application lacks a declared output');
select ok(not pg_temp.fires('e0000000-0000-4000-8000-000000000001', 'application_outputs_absent',
                            (select id from public.method_applications where engagement_id = 'e0000000-0000-4000-8000-000000000001')),
  '30- Meridian''s application is still in progress');

select ok(pg_temp.fires('e0000000-0000-4000-8000-000000000003', 'application_instrument_evidence_absent',
                        (select id from public.method_applications where engagement_id = 'e0000000-0000-4000-8000-000000000003')),
  '31+ application_instrument_evidence_absent: no gathered evidence cites the declared Instrument');
select ok(not pg_temp.fires('e0000000-0000-4000-8000-000000000001', 'application_instrument_evidence_absent',
                            (select id from public.method_applications where engagement_id = 'e0000000-0000-4000-8000-000000000001')),
  '31- an application still in progress');

-- -----------------------------------------------------------------------------
-- 10 and 16 last: they revise and retire shared seed records.
-- -----------------------------------------------------------------------------
select ok(not pg_temp.hf('implements_replaced_element', pg_temp.h('IMP-002')),
  '10- implements_replaced_element: KNW-001 is live');
select ok(pg_temp.hf('criteria_predate_revision', pg_temp.h('IMP-001')) is false,
  '16- criteria are subjects by their own id, never the initiative''s');
select pg_temp.revise(pg_temp.h('IMP-001'), 'Stands up the council with partner seats.');
select ok(pg_temp.hf('criteria_predate_revision',
                     (select id from public.acceptance_criteria where reference_code = 'ACR-001'
                        and engagement_id = 'e0000000-0000-4000-8000-000000000003')),
  '16+ an agreed criterion whose governed element was substantively revised after agreement');
select public.retire_element(pg_temp.h('KNW-001'), 'Folded into the council''s charter for the rule tests.');
select ok(pg_temp.hf('implements_replaced_element', pg_temp.h('IMP-002')),
  '10+ an initiative that implements a retired element');

select * from finish();

rollback;
