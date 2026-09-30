import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Label, control, optional hint and error, laid out consistently. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium tracking-wide text-ink-muted uppercase"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-negative" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-sm border px-3 py-2 text-sm",
        tone === "error"
          ? "border-negative/30 bg-negative-soft text-negative"
          : "border-positive/30 bg-positive-soft text-positive",
      )}
    >
      {children}
    </div>
  );
}
