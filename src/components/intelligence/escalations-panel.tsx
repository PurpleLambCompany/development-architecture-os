import Link from "next/link";
import type { LoadedEscalation } from "@/domain/intelligence/queries";
import { ReferenceCode } from "@/components/architecture/badges";
import { EmptyState, Panel } from "@/components/ui/panel";
import { EscalationItem } from "./element-panels";

/** Open escalations, newest first, each linked to its record. */
export function EscalationsPanel({
  escalations,
  canPublish,
  nameOf,
  showEngagement = false,
  signals,
}: {
  escalations: LoadedEscalation[];
  /** Whether the viewer may acknowledge and resolve, by engagement. */
  canPublish: (engagementId: string) => boolean;
  nameOf: (id: string | null) => string;
  showEngagement?: boolean;
  /** Open signals and where to see them, for a single engagement. */
  signals?: { count: number; href: string };
}) {
  return (
    <Panel
      title="Escalations"
      description="Records escalated to a Principal Architect or a client executive, until resolved."
      actions={
        signals ? (
          <Link href={signals.href} className="text-sm text-ink-muted hover:underline">
            {signals.count} open signal{signals.count === 1 ? "" : "s"}
          </Link>
        ) : null
      }
    >
      {escalations.length === 0 ? (
        <EmptyState title="Nothing escalated" />
      ) : (
        <div className="space-y-3">
          {escalations.map((x) => (
            <EscalationItem
              key={x.id}
              escalation={x}
              canPublish={canPublish(x.engagement_id)}
              nameOf={nameOf}
              subject={
                x.architecture_elements ? (
                  <Link
                    href={`/internal/engagements/${x.architecture_elements.engagements?.slug}/architecture/elements/${x.element_id}`}
                    className="group inline-flex items-baseline gap-2"
                  >
                    <ReferenceCode code={x.architecture_elements.reference_code} />
                    <span className="text-ink group-hover:underline">
                      {x.architecture_elements.title}
                    </span>
                    {showEngagement ? (
                      <span className="text-xs text-ink-subtle">
                        {x.architecture_elements.engagements?.title}
                      </span>
                    ) : null}
                  </Link>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
