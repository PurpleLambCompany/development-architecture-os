-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 7 of 11.
-- The 31 new deterministic rules and the change_reaches consequence type.
--
-- Decisions: ADR-0051 (catalog), ADR-0052 (trigger keys), ADR-0053
-- (substantive revision), ADR-0054 (Review capture), ADR-0055 (impact).
-- Proposal §5.2 (the rules), §5.4 (fingerprints), §7.2 (trigger keys),
-- §10.5 (change_reaches), §11 (capture), §12 (substantive revision).
--
-- Every function here is private and unchecked: public.edge_items checks
-- private.can_read_architecture first and is the only caller. Each takes one
-- engagement and never reads another. Nothing is stored; every item is
-- computed on read.
--
-- Time (F1): change rules compare system time or exact versions only.
-- Business dates are used only by the anticipation rule
-- checkpoint_past_target. Revisions (F2): change rules act on substantive
-- revisions only (private.element_content_state).
-- =============================================================================

-- The common shape of a raw rule item, before the envelope adds the catalog,
-- tier, order facts and judgment.
create type private.edge_raw_item as (
  rule_key            text,
  variant             text,
  subject_type        text,
  subject_id          uuid,
  details             jsonb,
  basis               jsonb,
  trigger_type        text,
  trigger_subject_id  uuid,
  trigger_version_id  uuid,
  trigger_at          timestamptz,
  trigger_key         text,
  fingerprint         text,
  base_tier           text,
  consequence_path    jsonb
);

-- A basis reference to an element, with a version where one is compared.
create function private.edge_element_ref(p_element_id uuid, p_role text, p_version_id uuid default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'type', 'element', 'id', e.id, 'reference_code', e.reference_code, 'role', p_role,
    'version_id', p_version_id,
    'version_no', (select v.version_no from public.element_versions v where v.id = p_version_id)
  ))
  from public.architecture_elements e where e.id = p_element_id;
$$;

-- A basis reference to a non-element record.
create function private.edge_ref(p_type text, p_id uuid, p_reference_code text, p_role text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object('type', p_type, 'id', p_id, 'reference_code', p_reference_code,
                                              'role', p_role));
$$;

-- -----------------------------------------------------------------------------
-- Integrity (7)
-- -----------------------------------------------------------------------------
create function private.edge_rules_integrity(p_engagement_id uuid)
returns setof private.edge_raw_item
language sql
stable
set search_path = ''
as $$
  with live as (
    select e.*, o.object_type
    from public.architecture_elements e
    left join public.architecture_objects o on o.element_id = e.id
    where e.engagement_id = p_engagement_id and e.lifecycle not in ('retired', 'superseded')
  ),
  published as (select * from live where latest_version_id is not null),
  rels as (
    select r.* from public.architecture_relationships r
    where r.engagement_id = p_engagement_id and r.retired_at is null
  ),
  contradicting as (
    select s.element_id, l.evidence_source_id, l.id as link_id, l.created_at
    from public.statement_evidence_links l
    join public.architecture_statements s on s.id = l.statement_id
    where l.engagement_id = p_engagement_id and l.stance = 'contradicts'
      and s.ai_review_state in ('not_applicable', 'accepted')
  )
  -- 1. statement_contradicted_by_evidence (D-03), one item per element and
  --    contradicting source.
  select 'statement_contradicted_by_evidence', null::text, 'element', e.id,
         jsonb_build_object('evidence_source_id', c.evidence_source_id,
                            'link_count', count(*)),
         jsonb_build_array(private.edge_element_ref(e.id, 'subject', e.latest_version_id),
                           private.edge_ref('evidence_source', c.evidence_source_id, null, 'contradicts')),
         'evidence_link', e.id, null::uuid, max(c.created_at),
         'evidence:' || e.id || ':' || c.evidence_source_id,
         string_agg(c.link_id::text, ',' order by c.link_id),
         case when e.kind = 'assumption'
                   or exists (select 1 from rels u where u.source_element_id = e.id and u.relationship_type = 'underpins')
              then 'attention' else 'ambient' end,
         null::jsonb
  from published e
  join contradicting c on c.element_id = e.id
  group by e.id, e.kind, e.latest_version_id, c.evidence_source_id
  union all
  -- 2. relationship_to_replaced_element (D-05). Never supersedes itself.
  select 'relationship_to_replaced_element', null, 'element', e.id,
         jsonb_build_object('replaced', jsonb_agg(jsonb_build_object(
           'relationship_id', x.rel_id, 'relationship_type', x.relationship_type,
           'element_id', x.other_id, 'reference_code', x.other_code, 'lifecycle', x.other_lifecycle)
           order by x.other_code)),
         jsonb_agg(private.edge_element_ref(x.other_id, 'replaced') order by x.other_code),
         'state', e.id, null, null,
         'state:' || e.id,
         string_agg(x.rel_id || ':' || x.other_id || ':' || x.other_lifecycle, ',' order by x.rel_id),
         'attention', null
  from live e
  join lateral (
    select r.id as rel_id, r.relationship_type, o.id as other_id, o.reference_code as other_code,
           o.lifecycle::text as other_lifecycle
    from rels r
    join public.architecture_elements o
      on o.id = case when r.source_element_id = e.id then r.target_element_id else r.source_element_id end
    where (r.source_element_id = e.id or r.target_element_id = e.id)
      and r.relationship_type <> 'supersedes'
      and o.lifecycle in ('superseded', 'retired')
  ) x on true
  group by e.id
  union all
  -- 3. conflict_unresolved (D-06). The subject is the pair's canonical source;
  --    both ends are in the basis, so the item appears on both elements.
  select 'conflict_unresolved', null, 'element', a.id,
         jsonb_build_object('relationship_id', r.id, 'other_element_id', b.id, 'other_reference_code', b.reference_code),
         jsonb_build_array(private.edge_element_ref(a.id, 'in_tension'), private.edge_element_ref(b.id, 'in_tension')),
         'state', a.id, null, null, 'state:' || a.id, r.id::text, 'attention', null
  from rels r
  join published a on a.id = r.source_element_id
  join published b on b.id = r.target_element_id
  where r.relationship_type = 'conflicts_with'
  union all
  -- 4. methodology_derived_without_model (D-08).
  select 'methodology_derived_without_model', null, 'element', e.id,
         jsonb_build_object('element_provenance', e.provenance = 'methodology_derived',
                            'statement_ids', coalesce(jsonb_agg(s.id order by s.id) filter (where s.id is not null),
                                                      '[]'::jsonb)),
         jsonb_build_array(private.edge_element_ref(e.id, 'subject')),
         'state', e.id, null, null, 'state:' || e.id,
         concat_ws(',', case when e.provenance = 'methodology_derived' then e.id::text end,
                   string_agg(s.id::text, ',' order by s.id)),
         'attention', null
  from live e
  left join public.architecture_statements s
    on s.element_id = e.id and s.provenance = 'methodology_derived'
   and s.ai_review_state in ('not_applicable', 'accepted')
  where (e.provenance = 'methodology_derived' or s.id is not null)
    and not exists (select 1 from public.element_method_lineage ml
                    where ml.element_id = e.id and ml.lineage_role = 'instantiates')
  group by e.id, e.provenance
  union all
  -- 5. measurement_gap (D-09), two variants, Ambient.
  select 'measurement_gap', 'outcome_unmeasured', 'element', e.id, '{}'::jsonb,
         jsonb_build_array(private.edge_element_ref(e.id, 'subject')),
         'state', e.id, null, null, 'state:' || e.id, 'outcome_unmeasured', 'ambient', null
  from published e
  where e.object_type = 'intended_outcome'
    and not exists (select 1 from rels m join live t on t.id = m.target_element_id
                    where m.source_element_id = e.id and m.relationship_type = 'measured_by')
  union all
  select 'measurement_gap', 'metric_unattached', 'element', e.id, '{}'::jsonb,
         jsonb_build_array(private.edge_element_ref(e.id, 'subject')),
         'state', e.id, null, null, 'state:' || e.id, 'metric_unattached', 'ambient', null
  from published e
  where e.object_type = 'metric'
    and not exists (select 1 from rels m join live s on s.id = m.source_element_id
                    where m.target_element_id = e.id and m.relationship_type = 'measured_by')
  union all
  -- 6. capability_serves_no_outcome (D-10), directly or through part_of ancestors.
  select 'capability_serves_no_outcome', null, 'element', e.id,
         jsonb_build_object('relates_through', coalesce((
           select jsonb_object_agg(t.relationship_type, t.n)
           from (select r.relationship_type, count(*) as n from rels r
                 where r.source_element_id = e.id or r.target_element_id = e.id
                 group by r.relationship_type) t
         ), '{}'::jsonb)),
         jsonb_build_array(private.edge_element_ref(e.id, 'subject')),
         'state', e.id, null, null, 'state:' || e.id, 'serves:none', 'attention', null
  from published e
  where e.object_type = 'capability'
    and not exists (
      with recursive up(id, depth) as (
        select e.id, 0
        union
        select r.target_element_id, up.depth + 1
        from up join rels r on r.source_element_id = up.id and r.relationship_type = 'part_of'
        where up.depth < 5
      )
      select 1 from up join rels s on s.source_element_id = up.id and s.relationship_type = 'serves'
      join live t on t.id = s.target_element_id
    )
  union all
  -- 7. governance_allocation_gap (D-11), two variants.
  select 'governance_allocation_gap', 'decision_right_unheld', 'element', e.id, '{}'::jsonb,
         jsonb_build_array(private.edge_element_ref(e.id, 'subject')),
         'state', e.id, null, null, 'state:' || e.id, 'decision_right_unheld', 'attention', null
  from published e
  where e.object_type = 'decision_right'
    and not exists (select 1 from rels h join live s on s.id = h.source_element_id
                    where h.target_element_id = e.id and h.relationship_type = 'holds')
  union all
  select 'governance_allocation_gap', 'body_governs_nothing', 'element', e.id, '{}'::jsonb,
         jsonb_build_array(private.edge_element_ref(e.id, 'subject')),
         'state', e.id, null, null, 'state:' || e.id, 'body_governs_nothing', 'ambient', null
  from published e
  where e.object_type = 'governance_body'
    and not exists (select 1 from rels g join live s on s.id = g.source_element_id
                    where g.target_element_id = e.id and g.relationship_type = 'governed_by');
