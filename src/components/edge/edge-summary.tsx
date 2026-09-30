import Link from "next/link";
import { eventHeading, groupEdgeItems } from "@/domain/edge/grouping";
import { EDGE_TIER_LABELS, type EdgeItem, type EdgeTier } from "@/domain/edge/items";
import { EmptyState, Panel } from "@/components/ui/panel";

/**
 * The engagement overview's Development Edge section (§8.1): only the
 * human-flagged and Elevated events, as headings, with a link to the Edge.
 * No counts to chase, no badges.
 */
export function EdgeSummary({ slug, items }: { slug: string; items: EdgeItem[] }) {
  const events = groupEdgeItems(items).filter(
    (e) => e.tier === "human_flagged" || e.tier === "elevated",
  );
  return (
    <Panel
      title="Development Edge"
      description="Escalated or critical records, and changes that bear on governance within the next 14 days."
      actions={
        <Link
          href={`/internal/engagements/${slug}/edge`}
          className="text-sm text-ink-muted hover:underline"
        >
          Open the Edge
        </Link>
      }
    >
      {events.length === 0 ? (
        <EmptyState title="Nothing escalated or approaching">
          The Edge lists everything else to consider.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-rule text-sm">
          {events.map((e) => (
            <li key={e.key} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <Link
                href={`/internal/engagements/${slug}/edge#${encodeURIComponent(e.key)}`}
                className="text-ink hover:underline"
              >
                {eventHeading(e)}
              </Link>
              <span className="text-xs text-ink-subtle">
                {EDGE_TIER_LABELS[e.tier as EdgeTier]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
