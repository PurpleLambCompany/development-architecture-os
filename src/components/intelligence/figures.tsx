import Link from "next/link";
import { cn } from "@/lib/utils";

/** Counts that need judgment. Each links to the view that explains it; never a score. */
export function CountGrid({
  items,
  label,
}: {
  items: { label: string; value: number; href: string }[];
  label: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-rule bg-rule",
        items.length >= 5 ? "md:grid-cols-5" : "md:grid-cols-4",
      )}
    >
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="block bg-surface px-5 py-4 hover:bg-surface-muted"
        >
          <p className="text-xs tracking-wide text-ink-subtle uppercase">{item.label}</p>
          <p
            className={cn(
              "mt-1 font-serif text-2xl tabular-nums",
              item.value === 0 ? "text-ink-subtle" : "text-ink",
            )}
          >
            {item.value}
          </p>
        </Link>
      ))}
    </section>
  );
}
