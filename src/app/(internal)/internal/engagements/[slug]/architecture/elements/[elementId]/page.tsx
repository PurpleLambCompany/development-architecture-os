import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  addLineage,
  deleteElement,
  publishElement,
  removeLineage,
  retireElement,
  returnToDraft,
  reviewAiContent,
  submitForReview,
  supersedeElement,
  updateObject,
  updateRecord,
} from "@/domain/architecture/actions";
import {
  DOMAIN_LABELS,
  DOMAIN_SHORT_LABELS,
  DOMAIN_SLUGS,
  EVIDENCE_SOURCE_TYPE_LABELS,
  IP_CLASSIFICATION_LABELS,
  PROVENANCE_LABELS,
  RECORD_KIND_LABELS,
  VISIBILITY_LABELS,
  type RecordKind,
} from "@/domain/architecture/catalog";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import { describeAttributes } from "@/domain/architecture/object-types";
import {
  getElementDetail,
  getVersionSnapshot,
  listEvidence,
  listMethodAssets,
  loadArchitecture,
  previewClientSnapshot,
  type LoadedElement,
} from "@/domain/architecture/queries";
import type { ObjectTypeKey } from "@/domain/architecture/rules";
import { getBusinessToday } from "@/domain/finance/queries";
import {
  getClientActions,
  getContributions,
  getEscalations,
  getImpact,
  getRecordHistory,
  getRegister,
  getStatementOptions,
  getStewardship,
} from "@/domain/intelligence/queries";
import { recordsBearingOn } from "@/domain/intelligence/register";
import { clientMembersWith } from "@/domain/intelligence/views";
import { RECORD_KINDS } from "@/domain/architecture/vocabulary";
import { ActivityList } from "@/components/architecture/activity-list";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import {
  AiReviewTag,
  ApprovalTag,
  ElementLink,
  InternalMark,
  LifecycleTag,
  MaturityMark,
} from "@/components/architecture/badges";
import { DecisionPanel } from "@/components/architecture/decision-panel";
import {
  elementDefaults,
  isResolvedRecord,
  objectFields,
  recordFields,
  spineFields,
} from "@/components/architecture/element-fields";
import { RecordFacts } from "@/components/architecture/record-facts";
import {
  elementOptionLabel,
  elementTypeLabel,
  RelationshipsPanel,
} from "@/components/architecture/relationships-panel";
import { SnapshotView } from "@/components/architecture/snapshot-view";
import { StatementsPanel } from "@/components/architecture/statements-panel";
import { VersionsPanel, publicationLine } from "@/components/architecture/versions-panel";
import {
  BearingPanel,
  HistoryPanel,
  ImpactPanel,
  StewardshipPanel,
} from "@/components/intelligence/element-panels";
import { ElementRequestsPanel } from "@/components/intelligence/element-requests";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";

