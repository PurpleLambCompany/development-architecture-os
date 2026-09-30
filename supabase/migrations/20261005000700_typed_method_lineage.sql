-- =============================================================================
-- DSA OS — Phase 6: typed, version-pinned method lineage and the narrow
-- methodology_derived (D18, D19).
--
-- element_method_lineage now pins an exact Method Asset version and says
-- which verb applies, and the form decides which verbs are possible:
--
--   instantiates    a Model      -> a core object
--   produced_from   a Template   -> a Deliverable of the Template's type
--   judged_against  a Standard   -> a Review, a core object or an
--                                   Implementation Initiative
--   legacy_derived_from           pre-Phase 6 rows only; never written again
--
-- A Method is never element lineage: its use is a Method Application.
-- Instruments are used within applications, never lineage. Writes go
-- through record_method_lineage / remove_method_lineage only.
--
-- methodology_derived now means content literally taken from TPLCo's Method:
-- publishing an element with that provenance, or with a methodology_derived
-- statement, needs instantiates lineage to a published Model version.
-- Already-published versions are immutable and are not re-validated.
--
-- See docs/product/PHASE_6_PROPOSAL.md §12.5, §19 and §34 (step 7).
-- =============================================================================

alter table public.element_method_lineage
  add column method_asset_version_id uuid references public.method_asset_versions (id) on delete restrict,
  add column lineage_role public.method_lineage_role;

-- Backfill: every existing row pins its asset's legacy version (D28).
update public.element_method_lineage l
set method_asset_version_id = v.id, lineage_role = 'legacy_derived_from'
from public.method_asset_versions v
where v.asset_id = l.method_asset_id and v.legacy;

alter table public.element_method_lineage
  alter column method_asset_version_id set not null,
  alter column lineage_role set not null,
  drop constraint element_method_lineage_unique,
  add constraint element_method_lineage_unique unique (element_id, method_asset_version_id, lineage_role);
create index element_method_lineage_version_idx on public.element_method_lineage (method_asset_version_id);

-- The published elements the narrow reading asks an architect to revisit:
-- methodology_derived with no instantiates lineage (§34 step 7).
do $$
declare
  report text;
begin
  select string_agg(e.reference_code || ' "' || e.title || '"', ', ' order by e.reference_code) into report
  from public.architecture_elements e
  where e.latest_version_id is not null
    and (e.provenance = 'methodology_derived' or exists (
      select 1 from public.architecture_statements s where s.element_id = e.id and s.provenance = 'methodology_derived'))
    and not exists (select 1 from public.element_method_lineage l where l.element_id = e.id and l.lineage_role = 'instantiates');
  if report is not null then
    raise notice 'Phase 6 backfill: published methodology_derived elements without instantiates lineage: %', report;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Writes through operations only
-- -----------------------------------------------------------------------------
revoke insert, update, delete on public.element_method_lineage from authenticated;
drop policy "element_method_lineage: editors add" on public.element_method_lineage;
drop policy "element_method_lineage: editors change" on public.element_method_lineage;
drop policy "element_method_lineage: editors remove" on public.element_method_lineage;
drop policy "element_method_lineage: internal readers" on public.element_method_lineage;
create policy "element_method_lineage: internal readers"
  on public.element_method_lineage for select to authenticated
  using ((select private.is_internal()) and private.can_read_architecture(engagement_id));

