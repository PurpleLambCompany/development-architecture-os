-- Phase 5 acceptance-review fix (Defect 4): area-limited Client Contributors
-- currently see ZERO Phase 5 records (reviews, deliverables, implementation
-- initiatives), regardless of area — confirmed empirically. Every client
-- Phase 5 read model already gates on private.element_client_readable, the
-- same central helper every Phase 3/4 client policy goes through, which for
-- a plain Contributor collapses to private.element_in_member_areas. That
-- function's `concerned` CTE, which maps a non-object record to the
-- architecture objects it "concerns" for area matching, only recognized the
-- Phase 3/4 relationship vocabulary ('underpins', 'threatens', 'constrains',
-- 'mitigates', 'affects', 'addresses', 'advances', 'pursues'), so a Phase 5
-- element's `concerned` set was always empty and it never matched an area.
--
-- Fix (see ADR-0040): extend the same "walk to concerned objects, check
-- against areas" pattern already used for Phase 3/4 records to also resolve
-- Phase 5's structural vocabulary:
--   * Implementation Initiative --implements--> object
--   * Deliverable --documents--> object
--   * Review --examines--> object
-- all resolve through the existing `concerned`/`concerned_objects` walk once
-- 'implements', 'documents' and 'examines' are recognized relationship
-- types. A Review examining an Implementation Initiative (rather than an
-- object directly) needs a second path: the initiative's own area
-- membership (via what it implements, or a direct area assignment to it)
-- is walked in a small additional CTE, mirroring the existing recursive
-- `ancestry` CTE's style, so a Review is visible when it examines an
-- Initiative that is itself visible.
create or replace function private.element_in_member_areas(target_member_id uuid, target_element_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive
  target as (
    select e.id, e.kind, e.engagement_wide
    from public.architecture_elements e
    where e.id = target_element_id
  ),
  areas as (
    select a.domain, a.element_id
    from public.engagement_member_areas a
    where a.engagement_member_id = target_member_id
  ),
  concerned as (
    select t.id as element_id from target t where t.kind = 'object'
    union
    select case when r.source_element_id = t.id then r.target_element_id else r.source_element_id end
    from target t
    join public.architecture_relationships r on r.source_element_id = t.id or r.target_element_id = t.id
    where t.kind <> 'object' and not t.engagement_wide
      and r.retired_at is null and r.published_at is not null
      and r.relationship_type in ('underpins', 'threatens', 'constrains', 'mitigates', 'affects', 'addresses',
                                  'advances', 'pursues', 'implements', 'documents', 'examines')
    union
    select v.x
    from target t
    join public.dependencies d on d.element_id = t.id
    cross join lateral (values (d.from_element_id), (d.to_element_id)) v(x)
    where not t.engagement_wide
  ),
  concerned_objects as (
    select c.element_id, o.domain
    from concerned c
    join public.architecture_objects o on o.element_id = c.element_id
  ),
  ancestry (element_id) as (
    select element_id from concerned_objects
    union
    select r.target_element_id
    from ancestry an
    join public.architecture_relationships r on r.source_element_id = an.element_id
    where r.relationship_type = 'part_of' and r.retired_at is null and r.published_at is not null
  ),
  -- A Review's own `examines` may point at an Implementation Initiative
  -- instead of an object. The initiative's area membership is then walked
  -- independently (what it implements, and its ancestry), so a Review that
  -- examines an otherwise-visible initiative is visible too, even with no
  -- direct link to an object of its own.
  examined_initiatives as (
    select case when r.source_element_id = t.id then r.target_element_id else r.source_element_id end as element_id
    from target t
    join public.architecture_relationships r on r.source_element_id = t.id or r.target_element_id = t.id
    join public.architecture_elements ei on ei.id = case when r.source_element_id = t.id then r.target_element_id else r.source_element_id end
    where t.kind = 'review' and r.relationship_type = 'examines' and r.retired_at is null and r.published_at is not null
      and ei.kind = 'implementation_initiative'
  ),
  examined_initiative_objects as (
    select ei.element_id as initiative_id,
      case when r.source_element_id = ei.element_id then r.target_element_id else r.source_element_id end as object_id
    from examined_initiatives ei
    join public.architecture_relationships r on r.source_element_id = ei.element_id or r.target_element_id = ei.element_id
    where r.relationship_type = 'implements' and r.retired_at is null and r.published_at is not null
  ),
  examined_initiative_concerned_objects as (
    select eio.initiative_id, o.domain
    from examined_initiative_objects eio
    join public.architecture_objects o on o.element_id = eio.object_id
  ),
  examined_initiative_ancestry (initiative_id, element_id) as (
    select initiative_id, object_id from examined_initiative_objects
    union
    select an.initiative_id, r.target_element_id
    from examined_initiative_ancestry an
    join public.architecture_relationships r on r.source_element_id = an.element_id
    where r.relationship_type = 'part_of' and r.retired_at is null and r.published_at is not null
  )
  select exists (select 1 from areas a join target t on a.element_id = t.id)
      or exists (select 1 from areas a join concerned_objects c on a.domain = c.domain)
      or exists (select 1 from areas a join ancestry an on a.element_id = an.element_id)
      or exists (
        select 1 from target t
        join public.intelligence_record_domains d on d.element_id = t.id
        join areas a on a.domain = d.domain
        where not t.engagement_wide
      )
      or exists (select 1 from areas a join examined_initiatives ei on a.element_id = ei.element_id)
      or exists (select 1 from areas a join examined_initiative_concerned_objects c on a.domain = c.domain)
      or exists (select 1 from areas a join examined_initiative_ancestry an on a.element_id = an.element_id);
$$;

revoke all on function private.element_in_member_areas(uuid, uuid) from public, anon, authenticated;