$$;

-- -----------------------------------------------------------------------------
-- Realization (8)
-- -----------------------------------------------------------------------------
create function private.edge_rules_realization(p_engagement_id uuid, p_as_of date)
returns setof private.edge_raw_item
language sql
stable
set search_path = ''
as $$
  with live as (
    select e.*, o.object_type
    from public.architecture_elements e
    left join public.architecture_objects o on o.element_id = e.id
    where e.engagement_id = p_engagement_id and e.lifecycle not in ('retired', 'superseded')
  ),
  rels as (
    select r.* from public.architecture_relationships r
    where r.engagement_id = p_engagement_id and r.retired_at is null
  ),
  initiatives as (
    select e.id, e.reference_code, e.latest_version_id, i.implementation_status
    from live e join public.implementation_initiatives i on i.element_id = e.id
  ),
  content as (select * from private.element_content_state(p_engagement_id)),
  captures as (
    select c.*, v.version_no as captured_version_no
    from public.review_examined_versions c
    left join public.element_versions v on v.id = c.element_version_id
    where c.engagement_id = p_engagement_id
  ),
  status_rows as (
    select distinct on (c.element_id, c.to_value) c.element_id, c.to_value, c.id, c.changed_at
    from public.implementation_status_changes c
    where c.engagement_id = p_engagement_id and c.field = 'implementation_status' and c.from_value is not null
    order by c.element_id, c.to_value, c.changed_at desc, c.id desc
  )
  -- 8. approved_without_pathway (D-12).
  select 'approved_without_pathway', null::text, 'element', e.id,
         jsonb_build_object('object_type', e.object_type),
         jsonb_build_array(private.edge_element_ref(e.id, 'subject', e.latest_version_id)),
         'state', e.id, null::uuid, null::timestamptz, 'state:' || e.id, 'no_pathway', 'attention', null::jsonb
  from live e
  where e.latest_version_id is not null
    and e.object_type in ('capability', 'application_format')
    and not exists (
      with recursive down(id, depth) as (
        select e.id, 0
        union
        select r.source_element_id, down.depth + 1
        from down join rels r on r.target_element_id = down.id and r.relationship_type = 'part_of'
        where down.depth < 2
      )
      select 1 from down
      join rels im on im.target_element_id = down.id and im.relationship_type = 'implements'
      join initiatives i on i.id = im.source_element_id
    )
    and not (e.object_type = 'capability' and exists (
      select 1 from rels it join live t on t.id = it.target_element_id
      where it.source_element_id = e.id and it.relationship_type = 'implemented_through'))
  union all
  -- 9. operational_not_validated (D-13), triggered by the status change.
  select 'operational_not_validated', null, 'element', i.id,
         jsonb_build_object('next_review', (
           select jsonb_build_object('element_id', rv.id, 'reference_code', rv.reference_code,
                                     'scheduled_for', r.scheduled_for)
           from rels ex
           join live rv on rv.id = ex.source_element_id
           join public.reviews r on r.element_id = rv.id and r.review_status = 'scheduled'
           where ex.target_element_id = i.id and ex.relationship_type = 'examines'
           order by r.scheduled_for nulls last, rv.reference_code limit 1)),
         jsonb_build_array(private.edge_element_ref(i.id, 'subject', i.latest_version_id)),
         case when s.id is null then 'state' else 'status_change' end, i.id, null, s.changed_at,
         case when s.id is null then 'state:' || i.id else 'status:' || i.id || ':' || s.id end,
         coalesce(s.id::text, 'operational'), 'attention', null
  from initiatives i
  left join status_rows s on s.element_id = i.id and s.to_value = 'operational'
  where i.implementation_status = 'operational'
    and not exists (select 1 from rels v where v.target_element_id = i.id and v.relationship_type = 'validates')
  union all
  -- 10. implements_replaced_element (D-14).
  select 'implements_replaced_element', null, 'element', i.id,
         jsonb_build_object('replaced', jsonb_agg(jsonb_build_object('element_id', t.id, 'reference_code',
                                                                     t.reference_code, 'lifecycle', t.lifecycle)
                                                  order by t.reference_code)),
         jsonb_agg(private.edge_element_ref(t.id, 'implements_replaced') order by t.reference_code),
         'state', i.id, null, null, 'state:' || i.id,
         string_agg(t.id || ':' || t.lifecycle, ',' order by t.id), 'attention', null
  from initiatives i
  join rels im on im.source_element_id = i.id and im.relationship_type = 'implements'
  join public.architecture_elements t on t.id = im.target_element_id and t.lifecycle in ('superseded', 'retired')
  group by i.id
  union all
  -- 11. implemented_element_revised (D-15). Resolved by a Review held after the
  --     revision whose capture shows the new version of the element, or that
  --     examined the initiative after the revision.
  select 'implemented_element_revised', null, 'element', i.id,
         jsonb_build_object('implemented_element_id', t.id, 'implemented_reference_code', t.reference_code,
                            'revision_version_no', c.latest_revision_version_no,
                            'revision_count', c.revision_count,
                            'changed_paths', to_jsonb(c.latest_revision_paths),
                            'change_summary', c.latest_revision_summary,
                            'implements_recorded_at', im.created_at),
         jsonb_build_array(private.edge_element_ref(t.id, 'revised', c.latest_revision_version_id),
                           private.edge_ref('relationship', im.id, null, 'implements')),
         'substantive_revision', t.id, c.latest_revision_version_id, c.latest_revision_published_at,
         'rev:' || t.id || ':' || c.latest_revision_version_id,
         t.id || ':' || c.latest_revision_version_id, 'attention', null
  from initiatives i
  join rels im on im.source_element_id = i.id and im.relationship_type = 'implements'
  join live t on t.id = im.target_element_id
  join content c on c.element_id = t.id
  where i.implementation_status in ('not_started', 'in_progress', 'stalled', 'operational')
    and c.latest_revision_published_at > im.created_at
    and not exists (
      select 1 from captures cp
      where (cp.element_id = t.id and cp.captured_version_no >= c.latest_revision_version_no)
         or (cp.element_id = i.id and cp.captured_at > c.latest_revision_published_at)
    )
  union all
  -- 12. validated_element_revised (D-16), after the latest validation.
  select 'validated_element_revised', null, 'element', i.id,
         jsonb_build_object('implemented_element_id', t.id, 'implemented_reference_code', t.reference_code,
                            'revision_version_no', c.latest_revision_version_no,
                            'revision_count', c.revision_count,
                            'changed_paths', to_jsonb(c.latest_revision_paths),
                            'change_summary', c.latest_revision_summary,
                            'validated_at', va.created_at),
         jsonb_build_array(private.edge_element_ref(t.id, 'revised', c.latest_revision_version_id),
                           private.edge_ref('relationship', va.id, null, 'validates')),
         'substantive_revision', t.id, c.latest_revision_version_id, c.latest_revision_published_at,
         'rev:' || t.id || ':' || c.latest_revision_version_id,
         t.id || ':' || c.latest_revision_version_id, 'attention', null
  from initiatives i
  join lateral (
    select v.id, v.created_at from rels v
    where v.target_element_id = i.id and v.relationship_type = 'validates'
    order by v.created_at desc limit 1
  ) va on true
  join rels im on im.source_element_id = i.id and im.relationship_type = 'implements'
  join live t on t.id = im.target_element_id
  join content c on c.element_id = t.id
  where i.implementation_status = 'validated'
    and c.latest_revision_published_at > va.created_at
    and not exists (select 1 from captures cp
                    where cp.element_id = i.id and cp.captured_at > c.latest_revision_published_at)
  union all
  -- 13. realization_without_evidence (D-17).
  select 'realization_without_evidence', null, 'element', i.id,
         jsonb_build_object('implementation_status', i.implementation_status),
         jsonb_build_array(private.edge_element_ref(i.id, 'subject', i.latest_version_id)),
         'state', i.id, null, null, 'state:' || i.id, i.implementation_status::text, 'attention', null
  from initiatives i
  where i.implementation_status in ('operational', 'validated')
    and not exists (select 1 from public.element_evidence_links l where l.element_id = i.id)
    and not exists (select 1 from public.implementation_checkpoints k
                    where k.implementation_element_id = i.id and k.achieved_on is not null
                      and k.achieved_evidence_source_id is not null)
  union all
  -- 14. checkpoint_past_target (D-19). Business date: anticipation only.
  select 'checkpoint_past_target', null, 'element', i.id,
         jsonb_build_object('checkpoint_id', k.id, 'checkpoint_title', k.title, 'target_on', k.target_on),
         jsonb_build_array(private.edge_element_ref(i.id, 'subject'),
                           private.edge_ref('checkpoint', k.id, null, 'past_target')),
         'date', i.id, null, null, 'date:' || i.id || ':checkpoint_past_target',
         k.id || ':' || k.target_on, 'attention', null
  from initiatives i
  join public.implementation_checkpoints k on k.implementation_element_id = i.id
  where i.implementation_status <> 'abandoned'
    and k.achieved_on is null and k.target_on is not null and k.target_on < p_as_of
  union all
  -- 15. criteria_without_review_path (D-20).
  select 'criteria_without_review_path', null, 'element', i.id,
         jsonb_build_object('criteria', jsonb_agg(jsonb_build_object('id', ac.id, 'reference_code', ac.reference_code)
                                                  order by ac.reference_code)),
         jsonb_agg(private.edge_ref('acceptance_criterion', ac.id, ac.reference_code, 'in_force')
                   order by ac.reference_code),
         'state', i.id, null, null, 'state:' || i.id,
         string_agg(ac.id::text, ',' order by ac.id), 'attention', null
  from initiatives i
  join public.acceptance_criteria ac
    on ac.state = 'agreed'
   and (ac.governed_element_id = i.id
        or exists (select 1 from rels im where im.source_element_id = i.id and im.relationship_type = 'implements'
                     and im.target_element_id = ac.governed_element_id))
  where i.implementation_status not in ('validated', 'abandoned')
    and not exists (
      select 1 from rels ex
      join live rv on rv.id = ex.source_element_id
      join public.reviews r on r.element_id = rv.id and r.review_status in ('scheduled', 'held')
      where ex.relationship_type = 'examines'
        and (ex.target_element_id = i.id
             or exists (select 1 from rels im where im.source_element_id = i.id
                          and im.relationship_type = 'implements' and im.target_element_id = ex.target_element_id))
    )
  group by i.id;
