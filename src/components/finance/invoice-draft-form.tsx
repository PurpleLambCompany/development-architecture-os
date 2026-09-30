"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { saveInvoiceDraft } from "@/domain/finance/actions";
import { formatMoney, parseMoney } from "@/domain/finance/money";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";

export type BillableSource = { value: string; label: string; remainingMinor: number };

type Values = {
  memo: string;
  lines: { description: string; amount: string; source: string }[];
};

/**
 * Draft invoice: a client-facing memo and itemised lines. Each line may bill
 * a milestone or an approved change order (never both). What remains
 * billable is shown; the database refuses to issue anything that would bill
 * beyond the authorized amount.
 */
export function InvoiceDraftForm({
  contractId,
  invoiceId = null,
  sources,
  initial,
  currency,
  onDone,
}: {
  contractId: string;
  invoiceId?: string | null;
  sources: BillableSource[];
  initial?: Values;
  currency: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    defaultValues: initial ?? { memo: "", lines: [{ description: "", amount: "", source: "" }] },
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const watched = useWatch({ control: form.control, name: "lines" });
  const total = watched.reduce((sum, line) => sum + (parseMoney(line.amount ?? "") ?? 0), 0);

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    form.clearErrors();
    startTransition(async () => {
      const result = await saveInvoiceDraft(contractId, invoiceId, values);
      if (!result.ok) {
        setError(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as never, { type: "server", message });
        }
        return;
      }
      if (!invoiceId)
        form.reset({ memo: "", lines: [{ description: "", amount: "", source: "" }] });
      onDone?.();
      router.refresh();
    });
  });

  const errors = form.formState.errors;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Field
        label="Memo to the client"
        htmlFor="invoice-memo"
        hint="Why this invoice exists, in plain language."
      >
        <Textarea id="invoice-memo" className="min-h-16" {...form.register("memo")} />
      </Field>

      <div className="space-y-3">
        {lines.fields.map((line, index) => {
          const source = sources.find((s) => s.value === watched[index]?.source);
          return (
            <div
              key={line.id}
              className="grid grid-cols-1 gap-3 border-b border-rule pb-3 sm:grid-cols-[1.4fr_1.6fr_0.8fr_auto]"
            >
              <Field
                label="Bills"
                htmlFor={`line-${index}-source`}
                error={errors.lines?.[index]?.source?.message}
                hint={
                  source
                    ? `${formatMoney(source.remainingMinor, currency)} not yet billed`
                    : undefined
                }
              >
                <Select id={`line-${index}-source`} {...form.register(`lines.${index}.source`)}>
                  <option value="">Other (no milestone or change order)</option>
                  {sources.map((s) => (
                    <option key={s.value} value={s.value} disabled={s.remainingMinor <= 0}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Description"
                htmlFor={`line-${index}-description`}
                error={errors.lines?.[index]?.description?.message}
              >
                <Input
                  id={`line-${index}-description`}
                  {...form.register(`lines.${index}.description`)}
                />
              </Field>
              <Field
                label="Amount"
                htmlFor={`line-${index}-amount`}
                error={errors.lines?.[index]?.amount?.message}
              >
                <Input
                  id={`line-${index}-amount`}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tabular-nums"
                  {...form.register(`lines.${index}.amount`)}
                />
              </Field>
              <div className="flex items-end pb-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => lines.remove(index)}
                  disabled={lines.fields.length === 1}
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => lines.append({ description: "", amount: "", source: "" })}
        >
          Add line
        </Button>
        <p className="text-sm text-ink-muted">
          Total{" "}
          <span className="ml-2 font-medium text-ink tabular-nums">
            {formatMoney(total, currency)}
          </span>
        </p>
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : invoiceId ? "Save draft" : "Create draft invoice"}
      </Button>
    </form>
  );
}
