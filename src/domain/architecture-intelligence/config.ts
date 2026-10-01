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

/**
 * The deterministic fake provider, for Step A acceptance only (ADR-0073,
 * PD-2). Available only when all three hold:
 *   - ARCHITECTURE_INTELLIGENCE_PROVIDER is `fake`;
 *   - ARCHITECTURE_INTELLIGENCE_MODE is `synthetic_only`;
 *   - NODE_ENV is not `production` (`next start` and every production build
 *     set it, so a production server can never use it).
 * It needs no credential and calls no network. Its model is priced only so
 * the Gateway's budget checks run exactly as they would for a real one.
 */
const fakeProviderSchema = z.strictObject({
  providerKey: z.literal("fake"),
  region: z.string().min(1).max(40),
  requestedModel: z.string().min(1).max(120),
  prices: priceSchema,
  maxRequestUsd: z.number().positive(),
  timeoutMs: z.number().int().positive().default(60000),
});
export type FakeProviderConfig = z.infer<typeof fakeProviderSchema>;

export const FAKE_PROVIDER_DEFAULT_MODEL = "dsa-fake-model-1";

export function fakeProviderConfig(
  env: Record<string, string | undefined> = process.env,
): FakeProviderConfig | null {
  if (env.NODE_ENV === "production") return null;
  if (env.ARCHITECTURE_INTELLIGENCE_PROVIDER !== "fake") return null;
  if (processingMode(env) !== "synthetic_only") return null;
  const requestedModel = env.ARCHITECTURE_INTELLIGENCE_MODEL || FAKE_PROVIDER_DEFAULT_MODEL;
  let prices: unknown = { [requestedModel]: { inputPerMTok: 1, outputPerMTok: 1 } };
  if (env.ARCHITECTURE_INTELLIGENCE_PRICES) {
    try {
      prices = JSON.parse(env.ARCHITECTURE_INTELLIGENCE_PRICES);
    } catch {
      return null;
    }
  }
  const parsed = fakeProviderSchema.safeParse({
    providerKey: "fake",
    region: env.ARCHITECTURE_INTELLIGENCE_REGION,
    requestedModel,
    prices,
    maxRequestUsd: Number(env.ARCHITECTURE_INTELLIGENCE_MAX_REQUEST_USD),
    timeoutMs: env.ARCHITECTURE_INTELLIGENCE_TIMEOUT_MS
      ? Number(env.ARCHITECTURE_INTELLIGENCE_TIMEOUT_MS)
      : undefined,
  });
  return parsed.success ? parsed.data : null;
}

/** The provider in force: a configured real provider, the fake one under its conditions, or none. */
export type ActiveProvider =
  { kind: "openai"; config: ProviderConfig } | { kind: "fake"; config: FakeProviderConfig };

export function activeProvider(
  env: Record<string, string | undefined> = process.env,
): ActiveProvider | null {
  if (env.ARCHITECTURE_INTELLIGENCE_PROVIDER === "fake") {
    const config = fakeProviderConfig(env);
    return config ? { kind: "fake", config } : null;
  }
  const config = providerConfig(env);
  return config ? { kind: "openai", config } : null;
}

/**
 * The provider and requested model the environment names, whether or not a
 * credential or a complete configuration is present. The interpretation
 * layer uses it only to say whether that model has been evaluated (7B.2
 * proposal §5.2 item 4), so the governance state is honest before anything
 * could be sent. Nothing is sent on the strength of this alone.
 */
export function configuredModel(
  env: Record<string, string | undefined> = process.env,
): { providerKey: string; requestedModel: string } | null {
  const providerKey = env.ARCHITECTURE_INTELLIGENCE_PROVIDER;
  if (providerKey !== "openai" && providerKey !== "fake") return null;
  const requestedModel =
    env.ARCHITECTURE_INTELLIGENCE_MODEL ||
    (providerKey === "fake" ? FAKE_PROVIDER_DEFAULT_MODEL : "");
  return requestedModel ? { providerKey, requestedModel } : null;
}
