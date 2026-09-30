import { describe, expect, it } from "vitest";
import { buildGraph, buildTree, flattenTree, traceFrom } from "./graph";

const edge = (id: string, source: string, type: string, target: string, retired = false) => ({
  id,
  source_element_id: source,
  target_element_id: target,
  relationship_type: type,
  retired_at: retired ? "2026-09-30T00:00:00Z" : null,
});

describe("buildTree", () => {
  const items = ["area", "sub", "concept", "kind", "loose"].map((id) => ({ id }));
  const graph = buildGraph([
    edge("1", "sub", "part_of", "area"),
    edge("2", "concept", "part_of", "sub"),
    edge("3", "kind", "specializes", "concept"),
    edge("4", "loose", "part_of", "area", true),
  ]);

  it("nests children under their parents and ignores retired links", () => {
    const flat = flattenTree(buildTree(items, graph, ["part_of", "specializes"]));
    expect(flat.map((n) => [n.item.id, n.depth])).toEqual([
      ["area", 0],
      ["sub", 1],
      ["concept", 2],
      ["kind", 3],
      ["loose", 0],
    ]);
  });

  it("treats a parent outside the item set as no parent", () => {
    const flat = flattenTree(
      buildTree([{ id: "concept" }, { id: "kind" }], graph, ["specializes"]),
    );
    expect(flat.map((n) => n.item.id)).toEqual(["concept", "kind"]);
  });
});

describe("traceFrom", () => {
  it("follows relationships in both directions up to the depth", () => {
    const graph = buildGraph([
      edge("1", "knowledge", "informs", "capability"),
      edge("2", "capability", "implemented_through", "workflow"),
      edge("3", "workflow", "measured_by", "metric"),
    ]);
    expect([...traceFrom(graph, "capability", 1).keys()].sort()).toEqual(["knowledge", "workflow"]);
    expect(traceFrom(graph, "knowledge", 3).get("metric")).toBe(3);
  });
});
