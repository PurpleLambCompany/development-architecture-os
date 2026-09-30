-- =============================================================================
-- DSA OS — Phase 6: pre-Phase 6 Method Assets become legacy assets (D28).
--
-- The migration cannot know what an existing asset is without inventing it,
-- so no form is inferred and nothing is renamed. Every existing asset keeps
-- its title and meaning and becomes `legacy` (a retired one stays retired),
-- with one frozen legacy version that carries its old content:
--
--   version_label  the original version text (e.g. 'DAM 1.0')
--   summary        the original description
--   domains        the original methodology_domain
--
-- A legacy version cannot be applied, instantiated, cited or used as a
-- component. An asset becomes a proper form only when a publish_methodology
-- holder adopts it (adopt_legacy_method_asset), which opens its first proper
-- draft. The Strategic Model Library Index therefore remains exactly what it
-- was. See docs/product/PHASE_6_PROPOSAL.md §34 and D28.
-- =============================================================================

-- A URL-safe key from a title, unique among assets.
create function private.method_asset_key_from_title(target_title text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  base := left(btrim(regexp_replace(lower(coalesce(target_title, '')), '[^a-z0-9]+', '-', 'g'), '-'), 70);
  if base = '' then
    base := 'method-asset';
  end if;
  candidate := base;
  while exists (select 1 from public.method_assets where key = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- The governed category closest to a pre-Phase 6 free-text category.
create function private.legacy_method_category(target_category text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select c.key from public.method_asset_categories c
      where c.key in (
        regexp_replace(lower(btrim(coalesce(target_category, ''))), '[^a-z]+', '_', 'g'),
        regexp_replace(lower(btrim(coalesce(target_category, ''))), '[^a-z]+', '_', 'g') || 's'
      )
      limit 1
    ),
    'other'
  );
$$;

-- Converts one asset, given its pre-Phase 6 content, into a legacy asset
-- with one frozen legacy version. Used by this migration and by seed data.
create function private.convert_to_legacy_method_asset(
  target_asset_id uuid,
  old_category text,
  old_domain public.architecture_domain,
  old_version text,
  old_status text,
  old_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_assets;
  label text;
  legacy_version uuid;
  was_retired boolean := old_status = 'retired';
begin
  select * into a from public.method_assets where id = target_asset_id for update;
  label := left(btrim(regexp_replace(coalesce(old_version, ''), '[^A-Za-z0-9 .-]', '', 'g')), 40);
  if label !~ '^[A-Za-z0-9]' then
    label := '1.0';
  end if;

  perform private.begin_methodology_operation();
  update public.method_assets
  set key = coalesce(a.key, private.method_asset_key_from_title(a.title)),
      category_key = coalesce(a.category_key, private.legacy_method_category(old_category)),
      status = case when was_retired then 'retired' else 'legacy' end,
      retired_at = case when was_retired then coalesce(a.retired_at, a.updated_at) else a.retired_at end,
      retired_reason = case when was_retired then coalesce(a.retired_reason, 'Retired before Phase 6') else a.retired_reason end
  where id = a.id;

  -- Written as a draft, given its domains, then frozen in one step.
  insert into public.method_asset_versions (asset_id, legacy, version_no, summary, change_summary, authored_by, created_by)
  values (a.id, true, 1, left(coalesce(old_description, ''), 4000), 'Carried over from before Phase 6.',
          a.created_by, a.created_by)
  returning id into legacy_version;
  if old_domain is not null then
    insert into public.method_version_domains (version_id, domain) values (legacy_version, old_domain);
  end if;
  update public.method_asset_versions
  set version_label = label,
      lifecycle = case when was_retired then 'retired' else 'published' end::public.method_asset_version_lifecycle,
      published_at = a.created_at,
      effective_on = (a.created_at at time zone 'America/Chicago')::date,
      retired_reason = case when was_retired then 'Retired before Phase 6' end,
      retired_at = case when was_retired then coalesce(a.retired_at, a.updated_at) end
  where id = legacy_version;
  if not was_retired then
    update public.method_assets set current_version_id = legacy_version where id = a.id;
  end if;
  perform private.end_methodology_operation();
  return legacy_version;
end;
$$;

-- Seed and test data describe pre-Phase 6 assets through this function, so
-- they are exactly what the backfill produces.
create function private.insert_legacy_method_asset(
  target_title text,
  old_category text,
  old_domain public.architecture_domain,
  old_version text,
  old_status text,
  old_description text,
  target_steward uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_asset uuid;
begin
  perform private.begin_methodology_operation();
  insert into public.method_assets (key, title, category_key, status, steward_user_id, created_by)
  values (private.method_asset_key_from_title(target_title), btrim(target_title),
          private.legacy_method_category(old_category), 'legacy', target_steward, target_steward)
  returning id into new_asset;
  perform private.end_methodology_operation();
  perform private.convert_to_legacy_method_asset(new_asset, old_category, old_domain, old_version, old_status, old_description);
  return new_asset;
end;
$$;

-- -----------------------------------------------------------------------------
-- Backfill every existing asset, then drop the pre-Phase 6 content columns.
-- -----------------------------------------------------------------------------
select private.convert_to_legacy_method_asset(id, category, methodology_domain, version, status, description)
from public.method_assets
order by created_at, id;

alter table public.method_assets
  drop column category,
  drop column version,
  drop column methodology_domain,
  drop column description,
  alter column key set not null,
  alter column category_key set not null;

alter table public.method_assets drop constraint method_assets_status_check;
alter table public.method_assets
  alter column status set default 'active',
  add constraint method_assets_status_check check (status in ('active', 'retired', 'legacy')),
  -- Form is null only for an asset that has not been adopted.
  add constraint method_assets_form_required check (form is not null or status in ('legacy', 'retired'));

-- -----------------------------------------------------------------------------
-- Adoption: a publish_methodology holder gives a legacy asset its form and
-- opens its first proper draft, derived from the legacy version. The legacy
-- version stays published (and in DAM 1.0) until the first proper version
-- is published and supersedes it.
-- -----------------------------------------------------------------------------
create function public.adopt_legacy_method_asset(
  p_asset_id uuid,
  p_form public.method_asset_form,
  p_category_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_assets;
  legacy_version public.method_asset_versions;
  new_version uuid;
begin
  perform private.require_practice_capability('publish_methodology');
  a := private.lock_method_asset(p_asset_id);
  if a.status <> 'legacy' then
    raise exception 'Only a legacy asset can be adopted' using errcode = '23514';
  end if;
  if p_form is null then
    raise exception 'Adoption gives the asset its form' using errcode = '23514';
  end if;
  if p_category_key is not null and not exists (
    select 1 from public.method_asset_categories where key = p_category_key and active
  ) then
    raise exception 'Choose an active category' using errcode = '23514';
  end if;
  select * into legacy_version from public.method_asset_versions
  where asset_id = a.id and legacy order by version_no desc limit 1;

  perform private.begin_methodology_operation();
  update public.method_assets
  set form = p_form, status = 'active', category_key = coalesce(p_category_key, category_key)
  where id = a.id;
  insert into public.method_asset_versions (asset_id, version_no, summary, derived_from_version_id)
  values (
    a.id,
    (select coalesce(max(version_no), 0) + 1 from public.method_asset_versions where asset_id = a.id),
    coalesce(legacy_version.summary, ''),
    legacy_version.id
  ) returning id into new_version;
  insert into public.method_version_domains (version_id, domain)
    select new_version, domain from public.method_version_domains where version_id = legacy_version.id;
  perform private.log_methodology_event('method_assets', a.id, 'adopted', jsonb_build_object('form', p_form));
  perform private.end_methodology_operation();
  return new_version;
end;
$$;

revoke all on function private.method_asset_key_from_title(text) from public, anon, authenticated;
revoke all on function private.legacy_method_category(text) from public, anon, authenticated;
revoke all on function private.convert_to_legacy_method_asset(uuid, text, public.architecture_domain, text, text, text)
  from public, anon, authenticated;
revoke all on function private.insert_legacy_method_asset(text, text, public.architecture_domain, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.adopt_legacy_method_asset(uuid, public.method_asset_form, text) from public, anon;
grant execute on function public.adopt_legacy_method_asset(uuid, public.method_asset_form, text) to authenticated;
