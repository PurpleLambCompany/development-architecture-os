"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ContractStatus, MilestoneStatus } from "./catalog";
import {
  allocationSchema,
  changeOrderSchema,
  contractDraftSchema,
  creditNoteSchema,
  executeContractSchema,
  externalApprovalSchema,
  financeNoteSchema,
  invoiceDraftSchema,
  issueInvoiceSchema,
  lineSource,
  milestoneSchema,
  paymentLinkSchema,
  paymentSchema,
  reasonSchema,
  refundSchema,
  rejectChangeOrderSchema,
  scheduleInvoiceSchema,
} from "./schemas";

/**
 * Finance server actions. They validate input for clear messages and call
 * the database as the signed-in user: money moves only through the
 * transactional operations (public.issue_invoice, record_payment, …), which
 * lock the contract, check permission and re-check every invariant. Draft
 * records are edited directly under row-level security.
 */

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Insert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/**
 * Child rows inherit engagement_id, currency (and contract_id for lines) from
 * their parent in the database (the inherit_*_context triggers); clients may
 * not supply them, and the column grants do not allow it.
 */
function inherited<T extends keyof Database["public"]["Tables"]>(
  row: Omit<Insert<T>, "engagement_id" | "currency" | "contract_id"> & { contract_id?: string },
): Insert<T> {
  return row as Insert<T>;
}

function refresh() {
  revalidatePath("/internal", "layout");
  revalidatePath("/portal", "layout");
}

function dbError(error: PostgrestError): ActionResult<never> {
  if (error.code === "23505" && error.message.includes("contracts_one_current")) {
    return fail("This engagement already has a current contract. Supersede it instead.");
  }
  return fromDatabaseError(error);
}

/** Validate, run, refresh. */
async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  work: (
    supabase: Supabase,
    data: z.output<S>,
  ) => Promise<{ data?: T; error: PostgrestError | null }>,
): Promise<ActionResult<T | undefined>> {
  await requireViewer();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await work(supabase, parsed.data);
  if (error) return dbError(error);
  refresh();
  return ok(data);
}

/** An update or delete that RLS silently filtered out means no permission. */
function expectRow<T>(result: { data: T[] | null; error: PostgrestError | null }) {
  if (result.error) return { error: result.error };
  if (!result.data?.length) {
    return {
      error: {
        code: "42501",
        message: "No permission",
        details: "",
        hint: "",
        name: "PostgrestError",
      } as PostgrestError,
    };
  }
  return { data: result.data[0], error: null };
}

// Contracts ---------------------------------------------------------------------------
function contractRow(v: z.output<typeof contractDraftSchema>) {
  return {
    title: v.title,
    currency: v.currency,
    original_value_minor: v.originalValue,
    payment_structure: v.paymentStructure,
    payment_terms_days: v.paymentTermsDays,
    deposit_minor: v.deposit,
    effective_date: v.effectiveDate,
    start_date: v.startDate,
    end_date: v.endDate,
    notes: v.notes,
  };
}

export async function createContract(engagementId: string, input: unknown) {
  return run(contractDraftSchema, input, async (supabase, v) =>
    supabase
      .from("contracts")
      .insert({ engagement_id: engagementId, ...contractRow(v) })
      .select("id")
      .single(),
  );
}

export async function createRenewalContract(
  supersedesId: string,
  engagementId: string,
  input: unknown,
) {
  return run(contractDraftSchema, input, async (supabase, v) =>
    supabase
      .from("contracts")
      .insert({
        engagement_id: engagementId,
        supersedes_contract_id: supersedesId,
        ...contractRow(v),
      })
      .select("id")
      .single(),
  );
}

export async function updateContractDraft(contractId: string, input: unknown) {
  return run(contractDraftSchema, input, async (supabase, v) =>
    expectRow(
      await supabase.from("contracts").update(contractRow(v)).eq("id", contractId).select("id"),
    ),
  );
}

