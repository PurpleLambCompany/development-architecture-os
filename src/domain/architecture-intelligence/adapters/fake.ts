import type { ModelAdapter, NormalizedModelRequest, NormalizedModelResponse, Usage } from "./types";

/**
 * A deterministic, scripted adapter (proposal §11.3). CI and the pipeline
 * evaluation use it; it never touches a network and needs no credential.
 * Each step sees the request about to be sent, so a script can answer from
 * the handles actually issued, or change the world mid-invocation.
 */

export const FAKE_PROVIDER_KEY = "fake";
export const FAKE_MODEL = "dsa-fake-model-1";

export type FakeStep = (
  request: NormalizedModelRequest,
  turn: number,
) => NormalizedModelResponse | Promise<NormalizedModelResponse>;

const usage: Usage = { inputTokens: 1000, outputTokens: 200, reasoningTokens: 0 };

export const fake = {
  output: (json: unknown, resolvedModel = FAKE_MODEL): NormalizedModelResponse => ({
    kind: "output",
    json,
    usage,
    resolvedModel,
    providerRequestId: "fake-request",
  }),
  toolCalls: (calls: { name: string; arguments: unknown }[]): NormalizedModelResponse => ({
    kind: "tool_calls",
    calls: calls.map((c, i) => ({
      callId: `call_${i}`,
      name: c.name,
      arguments: JSON.stringify(c.arguments),
    })),
    usage,
    resolvedModel: FAKE_MODEL,
    providerRequestId: "fake-request",
  }),
  refusal: (): NormalizedModelResponse => ({
    kind: "refusal",
    usage,
    resolvedModel: FAKE_MODEL,
    providerRequestId: "fake-request",
  }),
  error: (retryable = false): NormalizedModelResponse => ({
    kind: "error",
    errorClass: retryable ? "rate_limited" : "bad_request",
    retryable,
  }),
};

export class FakeModelAdapter implements ModelAdapter {
  readonly providerKey = FAKE_PROVIDER_KEY;
  readonly sent: NormalizedModelRequest[] = [];
  constructor(private readonly steps: FakeStep[]) {}

  async invoke(request: NormalizedModelRequest): Promise<NormalizedModelResponse> {
    this.sent.push(structuredClone(request));
    const step = this.steps[this.sent.length - 1];
    if (!step) return { kind: "error", errorClass: "other", retryable: false };
    return step(request, this.sent.length - 1);
  }
}
