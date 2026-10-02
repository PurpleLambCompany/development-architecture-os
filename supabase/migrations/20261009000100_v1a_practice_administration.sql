-- =============================================================================
-- DSA OS — V1-A Workstream A: practice administration and authority closure
-- (decisions D1-D5 and D7; changes A1-A4 and A6 of
-- docs/product/V1_A_WORKFLOW_CLOSURE_PROPOSAL.md; ADR-0074).
--
-- Four layers, kept apart:
--   * Practice administration is the practice capability administer_practice
--     (D1). Principal Architects and System Administrators hold it by default
--     (D4). It is delegable by override, never on oneself, and at least one
--     active holder always remains. It replaces every check that welded TPLCo
--     staff administration to the System Administrator role name.
--   * A System Administrator administers the practice but holds no
--     architectural authority and cannot create it (D2).
--   * Only an active Principal Architect gives a TPLCo member an
--     architectural authority-bearing role (Principal Architect, Architect,
--     Researcher), by invitation, role change or restoring access, and never
--     for themselves (D2).
--   * An internal engagement member's role is always their TPLCo role (D3).
--     Per-engagement differences go through the existing governed capability
--     overrides, whose rules are unchanged.
-- Safeguards (D5): nobody changes their own TPLCo role or status, or their
-- own profile status; at least one active Principal Architect and one
-- active practice administrator always remain.
--
-- Every rule is enforced in triggers that re-check the caller after taking
-- the practice advisory lock, so RLS policies are only the first gate and
-- concurrent changes are serialized. Service-role and migration writes
-- (no auth.uid()) are trusted operators, as everywhere else in DSA OS; the
-- local bootstrap command (D6) uses that path.
--
-- No new tables. Errors: 42501 permission, 23514 rule.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Role defaults (D4)
-- -----------------------------------------------------------------------------
insert into public.practice_role_capability_defaults (role, capability) values
  ('principal_architect',  'administer_practice'),
  ('system_administrator', 'administer_practice');

-- -----------------------------------------------------------------------------
-- 2. Architectural authority-bearing roles (D2)
--
-- The internal roles whose engagement defaults carry architectural
-- authority. pgTAP keeps this list equal to the roles whose
-- role_capability_defaults include an architecture authority capability.
-- -----------------------------------------------------------------------------
create function public.is_architecture_authority_role(role public.app_role)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select role in ('principal_architect', 'architect', 'researcher');
$$;

revoke all on function public.is_architecture_authority_role(public.app_role) from public, anon;
grant execute on function public.is_architecture_authority_role(public.app_role) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Helpers
-- -----------------------------------------------------------------------------

-- One writer at a time for every change that can move practice authority:
-- TPLCo memberships, profile status and practice capability overrides. The
-- key is the one the Phase 6 override functions already use.
create function private.lock_practice_administration()
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('dsa.practice_capabilities'));
$$;

-- Effective practice capability of a membership as if it held `p_role`:
-- an override on the membership wins, otherwise the role default applies.
create function private.membership_role_has_practice_capability(
  p_membership_id uuid,
  p_role public.app_role,
  p_capability public.practice_capability
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
      where o.organization_member_id = p_membership_id and o.capability = p_capability
    ),
    exists (
      select 1 from public.practice_role_capability_defaults d
      where d.role = p_role and d.capability = p_capability
    )
  );
$$;

-- Active Principal Architects: active membership, active profile, active
-- TPLCo organization.
create function private.active_principal_architect_count()
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
    and m.role = 'principal_architect';
$$;

