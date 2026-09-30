-- =============================================================================
-- DSA OS — Phase 6: DAM releases and Development Context.
--
-- A DAM release is a named, frozen set of exact published Method Asset
-- versions, at most one per asset (D7). Membership is editable only while
-- the release is a draft; publication freezes it and records the
-- architecture vocabulary in force, which the release documents and never
-- governs (D27, ADR-0016). There are no DAM phases (D8): current_phase is
-- untouched.
--
-- engagements.dam_release_id records the release an engagement is conducted
-- under. engagements.methodology_version stays (every element copies it,
-- ADR-0013) and is kept equal to 'DAM ' || the release label by trigger.
-- Changing an engagement's release needs publish_architecture on it and a
-- reason. The pre-Phase 6 methodology becomes release 1.0, containing every
-- legacy version (D28).
--
-- A Development Context is a governed, internal classification of the kind
-- of development environment (D15, D16). The table is empty in migration;
-- publish_methodology holders define contexts, with append-only revisions.
-- Engagements declare theirs (one primary); asset versions declare where
-- they apply (none means any).
--
-- See docs/product/PHASE_6_PROPOSAL.md §10, §13, §24, §25 and §34.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DAM releases
-- -----------------------------------------------------------------------------
alter table public.method_asset_versions add constraint method_asset_versions_asset_key unique (id, asset_id);

create table public.dam_releases (
  id                     uuid primary key default gen_random_uuid(),
  version_label          text not null unique check (version_label ~ '^[0-9]+(\.[0-9]+){0,2}$'),
  title                  text not null check (char_length(btrim(title)) between 1 and 200),
  status                 public.dam_release_status not null default 'draft',
  summary                text not null default '' check (char_length(summary) <= 4000),
  change_summary         text not null default '' check (char_length(change_summary) <= 4000),
  effective_on           date,
  supersedes_release_id  uuid references public.dam_releases (id) on delete restrict,
  vocabulary_record      jsonb,
  published_by           uuid references public.profiles (id) on delete set null,
  published_at           timestamptz,
  retired_reason         text check (retired_reason is null or char_length(retired_reason) <= 1000),
  retired_at             timestamptz,
  created_by             uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint dam_releases_published check (status = 'draft' or (published_at is not null and vocabulary_record is not null)),
  constraint dam_releases_retired check ((status = 'retired') = (retired_at is not null))
);
create unique index dam_releases_one_published on public.dam_releases ((true)) where status = 'published';

create table public.dam_release_members (
  release_id        uuid not null references public.dam_releases (id) on delete cascade,
  asset_id          uuid not null references public.method_assets (id) on delete restrict,
  asset_version_id  uuid not null,
  added_by          uuid references public.profiles (id) on delete set null default auth.uid(),
  added_at          timestamptz not null default now(),
  primary key (release_id, asset_id),
  constraint dam_release_members_version_fk foreign key (asset_version_id, asset_id)
    references public.method_asset_versions (id, asset_id) on delete restrict
);
create index dam_release_members_version_idx on public.dam_release_members (asset_version_id);

-- Releases: drafts change through operations; a published release only
-- moves to superseded or retired; only drafts are deleted.
create function private.guard_dam_release()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.in_methodology_operation() then
    raise exception 'DAM releases change only through methodology operations' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'A published DAM release is permanent' using errcode = '23514';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if (to_jsonb(new) - array['status', 'retired_reason', 'retired_at', 'updated_at'])
       is distinct from (to_jsonb(old) - array['status', 'retired_reason', 'retired_at', 'updated_at']) then
      raise exception 'A published DAM release is frozen' using errcode = '23514';
    end if;
    if new.status <> old.status and not (old.status = 'published' and new.status in ('superseded', 'retired'))
       and not (old.status = 'superseded' and new.status = 'retired') then
      raise exception 'A % release cannot become %', old.status, new.status using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger dam_releases_guard before insert or update or delete on public.dam_releases
  for each row execute function private.guard_dam_release();
create trigger dam_releases_set_updated_at before update on public.dam_releases
  for each row execute function private.set_updated_at();

