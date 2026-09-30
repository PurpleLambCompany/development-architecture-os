import Link from "next/link";
import { cn } from "@/lib/utils";

export type IntelligenceSection = "registers" | "requests" | "input" | "signals";

/** Sections of an engagement's Project Intelligence. */
export function IntelligenceNav({
  slug,
  current,
  counts = {},
}: {
  slug: string;
  current: IntelligenceSection;
  counts?: Partial<Record<IntelligenceSection, number>>;
}) {
  const base = `/internal/engagements/${slug}/intelligence`;
  const tabs: { key: IntelligenceSection; href: string; label: string }[] = [
    { key: "registers", href: base, label: "Registers" },
    { key: "requests", href: `${base}/requests`, label: "Client requests" },
    { key: "input", href: `${base}/input`, label: "Client input" },
    { key: "signals", href: `${base}/signals`, label: "Signals" },
  ];
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Project Intelligence">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={cn(
            "rounded-sm border px-3 py-1.5 text-sm",
            tab.key === current
              ? "border-accent bg-accent-soft text-accent"
              : "border-rule text-ink-muted hover:text-ink",
          )}
        >
          {tab.label}
          {counts[tab.key] ? (
            <span className="ml-1.5 text-xs text-ink-subtle tabular-nums">{counts[tab.key]}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
