import { describe, expect, it } from "vitest";
import { fake } from "./adapters/fake";
import { answer } from "./evaluation/answers";
import { fakeDeps } from "./evaluation/fixtures";
import { ENG, ids, memoryStore, type MemoryStore } from "./evaluation/memory-store";
import { invokeArchitectureIntelligence } from "./gateway";
import type { ProcessingMode } from "./types";

const input = {
  engagementId: ENG,
  kind: "explanation" as const,
  subject: { type: "impact_trace" as const, elementId: ids.cap },
  mode: "persist" as const,
};
const toolCall = () =>
  fake.toolCalls([{ name: "get_relationships", arguments: { reference_code: "CAP-004" } }]);

/** Run with a tool call first, changing the world just after the first send (AC-14, proposal §23). */
async function changeAfterFirstSend(
  change: (store: MemoryStore) => void,
  mode?: { value: ProcessingMode },
) {
  const store = memoryStore();
  const deps = fakeDeps(
    store,
    [
      () => {
        change(store);
        return toolCall();
      },
      answer("explanation"),
    ],
    () => mode?.value ?? "synthetic_only",
  );
  const result = await invokeArchitectureIntelligence(deps, input);
  return { result, store, sent: deps.adapter.sent.length };
}

describe("authorization, capability or mode change during an invocation", () => {
  it("stops before the next send when the authorization is revoked", async () => {
    const { result, store, sent } = await changeAfterFirstSend((s) => {
      s.standingNow.authorizationState = "not_authorized";
      s.standingNow.authorizationId = "a0000000-0000-4000-8000-0000000000a2";
    });
    expect(result.outcome).toBe("authorization_withdrawn");
    expect(sent).toBe(1);
    expect(store.records).toHaveLength(1);
    expect(store.records[0]!.inference).toBeNull();
  });

  it("stops when the authorization is replaced by a new one, even if still authorized", async () => {
    const { result, sent } = await changeAfterFirstSend((s) => {
      s.standingNow.authorizationId = "a0000000-0000-4000-8000-0000000000a3";
    });
    expect(result.outcome).toBe("authorization_withdrawn");
    expect(sent).toBe(1);
  });

  it("stops when the requester's use capability is removed", async () => {
    const { result, sent } = await changeAfterFirstSend((s) => {
      s.standingNow.canUse = false;
    });
    expect(result.outcome).toBe("authorization_withdrawn");
    expect(sent).toBe(1);
  });

  it("stops when a required class is removed", async () => {
    const { result } = await changeAfterFirstSend((s) => {
      s.standingNow.dataClasses = ["evidence_metadata"];
    });
    expect(result.outcome).toBe("authorization_withdrawn");
  });

  it("stops when the mode is set to off", async () => {
    const mode = { value: "synthetic_only" as ProcessingMode };
    const { result, sent } = await changeAfterFirstSend(() => {
      mode.value = "off";
    }, mode);
    expect(result.outcome).toBe("authorization_withdrawn");
    expect(sent).toBe(1);
  });

  it("refuses to persist when the authorization changes between the last send and recording", async () => {
    const store = memoryStore();
    const deps = fakeDeps(store, [
      (request) => {
        const output = answer("explanation")(request, 0);
        store.standingNow.authorizationId = "a0000000-0000-4000-8000-0000000000a4";
        return output;
      },
    ]);
    const result = await invokeArchitectureIntelligence(deps, input);
    expect(result.outcome).toBe("authorization_withdrawn");
    expect(store.records.map((r) => r.inference)).toEqual([null]);
  });
});
