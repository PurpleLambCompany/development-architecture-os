import { z } from "zod";
import type { ProcessingMode } from "./types";

/**
 * Deployment configuration for Architecture Intelligence (proposal §6, §20.3).
 * Read from server environment on every check, so setting
 * ARCHITECTURE_INTELLIGENCE_MODE=off stops processing on the next invocation
 * or the next send of one in progress. Anything absent or invalid means off.
 */

const modeSchema = z.enum(["off", "synthetic_only", "enabled"]);

export function processingMode(
  env: Record<string, string | undefined> = process.env,
): ProcessingMode {
  const parsed = modeSchema.safeParse(env.ARCHITECTURE_INTELLIGENCE_MODE);
  return parsed.success ? parsed.data : "off";
}

const priceSchema = z.record(
  z.string().min(1),
  z.strictObject({ inputPerMTok: z.number().positive(), outputPerMTok: z.number().positive() }),
);
export type PriceTable = z.infer<typeof priceSchema>;

const providerSchema = z.strictObject({
  providerKey: z.literal("openai"),
  apiKey: z.string().min(1),
  region: z.string().min(1).max(40),
  baseUrl: z.url().default("https://api.openai.com/v1"),
  requestedModel: z.string().min(1).max(120),
  reasoningEffort: z.enum(["minimal", "low", "medium", "high"]).optional(),
  prices: priceSchema,
  maxRequestUsd: z.number().positive(),
  timeoutMs: z.number().int().positive().default(60000),
});
export type ProviderConfig = z.infer<typeof providerSchema>;

/**
 * The provider configuration, or null when it is incomplete (then nothing
 * is sent). Credentials stay on the server and are never stored in DSA.
 */
export function providerConfig(
  env: Record<string, string | undefined> = process.env,
): ProviderConfig | null {
  let prices: unknown = {};
  try {
    prices = JSON.parse(env.ARCHITECTURE_INTELLIGENCE_PRICES ?? "{}");
  } catch {
    return null;
  }
  const parsed = providerSchema.safeParse({
    providerKey: env.ARCHITECTURE_INTELLIGENCE_PROVIDER,
    apiKey: env.ARCHITECTURE_INTELLIGENCE_API_KEY,
    region: env.ARCHITECTURE_INTELLIGENCE_REGION,
    baseUrl: env.ARCHITECTURE_INTELLIGENCE_BASE_URL || undefined,
    requestedModel: env.ARCHITECTURE_INTELLIGENCE_MODEL,
    reasoningEffort: env.ARCHITECTURE_INTELLIGENCE_REASONING_EFFORT || undefined,
    prices,
    maxRequestUsd: Number(env.ARCHITECTURE_INTELLIGENCE_MAX_REQUEST_USD),
    timeoutMs: env.ARCHITECTURE_INTELLIGENCE_TIMEOUT_MS
      ? Number(env.ARCHITECTURE_INTELLIGENCE_TIMEOUT_MS)
      : undefined,
  });
  return parsed.success ? parsed.data : null;
}

/** Estimated cost of token usage at a model's price, or null for an unpriced model. */
export function costUsd(
  prices: PriceTable,
  model: string,
  usage: { inputTokens: number; outputTokens: number },
): number | null {
  const price = prices[model];
  if (!price) return null;
  return (
    (usage.inputTokens * price.inputPerMTok + usage.outputTokens * price.outputPerMTok) / 1_000_000
  );
}
