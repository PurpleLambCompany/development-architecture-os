import { describe, expect, it } from "vitest";
import { activeProvider, configuredModel, fakeProviderConfig } from "../config";
import { INFERENCE_KINDS } from "../types";
import { currentPrompt, isEvaluatedModel, PROMPT_MANIFEST } from "./manifest";
import { testManifestOverlay } from "./test-overlay";

const fakeEnv = {
  NODE_ENV: "development",
  ARCHITECTURE_INTELLIGENCE_MODE: "synthetic_only",
  ARCHITECTURE_INTELLIGENCE_PROVIDER: "fake",
  ARCHITECTURE_INTELLIGENCE_REGION: "us",
  ARCHITECTURE_INTELLIGENCE_MAX_REQUEST_USD: "0.5",
};

describe("the fake provider and the test manifest overlay (PD-2, ADR-0073)", () => {
  it("is active only outside production, under synthetic_only", () => {
    expect(fakeProviderConfig(fakeEnv)).toMatchObject({ providerKey: "fake", region: "us" });
    expect(activeProvider(fakeEnv)?.kind).toBe("fake");
    expect(testManifestOverlay(fakeEnv)).not.toBeNull();
  });

  it("is refused in production, under every other mode, and never falls back to a real provider", () => {
    for (const env of [
      { ...fakeEnv, NODE_ENV: "production" },
      { ...fakeEnv, ARCHITECTURE_INTELLIGENCE_MODE: "enabled" },
      { ...fakeEnv, ARCHITECTURE_INTELLIGENCE_MODE: "off" },
    ]) {
      expect(fakeProviderConfig(env)).toBeNull();
      expect(activeProvider(env)).toBeNull();
      expect(testManifestOverlay(env)).toBeNull();
    }
  });

  it("never overlays a real provider or a third fake resolution", () => {
    const check = testManifestOverlay(fakeEnv)!;
    for (const kind of INFERENCE_KINDS) {
      const v = currentPrompt(kind).promptVersion;
      expect(check(kind, v, "fake", "dsa-fake-model-1")).toBe(true);
      expect(check(kind, v, "fake", "dsa-fake-model-2")).toBe(true);
      expect(check(kind, v, "fake", "dsa-fake-model-3")).toBe(false);
      expect(check(kind, v, "openai", "dsa-fake-model-1")).toBe(false);
      expect(check(kind, "v1", "fake", "dsa-fake-model-1")).toBe(false);
    }
  });

  it("leaves the committed manifest with no evaluated model, and the v1 prompts retired (PD-19)", () => {
    for (const kind of INFERENCE_KINDS) {
      for (const v of PROMPT_MANIFEST[kind]) expect(v.evaluatedModels).toEqual([]);
      expect(PROMPT_MANIFEST[kind].find((v) => v.promptVersion === "v1")?.status).toBe("retired");
      expect(currentPrompt(kind).promptVersion).toBe("v2");
      expect(isEvaluatedModel(kind, "v2", "fake", "dsa-fake-model-1")).toBe(false);
    }
  });

  it("names the configured model without a credential, so the unevaluated state is honest", () => {
    expect(
      configuredModel({
        ARCHITECTURE_INTELLIGENCE_PROVIDER: "openai",
        ARCHITECTURE_INTELLIGENCE_MODEL: "m",
      }),
    ).toEqual({ providerKey: "openai", requestedModel: "m" });
    expect(configuredModel({ ARCHITECTURE_INTELLIGENCE_PROVIDER: "openai" })).toBeNull();
    expect(configuredModel({})).toBeNull();
  });
});
