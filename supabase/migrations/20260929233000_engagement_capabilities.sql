-- =============================================================================
-- DSA OS — Engagement capabilities (Phase 1, pre-merge)
--
-- Permissions on an engagement are evaluated through capabilities, not role
-- names. Each role supplies DEFAULT capabilities (role_capability_defaults,
-- changed only by migration). An engagement manager may OVERRIDE a single
-- capability for a single engagement member (grant or revoke) without
-- touching the role definition. See ADR-0008 and docs/database/rls.md.
--
-- Financial visibility is deliberately separate from project visibility:
--   * view_financials does not grant access to project content, and
--   * project access does not grant view_financials.
-- System and Finance Administrators hold portfolio-wide view_financials
-- without assignment; that does NOT let them read engagement content.
-- =============================================================================

create type public.engagement_capability as enum (
  'view_financials',
  'approve_change_orders',
  'pay_invoices',
  'approve_architecture',
  'manage_client_team',
  'view_confidential_deliverables'
);

-- Capabilities that only make sense on one side of an engagement.
-- null means the capability may be held by internal and client members.
create function public.capability_side(capability public.engagement_capability)
returns public.member_side
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when capability in ('pay_invoices', 'approve_change_orders') then 'client'::public.member_side
    else null
  end;
$$;

-- Financial capabilities need financial authority to grant or revoke.
create function public.is_financial_capability(capability public.engagement_capability)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select capability in ('view_financials', 'pay_invoices', 'approve_change_orders');
$$;

-- -----------------------------------------------------------------------------
-- Role defaults (the role definition). Reference data; migrations only.
-- -----------------------------------------------------------------------------
create table public.role_capability_defaults (
  role        public.app_role not null,
  capability  public.engagement_capability not null,
  primary key (role, capability),
  constraint role_capability_defaults_side check (
    public.capability_side(capability) is null
    or public.capability_side(capability) = public.role_side(role)
  )
);

insert into public.role_capability_defaults (role, capability) values
  -- Internal
  ('system_administrator',  'view_financials'),
  ('system_administrator',  'approve_architecture'),
  ('system_administrator',  'manage_client_team'),
  ('system_administrator',  'view_confidential_deliverables'),
  ('principal_architect',   'view_financials'),
  ('principal_architect',   'approve_architecture'),
  ('principal_architect',   'manage_client_team'),
  ('principal_architect',   'view_confidential_deliverables'),
  ('architect',             'view_confidential_deliverables'),
  ('researcher',            'view_confidential_deliverables'),
  ('project_administrator', 'manage_client_team'),
  ('project_administrator', 'view_confidential_deliverables'),
  ('finance_administrator', 'view_financials'),
  -- Client
  ('executive_sponsor',     'view_financials'),
  ('executive_sponsor',     'approve_change_orders'),
  ('executive_sponsor',     'pay_invoices'),
  ('executive_sponsor',     'approve_architecture'),
  ('executive_sponsor',     'manage_client_team'),
  ('executive_sponsor',     'view_confidential_deliverables'),
  ('client_project_lead',   'approve_architecture'),
  ('client_project_lead',   'manage_client_team'),
  ('client_project_lead',   'view_confidential_deliverables'),
  ('client_finance',        'view_financials'),
  ('client_finance',        'pay_invoices');
  -- client_contributor and client_viewer hold no capabilities by default.

-- -----------------------------------------------------------------------------
-- Per-member overrides. Never mutate the role; grant or revoke one
-- capability for one engagement member.
-- -----------------------------------------------------------------------------
create table public.engagement_member_capability_overrides (
  id                    uuid primary key default gen_random_uuid(),
  engagement_member_id  uuid not null references public.engagement_members (id) on delete cascade,
  -- Denormalized from the member (set by trigger) so policies and the audit
  -- log can scope by engagement without a join.
  engagement_id         uuid not null references public.engagements (id) on delete cascade,
  capability            public.engagement_capability not null,
  granted               boolean not null,
  reason                text not null default '' check (char_length(reason) <= 500),
  created_by            uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint engagement_member_capability_overrides_unique unique (engagement_member_id, capability)
);
create index engagement_member_capability_overrides_engagement_idx
  on public.engagement_member_capability_overrides (engagement_id);

-- -----------------------------------------------------------------------------
-- Capability helpers
-- -----------------------------------------------------------------------------

-- Effective capability of one engagement member: an override wins,
-- otherwise the member's role default applies.
create function private.member_has_capability(
  target_member_id uuid,
  target_capability public.engagement_capability
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
      from public.engagement_member_capability_overrides o
      where o.engagement_member_id = target_member_id
        and o.capability = target_capability
    ),
    exists (
      select 1
      from public.engagement_members em
      join public.role_capability_defaults d on d.role = em.role
      where em.id = target_member_id
        and d.capability = target_capability
    )
  );
$$;

-- Portfolio-wide financial visibility for internal finance authority.
-- Grants view_financials on every engagement WITHOUT granting access to the
-- engagement's project content (can_access_engagement is unaffected).
create function private.has_portfolio_financial_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_internal_role(
    array['system_administrator', 'finance_administrator']::public.app_role[]
  );
$$;

-- Does the caller hold a capability on an engagement? Evaluated through the
-- caller's own valid assignment (same validity rules as engagement_role),
-- plus portfolio financial access for view_financials.
create function private.has_engagement_capability(
  target_engagement_id uuid,
  target_capability public.engagement_capability
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.engagement_members em
    join public.engagements e on e.id = em.engagement_id
    where em.engagement_id = target_engagement_id
      and em.user_id = auth.uid()
      and em.status = 'active'
      and (
        (em.side = 'internal' and private.is_internal())
        or (em.side = 'client' and private.is_active_org_member(e.client_organization_id))
      )
      and private.member_has_capability(em.id, target_capability)
  )
  or (
    target_capability = 'view_financials'
    and private.has_portfolio_financial_access()
    and exists (select 1 from public.engagements where id = target_engagement_id)
  );