-- Raise when a change removed the last holder. Each flag says the changed
-- membership was a holder before the change, so an installation that never
-- had a holder (for example one bootstrapped with only a System
-- Administrator) is not locked out of unrelated changes.
create function private.assert_practice_holders_remain(
  was_principal_architect boolean,
  was_practice_administrator boolean,
  was_methodology_publisher boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if was_principal_architect and private.active_principal_architect_count() = 0 then
    raise exception 'At least one active Principal Architect must remain' using errcode = '23514';
  end if;
  if was_practice_administrator and private.practice_capability_holder_count('administer_practice') = 0 then
    raise exception 'At least one active practice administrator must remain' using errcode = '23514';
  end if;
  if was_methodology_publisher and private.practice_capability_holder_count('publish_methodology') = 0 then
    raise exception 'At least one member must keep publish_methodology' using errcode = '23514';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Practice capability overrides: administer_practice is administered by
--    its holders; the Method capabilities keep their Phase 6 rule
--    (publish_methodology holders). Never on oneself; last holder kept.
-- -----------------------------------------------------------------------------
drop function private.lock_practice_override_target(uuid);

create function private.lock_practice_override_target(
  p_membership_id uuid,
  p_capability public.practice_capability
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_practice_administration();
  if p_capability = 'administer_practice' then
    perform private.require_practice_capability('administer_practice');
  else
    perform private.require_practice_capability('publish_methodology');
  end if;
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

create function private.assert_practice_capability_remains(p_capability public.practice_capability)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_capability = 'administer_practice' then
    perform private.assert_practice_holders_remain(false, true, false);
  else
    perform private.assert_publish_methodology_remains();
  end if;
end;
$$;

create or replace function public.set_practice_capability_override(
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
  perform private.lock_practice_override_target(p_membership_id, p_capability);
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
  perform private.assert_practice_capability_remains(p_capability);
  return override_id;
end;
$$;

create or replace function public.clear_practice_capability_override(
  p_membership_id uuid,
  p_capability public.practice_capability
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_practice_override_target(p_membership_id, p_capability);
  delete from public.practice_member_capability_overrides
  where organization_member_id = p_membership_id and capability = p_capability;
  perform private.assert_practice_capability_remains(p_capability);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. TPLCo memberships: who may change what (D1, D2, D5)
-- -----------------------------------------------------------------------------
create function private.guard_practice_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_ids uuid[];
  target_user uuid;
  new_authority boolean;
begin
  -- Trusted operators (migrations, seed, the local bootstrap command).
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    organization_ids := array[new.organization_id];
  elsif tg_op = 'DELETE' then
    organization_ids := array[old.organization_id];
  else
    organization_ids := array[new.organization_id, old.organization_id];
  end if;
  if not exists (
    select 1 from public.organizations o
    where o.type = 'tplco' and o.id = any (organization_ids)
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  perform private.lock_practice_administration();

  -- Accepting one's own invitation (public.accept_invitation).
  if tg_op = 'UPDATE'
     and old.user_id = auth.uid()
     and old.status = 'invited' and new.status = 'active'
     and new.role = old.role
     and new.organization_id = old.organization_id and new.user_id = old.user_id then
    return new;
  end if;

  if not private.has_practice_capability('administer_practice') then
    raise exception 'Only a practice administrator manages TPLCo staff' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.user_id <> old.user_id) then
    raise exception 'A membership cannot be moved; invite the person instead' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    target_user := old.user_id;
  else
    target_user := new.user_id;
  end if;
  if target_user = auth.uid() then
    raise exception 'You cannot change your own practice role or status' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'invited' then
      raise exception 'Only a pending invitation can be revoked; suspend the member instead'
        using errcode = '23514';
    end if;
    return old;
  end if;

  -- Creating architectural authority: an authority-bearing role that is
  -- new, changed into, or restored from suspension.
  if tg_op = 'INSERT' then
    new_authority := public.is_architecture_authority_role(new.role)
      and new.status in ('active', 'invited');
  else
    new_authority := public.is_architecture_authority_role(new.role)
      and new.status in ('active', 'invited')
      and (new.role <> old.role or old.status not in ('active', 'invited'));
  end if;
  if new_authority and private.current_internal_role() is distinct from 'principal_architect' then
    raise exception 'Only a Principal Architect can give someone the % role', new.role
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger organization_members_guard_practice
  before insert or update or delete on public.organization_members
  for each row execute function private.guard_practice_membership();

-- After a TPLCo role or status change, the last Principal Architect, the
-- last practice administrator and the last methodology publisher remain.
create function private.check_practice_membership_holders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_active boolean;
begin
  if auth.uid() is null
     or not exists (select 1 from public.organizations o where o.id = old.organization_id and o.type = 'tplco') then
    return null;
  end if;
  was_active := old.status = 'active'
    and exists (select 1 from public.profiles p where p.id = old.user_id and p.status = 'active');
  perform private.assert_practice_holders_remain(
    was_active and old.role = 'principal_architect',
    was_active and private.membership_role_has_practice_capability(old.id, old.role, 'administer_practice'),
    was_active and private.membership_role_has_practice_capability(old.id, old.role, 'publish_methodology')
  );
  return null;
end;
$$;

create trigger organization_members_practice_holders
  after update on public.organization_members
  for each row execute function private.check_practice_membership_holders();

-- -----------------------------------------------------------------------------
-- 6. Internal engagement roles follow the TPLCo role (D3)
-- -----------------------------------------------------------------------------

-- Existing data must already comply. Fail loudly rather than silently
-- changing anyone's authority.
do $$
begin
  if exists (
    select 1
    from public.engagement_members em
    where em.side = 'internal'
      and not exists (
        select 1 from public.organization_members m
        join public.organizations o on o.id = m.organization_id
        where o.type = 'tplco' and m.user_id = em.user_id and m.role = em.role
      )
  ) then
    raise exception 'Internal engagement members exist whose role differs from their TPLCo role. '
      'Resolve them before applying this migration (V1-A A3).';
  end if;
end;
$$;

create or replace function private.validate_engagement_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  engagement_org uuid;
  practice_role public.app_role;
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

  if new.side = 'internal' then
    select m.role into practice_role
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = new.user_id
      and o.type = 'tplco';
    if practice_role is null then
      raise exception 'Internal members must belong to TPLCo' using errcode = '23514';
    end if;
    -- D3: the engagement role is the practice role. Per-engagement
    -- differences are capability overrides.
    if new.role <> practice_role then
      raise exception 'An internal team member''s engagement role is their practice role'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' and (new.engagement_id <> old.engagement_id or new.user_id <> old.user_id) then
    raise exception 'Reassign by removing and re-adding the member' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- A TPLCo role change moves that person's internal engagement rows with it,
-- in the same transaction. Engagement capability overrides are kept.
create function private.propagate_practice_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and exists (select 1 from public.organizations o where o.id = new.organization_id and o.type = 'tplco') then
    update public.engagement_members
    set role = new.role
    where user_id = new.user_id and side = 'internal' and role <> new.role;
  end if;
  return null;
end;
$$;

create trigger organization_members_propagate_role
  after update of role on public.organization_members
  for each row execute function private.propagate_practice_role();

-- -----------------------------------------------------------------------------
-- 7. Profiles: status and email are practice administration (D1, D2, D5)
-- -----------------------------------------------------------------------------
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or (new.status is not distinct from old.status and new.email is not distinct from old.email) then
    return new;
  end if;

  perform private.lock_practice_administration();
  if not private.has_practice_capability('administer_practice') then
    raise exception 'Only a practice administrator can change profile status or email'
      using errcode = '42501';
  end if;
  if new.id = auth.uid() then
    raise exception 'You cannot change your own status' using errcode = '42501';
  end if;
  -- Restoring a profile restores the authority its TPLCo role carries.
  if new.status = 'active' and old.status <> 'active'
     and exists (
       select 1 from public.organization_members m
       join public.organizations o on o.id = m.organization_id
       where m.user_id = new.id and o.type = 'tplco'
         and m.status in ('active', 'invited')
         and public.is_architecture_authority_role(m.role)
     )
     and private.current_internal_role() is distinct from 'principal_architect' then
    raise exception 'Only a Principal Architect can restore someone with architectural authority'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.check_practice_profile_holders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership record;
begin
  if auth.uid() is null or old.status <> 'active' or new.status = 'active' then
    return null;
  end if;
  select m.id, m.role into membership
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = old.id and o.type = 'tplco' and m.status = 'active';
  if found then
    perform private.assert_practice_holders_remain(
      membership.role = 'principal_architect',
      private.membership_role_has_practice_capability(membership.id, membership.role, 'administer_practice'),
      private.membership_role_has_practice_capability(membership.id, membership.role, 'publish_methodology')
    );
  end if;
  return null;
end;
$$;

create trigger profiles_practice_holders
  after update of status on public.profiles
  for each row execute function private.check_practice_profile_holders();

-- -----------------------------------------------------------------------------
-- 8. The practice organization (A6): its name and identifier are edited by
--    practice administrators; its type never changes, and it is not
--    suspended or archived from the app (that would remove every member's
--    access at once).
-- -----------------------------------------------------------------------------
create function private.guard_organization_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.type <> old.type then
    raise exception 'An organization''s type cannot change' using errcode = '23514';
  end if;
  if old.type = 'tplco' and new.status <> old.status then
    raise exception 'The practice organization cannot be suspended or archived here' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger organizations_guard_update
  before update on public.organizations
  for each row execute function private.guard_organization_update();

-- -----------------------------------------------------------------------------
-- 9. Policies: practice administration is a capability, not a role name
-- -----------------------------------------------------------------------------
drop policy "profiles: users edit themselves, system administrators edit anyone" on public.profiles;
create policy "profiles: users edit themselves, practice administrators edit anyone"
  on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or (select private.has_practice_capability('administer_practice'))
  )
  with check (
    id = (select auth.uid())
    or (select private.has_practice_capability('administer_practice'))
  );

drop policy "organizations: directory managers edit client organizations, admins edit TPLCo" on public.organizations;
create policy "organizations: directory managers edit client organizations, practice administrators edit TPLCo"
  on public.organizations for update to authenticated
  using (
    (type = 'client' and (select private.can_manage_client_directory()))
    or (type = 'tplco' and (select private.has_practice_capability('administer_practice')))
  )
  with check (
    (type = 'client' and (select private.can_manage_client_directory()))
    or (type = 'tplco' and (select private.has_practice_capability('administer_practice')))
  );

drop policy "organization members: managed by directory managers (client) or admins (TPLCo)" on public.organization_members;
create policy "organization members: managed by directory managers (client) or practice administrators (TPLCo)"
  on public.organization_members for all to authenticated
  using (
    exists (
      select 1 from public.organizations o
      where o.id = organization_id
        and (
          (o.type = 'tplco' and (select private.has_practice_capability('administer_practice')))
          or (o.type = 'client' and (select private.can_manage_client_directory()))
        )
    )
  )
  with check (
    exists (
      select 1 from public.organizations o
      where o.id = organization_id
        and (
          (o.type = 'tplco' and (select private.has_practice_capability('administer_practice')))
          or (o.type = 'client' and (select private.can_manage_client_directory()))
        )
    )
  );

-- -----------------------------------------------------------------------------
-- 10. Privileges
-- -----------------------------------------------------------------------------
revoke all on function private.lock_practice_administration() from public, anon, authenticated;
revoke all on function private.membership_role_has_practice_capability(uuid, public.app_role, public.practice_capability) from public, anon, authenticated;
revoke all on function private.active_principal_architect_count() from public, anon, authenticated;
revoke all on function private.assert_practice_holders_remain(boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function private.lock_practice_override_target(uuid, public.practice_capability) from public, anon, authenticated;
revoke all on function private.assert_practice_capability_remains(public.practice_capability) from public, anon, authenticated;
revoke all on function private.guard_practice_membership() from public, anon, authenticated;
revoke all on function private.check_practice_membership_holders() from public, anon, authenticated;
revoke all on function private.propagate_practice_role() from public, anon, authenticated;
revoke all on function private.check_practice_profile_holders() from public, anon, authenticated;
revoke all on function private.guard_organization_update() from public, anon, authenticated;
