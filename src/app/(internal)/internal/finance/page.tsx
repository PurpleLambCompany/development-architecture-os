import Link from "next/link";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { CONTRACT_STATUS } from "@/domain/finance/catalog";
import { formatMoney } from "@/domain/finance/money";
import { getBusinessToday, getPortfolio, type PortfolioRow } from "@/domain/finance/queries";
import { FigureGrid } from "@/components/finance/figures";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const VIEWS = {
  all: "All engagements",
  past_due: "Past due",
  awaiting: "Awaiting approval",
  credit: "Credit on account",
} as const;
type View = keyof typeof VIEWS;

function matches(row: PortfolioRow, view: View) {
  const s = row.summary;
  if (view === "past_due") return (s?.past_due_minor ?? 0) > 0;
  if (view === "awaiting") return row.pendingChangeOrders > 0;
  if (view === "credit") return (s?.unapplied_credit_minor ?? 0) > 0;
  return true;
}

/**
 * Finance portfolio: every engagement the viewer may see financially. RLS
 * and finance_engagement_directory decide the rows; Finance Administrators
 * see every engagement here without project access.
 */
export default async function FinancePortfolioPage({
  searchParams,
}: PageProps<"/internal/finance">) {
  await requireInternal();
  const { view: rawView } = await searchParams;
  const view: View = typeof rawView === "string" && rawView in VIEWS ? (rawView as View) : "all";
  const today = getBusinessToday();
  const rows = await getPortfolio(today);
  const shown = rows.filter((row) => matches(row, view));

  // Totals by currency: amounts in different currencies are never added.
  const currencies = [...new Set(rows.map((r) => r.summary?.currency).filter(Boolean))] as string[];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Finance"
        title="Portfolio"
        description={`Figures as of ${formatDate(today)}, business time (America/Chicago).`}
      />

      {rows.length === 0 ? (
        <Panel>
          <EmptyState title="No financial access">
            You do not have financial visibility on any engagement.
          </EmptyState>
        </Panel>
      ) : (
        <>
          {currencies.map((currency) => {
            const sum = (key: keyof NonNullable<PortfolioRow["summary"]>) =>
              rows
                .filter((r) => r.summary?.currency === currency)
                .reduce((total, r) => total + Number(r.summary?.[key] ?? 0), 0);
            return (
              <FigureGrid
                key={currency}
                currency={currency}
                figures={[
                  {
                    label: `Revised contract value (${currency})`,
                    minor: sum("revised_value_minor"),
                  },
                  { label: "Net invoiced", minor: sum("net_invoiced_minor") },
                  { label: "Outstanding invoices", minor: sum("outstanding_balance_minor") },
                  { label: "Past due", minor: sum("past_due_minor"), tone: "negative" },
                  { label: "Payments applied", minor: sum("payments_applied_minor") },
                  { label: "Credit on account", minor: sum("unapplied_credit_minor") },
                  { label: "Remaining to invoice", minor: sum("remaining_to_invoice_minor") },
                  {
                    label: "Net remaining to collect",
                    minor: sum("net_remaining_to_collect_minor"),
                  },
                ]}
              />
            );
          })}

          <Panel>
            <nav className="-mt-1 mb-3 flex flex-wrap gap-1 text-sm" aria-label="Filter">
              {(Object.keys(VIEWS) as View[]).map((key) => (
                <Link
                  key={key}
                  href={key === "all" ? "/internal/finance" : `/internal/finance?view=${key}`}
                  aria-current={view === key ? "page" : undefined}
                  className={cn(
                    "rounded-sm px-3 py-1.5",
                    view === key
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-ink-muted hover:bg-rule/40",
                  )}
                >
                  {VIEWS[key]}
                </Link>
              ))}
            </nav>
            {shown.length === 0 ? (
              <EmptyState title="Nothing here" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Engagement</Th>
                    <Th>Contract</Th>
                    <Th className="text-right">Revised value</Th>
                    <Th className="text-right">Net invoiced</Th>
                    <Th className="text-right">Paid</Th>
                    <Th className="text-right">Credit</Th>
                    <Th className="text-right">Currently due</Th>
                    <Th className="text-right">Past due</Th>
                    <Th>Next payment</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const s = row.summary;
                    const money = (minor: number | undefined) =>
                      s ? formatMoney(minor ?? 0, s.currency) : "—";
                    return (
                      <tr key={row.engagementId}>
                        <Td>
                          <Link
                            href={`/internal/finance/${row.slug}`}
                            className="font-medium hover:underline"
                          >
                            {row.title}
                          </Link>
                          <p className="text-xs text-ink-subtle">{row.clientName}</p>
                          {row.pendingChangeOrders > 0 ? (
                            <p className="mt-1">
                              <StatusTag tone="attention">
                                {`${row.pendingChangeOrders} awaiting approval`}
                              </StatusTag>
                            </p>
                          ) : null}
                        </Td>
                        <Td>
                          {s ? (
                            <StatusTag tone={CONTRACT_STATUS[s.contract_status].tone}>
                              {CONTRACT_STATUS[s.contract_status].label}
                            </StatusTag>
                          ) : (
                            <span className="text-ink-subtle">None</span>
                          )}
                        </Td>
                        <Td className="text-right tabular-nums">{money(s?.revised_value_minor)}</Td>
                        <Td className="text-right tabular-nums">{money(s?.net_invoiced_minor)}</Td>
                        <Td className="text-right tabular-nums">
                          {money(s?.payments_applied_minor)}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {money(s?.unapplied_credit_minor)}
                        </Td>
                        <Td className="text-right tabular-nums">{money(s?.currently_due_minor)}</Td>
                        <Td
                          className={cn(
                            "text-right tabular-nums",
                            (s?.past_due_minor ?? 0) > 0 && "text-negative",
                          )}
                        >
                          {money(s?.past_due_minor)}
                        </Td>
                        <Td className="text-sm">
                          {s?.next_payment_amount_minor ? (
                            <>
                              <span className="tabular-nums">
                                {formatMoney(s.next_payment_amount_minor, s.currency)}
                              </span>
                              <p className="text-xs text-ink-subtle">
                                {[s.next_payment_label, formatDate(s.next_payment_date)]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </>
                          ) : (
                            <span className="text-ink-subtle">—</span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
