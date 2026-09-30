-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 1 of 11.
-- The rule catalog and the governed relationship-impact matrix.
--
-- Decisions: ADR-0051 (envelope and catalog), ADR-0055 (impact matrix).
-- Proposal: docs/product/PHASE_7A_PROPOSAL.md §5 and §10.
--
-- Nothing here stores an intelligence conclusion. The catalog describes the
-- rules; conclusions are computed on read by public.edge_items (ADR-0032).
-- Catalog keys are text with check constraints wherever they are stored,
-- never enums, so rules stay revisable while they are tuned (§5.1).
--
-- Mirrors: src/domain/edge/rules.ts (rules.test.ts) and
--          src/domain/edge/impact-matrix.ts (impact-matrix.test.ts).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The rule catalog: 31 new rules (§5.2), then the 11 Phase 4 and Phase 5
--    rules consumed unchanged (§5.3). 42 rows.
--    change_reaches is a consequence type, not a condition, and has no row.
-- -----------------------------------------------------------------------------
create function private.edge_rules()
returns table (
  rule_key          text,
  candidate         text,
  origin            text,
  home              text,
  lens              text,
  epistemic_status  text,
  subject_type      text,
  trigger_type      text,
  time_basis        text,
  substantive_only  boolean,
  list_tier         text,
  resolving_act     text,
  scope             text,
  thresholds        text
)
language sql
immutable
set search_path = ''
as $$
  select * from (values
    ('statement_contradicted_by_evidence', 'D-03', 'new', 'architecture', 'integrity', 'derived', 'element',
     'evidence_link', 'system_time', false, 'ambient', 'revise_statement_or_validate',
     'Published element with a statement carrying contradicting evidence',
     null),
    ('relationship_to_replaced_element', 'D-05', 'new', 'architecture', 'integrity', 'derived', 'element',
     'state', 'none', false, 'attention', 'retire_or_repoint_relationship',
     'Live element with an unretired relationship to a superseded or retired element',
     null),
    ('conflict_unresolved', 'D-06', 'new', 'architecture', 'integrity', 'recorded', 'element',
     'state', 'none', false, 'attention', 'retire_conflict_or_judge',
     'Unretired conflicts_with between two published elements',
     null),
    ('methodology_derived_without_model', 'D-08', 'new', 'architecture', 'integrity', 'recorded', 'element',
     'state', 'none', false, 'attention', 'record_method_lineage',
     'Live element or statement with methodology-derived provenance and no instantiates lineage',
     null),
    ('measurement_gap', 'D-09', 'new', 'architecture', 'integrity', 'derived', 'element',
     'state', 'none', false, 'ambient', 'relate_metric',
     'Published Intended Outcome without measured_by, or published Metric that measures nothing',
     null),
    ('capability_serves_no_outcome', 'D-10', 'new', 'architecture', 'integrity', 'derived', 'element',
     'state', 'none', false, 'attention', 'relate_outcome',
     'Published Capability that serves no Intended Outcome, directly or through its part_of ancestors',
     null),
    ('governance_allocation_gap', 'D-11', 'new', 'architecture', 'integrity', 'derived', 'element',
     'state', 'none', false, 'attention', 'relate_governance',
     'Published Decision Right with no holder, or published Governance Body that governs nothing',
     'body_governs_nothing is Ambient only (narrowed)'),
    ('approved_without_pathway', 'D-12', 'new', 'architecture', 'realization', 'derived', 'element',
     'state', 'none', false, 'attention', 'create_pathway',
     'Published Capability or Application Format with no implements on it or its part_of descendants (depth 2), and for a Capability no implemented_through',
     'part_of descendants to depth 2'),
    ('operational_not_validated', 'D-13', 'new', 'implementation', 'realization', 'recorded', 'element',
     'status_change', 'system_time', false, 'attention', 'validate_through_review',
     'Live initiative with status operational and no validates',
     null),
    ('implements_replaced_element', 'D-14', 'new', 'implementation', 'realization', 'derived', 'element',
     'state', 'none', false, 'attention', 'repoint_implements',
     'Live initiative that implements a superseded or retired element',
     null),
    ('implemented_element_revised', 'D-15', 'new', 'implementation', 'realization', 'derived', 'element',
     'substantive_revision', 'system_time', true, 'attention', 'review_after_revision',
     'Initiative not started, in progress, stalled or operational whose implemented element was substantively revised after implements was recorded',
     null),
    ('validated_element_revised', 'D-16', 'new', 'implementation', 'realization', 'derived', 'element',
     'substantive_revision', 'system_time', true, 'attention', 'review_after_revision',
     'Validated initiative whose implemented element was substantively revised after the validation',
     null),
    ('realization_without_evidence', 'D-17', 'new', 'implementation', 'realization', 'derived', 'element',
     'state', 'none', false, 'attention', 'link_realization_evidence',
     'Operational or validated initiative with no evidence link and no checkpoint achieved with evidence',
     null),
    ('checkpoint_past_target', 'D-19', 'new', 'implementation', 'realization', 'recorded', 'element',
     'date', 'business_date', false, 'attention', 'achieve_or_retarget_checkpoint',
     'Live initiative with a checkpoint not achieved whose target is before the business date',
     null),
    ('criteria_without_review_path', 'D-20', 'new', 'implementation', 'realization', 'derived', 'element',
     'state', 'none', false, 'attention', 'schedule_review',
     'Live initiative with agreed criteria in force and no scheduled or held Review examining it or what it implements',
     null),
    ('criteria_predate_revision', 'D-04', 'new', 'criteria', 'change', 'derived', 'acceptance_criterion',
     'substantive_revision', 'system_time', true, 'attention', 'supersede_criterion',
     'Agreed criterion in force whose governed element was substantively revised after agreed_recorded_at; no item when the agreement time was not recorded',
     null),
    ('examined_element_revised_since_review', 'D-21', 'new', 'review', 'change', 'derived', 'element',
     'substantive_revision', 'exact_version', true, 'attention', 'later_review',
     'Held Review whose captured examined version is behind a later substantive version; Reviews held before 7A only through their frozen baseline',
     null),
    ('evidence_after_review', 'D-22', 'new', 'review', 'change', 'derived', 'element',
     'evidence_link', 'system_time', false, 'ambient', 'later_review',
     'Held Review with a capture, where evidence was linked to a captured element after the capture',
     'Attention when any link contradicts; Ambient otherwise'),
    ('decision_not_reflected', 'D-23', 'new', 'intelligence', 'change', 'derived', 'element',
     'decision', 'system_time', true, 'attention', 'revise_affected_element',
     'Decided decision recorded after the latest content version of an element it affects',
     null),
    ('deliverable_documents_revised', 'D-24', 'new', 'deliverable', 'change', 'derived', 'element',
     'substantive_revision', 'exact_version', true, 'attention', 'new_deliverable_version',
     'Live Deliverable documenting an element revised after the version in its baseline, or without a baseline, after its latest approval',
     null),
    ('contribution_on_prior_version', 'D-25', 'new', 'intelligence', 'change', 'derived', 'element',
     'substantive_revision', 'exact_version', true, 'attention', 'handle_contribution',
     'Unhandled client contribution made on a version that has since been substantively revised',
     null),
    ('method_basis_superseded', 'D-26, D-27', 'new', 'practice', 'change', 'recorded', 'method_application',
     'state', 'none', false, 'ambient', 'none_required_method',
     'Open Method Application pinned to a superseded Method version; or open applications started under a DAM release that is not the engagement''s or not the latest',
     'pinned_version_superseded Ambient; release_moved Attention, one engagement-level item'),
    ('approval_behind_published', 'D-28', 'new', 'architecture', 'change', 'derived', 'element',
     'substantive_revision', 'exact_version', true, 'attention', 'request_latest_approval',
     'Element whose latest approved version is behind its latest published version, with a substantive revision between',
     'Ambient while an approval request on the latest version is pending'),
    ('dependencies_converge', 'D-31', 'new', 'intelligence', 'exposure', 'derived', 'element',
     'status_change', 'system_time', false, 'attention', 'satisfy_dependency',
     'Live element that is the depended-on end of two or more blocking, unsatisfied dependencies',
     '2 or more converging dependencies'),
    ('escalation_before_review', 'D-32', 'new', 'intelligence', 'exposure', 'derived', 'element',
     'state', 'none', false, 'attention', 'resolve_escalation_or_hold',
     'Open escalation on a risk that threatens an element a scheduled Review examines',
     'Always shown in the escalated tier, because an escalation is a human act'),
    ('materialized_risk_still_threatens', 'D-33', 'new', 'intelligence', 'exposure', 'derived', 'element',
     'status_change', 'system_time', false, 'attention', 'revise_threatened',
     'Risk recorded as materialized with an unretired threatens to a live element',
     null),
    ('opportunity_advances_unrealized', 'D-37', 'new', 'intelligence', 'potential', 'worth_considering', 'element',
     'state', 'none', false, 'attention', 'decide_pursuit',
     'Open opportunity that advances a Capability or Application Format no initiative implements',
     null),
    ('opportunity_without_carrier', 'D-39', 'new', 'intelligence', 'potential', 'derived', 'element',
     'state', 'none', false, 'attention', 'relate_carrier',
     'Opportunity being evaluated with no pursues from any capability, decision or recommendation',
     null),
    ('repeated_realization_difficulty', 'D-40', 'new', 'implementation', 'learning', 'worth_considering', 'element',
     'status_change', 'system_time', false, 'attention', 'examine_architecture',
     'Element whose implementing initiatives record two or more transitions into stalled or abandoned, or reopenings',
     '2 or more difficulties'),
    ('application_outputs_absent', 'D-41', 'new', 'practice', 'learning', 'derived', 'method_application',
     'state', 'none', false, 'attention', 'record_outputs',
     'Completed Method Application with a declared output that has no produced link',
     null),
    ('application_instrument_evidence_absent', 'D-42', 'new', 'practice', 'learning', 'derived', 'method_application',
     'state', 'none', false, 'attention', 'link_gathered_evidence',
     'Completed or discontinued Method Application whose Method declares an Instrument no gathered evidence cites',
     null),
    ('assumption_unvalidated_underpins_published', 'D-02', 'existing', 'intelligence', 'integrity', 'derived', 'element',
     'status_change', 'none', false, 'attention', 'validate_assumption',
     'Live assumption, unvalidated or validating, underpinning published architecture',
     null),
    ('assumption_invalidated_still_underpins', 'D-01', 'existing', 'intelligence', 'integrity', 'derived', 'element',
     'status_change', 'none', false, 'attention', 'revise_underpinned',
     'Live assumption recorded as invalidated, still underpinning live architecture',
     null),
    ('risk_high_without_mitigation', 'D-29', 'existing', 'intelligence', 'exposure', 'derived', 'element',
     'state', 'none', false, 'attention', 'relate_mitigation',
     'Live risk, open or mitigating, with no mitigates',
     'Severity 15 or more'),
    ('dependency_blocking_unsatisfied', 'D-30', 'existing', 'intelligence', 'exposure', 'derived', 'element',
     'status_change', 'none', false, 'attention', 'satisfy_dependency',
     'Live blocking dependency, not satisfied, whose dependent end is published',
     null),
    ('decision_past_needed_by', 'D-36', 'existing', 'intelligence', 'exposure', 'recorded', 'element',
     'date', 'business_date', false, 'attention', 'record_decision',
     'Live decision, open or recommended',
     null),
    ('opportunity_window_closing', 'D-36', 'existing', 'intelligence', 'potential', 'recorded', 'element',
     'date', 'business_date', false, 'attention', 'decide_pursuit',
     'Live opportunity, identified or evaluating',
     'Window closing within 30 days'),
    ('opportunity_window_closed', 'D-36', 'existing', 'intelligence', 'potential', 'recorded', 'element',
     'date', 'business_date', false, 'attention', 'update_opportunity',
     'Live opportunity, drafts included, identified, evaluating or pursuing',
     null),
    ('review_overdue', 'D-36', 'existing', 'intelligence', 'exposure', 'recorded', 'element',
     'date', 'business_date', false, 'attention', 'review_record',
     'Live record with a stewardship review date, not in a terminal status',
     null),
    ('client_action_overdue', 'D-36', 'existing', 'intelligence', 'exposure', 'recorded', 'client_action',
     'date', 'business_date', false, 'attention', 'follow_up_action',
     'Open client action',
     null),
    ('record_untriaged', 'D-36', 'existing', 'intelligence', 'exposure', 'recorded', 'element',
     'date', 'business_date', false, 'attention', 'triage_record',
     'Live record untriaged',
     'Untriaged for more than 7 days'),
    ('implementation_past_target', 'D-18', 'existing', 'implementation', 'realization', 'recorded', 'element',
     'date', 'business_date', false, 'attention', 'retarget_initiative',
     'Live initiative not started, in progress or operational',
     null)
  ) as c (rule_key, candidate, origin, home, lens, epistemic_status, subject_type, trigger_type, time_basis,
          substantive_only, list_tier, resolving_act, scope, thresholds);
