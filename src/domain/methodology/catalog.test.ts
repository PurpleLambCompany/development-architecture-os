import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_CRITERION_STATES,
  APPLICATION_STATES,
  DAM_RELEASE_STATUSES,
  ELEMENT_ROLES,
  EVIDENCE_ROLES,
  FORMS,
  IDENTITY_DISCLOSURES,
  LINEAGE_ROLES,
  LINEAGE_RULES,
  METHOD_ASSET_FORMS,
  METHOD_ASSET_ORIGINS,
  PRACTICE_CAPABILITIES,
  PRACTICE_ROLE_DEFAULTS,
  RIGHTS_ROLES,
  STAGE_TREATMENTS,
  VERSION_LIFECYCLES,
  formLabel,
  isClosedApplication,
  lineageRolesForKind,
  roleAllowsKind,
} from "./catalog";

const enums = readFileSync(
  join(process.cwd(), "supabase/migrations/20261005000000_phase6_enums.sql"),
  "utf8",
);
const practice = readFileSync(
  join(process.cwd(), "supabase/migrations/20261005000100_practice_capabilities.sql"),
  "utf8",
);

function enumValues(file: string, type: string): string[] {
  const start = file.indexOf(`create type public.${type} as enum (`);
  expect(start, `enum ${type} is defined`).toBeGreaterThanOrEqual(0);
  const block = file.slice(start, file.indexOf(");", start));
  return [...block.matchAll(/'(\w+)'/g)].map((m) => m[1] as string);
}

describe("the Method Library vocabulary matches the migration", () => {
  it.each([
    ["method_asset_form", METHOD_ASSET_FORMS],
    ["method_asset_version_lifecycle", VERSION_LIFECYCLES],
    ["method_identity_disclosure", IDENTITY_DISCLOSURES],
    ["method_asset_origin", METHOD_ASSET_ORIGINS],
    ["method_rights_role", RIGHTS_ROLES],
    ["dam_release_status", DAM_RELEASE_STATUSES],
    ["method_application_state", APPLICATION_STATES],
    ["method_application_element_role", ELEMENT_ROLES],
    ["method_application_evidence_role", EVIDENCE_ROLES],
    ["method_stage_treatment", STAGE_TREATMENTS],
    ["method_lineage_role", LINEAGE_ROLES],
    ["practice_capability", PRACTICE_CAPABILITIES],
    ["acceptance_criterion_state", ACCEPTANCE_CRITERION_STATES],
  ])("%s", (type, values) => {
    expect([...values]).toEqual(enumValues(enums, type));
  });

  it("adds the approach statement kind", () => {
    expect(enums).toContain("alter type public.statement_kind add value 'approach';");
  });

  it("mirrors the practice capability role defaults", () => {
    const start = practice.indexOf("insert into public.practice_role_capability_defaults");
    const block = practice.slice(start, practice.indexOf(";", start));
    const fromSql = [...block.matchAll(/\('(\w+)',\s*'(\w+)'\)/g)].map(([, role, cap]) => [
      role,
      cap,
    ]);
    const fromTs = Object.entries(PRACTICE_ROLE_DEFAULTS).flatMap(([role, caps]) =>
      (caps ?? []).map((cap) => [role, cap]),
    );
    expect(fromTs.sort()).toEqual(fromSql.sort());
  });
});

describe("form behavior", () => {
  it("gives every form a distinct verb, so forms never degrade into labels", () => {
    const verbs = METHOD_ASSET_FORMS.map((f) => FORMS[f].verb);
    expect(new Set(verbs).size).toBe(METHOD_ASSET_FORMS.length);
  });

  it("gives each writable lineage role exactly one form, and never a Method or Instrument", () => {
    const forms = Object.values(LINEAGE_RULES).map((r) => r.form);
    expect(new Set(forms).size).toBe(forms.length);
    expect(forms).not.toContain("method");
    expect(forms).not.toContain("instrument");
  });

  it("offers lineage roles by element kind", () => {
    expect(lineageRolesForKind("object")).toEqual(["instantiates", "judged_against"]);
    expect(lineageRolesForKind("deliverable")).toEqual(["produced_from"]);
    expect(lineageRolesForKind("risk")).toEqual([]);
  });

  it("labels a legacy asset without inventing a form", () => {
    expect(formLabel(null)).toBe("Legacy");
    expect(formLabel("model")).toBe("Model");
  });
});

describe("Method Applications", () => {
  it("treats completed and discontinued as closed", () => {
    expect(APPLICATION_STATES.filter(isClosedApplication)).toEqual(["completed", "discontinued"]);
  });

  it("limits which kinds each link role may target", () => {
    expect(roleAllowsKind("examined", "review")).toBe(true);
    expect(roleAllowsKind("produced", "review")).toBe(false);
    expect(roleAllowsKind("informed", "object")).toBe(false);
  });
});
