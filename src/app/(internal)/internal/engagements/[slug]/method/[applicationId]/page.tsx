import Link from "next/link";
import { notFound } from "next/navigation";
import { DOMAINS, DOMAIN_SHORT_LABELS } from "@/domain/architecture/catalog";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import { internalElementHref } from "@/domain/architecture/links";
import { listEvidence, loadArchitecture } from "@/domain/architecture/queries";
import {
  addApplicationAddendum,
  beginMethodApplication,
  clearStageNote,
  completeMethodApplication,
  discontinueMethodApplication,
  linkApplicationElement,
  linkApplicationEvidence,
  removeApplicationAsset,
  setApplicationAsset,
  setApplicationContexts,
  setApplicationDomains,
  setApplicationPractitioners,
  setStageNote,
  unlinkApplicationElement,
  unlinkApplicationEvidence,
  updateMethodApplication,
} from "@/domain/methodology/actions";
import {
  ELEMENT_ROLE,
  ELEMENT_ROLES,
  EVIDENCE_ROLE,
  EVIDENCE_ROLES,
  FORMS,
  STAGE_TREATMENT,
  STAGE_TREATMENTS,
  isClosedApplication,
  roleAllowsKind,
} from "@/domain/methodology/catalog";
import { compareOutputs } from "@/domain/methodology/compare";
import { elementKindLabel, objectTypeLabel, outputLabel } from "@/domain/methodology/labels";
import {
  getDeliverableTypes,
  getDevelopmentContexts,
  getMethodApplication,
  getUsableVersions,
} from "@/domain/methodology/queries";
import { getEdgeItems } from "@/domain/edge/queries";
import { ContextualEdgePanel } from "@/components/edge/edge-panel";
import { formatDate } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ApplicationStateTag, FormBadge, ReleaseChip } from "@/components/methodology/badges";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

/**
 * One Method Application (§11): one use of one exact published Method
 * version on this engagement. Stages record how the method was actually
 * treated; links say what was examined, produced, revised or informed. A
 * closed application is frozen; later insight goes in addenda. Internal only.
 */
