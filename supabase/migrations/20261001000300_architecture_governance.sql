-- =============================================================================
-- DSA OS — Phase 3: architecture governance (decisions of 2026-09-30).
--
-- 1. Only Principal Architects grant or revoke edit_architecture and
--    publish_architecture overrides. System Administrators (for themselves or
--    anyone else) and Project Administrators cannot. Role defaults and the
--    per-engagement override model are unchanged.
-- 2. architecture_activity(): a filtered read model of architecture events
--    for holders of edit_architecture on an engagement (Principal Architects,
--    Architects and Researchers by default), and for those who already read
--    the whole activity log. It returns curated events only, never raw
--    audit rows, and never financial, membership or administrative events.
--    activity_log itself is unchanged.
-- See ADR-0024 and docs/product/PHASE_3_REPORT.md §8.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Who may grant or revoke a capability
-- -----------------------------------------------------------------------------
create function public.is_architecture_authority_capability(capability public.engagement_capability)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select capability in ('edit_architecture', 'publish_architecture');
$$;

revoke all on function public.is_architecture_authority_capability(public.engagement_capability) from public, anon;
grant execute on function public.is_architecture_authority_capability(public.engagement_capability) to authenticated;

-- Financial capabilities: System Administrators, Principal Architects, or a
-- Finance Administrator who can see the engagement. Architecture authority
-- (edit_architecture, publish_architecture): Principal Architects only, and
-- never for themselves. Other capabilities: anyone who manages the
-- engagement. Apart from architecture authority, nobody but a System
-- Administrator may change their own capabilities.
create or replace function private.can_manage_capability(
  target_engagement_id uuid,
  target_member_id uuid,
  target_capability public.engagement_capability
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_architecture_authority_capability(target_capability) then
      private.has_internal_role(array['principal_architect']::public.app_role[])
      and not exists (
        select 1 from public.engagement_members em
        where em.id = target_member_id and em.user_id = auth.uid()
      )
    else
      (
        private.has_internal_role(array['system_administrator']::public.app_role[])
        or not exists (
          select 1 from public.engagement_members em
          where em.id = target_member_id and em.user_id = auth.uid()
        )
      )
      and (
        case
          when public.is_financial_capability(target_capability) then
            private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[])
            or (
              private.has_internal_role(array['finance_administrator']::public.app_role[])
              and private.can_access_engagement(target_engagement_id)
            )
          else private.can_manage_engagement(target_engagement_id)
        end
      )
  end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Architecture activity
-- -----------------------------------------------------------------------------
create function private.can_read_architecture_activity(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_architecture(target_engagement_id)
     and (
       private.can_edit_architecture(target_engagement_id)
       or private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[])
     );
$$;

revoke all on function private.can_read_architecture_activity(uuid) from public, anon;
grant execute on function private.can_read_architecture_activity(uuid) to authenticated;

