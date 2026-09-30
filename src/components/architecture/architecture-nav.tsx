import Link from "next/link";
import { DOMAINS, DOMAIN_SHORT_LABELS, DOMAIN_SLUGS } from "@/domain/architecture/catalog";
import { cn } from "@/lib/utils";

export type ArchitectureSection =
  | "engagement"
  | "home"
  | (typeof DOMAINS)[number]
  | "element"
  | "intelligence"
  | "evidence"
  | "reviews"
  | "deliverables"
  | "implementation"
  | "baselines";

/** Tabs across an engagement's architecture workspace. */
export function ArchitectureNav({ slug, current }: { slug: string; current: ArchitectureSection }) {
  const base = `/internal/engagements/${slug}`;
  const tabs: { key: ArchitectureSection; href: string; label: string }[] = [
    { key: "engagement", href: base, label: "Engagement" },
    { key: "home", href: `${base}/architecture`, label: "Architecture" },
    ...DOMAINS.map((domain) => ({
      key: domain,
      href: `${base}/architecture/${DOMAIN_SLUGS[domain]}`,
      label: DOMAIN_SHORT_LABELS[domain],
    })),
    { key: "intelligence", href: `${base}/intelligence`, label: "Intelligence" },
    { key: "evidence", href: `${base}/evidence`, label: "Evidence" },
    { key: "reviews", href: `${base}/reviews`, label: "Reviews" },
    { key: "deliverables", href: `${base}/deliverables`, label: "Deliverables" },
    { key: "implementation", href: `${base}/implementation`, label: "Implementation" },
    { key: "baselines", href: `${base}/baselines`, label: "Baselines" },
  ];
  return (
    <nav
      className="-mt-4 flex flex-wrap items-center gap-x-1 border-b border-rule text-sm"
      aria-label="Architecture"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2",
            tab.key === current
              ? "border-accent text-ink"
              : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