-- Members: only while the release is a draft (the pre-Phase 6 backfill of
-- release 1.0 is the one exception).
create function private.guard_dam_release_member()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  release_status public.dam_release_status;
begin
  select status into release_status from public.dam_releases
  where id = case when tg_op = 'DELETE' then old.release_id else new.release_id end;
  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if not private.in_methodology_operation() then
    raise exception 'DAM release members change only through methodology operations' using errcode = '42501';
  end if;
  if release_status <> 'draft' and coalesce(current_setting('dsa.methodology_backfill', true), 'off') <> 'on' then
    raise exception 'A published DAM release is frozen' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger dam_release_members_guard before insert or update or delete on public.dam_release_members
  for each row execute function private.guard_dam_release_member();

-- The vocabulary in force: documented by a release, never governed by it.
create function private.architecture_vocabulary_record()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'recorded_at', now(),
    'domains', (select jsonb_agg(d order by d) from unnest(enum_range(null::public.architecture_domain)) d),
    'element_kinds', (select jsonb_agg(k order by k) from unnest(enum_range(null::public.element_kind)) k),
    'object_types', (select jsonb_agg(jsonb_build_object('key', key, 'domain', domain, 'label', label) order by sort_order)
                     from public.architecture_object_types),
    'relationship_types', (select jsonb_agg(jsonb_build_object('key', key, 'label', label) order by sort_order)
                           from public.relationship_types)
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Release 1.0: the methodology as it existed before Phase 6
-- -----------------------------------------------------------------------------
select private.begin_methodology_operation();
select set_config('dsa.methodology_backfill', 'on', true);
insert into public.dam_releases (
  version_label, title, status, summary, change_summary, effective_on, vocabulary_record, published_at, created_by
) values (
  '1.0', 'Development Architecture Method™ 1.0', 'published',
  'The Development Architecture Method as recorded before the Method Library existed.',
  'Recorded from the methodology version engagements carried before Phase 6.',
  (select coalesce(min(created_at), now()) from public.engagements)::date,
  private.architecture_vocabulary_record(), now(), null
);
insert into public.dam_release_members (release_id, asset_id, asset_version_id, added_by)
select r.id, v.asset_id, v.id, null
from public.method_asset_versions v cross join public.dam_releases r
where v.legacy and r.version_label = '1.0';
select set_config('dsa.methodology_backfill', 'off', true);
select private.end_methodology_operation();

