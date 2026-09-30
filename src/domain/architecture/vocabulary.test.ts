import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOMAIN_PREFIXES,
  PHASE_5_PREFIXES,
  PROVENANCE_CLIENT_LABELS,
  PROVENANCE_LABELS,
  PROVENANCE_TYPES,
  RECORD_PREFIXES,
} from "./catalog";
import {
  ATTRIBUTE_SCHEMA_VERSION,
  OBJECT_ATTRIBUTE_FIELDS,
  attributeSchema,
  attributesFromForm,
  attributesToForm,
  describeAttributes,
} from "./object-types";
import {
  RELATIONSHIP_RULES,
  allowedRelationshipTypes,
  elementClass,
  expandTokens,
  isAllowedPairing,
  type ObjectTypeKey,
} from "./rules";
import {
  OBJECT_TYPES,
  PHASE_4_RULE_SPEC,
  PHASE_5_RULE_SPEC,
  RELATIONSHIP_RULE_SPEC,
  RELATIONSHIP_TYPES,
} from "./vocabulary";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261001000100_architecture_core.sql"),
  "utf8",
);
const intelligenceMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261002000100_project_intelligence.sql"),
  "utf8",
);
const phase5Migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261003000100_reviews_deliverables_implementation.sql",
  ),
  "utf8",
);
const seed = readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8");

/** The rows of one `insert into <table> (...) values ...;` statement, as leading quoted fields. */
function insertedKeys(table: string, fields: number, sql = migration): string[][] {
  const start = sql.indexOf(`insert into public.${table} (`);
  const block = sql.slice(start, sql.indexOf(";\n", start));
  const pattern = new RegExp(`\\n  \\(${Array(fields).fill("'([^']*)'").join(", ")}`, "g");
  return [...block.matchAll(pattern)].map((m) => m.slice(1));
}

