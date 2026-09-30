import Link from "next/link";
import type { ReactNode } from "react";
import type { LoadedElement } from "@/domain/architecture/queries";
import { RECORD_KIND_LABELS, type RecordKind } from "@/domain/architecture/catalog";
import {
  acknowledgeEscalation,
  escalateRecord,
  reopenRecord,
  resolveEscalation,
  resolveRecord,
  triageRecord,
} from "@/domain/intelligence/actions";
import {
  ATTENTION,
  ESCALATION_LEVEL_LABELS,
  HISTORY_FIELD_LABELS,
  HISTORY_OPERATION_LABELS,
  TRIAGE_STATE,
  isResolvableKind,
  isTerminalStatus,
} from "@/domain/intelligence/catalog";
import type { HistoryRow, LoadedEscalation, StewardshipRow } from "@/domain/intelligence/queries";
import type { ImpactTraceRow } from "@/domain/edge/queries";
import { linkWords } from "@/domain/edge/words";
import { groupEdgeItems } from "@/domain/edge/grouping";
import type { EdgeItem } from "@/domain/edge/items";
import { EdgeEventCard } from "@/components/edge/edge-event";
import { edgeSubjectHref } from "@/components/edge/links";
import { isActiveRecord, type RegisterRow } from "@/domain/intelligence/register";
import { formatDate, formatDateTime, personName } from "@/lib/format";
import { ReferenceCode } from "@/components/architecture/badges";
import { recordStatusValue } from "@/components/architecture/element-fields";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import {
  escalateFields,
  reopenFields,
  requiredNoteFields,
  resolveFields,
  triageFields,
} from "./fields";
import { AttentionTag, RecordStatusTag } from "./register-view";

/**
 * Stewardship of one record: attention, triage, review date, resolution and
 * escalation. Internal only (the stewardship table has no client policy).
 */
