import { z } from "zod";
import { isIsoDate } from "./business-date";
import {
  EXTERNAL_APPROVAL_METHODS,
  MILESTONE_TRIGGERS,
  PAYMENT_METHODS,
  PAYMENT_STRUCTURES,
} from "./catalog";
import { parseMoney } from "./money";

/**
 * Form schemas for finance actions. Forms send strings; these validate and
 * convert them (money to integer minor units, dates to YYYY-MM-DD). The
 * database re-checks every rule; these exist to give clear field errors.
 */

const id = z.uuid("Choose a record");

const text = (max: number) =>
  z.string().trim().max(max, `At most ${max.toLocaleString()} characters`);
const required = (max: number) => text(max).min(1, "Required");

const date = z.string().trim().refine(isIsoDate, "Enter a date (YYYY-MM-DD)");

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || isIsoDate(value), "Enter a date (YYYY-MM-DD)")
  .transform((value) => (value === "" ? null : value));

const nullableText = (max: number) => text(max).transform((value) => (value === "" ? null : value));

/** A positive amount in minor units, typed as text ("12,500.00"). */
export const positiveMoney = z.string().transform((value, ctx) => {
  const minor = parseMoney(value);
  if (minor === null || minor <= 0) {
    ctx.addIssue({ code: "custom", message: "Enter a positive amount, such as 12,500.00" });
    return z.NEVER;
  }
  return minor;
});

const nonNegativeMoney = z.string().transform((value, ctx) => {
  const minor = parseMoney(value);
  if (minor === null) {
    ctx.addIssue({ code: "custom", message: "Enter an amount, such as 12,500.00" });
    return z.NEVER;
  }
  return minor;
});

const optionalMoney = z.string().transform((value, ctx) => {
  if (value.trim() === "") return null;
  const minor = parseMoney(value);
  if (minor === null) {
    ctx.addIssue({ code: "custom", message: "Enter an amount, such as 12,500.00" });
    return z.NEVER;
  }
  return minor;
});

/** A change-order amount: positive (extra work) or negative (reduction), never zero. */
const signedMoney = z.string().transform((value, ctx) => {
  const minor = parseMoney(value, "USD", { allowNegative: true });
  if (minor === null || minor === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a non-zero amount; use a minus sign for a reduction",
    });
    return z.NEVER;
  }
  return minor;
});

const reason = required(1000);

// Contracts -------------------------------------------------------------------------
export const contractDraftSchema = z
  .object({
    title: required(200),
    currency: z.literal("USD", "Only USD is enabled"),
    originalValue: nonNegativeMoney,
    paymentStructure: z.enum(PAYMENT_STRUCTURES),
    paymentTermsDays: z.coerce.number().int("Whole days").min(0).max(180, "At most 180 days"),
    deposit: optionalMoney,
    effectiveDate: optionalDate,
    startDate: optionalDate,
    endDate: optionalDate,
    notes: text(2000),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "Must be on or after the start date",
    path: ["endDate"],
  });

export const executeContractSchema = z.object({
  executedOn: date,
  signatoryName: required(200),
  signatoryTitle: text(200),
});

// Milestones ------------------------------------------------------------------------
export const milestoneSchema = z.object({
  sequence: z.coerce.number().int().min(1, "At least 1"),
  title: required(200),
  description: text(2000),
  amount: positiveMoney,
  dueDate: optionalDate,
  triggerType: z.enum(MILESTONE_TRIGGERS),
  stageLabel: nullableText(200),
});

// Change orders ---------------------------------------------------------------------
export const changeOrderSchema = z.object({
  title: required(200),
  description: text(5000),
  scopeImpact: text(5000),
  scheduleImpact: text(5000),
  amount: signedMoney,
});

export const externalApprovalSchema = z
  .object({
    approverName: required(200),
    approverTitle: text(200),
    approvedOn: date,
    method: z.enum(EXTERNAL_APPROVAL_METHODS),
    evidenceReference: text(500),
    evidencePath: text(500).default(""),
  })
  .refine((v) => v.evidenceReference !== "" || v.evidencePath !== "", {
    message: "Describe the evidence or attach it",
    path: ["evidenceReference"],
  });

export const reasonSchema = z.object({ reason });

// Invoices --------------------------------------------------------------------------
export const invoiceLineSchema = z.object({
  description: required(500),
  amount: positiveMoney,
  /** "" for a free line, "milestone:<id>" or "change_order:<id>". */
  source: z
    .string()
    .refine(
      (v) => v === "" || /^(milestone|change_order):[0-9a-f-]{36}$/.test(v),
      "Choose what this line bills",
    ),
});

export const invoiceDraftSchema = z.object({
  memo: text(2000),
  lines: z.array(invoiceLineSchema).min(1, "Add at least one line").max(50),
});

export function lineSource(source: string): {
  payment_milestone_id: string | null;
  change_order_id: string | null;
} {
  const [kind, value] = source.split(":");
  return {
    payment_milestone_id: kind === "milestone" ? value! : null,
    change_order_id: kind === "change_order" ? value! : null,
  };
}

export const issueInvoiceSchema = z
  .object({ issueDate: date, dueDate: optionalDate })
  .refine((v) => !v.dueDate || v.dueDate >= v.issueDate, {
    message: "Cannot be before the issue date",
    path: ["dueDate"],
  });

export const scheduleInvoiceSchema = z.object({ scheduledIssueDate: optionalDate });

export const paymentLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => /^https:\/\/[^\s]+$/.test(v), "Must be an https:// link"),
  provider: text(100),
  providerReference: text(200),
});

// Credit notes ----------------------------------------------------------------------
export const creditNoteSchema = z.object({
  amount: positiveMoney,
  reason,
  issueDate: date,
});

// Cash --------------------------------------------------------------------------------
const noAccountNumbers = (value: string) => {
  const digits = value.replace(/[\s-]/g, "");
  return !/\d{12,}/.test(digits);
};

const reference = text(120).refine(
  noAccountNumbers,
  "Do not enter card or bank account numbers; use a check number or confirmation reference",
);

export const paymentSchema = z.object({
  amount: positiveMoney,
  receivedOn: date,
  method: z.enum(PAYMENT_METHODS),
  reference,
  payerName: text(200).refine(noAccountNumbers, "Do not enter account numbers"),
  allocations: z.array(z.object({ invoiceId: id, amount: positiveMoney })).max(50),
});

export const allocationSchema = z.object({ invoiceId: id, amount: positiveMoney });

export const refundSchema = z.object({
  amount: positiveMoney,
  refundedOn: date,
  method: z.enum(PAYMENT_METHODS),
  reason,
  paymentId: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable()),
  reference,
});

export const financeNoteSchema = z.object({ body: required(5000) });

export const rejectChangeOrderSchema = z.object({ note: reason });
