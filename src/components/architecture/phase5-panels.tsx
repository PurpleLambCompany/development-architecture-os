import type { LoadedArchitecture } from "@/domain/architecture/queries";
import { DELIVERABLE_TYPE_LABELS } from "@/domain/deliverables/catalog";
import type { DeliverableRegisterRow } from "@/domain/deliverables/queries";
import { IMPLEMENTATION_STATUS, categoryLabel } from "@/domain/implementation/catalog";
import type { ImplementationRegisterRow } from "@/domain/implementation/queries";
import { REVIEW_TYPE_LABELS, reviewStatus } from "@/domain/reviews/catalog";
import type { ReviewRegisterRow } from "@/domain/reviews/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { ElementLink } from "./badges";

/**
 * What implements, reviews and documents this architecture element (proposal
 * §15): three compact panels, the same visual/structural pattern as
 * "Bearing on this element" (§17's intelligence-layer equivalent), reading
 * the `implements`, `examines` and `documents` relationships already loaded
 * on the engagement.
 */

function relatedElementIds(
  architecture: LoadedArchitecture,
  elementId: string,
  relationshipType: string,
  direction: "incoming" | "outgoing",
): string[] {
  return architecture.relationships
    .filter(
      (r) =>
        r.relationship_type === relationshipType &&
        !r.retired_at &&
        (direction === "incoming"
          ? r.target_element_id === elementId
          : r.source_element_id === elementId),
    )
    .map((r) => (direction === "incoming" ? r.source_element_id : r.target_element_id));
}

/** Implementation initiatives that `implement` this element. */
export function ImplementationPanel({
  slug,
  elementId,
  architecture,
  rows,
}: {
  slug: string;
  elementId: string;
  architecture: LoadedArchitecture;
  rows: readonly ImplementationRegisterRow[];
}) {
  const ids = new Set(relatedElementIds(architecture, elementId, "implements", "incoming"));
  const shown = rows.filter((r) => ids.has(r.element_id));
  return (
    <Panel
      title="Implementation"
      description="Initiatives realizing this element in operating reality."
    >
      {shown.length === 0 ? (
        <EmptyState title="Nothing implements this element yet" />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule text-sm">
          {shown.map((row) => {
            const element = architecture.byId.get(row.element_id);
            const status = IMPLEMENTATION_STATUS[row.implementation_status];
            return (
              <li key={row.element_id} className="flex flex-wrap items-center gap-3 py-2">
                {element ? <ElementLink slug={slug} element={element} /> : row.title}
                <span className="text-xs text-ink-subtle">{categoryLabel(row.category)}</span>
                <StatusTag tone={status.tone}>{status.label}</StatusTag>
                {row.target_operational_on ? (
                  <span className="text-xs text-ink-muted">
                    Target {formatDate(row.target_operational_on)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Reviews whose agenda `examines` this element. */
export function ReviewedInPanel({
  slug,
  elementId,
  architecture,
  rows,
}: {
  slug: string;
  elementId: string;
  architecture: LoadedArchitecture;
  rows: readonly ReviewRegisterRow[];
}) {
  const ids = new Set(relatedElementIds(architecture, elementId, "examines", "incoming"));
  const shown = rows.filter((r) => ids.has(r.element_id));
  return (
    <Panel title="Reviewed in" description="Reviews whose agenda examines this element.">
      {shown.length === 0 ? (
        <EmptyState title="Not on any review's agenda yet" />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule text-sm">
          {shown.map((row) => {
            const element = architecture.byId.get(row.element_id);
            const status = reviewStatus(row.review_status);
            return (
              <li key={row.element_id} className="flex flex-wrap items-center gap-3 py-2">
                {element ? <ElementLink slug={slug} element={element} /> : row.title}
                <span className="text-xs text-ink-subtle">
                  {REVIEW_TYPE_LABELS[row.review_type]}
                </span>
                {status ? <StatusTag tone={status.tone}>{status.label}</StatusTag> : null}
                {row.held_at ? (
                  <span className="text-xs text-ink-muted">Held {formatDateTime(row.held_at)}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Deliverables that `document` this element. */
export function DocumentedInPanel({
  slug,
  elementId,
  architecture,
  rows,
}: {
  slug: string;
  elementId: string;
  architecture: LoadedArchitecture;
  rows: readonly DeliverableRegisterRow[];
}) {
  const ids = new Set(relatedElementIds(architecture, elementId, "documents", "incoming"));
  const shown = rows.filter((r) => ids.has(r.element_id));
  return (
    <Panel title="Documented in" description="Deliverables that present or summarize this element.">
      {shown.length === 0 ? (
        <EmptyState title="Not documented in any deliverable yet" />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule text-sm">
          {shown.map((row) => {
            const element = architecture.byId.get(row.element_id);
            return (
              <li key={row.element_id} className="flex flex-wrap items-center gap-3 py-2">
                {element ? <ElementLink slug={slug} element={element} /> : row.title}
                <span className="text-xs text-ink-subtle">
                  {DELIVERABLE_TYPE_LABELS[row.deliverable_type]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
