import { describe, expect, it } from "vitest";
import {
  CLIENT_ROLES,
  INTERNAL_ROLES,
  ROLE_LABELS,
  canArchiveEngagement,
  canManageClientDirectory,
  canManageEngagement,
  canManageInternalStaff,
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
      expect(canManageInternalStaff(role)).toBe(false);
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

  it("reserves staff management for system administrators", () => {
    expect(canManageInternalStaff("system_administrator")).toBe(true);
    expect(canManageInternalStaff("principal_architect")).toBe(false);
  });
});
