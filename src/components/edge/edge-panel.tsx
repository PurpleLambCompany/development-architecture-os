import Link from "next/link";
import { groupEdgeItems } from "@/domain/edge/grouping";
import type { EdgeItem } from "@/domain/edge/items";
import { EmptyState, Panel } from "@/components/ui/panel";
import { EdgeEventCard } from "./edge-event";

/**
 * A contextual Edge panel (§16): every event bearing on one object, Ambient
 * included, grouped by trigger. Advisory: a prompt to look, never a verdict.
 */
export function ContextualEdgePanel({
  slug,
  engagementId,
  items,
  canJudge,
  title = "On the Development Edge",
  description = "Conditions and changes bearing on this record, from deterministic rules over governed records. Each is a prompt to look, never a conclusion.",
  empty = "Nothing on the Edge bears on this record.",
  children,
}: {
  slug: string;
  engagementId: string;
  items: EdgeItem[];
  canJudge: boolean;
  title?: string;
  description?: string;
  empty?: string;
  children?: React.ReactNode;
}) {
  const events = groupEdgeItems(items);
  return (
    <Panel
      title={title}
      description={description}
      actions={
        <Link
          href={`/internal/engagements/${slug}/edge`}
          className="text-sm text-ink-muted hover:underline"
        >
          Open the Edge
        </Link>
      }
    >
      {children}
      {events.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <div>
          {events.map((event) => (
            <EdgeEventCard
              eventJudgment={false}
              key={event.key}
              slug={slug}
              engagementId={engagementId}
              event={event}
              canJudge={canJudge}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
