import {
  deleteInvoiceDraft,
  issueCreditNote,
  issueInvoice,
  removePaymentLink,
  scheduleInvoice,
  setPaymentLink,
  voidCreditNote,
  voidInvoice,
} from "@/domain/finance/actions";
import { CREDIT_NOTE_STATUS, INVOICE_STATE } from "@/domain/finance/catalog";
import { formatMoney, toDecimalString } from "@/domain/finance/money";
import type { LoadedFinances } from "@/domain/finance/queries";
import { formatDate } from "@/lib/format";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { InvoiceDraftForm, type BillableSource } from "@/components/finance/invoice-draft-form";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

const reasonField = [{ name: "reason", label: "Reason", type: "textarea" as const }];

/** What each milestone and approved positive change order may still bill. */
export function billableSources(finances: LoadedFinances): BillableSource[] {
  const currency = finances.contract.currency;
  const issuedLines = finances.invoices
    .filter((i) => i.status === "issued")
    .flatMap((i) => i.invoice_lines);
  const milestones = finances.milestones
    .filter((m) => m.status !== "cancelled")
    .map((m) => {
      const remaining = m.amount_minor - m.billed_minor;
      return {
        value: `milestone:${m.milestone_id}`,
        label: `Milestone ${m.sequence}: ${m.title} (${formatMoney(remaining, currency)} left)`,
        remainingMinor: remaining,
      };
    });
  const changeOrders = finances.changeOrders
    .filter((co) => co.status === "approved" && co.amount_minor > 0)
    .map((co) => {
      const billed = issuedLines
        .filter((l) => l.change_order_id === co.id)
        .reduce((sum, l) => sum + l.amount_minor, 0);
      const remaining = co.amount_minor - billed;
      return {
        value: `change_order:${co.id}`,
        label: `CO-${co.number}: ${co.title} (${formatMoney(remaining, currency)} left)`,
        remainingMinor: remaining,
      };
    });
  return [...milestones, ...changeOrders];
}

/**
 * Invoices: drafts are edited freely; issuing assigns the permanent number,
 * freezes the total and checks anti-double-billing. Issued invoices change
 * only through credit notes, payments, or voiding when nothing is applied.
 */
