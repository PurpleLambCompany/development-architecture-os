import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ApproachGuidance } from "./approach";

/**
 * Method Library and practice reads. Every query runs as the signed-in user:
 * the read models return nothing to a client, and RLS limits the
 * engagement-scoped ones to internal readers of that engagement. The two
 * client read models return only the release label and title, and agreed
 * acceptance criteria (never the informing Standard).
 */

type Fn = Database["public"]["Functions"];

export type MethodLibraryRow = Fn["method_library"]["Returns"][number];
export type MethodUsageRow = Fn["method_usage"]["Returns"][number];
export type MethodApplicationRegisterRow = Fn["method_application_register"]["Returns"][number];
export type ElementPracticeRow = Fn["element_practice_context"]["Returns"][number];
export type ClientEngagementMethodology = Fn["client_engagement_methodology"]["Returns"][number];
export type ClientAcceptanceCriterionRow = Fn["client_acceptance_criteria"]["Returns"][number];

/**
 * Approved names and internal-only titles for approach statements on one
 * element (§17.2): approved names come from assets linked to the element
 * through applications or lineage; every internal-only current asset title is
 * checked against client-visible text.
 */
export const getApproachGuidance = cache(async (elementId: string): Promise<ApproachGuidance> => {
  const [rows, usable] = await Promise.all([
    getElementPracticeContext(elementId),
    getUsableVersions(),
  ]);
  const versionIds = [...new Set(rows.map((r) => r.version_id).filter(Boolean))];
  const supabase = await createSupabaseServerClient();
  const { data, error } = versionIds.length
    ? await supabase
        .from("method_asset_versions")
        .select(
          "id, identity_disclosure, disclosable_name, method_assets!method_asset_versions_asset_id_fkey(title)",
        )
        .in("id", versionIds)
    : { data: [], error: null };
  if (error) throw error;
  const linked = data ?? [];
  const approved = linked
    .filter((v) => v.identity_disclosure === "may_be_named" && v.disclosable_name)
    .map((v) => ({ assetTitle: v.method_assets?.title ?? "", name: v.disclosable_name! }));
  const internalTitles = [
    ...usable
      .filter((u) => u.version.identity_disclosure === "internal_only")
      .map((u) => u.asset.title),
    ...linked
      .filter((v) => v.identity_disclosure === "internal_only")
      .map((v) => v.method_assets?.title ?? ""),
  ].filter(Boolean);
  return {
    approved: approved.filter((a, i) => approved.findIndex((b) => b.name === a.name) === i),
    internalTitles: [...new Set(internalTitles)],
  };
});

/** The deliverable type each Template version produces, by version id. */
export const getTemplateDeliverableTypes = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("template_version_specs")
    .select("version_id, deliverable_type");
  if (error) throw error;
  return new Map<string, string>((data ?? []).map((t) => [t.version_id, t.deliverable_type]));
});

export const getMethodLibrary = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("method_library");
  if (error) throw error;
  return data ?? [];
});

export const getMethodUsage = cache(async (assetId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("method_usage", { p_asset_id: assetId });
  if (error) throw error;
  return data ?? [];
});

export const getMethodApplicationRegister = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("method_application_register", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
});

export const getElementPracticeContext = cache(async (elementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("element_practice_context", {
    p_element_id: elementId,
  });
  if (error) throw error;
  return data ?? [];
});

export const getClientEngagementMethodology = cache(
  async (engagementId: string): Promise<ClientEngagementMethodology | null> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("client_engagement_methodology", {
      p_engagement_id: engagementId,
    });
    if (error) throw error;
    return data?.[0] ?? null;
  },
);

export const getClientAcceptanceCriteria = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_acceptance_criteria", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
});

// -----------------------------------------------------------------------------
// Practice authority
// -----------------------------------------------------------------------------

/** The viewer's practice capabilities; the database checks them again on every write. */
export const getMyPracticeCapabilities = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_practice_capabilities");
  if (error) throw error;
  const held = new Set(data ?? []);
  return {
    canAuthor: held.has("author_methodology"),
    canPublish: held.has("publish_methodology"),
  };
});

export const getPracticeCapabilityMatrix = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("practice_capability_matrix");
  if (error) throw error;
  return data ?? [];
});

