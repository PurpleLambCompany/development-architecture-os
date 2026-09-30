import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { getMyEngagementCapabilities } from "@/domain/capabilities/queries";
import { getEngagementBySlug } from "@/domain/engagements/queries";
import {
  APPROVAL_SOURCE_LABELS,
  CHANGE_ORDER_STATUS,
  INVOICE_STATE,
  PAYMENT_METHOD_LABELS,
} from "@/domain/finance/catalog";
import { formatMoney, formatSignedMoney } from "@/domain/finance/money";
import {
  getBusinessToday,
  getEngagementFinances,
  type LoadedFinances,
} from "@/domain/finance/queries";
import { ChangeOrderDecision } from "@/components/finance/change-order-decision";
import { FigureGrid } from "@/components/finance/figures";
import { PaymentJourney } from "@/components/finance/payment-journey";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

/**
 * Client billing. Shown only with view_financials; every record comes
 * through RLS, which also hides drafts, internal notes and internal events.
 * The payment journey is its own track, separate from the architecture.
 */
export default async function ClientBillingPage({ params }: PageProps<"/portal/[slug]/billing">) {
  const { slug } = await params;
  await requireClient();
  const engagement = await getEngagementBySlug(slug);
  if (!engagement) notFound();
  const capabilities = await getMyEngagementCapabilities(engagement.id);
  if (!capabilities.has("view_financials")) notFound();

  const today = getBusinessToday();
  const finances = await getEngagementFinances(engagement.id, today);

  return (
    <div className="space-y-8">
      <EngagementNav slug={engagement.slug} current="billing" seesBilling />
      <PageHeader
        eyebrow={engagement.organizations?.name ?? "Billing"}
        title="Billing"
        description={`${engagement.title} · as of ${formatDate(today)}`}
      />
      {finances.contract === null || !finances.summary ? (
        <Panel>
          <EmptyState title="Billing information is not yet available">
            Your contract, payment schedule and invoices will appear here once the agreement is
            executed.
          </EmptyState>
        </Panel>
      ) : (
        <Billing
          finances={finances as LoadedFinances}
          slug={engagement.slug}
          canApprove={capabilities.has("approve_change_orders")}
          canPay={capabilities.has("pay_invoices")}
        />
      )}
    </div>
  );
}

