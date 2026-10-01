import { describe, expect, it } from "vitest";
import { answer } from "./evaluation/answers";
import { fakeDeps } from "./evaluation/fixtures";
import { ENG, ids, memoryStore } from "./evaluation/memory-store";
import { invokeArchitectureIntelligence } from "./gateway";

const input = {
  engagementId: ENG,
  kind: "explanation" as const,
  subject: { type: "impact_trace" as const, elementId: ids.cap },
  mode: "persist" as const,
};

async function run(overrides: Record<string, unknown>) {
  const store = memoryStore();
  const result = await invokeArchitectureIntelligence(
    fakeDeps(store, [answer("explanation", overrides)]),
    input,
  );
  return { result, store };
}

describe("citations (AC-13)", () => {
  it("rejects a handle that was never issued", async () => {
    const { result, store } = await run({ claims: [{ text: "It follows.", cites: ["R9"] }] });
    expect(result.outcome).toBe("unknown_citation");
    expect(store.records[0]!.inference).toBeNull();
  });

  it("rejects a handle from another invocation or a reference code, which are not handles", async () => {
    for (const cites of [["R1", "R40"], ["CAP-004"], ["e0000000-0000-4000-8000-000000000003"]]) {
      const { result } = await run({ claims: [{ text: "It follows.", cites }] });
      expect(["unknown_citation", "invalid_output"]).toContain(result.outcome);
    }
  });

  it("rejects a claim without citations", async () => {
    const { result } = await run({ claims: [{ text: "It follows.", cites: [] }] });
    expect(result.outcome).toBe("invalid_output");
  });

  it("rejects an unissued handle in the payload", async () => {
    const { result } = await run({ payload: { condition_ref: "R77", connection: "x" } });
    expect(result.outcome).toBe("unknown_citation");
  });

  it("accepts a part of an issued record (R1.statements)", async () => {
    const { result } = await run({
      claims: [{ text: "Its statement bears on it.", cites: ["R1.statements"] }],
    });
    expect(result.outcome).toBe("persisted");
  });
});
