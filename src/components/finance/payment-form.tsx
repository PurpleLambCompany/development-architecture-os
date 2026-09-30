"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { recordPayment } from "@/domain/finance/actions";
import { suggestAllocations, type OpenInvoice } from "@/domain/finance/allocation";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/domain/finance/catalog";
import { formatMoney, parseMoney, toDecimalString } from "@/domain/finance/money";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";

type Values = {
  amount: string;
  receivedOn: string;
  method: string;
  reference: string;
  payerName: string;
  applied: Record<string, string>;
};

/**
 * Record cash received. The person decides where it goes: the form can
 * suggest oldest-due-first, and anything left unallocated stays as credit on
 * account. Card and bank account numbers are never entered here.
 */
export function PaymentForm({
  contractId,
  openInvoices,
  currency,
  today,
}: {
  contractId: string;
  openInvoices: OpenInvoice[];
  currency: string;
  today: string;
}) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const blank: Values = {
    amount: "",
    receivedOn: today,
    method: "wire",
    reference: "",
    payerName: "",
    applied: Object.fromEntries(openInvoices.map((i) => [i.id, ""])),
  };
  const form = useForm<Values>({ defaultValues: blank });
  const amount = parseMoney(useWatch({ control: form.control, name: "amount" }) ?? "") ?? 0;
  const applied = useWatch({ control: form.control, name: "applied" }) ?? {};
  const allocated = Object.values(applied).reduce((sum, v) => sum + (parseMoney(v ?? "") ?? 0), 0);

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Record payment
      </Button>
    );
  }

  const suggest = () => {
    const { lines } = suggestAllocations(amount, openInvoices);
    for (const invoice of openInvoices) {
      const line = lines.find((l) => l.invoiceId === invoice.id);
      form.setValue(
        `applied.${invoice.id}`,
        line ? toDecimalString(line.amountMinor, currency) : "",
      );
    }
  };

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    form.clearErrors();
    const allocations = Object.entries(values.applied ?? {})
      .filter(([, value]) => value.trim() !== "")
      .map(([invoiceId, value]) => ({ invoiceId, amount: value }));
    startTransition(async () => {
      const result = await recordPayment(contractId, { ...values, allocations });
      if (!result.ok) {
        setError(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          if (!field.startsWith("allocations"))
            form.setError(field as never, { type: "server", message });
        }
        return;
      }
      form.reset(blank);
      setOpen(false);
      router.refresh();
    });
  });

  const errors = form.formState.errors;
  const id = (name: string) => `${formId}-${name}`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 rounded-sm border border-rule bg-surface-muted p-4"
    >
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Amount received" htmlFor={id("amount")} error={errors.amount?.message}>
          <Input
            id={id("amount")}
            inputMode="decimal"
            placeholder="0.00"
            className="tabular-nums"
            {...form.register("amount")}
          />
        </Field>
        <Field label="Date received" htmlFor={id("receivedOn")} error={errors.receivedOn?.message}>
          <Input id={id("receivedOn")} type="date" {...form.register("receivedOn")} />
        </Field>
        <Field label="Method" htmlFor={id("method")} error={errors.method?.message}>
          <Select id={id("method")} {...form.register("method")}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Reference"
          htmlFor={id("reference")}
          error={errors.reference?.message}
          hint="Check number or confirmation. Never a card or account number."
        >
          <Input id={id("reference")} {...form.register("reference")} />
        </Field>
        <Field label="Payer" htmlFor={id("payerName")} error={errors.payerName?.message}>
          <Input id={id("payerName")} {...form.register("payerName")} />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
            Apply to invoices
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={suggest}
            disabled={amount <= 0 || openInvoices.length === 0}
          >
            Suggest oldest due first
          </Button>
        </div>
        {openInvoices.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No open invoices. The payment will be held as credit on account.
          </p>
        ) : (
          <ul className="divide-y divide-rule rounded-sm border border-rule bg-surface">
            {openInvoices.map((invoice) => (
              <li
                key={invoice.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{invoice.invoiceNumber}</span>
                  <span className="ml-2 text-ink-muted">
                    due {formatDate(invoice.dueDate)} ·{" "}
                    {formatMoney(invoice.balanceMinor, currency)} open
                  </span>
                </span>
                <Input
                  aria-label={`Amount applied to ${invoice.invoiceNumber}`}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-8 w-36 text-right tabular-nums"
                  {...form.register(`applied.${invoice.id}`)}
                />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-ink-muted">
          Applied{" "}
          <span className="font-medium text-ink tabular-nums">
            {formatMoney(allocated, currency)}
          </span>
          <span className="mx-2">·</span>
          Left as credit on account{" "}
          <span
            className={
              allocated > amount
                ? "font-medium text-negative tabular-nums"
                : "font-medium text-ink tabular-nums"
            }
          >
            {formatMoney(amount - allocated, currency)}
          </span>
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
