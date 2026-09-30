-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 5 of 11.
-- The curated development-change read model (ADR-0057, proposal §13).
--
-- Classified developmental events across Phases 3 to 6, in system time, for
-- the Since You Were Away briefing. Built from the domain tables, and from
-- activity_log only where a domain table keeps no system time for the event
-- (element retirement actor, Review status, checkpoint achievement, Method
-- Application state). Like architecture_activity, it projects fields and
-- never returns metadata_json.
--
-- Excluded as noise or out of scope (§13.3): working-copy saves, stewardship
-- date and attention edits, dismissals and Edge judgments, membership and
-- capability changes, and every Phase 2 commercial event (ADR-0023).
-- architecture_activity is unchanged.
-- =============================================================================

create function public.development_changes(
  p_engagement_id uuid,
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_element_id uuid default null,
  p_limit integer default 200
)
returns table (
  occurred_at             timestamptz,
  change_type             text,
  subject_type            text,
  subject_id              uuid,
  subject_kind            text,
  reference_code          text,
  title                   text,
  version_id              uuid,
  version_no              int,
  related_type            text,
  related_id              uuid,
  related_reference_code  text,
  actor_name              text,
  summary                 text
)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    select private.can_read_architecture(p_engagement_id) as ok
  ),
  -- Log rows used where the domain tables keep no system time for the event.
  log as (
    select l.created_at, l.actor_user_id, l.entity_type, l.entity_id,
           l.metadata_json -> 'before' as b, l.metadata_json -> 'after' as r
    from public.activity_log l, allowed
    where allowed.ok and l.engagement_id = p_engagement_id and l.action_type = 'update'
      and l.entity_type in ('reviews', 'implementation_checkpoints', 'method_applications')
  ),
  changes (occurred_at, change_type, subject_type, subject_id, version_id, version_no, related_type, related_id,
           actor_user_id, summary) as (
    -- Publications, classified by §12.
    select v.published_at, r.change_type, 'element', r.element_id, r.version_id, r.version_no, null, null::uuid,
           v.published_by, nullif(btrim(r.change_summary), '')
    from private.element_revision_rows(p_engagement_id) r
    join public.element_versions v on v.id = r.version_id
    union all
    -- Retired elements.
    select e.retired_at, 'element_retired', 'element', e.id, null, null, null, null, e.updated_by, null
    from public.architecture_elements e
    where e.engagement_id = p_engagement_id and e.lifecycle = 'retired' and e.retired_at is not null
    union all
    -- Superseded elements, at the time the supersession was recorded.
    select rel.created_at, 'element_superseded', 'element', rel.target_element_id, null, null, 'element',
           rel.source_element_id, rel.created_by, null
    from public.architecture_relationships rel
    where rel.engagement_id = p_engagement_id and rel.relationship_type = 'supersedes'
    union all
    -- Relationships added and retired. Supersession and validation have
    -- their own change types.
    select rel.created_at, 'relationship_added', 'element', rel.source_element_id, null, null, 'element',
           rel.target_element_id, rel.created_by, rel.relationship_type
    from public.architecture_relationships rel
    where rel.engagement_id = p_engagement_id and rel.relationship_type not in ('supersedes', 'validates')
    union all
    select rel.retired_at, 'relationship_retired', 'element', rel.source_element_id, null, null, 'element',
           rel.target_element_id, rel.retired_by, rel.relationship_type
    from public.architecture_relationships rel
    where rel.engagement_id = p_engagement_id and rel.retired_at is not null
    union all
    -- Evidence linked, with its stance.
    select l.created_at, 'evidence_linked', 'element', s.element_id, null, null, 'evidence_source',
           l.evidence_source_id, l.created_by, l.stance::text
    from public.statement_evidence_links l
    join public.architecture_statements s on s.id = l.statement_id
    where l.engagement_id = p_engagement_id
    union all
    select l.created_at, 'evidence_linked', 'element', l.element_id, null, null, 'evidence_source',
           l.evidence_source_id, l.created_by, l.stance::text
    from public.element_evidence_links l
    where l.engagement_id = p_engagement_id
    union all
    -- Approvals requested and recorded.
    select a.requested_at, 'approval_requested', 'element', v.element_id, v.id, v.version_no, null, null,
           a.requested_by, null
    from public.architecture_approvals a
    join public.element_versions v on v.id = a.element_version_id
    where a.engagement_id = p_engagement_id and a.requested_at is not null and a.requested_by is not null
    union all
    select coalesce(a.recorded_at, a.responded_at), 'approval_recorded', 'element', v.element_id, v.id, v.version_no,
           null, null, coalesce(a.recorded_by, a.responded_by), a.response::text
    from public.architecture_approvals a
    join public.element_versions v on v.id = a.element_version_id
    where a.engagement_id = p_engagement_id and a.response is not null
      and coalesce(a.recorded_at, a.responded_at) is not null
    union all
    -- Baselines frozen.
    select b.frozen_at, 'baseline_frozen', 'baseline', b.id, null, null, null, null, b.frozen_by, b.label
    from public.architecture_baselines b
    where b.engagement_id = p_engagement_id and b.status = 'frozen' and b.frozen_at is not null
    union all
    -- Record status changes, with rationale: status fields only, never the
    -- values recorded at creation. A decision's status has its own types.
    select c.changed_at, 'record_status_changed', 'element', c.element_id, null, null, null, null, c.changed_by,
           c.from_value || ' → ' || c.to_value || coalesce(': ' || nullif(btrim(c.rationale), ''), '')
    from public.intelligence_status_changes c
    where c.engagement_id = p_engagement_id and c.from_value is not null
      and c.field in ('validation_status', 'risk_status', 'constraint_status', 'dependency_status',
                      'opportunity_status')
    union all
    select c.changed_at, 'decision_deferred', 'element', c.element_id, null, null, null, null, c.changed_by,
           nullif(btrim(c.rationale), '')
    from public.intelligence_status_changes c
    where c.engagement_id = p_engagement_id and c.field = 'decision_status' and c.to_value = 'deferred'
    union all
    select d.decided_at, 'decision_decided', 'element', d.element_id, null, null, null, null,
           coalesce(d.recorded_by, d.decided_by), null
    from public.decisions d
    where d.engagement_id = p_engagement_id and d.decided_at is not null
    union all
    -- Escalations opened and resolved.
    select x.raised_at, 'escalation_opened', 'element', x.element_id, null, null, null, null, x.raised_by, x.level::text
    from public.intelligence_escalations x where x.engagement_id = p_engagement_id
    union all
    select x.resolved_at, 'escalation_resolved', 'element', x.element_id, null, null, null, null, x.resolved_by,
           x.level::text
    from public.intelligence_escalations x where x.engagement_id = p_engagement_id and x.resolved_at is not null
    union all
    select x.raised_at, 'escalation_opened', 'element', x.element_id, null, null, null, null, x.raised_by, x.level::text
    from public.implementation_escalations x where x.engagement_id = p_engagement_id
    union all
    select x.resolved_at, 'escalation_resolved', 'element', x.element_id, null, null, null, null, x.resolved_by,
           x.level::text
    from public.implementation_escalations x where x.engagement_id = p_engagement_id and x.resolved_at is not null
    union all
    -- Client actions answered and contributions received.
    select r.responded_at, 'client_action_answered', 'client_action', r.action_id, null, null, null, null,
           r.responded_by, null
    from public.client_action_responses r where r.engagement_id = p_engagement_id
    union all
    select c.submitted_at, 'contribution_received', 'element', c.element_id, c.element_version_id,
           (select v.version_no from public.element_versions v where v.id = c.element_version_id),
           null, null, c.submitted_by, null
    from public.client_contributions c where c.engagement_id = p_engagement_id
    union all
    -- Reviews scheduled, held and cancelled, in system time (never held_at).
    select l.created_at,
           case l.r ->> 'review_status' when 'held' then 'review_held' when 'cancelled' then 'review_cancelled'
                else 'review_scheduled' end,
           'element', l.entity_id, null, null, null, null, l.actor_user_id, null
    from log l
    where l.entity_type = 'reviews'
      and (l.b ->> 'review_status') is distinct from (l.r ->> 'review_status')
    union all
    -- Validations recorded.
    select rel.created_at, 'validation_recorded', 'element', rel.target_element_id, null, null, 'element',
           rel.source_element_id, rel.created_by, null
    from public.architecture_relationships rel
    where rel.engagement_id = p_engagement_id and rel.relationship_type = 'validates'
    union all
    -- Implementation status changes, with rationale.
    select c.changed_at, 'implementation_status_changed', 'element', c.element_id, null, null, null, null,
           c.changed_by,
           c.from_value || ' → ' || c.to_value || coalesce(': ' || nullif(btrim(c.rationale), ''), '')
    from public.implementation_status_changes c
    where c.engagement_id = p_engagement_id and c.field = 'implementation_status' and c.from_value is not null
    union all
    -- Checkpoints achieved.
    select l.created_at, 'checkpoint_achieved', 'element', (l.r ->> 'implementation_element_id')::uuid, null, null,
           null, null, l.actor_user_id, l.r ->> 'title'
    from log l
    where l.entity_type = 'implementation_checkpoints'
      and l.b ->> 'achieved_on' is null and l.r ->> 'achieved_on' is not null
    union all
    -- Acceptance criteria: proposed, agreed (at agreed_recorded_at, never
    -- agreed_on), superseded and withdrawn.
    select c.created_at, 'criterion_proposed', 'acceptance_criterion', c.id, null, null, 'element',
           c.governed_element_id, c.created_by, null
    from public.acceptance_criteria c where c.engagement_id = p_engagement_id
    union all
    select c.agreed_recorded_at, 'criterion_agreed', 'acceptance_criterion', c.id, null, null, 'element',
           c.governed_element_id, c.agreed_recorded_by, null
    from public.acceptance_criteria c
    where c.engagement_id = p_engagement_id and c.agreed_recorded_at is not null
    union all
    select c.closed_at, 'criterion_' || c.state::text, 'acceptance_criterion', c.id, null, null, 'element',
           c.governed_element_id, null, nullif(btrim(c.closure_reason), '')
    from public.acceptance_criteria c
    where c.engagement_id = p_engagement_id and c.state in ('superseded', 'withdrawn') and c.closed_at is not null
    union all
    -- Method Applications started and closed (internal), and addenda.
    select l.created_at,
           case when l.r ->> 'state' in ('completed', 'discontinued') then 'application_closed'
                else 'application_started' end,
           'method_application', l.entity_id, null, null, null, null, l.actor_user_id, l.r ->> 'state'
    from log l
    where l.entity_type = 'method_applications'
      and (l.b ->> 'state') is distinct from (l.r ->> 'state')
      and l.r ->> 'state' in ('in_progress', 'completed', 'discontinued')
    union all
    select a.created_at, 'application_addendum', 'method_application', a.application_id, null, null, null, null,
           a.created_by, null
    from public.method_application_addenda a where a.engagement_id = p_engagement_id
  )
  select c.occurred_at, c.change_type, c.subject_type, c.subject_id,
         coalesce(e.kind::text, case c.subject_type when 'acceptance_criterion' then 'acceptance_criterion'
                                                    when 'method_application' then 'method_application'
                                                    when 'client_action' then 'client_action'
                                                    when 'baseline' then 'baseline' end),
         coalesce(e.reference_code, ac.reference_code, ma.reference_code, ca.reference_code),
         coalesce(e.title, ma.title, ca.title, b.label, left(ac.body, 120)),
         c.version_id, c.version_no, c.related_type, c.related_id,
         coalesce(re.reference_code, rs.title),
         private.person_name(c.actor_user_id),
         c.summary
  from changes c
  cross join allowed
  left join public.architecture_elements e on c.subject_type = 'element' and e.id = c.subject_id
  left join public.acceptance_criteria ac on c.subject_type = 'acceptance_criterion' and ac.id = c.subject_id
  left join public.method_applications ma on c.subject_type = 'method_application' and ma.id = c.subject_id
  left join public.client_actions ca on c.subject_type = 'client_action' and ca.id = c.subject_id
  left join public.architecture_baselines b on c.subject_type = 'baseline' and b.id = c.subject_id
  left join public.architecture_elements re on c.related_type = 'element' and re.id = c.related_id
  left join public.evidence_sources rs on c.related_type = 'evidence_source' and rs.id = c.related_id
  where allowed.ok
    and c.occurred_at is not null
    and (p_since is null or c.occurred_at > p_since)
    and (p_until is null or c.occurred_at <= p_until)
    and (p_element_id is null or c.subject_id = p_element_id or c.related_id = p_element_id)
  order by c.occurred_at desc, c.change_type, 6
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

revoke all on function public.development_changes(uuid, timestamptz, timestamptz, uuid, integer) from public, anon;
grant execute on function public.development_changes(uuid, timestamptz, timestamptz, uuid, integer) to authenticated;