function Billing({
  finances,
  slug,
  canApprove,
  canPay,
}: {
  finances: LoadedFinances;
  slug: string;
  canApprove: boolean;
  canPay: boolean;
}) {
  const summary = finances.summary!;
  const currency = summary.currency;
  const issued = finances.invoices.filter((i) => i.status === "issued" || i.status === "void");
  const awaiting = finances.changeOrders.filter((co) => co.status === "submitted");
  const decided = finances.changeOrders.filter((co) => co.status !== "submitted");
  const invoiceNumber = new Map(finances.invoices.map((i) => [i.id, i.invoice_number]));

  return (
    <>
      <Panel title="Summary">
        <div className="space-y-4">
          <FigureGrid
            columns={3}
            currency={currency}
            figures={[
              { label: "Original contract value", minor: summary.original_value_minor },
              { label: "Approved change orders", minor: summary.approved_changes_minor },
              {
                label: "Revised contract value",
                minor: summary.revised_value_minor,
                emphasis: true,
              },
            ]}
          />
          <FigureGrid
            columns={3}
            currency={currency}
            figures={[
              {
                label: "Currently due",
                minor: summary.currently_due_minor,
                tone: "attention",
                emphasis: true,
                hint: "Invoices due today or earlier",
              },
              { label: "Past due", minor: summary.past_due_minor, tone: "negative" },
              { label: "Invoiced, not yet due", minor: summary.not_yet_due_minor },
            ]}
          />
          <FigureGrid
            currency={currency}
            figures={[
              {
                label: "Amount paid",
                minor: summary.payments_applied_minor,
                hint: "Payments applied to invoices",
              },
              {
                label: "Credit on account",
                minor: summary.unapplied_credit_minor,
                hint: "Received and not yet applied to an invoice",
              },
              { label: "Remaining to invoice", minor: summary.remaining_to_invoice_minor },
              {
                label: "Net remaining to collect",
                minor: summary.net_remaining_to_collect_minor,
                emphasis: true,
                hint: "Revised contract value less net payments received",
              },
            ]}
          />
          {summary.next_payment_amount_minor ? (
            <p className="text-sm text-ink-muted">
              Next payment:{" "}
              <span className="font-medium text-ink tabular-nums">
                {formatMoney(summary.next_payment_amount_minor, currency)}
              </span>
              {summary.next_payment_label ? ` · ${summary.next_payment_label}` : ""}
              {summary.next_payment_date ? ` · ${formatDate(summary.next_payment_date)}` : ""}
              {summary.next_payment_kind === "milestone" ? " (planned; not yet invoiced)" : ""}
            </p>
          ) : null}
          {summary.refunds_minor > 0 ? (
            <p className="text-sm text-ink-muted">
              Refunded to you:{" "}
              <span className="tabular-nums">{formatMoney(summary.refunds_minor, currency)}</span>
            </p>
          ) : null}
        </div>
      </Panel>

      {awaiting.length > 0 ? (
        <Panel title="Change orders awaiting your decision">
          <ul className="divide-y divide-rule">
            {awaiting.map((co) => (
              <li key={co.id} className="space-y-3 py-4 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-medium">
                    <span className="mr-2 text-ink-subtle">CO-{co.number}</span>
                    {co.title}
                  </p>
                  <span className="font-serif text-lg tabular-nums">
                    {formatSignedMoney(co.amount_minor, currency)}
                  </span>
                </div>
                {co.description ? <p className="text-sm text-ink-muted">{co.description}</p> : null}
                {co.scope_impact ? (
                  <p className="text-sm text-ink-muted">Scope: {co.scope_impact}</p>
                ) : null}
                {co.schedule_impact ? (
                  <p className="text-sm text-ink-muted">Schedule: {co.schedule_impact}</p>
                ) : null}
                <p className="text-sm text-ink-muted">
                  If approved, the contract value becomes{" "}
                  <span className="text-ink tabular-nums">
                    {formatMoney(summary.revised_value_minor + co.amount_minor, currency)}
                  </span>
                  .
                </p>
                {canApprove ? (
                  <ChangeOrderDecision
                    changeOrderId={co.id}
                    amountLabel={formatSignedMoney(co.amount_minor, currency)}
                  />
                ) : (
                  <p className="text-xs text-ink-subtle">
                    Awaiting a decision from your authorized approver.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel
        title="Payment journey"
        description="The payment schedule, separate from the architecture journey."
      >
        {finances.milestones.length === 0 ? (
          <EmptyState title="No payment schedule yet" />
        ) : (
          <PaymentJourney milestones={finances.milestones} currency={currency} />
        )}
      </Panel>

      <Panel title="Invoices">
        {issued.length === 0 ? (
          <EmptyState title="No invoices yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Issued</Th>
                <Th>Due</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Balance</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {issued.map((invoice) => {
                const state = INVOICE_STATE[invoice.balance?.payment_state ?? "open"];
                return (
                  <tr key={invoice.id}>
                    <Td>
                      <Link
                        href={`/portal/${slug}/billing/invoices/${invoice.id}`}
                        className="font-medium hover:underline"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </Td>
                    <Td>{formatDate(invoice.issue_date)}</Td>
                    <Td>{formatDate(invoice.due_date)}</Td>
                    <Td className="text-right tabular-nums">
                      {formatMoney(invoice.total_minor ?? 0, currency)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {invoice.status === "issued"
                        ? formatMoney(invoice.balance?.balance_minor ?? 0, currency)
                        : "—"}
                    </Td>
                    <Td>
                      <StatusTag tone={state.tone}>{state.label}</StatusTag>
                      {invoice.status === "void" && invoice.void_reason ? (
                        <p className="mt-1 text-xs text-ink-subtle">{invoice.void_reason}</p>
                      ) : null}
                    </Td>
                    <Td className="text-right">
                      {canPay && invoice.paymentLink ? (
                        <a
                          href={invoice.paymentLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-accent hover:underline"
                        >
                          Pay online
                        </a>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      {finances.creditNotes.length > 0 ? (
        <Panel title="Credit notes">
          <Table>
            <thead>
              <tr>
                <Th>Credit note</Th>
                <Th>Invoice</Th>
                <Th>Issued</Th>
                <Th>Reason</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {finances.creditNotes.map((cn) => (
                <tr key={cn.id}>
                  <Td className="font-medium">
                    {cn.credit_note_number}
                    {cn.status === "void" ? (
                      <span className="ml-2">
                        <StatusTag>Void</StatusTag>
                      </span>
                    ) : null}
                  </Td>
                  <Td>{invoiceNumber.get(cn.invoice_id)}</Td>
                  <Td>{formatDate(cn.issue_date)}</Td>
                  <Td className="text-ink-muted">{cn.reason}</Td>
                  <Td className="text-right tabular-nums">
                    {formatMoney(cn.amount_minor, currency)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      ) : null}

      <Panel title="Payments received">
        {finances.payments.length === 0 ? (
          <EmptyState title="No payments recorded yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Received</Th>
                <Th>Method</Th>
                <Th>Reference</Th>
                <Th>Applied to</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {finances.payments.map((payment) => {
                const applied = finances.allocations.filter(
                  (a) => a.payment_id === payment.id && !a.reversed_at,
                );
                return (
                  <tr key={payment.id}>
                    <Td>{formatDate(payment.received_on)}</Td>
                    <Td>{PAYMENT_METHOD_LABELS[payment.method]}</Td>
                    <Td className="text-ink-muted">{payment.reference}</Td>
                    <Td className="text-sm">
                      {payment.status === "reversed" ? (
                        <StatusTag tone="negative">Reversed</StatusTag>
                      ) : applied.length === 0 ? (
                        <span className="text-ink-muted">Credit on account</span>
                      ) : (
                        applied
                          .map(
                            (a) =>
                              `${invoiceNumber.get(a.invoice_id)} (${formatMoney(a.amount_minor, currency)})`,
                          )
                          .join(", ")
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatMoney(payment.amount_minor, currency)}
                    </Td>
                  </tr>
                );
              })}
              {finances.refunds
                .filter((r) => r.status === "completed")
                .map((refund) => (
                  <tr key={refund.id}>
                    <Td>{formatDate(refund.refunded_on)}</Td>
                    <Td>Refund · {PAYMENT_METHOD_LABELS[refund.method]}</Td>
                    <Td className="text-ink-muted">{refund.reference}</Td>
                    <Td className="text-sm text-ink-muted">{refund.reason}</Td>
                    <Td className="text-right tabular-nums">
                      −{formatMoney(refund.amount_minor, currency)}
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {decided.length > 0 ? (
        <Panel title="Change order history">
          <ul className="divide-y divide-rule text-sm">
            {decided.map((co) => (
              <li key={co.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                <span>
                  <span className="mr-2 text-ink-subtle">CO-{co.number}</span>
                  {co.title}
                  {co.approval_source ? (
                    <span className="block text-xs text-ink-subtle">
                      {APPROVAL_SOURCE_LABELS[co.approval_source]}
                      {co.external_approver_name ? ` · ${co.external_approver_name}` : ""}
                      {co.external_approved_on ? ` · ${formatDate(co.external_approved_on)}` : ""}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">
                    {formatSignedMoney(co.amount_minor, currency)}
                  </span>
                  <StatusTag tone={CHANGE_ORDER_STATUS[co.status].tone}>
                    {CHANGE_ORDER_STATUS[co.status].label}
                  </StatusTag>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
