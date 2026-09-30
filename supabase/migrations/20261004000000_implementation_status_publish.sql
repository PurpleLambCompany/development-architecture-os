-- Phase 5 acceptance-review fix (Defect 2): update_implementation_status and
-- resolve_implementation_initiative changed the live implementation_initiatives
-- row but never touched element_versions/latest_version_id, so the
-- client-facing client_implementation() (which reads v.client_snapshot, the
-- frozen published version) never reflected a status change. This mirrors
-- Phase 4's resolve_intelligence_record(..., p_publish default false, ...)
-- pattern exactly: an optional, explicit publication path that reuses the
-- existing publish_element_version machinery in the same transaction, so a
-- status transition never silently mutates an already-published snapshot —
-- only an explicit p_publish = true creates and publishes a new one.

drop function if exists public.update_implementation_status(uuid, public.implementation_status, text);

create function public.update_implementation_status(
  p_element_id uuid,
  p_status public.implementation_status,
  p_rationale text default null,
  p_publish boolean default false,
  p_change_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  current_status public.implementation_status;
  version_id uuid;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'implementation_initiative' then
    raise exception 'Only an initiative has an implementation status' using errcode = '23514';
  end if;
  perform private.require_engagement_capability(e.engagement_id, 'manage_implementation');
  if coalesce(p_publish, false) then
    perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
  end if;
  if p_status not in ('not_started', 'in_progress', 'operational', 'stalled') then
    raise exception 'Use resolve or reopen for validated or abandoned' using errcode = '23514';
  end if;
  select implementation_status into current_status from public.implementation_initiatives where element_id = e.id;
  if current_status in ('validated', 'abandoned') then
    raise exception 'Reopen the initiative before changing its status' using errcode = '23514';
  end if;
  if p_status = 'stalled' and coalesce(btrim(p_rationale), '') = '' then
    raise exception 'Say why the initiative has stalled' using errcode = '23514';
  end if;
  perform private.set_implementation_context('edit', p_rationale);
  update public.implementation_initiatives
  set implementation_status = p_status,
      actual_operational_on = case when p_status = 'operational'
        then coalesce(actual_operational_on, private.business_today())
        else actual_operational_on end
  where element_id = e.id;
  perform private.clear_implementation_context();
  perform private.end_architecture_operation();

  if coalesce(p_publish, false) then
    version_id := public.publish_element_version(
      e.id,
      coalesce(nullif(btrim(p_change_summary), ''), 'Status: ' || replace(p_status::text, '_', ' '))
    );
  end if;
  return version_id;
end;
$$;

drop function if exists public.resolve_implementation_initiative(uuid, public.implementation_status, text);

create function public.resolve_implementation_initiative(
  p_element_id uuid,
  p_status public.implementation_status,
  p_rationale text,
  p_publish boolean default false,
  p_change_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  current_status public.implementation_status;
  version_id uuid;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'implementation_initiative' then
    raise exception 'Only an initiative is resolved' using errcode = '23514';
  end if;
  perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
  if p_status not in ('validated', 'abandoned') then
    raise exception '"%" does not resolve an initiative', p_status using errcode = '23514';
  end if;
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'A rationale is required' using errcode = '23514';
  end if;
  select implementation_status into current_status from public.implementation_initiatives where element_id = e.id;
  if current_status in ('validated', 'abandoned') then
    raise exception 'The initiative is already resolved; reopen it first' using errcode = '23514';
  end if;
  if p_status = 'validated' and not exists (
    select 1 from public.architecture_relationships r
    join public.architecture_elements rev on rev.id = r.source_element_id
    where r.target_element_id = e.id and r.relationship_type = 'validates' and r.retired_at is null
      and rev.kind = 'review'
  ) then
    raise exception 'A held review must validate this initiative before it can be marked validated' using errcode = '23514';
  end if;
  perform private.set_implementation_context('resolved', p_rationale);
  update public.implementation_initiatives
  set implementation_status = p_status,
      actual_operational_on = case when p_status = 'validated'
        then coalesce(actual_operational_on, private.business_today())
        else actual_operational_on end
  where element_id = e.id;
  perform private.clear_implementation_context();
  perform private.end_architecture_operation();

  if coalesce(p_publish, false) then
    version_id := public.publish_element_version(
      e.id,
      coalesce(nullif(btrim(p_change_summary), ''), 'Resolved: ' || replace(p_status::text, '_', ' ') || '. ' || btrim(p_rationale))
    );
  end if;
  return version_id;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.update_implementation_status(uuid, public.implementation_status, text, boolean, text)',
    'public.resolve_implementation_initiative(uuid, public.implementation_status, text, boolean, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
