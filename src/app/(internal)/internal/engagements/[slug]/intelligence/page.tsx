import Link from "next/link";
import type { ReactNode } from "react";
import { createRecord } from "@/domain/architecture/actions";
import {
  CONFIDENCE_LABELS,
  CONSTRAINT_CATEGORY_LABELS,
  CONSTRAINT_STATUS,
  DECISION_STATUS,
  DEPENDENCY_STATUS,
  DEPENDENCY_TYPE_LABELS,
  DOMAIN_SHORT_LABELS,
  RECOMMENDATION_PRIORITY,
  RECORD_KIND_LABELS,
  RECORD_KIND_PLURALS,
  RISK_SCALE,
  RISK_STATUS,
  VALIDATION_STATUS,
  type RecordKind,
} from "@/domain/architecture/catalog";
import { getInternalArchitectureContext } from "@/domain/architecture/context";
import { buildGraph } from "@/domain/architecture/graph";
import { loadArchitecture, recordsOf, type LoadedElement } from "@/domain/architecture/queries";
import { RECORD_KINDS } from "@/domain/architecture/vocabulary";
import { formatDate } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ElementLink, InternalMark, LifecycleTag } from "@/components/architecture/badges";
import {
  newElementDefaults,
  newRecordDefaults,
  recordFields,
  spineFields,
} from "@/components/architecture/element-fields";
import { elementOptionLabel } from "@/components/architecture/relationships-panel";
import { ActionForm } from "@/components/ui/action-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const CONCERN_TYPES: Record<RecordKind, string[]> = {
  assumption: ["underpins", "affects"],
  risk: ["threatens", "affects"],
  constraint: ["constrains", "affects"],
  dependency: ["affects"],
  decision: ["affects"],
  recommendation: ["addresses", "affects"],
};

