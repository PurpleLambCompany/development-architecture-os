import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addAllPublishedToBaseline,
  addBaselineItem,
  deleteBaseline,
  freezeBaseline,
  recordExternalApproval,
  removeBaselineItem,
  requestApproval,
} from "@/domain/architecture/actions";
import {
  BASELINE_STATUS,
  DOMAIN_SHORT_LABELS,
  MATURITY_LABELS,
} from "@/domain/architecture/catalog";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import {
  compareBaselines,
  getBaseline,
  listBaselines,
  loadArchitecture,
} from "@/domain/architecture/queries";
import { relationshipType } from "@/domain/architecture/rules";
import { getBusinessToday } from "@/domain/finance/queries";
import { formatDateTime } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ElementLink } from "@/components/architecture/badges";
import { elementOptionLabel } from "@/components/architecture/relationships-panel";
import { ApprovalDetail, externalApprovalFields } from "@/components/architecture/versions-panel";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default async function BaselinePage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/baselines/[baselineId]">) {
  const { slug, baselineId } = await params;
  const query = await searchParams;
  const { engagement, canEdit, canPublish } = await getInternalArchitectureContext(slug);
  const [baseline, architecture, baselines] = await Promise.all([
    getBaseline(baselineId),
    loadArchitecture(engagement.id),
    listBaselines(engagement.id),
  ]);
  if (!baseline || baseline.engagement_id !== engagement.id) notFound();
  const nameOf = memberNames(engagement);
  const today = getBusinessToday();
  const draft = baseline.status === "draft";
  const base = `/internal/engagements/${slug}/baselines/${baseline.id}`;
  const items = baseline.architecture_baseline_items;
  const inBaseline = new Set(items.map((i) => i.element_id));
  const approval = architecture.approvals.find((a) => a.baseline_id === baseline.id);

  const versionOf = new Map(
    architecture.elements.flatMap((e) => e.versions.map((v) => [v.id, { e, v }] as const)),
  );
  const publishedNotIn = architecture.elements.filter(
    (e) => e.latestVersion && !inBaseline.has(e.id) && e.lifecycle !== "retired",
  );

  const compareTarget =
    query.compare === "current"
      ? "current"
      : baselines.find(
          (b) => b.id === query.compare && b.status === "frozen" && b.id !== baseline.id,
        );
  const comparison =
    baseline.status === "frozen" && compareTarget
      ? await compareBaselines(baseline.id, compareTarget === "current" ? null : compareTarget.id)
      : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Baseline"].join(" · ")}
        title={baseline.label}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <StatusTag tone={BASELINE_STATUS[baseline.status].tone}>
              {BASELINE_STATUS[baseline.status].label}
            </StatusTag>
            {baseline.frozen_at ? (
              <span>
                Frozen {formatDateTime(baseline.frozen_at)} by {nameOf(baseline.frozen_by)}
              </span>
            ) : null}
            {baseline.description ? <span>{baseline.description}</span> : null}
          </span>
        }
      />
      <ArchitectureNav slug={slug} current="baselines" />

      {draft ? (
        <Panel
          title="Draft baseline"
          description="Choose published versions. Freezing captures them, the relationships among them and the latest domain assessments; a frozen baseline never changes."
        >
          <div className="flex flex-wrap items-start gap-2">
            {canEdit && publishedNotIn.length > 0 ? (
              <ActionButton
                action={addAllPublishedToBaseline.bind(
                  null,
                  baseline.id,
                  publishedNotIn.map((e) => ({ elementId: e.id, versionId: e.latestVersion!.id })),
                )}
                label={`Add latest published version of all ${publishedNotIn.length} elements`}
              />
            ) : null}
            {canEdit && publishedNotIn.length > 0 ? (
              <ActionForm
                fields={[
                  {
                    name: "elementVersionId",
                    label: "Version",
                    type: "select",
                    options: publishedNotIn.flatMap((e) =>
                      e.versions.map((v) => ({
                        value: v.id,
                        label: `${elementOptionLabel(e)} · v${v.version_no}`,
                      })),
                    ),
                    wide: true,
                  },
                ]}
                action={addBaselineItem.bind(null, baseline.id)}
                submitLabel="Add version"
                trigger="Add a specific version"
              />
            ) : null}
            {canPublish ? (
              <ActionButton
                action={freezeBaseline.bind(null, baseline.id)}
                label="Freeze baseline"
                variant="primary"
                confirm="Freeze this baseline? Its contents can never change afterwards."
              />
            ) : null}
            {canEdit ? (
              <ActionButton
                action={deleteBaseline.bind(null, baseline.id)}
                label="Delete draft"
                variant="danger"
                confirm="Delete this draft baseline?"
              />
            ) : null}
          </div>
        </Panel>
      ) : (
        <Panel title="Approval">
          <div className="space-y-3">
            <ApprovalDetail approval={approval} nameOf={nameOf} />
            {canPublish && !approval ? (
              <div className="flex flex-wrap items-start gap-2">
                <ActionForm
                  fields={[{ name: "note", label: "Note to the client", type: "textarea" }]}
                  action={requestApproval.bind(null, { baselineId: baseline.id })}
                  submitLabel="Request approval"
                  trigger="Request client approval"
                />
                <ActionForm
                  fields={externalApprovalFields}
                  defaultValues={{
                    response: "approved",
                    method: "signed_document",
                    approvedOn: today,
                  }}
                  action={recordExternalApproval.bind(null, { baselineId: baseline.id })}
                  submitLabel="Record external response"
                  trigger="Record approval given outside the portal"
                  confirm="Record this response? It is final once recorded."
                />
              </div>
            ) : null}
            {canPublish && approval && approval.response === null ? (
              <ActionForm
                fields={externalApprovalFields}
                defaultValues={{
                  response: "approved",
                  method: "signed_document",
                  approvedOn: today,
                }}
                action={recordExternalApproval.bind(null, { baselineId: baseline.id })}
                submitLabel="Record external response"
                trigger="Record approval given outside the portal"
                confirm="Record this response? It is final once recorded."
              />
            ) : null}
          </div>
        </Panel>
      )}

      <Panel
        title="Contents"
        description={`${items.length} element version${items.length === 1 ? "" : "s"}${baseline.status === "frozen" ? `, ${baseline.architecture_baseline_relationships.length} relationships and ${baseline.architecture_baseline_assessments.length} domain assessments captured` : ""}.`}
      >
        {items.length === 0 ? (
          <EmptyState title="No versions chosen yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Element</Th>
                <Th>Version</Th>
                <Th>Current</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {items
                .map((i) => versionOf.get(i.element_version_id))
                .filter(Boolean)
                .sort((a, b) =>
                  (a!.e.reference_code ?? "").localeCompare(b!.e.reference_code ?? "", undefined, {
                    numeric: true,
                  }),
                )
                .map((entry) => {
                  const { e, v } = entry!;
                  const newer = e.latestVersion && e.latestVersion.version_no > v.version_no;
                  return (
                    <tr key={e.id}>
                      <Td>
                        <ElementLink slug={slug} element={e} />
                      </Td>
                      <Td className="tabular-nums">v{v.version_no}</Td>
                      <Td className="text-xs text-ink-muted">
                        {newer ? `v${e.latestVersion!.version_no} published since` : "Latest"}
                      </Td>
                      <Td className="text-right">
                        {draft && canEdit ? (
                          <ActionButton
                            action={removeBaselineItem.bind(null, baseline.id, e.id)}
                            label="Remove"
                            variant="ghost"
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

      {baseline.status === "frozen" ? (
        <Panel
          title="Compare"
          description="What changed between this baseline and another frozen baseline, or the current published architecture."
        >
          <div className="space-y-4">
            <nav className="flex flex-wrap gap-2 text-sm">
              {[
                { key: "current", label: "Current published architecture" },
                ...baselines
                  .filter((b) => b.status === "frozen" && b.id !== baseline.id)
                  .map((b) => ({ key: b.id, label: b.label })),
              ].map((option) => (
                <Link
                  key={option.key}
                  href={`${base}?compare=${option.key}`}
                  className={cn(
                    "rounded-sm border px-3 py-1.5",
                    query.compare === option.key
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-rule text-ink-muted hover:text-ink",
                  )}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
            {comparison === null ? null : comparison.length === 0 ? (
              <EmptyState title="No differences" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Change</Th>
                    <Th>What</Th>
                    <Th>From → to</Th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row, index) => (
                    <tr key={index}>
                      <Td className="whitespace-nowrap capitalize">{row.change}</Td>
                      <Td>
                        {row.subject === "element" ? (
                          architecture.byId.get(row.element_id) ? (
                            <ElementLink
                              slug={slug}
                              element={architecture.byId.get(row.element_id)!}
                            />
                          ) : (
                            `${row.reference_code} ${row.title}`
                          )
                        ) : row.subject === "relationship" ? (
                          <RelationshipDescription
                            id={row.relationship_id}
                            architecture={architecture}
                            fallback={row.relationship_type}
                          />
                        ) : (
                          `${DOMAIN_SHORT_LABELS[row.domain]} domain assessment`
                        )}
                      </Td>
                      <Td className="text-xs text-ink-muted tabular-nums">
                        {row.subject === "element"
                          ? `${row.from_version_no ? `v${row.from_version_no}` : "—"} → ${row.to_version_no ? `v${row.to_version_no}` : "—"}`
                          : row.subject === "domain"
                            ? `${row.from_maturity ? MATURITY_LABELS[row.from_maturity] : "—"} → ${row.to_maturity ? MATURITY_LABELS[row.to_maturity] : "—"}`
                            : ""}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function RelationshipDescription({
  id,
  architecture,
  fallback,
}: {
  id: string;
  architecture: Awaited<ReturnType<typeof loadArchitecture>>;
  fallback: string;
}) {
  const r = architecture.relationships.find((x) => x.id === id);
  if (!r) return <>{fallback}</>;
  const s = architecture.byId.get(r.source_element_id);
  const t = architecture.byId.get(r.target_element_id);
  return (
    <span className="text-sm">
      {s?.reference_code} {relationshipType(r.relationship_type)?.label ?? r.relationship_type}{" "}
      {t?.reference_code}
    </span>
  );
}