$$;

-- -----------------------------------------------------------------------------
-- Change (8)
-- -----------------------------------------------------------------------------
create function private.edge_rules_change(p_engagement_id uuid)
returns setof private.edge_raw_item
language sql
stable
set search_path = ''
as $$
  with live as (
    select e.* from public.architecture_elements e
    where e.engagement_id = p_engagement_id and e.lifecycle not in ('retired', 'superseded')
  ),
  rels as (
    select r.* from public.architecture_relationships r
    where r.engagement_id = p_engagement_id and r.retired_at is null
  ),
  content as (select * from private.element_content_state(p_engagement_id)),
  captures as (
    select c.*, v.version_no as captured_version_no
    from public.review_examined_versions c
    left join public.element_versions v on v.id = c.element_version_id
    where c.engagement_id = p_engagement_id
  ),
  held as (
    select rv.id, rv.reference_code, r.baseline_id
    from live rv join public.reviews r on r.element_id = rv.id and r.review_status = 'held'
  ),
  -- What each held Review examined, at which version: its capture, or for a
  -- Review held before 7A, its frozen baseline (never held_at).
  examined as (
    select h.id as review_id, c.element_id, c.element_version_id, c.captured_version_no as examined_no,
           c.captured_at, 'capture'::text as basis_kind
    from held h join captures c on c.review_element_id = h.id
    union all
    select h.id, bi.element_id, bi.element_version_id, v.version_no, null::timestamptz, 'baseline'
    from held h
    join public.architecture_baselines b on b.id = h.baseline_id and b.status = 'frozen'
    join rels ex on ex.source_element_id = h.id and ex.relationship_type = 'examines'
    join public.architecture_baseline_items bi on bi.baseline_id = b.id and bi.element_id = ex.target_element_id
    join public.element_versions v on v.id = bi.element_version_id
    where not exists (select 1 from captures c where c.review_element_id = h.id)
  ),
  evidence as (
    select s.element_id, l.id, l.evidence_source_id, l.stance, l.created_at
    from public.statement_evidence_links l
    join public.architecture_statements s on s.id = l.statement_id
    where l.engagement_id = p_engagement_id
    union all
    select l.element_id, l.id, l.evidence_source_id, l.stance, l.created_at
    from public.element_evidence_links l where l.engagement_id = p_engagement_id
  )
  -- 16. criteria_predate_revision (D-04). agreed_recorded_at only (OD-2);
  --     never agreed_on. A criterion with no recorded agreement time is skipped.
  select 'criteria_predate_revision', null::text, 'acceptance_criterion', ac.id,
         jsonb_build_object('governed_element_id', t.id, 'governed_reference_code', t.reference_code,
                            'agreed_recorded_at', ac.agreed_recorded_at,
                            'revision_version_no', c.latest_revision_version_no,
                            'changed_paths', to_jsonb(c.latest_revision_paths),
                            'change_summary', c.latest_revision_summary),
         jsonb_build_array(private.edge_ref('acceptance_criterion', ac.id, ac.reference_code, 'subject'),
                           private.edge_element_ref(t.id, 'revised', c.latest_revision_version_id)),
         'substantive_revision', t.id, c.latest_revision_version_id, c.latest_revision_published_at,
         'rev:' || t.id || ':' || c.latest_revision_version_id,
         c.latest_revision_version_id::text, 'attention', null::jsonb
  from public.acceptance_criteria ac
  join live t on t.id = ac.governed_element_id
  join content c on c.element_id = t.id
  where ac.engagement_id = p_engagement_id and ac.state = 'agreed'
    and ac.agreed_recorded_at is not null
    and c.latest_revision_published_at > ac.agreed_recorded_at
  union all
  -- 17. examined_element_revised_since_review (D-21), version-exact. A null
  --     capture means the element was unpublished at hold: any later
  --     publication counts. Resolved by a later capture at the current version.
  select 'examined_element_revised_since_review', null, 'element', x.review_id,
         jsonb_build_object('examined_element_id', t.id, 'examined_reference_code', t.reference_code,
                            'examined_version_no', x.examined_no, 'basis_kind', x.basis_kind,
                            'current_version_no', c.latest_content_version_no,
                            'revision_count', (select count(*) from private.element_revision_rows(p_engagement_id, t.id) rr
                                               where rr.change_type in ('first_publication', 'substantive_revision')
                                                 and rr.version_no > coalesce(x.examined_no, 0)),
                            'changed_paths', to_jsonb(c.latest_revision_paths),
                            'change_summary', coalesce(c.latest_revision_summary, '')),
         jsonb_build_array(private.edge_element_ref(x.review_id, 'subject'),
                           private.edge_element_ref(t.id, 'examined', x.element_version_id),
                           private.edge_element_ref(t.id, 'revised', c.latest_content_version_id)),
         'substantive_revision', t.id, c.latest_content_version_id, c.latest_content_published_at,
         'rev:' || t.id || ':' || c.latest_content_version_id,
         t.id || ':' || c.latest_content_version_id, 'attention', null
  from examined x
  join live t on t.id = x.element_id
  join content c on c.element_id = t.id
  where c.latest_content_version_no > coalesce(x.examined_no, 0)
    and not exists (select 1 from captures later
                    where later.element_id = t.id and later.review_element_id <> x.review_id
                      and later.captured_version_no >= c.latest_content_version_no)
  union all
  -- 18. evidence_after_review (D-22): evidence linked to a captured element
  --     after the capture. One item per Review, element and source.
  select 'evidence_after_review', null, 'element', x.review_id,
         jsonb_build_object('examined_element_id', t.id, 'examined_reference_code', t.reference_code,
                            'evidence_source_id', ev.evidence_source_id,
                            'stances', jsonb_agg(distinct ev.stance)),
         jsonb_build_array(private.edge_element_ref(x.review_id, 'subject'),
                           private.edge_element_ref(t.id, 'examined', x.element_version_id),
                           private.edge_ref('evidence_source', ev.evidence_source_id, null, 'linked_after')),
         'evidence_link', t.id, null, max(ev.created_at),
         'evidence:' || t.id || ':' || ev.evidence_source_id,
         string_agg(ev.id::text, ',' order by ev.id),
         case when bool_or(ev.stance = 'contradicts') then 'attention' else 'ambient' end, null
  from examined x
  join live t on t.id = x.element_id
  join evidence ev on ev.element_id = t.id and ev.created_at > x.captured_at
  where x.basis_kind = 'capture'
    and not exists (select 1 from captures later
                    where later.element_id = t.id and later.review_element_id <> x.review_id
                      and later.captured_at > ev.created_at)
  group by x.review_id, t.id, t.reference_code, x.element_version_id, ev.evidence_source_id
  union all
  -- 19. decision_not_reflected (D-23): decided (system time) after the latest
  --     content version of an element it affects.
  select 'decision_not_reflected', null, 'element', d.id,
         jsonb_build_object('affected_element_id', t.id, 'affected_reference_code', t.reference_code,
                            'decided_at', dd.decided_at, 'affected_version_no', c.latest_content_version_no),
         jsonb_build_array(private.edge_element_ref(d.id, 'decision', d.latest_version_id),
                           private.edge_element_ref(t.id, 'affected', c.latest_content_version_id)),
         'decision', d.id, d.latest_version_id, dd.decided_at,
         'decision:' || d.id || ':' || coalesce(d.latest_version_id::text, 'unpublished'),
         coalesce(d.latest_version_id::text, '') || ':' || c.latest_content_version_id, 'attention', null
  from live d
  join public.decisions dd on dd.element_id = d.id and dd.decision_status = 'decided' and dd.decided_at is not null
  join rels af on af.source_element_id = d.id and af.relationship_type = 'affects'
  join live t on t.id = af.target_element_id
  join content c on c.element_id = t.id
  where c.latest_content_published_at < dd.decided_at
  union all
  -- 20. deliverable_documents_revised (D-24): against the Deliverable's frozen
  --     baseline (exact version), else its latest approval (system time).
  select 'deliverable_documents_revised', null, 'element', dv.id,
         jsonb_build_object('documented_element_id', t.id, 'documented_reference_code', t.reference_code,
                            'reference_point', case when bi.element_version_id is not null then 'baseline'
                                                    else 'approval' end,
                            'reference_version_no', bv.version_no, 'approved_at', ap.approved_at,
                            'revision_version_no', c.latest_revision_version_no,
                            'change_summary', c.latest_revision_summary),
         jsonb_build_array(private.edge_element_ref(dv.id, 'subject'),
                           private.edge_element_ref(t.id, 'revised', c.latest_revision_version_id))
         || case when bi.element_version_id is not null
                 then jsonb_build_array(private.edge_element_ref(t.id, 'baselined', bi.element_version_id))
                 else '[]'::jsonb end,
         'substantive_revision', t.id, c.latest_revision_version_id, c.latest_revision_published_at,
         'rev:' || t.id || ':' || c.latest_revision_version_id,
         t.id || ':' || c.latest_revision_version_id, 'attention', null
  from live dv
  join public.deliverables d on d.element_id = dv.id
  join rels doc on doc.source_element_id = dv.id and doc.relationship_type = 'documents'
  join live t on t.id = doc.target_element_id
  join content c on c.element_id = t.id and c.latest_revision_version_id is not null
  left join public.architecture_baselines b on b.id = d.baseline_id and b.status = 'frozen'
  left join public.architecture_baseline_items bi on bi.baseline_id = b.id and bi.element_id = t.id
  left join public.element_versions bv on bv.id = bi.element_version_id
  left join lateral (
    select max(coalesce(a.recorded_at, a.responded_at)) as approved_at
    from public.architecture_approvals a
    join public.element_versions av on av.id = a.element_version_id
    where av.element_id = dv.id and a.response = 'approved'
  ) ap on true
  where (bi.element_version_id is not null and c.latest_revision_version_no > bv.version_no)
     or (bi.element_version_id is null and ap.approved_at is not null
         and c.latest_revision_published_at > ap.approved_at)
  union all
  -- 21. contribution_on_prior_version (D-25), version-exact.
  select 'contribution_on_prior_version', null, 'element', t.id,
         jsonb_build_object('contribution_id', cc.id, 'contribution_version_no', cv.version_no,
                            'revision_version_no', c.latest_revision_version_no, 'submitted_at', cc.submitted_at),
         jsonb_build_array(private.edge_ref('contribution', cc.id, null, 'unhandled'),
                           private.edge_element_ref(t.id, 'contributed_on', cc.element_version_id),
                           private.edge_element_ref(t.id, 'revised', c.latest_revision_version_id)),
         'substantive_revision', t.id, c.latest_revision_version_id, c.latest_revision_published_at,
         'rev:' || t.id || ':' || c.latest_revision_version_id,
         cc.id || ':' || c.latest_revision_version_id, 'attention', null
  from public.client_contributions cc
  join live t on t.id = cc.element_id
  join public.element_versions cv on cv.id = cc.element_version_id
  join content c on c.element_id = t.id
  where cc.engagement_id = p_engagement_id and cc.status = 'received'
    and c.latest_revision_version_no > cv.version_no
  union all
  -- 22. method_basis_superseded (D-26, D-27). Pins are deliberate (ADR-0043).
  select 'method_basis_superseded', 'pinned_version_superseded', 'method_application', ma.id,
         jsonb_build_object('method_version_id', mv.id, 'version_label', mv.version_label,
                            'current_version_id', a.current_version_id),
         jsonb_build_array(private.edge_ref('method_application', ma.id, ma.reference_code, 'subject'),
                           private.edge_ref('method_version', mv.id, mv.version_label, 'pinned')),
         'state', ma.id, null, null, 'state:' || ma.id, mv.id::text, 'ambient', null
  from public.method_applications ma
  join public.method_asset_versions mv on mv.id = ma.method_asset_version_id and mv.lifecycle = 'superseded'
  join public.method_assets a on a.id = mv.asset_id
  where ma.engagement_id = p_engagement_id and ma.state in ('planned', 'in_progress')
  union all
  select 'method_basis_superseded', 'release_moved', 'engagement', g.id,
         jsonb_build_object('engagement_release_id', g.dam_release_id,
                            'applications', jsonb_agg(jsonb_build_object('id', ma.id, 'reference_code',
                                                      ma.reference_code, 'release_id', ma.dam_release_id,
                                                      'release_label', rl.version_label)
                                                      order by ma.reference_code)),
         jsonb_agg(private.edge_ref('method_application', ma.id, ma.reference_code, 'started_under_moved_release')
                   order by ma.reference_code),
         'state', g.id, null, null, 'state:' || g.id,
         coalesce(g.dam_release_id::text, 'none') || ':' || string_agg(ma.id::text, ',' order by ma.id),
         'attention', null
  from public.engagements g
  join public.method_applications ma on ma.engagement_id = g.id and ma.state in ('planned', 'in_progress')
  join public.dam_releases rl on rl.id = ma.dam_release_id
  where g.id = p_engagement_id
    and (ma.dam_release_id is distinct from g.dam_release_id or rl.status <> 'published')
  group by g.id, g.dam_release_id
  union all
  -- 23. approval_behind_published (D-28), version-exact. Ambient while an
  --     approval request on the latest version is pending.
  select 'approval_behind_published', null, 'element', e.id,
         jsonb_build_object('approved_version_no', ap.version_no, 'latest_version_no', lv.version_no,
                            'revision_version_no', c.latest_revision_version_no,
                            'pending_on_latest', pending.yes),
         jsonb_build_array(private.edge_element_ref(e.id, 'approved', ap.version_id),
                           private.edge_element_ref(e.id, 'revised', c.latest_revision_version_id)),
         'substantive_revision', e.id, c.latest_revision_version_id, c.latest_revision_published_at,
         'rev:' || e.id || ':' || c.latest_revision_version_id,
         ap.version_id || ':' || c.latest_revision_version_id,
         case when pending.yes then 'ambient' else 'attention' end, null
  from live e
  join public.element_versions lv on lv.id = e.latest_version_id
  join content c on c.element_id = e.id
  join lateral (
    select v.id as version_id, v.version_no
    from public.architecture_approvals a
    join public.element_versions v on v.id = a.element_version_id
    where v.element_id = e.id and a.response = 'approved'
    order by v.version_no desc limit 1
  ) ap on true
  cross join lateral (
    select exists (select 1 from public.architecture_approvals a
                   where a.element_version_id = e.latest_version_id and a.response is null) as yes
  ) pending
  where ap.version_no < lv.version_no
    and c.latest_revision_version_no > ap.version_no;
