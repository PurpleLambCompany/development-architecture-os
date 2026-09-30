import type { Database } from "@/types/database";
import { canManageEngagement, type AppRole, type MemberSide } from "@/domain/roles/roles";

export type EngagementCapability = Database["public"]["Enums"]["engagement_capability"];

/**
 * Engagement capabilities. Permissions on an engagement are evaluated
 * through these, not through role names. The database is the authority
 * (supabase/migrations/*_engagement_capabilities.sql); this module mirrors
 * it so the UI only offers what will succeed. ADR-0008.
 */
export const ENGAGEMENT_CAPABILITIES = [
  "view_financials",
  "approve_change_orders",
  "pay_invoices",
  "approve_architecture",
  "manage_client_team",
  "view_confidential_deliverables",
  "manage_financials",
  "edit_architecture",
  "publish_architecture",
  "view_architecture",
  "manage_client_requests",
  "view_full_architecture",
  "respond_to_client_actions",
  "assign_client_actions",
  "submit_client_input",
] as const satisfies readonly EngagementCapability[];

export const CAPABILITY_LABELS: Record<EngagementCapability, string> = {
  view_financials: "View financials",
  approve_change_orders: "Approve change orders",
  pay_invoices: "Pay invoices",
  approve_architecture: "Approve architecture",
  manage_client_team: "Manage client team",
  view_confidential_deliverables: "View confidential deliverables",
  manage_financials: "Manage financials",
  edit_architecture: "Edit architecture",
  publish_architecture: "Publish architecture",
  view_architecture: "View architecture",
  manage_client_requests: "Manage client requests",
  view_full_architecture: "View the full architecture",
  respond_to_client_actions: "Respond to requests",
  assign_client_actions: "Assign requests",
  submit_client_input: "Add input",
};

export const FINANCIAL_CAPABILITIES = [
  "view_financials",
  "approve_change_orders",
  "pay_invoices",
  "manage_financials",
] as const satisfies readonly EngagementCapability[];

export function isFinancialCapability(capability: EngagementCapability): boolean {
  return (FINANCIAL_CAPABILITIES as readonly EngagementCapability[]).includes(capability);
}

/** Drafting and publishing authority: only Principal Architects grant or revoke these. */
export const ARCHITECTURE_AUTHORITY_CAPABILITIES = [
  "edit_architecture",
  "publish_architecture",
] as const satisfies readonly EngagementCapability[];

export function isArchitectureAuthorityCapability(capability: EngagementCapability): boolean {
  return (ARCHITECTURE_AUTHORITY_CAPABILITIES as readonly EngagementCapability[]).includes(
    capability,
  );
}

/** The side a capability is restricted to, or null when either side may hold it. */
export function capabilitySide(capability: EngagementCapability): MemberSide | null {
  if (
    capability === "pay_invoices" ||
    capability === "approve_change_orders" ||
    capability === "view_architecture" ||
    capability === "view_full_architecture" ||
    capability === "respond_to_client_actions" ||
    capability === "assign_client_actions" ||
    capability === "submit_client_input"
  )
    return "client";
  if (
    capability === "manage_financials" ||
    capability === "edit_architecture" ||
    capability === "publish_architecture" ||
    capability === "manage_client_requests"
  )
    return "internal";
  return null;
}

/** Role defaults: the role definition. Mirrors public.role_capability_defaults. */
export const ROLE_CAPABILITY_DEFAULTS: Record<AppRole, readonly EngagementCapability[]> = {
  system_administrator: [
    "view_financials",
    "manage_financials",
    "approve_architecture",
    "manage_client_team",
    "view_confidential_deliverables",
  ],
  principal_architect: [
    "view_financials",
    "manage_financials",
    "approve_architecture",
    "manage_client_team",
    "view_confidential_deliverables",
    "edit_architecture",
    "publish_architecture",
    "manage_client_requests",
  ],
  architect: [
    "view_confidential_deliverables",
    "edit_architecture",
    "publish_architecture",
    "manage_client_requests",
  ],
  researcher: ["view_confidential_deliverables", "edit_architecture", "manage_client_requests"],
  project_administrator: [
    "manage_client_team",
    "view_confidential_deliverables",
    "manage_client_requests",
  ],
  finance_administrator: ["view_financials", "manage_financials"],
  executive_sponsor: [
    "view_financials",
    "approve_change_orders",
    "pay_invoices",
    "approve_architecture",
    "manage_client_team",
    "view_confidential_deliverables",
    "view_architecture",
    "view_full_architecture",
    "respond_to_client_actions",
    "assign_client_actions",
    "submit_client_input",
  ],
  client_project_lead: [
    "approve_architecture",
    "manage_client_team",
    "view_confidential_deliverables",
    "view_architecture",
    "view_full_architecture",
    "respond_to_client_actions",
    "assign_client_actions",
    "submit_client_input",
  ],
  client_finance: ["view_financials", "pay_invoices"],
  client_contributor: ["view_architecture", "respond_to_client_actions", "submit_client_input"],
  client_viewer: ["view_architecture", "view_full_architecture"],
};

export type CapabilityOverride = { capability: EngagementCapability; granted: boolean };

/** A member's effective capabilities: an override wins, otherwise the role default. */
export function effectiveCapabilities(
  role: AppRole,
  overrides: readonly CapabilityOverride[] = [],
): EngagementCapability[] {
  return ENGAGEMENT_CAPABILITIES.filter((capability) => {
    const override = overrides.find((o) => o.capability === capability);
    return override ? override.granted : ROLE_CAPABILITY_DEFAULTS[role].includes(capability);
  });
}

/**
 * Whether the viewer may grant or revoke `capability` for a member.
 * Mirrors private.can_manage_capability: architecture authority
 * (edit_architecture, publish_architecture) is granted only by Principal
 * Architects, never to themselves; otherwise nobody but a System
 * Administrator changes their own capabilities, financial capabilities need
 * financial authority and the rest need engagement management rights.
 */
export function canManageCapability({
  viewerRole,
  viewerEngagementRole,
  isSelf,
  capability,
}: {
  viewerRole: AppRole | null;
  viewerEngagementRole: AppRole | null;
  isSelf: boolean;
  capability: EngagementCapability;
}): boolean {
  if (isArchitectureAuthorityCapability(capability)) {
    return viewerRole === "principal_architect" && !isSelf;
  }
  if (isSelf && viewerRole !== "system_administrator") return false;
  if (isFinancialCapability(capability)) {
    return (
      viewerRole === "system_administrator" ||
      viewerRole === "principal_architect" ||
      (viewerRole === "finance_administrator" && viewerEngagementRole !== null)
    );
  }
  return canManageEngagement(viewerRole, viewerEngagementRole);
}
