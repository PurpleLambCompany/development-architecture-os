import { describe, expect, it } from "vitest";
import { allocationProblems, suggestAllocations, type OpenInvoice } from "./allocation";

const invoices: OpenInvoice[] = [
  { id: "c", invoiceNumber: "TPL-2026-0003", dueDate: "2026-10-20", balanceMinor: 600000 },
  { id: "a", invoiceNumber: "TPL-2026-0001", dueDate: "2026-09-01", balanceMinor: 400000 },
  { id: "b", invoiceNumber: "TPL-2026-0002", dueDate: "2026-09-15", balanceMinor: 500000 },
  { id: "paid", invoiceNumber: "TPL-2026-0000", dueDate: "2026-08-01", balanceMinor: 0 },
];

describe("suggestAllocations", () => {
  it("splits a $10,000 payment oldest due first", () => {
    expect(suggestAllocations(1000000, invoices)).toEqual({
      lines: [
        { invoiceId: "a", amountMinor: 400000 },
        { invoiceId: "b", amountMinor: 500000 },
        { invoiceId: "c", amountMinor: 100000 },
      ],
      unappliedMinor: 0,
    });
  });

  it("leaves any excess as credit on account", () => {
    expect(suggestAllocations(2000000, invoices).unappliedMinor).toBe(500000);
  });

  it("suggests nothing when nothing is open", () => {
    expect(suggestAllocations(50000, [])).toEqual({ lines: [], unappliedMinor: 50000 });
  });
});

describe("allocationProblems", () => {
  it("accepts a valid split", () => {
    expect(
      allocationProblems(1000000, suggestAllocations(1000000, invoices).lines, invoices),
    ).toEqual([]);
  });

  it("rejects over-allocation of the payment and of an invoice", () => {
    expect(allocationProblems(100, [{ invoiceId: "a", amountMinor: 200 }], invoices)).toContain(
      "The allocations add up to more than the payment.",
    );
    expect(
      allocationProblems(900000, [{ invoiceId: "a", amountMinor: 400001 }], invoices),
    ).toContain("The amount for TPL-2026-0001 is more than its balance.");
  });

  it("rejects duplicates and unknown invoices", () => {
    expect(
      allocationProblems(
        300,
        [
          { invoiceId: "a", amountMinor: 100 },
          { invoiceId: "a", amountMinor: 100 },
          { invoiceId: "zzz", amountMinor: 100 },
        ],
        invoices,
      ),
    ).toEqual([
      "TPL-2026-0001 is listed twice.",
      "An allocation refers to an invoice that is not open.",
    ]);
  });
});
