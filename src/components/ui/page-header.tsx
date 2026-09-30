import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-medium tracking-[0.14em] text-ink-subtle uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-3xl text-ink">{title}</h1>
        {description ? <div className="mt-2 text-sm text-ink-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </header>
  );
}