$$;

-- -----------------------------------------------------------------------------
-- Exposure (3)
-- -----------------------------------------------------------------------------
create function private.edge_rules_exposure(p_engagement_id uuid)
returns setof private.edge_raw_item
language sql
stable
set search_path = ''
as $$
  with live as (
    select e.* from public.architecture_elements e
    where e.engagement_id = p_engagement_id and e.lifecycle not in ('retired', 'superseded')
  ),
  rels as (
    select r.* from public.architecture_relationships r
    where r.engagement_id = p_engagement_id and r.retired_at is null
  ),
  converging as (
    select d.to_element_id, d.element_id as dependency_id, d.dependency_status
    from public.dependencies d join live de on de.id = d.element_id
    where d.engagement_id = p_engagement_id and d.blocking
      and d.dependency_status in ('open', 'at_risk', 'broken')
  )
  -- 24. dependencies_converge (D-31): two or more blocking, unsatisfied.
  select 'dependencies_converge', null::text, 'element', t.id,
         jsonb_build_object('dependency_count', count(*)),
         jsonb_agg(private.edge_element_ref(cv.dependency_id, 'converging') order by cv.dependency_id),
         case when st.id is null then 'state' else 'status_change' end, coalesce(st.element_id, t.id), null::uuid,
         st.changed_at,
         case when st.id is null then 'state:' || t.id else 'status:' || t.id || ':' || st.id end,
         string_agg(cv.dependency_id || ':' || cv.dependency_status, ',' order by cv.dependency_id),
         'attention', null::jsonb
  from live t
  join converging cv on cv.to_element_id = t.id
  left join lateral (
    select c.id, c.element_id, c.changed_at from public.intelligence_status_changes c
    where c.element_id in (select x.dependency_id from converging x where x.to_element_id = t.id)
      and c.field = 'dependency_status' and c.from_value is not null
    order by c.changed_at desc, c.id desc limit 1
  ) st on true
  group by t.id, st.id, st.element_id, st.changed_at
  having count(*) >= 2
  union all
  -- 25. escalation_before_review (D-32). Human-flagged in the envelope,
  --     because an open escalation is a human act.
  select 'escalation_before_review', null, 'element', rk.id,
         jsonb_build_object('escalation_id', x.id, 'level', x.level,
                            'reviews', jsonb_agg(distinct jsonb_build_object('element_id', rv.id,
                                                 'reference_code', rv.reference_code,
                                                 'scheduled_for', r.scheduled_for))),
         jsonb_build_array(private.edge_ref('escalation', x.id, null, 'open'))
         || jsonb_agg(distinct private.edge_element_ref(th.target_element_id, 'threatened'))
         || jsonb_agg(distinct private.edge_element_ref(rv.id, 'scheduled_review')),
         'state', rk.id, null, null, 'state:' || rk.id,
         x.id || ':' || string_agg(distinct rv.id::text, ','), 'attention', null
  from live rk
  join public.risks rr on rr.element_id = rk.id
  join public.intelligence_escalations x on x.element_id = rk.id and x.resolved_at is null
  join rels th on th.source_element_id = rk.id and th.relationship_type = 'threatens'
  join live tt on tt.id = th.target_element_id
  join rels ex on ex.target_element_id = tt.id and ex.relationship_type = 'examines'
  join live rv on rv.id = ex.source_element_id
  join public.reviews r on r.element_id = rv.id and r.review_status = 'scheduled'
  group by rk.id, x.id, x.level
  union all
  -- 26. materialized_risk_still_threatens (D-33).
  select 'materialized_risk_still_threatens', null, 'element', rk.id,
         jsonb_build_object('threatened', jsonb_agg(jsonb_build_object('element_id', t.id,
                                                                       'reference_code', t.reference_code)
                                                    order by t.reference_code)),
         jsonb_agg(private.edge_element_ref(t.id, 'threatened') order by t.reference_code),
         case when st.id is null then 'state' else 'status_change' end, rk.id, null, st.changed_at,
         case when st.id is null then 'state:' || rk.id else 'status:' || rk.id || ':' || st.id end,
         string_agg(t.id::text, ',' order by t.id), 'attention', null
  from live rk
  join public.risks rr on rr.element_id = rk.id and rr.risk_status = 'materialized'
  join rels th on th.source_element_id = rk.id and th.relationship_type = 'threatens'
  join live t on t.id = th.target_element_id
  left join lateral (
    select c.id, c.changed_at from public.intelligence_status_changes c
    where c.element_id = rk.id and c.field = 'risk_status' and c.to_value = 'materialized'
    order by c.changed_at desc, c.id desc limit 1
  ) st on true
  group by rk.id, st.id, st.changed_at;
