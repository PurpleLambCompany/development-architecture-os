import { notFound } from "next/navigation";
import {
  citeEvidenceOnElement,
  publishElement,
  removeElementCitation,
  retireElement,
  returnToDraft,
  submitForReview,
} from "@/domain/architecture/actions";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import { getElementDetail, listEvidence, loadArchitecture } from "@/domain/architecture/queries";
import {
  acknowledgeEscalation,
  addCheckpoint,
  escalateInitiative,
  recordCheckpointAchieved,
  reopenInitiative,
  resolveEscalation,
  resolveInitiative,
  triageInitiative,
  updateImplementationStatus,
  updateInitiativeDetails,
} from "@/domain/implementation/actions";
import {
  IMPLEMENTATION_CATEGORIES,
  IMPLEMENTATION_CHECKPOINT_TYPES,
  IMPLEMENTATION_CHECKPOINT_TYPE_LABELS,
  IMPLEMENTATION_STATUS,
  NON_TERMINAL_STATUSES,
  categoryLabel,
} from "@/domain/implementation/catalog";
import {
  getCheckpoints,
  getEscalations,
  getImpact,
  getImplementationRegister,
  getStatusHistory,
  getStewardship,
} from "@/domain/implementation/queries";
import {
  ATTENTION,
  ESCALATION_LEVEL_LABELS,
  HISTORY_FIELD_LABELS,
  HISTORY_OPERATION_LABELS,
  TRIAGE_STATE,
} from "@/domain/intelligence/catalog";
import { clientMembersWith } from "@/domain/intelligence/views";
import { formatDate, formatDateTime } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import {
  ElementLink,
  InternalMark,
  LifecycleTag,
  ReferenceCode,
} from "@/components/architecture/badges";
import { RelationshipsPanel } from "@/components/architecture/relationships-panel";
import { StatementsPanel } from "@/components/architecture/statements-panel";
import { VersionsPanel } from "@/components/architecture/versions-panel";
import { ActivityList } from "@/components/architecture/activity-list";
import { escalateFields, requiredNoteFields, triageFields } from "@/components/intelligence/fields";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

