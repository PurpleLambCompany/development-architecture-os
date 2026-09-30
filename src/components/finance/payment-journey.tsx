import { MILESTONE_STATE } from "@/domain/finance/catalog";
import { formatMoney } from "@/domain/finance/money";
import type { MilestoneBilling } from "@/domain/finance/queries";
import { formatDate } from "@/lib/format";
import { StatusTag } from "@/components/ui/status-tag";
import { cn } from "@/lib/utils";

/**
 * The payment journey: the milestones of the payment plan in order, each
 * with its derived state. It is its own track. Stage labels are text only;
 * payment state is never inferred from architecture progress, or the reverse.
 */
export function PaymentJourney({
  milestones,
  currency,
}: {
  milestones: MilestoneBilling[];
  currency: string;
}) {
  const visible = milestones.filter((m) => m.payment_state !== "cancelled");
  return (
    <ol className="relative space-y-0">
      {visible.map((milestone, index) => {
        const state = MILESTONE_STATE[milestone.payment_state];
        const done = milestone.payment_state === "paid";
        return (
          <li key={milestone.milestone_id} className="grid grid-cols-[1.5rem_1fr] gap-4">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-3 rounded-full border",
                  done ? "border-positive bg-positive" : "border-rule-strong bg-surface",
                  milestone.payment_state === "overdue" && "border-negative bg-negative-soft",
                )}
              />
              {index < visible.length - 1 ? (
                <span aria-hidden className="w-px flex-1 bg-rule" />
              ) : null}
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-5">
              <div>
                <p className="text-sm font-medium text-ink">{milestone.title}</p>
                <p className="text-xs text-ink-subtle">
                  {[
                    milestone.stage_label,
                    milestone.due_date ? `Planned ${formatDate(milestone.due_date)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums">
                  {formatMoney(milestone.amount_minor, currency)}
                </span>
                <StatusTag tone={state.tone}>{state.label}</StatusTag>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
