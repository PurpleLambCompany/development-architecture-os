import Link from "next/link";
import { judgeEdgeEvent, judgeEdgeItem } from "@/domain/edge/actions";
import { eventHeading, type EdgeConsequence, type EdgeEvent } from "@/domain/edge/grouping";
import {
  EDGE_TIER_LABELS,
  JUDGMENT_LABELS,
  TIER_REASON_LABELS,
  type EdgeItem,
  type EdgeTier,
  type JudgmentKind,
} from "@/domain/edge/items";
import { describeOrderFacts } from "@/domain/edge/ordering";
import {
  EDGE_LENS_LABELS,
  EPISTEMIC_LABELS,
  resolvingActLabel,
  type EdgeLens,
  type EpistemicStatus,
} from "@/domain/edge/rules";
import { itemLine } from "@/domain/edge/words";
import { formatDate, formatDateTime } from "@/lib/format";
import { ReferenceCode } from "@/components/architecture/badges";
import { ActionForm } from "@/components/ui/action-form";
import { StatusTag } from "@/components/ui/status-tag";
import { judgmentFields } from "./judgment-fields";
import { edgeSubjectHref } from "./links";

const RECORD_KINDS_FOR_PROMOTION = ["risk", "decision", "recommendation"] as const;

function labels(event: EdgeEvent): string {
  const lenses = event.lenses.map((l) => EDGE_LENS_LABELS[l as EdgeLens] ?? l).join(", ");
  const statuses = event.epistemicStatuses
    .map((s) => EPISTEMIC_LABELS[s as EpistemicStatus] ?? s)
    .join(", ");
  return `${lenses} · ${statuses}`;
}

function whyLines(event: EdgeEvent): string[] {
  const withDate = event.items.find(
    (i) => i.order_facts?.governance_date === event.orderKey.governanceDate,
  );
  const facts = {
    governance_date: event.orderKey.governanceDate,
    governance_kind: withDate?.order_facts?.governance_kind ?? null,
    governance_reference_code: withDate?.order_facts?.governance_reference_code ?? null,
    reach_class: event.orderKey.reachClass,
    constrained_initiatives:
      Math.max(0, ...event.items.map((i) => i.order_facts?.constrained_initiatives ?? 0)) || null,
    responsible: event.orderKey.responsible,
  };
  const lines: string[] = [];
  const reasons = [
    ...new Set(event.items.filter((i) => i.tier === event.tier).map((i) => i.tier_reason)),
  ];
  for (const r of reasons)
    if (r !== "rule_default" && r !== "ambient_rule") lines.push(TIER_REASON_LABELS[r] ?? r);
  const reached =
    event.consequences.length + event.hubs.reduce((n, h) => n + h.consequences.length, 0);
  if (event.triggerType !== "state" && event.triggerType !== "date" && reached > 1)
    lines.push(`${reached} records reached`);
  return [...lines, ...describeOrderFacts(facts)];
}

function JudgmentLine({ item }: { item: EdgeItem }) {
  if (!item.judgment_kind) return null;
  const label = JUDGMENT_LABELS[item.judgment_kind as JudgmentKind] ?? item.judgment_kind;
  return (
    <p className="mt-1 text-xs text-ink-muted">
      {item.judgment_kind === "investigating" ? "Being examined" : label} by{" "}
      {item.judged_by_name ?? "a colleague"}
      {item.judged_at ? ` since ${formatDate(item.judged_at.slice(0, 10))}` : ""}
      {item.judgment_expires_on ? `, until ${formatDate(item.judgment_expires_on)}` : ""}
      {item.judgment_reason ? `: ${item.judgment_reason}` : ""}
      {item.promoted_element_id ? " (promoted to a governed record)" : ""}
    </p>
  );
}

