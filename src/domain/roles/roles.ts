import type { Database } from "@/types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type MemberSide = Database["public"]["Enums"]["member_side"];

/**
 * Role catalog. The database (RLS + triggers) is the authority on what a
 * role may do; the capability helpers below mirror those rules so the UI
 * only offers actions that will succeed. Keep them in sync with
 * supabase/migrations/*_phase1_foundation.sql and docs/database/rls.md.
 */
export const INTERNAL_ROLES = [
  "system_administrator",
  "principal_architect",
  "architect",
  "researcher",
  "project_administrator",
  "finance_administrator",
] as const satisfies readonly AppRole[];

export const CLIENT_ROLES = [
  "executive_sponsor",
  "client_project_lead",
  "client_finance",
  "client_contributor",
  "client_viewer",
] as const satisfies readonly AppRole[];

export type InternalRole = (typeof INTERNAL_ROLES)[number];
export type ClientRole = (typeof CLIENT_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  system_administrator: "System Administrator",
  principal_architect: "Principal Architect",
  architect: "Architect",
  researcher: "Researcher",
  project_administrator: "Project Administrator",
  finance_administrator: "Finance Administrator",
  executive_sponsor: "Executive Sponsor",
  client_project_lead: "Client Project Lead",
  client_finance: "Client Finance",
  client_contributor: "Client Contributor",
  client_viewer: "Client Viewer",
};

export function roleSide(role: AppRole): MemberSide {
  return (INTERNAL_ROLES as readonly AppRole[]).includes(role) ? "internal" : "client";
}

export function isInternalRole(role: AppRole): role is InternalRole {
  return roleSide(role) === "internal";
}

export function isClientRole(role: AppRole): role is ClientRole {
  return roleSide(role) === "client";
}

/** Sees every engagement without being assigned. */
export function canSeeAllEngagements(role: AppRole | null): boolean {
  return role === "system_administrator" || role === "principal_architect";
}

/** May create client organizations, invite client users, and create engagements. */
export function canManageClientDirectory(role: AppRole | null): boolean {
  return (
    role === "system_administrator" ||
    role === "principal_architect" ||
    role === "project_administrator"
  );
}

export const canCreateEngagement = canManageClientDirectory;

/**
 * May edit an engagement and its team. `engagementRole` is the viewer's
 * role on that specific engagement, if assigned.
 */
export function canManageEngagement(
  orgRole: AppRole | null,
  engagementRole: AppRole | null,
): boolean {
  return canSeeAllEngagements(orgRole) || engagementRole === "project_administrator";
}

export function canArchiveEngagement(role: AppRole | null): boolean {
  return canSeeAllEngagements(role);
}

/**
 * Internal roles whose engagement defaults carry architectural authority
 * (decision D2). Mirrors public.is_architecture_authority_role.
 */
export const ARCHITECTURE_AUTHORITY_ROLES = [
  "principal_architect",
  "architect",
  "researcher",
] as const satisfies readonly InternalRole[];

export function isArchitectureAuthorityRole(role: AppRole): boolean {
  return (ARCHITECTURE_AUTHORITY_ROLES as readonly AppRole[]).includes(role);
}

/**
 * The practice roles a viewer may give someone, by invitation or role
 * change. Practice administration is the administer_practice capability
 * (D1), not a role name; the authority-bearing roles additionally need the
 * viewer to be a Principal Architect (D2). Mirrors
 * private.guard_practice_membership; nobody acts on themselves (D5).
 */
export function assignablePracticeRoles(
  viewerRole: AppRole | null,
  administersPractice: boolean,
): InternalRole[] {
  if (!administersPractice) return [];
  return INTERNAL_ROLES.filter(
    (role) => viewerRole === "principal_architect" || !isArchitectureAuthorityRole(role),
  );
}

/**
 * Whether giving `target` this role and status creates architectural
 * authority: an authority-bearing role that is new, changed into, or
 * restored from suspension. Only a Principal Architect may do that.
 */
export function createsArchitectureAuthority(
  before: { role: AppRole; status: string } | null,
  after: { role: AppRole; status: string },
): boolean {
  if (!isArchitectureAuthorityRole(after.role)) return false;
  if (after.status !== "active" && after.status !== "invited") return false;
  if (!before) return true;
  return before.role !== after.role || (before.status !== "active" && before.status !== "invited");
}

export function canReadActivityLog(role: AppRole | null): boolean {
  return canSeeAllEngagements(role);
}
