import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_ROLES, INTERNAL_ROLES, type AppRole } from "@/domain/roles/roles";
import {
  ROLE_CAPABILITY_DEFAULTS,
  canManageCapability,
  capabilitySide,
  effectiveCapabilities,
  type EngagementCapability,
} from "./catalog";

describe("role capability defaults", () => {
  it("match the defaults seeded by the migration", () => {
    // Every defaults insert, across all migrations, in order.
    const dir = join(process.cwd(), "supabase/migrations");
    const fromSql: Record<string, string[]> = {};
    for (const file of readdirSync(dir).sort()) {
      const sql = readFileSync(join(dir, file), "utf8");
      for (const block of sql.split("insert into public.role_capability_defaults").slice(1)) {
        const pairs = block.slice(0, block.indexOf(";")).matchAll(/\('(\w+)',\s*'(\w+)'\)/g);
        for (const [, role, capability] of pairs) (fromSql[role!] ??= []).push(capability!);
      }
    }

    for (const role of [...INTERNAL_ROLES, ...CLIENT_ROLES]) {
      expect([...(fromSql[role] ?? [])].sort(), role).toEqual(
        [...ROLE_CAPABILITY_DEFAULTS[role]].sort(),
      );
    }
  });

  it("give Executive Sponsor and Client Finance financial visibility, and no other client role", () => {
    const withFinancials = CLIENT_ROLES.filter((role) =>
      ROLE_CAPABILITY_DEFAULTS[role].includes("view_financials"),
    );
    expect(withFinancials).toEqual(["executive_sponsor", "client_finance"]);
  });

  it("keep financial management internal", () => {
    expect(capabilitySide("manage_financials")).toBe("internal");
    for (const role of CLIENT_ROLES) {
      expect(ROLE_CAPABILITY_DEFAULTS[role]).not.toContain("manage_financials");
    }
  });

  it("never give an internal role a client-only capability", () => {
    for (const role of INTERNAL_ROLES) {
      for (const capability of ROLE_CAPABILITY_DEFAULTS[role]) {
        expect(capabilitySide(capability)).not.toBe("client");
      }
    }
  });
});

describe("architecture capabilities", () => {
  it("keep drafting and publishing internal, and viewing on the client side", () => {
    expect(capabilitySide("edit_architecture")).toBe("internal");
    expect(capabilitySide("publish_architecture")).toBe("internal");
    expect(capabilitySide("view_architecture")).toBe("client");
  });

  it("do not give System Administrators drafting or publishing authority by default", () => {
    expect(ROLE_CAPABILITY_DEFAULTS.system_administrator).not.toContain("edit_architecture");
    expect(ROLE_CAPABILITY_DEFAULTS.system_administrator).not.toContain("publish_architecture");
  });

  it("give Client Finance no architecture visibility by default", () => {
    expect(ROLE_CAPABILITY_DEFAULTS.client_finance).not.toContain("view_architecture");
  });
});

describe("Project Intelligence capabilities", () => {
  it("keep managing client requests internal and the client's participation on the client side", () => {
    expect(capabilitySide("manage_client_requests")).toBe("internal");
    for (const capability of [
      "view_full_architecture",
      "respond_to_client_actions",
      "assign_client_actions",
      "submit_client_input",
    ] as const) {
      expect(capabilitySide(capability)).toBe("client");
    }
  });

  it("limit Client Contributors to their areas and give Client Finance no participation", () => {
    expect(ROLE_CAPABILITY_DEFAULTS.client_contributor).not.toContain("view_full_architecture");
    expect(ROLE_CAPABILITY_DEFAULTS.client_contributor).toContain("respond_to_client_actions");
    for (const capability of [
      "view_full_architecture",
      "respond_to_client_actions",
      "assign_client_actions",
      "submit_client_input",
    ] as const) {
      expect(ROLE_CAPABILITY_DEFAULTS.client_finance).not.toContain(capability);
    }
  });

  it("do not let System Administrators or Finance Administrators manage client requests by default", () => {
    expect(ROLE_CAPABILITY_DEFAULTS.system_administrator).not.toContain("manage_client_requests");
    expect(ROLE_CAPABILITY_DEFAULTS.finance_administrator).not.toContain("manage_client_requests");
  });
});

describe("effectiveCapabilities", () => {
  it("uses the role default when there is no override", () => {
    expect(effectiveCapabilities("client_finance")).toEqual(["view_financials", "pay_invoices"]);
    expect(effectiveCapabilities("client_viewer")).toEqual([
      "view_architecture",
      "view_full_architecture",
    ]);
  });

  it("lets an override grant or revoke a single capability", () => {
    expect(
      effectiveCapabilities("client_project_lead", [
        { capability: "view_financials", granted: true },
      ]),
    ).toContain("view_financials");
    const sponsor = effectiveCapabilities("executive_sponsor", [
      { capability: "pay_invoices", granted: false },
    ]);
    expect(sponsor).not.toContain("pay_invoices");
    expect(sponsor).toHaveLength(ROLE_CAPABILITY_DEFAULTS.executive_sponsor.length - 1);
  });

  it("does not mutate the role definition", () => {
    effectiveCapabilities("client_viewer", [{ capability: "view_financials", granted: true }]);
    expect(ROLE_CAPABILITY_DEFAULTS.client_viewer).toEqual([
      "view_architecture",
      "view_full_architecture",
    ]);
  });
});

describe("canManageCapability", () => {
  const check = (
    viewerRole: AppRole,
    viewerEngagementRole: AppRole | null,
    capability: EngagementCapability,
    isSelf = false,
  ) => canManageCapability({ viewerRole, viewerEngagementRole, isSelf, capability });

  it("requires financial authority for financial capabilities", () => {
    expect(check("principal_architect", null, "view_financials")).toBe(true);
    expect(check("project_administrator", "project_administrator", "view_financials")).toBe(false);
    expect(check("finance_administrator", "finance_administrator", "view_financials")).toBe(true);
    expect(check("finance_administrator", null, "view_financials")).toBe(false);
  });

  it("lets engagement managers change project capabilities", () => {
    expect(check("project_administrator", "project_administrator", "approve_architecture")).toBe(
      true,
    );
    expect(check("architect", "architect", "approve_architecture")).toBe(false);
    expect(check("finance_administrator", "finance_administrator", "approve_architecture")).toBe(
      false,
    );
  });

  it("lets only Principal Architects grant drafting and publishing authority", () => {
    for (const capability of ["edit_architecture", "publish_architecture"] as const) {
      expect(check("principal_architect", "principal_architect", capability)).toBe(true);
      expect(check("principal_architect", null, capability, true)).toBe(false);
      expect(check("system_administrator", null, capability)).toBe(false);
      expect(check("system_administrator", null, capability, true)).toBe(false);
      expect(check("project_administrator", "project_administrator", capability)).toBe(false);
      expect(check("architect", "architect", capability)).toBe(false);
    }
    expect(check("project_administrator", "project_administrator", "view_architecture")).toBe(true);
  });

  it("stops anyone but a System Administrator changing their own capabilities", () => {
    expect(check("principal_architect", null, "approve_architecture", true)).toBe(false);
    expect(check("system_administrator", null, "view_financials", true)).toBe(true);
  });
});
