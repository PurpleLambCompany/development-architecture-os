import { describe, expect, it } from "vitest";
import {
  approvalResponseSchema,
  dependencyFields,
  evidenceSourceSchema,
  objectSchema,
  recordSchema,
  relationshipSchema,
  riskFields,
} from "./schemas";

const object = {
  title: "Commercial Acquisition",
  summary: "",
  provenance: "architect_judgment",
  sourceReference: "",
  ipClassification: "project_work_product",
  clientVisibility: "client",
  objectType: "capability",
  maturity: "undefined",
  maturityRationale: "",
};

describe("object schema", () => {
  it("accepts a minimal object", () => {
    expect(objectSchema.safeParse(object).success).toBe(true);
  });

  it("requires a rationale for any maturity above Undefined", () => {
    const result = objectSchema.safeParse({ ...object, maturity: "defined" });
    expect(result.error?.issues[0]?.path).toEqual(["maturityRationale"]);
  });

  it("never lets Method IP be client-visible", () => {
    const result = objectSchema.safeParse({ ...object, ipClassification: "tplco_method_ip" });
    expect(result.error?.issues[0]?.path).toEqual(["clientVisibility"]);
  });

  it("offers no operation-only provenance", () => {
    for (const provenance of ["client_decision", "system_derived", "ai_analysis"]) {
      expect(objectSchema.safeParse({ ...object, provenance }).success).toBe(false);
    }
  });

  it("refuses unknown object types", () => {
    expect(objectSchema.safeParse({ ...object, objectType: "initiative" }).success).toBe(false);
  });
});

describe("record schemas", () => {
  it("read domains from a checkbox group, whether one or several", () => {
    const base = { ...object, engagementWide: "no" };
    expect(recordSchema.parse({ ...base, domains: "capability" }).domains).toEqual(["capability"]);
    expect(recordSchema.parse({ ...base, domains: ["knowledge", "application"] }).domains).toEqual([
      "knowledge",
      "application",
    ]);
    expect(recordSchema.parse({ ...base, domains: false }).domains).toEqual([]);
    expect(recordSchema.parse({ ...base, engagementWide: "yes" }).engagementWide).toBe(true);
  });

  it("rate risks from 1 to 5", () => {
    const risk = { category: "", mitigation: "", riskStatus: "open" };
    expect(riskFields.safeParse({ ...risk, probability: "5", impact: "1" }).success).toBe(true);
    expect(riskFields.safeParse({ ...risk, probability: "6", impact: "1" }).success).toBe(false);
  });

  it("keep a dependency's two ends distinct", () => {
    const id = "b3000000-0000-4000-8000-000000000401";
    const result = dependencyFields.safeParse({
      fromElementId: id,
      toElementId: id,
      dependencyType: "prerequisite",
      dependencyStatus: "open",
    });
    expect(result.error?.issues[0]?.path).toEqual(["toElementId"]);
  });
});

describe("relationship schema", () => {
  const rel = {
    targetElementId: "b3000000-0000-4000-8000-000000000202",
    relationshipType: "requires",
    description: "",
    clientVisibility: "client",
  };

  it("never lets an editor write supersedes", () => {
    expect(relationshipSchema.safeParse({ ...rel, relationshipType: "supersedes" }).success).toBe(
      false,
    );
  });

  it("allows a proficiency only on requires", () => {
    expect(
      relationshipSchema.parse({ ...rel, requiredProficiency: "expert" }).requiredProficiency,
    ).toBe("expert");
    expect(
      relationshipSchema.safeParse({
        ...rel,
        relationshipType: "informs",
        requiredProficiency: "expert",
      }).success,
    ).toBe(false);
  });
});

describe("approvals and evidence", () => {
  it("require a comment when changes are requested", () => {
    expect(approvalResponseSchema.safeParse({ response: "approved", comment: "" }).success).toBe(
      true,
    );
    expect(
      approvalResponseSchema.safeParse({ response: "changes_requested", comment: "" }).success,
    ).toBe(false);
  });

  it("accept only https evidence links", () => {
    const source = {
      title: "Market report",
      sourceType: "publication",
      provenance: "public_source",
      reference: "",
      publisherAuthor: "",
      sourceDate: "",
      accessedDate: "",
      externalReference: "",
      summary: "",
      notes: "",
      ipClassification: "public_source",
      clientVisibility: "client",
    };
    expect(
      evidenceSourceSchema.safeParse({ ...source, url: "https://example.org/r" }).success,
    ).toBe(true);
    expect(evidenceSourceSchema.safeParse({ ...source, url: "http://example.org/r" }).success).toBe(
      false,
    );
  });
});
