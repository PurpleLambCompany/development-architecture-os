-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 11 of 11.
-- Narrow Practice Intelligence: counts on the Method Asset page (ADR-0059,
-- proposal §17, the deferred D-43).
--
-- Counts with their n, always. A proportion is returned only when n is at
-- least 5 closed applications of the version (OD-5). The threshold is a
-- product and governance threshold for avoiding meaningless small-sample
-- proportions, not a statistical-validity claim. No engagement name, client
-- name or free text is returned, and nothing is scored or ranked.
--
-- Readers: users who can read the Method Library (internal users).
-- =============================================================================

create function private.practice_min_n()
returns int
language sql
immutable
set search_path = ''
as $$ select 5 $$;

create function public.method_practice_counts(p_asset_id uuid)
returns table (
  measure              text,
  version_id           uuid,
  version_label        text,
  stage_key            text,
  stage_title          text,
  stage_ordinal        int,
  treatment            text,
  other_version_id     uuid,
  other_asset_title    text,
  other_version_label  text,
  count                int,
  n                    int,
  proportion           numeric,
  min_n                int
)
language sql
stable
security definer
set search_path = ''
as $$
  with versions as (
    select v.id, v.version_label, v.version_no
    from public.method_asset_versions v
    where v.asset_id = p_asset_id and private.is_internal()
  ),
  closed as (
    select ap.id, ap.method_asset_version_id as version_id, ap.engagement_id
    from public.method_applications ap
    join versions v on v.id = ap.method_asset_version_id
    where ap.state in ('completed', 'discontinued')
  ),
  n_by_version as (
    select v.id as version_id, count(c.id)::int as n
    from versions v left join closed c on c.version_id = v.id
    group by v.id
  )
  -- Stage treatments across closed applications.
  select 'stage_treatment', v.id, v.version_label, s.key, s.title, s.ordinal, t.treatment::text,
         null::uuid, null::text, null::text,
         (select count(*)::int from public.method_application_stage_notes sn
          join closed c on c.id = sn.application_id
          where sn.stage_id = s.id and sn.treatment = t.treatment),
         nv.n,
         case when nv.n >= private.practice_min_n() then round(
           (select count(*) from public.method_application_stage_notes sn
            join closed c on c.id = sn.application_id
            where sn.stage_id = s.id and sn.treatment = t.treatment)::numeric / nv.n, 2) end,
         private.practice_min_n()
  from versions v
  join n_by_version nv on nv.version_id = v.id
  join public.method_version_stages s on s.version_id = v.id
  cross join unnest(enum_range(null::public.method_stage_treatment)) t(treatment)
  union all
  -- Methods applied together within the same engagement, per version pair.
  select 'co_use', v.id, v.version_label, null, null, null, null,
         ov.id, oa.title, ov.version_label,
         count(distinct c.id)::int, nv.n,
         case when nv.n >= private.practice_min_n() then round(count(distinct c.id)::numeric / nv.n, 2) end,
         private.practice_min_n()
  from versions v
  join n_by_version nv on nv.version_id = v.id
  join closed c on c.version_id = v.id
  join public.method_applications other on other.engagement_id = c.engagement_id
   and other.method_asset_version_id <> v.id
  join public.method_asset_versions ov on ov.id = other.method_asset_version_id and ov.asset_id <> p_asset_id
  join public.method_assets oa on oa.id = ov.asset_id
  group by v.id, v.version_label, nv.n, ov.id, oa.title, ov.version_label
  union all
  -- Standards informing agreed criteria, per Standard version.
  select 'standard_informs_criteria', v.id, v.version_label, null, null, null, null, null, null, null,
         count(ac.id)::int, count(ac.id)::int, null::numeric, private.practice_min_n()
  from versions v
  join public.method_asset_versions sv on sv.id = v.id
  join public.method_assets a on a.id = sv.asset_id and a.form = 'standard'
  left join public.acceptance_criteria ac
    on ac.informing_standard_version_id = v.id and ac.state in ('agreed', 'superseded', 'withdrawn')
   and ac.agreed_recorded_by is not null
  group by v.id, v.version_label
  order by 1, 3, 6, 5, 7, 10;
$$;

revoke all on function private.practice_min_n() from public, anon, authenticated;
revoke all on function public.method_practice_counts(uuid) from public, anon;
grant execute on function public.method_practice_counts(uuid) to authenticated;
