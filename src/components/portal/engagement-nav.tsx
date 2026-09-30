import Link from "next/link";
import { NavPlaceholder } from "@/components/shell/nav-link";
import { cn } from "@/lib/utils";

/** Client navigation from spec §7. Overview and (with view_financials) Billing are live. */
const LATER_SECTIONS = [
  "Architecture",
  "Decisions",
  "Actions",
  "Reviews",
  "Documents",
  "Implementation",
  "Messages",
];

export function EngagementNav({
  slug,
  current,
  seesBilling,
}: {
  slug: string;
  current: "overview" | "billing";
  seesBilling: boolean;
}) {
  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 px-3 py-2",
        active ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav
      className="-mt-4 flex flex-wrap items-center gap-x-1 border-b border-rule text-sm"
      aria-label="Engagement"
    >
      {tab(`/portal/${slug}`, "Overview", current === "overview")}
      {seesBilling ? tab(`/portal/${slug}/billing`, "Billing", current === "billing") : null}
      {LATER_SECTIONS.map((section) => (
        <span key={section} className="px-0 py-0.5">
          <NavPlaceholder>{section}</NavPlaceholder>
        </span>
      ))}
    </nav>
  );
}
