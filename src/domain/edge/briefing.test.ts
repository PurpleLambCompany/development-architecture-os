import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIRST_BRIEFING_DAYS,
  FIRST_BRIEFING_NOTE,
  briefingWindow,
  isNewSince,
  markThroughFor,
} from "./briefing";

const now = new Date("2026-10-14T15:00:00.000Z");

describe("Since You Were Away", () => {
  it("covers the prior 14 days when the user has no mark, and says so", () => {
    const w = briefingWindow(null, now);
    expect(FIRST_BRIEFING_DAYS).toBe(14);
    expect(w.isDefault).toBe(true);
    expect(w.since).toBe("2026-09-30T15:00:00.000Z");
    expect(w.until).toBe(now.toISOString());
    expect(FIRST_BRIEFING_NOTE).toContain("last 14 days");
  });

  it("starts at the user's own mark when one exists", () => {
    const w = briefingWindow("2026-10-10T09:30:00Z", now);
    expect(w).toEqual({
      since: "2026-10-10T09:30:00.000Z",
      until: now.toISOString(),
      isDefault: false,
    });
  });

  it("marks through the newest change shown, not now", () => {
    expect(
      markThroughFor([
        "2026-10-12T10:00:00Z",
        null,
        "2026-10-13T08:00:00Z",
        "2026-10-11T00:00:00Z",
      ]),
    ).toBe("2026-10-13T08:00:00.000Z");
    expect(markThroughFor([])).toBeNull();
  });

  it("treats only items with a trigger time after the mark as new", () => {
    expect(isNewSince({ trigger_at: "2026-10-12T00:00:00Z" }, "2026-10-11T00:00:00Z")).toBe(true);
    expect(isNewSince({ trigger_at: "2026-10-10T00:00:00Z" }, "2026-10-11T00:00:00Z")).toBe(false);
    expect(isNewSince({ trigger_at: null }, "2026-10-11T00:00:00Z")).toBe(false);
  });

  it("keeps the watermark private and unlogged in the database", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261006000800_edge_briefing_marks.sql"),
      "utf8",
    );
    expect(sql).toMatch(/user_id = \(select auth\.uid\(\)\)|user_id = auth\.uid\(\)/);
    expect(sql).not.toMatch(/log_activity/);
    expect(sql).not.toMatch(/is_system_admin|is_internal\(\)/);
  });
});
