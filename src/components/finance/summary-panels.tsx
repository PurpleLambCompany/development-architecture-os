import { formatMoney } from "@/domain/finance/money";
import type { FinancialSummary } from "@/domain/finance/queries";
import { FigureGrid, SectionLabel } from "./figures";

/**
 * The full internal set of figures, grouped by the question each answers:
 * the price, what has been billed, what is owed now, and the cash.
 */
export function InternalSummary({ summary }: { summary: FinancialSummary }) {
  const c = summary.currency;
  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Price</SectionLabel>
        <FigureGrid
          currency={c}
          figures={[
            { label: "Original contract value", minor: summary.original_value_minor },
            { label: "Approved change orders", minor: summary.approved_changes_minor },
            { label: "Revised contract value", minor: summary.revised_value_minor, emphasis: true },
            {
              label: "Awaiting approval",
              minor: summary.pending_changes_minor,
              tone: "muted",
              hint: "Submitted change orders; not in the price",
            },
          ]}
        />
      </div>
      <div>
        <SectionLabel>Billing</SectionLabel>
        <FigureGrid
          currency={c}
          figures={[
            { label: "Gross invoiced", minor: summary.gross_invoiced_minor },
            { label: "Credit notes", minor: summary.credits_issued_minor },
            { label: "Net invoiced", minor: summary.net_invoiced_minor, emphasis: true },
            {
              label: "Remaining to invoice",
              minor: summary.remaining_to_invoice_minor,
              hint:
                summary.unscheduled_minor > 0
                  ? `${formatMoney(summary.unscheduled_minor, c)} not yet on the payment plan`
                  : undefined,
            },
          ]}
        />
      </div>
      <div>
        <SectionLabel>Owed on invoices</SectionLabel>
        <FigureGrid
          currency={c}
          figures={[
            {
              label: "Outstanding invoice balance",
              minor: summary.outstanding_balance_minor,
              emphasis: true,
            },
            {
              label: "Currently due",
              minor: summary.currently_due_minor,
              tone: "attention",
              hint: "Due today or earlier",
            },
            { label: "Past due", minor: summary.past_due_minor, tone: "negative" },
            { label: "Issued, not yet due", minor: summary.not_yet_due_minor },
          ]}
        />
      </div>
      <div>
        <SectionLabel>Cash received</SectionLabel>
        <FigureGrid
          columns={3}
          currency={c}
          figures={[
            {
              label: "Payments received",
              minor: summary.payments_received_minor,
              hint: "Excludes reversed payments",
            },
            { label: "Refunds", minor: summary.refunds_minor },
            { label: "Net cash received", minor: summary.net_cash_received_minor },
          ]}
        />
      </div>
      <div>
        <SectionLabel>Applied and remaining</SectionLabel>
        <FigureGrid
          currency={c}
          figures={[
            { label: "Payments applied", minor: summary.payments_applied_minor },
            {
              label: "Credit on account",
              minor: summary.unapplied_credit_minor,
              hint: "Received, not applied; never subtracted from what is due",
            },
            {
              label: "Remaining contract balance",
              minor: summary.remaining_contract_balance_minor,
              hint: "Revised value − payments applied",
            },
            {
              label: "Net remaining to collect",
              minor: summary.net_remaining_to_collect_minor,
              emphasis: true,
              hint: "Revised value − net cash received",
            },
          ]}
        />
      </div>
    </div>
  );
}