export default async function IntelligencePage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/intelligence">) {
  const { slug } = await params;
  const query = await searchParams;
  const kind = (RECORD_KINDS as readonly string[]).includes(String(query.kind))
    ? (query.kind as RecordKind)
    : "risk";
  const { engagement, canEdit, canPublish } = await getInternalArchitectureContext(slug);
  const architecture = await loadArchitecture(engagement.id);
  const graph = buildGraph(architecture.relationships);
  const records = recordsOf(architecture, kind).filter(
    (r) => query.show === "all" || (r.lifecycle !== "retired" && r.lifecycle !== "superseded"),
  );
  const here = `/internal/engagements/${slug}/intelligence?kind=${kind}`;
  const creating = query.new === kind && canEdit;
  const live = architecture.elements.filter(
    (e) => e.lifecycle !== "retired" && e.lifecycle !== "superseded",
  );

  const concerns = (r: LoadedElement) => {
    const ids = CONCERN_TYPES[kind].flatMap((t) =>
      graph.targets(r.id, t).map((e) => e.target_element_id),
    );
    return [...new Set(ids)]
      .map((id) => architecture.byId.get(id))
      .filter(Boolean) as LoadedElement[];
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Project Intelligence"].join(" · ")}
        title="Project Intelligence"
        description="Assumptions, risks, constraints, dependencies, decisions and recommendations. A record may span domains, concern specific elements, or apply to the whole engagement."
      />
      <ArchitectureNav slug={slug} current="intelligence" />

      <nav className="flex flex-wrap gap-2" aria-label="Record kinds">
        {RECORD_KINDS.map((k) => (
          <Link
            key={k}
            href={`/internal/engagements/${slug}/intelligence?kind=${k}`}
            aria-current={k === kind ? "page" : undefined}
            className={cn(
              "rounded-sm border px-3 py-1.5 text-sm",
              k === kind
                ? "border-accent bg-accent-soft text-accent"
                : "border-rule text-ink-muted hover:text-ink",
            )}
          >
            {RECORD_KIND_PLURALS[k]}{" "}
            <span className="text-xs text-ink-subtle tabular-nums">
              {recordsOf(architecture, k).filter((r) => r.lifecycle !== "retired").length}
            </span>
          </Link>
        ))}
      </nav>

      {canEdit ? (
        creating ? (
          <Panel title={`New ${RECORD_KIND_LABELS[kind].toLowerCase()}`}>
            <ActionForm
              fields={[
                ...spineFields(canPublish, { recommendation: kind === "recommendation" }),
                ...recordFields(
                  kind,
                  live.map((e) => ({ value: e.id, label: elementOptionLabel(e) })),
                ),
              ]}
              defaultValues={{
                ...newElementDefaults,
                ...newRecordDefaults[kind],
                ...(kind === "dependency" && live.length > 1
                  ? { fromElementId: live[0]!.id, toElementId: live[1]!.id }
                  : {}),
              }}
              action={createRecord.bind(null, engagement.id, kind)}
              submitLabel={`Create ${RECORD_KIND_LABELS[kind].toLowerCase()}`}
            />
            <Link href={here} className="mt-3 inline-block text-sm text-ink-muted hover:underline">
              Cancel
            </Link>
          </Panel>
        ) : (
          <div>
            <ButtonLink href={`${here}&new=${kind}`} size="sm">
              New {RECORD_KIND_LABELS[kind].toLowerCase()}
            </ButtonLink>
          </div>
        )
      ) : null}

      {kind === "risk" ? <RiskGrid slug={slug} risks={recordsOf(architecture, "risk")} /> : null}

      <Panel
        title={RECORD_KIND_PLURALS[kind]}
        actions={
          <Link
            href={query.show === "all" ? here : `${here}&show=all`}
            className="text-sm text-ink-muted hover:underline"
          >
            {query.show === "all" ? "Hide retired" : "Include retired and superseded"}
          </Link>
        }
      >
        {records.length === 0 ? (
          <EmptyState title={`No ${RECORD_KIND_PLURALS[kind].toLowerCase()} recorded`} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Record</Th>
                <Th>Scope</Th>
                <Th>Detail</Th>
                <Th>Concerns</Th>
                <Th>Lifecycle</Th>
              </tr>
            </thead>
            <tbody>
              {sortRecords(kind, records).map((r) => (
                <tr key={r.id}>
                  <Td>
                    <span className="flex flex-wrap items-center gap-2">
                      <ElementLink slug={slug} element={r} />
                      {r.client_visibility === "internal" ? <InternalMark /> : null}
                    </span>
                  </Td>
                  <Td className="text-xs text-ink-muted">
                    {[
                      r.engagement_wide ? "Engagement-wide" : null,
                      ...r.domains.map((d) => DOMAIN_SHORT_LABELS[d]),
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </Td>
                  <Td>
                    <RecordDetail element={r} slug={slug} architecture={architecture} />
                  </Td>
                  <Td>
                    <span className="flex flex-col gap-1">
                      {concerns(r).map((c) => (
                        <ElementLink key={c.id} slug={slug} element={c} />
                      ))}
                    </span>
                  </Td>
                  <Td>
                    <LifecycleTag lifecycle={r.lifecycle} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

function sortRecords(kind: RecordKind, records: LoadedElement[]) {
  const copy = [...records];
  if (kind === "risk") {
    copy.sort(
      (a, b) =>
        ((b.record?.kind === "risk" && b.record.row.severity) || 0) -
        ((a.record?.kind === "risk" && a.record.row.severity) || 0),
    );
  }
  if (kind === "dependency") {
    copy.sort(
      (a, b) =>
        Number(b.record?.kind === "dependency" && b.record.row.blocking) -
        Number(a.record?.kind === "dependency" && a.record.row.blocking),
    );
  }
  return copy;
}

function RecordDetail({
  element,
  slug,
  architecture,
}: {
  element: LoadedElement;
  slug: string;
  architecture: Awaited<ReturnType<typeof loadArchitecture>>;
}): ReactNode {
  const record = element.record;
  if (!record) return null;
  const tag = (label: { label: string; tone: Parameters<typeof StatusTag>[0]["tone"] }) => (
    <StatusTag tone={label.tone}>{label.label}</StatusTag>
  );
  switch (record.kind) {
    case "assumption":
      return (
        <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {tag(VALIDATION_STATUS[record.row.validation_status])}
          Confidence {CONFIDENCE_LABELS[record.row.confidence].toLowerCase()}
        </span>
      );
    case "risk":
      return (
        <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {tag(RISK_STATUS[record.row.risk_status])}
          <span className="tabular-nums">
            {record.row.probability} × {record.row.impact} = {record.row.severity}
          </span>
        </span>
      );
    case "constraint":
      return (
        <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {tag(CONSTRAINT_STATUS[record.row.constraint_status])}
          {CONSTRAINT_CATEGORY_LABELS[record.row.category]}
          {record.row.negotiable ? " · negotiable" : ""}
        </span>
      );
    case "dependency": {
      const from = architecture.byId.get(record.row.from_element_id);
      const to = architecture.byId.get(record.row.to_element_id);
      return (
        <span className="flex flex-col gap-1 text-xs text-ink-muted">
          <span className="flex flex-wrap items-center gap-2">
            {record.row.blocking ? <StatusTag tone="negative">Blocking</StatusTag> : null}
            {tag(DEPENDENCY_STATUS[record.row.dependency_status])}
            {DEPENDENCY_TYPE_LABELS[record.row.dependency_type]}
          </span>
          {from && to ? (
            <span>
              <ElementLink slug={slug} element={from} /> depends on{" "}
              <ElementLink slug={slug} element={to} />
            </span>
          ) : null}
        </span>
      );
    }
    case "decision":
      return (
        <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {tag(DECISION_STATUS[record.row.decision_status])}
          {record.row.needed_by ? `Needed by ${formatDate(record.row.needed_by)}` : null}
        </span>
      );
    case "recommendation":
      return tag(RECOMMENDATION_PRIORITY[record.row.priority]);
  }
}

/** Probability × impact grid of open risks: a register view, not a score. */
function RiskGrid({ slug, risks }: { slug: string; risks: LoadedElement[] }) {
  const open = risks.filter(
    (r) =>
      r.record?.kind === "risk" &&
      r.record.row.risk_status !== "closed" &&
      r.lifecycle !== "retired" &&
      r.lifecycle !== "superseded",
  );
  const at = (p: number, i: number) =>
    open.filter(
      (r) =>
        r.record?.kind === "risk" && r.record.row.probability === p && r.record.row.impact === i,
    );
  return (
    <Panel
      title="Risk grid"
      description="Open and mitigating risks by probability (rows) and impact (columns)."
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-24 px-2 py-1 text-left font-medium text-ink-subtle">
                Probability ↓ Impact →
              </th>
              {RISK_SCALE.map((i) => (
                <th key={i} className="px-2 py-1 text-center font-medium text-ink-subtle">
                  {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...RISK_SCALE].reverse().map((p) => (
              <tr key={p}>
                <th className="px-2 py-1 text-left font-medium text-ink-subtle">{p}</th>
                {RISK_SCALE.map((i) => (
                  <td
                    key={i}
                    className={cn(
                      "h-14 border border-rule px-2 py-1 align-top",
                      p * i >= 15 ? "bg-negative-soft" : p * i >= 8 ? "bg-attention-soft" : "",
                    )}
                  >
                    {at(p, i).map((r) => (
                      <ElementLink key={r.id} slug={slug} element={r} className="block" />
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
