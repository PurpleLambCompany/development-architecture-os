import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fake } from "./adapters/fake";
import { answer } from "./evaluation/answers";
import { fakeDeps } from "./evaluation/fixtures";
import { ENG, ids, memoryStore } from "./evaluation/memory-store";
import { invokeArchitectureIntelligence } from "./gateway";
import { TOOLS } from "./tools/registry";

const input = {
  engagementId: ENG,
  kind: "explanation" as const,
  subject: { type: "impact_trace" as const, elementId: ids.cap },
  mode: "persist" as const,
};
const dir = join(process.cwd(), "src/domain/architecture-intelligence");

function sources(path = dir): { file: string; text: string }[] {
  return readdirSync(path).flatMap((name) => {
    const full = join(path, name);
    // The experience module sits above the Gateway (it calls server.ts); the Gateway never imports it.
    if (statSync(full).isDirectory())
      return name === "experience" && path === dir ? [] : sources(full);
    // The page's own read models and its one authorization action are not reachable from the Gateway.
    if (path === dir && ["actions.ts", "queries.ts", "schemas.ts"].includes(name)) return [];
    return name.endsWith(".ts") && !name.endsWith(".test.ts")
      ? [{ file: full, text: readFileSync(full, "utf8") }]
      : [];
  });
}

describe("no path from a model to a mutation", () => {
  it.each([
    ["update_element", { reference_code: "CAP-004" }],
    ["record_architecture_intelligence_request", {}],
    ["publish_element_version", { reference_code: "CAP-004" }],
    ["get_review_context", { reference_code: "REV-001" }], // a real tool, but not in explanation's plan
    [
      "get_element",
      {
        reference_code: "CAP-004",
        state: "published",
        engagement_id: "e0000000-0000-4000-8000-000000000003",
      },
    ],
    ["get_element", { reference_code: "HBR-001", state: "published" }], // not in the data provided
    ["__proto__", {}],
  ])("refuses %s and calls nothing", async (name, args) => {
    const store = memoryStore();
    const deps = fakeDeps(store, [
      () => fake.toolCalls([{ name, arguments: args }]),
      answer("explanation"),
    ]);
    const result = await invokeArchitectureIntelligence(deps, input);
    expect(result.outcome).toBe("persisted");
    // Only the anchors were read.
    expect(store.toolCalls.map((c) => c.fn)).toEqual(["ai_context_impact", "ai_context_element"]);
    const turn = deps.adapter.sent[1]!.input.find((t) => t.type === "tool_result");
    expect(turn).toMatchObject({ refused: expect.any(String) });
    expect(store.records[0]!.request.tool_calls).toEqual([
      { name: name.slice(0, 100), refused: true },
    ]);
  });

  it("dispatches only through the registry, whose every entry is a Tool Contract function", () => {
    for (const tool of Object.values(TOOLS)) expect(tool.fn).toMatch(/^ai_context_[a-z_]+$/);
  });

  it("contains no table write and calls no database function outside the approved set", () => {
    const allowedRpc = new Set([
      "architecture_intelligence_standing",
      "architecture_intelligence_budget",
      // The one write, through the server-only recording path (ADR-0069).
      "record_architecture_intelligence_request_for",
    ]);
    for (const { file, text } of sources()) {
      expect(text, file).not.toMatch(/\.(insert|upsert|delete)\(/);
      expect(text, file).not.toMatch(/\.from\([^)]*\)[\s\S]{0,200}?\.update\(/);
      for (const [, name] of text.matchAll(/\.rpc\(\s*"([a-z_]+)"/g))
        expect(allowedRpc.has(name!), `${file}: ${name}`).toBe(true);
      for (const [, table] of text.matchAll(/\.from\(\s*"([a-z_]+)"/g))
        expect(table, file).toBe("architecture_elements");
    }
  });
});
