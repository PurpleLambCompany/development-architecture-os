import { describe, expect, it } from "vitest";
import { engagementCreateSchema, toEngagementRow } from "./schemas";

const valid = {
  clientOrganizationId: "a0000000-0000-4000-8000-000000000002",
  title: "Regional Innovation District",
  slug: "meridian-innovation-district",
  engagementType: "development_architecture_intensive",
  objective: "",
  description: "",
  methodologyVersion: "DAM 1.0",
  currentPhase: "",
  status: "proposed",
  startDate: "2026-08-03",
  targetEndDate: "",
};

describe("engagementCreateSchema", () => {
  it("accepts a minimal valid engagement and normalizes empty dates to null", () => {
    const result = engagementCreateSchema.parse(valid);
    expect(result.targetEndDate).toBeNull();
    expect(toEngagementRow(result).start_date).toBe("2026-08-03");
  });

  it("rejects an end date before the start date", () => {
    const result = engagementCreateSchema.safeParse({ ...valid, targetEndDate: "2026-01-01" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["targetEndDate"]);
  });

  it("rejects unknown engagement types and malformed slugs", () => {
    expect(engagementCreateSchema.safeParse({ ...valid, engagementType: "retainer" }).success).toBe(
      false,
    );
    expect(engagementCreateSchema.safeParse({ ...valid, slug: "Bad Slug" }).success).toBe(false);
  });
});
