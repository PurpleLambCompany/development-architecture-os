import { describe, expect, it } from "vitest";
import {
  CLIENT_ROLES,
  INTERNAL_ROLES,
  ROLE_LABELS,
  canArchiveEngagement,
  canManageClientDirectory,
  canManageEngagement,
  assignablePracticeRoles,
  createsArchitectureAuthority,
  isArchitectureAuthorityRole,
  canSeeAllEngagements,
  roleSide,
} from "./roles";

describe("role catalog", () => {
  it("defines the six internal and five client roles from the spec", () => {
    expect(INTERNAL_ROLES).toHaveLength(6);
    expect(CLIENT_ROLES).toHaveLength(5);
    expect(Object.keys(ROLE_LABELS)).toHaveLength(11);
  });

  it("assigns every role to exactly one side", () => {
    for (const role of INTERNAL_ROLES) expect(roleSide(role)).toBe("internal");
    for (const role of CLIENT_ROLES) expect(roleSide(role)).toBe("client");
  });
});

describe("capabilities (mirror of RLS)", () => {
  it("lets only administrators and principals see every engagement", () => {
    expect(canSeeAllEngagements("system_administrator")).toBe(true);
    expect(canSeeAllEngagements("principal_architect")).toBe(true);
    expect(canSeeAllEngagements("project_administrator")).toBe(false);
    expect(canSeeAllEngagements("researcher")).toBe(false);
    expect(canSeeAllEngagements("executive_sponsor")).toBe(false);
    expect(canSeeAllEngagements(null)).toBe(false);
  });

  it("never gives a client role management rights", () => {
    for (const role of CLIENT_ROLES) {
      expect(canManageClientDirectory(role)).toBe(false);
      expect(canManageEngagement(role, role)).toBe(false);
      expect(canArchiveEngagement(role)).toBe(false);
      expect(isArchitectureAuthorityRole(role)).toBe(false);
    }
  });

  it("keeps researchers and finance administrators out of engagement management", () => {
    expect(canManageEngagement("researcher", "researcher")).toBe(false);
    expect(canManageEngagement("finance_administrator", "finance_administrator")).toBe(false);
  });

  it("lets a project administrator manage only engagements they are assigned to", () => {
    expect(canManageEngagement("project_administrator", "project_administrator")).toBe(true);
    expect(canManageEngagement("project_administrator", null)).toBe(false);
    expect(canArchiveEngagement("project_administrator")).toBe(false);
  });

  it("lets practice administrators manage staff, but only a Principal Architect creates authority (D1, D2)", () => {
    expect(assignablePracticeRoles("principal_architect", true)).toEqual(INTERNAL_ROLES);
    expect(assignablePracticeRoles("system_administrator", true)).toEqual([
      "system_administrator",
      "project_administrator",
      "finance_administrator",
    ]);
    expect(assignablePracticeRoles("project_administrator", true)).not.toContain("architect");
    expect(assignablePracticeRoles("principal_architect", false)).toEqual([]);
    expect(assignablePracticeRoles("system_administrator", false)).toEqual([]);
  });

  it("recognizes every route that creates architectural authority", () => {
    expect(createsArchitectureAuthority(null, { role: "architect", status: "invited" })).toBe(true);
    expect(
      createsArchitectureAuthority(
        { role: "researcher", status: "active" },
        { role: "architect", status: "active" },
      ),
    ).toBe(true);
    expect(
      createsArchitectureAuthority(
        { role: "architect", status: "suspended" },
        { role: "architect", status: "active" },
      ),
    ).toBe(true);
    expect(
      createsArchitectureAuthority(
        { role: "architect", status: "active" },
        { role: "architect", status: "suspended" },
      ),
    ).toBe(false);
    expect(
      createsArchitectureAuthority(
        { role: "architect", status: "active" },
        { role: "project_administrator", status: "active" },
      ),
    ).toBe(false);
    expect(
      createsArchitectureAuthority(
        { role: "architect", status: "invited" },
        { role: "architect", status: "active" },
      ),
    ).toBe(false);
  });
});