export default async function MethodApplicationPage({
  params,
}: PageProps<"/internal/engagements/[slug]/method/[applicationId]">) {
  const { slug, applicationId } = await params;
  const { engagement, canEdit } = await getInternalArchitectureContext(slug);
  const detail = await getMethodApplication(applicationId);
  if (!detail || detail.app.engagement_id !== engagement.id) notFound();
  const [architecture, evidence, contexts, usable, deliverableTypes, edgeItems] = await Promise.all(
    [
      loadArchitecture(engagement.id),
      listEvidence(engagement.id),
      getDevelopmentContexts(),
      getUsableVersions(),
      getDeliverableTypes(engagement.id),
      getEdgeItems(engagement.id, { subjectId: applicationId }),
    ],
  );

  const { app } = detail;
  const version = app.method_asset_versions;
  const method = version?.method_assets;
  const closed = isClosedApplication(app.state);
  const editable = canEdit && !closed;
  const nameOf = memberNames(engagement);
  const internalMembers = engagement.engagement_members.filter(
    (m) => m.side === "internal" && m.status === "active",
  );
  const memberName = (memberId: string) =>
    nameOf(engagement.engagement_members.find((m) => m.id === memberId)?.user_id ?? null);
  const lead = detail.practitioners.find((p) => p.role === "lead");
  const contributors = detail.practitioners.filter((p) => p.role !== "lead");
  const notesByStage = new Map(detail.notes.map((n) => [n.stage_id, n]));

  const examined = detail.elements.filter((l) => l.role === "examined");
  const outputs = detail.elements.filter((l) => l.role !== "examined");
  const { comparison, unexpected } = compareOutputs(
    detail.outputs.map((o) => ({
      outputKind: o.output_kind,
      objectTypeKey: o.object_type_key,
      deliverableType: o.deliverable_type,
    })),
    detail.elements
      .filter((l) => l.element_id)
      .map((l) => ({
        role: l.role,
        kind: l.captured_kind,
        objectTypeKey: l.captured_object_type_key,
        deliverableType: l.element_id ? (deliverableTypes.get(l.element_id) ?? null) : null,
      })),
  );

  const componentOptions = usable
    .filter((u) => u.asset.form !== "method" && u.asset.form !== null)
    .map((u) => ({
      value: u.version.id,
      label: `${u.asset.title} ${u.version.version_label ?? ""} (${FORMS[u.asset.form!].label})`,
    }));
  const usedIds = new Set(detail.assets.map((a) => a.asset_version_id));
  const declaredNotUsed = detail.declaredComponents.filter(
    (c) => !usedIds.has(c.component_version_id),
  );
  const instruments = detail.assets.filter(
    (a) => a.method_asset_versions?.method_assets?.form === "instrument",
  );

  const elementOptions = (role: (typeof ELEMENT_ROLES)[number]) =>
    architecture.elements
      .filter((e) => e.lifecycle !== "retired" && roleAllowsKind(role, e.kind))
      .map((e) => ({
        value: e.id,
        label: `${e.reference_code ?? "Draft"} · ${e.title} (${
          e.object ? objectTypeLabel(e.object.object_type) : elementKindLabel(e.kind)
        })`,
      }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Method", app.reference_code].join(" · ")}
        title={app.title}
        description={app.selection_reason}
        actions={
          canEdit && !closed ? (
            <div className="flex flex-wrap gap-2">
              {app.state === "planned" ? (
                <ActionButton action={beginMethodApplication.bind(null, app.id)} label="Begin" />
              ) : null}
              {app.state === "in_progress" ? (
                <ActionForm
                  trigger="Complete"
                  submitLabel="Complete application"
                  action={completeMethodApplication.bind(null, app.id)}
                  confirm="A completed application is frozen. Later insight goes in addenda."
                  fields={[
                    {
                      name: "completionStatement",
                      label: "What was concluded",
                      type: "textarea",
                      hint: version?.completion_criteria
                        ? `The method's completion criteria: ${version.completion_criteria}`
                        : undefined,
                    },
                    {
                      name: "retrospective",
                      label: "Retrospective (optional)",
                      type: "textarea",
                      hint: "What should the Method Library learn from this use?",
                    },
                  ]}
                />
              ) : null}
              <ActionForm
                trigger="Discontinue"
                variant="danger"
                submitLabel="Discontinue"
                action={discontinueMethodApplication.bind(null, app.id)}
                fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
              />
            </div>
          ) : null
        }
      />
      <ArchitectureNav slug={slug} current="method" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Application" className="lg:col-span-2">
          <DetailList
            items={[
              { label: "State", value: <ApplicationStateTag state={app.state} /> },
              {
                label: "Method",
                value: method ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <FormBadge form={method.form} />
                    <Link
                      href={`/internal/method-library/${method.id}?version=${version?.id}`}
                      className="hover:underline"
                    >
                      {method.title}
                    </Link>
                    <span className="text-ink-subtle">{version?.version_label}</span>
                  </span>
                ) : (
                  "—"
                ),
              },
              {
                label: "Release",
                value: app.dam_releases ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <ReleaseChip label={app.dam_releases.version_label} />
                    {app.version_in_release ? null : (
                      <span className="text-attention">
                        Version outside the release: {app.outside_release_reason}
                      </span>
                    )}
                  </span>
                ) : (
                  "—"
                ),
              },
              {
                label: "Question it answers here",
                value: app.architectural_question || "—",
              },
              {
                label: "Scope",
                value: app.engagement_wide ? "Engagement-wide" : "Specific elements",
              },
              {
                label: "Dates",
                value: app.started_on
                  ? `${formatDate(app.started_on)}${app.closed_on ? ` to ${formatDate(app.closed_on)}` : ""}`
                  : "Not begun",
              },
              ...(app.completion_statement
                ? [{ label: "Concluded", value: app.completion_statement }]
                : []),
              ...(app.retrospective ? [{ label: "Retrospective", value: app.retrospective }] : []),
              ...(app.discontinued_reason
                ? [{ label: "Discontinued because", value: app.discontinued_reason }]
                : []),
            ]}
          />
          {editable ? (
            <div className="mt-4">
              <ActionForm
                trigger="Edit details"
                submitLabel="Save"
                action={updateMethodApplication.bind(null, app.id)}
                fields={[
                  { name: "title", label: "Title", wide: true },
                  { name: "selectionReason", label: "Why this method", type: "textarea" },
                  {
                    name: "architecturalQuestion",
                    label: "The question it answers here",
                    type: "textarea",
                  },
                  {
                    name: "engagementWide",
                    label: "Scope",
                    type: "select",
                    options: [
                      { value: "yes", label: "Engagement-wide" },
                      { value: "no", label: "Specific elements" },
                    ],
                  },
                ]}
                defaultValues={{
                  title: app.title,
                  selectionReason: app.selection_reason,
                  architecturalQuestion: app.architectural_question,
                  engagementWide: app.engagement_wide ? "yes" : "no",
                }}
              />
            </div>
          ) : null}
        </Panel>

        <Panel title="Practitioners and scope">
          <DetailList
            items={[
              { label: "Lead", value: lead ? memberName(lead.engagement_member_id) : "—" },
              {
                label: "Contributors",
                value: contributors.length
                  ? contributors.map((p) => memberName(p.engagement_member_id)).join(", ")
                  : "—",
              },
              {
                label: "Contexts",
                value: detail.contexts.length
                  ? detail.contexts.map((c) => c.development_contexts?.label).join(", ")
                  : "—",
              },
              {
                label: "Domains",
                value: detail.domains.length
                  ? detail.domains.map((d) => DOMAIN_SHORT_LABELS[d]).join(", ")
                  : "—",
              },
            ]}
          />
          {editable ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionForm
                trigger="Practitioners"
                submitLabel="Save"
                action={setApplicationPractitioners.bind(null, app.id)}
                fields={[
                  {
                    name: "leadMemberId",
                    label: "Lead",
                    type: "select",
                    options: internalMembers.map((m) => ({
                      value: m.id,
                      label: nameOf(m.user_id),
                    })),
                  },
                  {
                    name: "contributorMemberIds",
                    label: "Contributors",
                    type: "checkboxes",
                    options: internalMembers.map((m) => ({
                      value: m.id,
                      label: nameOf(m.user_id),
                    })),
                  },
                ]}
                defaultValues={{
                  leadMemberId: lead?.engagement_member_id ?? "",
                  contributorMemberIds: contributors.map((p) => p.engagement_member_id),
                }}
              />
              <ActionForm
                trigger="Contexts"
                submitLabel="Save"
                action={setApplicationContexts.bind(null, app.id)}
                fields={[
                  {
                    name: "contextIds",
                    label: "Development Contexts",
                    type: "checkboxes",
                    options: contexts
                      .filter((c) => c.status === "active")
                      .map((c) => ({ value: c.id, label: c.label })),
                  },
                ]}
                defaultValues={{ contextIds: detail.contexts.map((c) => c.context_id) }}
              />
              <ActionForm
                trigger="Domains"
                submitLabel="Save"
                action={setApplicationDomains.bind(null, app.id)}
                fields={[
                  {
                    name: "domains",
                    label: "Domains",
                    type: "checkboxes",
                    options: DOMAINS.map((d) => ({ value: d, label: DOMAIN_SHORT_LABELS[d] })),
                  },
                ]}
                defaultValues={{ domains: detail.domains }}
              />
            </div>
          ) : null}
        </Panel>
      </div>

      <ContextualEdgePanel
        slug={slug}
        engagementId={engagement.id}
        items={edgeItems}
        canJudge={canEdit}
        title="Practice conditions"
        description="Conditions on this application from the Method Library and the architecture it touched: a superseded method basis, stages without a recorded treatment, examined elements revised since. Internal only."
        empty="No practice conditions on this application."
      />

      <Panel
        title="Stages"
        description="The pinned version's stages, and how each was treated here. A stage adapted or skipped says why."
      >
        {detail.stages.length === 0 ? (
          <EmptyState title="This version declares no stages" />
        ) : (
          <ol className="divide-y divide-rule">
            {detail.stages.map((stage, i) => {
              const note = notesByStage.get(stage.id);
              return (
                <li key={stage.id} className="py-3 first:pt-0 last:pb-0">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                      <span className="text-ink-subtle tabular-nums">{i + 1}.</span>
                      <span className="font-medium text-ink">{stage.title}</span>
                      {note ? (
                        <StatusTag
                          tone={
                            note.treatment === "followed"
                              ? "positive"
                              : note.treatment === "adapted"
                                ? "attention"
                                : "neutral"
                          }
                        >
                          {STAGE_TREATMENT[note.treatment]}
                        </StatusTag>
                      ) : (
                        <span className="text-xs text-ink-subtle">Not yet recorded</span>
                      )}
                    </summary>
                    <div className="mt-2 space-y-2 pl-6 text-sm">
                      {stage.purpose ? <p className="text-ink">{stage.purpose}</p> : null}
                      {stage.guidance ? <p className="text-ink-muted">{stage.guidance}</p> : null}
                      {note?.reason ? <p className="text-ink">Why: {note.reason}</p> : null}
                      {note?.note ? <p className="text-ink">{note.note}</p> : null}
                      {editable ? (
                        <div className="flex flex-wrap gap-2">
                          <ActionForm
                            trigger={note ? "Update treatment" : "Record treatment"}
                            submitLabel="Save"
                            action={setStageNote.bind(null, app.id, stage.id)}
                            fields={[
                              {
                                name: "treatment",
                                label: "Treatment",
                                type: "select",
                                options: STAGE_TREATMENTS.map((t) => ({
                                  value: t,
                                  label: STAGE_TREATMENT[t],
                                })),
                              },
                              {
                                name: "reason",
                                label: "Why (required when adapted or skipped)",
                                type: "textarea",
                              },
                              { name: "note", label: "Notes", type: "textarea" },
                            ]}
                            defaultValues={{
                              treatment: note?.treatment ?? "followed",
                              reason: note?.reason ?? "",
                              note: note?.note ?? "",
                            }}
                          />
                          {note ? (
                            <ActionButton
                              action={clearStageNote.bind(null, app.id, stage.id)}
                              label="Clear"
                              variant="ghost"
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Inputs"
          description="What the work examined and the evidence it drew on or gathered."
          actions={
            editable ? (
              <div className="flex flex-wrap gap-2">
                <ActionForm
                  trigger="Examined element"
                  submitLabel="Link"
                  action={linkApplicationElement.bind(null, app.id)}
                  fields={[
                    {
                      name: "role",
                      label: "Role",
                      type: "select",
                      options: [{ value: "examined", label: ELEMENT_ROLE.examined }],
                    },
                    {
                      name: "elementId",
                      label: "Element",
                      type: "select",
                      options: elementOptions("examined"),
                      wide: true,
                    },
                    { name: "note", label: "Note", type: "textarea" },
                  ]}
                  defaultValues={{ role: "examined" }}
                />
                {evidence.length > 0 ? (
                  <ActionForm
                    trigger="Evidence"
                    submitLabel="Link"
                    action={linkApplicationEvidence.bind(null, app.id)}
                    fields={[
                      {
                        name: "evidenceSourceId",
                        label: "Evidence source",
                        type: "select",
                        options: evidence.map((s) => ({ value: s.id, label: s.title })),
                        wide: true,
                      },
                      {
                        name: "role",
                        label: "Role",
                        type: "select",
                        options: EVIDENCE_ROLES.map((r) => ({ value: r, label: EVIDENCE_ROLE[r] })),
                      },
                      {
                        name: "instrumentVersionId",
                        label: "Gathered with",
                        type: "select",
                        hint: "An Instrument used in this application",
                        options: [
                          { value: "", label: "No instrument" },
                          ...instruments.map((a) => ({
                            value: a.asset_version_id,
                            label: `${a.method_asset_versions?.method_assets?.title ?? ""} ${
                              a.method_asset_versions?.version_label ?? ""
                            }`,
                          })),
                        ],
                      },
                      { name: "note", label: "Note", type: "textarea" },
                    ]}
                    defaultValues={{ role: "drew_on" }}
                  />
                ) : null}
              </div>
            ) : null
          }
        >
          {examined.length === 0 && detail.evidence.length === 0 ? (
            <EmptyState title="Nothing linked yet" />
          ) : (
            <ul className="space-y-2 text-sm">
              {examined.map((l) => (
                <ElementLinkRow key={l.id} link={l} slug={slug} canUnlink={editable} />
              ))}
              {detail.evidence.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="text-ink-subtle">{EVIDENCE_ROLE[l.role]}</span>
                  <Link
                    href={`/internal/engagements/${slug}/evidence`}
                    className="text-ink hover:underline"
                  >
                    {l.evidence_sources?.title}
                  </Link>
                  {l.instrument_version_id ? (
                    <span className="text-xs text-ink-subtle">
                      with{" "}
                      {instruments.find((i) => i.asset_version_id === l.instrument_version_id)
                        ?.method_asset_versions?.method_assets?.title ?? "an Instrument"}
                    </span>
                  ) : null}
                  {l.note ? <span className="text-ink-muted">· {l.note}</span> : null}
                  {editable ? (
                    <ActionButton
                      action={unlinkApplicationEvidence.bind(null, l.id)}
                      label="Unlink"
                      variant="ghost"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Components used"
          description="The exact Model, Standard, Instrument and Template versions used within this application."
          actions={
            editable && componentOptions.length > 0 ? (
              <ActionForm
                trigger="Record a component"
                submitLabel="Record"
                action={setApplicationAsset.bind(null, app.id)}
                fields={[
                  {
                    name: "versionId",
                    label: "Version",
                    type: "select",
                    options: componentOptions,
                    wide: true,
                  },
                  {
                    name: "deviationNote",
                    label: "Deviation note",
                    hint: "How this differs from the components the method declares, if it does",
                    type: "textarea",
                  },
                ]}
                defaultValues={{
                  versionId: declaredNotUsed[0]?.component_version_id ?? componentOptions[0]?.value,
                }}
              />
            ) : null
          }
        >
          {detail.assets.length === 0 && declaredNotUsed.length === 0 ? (
            <EmptyState title="No components declared or recorded" />
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.assets.map((a) => (
                <li key={a.asset_version_id} className="flex flex-wrap items-baseline gap-2">
                  <FormBadge form={a.method_asset_versions?.method_assets?.form ?? null} />
                  <Link
                    href={`/internal/method-library/${a.method_asset_versions?.method_assets?.id}`}
                    className="text-ink hover:underline"
                  >
                    {a.method_asset_versions?.method_assets?.title}
                  </Link>
                  <span className="text-ink-subtle">{a.method_asset_versions?.version_label}</span>
                  {a.deviation_note ? (
                    <span className="text-attention">· {a.deviation_note}</span>
                  ) : null}
                  {editable ? (
                    <ActionButton
                      action={removeApplicationAsset.bind(null, app.id, a.asset_version_id)}
                      label="Remove"
                      variant="ghost"
                    />
                  ) : null}
                </li>
              ))}
              {declaredNotUsed.map((c) => (
                <li key={c.component_version_id} className="text-ink-subtle">
                  Declared by the method, not recorded as used:{" "}
                  {c.method_asset_versions?.method_assets?.title}{" "}
                  {c.method_asset_versions?.version_label}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Outputs"
        description="Elements this application produced, revised or informed. Method work never creates architecture relationships."
        actions={
          editable ? (
            <ActionForm
              trigger="Link an output"
              submitLabel="Link"
              action={linkApplicationElement.bind(null, app.id)}
              fields={[
                {
                  name: "role",
                  label: "Role",
                  type: "select",
                  options: ELEMENT_ROLES.filter((r) => r !== "examined").map((r) => ({
                    value: r,
                    label: ELEMENT_ROLE[r],
                  })),
                },
                {
                  name: "elementId",
                  label: "Element",
                  type: "select",
                  hint: "Produced and revised accept objects, records and deliverables; informed accepts decisions, recommendations, reviews and initiatives. The database checks the pairing.",
                  options: elementOptions("examined"),
                  wide: true,
                },
                { name: "note", label: "Note", type: "textarea" },
              ]}
              defaultValues={{ role: "produced" }}
            />
          ) : null
        }
      >
        {comparison.length > 0 ? (
          <div className="mb-4 space-y-1 text-sm">
            <p className="text-xs tracking-wide text-ink-subtle uppercase">
              Expected by the method
            </p>
            <ul className="space-y-1">
              {comparison.map((c, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="text-ink">
                    {outputLabel({
                      output_kind: c.expected.outputKind,
                      object_type_key: c.expected.objectTypeKey,
                      deliverable_type: c.expected.deliverableType,
                    })}
                  </span>
                  <span className={c.produced > 0 ? "text-positive" : "text-ink-subtle"}>
                    {c.produced > 0 ? `${c.produced} linked` : "None yet"}
                  </span>
                </li>
              ))}
            </ul>
            {unexpected.length > 0 ? (
              <p className="text-ink-muted">
                {unexpected.length} {unexpected.length === 1 ? "output" : "outputs"} beyond what the
                method expects.
              </p>
            ) : null}
          </div>
        ) : null}
        {outputs.length === 0 ? (
          <EmptyState title="No outputs linked yet" />
        ) : (
          <ul className="space-y-2 text-sm">
            {outputs.map((l) => (
              <ElementLinkRow key={l.id} link={l} slug={slug} canUnlink={editable} />
            ))}
          </ul>
        )}
      </Panel>

      {closed ? (
        <Panel
          title="Addenda"
          description="Insight after closure. The closed record itself does not change."
          actions={
            canEdit ? (
              <ActionForm
                trigger="Add an addendum"
                submitLabel="Add"
                action={addApplicationAddendum.bind(null, app.id)}
                fields={[{ name: "body", label: "Addendum", type: "textarea" }]}
              />
            ) : null
          }
        >
          {detail.addenda.length === 0 ? (
            <EmptyState title="No addenda" />
          ) : (
            <ul className="space-y-3 text-sm">
              {detail.addenda.map((a) => (
                <li key={a.id}>
                  <p className="text-ink-subtle">
                    {formatDate(a.created_at)} · {nameOf(a.created_by)}
                  </p>
                  <p className="text-ink">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

type ElementLink =
  Awaited<ReturnType<typeof getMethodApplication>> extends infer D
    ? D extends { elements: (infer L)[] }
      ? L
      : never
    : never;

/**
 * One link. When the element was a draft that has since been deleted (D30),
 * the link keeps the identity captured when it was made and says so.
 */
function ElementLinkRow({
  link,
  slug,
  canUnlink,
}: {
  link: ElementLink;
  slug: string;
  canUnlink: boolean;
}) {
  const kindText =
    link.captured_kind === "object"
      ? objectTypeLabel(link.captured_object_type_key)
      : elementKindLabel(link.captured_kind);
  return (
    <li className="flex flex-wrap items-baseline gap-2">
      <span className="text-ink-subtle">{ELEMENT_ROLE[link.role]}</span>
      {link.element_id ? (
        <Link
          href={internalElementHref(slug, link.captured_kind, link.element_id)}
          className="text-ink hover:underline"
        >
          {link.captured_reference_code ? `${link.captured_reference_code} · ` : ""}
          {link.captured_title}
        </Link>
      ) : (
        <span className="text-ink-muted line-through decoration-rule">
          {link.captured_reference_code ? `${link.captured_reference_code} · ` : ""}
          {link.captured_title}
        </span>
      )}
      <span className="text-xs text-ink-subtle">{kindText}</span>
      {link.element_removed_at ? (
        <span className="text-xs text-attention">
          Draft deleted {formatDate(link.element_removed_at)}; identity as captured{" "}
          {formatDate(link.captured_at)}
        </span>
      ) : null}
      {link.note ? <span className="text-ink-muted">· {link.note}</span> : null}
      {canUnlink && link.element_id ? (
        <ActionButton
          action={unlinkApplicationElement.bind(null, link.id)}
          label="Unlink"
          variant="ghost"
        />
      ) : null}
    </li>
  );
}
