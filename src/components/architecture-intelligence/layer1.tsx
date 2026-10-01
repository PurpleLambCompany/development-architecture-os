import Link from "next/link";
import type { ReactNode } from "react";
import { ReferenceCode } from "@/components/architecture/badges";
import { edgeSubjectHref } from "@/components/edge/links";
import {
  EDGE_TIER_LABELS,
  JUDGMENT_LABELS,
  TIER_REASON_LABELS,
  type EdgeItem,
  type EdgeTier,
  type JudgmentKind,
} from "@/domain/edge/items";
import {
  EDGE_LENS_LABELS,
  EPISTEMIC_LABELS,
  edgeRule,
  edgeRuleLabel,
  resolvingActLabel,
  type EdgeLens,
  type EpistemicStatus,
} from "@/domain/edge/rules";
import { itemLine, linkWords } from "@/domain/edge/words";
import { formatDate, formatDateTime } from "@/lib/format";

/**
 * Layer 1 of the intelligence drawer: what DSA knows, assembled
 * deterministically from governed records (7B.2 proposal §7). Complete on its
 * own, the same with Architecture Intelligence off, and never phrased as
 * an invitation to interpret.
 */

export function FactSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      <div className="text-sm text-ink-muted">{children}</div>
    </div>
  );
}

export function FactList({ items }: { items: ReactNode[] }) {
  if (items.length === 0) return <p className="text-sm text-ink-subtle">None recorded.</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Code({
  slug,
  id,
  code,
  kind,
}: {
  slug: string;
  id: string;
  code: string | null;
  kind?: string | null;
}) {
  return (
    <Link
      href={edgeSubjectHref(slug, { type: "element", id, kind: kind ?? null })}
      className="hover:underline"
    >
      <ReferenceCode code={code} />
    </Link>
  );
}

/** "Why am I seeing this?" for one Edge item (§7, Edge item row). */
export function EdgeItemFacts({ item, slug }: { item: EdgeItem; slug: string }) {
  const rule = edgeRule(item.rule_key);
  const path = item.consequence_path ?? [];
  return (
    <div className="space-y-4">
      <FactSection title={edgeRuleLabel(item.rule_key)}>
        <p className="text-ink">{itemLine(item)}</p>
        {rule ? <p className="mt-1">{rule.definition}</p> : null}
        {rule?.why ? <p className="mt-1 text-xs text-ink-subtle">{rule.why}</p> : null}
      </FactSection>
      <FactSection title="Lens and standing">
        {EDGE_LENS_LABELS[item.lens as EdgeLens] ?? item.lens} ·{" "}
        {EPISTEMIC_LABELS[item.epistemic_status as EpistemicStatus] ?? item.epistemic_status}
      </FactSection>
      <FactSection title="What changed">
        {item.trigger_reference_code ? (
          <p>
            {item.trigger_subject_id ? (
              <Code slug={slug} id={item.trigger_subject_id} code={item.trigger_reference_code} />
            ) : (
              <ReferenceCode code={item.trigger_reference_code} />
            )}{" "}
            {item.trigger_title}
            {item.trigger_version_no ? `, v${item.trigger_version_no}` : ""}
            {item.trigger_at ? `, ${formatDateTime(item.trigger_at)}` : ""}
          </p>
        ) : (
          <p>{item.trigger_type === "date" ? "A date was reached." : "A recorded state holds."}</p>
        )}
      </FactSection>
      <FactSection title="Records it reads">
        <FactList
          items={(item.basis ?? []).map((b) => (
            <span key={`${b.type}:${b.id}`}>
              <ReferenceCode code={b.reference_code ?? null} /> {b.type.replaceAll("_", " ")}
              {b.version_no ? ` v${b.version_no}` : ""}
              {b.role ? ` (${b.role.replaceAll("_", " ")})` : ""}
            </span>
          ))}
        />
      </FactSection>
      {path.length > 0 ? (
        <FactSection title="Consequence path">
          <FactList
            items={path.map((step, i) => (
              <span key={i}>
                {linkWords(step.link_key, step.direction, item.trigger_reference_code ?? "it")}
                {step.terminal ? "" : " …"}
              </span>
            ))}
          />
        </FactSection>
      ) : null}
      <FactSection title="Where it sits">
        {EDGE_TIER_LABELS[item.tier as EdgeTier] ?? item.tier}
        {item.tier_reason && item.tier_reason !== "rule_default"
          ? `: ${TIER_REASON_LABELS[item.tier_reason] ?? item.tier_reason}`
          : ""}
      </FactSection>
      <FactSection title="What would resolve it">
        {resolvingActLabel(item.resolving_act)}
      </FactSection>
      {item.judgment_kind ? (
        <FactSection title="Current judgment">
          {JUDGMENT_LABELS[item.judgment_kind as JudgmentKind] ?? item.judgment_kind} by{" "}
          {item.judged_by_name ?? "a colleague"}
          {item.judged_at ? ` on ${formatDate(item.judged_at)}` : ""}
          {item.judgment_reason ? `: ${item.judgment_reason}` : ""}
        </FactSection>
      ) : null}
    </div>
  );
}

type SnapshotLike = {
  summary?: string;
  statements?: { id: string; body: string; statement_kind: string }[];
} | null;

/** A substantive revision: from and to versions, changed paths, statements before and after. */
export function RevisionFacts({
  code,
  fromNo,
  toNo,
  publishedAt,
  changedPaths,
  changeSummary,
  before,
  after,
  statusPublications,
  approvals,
}: {
  code: string;
  fromNo: number | null;
  toNo: number;
  publishedAt: string;
  changedPaths: string[];
  changeSummary: string;
  before: SnapshotLike;
  after: SnapshotLike;
  statusPublications: { versionNo: number; publishedAt: string }[];
  approvals: string[];
}) {
  const was = new Map((before?.statements ?? []).map((s) => [s.id, s]));
  const now = new Map((after?.statements ?? []).map((s) => [s.id, s]));
  const added = [...now.values()].filter((s) => !was.has(s.id));
  const removed = [...was.values()].filter((s) => !now.has(s.id));
  const changed = [...now.values()].filter((s) => was.has(s.id) && was.get(s.id)!.body !== s.body);
  return (
    <div className="space-y-4">
      <FactSection title="Versions">
        {code} {fromNo ? `v${fromNo} to ` : ""}v{toNo}, published {formatDateTime(publishedAt)}
        {changeSummary ? `. ${changeSummary}` : ""}
      </FactSection>
      <FactSection title="Changed">
        {changedPaths.length > 0
          ? changedPaths.map((p) => p.replaceAll("_", " ")).join(", ")
          : "None recorded"}
      </FactSection>
      {before?.summary !== after?.summary ? (
        <FactSection title="Summary">
          <p className="line-through decoration-ink-subtle">{before?.summary || "—"}</p>
          <p className="text-ink">{after?.summary || "—"}</p>
        </FactSection>
      ) : null}
      {changed.length + added.length + removed.length > 0 ? (
        <FactSection title="Statements">
          <ul className="space-y-2">
            {changed.map((s) => (
              <li key={s.id}>
                <p className="text-xs text-ink-subtle">{s.statement_kind}, changed</p>
                <p className="line-through decoration-ink-subtle">{was.get(s.id)!.body}</p>
                <p className="text-ink">{s.body}</p>
              </li>
            ))}
            {added.map((s) => (
              <li key={s.id}>
                <p className="text-xs text-ink-subtle">{s.statement_kind}, added</p>
                <p className="text-ink">{s.body}</p>
              </li>
            ))}
            {removed.map((s) => (
              <li key={s.id}>
                <p className="text-xs text-ink-subtle">{s.statement_kind}, removed</p>
                <p className="line-through decoration-ink-subtle">{s.body}</p>
              </li>
            ))}
          </ul>
        </FactSection>
      ) : null}
      {statusPublications.length > 0 ? (
        <FactSection title="Status publications in between">
          <FactList
            items={statusPublications.map(
              (p) => `v${p.versionNo}, ${formatDateTime(p.publishedAt)}`,
            )}
          />
        </FactSection>
      ) : null}
      <FactSection title="Approvals touching either version">
        <FactList items={approvals} />
      </FactSection>
    </div>
  );
}

export type TraceRow = {
  reached_id: string;
  reached_type: string;
  reference_code: string;
  title: string;
  kind: string;
  link_key: string;
  direction: string;
  propagation: string;
  depth: number;
  assessment: string;
};

/** What changing an element reaches: path, direction, propagation and depth; reached records' Edge items. */
export function TraceFacts({
  slug,
  code,
  trace,
  reachedItems,
}: {
  slug: string;
  code: string;
  trace: TraceRow[];
  reachedItems: EdgeItem[];
}) {
  return (
    <div className="space-y-4">
      <FactSection title={`Reached from ${code}`}>
        <FactList
          items={trace.map((r) => (
            <span key={`${r.reached_type}:${r.reached_id}`}>
              {r.reached_type === "element" ? (
                <Code slug={slug} id={r.reached_id} code={r.reference_code} kind={r.kind} />
              ) : (
                <ReferenceCode code={r.reference_code} />
              )}{" "}
              {r.title}. {linkWords(r.link_key, r.direction, code)}
              {r.depth > 1 ? " (two steps)" : ""}. Propagation: {r.propagation.replaceAll("_", " ")}
              {r.assessment === "weak" ? "; weak link" : ""}.
            </span>
          ))}
        />
      </FactSection>
      <FactSection title="Current Edge items on reached records">
        <FactList
          items={reachedItems.map((i) => (
            <span key={i.item_key}>
              <ReferenceCode code={i.subject_reference_code} /> {itemLine(i)}
            </span>
          ))}
        />
      </FactSection>
    </div>
  );
}

type PairSide = {
  id: string;
  code: string;
  title: string;
  kind: string;
  versionNo: number | null;
  publishedAt: string | null;
  lastSubstantiveAt: string | null;
};

/** Two related elements side by side (§7, related pair): versions, the relationships between them, shared Edge items. */
export function PairFacts({
  slug,
  a,
  b,
  relationships,
  sharedItems,
}: {
  slug: string;
  a: PairSide;
  b: PairSide;
  relationships: string[];
  sharedItems: EdgeItem[];
}) {
  const side = (s: PairSide) => (
    <div key={s.id} className="rounded-sm border border-rule px-3 py-2">
      <p>
        <Code slug={slug} id={s.id} code={s.code} kind={s.kind} />{" "}
        <span className="text-ink">{s.title}</span>
      </p>
      <p className="text-xs">
        {s.versionNo ? `v${s.versionNo}, published ${formatDate(s.publishedAt)}` : "Not published"}
      </p>
      <p className="text-xs">
        {s.lastSubstantiveAt
          ? `Last substantive revision ${formatDate(s.lastSubstantiveAt)}`
          : "No substantive revision since first publication"}
      </p>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {side(a)}
        {side(b)}
      </div>
      <FactSection title="How they are connected">
        <FactList items={relationships} />
      </FactSection>
      <FactSection title="Edge items that read both">
        <FactList
          items={sharedItems.map((i) => (
            <span key={i.item_key}>
              <ReferenceCode code={i.subject_reference_code} /> {itemLine(i)}
            </span>
          ))}
        />
      </FactSection>
    </div>
  );
}
