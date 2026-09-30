-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 6 of 11.
-- The governed impact trace (ADR-0055, proposal §10).
--
-- impact_trace follows public.relationship_impact_rules. It is not a generic
-- graph traversal:
--   * every link is direct (one hop) except four walks, each capped at
--     depth 2: part_of downward (whole to parts), specializes downward,
--     requires upward (required to requirers), and underpins from an
--     invalidated assumption, continuing through the targets' requires
--     (upward) and part_of (downward);
--   * terminal hops (implements, examines, documents, criteria, open client
--     actions) are joined at each reached element, add no depth and never
--     continue;
--   * never-traversed links (supersedes, raises, validates, baselines,
--     validation criteria, closed Method Applications, record domains,
--     member areas) are not in the walk at all.
-- Modes: 'on_demand' includes Weak links (labeled "may bear on"), evidence,
-- lineage and pending approvals; 'edge' uses Yes links only and is what
-- change_reaches consumes. There is no user-selectable depth.
--
-- security invoker: RLS applies to every row read. It returns nothing to a
-- user who cannot read the engagement's architecture (clients included).
--
-- impact_trace is the authoritative impact semantics (OD-8).
-- intelligence_impact and implementation_impact stay, unchanged, as legacy
-- internal read paths for backward compatibility only; no UI calls them.
-- =============================================================================

