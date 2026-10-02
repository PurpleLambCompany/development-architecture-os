import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  publishElement,
  retireElement,
  returnToDraft,
  submitForReview,
} from "@/domain/architecture/actions";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import { internalElementHref } from "@/domain/architecture/links";
import {
  getElementDetail,
  getVersionSnapshot,
  listBaselines,
  listEvidence,
  loadArchitecture,
} from "@/domain/architecture/queries";
import {
  addReviewParticipant,
  cancelReview,
  holdReview,
  recordReviewValidation,
  updateReview,
} from "@/domain/reviews/actions";
import {
  REVIEW_PARTICIPANT_ROLES,
  REVIEW_PARTICIPANT_ROLE_LABELS,
  REVIEW_TYPES,
  REVIEW_TYPE_LABELS,
  reviewStatus,
} from "@/domain/reviews/catalog";
import {
  getReviewParticipants,
  getReviewRegister,
  getReviewSummary,
} from "@/domain/reviews/queries";
import { setValidationCriterionNote } from "@/domain/methodology/actions";
import {
  getApproachGuidance,
  getCriteriaInForce,
  getValidationCriteria,
} from "@/domain/methodology/queries";
import { getEdgeItems, getElementRevisions, getReviewCapture } from "@/domain/edge/queries";
import { ContextualEdgePanel } from "@/components/edge/edge-panel";
import { formatDate, formatDateTime } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ElementLink, LifecycleTag, ReferenceCode } from "@/components/architecture/badges";
import { elementTypeLabel } from "@/components/architecture/relationships-panel";
import { RelationshipsPanel } from "@/components/architecture/relationships-panel";
import { StatementsPanel } from "@/components/architecture/statements-panel";
import { VersionSnapshotPanel, VersionsPanel } from "@/components/architecture/versions-panel";
import { ActivityList } from "@/components/architecture/activity-list";
import { PracticePanel } from "@/components/methodology/practice-panel";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";
import { ReviewDossierView } from "@/components/architecture-intelligence/dossier";
import { SubjectDrawer } from "@/components/architecture-intelligence/drawers";
import { getReviewDossier } from "@/domain/architecture-intelligence/experience/layer1-queries";
import { viewerUsesIntelligence } from "@/domain/architecture-intelligence/experience/queries";
import { ACTION_LABELS, pageDrawer } from "@/domain/architecture-intelligence/experience/subjects";
import { StatusTag } from "@/components/ui/status-tag";
import { ClientVisibilityControl } from "@/components/architecture/client-visibility-control";

/**
 * One review's detail: header, agenda (examines), participants, findings
 * (statements), and — for a held review whose agenda includes an
 * Implementation Initiative — the record_review_validation control that
 * alone can write a `validates` relationship (proposal §7.5).
 */
