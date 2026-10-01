-- =============================================================================
-- Phase 7B.2: Architecture Intelligence Experience. Migration 6 of 9.
-- Deterministic dossiers: the Review dossier and an element's supports and
-- exposures (principle 22, PD-9, PD-22; proposal §7, §8; ADR-0072).
--
-- Both are complete on their own, with Architecture Intelligence off or
-- unavailable, for every internal reader of the architecture. Neither reads,
-- returns or depends on any inference, model output, authorization or
-- Architecture Intelligence capability: the same rows for every internal
-- reader whatever their AI standing. Read only (47_ai_no_mutation), security
-- definer, search_path '', can_read_architecture (internal only; a client
-- gets P0002). Exact: every line names records with versions; nothing is
-- summarised, scored or ordered by importance. Free: no external processing,
-- no audit row, no budget.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The Review dossier (§8.1). For a held Review, the comparison point of each
-- examined element is its capture at the hold. For a scheduled Review, it is
-- the capture by the most recent earlier held Review that examined the same
-- element; without one, the element is "first Review of this element" and
-- every recorded fact counts as since. A Review held before captures existed
-- (OD-6, no backfill) has no comparison point, and says so.
-- -----------------------------------------------------------------------------
create function public.review_dossier(p_engagement_id uuid, p_review_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.architecture_elements;
  rv public.reviews;
  review_on date;
  result jsonb;
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  select * into r from public.architecture_elements
  where id = p_review_id and engagement_id = p_engagement_id and kind = 'review';
  select * into rv from public.reviews where element_id = r.id;
  if r.id is null or rv.element_id is null then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  review_on := coalesce(rv.held_at, rv.scheduled_for)::date;

  with examined as (
    -- The examined set as recorded: unretired examines, in the order they
    -- were recorded.
    select x.target_element_id as element_id, x.created_at as examined_since, e.reference_code, e.title,
           e.kind::text as kind, e.latest_version_id,
           row_number() over (order by x.created_at, e.reference_code) as ordinal
    from public.architecture_relationships x
    join public.architecture_elements e on e.id = x.target_element_id
    where x.engagement_id = p_engagement_id and x.source_element_id = r.id and x.relationship_type = 'examines'
      and x.retired_at is null
  ),
  point as (
    select ex.*,
           case
             when rv.review_status = 'held' then own.element_version_id
             else prior.element_version_id
           end as compare_version_id,
           case
             when rv.review_status = 'held' then own.captured_at
             else prior.captured_at
           end as compare_at,
           case
             when rv.review_status = 'held' and own.element_id is null then 'no_capture'
             when rv.review_status = 'held' then 'captured_at_hold'
             when prior.element_id is null then 'first_review'
             else 'prior_review'
           end as compare_basis,
           prior.review_reference_code as prior_review_code
    from examined ex
    left join public.review_examined_versions own
      on own.review_element_id = r.id and own.element_id = ex.element_id
    left join lateral (
      select c.element_id, c.element_version_id, c.captured_at, pe.reference_code as review_reference_code
      from public.review_examined_versions c
      join public.architecture_elements pe on pe.id = c.review_element_id
      where c.engagement_id = p_engagement_id and c.element_id = ex.element_id and c.review_element_id <> r.id
      order by c.captured_at desc
      limit 1
    ) prior on rv.review_status <> 'held'
  ),
  revisions as (
    select p.element_id, rr.version_id, rr.version_no, rr.published_at, rr.change_type, rr.changed_paths,
           rr.change_summary
    from point p
    cross join lateral private.element_revision_rows(p_engagement_id, p.element_id) rr
    where p.compare_basis in ('captured_at_hold', 'prior_review')
      and rr.version_no > coalesce((select v.version_no from public.element_versions v where v.id = p.compare_version_id), 0)
      and rr.change_type in ('substantive_revision', 'status_publication', 'first_publication')
  ),
  initiatives as (
    -- Initiatives that implement an examined element, or are examined
    -- themselves, with the earliest comparison time among those elements.
    select ii.element_id as initiative_id, min(p.compare_at) as compare_at,
           bool_or(p.compare_basis in ('first_review', 'no_capture')) as from_start
    from point p
    join public.implementation_initiatives ii
      on ii.element_id = p.element_id
      or exists (select 1 from public.architecture_relationships x
                 where x.engagement_id = p_engagement_id and x.retired_at is null
                   and x.relationship_type = 'implements' and x.source_element_id = ii.element_id
                   and x.target_element_id = p.element_id)
    where ii.engagement_id = p_engagement_id
    group by ii.element_id
  ),
  edge as (
    select i.* from public.edge_items(p_engagement_id, null, null, null, true) i
    where i.subject_type = 'element'
      and (i.subject_id in (select element_id from point) or i.trigger_subject_id in (select element_id from point))
  )
  select jsonb_build_object(
    'review', jsonb_build_object(
      'id', r.id, 'reference_code', r.reference_code, 'title', r.title, 'status', rv.review_status,
      'scheduled_for', rv.scheduled_for, 'held_at', rv.held_at, 'review_on', review_on),
    'examined', coalesce((
      select jsonb_agg(jsonb_build_object(
               'element_id', p.element_id, 'reference_code', p.reference_code, 'title', p.title, 'kind', p.kind,
               'ordinal', p.ordinal,
               'examined_version_id', case when rv.review_status = 'held' then p.compare_version_id
                                           else p.latest_version_id end,
               'examined_version_no', (select v.version_no from public.element_versions v
                                       where v.id = case when rv.review_status = 'held' then p.compare_version_id
                                                         else p.latest_version_id end),
               'latest_version_no', (select v.version_no from public.element_versions v where v.id = p.latest_version_id),
               'compare_basis', p.compare_basis, 'compare_at', p.compare_at,
               'compare_version_no', (select v.version_no from public.element_versions v where v.id = p.compare_version_id),
               'prior_review_code', p.prior_review_code)
             order by p.ordinal)
      from point p), '[]'::jsonb),
    'changes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'element_id', v.element_id, 'reference_code', p.reference_code, 'version_id', v.version_id,
               'version_no', v.version_no, 'published_at', v.published_at, 'change_type', v.change_type,
               'changed_paths', to_jsonb(v.changed_paths), 'change_summary', v.change_summary)
             order by p.ordinal, v.version_no)
      from revisions v join point p on p.element_id = v.element_id), '[]'::jsonb),
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object(
               'element_id', l.element_id, 'reference_code', p.reference_code, 'link_id', l.link_id,
               'link_type', l.link_type, 'stance', l.stance, 'evidence_title', l.title,
               'source_type', l.source_type, 'linked_at', l.created_at)
             order by p.ordinal, l.created_at, l.link_id)
      from (
        select el.element_id, el.id as link_id, 'element_link' as link_type, el.stance::text as stance, s.title,
               s.source_type::text as source_type, el.created_at
        from public.element_evidence_links el join public.evidence_sources s on s.id = el.evidence_source_id
        where el.engagement_id = p_engagement_id
        union all
        select st.element_id, sl.id, 'statement_link', sl.stance::text, s.title, s.source_type::text, sl.created_at
        from public.statement_evidence_links sl
        join public.architecture_statements st on st.id = sl.statement_id
        join public.evidence_sources s on s.id = sl.evidence_source_id
        where sl.engagement_id = p_engagement_id
      ) l
      join point p on p.element_id = l.element_id
      where p.compare_basis = 'first_review' or p.compare_basis = 'no_capture' or l.created_at > p.compare_at), '[]'::jsonb),
    'edge', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_key', i.item_key, 'rule_key', i.rule_key, 'subject_id', i.subject_id,
               'subject_reference_code', i.subject_reference_code, 'trigger_reference_code', i.trigger_reference_code,
               'trigger_version_no', i.trigger_version_no, 'tier', i.tier, 'fingerprint', i.fingerprint,
               'resolving_act', i.resolving_act)
             order by case i.tier when 'human_flagged' then 1 when 'elevated' then 2 when 'attention' then 3 else 4 end,
                      i.order_facts ->> 'governance_date' nulls last, i.subject_reference_code, i.rule_key, i.item_key)
      from edge i where not i.judged), '[]'::jsonb),
    'edge_judged_count', (select count(*) from edge i where i.judged),
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
               'criterion_id', c.id, 'reference_code', c.reference_code, 'governs', g.reference_code,
               'governed_element_id', c.governed_element_id, 'state', c.state, 'agreed_on', c.agreed_on,
               'in_force', c.state = 'agreed',
               'changed_since', (n.from_start or c.created_at > n.compare_at or c.agreed_recorded_at > n.compare_at
                                 or c.closed_at > n.compare_at))
             order by g.reference_code, c.reference_code)
      from public.acceptance_criteria c
      join initiatives n on n.initiative_id = c.governed_element_id
      join public.architecture_elements g on g.id = c.governed_element_id
      where c.engagement_id = p_engagement_id
        and (c.state = 'agreed' or n.from_start or c.created_at > n.compare_at
             or c.agreed_recorded_at > n.compare_at or c.closed_at > n.compare_at)), '[]'::jsonb),
    'implementation', coalesce((
      select jsonb_agg(x.fact order by x.reference_code, x.at nulls last)
      from (
        select g.reference_code, sc.changed_at as at,
               jsonb_build_object('kind', 'status_change', 'initiative_id', sc.element_id, 'reference_code', g.reference_code,
                                  'from_value', sc.from_value, 'to_value', sc.to_value, 'at', sc.changed_at) as fact
        from public.implementation_status_changes sc
        join initiatives n on n.initiative_id = sc.element_id
        join public.architecture_elements g on g.id = sc.element_id
        where sc.field = 'implementation_status' and (n.from_start or sc.changed_at > n.compare_at)
        union all
        select g.reference_code, c.achieved_on::timestamptz,
               jsonb_build_object('kind', 'checkpoint_achieved', 'initiative_id', c.implementation_element_id,
                                  'reference_code', g.reference_code, 'checkpoint_id', c.id, 'title', c.title,
                                  'target_on', c.target_on, 'achieved_on', c.achieved_on)
        from public.implementation_checkpoints c
        join initiatives n on n.initiative_id = c.implementation_element_id
        join public.architecture_elements g on g.id = c.implementation_element_id
        where c.achieved_on is not null and (n.from_start or c.achieved_on >= n.compare_at::date)
        union all
        select g.reference_code, c.target_on::timestamptz,
               jsonb_build_object('kind', 'checkpoint_missed', 'initiative_id', c.implementation_element_id,
                                  'reference_code', g.reference_code, 'checkpoint_id', c.id, 'title', c.title,
                                  'target_on', c.target_on)
        from public.implementation_checkpoints c
        join initiatives n on n.initiative_id = c.implementation_element_id
        join public.architecture_elements g on g.id = c.implementation_element_id
        where c.achieved_on is null and c.target_on < private.business_today()
          and (n.from_start or c.target_on >= n.compare_at::date)
      ) x), '[]'::jsonb),
    'unresolved', jsonb_build_object(
      -- Open Decisions due on or before the Review, that it examines or that
      -- are related by a typed relationship to what it examines.
      'decisions', coalesce((
        select jsonb_agg(jsonb_build_object('element_id', d.element_id, 'reference_code', e.reference_code,
                                            'title', e.title, 'needed_by', d.needed_by)
                         order by d.needed_by, e.reference_code)
        from public.decisions d
        join public.architecture_elements e on e.id = d.element_id
        where d.engagement_id = p_engagement_id and d.decision_status = 'open' and d.needed_by <= review_on
          and e.lifecycle not in ('retired', 'superseded')
          and (d.element_id in (select element_id from point)
               or exists (select 1 from public.architecture_relationships x
                          where x.engagement_id = p_engagement_id and x.retired_at is null
                            and ((x.source_element_id = d.element_id and x.target_element_id in (select element_id from point))
                                 or (x.target_element_id = d.element_id and x.source_element_id in (select element_id from point)))))),
        '[]'::jsonb),
      'escalations', coalesce((
        select jsonb_agg(jsonb_build_object('element_id', x.element_id, 'reference_code', e.reference_code,
                                            'level', x.level, 'raised_at', x.raised_at, 'source', x.source)
                         order by e.reference_code, x.raised_at)
        from (
          select ie.element_id, ie.level::text as level, ie.raised_at, 'intelligence' as source
          from public.intelligence_escalations ie
          where ie.engagement_id = p_engagement_id and ie.resolved_at is null
            and ie.element_id in (select element_id from point)
          union all
          select me.element_id, me.level::text, me.raised_at, 'implementation'
          from public.implementation_escalations me
          where me.engagement_id = p_engagement_id and me.resolved_at is null
            and (me.element_id in (select element_id from point)
                 or me.element_id in (select initiative_id from initiatives))
        ) x
        join public.architecture_elements e on e.id = x.element_id), '[]'::jsonb),
      'deferred_edge', coalesce((
        select jsonb_agg(jsonb_build_object('item_key', i.item_key, 'rule_key', i.rule_key,
                                            'subject_reference_code', i.subject_reference_code,
                                            'expires_on', i.judgment_expires_on)
                         order by i.judgment_expires_on, i.subject_reference_code, i.item_key)
        from edge i
        where i.judgment_kind = 'deferred' and i.judgment_expires_on <= review_on), '[]'::jsonb)
    )
  ) into result;
  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- An element's supports and exposures (§7, PD-9): Evidence linked to it and
