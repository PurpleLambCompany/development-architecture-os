import { describe, expect, it } from "vitest";
import type { ProviderSettings } from "../gateway";
import type { Standing } from "../store";
import { composeGate, GATE_COPY, type GateFacts } from "./gate";

const standing: Standing = {
  canUse: true,
  canAuthorize: false,
  dataOrigin: "synthetic",
  engagementStatus: "active",
  authorizationId: "a",
  authorizationState: "authorized",
  dataClasses: ["architecture", "evidence", "review", "implementation"],
  providerKey: "fake",
  processingRegion: "us",
  monthlyBudgetUsd: 25,
};
const provider = {
  providerKey: "fake",
  region: "us",
  maxRequestUsd: 0.5,
} as unknown as ProviderSettings;
const facts: GateFacts = {
  mode: "synthetic_only",
  standing,
  configured: { providerKey: "fake", requestedModel: "dsa-fake-model-1" },
  evaluated: true,
  provider,
  requiredClasses: ["architecture"],
  estimateUsd: 0.1,
  monthToDateUsd: 0,
  rule: { holds: true, reason: "a substantive revision changed the summary" },
};
const gate = (over: Partial<GateFacts>, s: Partial<Standing> = {}) =>
  composeGate({ ...facts, ...over, standing: facts.standing && { ...standing, ...s } });

describe("interpretation gate (7B.2 §5.2, §9, §23)", () => {
  it("offers the action with the rule's reason when every check holds", () => {
    expect(gate({})).toEqual({
      state: "offered",
      reason: "a substantive revision changed the summary",
      large: false,
    });
  });

  it("is absent with AI off, without standing, or without the capability (IX-18)", () => {
    expect(gate({ mode: "off" })).toEqual({ state: "absent" });
    expect(composeGate({ ...facts, standing: null })).toEqual({ state: "absent" });
    expect(gate({}, { canUse: false })).toEqual({ state: "absent" });
  });

  it("refuses real engagements under synthetic_only, with no authorizer link", () => {
    expect(gate({}, { dataOrigin: "real", canAuthorize: true })).toEqual({
      state: "unavailable",
      text: GATE_COPY.notForEngagement,
      authorizerLink: false,
    });
  });

  it("names authorisation, class, configuration and budget states, linking authorizers", () => {
    expect(gate({}, { authorizationState: "not_authorized", canAuthorize: true })).toEqual({
      state: "unavailable",
      text: GATE_COPY.notAuthorised,
      authorizerLink: true,
    });
    expect(gate({}, { engagementStatus: "closed" })).toMatchObject({
      text: GATE_COPY.notAuthorised,
    });
    expect(gate({ requiredClasses: ["architecture", "financial"] })).toMatchObject({
      text: GATE_COPY.classNotAuthorised,
    });
    expect(gate({ configured: null })).toMatchObject({ text: GATE_COPY.notConfigured });
    expect(gate({ provider: null })).toMatchObject({ text: GATE_COPY.notConfigured });
    expect(gate({}, { processingRegion: "eu" })).toMatchObject({ text: GATE_COPY.notAuthorised });
    expect(gate({}, { providerKey: "openai" })).toMatchObject({ text: GATE_COPY.notAuthorised });
    expect(gate({ estimateUsd: 0.6 })).toMatchObject({ text: GATE_COPY.budget });
    expect(gate({ estimateUsd: null })).toMatchObject({ text: GATE_COPY.budget });
    expect(gate({ monthToDateUsd: 24.95 })).toMatchObject({ text: GATE_COPY.budget });
    expect(gate({ monthToDateUsd: null })).toMatchObject({ text: GATE_COPY.budget });
  });

  it("says no model is evaluated before checking the credential, and never links an authorizer for it", () => {
    // The unevaluated-model state shows even when no provider credential is configured.
    expect(gate({ evaluated: false, provider: null }, { canAuthorize: true })).toEqual({
      state: "unavailable",
      text: GATE_COPY.notEvaluated,
      authorizerLink: false,
    });
  });

  it("is not offered when the deterministic rule does not hold", () => {
    expect(gate({ rule: { holds: false, reason: null } })).toEqual({ state: "not_offered" });
    expect(gate({ rule: { holds: true, reason: null } })).toEqual({ state: "not_offered" });
  });

  it("asks for confirmation above half the per-request ceiling (PD-17)", () => {
    expect(gate({ estimateUsd: 0.25 })).toMatchObject({ state: "offered", large: false });
    expect(gate({ estimateUsd: 0.26 })).toMatchObject({ state: "offered", large: true });
  });
});