-- Events on one engagement, optionally only those concerning one element
-- (as the element, or as either end of a relationship). Bookkeeping writes
-- (subtype rows at creation, version pointers, baseline contents) are folded
-- into the events that caused them.
create function public.architecture_activity(
  p_engagement_id uuid,
  p_element_id uuid default null,
  p_limit integer default 100
)
returns table (
  id bigint,
  created_at timestamptz,
  actor_user_id uuid,
  actor_name text,
  event text,
  entity_type text,
  entity_id uuid,
  element_id uuid,
  related_element_id uuid,
  details jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with raw as (
    select
      l.*,
      coalesce(l.metadata_json -> 'after', l.metadata_json -> 'record') as r,
      l.metadata_json -> 'before' as b
    from public.activity_log l
    where l.engagement_id = p_engagement_id
      and private.can_read_architecture_activity(p_engagement_id)
      and l.entity_type in (
        'architecture_elements', 'architecture_objects', 'assumptions', 'risks', 'constraints',
        'dependencies', 'decisions', 'decision_options', 'recommendations', 'architecture_statements',
        'statement_evidence_links', 'element_evidence_links', 'element_method_lineage', 'evidence_sources',
        'architecture_relationships', 'element_versions', 'architecture_approvals', 'domain_assessments',
        'architecture_baselines'
      )
  ),
  classified as (
    select
      raw.*,
      case
        when action_type = 'provenance_changed' then 'provenance_changed'
        when action_type = 'returned_from_review' then 'returned_from_review'
        when entity_type = 'architecture_elements' then
          case action_type
            when 'insert' then 'element_created'
            when 'delete' then 'draft_deleted'
            else case
              when (b ->> 'lifecycle') is distinct from (r ->> 'lifecycle') then
                case r ->> 'lifecycle'
                  when 'in_review' then 'submitted_for_review'
                  when 'retired' then 'element_retired'
                  when 'superseded' then 'element_superseded'
                end
              when (b ->> 'ai_review_state') is distinct from (r ->> 'ai_review_state')
                   and r ->> 'ai_review_state' in ('accepted', 'rejected') then 'ai_content_reviewed'
              when (b -> 'title', b -> 'summary', b -> 'client_visibility', b -> 'source_reference',
                    b -> 'ip_classification', b -> 'engagement_wide', b -> 'owner_user_id')
                   is distinct from
                   (r -> 'title', r -> 'summary', r -> 'client_visibility', r -> 'source_reference',
                    r -> 'ip_classification', r -> 'engagement_wide', r -> 'owner_user_id')
                then 'element_edited'
            end
          end
        when entity_type = 'decisions' and action_type = 'update' then
          case
            when (b ->> 'decision_status') is distinct from (r ->> 'decision_status') then
              case r ->> 'decision_status'
                when 'recommended' then 'decision_recommended'
                when 'decided' then 'decision_recorded'
                when 'deferred' then 'decision_deferred'
                else 'element_edited'
              end
            when (b ->> 'recommended_option_id') is distinct from (r ->> 'recommended_option_id')
              then 'decision_recommended'
            else 'element_edited'
          end
        when entity_type in ('architecture_objects', 'assumptions', 'risks', 'constraints', 'dependencies',
                             'recommendations') and action_type = 'update' then 'element_edited'
        when entity_type = 'decision_options' then
          case action_type when 'insert' then 'decision_option_added'
                           when 'update' then 'decision_option_edited'
                           else 'decision_option_removed' end
        when entity_type = 'architecture_statements' then
          case action_type
            when 'insert' then 'statement_added'
            when 'delete' then 'statement_removed'
            else case
              when (b ->> 'ai_review_state') is distinct from (r ->> 'ai_review_state')
                   and r ->> 'ai_review_state' in ('accepted', 'rejected') then 'ai_content_reviewed'
              else 'statement_edited'
            end
          end
        when entity_type in ('statement_evidence_links', 'element_evidence_links') then
          case action_type when 'insert' then 'evidence_cited'
                           when 'delete' then 'citation_removed'
                           else 'citation_edited' end
        when entity_type = 'element_method_lineage' then
          case action_type when 'delete' then 'lineage_removed' else 'lineage_recorded' end
        when entity_type = 'evidence_sources' then
          case action_type when 'insert' then 'evidence_source_added'
                           when 'delete' then 'evidence_source_removed'
                           else 'evidence_source_edited' end
        when entity_type = 'architecture_relationships' then
          case action_type
            when 'insert' then 'relationship_added'
            when 'delete' then 'relationship_removed'
            else case
              when b ->> 'retired_at' is null and r ->> 'retired_at' is not null then 'relationship_retired'
              when b ->> 'published_at' is null and r ->> 'published_at' is not null then 'relationship_published'
              else 'relationship_edited'
            end
          end
        when entity_type = 'element_versions' and action_type = 'insert' then 'version_published'
        when entity_type = 'architecture_approvals' then
          case
            when action_type = 'insert' and r ->> 'response' is null then 'approval_requested'
            when action_type = 'insert' then 'approval_recorded'
            when action_type = 'update' and b ->> 'response' is null and r ->> 'response' is not null
              then 'approval_responded'
          end
        when entity_type = 'domain_assessments' and action_type = 'insert' then 'domain_assessed'
        when entity_type = 'architecture_baselines' then
          case
            when action_type = 'insert' then 'baseline_created'
            when action_type = 'update' and b ->> 'status' = 'draft' and r ->> 'status' = 'frozen'
              then 'baseline_frozen'
            when action_type = 'delete' then 'baseline_deleted'
          end
      end as event
    from raw
  ),
  located as (
    select
      c.*,
      case
        when c.entity_type = 'architecture_elements' then c.entity_id
        when c.entity_type = 'decision_options' then (c.r ->> 'decision_element_id')::uuid
        when c.entity_type = 'architecture_relationships' then
          coalesce((c.r ->> 'source_element_id')::uuid,
                   (select rel.source_element_id from public.architecture_relationships rel where rel.id = c.entity_id))
        when c.entity_type = 'architecture_statements' then
          coalesce((c.r ->> 'element_id')::uuid,
                   (select s.element_id from public.architecture_statements s where s.id = c.entity_id))
        when c.entity_type = 'statement_evidence_links' then
          (select s.element_id from public.architecture_statements s where s.id = (c.r ->> 'statement_id')::uuid)
        when c.entity_type = 'architecture_approvals' then
          (select v.element_id from public.element_versions v where v.id = (c.r ->> 'element_version_id')::uuid)
        when c.entity_type in ('evidence_sources', 'domain_assessments', 'architecture_baselines') then null
        else (c.r ->> 'element_id')::uuid
      end as element_ref,
      case
        when c.entity_type = 'architecture_relationships' then
          coalesce((c.r ->> 'target_element_id')::uuid,
                   (select rel.target_element_id from public.architecture_relationships rel where rel.id = c.entity_id))
      end as related_ref
    from classified c
    where c.event is not null
  )
  select
    x.id,
    x.created_at,
    x.actor_user_id,
    nullif(trim(p.first_name || ' ' || p.last_name), '') as actor_name,
    x.event,
    x.entity_type,
    x.entity_id,
    x.element_ref,
    x.related_ref,
    jsonb_strip_nulls(jsonb_build_object(
      'title', case when x.entity_type in ('architecture_elements', 'decision_options', 'evidence_sources')
                    then x.r ->> 'title' end,
      'label', case when x.entity_type = 'architecture_baselines' then x.r ->> 'label' end,
      'from', case when x.event = 'provenance_changed' then x.metadata_json ->> 'from'
                   when x.entity_type = 'architecture_elements' and x.event in ('element_retired', 'element_superseded')
                     then x.b ->> 'lifecycle' end,
      'to', case when x.event = 'provenance_changed' then x.metadata_json ->> 'to' end,
      'note', case when x.event = 'returned_from_review' then nullif(x.metadata_json ->> 'note', '') end,
      'version_no', case when x.entity_type = 'element_versions' then (x.r ->> 'version_no')::integer
                         when x.entity_type = 'architecture_approvals' then
                           (select v.version_no from public.element_versions v
                            where v.id = (x.r ->> 'element_version_id')::uuid) end,
      'change_summary', case when x.entity_type = 'element_versions' then nullif(x.r ->> 'change_summary', '') end,
      'baseline_id', case when x.entity_type = 'architecture_approvals' then x.r ->> 'baseline_id' end,
      'response', case when x.entity_type = 'architecture_approvals' then x.r ->> 'response' end,
      'approval_source', case when x.entity_type = 'architecture_approvals' and x.r ->> 'response' is not null
                              then x.r ->> 'approval_source' end,
      'relationship_type', case when x.entity_type = 'architecture_relationships' then x.r ->> 'relationship_type' end,
      'statement_kind', case when x.entity_type = 'architecture_statements' then x.r ->> 'statement_kind' end,
      'domain', case when x.entity_type = 'domain_assessments' then x.r ->> 'domain' end,
      'maturity', case when x.entity_type = 'domain_assessments' then x.r ->> 'maturity' end,
      'decision_source', case when x.event = 'decision_recorded' then x.r ->> 'decision_source' end,
      'ai_review_state', case when x.event = 'ai_content_reviewed' then x.r ->> 'ai_review_state' end
    )) as details
  from located x
  left join public.profiles p on p.id = x.actor_user_id
  where p_element_id is null or x.element_ref = p_element_id or x.related_ref = p_element_id
  order by x.created_at desc, x.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.architecture_activity(uuid, uuid, integer) from public, anon;
grant execute on function public.architecture_activity(uuid, uuid, integer) to authenticated;
