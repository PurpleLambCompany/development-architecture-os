import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RELATIONSHIP_TYPES } from "@/domain/architecture/vocabulary";
import {
  IMPACT_DIRECTIONS,
  IMPACT_MATRIX,
  IMPACT_MAX_DEPTH,
  INVALIDATED_UNDERPINS_CONDITION,
  OFF_SPINE_LINK_KEYS,
  RECURSIVE_WALKS,
  impactRule,
  isEdgeEligible,
} from "./impact-matrix";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261006000000_phase7a_edge_catalog.sql"),
  "utf8",
);
const traceSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261006000400_impact_trace.sql"),
  "utf8",
);

const sqlRows = [
  ...sql.matchAll(
    /\('(\w+)', '(source_to_target|target_to_source)', '(yes|weak|no)', '(\w+)', (\d), (true|false), (null|'\w+'),\s*'((?:[^']|'')*)'\)/g,
  ),
].map((m) => ({
  linkKey: m[1],
  direction: m[2],
  assessment: m[3],
  propagation: m[4],
  maxDepth: Number(m[5]),
  hubTarget: m[6] === "true",
  condition: m[7] === "null" ? null : m[7].slice(1, -1),
  reason: m[8].replaceAll("''", "'"),
}));

describe("relationship-impact direction matrix", () => {
  it("covers all 39 relationship types and every off-spine link in both directions", () => {
    const keys = [...RELATIONSHIP_TYPES.map((t) => t.key), ...OFF_SPINE_LINK_KEYS];
    expect(RELATIONSHIP_TYPES).toHaveLength(39);
    expect(IMPACT_MATRIX).toHaveLength(keys.length * 2);
    for (const key of keys) {
      for (const direction of IMPACT_DIRECTIONS) {
        expect(impactRule(key, direction), `${key} ${direction}`).toBeDefined();
      }
    }
  });

  it("agrees row by row with public.relationship_impact_rules", () => {
    expect(sqlRows).toHaveLength(IMPACT_MATRIX.length);
    for (const row of sqlRows) {
      const rule = impactRule(row.linkKey, row.direction as (typeof IMPACT_DIRECTIONS)[number]);
      expect(rule, `${row.linkKey} ${row.direction}`).toEqual(row);
    }
  });

  it("recurses only on the three governed walks, to depth two", () => {
    const recursive = IMPACT_MATRIX.filter((r) => r.propagation === "recursive").map((r) => [
      r.linkKey,
      r.direction,
    ]);
    expect(recursive).toEqual(RECURSIVE_WALKS.map((w) => [...w]));
    expect(IMPACT_MAX_DEPTH).toBe(2);
    for (const rule of IMPACT_MATRIX) {
      expect(rule.maxDepth).toBe(
        rule.propagation === "never" ? 0 : rule.propagation === "recursive" ? 2 : 1,
      );
    }
  });

  it("recurses underpins only from an invalidated assumption", () => {
    const conditioned = IMPACT_MATRIX.filter(
      (r) => r.condition === INVALIDATED_UNDERPINS_CONDITION,
    );
    expect(conditioned.map((r) => r.linkKey)).toEqual(["underpins"]);
    expect(conditioned[0].propagation).not.toBe("recursive");
  });

  it("is not bidirectional by default: only conflicts_with answers the same both ways among Yes links", () => {
    const symmetricYes = RELATIONSHIP_TYPES.map((t) => t.key).filter(
      (k) =>
        impactRule(k, "source_to_target")!.assessment === "yes" &&
        impactRule(k, "target_to_source")!.assessment === "yes",
    );
    expect(symmetricYes).toContain("conflicts_with");
    expect(symmetricYes.length).toBeLessThan(RELATIONSHIP_TYPES.length / 2);
  });

  it("feeds the Edge only from Yes links that propagate", () => {
    for (const rule of IMPACT_MATRIX) {
      expect(isEdgeEligible(rule)).toBe(rule.assessment === "yes" && rule.propagation !== "never");
      if (rule.assessment === "no") expect(rule.propagation).toBe("never");
    }
  });

  it("explains every row", () => {
    for (const rule of IMPACT_MATRIX) expect(rule.reason.length).toBeGreaterThan(10);
  });

  it("keeps the legacy traces documented as legacy and never walks generically", () => {
    expect(traceSql).toMatch(
      /comment on function public\.intelligence_impact\(uuid, int\)[\s\S]*?[Ll]egacy/,
    );
    expect(traceSql).toMatch(
      /comment on function public\.implementation_impact\(uuid, int\)[\s\S]*?[Ll]egacy/,
    );
    expect(traceSql).toContain("relationship_impact_rules");
  });
});
