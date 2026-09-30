-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 2 of 11.
-- Substantive revision (Q30, ADR-0053, proposal §12).
--
-- A published version n >= 2 is a substantive revision if and only if its
-- internal snapshot differs from version n - 1 after removing, from both, the
-- excluded paths for the element's kind. Version 1 is a first publication, a
-- separate change type. The excluded paths are status and lifecycle fields
-- only; everything else is content. change_summary is never parsed.
--
-- Computed at read time from the immutable element_versions; nothing is stored
-- on element_versions, and Phase 3's publication path is unchanged.
--
-- Mirror: src/domain/edge/substantive.ts (substantive.test.ts).
-- =============================================================================

-- The excluded details keys for a kind (§12.2).
create function private.substantive_detail_exclusions(p_kind public.element_kind)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'object' then array['maturity', 'maturity_rationale']
    when 'assumption' then array['validation_status', 'validation_note']
    when 'risk' then array['risk_status']
    when 'constraint' then array['constraint_status']
    when 'dependency' then array['dependency_status']
    when 'decision' then array['decision_status', 'deferred_reason']
    when 'recommendation' then array[]::text[]
    when 'opportunity' then array['opportunity_status']
    when 'review' then array['review_status', 'held_at']
    when 'deliverable' then array[]::text[]
    when 'implementation_initiative' then array['implementation_status', 'actual_operational_on']
  end;
$$;

-- The full excluded-path list for a kind, as documented and mirrored.
create function private.substantive_excluded_paths(p_kind public.element_kind)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['ai_review_state', 'ai_reviewed_by', 'ai_reviewed_at',
               'statements[].ai_review_state', 'statements[].ai_reviewed_by']
         || coalesce((select array_agg('details.' || k order by ord)
                      from unnest(private.substantive_detail_exclusions(p_kind)) with ordinality u(k, ord)),
                     array[]::text[]);
$$;

