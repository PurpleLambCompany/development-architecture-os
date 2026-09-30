import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { getMyEngagementCapabilities } from "@/domain/capabilities/queries";
import { getEngagementBySlug } from "@/domain/engagements/queries";
import { INVOICE_STATE } from "@/domain/finance/catalog";
import { formatMoney } from "@/domain/finance/money";
import { getBusinessToday, getEngagementFinances } from "@/domain/finance/queries";
import { ButtonLink } from "@/components/ui/button";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { StatusTag } from "@/components/ui/status-tag";

/** One issued invoice, laid out as the document the client receives. */
export default async function ClientInvoicePage({
  params,
}: PageProps<"/portal/[slug]/billing/invoices/[invoiceId]">) {
  const { slug, invoiceId } = await params;
  await requireClient();
  const engagement = await getEngagementBySlug(slug);
  if (!engagement) notFound();
  const capabilities = await getMyEngagementCapabilities(engagement.id);
  if (!capabilities.has("view_financials")) notFound();

  const finances = await getEngagementFinances(engagement.id, getBusinessToday());
  if (!finances.contract) notFound();
  // RLS returns only issued (or voided) invoices to clients.
  const invoice = finances.invoices.find((i) => i.id === invoiceId);
  if (!invoice || !invoice.invoice_number) notFound();

  const currency = finances.contract.currency;
  const balance = invoice.balance;
  const state = INVOICE_STATE[balance?.payment_state ?? "open"];
  const credits = finances.creditNotes.filter(
    (cn) => cn.invoice_id === invoice.id && cn.status === "issued",
  );
  const applied = finances.allocations.filter((a) => a.invoice_id === invoice.id && !a.reversed_at);

  return (
    <div className="space-y-8">
      <EngagementNav slug={engagement.slug} engagementId={engagement.id} current="billing" />
      <article className="mx-auto max-w-3xl rounded-sm border border-rule bg-surface px-10 py-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-rule pb-6">
          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-ink-subtle uppercase">
              Invoice
            </p>
            <h1 className="mt-1 font-serif text-3xl text-ink">{invoice.invoice_number}</h1>
            <p className="mt-2 text-sm text-ink-muted">The Purple Lamb Company</p>
          </div>
          <div className="text-right text-sm">
            <StatusTag tone={state.tone}>{state.label}</StatusTag>
            <p className="mt-3 text-ink-muted">Issued {formatDate(invoice.issue_date)}</p>
            <p className="text-ink-muted">Due {formatDate(invoice.due_date)}</p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 border-b border-rule py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Billed to</p>
            <p className="mt-1">{engagement.organizations?.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
              Engagement
            </p>
            <p className="mt-1">{engagement.title}</p>
          </div>
          {invoice.memo ? <p className="text-ink-muted sm:col-span-2">{invoice.memo}</p> : null}
        </section>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs tracking-wide text-ink-subtle uppercase">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.invoice_lines
              .toSorted((a, b) => a.position - b.position)
              .map((line) => (
                <tr key={line.id} className="border-b border-rule/60">
                  <td className="py-2">{line.description}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(line.amount_minor, currency)}
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 text-ink-muted">Invoice total</td>
              <td className="pt-4 text-right tabular-nums">
                {formatMoney(invoice.total_minor ?? 0, currency)}
              </td>
            </tr>
            {credits.map((cn) => (
              <tr key={cn.id}>
                <td className="text-ink-muted">
                  Credit note {cn.credit_note_number} · {cn.reason}
                </td>
                <td className="text-right tabular-nums">
                  −{formatMoney(cn.amount_minor, currency)}
                </td>
              </tr>
            ))}
            {applied.map((a) => {
              const payment = finances.payments.find((p) => p.id === a.payment_id);
              return (
                <tr key={a.id}>
                  <td className="text-ink-muted">
                    Payment received {payment ? formatDate(payment.received_on) : ""}
                    {payment?.reference ? ` · ${payment.reference}` : ""}
                  </td>
                  <td className="text-right tabular-nums">
                    −{formatMoney(a.amount_minor, currency)}
                  </td>
                </tr>
              );
            })}
            {invoice.status === "issued" ? (
              <tr className="font-medium">
                <td className="border-t border-rule pt-3">Balance due</td>
                <td className="border-t border-rule pt-3 text-right font-serif text-xl tabular-nums">
                  {formatMoney(balance?.balance_minor ?? 0, currency)}
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={2} className="pt-3 text-ink-muted">
                  This invoice was voided: {invoice.void_reason}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        {capabilities.has("pay_invoices") && invoice.paymentLink ? (
          <div className="mt-8 border-t border-rule pt-6">
            <a
              href={invoice.paymentLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Pay online
            </a>
            <p className="mt-2 text-xs text-ink-subtle">
              Opens {invoice.paymentLink.provider ?? "the payment provider"}. DSA OS never sees card
              or bank details.
            </p>
          </div>
        ) : null}
      </article>
      <div className="mx-auto max-w-3xl">
        <ButtonLink href={`/portal/${engagement.slug}/billing`} variant="ghost" size="sm">
          Back to billing
        </ButtonLink>
      </div>
    </div>
  );
}
