-- =============================================================================
-- DSA OS — Phase 6: read models and the client boundary (§26, §28).
--
-- Client read models are the only client path to anything methodological:
--
--   client_engagement_methodology  the engagement's DAM release label and
--                                  title. Nothing else (D22)
--   client_acceptance_criteria     agreed, client-visible criteria on
--                                  elements the caller may already read,
--                                  and the criteria captured for validations
--                                  the caller may already read. Never the
--                                  informing Standard (D20)
--
-- Both are security definer and return only what the caller may see. No
-- client policy exists on any Method Library or practice table (ADR-0022).
-- Architect-authored `approach` statements reach clients through the
-- existing client snapshot, unchanged.
--
-- Internal read models aggregate across engagements with titles, codes and
-- counts only (§22.3); application and lineage detail is listed only for
-- engagements the caller can read.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Client
-- -----------------------------------------------------------------------------
create function public.client_engagement_methodology(p_engagement_id uuid)
returns table (release_label text, release_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.version_label, r.title
  from public.engagements e
  join public.dam_releases r on r.id = e.dam_release_id
  where e.id = p_engagement_id
    and private.can_access_engagement(p_engagement_id);
$$;

create function public.client_acceptance_criteria(p_engagement_id uuid)
returns table (
  criterion_id uuid,
  reference_code text,
  body text,
  state public.acceptance_criterion_state,
  agreed_on date,
  governed_element_id uuid,
  governed_reference_code text,
  governed_title text,
  validation_relationship_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible_validations as (
    select vc.criterion_id, array_agg(vc.validation_relationship_id order by vc.captured_at) as ids
    from public.validation_criteria vc
    where vc.engagement_id = p_engagement_id
      and private.relationship_client_readable(vc.validation_relationship_id)
    group by vc.criterion_id
  )
  select c.id, c.reference_code, c.body, c.state, c.agreed_on,
    e.id, e.reference_code, v.client_snapshot ->> 'title',
    coalesce(vv.ids, '{}')
  from public.acceptance_criteria c
  join public.architecture_elements e on e.id = c.governed_element_id
  join public.element_versions v on v.id = e.latest_version_id
  left join visible_validations vv on vv.criterion_id = c.id
  where c.engagement_id = p_engagement_id
    and c.client_visible
    and c.state <> 'proposed'
    and (c.state = 'agreed' or vv.ids is not null)
    and (private.can_view_client_architecture(p_engagement_id) or private.can_read_architecture(p_engagement_id))
    and private.element_client_readable(e.id)
  order by c.reference_code;
$$;

-- -----------------------------------------------------------------------------
-- Internal: the library and where it is used
-- -----------------------------------------------------------------------------
create function public.method_library()
returns table (
  asset_id uuid,
  key text,
  title text,
  form public.method_asset_form,
  category_key text,
  status text,
  origin public.method_asset_origin,
  current_version_id uuid,
  version_label text,
  version_lifecycle public.method_asset_version_lifecycle,
  architectural_question text,
  has_draft boolean,
  domains public.architecture_domain[],
  context_keys text[],
  release_labels text[],
  application_count int,
  lineage_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.key, a.title, a.form, a.category_key, a.status, a.origin,
    a.current_version_id, cv.version_label, cv.lifecycle, cv.architectural_question,
    exists (select 1 from public.method_asset_versions d where d.asset_id = a.id and d.lifecycle = 'draft'),
    coalesce((select array_agg(d.domain order by d.domain) from public.method_version_domains d
              where d.version_id = cv.id), '{}'),
    coalesce((select array_agg(x.key order by x.key) from public.method_version_contexts mc
              join public.development_contexts x on x.id = mc.context_id where mc.version_id = cv.id), '{}'),
    coalesce((select array_agg(r.version_label order by r.version_label) from public.dam_release_members m
              join public.dam_releases r on r.id = m.release_id
              where m.asset_id = a.id and r.status in ('draft', 'published')), '{}'),
    (select count(*)::int from public.method_applications ap
     join public.method_asset_versions av on av.id = ap.method_asset_version_id where av.asset_id = a.id),
    (select count(*)::int from public.element_method_lineage l where l.method_asset_id = a.id)
  from public.method_assets a
  left join public.method_asset_versions cv on cv.id = a.current_version_id
  where private.is_internal()
  order by a.title;
$$;

-- Per version: counts across all engagements; application and lineage rows
-- only where the caller can read the engagement's architecture.
create function public.method_usage(p_asset_id uuid)
returns table (
  version_id uuid,
  version_no int,
  version_label text,
  lifecycle public.method_asset_version_lifecycle,
  legacy boolean,
  application_count int,
  lineage_count int,
  release_labels text[],
  applications jsonb,
  lineage jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.version_no, v.version_label, v.lifecycle, v.legacy,
    (select count(*)::int from public.method_applications ap where ap.method_asset_version_id = v.id),
    (select count(*)::int from public.element_method_lineage l where l.method_asset_version_id = v.id),
    coalesce((select array_agg(r.version_label order by r.version_label) from public.dam_release_members m
              join public.dam_releases r on r.id = m.release_id where m.asset_version_id = v.id), '{}'),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ap.id, 'reference_code', ap.reference_code, 'title', ap.title, 'state', ap.state,
               'engagement_id', en.id, 'engagement_title', en.title, 'engagement_slug', en.slug
             ) order by en.title, ap.reference_code)
      from public.method_applications ap
      join public.engagements en on en.id = ap.engagement_id
      where ap.method_asset_version_id = v.id and private.can_read_architecture(ap.engagement_id)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'role', l.lineage_role, 'element_id', e.id, 'reference_code', e.reference_code,
               'title', e.title, 'engagement_id', en.id, 'engagement_title', en.title, 'engagement_slug', en.slug
             ) order by en.title, e.reference_code)
      from public.element_method_lineage l
      join public.architecture_elements e on e.id = l.element_id
      join public.engagements en on en.id = l.engagement_id
      where l.method_asset_version_id = v.id and private.can_read_architecture(l.engagement_id)
    ), '[]'::jsonb)
  from public.method_asset_versions v
  where v.asset_id = p_asset_id and private.is_internal()
  order by v.version_no desc;
