import { describe, expect, it } from "vitest";
import { updateReviewSchema } from "./schemas";

/** Editing a review's own fields (V1-A B2): the database re-checks manage_reviews. */
describe("updateReviewSchema", () => {
  it("accepts a corrected date and summary, and clears an empty baseline", () => {
    const parsed = updateReviewSchema.parse({
      reviewType: "architecture_review",
      scheduledFor: "2026-11-02T15:00",
      baselineId: "",
      summary: "  Confirm the scope.  ",
    });
    expect(parsed).toEqual({
      reviewType: "architecture_review",
      scheduledFor: "2026-11-02T15:00",
      baselineId: null,
      summary: "Confirm the scope.",
    });
  });

  it("clears an empty date", () => {
    expect(
      updateReviewSchema.parse({ reviewType: "executive_review", scheduledFor: "", summary: "" })
        .scheduledFor,
    ).toBeNull();
  });

  it("refuses an unknown kind and a malformed date", () => {
    const result = updateReviewSchema.safeParse({
      reviewType: "board_review",
      scheduledFor: "next Tuesday",
      summary: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(["reviewType", "scheduledFor"]);
  });
});