$$;

-- -----------------------------------------------------------------------------
-- Potential (2)
-- -----------------------------------------------------------------------------
create function private.edge_rules_potential(p_engagement_id uuid)
returns setof private.edge_raw_item
language sql
stable
set search_path = ''
as $$
  with live as (
    select e.*, o.object_type from public.architecture_elements e
    left join public.architecture_objects o on o.element_id = e.id
    where e.engagement_id = p_engagement_id and e.lifecycle not in ('retired', 'superseded')
  ),
  rels as (
    select r.* from public.architecture_relationships r
    where r.engagement_id = p_engagement_id and r.retired_at is null
  )
  -- 27. opportunity_advances_unrealized (D-37), narrowed to Capabilities and
  --     Application Formats that no initiative implements.
  select 'opportunity_advances_unrealized', null::text, 'element', op.id,
         jsonb_build_object('advanced', jsonb_agg(jsonb_build_object('element_id', t.id,
                                                                     'reference_code', t.reference_code)
                                                  order by t.reference_code)),
         jsonb_agg(private.edge_element_ref(t.id, 'advanced_unrealized') order by t.reference_code),
         'state', op.id, null::uuid, null::timestamptz, 'state:' || op.id,
         string_agg(t.id::text, ',' order by t.id), 'attention', null::jsonb
  from live op
  join public.opportunities o on o.element_id = op.id
   and o.opportunity_status in ('identified', 'evaluating', 'pursuing')
  join rels adv on adv.source_element_id = op.id and adv.relationship_type = 'advances'
  join live t on t.id = adv.target_element_id and t.object_type in ('capability', 'application_format')
  where not exists (select 1 from rels im join live i on i.id = im.source_element_id
                    where im.target_element_id = t.id and im.relationship_type = 'implements')
  group by op.id
  union all
  -- 28. opportunity_without_carrier (D-39).
  select 'opportunity_without_carrier', null, 'element', op.id,
         jsonb_build_object('opportunity_status', o.opportunity_status),
         jsonb_build_array(private.edge_element_ref(op.id, 'subject')),
         'state', op.id, null, null, 'state:' || op.id, o.opportunity_status::text, 'attention', null
  from live op
  join public.opportunities o on o.element_id = op.id and o.opportunity_status = 'evaluating'
  where not exists (select 1 from rels p join live s on s.id = p.source_element_id
                    where p.target_element_id = op.id and p.relationship_type = 'pursues');
