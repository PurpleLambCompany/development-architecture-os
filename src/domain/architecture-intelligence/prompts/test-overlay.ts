import { FAKE_PROVIDER_KEY } from "../adapters/fake";
import { fakeProviderConfig } from "../config";
import type { InferenceKind } from "../types";
import { currentPrompt, isEvaluatedModel } from "./manifest";

/**
 * The test-only manifest overlay (ADR-0073, PD-2). Under exactly the fake
 * provider's conditions (provider `fake`, mode `synthetic_only`, NODE_ENV not
 * `production`), the deterministic fake models count as evaluated for each
 * kind's current prompt, so Step A acceptance can show every interpretation
 * state honestly without a credential or a provider call. It never lists a
 * real provider, never changes PROMPT_MANIFEST, and returns null (no overlay)
 * in any other configuration, including every production server.
 *
 * Two fake models are listed so acceptance can show that a change of the
 * resolved model ends reuse even when the requested model is unchanged
 * (PD-13a); a third resolution is never listed, so "model not evaluated"
 * can be shown too.
 */
export const TEST_OVERLAY_MODELS: readonly string[] = ["dsa-fake-model-1", "dsa-fake-model-2"];

export type EvaluatedModelCheck = (
  kind: InferenceKind,
  promptVersion: string,
  providerKey: string,
  resolvedModel: string,
) => boolean;

export function testManifestOverlay(
  env: Record<string, string | undefined> = process.env,
): EvaluatedModelCheck | null {
  if (!fakeProviderConfig(env)) return null;
  return (kind, promptVersion, providerKey, resolvedModel) =>
    isEvaluatedModel(kind, promptVersion, providerKey, resolvedModel) ||
    (providerKey === FAKE_PROVIDER_KEY &&
      promptVersion === currentPrompt(kind).promptVersion &&
      TEST_OVERLAY_MODELS.includes(resolvedModel));
}
