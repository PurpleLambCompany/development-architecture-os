-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 8 of 11.
-- The common intelligence envelope: public.edge_items.
--
-- Decisions: ADR-0051 (envelope), ADR-0052 (trigger keys), ADR-0058 (tiers
-- and ordering facts). Proposal §6, §7.2, §9, §15.4, §26.
--
-- edge_items composes the two existing signal functions (consumed unchanged,
-- with their scope, thresholds and dismissals), the 31 new rules and the
-- change_reaches consequences, and maps each into one shape: what it is, why
-- it surfaced, what it rests on (with versions), its epistemic status, what
-- triggered it, what governance act would resolve it, its tier and the facts
-- that order it, and what a person has judged.
--
-- Rules for the envelope (§6.2): one epistemic status, lens, tier and
-- resolving act per item; no confidence value and no score; basis holds
-- references only; security definer, checking can_read_architecture first,
-- one engagement per call; nothing for retired or superseded subjects.
-- producer is always 'rule' in 7A (the column exists so a later phase can add
-- another producer without reshaping the envelope; nothing of 7B is built).
-- =============================================================================

-- The Elevated horizon (OD-4): a governed constant, not user-configurable.
create function private.edge_horizon_days()
returns int
language sql
immutable
set search_path = ''
as $$ select 14 $$;

-- The latest human judgment on an item. For the 11 existing rules,
-- not_material and deferred are the existing dismissals (OD-9): a dismissal
-- with an expiry reads as deferred, without one as not material. Migration
-- 20261006000700 extends this to public.edge_judgments.
create function private.edge_judgment_for(
  p_engagement_id uuid,
  p_rule_key text,
  p_subject_type text,
  p_subject_id uuid,
  p_fingerprint text
)
returns table (
  judgment_kind        text,
  judged_by            uuid,
  judged_at            timestamptz,
  judgment_reason      text,
  judgment_expires_on  date,
  judgment_source      text,
  promoted_element_id  uuid
)
language sql
stable
set search_path = ''
as $$
  select case when d.expires_on is null then 'not_material' else 'deferred' end, d.dismissed_by, d.dismissed_at,
         d.reason, d.expires_on, 'signal_dismissal', null::uuid
  from public.intelligence_signal_dismissals d
  where d.engagement_id = p_engagement_id and d.rule_key = p_rule_key and d.fingerprint = p_fingerprint
    and ((p_subject_type = 'element' and d.element_id = p_subject_id)
         or (p_subject_type = 'client_action' and d.client_action_id = p_subject_id))
  union all
  select case when d.expires_on is null then 'not_material' else 'deferred' end, d.dismissed_by, d.dismissed_at,
         d.reason, d.expires_on, 'implementation_dismissal', null::uuid
  from public.implementation_signal_dismissals d
  where d.engagement_id = p_engagement_id and d.rule_key = p_rule_key and d.fingerprint = p_fingerprint
    and p_subject_type = 'element' and d.element_id = p_subject_id
  order by 3 desc
  limit 1;
$$;

