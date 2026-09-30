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
] as const satisfies readonly EngagementCapability[];

export const CAPABILITY_LABELS: Record<EngagementCapability, string> = {
  view_financials: "View financials",
  approve_change_orders: "Approve change orders",
  pay_invoices: "Pay invoices",
  approve_architecture: "Approve architecture",
  manage_client_team: "Manage client team",
  view_confidential_deliverables: "View confidential deliverables",
  manage_financials: "Manage financials",
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

/** The side a capability is restricted to, or null when either side may hold it. */
export function capabilitySide(capability: EngagementCapability): MemberSide | null {
  if (capability === "pay_invoices" || capability === "approve_change_orders") return "client";
  if (capability === "manage_financials") return "internal";
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
  ],
  architect: ["view_confidential_deliverables"],
  researcher: ["view_confidential_deliverables"],
  project_administrator: ["manage_client_team", "view_confidential_deliverables"],
  finance_administrator: ["view_financials", "manage_financials"],
  executive_sponsor: [
    "view_financials",
    "approve_change_orders",
    "pay_invoices",
    "approve_architecture",
    "manage_client_team",
    "view_confidential_deliverables",
  ],
  client_project_lead: [
    "approve_architecture",
    "manage_client_team",
    "view_confidential_deliverables",
  ],
  client_finance: ["view_financials", "pay_invoices"],
  client_contributor: [],
  client_viewer: [],
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
 * Mirrors private.can_manage_capability: nobody but a System Administrator
 * changes their own capabilities; financial capabilities need financial
 * authority; the rest need engagement management rights.
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