export function InvoicesPanel({
  finances,
  canManage,
  today,
}: {
  finances: LoadedFinances;
  canManage: boolean;
  today: string;
}) {
  const { contract, invoices, creditNotes, allocations, payments } = finances;
  const currency = contract.currency;
  const sources = billableSources(finances);
  const isCurrent = contract.status === "executed" || contract.status === "active";
  const milestoneTitle = new Map(finances.milestones.map((m) => [m.milestone_id, m.title]));
  const coNumber = new Map(finances.changeOrders.map((co) => [co.id, co.number]));

  return (
    <Panel
      title="Invoices"
      description={`Numbered TPL-YYYY-NNNN when issued. Due dates default to Net ${contract.payment_terms_days}.`}
    >
      <div className="space-y-4">
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {invoices.map((invoice) => {
              const balance = invoice.balance;
              const state =
                INVOICE_STATE[
                  balance?.payment_state ?? (invoice.status === "issued" ? "open" : invoice.status)
                ];
              const draft = invoice.status === "draft" || invoice.status === "scheduled";
              const lineTotal = invoice.invoice_lines.reduce((sum, l) => sum + l.amount_minor, 0);
              const credits = creditNotes.filter((cn) => cn.invoice_id === invoice.id);
              const applied = allocations.filter((a) => a.invoice_id === invoice.id);
              return (
                <li key={invoice.id}>
                  <details className="group">
                    <summary className="grid cursor-pointer grid-cols-[1fr_auto] items-baseline gap-4 py-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
                      <span className="font-medium">
                        {invoice.invoice_number ?? "Draft invoice"}
                        <span className="ml-2 text-xs font-normal text-ink-subtle">
                          {invoice.issue_date
                            ? `Issued ${formatDate(invoice.issue_date)}`
                            : invoice.scheduled_issue_date
                              ? `Scheduled ${formatDate(invoice.scheduled_issue_date)}`
                              : "Not issued"}
                        </span>
                      </span>
                      <span className="hidden text-sm text-ink-muted sm:block">
                        {invoice.due_date ? `Due ${formatDate(invoice.due_date)}` : ""}
                      </span>
                      <span className="hidden text-right tabular-nums sm:block">
                        {formatMoney(invoice.total_minor ?? lineTotal, currency)}
                      </span>
                      <span className="hidden text-right text-sm tabular-nums sm:block">
                        {balance?.balance_minor != null
                          ? `${formatMoney(balance.balance_minor, currency)} open`
                          : ""}
                      </span>
                      <StatusTag tone={state.tone}>{state.label}</StatusTag>
                    </summary>

                    <div className="space-y-4 pb-5">
                      {invoice.memo ? (
                        <p className="text-sm text-ink-muted">{invoice.memo}</p>
                      ) : null}
                      <table className="w-full text-sm">
                        <tbody>
                          {invoice.invoice_lines
                            .toSorted((a, b) => a.position - b.position)
                            .map((line) => (
                              <tr key={line.id} className="border-b border-rule/60">
                                <td className="py-1.5">
                                  {line.description}
                                  <span className="ml-2 text-xs text-ink-subtle">
                                    {line.payment_milestone_id
                                      ? `Milestone: ${milestoneTitle.get(line.payment_milestone_id) ?? ""}`
                                      : line.change_order_id
                                        ? `CO-${coNumber.get(line.change_order_id) ?? ""}`
                                        : ""}
                                  </span>
                                </td>
                                <td className="py-1.5 text-right tabular-nums">
                                  {formatMoney(line.amount_minor, currency)}
                                </td>
                              </tr>
                            ))}
                          {balance && invoice.status === "issued" ? (
                            <>
                              <tr>
                                <td className="pt-2 text-ink-muted">Credit notes</td>
                                <td className="pt-2 text-right tabular-nums">
                                  −{formatMoney(balance.credited_minor, currency)}
                                </td>
                              </tr>
                              <tr>
                                <td className="text-ink-muted">Payments applied</td>
                                <td className="text-right tabular-nums">
                                  −{formatMoney(balance.applied_minor, currency)}
                                </td>
                              </tr>
                              <tr className="font-medium">
                                <td>Balance</td>
                                <td className="text-right tabular-nums">
                                  {formatMoney(balance.balance_minor ?? 0, currency)}
                                </td>
                              </tr>
                            </>
                          ) : null}
                        </tbody>
                      </table>

                      {credits.length > 0 ? (
                        <div className="text-sm">
                          <p className="mb-1 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                            Credit notes
                          </p>
                          <ul className="space-y-2">
                            {credits.map((cn) => (
                              <li key={cn.id} className="flex flex-wrap items-center gap-3">
                                <span className="font-medium">
                                  {cn.credit_note_number ?? "Draft"}
                                </span>
                                <span className="tabular-nums">
                                  {formatMoney(cn.amount_minor, currency)}
                                </span>
                                <span className="text-ink-muted">{cn.reason}</span>
                                <StatusTag tone={CREDIT_NOTE_STATUS[cn.status].tone}>
                                  {CREDIT_NOTE_STATUS[cn.status].label}
                                </StatusTag>
                                {canManage && cn.status === "issued" ? (
                                  <ActionForm
                                    fields={reasonField}
                                    action={voidCreditNote.bind(null, cn.id)}
                                    submitLabel="Void credit note"
                                    variant="danger"
                                    trigger="Void"
                                  />
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {applied.length > 0 ? (
                        <div className="text-sm">
                          <p className="mb-1 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                            Payments applied
                          </p>
                          <ul className="space-y-1">
                            {applied.map((a) => {
                              const payment = payments.find((p) => p.id === a.payment_id);
                              return (
                                <li
                                  key={a.id}
                                  className={
                                    a.reversed_at ? "text-ink-subtle line-through" : undefined
                                  }
                                >
                                  <span className="tabular-nums">
                                    {formatMoney(a.amount_minor, currency)}
                                  </span>{" "}
                                  from the{" "}
                                  {payment
                                    ? `${formatDate(payment.received_on)} payment`
                                    : "payment"}
                                  {payment?.reference ? ` (${payment.reference})` : ""}
                                  {a.reversed_at ? ` · reversed: ${a.reversal_reason}` : ""}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}

                      {invoice.paymentLink ? (
                        <p className="text-sm">
                          Payment link:{" "}
                          <span className="text-ink-muted">{invoice.paymentLink.url}</span>
                          {invoice.paymentLink.provider ? ` (${invoice.paymentLink.provider})` : ""}
                        </p>
                      ) : null}

                      {invoice.status === "void" ? (
                        <p className="text-sm text-ink-muted">Voided: {invoice.void_reason}</p>
                      ) : null}

                      {canManage ? (
                        <div className="flex flex-wrap items-start gap-2">
                          {draft ? (
                            <>
                              {isCurrent ? (
                                <ActionForm
                                  fields={[
                                    { name: "issueDate", label: "Issue date", type: "date" },
                                    {
                                      name: "dueDate",
                                      label: "Due date",
                                      type: "date",
                                      hint: `Leave blank for Net ${contract.payment_terms_days}`,
                                    },
                                  ]}
                                  defaultValues={{ issueDate: today }}
                                  action={issueInvoice.bind(null, invoice.id)}
                                  submitLabel="Issue invoice"
                                  trigger="Issue"
                                  confirm="Issuing assigns a permanent number and freezes the invoice. Continue?"
                                />
                              ) : null}
                              <ActionForm
                                fields={[
                                  {
                                    name: "scheduledIssueDate",
                                    label: "Planned issue date",
                                    type: "date",
                                    hint: "Blank returns it to draft",
                                  },
                                ]}
                                defaultValues={{
                                  scheduledIssueDate: invoice.scheduled_issue_date ?? "",
                                }}
                                action={scheduleInvoice.bind(null, invoice.id)}
                                submitLabel="Save schedule"
                                trigger="Schedule"
                              />
                              <DraftEditor
                                finances={finances}
                                invoiceId={invoice.id}
                                sources={sources}
                              />
                              <ActionButton
                                action={deleteInvoiceDraft.bind(null, invoice.id)}
                                label="Delete draft"
                                variant="danger"
                                confirm="Delete this draft invoice?"
                              />
                            </>
                          ) : null}
                          {invoice.status === "issued" ? (
                            <>
                              {(balance?.balance_minor ?? 0) > 0 ? (
                                <ActionForm
                                  fields={[
                                    { name: "amount", label: "Credit amount", type: "money" },
                                    { name: "issueDate", label: "Issue date", type: "date" },
                                    {
                                      name: "reason",
                                      label: "Reason (shown to the client)",
                                      type: "textarea",
                                    },
                                  ]}
                                  defaultValues={{ issueDate: today }}
                                  action={issueCreditNote.bind(null, invoice.id)}
                                  submitLabel="Issue credit note"
                                  trigger="Credit note"
                                  confirm="Issue a credit note? It is numbered and permanent."
                                />
                              ) : null}
                              <ActionForm
                                fields={[
                                  {
                                    name: "url",
                                    label: "Payment link (https)",
                                    type: "url",
                                    wide: true,
                                  },
                                  { name: "provider", label: "Provider" },
                                  { name: "providerReference", label: "Provider reference" },
                                ]}
                                defaultValues={{
                                  url: invoice.paymentLink?.url ?? "",
                                  provider: invoice.paymentLink?.provider ?? "",
                                  providerReference: invoice.paymentLink?.provider_reference ?? "",
                                }}
                                action={setPaymentLink.bind(null, invoice.id)}
                                submitLabel="Save link"
                                trigger={
                                  invoice.paymentLink ? "Change payment link" : "Add payment link"
                                }
                              />
                              {invoice.paymentLink ? (
                                <ActionButton
                                  action={removePaymentLink.bind(null, invoice.id)}
                                  label="Remove link"
                                  variant="ghost"
                                />
                              ) : null}
                              {balance &&
                              balance.applied_minor === 0 &&
                              balance.credited_minor === 0 ? (
                                <ActionForm
                                  fields={reasonField}
                                  action={voidInvoice.bind(null, invoice.id)}
                                  submitLabel="Void invoice"
                                  variant="danger"
                                  trigger="Void"
                                  confirm="Void this invoice? It keeps its number, which is never reused."
                                />
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        {canManage && contract.status !== "void" ? (
          <details className="rounded-sm border border-rule bg-surface-muted p-4">
            <summary className="cursor-pointer text-sm font-medium">New draft invoice</summary>
            <div className="mt-4">
              <InvoiceDraftForm contractId={contract.id} sources={sources} currency={currency} />
            </div>
          </details>
        ) : null}
      </div>
    </Panel>
  );
}

function DraftEditor({
  finances,
  invoiceId,
  sources,
}: {
  finances: LoadedFinances;
  invoiceId: string;
  sources: BillableSource[];
}) {
  const invoice = finances.invoices.find((i) => i.id === invoiceId)!;
  const currency = finances.contract.currency;
  return (
    <details className="w-full rounded-sm border border-rule bg-surface-muted p-4">
      <summary className="cursor-pointer text-sm font-medium">Edit lines</summary>
      <div className="mt-4">
        <InvoiceDraftForm
          contractId={finances.contract.id}
          invoiceId={invoice.id}
          sources={sources}
          currency={currency}
          initial={{
            memo: invoice.memo,
            lines: invoice.invoice_lines
              .toSorted((a, b) => a.position - b.position)
              .map((l) => ({
                description: l.description,
                amount: toDecimalString(l.amount_minor, currency),
                source: l.payment_milestone_id
                  ? `milestone:${l.payment_milestone_id}`
                  : l.change_order_id
                    ? `change_order:${l.change_order_id}`
                    : "",
              })),
          }}
        />
      </div>
    </details>
  );
}