function ConsequenceRow({
  slug,
  engagementId,
  line,
  canJudge,
}: {
  slug: string;
  engagementId: string;
  line: EdgeConsequence;
  canJudge: boolean;
}) {
  const item = line.primary;
  const promoteHref = (kind: string) =>
    `/internal/engagements/${slug}/intelligence?${new URLSearchParams({
      new: kind,
      promoteRule: item.rule_key,
      promoteType: item.subject_type,
      promoteId: item.subject_id,
      promoteFp: item.fingerprint,
    }).toString()}`;
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {item.subject_type === "engagement" ? (
          <span className="text-sm text-ink">This engagement</span>
        ) : (
          <Link
            href={edgeSubjectHref(slug, {
              type: item.subject_type,
              id: item.subject_id,
              kind: item.subject_kind,
              referenceCode: item.subject_reference_code,
            })}
            className="group inline-flex items-baseline gap-2"
          >
            <ReferenceCode code={item.subject_reference_code} />
            <span className="text-sm text-ink group-hover:underline">{item.subject_title}</span>
          </Link>
        )}
        {line.tier === "human_flagged" ? (
          <StatusTag tone="attention">Escalated or critical</StatusTag>
        ) : null}
      </div>
      <p className="mt-0.5 text-sm text-ink-muted">{itemLine(item)}</p>
      {line.items.length > 1 ? (
        <p className="mt-0.5 text-xs text-ink-subtle">
          Also reached through the impact matrix:{" "}
          {line.items
            .filter((i) => i !== item)
            .map((i) => itemLine(i))
            .join("; ")}
        </p>
      ) : null}
      {line.items.map((i) => (
        <JudgmentLine key={i.item_key} item={i} />
      ))}
      {canJudge && !item.judged ? (
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <ActionForm
            trigger="Judge"
            fields={judgmentFields}
            defaultValues={{ kind: "investigating" }}
            action={judgeEdgeItem.bind(null, engagementId, {
              ruleKey: item.rule_key,
              subjectType: item.subject_type,
              subjectId: item.subject_id,
              fingerprint: item.fingerprint,
            })}
            submitLabel="Record judgment"
          />
          {item.subject_type === "element" || item.subject_type === "client_action" ? (
            <details className="text-sm">
              <summary className="cursor-pointer rounded-sm border border-rule px-2 py-1 text-ink-muted hover:text-ink">
                Promote
              </summary>
              <ul className="mt-2 space-y-1">
                {RECORD_KINDS_FOR_PROMOTION.map((kind) => (
                  <li key={kind}>
                    <Link href={promoteHref(kind)} className="text-ink-muted hover:underline">
                      Record a {kind}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** One Edge event: the trigger, its consequences, why it is here and what would resolve it (§8.2). */
export function EdgeEventCard({
  slug,
  engagementId,
  event,
  canJudge,
  compact = false,
}: {
  slug: string;
  engagementId: string;
  event: EdgeEvent;
  canJudge: boolean;
  compact?: boolean;
}) {
  const heading = eventHeading(event);
  const triggerHref = event.triggerSubjectId
    ? edgeSubjectHref(slug, { type: "element", id: event.triggerSubjectId })
    : null;
  const acts = [...new Set(event.items.map((i) => i.resolving_act))];
  const why = whyLines(event);
  const open = event.items.filter((i) => !i.judged);
  return (
    <article className="border-b border-rule py-4 last:border-b-0">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-base text-ink">
          {triggerHref && event.triggerType !== "state" && event.triggerType !== "date" ? (
            <Link href={triggerHref} className="hover:underline">
              {heading}
            </Link>
          ) : (
            heading
          )}
          {event.triggerType === "substantive_revision" && event.triggerVersionNo ? (
            <span className="ml-2 text-sm text-ink-muted">
              v{event.triggerVersionNo}
              {event.triggerAt ? `, published ${formatDateTime(event.triggerAt)}` : ""}
            </span>
          ) : null}
        </h3>
        <span className="text-xs tracking-wide text-ink-subtle uppercase">
          {labels(event)}
          {event.tier === "human_flagged" || event.tier === "elevated"
            ? ` · ${EDGE_TIER_LABELS[event.tier as EdgeTier]}`
            : ""}
        </span>
      </header>
      {event.changeSummary ? (
        <p className="mt-2 text-sm text-ink-muted">
          <span className="italic">“{event.changeSummary}”</span>{" "}
          <span className="text-xs text-ink-subtle">
            (the author’s change summary, shown as written)
          </span>
        </p>
      ) : null}
      {compact ? (
        <p className="mt-1 text-sm text-ink-muted">
          {event.items.length === 1
            ? itemLine(event.items[0]!)
            : `${event.consequences.length + event.hubs.length} lines`}
        </p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-rule">
            {event.consequences.map((line) => (
              <ConsequenceRow
                key={line.key}
                slug={slug}
                engagementId={engagementId}
                line={line}
                canJudge={canJudge}
              />
            ))}
          </ul>
          {event.hubs.map((hub) => (
            <details key={hub.hubElementId} className="mt-2 text-sm">
              <summary className="cursor-pointer text-ink-muted">
                {hub.consequences.length} records reached through{" "}
                {hub.hubReferenceCode ?? "a shared element"}
              </summary>
              <ul className="mt-1 divide-y divide-rule pl-4">
                {hub.consequences.map((line) => (
                  <ConsequenceRow
                    key={line.key}
                    slug={slug}
                    engagementId={engagementId}
                    line={line}
                    canJudge={canJudge}
                  />
                ))}
              </ul>
            </details>
          ))}
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {why.length > 0 ? (
              <div>
                <dt className="text-xs tracking-wide text-ink-subtle uppercase">
                  Why this is here
                </dt>
                <dd className="mt-0.5 text-ink-muted">{why.join(" · ")}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs tracking-wide text-ink-subtle uppercase">
                What would resolve it
              </dt>
              <dd className="mt-0.5 text-ink-muted">{acts.map(resolvingActLabel).join("; ")}</dd>
            </div>
          </dl>
          {canJudge && open.length > 1 ? (
            <div className="mt-3">
              <ActionForm
                trigger={`Judge all ${open.length}`}
                fields={judgmentFields}
                defaultValues={{ kind: "not_material" }}
                action={judgeEdgeEvent.bind(null, engagementId, event.key)}
                submitLabel={`Record for all ${open.length}`}
              />
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
