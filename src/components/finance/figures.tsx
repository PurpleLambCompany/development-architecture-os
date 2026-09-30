import type { ReactNode } from "react";
import { formatMoney } from "@/domain/finance/money";
import { cn } from "@/lib/utils";

export type Figure = {
  label: string;
  minor: number;
  hint?: string;
  tone?: "default" | "attention" | "negative" | "muted";
  emphasis?: boolean;
};

/**
 * A set of related figures, each with its own label and definition. Figures
 * are never merged or substituted for one another (proposal §6).
 */
export function FigureGrid({
  figures,
  currency,
  columns = 4,
}: {
  figures: Figure[];
  currency: string;
  columns?: 3 | 4;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:grid-cols-2",
        columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {figures.map((figure) => (
        <div key={figure.label} className="bg-surface px-4 py-3">
          <dt className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
            {figure.label}
          </dt>
          <dd
            className={cn(
              "mt-1 font-serif tabular-nums",
              figure.emphasis ? "text-2xl" : "text-xl",
              figure.tone === "negative" && figure.minor !== 0 && "text-negative",
              figure.tone === "attention" && figure.minor !== 0 && "text-attention",
              figure.tone === "muted" && "text-ink-muted",
            )}
          >
            {formatMoney(figure.minor, currency)}
          </dd>
          {figure.hint ? <p className="mt-0.5 text-xs text-ink-subtle">{figure.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export function Amount({
  minor,
  currency,
  className,
}: {
  minor: number;
  currency: string;
  className?: string;
}) {
  return <span className={cn("tabular-nums", className)}>{formatMoney(minor, currency)}</span>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">{children}</p>
  );
}
