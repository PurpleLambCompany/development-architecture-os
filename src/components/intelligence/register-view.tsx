import Link from "next/link";
import type { ReactNode } from "react";
import {
  CONFIDENCE_LABELS,
  CONSTRAINT_CATEGORY_LABELS,
  DOMAINS,
  DOMAIN_SHORT_LABELS,
  LIFECYCLE,
  OPPORTUNITY_SCALE,
  PROVENANCE_LABELS,
  PROVENANCE_TYPES,
  RECOMMENDATION_PRIORITY,
  RECORD_KIND_LABELS,
  RECORD_KIND_PLURALS,
  RISK_SCALE,
  type ConstraintCategory,
  type RecordKind,
} from "@/domain/architecture/catalog";
import { RECORD_KINDS } from "@/domain/architecture/vocabulary";
import { triageRecord } from "@/domain/intelligence/actions";
import {
  ACTIVE_STATUSES,
  ATTENTION,
  ATTENTION_LEVELS,
  ESCALATION_LEVEL_LABELS,
  INTELLIGENCE_CATEGORIES,
  TERMINAL_STATUSES,
  TRIAGE_STATE,
  categoryLabel,
  isCategorizedKind,
  isResolvableKind,
  recordStatus,
} from "@/domain/intelligence/catalog";
import {
  REGISTER_ORDER_EXPLANATIONS,
  isActiveRecord,
  registerQuery,
  type RegisterFilters,
  type RegisterRow,
} from "@/domain/intelligence/register";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InternalMark, ReferenceCode } from "@/components/architecture/badges";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";
import { triageFields } from "./fields";

/** Where a record's page is, by engagement. */
export type RecordHref = (row: Pick<RegisterRow, "engagement_id" | "element_id">) => string;

export function AttentionTag({ attention }: { attention: RegisterRow["attention"] }) {
  return <StatusTag tone={ATTENTION[attention].tone}>{ATTENTION[attention].label}</StatusTag>;
}

export function RecordStatusTag({ kind, status }: { kind: RecordKind; status: string | null }) {
  const label = recordStatus(kind, status);
  return label ? <StatusTag tone={label.tone}>{label.label}</StatusTag> : null;
}

