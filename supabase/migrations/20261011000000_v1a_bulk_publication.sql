-- =============================================================================
-- V1-A Increment 5 (Workstream D, decision D8): publishing at scale.
--
-- Gate A needs a real engagement (100-300 elements) to move through review
-- and publication without one browser round trip per element. This
-- migration adds exactly two functions and changes no table and no existing
-- function:
--
--   public.submit_elements_for_review(p_element_ids uuid[])
--   public.publish_element_versions(p_element_ids uuid[], p_change_summary text default '')
--
-- Composition, not a second model. Each function loops over the given ids
-- and, for every one, calls the existing single-element function
-- (public.submit_element_for_review / public.publish_element_version)
-- exactly as a human submitting one element at a time would trigger it.
-- Nothing here re-implements a capability check, a lifecycle rule, record
-- scope, methodology lineage, version numbering, snapshotting, audit, or
-- relationship publication: every one of those still lives only in the
-- single-element function, so individual publication and bulk publication
-- can never disagree about what is allowed.
--
-- Partial success, not all-or-nothing. The accepted plan's own "Tests" text
-- for this workstream says it directly: "partial failure (one refused
-- element does not block the rest)". Each element's own call runs inside a
-- nested begin/exception block. A plpgsql exception block is an implicit
-- savepoint: on an exception, Postgres rolls back only that element's work
-- (and its row lock) and continues the loop; nothing commits or rolls back
-- at the statement level, since COMMIT/ROLLBACK are not legal inside a
-- function body and are not used anywhere else in this schema. The caller
-- gets one row per element: success with its new version id, or the exact
-- error the single-element function would have raised for that id alone
-- (the same "not found" for an unauthorized-or-cross-engagement id that the
-- single-element RPC already gives, since require_architecture_capability
-- is unchanged; a lifecycle/scope/lineage refusal with its own message
-- otherwise). That per-row detail is returned only to the caller who
-- submitted those exact ids, so it discloses nothing beyond what calling the
-- single-element function on each id separately already would.
--
-- Stable order and duplicates. The input is deduplicated and sorted
-- ascending by element id before anything is locked: `array(select distinct
-- x from unnest(...) order by x)`. Deduplication means a repeated id is
-- processed once, so passing the same id twice cannot create two versions or
-- two audit rows for one publish request; the result set has exactly one row
-- per distinct id, never one row per input position. Ascending-id order
-- means every bulk call -- whoever submits it, whatever order its ids were
-- selected in on screen -- locks the same set of overlapping elements in the
-- same global order, which is the existing deadlock-avoidance pattern this
-- schema already uses for two-row locking (supersede_element's "lock in a
-- stable order so two supersessions cannot deadlock"). Without this, two
-- concurrent bulk publishes over an overlapping selection, each holding its
-- locks for its whole request rather than releasing them element-by-element
-- the way separate individual-publish requests would, could deadlock; sorted
-- order rules that out. A null entry (not a real id) is excluded by the same
-- `where x is not null` and produces no row at all, same as it would if a
-- caller tried to pass null to the single-element function directly; a real
-- id that turns out not to exist, or that the caller cannot read, still gets
-- its own refused row (P0002), so no real submitted id is ever dropped
-- silently.
--
-- Scale, not a queue. The request is refused outright (23514, before
-- touching a single row) when more than 500 ids are given. V1 scale is
-- "at least 150"; 500 is a generous ceiling against an unbounded request
-- from the UI or a mistaken script, not a throughput target, and is well
-- short of anything that would need a background worker. Both begin and end
-- every pass through private.begin_architecture_operation() /
-- end_architecture_operation() exactly once per element, inherited from
-- the single-element function each call makes; those are transaction-local
-- set_config calls, not a counter, so looping them is correct and matches
-- how every other repeated-call site in this schema already uses them
-- (e.g. supersede_element's and the Phase 4 implementation-status trigger's
-- calls into publish_element_version).
-- =============================================================================

create function public.submit_elements_for_review(p_element_ids uuid[])
returns table(element_id uuid, submitted boolean, error_code text, error_message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[] := array(select distinct x from unnest(coalesce(p_element_ids, '{}')) x where x is not null order by x);
  target_id uuid;
begin
  if array_length(ids, 1) is null then
    return;
  end if;
  if array_length(ids, 1) > 500 then
    raise exception 'At most 500 elements can be submitted for review in one request' using errcode = '23514';
  end if;

  for i in 1 .. array_length(ids, 1) loop
    target_id := ids[i];

    begin
      perform public.submit_element_for_review(target_id);
      element_id := target_id;
      submitted := true;
      error_code := null;
      error_message := null;
      return next;
    exception when others then
      element_id := target_id;
      submitted := false;
      error_code := sqlstate;
      error_message := sqlerrm;
      return next;
    end;
  end loop;
  return;
end;
$$;

revoke all on function public.submit_elements_for_review(uuid[]) from public, anon;
grant execute on function public.submit_elements_for_review(uuid[]) to authenticated;

create function public.publish_element_versions(p_element_ids uuid[], p_change_summary text default '')
returns table(element_id uuid, published boolean, version_id uuid, error_code text, error_message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[] := array(select distinct x from unnest(coalesce(p_element_ids, '{}')) x where x is not null order by x);
  target_id uuid;
  new_version_id uuid;
begin
  if array_length(ids, 1) is null then
    return;
  end if;
  if array_length(ids, 1) > 500 then
    raise exception 'At most 500 elements can be published in one request' using errcode = '23514';
  end if;

  for i in 1 .. array_length(ids, 1) loop
    target_id := ids[i];

    begin
      new_version_id := public.publish_element_version(target_id, p_change_summary);
      element_id := target_id;
      published := true;
      version_id := new_version_id;
      error_code := null;
      error_message := null;
      return next;
    exception when others then
      element_id := target_id;
      published := false;
      version_id := null;
      error_code := sqlstate;
      error_message := sqlerrm;
      return next;
    end;
  end loop;
  return;
end;
$$;

revoke all on function public.publish_element_versions(uuid[], text) from public, anon;
grant execute on function public.publish_element_versions(uuid[], text) to authenticated;
