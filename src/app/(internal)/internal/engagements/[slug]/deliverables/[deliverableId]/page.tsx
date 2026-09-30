import { notFound } from "next/navigation";
import { getApproachGuidance } from "@/domain/methodology/queries";
import {
  publishElement,
  retireElement,
  returnToDraft,
  submitForReview,
} from "@/domain/architecture/actions";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import {
  getElementDetail,
  listBaselines,
  listEvidence,
  loadArchitecture,
} from "@/domain/architecture/queries";
import { updateDeliverable } from "@/domain/deliverables/actions";
import { DELIVERABLE_TYPES, DELIVERABLE_TYPE_LABELS } from "@/domain/deliverables/catalog";
import { getDeliverableFiles, getDeliverableRegister } from "@/domain/deliverables/queries";
import { formatDateTime } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { LifecycleTag, ReferenceCode } from "@/components/architecture/badges";
import { RelationshipsPanel } from "@/components/architecture/relationships-panel";
import { StatementsPanel } from "@/components/architecture/statements-panel";
import { VersionsPanel } from "@/components/architecture/versions-panel";
import { ActivityList } from "@/components/architecture/activity-list";
import { DeliverableFileUpload } from "@/components/deliverables/deliverable-file-upload";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { PracticePanel } from "@/components/methodology/practice-panel";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";

