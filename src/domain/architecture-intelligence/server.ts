import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  DeterministicFakeAdapter,
  fakeResolvedModel,
  fakeScenario,
} from "./adapters/fake-responder";
import { OpenAIAdapter } from "./adapters/openai";
import type { ModelAdapter } from "./adapters/types";
import { activeProvider, configuredModel, processingMode } from "./config";
import {
  invokeArchitectureIntelligence,
  type GatewayResult,
  type InvokeInput,
  type ProviderSettings,
} from "./gateway";
import { isEvaluatedModel } from "./prompts/manifest";
import { testManifestOverlay, type EvaluatedModelCheck } from "./prompts/test-overlay";
import { supabaseStore } from "./store";
import type { ProcessingMode } from "./types";

/**
 * The only entry point application code may use. It wires the Gateway to
 * the requesting user's Supabase session (never the service role) and to
 * the configured provider.
 *
 * 7B.2: the application calls it only in ephemeral mode, on a person's
 * explicit request (IX-12, IX-16); a source scan proves no application
 * module asks for `persist`. The deterministic fake provider and its test
 * manifest overlay are wired only under their non-production conditions
 * (ADR-0073); a production server can never use them.
 */

export type Deployment = {
  mode: ProcessingMode;
  /** The provider in force, without its credential, or null. */
  provider: ProviderSettings | null;
  /** The provider and model the environment names, even without a credential. */
  configured: { providerKey: string; requestedModel: string } | null;
  isEvaluatedModel: EvaluatedModelCheck;
};

/** The deployment's Architecture Intelligence configuration, read now. */
export function deployment(): Deployment {
  const active = activeProvider();
  const overlay = active?.kind === "fake" ? testManifestOverlay() : null;
  return {
    mode: processingMode(),
    provider: active
      ? {
          providerKey: active.config.providerKey,
          region: active.config.region,
          requestedModel: active.config.requestedModel,
          reasoningEffort: active.kind === "openai" ? active.config.reasoningEffort : undefined,
          prices: active.config.prices,
          maxRequestUsd: active.config.maxRequestUsd,
          timeoutMs: active.config.timeoutMs,
        }
      : null,
    configured: configuredModel(),
    isEvaluatedModel: overlay ?? isEvaluatedModel,
  };
}

function adapterFor(active: ReturnType<typeof activeProvider>): ModelAdapter | null {
  if (!active) return null;
  if (active.kind === "fake")
    return new DeterministicFakeAdapter(fakeScenario(), fakeResolvedModel());
  return new OpenAIAdapter({ apiKey: active.config.apiKey, baseUrl: active.config.baseUrl });
}

export async function invokeAsUser(
  supabase: SupabaseClient<Database>,
  input: InvokeInput,
): Promise<GatewayResult> {
  const active = activeProvider();
  const d = deployment();
  return invokeArchitectureIntelligence(
    {
      store: supabaseStore(supabase),
      adapter: adapterFor(active),
      provider: d.provider,
      mode: () => processingMode(),
      isEvaluatedModel: d.isEvaluatedModel,
    },
    input,
  );
}
