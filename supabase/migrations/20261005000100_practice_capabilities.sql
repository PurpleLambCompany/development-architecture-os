-- =============================================================================
-- DSA OS — Phase 6: practice capabilities (D10, D11, ADR-0044)
--
-- One capability model, two membership scopes. A capability is always held
-- through a membership and its scope is that membership's scope:
--   * an engagement membership carries engagement capabilities (ADR-0008,
--     unchanged by this migration);
--   * a TPLCo organization membership carries practice capabilities.
-- The practice scope mirrors the engagement scope exactly: role defaults
-- (migration-only reference data), per-membership overrides with a reason,
-- and one private check function. Nothing in the engagement capability
-- tables, functions or enum is touched.
--
-- Administration is capability-based: only holders of publish_methodology
-- grant or revoke practice capabilities, never on themselves, and the last
-- effective publish_methodology holder cannot be revoked. A System
-- Administrator holds no practice capability by default (Q11).
-- Errors: 42501 permission, 23514 rule, P0002 not found.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Role defaults (the role definition). Reference data; migrations only.
-- -----------------------------------------------------------------------------
create table public.practice_role_capability_defaults (
  role        public.app_role not null,
  capability  public.practice_capability not null,
  primary key (role, capability),
  constraint practice_role_capability_defaults_internal check (public.role_side(role) = 'internal')
);

insert into public.practice_role_capability_defaults (role, capability) values
  ('principal_architect', 'author_methodology'),
  ('principal_architect', 'publish_methodology'),
  ('architect',           'author_methodology');
  -- System Administrators, Researchers, Project and Finance Administrators
  -- hold none by default. Library read access is every internal member's.

-- -----------------------------------------------------------------------------
-- 2. Per-membership overrides on the TPLCo organization membership.
-- -----------------------------------------------------------------------------
create table public.practice_member_capability_overrides (
  id                      uuid primary key default gen_random_uuid(),
  organization_member_id  uuid not null references public.organization_members (id) on delete cascade,
  capability              public.practice_capability not null,
  granted                 boolean not null,
  reason                  text not null check (char_length(btrim(reason)) between 1 and 500),
  created_by              uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint practice_member_capability_overrides_unique unique (organization_member_id, capability)
);

-- Only an internal membership of the TPLCo organization can carry one.
create function private.prepare_practice_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.id = new.organization_member_id
      and o.type = 'tplco'
      and public.role_side(m.role) = 'internal'
  ) then
    raise exception 'Practice capabilities are held only through TPLCo membership' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (
    new.organization_member_id <> old.organization_member_id or new.capability <> old.capability
  ) then
    raise exception 'Remove the override and create a new one instead' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger practice_overrides_prepare
  before insert or update on public.practice_member_capability_overrides
  for each row execute function private.prepare_practice_override();
create trigger practice_overrides_set_updated_at
  before update on public.practice_member_capability_overrides
  for each row execute function private.set_updated_at();
create trigger practice_overrides_set_created_by
  before insert on public.practice_member_capability_overrides
  for each row execute function private.set_created_by();
create trigger practice_overrides_log
  after insert or update or delete on public.practice_member_capability_overrides
  for each row execute function private.log_activity();

-- -----------------------------------------------------------------------------
-- 3. Capability helpers
-- -----------------------------------------------------------------------------

-- Effective capability of one TPLCo membership: an override wins, otherwise
-- the membership's role default applies.
create function private.member_has_practice_capability(
  target_membership_id uuid,
  target_capability public.practice_capability
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select o.granted
      from public.practice_member_capability_overrides o
      where o.organization_member_id = target_membership_id
        and o.capability = target_capability
    ),
    exists (
      select 1
      from public.organization_members m
      join public.practice_role_capability_defaults d on d.role = m.role
      where m.id = target_membership_id
        and d.capability = target_capability
    )
  );
$$;

-- The caller's active TPLCo membership (same validity rules as is_internal).
create function private.current_tplco_membership()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and o.type = 'tplco'
    and o.status = 'active'
    and p.status = 'active'
    and public.role_side(m.role) = 'internal'
  limit 1;
$$;

-- Does the caller hold a practice capability? Client and licensed-practice
-- users never can: they have no TPLCo membership.
create function private.has_practice_capability(target_capability public.practice_capability)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.member_has_practice_capability(private.current_tplco_membership(), target_capability),
    false
  ) and private.current_tplco_membership() is not null;
$$;

create function private.require_practice_capability(target_capability public.practice_capability)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_practice_capability(target_capability) then
    raise exception 'You do not hold %', target_capability using errcode = '42501';
  end if;
end;
$$;

-- Effective holders of a capability among active TPLCo memberships.
create function private.practice_capability_holder_count(target_capability public.practice_capability)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  where m.status = 'active' and o.type = 'tplco' and o.status = 'active' and p.status = 'active'
    and public.role_side(m.role) = 'internal'
    and private.member_has_practice_capability(m.id, target_capability);
$$;

-- The caller's effective practice capabilities (for the UI).
create function public.my_practice_capabilities()
returns setof public.practice_capability
language sql
stable
security definer
set search_path = ''
as $$
  select c
  from unnest(enum_range(null::public.practice_capability)) as c
  where private.has_practice_capability(c);
$$;