export async function deleteContractDraft(contractId: string): Promise<ActionResult<undefined>> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const result = expectRow(
    await supabase.from("contracts").delete().eq("id", contractId).select("id"),
  );
  if (result.error) return dbError(result.error);
  refresh();
  return ok(undefined);
}

export async function executeContract(contractId: string, input: unknown) {
  return run(executeContractSchema, input, async (supabase, v) =>
    supabase.rpc("execute_contract", {
      p_contract_id: contractId,
      p_executed_on: v.executedOn,
      p_client_signatory_name: v.signatoryName,
      p_client_signatory_title: v.signatoryTitle,
    }),
  );
}

export async function setContractStatus(contractId: string, status: ContractStatus) {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_contract_status", {
    p_contract_id: contractId,
    p_status: status,
  });
  if (error) return dbError(error);
  refresh();
  return ok(undefined);
}

// Milestones --------------------------------------------------------------------------
function milestoneRow(v: z.output<typeof milestoneSchema>) {
  return {
    sequence: v.sequence,
    title: v.title,
    description: v.description,
    amount_minor: v.amount,
    due_date: v.dueDate,
    trigger_type: v.triggerType,
    stage_label: v.stageLabel,
  };
}

export async function createMilestone(contractId: string, input: unknown) {
  return run(milestoneSchema, input, async (supabase, v) =>
    supabase
      .from("payment_milestones")
      .insert(inherited<"payment_milestones">({ contract_id: contractId, ...milestoneRow(v) }))
      .select("id")
      .single(),
  );
}

export async function updateMilestone(milestoneId: string, input: unknown) {
  return run(milestoneSchema, input, async (supabase, v) =>
    expectRow(
      await supabase
        .from("payment_milestones")
        .update(milestoneRow(v))
        .eq("id", milestoneId)
        .select("id"),
    ),
  );
}

export async function deleteMilestone(milestoneId: string): Promise<ActionResult<undefined>> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const result = expectRow(
    await supabase.from("payment_milestones").delete().eq("id", milestoneId).select("id"),
  );
  if (result.error) return dbError(result.error);
  refresh();
  return ok(undefined);
}

export async function setMilestoneStatus(milestoneId: string, status: MilestoneStatus) {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_milestone_status", {
    p_milestone_id: milestoneId,
    p_status: status,
  });
  if (error) return dbError(error);
  refresh();
  return ok(undefined);
}

// Change orders -----------------------------------------------------------------------
function changeOrderRow(v: z.output<typeof changeOrderSchema>) {
  return {
    title: v.title,
    description: v.description,
    scope_impact: v.scopeImpact,
    schedule_impact: v.scheduleImpact,
    amount_minor: v.amount,
  };
}

export async function createChangeOrder(contractId: string, input: unknown) {
  return run(changeOrderSchema, input, async (supabase, v) =>
    supabase
      .from("change_orders")
      .insert(inherited<"change_orders">({ contract_id: contractId, ...changeOrderRow(v) }))
      .select("id")
      .single(),
  );
}

export async function updateChangeOrder(changeOrderId: string, input: unknown) {
  return run(changeOrderSchema, input, async (supabase, v) =>
    expectRow(
      await supabase
        .from("change_orders")
        .update(changeOrderRow(v))
        .eq("id", changeOrderId)
        .select("id"),
    ),
  );
}

export async function submitChangeOrder(changeOrderId: string): Promise<ActionResult<undefined>> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_change_order", { p_change_order_id: changeOrderId });
  if (error) return dbError(error);
  refresh();
  return ok(undefined);
}

export async function recordExternalApproval(changeOrderId: string, input: unknown) {
  return run(externalApprovalSchema, input, async (supabase, v) =>
    supabase.rpc("record_external_change_order_approval", {
      p_change_order_id: changeOrderId,
      p_approver_name: v.approverName,
      p_approver_title: v.approverTitle,
      p_approved_on: v.approvedOn,
      p_method: v.method,
      p_evidence_path: v.evidencePath,
      p_evidence_reference: v.evidenceReference,
    }),
  );
}

