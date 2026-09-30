import {
  APPROVAL_RESPONSE_LABELS,
  ARCHITECTURE_EVENT_LABELS,
  DOMAIN_LABELS,
  MATURITY_LABELS,
  PROVENANCE_LABELS,
  type ApprovalResponse,
  type ArchitectureDomain,
  type MaturityState,
  type ProvenanceType,
} from "@/domain/architecture/catalog";
import type { ArchitectureActivityEvent } from "@/domain/architecture/queries";
import { relationshipType } from "@/domain/architecture/rules";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/panel";
import { ElementLink } from "./badges";

type Details = Record<string, string | number | undefined>;

/** A short plain description of what an event changed, from its curated details. */
function describe(event: ArchitectureActivityEvent): string | null {
  const d = (event.details ?? {}) as Details;
  const parts: string[] = [];
  if (d.version_no) parts.push(`v${d.version_no}`);
  if (d.label) parts.push(String(d.label));
  if (d.relationship_type) {
    parts.push(relationshipType(String(d.relationship_type))?.label ?? String(d.relationship_type));
  }
  if (d.response) parts.push(APPROVAL_RESPONSE_LABELS[d.response as ApprovalResponse]);
  if (d.approval_source === "external_recorded_by_tplco") parts.push("outside the portal");
  if (d.domain) {
    parts.push(
      `${DOMAIN_LABELS[d.domain as ArchitectureDomain]}: ${MATURITY_LABELS[d.maturity as MaturityState]}`,
    );
  }
  if (d.from && d.to) {
    parts.push(
      `${PROVENANCE_LABELS[d.from as ProvenanceType] ?? d.from} to ${PROVENANCE_LABELS[d.to as ProvenanceType] ?? d.to}`,
    );
  }
  if (d.change_summary) parts.push(String(d.change_summary));
  if (d.note) parts.push(String(d.note));
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Architecture activity, newest first. With `elementOf`, each event names the
 * element it concerns (for engagement-wide lists).
 */
export function ActivityList({
  events,
  slug,
  elementOf,
}: {
  events: ArchitectureActivityEvent[];
  slug?: string;
  elementOf?: (id: string) => { id: string; reference_code: string | null; title: string } | null;
}) {
  if (events.length === 0) return <EmptyState title="No recorded activity" />;
  return (
    <ul className="divide-y divide-rule border-y border-rule text-sm">
      {events.map((event) => {
        const element = event.element_id && elementOf ? elementOf(event.element_id) : null;
        const detail = describe(event);
        return (
          <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
            <span className="w-40 shrink-0 text-xs text-ink-subtle tabular-nums">
              {formatDateTime(event.created_at)}
            </span>
            <span className="text-ink">
              {ARCHITECTURE_EVENT_LABELS[event.event] ?? event.event.replaceAll("_", " ")}
            </span>
            {element && slug ? <ElementLink slug={slug} element={element} /> : null}
            {detail ? <span className="text-ink-muted">{detail}</span> : null}
            <span className="text-xs text-ink-subtle">{event.actor_name ?? "System"}</span>
          </li>
        );
      })}
    </ul>
  );
}
