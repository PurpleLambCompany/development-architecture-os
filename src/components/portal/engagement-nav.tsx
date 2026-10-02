import Link from "next/link";
import { getMyEngagementCapabilities } from "@/domain/capabilities/queries";
import { NavPlaceholder } from "@/components/shell/nav-link";
import { cn } from "@/lib/utils";

/**
 * Client navigation from spec §7. Overview is live for every member;
 * Actions for anyone who can be asked, respond or assign; Architecture and
 * Decisions with view_architecture; Billing with view_financials. The database enforces the same capabilities.
 */
const LATER_SECTIONS = ["Documents", "Messages"];

export type PortalSection =
  | "overview"
  | "actions"
  | "architecture"
  | "decisions"
  | "reviews"
  | "deliverables"
  | "implementation"
  | "billing";

export async function EngagementNav({
  slug,
  engagementId,
  current,
}: {
  slug: string;
  engagementId: string;
  current: PortalSection;
}) {
  const capabilities = await getMyEngagementCapabilities(engagementId);
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
  const seesArchitecture = capabilities.has("view_architecture");
  const seesActions =
    seesArchitecture ||
    capabilities.has("respond_to_client_actions") ||
    capabilities.has("assign_client_actions");
  return (
    <nav
      className="-mt-4 flex flex-wrap items-center gap-x-1 border-b border-rule text-sm"
      aria-label="Engagement"
    >
      {tab(`/portal/${slug}`, "Overview", current === "overview")}
      {seesActions ? tab(`/portal/${slug}/actions`, "Actions", current === "actions") : null}
      {seesArchitecture
        ? tab(`/portal/${slug}/architecture`, "Architecture", current === "architecture")
        : null}
      {seesArchitecture
        ? tab(`/portal/${slug}/decisions`, "Decisions", current === "decisions")
        : null}
      {seesArchitecture ? tab(`/portal/${slug}/reviews`, "Reviews", current === "reviews") : null}
      {seesArchitecture
        ? tab(`/portal/${slug}/deliverables`, "Deliverables", current === "deliverables")
        : null}
      {seesArchitecture
        ? tab(`/portal/${slug}/implementation`, "Implementation", current === "implementation")
        : null}
      {capabilities.has("view_financials")
        ? tab(`/portal/${slug}/billing`, "Billing", current === "billing")
        : null}
      {LATER_SECTIONS.map((section) => (
        <span key={section} className="px-0 py-0.5">
          <NavPlaceholder>{section}</NavPlaceholder>
        </span>
      ))}
    </nav>
  );
}