$$;

-- -----------------------------------------------------------------------------
-- Learning (3)
-- -----------------------------------------------------------------------------
create function private.edge_rules_learning(p_engagement_id uuid)
returns setof private.edge_raw_item
language sql
stable
set search_path = ''
as $$
  with live as (
    select e.* from public.architecture_elements e
    where e.engagement_id = p_engagement_id and e.lifecycle not in ('retired', 'superseded')
  ),
  difficulties as (
    select im.target_element_id as element_id, c.id, c.element_id as initiative_id, c.changed_at, c.to_value
    from public.architecture_relationships im
    join live i on i.id = im.source_element_id
    join public.implementation_status_changes c
      on c.element_id = i.id and c.field = 'implementation_status' and c.from_value is not null
    where im.engagement_id = p_engagement_id and im.relationship_type = 'implements' and im.retired_at is null
      and (c.to_value in ('stalled', 'abandoned')
           or (c.from_value in ('operational', 'validated', 'abandoned')
               and c.to_value in ('not_started', 'in_progress')))
  ),
  open_outputs as (
    select ma.id as application_id, o.id as output_id, o.output_kind, o.object_type_key, o.deliverable_type
    from public.method_applications ma
    join public.method_version_outputs o on o.version_id = ma.method_asset_version_id
    where ma.engagement_id = p_engagement_id and ma.state = 'completed'
      and not exists (
        select 1 from public.method_application_elements me
        left join public.deliverables dl on dl.element_id = me.element_id
        where me.application_id = ma.id and me.role = 'produced'
          and me.captured_kind = o.output_kind
          and (o.object_type_key is null or me.captured_object_type_key = o.object_type_key)
          and (o.deliverable_type is null or dl.deliverable_type = o.deliverable_type)
      )
  ),
  instruments as (
    select ma.id as application_id, c.component_version_id, cv.version_label
    from public.method_applications ma
    join public.method_version_components c on c.version_id = ma.method_asset_version_id
    join public.method_asset_versions cv on cv.id = c.component_version_id
    join public.method_assets a on a.id = cv.asset_id and a.form = 'instrument'
    where ma.engagement_id = p_engagement_id and ma.state in ('completed', 'discontinued')
      and not exists (select 1 from public.method_application_evidence ev
                      where ev.application_id = ma.id and ev.role = 'gathered'
                        and ev.instrument_version_id = c.component_version_id)
  )
  -- 29. repeated_realization_difficulty (D-40): two or more. Worded "worth
  --     examining": recurrence is not cause.
  select 'repeated_realization_difficulty', null::text, 'element', e.id,
         jsonb_build_object('difficulty_count', count(*),
                            'initiatives', jsonb_agg(distinct d.initiative_id)),
         jsonb_build_array(private.edge_element_ref(e.id, 'subject'))
         || jsonb_agg(distinct private.edge_element_ref(d.initiative_id, 'implementing')),
         'status_change', (array_agg(d.initiative_id order by d.changed_at desc, d.id desc))[1], null::uuid,
         max(d.changed_at),
         'status:' || e.id || ':' || (array_agg(d.id order by d.changed_at desc, d.id desc))[1],
         string_agg(d.id::text, ',' order by d.id), 'attention', null::jsonb
  from live e
  join difficulties d on d.element_id = e.id
  group by e.id
  having count(*) >= 2
  union all
  -- 30. application_outputs_absent (D-41).
  select 'application_outputs_absent', null, 'method_application', ma.id,
         jsonb_build_object('outputs', jsonb_agg(jsonb_build_object('output_id', o.output_id, 'output_kind',
                                                 o.output_kind, 'object_type_key', o.object_type_key,
                                                 'deliverable_type', o.deliverable_type)
                                                 order by o.output_id)),
         jsonb_build_array(private.edge_ref('method_application', ma.id, ma.reference_code, 'subject')),
         'state', ma.id, null, null, 'state:' || ma.id,
         string_agg(o.output_id::text, ',' order by o.output_id), 'attention', null
  from public.method_applications ma
  join open_outputs o on o.application_id = ma.id
  group by ma.id
  union all
  -- 31. application_instrument_evidence_absent (D-42), narrowed.
  select 'application_instrument_evidence_absent', null, 'method_application', ma.id,
         jsonb_build_object('instruments', jsonb_agg(jsonb_build_object('version_id', i.component_version_id,
                                                     'version_label', i.version_label)
                                                     order by i.component_version_id)),
         jsonb_build_array(private.edge_ref('method_application', ma.id, ma.reference_code, 'subject')),
         'state', ma.id, null, null, 'state:' || ma.id,
         string_agg(i.component_version_id::text, ',' order by i.component_version_id), 'attention', null
  from public.method_applications ma
  join instruments i on i.application_id = ma.id
  group by ma.id;
