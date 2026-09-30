import Link from "next/link";
import {
  EVIDENCE_SOURCE_TYPES,
  EVIDENCE_SOURCE_TYPE_LABELS,
  RECORD_KIND_LABELS,
} from "@/domain/architecture/catalog";
import { OBJECT_TYPES } from "@/domain/architecture/vocabulary";
import { DELIVERABLE_TYPES, DELIVERABLE_TYPE_LABELS } from "@/domain/deliverables/catalog";
import {
  addLearningSource,
  recordRightsHolder,
  removeLearningSource,
  removeMethodFile,
  setInstrumentEvidenceTypes,
  setMethodAssetOrigin,
  setStandardCriteria,
  setStandardJudgedIn,
  setTemplateSpec,
  setVersionComponents,
  setVersionOutputs,
  setVersionStages,
  supersedeRightsHolder,
} from "@/domain/methodology/actions";
import {
  FORMS,
  LINEAGE_ROLE,
  METHOD_ASSET_ORIGINS,
  ORIGIN,
  RIGHTS_ROLE,
  RIGHTS_ROLES,
  STANDARD_SETTINGS,
  formLabel,
  type MethodAssetForm,
  type MethodLineageRole,
} from "@/domain/methodology/catalog";
import { diffVersionFields } from "@/domain/methodology/compare";
import { outputLabel } from "@/domain/methodology/labels";
import {
  getClosedApplicationsOfAsset,
  type MethodAssetDetail,
  type MethodUsageRow,
  type MethodVersionRow,
  type MethodVersionStructure,
  type UsableVersion,
} from "@/domain/methodology/queries";
import {
  criteriaToText,
  outputValue,
  sectionsToText,
  stagesToText,
} from "@/domain/methodology/structure";
import { formatDate } from "@/lib/format";
import { ProtectedBanner, VersionTag } from "@/components/methodology/badges";
import { MethodFileUpload } from "@/components/methodology/method-file-upload";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

const RECORD_OUTPUT_KINDS = Object.keys(RECORD_KIND_LABELS) as (keyof typeof RECORD_KIND_LABELS)[];

function outputOptions(form: MethodAssetForm | null) {
  const objects = OBJECT_TYPES.map((t) => ({ value: `object:${t.key}`, label: t.label }));
  if (form === "model") return objects;
  return [
    ...objects,
    ...RECORD_OUTPUT_KINDS.map((k) => ({ value: `kind:${k}`, label: RECORD_KIND_LABELS[k] })),
    ...DELIVERABLE_TYPES.map((d) => ({
      value: `deliverable:${d}`,
      label: `${DELIVERABLE_TYPE_LABELS[d]} (Deliverable)`,
    })),
  ];
}