export default async function ReviewDetailPage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/reviews/[reviewId]">) {
  const { slug, reviewId } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(reviewId).success) notFound();
  const { engagement, canEdit, canPublish, canManageReviews } =
    await getInternalArchitectureContext(slug);
  const [
    architecture,
    registerRows,
    participants,
    detail,
    evidence,
    capture,
    edgeItems,
    revisions,
    dossier,
    usesIntelligence,
    baselines,
    reviewSummary,
  ] = await Promise.all([
    loadArchitecture(engagement.id),
    getReviewRegister(engagement.id),
    getReviewParticipants(reviewId),
    getElementDetail(engagement.id, reviewId),
    listEvidence(engagement.id),
    getReviewCapture(reviewId),
    getEdgeItems(engagement.id),
    getElementRevisions(engagement.id),
    getReviewDossier(engagement.id, reviewId),
    viewerUsesIntelligence(engagement.id),
    listBaselines(engagement.id),
    getReviewSummary(reviewId),
  ]);
  const intelligence = pageDrawer(`/internal/engagements/${slug}/reviews/${reviewId}`, query);
  const element = architecture.byId.get(reviewId);
  const row = registerRows.find((r) => r.element_id === reviewId);
  if (!element || !row || element.kind !== "review") notFound();

  const versionId = typeof query.version === "string" ? query.version : null;
  const shownVersion = versionId ? element.versions.find((v) => v.id === versionId) : null;
  const versionSnapshot = shownVersion ? await getVersionSnapshot(shownVersion.id) : null;

  const nameOf = memberNames(engagement);
  const status = reviewStatus(row.review_status);
  const frozen = element.lifecycle === "retired" || element.lifecycle === "superseded";
  const evidenceOptions = evidence.map((s) => ({ value: s.id, label: s.title }));

  // Agenda: elements this review examines, plus any it has raised or validated.
  const examines = architecture.relationships.filter(
    (r) => r.source_element_id === reviewId && r.relationship_type === "examines" && !r.retired_at,
  );
  const validates = architecture.relationships.filter(
    (r) => r.source_element_id === reviewId && r.relationship_type === "validates" && !r.retired_at,
  );

  // An initiative is a candidate for validation when this review examines it
  // directly, or examines a core object it implements (mirrors the database
  // gate in record_review_validation exactly, so the control is offered only
  // when it will actually succeed).
  const examinedIds = new Set(examines.map((r) => r.target_element_id));
  // The closed examined set (ADR-0054): the version of each examined element
  // captured when this Review was held. Captures are facts, not a baseline.
  const held = row.review_status === "held";
  // The Review's own items, and items on what it examines: revisions,
  // escalations, decisions due and pending approvals on its agenda (§16).
  const bearing = new Set([reviewId, ...examinedIds]);
  const reviewItems = edgeItems.filter(
    (i) => bearing.has(i.subject_id) || (i.basis ?? []).some((ref) => ref.id === reviewId),
  );
  const capturedVersion = new Map(capture.map((c) => [c.element_id, c.element_version_id]));
  const versionNo = (elementId: string, versionId: string | null | undefined) =>
    architecture.byId.get(elementId)?.versions.find((v) => v.id === versionId)?.version_no ?? null;
  const initiatives = architecture.elements.filter(
    (e) => e.kind === "implementation_initiative" && e.lifecycle !== "retired",
  );
  const implementsTarget = new Map<string, string[]>();
  for (const r of architecture.relationships) {
    if (r.relationship_type === "implements" && !r.retired_at) {
      implementsTarget.set(r.source_element_id, [
        ...(implementsTarget.get(r.source_element_id) ?? []),
        r.target_element_id,
      ]);
    }
  }
  const alreadyValidated = new Set(validates.map((r) => r.target_element_id));
  const validationCandidates = initiatives.filter(
    (i) =>
      !alreadyValidated.has(i.id) &&
      (examinedIds.has(i.id) || (implementsTarget.get(i.id) ?? []).some((t) => examinedIds.has(t))),
  );

  const [candidateCriteria, captured] = await Promise.all([
    Promise.all(validationCandidates.map((i) => getCriteriaInForce(i.id))),
    validates.length > 0 ? getValidationCriteria(engagement.id) : Promise.resolve([]),
  ]);

  const engagementMembers = engagement.engagement_members.filter((m) => m.status === "active");
  const availableMembers = engagementMembers.filter(
    (m) => !participants.some((p) => p.engagement_member_id === m.id),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Reviews", REVIEW_TYPE_LABELS[row.review_type]].join(" · ")}
        title={element.title}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs">{element.reference_code}</span>
            <LifecycleTag lifecycle={element.lifecycle} />
            {status ? <StatusTag tone={status.tone}>{status.label}</StatusTag> : null}
          </span>
        }
      />
      <ArchitectureNav slug={slug} current="reviews" />

      {shownVersion && versionSnapshot ? (
        <VersionSnapshotPanel
          versionNo={shownVersion.version_no}
          publishedAt={shownVersion.published_at}
          snapshot={versionSnapshot}
          closeHref={internalElementHref(slug, "review", element.id)}
          titleOf={(id) => architecture.byId.get(id)?.title ?? null}
        />
      ) : null}

      <Panel
        title="Session"
        description="Scheduling and outcome of this convened session."
        actions={
          <div className="flex flex-wrap items-start justify-end gap-2">
            {canManageReviews && row.review_status === "scheduled" ? (
              <ActionForm
                fields={[
                  { name: "heldAt", label: "Held at", hint: "YYYY-MM-DDTHH:mm, blank for now" },
                  { name: "summary", label: "Summary", type: "textarea" },
                ]}
                action={holdReview.bind(null, element.id)}
                submitLabel="Record as held"
                trigger="Hold review"
              />
            ) : null}
            {canManageReviews && row.review_status === "scheduled" ? (
              <ActionForm
                fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
                action={cancelReview.bind(null, element.id)}
                submitLabel="Cancel review"
                variant="danger"
                trigger="Cancel review"
              />
            ) : null}
            {canEdit && (element.lifecycle === "draft" || element.lifecycle === "published") ? (
              <ActionButton
                action={submitForReview.bind(null, element.id)}
                label="Submit for internal review"
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
        <DetailList
          items={[
            { label: "Kind", value: REVIEW_TYPE_LABELS[row.review_type] },
            {
              label: "Scheduled for",
              value: row.scheduled_for ? formatDateTime(row.scheduled_for) : "Not set",
            },
            { label: "Held at", value: row.held_at ? formatDateTime(row.held_at) : "Not yet held" },
            { label: "Summary", value: reviewSummary || null },
            {
              label: "Client visibility",
              value: element.client_visibility === "client" ? "Client" : "Internal",
            },
          ]}
        />
        {canPublish && !frozen ? (
          <div className="mt-4">
            <ClientVisibilityControl
              elementId={element.id}
              visibility={element.client_visibility}
              published={Boolean(element.latestVersion)}
              noun="review"
            />
          </div>
        ) : null}
        {canManageReviews && !frozen ? (
          <div className="mt-4">
            <ActionForm
              fields={[
                {
                  name: "reviewType",
                  label: "Kind",
                  type: "select",
                  options: REVIEW_TYPES.map((t) => ({ value: t, label: REVIEW_TYPE_LABELS[t] })),
                },
                {
                  name: "scheduledFor",
                  label: "Scheduled for",
                  type: "text",
                  hint: "YYYY-MM-DDTHH:mm",
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
                { name: "summary", label: "Summary", type: "textarea" },
              ]}
              defaultValues={{
                reviewType: row.review_type,
                scheduledFor: row.scheduled_for ? row.scheduled_for.slice(0, 16) : "",
                baselineId: row.baseline_id ?? "",
                summary: reviewSummary,
              }}
              action={updateReview.bind(null, element.id)}
              submitLabel="Save"
              trigger="Edit review fields"
            />
          </div>
        ) : null}
      </Panel>

      {row.review_status === "scheduled" || row.review_status === "held" ? (
        <Panel
          title="Dossier"
          description={
            held
              ? "What this Review examined, at the versions it captured, and what has moved since. Exact records and versions; nothing summarised or ranked."
              : "What this Review will examine and what has moved since each element was last reviewed. Exact records and versions; nothing summarised or ranked."
          }
          actions={
            usesIntelligence ? (
              <Link
                href={intelligence.open({ drawer: "review", elementId: reviewId })}
                scroll={false}
                className="text-sm text-ink-muted hover:text-ink hover:underline"
              >
                {ACTION_LABELS.review_brief}
              </Link>
            ) : null
          }
        >
          {dossier ? (
            <ReviewDossierView
              dossier={dossier}
              slug={slug}
              edgeHref={`/internal/engagements/${slug}/edge?view=judged`}
            />
          ) : (
            <EmptyState title="The dossier could not be prepared" />
          )}
        </Panel>
      ) : null}

      <Panel
        title="Participants"
        actions={
          canManageReviews && availableMembers.length > 0 ? (
            <ActionForm
              fields={[
                {
                  name: "engagementMemberId",
                  label: "Member",
                  type: "select",
                  options: availableMembers.map((m) => ({ value: m.id, label: nameOf(m.user_id) })),
                  wide: true,
                },
                {
                  name: "role",
                  label: "Role",
                  type: "select",
                  options: REVIEW_PARTICIPANT_ROLES.map((r) => ({
                    value: r,
                    label: REVIEW_PARTICIPANT_ROLE_LABELS[r],
                  })),
                },
              ]}
              defaultValues={{ role: "attendee" }}
              action={addReviewParticipant.bind(null, element.id)}
              submitLabel="Add participant"
              trigger="Add participant"
            />
          ) : null
        }
      >
        {participants.length === 0 ? (
          <EmptyState title="No participants added" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule text-sm">
            {participants.map((p) => {
              const member = engagementMembers.find((m) => m.id === p.engagement_member_id);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="text-ink">
                    {nameOf(member?.user_id ?? p.engagement_member_id)}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-ink-muted">
                    {REVIEW_PARTICIPANT_ROLE_LABELS[p.role]}
                    {p.attended ? <StatusTag tone="positive">Attended</StatusTag> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="Agenda"
        description={
          held
            ? "What this Review examined, and the version of each captured when it was held. The examined set closed at hold."
            : "Elements and Project Intelligence records this review examines. The version of each is captured when the Review is held."
        }
      >
        {examines.length === 0 ? (
          <EmptyState title="Nothing on the agenda yet">
            Add agenda items from “Connected architecture” below, as an “examines” relationship.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule text-sm">
            {examines.map((r) => {
              const target = architecture.byId.get(r.target_element_id);
              if (!target) return null;
              const examinedNo = versionNo(target.id, capturedVersion.get(target.id));
              const currentNo = target.versions[0]?.version_no ?? null;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                  <ElementLink slug={slug} element={target} />
                  <span className="text-xs text-ink-subtle">{elementTypeLabel(target)}</span>
                  {held ? (
                    <span className="text-xs text-ink-muted">
                      {examinedNo === null
                        ? "No published version when held"
                        : currentNo !== null && currentNo > examinedNo
                          ? `Examined at version ${examinedNo}; now version ${currentNo}${
                              revisions.some(
                                (v) =>
                                  v.element_id === target.id &&
                                  v.version_no > examinedNo &&
                                  v.change_type === "substantive_revision",
                              )
                                ? ", revised substantively since"
                                : ", with status-only publications since"
                            }`
                          : `Examined at version ${examinedNo}`}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <ContextualEdgePanel
        slug={slug}
        engagementId={engagement.id}
        items={reviewItems}
        canJudge={canEdit}
        explain
        title={held ? "Since this Review was held" : "Before this Review"}
        description={
          held
            ? "What has changed in the records this Review examined since it was held, compared with the versions it captured. A prompt to look, never a finding."
            : "What bears on this Review's agenda before it convenes: revisions, open escalations, decisions due and pending approvals."
        }
        empty={
          held
            ? "Nothing examined has changed since this Review was held."
            : "Nothing bears on this Review's agenda."
        }
      />

      {row.review_status === "held" && validationCandidates.length > 0 && canPublish ? (
        <Panel
          title="Validate an implementation initiative"
          description="A held review that has examined an initiative — or a core object it implements — may formally judge that operating reality sufficiently conforms to architectural intent. This is the only way a “validates” relationship is written; it does not itself change the initiative's status."
        >
          <ActionForm
            fields={[
              {
                name: "initiativeElementId",
                label: "Initiative",
                type: "select",
                options: validationCandidates.map((i) => ({
                  value: i.id,
                  label: `${i.reference_code} · ${i.title}`,
                })),
                wide: true,
              },
            ]}
            action={recordReviewValidation.bind(null, element.id)}
            submitLabel="Record validation"
            trigger="Validate initiative"
            confirm="Record that this review validates the chosen initiative's operating reality? The agreed acceptance criteria in force are captured with it."
          />
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-xs tracking-wide text-ink-subtle uppercase">
              Would be validated against
            </p>
            {validationCandidates.map((i, n) => {
              const criteria = candidateCriteria[n] ?? [];
              return (
                <div key={i.id} className="space-y-1">
                  <p className="text-ink">
                    {i.reference_code} · {i.title}
                  </p>
                  {criteria.length === 0 ? (
                    <p className="text-attention">
                      No agreed acceptance criteria are in force. The validation is still valid; it
                      will record that none were agreed.
                    </p>
                  ) : (
                    <ul className="space-y-1 pl-4 text-ink-muted">
                      {criteria.map((c) => (
                        <li key={c.id}>
                          <span className="font-mono text-xs">{c.reference_code}</span> {c.body}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {validates.length > 0 ? (
        <Panel
          title="Validated"
          description="Each validation with the agreed acceptance criteria it was judged against. Notes record how each was met; there is no pass or fail."
        >
          <ul className="space-y-4 text-sm">
            {validates.map((r) => {
              const target = architecture.byId.get(r.target_element_id);
              const against = captured
                .filter((c) => c.validation_relationship_id === r.id)
                .sort((a, b) =>
                  (a.acceptance_criteria?.reference_code ?? "").localeCompare(
                    b.acceptance_criteria?.reference_code ?? "",
                    undefined,
                    { numeric: true },
                  ),
                );
              return target ? (
                <li key={r.id} className="space-y-2">
                  <ElementLink slug={slug} element={target} />
                  {against.length === 0 ? (
                    <p className="text-ink-subtle">
                      No agreed acceptance criteria were in force when this was validated.
                    </p>
                  ) : (
                    <ul className="space-y-2 border-l-2 border-rule pl-4">
                      {against.map((c) => (
                        <li key={c.criterion_id} className="space-y-1">
                          <p className="text-ink">
                            <span className="font-mono text-xs text-ink-subtle">
                              {c.acceptance_criteria?.reference_code}
                            </span>{" "}
                            {c.acceptance_criteria?.body}
                          </p>
                          {c.note ? (
                            <p className="text-ink-muted">
                              {c.note}
                              {c.note_updated_at ? (
                                <span className="text-xs text-ink-subtle">
                                  {" "}
                                  · {formatDate(c.note_updated_at)}
                                </span>
                              ) : null}
                            </p>
                          ) : null}
                          {canPublish ? (
                            <ActionForm
                              trigger={c.note ? "Edit note" : "Add note"}
                              submitLabel="Save note"
                              action={setValidationCriterionNote.bind(null, r.id, c.criterion_id)}
                              fields={[
                                {
                                  name: "note",
                                  label: "How this criterion was met",
                                  type: "textarea",
                                },
                              ]}
                              defaultValues={{ note: c.note }}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ) : null;
            })}
          </ul>
        </Panel>
      ) : null}

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
        locked={
          held
            ? {
                types: ["examines"],
                reason:
                  "This Review has been held, so what it examined is closed: examines relationships can no longer be added or retired. Examine anything further in a new Review.",
              }
            : undefined
        }
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

      {intelligence.drawer &&
      (intelligence.drawer.drawer === "edge" ||
        (intelligence.drawer.drawer === "review" && intelligence.drawer.elementId === reviewId)) ? (
        <SubjectDrawer
          engagementId={engagement.id}
          slug={slug}
          subject={intelligence.drawer}
          closeHref={intelligence.closeHref}
          canJudge={canEdit}
        />
      ) : null}
    </div>
  );
}