$$;

-- Phase 2 financial tables will use this in their policies.
create function private.can_view_engagement_financials(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_engagement_capability(target_engagement_id, 'view_financials');
$$;

-- Who may grant or revoke a capability for a member of an engagement.
-- Financial capabilities: System Administrators, Principal Architects, or a
-- Finance Administrator who can see the engagement. Other capabilities:
-- anyone who manages the engagement. Nobody but a System Administrator may
-- change their own capabilities.
create function private.can_manage_capability(
  target_engagement_id uuid,
  target_member_id uuid,
  target_capability public.engagement_capability
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      private.has_internal_role(array['system_administrator']::public.app_role[])
      or not exists (
        select 1 from public.engagement_members em
        where em.id = target_member_id and em.user_id = auth.uid()
      )
    )
    and (
      case
        when public.is_financial_capability(target_capability) then
          private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[])
          or (
            private.has_internal_role(array['finance_administrator']::public.app_role[])
            and private.can_access_engagement(target_engagement_id)
          )
        else private.can_manage_engagement(target_engagement_id)
      end
    );
$$;

revoke all on function private.member_has_capability(uuid, public.engagement_capability) from public, anon;
revoke all on function private.has_portfolio_financial_access() from public, anon;
revoke all on function private.has_engagement_capability(uuid, public.engagement_capability) from public, anon;
revoke all on function private.can_view_engagement_financials(uuid) from public, anon;
revoke all on function private.can_manage_capability(uuid, uuid, public.engagement_capability) from public, anon;
grant execute on function private.member_has_capability(uuid, public.engagement_capability) to authenticated;
grant execute on function private.has_portfolio_financial_access() to authenticated;
grant execute on function private.has_engagement_capability(uuid, public.engagement_capability) to authenticated;
grant execute on function private.can_view_engagement_financials(uuid) to authenticated;
grant execute on function private.can_manage_capability(uuid, uuid, public.engagement_capability) to authenticated;

-- The caller's effective capabilities on an engagement (for the UI).
create function public.my_engagement_capabilities(target_engagement_id uuid)
returns setof public.engagement_capability
language sql
stable
security definer
set search_path = ''
as $$
  select c
  from unnest(enum_range(null::public.engagement_capability)) as c
  where private.has_engagement_capability(target_engagement_id, c);
$$;

revoke all on function public.my_engagement_capabilities(uuid) from public, anon;
grant execute on function public.my_engagement_capabilities(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Integrity
-- -----------------------------------------------------------------------------
create function private.prepare_capability_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m_side public.member_side;
begin
  select em.engagement_id, em.side into new.engagement_id, m_side
  from public.engagement_members em
  where em.id = new.engagement_member_id;

  if new.granted and public.capability_side(new.capability) is not null
     and public.capability_side(new.capability) <> m_side then
    raise exception 'Capability % cannot be granted to % members', new.capability, m_side
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and (
    new.engagement_member_id <> old.engagement_member_id or new.capability <> old.capability
  ) then
    raise exception 'Remove the override and create a new one instead' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger capability_overrides_prepare
  before insert or update on public.engagement_member_capability_overrides
  for each row execute function private.prepare_capability_override();
create trigger capability_overrides_set_updated_at
  before update on public.engagement_member_capability_overrides
  for each row execute function private.set_updated_at();
create trigger capability_overrides_set_created_by
  before insert on public.engagement_member_capability_overrides
  for each row execute function private.set_created_by();

-- Extend the audit log to overrides.
create or replace function private.log_activity()
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
    when 'engagement_members', 'engagement_member_capability_overrides' then
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

create trigger capability_overrides_log
  after insert or update or delete on public.engagement_member_capability_overrides
  for each row execute function private.log_activity();

-- -----------------------------------------------------------------------------
-- Privileges and RLS
-- -----------------------------------------------------------------------------
revoke all on public.role_capability_defaults, public.engagement_member_capability_overrides from anon;
revoke insert, update, delete, truncate on public.role_capability_defaults from authenticated;
revoke truncate on public.engagement_member_capability_overrides from authenticated;

alter table public.role_capability_defaults enable row level security;
alter table public.engagement_member_capability_overrides enable row level security;

create policy "role capability defaults: readable reference data"
  on public.role_capability_defaults for select to authenticated
  using (true);

create policy "capability overrides: internal staff who can see the engagement, and the member themself"
  on public.engagement_member_capability_overrides for select to authenticated
  using (
    ((select private.is_internal()) and private.can_access_engagement(engagement_id))
    or exists (
      select 1 from public.engagement_members em
      where em.id = engagement_member_id and em.user_id = (select auth.uid())
    )
  );

create policy "capability overrides: granted by capability managers"
  on public.engagement_member_capability_overrides for insert to authenticated
  with check (private.can_manage_capability(engagement_id, engagement_member_id, capability));

create policy "capability overrides: changed by capability managers"
  on public.engagement_member_capability_overrides for update to authenticated
  using (private.can_manage_capability(engagement_id, engagement_member_id, capability))
  with check (private.can_manage_capability(engagement_id, engagement_member_id, capability));

create policy "capability overrides: removed by capability managers"
  on public.engagement_member_capability_overrides for delete to authenticated
  using (private.can_manage_capability(engagement_id, engagement_member_id, capability));
