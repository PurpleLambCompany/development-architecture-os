import {
  allocatePayment,
  recordRefund,
  reverseAllocation,
  reversePayment,
  voidRefund,
} from "@/domain/finance/actions";
import type { OpenInvoice } from "@/domain/finance/allocation";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/domain/finance/catalog";
import { formatMoney } from "@/domain/finance/money";
import type { LoadedFinances } from "@/domain/finance/queries";
import { formatDate } from "@/lib/format";
import { ActionForm } from "@/components/ui/action-form";
import { PaymentForm } from "@/components/finance/payment-form";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

const reasonField = [{ name: "reason", label: "Reason", type: "textarea" as const }];
const methodOptions = PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));

export function openInvoices(finances: LoadedFinances): OpenInvoice[] {
  return finances.invoices
    .filter((i) => i.status === "issued" && (i.balance?.balance_minor ?? 0) > 0)
    .map((i) => ({
      id: i.id,
      invoiceNumber: i.invoice_number!,
      dueDate: i.due_date!,
      balanceMinor: i.balance!.balance_minor!,
    }));
}

/** Per payment: applied (active allocations) and refunded amounts, and what is left. */
export function paymentPosition(finances: LoadedFinances, paymentId: string) {
  const payment = finances.payments.find((p) => p.id === paymentId)!;
  const applied = finances.allocations
    .filter((a) => a.payment_id === paymentId && !a.reversed_at)
    .reduce((sum, a) => sum + a.amount_minor, 0);
  const refunded = finances.refunds
    .filter((r) => r.payment_id === paymentId && r.status === "completed")
    .reduce((sum, r) => sum + r.amount_minor, 0);
  const unapplied = payment.status === "recorded" ? payment.amount_minor - applied - refunded : 0;
  return { applied, refunded, unapplied };
}

/**
 * Cash: payments received, where each was applied, and refunds. Nothing
 * here is edited or deleted: allocations are reversed and re-applied, a
 * bounced payment is reversed, a refund is voided, each with a reason.
 */