-- The snapshot with the excluded paths removed.
create function private.substantive_snapshot(p_kind public.element_kind, p_snapshot jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_snapshot is null then null else
    (p_snapshot - array['ai_review_state', 'ai_reviewed_by', 'ai_reviewed_at'])
    || jsonb_build_object('details',
         coalesce(p_snapshot -> 'details', '{}'::jsonb) - private.substantive_detail_exclusions(p_kind))
    || case when jsonb_typeof(p_snapshot -> 'statements') = 'array' then
         jsonb_build_object('statements', coalesce((
           select jsonb_agg(case when jsonb_typeof(s) = 'object'
                                 then s - array['ai_review_state', 'ai_reviewed_by'] else s end
                            order by ord)
           from jsonb_array_elements(p_snapshot -> 'statements') with ordinality x(s, ord)
         ), '[]'::jsonb))
       else '{}'::jsonb end
  end;
$$;

-- The top-level and details keys that differ between two reduced snapshots,
-- for explanation only.
create function private.snapshot_changed_paths(p_before jsonb, p_after jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(path order by path), array[]::text[])
  from (
    select k as path
    from (select jsonb_object_keys(coalesce(p_before, '{}'::jsonb)) as k
          union select jsonb_object_keys(coalesce(p_after, '{}'::jsonb))) keys
    where k <> 'details' and (p_before -> k) is distinct from (p_after -> k)
    union all
    select 'details.' || k
    from (select jsonb_object_keys(coalesce(p_before -> 'details', '{}'::jsonb)) as k
          union select jsonb_object_keys(coalesce(p_after -> 'details', '{}'::jsonb))) keys
    where (p_before -> 'details' -> k) is distinct from (p_after -> 'details' -> k)
  ) d;
$$;

-- Every published version of an engagement's elements, classified. Unchecked:
-- called only by the checked read functions below and in later migrations.
create function private.element_revision_rows(p_engagement_id uuid, p_element_id uuid default null)
returns table (
  element_id           uuid,
  kind                 public.element_kind,
  version_id           uuid,
  version_no           int,
  previous_version_id  uuid,
  published_at         timestamptz,
  change_type          text,
  changed_paths        text[],
  change_summary       text
)
language sql
stable
set search_path = ''
as $$
  with v as (
    select ev.id, ev.element_id, e.kind, ev.version_no, ev.published_at, ev.change_summary,
           private.substantive_snapshot(e.kind, ev.snapshot) as reduced,
           lag(ev.id) over w as previous_id,
           lag(private.substantive_snapshot(e.kind, ev.snapshot)) over w as previous_reduced
    from public.element_versions ev
    join public.architecture_elements e on e.id = ev.element_id
    where ev.engagement_id = p_engagement_id
      and (p_element_id is null or ev.element_id = p_element_id)
    window w as (partition by ev.element_id order by ev.version_no)
  )
  select v.element_id, v.kind, v.id, v.version_no, v.previous_id, v.published_at,
         case
           when v.previous_id is null then 'first_publication'
           when v.reduced is distinct from v.previous_reduced then 'substantive_revision'
           else 'status_publication'
         end,
         case when v.previous_id is null then array[]::text[]
              else private.snapshot_changed_paths(v.previous_reduced, v.reduced) end,
         v.change_summary
  from v;
$$;

-- Per element: its latest content version (first publication or substantive
-- revision) and its latest substantive revision. Revisions are monotone in
-- time, so "a substantive revision after T" is "the latest revision after T".
create function private.element_content_state(p_engagement_id uuid)
returns table (
  element_id                   uuid,
  latest_content_version_id    uuid,
  latest_content_version_no    int,
  latest_content_published_at  timestamptz,
  latest_revision_version_id   uuid,
  latest_revision_version_no   int,
  latest_revision_published_at timestamptz,
  latest_revision_summary      text,
  latest_revision_paths        text[],
  revision_count               int
)
language sql
stable
set search_path = ''
as $$
  with r as (select * from private.element_revision_rows(p_engagement_id))
  select e.element_id,
         c.version_id, c.version_no, c.published_at,
         s.version_id, s.version_no, s.published_at, s.change_summary, s.changed_paths,
         (select count(*)::int from r x where x.element_id = e.element_id and x.change_type = 'substantive_revision')
  from (select distinct r.element_id from r) e
  left join lateral (
    select x.version_id, x.version_no, x.published_at from r x
    where x.element_id = e.element_id and x.change_type in ('first_publication', 'substantive_revision')
    order by x.version_no desc limit 1
  ) c on true
  left join lateral (
    select x.version_id, x.version_no, x.published_at, x.change_summary, x.changed_paths from r x
    where x.element_id = e.element_id and x.change_type = 'substantive_revision'
    order by x.version_no desc limit 1
  ) s on true;
$$;

-- Internal read: every published version, classified (§12.3).
create function public.element_revisions(p_engagement_id uuid, p_element_id uuid default null)
returns table (
  element_id           uuid,
  reference_code       text,
  kind                 public.element_kind,
  version_id           uuid,
  version_no           int,
  previous_version_id  uuid,
  published_at         timestamptz,
  change_type          text,
  changed_paths        text[],
  change_summary       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.element_id, e.reference_code, r.kind, r.version_id, r.version_no, r.previous_version_id,
         r.published_at, r.change_type, r.changed_paths, r.change_summary
  from private.element_revision_rows(p_engagement_id, p_element_id) r
  join public.architecture_elements e on e.id = r.element_id
  where private.can_read_architecture(p_engagement_id)
  order by e.reference_code, r.version_no;
$$;

revoke all on function private.substantive_detail_exclusions(public.element_kind) from public, anon, authenticated;
revoke all on function private.substantive_excluded_paths(public.element_kind) from public, anon, authenticated;
revoke all on function private.substantive_snapshot(public.element_kind, jsonb) from public, anon, authenticated;
revoke all on function private.snapshot_changed_paths(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.element_revision_rows(uuid, uuid) from public, anon, authenticated;
revoke all on function private.element_content_state(uuid) from public, anon, authenticated;
revoke all on function public.element_revisions(uuid, uuid) from public, anon;
grant execute on function public.element_revisions(uuid, uuid) to authenticated;