-- Seed and test data describing pre-Phase 6 assets land in release 1.0 too.
create or replace function private.convert_to_legacy_method_asset(
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

  perform set_config('dsa.methodology_backfill', 'on', true);
  insert into public.dam_release_members (release_id, asset_id, asset_version_id, added_by)
  select r.id, a.id, legacy_version, null from public.dam_releases r where r.version_label = '1.0';
  perform set_config('dsa.methodology_backfill', 'off', true);
  perform private.end_methodology_operation();
  return legacy_version;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Engagements: conducted under a release
-- -----------------------------------------------------------------------------
alter table public.engagements
  add column dam_release_id uuid references public.dam_releases (id) on delete restrict;
create index engagements_dam_release_idx on public.engagements (dam_release_id);

update public.engagements e set dam_release_id = r.id
from public.dam_releases r
where r.version_label = '1.0' and e.methodology_version = 'DAM 1.0';

-- The report the proposal asks for: engagements left without a release.
do $$
declare
  n int;
begin
  select count(*) into n from public.engagements where dam_release_id is null;
  if n > 0 then
    raise notice 'Phase 6 backfill: % engagement(s) carry a methodology version other than DAM 1.0 and have no DAM release: %',
      n, (select string_agg(slug || ' (' || methodology_version || ')', ', ') from public.engagements where dam_release_id is null);
  end if;
end;
$$;

-- methodology_version follows the release. A new engagement starts on the
-- release its methodology text names, or else the current published one.
-- The release changes only through set_engagement_dam_release.
create function private.sync_engagement_dam_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dam_releases;
begin
  if tg_op = 'INSERT' then
    if new.dam_release_id is null then
      select * into r from public.dam_releases
      where status = 'published' and 'DAM ' || version_label = new.methodology_version;
      if not found then
        select * into r from public.dam_releases where status = 'published';
      end if;
      new.dam_release_id := r.id;
    else
      select * into r from public.dam_releases where id = new.dam_release_id;
      if r.status <> 'published' then
        raise exception 'An engagement starts on a published DAM release' using errcode = '23514';
      end if;
    end if;
  else
    if new.dam_release_id is distinct from old.dam_release_id and not private.in_methodology_operation() then
      raise exception 'Change an engagement''s DAM release through set_engagement_dam_release' using errcode = '42501';
    end if;
    if new.methodology_version is distinct from old.methodology_version and not private.in_methodology_operation() then
      raise exception 'The methodology version follows the engagement''s DAM release' using errcode = '23514';
    end if;
    select * into r from public.dam_releases where id = new.dam_release_id;
  end if;
  if r.id is not null then
    new.methodology_version := 'DAM ' || r.version_label;
  end if;
  return new;
end;
$$;

create trigger engagements_sync_dam_release before insert or update on public.engagements
  for each row execute function private.sync_engagement_dam_release();

-- -----------------------------------------------------------------------------
-- 4. Development Context
-- -----------------------------------------------------------------------------
create table public.development_contexts (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z][a-z0-9_]{0,59}$'),
  label       text not null check (char_length(btrim(label)) between 1 and 120),
  definition  text not null check (char_length(btrim(definition)) between 1 and 2000),
  status      text not null default 'active' check (status in ('active', 'retired')),
  retired_at  timestamptz,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint development_contexts_retired check ((status = 'retired') = (retired_at is not null))
);

create table public.development_context_revisions (
  id                uuid primary key default gen_random_uuid(),
  context_id        uuid not null references public.development_contexts (id) on delete restrict,
  prior_label       text not null,
  prior_definition  text not null,
  reason            text not null check (char_length(btrim(reason)) between 1 and 1000),
  revised_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  revised_at        timestamptz not null default now()
);
create index development_context_revisions_context_idx on public.development_context_revisions (context_id);

create table public.engagement_development_contexts (
  engagement_id  uuid not null references public.engagements (id) on delete restrict,
  context_id     uuid not null references public.development_contexts (id) on delete restrict,
  is_primary     boolean not null default false,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  primary key (engagement_id, context_id)
);
create unique index engagement_development_contexts_one_primary
  on public.engagement_development_contexts (engagement_id) where is_primary;
create index engagement_development_contexts_context_idx on public.engagement_development_contexts (context_id);

create table public.method_version_contexts (
  version_id  uuid not null references public.method_asset_versions (id) on delete cascade,
  context_id  uuid not null references public.development_contexts (id) on delete restrict,
  primary key (version_id, context_id)
);

-- Keys are permanent, contexts are never deleted, revisions are append-only.
create function private.guard_development_context()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.in_methodology_operation() then
    raise exception 'Development Contexts change only through methodology operations' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Development Contexts are retired, never deleted' using errcode = '23514';
  end if;
  if tg_table_name = 'development_context_revisions' and tg_op = 'UPDATE' then
    raise exception 'Development Context revisions are append-only' using errcode = '23514';
  end if;
  if tg_table_name = 'development_contexts' and tg_op = 'UPDATE' then
    if new.key <> old.key then
      raise exception 'A Development Context key is permanent' using errcode = '23514';
    end if;
    if old.status = 'retired' and (new.status <> 'retired' or new.label <> old.label or new.definition <> old.definition) then
      raise exception 'A retired Development Context stays as it was' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger development_contexts_guard before insert or update or delete on public.development_contexts
  for each row execute function private.guard_development_context();
create trigger development_context_revisions_guard before insert or update or delete on public.development_context_revisions
  for each row execute function private.guard_development_context();
create trigger development_contexts_set_updated_at before update on public.development_contexts
  for each row execute function private.set_updated_at();
create trigger method_version_contexts_guard before insert or update or delete on public.method_version_contexts
  for each row execute function private.guard_method_version_child();

