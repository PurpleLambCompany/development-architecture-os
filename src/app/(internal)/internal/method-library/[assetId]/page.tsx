import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DOMAINS, DOMAIN_SHORT_LABELS } from "@/domain/architecture/catalog";
import {
  adoptLegacyMethodAsset,
  createMethodVersion,
  deleteMethodVersion,
  publishMethodVersion,
  retireMethodAsset,
  retireMethodVersion,
  setVersionContexts,
  setVersionDomains,
  updateMethodAsset,
  updateMethodVersion,
} from "@/domain/methodology/actions";
import {
  FORMS,
  IDENTITY_DISCLOSURE,
  IDENTITY_DISCLOSURES,
  METHOD_ASSET_FORMS,
  METHOD_MODES,
  ORIGIN,
} from "@/domain/methodology/catalog";
import { outputLabel } from "@/domain/methodology/labels";
import {
  getDevelopmentContexts,
  getMethodAsset,
  getMethodCategories,
  getMethodUsage,
  getMethodVersionStructure,
  getMyPracticeCapabilities,
  getPublishGaps,
  getUsableVersions,
} from "@/domain/methodology/queries";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import {
  AssetStatusTag,
  FormBadge,
  ReleaseChip,
  VersionTag,
} from "@/components/methodology/badges";
import { LibraryNav } from "@/components/methodology/library-nav";
import {
  GuidanceSection,
  HistorySection,
  RightsSection,
  StructureSection,
  UsageSection,
} from "@/components/methodology/asset-sections";
import { ActionButton, ActionForm, type FieldSpec } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

