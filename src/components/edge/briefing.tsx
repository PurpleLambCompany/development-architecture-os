import Link from "next/link";
import { markBriefedThrough } from "@/domain/edge/actions";
import { FIRST_BRIEFING_NOTE, markThroughFor, type BriefingWindow } from "@/domain/edge/briefing";
import type { EdgeEvent } from "@/domain/edge/grouping";
import type { DevelopmentChangeRow } from "@/domain/edge/queries";
import { CHANGE_TYPE_WORDS, changeRank } from "@/domain/edge/words";
import { formatDateTime } from "@/lib/format";
import { ReferenceCode } from "@/components/architecture/badges";
import { ActionForm } from "@/components/ui/action-form";
import { EmptyState, Panel } from "@/components/ui/panel";
import { eventHeading } from "@/domain/edge/grouping";
import { edgeSubjectHref } from "./links";

/**
 * Since you last reviewed (§14.2): a document, not a feed. No unread counts,
 * badges or per-item seen state. The mark moves only when the user says so.
 */
export function BriefingPanel({
  slug,
  engagementId,
  window,
  changes,
  newEvents,
}: {
  slug: string;
  engagementId: string;
  window: BriefingWindow;
  changes: DevelopmentChangeRow[];
  newEvents: EdgeEvent[];
}) {
  const bySubject = new Map<string, DevelopmentChangeRow[]>();
  for (const c of changes) {
    const key = `${c.subject_type}:${c.subject_id}`;
    bySubject.set(key, [...(bySubject.get(key) ?? []), c]);
  }
  const groups = [...bySubject.values()]
    .map((rows) =>
      [...rows].sort(
        (a, b) =>
          changeRank(a.change_type) - changeRank(b.change_type) ||
          b.occurred_at.localeCompare(a.occurred_at),
      ),
    )
    .sort(
      (a, b) =>
        changeRank(a[0]!.change_type) - changeRank(b[0]!.change_type) ||
        b[0]!.occurred_at.localeCompare(a[0]!.occurred_at),
    );
  const through = markThroughFor([
    ...changes.map((c) => c.occurred_at),
    ...newEvents.map((e) => e.triggerAt),
  ]);
  return (
    <Panel
      title="Since you last reviewed"
      description={
        window.isDefault
          ? FIRST_BRIEFING_NOTE
          : `Developmental changes since ${formatDateTime(window.since)}, the point you marked. Only you can see or move it.`
      }
      actions={
        through ? (
          <ActionForm
            fields={[]}
            hidden={{ through }}
            action={markBriefedThrough.bind(null, engagementId)}
            submitLabel={`Mark reviewed through ${formatDateTime(through)}`}
            variant="secondary"
          />
        ) : null
      }
    >
      {groups.length === 0 && newEvents.length === 0 ? (
        <EmptyState title="Nothing has changed since then" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h3 className="text-xs tracking-wide text-ink-subtle uppercase">What changed</h3>
            <ul className="mt-2 divide-y divide-rule text-sm">
              {groups.map((rows) => {
                const head = rows[0]!;
                return (
                  <li key={`${head.subject_type}:${head.subject_id}`} className="py-2">
                    <Link
                      href={edgeSubjectHref(slug, {
                        type: head.subject_type,
                        id: head.subject_id,
                        kind: head.subject_kind,
                        referenceCode: head.reference_code,
                      })}
                      className="group inline-flex items-baseline gap-2"
                    >
                      <ReferenceCode code={head.reference_code} />
                      <span className="text-ink group-hover:underline">{head.title}</span>
                    </Link>
                    <ul className="mt-1 space-y-0.5 text-ink-muted">
                      {rows.map((c, i) => (
                        <li key={i}>
                          {CHANGE_TYPE_WORDS[c.change_type] ?? c.change_type}
                          {c.version_no ? ` (v${c.version_no})` : ""}
                          {c.related_reference_code ? `, ${c.related_reference_code}` : ""}
                          <span className="text-xs text-ink-subtle">
                            {" "}
                            · {formatDateTime(c.occurred_at)}
                            {c.actor_name ? ` · ${c.actor_name}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <h3 className="text-xs tracking-wide text-ink-subtle uppercase">New on the Edge</h3>
            {newEvents.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                No new events. Standing conditions appear in the Edge below.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-rule text-sm">
                {newEvents.map((e) => (
                  <li key={e.key} className="py-2 text-ink">
                    <a href={`#${encodeURIComponent(e.key)}`} className="hover:underline">
                      {eventHeading(e)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Panel>
  );
}