export function StewardshipPanel({
  element,
  stewardship,
  escalations,
  canEdit,
  canPublish,
  executives,
  nameOf,
  today,
}: {
  element: LoadedElement;
  stewardship: StewardshipRow | null;
  escalations: LoadedEscalation[];
  canEdit: boolean;
  canPublish: boolean;
  executives: { value: string; label: string }[];
  nameOf: (id: string | null) => string;
  today: string;
}) {
  const record = element.record;
  if (!record || !stewardship) return null;
  const kind = record.kind as RecordKind;
  const status = recordStatusValue(record);
  const frozen = element.lifecycle === "retired" || element.lifecycle === "superseded";
  const active = isActiveRecord({ kind, status, lifecycle: element.lifecycle });
  const resolvable = isResolvableKind(kind);
  const resolved = resolvable && isTerminalStatus(kind, status);
  const overdue = active && !!stewardship.next_review_on && stewardship.next_review_on < today;
  const open = escalations.filter((e) => !e.resolved_at);
  const closed = escalations.filter((e) => e.resolved_at);
  return (
    <Panel
      title="Stewardship"
      description="How much attention this record needs, when it is next reviewed, and who it is escalated to. Internal only."
      actions={
        canEdit && !frozen ? (
          <div className="flex flex-wrap items-start justify-end gap-2">
            {active ? (
              <ActionForm
                trigger="Triage"
                fields={triageFields}
                defaultValues={{
                  attention: stewardship.attention,
                  nextReviewOn: stewardship.next_review_on ?? "",
                }}
                action={triageRecord.bind(null, element.id)}
                submitLabel="Save triage"
              />
            ) : null}
            {resolvable && !resolved ? (
              <ActionForm
                trigger={`Resolve ${RECORD_KIND_LABELS[kind].toLowerCase()}`}
                fields={resolveFields(kind, canPublish)}
                defaultValues={{ publish: "no" }}
                action={resolveRecord.bind(null, element.id)}
                submitLabel="Resolve"
              />
            ) : null}
            {resolvable && resolved ? (
              <ActionForm
                trigger="Reopen"
                fields={reopenFields(kind)}
                action={reopenRecord.bind(null, element.id)}
                submitLabel="Reopen"
              />
            ) : null}
            {active ? (
              <ActionForm
                trigger="Escalate"
                variant="danger"
                fields={escalateFields(canPublish, executives)}
                defaultValues={{ level: "principal_architect" }}
                action={escalateRecord.bind(null, element.id)}
                submitLabel="Escalate"
              />
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        <DetailList
          items={[
            { label: "Status", value: <RecordStatusTag kind={kind} status={status} /> },
            {
              label: "Attention",
              value: (
                <span className="flex flex-col gap-1">
                  <AttentionTag attention={stewardship.attention} />
                  <span className="text-xs text-ink-muted">
                    {ATTENTION[stewardship.attention].description}
                  </span>
                </span>
              ),
            },
            {
              label: "Triage",
              value:
                stewardship.triage_state === "triaged" && stewardship.triaged_at
                  ? `${TRIAGE_STATE.triaged.label} by ${nameOf(stewardship.triaged_by)} ${formatDate(stewardship.triaged_at.slice(0, 10))}${stewardship.triage_note ? `: ${stewardship.triage_note}` : ""}`
                  : TRIAGE_STATE.untriaged.label,
            },
            {
              label: "Next review",
              value: stewardship.next_review_on ? (
                <span className={overdue ? "text-negative" : undefined}>
                  {formatDate(stewardship.next_review_on)}
                  {overdue ? " (overdue)" : ""}
                </span>
              ) : (
                "Not set"
              ),
            },
          ]}
        />
        {open.length || closed.length ? (
          <section aria-label="Escalations" className="space-y-3">
            <h3 className="text-xs tracking-wide text-ink-subtle uppercase">Escalations</h3>
            {[...open, ...closed].map((x) => (
              <EscalationItem key={x.id} escalation={x} canPublish={canPublish} nameOf={nameOf} />
            ))}
          </section>
        ) : null}
      </div>
    </Panel>
  );
}

export function EscalationItem({
  escalation: x,
  canPublish,
  nameOf,
  subject,
}: {
  escalation: LoadedEscalation;
  canPublish: boolean;
  nameOf: (id: string | null) => string;
  subject?: ReactNode;
}) {
  const who = (profile: Parameters<typeof personName>[0] | undefined, id: string | null) =>
    profile ? personName(profile) : nameOf(id);
  return (
    <div className="rounded-sm border border-rule px-4 py-3 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <StatusTag tone={x.resolved_at ? "neutral" : x.acknowledged_at ? "accent" : "negative"}>
          {x.resolved_at ? "Resolved" : x.acknowledged_at ? "Acknowledged" : "Open"}
        </StatusTag>
        <span className="text-ink">To {ESCALATION_LEVEL_LABELS[x.level].toLowerCase()}</span>
        {subject}
        {x.client_actions ? (
          <span className="text-xs text-ink-muted">
            with request <span className="font-mono">{x.client_actions.reference_code}</span>
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-ink-muted">{x.reason}</p>
      <p className="mt-1 text-xs text-ink-subtle">
        Raised by {who(x.raiser, x.raised_by)} {formatDateTime(x.raised_at)}
        {x.acknowledged_at
          ? ` · acknowledged by ${who(x.acknowledger, x.acknowledged_by)} ${formatDateTime(x.acknowledged_at)}`
          : ""}
        {x.resolved_at
          ? ` · resolved by ${who(x.resolver, x.resolved_by)} ${formatDateTime(x.resolved_at)}: ${x.resolution_note}`
          : ""}
      </p>
      {canPublish && !x.resolved_at ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {x.acknowledged_at ? null : (
            <ActionButton action={acknowledgeEscalation.bind(null, x.id)} label="Acknowledge" />
          )}
          <ActionForm
            trigger="Resolve escalation"
            fields={requiredNoteFields("Resolution")}
            action={resolveEscalation.bind(null, x.id)}
            submitLabel="Resolve escalation"
          />
        </div>
      ) : null}
    </div>
  );
}

/** Every change to a record's status, scoring and stewardship, oldest last. */
export function HistoryPanel({ history }: { history: HistoryRow[] }) {
  return (
    <Panel
      title="Record history"
      description="Every change to status, scoring and stewardship, with who made it and why. Append-only."
    >
      {history.length === 0 ? (
        <EmptyState title="No history yet" />
      ) : (
        <ol className="divide-y divide-rule border-y border-rule text-sm">
          {history.map((h) => (
            <li key={h.id} className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]">
              <span className="text-xs text-ink-subtle">{formatDateTime(h.changed_at)}</span>
              <span>
                <span className="text-ink">
                  {HISTORY_OPERATION_LABELS[h.operation] ?? h.operation}
                  {h.field ? ` · ${HISTORY_FIELD_LABELS[h.field] ?? h.field}` : ""}
                </span>
                {h.field ? (
                  <span className="text-ink-muted">
                    {" "}
                    {h.from_value || "—"} → {h.to_value || "—"}
                  </span>
                ) : null}
                <span className="text-ink-subtle"> · {h.actor_name}</span>
                {h.rationale ? (
                  <span className="block text-xs text-ink-muted">{h.rationale}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

const IMPACT_CATEGORY_LABELS: Record<string, string> = {
  active_implementation: "Implementation",
  implementation: "Implementation",
  criteria: "Acceptance criteria",
  review: "Reviews",
  deliverable: "Deliverables",
  architecture: "Architecture",
  governance: "Governance",
  client_exposure: "Client requests and input",
  practice: "Method Applications",
  evidence: "Evidence",
  lineage: "Method lineage",
  approval: "Approvals",
};
const IMPACT_CATEGORY_ORDER = Object.keys(IMPACT_CATEGORY_LABELS);

/**
 * What changing this element may bear on (Phase 7A, ADR-0055): the governed
 * impact trace in on-demand mode. Direction comes from the relationship-impact
 * matrix; only three walks recurse, to two steps; weak links are labeled.
 */
export function ImpactPanel({
  slug,
  element,
  trace,
}: {
  slug: string;
  element: { id: string; reference_code: string | null };
  trace: ImpactTraceRow[];
}) {
  const code = element.reference_code ?? "this element";
  // Hubs collapse (§7.3 rule 6): two or more records reached through one
  // hub other than this element are one line with a count.
  const hubCounts = new Map<string, number>();
  for (const row of trace) {
    if (row.hub_element_id && row.hub_element_id !== element.id) {
      hubCounts.set(row.hub_element_id, (hubCounts.get(row.hub_element_id) ?? 0) + 1);
    }
  }
  const collapsed = (row: ImpactTraceRow) =>
    !!row.hub_element_id &&
    row.hub_element_id !== element.id &&
    (hubCounts.get(row.hub_element_id) ?? 0) >= 2;
  const byCategory = new Map<string, ImpactTraceRow[]>();
  for (const row of trace)
    byCategory.set(row.category, [...(byCategory.get(row.category) ?? []), row]);
  const categories = [...byCategory.keys()].sort(
    (a, b) => IMPACT_CATEGORY_ORDER.indexOf(a) - IMPACT_CATEGORY_ORDER.indexOf(b),
  );
  const codeOf = (id: string) =>
    trace.find((r) => r.reached_id === id)?.reference_code ?? "a shared element";
  const hrefOf = (row: ImpactTraceRow) =>
    row.reached_type === "element"
      ? edgeSubjectHref(slug, { type: "element", id: row.reached_id, kind: row.kind })
      : row.reached_type === "evidence_source"
        ? `/internal/engagements/${slug}/evidence#${row.reached_id}`
        : edgeSubjectHref(slug, {
            type: row.reached_type,
            id: row.reached_id,
            referenceCode: row.reference_code,
          });
  const line = (row: ImpactTraceRow) => (
    <li
      key={`${row.reached_type}:${row.reached_id}`}
      className="flex flex-wrap items-baseline gap-2"
    >
      {row.reached_type === "evidence_source" ? (
        <span className="text-ink">{row.title}</span>
      ) : (
        <Link href={hrefOf(row)} className="group inline-flex items-baseline gap-2">
          <ReferenceCode code={row.reference_code} />
          <span className="text-ink group-hover:underline">{row.title}</span>
        </Link>
      )}
      <span className="text-xs text-ink-subtle">
        {linkWords(row.link_key, row.direction, code)}
        {row.depth > 1 ? " (two steps)" : ""}
        {row.assessment === "weak" ? " · weak link: shown on demand only" : ""}
      </span>
    </li>
  );
  return (
    <Panel
      title="Impact trace"
      description="What a change to this element may bear on, by the governed direction of each relationship. Structural parents and requirements are followed two steps; everything else one. A trace to read, not a score."
    >
      {trace.length === 0 ? (
        <EmptyState title="Nothing reached" />
      ) : (
        <div className="space-y-4">
          {categories.map((category) => {
            const rows = byCategory.get(category)!;
            const hubs = [...new Set(rows.filter(collapsed).map((r) => r.hub_element_id!))];
            return (
              <section key={category}>
                <h3 className="text-xs tracking-wide text-ink-subtle uppercase">
                  {IMPACT_CATEGORY_LABELS[category] ?? category}
                </h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {rows.filter((r) => !collapsed(r)).map(line)}
                </ul>
                {hubs.map((hub) => (
                  <details key={hub} className="mt-1 text-sm">
                    <summary className="cursor-pointer text-ink-muted">
                      {rows.filter((r) => r.hub_element_id === hub).length} records through{" "}
                      {codeOf(hub)}
                    </summary>
                    <ul className="mt-1 space-y-1 pl-4">
                      {rows.filter((r) => r.hub_element_id === hub).map(line)}
                    </ul>
                  </details>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/** Project Intelligence records bearing on an architecture element. */
export function BearingPanel({
  slug,
  engagementId,
  elementId,
  rows,
  today,
  edgeItems,
  canJudge,
  servesOutcomes,
}: {
  slug: string;
  engagementId: string;
  elementId: string;
  rows: RegisterRow[];
  today: string;
  /** Edge items where this element is subject, trigger or reached (§16). */
  edgeItems: EdgeItem[];
  canJudge: boolean;
  /** The D-38 fact: Intended Outcomes this element serves. A fact, never a condition. */
  servesOutcomes: number;
}) {
  const active = rows.filter(isActiveRecord);
  const events = groupEdgeItems(edgeItems);
  return (
    <Panel
      title="Bearing on this element"
      description="Open assumptions, risks, constraints, dependencies, decisions, recommendations and opportunities related to it, then what the Development Edge finds bearing on it. Each Edge line is a prompt to look, never a conclusion."
      actions={
        <span className="flex flex-wrap gap-4">
          <Link
            href={`/internal/engagements/${slug}/intelligence?element=${elementId}&status=all`}
            className="text-sm text-ink-muted hover:underline"
          >
            Open in the register
          </Link>
          <Link
            href={`/internal/engagements/${slug}/edge`}
            className="text-sm text-ink-muted hover:underline"
          >
            Open the Edge
          </Link>
        </span>
      }
    >
      <div className="space-y-4">
        {servesOutcomes > 0 ? (
          <p className="text-sm text-ink-muted">
            Serves {servesOutcomes} Intended {servesOutcomes === 1 ? "Outcome" : "Outcomes"}.
          </p>
        ) : null}
        {active.length === 0 ? (
          <EmptyState title="Nothing open bears on it" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule text-sm">
            {active.map((row) => (
              <li key={row.element_id} className="flex flex-wrap items-center gap-3 py-2">
                <Link
                  href={`/internal/engagements/${slug}/architecture/elements/${row.element_id}`}
                  className="group inline-flex items-baseline gap-2"
                >
                  <ReferenceCode code={row.reference_code} />
                  <span className="text-ink group-hover:underline">{row.title}</span>
                </Link>
                <span className="text-xs text-ink-subtle">{RECORD_KIND_LABELS[row.kind]}</span>
                <RecordStatusTag kind={row.kind} status={row.status} />
                <AttentionTag attention={row.attention} />
                {row.next_review_on && row.next_review_on < today ? (
                  <span className="text-xs text-negative">Review overdue</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {events.length > 0 ? (
          <div>
            <p className="text-xs tracking-wide text-ink-subtle uppercase">
              On the Development Edge
            </p>
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
        ) : null}
      </div>
    </Panel>
  );
}
