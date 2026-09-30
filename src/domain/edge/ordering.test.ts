import { describe, expect, it } from "vitest";
import { edgeItem } from "./fixtures";
import { compareOrderKeys, describeOrderFacts, orderKeyOf, strongestOrderKey } from "./ordering";

function sorted(items: ReturnType<typeof edgeItem>[]) {
  return [...items]
    .sort((a, b) => compareOrderKeys(orderKeyOf(a), orderKeyOf(b)))
    .map((i) => i.subject_id);
}

describe("deterministic-first ordering", () => {
  it("orders by tier first", () => {
    expect(
      sorted([
        edgeItem({ rule_key: "r", subject_id: "ambient", tier: "ambient" }),
        edgeItem({ rule_key: "r", subject_id: "attention", tier: "attention" }),
        edgeItem({ rule_key: "r", subject_id: "flagged", tier: "human_flagged" }),
        edgeItem({ rule_key: "r", subject_id: "elevated", tier: "elevated" }),
      ]),
    ).toEqual(["flagged", "elevated", "attention", "ambient"]);
  });

  it("then nearest governance date, then reach class, then responsibility, then recency, then code", () => {
    expect(
      sorted([
        edgeItem({
          rule_key: "r",
          subject_id: "later-date",
          order_facts: { governance_date: "2026-10-20", reach_class: 1 },
        }),
        edgeItem({
          rule_key: "r",
          subject_id: "sooner-date",
          order_facts: { governance_date: "2026-10-10", reach_class: 4 },
        }),
        edgeItem({ rule_key: "r", subject_id: "no-date-reach1", order_facts: { reach_class: 1 } }),
        edgeItem({
          rule_key: "r",
          subject_id: "no-date-reach2-mine",
          order_facts: { reach_class: 2, responsible: true },
        }),
        edgeItem({
          rule_key: "r",
          subject_id: "no-date-reach2-new",
          trigger_at: "2026-10-12T00:00:00Z",
          order_facts: { reach_class: 2 },
        }),
        edgeItem({
          rule_key: "r",
          subject_id: "no-date-reach2-old",
          trigger_at: "2026-10-01T00:00:00Z",
          order_facts: { reach_class: 2 },
        }),
        edgeItem({
          rule_key: "r",
          subject_id: "b",
          subject_reference_code: "RSK-002",
          order_facts: { reach_class: 4 },
        }),
        edgeItem({
          rule_key: "r",
          subject_id: "a",
          subject_reference_code: "RSK-001",
          order_facts: { reach_class: 4 },
        }),
      ]),
    ).toEqual([
      "sooner-date",
      "later-date",
      "no-date-reach1",
      "no-date-reach2-mine",
      "no-date-reach2-new",
      "no-date-reach2-old",
      "a",
      "b",
    ]);
  });

  it("has no score: equal facts fall back to reference code and item key only", () => {
    const a = orderKeyOf(edgeItem({ rule_key: "r", subject_id: "x", item_key: "k1" }));
    const b = orderKeyOf(edgeItem({ rule_key: "r", subject_id: "x", item_key: "k2" }));
    expect(compareOrderKeys(a, b)).toBeLessThan(0);
    expect(Object.keys(a)).not.toContain("score");
  });

  it("takes each fact at its strongest for an event", () => {
    const k = strongestOrderKey([
      orderKeyOf(
        edgeItem({
          rule_key: "r",
          subject_id: "1",
          tier: "attention",
          order_facts: { governance_date: "2026-10-20", reach_class: 3 },
        }),
      ),
      orderKeyOf(
        edgeItem({
          rule_key: "r",
          subject_id: "2",
          tier: "elevated",
          order_facts: { reach_class: 1, responsible: true },
        }),
      ),
      orderKeyOf(
        edgeItem({
          rule_key: "r",
          subject_id: "3",
          trigger_at: "2026-10-12T00:00:00Z",
          order_facts: { governance_date: "2026-10-08" },
        }),
      ),
    ]);
    expect(k.tier).toBe("elevated");
    expect(k.governanceDate).toBe("2026-10-08");
    expect(k.reachClass).toBe(1);
    expect(k.responsible).toBe(true);
    expect(k.triggerAt).toBe("2026-10-12T00:00:00Z");
  });

  it("says why an item is placed where it is, in words", () => {
    expect(
      describeOrderFacts({
        governance_date: "2026-10-07",
        governance_kind: "review_scheduled",
        governance_reference_code: "REV-002",
        reach_class: 1,
        constrained_initiatives: 2,
        responsible: true,
      }),
    ).toEqual([
      "REV-002 is scheduled for October 7, 2026",
      "Reaches active implementation",
      "Constrains 2 initiatives",
      "You hold responsibility here",
    ]);
    expect(describeOrderFacts(null)).toEqual([]);
  });
});