-- Form <-> role <-> kind, pinned to a published proper version. Legacy rows
-- never change; they go only with their (draft) element.
create function private.guard_method_lineage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f public.method_asset_form;
  v public.method_asset_versions;
  element_kind public.element_kind;
  template_type public.deliverable_type;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.architecture_elements where id = old.element_id) then
      return old;
    end if;
    if not private.in_methodology_operation() then
      raise exception 'Method lineage changes only through remove_method_lineage' using errcode = '42501';
    end if;
    if old.lineage_role = 'legacy_derived_from' then
      raise exception 'Pre-Phase 6 lineage is kept as history' using errcode = '23514';
    end if;
    return old;
  end if;
  if not private.in_methodology_operation() then
    raise exception 'Method lineage changes only through record_method_lineage' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.method_asset_version_id <> old.method_asset_version_id or new.lineage_role <> old.lineage_role
       or new.element_id <> old.element_id or new.method_asset_id <> old.method_asset_id
       or new.method_version <> old.method_version then
      raise exception 'Lineage is pinned: remove it and record it again' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.lineage_role = 'legacy_derived_from' then
    if coalesce(current_setting('dsa.methodology_backfill', true), 'off') <> 'on' then
      raise exception 'legacy_derived_from is only for pre-Phase 6 lineage' using errcode = '23514';
    end if;
    select * into v from public.method_asset_versions where id = new.method_asset_version_id;
    new.method_asset_id := v.asset_id;
    return new;
  end if;
  select * into v from public.method_asset_versions where id = new.method_asset_version_id;
  f := private.method_version_form(v.id);
  select e.kind into element_kind from public.architecture_elements e where e.id = new.element_id;
  if new.lineage_role = 'instantiates' and (f is distinct from 'model' or element_kind <> 'object') then
    raise exception 'Only a Model is instantiated, and only into a core object' using errcode = '23514';
  end if;
  if new.lineage_role = 'produced_from' then
    if f is distinct from 'template' or element_kind <> 'deliverable' then
      raise exception 'Only a Deliverable is produced from a Template' using errcode = '23514';
    end if;
    select deliverable_type into template_type from public.template_version_specs where version_id = v.id;
    if template_type is distinct from (select d.deliverable_type from public.deliverables d where d.element_id = new.element_id) then
      raise exception 'This Template produces a different kind of Deliverable' using errcode = '23514';
    end if;
  end if;
  if new.lineage_role = 'judged_against'
     and (f is distinct from 'standard' or element_kind not in ('review', 'object', 'implementation_initiative')) then
    raise exception 'Only a Standard is judged against, by a Review, a core object or an Implementation Initiative'
      using errcode = '23514';
  end if;
  new.method_asset_id := v.asset_id;
  new.method_version := coalesce(v.version_label, '');
  return new;
end;
$$;

create trigger element_method_lineage_guard before insert or update or delete on public.element_method_lineage
  for each row execute function private.guard_method_lineage();