$$;

-- -----------------------------------------------------------------------------
-- Internal: an engagement's practice
-- -----------------------------------------------------------------------------
create function public.method_application_register(p_engagement_id uuid)
returns table (
  application_id uuid,
  reference_code text,
  title text,
  state public.method_application_state,
  asset_id uuid,
  asset_title text,
  version_id uuid,
  version_label text,
  version_in_release boolean,
  lead_member_id uuid,
  started_on date,
  closed_on date,
  element_link_count int,
  evidence_link_count int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select ap.id, ap.reference_code, ap.title, ap.state, a.id, a.title, v.id, v.version_label, ap.version_in_release,
    (select p.engagement_member_id from public.method_application_practitioners p
     where p.application_id = ap.id and p.role = 'lead'),
    ap.started_on, ap.closed_on,
    (select count(*)::int from public.method_application_elements x where x.application_id = ap.id),
    (select count(*)::int from public.method_application_evidence x where x.application_id = ap.id)
  from public.method_applications ap
  join public.method_asset_versions v on v.id = ap.method_asset_version_id
  join public.method_assets a on a.id = v.asset_id
  where ap.engagement_id = p_engagement_id
  order by ap.reference_code;
$$;

-- The element page's Practice panel: applications linked to the element and
-- its typed lineage. RLS decides what the caller reads.
create function public.element_practice_context(p_element_id uuid)
returns table (
  source text,
  record_id uuid,
  role text,
  application_id uuid,
  application_code text,
  application_title text,
  application_state public.method_application_state,
  asset_id uuid,
  asset_title text,
  form public.method_asset_form,
  version_id uuid,
  version_label text,
  legacy boolean,
  note text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'application', x.id, x.role::text, ap.id, ap.reference_code, ap.title, ap.state,
    a.id, a.title, a.form, v.id, v.version_label, v.legacy, x.note
  from public.method_application_elements x
  join public.method_applications ap on ap.id = x.application_id
  join public.method_asset_versions v on v.id = ap.method_asset_version_id
  join public.method_assets a on a.id = v.asset_id
  where x.element_id = p_element_id
  union all
  select 'lineage', l.id, l.lineage_role::text, null, null, null, null,
    a.id, a.title, a.form, v.id, coalesce(v.version_label, l.method_version), v.legacy, l.note
  from public.element_method_lineage l
  join public.method_asset_versions v on v.id = l.method_asset_version_id
  join public.method_assets a on a.id = v.asset_id
  where l.element_id = p_element_id
  order by 1, 5 nulls last, 9;
$$;

revoke all on function public.client_engagement_methodology(uuid) from public, anon;
revoke all on function public.client_acceptance_criteria(uuid) from public, anon;
revoke all on function public.method_library() from public, anon;
revoke all on function public.method_usage(uuid) from public, anon;
revoke all on function public.method_application_register(uuid) from public, anon;
revoke all on function public.element_practice_context(uuid) from public, anon;
grant execute on function public.client_engagement_methodology(uuid) to authenticated;
grant execute on function public.client_acceptance_criteria(uuid) to authenticated;
grant execute on function public.method_library() to authenticated;
grant execute on function public.method_usage(uuid) to authenticated;
grant execute on function public.method_application_register(uuid) to authenticated;
grant execute on function public.element_practice_context(uuid) to authenticated;