-- Effective practice capabilities of every TPLCo membership (for the
-- settings page). Internal members only.
create function public.practice_capability_matrix()
returns table (
  organization_member_id uuid, user_id uuid, role public.app_role, status public.record_status,
  capability public.practice_capability, effective boolean, role_default boolean, override_granted boolean,
  override_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, m.role, m.status, c,
    private.member_has_practice_capability(m.id, c),
    exists (select 1 from public.practice_role_capability_defaults d where d.role = m.role and d.capability = c),
    o.granted, o.reason
  from public.organization_members m
  join public.organizations org on org.id = m.organization_id and org.type = 'tplco'
  cross join unnest(enum_range(null::public.practice_capability)) as c
  left join public.practice_member_capability_overrides o
    on o.organization_member_id = m.id and o.capability = c
  where private.is_internal() and public.role_side(m.role) = 'internal'
  order by m.role, m.id, c;
$$;

-- -----------------------------------------------------------------------------
-- 4. Administration: capability-based, never self, last-holder guard.
-- -----------------------------------------------------------------------------
create function private.assert_publish_methodology_remains()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.practice_capability_holder_count('publish_methodology') = 0 then
    raise exception 'At least one member must keep publish_methodology' using errcode = '23514';
  end if;
end;
$$;

create function private.lock_practice_override_target(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One writer at a time, so two concurrent revocations cannot both pass the
  -- last-holder guard.
  perform pg_advisory_xact_lock(hashtext('dsa.practice_capabilities'));
  perform private.require_practice_capability('publish_methodology');
  if not exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.id = p_membership_id and o.type = 'tplco' and public.role_side(m.role) = 'internal'
  ) then
    raise exception 'TPLCo membership not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.organization_members where id = p_membership_id and user_id = auth.uid()) then
    raise exception 'You cannot change your own practice capabilities' using errcode = '42501';
  end if;
end;
$$;

create function public.set_practice_capability_override(
  p_membership_id uuid,
  p_capability public.practice_capability,
  p_granted boolean,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  override_id uuid;
begin
  perform private.lock_practice_override_target(p_membership_id);
  if p_granted is null then
    raise exception 'Say whether the capability is granted or revoked' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say why the capability changes' using errcode = '23514';
  end if;
  insert into public.practice_member_capability_overrides (organization_member_id, capability, granted, reason)
  values (p_membership_id, p_capability, p_granted, btrim(p_reason))
  on conflict (organization_member_id, capability)
    do update set granted = excluded.granted, reason = excluded.reason
  returning id into override_id;
  perform private.assert_publish_methodology_remains();
  return override_id;
end;
$$;

-- Returns the membership to its role default.
create function public.clear_practice_capability_override(
  p_membership_id uuid,
  p_capability public.practice_capability
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_practice_override_target(p_membership_id);
  delete from public.practice_member_capability_overrides
  where organization_member_id = p_membership_id and capability = p_capability;
  perform private.assert_publish_methodology_remains();
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Privileges and RLS. Both tables are written only by the operations
--    above; internal members read them; clients have no policy at all.
-- -----------------------------------------------------------------------------
revoke all on public.practice_role_capability_defaults, public.practice_member_capability_overrides
  from anon, authenticated;
grant select on public.practice_role_capability_defaults, public.practice_member_capability_overrides
  to authenticated;

alter table public.practice_role_capability_defaults enable row level security;
alter table public.practice_member_capability_overrides enable row level security;

create policy "practice capability defaults: internal readers"
  on public.practice_role_capability_defaults for select to authenticated
  using ((select private.is_internal()));
create policy "practice capability overrides: internal readers"
  on public.practice_member_capability_overrides for select to authenticated
  using ((select private.is_internal()));

revoke all on function private.prepare_practice_override() from public, anon, authenticated;
revoke all on function private.member_has_practice_capability(uuid, public.practice_capability) from public, anon;
revoke all on function private.current_tplco_membership() from public, anon;
revoke all on function private.has_practice_capability(public.practice_capability) from public, anon;
revoke all on function private.require_practice_capability(public.practice_capability) from public, anon, authenticated;
revoke all on function private.practice_capability_holder_count(public.practice_capability) from public, anon, authenticated;
revoke all on function private.assert_publish_methodology_remains() from public, anon, authenticated;
revoke all on function private.lock_practice_override_target(uuid) from public, anon, authenticated;
grant execute on function private.member_has_practice_capability(uuid, public.practice_capability) to authenticated;
grant execute on function private.current_tplco_membership() to authenticated;
grant execute on function private.has_practice_capability(public.practice_capability) to authenticated;

revoke all on function public.my_practice_capabilities() from public, anon;
revoke all on function public.practice_capability_matrix() from public, anon;
revoke all on function public.set_practice_capability_override(uuid, public.practice_capability, boolean, text) from public, anon;
revoke all on function public.clear_practice_capability_override(uuid, public.practice_capability) from public, anon;
grant execute on function public.my_practice_capabilities() to authenticated;
grant execute on function public.practice_capability_matrix() to authenticated;
grant execute on function public.set_practice_capability_override(uuid, public.practice_capability, boolean, text) to authenticated;
grant execute on function public.clear_practice_capability_override(uuid, public.practice_capability) to authenticated;