$$;

comment on function private.edge_rules() is
  'Phase 7A rule catalog (ADR-0051). 31 new rules and the 11 existing Phase 4/5 signal rules. Mirrored in src/domain/edge/rules.ts.';

-- The catalog for internal readers (the UI and the mirror tests).
create function public.edge_rule_catalog()
returns table (
  rule_key          text,
  candidate         text,
  origin            text,
  home              text,
  lens              text,
  epistemic_status  text,
  subject_type      text,
  trigger_type      text,
  time_basis        text,
  substantive_only  boolean,
  list_tier         text,
  resolving_act     text,
  scope             text,
  thresholds        text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from private.edge_rules() c where private.is_internal();
$$;

revoke all on function private.edge_rules() from public, anon, authenticated;
revoke all on function public.edge_rule_catalog() from public, anon;
grant execute on function public.edge_rule_catalog() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. The relationship-impact direction matrix (reconciliation §13.4).
--    One row per link and direction: the 39 relationship types and the
--    off-spine links. source_to_target answers "if the source changes, may the
--    target warrant examination?"; target_to_source answers the reverse.
--    Written only by migrations; read by internal users.
-- -----------------------------------------------------------------------------
create table public.relationship_impact_rules (
  link_key       text not null check (link_key ~ '^[a-z][a-z_]*$'),
  direction      text not null check (direction in ('source_to_target', 'target_to_source')),
  assessment     text not null check (assessment in ('yes', 'weak', 'no')),
  propagation    text not null check (propagation in ('direct', 'recursive', 'terminal', 'never')),
  max_depth      int  not null check (max_depth between 0 and 2),
  edge_eligible  boolean generated always as (assessment = 'yes' and propagation <> 'never') stored,
  hub_target     boolean not null default false,
  condition      text check (condition is null or condition ~ '^[a-z][a-z_]*$'),
  reason         text not null check (char_length(btrim(reason)) between 1 and 300),
  primary key (link_key, direction),
  constraint relationship_impact_rules_depth check (
    (propagation = 'never' and max_depth = 0)
    or (propagation in ('direct', 'terminal') and max_depth = 1)
    or (propagation = 'recursive' and max_depth = 2)
  ),
  constraint relationship_impact_rules_never_no check (assessment <> 'no' or propagation = 'never')
);

comment on table public.relationship_impact_rules is
  'Governed relationship-impact direction matrix (ADR-0055, reconciliation §13.4). Written only by migrations. Mirrored in src/domain/edge/impact-matrix.ts.';

insert into public.relationship_impact_rules
  (link_key, direction, assessment, propagation, max_depth, hub_target, condition, reason)
values
  ('part_of', 'source_to_target', 'weak', 'direct', 1, false, null,
   'A changed part rarely invalidates the whole'),
  ('part_of', 'target_to_source', 'yes', 'recursive', 2, true, null,
   'A changed whole changes the frame its parts were designed for'),
  ('specializes', 'source_to_target', 'no', 'never', 0, false, null,
   'A specialization does not redefine its general concept'),
  ('specializes', 'target_to_source', 'yes', 'recursive', 2, false, null,
   'A specialization inherits the definition of its general concept'),
  ('precedes', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A later stage assumes the earlier one'),
  ('precedes', 'target_to_source', 'no', 'never', 0, false, null,
   'A later stage does not change the earlier one'),
  ('gap_in', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A reassessed gap may change the capability or area'),
  ('gap_in', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A revised capability or area may close or change the gap'),
  ('investigates', 'source_to_target', 'yes', 'direct', 1, false, null,
   'An answered question tests its target'),
  ('investigates', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed target may make the question obsolete'),
  ('informs', 'source_to_target', 'yes', 'direct', 1, true, null,
   'The target''s design or justification drew on the source'),
  ('informs', 'target_to_source', 'no', 'never', 0, false, null,
   'What was informed does not change its source'),
  ('serves', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A changed server may change how the outcome is achieved'),
  ('serves', 'target_to_source', 'yes', 'direct', 1, true, null,
   'A changed outcome may remove the purpose of what serves it'),
  ('shapes', 'source_to_target', 'yes', 'direct', 1, false, null,
   'Strategic logic materially influences the design it shapes'),
  ('shapes', 'target_to_source', 'no', 'never', 0, false, null,
   'Shaped design does not change the logic'),
  ('implies', 'source_to_target', 'yes', 'direct', 1, false, null,
   'The implication is a consequence of the source'),
  ('implies', 'target_to_source', 'no', 'never', 0, false, null,
   'An implication does not change its source'),
  ('exploits', 'source_to_target', 'no', 'never', 0, false, null,
   'What exploits a lever does not change the lever'),
  ('exploits', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed lever changes what exploits it'),
  ('positioned_against', 'source_to_target', 'no', 'never', 0, false, null,
   'Positioning does not change the competitive factor'),
  ('positioned_against', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed competitive factor changes the positioning'),
  ('requires', 'source_to_target', 'weak', 'direct', 1, false, null,
   'A changed requirer may no longer need what it requires'),
  ('requires', 'target_to_source', 'yes', 'recursive', 2, false, null,
   'A changed prerequisite affects everything that requires it'),
  ('implemented_through', 'source_to_target', 'yes', 'direct', 1, false, null,
   'The capability and the way it operates must stay aligned'),
  ('implemented_through', 'target_to_source', 'yes', 'direct', 1, false, null,
   'The operating form and the capability must stay aligned'),
  ('delivered_through', 'source_to_target', 'weak', 'direct', 1, false, null,
   'A changed format may change its channel'),
  ('delivered_through', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed channel changes how value reaches beneficiaries'),
  ('measured_by', 'source_to_target', 'yes', 'direct', 1, false, null,
   'The measure may no longer fit a changed source'),
  ('measured_by', 'target_to_source', 'weak', 'direct', 1, false, null,
   'A changed metric changes how performance is observed'),
  ('governed_by', 'source_to_target', 'weak', 'direct', 1, false, null,
   'A changed element may change what its governance covers'),
  ('governed_by', 'target_to_source', 'yes', 'direct', 1, true, null,
   'Changed authority changes what it governs'),
  ('holds', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A changed holder changes how authority is allocated'),
  ('holds', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed decision right changes what its holder holds'),
  ('accountable_for', 'source_to_target', 'yes', 'direct', 1, false, null,
   'Who answers for the element changed'),
  ('accountable_for', 'target_to_source', 'yes', 'direct', 1, false, null,
   'What someone answers for changed'),
  ('introduces', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A changed stage changes when its targets enter'),
  ('introduces', 'target_to_source', 'no', 'never', 0, false, null,
   'What a stage introduces does not change the stage'),
  ('bounded_by', 'source_to_target', 'no', 'never', 0, false, null,
   'An element does not move its boundary'),
  ('bounded_by', 'target_to_source', 'yes', 'direct', 1, true, null,
   'A moved boundary may place elements outside it'),
  ('subject_to', 'source_to_target', 'no', 'never', 0, false, null,
   'A subject does not change the regulation'),
  ('subject_to', 'target_to_source', 'yes', 'direct', 1, true, null,
   'A changed regulation applies to its subjects'),
  ('documented_by', 'source_to_target', 'no', 'never', 0, false, null,
   'Documentation practice, not design'),
  ('documented_by', 'target_to_source', 'weak', 'direct', 1, false, null,
   'A changed protocol may change how the element is documented'),
  ('has_stake_in', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A changed stakeholder alters the interests in the element'),
  ('has_stake_in', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed element alters the stake'),
  ('underpins', 'source_to_target', 'yes', 'direct', 1, false, 'recurse_when_invalidated',
   'The target holds only if the assumption is true'),
  ('underpins', 'target_to_source', 'weak', 'direct', 1, false, null,
   'A changed target may change what the assumption must carry'),
  ('threatens', 'source_to_target', 'yes', 'direct', 1, false, null,
   'Changed severity or a materialized risk bears on the target'),
  ('threatens', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed target may change the risk assessment'),
  ('constrains', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A lifted or relaxed constraint frees the target'),
  ('constrains', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed target needs a compliance check'),
  ('mitigates', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A changed mitigation changes the exposure'),
  ('mitigates', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed risk changes whether the mitigation suffices'),
  ('affects', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A decision''s outcome changes its targets'),
  ('affects', 'target_to_source', 'weak', 'direct', 1, false, null,
   'A changed target may reopen the record'),
  ('addresses', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A changed recommendation changes what it addresses'),
  ('addresses', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed target may make the recommendation obsolete'),
  ('advances', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A changed window or status bears on what it would advance'),
  ('advances', 'target_to_source', 'weak', 'direct', 1, false, null,
   'A changed target may change the opportunity''s value'),
  ('pursues', 'source_to_target', 'yes', 'direct', 1, false, null,
   'The pursuer and the opportunity must stay aligned'),
  ('pursues', 'target_to_source', 'yes', 'direct', 1, false, null,
   'The opportunity and its pursuer must stay aligned'),
  ('supersedes', 'source_to_target', 'no', 'never', 0, false, null,
   'Supersession is an event, not an impact path'),
  ('supersedes', 'target_to_source', 'no', 'never', 0, false, null,
   'Supersession is an event, not an impact path'),
  ('conflicts_with', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A recognized tension may be resolved or worsened by either side'),
  ('conflicts_with', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A recognized tension may be resolved or worsened by either side'),
  ('examines', 'source_to_target', 'no', 'never', 0, false, null,
   'A Review does not change what it examines'),
  ('examines', 'target_to_source', 'yes', 'terminal', 1, false, null,
   'An examined element revised after the Review dates its judgment'),
  ('raises', 'source_to_target', 'no', 'never', 0, false, null,
   'Provenance of where a record came from'),
  ('raises', 'target_to_source', 'no', 'never', 0, false, null,
   'Provenance of where a record came from'),
  ('documents', 'source_to_target', 'no', 'never', 0, false, null,
   'A Deliverable does not change what it documents'),
  ('documents', 'target_to_source', 'yes', 'terminal', 1, false, 'excludes_superseded_deliverables',
   'A documented element revised after the Deliverable''s reference point'),
  ('implements', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A changed initiative changes the element''s realization'),
  ('implements', 'target_to_source', 'yes', 'terminal', 1, false, null,
   'A revised design may leave reality tracking an older one'),
  ('initiates', 'source_to_target', 'yes', 'direct', 1, false, null,
   'A changed decision or recommendation questions the initiative it started'),
  ('initiates', 'target_to_source', 'weak', 'direct', 1, false, null,
   'An abandoned initiative leaves its decision unrealized'),
  ('validates', 'source_to_target', 'no', 'never', 0, false, null,
   'Validation is a dated judgment, reached through implements'),
  ('validates', 'target_to_source', 'no', 'never', 0, false, null,
   'Validation is a dated judgment, reached through implements'),
  ('dependency_ends', 'source_to_target', 'weak', 'direct', 1, false, null,
   'A changed dependent end rarely changes what it depends on'),
  ('dependency_ends', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A changed depended-on element bears on the dependent'),
  ('statement_evidence_links', 'source_to_target', 'no', 'never', 0, false, null,
   'A claim does not change its evidence'),
  ('statement_evidence_links', 'target_to_source', 'yes', 'direct', 1, false, 'on_demand_join_only',
   'New or changed evidence bears on the claim'),
  ('element_evidence_links', 'source_to_target', 'no', 'never', 0, false, null,
   'An element does not change its evidence'),
  ('element_evidence_links', 'target_to_source', 'yes', 'direct', 1, false, 'on_demand_join_only',
   'New or changed evidence bears on the element'),
  ('checkpoint_support', 'source_to_target', 'no', 'never', 0, false, null,
   'A checkpoint does not change its support'),
  ('checkpoint_support', 'target_to_source', 'yes', 'direct', 1, false, null,
   'The support for an achieved checkpoint changed'),
  ('acceptance_criteria_governed', 'source_to_target', 'no', 'never', 0, false, null,
   'A criterion does not change what it governs'),
  ('acceptance_criteria_governed', 'target_to_source', 'yes', 'terminal', 1, false, 'agreed_in_force',
   'A revised governed element may leave agreed criteria out of step'),
  ('validation_criteria', 'source_to_target', 'no', 'never', 0, false, null,
   'A frozen capture of what was in force'),
  ('validation_criteria', 'target_to_source', 'no', 'never', 0, false, null,
   'A frozen capture of what was in force'),
  ('baseline_items', 'source_to_target', 'no', 'never', 0, false, null,
   'Frozen reference points; a comparison basis, not an impact path'),
  ('baseline_items', 'target_to_source', 'no', 'never', 0, false, null,
   'Frozen reference points; a comparison basis, not an impact path'),
  ('approval_version', 'source_to_target', 'no', 'never', 0, false, null,
   'An approval does not change the version'),
  ('approval_version', 'target_to_source', 'yes', 'direct', 1, false, null,
   'A later substantive version leaves the approval behind'),
  ('client_action_subjects', 'source_to_target', 'no', 'never', 0, false, null,
   'A client action does not change its subject'),
  ('client_action_subjects', 'target_to_source', 'yes', 'terminal', 1, false, 'open_actions_only',
   'A client may be answering about content that has since changed'),
  ('contribution_version', 'source_to_target', 'no', 'never', 0, false, null,
   'A contribution does not change the version'),
  ('contribution_version', 'target_to_source', 'yes', 'direct', 1, false, 'unhandled_only',
   'Unhandled input on an older version'),
  ('method_application_elements', 'source_to_target', 'no', 'never', 0, false, null,
   'Method work never changes architecture'),
  ('method_application_elements', 'target_to_source', 'yes', 'direct', 1, false, 'open_examined_only',
   'An open application examining a changed element may need to re-examine it'),
  ('method_application_evidence', 'source_to_target', 'no', 'never', 0, false, null,
   'A practice record, not engagement impact'),
  ('method_application_evidence', 'target_to_source', 'weak', 'direct', 1, false, 'internal_practice_only',
   'A practice record, not engagement impact'),
  ('element_method_lineage', 'source_to_target', 'no', 'never', 0, false, null,
   'Architecture does not change the Method'),
  ('element_method_lineage', 'target_to_source', 'weak', 'direct', 1, false, 'internal_practice_only',
   'A Method superseded after use is practice awareness, never architecture impact'),
  ('dam_release', 'source_to_target', 'no', 'never', 0, false, null,
   'An engagement does not change its release'),
  ('dam_release', 'target_to_source', 'yes', 'direct', 1, false, 'internal_practice_only',
   'A superseded release is practice awareness'),
  ('intelligence_record_domains', 'source_to_target', 'no', 'never', 0, false, null,
   'Domain scope is too broad to carry impact'),
  ('intelligence_record_domains', 'target_to_source', 'no', 'never', 0, false, null,
   'Domain scope is too broad to carry impact'),
  ('engagement_member_areas', 'source_to_target', 'no', 'never', 0, false, null,
   'Access scope, not impact'),
  ('engagement_member_areas', 'target_to_source', 'no', 'never', 0, false, null,
   'Access scope, not impact'),
  ('domain_assessments', 'source_to_target', 'no', 'never', 0, false, null,
   'A domain judgment does not change architecture'),
  ('domain_assessments', 'target_to_source', 'weak', 'direct', 1, false, 'ambient_domain_count',
   'Revisions after the latest judgment may warrant a new one; judgment is never computed');

-- Every relationship type has exactly one row per direction.
do $$
begin
  if exists (
    select 1 from public.relationship_types t
    cross join (values ('source_to_target'), ('target_to_source')) d(direction)
    where not exists (select 1 from public.relationship_impact_rules r
                      where r.link_key = t.key and r.direction = d.direction)
  ) then
    raise exception 'The impact matrix must cover every relationship type in both directions';
  end if;
end;
$$;

-- Only four walks recurse (§10.2): part_of, specializes and requires from
-- target to source, and underpins from an invalidated assumption.
do $$
begin
  if exists (
    select 1 from public.relationship_impact_rules
    where propagation = 'recursive'
      and (link_key, direction) not in (('part_of', 'target_to_source'), ('specializes', 'target_to_source'),
                                        ('requires', 'target_to_source'))
  ) then
    raise exception 'Only part_of, specializes and requires recurse';
  end if;
end;
$$;

alter table public.relationship_impact_rules enable row level security;
revoke all on public.relationship_impact_rules from anon, authenticated;
grant select on public.relationship_impact_rules to authenticated;
create policy "relationship impact rules: internal readers"
  on public.relationship_impact_rules for select to authenticated using (private.is_internal());