/** Kind tabs with the number of active records of each kind. */
export function KindTabs({
  base,
  filters,
  counts,
}: {
  base: string;
  filters: RegisterFilters;
  counts: Record<RecordKind, number>;
}) {
  const tabs: { kind: RecordKind | null; label: string; count: number }[] = [
    { kind: null, label: "All records", count: Object.values(counts).reduce((a, b) => a + b, 0) },
    ...RECORD_KINDS.map((k) => ({ kind: k, label: RECORD_KIND_PLURALS[k], count: counts[k] })),
  ];
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Record kinds">
      {tabs.map((tab) => {
        const query = registerQuery({ kind: tab.kind });
        return (
          <Link
            key={tab.label}
            href={query ? `${base}?${query}` : base}
            aria-current={tab.kind === filters.kind ? "page" : undefined}
            className={cn(
              "rounded-sm border px-3 py-1.5 text-sm",
              tab.kind === filters.kind
                ? "border-ink/40 bg-surface text-ink"
                : "border-rule text-ink-muted hover:text-ink",
            )}
          >
            {tab.label} <span className="text-xs text-ink-subtle tabular-nums">{tab.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** The register filters, as a plain GET form: a filtered register is a shareable URL. */
export function RegisterFilterForm({
  base,
  filters,
  owners,
  elements,
}: {
  base: string;
  filters: RegisterFilters;
  owners?: { value: string; label: string }[];
  elements?: { value: string; label: string }[];
}) {
  const statusOptions: { value: string; label: string }[] = [
    { value: "active", label: "Open (unresolved)" },
    { value: "resolved", label: "Resolved or settled" },
    { value: "all", label: "Any status" },
  ];
  if (filters.kind && isResolvableKind(filters.kind)) {
    for (const s of [...ACTIVE_STATUSES[filters.kind], ...TERMINAL_STATUSES[filters.kind]]) {
      statusOptions.push({ value: s, label: recordStatus(filters.kind, s)?.label ?? s });
    }
  }
  const categories = filters.kind
    ? isCategorizedKind(filters.kind)
      ? INTELLIGENCE_CATEGORIES[filters.kind].map((c) => ({ value: c.key, label: c.label }))
      : filters.kind === "constraint"
        ? Object.entries(CONSTRAINT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
        : []
    : [];
  const select = (
    name: string,
    label: string,
    value: string | null,
    options: { value: string; label: string }[],
    any = "Any",
  ) => (
    <label className="space-y-1 text-xs text-ink-subtle">
      <span className="block tracking-wide uppercase">{label}</span>
      <Select name={name} defaultValue={value ?? ""} className="h-9">
        {any ? <option value="">{any}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
  const hasFilters = registerQuery({ ...filters, kind: null }) !== "";
  return (
    <form
      method="get"
      action={base}
      className="rounded-sm border border-rule bg-surface px-5 py-4"
      aria-label="Filter the register"
    >
      {filters.kind ? <input type="hidden" name="kind" value={filters.kind} /> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {select("status", "Status", filters.status, statusOptions, "")}
        {select(
          "attention",
          "Attention",
          filters.attention,
          ATTENTION_LEVELS.map((a) => ({ value: a, label: ATTENTION[a].label })),
        )}
        {select("triage", "Triage", filters.triage, [
          { value: "untriaged", label: TRIAGE_STATE.untriaged.label },
          { value: "triaged", label: TRIAGE_STATE.triaged.label },
        ])}
        {select(
          "domain",
          "Domain",
          filters.domain,
          DOMAINS.map((d) => ({ value: d, label: DOMAIN_SHORT_LABELS[d] })),
        )}
        {select("review", "Review", filters.review, [
          { value: "overdue", label: "Overdue" },
          { value: "soon", label: "Due within 14 days" },
        ])}
        {categories.length ? select("category", "Category", filters.category, categories) : null}
        {select("visibility", "Visibility", filters.visibility, [
          { value: "client", label: "Client-visible" },
          { value: "internal", label: "Internal only" },
        ])}
        {select(
          "lifecycle",
          "Lifecycle",
          filters.lifecycle,
          Object.entries(LIFECYCLE).map(([value, l]) => ({ value, label: l.label })),
        )}
        {select(
          "provenance",
          "Provenance",
          filters.provenance,
          PROVENANCE_TYPES.map((p) => ({ value: p, label: PROVENANCE_LABELS[p] })),
        )}
        {owners?.length ? select("owner", "Owner", filters.owner, owners) : null}
        {elements?.length ? select("element", "Bears on", filters.element, elements) : null}
        <label className="space-y-1 text-xs text-ink-subtle">
          <span className="block tracking-wide uppercase">Search</span>
          <Input name="q" defaultValue={filters.q} className="h-9" placeholder="Title or code" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink">
        {(
          [
            ["escalated", "Escalated", filters.escalated],
            ["actions", "Open client requests", filters.openActions],
            ["signals", "Open signals", filters.signalled],
            ["wide", "Engagement-wide", filters.engagementWide],
          ] as const
        ).map(([name, label, checked]) => (
          <label key={name} className="flex items-center gap-2">
            <input
              type="checkbox"
              name={name}
              value="yes"
              defaultChecked={checked}
              className="size-4 accent-accent"
            />
            {label}
          </label>
        ))}
        <span className="ml-auto flex gap-2">
          {hasFilters ? (
            <Link
              href={filters.kind ? `${base}?kind=${filters.kind}` : base}
              className="self-center text-sm text-ink-muted hover:underline"
            >
              Clear filters
            </Link>
          ) : null}
          <Button type="submit" size="sm" variant="secondary">
            Apply
          </Button>
        </span>
      </div>
    </form>
  );
}

/** Facts that set a record's place in its register, by kind. */
function RowFacts({ row }: { row: RegisterRow }): ReactNode {
  const facts: ReactNode[] = [];
  switch (row.kind) {
    case "risk":
      facts.push(
        <span key="s" className="tabular-nums">
          {row.probability} × {row.impact} = {row.severity}
        </span>,
      );
      break;
    case "assumption":
      if (row.confidence)
        facts.push(`Confidence ${CONFIDENCE_LABELS[row.confidence].toLowerCase()}`);
      break;
    case "constraint":
      facts.push(row.negotiable ? "Negotiable" : "Non-negotiable");
      break;
    case "dependency":
      if (row.blocking)
        facts.push(
          <StatusTag key="b" tone="negative">
            Blocking
          </StatusTag>,
        );
      break;
    case "decision":
      if (row.needed_by) facts.push(`Needed by ${formatDate(row.needed_by)}`);
      break;
    case "recommendation":
      if (row.priority) {
        const p = RECOMMENDATION_PRIORITY[row.priority];
        facts.push(
          <StatusTag key="p" tone={p.tone}>
            {p.label}
          </StatusTag>,
        );
      }
      if (row.approval_state === "awaiting_response") facts.push("Awaiting the client");
      break;
    case "opportunity":
      facts.push(
        <span key="a" className="tabular-nums">
          {row.value} × {row.feasibility} = {row.attractiveness}
        </span>,
      );
      if (row.window_closes_on) facts.push(`Window closes ${formatDate(row.window_closes_on)}`);
      break;
  }
  const category =
    row.kind === "constraint"
      ? CONSTRAINT_CATEGORY_LABELS[row.category as ConstraintCategory]
      : categoryLabel(row.kind, row.category);
  if (category && row.category !== "other") facts.push(category);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
      <RecordStatusTag kind={row.kind} status={row.status} />
      {facts.map((f, i) => (
        <span key={i}>{f}</span>
      ))}
    </span>
  );
}

export function RegisterTable({
  rows,
  filters,
  recordHref,
  today,
  canTriage,
  engagementLabel,
  signalCounts,
}: {
  rows: RegisterRow[];
  filters: RegisterFilters;
  recordHref: RecordHref;
  today: string;
  /** Whether the viewer may triage the record's engagement. */
  canTriage: (row: RegisterRow) => boolean;
  /** For cross-engagement registers: the engagement's name. */
  engagementLabel?: (row: RegisterRow) => string;
  signalCounts?: ReadonlyMap<string, number>;
}) {
  const kind = filters.kind;
  return (
    <Panel
      title={kind ? RECORD_KIND_PLURALS[kind] : "All records"}
      description={`${rows.length} shown. Order: ${REGISTER_ORDER_EXPLANATIONS[kind ?? "all"]}`}
    >
      {rows.length === 0 ? (
        <EmptyState title="No records match">Change the filters to see more.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Record</Th>
              {engagementLabel ? <Th>Engagement</Th> : null}
              <Th>Status and facts</Th>
              <Th>Attention</Th>
              <Th>Scope</Th>
              <Th className="w-40">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overdue =
                isActiveRecord(row) && !!row.next_review_on && row.next_review_on < today;
              const signals = signalCounts?.get(row.element_id) ?? 0;
              return (
                <tr key={row.element_id} className={isActiveRecord(row) ? undefined : "opacity-70"}>
                  <Td>
                    <Link href={recordHref(row)} className="group inline-flex items-baseline gap-2">
                      <ReferenceCode code={row.reference_code} />
                      <span className="text-ink group-hover:underline">{row.title}</span>
                    </Link>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      {kind ? null : (
                        <span className="text-xs text-ink-subtle">
                          {RECORD_KIND_LABELS[row.kind]}
                        </span>
                      )}
                      {row.client_visibility === "internal" ? <InternalMark /> : null}
                      {row.lifecycle !== "published" ? (
                        <span className="text-xs text-ink-subtle">
                          {LIFECYCLE[row.lifecycle].label}
                        </span>
                      ) : null}
                    </span>
                  </Td>
                  {engagementLabel ? (
                    <Td className="text-xs text-ink-muted">{engagementLabel(row)}</Td>
                  ) : null}
                  <Td>
                    <RowFacts row={row} />
                  </Td>
                  <Td>
                    <span className="flex flex-col gap-1 text-xs text-ink-muted">
                      <span className="flex flex-wrap items-center gap-2">
                        <AttentionTag attention={row.attention} />
                        {row.triage_state === "untriaged" ? (
                          <span className="text-attention">Untriaged</span>
                        ) : null}
                      </span>
                      {row.open_escalations.map((level) => (
                        <span key={level} className="text-negative">
                          Escalated to {ESCALATION_LEVEL_LABELS[level].toLowerCase()}
                        </span>
                      ))}
                      {row.next_review_on ? (
                        <span className={overdue ? "text-negative" : undefined}>
                          Review {overdue ? "overdue since" : "by"} {formatDate(row.next_review_on)}
                        </span>
                      ) : null}
                      {row.open_client_actions > 0 ? (
                        <span>
                          {row.open_client_actions} open client request
                          {row.open_client_actions === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {signals > 0 ? (
                        <span>
                          {signals} signal{signals === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                  </Td>
                  <Td className="text-xs text-ink-muted">
                    {[
                      row.engagement_wide ? "Engagement-wide" : null,
                      ...row.domains.map((d) => DOMAIN_SHORT_LABELS[d]),
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </Td>
                  <Td>
                    {canTriage(row) && isActiveRecord(row) ? (
                      <ActionForm
                        trigger="Triage"
                        fields={triageFields}
                        defaultValues={{
                          attention: row.attention,
                          nextReviewOn: row.next_review_on ?? "",
                        }}
                        action={triageRecord.bind(null, row.element_id)}
                        submitLabel="Save triage"
                        className="min-w-72"
                      />
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

/** Open risks by probability (rows) and impact (columns). A register view, not a score. */
export function RiskGrid({ rows, recordHref }: { rows: RegisterRow[]; recordHref: RecordHref }) {
  const open = rows.filter((r) => r.kind === "risk" && isActiveRecord(r));
  return (
    <ScaleGrid
      title="Risk grid"
      description="Open and mitigating risks by probability (rows) and impact (columns)."
      rowLabel="Probability"
      columnLabel="Impact"
      scale={RISK_SCALE}
      at={(p, i) => open.filter((r) => r.probability === p && r.impact === i)}
      tone={(p, i) => (p * i >= 15 ? "bg-negative-soft" : p * i >= 8 ? "bg-attention-soft" : "")}
      recordHref={recordHref}
    />
  );
}

/** Open opportunities by value (rows) and feasibility (columns). */
export function OpportunityGrid({
  rows,
  recordHref,
}: {
  rows: RegisterRow[];
  recordHref: RecordHref;
}) {
  const open = rows.filter((r) => r.kind === "opportunity" && isActiveRecord(r));
  return (
    <ScaleGrid
      title="Opportunity grid"
      description="Open opportunities by value if realized (rows) and feasibility (columns)."
      rowLabel="Value"
      columnLabel="Feasibility"
      scale={OPPORTUNITY_SCALE}
      at={(v, f) => open.filter((r) => r.value === v && r.feasibility === f)}
      tone={(v, f) => (v * f >= 15 ? "bg-positive-soft" : v * f >= 8 ? "bg-accent-soft" : "")}
      recordHref={recordHref}
    />
  );
}

function ScaleGrid({
  title,
  description,
  rowLabel,
  columnLabel,
  scale,
  at,
  tone,
  recordHref,
}: {
  title: string;
  description: string;
  rowLabel: string;
  columnLabel: string;
  scale: readonly number[];
  at: (row: number, column: number) => RegisterRow[];
  tone: (row: number, column: number) => string;
  recordHref: RecordHref;
}) {
  return (
    <Panel title={title} description={description}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-28 px-2 py-1 text-left font-medium text-ink-subtle">
                {rowLabel} ↓ {columnLabel} →
              </th>
              {scale.map((c) => (
                <th key={c} className="px-2 py-1 text-center font-medium text-ink-subtle">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...scale].reverse().map((r) => (
              <tr key={r}>
                <th className="px-2 py-1 text-left font-medium text-ink-subtle">{r}</th>
                {scale.map((c) => (
                  <td
                    key={c}
                    className={cn("h-14 border border-rule px-2 py-1 align-top", tone(r, c))}
                  >
                    {at(r, c).map((row) => (
                      <Link
                        key={row.element_id}
                        href={recordHref(row)}
                        className="block hover:underline"
                        title={row.title}
                      >
                        <ReferenceCode code={row.reference_code} />{" "}
                        <span className="text-ink">{row.title}</span>
                      </Link>
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