describe("the vocabulary matches the migration", () => {
  it("has the 27 core object types in the same domains and order", () => {
    expect(insertedKeys("architecture_object_types", 3)).toEqual(
      OBJECT_TYPES.map((t) => [t.key, t.domain, t.label]),
    );
    const perDomain = Object.groupBy(OBJECT_TYPES, (t) => t.domain);
    expect(perDomain.knowledge).toHaveLength(8);
    expect(perDomain.capability).toHaveLength(5);
    expect(perDomain.strategic_model).toHaveLength(5);
    expect(perDomain.application).toHaveLength(9);
  });

  it("has the 39 relationship types with the same labels, in sort order", () => {
    const phase3 = insertedKeys("relationship_types", 4);
    const phase4 = insertedKeys("relationship_types", 4, intelligenceMigration);
    const phase5 = insertedKeys("relationship_types", 4, phase5Migration);
    expect(phase4.map((t) => t[0])).toEqual(["advances", "pursues"]);
    expect(phase5.map((t) => t[0])).toEqual([
      "examines",
      "raises",
      "documents",
      "implements",
      "initiates",
      "validates",
    ]);
    // Phase 4 places advances and pursues before supersedes and conflicts_with;
    // Phase 5's six new types append after conflicts_with.
    const lineage = phase3.slice(-2);
    expect(lineage.map((t) => t[0])).toEqual(["supersedes", "conflicts_with"]);
    expect([...phase3.slice(0, -2), ...phase4, ...lineage, ...phase5]).toEqual(
      RELATIONSHIP_TYPES.map((t) => [t.key, t.category, t.label, t.inverseLabel]),
    );
    expect(RELATIONSHIP_TYPES.filter((t) => t.acyclic).map((t) => t.key)).toEqual([
      "part_of",
      "specializes",
      "precedes",
      "supersedes",
    ]);
    expect(RELATIONSHIP_TYPES.filter((t) => t.symmetric).map((t) => t.key)).toEqual([
      "conflicts_with",
    ]);
  });

  it("has the same pairing rule specification", () => {
    const calls = (sql: string) =>
      [
        ...sql.matchAll(
          /select pg_temp\.add_rules\('(\w+)', array\[([^\]]*)\], array\[([^\]]*)\]\);/g,
        ),
      ].map(([, type, sources, targets]) => [
        type,
        [...sources!.matchAll(/'([^']+)'/g)].map((m) => m[1]),
        [...targets!.matchAll(/'([^']+)'/g)].map((m) => m[1]),
      ]);
    const spec = (rules: typeof RELATIONSHIP_RULE_SPEC) =>
      rules.map(([t, s, g]) => [t, [...s], [...g]]);
    expect(calls(migration)).toEqual(spec(RELATIONSHIP_RULE_SPEC));
    // Phase 4 regenerates the Phase 3 rules that name every record kind, then
    // adds its own.
    const phase4 = calls(intelligenceMigration);
    const additions = spec(PHASE_4_RULE_SPEC);
    expect(phase4.slice(-additions.length)).toEqual(additions);
    for (const call of phase4.slice(0, -additions.length)) {
      expect(spec(RELATIONSHIP_RULE_SPEC)).toContainEqual(call);
    }
    // Phase 5 names its extended pairings and new types explicitly.
    expect(calls(phase5Migration)).toEqual(spec(PHASE_5_RULE_SPEC));
  });

  it("expands to the 2,608 rules the database holds", () => {
    expect(RELATIONSHIP_RULES).toHaveLength(2608);
    const counts = Object.fromEntries(
      Object.entries(Object.groupBy(RELATIONSHIP_RULES, (r) => r.relationshipType)).map(
        ([k, v]) => [k, v!.length],
      ),
    );
    expect(counts).toEqual({
      accountable_for: 12,
      addresses: 36,
      advances: 32,
      affects: 370,
      bounded_by: 26,
      conflicts_with: 1369,
      constrains: 33,
      delivered_through: 2,
      documented_by: 26,
      documents: 37,
      examines: 37,
      exploits: 11,
      gap_in: 3,
      governed_by: 16,
      has_stake_in: 36,
      holds: 2,
      implemented_through: 4,
      implements: 27,
      implies: 3,
      informs: 208,
      initiates: 2,
      introduces: 6,
      investigates: 4,
      measured_by: 10,
      mitigates: 17,
      part_of: 10,
      positioned_against: 4,
      precedes: 3,
      pursues: 16,
      raises: 8,
      requires: 23,
      serves: 18,
      shapes: 56,
      specializes: 1,
      subject_to: 36,
      supersedes: 34,
      threatens: 36,
      underpins: 33,
      validates: 1,
    });
  });

  it("uses the reference prefixes of public.element_reference_prefix", () => {
    // Phase 5's create-or-replace is the final, authoritative version.
    const fn = phase5Migration.slice(
      phase5Migration.indexOf("create or replace function public.element_reference_prefix"),
    );
    const body = fn.slice(0, fn.indexOf("$$;"));
    for (const [domain, prefix] of Object.entries(DOMAIN_PREFIXES)) {
      expect(body).toContain(`when '${domain}' then '${prefix}'`);
    }
    for (const [kind, prefix] of Object.entries(RECORD_PREFIXES)) {
      expect(body).toContain(`when '${kind}' then '${prefix}'`);
    }
    for (const [kind, prefix] of Object.entries(PHASE_5_PREFIXES)) {
      expect(body).toContain(`when '${kind}' then '${prefix}'`);
    }
  });
});

