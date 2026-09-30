import { describe, expect, it } from "vitest";
import {
  outputValue,
  parseCriteria,
  parseOutputs,
  parseSections,
  parseStages,
  stagesToText,
  toKey,
} from "./structure";

describe("structure keys", () => {
  it("derives database-safe keys from titles", () => {
    expect(toKey("Leadership interviews")).toBe("leadership_interviews");
    expect(toKey("3. Review — Evidence!")).toBe("item_3_review_evidence");
    expect(toKey("")).toBe("item");
    expect(toKey("a".repeat(60))).toHaveLength(40);
  });
});

describe("stages", () => {
  it("reads one stage per line with optional purpose and guidance", () => {
    expect(
      parseStages("Interview | Hear the leaders\n\n  Assess  \nInterview | Again | Note | more"),
    ).toEqual([
      { key: "interview", title: "Interview", purpose: "Hear the leaders", guidance: "" },
      { key: "assess", title: "Assess", purpose: "", guidance: "" },
      { key: "interview_2", title: "Interview", purpose: "Again", guidance: "Note | more" },
    ]);
  });

  it("round-trips through text", () => {
    const text = "Interview | Hear the leaders\nAssess";
    expect(stagesToText(parseStages(text))).toBe(text);
  });
});

describe("criteria and sections", () => {
  it("keys criteria from their first words", () => {
    expect(parseCriteria("Every claim cites a source | Check footnotes")).toEqual([
      {
        key: "every_claim_cites_a_source",
        statement: "Every claim cites a source",
        guidance: "Check footnotes",
      },
    ]);
  });

  it("reads section outlines", () => {
    expect(parseSections("Position\nEvidence | One page")).toEqual([
      { title: "Position", guidance: "" },
      { title: "Evidence", guidance: "One page" },
    ]);
  });
});

describe("expected outputs", () => {
  it("round-trips object, deliverable and record outputs", () => {
    const values = ["object:capability_gap", "deliverable:capability_map", "kind:risk"];
    const parsed = parseOutputs(values);
    expect(parsed).toEqual([
      { output_kind: "object", object_type_key: "capability_gap" },
      { output_kind: "deliverable", deliverable_type: "capability_map" },
      { output_kind: "risk" },
    ]);
    expect(
      parsed.map((o) =>
        outputValue({
          output_kind: o.output_kind,
          object_type_key: o.object_type_key ?? null,
          deliverable_type: o.deliverable_type ?? null,
        }),
      ),
    ).toEqual(values);
  });
});
