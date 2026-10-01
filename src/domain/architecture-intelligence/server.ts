import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { OpenAIAdapter } from "./adapters/openai";
import { processingMode, providerConfig } from "./config";
import { invokeArchitectureIntelligence, type GatewayResult, type InvokeInput } from "./gateway";
import { supabaseStore } from "./store";

/**
 * The only entry point application code may use. It wires the Gateway to
 * the requesting user's Supabase session (never the service role) and to
 * the configured provider. In 7B.1 nothing in the application calls it:
 * there is no user-facing inference surface (OD-12). The evaluation harness
 * calls the Gateway directly.
 */
export async function invokeAsUser(
  supabase: SupabaseClient<Database>,
  input: InvokeInput,
): Promise<GatewayResult> {
  const config = providerConfig();
  return invokeArchitectureIntelligence(
    {
      store: supabaseStore(supabase),
      adapter: config
        ? new OpenAIAdapter({ apiKey: config.apiKey, baseUrl: config.baseUrl })
        : null,
      provider: config,
      mode: () => processingMode(),
    },
    input,
  );
}