describe("pairing rules", () => {
  const obj = (t: ObjectTypeKey) => elementClass("object", t);
  const rec = (k: string) => elementClass(k, null);

  it("expands groups and exclusions", () => {
    expect(expandTokens(["@core", "-system_boundary"])).toHaveLength(26);
    expect(expandTokens(["@element", "-risk"])).toHaveLength(33);
    expect(expandTokens(["@record"]).map((c) => c.kind)).toEqual([
      "assumption",
      "risk",
      "constraint",
      "dependency",
      "decision",
      "recommendation",
      "opportunity",
    ]);
  });

  it("keeps the approved semantics", () => {
    // An Intended Outcome is measured by a Metric; a Metric does not serve itself.
    expect(isAllowedPairing("measured_by", obj("intended_outcome"), obj("metric"))).toBe(true);
    expect(isAllowedPairing("measured_by", obj("metric"), obj("metric"))).toBe(false);
    // An Intended Outcome does not serve another outcome.
    expect(isAllowedPairing("serves", obj("intended_outcome"), obj("intended_outcome"))).toBe(
      false,
    );
    // Application objects may require capabilities; knowledge does not require anything.
    expect(isAllowedPairing("requires", obj("metric"), obj("capability"))).toBe(true);
    expect(isAllowedPairing("requires", obj("concept"), obj("capability"))).toBe(false);
    // Risks threaten anything but another risk.
    expect(isAllowedPairing("threatens", rec("risk"), obj("capability"))).toBe(true);
    expect(isAllowedPairing("threatens", rec("risk"), rec("risk"))).toBe(false);
    // Supersedes: same kind and type only.
    expect(isAllowedPairing("supersedes", rec("decision"), rec("decision"))).toBe(true);
    expect(isAllowedPairing("supersedes", obj("concept"), obj("knowledge_area"))).toBe(false);
    // Opportunities advance what they would improve, never a risk or another opportunity;
    // capabilities, application objects, decisions and recommendations pursue them.
    expect(isAllowedPairing("advances", rec("opportunity"), obj("intended_outcome"))).toBe(true);
    expect(isAllowedPairing("advances", rec("opportunity"), rec("risk"))).toBe(false);
    expect(isAllowedPairing("advances", rec("opportunity"), rec("opportunity"))).toBe(false);
    expect(isAllowedPairing("pursues", obj("capability"), rec("opportunity"))).toBe(true);
    expect(isAllowedPairing("pursues", obj("concept"), rec("opportunity"))).toBe(false);
    expect(isAllowedPairing("underpins", rec("assumption"), rec("opportunity"))).toBe(true);
    expect(isAllowedPairing("threatens", rec("risk"), rec("opportunity"))).toBe(true);
  });

  it("never offers supersedes or validates to editors", () => {
    expect(allowedRelationshipTypes(rec("decision"), rec("decision"))).not.toContain("supersedes");
    expect(allowedRelationshipTypes(rec("review"), rec("implementation_initiative"))).not.toContain(
      "validates",
    );
    expect(allowedRelationshipTypes(obj("capability"), obj("capability"))).toEqual([
      "part_of",
      "requires",
      "conflicts_with",
    ]);
  });

  it("holds the Phase 5 pairings (§4.2)", () => {
    // examines: Review -> any element or Project Intelligence record.
    expect(isAllowedPairing("examines", rec("review"), obj("capability"))).toBe(true);
    expect(isAllowedPairing("examines", rec("review"), rec("risk"))).toBe(true);
    expect(isAllowedPairing("examines", rec("review"), rec("implementation_initiative"))).toBe(true);
    expect(isAllowedPairing("examines", rec("deliverable"), obj("capability"))).toBe(false);
    // raises: Review -> a new judgment record or an implementation initiative.
    expect(isAllowedPairing("raises", rec("review"), rec("risk"))).toBe(true);
    expect(isAllowedPairing("raises", rec("review"), rec("implementation_initiative"))).toBe(true);
    expect(isAllowedPairing("raises", rec("review"), obj("capability"))).toBe(false);
    // documents: Deliverable -> any element.
    expect(isAllowedPairing("documents", rec("deliverable"), obj("capability"))).toBe(true);
    expect(isAllowedPairing("documents", rec("review"), obj("capability"))).toBe(false);
    // implements: Implementation Initiative -> core object only.
    expect(isAllowedPairing("implements", rec("implementation_initiative"), obj("capability"))).toBe(
      true,
    );
    expect(isAllowedPairing("implements", rec("implementation_initiative"), rec("risk"))).toBe(false);
    // initiates: Decision or Recommendation -> Implementation Initiative.
    expect(isAllowedPairing("initiates", rec("decision"), rec("implementation_initiative"))).toBe(
      true,
    );
    expect(isAllowedPairing("initiates", rec("risk"), rec("implementation_initiative"))).toBe(false);
    // validates: Review -> Implementation Initiative (pairing exists even though it is restricted-write).
    expect(isAllowedPairing("validates", rec("review"), rec("implementation_initiative"))).toBe(true);
    expect(isAllowedPairing("validates", rec("deliverable"), rec("implementation_initiative"))).toBe(
      false,
    );
    // Existing pairings extend to the three new kinds.
    expect(isAllowedPairing("threatens", rec("risk"), rec("implementation_initiative"))).toBe(true);
    expect(isAllowedPairing("underpins", rec("assumption"), rec("deliverable"))).toBe(true);
    expect(isAllowedPairing("part_of", rec("implementation_initiative"), rec("implementation_initiative"))).toBe(
      true,
    );
  });
});

