import { describe, expect, it } from "vitest";
import { authorizationSchema } from "./schemas";

describe("the authorization form", () => {
  it("accepts a revocation that names only its reason", () => {
    expect(
      authorizationSchema.safeParse({
        state: "not_authorized",
        basisNote: "Paused by the sponsor.",
      }).success,
    ).toBe(true);
  });

  it("requires a reason to revoke", () => {
    expect(authorizationSchema.safeParse({ state: "not_authorized", basisNote: " " }).success).toBe(
      false,
    );
  });

  it("accepts an authorization without a note or date, and needs at least one class", () => {
    const base = {
      state: "authorized",
      providerKey: "openai",
      processingRegion: "us",
      basisKind: "client_agreement",
      basisReference: "Engagement letter",
      monthlyBudgetUsd: "10",
    };
    expect(
      authorizationSchema.safeParse({ ...base, dataClasses: ["published_architecture"] }).success,
    ).toBe(true);
    expect(authorizationSchema.safeParse({ ...base, dataClasses: [] }).success).toBe(false);
    expect(authorizationSchema.safeParse({ ...base, dataClasses: ["method_ip"] }).success).toBe(
      false,
    );
  });
});
