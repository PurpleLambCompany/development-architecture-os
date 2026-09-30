import { describe, expect, it } from "vitest";
import { edgeItem } from "./fixtures";
import { eventHeading, eventsForList, groupEdgeItems } from "./grouping";

const APP = "app-001";
const REV_KEY = `rev:${APP}:v3`;
const revised = {
  trigger_type: "substantive_revision",
  trigger_subject_id: APP,
  trigger_reference_code: "APP-001",
  trigger_title: "Regional Expansion Council",
  trigger_version_no: 3,
  trigger_at: "2026-10-14T10:00:00Z",
  trigger_key: REV_KEY,
};

function reach(subject: string, code: string, extra: Record<string, unknown> = {}) {
  return edgeItem({
    ...revised,
    rule_key: "change_reaches",
    subject_id: subject,
    subject_reference_code: code,
    consequence_path: [
      { to_id: subject, link_key: "implements", direction: "target_to_source", terminal: true },
    ],
    details: {
      trigger_element_id: APP,
      hub_element_id: APP,
      change_summary: "Membership extended.",
      ...extra,
    },
  });
}

describe("groupEdgeItems", () => {
  it("shows one triggering change as one event, with every item kept", () => {
    const items = [
      reach("imp-1", "IMP-001"),
      reach("imp-3", "IMP-003"),
      reach("acr-1", "ACR-001"),
      edgeItem({
        ...revised,
        rule_key: "implemented_element_revised",
        subject_id: "imp-1",
        subject_reference_code: "IMP-001",
      }),
      edgeItem({
        ...revised,
        rule_key: "examined_element_revised_since_review",
        subject_id: "rev-1",
        subject_reference_code: "REV-001",
      }),
    ];
    const events = groupEdgeItems(items);
    expect(events).toHaveLength(1);
    expect(events[0].items).toHaveLength(5);
    expect(eventHeading(events[0])).toBe("APP-001 Regional Expansion Council was revised");
    expect(events[0].changeSummary).toBe("Membership extended.");
  });

  it("merges a rule item and a matrix consequence on the same record into one line", () => {
    const events = groupEdgeItems([
      reach("imp-1", "IMP-001"),
      edgeItem({
        ...revised,
        rule_key: "implemented_element_revised",
        subject_id: "imp-1",
        subject_reference_code: "IMP-001",
      }),
    ]);
    const lines = events[0].consequences;
    expect(lines).toHaveLength(1);
    expect(lines[0].primary.rule_key).toBe("implemented_element_revised");
    expect(lines[0].items).toHaveLength(2);
    expect(lines[0].matrixPaths).toHaveLength(1);
  });

  it("keeps different triggers apart even when they reach the same record", () => {
    const events = groupEdgeItems([
      reach("imp-2", "IMP-002"),
      edgeItem({
        rule_key: "change_reaches",
        subject_id: "imp-2",
        trigger_type: "substantive_revision",
        trigger_subject_id: "cap-1",
        trigger_reference_code: "CAP-001",
        trigger_key: "rev:cap-1:v2",
      }),
    ]);
    expect(events).toHaveLength(2);
    expect(new Set(events.map((e) => e.key))).toEqual(new Set([REV_KEY, "rev:cap-1:v2"]));
  });

  it("groups standing conditions on one subject into one event", () => {
    const state = {
      trigger_type: "state",
      trigger_key: "state:imp-1",
      subject_reference_code: "IMP-001",
      subject_title: "Stand-up",
    };
    const events = groupEdgeItems([
      edgeItem({ ...state, rule_key: "realization_without_evidence", subject_id: "imp-1" }),
      edgeItem({ ...state, rule_key: "criterion_without_validation", subject_id: "imp-1" }),
    ]);
    expect(events).toHaveLength(1);
    expect(eventHeading(events[0])).toBe("Conditions on IMP-001 Stand-up");
  });

  it("collapses consequences reached through a hub other than the trigger", () => {
    const viaHub = { hub_element_id: "out-1" };
    const events = groupEdgeItems([
      reach("a", "CAP-002", viaHub),
      reach("b", "CAP-003", viaHub),
      reach("c", "CAP-004", viaHub),
      reach("d", "IMP-001"),
      edgeItem({
        rule_key: "x",
        subject_id: "out-1",
        subject_reference_code: "OUT-001",
        trigger_key: "state:out-1",
      }),
    ]);
    const event = events.find((e) => e.key === REV_KEY)!;
    expect(event.hubs).toHaveLength(1);
    expect(event.hubs[0].hubElementId).toBe("out-1");
    expect(event.hubs[0].consequences).toHaveLength(3);
    expect(event.consequences.map((c) => c.referenceCode)).toEqual(["IMP-001"]);
  });

  it("does not collapse when the hub is the trigger itself or holds only one line", () => {
    const events = groupEdgeItems([
      reach("a", "IMP-001"),
      reach("b", "IMP-003"),
      reach("c", "CAP-002", { hub_element_id: "out-1" }),
    ]);
    expect(events[0].hubs).toHaveLength(0);
    expect(events[0].consequences).toHaveLength(3);
  });

  it("takes the event tier from its highest item and orders events by it", () => {
    const events = groupEdgeItems([
      edgeItem({ rule_key: "a", subject_id: "s1", trigger_key: "state:s1", tier: "attention" }),
      edgeItem({ rule_key: "b", subject_id: "s2", trigger_key: "state:s2", tier: "ambient" }),
      reach("imp-1", "IMP-001"),
      { ...reach("imp-3", "IMP-003"), tier: "human_flagged", tier_reason: "open_escalation" },
    ]);
    expect(events.map((e) => e.tier)).toEqual(["human_flagged", "attention", "ambient"]);
    expect(eventsForList(events).map((e) => e.tier)).toEqual(["human_flagged", "attention"]);
  });

  it("names engagement-level conditions by their rule", () => {
    const events = groupEdgeItems([
      edgeItem({
        rule_key: "method_basis_superseded",
        subject_type: "engagement",
        subject_id: "eng",
        trigger_key: "state:eng",
        trigger_type: "state",
      }),
    ]);
    expect(eventHeading(events[0])).toBe("Method basis has moved");
  });

  it("is deterministic for any input order", () => {
    const items = [
      reach("a", "IMP-001"),
      reach("b", "IMP-003"),
      edgeItem({ rule_key: "a", subject_id: "s1" }),
    ];
    const one = groupEdgeItems(items).map((e) => [e.key, e.consequences.map((c) => c.key)]);
    const two = groupEdgeItems([...items].reverse()).map((e) => [
      e.key,
      e.consequences.map((c) => c.key),
    ]);
    expect(two).toEqual(one);
  });
});
