import "server-only";
import { cache } from "react";
import { getBusinessTimeZone } from "@/lib/env.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { businessDate } from "./business-date";
import type { InvoicePaymentState, MilestonePaymentState } from "./catalog";

/**
 * Finance reads. Every query runs as the signed-in user, so row-level
 * security decides what is returned; a client's figures are computed only
 * from records the client may see. Figures come from the database read
 * models (one definition each), never recomputed here.
 */

type Functions = Database["public"]["Functions"];
type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

export type FinancialSummary = Nullable<
  Functions["contract_financial_summary"]["Returns"][number],
  | "next_payment_kind"
  | "next_payment_id"
  | "next_payment_label"
  | "next_payment_amount_minor"
  | "next_payment_date"
>;

export type InvoiceBalance = Omit<
  Nullable<
    Functions["invoice_balances"]["Returns"][number],
    "invoice_number" | "issue_date" | "due_date" | "total_minor" | "balance_minor"
  >,
  "payment_state"
> & { payment_state: InvoicePaymentState };

export type MilestoneBilling = Omit<
  Nullable<Functions["milestone_billing"]["Returns"][number], "due_date" | "stage_label">,
  "payment_state"
> & { payment_state: MilestonePaymentState };

/** Today's date in the business time zone (America/Chicago). */
export function getBusinessToday(): string {
  return businessDate(new Date(), getBusinessTimeZone());
}

export type FinanceDirectoryEntry = {
  engagementId: string;
  title: string;
  slug: string;
  status: Database["public"]["Enums"]["engagement_status"];
  clientName: string;
};

/**
 * Engagements the viewer may see financially. Works for Finance
 * Administrators, who have no project access to unassigned engagements.
 */
export const getFinanceDirectory = cache(async (): Promise<FinanceDirectoryEntry[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("finance_engagement_directory");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    engagementId: row.engagement_id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    clientName: row.client_name,
  }));
});

export async function getFinanceEngagementBySlug(slug: string) {
  return (await getFinanceDirectory()).find((entry) => entry.slug === slug) ?? null;
}

export type PortfolioRow = FinanceDirectoryEntry & {
  summary: FinancialSummary | null;
  pendingChangeOrders: number;
};

export async function getPortfolio(asOf: string): Promise<PortfolioRow[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: pending, error: pendingError }] = await Promise.all([
    supabase.rpc("portfolio_financial_summary", { p_as_of: asOf }),
    supabase.from("change_orders").select("engagement_id").eq("status", "submitted"),
  ]);
  if (error) throw error;
  if (pendingError) throw pendingError;
  const directory = await getFinanceDirectory();
  return (data ?? []).map((row) => {
    const entry = directory.find((d) => d.engagementId === row.engagement_id)!;
    return {
      ...entry,
      summary: (row.summary as FinancialSummary | null) ?? null,
      pendingChangeOrders: (pending ?? []).filter((p) => p.engagement_id === row.engagement_id)
        .length,
    };
  });
}

/** Everything the finance workspace or the client billing page shows for one engagement. */
export async function getEngagementFinances(engagementId: string, asOf: string) {
  const supabase = await createSupabaseServerClient();

  const { data: contracts, error: contractsError } = await supabase
    .from("contracts")
    .select("*")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false });
  if (contractsError) throw contractsError;

  const { data: primaryId } = await supabase.rpc("engagement_primary_contract_id", {
    p_engagement_id: engagementId,
  });
  const contract = contracts?.find((c) => c.id === primaryId) ?? null;
  if (!contract) {
    return { contracts: contracts ?? [], contract: null } as const;
  }

  const [
    summary,
    milestones,
    balances,
    invoices,
    creditNotes,
    changeOrders,
    changeOrderEvents,
    payments,
    allocations,
    refunds,
    paymentLinks,
    events,
  ] = await Promise.all([
    supabase.rpc("contract_financial_summary", { p_contract_id: contract.id, p_as_of: asOf }),
    supabase.rpc("milestone_billing", { p_contract_id: contract.id, p_as_of: asOf }),
    supabase.rpc("invoice_balances", { p_engagement_id: engagementId, p_as_of: asOf }),
    supabase
      .from("invoices")
      .select("*, invoice_lines(*)")
      .eq("contract_id", contract.id)
      .order("created_at"),
    supabase.from("credit_notes").select("*").eq("contract_id", contract.id).order("created_at"),
    supabase
      .from("change_orders")
      .select("*")
      .eq("contract_id", contract.id)
      .order("number", { nullsFirst: false })
      .order("created_at"),
    supabase
      .from("change_order_events")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("occurred_at"),
    supabase
      .from("payments")
      .select("*")
      .eq("contract_id", contract.id)
      .order("received_on", { ascending: false }),
    supabase
      .from("payment_allocations")
      .select("*")
      .eq("contract_id", contract.id)
      .order("created_at"),
    supabase.from("refunds").select("*").eq("contract_id", contract.id).order("refunded_on"),
    supabase.from("invoice_payment_links").select("*").eq("engagement_id", engagementId),
    supabase
      .from("financial_events")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);

  for (const result of [
    summary,
    milestones,
    balances,
    invoices,
    creditNotes,
    changeOrders,
    changeOrderEvents,
    payments,
    allocations,
    refunds,
    paymentLinks,
    events,
  ]) {
    if (result.error) throw result.error;
  }

  const balanceById = new Map(
    ((balances.data ?? []) as InvoiceBalance[]).map((b) => [b.invoice_id, b]),
  );

  return {
    contracts: contracts ?? [],
    contract,
    summary: ((summary.data ?? [])[0] ?? null) as FinancialSummary | null,
    milestones: (milestones.data ?? []) as MilestoneBilling[],
    invoices: (invoices.data ?? []).map((invoice) => ({
      ...invoice,
      balance: balanceById.get(invoice.id) ?? null,
      paymentLink: (paymentLinks.data ?? []).find((l) => l.invoice_id === invoice.id) ?? null,
    })),
    creditNotes: creditNotes.data ?? [],
    changeOrders: changeOrders.data ?? [],
    changeOrderEvents: changeOrderEvents.data ?? [],
    payments: payments.data ?? [],
    allocations: allocations.data ?? [],
    refunds: refunds.data ?? [],
    events: events.data ?? [],
  } as const;
}

export type EngagementFinances = Awaited<ReturnType<typeof getEngagementFinances>>;
export type LoadedFinances = Extract<EngagementFinances, { contract: object }>;

/** Internal finance notes (RLS limits them to TPLCo financial viewers). */
export async function listFinanceNotes(engagementId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("finance_notes")
    .select("*, profiles:created_by(first_name, last_name, email)")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