export async function voidChangeOrder(changeOrderId: string, input: unknown) {
  return run(reasonSchema, input, async (supabase, v) =>
    supabase.rpc("void_change_order", { p_change_order_id: changeOrderId, p_note: v.reason }),
  );
}

/** Client decision in the portal. */
export async function approveChangeOrder(changeOrderId: string): Promise<ActionResult<undefined>> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("approve_change_order", {
    p_change_order_id: changeOrderId,
  });
  if (error) return dbError(error);
  refresh();
  return ok(undefined);
}

export async function rejectChangeOrder(changeOrderId: string, input: unknown) {
  return run(rejectChangeOrderSchema, input, async (supabase, v) =>
    supabase.rpc("reject_change_order", { p_change_order_id: changeOrderId, p_note: v.note }),
  );
}

// Invoices ----------------------------------------------------------------------------
export async function saveInvoiceDraft(
  contractId: string,
  invoiceId: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireViewer();
  const parsed = invoiceDraftSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();

  let id = invoiceId;
  if (id) {
    const updated = expectRow(
      await supabase.from("invoices").update({ memo: parsed.data.memo }).eq("id", id).select("id"),
    );
    if (updated.error) return dbError(updated.error);
    const { error } = await supabase.from("invoice_lines").delete().eq("invoice_id", id);
    if (error) return dbError(error);
  } else {
    const { data, error } = await supabase
      .from("invoices")
      .insert(inherited<"invoices">({ contract_id: contractId, memo: parsed.data.memo }))
      .select("id")
      .single();
    if (error) return dbError(error);
    id = data.id;
  }

  const { error } = await supabase.from("invoice_lines").insert(
    parsed.data.lines.map((line, index) =>
      inherited<"invoice_lines">({
        invoice_id: id!,
        position: index + 1,
        description: line.description,
        amount_minor: line.amount,
        ...lineSource(line.source),
      }),
    ),
  );
  if (error) return dbError(error);
  refresh();
  return ok({ id: id! });
}

export async function deleteInvoiceDraft(invoiceId: string): Promise<ActionResult<undefined>> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const result = expectRow(
    await supabase.from("invoices").delete().eq("id", invoiceId).select("id"),
  );
  if (result.error) return dbError(result.error);
  refresh();
  return ok(undefined);
}

export async function scheduleInvoice(invoiceId: string, input: unknown) {
  return run(scheduleInvoiceSchema, input, async (supabase, v) =>
    supabase.rpc("schedule_invoice", {
      p_invoice_id: invoiceId,
      p_scheduled_issue_date: v.scheduledIssueDate as string,
    }),
  );
}

export async function issueInvoice(invoiceId: string, input: unknown) {
  return run(issueInvoiceSchema, input, async (supabase, v) =>
    supabase.rpc("issue_invoice", {
      p_invoice_id: invoiceId,
      p_issue_date: v.issueDate,
      ...(v.dueDate ? { p_due_date: v.dueDate } : {}),
    }),
  );
}

export async function voidInvoice(invoiceId: string, input: unknown) {
  return run(reasonSchema, input, async (supabase, v) =>
    supabase.rpc("void_invoice", { p_invoice_id: invoiceId, p_reason: v.reason }),
  );
}

export async function setPaymentLink(invoiceId: string, input: unknown) {
  return run(paymentLinkSchema, input, async (supabase, v) =>
    supabase.from("invoice_payment_links").upsert(
      inherited<"invoice_payment_links">({
        invoice_id: invoiceId,
        url: v.url,
        provider: v.provider || null,
        provider_reference: v.providerReference || null,
      }),
      { onConflict: "invoice_id" },
    ),
  );
}

export async function removePaymentLink(invoiceId: string): Promise<ActionResult<undefined>> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const result = expectRow(
    await supabase
      .from("invoice_payment_links")
      .delete()
      .eq("invoice_id", invoiceId)
      .select("invoice_id"),
  );
  if (result.error) return dbError(result.error);
  refresh();
  return ok(undefined);
}

