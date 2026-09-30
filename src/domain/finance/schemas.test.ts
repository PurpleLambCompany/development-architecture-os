import { describe, expect, it } from "vitest";
import {
  changeOrderSchema,
  externalApprovalSchema,
  invoiceDraftSchema,
  lineSource,
  paymentLinkSchema,
  paymentSchema,
  refundSchema,
} from "./schemas";

const MILESTONE = "d0000000-0000-4000-8000-000000000001";

describe("finance form schemas", () => {
  it("converts payment amounts to minor units", () => {
    const parsed = paymentSchema.parse({
      amount: "10,000.00",
      receivedOn: "2026-09-30",
      method: "wire",
      reference: "WIRE-20417",
      payerName: "Meridian",
      allocations: [{ invoiceId: MILESTONE, amount: "4,000" }],
    });
    expect(parsed.amount).toBe(1000000);
    expect(parsed.allocations[0]!.amount).toBe(400000);
  });

  it("refuses card and bank account numbers as references", () => {
    const result = paymentSchema.safeParse({
      amount: "100",
      receivedOn: "2026-09-30",
      method: "card_via_processor",
      reference: "4111 1111 1111 1111",
      payerName: "",
      allocations: [],
    });
    expect(result.success).toBe(false);
  });

  it("allows negative change orders but not zero", () => {
    const base = { title: "Reduced scope", description: "", scopeImpact: "", scheduleImpact: "" };
    expect(changeOrderSchema.parse({ ...base, amount: "-3,000" }).amount).toBe(-300000);
    expect(changeOrderSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
  });

  it("requires evidence for an external approval", () => {
    const base = {
      approverName: "Eleanor Vance",
      approverTitle: "",
      approvedOn: "2026-09-30",
      method: "email",
      evidencePath: "",
    };
    expect(externalApprovalSchema.safeParse({ ...base, evidenceReference: "" }).success).toBe(
      false,
    );
    expect(externalApprovalSchema.safeParse({ ...base, evidenceReference: "Email" }).success).toBe(
      true,
    );
  });

  it("accepts only https payment links", () => {
    const base = { provider: "", providerReference: "" };
    expect(paymentLinkSchema.safeParse({ ...base, url: "http://pay.example.com" }).success).toBe(
      false,
    );
    expect(paymentLinkSchema.safeParse({ ...base, url: "https://pay.example.com/x" }).success).toBe(
      true,
    );
  });

  it("maps invoice line sources to one reference only", () => {
    const parsed = invoiceDraftSchema.parse({
      memo: "",
      lines: [{ description: "Deposit", amount: "30,000", source: `milestone:${MILESTONE}` }],
    });
    expect(lineSource(parsed.lines[0]!.source)).toEqual({
      payment_milestone_id: MILESTONE,
      change_order_id: null,
    });
    expect(lineSource("")).toEqual({ payment_milestone_id: null, change_order_id: null });
  });

  it("treats a refund's originating payment as optional", () => {
    const parsed = refundSchema.parse({
      amount: "1,000",
      refundedOn: "2026-09-30",
      method: "ach",
      reason: "Returned",
      paymentId: "",
      reference: "",
    });
    expect(parsed.paymentId).toBeNull();
  });
});