describe("provenance labels", () => {
  it("label every provenance type for staff and for clients", () => {
    for (const p of PROVENANCE_TYPES) {
      expect(PROVENANCE_LABELS[p]).toBeTruthy();
      expect(PROVENANCE_CLIENT_LABELS[p]).toBeTruthy();
    }
    expect(PROVENANCE_CLIENT_LABELS.system_derived).toBe("Calculated");
    expect(PROVENANCE_CLIENT_LABELS.ai_analysis).toBe("AI-assisted analysis (reviewed)");
  });
});

describe("object attributes", () => {
  it("defines fields for every object type", () => {
    expect(Object.keys(OBJECT_ATTRIBUTE_FIELDS).sort()).toEqual(
      OBJECT_TYPES.map((t) => t.key).sort(),
    );
  });

  it("accept every seeded object's attributes", () => {
    const calls = [
      ...seed.matchAll(/select pg_temp\.obj\('[^']+', '(\w+)',[\s\S]*?'(\{[^\n]*\})'/g),
    ];
    expect(calls.length).toBeGreaterThanOrEqual(30);
    for (const [, type, json] of calls) {
      const attributes = {
        schema_version: ATTRIBUTE_SCHEMA_VERSION,
        ...JSON.parse(json!.replaceAll("''", "'")),
      };
      const result = attributeSchema(type as ObjectTypeKey).safeParse(attributes);
      expect(result.success, `${type}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it("refuse unknown keys and values outside a field's options", () => {
    expect(
      attributeSchema("capability").safeParse({ schema_version: 1, readiness: "high" }).success,
    ).toBe(false);
    expect(
      attributeSchema("capability").safeParse({ schema_version: 1, tier: "primary" }).success,
    ).toBe(false);
    expect(attributeSchema("capability").safeParse({ tier: "core" }).success).toBe(false);
  });

  it("round-trip through form values", () => {
    const form = {
      attr_tier: "core",
      attr_leadership_capability: "yes",
      attr_current_readiness: "",
      attr_ownership_model: "shared",
    };
    const parsed = attributesFromForm("capability", form);
    expect(parsed).toEqual({
      success: true,
      data: {
        schema_version: 1,
        tier: "core",
        leadership_capability: true,
        ownership_model: "shared",
      },
    });
    if (!parsed.success) return;
    expect(attributesToForm("capability", parsed.data)).toEqual({
      attr_tier: "core",
      attr_leadership_capability: "yes",
      attr_ownership_model: "shared",
    });
    expect(describeAttributes("capability", parsed.data).map((r) => r.value)).toEqual([
      "Core",
      "Yes",
      "Shared",
    ]);
  });

  it("report field errors against the form field", () => {
    expect(attributesFromForm("talent_stage", { attr_sequence: "two" })).toEqual({
      success: false,
      errors: { attr_sequence: "Enter a whole number" },
    });
    const bad = attributesFromForm("capability", { attr_tier: "primary" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(Object.keys(bad.errors)).toEqual(["attr_tier"]);
  });
});
