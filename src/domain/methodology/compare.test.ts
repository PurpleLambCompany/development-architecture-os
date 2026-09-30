import { describe, expect, it } from "vitest";
import { compareOutputs, diffRelease, type ReleaseMember } from "./compare";

const member = (assetId: string, versionId: string, label = "1.0"): ReleaseMember => ({
  assetId,
  assetTitle: assetId,
  versionId,
  versionLabel: label,
});

describe("release diff", () => {
  it("names added, re-versioned, removed and unchanged members", () => {
    const prior = [member("diagnostic", "d1"), member("scale", "s1"), member("guide", "g1")];
    const current = [
      member("diagnostic", "d1"),
      member("scale", "s2", "1.1"),
      member("template", "t1"),
    ];
    expect(
      diffRelease(prior, current).map((c) => [
        c.change,
        c.member.assetId,
        c.change === "re_versioned" ? c.priorVersionLabel : null,
      ]),
    ).toEqual([
      ["added", "template", null],
      ["re_versioned", "scale", "1.0"],
      ["removed", "guide", null],
      ["unchanged", "diagnostic", null],
    ]);
  });

  it("treats every member of a first release as added", () => {
    expect(diffRelease([], [member("a", "a1")]).map((c) => c.change)).toEqual(["added"]);
  });
});

describe("expected and actual outputs", () => {
  it("counts produced and revised elements against each expectation", () => {
    const { comparison, unexpected } = compareOutputs(
      [
        { outputKind: "object", objectTypeKey: "capability_gap", deliverableType: null },
        { outputKind: "recommendation", objectTypeKey: null, deliverableType: null },
        { outputKind: "deliverable", objectTypeKey: null, deliverableType: "capability_map" },
      ],
      [
        {
          role: "produced",
          kind: "object",
          objectTypeKey: "capability_gap",
          deliverableType: null,
        },
        { role: "revised", kind: "object", objectTypeKey: "capability_gap", deliverableType: null },
        { role: "examined", kind: "recommendation", objectTypeKey: null, deliverableType: null },
        {
          role: "produced",
          kind: "deliverable",
          objectTypeKey: null,
          deliverableType: "executive_summary",
        },
        { role: "produced", kind: "risk", objectTypeKey: null, deliverableType: null },
      ],
    );
    expect(comparison.map((c) => c.produced)).toEqual([2, 0, 0]);
    expect(unexpected.map((u) => u.kind)).toEqual(["deliverable", "risk"]);
  });

  it("matches any object type when the expectation names none", () => {
    const { comparison } = compareOutputs(
      [{ outputKind: "object", objectTypeKey: null, deliverableType: null }],
      [{ role: "produced", kind: "object", objectTypeKey: "metric", deliverableType: null }],
    );
    expect(comparison[0]!.produced).toBe(1);
  });
});
