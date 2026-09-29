-- =============================================================================
-- DSA OS — Phase 1 Foundation
--
-- Identity, organizations, roles, engagements, engagement membership,
-- a method_assets stub (to enforce Method/IP isolation from day one),
-- and an append-only activity log.
--
-- Authorization model (see docs/database/rls.md and ADR-0003):
--   * RLS is enabled on every table; anything not granted is denied.
--   * Policies call SECURITY DEFINER helpers in the non-exposed `private`
--     schema, which read the membership tables. Roles are never trusted
--     from the client or the JWT.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schemas
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.organization_type as enum ('tplco', 'client', 'licensed_practice');

create type public.record_status as enum ('active', 'invited', 'suspended', 'archived');

create type public.member_side as enum ('internal', 'client');

create type public.app_role as enum (
  -- Internal (TPLCo)
  'system_administrator',
  'principal_architect',
  'architect',
  'researcher',
  'project_administrator',
  'finance_administrator',
  -- Client
  'executive_sponsor',
  'client_project_lead',
  'client_finance',
  'client_contributor',
  'client_viewer'
);

create type public.engagement_type as enum (
  'development_architecture_sprint',
  'development_architecture_intensive',
  'embedded_development_partner',
  'cohort',
  'custom'
);

create type public.engagement_status as enum ('proposed', 'active', 'paused', 'completed', 'archived');

create type public.architecture_domain as enum ('knowledge', 'capability', 'strategic_model', 'application');

create type public.ip_classification as enum (
  'tplco_method_ip',
  'client_confidential',
  'client_owned_source_material',
  'project_work_product',
  'public_source',
  'licensed_third_party_source',
  'generated_analysis'
);

-- Which side of the engagement a role belongs to.
create function public.role_side(role public.app_role)
returns public.member_side
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when role in (
      'system_administrator', 'principal_architect', 'architect',
      'researcher', 'project_administrator', 'finance_administrator'
    ) then 'internal'::public.member_side
    else 'client'::public.member_side
  end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- One profile per auth user. The primary key IS the auth user id (ADR-0004).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null default '' check (char_length(first_name) <= 100),
  last_name   text not null default '' check (char_length(last_name) <= 100),
  email       text not null check (char_length(email) <= 320),
  status      public.record_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  type        public.organization_type not null,
  status      public.record_status not null default 'active',
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Exactly one TPLCo organization may exist.
create unique index organizations_single_tplco on public.organizations (type) where type = 'tplco';

create table public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.app_role not null,
  status           public.record_status not null default 'active',
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- A person may belong to many organizations, once each, with a role per
  -- membership (ADR-0007).
  constraint organization_members_unique unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.engagements (
  id                      uuid primary key default gen_random_uuid(),
  client_organization_id  uuid not null references public.organizations (id) on delete restrict,
  title                   text not null check (char_length(title) between 1 and 200),
  slug                    text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  engagement_type         public.engagement_type not null,
  objective               text not null default '' check (char_length(objective) <= 2000),
  description             text not null default '' check (char_length(description) <= 10000),
  methodology_version     text not null default 'DAM 1.0' check (char_length(methodology_version) <= 40),
  status                  public.engagement_status not null default 'proposed',
  current_phase           text not null default '' check (char_length(current_phase) <= 120),
  start_date              date,
  target_end_date         date,
  created_by              uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint engagements_dates_ordered check (
    start_date is null or target_end_date is null or target_end_date >= start_date
  )
);
create index engagements_client_org_idx on public.engagements (client_organization_id);

create table public.engagement_members (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  side           public.member_side not null,
  role           public.app_role not null,
  status         public.record_status not null default 'active',
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint engagement_members_unique unique (engagement_id, user_id),
  constraint engagement_members_side_matches_role check (public.role_side(role) = side)
);
create index engagement_members_user_idx on public.engagement_members (user_id);

-- Method/IP stub: no UI in Phase 1. Exists so client isolation from
-- Method/IP is enforced and tested at the database layer now.
create table public.method_assets (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(title) between 1 and 200),
  category            text not null check (char_length(category) <= 80),
  methodology_domain  public.architecture_domain,
  version             text not null default '1.0' check (char_length(version) <= 40),
  status              text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  description         text not null default '',
  ip_classification   public.ip_classification not null default 'tplco_method_ip',
  owner_user_id       uuid references public.profiles (id) on delete set null,
  created_by          uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Append-only audit trail. Written only by triggers.