export default async function ElementPage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/architecture/elements/[elementId]">) {
  const { slug, elementId } = await params;
  const query = await searchParams;
  const { engagement, canEdit, canPublish, canManageRequests } =
    await getInternalArchitectureContext(slug);
  const architecture = await loadArchitecture(engagement.id);
  const element = architecture.byId.get(elementId);
  if (!element) notFound();

  const isRecord = !element.object;
  const [
    detail,
    evidence,
    methodAssets,
    stewardship,
    history,
    impact,
    escalations,
    register,
    actions,
    contributions,
    statements,
    respondents,
    executives,
  ] = await Promise.all([
    getElementDetail(engagement.id, element.id),
    listEvidence(engagement.id),
    listMethodAssets(),
    isRecord ? getStewardship(element.id) : null,
    isRecord ? getRecordHistory(element.id) : [],
    getImpact(element.id),
    isRecord ? getEscalations(engagement.id) : [],
    isRecord ? [] : getRegister(engagement.id),
    getClientActions(engagement.id),
    getContributions(engagement.id, element.id),
    getStatementOptions(engagement.id),
    clientMembersWith(engagement, ["view_architecture", "respond_to_client_actions"]),
    clientMembersWith(engagement, ["view_architecture", "approve_architecture"]),
  ]);
  const preview = query.preview === "1" ? await previewClientSnapshot(element.id) : null;
  const versionId = typeof query.version === "string" ? query.version : null;
  const shownVersion = versionId ? element.versions.find((v) => v.id === versionId) : null;
  const versionSnapshot = shownVersion ? await getVersionSnapshot(shownVersion.id) : null;

  const nameOf = memberNames(engagement);
  const today = getBusinessToday();
  const frozen = element.lifecycle === "retired" || element.lifecycle === "superseded";
  const editable = canEdit && !frozen;
  const base = `/internal/engagements/${slug}`;
  const domain = element.object?.domain ?? null;
  const evidenceOptions = evidence.map((s) => ({
    value: s.id,
    label: `${s.title} (${EVIDENCE_SOURCE_TYPE_LABELS[s.source_type]}${s.client_visibility === "internal" ? ", internal" : ""})`,
  }));
  const liveOthers = architecture.elements.filter(
    (e) => e.id !== element.id && e.lifecycle !== "retired" && e.lifecycle !== "superseded",
  );
  const successors = liveOthers.filter(
    (e) => e.kind === element.kind && e.object?.object_type === element.object?.object_type,
  );
  const supersededBy = architecture.relationships.find(
    (r) => r.relationship_type === "supersedes" && r.target_element_id === element.id,
  );
  const supersedes = architecture.relationships.filter(
    (r) => r.relationship_type === "supersedes" && r.source_element_id === element.id,
  );
  const bearing = isRecord
    ? new Set<string>()
    : recordsBearingOn(
        element.id,
        architecture.relationships,
        new Set(
          architecture.elements
            .filter((e) => (RECORD_KINDS as readonly string[]).includes(e.kind))
            .map((e) => e.id),
        ),
        architecture.elements.flatMap((e) =>
          e.record?.kind === "dependency"
            ? [
                {
                  element_id: e.id,
                  from_element_id: e.record.row.from_element_id,
                  to_element_id: e.record.row.to_element_id,
                },
              ]
            : [],
        ),
      );
  const member = (m: { id: string; user_id: string }) => ({
    value: m.id,
    label: nameOf(m.user_id),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[
          engagement.title,
          domain ? DOMAIN_LABELS[domain] : "Project Intelligence",
          elementTypeLabel(element),
        ].join(" · ")}
        title={element.title}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs">{element.reference_code}</span>
            <LifecycleTag lifecycle={element.lifecycle} />
            {element.latestVersion ? <ApprovalTag state={element.latestApprovalState} /> : null}
            <AiReviewTag state={element.ai_review_state} />
            {publicationLine(element) ? <span>{publicationLine(element)}</span> : null}
          </span>
        }
        actions={
          <ButtonLink
            href={
              query.preview === "1" ? `${base}/architecture/elements/${element.id}` : `?preview=1`
            }
            variant="secondary"
            size="sm"
          >
            {query.preview === "1" ? "Close preview" : "Preview as client"}
          </ButtonLink>
        }
      />
      <ArchitectureNav slug={slug} current={domain ?? "intelligence"} />

      {preview !== null || query.preview === "1" ? (
        <Panel
          title="Preview as client"
          description={
            element.client_visibility === "client"
              ? "Exactly the client snapshot that publishing the working copy now would produce."
              : "This element is internal: publishing it would show the client nothing. Shown here is what it would contain if made client-visible."
          }
          className="border-accent/40"
        >
          {preview ? (
            <SnapshotView
              snapshot={preview}
              titleOf={(id) => architecture.byId.get(id)?.title ?? null}
            />
          ) : (
            <EmptyState title="Nothing to preview" />
          )}
        </Panel>
      ) : null}

      {shownVersion && versionSnapshot ? (
        <Panel
          title={`Version ${shownVersion.version_no} as published`}
          description={`Published ${formatDateTime(shownVersion.published_at)}. Immutable. Internal view, including internal statements.`}
          actions={
            <ButtonLink
              href={`${base}/architecture/elements/${element.id}`}
              variant="ghost"
              size="sm"
            >
              Close
            </ButtonLink>
          }
        >
          <SnapshotView
            snapshot={versionSnapshot}
            titleOf={(id) => architecture.byId.get(id)?.title ?? null}
          />
        </Panel>
      ) : null}

      <Panel
        title="Working copy"
        description={
          element.lifecycle === "published"
            ? "Edits here change the working copy only. Clients keep seeing the last published version until the next one is published."
            : undefined
        }
        actions={
          <Operations
            element={element}
            canEdit={canEdit}
            canPublish={canPublish}
            successors={successors}
          />
        }
      >
        <div className="space-y-6">
          {element.summary ? (
            <p className="max-w-3xl font-serif text-base leading-relaxed text-ink">
              {element.summary}
            </p>
          ) : null}
          <DetailList
            items={[
              {
                label: element.object ? "Domain" : "Scope",
                value: element.object ? (
                  <Link
                    href={`${base}/architecture/${DOMAIN_SLUGS[element.object.domain]}`}
                    className="hover:underline"
                  >
                    {DOMAIN_LABELS[element.object.domain]}
                  </Link>
                ) : (
                  recordScope(element)
                ),
              },
              ...(element.object
                ? [
                    {
                      label: "Maturity",
                      value: (
                        <span className="space-y-1">
                          <MaturityMark maturity={element.object.maturity} />
                          {element.object.maturity_rationale ? (
                            <span className="block text-xs text-ink-muted">
                              {element.object.maturity_rationale}
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                  ]
                : []),
              { label: "Provenance", value: PROVENANCE_LABELS[element.provenance] },
              {
                label: "Client visibility",
                value: VISIBILITY_LABELS[element.client_visibility],
              },
              {
                label: "IP classification",
                value: IP_CLASSIFICATION_LABELS[element.ip_classification],
              },
              { label: "Source reference", value: element.source_reference },
              { label: "Last changed", value: formatDateTime(element.updated_at) },
              ...(element.retired_at
                ? [
                    {
                      label: "Retired",
                      value: `${formatDate(element.retired_at.slice(0, 10))}: ${element.retirement_reason}`,
                    },
                  ]
                : []),
              ...(supersededBy
                ? [
                    {
                      label: "Superseded by",
                      value: (
                        <ElementLink
                          slug={slug}
                          element={architecture.byId.get(supersededBy.source_element_id)!}
                        />
                      ),
                    },
                  ]
                : []),
              ...supersedes.map((r) => ({
                label: "Supersedes",
                value: (
                  <ElementLink slug={slug} element={architecture.byId.get(r.target_element_id)!} />
                ),
              })),
            ]}
          />
          {element.object ? (
            <DetailList
              items={describeAttributes(
                element.object.object_type as ObjectTypeKey,
                element.object.attributes,
              ).map((row) => ({ label: row.label, value: row.value }))}
            />
          ) : (
            <RecordFacts element={element} architecture={architecture} slug={slug} />
          )}
          {element.ai_review_state === "pending" && canPublish ? (
            <div className="flex gap-2">
              <ActionButton
                action={reviewAiContent.bind(null, element.id, null, true)}
                label="Accept AI analysis"
              />
              <ActionButton
                action={reviewAiContent.bind(null, element.id, null, false)}
                label="Reject"
                variant="danger"
              />
            </div>
          ) : null}
          {editable ? (
            <ActionForm
              fields={
                element.object
                  ? [
                      ...spineFields(canPublish),
                      ...objectFields(element.object.object_type as ObjectTypeKey),
                    ]
                  : [
                      ...spineFields(canPublish, {
                        recommendation: element.kind === "recommendation",
                      }),
                      ...recordFields(
                        element.kind as RecordKind,
                        liveOthers.map((e) => ({ value: e.id, label: elementOptionLabel(e) })),
                        { resolved: isResolvedRecord(element) },
                      ),
                    ]
              }
              defaultValues={elementDefaults(element)}
              action={
                element.object
                  ? updateObject.bind(null, element.id, element.object.object_type as ObjectTypeKey)
                  : updateRecord.bind(null, element.id, element.kind as RecordKind)
              }
              submitLabel="Save working copy"
              trigger="Edit working copy"
            />
          ) : null}
        </div>
      </Panel>

      {isRecord ? (
        <StewardshipPanel
          element={element}
          stewardship={stewardship}
          escalations={escalations.filter((x) => x.element_id === element.id)}
          canEdit={canEdit}
          canPublish={canPublish}
          executives={executives.map(member)}
          nameOf={nameOf}
          today={today}
        />
      ) : (
        <BearingPanel
          slug={slug}
          elementId={element.id}
          rows={register.filter((r) => bearing.has(r.element_id))}
          today={today}
        />
      )}

      <DecisionPanel
        element={element}
        architecture={architecture}
        canEdit={editable}
        canPublish={canPublish && !frozen}
        nameOf={nameOf}
        today={today}
      />

      <StatementsPanel
        elementId={element.id}
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

      <ElementRequestsPanel
        slug={slug}
        engagementId={engagement.id}
        element={element}
        architecture={architecture}
        actions={actions.filter((a) => a.subjects.includes(element.id))}
        contributions={contributions}
        statements={statements.filter((s) => s.element_id === element.id)}
        addressees={respondents.map(member)}
        canEdit={canEdit}
        canManageRequests={canManageRequests}
        nameOf={nameOf}
        today={today}
      />

      {isRecord ? <HistoryPanel history={history} /> : null}
      <ImpactPanel slug={slug} impact={impact} architecture={architecture} />

      <VersionsPanel
        slug={slug}
        element={element}
        approvals={architecture.approvals}
        canPublish={canPublish}
        nameOf={nameOf}
        today={today}
      />

      <Panel
        title="Method lineage"
        description="Which TPLCo Method assets this element derives from. Internal only: never in a client snapshot."
        actions={<InternalMark />}
      >
        <div className="space-y-4">
          {detail.lineage.length === 0 ? (
            <EmptyState title="No Method lineage recorded" />
          ) : (
            <ul className="divide-y divide-rule border-y border-rule text-sm">
              {detail.lineage.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span>
                    {l.method_assets?.title}{" "}
                    <span className="text-ink-subtle">· Method {l.method_version}</span>
                    {l.note ? <span className="text-ink-muted"> · {l.note}</span> : null}
                  </span>
                  {editable ? (
                    <ActionButton
                      action={removeLineage.bind(null, l.id)}
                      label="Remove"
                      variant="ghost"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {editable && methodAssets.length > 0 ? (
            <ActionForm
              fields={[
                {
                  name: "methodAssetId",
                  label: "Method asset",
                  type: "select",
                  options: methodAssets.map((a) => ({ value: a.id, label: a.title })),
                  wide: true,
                },
                { name: "methodVersion", label: "Method version" },
                { name: "note", label: "Note" },
              ]}
              defaultValues={{
                methodAssetId: methodAssets[0]!.id,
                methodVersion: engagement.methodology_version ?? "",
              }}
              action={addLineage.bind(null, element.id)}
              submitLabel="Record lineage"
              trigger="Record lineage"
            />
          ) : null}
        </div>
      </Panel>

      {canEdit || detail.activity.length > 0 ? (
        <Panel
          title="Activity"
          description="Architecture events on this element and its relationships."
        >
          <ActivityList events={detail.activity} />
        </Panel>
      ) : null}
    </div>
  );
}

function recordScope(element: LoadedElement): string {
  const parts = element.domains.map((d) => DOMAIN_SHORT_LABELS[d]);
  if (element.engagement_wide) parts.unshift("Engagement-wide");
  return parts.join(", ") || "Not yet scoped";
}

/** Lifecycle operations, offered by capability; the database checks each again. */
function Operations({
  element,
  canEdit,
  canPublish,
  successors,
}: {
  element: LoadedElement;
  canEdit: boolean;
  canPublish: boolean;
  successors: LoadedElement[];
}) {
  const { lifecycle } = element;
  if (lifecycle === "retired" || lifecycle === "superseded") return null;
  const kindLabel = element.object
    ? "element"
    : RECORD_KIND_LABELS[element.kind as RecordKind].toLowerCase();
  return (
    <div className="flex flex-wrap items-start justify-end gap-2">
      {canEdit && (lifecycle === "draft" || lifecycle === "published") ? (
        <ActionButton action={submitForReview.bind(null, element.id)} label="Submit for review" />
      ) : null}
      {canPublish ? (
        <ActionForm
          fields={[
            {
              name: "changeSummary",
              label: "What changed",
              type: "textarea",
              hint: "Shown to the client with this version.",
            },
          ]}
          action={publishElement.bind(null, element.id)}
          submitLabel={`Publish v${(element.latestVersion?.version_no ?? 0) + 1}`}
          trigger={`Publish v${(element.latestVersion?.version_no ?? 0) + 1}`}
          confirm="Publish an immutable version? If the element is client-visible, authorized client users will see it."
        />
      ) : null}
      {canPublish && lifecycle === "in_review" ? (
        <ActionForm
          fields={[{ name: "note", label: "What needs work", type: "textarea" }]}
          action={returnToDraft.bind(null, element.id)}
          submitLabel="Return"
          trigger="Return for work"
        />
      ) : null}
      {canPublish && successors.length > 0 ? (
        <ActionForm
          fields={[
            {
              name: "newElementId",
              label: `Replacing ${kindLabel}`,
              type: "select",
              options: successors.map((s) => ({ value: s.id, label: elementOptionLabel(s) })),
              wide: true,
            },
            { name: "reason", label: "Reason", type: "textarea" },
          ]}
          defaultValues={{ newElementId: successors[0]!.id }}
          action={supersedeElement.bind(null, element.id)}
          submitLabel="Supersede"
          variant="danger"
          trigger="Supersede"
          confirm="Mark this element superseded by the chosen one? This cannot be undone."
        />
      ) : null}
      {canPublish ? (
        <ActionForm
          fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
          action={retireElement.bind(null, element.id)}
          submitLabel="Retire"
          variant="danger"
          trigger="Retire"
          confirm="Retire this element? It stays in history and published versions remain readable."
        />
      ) : null}
      {canEdit && element.versions.length === 0 ? (
        <ActionButton
          action={deleteElement.bind(null, element.id)}
          label="Delete draft"
          variant="danger"
          confirm="Delete this never-published draft permanently?"
        />
      ) : null}
    </div>
  );
}
