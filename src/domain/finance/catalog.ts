import type { Tone } from "@/components/ui/status-tag";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];
export type ContractStatus = Enums["contract_status"];
export type PaymentStructure = Enums["payment_structure"];
export type ChangeOrderStatus = Enums["change_order_status"];
export type ApprovalSource = Enums["approval_source"];
export type ExternalApprovalMethod = Enums["external_approval_method"];
export type MilestoneTrigger = Enums["milestone_trigger"];
export type MilestoneStatus = Enums["milestone_status"];
export type InvoiceStatus = Enums["invoice_status"];
export type CreditNoteStatus = Enums["credit_note_status"];
export type PaymentMethod = Enums["payment_method"];
export type PaymentStatus = Enums["payment_status"];
export type RefundStatus = Enums["refund_status"];

/** Derived invoice payment states (public.invoice_balances). Never stored. */
export type InvoicePaymentState =
  "draft" | "scheduled" | "void" | "open" | "partially_paid" | "overdue" | "paid";

/** Derived milestone states (public.milestone_billing). Never stored. */
export type MilestonePaymentState =
  | "upcoming"
  | "ready_to_invoice"
  | "partially_billed"
  | "invoiced"
  | "overdue"
  | "paid"
  | "cancelled";

type Label = { label: string; tone: Tone };

export const CONTRACT_STATUS: Record<ContractStatus, Label> = {
  draft: { label: "Draft", tone: "neutral" },
  executed: { label: "Executed", tone: "accent" },
  active: { label: "Active", tone: "positive" },
  completed: { label: "Completed", tone: "neutral" },
  terminated: { label: "Terminated", tone: "negative" },
  superseded: { label: "Superseded", tone: "neutral" },
  void: { label: "Void", tone: "neutral" },
};

export const PAYMENT_STRUCTURE_LABELS: Record<PaymentStructure, string> = {
  milestone: "Milestones",
  installments: "Installments",
  percentage: "Percentage of fee",
  retainer: "Retainer",
  custom: "Custom",
};

export const CHANGE_ORDER_STATUS: Record<ChangeOrderStatus, Label> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Awaiting approval", tone: "attention" },
  approved: { label: "Approved", tone: "positive" },
  rejected: { label: "Rejected", tone: "negative" },
  void: { label: "Withdrawn", tone: "neutral" },
};

export const APPROVAL_SOURCE_LABELS: Record<ApprovalSource, string> = {
  client_portal: "Approved in the client portal",
  external_recorded_by_tplco: "Approved outside the portal, recorded by TPLCo",
};

export const EXTERNAL_APPROVAL_METHOD_LABELS: Record<ExternalApprovalMethod, string> = {
  signed_document: "Signed document",
  email: "Email",
  letter: "Letter",
  other: "Other",
};

export const MILESTONE_TRIGGER_LABELS: Record<MilestoneTrigger, string> = {
  on_signing: "On signing",
  on_date: "On a date",
  on_event: "On an event",
  manual: "Manual",
};

export const MILESTONE_STATE: Record<MilestonePaymentState, Label> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  ready_to_invoice: { label: "Ready to invoice", tone: "accent" },
  partially_billed: { label: "Partly invoiced", tone: "accent" },
  invoiced: { label: "Invoiced", tone: "accent" },
  overdue: { label: "Past due", tone: "negative" },
  paid: { label: "Paid", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const INVOICE_STATE: Record<InvoicePaymentState, Label> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  void: { label: "Void", tone: "neutral" },
  open: { label: "Open", tone: "accent" },
  partially_paid: { label: "Partially paid", tone: "attention" },
  overdue: { label: "Past due", tone: "negative" },
  paid: { label: "Paid", tone: "positive" },
};

export const CREDIT_NOTE_STATUS: Record<CreditNoteStatus, Label> = {
  draft: { label: "Draft", tone: "neutral" },
  issued: { label: "Issued", tone: "accent" },
  void: { label: "Void", tone: "neutral" },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ach: "ACH transfer",
  wire: "Wire transfer",
  check: "Check",
  card_via_processor: "Card (through a payment processor)",
  other: "Other",
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
export const EXTERNAL_APPROVAL_METHODS = Object.keys(
  EXTERNAL_APPROVAL_METHOD_LABELS,
) as ExternalApprovalMethod[];
export const MILESTONE_TRIGGERS = Object.keys(MILESTONE_TRIGGER_LABELS) as MilestoneTrigger[];
export const PAYMENT_STRUCTURES = Object.keys(PAYMENT_STRUCTURE_LABELS) as PaymentStructure[];