export default async function DeliverableDetailPage({
  params,
}: PageProps<"/internal/engagements/[slug]/deliverables/[deliverableId]">) {
  const { slug, deliverableId } = await params;
  const { engagement, canEdit, canPublish, canManageDeliverables } =
    await getInternalArchitectureContext(slug);
  const [architecture, registerRows, baselines, detail, evidence] = await Promise.all([
    loadArchitecture(engagement.id),
    getDeliverableRegister(engagement.id),
    listBaselines(engagement.id),
    getElementDetail(engagement.id, deliverableId),
    listEvidence(engagement.id),
  ]);
  const element = architecture.byId.get(deliverableId);
  const row = registerRows.find((r) => r.element_id === deliverableId);
  if (!element || !row || element.kind !== "deliverable") notFound();

  const nameOf = memberNames(engagement);
  const frozen = element.lifecycle === "retired" || element.lifecycle === "superseded";
  const evidenceOptions = evidence.map((s) => ({ value: s.id, label: s.title }));
  const files = row.latest_version_id ? await getDeliverableFiles(row.latest_version_id) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[
          engagement.title,
          "Deliverables",
          DELIVERABLE_TYPE_LABELS[row.deliverable_type],
        ].join(" · ")}
        title={element.title}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs">{element.reference_code}</span>
            <LifecycleTag lifecycle={element.lifecycle} />
          </span>
        }
      />
      <ArchitectureNav slug={slug} current="deliverables" />

      <Panel
        title="Working copy"
        actions={
          <div className="flex flex-wrap items-start justify-end gap-2">
            {canEdit && (element.lifecycle === "draft" || element.lifecycle === "published") ? (
              <ActionButton
                action={submitForReview.bind(null, element.id)}
                label="Submit for review"
              />
            ) : null}
            {canPublish ? (
              <ActionForm
                fields={[{ name: "changeSummary", label: "What changed", type: "textarea" }]}
                action={publishElement.bind(null, element.id)}
                submitLabel={`Publish v${(element.latestVersion?.version_no ?? 0) + 1}`}
                trigger="Publish"
                confirm="Publish an immutable version? If client-visible, the client will see it."
              />
            ) : null}
            {canPublish && element.lifecycle === "in_review" ? (
              <ActionForm
                fields={[{ name: "note", label: "What needs work", type: "textarea" }]}
                action={returnToDraft.bind(null, element.id)}
                submitLabel="Return"
                trigger="Return for work"
              />
            ) : null}
            {canPublish && !frozen ? (
              <ActionForm
                fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
                action={retireElement.bind(null, element.id)}
                submitLabel="Retire"
                variant="danger"
                trigger="Retire"
              />
            ) : null}
          </div>
        }
      >
        <div className="space-y-4">
          {element.summary ? (
            <p className="max-w-3xl font-serif text-base leading-relaxed text-ink">
              {element.summary}
            </p>
          ) : null}
          <DetailList
            items={[
              { label: "Kind", value: DELIVERABLE_TYPE_LABELS[row.deliverable_type] },
              { label: "Confidential", value: row.confidential ? "Yes" : "No" },
              {
                label: "Baseline",
                value: row.baseline_id
                  ? baselines.find((b) => b.id === row.baseline_id)?.label
                  : null,
              },
              { label: "Last changed", value: formatDateTime(element.updated_at) },
            ]}
          />
          {canManageDeliverables && !frozen ? (
            <ActionForm
              fields={[
                {
                  name: "deliverableType",
                  label: "Kind",
                  type: "select",
                  options: DELIVERABLE_TYPES.map((t) => ({
                    value: t,
                    label: DELIVERABLE_TYPE_LABELS[t],
                  })),
                },
                {
                  name: "baselineId",
                  label: "Baseline",
                  type: "select",
                  options: [
                    { value: "", label: "None" },
                    ...baselines.map((b) => ({ value: b.id, label: b.label })),
                  ],
                },
                {
                  name: "confidential",
                  label: "Confidential",
                  type: "select",
                  options: [
                    { value: "no", label: "No" },
                    { value: "yes", label: "Yes — needs view_confidential_deliverables" },
                  ],
                },
              ]}
              defaultValues={{
                deliverableType: row.deliverable_type,
                baselineId: row.baseline_id ?? "",
                confidential: row.confidential ? "yes" : "no",
              }}
              action={updateDeliverable.bind(null, element.id)}
              submitLabel="Save"
              trigger="Edit deliverable fields"
            />
          ) : null}
        </div>
      </Panel>

      <Panel
        title="File"
        description={
          row.latest_version_id
            ? "Attached to the currently published version."
            : "Publish the deliverable before attaching its file."
        }
      >
        <div className="space-y-4">
          {files.length === 0 ? (
            <EmptyState title="No file attached" />
          ) : (
            <ul className="divide-y divide-rule border-y border-rule text-sm">
              {files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="text-ink">{f.filename}</span>
                  <span className="text-xs text-ink-muted">
                    {(f.size_bytes / 1024).toFixed(0)} KB · {formatDateTime(f.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManageDeliverables && row.latest_version_id ? (
            <DeliverableFileUpload engagementId={engagement.id} elementId={element.id} />
          ) : null}
        </div>
      </Panel>

      <StatementsPanel
        elementId={element.id}
        approach={await getApproachGuidance(element.id)}
        statements={detail.statements}
        evidenceOptions={evidenceOptions}
        canEdit={canEdit}
        canPublish={canPublish}
        frozen={frozen}
      />

      <RelationshipsPanel
        engagementId={engagement.id}
        slug={slug}
        element={element}
        architecture={architecture}
        canEdit={canEdit}
        canPublish={canPublish}
        frozen={frozen}
      />

      <VersionsPanel
        slug={slug}
        element={element}
        approvals={architecture.approvals}
        canPublish={canPublish}
        nameOf={nameOf}
        today={new Date().toISOString().slice(0, 10)}
      />

      <PracticePanel
        slug={slug}
        elementId={element.id}
        kind={element.kind}
        editable={canEdit && !frozen}
        methodologyDerived={
          element.provenance === "methodology_derived" ||
          detail.statements.some((st) => st.provenance === "methodology_derived")
        }
      />

      {detail.activity.length > 0 ? (
        <Panel title="Activity">
          <ActivityList events={detail.activity} />
        </Panel>
      ) : null}

      <div className="text-right">
        <ReferenceCode code={element.reference_code} />
      </div>
    </div>
  );
}
