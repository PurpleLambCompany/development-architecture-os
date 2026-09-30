import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { edgeItem } from "./fixtures";
import {
  PROMOTION_TARGET_KINDS,
  criterionPromotionFor,
  promotionFromQuery,
  promotionHref,
  promotionTargetsFor,
} from "./promotion";

const onImp = edgeItem({
  rule_key: "implemented_element_revised",
  subject_type: "element",
  subject_id: "imp-003",
  subject_kind: "implementation_initiative",
  fingerprint: "rev:app:v3",
});

describe("promotion targets", () => {
  it("is the closed vocabulary the database enforces", () => {
    const sql = readFileSync("supabase/migrations/20261006000700_edge_judgments.sql", "utf8");
    const check = sql.match(
      /promotion_target_kind\s+text check \(promotion_target_kind in \(([^)]*)\)\)/,
    );
    expect(check?.[1].match(/'([a-z_]+)'/g)?.map((k) => k.replaceAll("'", ""))).toEqual([
      ...PROMOTION_TARGET_KINDS,
    ]);
  });

  it("offers a criterion only where the subject can carry criteria", () => {
    expect(promotionTargetsFor(onImp)).toEqual([
      "risk",
      "decision",
      "review",
      "acceptance_criterion",
    ]);
    expect(promotionTargetsFor({ ...onImp, subject_kind: "object" })).toContain(
      "acceptance_criterion",
    );
    expect(promotionTargetsFor({ ...onImp, subject_kind: "decision" })).toEqual([
      "risk",
      "decision",
      "review",
    ]);
    expect(promotionTargetsFor({ ...onImp, subject_type: "client_action" })).toEqual([
      "risk",
      "decision",
      "review",
    ]);
  });

  it("offers nothing for engagement, application or criterion subjects", () => {
    for (const subject_type of ["engagement", "method_application", "acceptance_criterion"])
      expect(promotionTargetsFor({ ...onImp, subject_type })).toEqual([]);
  });
});

describe("promotion links", () => {
  it("opens the governed form each target uses, carrying the item", () => {
    const q =
      "promoteRule=implemented_element_revised&promoteType=element&promoteId=imp-003&promoteFp=rev%3Aapp%3Av3";
    expect(promotionHref("harbor", onImp, "acceptance_criterion")).toBe(
      `/internal/engagements/harbor/implementation/imp-003?${q}#criteria`,
    );
    expect(
      promotionHref("harbor", { ...onImp, subject_kind: "object" }, "acceptance_criterion"),
    ).toBe(`/internal/engagements/harbor/architecture/elements/imp-003?${q}#criteria`);
    expect(promotionHref("harbor", onImp, "review")).toBe(
      `/internal/engagements/harbor/reviews?${q}`,
    );
    expect(promotionHref("harbor", onImp, "risk")).toBe(
      `/internal/engagements/harbor/intelligence?new=risk&${q}`,
    );
  });

  it("reads the item back from the query, and only when it is complete", () => {
    expect(
      promotionFromQuery({
        promoteRule: "r",
        promoteType: "element",
        promoteId: "id",
        promoteFp: "fp",
      }),
    ).toEqual({ ruleKey: "r", subjectType: "element", subjectId: "id", fingerprint: "fp" });
    expect(promotionFromQuery({ promoteRule: "r", promoteType: "element", promoteId: "id" })).toBe(
      null,
    );
    expect(
      promotionFromQuery({
        promoteRule: ["r"],
        promoteType: "element",
        promoteId: "id",
        promoteFp: "fp",
      }),
    ).toBe(null);
  });
});

describe("criterion promotion on a page", () => {
  const context = {
    engagementId: "eng",
    slug: "harbor",
    elementId: "imp-003",
    elementKind: "implementation_initiative" as const,
  };
  const query = {
    promoteRule: "implemented_element_revised",
    promoteType: "element",
    promoteId: "imp-003",
    promoteFp: "rev:app:v3",
  };

  it("prefills from the current item on this element", () => {
    const promotion = criterionPromotionFor(query, [onImp], context);
    expect(promotion?.item).toEqual({
      ruleKey: "implemented_element_revised",
      subjectType: "element",
      subjectId: "imp-003",
      fingerprint: "rev:app:v3",
    });
    expect(promotion?.itemLine).toBeTruthy();
  });

  it("offers nothing for a stale, judged or foreign item", () => {
    expect(criterionPromotionFor({ ...query, promoteFp: "old" }, [onImp], context)).toBe(null);
    expect(criterionPromotionFor(query, [{ ...onImp, judged: true }], context)).toBe(null);
    expect(criterionPromotionFor(query, [onImp], { ...context, elementId: "imp-001" })).toBe(null);
    expect(criterionPromotionFor(query, [{ ...onImp, subject_kind: "decision" }], context)).toBe(
      null,
    );
  });
});