-- its statements with stance; Assumptions that underpin it and whether each
-- has supporting Evidence; open Risks related to it; current Edge items on
-- it. Deterministic; no AI.
-- -----------------------------------------------------------------------------
create function public.element_supports_and_exposures(p_engagement_id uuid, p_element_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  select * into e from public.architecture_elements where id = p_element_id and engagement_id = p_engagement_id;
  if e.id is null then
    raise exception 'Element not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object(
               'link_id', l.link_id, 'link_type', l.link_type, 'stance', l.stance, 'evidence_id', l.evidence_id,
               'evidence_title', l.title, 'source_type', l.source_type, 'source_date', l.source_date,
               'has_summary', l.has_summary, 'linked_at', l.created_at, 'statement_id', l.statement_id)
             order by case l.stance when 'supports' then 1 when 'contradicts' then 2 else 3 end, l.created_at, l.link_id)
      from (
        select el.id as link_id, 'element_link' as link_type, el.stance::text as stance, s.id as evidence_id, s.title,
               s.source_type::text as source_type, s.source_date, btrim(s.summary) <> '' as has_summary, el.created_at,
               null::uuid as statement_id
        from public.element_evidence_links el join public.evidence_sources s on s.id = el.evidence_source_id
        where el.engagement_id = p_engagement_id and el.element_id = e.id
        union all
        select sl.id, 'statement_link', sl.stance::text, s.id, s.title, s.source_type::text, s.source_date,
               btrim(s.summary) <> '', sl.created_at, sl.statement_id
        from public.statement_evidence_links sl
        join public.architecture_statements st on st.id = sl.statement_id
        join public.evidence_sources s on s.id = sl.evidence_source_id
        where sl.engagement_id = p_engagement_id and st.element_id = e.id
      ) l), '[]'::jsonb),
    'assumptions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'element_id', a.id, 'reference_code', a.reference_code, 'title', a.title,
               'validation_status', asm.validation_status,
               'has_supporting_evidence', exists (
                 select 1 from public.element_evidence_links el
                 where el.element_id = a.id and el.stance = 'supports'
                 union all
                 select 1 from public.statement_evidence_links sl
                 join public.architecture_statements st on st.id = sl.statement_id
                 where st.element_id = a.id and sl.stance = 'supports'))
             order by a.reference_code)
      from public.architecture_relationships x
      join public.architecture_elements a on a.id = x.source_element_id
      join public.assumptions asm on asm.element_id = a.id
      where x.engagement_id = p_engagement_id and x.retired_at is null and x.relationship_type = 'underpins'
        and x.target_element_id = e.id and a.lifecycle not in ('retired', 'superseded')), '[]'::jsonb),
    'risks', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
               'element_id', k.id, 'reference_code', k.reference_code, 'title', k.title,
               'risk_status', rk.risk_status, 'severity', rk.severity))
      from public.architecture_relationships x
      join public.architecture_elements k
        on k.id = case when x.source_element_id = e.id then x.target_element_id else x.source_element_id end
      join public.risks rk on rk.element_id = k.id
      where x.engagement_id = p_engagement_id and x.retired_at is null
        and e.id in (x.source_element_id, x.target_element_id)
        and rk.risk_status in ('open', 'mitigating') and k.lifecycle not in ('retired', 'superseded')), '[]'::jsonb),
    'edge', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_key', i.item_key, 'rule_key', i.rule_key, 'tier', i.tier, 'fingerprint', i.fingerprint,
               'trigger_reference_code', i.trigger_reference_code)
             order by case i.tier when 'human_flagged' then 1 when 'elevated' then 2 when 'attention' then 3 else 4 end,
                      i.rule_key, i.item_key)
      from public.edge_items(p_engagement_id, null, 'element', e.id) i
      where i.subject_type = 'element' and i.subject_id = e.id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.review_dossier(uuid, uuid) from public, anon;
revoke all on function public.element_supports_and_exposures(uuid, uuid) from public, anon;
grant execute on function public.review_dossier(uuid, uuid) to authenticated;
grant execute on function public.element_supports_and_exposures(uuid, uuid) to authenticated;
