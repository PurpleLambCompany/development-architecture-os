import { describe, expect, it } from "vitest";
import { fake } from "./adapters/fake";
import { answer } from "./evaluation/answers";
import { fakeDeps } from "./evaluation/fixtures";
import { ENG, ids, memoryStore } from "./evaluation/memory-store";
import { invokeArchitectureIntelligence } from "./gateway";
import { FORBIDDEN_VOCABULARY, forbiddenTerm } from "./validation";

const input = {
  engagementId: ENG,
  kind: "explanation" as const,
  subject: { type: "impact_trace" as const, elementId: ids.cap },
  mode: "persist" as const,
};

describe("generation policy enforcement", () => {
  it.each([
    "This capability is validated.",
    "The decision was approved by the client.",
    "This is a critical risk.",
    "It should be a top priority.",
    "Confidence: 80%.",
    "I would rank this first.",
    "The score is high.",
    "We recommend the Delphi method.",
  ])("rejects %j with no repair call (OD-9)", async (assertion) => {
    const store = memoryStore();
    const deps = fakeDeps(store, [answer("explanation", { assertion }), answer("explanation")]);
    const result = await invokeArchitectureIntelligence(deps, input);
    expect(result.outcome).toBe("invalid_output");
    expect(deps.adapter.sent).toHaveLength(1); // no second, repairing call
    expect(store.records[0]!.inference).toBeNull();
  });

  it("allows ordinary architectural language", () => {
    expect(
      forbiddenTerm("The capability depends on the delegated authority recorded in CAP-004."),
    ).toBeNull();
    expect(FORBIDDEN_VOCABULARY.length).toBeGreaterThan(10);
  });

  it("rejects output that does not parse, with no retry", async () => {
    const store = memoryStore();
    const deps = fakeDeps(store, [() => fake.output(null), answer("explanation")]);
    expect((await invokeArchitectureIntelligence(deps, input)).outcome).toBe("invalid_output");
    expect(deps.adapter.sent).toHaveLength(1);
  });

  it("refuses an output from a resolved model that differs from the evaluated one (OD-8)", async () => {
    const store = memoryStore();
    const deps = fakeDeps(store, [answer("explanation", {}, "dsa-fake-model-1-2026-10")]);
    const result = await invokeArchitectureIntelligence(deps, input);
    expect(result.outcome).toBe("model_not_evaluated");
    expect(result.output).toBeUndefined();
    expect(store.records[0]!.request.resolved_model).toBe("dsa-fake-model-1-2026-10");
  });

  it("returns an unevaluated model's output only for an ephemeral evaluation run", async () => {
    const store = memoryStore();
    const deps = fakeDeps(store, [answer("explanation", {}, "candidate-model")]);
    const result = await invokeArchitectureIntelligence(deps, {
      ...input,
      mode: "ephemeral",
      evaluation: true,
    });
    expect(result.outcome).toBe("returned");
    expect(store.records[0]!.inference).toBeNull();
    const persisted = await invokeArchitectureIntelligence(
      fakeDeps(memoryStore(), [answer("explanation", {}, "candidate-model")]),
      {
        ...input,
        evaluation: true,
      },
    );
    expect(persisted.outcome).toBe("model_not_evaluated");
  });

  it("refuses an evaluation run outside synthetic_only", async () => {
    const store = memoryStore();
    const deps = fakeDeps(store, [answer("explanation")], () => "enabled");
    expect(
      (await invokeArchitectureIntelligence(deps, { ...input, evaluation: true })).outcome,
    ).toBe("refused_mode");
  });

  it("stops a model that keeps calling tools", async () => {
    const store = memoryStore();
    const call = () =>
      fake.toolCalls([{ name: "get_relationships", arguments: { reference_code: "CAP-004" } }]);
    const deps = fakeDeps(
      store,
      Array.from({ length: 12 }, () => call),
    );
    const result = await invokeArchitectureIntelligence(deps, input);
    expect(result.outcome).toBe("invalid_output");
    expect(store.toolCalls.filter((c) => c.fn === "ai_context_relationships")).toHaveLength(6);
  });
});