create function public.impact_trace(p_element_id uuid, p_mode text default 'on_demand')
returns table (
  reached_type      text,
  reached_id        uuid,
  reference_code    text,
  title             text,
  kind              text,
  object_type       text,
  category          text,
  depth             int,
  via_element_id    uuid,
  link_key          text,
  direction         text,
  assessment        text,
  propagation       text,
  hub_element_id    uuid,
  path              jsonb,
  reason            text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive
  start as (
    select e.id, e.engagement_id, coalesce(a.validation_status = 'invalidated', false) as invalidated
    from public.architecture_elements e
    left join public.assumptions a on a.element_id = e.id
    where e.id = p_element_id
      and p_mode in ('on_demand', 'edge')
      and private.can_read_architecture(e.engagement_id)
  ),
  live as (
    select e.id, e.kind, e.reference_code, e.title, e.lifecycle, o.object_type
    from public.architecture_elements e
    join start s on s.engagement_id = e.engagement_id
    left join public.architecture_objects o on o.element_id = e.id
    where e.lifecycle not in ('retired', 'superseded')
  ),
  rules as (
    select * from public.relationship_impact_rules
    where propagation in ('direct', 'recursive')
      and (assessment = 'yes' or (p_mode = 'on_demand' and assessment = 'weak'))
  ),
  -- Every walkable link as a directed step from the changed end.
  links (from_id, to_id, link_key, direction) as (
    select r.source_element_id, r.target_element_id, r.relationship_type, 'source_to_target'
    from public.architecture_relationships r join start s on s.engagement_id = r.engagement_id
    where r.retired_at is null
    union all
    select r.target_element_id, r.source_element_id, r.relationship_type, 'target_to_source'
    from public.architecture_relationships r join start s on s.engagement_id = r.engagement_id
    where r.retired_at is null
    union all
    -- A dependency record joins its dependent (from) and depended-on (to) ends.
    select d.from_element_id, d.to_element_id, 'dependency_ends', 'source_to_target'
    from public.dependencies d join start s on s.engagement_id = d.engagement_id
    join live de on de.id = d.element_id
    union all
    select d.to_element_id, d.from_element_id, 'dependency_ends', 'target_to_source'
    from public.dependencies d join start s on s.engagement_id = d.engagement_id
    join live de on de.id = d.element_id
    union all
    -- A Review that supports an initiative's checkpoint.
    select c.related_review_id, c.implementation_element_id, 'checkpoint_support', 'target_to_source'
    from public.implementation_checkpoints c join start s on s.engagement_id = c.engagement_id
    where c.related_review_id is not null
  ),
  steps as (
    select l.from_id, l.to_id, l.link_key, l.direction, ru.assessment, ru.propagation, ru.reason
    from links l
    join rules ru on ru.link_key = l.link_key and ru.direction = l.direction
    join live t on t.id = l.to_id
  ),
  walk (element_id, depth, via_element_id, link_key, direction, assessment, propagation, reason, walk_kind,
        path, ids) as (
    select s.id, 0, null::uuid, null::text, null::text, null::text, null::text, null::text,
           case when s.invalidated then 'invalidated' else 'start' end, '[]'::jsonb, array[s.id]
    from start s
    union all
    select st.to_id, w.depth + 1, w.element_id, st.link_key, st.direction, st.assessment, st.propagation, st.reason,
           case
             when w.depth > 0 then w.walk_kind
             when st.propagation = 'recursive' then st.link_key || ':' || st.direction
             when w.walk_kind = 'invalidated' and st.link_key = 'underpins' and st.direction = 'source_to_target'
               then 'underpins_invalidated'
             else 'direct'
           end,
           w.path || jsonb_build_object('link_key', st.link_key, 'direction', st.direction,
                                        'from_id', w.element_id, 'to_id', st.to_id, 'depth', w.depth + 1),
           w.ids || st.to_id
    from walk w
    join steps st on st.from_id = w.element_id
    where w.depth < 2
      and not st.to_id = any (w.ids)
      and (
        w.depth = 0
        or (st.propagation = 'recursive' and w.walk_kind = st.link_key || ':' || st.direction)
        or (w.walk_kind = 'underpins_invalidated' and st.assessment = 'yes'
            and (st.link_key, st.direction) in (('requires', 'target_to_source'), ('part_of', 'target_to_source')))
      )
  ),
  reached as (
    select distinct on (w.element_id) w.*
    from walk w
    where w.depth > 0
    order by w.element_id, w.depth, (w.assessment = 'yes') desc, w.link_key, w.direction
  ),
  -- The start and every reached element take the terminal joins.
  nodes as (
    select r.element_id, r.depth, r.path from reached r
    union all
    select s.id, 0, '[]'::jsonb from start s
  ),
  initiatives as (
    select n.element_id as node_id, n.depth, n.path, i.id, rel.relationship_type
    from nodes n
    join public.architecture_relationships rel
      on rel.target_element_id = n.element_id and rel.relationship_type = 'implements' and rel.retired_at is null
    join live i on i.id = rel.source_element_id
  ),
  terminals (reached_type, reached_id, category, depth, via_element_id, link_key, direction, assessment,
             propagation, path, reason) as (
    select 'element', i.id,
           case when ii.implementation_status in ('not_started', 'in_progress', 'operational', 'stalled')
                then 'active_implementation' else 'implementation' end,
           i.depth, i.node_id, 'implements', 'target_to_source', 'yes', 'terminal', i.path,
           'A revised design may leave reality tracking an older one'
    from initiatives i
    join public.implementation_initiatives ii on ii.element_id = i.id
    union all
    -- Scheduled Reviews that examine the element.
    select 'element', rv.id, 'review', n.depth, n.element_id, 'examines', 'target_to_source', 'yes', 'terminal', n.path,
           'A scheduled Review examines it'
    from nodes n
    join public.architecture_relationships rel
      on rel.target_element_id = n.element_id and rel.relationship_type = 'examines' and rel.retired_at is null
    join live rv on rv.id = rel.source_element_id
    join public.reviews r on r.element_id = rv.id and r.review_status = 'scheduled'
    union all
    -- Held Reviews with a capture of the element.
    select 'element', rv.id, 'review', n.depth, n.element_id, 'examines', 'target_to_source', 'yes', 'terminal', n.path,
           'A held Review examined a captured version of it'
    from nodes n
    join public.review_examined_versions c on c.element_id = n.element_id
    join live rv on rv.id = c.review_element_id
    union all
    -- Deliverables that document it (not superseded or retired).
    select 'element', dv.id, 'deliverable', n.depth, n.element_id, 'documents', 'target_to_source', 'yes', 'terminal',
           n.path, 'A Deliverable documents it'
    from nodes n
    join public.architecture_relationships rel
      on rel.target_element_id = n.element_id and rel.relationship_type = 'documents' and rel.retired_at is null
    join live dv on dv.id = rel.source_element_id
    union all
    -- Agreed criteria in force on the element, and on initiatives that implement it.
    select 'acceptance_criterion', c.id, 'criteria', n.depth, n.element_id, 'acceptance_criteria_governed',
           'target_to_source', 'yes', 'terminal', n.path, 'Agreed criteria govern it'
    from nodes n
    join public.acceptance_criteria c on c.governed_element_id = n.element_id and c.state = 'agreed'
    union all
    select 'acceptance_criterion', c.id, 'criteria', i.depth, i.id, 'acceptance_criteria_governed',
           'target_to_source', 'yes', 'terminal', i.path, 'Agreed criteria govern an initiative that implements it'
    from initiatives i
    join public.acceptance_criteria c on c.governed_element_id = i.id and c.state = 'agreed'
    union all
    -- Open client actions with it as subject.
    select 'client_action', a.id, 'client_exposure', n.depth, n.element_id, 'client_action_subjects',
           'target_to_source', 'yes', 'terminal', n.path, 'A client may be answering about it'
    from nodes n
    join public.client_action_subjects cs on cs.element_id = n.element_id
    join public.client_actions a on a.id = cs.action_id and a.status = 'open'
    union all
    -- Unhandled client contributions on it.
    select 'contribution', c.id, 'contribution', n.depth, n.element_id, 'contribution_version', 'target_to_source',
           'yes', 'direct', n.path, 'Unhandled client input on it'
    from nodes n
    join public.client_contributions c on c.element_id = n.element_id and c.status = 'received'
    union all
    -- Open Method Applications that examined it (internal practice).
    select 'method_application', ma.id, 'practice', n.depth, n.element_id, 'method_application_elements',
           'target_to_source', 'yes', 'direct', n.path, 'Open method work examined it'
    from nodes n
    join public.method_application_elements me on me.element_id = n.element_id and me.role = 'examined'
    join public.method_applications ma on ma.id = me.application_id and ma.state in ('planned', 'in_progress')
    union all
    -- On demand only: evidence it cites, its method lineage, and pending approvals.
    select 'evidence_source', l.evidence_source_id, 'evidence', n.depth, n.element_id, 'statement_evidence_links',
           'target_to_source', 'yes', 'direct', n.path, 'Evidence cited by a statement on it'
    from nodes n
    join public.architecture_statements s on s.element_id = n.element_id
    join public.statement_evidence_links l on l.statement_id = s.id
    where p_mode = 'on_demand'
    union all
    select 'evidence_source', l.evidence_source_id, 'evidence', n.depth, n.element_id, 'element_evidence_links',
           'target_to_source', 'yes', 'direct', n.path, 'Evidence cited on it'
    from nodes n
    join public.element_evidence_links l on l.element_id = n.element_id
    where p_mode = 'on_demand'
    union all
    select 'method_lineage', ml.id, 'lineage', n.depth, n.element_id, 'element_method_lineage', 'target_to_source',
           'weak', 'direct', n.path, 'Method lineage (practice awareness, never architecture impact)'
    from nodes n
    join public.element_method_lineage ml on ml.element_id = n.element_id
    where p_mode = 'on_demand' and ml.lineage_role <> 'legacy_derived_from'
    union all
    select 'approval', ap.id, 'governance', n.depth, n.element_id, 'approval_version', 'target_to_source', 'yes',
           'direct', n.path, 'An approval request is pending on it'
    from nodes n
    join public.architecture_elements ne on ne.id = n.element_id
    join public.architecture_approvals ap on ap.element_version_id = ne.latest_version_id and ap.response is null
    where p_mode = 'on_demand'
  ),
  results (reached_type, reached_id, category, depth, via_element_id, link_key, direction, assessment, propagation,
           path, reason) as (
    select 'element', r.element_id,
           case l.kind
             when 'implementation_initiative' then
               case when ii.implementation_status in ('not_started', 'in_progress', 'operational', 'stalled')
                    then 'active_implementation' else 'implementation' end
             when 'review' then 'review'
             when 'deliverable' then 'deliverable'
             else 'architecture'
           end,
           r.depth, r.via_element_id, r.link_key, r.direction, r.assessment, r.propagation, r.path, r.reason
    from reached r
    join live l on l.id = r.element_id
    left join public.implementation_initiatives ii on ii.element_id = r.element_id
    union all
    select t.reached_type, t.reached_id, t.category, t.depth, t.via_element_id, t.link_key, t.direction,
           t.assessment, t.propagation, t.path, t.reason
    from terminals t
    where not (t.reached_type = 'element' and t.reached_id = p_element_id)
  ),
  best as (
    select distinct on (x.reached_type, x.reached_id) x.*
    from results x
    order by x.reached_type, x.reached_id, x.depth, (x.assessment = 'yes') desc, (x.propagation = 'terminal'),
             x.link_key
  )
  select b.reached_type, b.reached_id,
         coalesce(e.reference_code, ac.reference_code, ca.reference_code, ma.reference_code),
         coalesce(e.title, left(ac.body, 160), ca.title, ma.title, es.title, cc.body, ml.method_version),
         e.kind::text, o.object_type, b.category, b.depth, b.via_element_id, b.link_key, b.direction,
         b.assessment, b.propagation,
         case when vo.object_type in ('intended_outcome', 'system_boundary', 'regulatory_factor', 'governance_body',
                                      'knowledge_area') then b.via_element_id end,
         b.path, b.reason
  from best b
  left join public.architecture_elements e on b.reached_type = 'element' and e.id = b.reached_id
  left join public.architecture_objects o on b.reached_type = 'element' and o.element_id = b.reached_id
  left join public.acceptance_criteria ac on b.reached_type = 'acceptance_criterion' and ac.id = b.reached_id
  left join public.client_actions ca on b.reached_type = 'client_action' and ca.id = b.reached_id
  left join public.method_applications ma on b.reached_type = 'method_application' and ma.id = b.reached_id
  left join public.evidence_sources es on b.reached_type = 'evidence_source' and es.id = b.reached_id
  left join public.client_contributions cc on b.reached_type = 'contribution' and cc.id = b.reached_id
  left join public.element_method_lineage ml on b.reached_type = 'method_lineage' and ml.id = b.reached_id
  left join public.architecture_objects vo on vo.element_id = b.via_element_id
  order by b.depth, b.category, 3;
$$;

comment on function public.impact_trace(uuid, text) is
  'Authoritative impact semantics (OD-8, ADR-0055): the governed matrix, four depth-2 walks, terminal hops. Modes on_demand and edge.';

comment on function public.intelligence_impact(uuid, int) is
  'Legacy internal read path (OD-8). Unchanged for backward compatibility; not an alternative definition of impact and not used by any UI. Use impact_trace.';
comment on function public.implementation_impact(uuid, int) is
  'Legacy internal read path (OD-8). Unchanged for backward compatibility; not an alternative definition of impact and not used by any UI. Use impact_trace.';

revoke all on function public.impact_trace(uuid, text) from public, anon;
grant execute on function public.impact_trace(uuid, text) to authenticated;