create table public.activity_log (
  id               bigint generated always as identity primary key,
  organization_id  uuid references public.organizations (id) on delete set null,
  engagement_id    uuid references public.engagements (id) on delete set null,
  actor_user_id    uuid references public.profiles (id) on delete set null,
  action_type      text not null,
  entity_type      text not null,
  entity_id        uuid,
  metadata_json    jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index activity_log_engagement_idx on public.activity_log (engagement_id, created_at desc);
create index activity_log_org_idx on public.activity_log (organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER, not exposed through the API)
-- -----------------------------------------------------------------------------

-- The caller's internal role, if they are an active member of the active
-- TPLCo organization and their profile is active.
create function private.current_internal_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and o.type = 'tplco'
    and o.status = 'active'
    and p.status = 'active'
  limit 1;
$$;

create function private.is_internal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_internal_role() is not null;
$$;

create function private.has_internal_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_internal_role() = any (roles), false);
$$;

-- True when the caller is an active member of the given active
-- organization and their profile is active. A person may hold memberships
-- in several organizations; each is evaluated on its own, so access
-- through one membership never extends to another organization.
create function private.is_active_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    join public.profiles p on p.id = m.user_id
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
      and p.status = 'active'
  );
$$;

-- The caller's active role on an engagement. A client-side assignment
-- only counts while the caller is an active member of that engagement's
-- own client organization, so a stray assignment (or a membership in a
-- different organization) can never expose another tenant's engagement.
create function private.engagement_role(target_engagement_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select em.role
  from public.engagement_members em
  join public.engagements e on e.id = em.engagement_id
  where em.engagement_id = target_engagement_id
    and em.user_id = auth.uid()
    and em.status = 'active'
    and (
      (em.side = 'internal' and private.is_internal())
      or (em.side = 'client' and private.is_active_org_member(e.client_organization_id))
    )
  limit 1;
$$;

-- System Administrators and Principal Architects see every engagement;
-- everyone else must be assigned (ADR-0002, decisions 2 and 3).
create function private.can_access_engagement(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[])
      or private.engagement_role(target_engagement_id) is not null;
$$;

create function private.can_manage_engagement(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[])
      or private.engagement_role(target_engagement_id) = 'project_administrator';
$$;

-- Internal roles that may manage client organizations and their members.
create function private.can_manage_client_directory()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_internal_role(
    array['system_administrator', 'principal_architect', 'project_administrator']::public.app_role[]
  );
$$;

-- True when the caller and the given user are both active on an engagement
-- the caller can access. Used so client users can see their counterparts.
create function private.shares_engagement_with(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.engagement_members mine
    join public.engagement_members theirs on theirs.engagement_id = mine.engagement_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = other_user_id
      and theirs.status = 'active'
      and private.can_access_engagement(mine.engagement_id)
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Integrity triggers
-- -----------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- created_by always reflects the real caller when there is one.
create function private.set_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Create a profile whenever an auth user is created (invite or seed).
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    'active'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Only System Administrators may change a profile's status or email.
create function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (new.status is distinct from old.status or new.email is distinct from old.email)
     and not private.has_internal_role(array['system_administrator']::public.app_role[]) then
    raise exception 'Only a System Administrator can change profile status or email'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Organization roles must match the organization's side.
create function private.validate_organization_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_type public.organization_type;
begin
  select type into org_type from public.organizations where id = new.organization_id;

  if org_type = 'tplco' and public.role_side(new.role) <> 'internal' then
    raise exception 'TPLCo members must hold an internal role' using errcode = '23514';
  elsif org_type = 'client' and public.role_side(new.role) <> 'client' then
    raise exception 'Client organization members must hold a client role' using errcode = '23514';
  elsif org_type = 'licensed_practice' then
    raise exception 'Licensed practice organizations are not supported yet' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Engagements belong to client organizations only.
create function private.validate_engagement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organizations
    where id = new.client_organization_id and type = 'client'
  ) then
    raise exception 'An engagement must belong to a client organization' using errcode = '23514';
  end if;

  -- Only System Administrators and Principal Architects may archive.
  if auth.uid() is not null
     and new.status = 'archived'
     and (tg_op = 'INSERT' or old.status is distinct from 'archived')
     and not private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[]) then
    raise exception 'Only a System Administrator or Principal Architect can archive an engagement'
      using errcode = '42501';
  end if;

  -- An engagement cannot be moved between client organizations.
  if tg_op = 'UPDATE' and new.client_organization_id <> old.client_organization_id then
    raise exception 'An engagement cannot be moved to another organization' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Client-side members must belong to the engagement's client organization;