create function public.edge_items(
  p_engagement_id uuid,
  p_as_of date default null,
  p_subject_type text default null,
  p_subject_id uuid default null,
  p_include_judged boolean default false
)
returns table (
  item_key                text,
  rule_key                text,
  home                    text,
  lens                    text,
  epistemic_status        text,
  producer                text,
  subject_type            text,
  subject_id              uuid,
  subject_reference_code  text,
  subject_title           text,
  subject_kind            text,
  variant                 text,
  details                 jsonb,
  basis                   jsonb,
  trigger_type            text,
  trigger_subject_id      uuid,
  trigger_reference_code  text,
  trigger_title           text,
  trigger_version_id      uuid,
  trigger_version_no      int,
  trigger_at              timestamptz,
  trigger_key             text,
  consequence_path        jsonb,
  fingerprint             text,
  resolving_act           text,
  tier                    text,
  tier_reason             text,
  order_facts             jsonb,
  judgment_kind           text,
  judged_by               uuid,
  judged_by_name          text,
  judged_at               timestamptz,
  judgment_reason         text,
  judgment_expires_on     date,
  judgment_source         text,
  promoted_element_id     uuid,
  judged                  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select coalesce(p_as_of, private.business_today()) as as_of,
           private.edge_horizon_days() as horizon,
           auth.uid() as me
    where private.can_read_architecture(p_engagement_id)
  ),
  existing as (
    select s.rule_key, s.element_id, s.client_action_id, s.fingerprint, s.details
    from params, public.intelligence_signals(p_engagement_id, params.as_of, true) s
    union all
    select s.rule_key, s.element_id, null::uuid, s.fingerprint, s.details
    from params, public.implementation_signals(p_engagement_id, params.as_of, true) s
  ),
  existing_items as (
    select x.rule_key, null::text as variant,
           case when x.client_action_id is not null then 'client_action' else 'element' end as subject_type,
           coalesce(x.element_id, x.client_action_id) as subject_id,
           x.details,
           case when x.client_action_id is not null
                then jsonb_build_array(private.edge_ref('client_action', x.client_action_id, null, 'subject'))
                else jsonb_build_array(private.edge_element_ref(x.element_id, 'subject'))
                     || coalesce((select jsonb_agg(private.edge_element_ref((t ->> 'element_id')::uuid, 'target'))
                                  from jsonb_array_elements(x.details -> 'targets') t), '[]'::jsonb)
                     || case when x.details ? 'from' then jsonb_build_array(
                               private.edge_element_ref((x.details -> 'from' ->> 'element_id')::uuid, 'dependent'),
                               private.edge_element_ref((x.details -> 'to' ->> 'element_id')::uuid, 'depended_on'))
                             else '[]'::jsonb end
           end as basis,
           case when st.id is not null then 'status_change'
                when c.trigger_type = 'date' then 'date' else 'state' end as trigger_type,
           coalesce(x.element_id, x.client_action_id) as trigger_subject_id,
           null::uuid as trigger_version_id,
           st.changed_at as trigger_at,
           case when st.id is not null then 'status:' || x.element_id || ':' || st.id
                when c.trigger_type = 'date' then 'date:' || coalesce(x.element_id, x.client_action_id) || ':' || x.rule_key
                else 'state:' || coalesce(x.element_id, x.client_action_id) end as trigger_key,
           x.fingerprint,
           c.list_tier as base_tier,
           null::jsonb as consequence_path
    from existing x
    join private.edge_rules() c on c.rule_key = x.rule_key
    left join lateral (
      select h.id, h.changed_at from public.intelligence_status_changes h
      where c.trigger_type = 'status_change' and h.element_id = x.element_id and h.from_value is not null
        and h.field in ('validation_status', 'dependency_status')
      order by h.changed_at desc, h.id desc limit 1
    ) st on true
  ),
  raw as (
    select r.* from params, private.edge_rules_integrity(p_engagement_id) r
    union all select r.* from params, private.edge_rules_realization(p_engagement_id, params.as_of) r
    union all select r.* from params, private.edge_rules_change(p_engagement_id) r
    union all select r.* from params, private.edge_rules_exposure(p_engagement_id) r
    union all select r.* from params, private.edge_rules_potential(p_engagement_id) r
    union all select r.* from params, private.edge_rules_learning(p_engagement_id) r
    union all select r.* from params, private.edge_change_reaches(p_engagement_id) r
    union all
    select e.rule_key, e.variant, e.subject_type, e.subject_id, e.details, e.basis, e.trigger_type,
           e.trigger_subject_id, e.trigger_version_id, e.trigger_at, e.trigger_key, e.fingerprint, e.base_tier,
           e.consequence_path
    from existing_items e
  ),
  subjects as (
    select r.*,
           coalesce(se.reference_code, ac.reference_code, ma.reference_code, ca.reference_code) as s_code,
           coalesce(se.title, left(ac.body, 160), ma.title, ca.title, g.title) as s_title,
           coalesce(se.kind::text, case r.subject_type when 'element' then null else r.subject_type end) as s_kind,
           se.lifecycle as s_lifecycle,
           te.reference_code as t_code, te.title as t_title,
           tv.version_no as t_version_no
    from raw r
    left join public.architecture_elements se on r.subject_type = 'element' and se.id = r.subject_id
    left join public.acceptance_criteria ac on r.subject_type = 'acceptance_criterion' and ac.id = r.subject_id
    left join public.method_applications ma on r.subject_type = 'method_application' and ma.id = r.subject_id
    left join public.client_actions ca on r.subject_type = 'client_action' and ca.id = r.subject_id
    left join public.engagements g on r.subject_type = 'engagement' and g.id = r.subject_id
    left join public.architecture_elements te on te.id = r.trigger_subject_id
    left join public.element_versions tv on tv.id = r.trigger_version_id
    where r.subject_type <> 'element' or se.lifecycle not in ('retired', 'superseded')
  ),
  facts as (
    select s.*, t.ids,
      -- Human-set: attention critical or an open escalation (Q22).
      (select case when exists (select 1 from public.intelligence_stewardship st
                                where st.element_id in (s.subject_id, s.trigger_subject_id) and st.attention = 'critical')
                     or exists (select 1 from public.implementation_stewardship st
                                where st.element_id in (s.subject_id, s.trigger_subject_id) and st.attention = 'critical')
                   then 'attention_critical'
                   when exists (select 1 from public.intelligence_escalations x
                                where x.element_id in (s.subject_id, s.trigger_subject_id) and x.resolved_at is null)
                     or exists (select 1 from public.implementation_escalations x
                                where x.element_id in (s.subject_id, s.trigger_subject_id) and x.resolved_at is null)
                   then 'open_escalation' end) as human_reason,
      exists (select 1 from public.intelligence_stewardship st
              where st.element_id in (s.subject_id, s.trigger_subject_id) and st.attention = 'high')
        or exists (select 1 from public.implementation_stewardship st
                   where st.element_id in (s.subject_id, s.trigger_subject_id) and st.attention = 'high')
        as attention_high,
      -- The nearest recorded governance date on the subject or trigger
      -- subject (anticipation only: business dates).
      (select jsonb_build_object('d', g.d, 'kind', g.kind, 'code', g.code) from (
         select (r.scheduled_for at time zone 'America/Chicago')::date as d, 'review_scheduled' as kind,
                rv.reference_code as code
         from public.architecture_relationships ex
         join public.architecture_elements rv on rv.id = ex.source_element_id
                                             and rv.lifecycle not in ('retired', 'superseded')
         join public.reviews r on r.element_id = rv.id and r.review_status = 'scheduled'
         where ex.relationship_type = 'examines' and ex.retired_at is null
           and ex.target_element_id in (s.subject_id, s.trigger_subject_id) and r.scheduled_for is not null
         union all
         select (r.scheduled_for at time zone 'America/Chicago')::date, 'review_scheduled', rv.reference_code
         from public.reviews r join public.architecture_elements rv on rv.id = r.element_id
         where r.element_id = s.subject_id and r.review_status = 'scheduled' and r.scheduled_for is not null
         union all
         select d.needed_by, 'decision_needed_by', de.reference_code
         from public.decisions d join public.architecture_elements de on de.id = d.element_id
         where d.element_id in (s.subject_id, s.trigger_subject_id) and d.decision_status in ('open', 'recommended')
           and d.needed_by is not null
         union all
         select k.target_on, 'checkpoint_target', ie.reference_code
         from public.implementation_checkpoints k join public.architecture_elements ie on ie.id = k.implementation_element_id
         where k.implementation_element_id in (s.subject_id, s.trigger_subject_id) and k.achieved_on is null
           and k.target_on is not null
         union all
         select a.due_on, 'client_action_due', a.reference_code
         from public.client_actions a
         where a.status = 'open' and a.due_on is not null
           and (a.id = s.subject_id or exists (select 1 from public.client_action_subjects cs where cs.action_id = a.id
                                                 and cs.element_id in (s.subject_id, s.trigger_subject_id)))
       ) g, params p
       where g.d >= p.as_of
       order by g.d, g.code limit 1) as governance,
      -- Reach class (§9.3): active implementation, then published
      -- architecture, then an Intended Outcome, then other. An in-force
      -- constraint's constrained initiatives count toward reach (D-34).
      (select count(distinct i.element_id)
       from public.constraints cn
       join public.architecture_relationships c
         on c.source_element_id = cn.element_id and c.relationship_type = 'constrains' and c.retired_at is null
       join public.implementation_initiatives i
         on i.element_id = c.target_element_id
            or exists (select 1 from public.architecture_relationships im
                       where im.source_element_id = i.element_id and im.relationship_type = 'implements'
                         and im.retired_at is null and im.target_element_id = c.target_element_id)
       where cn.element_id = s.subject_id and cn.constraint_status = 'in_force') as constrained_initiatives,
      (select min(case
                when ii.implementation_status in ('not_started', 'in_progress', 'operational', 'stalled') then 1
                when e.latest_version_id is not null and coalesce(o.object_type, '') <> 'intended_outcome' then 2
                when o.object_type = 'intended_outcome' then 3
                else 4 end)
       from public.architecture_elements e
       left join public.implementation_initiatives ii on ii.element_id = e.id
       left join public.architecture_objects o on o.element_id = e.id
       where e.id = any (t.ids) and e.lifecycle not in ('retired', 'superseded')) as reach_class,
      -- Structural responsibility of the reader (§9.3).
      (select exists (
         select 1 from public.architecture_elements e
         where e.id = any (t.ids) and e.owner_user_id = p.me
         union all
         select 1 from public.decisions d where d.element_id = any (t.ids) and d.decision_owner_user_id = p.me
         union all
         select 1 from public.implementation_initiatives i
         join public.engagement_members m on m.id = i.owner_member_id
         where i.element_id = any (t.ids) and m.user_id = p.me
         union all
         select 1 from public.review_participants rp
         join public.engagement_members m on m.id = rp.engagement_member_id
         where rp.element_id = any (t.ids) and m.user_id = p.me
         union all
         select 1 from public.method_application_practitioners mp
         join public.engagement_members m on m.id = mp.engagement_member_id
         where s.subject_type = 'method_application' and mp.application_id = s.subject_id and m.user_id = p.me
         union all
         select 1 from public.client_actions a
         where s.subject_type = 'client_action' and a.id = s.subject_id and a.addressed_to_user_id = p.me
       ) from params p) as responsible
    from subjects s
    -- The elements an item bears on: its subject, its trigger and its basis.
    cross join lateral (
      select array_remove(array_agg(distinct x.id), null) as ids
      from (
        select s.subject_id as id where s.subject_type = 'element'
        union select s.trigger_subject_id
        union select (b ->> 'id')::uuid from jsonb_array_elements(s.basis) b where b ->> 'type' = 'element'
      ) x
    ) t
  ),
  tiered as (
    select f.*,
           -- Ambient first: an Ambient item appears in context and nowhere else
           -- (§16), even on a record a person has flagged.
           case when f.base_tier = 'ambient' then 'ambient'
                when f.human_reason is not null then 'human_flagged'
                when f.attention_high then 'elevated'
                when (f.governance ->> 'd')::date <= p.as_of + p.horizon then 'elevated'
                else f.base_tier end as tier,
           case when f.base_tier = 'ambient' then 'ambient_rule'
                when f.human_reason is not null then f.human_reason
                when f.attention_high then 'attention_high'
                when (f.governance ->> 'd')::date <= p.as_of + p.horizon then 'governance_within_horizon'
                else 'rule_default' end as tier_reason
    from facts f, params p
  )
  select
    x.rule_key || ':' || x.subject_id || ':' || md5(x.fingerprint || '|' || x.trigger_key),
    x.rule_key,
    coalesce(c.home, 'architecture'),
    coalesce(c.lens, 'change'),
    coalesce(c.epistemic_status, 'derived'),
    'rule',
    x.subject_type, x.subject_id, x.s_code, x.s_title, x.s_kind,
    x.variant, x.details, x.basis,
    x.trigger_type, x.trigger_subject_id, x.t_code, x.t_title, x.trigger_version_id, x.t_version_no,
    x.trigger_at, x.trigger_key,
    x.consequence_path, x.fingerprint,
    coalesce(c.resolving_act, 'examine_reached'),
    x.tier, x.tier_reason,
    jsonb_strip_nulls(jsonb_build_object(
      'governance_date', x.governance ->> 'd',
      'governance_kind', x.governance ->> 'kind',
      'governance_reference_code', x.governance ->> 'code',
      'reach_class', coalesce(case when x.constrained_initiatives > 0 then 1 end, x.reach_class, 4),
      'constrained_initiatives', nullif(x.constrained_initiatives, 0),
      'responsible', x.responsible,
      'trigger_at', x.trigger_at,
      'reference_code', coalesce(x.s_code, x.t_code)
    )),
    j.judgment_kind, j.judged_by, private.person_name(j.judged_by), j.judged_at, j.judgment_reason,
    j.judgment_expires_on, j.judgment_source, j.promoted_element_id,
    coalesce(j.judgment_kind in ('not_material', 'disagree', 'promoted')
             or (j.judgment_kind = 'deferred' and (j.judgment_expires_on is null or j.judgment_expires_on > p.as_of)),
             false)
  from tiered x
  cross join params p
  left join private.edge_rules() c on c.rule_key = x.rule_key
  left join lateral private.edge_judgment_for(p_engagement_id, x.rule_key, x.subject_type, x.subject_id,
                                              x.fingerprint) j on true
  where (p_subject_id is null
         or (x.subject_id = p_subject_id and (p_subject_type is null or x.subject_type = p_subject_type))
         or x.trigger_subject_id = p_subject_id
         or p_subject_id = any (x.ids)
         or exists (select 1 from jsonb_array_elements(x.basis) b where (b ->> 'id')::uuid = p_subject_id))
    and (coalesce(p_include_judged, false)
         or not coalesce(j.judgment_kind in ('not_material', 'disagree', 'promoted')
                         or (j.judgment_kind = 'deferred'
                             and (j.judgment_expires_on is null or j.judgment_expires_on > p.as_of)), false))
  order by
    case x.tier when 'human_flagged' then 0 when 'elevated' then 1 when 'attention' then 2 else 3 end,
    (x.governance ->> 'd')::date nulls last,
    coalesce(case when x.constrained_initiatives > 0 then 1 end, x.reach_class, 4),
    x.responsible desc,
    x.trigger_at desc nulls last,
    coalesce(x.s_code, x.t_code),
    x.rule_key;
$$;

revoke all on function private.edge_horizon_days() from public, anon, authenticated;
revoke all on function private.edge_judgment_for(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.edge_items(uuid, date, text, uuid, boolean) from public, anon;
grant execute on function public.edge_items(uuid, date, text, uuid, boolean) to authenticated;
