import { describe, expect, it } from "vitest";
import { invokeArchitectureIntelligence } from "../gateway";
import { EVALUATION_CASES } from "./cases";
import { fakeDeps } from "./fixtures";
import { ENG, memoryStore } from "./memory-store";

describe("evaluation cases against the fake adapter (CI runner, proposal §19.3)", () => {
  for (const c of EVALUATION_CASES) {
    it(c.name, async () => {
      const store = memoryStore();
      c.setup?.(store);
      const deps = fakeDeps(store, c.steps);
      const result = await invokeArchitectureIntelligence(deps, {
        engagementId: ENG,
        kind: c.kind,
        subject: c.subject,
        mode: c.mode,
      });
      expect(result.outcome, result.reason).toBe(c.expect);
      expect(c.check?.(result, store)).toBeUndefined();
      // Exactly one audit record, whatever the outcome.
      expect(store.records).toHaveLength(1);
      expect(store.records[0]!.request.outcome).toBe(c.expect);
      // An inference only when persisted, or (7B.2) the exact output held
      // for keeping when returned on the application path (ADR-0069).
      expect(store.records[0]!.inference !== null).toBe(
        c.expect === "persisted" || (c.expect === "returned" && c.mode === "ephemeral"),
      );
      // Nothing but Tool Contract reads and the recording operation.
      expect(store.toolCalls.every((call) => call.fn.startsWith("ai_context_"))).toBe(true);
    });
  }
});