-- internal-side members must belong to TPLCo.
create function private.validate_engagement_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  engagement_org uuid;
begin
  select client_organization_id into engagement_org
  from public.engagements where id = new.engagement_id;

  if new.side = 'client' and not exists (
    select 1 from public.organization_members m
    where m.user_id = new.user_id
      and m.organization_id = engagement_org
  ) then
    raise exception 'Client members must belong to the engagement''s client organization'
      using errcode = '23514';
  end if;

  if new.side = 'internal' and not exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = new.user_id
      and o.type = 'tplco'
  ) then
    raise exception 'Internal members must belong to TPLCo' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and (new.engagement_id <> old.engagement_id or new.user_id <> old.user_id) then
    raise exception 'Reassign by removing and re-adding the member' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- The internal user who creates an engagement is assigned to it, so a
-- Project Administrator keeps access to what they set up.
create function private.assign_engagement_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_role public.app_role;
begin
  creator_role := private.current_internal_role();
  if creator_role is not null then
    insert into public.engagement_members (engagement_id, user_id, side, role, created_by)
    values (new.id, auth.uid(), 'internal', creator_role, auth.uid())
    on conflict (engagement_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Activity log writer shared by the audited tables.
create function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb;
  org_id uuid;
  eng_id uuid;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  case tg_table_name
    when 'organizations' then
      org_id := (rec ->> 'id')::uuid;
    when 'organization_members' then
      org_id := (rec ->> 'organization_id')::uuid;
    when 'engagements' then
      org_id := (rec ->> 'client_organization_id')::uuid;
      eng_id := (rec ->> 'id')::uuid;
    when 'engagement_members' then
      eng_id := (rec ->> 'engagement_id')::uuid;
      select client_organization_id into org_id from public.engagements where id = eng_id;
    else
      null;
  end case;

  -- On deletes the referenced rows may already be gone; the ids are still
  -- preserved in metadata_json.
  if org_id is not null and not exists (select 1 from public.organizations where id = org_id) then
    org_id := null;
  end if;
  if eng_id is not null and not exists (select 1 from public.engagements where id = eng_id) then
    eng_id := null;
  end if;

  insert into public.activity_log (
    organization_id, engagement_id, actor_user_id, action_type, entity_type, entity_id, metadata_json
  ) values (
    org_id,
    eng_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    (rec ->> 'id')::uuid,
    case
      when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      else jsonb_build_object('record', rec)
    end
  );

  return null;
end;
$$;

-- Wire up triggers
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger profiles_guard_update before update on public.profiles
  for each row execute function private.guard_profile_update();

create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger organizations_set_created_by before insert on public.organizations
  for each row execute function private.set_created_by();
create trigger organizations_log after insert or update or delete on public.organizations
  for each row execute function private.log_activity();

create trigger organization_members_set_updated_at before update on public.organization_members
  for each row execute function private.set_updated_at();
create trigger organization_members_set_created_by before insert on public.organization_members
  for each row execute function private.set_created_by();
create trigger organization_members_validate before insert or update on public.organization_members
  for each row execute function private.validate_organization_member();
create trigger organization_members_log after insert or update or delete on public.organization_members
  for each row execute function private.log_activity();

create trigger engagements_set_updated_at before update on public.engagements
  for each row execute function private.set_updated_at();
create trigger engagements_set_created_by before insert on public.engagements
  for each row execute function private.set_created_by();
create trigger engagements_validate before insert or update on public.engagements
  for each row execute function private.validate_engagement();
create trigger engagements_assign_creator after insert on public.engagements
  for each row execute function private.assign_engagement_creator();
create trigger engagements_log after insert or update or delete on public.engagements
  for each row execute function private.log_activity();

create trigger engagement_members_set_updated_at before update on public.engagement_members
  for each row execute function private.set_updated_at();
create trigger engagement_members_set_created_by before insert on public.engagement_members
  for each row execute function private.set_created_by();
create trigger engagement_members_validate before insert or update on public.engagement_members
  for each row execute function private.validate_engagement_member();
create trigger engagement_members_log after insert or update or delete on public.engagement_members
  for each row execute function private.log_activity();

create trigger method_assets_set_updated_at before update on public.method_assets
  for each row execute function private.set_updated_at();
create trigger method_assets_set_created_by before insert on public.method_assets
  for each row execute function private.set_created_by();

-- -----------------------------------------------------------------------------
-- Invitation acceptance
--
-- Invited memberships grant no access until the invited person signs in
-- through their invitation link, which calls this function. It can only
-- activate the caller's own invited membership.
-- -----------------------------------------------------------------------------
create function public.accept_invitation()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.organization_members
  set status = 'active'
  where user_id = auth.uid()
    and status = 'invited';
$$;

revoke all on function public.accept_invitation() from public, anon;
grant execute on function public.accept_invitation() to authenticated;

-- -----------------------------------------------------------------------------
-- Privileges: no anonymous access to anything; column-limited profile edits.
-- -----------------------------------------------------------------------------
revoke all on
  public.profiles,
  public.organizations,
  public.organization_members,
  public.engagements,
  public.engagement_members,
  public.method_assets,
  public.activity_log
from anon;

revoke insert, update, delete, truncate on public.profiles from authenticated;
grant update (first_name, last_name, status) on public.profiles to authenticated;

revoke insert, update, delete, truncate on public.activity_log from authenticated;
-- Organizations and engagements are archived, never deleted, from the app.
revoke delete on public.organizations, public.engagements from authenticated;

revoke truncate on
  public.organizations,
  public.organization_members,
  public.engagements,
  public.engagement_members,
  public.method_assets
from authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.engagements enable row level security;
alter table public.engagement_members enable row level security;
alter table public.method_assets enable row level security;
alter table public.activity_log enable row level security;

-- profiles --------------------------------------------------------------------
create policy "profiles: read self, internal reads all, clients read engagement counterparts"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_internal())
    or private.shares_engagement_with(id)
  );

