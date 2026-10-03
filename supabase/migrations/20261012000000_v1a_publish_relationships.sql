-- =============================================================================
-- V1-A Increment 6 (Workstream D, decision D2): publishing relationships
-- between already-published elements.
--
-- publish_element_version's own side effect only publishes a relationship
-- as a consequence of one of its ends being freshly published (see
-- typed_method_lineage.sql:294-304). A relationship recorded later between
-- two elements that are BOTH already published never triggers that check
-- again, so it stays "Draft" (and invisible to the client) forever unless
-- one end is meaninglessly republished.
--
-- This migration adds exactly one function and changes no table and no
-- existing function: public.publish_relationships(p_relationship_ids uuid[]).
-- It reuses the exact same relationship lifecycle and column semantics
-- already in place (published_at/published_by, the architecture-operation
-- guard, require_architecture_capability) -- no new table, no new status
-- enum value, no second publication model. The eligibility rule mirrors,
-- field for field, the one already encoded in publish_element_version's
-- side effect: the relationship itself must be unpublished and not
-- retired, and the OTHER end (from each end's own perspective) must have
-- latest_version_id is not null. Checking both ends independently this way
-- (rather than "the engagement has a published element") is exactly what
-- the existing per-element side effect already does, just run for a
-- relationship directly instead of as a consequence of publishing one of
-- its elements.
--
-- Composition, partial success, stable order: this follows the same shape
-- as publish_element_versions / submit_elements_for_review (D1, D8). Each
-- relationship is locked and processed in its own begin/exception block (an
-- implicit savepoint), ids are deduplicated and sorted ascending before
-- locking to avoid deadlocking against a concurrent call over an
-- overlapping selection, and the caller gets one row per distinct id with
-- either success or the exact refusal reason for that id alone.
--
-- No element version is created as a side effect -- this function only
-- ever touches public.architecture_relationships.
-- =============================================================================

create function public.publish_relationships(p_relationship_ids uuid[])
returns table(relationship_id uuid, published boolean, error_code text, error_message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[] := array(select distinct x from unnest(coalesce(p_relationship_ids, '{}')) x where x is not null order by x);
  target_id uuid;
  r public.architecture_relationships;
  source_e public.architecture_elements;
  target_e public.architecture_elements;
begin
  if array_length(ids, 1) is null then
    return;
  end if;
  if array_length(ids, 1) > 500 then
    raise exception 'At most 500 relationships can be published in one request' using errcode = '23514';
  end if;

  for i in 1 .. array_length(ids, 1) loop
    target_id := ids[i];

    begin
      perform private.begin_architecture_operation();

      select * into r from public.architecture_relationships where id = target_id for update;
      if not found then
        raise exception 'Relationship not found' using errcode = 'P0002';
      end if;

      perform private.require_architecture_capability(r.engagement_id, 'publish_architecture');

      if r.published_at is not null then
        raise exception 'This relationship is already published' using errcode = '23514';
      end if;
      if r.retired_at is not null then
        raise exception 'A retired relationship cannot be published' using errcode = '23514';
      end if;

      select * into source_e from public.architecture_elements where id = r.source_element_id;
      select * into target_e from public.architecture_elements where id = r.target_element_id;
      if source_e.latest_version_id is null or target_e.latest_version_id is null then
        raise exception 'Both ends of this relationship must be published first' using errcode = '23514';
      end if;

      update public.architecture_relationships
      set published_at = clock_timestamp(), published_by = auth.uid()
      where id = target_id;

      perform private.end_architecture_operation();

      relationship_id := target_id;
      published := true;
      error_code := null;
      error_message := null;
      return next;
    exception when others then
      perform private.end_architecture_operation();
      relationship_id := target_id;
      published := false;
      error_code := sqlstate;
      error_message := sqlerrm;
      return next;
    end;
  end loop;
  return;
end;
$$;

revoke all on function public.publish_relationships(uuid[]) from public, anon;
grant execute on function public.publish_relationships(uuid[]) to authenticated;
