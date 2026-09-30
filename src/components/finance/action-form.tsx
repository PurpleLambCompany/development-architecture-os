"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "money" | "date" | "number" | "textarea" | "select" | "url";
  options?: { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
  wide?: boolean;
};

type Values = Record<string, string>;

/**
 * A small form for one finance action. Values are sent as text; the server
 * action validates them (money to minor units, dates) and the database
 * enforces every rule. Server field errors are shown next to their fields.
 * With `trigger`, the form stays folded behind a button until needed.
 */
export function ActionForm({
  fields,
  action,
  submitLabel,
  variant = "primary",
  defaultValues = {},
  trigger,
  confirm,
  className,
}: {
  fields: FieldSpec[];
  action: (input: Values) => Promise<ActionResult<unknown>>;
  submitLabel: string;
  variant?: "primary" | "secondary" | "danger";
  defaultValues?: Values;
  trigger?: string;
  confirm?: string;
  className?: string;
}) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(!trigger);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    defaultValues: Object.fromEntries(fields.map((f) => [f.name, defaultValues[f.name] ?? ""])),
  });

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant={variant === "danger" ? "danger" : "secondary"}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>
    );
  }

  const onSubmit = form.handleSubmit((values) => {
    if (confirm && !window.confirm(confirm)) return;
    setError(null);
    form.clearErrors();
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setError(result.error);
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field, { type: "server", message });
        }
        return;
      }
      form.reset(Object.fromEntries(fields.map((f) => [f.name, defaultValues[f.name] ?? ""])));
      if (trigger) setOpen(false);
      router.refresh();
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn(
        "space-y-4",
        trigger && "rounded-sm border border-rule bg-surface-muted p-4",
        className,
      )}
    >
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const id = `${formId}-${field.name}`;
          const message = form.formState.errors[field.name]?.message;
          const common = { id, "aria-invalid": !!message, ...form.register(field.name) };
          return (
            <Field
              key={field.name}
              label={field.label}
              htmlFor={id}
              hint={field.hint}
              error={message}
              className={field.wide || field.type === "textarea" ? "sm:col-span-2" : undefined}
            >
              {field.type === "textarea" ? (
                <Textarea {...common} placeholder={field.placeholder} />
              ) : field.type === "select" ? (
                <Select {...common}>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  {...common}
                  type={
                    field.type === "date"
                      ? "date"
                      : field.type === "number"
                        ? "number"
                        : field.type === "url"
                          ? "url"
                          : "text"
                  }
                  inputMode={field.type === "money" ? "decimal" : undefined}
                  placeholder={field.placeholder ?? (field.type === "money" ? "0.00" : undefined)}
                  className={field.type === "money" ? "tabular-nums" : undefined}
                />
              )}
            </Field>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {pending ? "Working…" : submitLabel}
        </Button>
        {trigger ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** A single-click action (no fields), with an optional confirmation. */
export function ActionButton({
  action,
  label,
  variant = "secondary",
  confirm,
}: {
  action: () => Promise<ActionResult<unknown>>;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          const result = await action();
          if (!result.ok) window.alert(result.error);
          router.refresh();
        });
      }}
    >
      {pending ? "Working…" : label}
    </Button>
  );
}