// -----------------------------------------------------------------------------
// Library
// -----------------------------------------------------------------------------

export const getMethodCategories = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("method_asset_categories")
    .select("key, label, description, active, sort_order")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
});

export const getMethodAsset = cache(async (assetId: string) => {
  const supabase = await createSupabaseServerClient();
  const [asset, versions, rights] = await Promise.all([
    supabase.from("method_assets").select("*").eq("id", assetId).maybeSingle(),
    supabase
      .from("method_asset_versions")
      .select("*")
      .eq("asset_id", assetId)
      .order("version_no", { ascending: false }),
    supabase
      .from("method_asset_rights_holders")
      .select("*, organizations(id, name)")
      .eq("asset_id", assetId)
      .order("recorded_at"),
  ]);
  if (asset.error) throw asset.error;
  if (versions.error) throw versions.error;
  if (rights.error) throw rights.error;
  if (!asset.data) return null;
  return { asset: asset.data, versions: versions.data ?? [], rights: rights.data ?? [] };
});

export type MethodAssetDetail = NonNullable<Awaited<ReturnType<typeof getMethodAsset>>>;
export type MethodVersionRow = MethodAssetDetail["versions"][number];

/** A version's form-specific structure and its links. */
export const getMethodVersionStructure = cache(async (versionId: string) => {
  const supabase = await createSupabaseServerClient();
  const [
    domains,
    stages,
    outputs,
    components,
    criteria,
    judgedIn,
    evidenceTypes,
    spec,
    sections,
    files,
    contexts,
    learning,
  ] = await Promise.all([
    supabase.from("method_version_domains").select("domain").eq("version_id", versionId),
    supabase.from("method_version_stages").select("*").eq("version_id", versionId).order("ordinal"),
    supabase
      .from("method_version_outputs")
      .select("*")
      .eq("version_id", versionId)
      .order("ordinal"),
    supabase
      .from("method_version_components")
      .select(
        "*, method_asset_versions!method_version_components_component_version_id_fkey(id, version_label, lifecycle, asset_id, method_assets!method_asset_versions_asset_id_fkey(id, title, form, status))",
      )
      .eq("version_id", versionId),
    supabase
      .from("standard_version_criteria")
      .select("*")
      .eq("version_id", versionId)
      .order("ordinal"),
    supabase.from("standard_version_judged_in").select("setting").eq("version_id", versionId),
    supabase
      .from("instrument_version_evidence_types")
      .select("evidence_source_type")
      .eq("version_id", versionId),
    supabase
      .from("template_version_specs")
      .select("deliverable_type")
      .eq("version_id", versionId)
      .maybeSingle(),
    supabase
      .from("template_version_sections")
      .select("*")
      .eq("version_id", versionId)
      .order("ordinal"),
    supabase
      .from("method_version_files")
      .select("*")
      .eq("version_id", versionId)
      .order("created_at"),
    supabase
      .from("method_version_contexts")
      .select("context_id, development_contexts(id, key, label, status)")
      .eq("version_id", versionId),
    supabase
      .from("method_version_learning_sources")
      .select("*, method_applications(id, reference_code, title, state, engagement_id)")
      .eq("version_id", versionId),
  ]);
  for (const r of [
    domains,
    stages,
    outputs,
    components,
    criteria,
    judgedIn,
    evidenceTypes,
    spec,
    sections,
    files,
    contexts,
    learning,
  ]) {
    if (r.error) throw r.error;
  }
  return {
    domains: (domains.data ?? []).map((d) => d.domain),
    stages: stages.data ?? [],
    outputs: outputs.data ?? [],
    components: components.data ?? [],
    criteria: criteria.data ?? [],
    judgedIn: (judgedIn.data ?? []).map((j) => j.setting),
    evidenceTypes: (evidenceTypes.data ?? []).map((e) => e.evidence_source_type),
    deliverableType: spec.data?.deliverable_type ?? null,
    sections: sections.data ?? [],
    files: files.data ?? [],
    contexts: contexts.data ?? [],
    learning: learning.data ?? [],
  };
});

export type MethodVersionStructure = Awaited<ReturnType<typeof getMethodVersionStructure>>;