create or replace function private.method_child_forms(child_table text)
returns public.method_asset_form[]
language sql
immutable
set search_path = ''
as $$
  select case child_table
    when 'method_version_domains' then array['method', 'model', 'standard', 'instrument', 'template']
    when 'method_version_contexts' then array['method', 'model', 'standard', 'instrument', 'template']
    when 'method_version_stages' then array['method']
    when 'method_version_outputs' then array['method', 'model']
    when 'method_version_components' then array['method']
    when 'standard_version_criteria' then array['standard']
    when 'standard_version_judged_in' then array['standard']
    when 'instrument_version_evidence_types' then array['instrument']
    when 'template_version_specs' then array['template']
    when 'template_version_sections' then array['template']
    when 'method_version_files' then array['template', 'instrument']
  end::public.method_asset_form[];
$$;

-- Engagement contexts: written only by the operation.
create function private.guard_engagement_development_context()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.in_methodology_operation() then
    raise exception 'Engagement contexts change only through set_engagement_development_contexts'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger engagement_development_contexts_guard
  before insert or update or delete on public.engagement_development_contexts
  for each row execute function private.guard_engagement_development_context();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'dam_releases', 'dam_release_members', 'development_contexts', 'development_context_revisions',
    'engagement_development_contexts', 'method_version_contexts'
  ] loop
    execute format('create trigger %1$s_log after insert or update or delete on public.%1$I
                      for each row execute function private.log_activity()', tbl);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Privileges and RLS
-- -----------------------------------------------------------------------------
revoke all on
  public.dam_releases, public.dam_release_members, public.development_contexts,
  public.development_context_revisions, public.engagement_development_contexts, public.method_version_contexts
from public, anon, authenticated;
grant select on
  public.dam_releases, public.dam_release_members, public.development_contexts,
  public.development_context_revisions, public.engagement_development_contexts, public.method_version_contexts
to authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'dam_releases', 'dam_release_members', 'development_contexts', 'development_context_revisions',
    'method_version_contexts'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    -- No client or licensed-practice policy: clients see only the release
    -- label, through client_engagement_methodology.
    execute format('create policy "%s: internal only" on public.%I for select to authenticated
                      using ((select private.is_internal()))', tbl, tbl);
  end loop;
end;
$$;

alter table public.engagement_development_contexts enable row level security;
create policy "engagement development contexts: internal architecture readers"
  on public.engagement_development_contexts for select to authenticated
  using ((select private.is_internal()) and private.can_read_architecture(engagement_id));

-- -----------------------------------------------------------------------------
-- 6. Operations: releases
-- -----------------------------------------------------------------------------
create function private.lock_dam_release(target_release_id uuid)
returns public.dam_releases
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dam_releases;
begin
  if not private.is_internal() then
    raise exception 'DAM release not found' using errcode = 'P0002';
  end if;
  select * into r from public.dam_releases where id = target_release_id for update;
  if not found then
    raise exception 'DAM release not found' using errcode = 'P0002';
  end if;
  return r;
end;
$$;

create function private.lock_draft_dam_release(target_release_id uuid)
returns public.dam_releases
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dam_releases;
begin
  perform private.require_practice_capability('author_methodology');
  r := private.lock_dam_release(target_release_id);
  if r.status <> 'draft' then
    raise exception 'A published DAM release is frozen' using errcode = '23514';
  end if;
  return r;
end;
$$;

-- A new draft release, starting from the members of the current published one.
create function public.create_dam_release(p_version_label text, p_title text, p_summary text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_release uuid;
  new_release uuid;
begin
  perform private.require_practice_capability('author_methodology');
  if not private.nonblank(p_title) then
    raise exception 'A release needs a title' using errcode = '23514';
  end if;
  if exists (select 1 from public.dam_releases where status = 'draft') then
    raise exception 'Finish or delete the draft release first' using errcode = '23514';
  end if;
  select id into current_release from public.dam_releases where status = 'published';
  perform private.begin_methodology_operation();
  insert into public.dam_releases (version_label, title, summary, supersedes_release_id)
  values (btrim(p_version_label), btrim(p_title), btrim(coalesce(p_summary, '')), current_release)
  returning id into new_release;
  -- Carry forward only what can still be a member: proper, not retired.
  insert into public.dam_release_members (release_id, asset_id, asset_version_id)
  select new_release, m.asset_id, m.asset_version_id
  from public.dam_release_members m
  join public.method_asset_versions v on v.id = m.asset_version_id
  join public.method_assets a on a.id = m.asset_id
  where m.release_id = current_release and not v.legacy
    and v.lifecycle in ('published', 'superseded') and a.status = 'active';
  perform private.end_methodology_operation();
  return new_release;
end;
$$;

create function public.update_dam_release(
  p_release_id uuid,
  p_title text,
  p_summary text,
  p_change_summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dam_releases;
begin
  r := private.lock_draft_dam_release(p_release_id);
  if not private.nonblank(p_title) then
    raise exception 'A release needs a title' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  update public.dam_releases
  set title = btrim(p_title), summary = btrim(coalesce(p_summary, '')), change_summary = btrim(coalesce(p_change_summary, ''))
  where id = r.id;
  perform private.end_methodology_operation();
end;
$$;

-- Puts an exact version of an asset in a draft release (replacing any other
-- version of the same asset). Only proper versions that have been published.
create function public.set_dam_release_member(p_release_id uuid, p_asset_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dam_releases;
  v public.method_asset_versions;
  a public.method_assets;
begin
  r := private.lock_draft_dam_release(p_release_id);
  select * into v from public.method_asset_versions where id = p_asset_version_id;
  if not found then
    raise exception 'Method Asset version not found' using errcode = 'P0002';
  end if;
  select * into a from public.method_assets where id = v.asset_id;
  if v.legacy then
    raise exception 'A legacy version cannot join a new release; adopt the asset first' using errcode = '23514';
  end if;
  if v.lifecycle not in ('published', 'superseded') or a.status <> 'active' then
    raise exception 'Only published versions of active assets can be release members' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  insert into public.dam_release_members (release_id, asset_id, asset_version_id)
  values (r.id, v.asset_id, v.id)
  on conflict (release_id, asset_id) do update set asset_version_id = excluded.asset_version_id,
    added_by = auth.uid(), added_at = now();
  perform private.end_methodology_operation();
end;
$$;

create function public.remove_dam_release_member(p_release_id uuid, p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dam_releases;
begin
  r := private.lock_draft_dam_release(p_release_id);
  perform private.begin_methodology_operation();
  delete from public.dam_release_members where release_id = r.id and asset_id = p_asset_id;
  perform private.end_methodology_operation();
end;
$$;

create function public.delete_dam_release(p_release_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dam_releases;
begin
  r := private.lock_draft_dam_release(p_release_id);
  perform private.begin_methodology_operation();
  delete from public.dam_releases where id = r.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.publish_dam_release(
  p_release_id uuid,
  p_change_summary text default null,
  p_effective_on date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dam_releases;
begin
  perform private.require_practice_capability('publish_methodology');
  -- One lock order: the current published release, then this one.
  perform 1 from public.dam_releases where status = 'published' for update;
  r := private.lock_dam_release(p_release_id);
  if r.status <> 'draft' then
    raise exception 'Only a draft release can be published' using errcode = '23514';
  end if;
  if not private.nonblank(coalesce(p_change_summary, r.change_summary)) then
    raise exception 'A release needs a change summary' using errcode = '23514';
  end if;
  if not exists (select 1 from public.dam_release_members where release_id = r.id) then
    raise exception 'A release needs at least one member' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.dam_release_members m
    join public.method_asset_versions v on v.id = m.asset_version_id
    where m.release_id = r.id and (v.legacy or v.lifecycle not in ('published', 'superseded'))
  ) then
    raise exception 'A member version has since been retired; replace it before publishing' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.dam_releases p
    where p.status in ('published', 'superseded')
      and string_to_array(p.version_label, '.')::int[] >= string_to_array(r.version_label, '.')::int[]
  ) then
    raise exception 'Release % must follow the latest published release', r.version_label using errcode = '23514';
  end if;

  perform private.begin_methodology_operation();
  update public.dam_releases set status = 'superseded' where status = 'published';
  update public.dam_releases
  set status = 'published', change_summary = btrim(coalesce(p_change_summary, change_summary)),
      effective_on = coalesce(p_effective_on, private.business_today()),
      vocabulary_record = private.architecture_vocabulary_record(),
      published_by = auth.uid(), published_at = now()
  where id = r.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.retire_dam_release(p_release_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dam_releases;
begin
  perform private.require_practice_capability('publish_methodology');
  if not private.nonblank(p_reason) then
    raise exception 'Retiring a release needs a reason' using errcode = '23514';
  end if;
  r := private.lock_dam_release(p_release_id);
  if r.status not in ('published', 'superseded') then
    raise exception 'Only a published or superseded release can be retired' using errcode = '23514';
  end if;
  if exists (select 1 from public.engagements where dam_release_id = r.id and status in ('proposed', 'active', 'paused')) then
    raise exception 'Engagements in progress are conducted under this release; move them first' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  update public.dam_releases set status = 'retired', retired_reason = btrim(p_reason), retired_at = now()
  where id = r.id;
  perform private.end_methodology_operation();
end;
$$;

-- An engagement governance act, not a methodology-publication act.
create function public.set_engagement_dam_release(p_engagement_id uuid, p_release_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eng public.engagements;
  r public.dam_releases;
begin
  perform private.require_architecture_capability(p_engagement_id, 'publish_architecture');
  if not private.nonblank(p_reason) then
    raise exception 'Changing the DAM release needs a reason' using errcode = '23514';
  end if;
  select * into eng from public.engagements where id = p_engagement_id for update;
  select * into r from public.dam_releases where id = p_release_id;
  if not found or r.status <> 'published' then
    raise exception 'An engagement moves only to the published DAM release' using errcode = '23514';
  end if;
  if eng.dam_release_id = r.id then
    return;
  end if;
  perform private.begin_methodology_operation();
  update public.engagements set dam_release_id = r.id where id = eng.id;
  perform private.end_methodology_operation();
  perform private.log_architecture_event(eng.id, 'engagements', eng.id, 'dam_release_changed',
    jsonb_build_object('from', eng.methodology_version, 'to', 'DAM ' || r.version_label, 'reason', btrim(p_reason)));
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Operations: Development Contexts
-- -----------------------------------------------------------------------------
create function public.create_development_context(p_key text, p_label text, p_definition text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform private.require_practice_capability('publish_methodology');
  perform private.begin_methodology_operation();
  insert into public.development_contexts (key, label, definition)
  values (lower(btrim(p_key)), btrim(p_label), btrim(p_definition))
  returning id into new_id;
  perform private.end_methodology_operation();
  return new_id;
end;
$$;

create function public.revise_development_context(p_context_id uuid, p_label text, p_definition text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.development_contexts;
begin
  perform private.require_practice_capability('publish_methodology');
  if not private.nonblank(p_reason) then
    raise exception 'A redefinition needs a reason' using errcode = '23514';
  end if;
  select * into c from public.development_contexts where id = p_context_id for update;
  if not found then
    raise exception 'Development Context not found' using errcode = 'P0002';
  end if;
  if c.status <> 'active' then
    raise exception 'A retired Development Context stays as it was' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  insert into public.development_context_revisions (context_id, prior_label, prior_definition, reason)
  values (c.id, c.label, c.definition, btrim(p_reason));
  update public.development_contexts set label = btrim(p_label), definition = btrim(p_definition) where id = c.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.retire_development_context(p_context_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.development_contexts;
begin
  perform private.require_practice_capability('publish_methodology');
  if not private.nonblank(p_reason) then
    raise exception 'Retiring a context needs a reason' using errcode = '23514';
  end if;
  select * into c from public.development_contexts where id = p_context_id for update;
  if not found then
    raise exception 'Development Context not found' using errcode = 'P0002';
  end if;
  if c.status <> 'active' then
    raise exception 'This context is already retired' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  insert into public.development_context_revisions (context_id, prior_label, prior_definition, reason)
  values (c.id, c.label, c.definition, 'Retired: ' || btrim(p_reason));
  update public.development_contexts set status = 'retired', retired_at = now() where id = c.id;
  perform private.end_methodology_operation();
end;
$$;

-- Replaces the engagement's contexts. Newly added contexts must be active;
-- one is primary.
create function public.set_engagement_development_contexts(
  p_engagement_id uuid,
  p_context_ids uuid[],
  p_primary_context_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[] := array(select distinct unnest(coalesce(p_context_ids, '{}')));
begin
  perform private.require_architecture_capability(p_engagement_id, 'edit_architecture');
  perform 1 from public.engagements where id = p_engagement_id for update;
  if cardinality(ids) > 0 and (p_primary_context_id is null or not p_primary_context_id = any (ids)) then
    raise exception 'Mark one of the engagement''s contexts as primary' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(ids) i
    left join public.development_contexts c on c.id = i
    where c.id is null
       or (c.status <> 'active' and not exists (
         select 1 from public.engagement_development_contexts x where x.engagement_id = p_engagement_id and x.context_id = i))
  ) then
    raise exception 'Only active Development Contexts can be added' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  delete from public.engagement_development_contexts where engagement_id = p_engagement_id and not context_id = any (ids);
  update public.engagement_development_contexts set is_primary = false
  where engagement_id = p_engagement_id and is_primary and context_id <> p_primary_context_id;
  insert into public.engagement_development_contexts (engagement_id, context_id, is_primary)
  select p_engagement_id, i, i = p_primary_context_id from unnest(ids) i
  on conflict (engagement_id, context_id) do update set is_primary = excluded.is_primary;
  perform private.end_methodology_operation();
end;
$$;

-- Where a draft version applies. None means any context.
create function public.set_method_version_contexts(p_version_id uuid, p_context_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
begin
  v := private.lock_draft_method_version(p_version_id);
  if exists (
    select 1 from unnest(coalesce(p_context_ids, '{}')) i
    left join public.development_contexts c on c.id = i and c.status = 'active'
    where c.id is null
  ) then
    raise exception 'Only active Development Contexts can be declared' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  delete from public.method_version_contexts where version_id = v.id;
  insert into public.method_version_contexts (version_id, context_id)
    select distinct v.id, i from unnest(coalesce(p_context_ids, '{}')) i;
  perform private.end_methodology_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. New drafts also carry the declared contexts forward.
-- -----------------------------------------------------------------------------
create or replace function public.create_method_asset_version(p_asset_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_assets;
  src uuid;
  new_version uuid;
begin
  perform private.require_practice_capability('author_methodology');
  a := private.lock_method_asset(p_asset_id);
  if a.status <> 'active' then
    raise exception 'New versions can be drafted only for an active asset' using errcode = '23514';
  end if;
  if exists (select 1 from public.method_asset_versions where asset_id = a.id and lifecycle = 'draft') then
    raise exception 'This asset already has a draft version' using errcode = '23514';
  end if;
  -- The published version, or else the latest proper version (retired).
  select id into src from public.method_asset_versions
  where asset_id = a.id and lifecycle <> 'draft' and not legacy
  order by (lifecycle = 'published') desc, version_no desc
  limit 1;

  perform private.begin_methodology_operation();
  insert into public.method_asset_versions (
    asset_id, version_no, architectural_question, summary, applicability, exclusions, prerequisites,
    expected_inputs, evidence_expectations, practitioner_roles, completion_criteria,
    completion_standard_version_id, review_implications, implementation_implications,
    practitioner_instructions, internal_notes, modes, identity_disclosure, disclosable_name,
    derived_from_version_id, external_basis
  )
  select a.id, (select coalesce(max(version_no), 0) + 1 from public.method_asset_versions where asset_id = a.id),
         s.architectural_question, s.summary, s.applicability, s.exclusions, s.prerequisites,
         s.expected_inputs, s.evidence_expectations, s.practitioner_roles, s.completion_criteria,
         s.completion_standard_version_id, s.review_implications, s.implementation_implications,
         s.practitioner_instructions, s.internal_notes, s.modes, s.identity_disclosure, s.disclosable_name,
         s.id, s.external_basis
  from public.method_asset_versions s
  where s.id = src
  returning id into new_version;
  if new_version is null then
    insert into public.method_asset_versions (asset_id, version_no)
    values (a.id, (select coalesce(max(version_no), 0) + 1 from public.method_asset_versions where asset_id = a.id))
    returning id into new_version;
  end if;

  if src is not null then
    insert into public.method_version_domains (version_id, domain)
      select new_version, domain from public.method_version_domains where version_id = src;
    insert into public.method_version_stages (version_id, ordinal, key, title, purpose, guidance)
      select new_version, ordinal, key, title, purpose, guidance from public.method_version_stages where version_id = src;
    insert into public.method_version_outputs (version_id, ordinal, output_kind, object_type_key, deliverable_type, note)
      select new_version, ordinal, output_kind, object_type_key, deliverable_type, note
      from public.method_version_outputs where version_id = src;
    -- Only components still current carry forward; the author re-pins the rest.
    insert into public.method_version_components (version_id, component_version_id, note)
      select new_version, c.component_version_id, c.note
      from public.method_version_components c
      join public.method_asset_versions cv on cv.id = c.component_version_id
      where c.version_id = src and cv.lifecycle = 'published';
    insert into public.standard_version_criteria (version_id, ordinal, key, statement, guidance, scale)
      select new_version, ordinal, key, statement, guidance, scale from public.standard_version_criteria where version_id = src;
    insert into public.standard_version_judged_in (version_id, setting)
      select new_version, setting from public.standard_version_judged_in where version_id = src;
    insert into public.instrument_version_evidence_types (version_id, evidence_source_type)
      select new_version, evidence_source_type from public.instrument_version_evidence_types where version_id = src;
    insert into public.template_version_specs (version_id, deliverable_type)
      select new_version, deliverable_type from public.template_version_specs where version_id = src;
    insert into public.template_version_sections (version_id, ordinal, title, guidance)
      select new_version, ordinal, title, guidance from public.template_version_sections where version_id = src;
    insert into public.method_version_contexts (version_id, context_id)
      select new_version, x.context_id from public.method_version_contexts x
      join public.development_contexts c on c.id = x.context_id
      where x.version_id = src and c.status = 'active';
    -- Files are not copied: the stored objects belong to their version's path.
  end if;
  perform private.end_methodology_operation();
  return new_version;
end;
$$;


-- -----------------------------------------------------------------------------
-- 9. Function privileges
-- -----------------------------------------------------------------------------
revoke all on function private.guard_dam_release() from public, anon, authenticated;
revoke all on function private.guard_dam_release_member() from public, anon, authenticated;
revoke all on function private.architecture_vocabulary_record() from public, anon, authenticated;
revoke all on function private.sync_engagement_dam_release() from public, anon, authenticated;
revoke all on function private.guard_development_context() from public, anon, authenticated;
revoke all on function private.guard_engagement_development_context() from public, anon, authenticated;
revoke all on function private.lock_dam_release(uuid) from public, anon, authenticated;
revoke all on function private.lock_draft_dam_release(uuid) from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_dam_release(text, text, text)',
    'public.update_dam_release(uuid, text, text, text)',
    'public.set_dam_release_member(uuid, uuid)',
    'public.remove_dam_release_member(uuid, uuid)',
    'public.delete_dam_release(uuid)',
    'public.publish_dam_release(uuid, text, date)',
    'public.retire_dam_release(uuid, text)',
    'public.set_engagement_dam_release(uuid, uuid, text)',
    'public.create_development_context(text, text, text)',
    'public.revise_development_context(uuid, text, text, text)',
    'public.retire_development_context(uuid, text)',
    'public.set_engagement_development_contexts(uuid, uuid[], uuid)',
    'public.set_method_version_contexts(uuid, uuid[])'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