const TABS = [
  ["overview", "Overview"],
  ["structure", "Structure"],
  ["guidance", "Practitioner guidance"],
  ["history", "History"],
  ["usage", "Where used"],
  ["rights", "Rights"],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * One Method Asset (§29.2): its identity, its versions and the form-specific
 * structure of the chosen version. Drafts are edited here by
 * author_methodology holders and published by publish_methodology holders;
 * the database re-checks both and freezes every published version.
 */
export default async function MethodAssetPage({
  params,
  searchParams,
}: PageProps<"/internal/method-library/[assetId]">) {
  await requireInternal();
  const { assetId } = await params;
  if (!z.uuid().safeParse(assetId).success) notFound();
  const query = await searchParams;
  const detail = await getMethodAsset(assetId);
  if (!detail) notFound();
  const { asset, versions, rights } = detail;
  const [practice, categories, contexts, usage, usable] = await Promise.all([
    getMyPracticeCapabilities(),
    getMethodCategories(),
    getDevelopmentContexts(),
    getMethodUsage(asset.id),
    getUsableVersions(),
  ]);

  const draft = versions.find((v) => v.lifecycle === "draft");
  const requested = typeof query.version === "string" ? query.version : null;
  const version =
    versions.find((v) => v.id === requested) ??
    (practice.canAuthor && draft ? draft : undefined) ??
    versions.find((v) => v.id === asset.current_version_id) ??
    versions[0];
  const tab: Tab = TABS.some(([t]) => t === query.tab) ? (query.tab as Tab) : "overview";
  const structure = version ? await getMethodVersionStructure(version.id) : null;
  const editing =
    !!version && version.lifecycle === "draft" && practice.canAuthor && !version.legacy;
  const gaps = version?.lifecycle === "draft" ? await getPublishGaps(version.id) : [];
  const categoryLabel =
    categories.find((c) => c.key === asset.category_key)?.label ?? asset.category_key;
  const isMethod = asset.form === "method";
  const current = versions.find((v) => v.id === asset.current_version_id);
  const releases = usage.flatMap((u) => u.release_labels);
  const openOnCurrent = (usage.find((u) => u.version_id === asset.current_version_id)
    ?.applications ?? []) as {
    reference_code: string;
    title: string;
    state: string;
    engagement_title: string;
  }[];
  const href = (next: { tab?: Tab; version?: string }) => {
    const p = new URLSearchParams();
    p.set("tab", next.tab ?? tab);
    if (next.version ?? version?.id) p.set("version", (next.version ?? version?.id) as string);
    return `/internal/method-library/${asset.id}?${p.toString()}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Method Library · ${categoryLabel}`}
        title={asset.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <FormBadge form={asset.form} />
            {asset.status === "retired" ? <AssetStatusTag status={asset.status} /> : null}
            {asset.origin !== "tplco_developed" ? (
              <span className="text-xs tracking-wide text-ink-subtle uppercase">
                {ORIGIN[asset.origin]}
              </span>
            ) : null}
            {version ? (
              <span className="text-xs text-ink-subtle">
                {IDENTITY_DISCLOSURE[version.identity_disclosure]}
                {version.identity_disclosure === "may_be_named" && version.disclosable_name
                  ? `: “${version.disclosable_name}”`
                  : ""}
              </span>
            ) : null}
            {[...new Set(releases)].map((label) => (
              <ReleaseChip key={label} label={label} />
            ))}
          </span>
        }
        actions={
          <>
            {asset.status === "active" && !draft && practice.canAuthor ? (
              <ActionButton
                action={createMethodVersion.bind(null, asset.id)}
                label="Start a new draft"
              />
            ) : null}
            {asset.status === "active" && practice.canPublish && !draft ? (
              <ActionForm
                trigger="Retire asset"
                variant="danger"
                submitLabel="Retire"
                confirm="Retire this asset? It can no longer be applied, cited or put in a new release."
                action={retireMethodAsset.bind(null, asset.id)}
                fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
              />
            ) : null}
          </>
        }
      />
      <LibraryNav current="assets" />

      {asset.status === "legacy" ? (
        <Panel
          title="Legacy asset"
          description="Carried over from before Phase 6 with no form. It cannot be applied, cited or instantiated until it is adopted: adoption gives it a form and opens a first proper draft derived from the legacy version."
        >
          {practice.canPublish ? (
            <ActionForm
              trigger="Adopt this asset"
              submitLabel="Adopt"
              action={adoptLegacyMethodAsset.bind(null, asset.id)}
              fields={[
                {
                  name: "form",
                  label: "Form",
                  type: "select",
                  options: METHOD_ASSET_FORMS.map((f) => ({
                    value: f,
                    label: `${FORMS[f].label}: ${FORMS[f].verb}`,
                  })),
                },
                {
                  name: "categoryKey",
                  label: "Category",
                  type: "select",
                  options: categories
                    .filter((c) => c.active)
                    .map((c) => ({ value: c.key, label: c.label })),
                },
              ]}
              defaultValues={{ form: "model", categoryKey: asset.category_key }}
            />
          ) : (
            <p className="text-sm text-ink-muted">
              Adoption needs the publish methodology capability.
            </p>
          )}
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs tracking-wide text-ink-subtle uppercase">Version</span>
        {versions.map((v) => (
          <Link
            key={v.id}
            href={href({ version: v.id })}
            aria-current={v.id === version?.id ? "true" : undefined}
            className={cn(
              "rounded-sm border px-2 py-1",
              v.id === version?.id
                ? "border-accent text-ink"
                : "border-rule text-ink-muted hover:text-ink",
            )}
          >
            {v.version_label ?? "Draft"}{" "}
            <span className="text-[11px] uppercase">{v.lifecycle}</span>
          </Link>
        ))}
      </div>

      <nav className="flex flex-wrap gap-x-1 border-b border-rule text-sm" aria-label="Asset">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={href({ tab: key })}
            aria-current={key === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2",
              key === tab
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {!version || !structure ? (
        <Panel>
          <p className="text-sm text-ink-muted">This asset has no versions.</p>
        </Panel>
      ) : tab === "overview" ? (
        <>
          {version.lifecycle === "draft" ? (
            <Panel
              title="Before this draft can be published"
              description={FORMS[asset.form ?? "method"]?.behavior}
              actions={<VersionTag lifecycle="draft" />}
            >
              {gaps.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
                  {gaps.map((g) => (
                    <li key={g}>Add {g}.</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-positive">
                  Everything the {asset.form ?? "asset"} form requires is in place.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {practice.canPublish && gaps.length === 0 ? (
                  <div className="w-full space-y-2">
                    <p className="text-sm text-ink-muted">
                      {current
                        ? `Publishing supersedes version ${current.version_label}. ${
                            openOnCurrent.filter(
                              (a) => a.state === "planned" || a.state === "in_progress",
                            ).length
                          } open application(s) stay pinned to it.`
                        : "This will be the asset's first published version."}
                    </p>
                    <ActionForm
                      trigger="Publish this version"
                      submitLabel="Publish"
                      confirm="Publish this version? It becomes immutable."
                      action={publishMethodVersion.bind(null, version.id)}
                      fields={[
                        { name: "versionLabel", label: "Version label", hint: "e.g. 1.0 or 2.1" },
                        { name: "effectiveOn", label: "Effective on", type: "date" },
                        { name: "changeSummary", label: "Change summary", type: "textarea" },
                      ]}
                      defaultValues={{ changeSummary: version.change_summary }}
                    />
                  </div>
                ) : null}
                {practice.canAuthor ? (
                  <ActionButton
                    action={deleteMethodVersion.bind(null, version.id)}
                    label="Delete draft"
                    variant="ghost"
                    confirm="Delete this draft? Its content is discarded."
                  />
                ) : null}
              </div>
            </Panel>
          ) : null}

          <Panel title="Overview" actions={<VersionTag lifecycle={version.lifecycle} />}>
            <DetailList
              items={[
                { label: "Architectural question", value: version.architectural_question },
                { label: "Summary", value: version.summary },
                { label: "Applicability", value: version.applicability },
                { label: "Exclusions", value: version.exclusions },
                { label: "Expected inputs", value: version.expected_inputs },
                { label: "Evidence expectations", value: version.evidence_expectations },
                {
                  label: "Domains",
                  value: structure.domains.map((d) => DOMAIN_SHORT_LABELS[d]).join(", "),
                },
                {
                  label: "Development Contexts",
                  value: structure.contexts.map((c) => c.development_contexts?.label).join(", "),
                },
                ...(asset.form === "method" || asset.form === "model"
                  ? [
                      {
                        label: asset.form === "model" ? "Applied into" : "Expected outputs",
                        value: structure.outputs.map((o) => outputLabel(o)).join(", "),
                      },
                    ]
                  : []),
                ...(isMethod ? [{ label: "Modes", value: version.modes.join(", ") }] : []),
                { label: "Usage restriction", value: asset.usage_restriction },
                { label: "Change summary", value: version.change_summary },
                { label: "Effective", value: formatDate(version.effective_on) },
              ]}
            />
          </Panel>

          {editing ? (
            <Panel
              title="Edit this draft"
              description="Saved as you go; nothing is published until a publisher publishes it."
            >
              <div className="space-y-6">
                <ActionForm
                  submitLabel="Save content"
                  action={updateMethodVersion.bind(null, version.id, isMethod)}
                  fields={[
                    {
                      name: "architecturalQuestion",
                      label: "Architectural question",
                      type: "textarea",
                    },
                    { name: "summary", label: "Summary", type: "textarea" },
                    { name: "applicability", label: "Applicability", type: "textarea" },
                    { name: "exclusions", label: "Exclusions", type: "textarea" },
                    { name: "expectedInputs", label: "Expected inputs", type: "textarea" },
                    {
                      name: "evidenceExpectations",
                      label: "Evidence expectations",
                      type: "textarea",
                    },
                    ...(isMethod
                      ? ([
                          {
                            name: "modes",
                            label: "Modes",
                            type: "checkboxes",
                            options: METHOD_MODES.map((m) => ({
                              value: m,
                              label: m[0]!.toUpperCase() + m.slice(1),
                            })),
                          },
                          { name: "prerequisites", label: "Prerequisites", type: "textarea" },
                          {
                            name: "practitionerRoles",
                            label: "Practitioner roles",
                            type: "textarea",
                          },
                          {
                            name: "completionCriteria",
                            label: "Completion criteria",
                            type: "textarea",
                          },
                          {
                            name: "completionStandardVersionId",
                            label: "Completion judged against (Standard)",
                            type: "select",
                            options: [
                              { value: "", label: "None" },
                              ...usable
                                .filter((u) => u.asset.form === "standard")
                                .map((u) => ({
                                  value: u.version.id,
                                  label: `${u.asset.title} ${u.version.version_label ?? ""}`,
                                })),
                            ],
                          },
                          {
                            name: "reviewImplications",
                            label: "Review implications",
                            type: "textarea",
                          },
                          {
                            name: "implementationImplications",
                            label: "Implementation implications",
                            type: "textarea",
                          },
                        ] satisfies FieldSpec[])
                      : []),
                    {
                      name: "practitionerInstructions",
                      label: "Practitioner instructions (protected)",
                      type: "textarea",
                    },
                    { name: "internalNotes", label: "Internal notes", type: "textarea" },
                    {
                      name: "identityDisclosure",
                      label: "Client naming",
                      type: "select",
                      options: IDENTITY_DISCLOSURES.map((d) => ({
                        value: d,
                        label: IDENTITY_DISCLOSURE[d],
                      })),
                    },
                    {
                      name: "disclosableName",
                      label: "Approved name for approach statements",
                      hint: "Used only when an architect writes it",
                    },
                    { name: "externalBasis", label: "External basis", type: "textarea" },
                    { name: "changeSummary", label: "Change summary", type: "textarea" },
                  ]}
                  defaultValues={{
                    architecturalQuestion: version.architectural_question,
                    summary: version.summary,
                    applicability: version.applicability,
                    exclusions: version.exclusions,
                    expectedInputs: version.expected_inputs,
                    evidenceExpectations: version.evidence_expectations,
                    modes: version.modes,
                    prerequisites: version.prerequisites,
                    practitionerRoles: version.practitioner_roles,
                    completionCriteria: version.completion_criteria,
                    completionStandardVersionId: version.completion_standard_version_id ?? "",
                    reviewImplications: version.review_implications,
                    implementationImplications: version.implementation_implications,
                    practitionerInstructions: version.practitioner_instructions,
                    internalNotes: version.internal_notes,
                    identityDisclosure: version.identity_disclosure,
                    disclosableName: version.disclosable_name ?? "",
                    externalBasis: version.external_basis,
                    changeSummary: version.change_summary,
                  }}
                />
                <ActionForm
                  submitLabel="Save domains"
                  action={setVersionDomains.bind(null, version.id)}
                  fields={[
                    {
                      name: "domains",
                      label: "Architecture domains",
                      type: "checkboxes",
                      options: DOMAINS.map((d) => ({ value: d, label: DOMAIN_SHORT_LABELS[d] })),
                      wide: true,
                    },
                  ]}
                  defaultValues={{ domains: structure.domains }}
                />
                <ActionForm
                  submitLabel="Save contexts"
                  action={setVersionContexts.bind(null, version.id)}
                  fields={[
                    {
                      name: "contextIds",
                      label: "Development Contexts it applies to",
                      type: "checkboxes",
                      options: contexts
                        .filter((c) => c.status === "active")
                        .map((c) => ({ value: c.id, label: c.label })),
                      wide: true,
                      hint:
                        contexts.length === 0
                          ? "No Development Contexts are defined yet."
                          : undefined,
                    },
                  ]}
                  defaultValues={{ contextIds: structure.contexts.map((c) => c.context_id) }}
                />
              </div>
            </Panel>
          ) : null}

          {asset.status === "active" && practice.canAuthor ? (
            <Panel title="Asset details">
              <ActionForm
                trigger="Edit asset details"
                submitLabel="Save"
                action={updateMethodAsset.bind(null, asset.id, asset.steward_user_id)}
                fields={[
                  { name: "title", label: "Title", wide: true },
                  {
                    name: "categoryKey",
                    label: "Category",
                    type: "select",
                    options: categories
                      .filter((c) => c.active)
                      .map((c) => ({ value: c.key, label: c.label })),
                  },
                  { name: "usageRestriction", label: "Usage restriction", type: "textarea" },
                ]}
                defaultValues={{
                  title: asset.title,
                  categoryKey: asset.category_key,
                  usageRestriction: asset.usage_restriction ?? "",
                }}
              />
            </Panel>
          ) : null}

          {version.lifecycle === "published" && practice.canPublish ? (
            <ActionForm
              trigger="Retire this version"
              variant="danger"
              submitLabel="Retire version"
              confirm="Retire this version? It can no longer be applied or cited."
              action={retireMethodVersion.bind(null, version.id)}
              fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
            />
          ) : null}
        </>
      ) : tab === "structure" ? (
        <StructureSection
          form={asset.form}
          assetId={asset.id}
          version={version}
          structure={structure}
          editing={editing}
          usable={usable}
        />
      ) : tab === "guidance" ? (
        <GuidanceSection
          form={asset.form}
          version={version}
          structure={structure}
          editing={editing}
        />
      ) : tab === "history" ? (
        <HistorySection
          assetId={asset.id}
          versions={versions}
          version={version}
          structure={structure}
          editing={editing}
        />
      ) : tab === "usage" ? (
        <UsageSection usage={usage} />
      ) : (
        <RightsSection asset={asset} rights={rights} canPublish={practice.canPublish} />
      )}
    </div>
  );
}
