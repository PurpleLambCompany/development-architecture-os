import { describe, expect, it } from "vitest";
import { addDays, businessDate, daysBetween, isIsoDate, isValidTimeZone } from "./business-date";

const CHICAGO = "America/Chicago";

describe("businessDate", () => {
  it("uses the business time zone, not UTC", () => {
    // 03:30 UTC on Oct 1 is still the evening of Sep 30 in Chicago (CDT, UTC-5).
    expect(businessDate(new Date("2026-10-01T03:30:00Z"), CHICAGO)).toBe("2026-09-30");
    expect(businessDate(new Date("2026-10-01T05:30:00Z"), CHICAGO)).toBe("2026-10-01");
  });

  it("follows daylight saving time without hard-coded offsets", () => {
    // Winter: CST is UTC-6, so 05:30 UTC is 23:30 the previous day.
    expect(businessDate(new Date("2026-01-15T05:30:00Z"), CHICAGO)).toBe("2026-01-14");
    // Summer: CDT is UTC-5, so 05:30 UTC is 00:30 the same day.
    expect(businessDate(new Date("2026-07-15T05:30:00Z"), CHICAGO)).toBe("2026-07-15");
  });

  it("validates IANA zone names", () => {
    expect(isValidTimeZone(CHICAGO)).toBe(true);
    expect(isValidTimeZone("Central Standard Time")).toBe(false);
  });
});

describe("calendar arithmetic", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-09-30", 30)).toBe("2026-10-30");
    expect(addDays("2026-12-20", 15)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-09-01", "2026-09-30")).toBe(29);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2); // across a DST change
  });

  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("09/30/2026")).toBe(false);
  });
});
