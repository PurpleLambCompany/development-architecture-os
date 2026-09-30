import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_ROLES, INTERNAL_ROLES, type AppRole } from "@/domain/roles/roles";
import {
  ENGAGEMENT_CAPABILITIES,
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

describe("effectiveCapabilities", () => {
  it("uses the role default when there is no override", () => {
    expect(effectiveCapabilities("client_finance")).toEqual(["view_financials", "pay_invoices"]);
    expect(effectiveCapabilities("client_viewer")).toEqual([]);
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
    expect(ROLE_CAPABILITY_DEFAULTS.client_viewer).toEqual([]);
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

  it("stops anyone but a System Administrator changing their own capabilities", () => {
    expect(check("principal_architect", null, "approve_architecture", true)).toBe(false);
    expect(check("system_administrator", null, "view_financials", true)).toBe(true);
  });
});