// -----------------------------------------------------------------------------
// Structure: the form-specific tab
// -----------------------------------------------------------------------------
export function StructureSection({
  form,
  assetId,
  version,
  structure,
  editing,
  usable,
}: {
  form: MethodAssetForm | null;
  assetId: string;
  version: MethodVersionRow;
  structure: MethodVersionStructure;
  editing: boolean;
  usable: UsableVersion[];
}) {
  if (!form) {
    return (
      <Panel title="Structure">
        <EmptyState title="A legacy version has no form-specific structure">
          Adopt the asset to give it a form; nothing is inferred.
        </EmptyState>
      </Panel>
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">{FORMS[form].behavior}</p>

      {form === "method" ? (
        <Panel
          title="Stages"
          description="Guidance for practitioners, never a checklist or a status."
        >
          {structure.stages.length === 0 ? (
            <EmptyState title="No stages yet" />
          ) : (
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              {structure.stages.map((s) => (
                <li key={s.id}>
                  <span className="font-medium text-ink">{s.title}</span>
                  {s.purpose ? <span className="text-ink-muted"> · {s.purpose}</span> : null}
                  {s.guidance ? <p className="mt-1 text-ink-muted">{s.guidance}</p> : null}
                </li>
              ))}
            </ol>
          )}
          {editing ? (
            <div className="mt-4">
              <ActionForm
                trigger="Edit stages"
                submitLabel="Save stages"
                action={setVersionStages.bind(null, version.id)}
                fields={[
                  {
                    name: "text",
                    label: "One stage per line",
                    type: "textarea",
                    hint: "Title | purpose | guidance",
                  },
                ]}
                defaultValues={{ text: stagesToText(structure.stages) }}
              />
            </div>
          ) : null}
        </Panel>
      ) : null}

      {form === "method" || form === "model" ? (
        <Panel
          title={form === "model" ? "Applied into" : "Expected outputs"}
          description={
            form === "model"
              ? "The core object types this Model is instantiated into."
              : "What an application of this Method is expected to produce. Compared with actual outputs on each application."
          }
        >
          {structure.outputs.length === 0 ? (
            <EmptyState title="None declared" />
          ) : (
            <ul className="space-y-1 text-sm text-ink">
              {structure.outputs.map((o) => (
                <li key={o.id}>{outputLabel(o)}</li>
              ))}
            </ul>
          )}
          {editing ? (
            <div className="mt-4">
              <ActionForm
                trigger="Edit outputs"
                submitLabel="Save outputs"
                action={setVersionOutputs.bind(null, version.id)}
                fields={[
                  {
                    name: "outputs",
                    label: "Outputs",
                    type: "checkboxes",
                    options: outputOptions(form),
                    wide: true,
                  },
                ]}
                defaultValues={{ outputs: structure.outputs.map((o) => outputValue(o)) }}
              />
            </div>
          ) : null}
        </Panel>
      ) : null}

      {form === "method" ? (
        <Panel
          title="Components"
          description="Models, Standards, Instruments and Templates this Method normally uses. Guidance, pinned to exact versions."
        >
          {structure.components.length === 0 ? (
            <EmptyState title="No components" />
          ) : (
            <ul className="space-y-1 text-sm">
              {structure.components.map((c) => {
                const cv = c.method_asset_versions;
                const ca = cv?.method_assets;
                return (
                  <li key={c.component_version_id}>
                    <Link
                      href={`/internal/method-library/${ca?.id}`}
                      className="text-ink hover:underline"
                    >
                      {ca?.title}
                    </Link>{" "}
                    <span className="text-ink-subtle">
                      · {formLabel(ca?.form ?? null)} {cv?.version_label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {editing ? (
            <div className="mt-4">
              <ActionForm
                trigger="Edit components"
                submitLabel="Save components"
                action={setVersionComponents.bind(null, version.id)}
                fields={[
                  {
                    name: "componentVersionIds",
                    label: "Current published components",
                    type: "checkboxes",
                    options: usable
                      .filter((u) => u.asset.form !== "method" && u.asset.id !== assetId)
                      .map((u) => ({
                        value: u.version.id,
                        label: `${u.asset.title} (${formLabel(u.asset.form)} ${u.version.version_label ?? ""})`,
                      })),
                    wide: true,
                  },
                ]}
                defaultValues={{
                  componentVersionIds: structure.components.map((c) => c.component_version_id),
                }}
              />
            </div>
          ) : null}
        </Panel>
      ) : null}

      {form === "standard" ? (
        <>
          <Panel title="Criteria" description="What is judged. A Standard never records a verdict.">
            {structure.criteria.length === 0 ? (
              <EmptyState title="No criteria yet" />
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                {structure.criteria.map((c) => (
                  <li key={c.id}>
                    <span className="text-ink">{c.statement}</span>
                    {c.guidance ? <p className="text-ink-muted">{c.guidance}</p> : null}
                  </li>
                ))}
              </ol>
            )}
            {editing ? (
              <div className="mt-4">
                <ActionForm
                  trigger="Edit criteria"
                  submitLabel="Save criteria"
                  action={setStandardCriteria.bind(null, version.id)}
                  fields={[
                    {
                      name: "text",
                      label: "One criterion per line",
                      type: "textarea",
                      hint: "Statement | guidance",
                    },
                  ]}
                  defaultValues={{ text: criteriaToText(structure.criteria) }}
                />
              </div>
            ) : null}
          </Panel>
          <Panel title="Judged in">
            <p className="text-sm text-ink">
              {structure.judgedIn.length
                ? structure.judgedIn.map((s) => s[0]!.toUpperCase() + s.slice(1)).join(", ")
                : "—"}
            </p>
            {editing ? (
              <div className="mt-4">
                <ActionForm
                  trigger="Edit"
                  submitLabel="Save"
                  action={setStandardJudgedIn.bind(null, version.id)}
                  fields={[
                    {
                      name: "settings",
                      label: "Settings",
                      type: "checkboxes",
                      options: STANDARD_SETTINGS.map((s) => ({
                        value: s,
                        label: s[0]!.toUpperCase() + s.slice(1),
                      })),
                    },
                  ]}
                  defaultValues={{ settings: structure.judgedIn }}
                />
              </div>
            ) : null}
          </Panel>
        </>
      ) : null}

      {form === "instrument" ? (
        <Panel
          title="Evidence it gathers"
          description="An Instrument is used within a Method Application."
        >
          <p className="text-sm text-ink">
            {structure.evidenceTypes.length
              ? structure.evidenceTypes.map((t) => EVIDENCE_SOURCE_TYPE_LABELS[t]).join(", ")
              : "—"}
          </p>
          {editing ? (
            <div className="mt-4">
              <ActionForm
                trigger="Edit"
                submitLabel="Save"
                action={setInstrumentEvidenceTypes.bind(null, version.id)}
                fields={[
                  {
                    name: "types",
                    label: "Evidence types",
                    type: "checkboxes",
                    options: EVIDENCE_SOURCE_TYPES.map((t) => ({
                      value: t,
                      label: EVIDENCE_SOURCE_TYPE_LABELS[t],
                    })),
                    wide: true,
                  },
                ]}
                defaultValues={{ types: structure.evidenceTypes }}
              />
            </div>
          ) : null}
        </Panel>
      ) : null}

      {form === "template" ? (
        <Panel
          title="Deliverable and outline"
          description="A Deliverable of this type is produced from the Template."
        >
          <DetailList
            items={[
              {
                label: "Produces",
                value: structure.deliverableType
                  ? DELIVERABLE_TYPE_LABELS[structure.deliverableType]
                  : null,
              },
              {
                label: "Section outline",
                value: structure.sections.length ? (
                  <ol className="list-decimal pl-5">
                    {structure.sections.map((s) => (
                      <li key={s.id}>
                        {s.title}
                        {s.guidance ? (
                          <span className="text-ink-muted"> · {s.guidance}</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : null,
              },
            ]}
          />
          {editing ? (
            <div className="mt-4">
              <ActionForm
                trigger="Edit"
                submitLabel="Save"
                action={setTemplateSpec.bind(null, version.id)}
                fields={[
                  {
                    name: "deliverableType",
                    label: "Deliverable type",
                    type: "select",
                    options: DELIVERABLE_TYPES.map((d) => ({
                      value: d,
                      label: DELIVERABLE_TYPE_LABELS[d],
                    })),
                  },
                  {
                    name: "sections",
                    label: "One section per line",
                    type: "textarea",
                    hint: "Title | guidance",
                  },
                ]}
                defaultValues={{
                  deliverableType: structure.deliverableType ?? DELIVERABLE_TYPES[0],
                  sections: sectionsToText(structure.sections),
                }}
              />
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Practitioner guidance: protected
// -----------------------------------------------------------------------------
export function GuidanceSection({
  form,
  version,
  structure,
  editing,
}: {
  form: MethodAssetForm | null;
  version: MethodVersionRow;
  structure: MethodVersionStructure;
  editing: boolean;
}) {
  return (
    <div className="space-y-6">
      <ProtectedBanner />
      <Panel title="Practitioner guidance">
        <DetailList
          items={[
            {
              label: "Practitioner instructions",
              value: version.practitioner_instructions ? (
                <span className="whitespace-pre-line">{version.practitioner_instructions}</span>
              ) : null,
            },
            { label: "Internal notes", value: version.internal_notes },
            ...(form === "method"
              ? [
                  { label: "Prerequisites", value: version.prerequisites },
                  { label: "Practitioner roles", value: version.practitioner_roles },
                  { label: "Completion criteria", value: version.completion_criteria },
                  { label: "Review implications", value: version.review_implications },
                  {
                    label: "Implementation implications",
                    value: version.implementation_implications,
                  },
                ]
              : []),
          ]}
        />
      </Panel>
      {form === "instrument" || form === "template" ? (
        <Panel title="Protected files">
          {structure.files.length === 0 ? (
            <EmptyState title="No files" />
          ) : (
            <ul className="divide-y divide-rule text-sm">
              {structure.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                  <a
                    href={`/internal/method-library/files/${f.id}`}
                    className="text-ink hover:underline"
                  >
                    {f.file_name}
                  </a>
                  {editing ? (
                    <ActionButton
                      action={removeMethodFile.bind(null, f.id)}
                      label="Remove"
                      variant="ghost"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {editing ? (
            <div className="mt-4">
              <MethodFileUpload versionId={version.id} />
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// History
// -----------------------------------------------------------------------------
export async function HistorySection({
  assetId,
  versions,
  version,
  structure,
  editing,
}: {
  assetId: string;
  versions: MethodVersionRow[];
  version: MethodVersionRow;
  structure: MethodVersionStructure;
  editing: boolean;
}) {
  const prior =
    versions.find((v) => v.id === version.derived_from_version_id) ??
    versions.find((v) => v.version_no === version.version_no - 1) ??
    null;
  const diff = diffVersionFields(prior, version);
  const closed = editing ? await getClosedApplicationsOfAsset(assetId) : [];
  const cited = new Set(structure.learning.map((l) => l.application_id));
  return (
    <div className="space-y-6">
      <Panel title="Versions">
        <Table>
          <thead>
            <tr>
              <Th>Version</Th>
              <Th>State</Th>
              <Th>Published</Th>
              <Th>Change summary</Th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <Td>
                  <Link
                    href={`/internal/method-library/${assetId}?tab=history&version=${v.id}`}
                    className="hover:underline"
                  >
                    {v.version_label ?? "Draft"}
                  </Link>
                  {v.legacy ? <span className="ml-2 text-xs text-attention">Legacy</span> : null}
                </Td>
                <Td>
                  <VersionTag lifecycle={v.lifecycle} />
                </Td>
                <Td>{formatDate(v.published_at)}</Td>
                <Td className="max-w-md text-ink-muted">{v.change_summary || v.retired_reason}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel
        title={
          prior ? `Changes from ${prior.version_label ?? "the previous version"}` : "First version"
        }
        description="Field-level differences in the version's text."
      >
        {diff.length === 0 ? (
          <EmptyState title="No text changes" />
        ) : (
          <dl className="space-y-4 text-sm">
            {diff.map((d) => (
              <div key={d.field}>
                <dt className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
                  {d.label}
                </dt>
                {d.before ? <dd className="mt-1 text-negative line-through">{d.before}</dd> : null}
                <dd className="mt-1 text-ink">
                  {d.after || <span className="text-ink-subtle">Removed</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <Panel
        title="Learning sources"
        description="Closed Method Applications that informed this version. The practice loop's return path."
      >
        {structure.learning.length === 0 ? (
          <EmptyState title="None recorded" />
        ) : (
          <ul className="space-y-2 text-sm">
            {structure.learning.map((l) => (
              <li
                key={l.application_id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  <span className="font-mono text-xs text-ink-muted">
                    {l.method_applications?.reference_code}
                  </span>{" "}
                  {l.method_applications?.title}
                  {l.note ? <span className="text-ink-muted"> · {l.note}</span> : null}
                </span>
                {editing ? (
                  <ActionButton
                    action={removeLearningSource.bind(null, version.id, l.application_id)}
                    label="Remove"
                    variant="ghost"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {editing && closed.some((a) => !cited.has(a.id)) ? (
          <div className="mt-4">
            <ActionForm
              trigger="Cite an application"
              submitLabel="Cite"
              action={addLearningSource.bind(null, version.id)}
              fields={[
                {
                  name: "applicationId",
                  label: "Closed application",
                  type: "select",
                  options: closed
                    .filter((a) => !cited.has(a.id))
                    .map((a) => ({
                      value: a.id,
                      label: `${a.reference_code} ${a.title} (${a.engagements?.title ?? ""})`,
                    })),
                  wide: true,
                },
                { name: "note", label: "What it taught", type: "textarea" },
              ]}
              defaultValues={{ applicationId: closed.find((a) => !cited.has(a.id))?.id ?? "" }}
            />
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Where used
// -----------------------------------------------------------------------------
type UsageApplication = {
  id: string;
  reference_code: string;
  title: string;
  state: string;
  engagement_title: string;
  engagement_slug: string;
};
type UsageLineage = {
  id: string;
  role: MethodLineageRole;
  element_id: string;
  reference_code: string;
  title: string;
  engagement_title: string;
  engagement_slug: string;
};

export function UsageSection({ usage }: { usage: MethodUsageRow[] }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        Counts cover every engagement. Applications and elements are listed only for engagements you
        can read. There is no scoring.
      </p>
      {usage.map((u) => {
        const applications = u.applications as unknown as UsageApplication[];
        const lineage = u.lineage as unknown as UsageLineage[];
        return (
          <Panel
            key={u.version_id}
            title={`Version ${u.version_label ?? "draft"}`}
            description={`${u.application_count} application(s) · ${u.lineage_count} lineage row(s)${
              u.release_labels.length ? ` · in DAM ${u.release_labels.join(", ")}` : ""
            }`}
            actions={<VersionTag lifecycle={u.lifecycle} />}
          >
            {applications.length === 0 && lineage.length === 0 ? (
              <p className="text-sm text-ink-subtle">Nothing you can read.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {applications.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/internal/engagements/${a.engagement_slug}/method/${a.id}`}
                      className="hover:underline"
                    >
                      <span className="font-mono text-xs text-ink-muted">{a.reference_code}</span>{" "}
                      {a.title}
                    </Link>{" "}
                    <span className="text-ink-subtle">
                      · {a.engagement_title} · {a.state.replace("_", " ")}
                    </span>
                  </li>
                ))}
                {lineage.map((l) => (
                  <li key={l.id}>
                    <span className="text-ink-subtle">{LINEAGE_ROLE[l.role]}</span>{" "}
                    <Link
                      href={`/internal/engagements/${l.engagement_slug}/architecture/elements/${l.element_id}`}
                      className="hover:underline"
                    >
                      <span className="font-mono text-xs text-ink-muted">{l.reference_code}</span>{" "}
                      {l.title}
                    </Link>{" "}
                    <span className="text-ink-subtle">· {l.engagement_title}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Rights
// -----------------------------------------------------------------------------
export function RightsSection({
  asset,
  rights,
  canPublish,
}: {
  asset: MethodAssetDetail["asset"];
  rights: MethodAssetDetail["rights"];
  canPublish: boolean;
}) {
  const active = rights.filter((r) => !r.superseded_at);
  const history = rights.filter((r) => r.superseded_at);
  return (
    <div className="space-y-6">
      <Panel
        title="Origin and restriction"
        description="Internal only, including for a client that co-owns the asset."
      >
        <DetailList
          items={[
            { label: "Origin", value: ORIGIN[asset.origin] },
            { label: "Usage restriction", value: asset.usage_restriction },
          ]}
        />
        {canPublish && asset.status !== "retired" ? (
          <div className="mt-4">
            <ActionForm
              trigger="Change origin"
              submitLabel="Save"
              action={setMethodAssetOrigin.bind(null, asset.id)}
              fields={[
                {
                  name: "origin",
                  label: "Origin",
                  type: "select",
                  options: METHOD_ASSET_ORIGINS.map((o) => ({ value: o, label: ORIGIN[o] })),
                },
                { name: "reason", label: "Reason", type: "textarea" },
              ]}
              defaultValues={{ origin: asset.origin }}
            />
          </div>
        ) : null}
      </Panel>
      <Panel
        title="Rights holders"
        description="Append-only: a change supersedes the earlier record."
      >
        {active.length === 0 ? (
          <EmptyState title="No rights holders recorded" />
        ) : (
          <ul className="divide-y divide-rule text-sm">
            {active.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {r.organizations?.name ?? r.external_holder_name}{" "}
                  <span className="text-ink-subtle">
                    · {RIGHTS_ROLE[r.holder_role]}
                    {r.agreement_reference ? ` · ${r.agreement_reference}` : ""}
                    {r.effective_on ? ` · from ${formatDate(r.effective_on)}` : ""}
                  </span>
                </span>
                {canPublish ? (
                  <ActionForm
                    trigger="Supersede"
                    submitLabel="Supersede"
                    action={supersedeRightsHolder.bind(null, r.id)}
                    fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {history.length > 0 ? (
          <details className="mt-3 text-sm text-ink-muted">
            <summary className="cursor-pointer">Superseded records ({history.length})</summary>
            <ul className="mt-2 space-y-1">
              {history.map((r) => (
                <li key={r.id}>
                  {r.organizations?.name ?? r.external_holder_name} · {RIGHTS_ROLE[r.holder_role]} ·
                  superseded {formatDate(r.superseded_at)}: {r.superseded_reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {canPublish ? (
          <div className="mt-4">
            <ActionForm
              trigger="Record a rights holder"
              submitLabel="Record"
              action={recordRightsHolder.bind(null, asset.id)}
              fields={[
                { name: "externalHolderName", label: "Holder", hint: "Organization or person" },
                {
                  name: "holderRole",
                  label: "Role",
                  type: "select",
                  options: RIGHTS_ROLES.map((r) => ({ value: r, label: RIGHTS_ROLE[r] })),
                },
                { name: "agreementReference", label: "Agreement reference" },
                { name: "effectiveOn", label: "Effective on", type: "date" },
                { name: "note", label: "Note", type: "textarea" },
              ]}
              defaultValues={{ holderRole: "owner" }}
            />
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
