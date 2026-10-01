-- =============================================================================
-- Phase 7B.1: Architecture Intelligence Foundation. Migration 2 of 7.
-- Capability defaults, sides, override authority and helpers (OD-1, OD-2;
-- B-10; proposal §5.3, §7; ADR-0061, ADR-0024 amendment).
--
-- Editing Architecture and invoking external AI are separate authorities.
-- Neither use_architecture_intelligence nor authorize_external_ai_processing
-- is implied by reading or editing Architecture, and neither implies them.
--
--   use_architecture_intelligence      Principal Architect, Architect
--                                      (Researchers: not by default, OD-2)
--   authorize_external_ai_processing   Principal Architect only (OD-1)
--
-- Both are internal-only and join the architecture-authority set: only
-- Principal Architects grant or revoke overrides, never for themselves.
-- =============================================================================

create or replace function public.capability_side(capability public.engagement_capability)
returns public.member_side
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when capability in (
      'pay_invoices', 'approve_change_orders', 'view_architecture', 'view_full_architecture',
      'respond_to_client_actions', 'assign_client_actions', 'submit_client_input'
    ) then 'client'::public.member_side
    when capability in (
      'manage_financials', 'edit_architecture', 'publish_architecture', 'manage_client_requests',
      'manage_reviews', 'manage_deliverables', 'manage_implementation',
      'use_architecture_intelligence', 'authorize_external_ai_processing'
    ) then 'internal'::public.member_side
    else null
  end;
$$;

create or replace function public.is_architecture_authority_capability(capability public.engagement_capability)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select capability in ('edit_architecture', 'publish_architecture',
                        'use_architecture_intelligence', 'authorize_external_ai_processing');
$$;

insert into public.role_capability_defaults (role, capability) values
  ('principal_architect',   'use_architecture_intelligence'),
  ('architect',             'use_architecture_intelligence'),
  ('principal_architect',   'authorize_external_ai_processing');
  -- Researchers, Project, Finance and System Administrators hold neither by
  -- default; a Principal Architect may grant either by override.

-- May invoke Architecture Intelligence on the engagement. Internal-only even
-- if an override row were somehow present for a client member.
create function private.can_use_architecture_intelligence(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_architecture(target_engagement_id)
     and private.has_engagement_capability(target_engagement_id, 'use_architecture_intelligence');
$$;

-- May record the engagement's external processing authorization.
create function private.can_authorize_external_ai_processing(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_architecture(target_engagement_id)
     and private.has_engagement_capability(target_engagement_id, 'authorize_external_ai_processing');
$$;

revoke all on function private.can_use_architecture_intelligence(uuid) from public, anon;
revoke all on function private.can_authorize_external_ai_processing(uuid) from public, anon;
grant execute on function private.can_use_architecture_intelligence(uuid) to authenticated;
grant execute on function private.can_authorize_external_ai_processing(uuid) to authenticated;
