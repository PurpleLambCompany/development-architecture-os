import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A bordered surface with an optional titled header. */
export function Panel({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-sm border border-rule bg-surface", className)}>
      {title ? (
        <header className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
          <div>
            <h2 className="font-serif text-lg text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-8 text-center">
      <p className="font-serif text-base text-ink">{title}</p>
      {children ? <div className="mt-1 text-sm text-ink-muted">{children}</div> : null}
    </div>
  );
}

/** A term/definition list for record details. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {item.value || <span className="text-ink-subtle">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
