import { describe, expect, it } from "vitest";
import { formatMoney, formatSignedMoney, parseMoney, toDecimalString } from "./money";

describe("parseMoney", () => {
  it("reads whole and fractional amounts into minor units", () => {
    expect(parseMoney("12500")).toBe(1250000);
    expect(parseMoney("$12,500.50")).toBe(1250050);
    expect(parseMoney("0.07")).toBe(7);
    expect(parseMoney("19.9")).toBe(1990);
    expect(parseMoney("  1,000  ")).toBe(100000);
  });

  it("never uses floating point", () => {
    // 0.1 + 0.2 style errors cannot occur: 1.15 * 100 is 114.99999… in floats.
    expect(parseMoney("1.15")).toBe(115);
    expect(parseMoney("4.35")).toBe(435);
    expect(parseMoney("1234567.89")).toBe(123456789);
  });

  it("rejects malformed amounts and extra precision", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.234")).toBeNull();
    expect(parseMoney("1.2.3")).toBeNull();
    expect(parseMoney("1e5")).toBeNull();
  });

  it("accepts negatives only when asked", () => {
    expect(parseMoney("-3000")).toBeNull();
    expect(parseMoney("-3,000.25", "USD", { allowNegative: true })).toBe(-300025);
  });

  it("rejects amounts beyond safe integers", () => {
    expect(parseMoney("99999999999999999")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats minor units exactly", () => {
    expect(formatMoney(1250050)).toBe("$12,500.50");
    expect(formatMoney(5)).toBe("$0.05");
    expect(formatMoney(-300025)).toBe("-$3,000.25");
    expect(formatMoney(900719925474099)).toBe("$9,007,199,254,740.99");
  });

  it("signs change-order amounts", () => {
    expect(formatSignedMoney(500000)).toBe("+$5,000.00");
    expect(formatSignedMoney(-300000)).toBe("−$3,000.00");
  });

  it("round-trips through form values", () => {
    for (const minor of [0, 7, 1990, 1250050, -300025]) {
      expect(parseMoney(toDecimalString(minor), "USD", { allowNegative: true })).toBe(minor);
    }
  });
});