// Credit notes ------------------------------------------------------------------------
/** Creates the credit note and issues it; if issuing fails, the draft is removed. */
export async function issueCreditNote(invoiceId: string, input: unknown) {
  return run(creditNoteSchema, input, async (supabase, v) => {
    const { data, error } = await supabase
      .from("credit_notes")
      .insert(
        inherited<"credit_notes">({
          invoice_id: invoiceId,
          amount_minor: v.amount,
          reason: v.reason,
        }),
      )
      .select("id")
      .single();
    if (error) return { error };
    const issued = await supabase.rpc("issue_credit_note", {
      p_credit_note_id: data.id,
      p_issue_date: v.issueDate,
    });
    if (issued.error) {
      await supabase.from("credit_notes").delete().eq("id", data.id);
      return { error: issued.error };
    }
    return { data: issued.data, error: null };
  });
}

export async function voidCreditNote(creditNoteId: string, input: unknown) {
  return run(reasonSchema, input, async (supabase, v) =>
    supabase.rpc("void_credit_note", { p_credit_note_id: creditNoteId, p_reason: v.reason }),
  );
}

// Cash ----------------------------------------------------------------------------------
export async function recordPayment(contractId: string, input: unknown) {
  return run(paymentSchema, input, async (supabase, v) => {
    const total = v.allocations.reduce((sum, a) => sum + a.amount, 0);
    if (total > v.amount) {
      return {
        error: {
          code: "23514",
          message: "The allocations add up to more than the payment.",
          details: "",
          hint: "",
          name: "PostgrestError",
        } as PostgrestError,
      };
    }
    return supabase.rpc("record_payment", {
      p_contract_id: contractId,
      p_amount_minor: v.amount,
      p_received_on: v.receivedOn,
      p_method: v.method,
      p_reference: v.reference,
      p_payer_name: v.payerName,
      p_allocations: v.allocations.map((a) => ({
        invoice_id: a.invoiceId,
        amount_minor: a.amount,
      })),
    });
  });
}

export async function allocatePayment(paymentId: string, input: unknown) {
  return run(allocationSchema, input, async (supabase, v) =>
    supabase.rpc("allocate_payment", {
      p_payment_id: paymentId,
      p_invoice_id: v.invoiceId,
      p_amount_minor: v.amount,
    }),
  );
}

export async function reverseAllocation(allocationId: string, input: unknown) {
  return run(reasonSchema, input, async (supabase, v) =>
    supabase.rpc("reverse_allocation", { p_allocation_id: allocationId, p_reason: v.reason }),
  );
}

export async function reversePayment(paymentId: string, input: unknown) {
  return run(reasonSchema, input, async (supabase, v) =>
    supabase.rpc("reverse_payment", { p_payment_id: paymentId, p_reason: v.reason }),
  );
}

export async function recordRefund(contractId: string, input: unknown) {
  return run(refundSchema, input, async (supabase, v) =>
    supabase.rpc("record_refund", {
      p_contract_id: contractId,
      p_amount_minor: v.amount,
      p_refunded_on: v.refundedOn,
      p_method: v.method,
      p_reason: v.reason,
      ...(v.paymentId ? { p_payment_id: v.paymentId } : {}),
      p_reference: v.reference,
    }),
  );
}

export async function voidRefund(refundId: string, input: unknown) {
  return run(reasonSchema, input, async (supabase, v) =>
    supabase.rpc("void_refund", { p_refund_id: refundId, p_reason: v.reason }),
  );
}

// Internal notes --------------------------------------------------------------------------
type NoteEntity = Database["public"]["Tables"]["finance_notes"]["Insert"]["entity_type"];

export async function addFinanceNote(
  engagementId: string,
  entityType: NoteEntity,
  entityId: string,
  input: unknown,
) {
  return run(financeNoteSchema, input, async (supabase, v) =>
    supabase.from("finance_notes").insert({
      engagement_id: engagementId,
      entity_type: entityType,
      entity_id: entityId,
      body: v.body,
    }),
  );
}