create policy "profiles: users edit themselves, system administrators edit anyone"
  on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or (select private.has_internal_role(array['system_administrator']::public.app_role[]))
  )
  with check (
    id = (select auth.uid())
    or (select private.has_internal_role(array['system_administrator']::public.app_role[]))
  );

-- organizations ---------------------------------------------------------------
create policy "organizations: internal reads all, others read organizations they belong to"
  on public.organizations for select to authenticated
  using (
    (select private.is_internal())
    or private.is_active_org_member(id)
  );

create policy "organizations: directory managers create client organizations"
  on public.organizations for insert to authenticated
  with check (
    type = 'client' and (select private.can_manage_client_directory())
  );

create policy "organizations: directory managers edit client organizations, admins edit TPLCo"
  on public.organizations for update to authenticated
  using (
    (type = 'client' and (select private.can_manage_client_directory()))
    or (select private.has_internal_role(array['system_administrator']::public.app_role[]))
  )
  with check (
    (type = 'client' and (select private.can_manage_client_directory()))
    or (select private.has_internal_role(array['system_administrator']::public.app_role[]))
  );

-- organization_members --------------------------------------------------------
create policy "organization members: internal reads all, others read organizations they belong to"
  on public.organization_members for select to authenticated
  using (
    (select private.is_internal())
    or private.is_active_org_member(organization_id)
  );

-- Directory managers manage client memberships. Only System Administrators
-- manage TPLCo staff, so nobody can grant themselves an internal role.
create policy "organization members: managed by directory managers (client) or admins (TPLCo)"
  on public.organization_members for all to authenticated
  using (
    (select private.has_internal_role(array['system_administrator']::public.app_role[]))
    or (
      (select private.can_manage_client_directory())
      and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.type = 'client'
      )
    )
  )
  with check (
    (select private.has_internal_role(array['system_administrator']::public.app_role[]))
    or (
      (select private.can_manage_client_directory())
      and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.type = 'client'
      )
    )
  );

-- engagements -----------------------------------------------------------------
create policy "engagements: visible to administrators, principals and assigned members"
  on public.engagements for select to authenticated
  using (private.can_access_engagement(id));

create policy "engagements: created by administrators, principals and project administrators"
  on public.engagements for insert to authenticated
  with check (
    (select private.has_internal_role(
      array['system_administrator', 'principal_architect', 'project_administrator']::public.app_role[]
    ))
  );

create policy "engagements: edited by administrators, principals and assigned project administrators"
  on public.engagements for update to authenticated
  using (private.can_manage_engagement(id))
  with check (private.can_manage_engagement(id));

-- No delete policy: engagements are archived, never deleted from the app.

-- engagement_members ----------------------------------------------------------
create policy "engagement members: visible to anyone who can see the engagement"
  on public.engagement_members for select to authenticated
  using (private.can_access_engagement(engagement_id));

create policy "engagement members: assigned by engagement managers"
  on public.engagement_members for insert to authenticated
  with check (private.can_manage_engagement(engagement_id));

create policy "engagement members: updated by engagement managers"
  on public.engagement_members for update to authenticated
  using (private.can_manage_engagement(engagement_id))
  with check (private.can_manage_engagement(engagement_id));

create policy "engagement members: removed by engagement managers"
  on public.engagement_members for delete to authenticated
  using (private.can_manage_engagement(engagement_id));

-- method_assets ---------------------------------------------------------------
-- There is intentionally no policy that a client user can satisfy.
create policy "method assets: internal only"
  on public.method_assets for select to authenticated
  using ((select private.is_internal()));

create policy "method assets: managed by administrators and principals"
  on public.method_assets for all to authenticated
  using ((select private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[])))
  with check ((select private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[])));

-- activity_log ----------------------------------------------------------------
create policy "activity log: read by administrators and principals"
  on public.activity_log for select to authenticated
  using ((select private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[])));