export function CashPanels({
  finances,
  canManage,
  today,
}: {
  finances: LoadedFinances;
  canManage: boolean;
  today: string;
}) {
  const { contract, payments, allocations, refunds, summary } = finances;
  const currency = contract.currency;
  const open = openInvoices(finances);
  const invoiceNumber = new Map(finances.invoices.map((i) => [i.id, i.invoice_number]));
  const canReceive = contract.status !== "draft" && contract.status !== "void";
  const credit = summary?.unapplied_credit_minor ?? 0;
  const invoiceOptions = open.map((i) => ({
    value: i.id,
    label: `${i.invoiceNumber} · ${formatMoney(i.balanceMinor, currency)} open`,
  }));

  return (
    <>
      <Panel
        title="Payments"
        description={`Cash received. Credit on account: ${formatMoney(credit, currency)}.`}
      >
        <div className="space-y-4">
          {canManage && canReceive ? (
            <PaymentForm
              contractId={contract.id}
              openInvoices={open}
              currency={currency}
              today={today}
            />
          ) : null}
          {payments.length === 0 ? (
            <EmptyState title="No payments recorded" />
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {payments.map((payment) => {
                const position = paymentPosition(finances, payment.id);
                const mine = allocations.filter((a) => a.payment_id === payment.id);
                const reversed = payment.status === "reversed";
                return (
                  <li key={payment.id} className="space-y-3 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p>
                        <span className="font-medium tabular-nums">
                          {formatMoney(payment.amount_minor, currency)}
                        </span>
                        <span className="ml-2 text-sm text-ink-muted">
                          {formatDate(payment.received_on)} ·{" "}
                          {PAYMENT_METHOD_LABELS[payment.method]}
                          {payment.reference ? ` · ${payment.reference}` : ""}
                          {payment.payer_name ? ` · ${payment.payer_name}` : ""}
                        </span>
                      </p>
                      <p className="flex items-center gap-3 text-sm">
                        {reversed ? (
                          <StatusTag tone="negative">Reversed</StatusTag>
                        ) : (
                          <>
                            <span className="text-ink-muted">
                              Applied{" "}
                              <span className="text-ink tabular-nums">
                                {formatMoney(position.applied, currency)}
                              </span>
                            </span>
                            {position.refunded > 0 ? (
                              <span className="text-ink-muted">
                                Refunded{" "}
                                <span className="text-ink tabular-nums">
                                  {formatMoney(position.refunded, currency)}
                                </span>
                              </span>
                            ) : null}
                            <span className="text-ink-muted">
                              Unapplied{" "}
                              <span className="text-ink tabular-nums">
                                {formatMoney(position.unapplied, currency)}
                              </span>
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    {reversed ? (
                      <p className="text-sm text-ink-muted">Reversed: {payment.reversal_reason}</p>
                    ) : null}
                    {mine.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {mine.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center gap-3">
                            <span
                              className={a.reversed_at ? "text-ink-subtle line-through" : undefined}
                            >
                              <span className="tabular-nums">
                                {formatMoney(a.amount_minor, currency)}
                              </span>{" "}
                              to {invoiceNumber.get(a.invoice_id)}
                            </span>
                            {a.reversed_at ? (
                              <span className="text-xs text-ink-subtle">
                                Reversed: {a.reversal_reason}
                              </span>
                            ) : canManage ? (
                              <ActionForm
                                fields={reasonField}
                                action={reverseAllocation.bind(null, a.id)}
                                submitLabel="Reverse allocation"
                                variant="danger"
                                trigger="Reverse"
                              />
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {canManage && !reversed ? (
                      <div className="flex flex-wrap items-start gap-2">
                        {position.unapplied > 0 && open.length > 0 ? (
                          <ActionForm
                            fields={[
                              {
                                name: "invoiceId",
                                label: "Invoice",
                                type: "select",
                                options: invoiceOptions,
                              },
                              { name: "amount", label: "Amount", type: "money" },
                            ]}
                            defaultValues={{ invoiceId: open[0]!.id }}
                            action={allocatePayment.bind(null, payment.id)}
                            submitLabel="Apply"
                            trigger="Apply unapplied amount"
                          />
                        ) : null}
                        <ActionForm
                          fields={reasonField}
                          action={reversePayment.bind(null, payment.id)}
                          submitLabel="Reverse payment"
                          variant="danger"
                          trigger="Reverse payment"
                          confirm="Reverse this payment (for example, returned by the bank)? Its allocations are reversed too."
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>

      <Panel
        title="Refunds"
        description="Money returned from credit on account. Limited to the unapplied credit available."
      >
        <div className="space-y-4">
          {refunds.length === 0 ? (
            <EmptyState title="No refunds" />
          ) : (
            <ul className="divide-y divide-rule border-y border-rule text-sm">
              {refunds.map((refund) => (
                <li
                  key={refund.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(refund.amount_minor, currency)}
                    </span>
                    <span className="ml-2 text-ink-muted">
                      {formatDate(refund.refunded_on)} · {PAYMENT_METHOD_LABELS[refund.method]}
                      {refund.reference ? ` · ${refund.reference}` : ""} · {refund.reason}
                    </span>
                    {refund.status === "void" ? (
                      <span className="ml-2 text-xs text-ink-subtle">
                        Voided: {refund.void_reason}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusTag tone={refund.status === "completed" ? "accent" : "neutral"}>
                      {refund.status === "completed" ? "Completed" : "Void"}
                    </StatusTag>
                    {canManage && refund.status === "completed" ? (
                      <ActionForm
                        fields={reasonField}
                        action={voidRefund.bind(null, refund.id)}
                        submitLabel="Void refund"
                        variant="danger"
                        trigger="Void"
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManage && credit > 0 ? (
            <ActionForm
              fields={[
                {
                  name: "amount",
                  label: "Amount",
                  type: "money",
                  hint: `Up to ${formatMoney(credit, currency)}`,
                },
                { name: "refundedOn", label: "Date refunded", type: "date" },
                { name: "method", label: "Method", type: "select", options: methodOptions },
                {
                  name: "paymentId",
                  label: "From payment",
                  type: "select",
                  options: [
                    { value: "", label: "Credit on account (no specific payment)" },
                    ...payments
                      .filter((p) => paymentPosition(finances, p.id).unapplied > 0)
                      .map((p) => ({
                        value: p.id,
                        label: `${formatDate(p.received_on)} · ${formatMoney(paymentPosition(finances, p.id).unapplied, currency)} unapplied`,
                      })),
                  ],
                },
                {
                  name: "reference",
                  label: "Reference",
                  hint: "Confirmation number. Never an account number.",
                },
                { name: "reason", label: "Reason", type: "textarea" },
              ]}
              defaultValues={{ refundedOn: today, method: "ach" }}
              action={recordRefund.bind(null, contract.id)}
              submitLabel="Record refund"
              trigger="Record refund"
              confirm="Record this refund? It is permanent and can only be voided with a reason."
            />
          ) : null}
        </div>
      </Panel>
    </>
  );
}