-- Seed and test data describe pre-Phase 6 lineage exactly as the backfill
-- converted it.
create function private.insert_legacy_method_lineage(
  target_element_id uuid,
  target_asset_id uuid,
  old_method_version text,
  target_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform private.begin_methodology_operation();
  perform set_config('dsa.methodology_backfill', 'on', true);
  insert into public.element_method_lineage (element_id, method_asset_id, method_asset_version_id, lineage_role, method_version, note)
  select target_element_id, target_asset_id, v.id, 'legacy_derived_from', coalesce(old_method_version, ''), coalesce(target_note, '')
  from public.method_asset_versions v where v.asset_id = target_asset_id and v.legacy
  returning id into new_id;
  perform set_config('dsa.methodology_backfill', 'off', true);
  perform private.end_methodology_operation();
  return new_id;
end;
$$;
revoke all on function private.insert_legacy_method_lineage(uuid, uuid, text, text) from public, anon, authenticated;

create function public.record_method_lineage(
  p_element_id uuid,
  p_method_version_id uuid,
  p_role public.method_lineage_role,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  new_id uuid;
begin
  e := private.lock_element(p_element_id);
  perform private.require_architecture_capability(e.engagement_id, 'edit_architecture');
  perform private.require_usable_method_version(p_method_version_id, null);
  perform private.begin_methodology_operation();
  insert into public.element_method_lineage (element_id, method_asset_id, method_asset_version_id, lineage_role, note)
  values (e.id, (select asset_id from public.method_asset_versions where id = p_method_version_id),
          p_method_version_id, p_role, btrim(coalesce(p_note, '')))
  returning id into new_id;
  perform private.end_methodology_operation();
  return new_id;
end;
$$;

create function public.remove_method_lineage(p_lineage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.element_method_lineage;
begin
  select * into l from public.element_method_lineage where id = p_lineage_id;
  if not found or not private.is_internal() then
    raise exception 'Lineage not found' using errcode = 'P0002';
  end if;
  perform private.lock_element(l.element_id);
  perform private.require_architecture_capability(l.engagement_id, 'edit_architecture');
  perform private.begin_methodology_operation();
  delete from public.element_method_lineage where id = l.id;
  perform private.end_methodology_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- D19: the publish check. Otherwise publish_element_version is unchanged.
-- -----------------------------------------------------------------------------
create function private.assert_methodology_derived_instantiates(target_element_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (
    exists (select 1 from public.architecture_elements where id = target_element_id and provenance = 'methodology_derived')
    or exists (select 1 from public.architecture_statements where element_id = target_element_id and provenance = 'methodology_derived')
  ) and not exists (
    select 1 from public.element_method_lineage l
    join public.method_asset_versions v on v.id = l.method_asset_version_id
    where l.element_id = target_element_id and l.lineage_role = 'instantiates'
      and v.lifecycle in ('published', 'superseded') and not v.legacy
  ) then
    raise exception 'Methodology-derived content must record the Model it instantiates before it is published'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.publish_element_version(p_element_id uuid, p_change_summary text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  next_no int;
  version_id uuid;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
  if e.lifecycle not in ('draft', 'in_review', 'published') then
    raise exception 'A retired or superseded element cannot be published' using errcode = '23514';
  end if;
  if e.ai_review_state in ('pending', 'rejected') then
    raise exception 'AI analysis must be reviewed and accepted before it is published' using errcode = '23514';
  end if;
  if exists (select 1 from public.architecture_statements where element_id = e.id and ai_review_state = 'pending') then
    raise exception 'Review the AI-analysis statements before publishing' using errcode = '23514';
  end if;
  perform private.assert_record_scope(e);
  perform private.assert_methodology_derived_instantiates(e.id);

  select coalesce(max(version_no), 0) + 1 into next_no from public.element_versions where element_id = e.id;
  insert into public.element_versions (
    engagement_id, element_id, version_no, snapshot, client_snapshot, client_visible_at_publication,
    change_summary, published_by, methodology_version
  ) values (
    e.engagement_id, e.id, next_no,
    private.build_element_snapshot(e.id, false),
    private.build_element_snapshot(e.id, true),
    e.client_visibility = 'client',
    coalesce(btrim(p_change_summary), ''),
    auth.uid(),
    e.methodology_version
  )
  returning id into version_id;

  update public.architecture_elements set lifecycle = 'published', latest_version_id = version_id where id = e.id;

  -- Relationships are published once both ends have a published version.
  update public.architecture_relationships r
  set published_at = clock_timestamp(), published_by = auth.uid()
  where r.published_at is null
    and r.retired_at is null
    and (r.source_element_id = e.id or r.target_element_id = e.id)
    and exists (
      select 1 from public.architecture_elements other
      where other.id = case when r.source_element_id = e.id then r.target_element_id else r.source_element_id end
        and other.latest_version_id is not null
    );

  perform private.end_architecture_operation();
  return version_id;
end;
$$;

revoke all on function private.guard_method_lineage() from public, anon, authenticated;
revoke all on function private.assert_methodology_derived_instantiates(uuid) from public, anon, authenticated;
revoke all on function public.record_method_lineage(uuid, uuid, public.method_lineage_role, text) from public, anon;
revoke all on function public.remove_method_lineage(uuid) from public, anon;
grant execute on function public.record_method_lineage(uuid, uuid, public.method_lineage_role, text) to authenticated;
grant execute on function public.remove_method_lineage(uuid) to authenticated;