export const getPublishGaps = cache(async (versionId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("method_version_publish_gaps", {
    p_version_id: versionId,
  });
  if (error) throw error;
  return data ?? [];
});

/**
 * Current published versions of active assets: what can be applied, cited,
 * instantiated or put in a release. Optionally one form.
 */
export const getUsableVersions = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("method_assets")
    .select(
      "id, key, title, form, status, usage_restriction, method_asset_versions!method_assets_current_version_fk(id, version_label, lifecycle, legacy, applicability, exclusions, architectural_question, identity_disclosure, disclosable_name)",
    )
    .eq("status", "active")
    .order("title");
  if (error) throw error;
  return (data ?? []).flatMap((a) => {
    const v = a.method_asset_versions;
    if (!a.form || !v || v.lifecycle !== "published" || v.legacy) return [];
    return [{ asset: { ...a, form: a.form }, version: v }];
  });
});

/** Criteria of current published Standards, for "informed by" on an acceptance criterion. */
export const getStandardCriterionOptions = cache(async () => {
  const standards = (await getUsableVersions()).filter((u) => u.asset.form === "standard");
  if (standards.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("standard_version_criteria")
    .select("version_id, key, statement, ordinal")
    .in(
      "version_id",
      standards.map((s) => s.version.id),
    )
    .order("ordinal");
  if (error) throw error;
  return standards.flatMap((s) =>
    (data ?? [])
      .filter((c) => c.version_id === s.version.id)
      .map((c) => ({
        value: `${c.version_id}:${c.key}`,
        label: `${s.asset.title} ${s.version.version_label ?? ""} · ${c.statement}`,
      })),
  );
});

export type UsableVersion = Awaited<ReturnType<typeof getUsableVersions>>[number];

// -----------------------------------------------------------------------------
// Releases and contexts
// -----------------------------------------------------------------------------

export const getDamReleases = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const [releases, engagements] = await Promise.all([
    supabase.from("dam_releases").select("*").order("created_at", { ascending: false }),
    supabase.from("engagements").select("id, title, slug, status, dam_release_id"),
  ]);
  if (releases.error) throw releases.error;
  if (engagements.error) throw engagements.error;
  return (releases.data ?? []).map((r) => ({
    ...r,
    engagements: (engagements.data ?? []).filter((e) => e.dam_release_id === r.id),
  }));
});

export type DamReleaseRow = Awaited<ReturnType<typeof getDamReleases>>[number];

export const getDamReleaseMembers = cache(async (releaseId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dam_release_members")
    .select(
      "release_id, asset_id, asset_version_id, method_assets(id, title, form, status, current_version_id), method_asset_versions(id, version_label, lifecycle, legacy)",
    )
    .eq("release_id", releaseId);
  if (error) throw error;
  return data ?? [];
});

export const getDevelopmentContexts = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("development_contexts")
    .select("*, development_context_revisions(*)")
    .order("label");
  if (error) throw error;
  return data ?? [];
});

export const getEngagementPractice = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const [engagement, contexts] = await Promise.all([
    supabase
      .from("engagements")
      .select(
        "id, dam_release_id, methodology_version, dam_releases(id, version_label, title, status)",
      )
      .eq("id", engagementId)
      .single(),
    supabase
      .from("engagement_development_contexts")
      .select("context_id, is_primary, development_contexts(id, key, label, definition, status)")
      .eq("engagement_id", engagementId),
  ]);
  if (engagement.error) throw engagement.error;
  if (contexts.error) throw contexts.error;
  return { release: engagement.data.dam_releases, contexts: contexts.data ?? [] };
});

// -----------------------------------------------------------------------------
// Method Applications
// -----------------------------------------------------------------------------

