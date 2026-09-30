import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EDGE_HOMES,
  EDGE_LENSES,
  EDGE_RULES,
  EDGE_SUBJECT_TYPES,
  EPISTEMIC_STATUSES,
  EXISTING_RULE_KEYS,
  LIST_TIERS,
  NEW_RULE_KEYS,
  RESOLVING_ACTS,
  TIME_BASES,
  TRIGGER_TYPES,
  edgeRule,
  edgeRuleLabel,
  resolvingActLabel,
} from "./rules";

const catalogSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261006000000_phase7a_edge_catalog.sql"),
  "utf8",
);

/** Rows of private.edge_rules() as the migration writes them. */
const sqlRows = [
  ...catalogSql.matchAll(
    /\('(\w+)', '([^']*)', '(new|existing)', '(\w+)', '(\w+)', '(\w+)', '(\w+)',\s*'(\w+)', '(\w+)', (true|false), '(\w+)', '(\w+)',/g,
  ),
].map((m) => ({
  key: m[1],
  candidate: m[2],
  origin: m[3],
  home: m[4],
  lens: m[5],
  epistemicStatus: m[6],
  subjectType: m[7],
  triggerType: m[8],
  timeBasis: m[9],
  substantiveOnly: m[10] === "true",
  listTier: m[11],
  resolvingAct: m[12],
}));

describe("Development Edge rule catalog", () => {
  it("has the 31 new rules and the 11 existing rules, with unique keys", () => {
    expect(NEW_RULE_KEYS).toHaveLength(31);
    expect(EXISTING_RULE_KEYS).toHaveLength(11);
    expect(new Set(EDGE_RULES.map((r) => r.key)).size).toBe(42);
  });

  it("agrees with private.edge_rules() field by field", () => {
    expect(sqlRows).toHaveLength(42);
    for (const row of sqlRows) {
      const rule = edgeRule(row.key);
      expect(rule, row.key).toBeDefined();
      expect({
        key: rule!.key,
        candidate: rule!.candidate,
        origin: rule!.origin,
        home: rule!.home,
        lens: rule!.lens,
        epistemicStatus: rule!.epistemicStatus,
        subjectType: rule!.subjectType,
        triggerType: rule!.triggerType,
        timeBasis: rule!.timeBasis,
        substantiveOnly: rule!.substantiveOnly,
        listTier: rule!.listTier,
        resolvingAct: rule!.resolvingAct,
      }).toEqual(row);
    }
  });

  it("uses only governed values for every attribute", () => {
    for (const rule of EDGE_RULES) {
      expect(EDGE_LENSES).toContain(rule.lens);
      expect(EPISTEMIC_STATUSES).toContain(rule.epistemicStatus);
      expect(EDGE_HOMES).toContain(rule.home);
      expect(EDGE_SUBJECT_TYPES).toContain(rule.subjectType);
      expect(TRIGGER_TYPES).toContain(rule.triggerType);
      expect(TIME_BASES).toContain(rule.timeBasis);
      expect(LIST_TIERS).toContain(rule.listTier);
      expect(Object.keys(RESOLVING_ACTS)).toContain(rule.resolvingAct);
    }
  });

  it("never produces the reserved 7B status or a confidence", () => {
    for (const rule of EDGE_RULES) {
      expect(rule.epistemicStatus).not.toBe("suggested");
      expect(JSON.stringify(rule).toLowerCase()).not.toContain("confidence");
    }
    expect(catalogSql).not.toContain("'suggested'");
  });

  it("gives every rule words a person reads, without alarm vocabulary", () => {
    for (const rule of EDGE_RULES) {
      expect(rule.label.length).toBeGreaterThan(3);
      expect(rule.definition.length).toBeGreaterThan(10);
      expect(rule.why.length).toBeGreaterThan(10);
      expect(rule.fingerprint.length).toBeGreaterThan(3);
      const words = `${rule.label} ${rule.definition} ${rule.why}`.toLowerCase();
      for (const banned of ["error", "violation", "health", "score"]) {
        expect(words, `${rule.key}: ${banned}`).not.toMatch(new RegExp(`\\b${banned}\\b`));
      }
    }
  });

  it("labels unknown keys and acts safely", () => {
    expect(edgeRuleLabel("no_such_rule")).toBe("no such rule");
    expect(resolvingActLabel("examine_reached")).toMatch(/\w/);
  });
});