export default async function InitiativeDetailPage({
  params,
}: PageProps<"/internal/engagements/[slug]/implementation/[initiativeId]">) {
  const { slug, initiativeId } = await params;
  const { engagement, canEdit, canPublish, canManageImplementation } =
    await getInternalArchitectureContext(slug);
  const [
    architecture,
    registerRows,
    detail,
    evidence,
    stewardship,
    checkpoints,
    escalations,
    history,
    impact,
    executives,
  ] = await Promise.all([
    loadArchitecture(engagement.id),
    getImplementationRegister(engagement.id),
    getElementDetail(engagement.id, initiativeId),
    listEvidence(engagement.id),
    getStewardship(initiativeId),
    getCheckpoints(initiativeId),
    getEscalations(engagement.id),
    getStatusHistory(initiativeId),
    getImpact(initiativeId),
    clientMembersWith(engagement, ["view_architecture", "respond_to_client_actions"]),
  ]);
  const element = architecture.byId.get(initiativeId);
  const row = registerRows.find((r) => r.element_id === initiativeId);
  if (!element || !row || element.kind !== "implementation_initiative") notFound();

  const nameOf = memberNames(engagement);
  const frozen = element.lifecycle === "retired" || element.lifecycle === "superseded";
  const evidenceOptions = evidence.map((s) => ({ value: s.id, label: s.title }));
  const status = IMPLEMENTATION_STATUS[row.implementation_status];
  const terminal =
    row.implementation_status === "validated" || row.implementation_status === "abandoned";
  const implementsTargets = architecture.relationships.filter(
    (r) =>
      r.source_element_id === element.id && r.relationship_type === "implements" && !r.retired_at,
  );
  const initiatedBy = architecture.relationships.filter(
    (r) =>
      r.target_element_id === element.id && r.relationship_type === "initiates" && !r.retired_at,
  );
  const validatedBy = architecture.relationships.filter(
    (r) =>
      r.target_element_id === element.id && r.relationship_type === "validates" && !r.retired_at,
  );
  const eligibleForValidated = validatedBy.length > 0;
  const openEscalations = escalations.filter((e) => e.element_id === element.id);
  const owners = engagement.engagement_members
    .filter((m) => m.side === "internal" && m.status === "active")
    .map((m) => ({ value: m.id, label: nameOf(m.user_id) }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Implementation", categoryLabel(row.category)].join(" · ")}
        title={element.title}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs">{element.reference_code}</span>
            <LifecycleTag lifecycle={element.lifecycle} />
            <StatusTag tone={status.tone}>{status.label}</StatusTag>
          </span>
        }
      />
      <ArchitectureNav slug={slug} current="implementation" />

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
              { label: "Category", value: categoryLabel(row.category) },
              {
                label: "Owner",
                value: row.owner_member_id ? nameOf(row.owner_member_id) : "Unassigned",
              },
              {
                label: "Target operational date",
                value: row.target_operational_on
                  ? formatDate(row.target_operational_on)
                  : "Not set",
              },
              {
                label: "Actual operational date",
                value: row.actual_operational_on ? formatDate(row.actual_operational_on) : "—",
              },
              {
                label: "Implements",
                value: (
                  <span className="flex flex-col gap-1">
                    {implementsTargets.map((r) => {
                      const target = architecture.byId.get(r.target_element_id);
                      return target ? (
                        <ElementLink key={r.id} slug={slug} element={target} />
                      ) : null;
                    })}
                  </span>
                ),
              },
              initiatedBy.length > 0
                ? {
                    label: "Initiated by",
                    value: (
                      <span className="flex flex-col gap-1">
                        {initiatedBy.map((r) => {
                          const source = architecture.byId.get(r.source_element_id);
                          return source ? (
                            <ElementLink key={r.id} slug={slug} element={source} />
                          ) : null;
                        })}
                      </span>
                    ),
                  }
                : { label: "Initiated by", value: null },
            ]}
          />
          {canManageImplementation && !frozen ? (
            <ActionForm
              fields={[
                {
                  name: "category",
                  label: "Category",
                  type: "select",
                  options: IMPLEMENTATION_CATEGORIES.map((c) => ({ value: c.key, label: c.label })),
                },
                { name: "targetOperationalOn", label: "Target operational date", type: "date" },
                {
                  name: "ownerMemberId",
                  label: "Owner",
                  type: "select",
                  options: [{ value: "", label: "Unassigned" }, ...owners],
                },
              ]}
              defaultValues={{
                category: row.category,
                targetOperationalOn: row.target_operational_on ?? "",
                ownerMemberId: row.owner_member_id ?? "",
              }}
              action={updateInitiativeDetails.bind(null, element.id)}
              submitLabel="Save"
              trigger="Edit initiative fields"
            />
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Implementation status"
        description="Direct edit among the active statuses. Validated and abandoned are reached only through Resolve, with a rationale, and validated additionally requires a held review's judgment (record_review_validation)."
        actions={
          <div className="flex flex-wrap items-start justify-end gap-2">
            {canManageImplementation && !terminal ? (
              <ActionForm
                trigger="Update status"
                fields={[
                  {
                    name: "status",
                    label: "Status",
                    type: "select",
                    options: NON_TERMINAL_STATUSES.map((s) => ({
                      value: s,
                      label: IMPLEMENTATION_STATUS[s].label,
                    })),
                  },
                  {
                    name: "rationale",
                    label: "Rationale",
                    type: "textarea",
                    hint: "Required when moving to stalled.",
                  },
                ]}
                defaultValues={{ status: row.implementation_status }}
                action={updateImplementationStatus.bind(null, element.id)}
                submitLabel="Save status"
              />
            ) : null}
            {canPublish && !terminal ? (
              <ActionForm
                trigger="Resolve"
                fields={[
                  {
                    name: "status",
                    label: "Resolve as",
                    type: "select",
                    options: [
                      ...(eligibleForValidated ? [{ value: "validated", label: "Validated" }] : []),
                      { value: "abandoned", label: "Abandoned" },
                    ],
                  },
                  { name: "rationale", label: "Rationale", type: "textarea" },
                ]}
                defaultValues={{ status: eligibleForValidated ? "validated" : "abandoned" }}
                action={resolveInitiative.bind(null, element.id)}
                submitLabel="Resolve"
                variant="danger"
              />
            ) : null}
            {canPublish && terminal ? (
              <ActionForm
                trigger="Reopen"
                fields={[{ name: "rationale", label: "Rationale", type: "textarea" }]}
                action={reopenInitiative.bind(null, element.id)}
                submitLabel="Reopen"
              />
            ) : null}
          </div>
        }
      >
        <div className="space-y-3">
          {!eligibleForValidated && !terminal ? (
            <p className="text-xs text-ink-subtle">
              Not yet eligible for “Validated”: needs a <span className="font-mono">validates</span>{" "}
              relationship from a held review that has examined this initiative, or a core object it
              implements. Record one from the review&rsquo;s own page.
            </p>
          ) : null}
          {validatedBy.length > 0 ? (
            <p className="text-sm text-ink">
              Validated by{" "}
              {validatedBy.map((r, i) => {
                const rev = architecture.byId.get(r.source_element_id);
                return rev ? (
                  <span key={r.id}>
                    {i > 0 ? ", " : ""}
                    <ElementLink slug={slug} element={rev} />
                  </span>
                ) : null;
              })}
            </p>
          ) : null}
          {history.length === 0 ? (
            <EmptyState title="No status history yet" />
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
                    {h.rationale ? (
                      <span className="block text-xs text-ink-muted">{h.rationale}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Panel>

      <Panel
        title="Stewardship"
        description="Attention, triage and escalation. Implementation's own tables, structurally parallel to Project Intelligence's but never shared with it. Internal only."
        actions={
          canEdit && !frozen && stewardship ? (
            <div className="flex flex-wrap items-start justify-end gap-2">
              <ActionForm
                trigger="Triage"
                fields={triageFields}
                defaultValues={{
                  attention: stewardship.attention,
                  nextReviewOn: stewardship.next_review_on ?? "",
                }}
                action={triageInitiative.bind(null, element.id)}
                submitLabel="Save triage"
              />
              <ActionForm
                trigger="Escalate"
                variant="danger"
                fields={escalateFields(
                  canPublish,
                  executives.map((m) => ({ value: m.id, label: nameOf(m.user_id) })),
                )}
                defaultValues={{ level: "principal_architect" }}
                action={escalateInitiative.bind(null, element.id)}
                submitLabel="Escalate"
              />
            </div>
          ) : null
        }
      >
        {stewardship ? (
          <div className="space-y-5">
            <DetailList
              items={[
                {
                  label: "Attention",
                  value: (
                    <StatusTag tone={ATTENTION[stewardship.attention].tone}>
                      {ATTENTION[stewardship.attention].label}
                    </StatusTag>
                  ),
                },
                {
                  label: "Triage",
                  value:
                    stewardship.triage_state === "triaged" && stewardship.triaged_at
                      ? `${TRIAGE_STATE.triaged.label} by ${nameOf(stewardship.triaged_by)} ${formatDate(stewardship.triaged_at.slice(0, 10))}`
                      : TRIAGE_STATE.untriaged.label,
                },
                {
                  label: "Next review",
                  value: stewardship.next_review_on
                    ? formatDate(stewardship.next_review_on)
                    : "Not set",
                },
              ]}
            />
            {openEscalations.length > 0 ? (
              <div className="space-y-3">
                {openEscalations.map((x) => (
                  <div key={x.id} className="rounded-sm border border-rule px-4 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <StatusTag
                        tone={x.resolved_at ? "neutral" : x.acknowledged_at ? "accent" : "negative"}
                      >
                        {x.resolved_at ? "Resolved" : x.acknowledged_at ? "Acknowledged" : "Open"}
                      </StatusTag>
                      <span className="text-ink">
                        To {ESCALATION_LEVEL_LABELS[x.level].toLowerCase()}
                      </span>
                      {x.client_actions ? (
                        <span className="text-xs text-ink-muted">
                          with request{" "}
                          <span className="font-mono">{x.client_actions.reference_code}</span>
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-ink-muted">{x.reason}</p>
                    <p className="mt-1 text-xs text-ink-subtle">
                      Raised by {nameOf(x.raised_by)} {formatDateTime(x.raised_at)}
                      {x.acknowledged_at
                        ? ` · acknowledged ${formatDateTime(x.acknowledged_at)}`
                        : ""}
                      {x.resolved_at
                        ? ` · resolved ${formatDateTime(x.resolved_at)}: ${x.resolution_note}`
                        : ""}
                    </p>
                    {canPublish && !x.resolved_at ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {x.acknowledged_at ? null : (
                          <ActionButton
                            action={acknowledgeEscalation.bind(null, x.id)}
                            label="Acknowledge"
                          />
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
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Checkpoints"
        description="Meaningful conditions or events inside this initiative — a short, dated list, achieved or pending. Not a task board."
        actions={
          canManageImplementation && !frozen ? (
            <ActionForm
              trigger="Add checkpoint"
              fields={[
                {
                  name: "checkpointType",
                  label: "Kind",
                  type: "select",
                  options: IMPLEMENTATION_CHECKPOINT_TYPES.map((t) => ({
                    value: t,
                    label: IMPLEMENTATION_CHECKPOINT_TYPE_LABELS[t],
                  })),
                },
                { name: "title", label: "Title", wide: true },
                { name: "targetOn", label: "Target date", type: "date" },
                {
                  name: "clientVisible",
                  label: "Client-visible",
                  type: "select",
                  options: [
                    { value: "no", label: "No" },
                    { value: "yes", label: "Yes" },
                  ],
                },
              ]}
              defaultValues={{ checkpointType: "other", clientVisible: "no" }}
              action={addCheckpoint.bind(null, element.id)}
              submitLabel="Add checkpoint"
            />
          ) : null
        }
      >
        {checkpoints.length === 0 ? (
          <EmptyState title="No checkpoints recorded" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule text-sm">
            {checkpoints.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span className="space-y-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-ink">{c.title}</span>
                    <span className="text-xs text-ink-subtle">
                      {IMPLEMENTATION_CHECKPOINT_TYPE_LABELS[c.checkpoint_type]}
                    </span>
                    {c.client_visible ? null : <InternalMark />}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {c.achieved_on
                      ? `Achieved ${formatDate(c.achieved_on)}`
                      : c.target_on
                        ? `Target ${formatDate(c.target_on)}`
                        : "No date set"}
                  </span>
                </span>
                {canManageImplementation && !c.achieved_on ? (
                  <ActionForm
                    trigger="Mark achieved"
                    fields={[
                      { name: "achievedOn", label: "Achieved on", type: "date" },
                      {
                        name: "achievedEvidenceSourceId",
                        label: "Evidence",
                        type: "select",
                        options: [{ value: "", label: "None" }, ...evidenceOptions],
                      },
                    ]}
                    defaultValues={{ achievedOn: today }}
                    action={recordCheckpointAchieved.bind(null, c.id)}
                    submitLabel="Record achieved"
                  />
                ) : c.achieved_on ? (
                  <StatusTag tone="positive">Achieved</StatusTag>
                ) : (
                  <StatusTag tone="neutral">Pending</StatusTag>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Evidence"
        description="What supports this initiative's operating-reality claim. Existing evidence sources, cited here."
      >
        <div className="space-y-3">
          {detail.elementEvidence.length === 0 ? (
            <EmptyState title="No evidence cited yet" />
          ) : (
            <ul className="divide-y divide-rule border-y border-rule text-sm">
              {detail.elementEvidence.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="text-ink">
                    {l.evidence_sources?.title}
                    {l.evidence_sources?.client_visibility === "internal" ? (
                      <span className="ml-2">
                        <InternalMark>Internal source</InternalMark>
                      </span>
                    ) : null}
                  </span>
                  {canEdit ? (
                    <ActionButton
                      action={removeElementCitation.bind(null, l.id)}
                      label="Remove"
                      variant="ghost"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canEdit && evidenceOptions.length > 0 ? (
            <ActionForm
              fields={[
                {
                  name: "evidenceSourceId",
                  label: "Evidence source",
                  type: "select",
                  options: evidenceOptions,
                  wide: true,
                },
                {
                  name: "stance",
                  label: "Stance",
                  type: "select",
                  options: [
                    { value: "supports", label: "Supports" },
                    { value: "contradicts", label: "Contradicts" },
                    { value: "context", label: "Context" },
                  ],
                },
                { name: "locator", label: "Locator" },
                { name: "note", label: "Note (internal)", type: "textarea" },
              ]}
              defaultValues={{ stance: "supports" }}
              action={citeEvidenceOnElement.bind(null, element.id)}
              submitLabel="Cite"
              trigger="Cite evidence"
            />
          ) : null}
        </div>
      </Panel>

      {impact.length > 0 ? (
        <Panel
          title="Impact"
          description="What this initiative implements and, in turn, what that touches through structural relationships."
        >
          <ul className="space-y-1 text-sm">
            {impact.map((row) => {
              const target = architecture.byId.get(row.element_id);
              return (
                <li key={row.element_id} className="flex flex-wrap items-baseline gap-2">
                  {target ? (
                    <ElementLink slug={slug} element={target} />
                  ) : (
                    <ReferenceCode code={row.reference_code} />
                  )}
                  <span className="text-xs text-ink-subtle">
                    {row.depth === 1 ? row.relationship_type : `${row.depth} steps away`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

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

      <VersionsPanel
        slug={slug}
        element={element}
        approvals={architecture.approvals}
        canPublish={canPublish}
        nameOf={nameOf}
        today={today}
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
