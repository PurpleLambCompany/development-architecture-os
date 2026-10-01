import { FakeModelAdapter, FAKE_MODEL, FAKE_PROVIDER_KEY, type FakeStep } from "../adapters/fake";
import type { GatewayDeps, ProviderSettings } from "../gateway";
import type { ArchitectureIntelligenceStore } from "../store";
import type { InferenceKind, ProcessingMode } from "../types";

/** Deployment settings for pipeline runs: the authorization's provider and region, a priced fake model. */
export const FAKE_PROVIDER: ProviderSettings = {
  providerKey: "openai",
  region: "us",
  requestedModel: FAKE_MODEL,
  prices: { [FAKE_MODEL]: { inputPerMTok: 1, outputPerMTok: 4 } },
  maxRequestUsd: 5,
  timeoutMs: 1000,
};

/** In pipeline runs the fake model counts as evaluated; nothing else does. */
export const fakeEvaluated = (
  _: InferenceKind,
  __: string,
  providerKey: string,
  resolvedModel: string,
) => providerKey === FAKE_PROVIDER_KEY && resolvedModel === FAKE_MODEL;

export function fakeDeps(
  store: ArchitectureIntelligenceStore,
  steps: FakeStep[],
  mode: () => ProcessingMode = () => "synthetic_only",
): GatewayDeps & { adapter: FakeModelAdapter } {
  return {
    store,
    adapter: new FakeModelAdapter(steps),
    provider: FAKE_PROVIDER,
    mode,
    isEvaluatedModel: fakeEvaluated,
    now: () => new Date(),
  };
}