export const getMethodApplication = cache(async (applicationId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data: app, error } = await supabase
    .from("method_applications")
    .select(
      "*, method_asset_versions!method_applications_method_asset_version_id_fkey(id, version_label, asset_id, completion_criteria, practitioner_instructions, method_assets!method_asset_versions_asset_id_fkey(id, title, form)), dam_releases(id, version_label, title)",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw error;
  if (!app) return null;
  const versionId = app.method_asset_version_id;
  const [
    practitioners,
    contexts,
    domains,
    notes,
    elements,
    evidence,
    assets,
    addenda,
    stages,
    outputs,
    components,
  ] = await Promise.all([
    supabase.from("method_application_practitioners").select("*").eq("application_id", app.id),
    supabase
      .from("method_application_contexts")
      .select("context_id, development_contexts(id, label)")
      .eq("application_id", app.id),
    supabase.from("method_application_domains").select("domain").eq("application_id", app.id),
    supabase.from("method_application_stage_notes").select("*").eq("application_id", app.id),
    supabase
      .from("method_application_elements")
      .select("*")
      .eq("application_id", app.id)
      .order("created_at"),
    supabase
      .from("method_application_evidence")
      .select("*, evidence_sources(id, title, source_type)")
      .eq("application_id", app.id)
      .order("created_at"),
    supabase
      .from("method_application_assets")
      .select(
        "*, method_asset_versions(id, version_label, method_assets!method_asset_versions_asset_id_fkey(id, title, form))",
      )
      .eq("application_id", app.id),
    supabase
      .from("method_application_addenda")
      .select("*")
      .eq("application_id", app.id)
      .order("created_at"),
    supabase.from("method_version_stages").select("*").eq("version_id", versionId).order("ordinal"),
    supabase
      .from("method_version_outputs")
      .select("*")
      .eq("version_id", versionId)
      .order("ordinal"),
    supabase
      .from("method_version_components")
      .select(
        "component_version_id, note, method_asset_versions!method_version_components_component_version_id_fkey(id, version_label, method_assets!method_asset_versions_asset_id_fkey(id, title, form))",
      )
      .eq("version_id", versionId),
  ]);
  for (const r of [
    practitioners,
    contexts,
    domains,
    notes,
    elements,
    evidence,
    assets,
    addenda,
    stages,
    outputs,
    components,
  ]) {
    if (r.error) throw r.error;
  }
  return {
    app,
    practitioners: practitioners.data ?? [],
    contexts: contexts.data ?? [],
    domains: (domains.data ?? []).map((d) => d.domain),
    notes: notes.data ?? [],
    elements: elements.data ?? [],
    evidence: evidence.data ?? [],
    assets: assets.data ?? [],
    addenda: addenda.data ?? [],
    stages: stages.data ?? [],
    outputs: outputs.data ?? [],
    declaredComponents: components.data ?? [],
  };
});

/** Deliverable types on one engagement, for comparing produced outputs with expected ones. */
export const getDeliverableTypes = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("deliverables")
    .select("element_id, deliverable_type")
    .eq("engagement_id", engagementId);
  if (error) throw error;
  return new Map((data ?? []).map((d) => [d.element_id, d.deliverable_type]));
});

export type MethodApplicationDetail = NonNullable<Awaited<ReturnType<typeof getMethodApplication>>>;

/** Closed applications of a Method asset (any engagement the viewer reads), for learning sources. */
export const getClosedApplicationsOfAsset = cache(async (assetId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("method_applications")
    .select(
      "id, reference_code, title, state, engagements(title), method_asset_versions!method_applications_method_asset_version_id_fkey!inner(asset_id)",
    )
    .eq("method_asset_versions.asset_id", assetId)
    .in("state", ["completed", "discontinued"]);
  if (error) throw error;
  return data ?? [];
});

// -----------------------------------------------------------------------------
// Acceptance criteria
// -----------------------------------------------------------------------------

export const getElementCriteria = cache(async (elementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("acceptance_criteria")
    .select(
      "*, method_asset_versions(id, version_label, method_assets!method_asset_versions_asset_id_fkey(title))",
    )
    .eq("governed_element_id", elementId)
    .order("reference_code");
  if (error) throw error;
  return data ?? [];
});

export type CriterionRow = Awaited<ReturnType<typeof getElementCriteria>>[number];

export const getCriteriaInForce = cache(async (initiativeElementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("criteria_in_force", {
    p_initiative_element_id: initiativeElementId,
  });
  if (error) throw error;
  return data ?? [];
});

/** Criteria captured by each validation relationship. */
export const getValidationCriteria = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("validation_criteria")
    .select("*, acceptance_criteria(id, reference_code, body, state)")
    .eq("engagement_id", engagementId);
  if (error) throw error;
  return data ?? [];
});