$$;

-- -----------------------------------------------------------------------------
-- change_reaches (§10.5): each element's latest substantive revision, and each
-- invalidated assumption, followed through impact_trace in 'edge' mode (Yes
-- links only). A reached record is resolved when it has its own content
-- version or approval after the trigger (or, for a Review, a capture after
-- it; for a criterion, an agreement after it). Judgments are applied by the
-- envelope.
-- -----------------------------------------------------------------------------
create function private.edge_change_reaches(p_engagement_id uuid)
returns setof private.edge_raw_item
language sql
stable
set search_path = ''
as $$
  with live as (
    select e.* from public.architecture_elements e
    where e.engagement_id = p_engagement_id and e.lifecycle not in ('retired', 'superseded')
  ),
  content as (select * from private.element_content_state(p_engagement_id)),
  triggers as (
    select c.element_id, 'substantive_revision'::text as trigger_type, c.latest_revision_version_id as version_id,
           c.latest_revision_published_at as trigger_at,
           'rev:' || c.element_id || ':' || c.latest_revision_version_id as trigger_key,
           c.latest_revision_version_id::text as fp
    from content c join live e on e.id = c.element_id
    where c.latest_revision_version_id is not null
    union all
    select a.element_id, 'status_change', null::uuid, st.changed_at,
           'status:' || a.element_id || ':' || st.id, st.id::text
    from public.assumptions a
    join live e on e.id = a.element_id
    join lateral (
      select c.id, c.changed_at from public.intelligence_status_changes c
      where c.element_id = a.element_id and c.field = 'validation_status' and c.to_value = 'invalidated'
      order by c.changed_at desc, c.id desc limit 1
    ) st on true
    where a.engagement_id = p_engagement_id and a.validation_status = 'invalidated'
  ),
  reached as (
    select t.*, r.*
    from triggers t
    cross join lateral public.impact_trace(t.element_id, 'edge') r
    where r.reached_type in ('element', 'acceptance_criterion', 'client_action')
  )
  select 'change_reaches', null::text,
         case r.reached_type when 'element' then 'element' when 'acceptance_criterion' then 'acceptance_criterion'
              else 'client_action' end,
         r.reached_id,
         jsonb_build_object('category', r.category, 'link_key', r.link_key, 'direction', r.direction,
                            'depth', r.depth, 'reason', r.reason, 'via_element_id', r.via_element_id,
                            'hub_element_id', r.hub_element_id,
                            'trigger_element_id', r.element_id,
                            'change_summary', (select v.change_summary from public.element_versions v
                                               where v.id = r.version_id)),
         jsonb_build_array(private.edge_element_ref(r.element_id, 'trigger', r.version_id),
                           case r.reached_type
                             when 'element' then private.edge_element_ref(r.reached_id, 'reached')
                             else private.edge_ref(r.reached_type, r.reached_id, r.reference_code, 'reached') end),
         r.trigger_type, r.element_id, r.version_id, r.trigger_at, r.trigger_key,
         r.element_id || ':' || r.fp,
         'attention',
         r.path || jsonb_build_array(jsonb_build_object('link_key', r.link_key, 'direction', r.direction,
                                                        'to_id', r.reached_id, 'terminal',
                                                        r.propagation = 'terminal'))
  from reached r
  where not (
    -- Resolved: the reached element has its own content version or approval
    -- after the trigger.
    (r.reached_type = 'element' and exists (
       select 1 from content rc where rc.element_id = r.reached_id
         and rc.latest_content_published_at > r.trigger_at))
    or (r.reached_type = 'element' and exists (
       select 1 from public.architecture_approvals ap
       join public.element_versions av on av.id = ap.element_version_id
       where av.element_id = r.reached_id and ap.response is not null
         and coalesce(ap.recorded_at, ap.responded_at) > r.trigger_at))
    -- A Review that captured the element after the trigger.
    or (r.reached_type = 'element' and exists (
       select 1 from public.review_examined_versions cp
       where cp.review_element_id = r.reached_id and cp.element_id = r.element_id
         and cp.captured_at > r.trigger_at))
    -- A criterion agreed after the trigger.
    or (r.reached_type = 'acceptance_criterion' and exists (
       select 1 from public.acceptance_criteria ac where ac.id = r.reached_id
         and ac.agreed_recorded_at > r.trigger_at))
    -- A client action sent after the trigger.
    or (r.reached_type = 'client_action' and exists (
       select 1 from public.client_actions ca where ca.id = r.reached_id and ca.sent_at > r.trigger_at))
  );
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'private.edge_element_ref(uuid, text, uuid)',
    'private.edge_ref(text, uuid, text, text)',
    'private.edge_rules_integrity(uuid)',
    'private.edge_rules_realization(uuid, date)',
    'private.edge_rules_change(uuid)',
    'private.edge_rules_exposure(uuid)',
    'private.edge_rules_potential(uuid)',
    'private.edge_rules_learning(uuid)',
    'private.edge_change_reaches(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end;
$$;
