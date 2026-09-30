"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireInternal } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import {
  addendumSchema,
  adoptLegacySchema,
  agreeCriterionSchema,
  applicationAssetSchema,
  completeApplicationSchema,
  componentsSchema,
  contextsSchema,
  createAssetSchema,
  createContextSchema,
  createReleaseSchema,
  domainsSchema,
  engagementContextsSchema,
  engagementReleaseSchema,
  evidenceTypesSchema,
  fileSchema,
  judgedInSchema,
  learningSourceSchema,
  linkElementSchema,
  linkEvidenceSchema,
  originSchema,
  outputsSchema,
  practiceOverrideSchema,
  practitionersSchema,
  proposeCriterionSchema,
  publishReleaseSchema,
  publishVersionSchema,
  reasonSchema,
  releaseMemberSchema,
  reviseContextSchema,
  rightsHolderSchema,
  stageNoteSchema,
  startApplicationSchema,
  structureTextSchema,
  supersedeCriterionSchema,
  templateSpecSchema,
  toVersionContent,
  updateApplicationSchema,
  updateAssetSchema,
  updateReleaseSchema,
  validationNoteSchema,
  versionContentSchema,
} from "./schemas";
import { METHOD_LIBRARY_BUCKET } from "./files";
import { parseCriteria, parseOutputs, parseSections, parseStages } from "./structure";

/**
 * Method Library and practice server actions. Each validates its input for
 * clear messages and calls one database operation as the signed-in user; the
 * operation checks practice or engagement capabilities and every rule again.
 * No Method Library or practice table has a write grant: the operations
 * below are the only way in, and none is reachable by a client.
 */

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Work<T> = { data?: T | null; error: PostgrestError | null };

const empty = z.object({});

function refresh() {
  revalidatePath("/internal", "layout");
  revalidatePath("/portal", "layout");
}

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  work: (supabase: Supabase, data: z.output<S>) => PromiseLike<Work<T>>,
): Promise<ActionResult<T | undefined>> {
  await requireInternal();
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await work(supabase, parsed.data);
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(data ?? undefined);
}

// Method Assets -----------------------------------------------------------------------

export async function createMethodAsset(input: unknown) {
  return run(createAssetSchema, input, (supabase, v) =>
    supabase.rpc("create_method_asset", {
      p_key: v.key,
      p_title: v.title,
      p_form: v.form,
      p_category_key: v.categoryKey,
      p_origin: v.origin,
    }),
  );
}

/** Creates the asset and opens its page on its first draft. */
export async function createMethodAssetAndOpen(input: unknown) {
  const result = await createMethodAsset(input);
  if (result.ok && result.data) redirect(`/internal/method-library/${result.data}`);
  return result;
}

/** The steward stays as recorded; it is set when the asset is created. */
export async function updateMethodAsset(
  assetId: string,
  stewardUserId: string | null,
  input: unknown,
) {
  return run(updateAssetSchema, input, (supabase, v) =>
    supabase.rpc("update_method_asset", {
      p_asset_id: assetId,
      p_title: v.title,
      p_category_key: v.categoryKey,
      p_steward_user_id: stewardUserId as string,
      p_usage_restriction: v.usageRestriction,
    }),
  );
}

export async function adoptLegacyMethodAsset(assetId: string, input: unknown) {
  return run(adoptLegacySchema, input, (supabase, v) =>
    supabase.rpc("adopt_legacy_method_asset", {
      p_asset_id: assetId,
      p_form: v.form,
      p_category_key: v.categoryKey,
    }),
  );
}

export async function retireMethodAsset(assetId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("retire_method_asset", { p_asset_id: assetId, p_reason: v.reason }),
  );
}

export async function setMethodAssetOrigin(assetId: string, input: unknown) {
  return run(originSchema, input, (supabase, v) =>
    supabase.rpc("set_method_asset_origin", {
      p_asset_id: assetId,
      p_origin: v.origin,
      p_reason: v.reason,
    }),
  );
}

export async function recordRightsHolder(assetId: string, input: unknown) {
  return run(rightsHolderSchema, input, (supabase, v) =>
    supabase.rpc("record_method_rights_holder", {
      p_asset_id: assetId,
      p_organization_id: (v.organizationId ?? null) as string,
      p_external_holder_name: v.externalHolderName || (null as unknown as string),
      p_holder_role: v.holderRole,
      p_agreement_reference: v.agreementReference,
      ...(v.effectiveOn ? { p_effective_on: v.effectiveOn } : {}),
      p_note: v.note,
    }),
  );
}

export async function supersedeRightsHolder(rightsHolderId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("supersede_method_rights_holder", {
      p_rights_holder_id: rightsHolderId,
      p_reason: v.reason,
    }),
  );
}

// Versions ----------------------------------------------------------------------------

export async function createMethodVersion(assetId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("create_method_asset_version", { p_asset_id: assetId }),
  );
}

export async function updateMethodVersion(versionId: string, isMethod: boolean, input: unknown) {
  return run(versionContentSchema, input, (supabase, v) =>
    supabase.rpc("update_method_asset_version", {
      p_version_id: versionId,
      p_content: toVersionContent(v, isMethod) as unknown as Json,
    }),
  );
}

export async function setVersionDomains(versionId: string, input: unknown) {
  return run(domainsSchema, input, (supabase, v) =>
    supabase.rpc("set_method_version_domains", { p_version_id: versionId, p_domains: v.domains }),
  );
}

export async function setVersionContexts(versionId: string, input: unknown) {
  return run(contextsSchema, input, (supabase, v) =>
    supabase.rpc("set_method_version_contexts", {
      p_version_id: versionId,
      p_context_ids: v.contextIds,
    }),
  );
}

export async function setVersionStages(versionId: string, input: unknown) {
  return run(structureTextSchema, input, (supabase, v) =>
    supabase.rpc("set_method_version_stages", {
      p_version_id: versionId,
      p_stages: parseStages(v.text) as unknown as Json,
    }),
  );
}

export async function setVersionOutputs(versionId: string, input: unknown) {
  return run(outputsSchema, input, (supabase, v) =>
    supabase.rpc("set_method_version_outputs", {
      p_version_id: versionId,
      p_outputs: parseOutputs(v.outputs) as unknown as Json,
    }),
  );
}

export async function setVersionComponents(versionId: string, input: unknown) {
  return run(componentsSchema, input, (supabase, v) =>
    supabase.rpc("set_method_version_components", {
      p_version_id: versionId,
      p_components: v.componentVersionIds.map((id) => ({ component_version_id: id })),
    }),
  );
}

export async function setStandardCriteria(versionId: string, input: unknown) {
  return run(structureTextSchema, input, (supabase, v) =>
    supabase.rpc("set_standard_version_criteria", {
      p_version_id: versionId,
      p_criteria: parseCriteria(v.text) as unknown as Json,
    }),
  );
}

export async function setStandardJudgedIn(versionId: string, input: unknown) {
  return run(judgedInSchema, input, (supabase, v) =>
    supabase.rpc("set_standard_version_judged_in", {
      p_version_id: versionId,
      p_settings: v.settings,
    }),
  );
}

export async function setInstrumentEvidenceTypes(versionId: string, input: unknown) {
  return run(evidenceTypesSchema, input, (supabase, v) =>
    supabase.rpc("set_instrument_version_evidence_types", {
      p_version_id: versionId,
      p_types: v.types,
    }),
  );
}

export async function setTemplateSpec(versionId: string, input: unknown) {
  return run(templateSpecSchema, input, (supabase, v) =>
    supabase.rpc("set_template_version_spec", {
      p_version_id: versionId,
      p_deliverable_type: v.deliverableType,
      p_sections: parseSections(v.sections) as unknown as Json,
    }),
  );
}

export async function deleteMethodVersion(versionId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("delete_method_asset_version", { p_version_id: versionId }),
  );
}

export async function publishMethodVersion(versionId: string, input: unknown) {
  return run(publishVersionSchema, input, (supabase, v) =>
    supabase.rpc("publish_method_asset_version", {
      p_version_id: versionId,
      p_version_label: v.versionLabel,
      p_change_summary: v.changeSummary,
      ...(v.effectiveOn ? { p_effective_on: v.effectiveOn } : {}),
    }),
  );
}

export async function retireMethodVersion(versionId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("retire_method_asset_version", { p_version_id: versionId, p_reason: v.reason }),
  );
}

export async function addLearningSource(versionId: string, input: unknown) {
  return run(learningSourceSchema, input, (supabase, v) =>
    supabase.rpc("add_method_version_learning_source", {
      p_version_id: versionId,
      p_application_id: v.applicationId,
      p_note: v.note,
    }),
  );
}

export async function removeLearningSource(versionId: string, applicationId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("remove_method_version_learning_source", {
      p_version_id: versionId,
      p_application_id: applicationId,
    }),
  );
}

/**
 * Registers a protected file on a draft version and returns a signed upload
 * URL for the path the operation issued. The bucket has no client policy.
 */
export async function prepareMethodFileUpload(versionId: string, input: unknown) {
  return run(fileSchema, input, async (supabase, v) => {
    const registered = await supabase.rpc("attach_method_version_file", {
      p_version_id: versionId,
      p_file_name: v.fileName,
      p_content_type: v.contentType,
      p_size_bytes: v.sizeBytes,
    });
    if (registered.error || !registered.data) return { error: registered.error };
    const signed = await supabase.storage
      .from(METHOD_LIBRARY_BUCKET)
      .createSignedUploadUrl(registered.data);
    if (signed.error) {
      return {
        error: {
          code: "42501",
          message: signed.error.message,
          details: "",
          hint: "",
          name: "StorageError",
        } as PostgrestError,
      };
    }
    return { data: { path: registered.data, token: signed.data.token }, error: null };
  });
}

export async function removeMethodFile(fileId: string) {
  return run(empty, {}, async (supabase) => {
    const removed = await supabase.rpc("remove_method_version_file", { p_file_id: fileId });
    if (removed.error) return { error: removed.error };
    if (removed.data) await supabase.storage.from(METHOD_LIBRARY_BUCKET).remove([removed.data]);
    return { data: null, error: null };
  });
}

// DAM releases ------------------------------------------------------------------------

export async function createDamRelease(input: unknown) {
  return run(createReleaseSchema, input, (supabase, v) =>
    supabase.rpc("create_dam_release", {
      p_version_label: v.versionLabel,
      p_title: v.title,
      p_summary: v.summary,
    }),
  );
}

export async function createDamReleaseAndOpen(input: unknown) {
  const result = await createDamRelease(input);
  if (result.ok && result.data) redirect(`/internal/method-library/releases/${result.data}`);
  return result;
}

export async function updateDamRelease(releaseId: string, input: unknown) {
  return run(updateReleaseSchema, input, (supabase, v) =>
    supabase.rpc("update_dam_release", {
      p_release_id: releaseId,
      p_title: v.title,
      p_summary: v.summary,
      p_change_summary: v.changeSummary,
    }),
  );
}

export async function setDamReleaseMember(releaseId: string, input: unknown) {
  return run(releaseMemberSchema, input, (supabase, v) =>
    supabase.rpc("set_dam_release_member", {
      p_release_id: releaseId,
      p_asset_version_id: v.versionId,
    }),
  );
}

export async function removeDamReleaseMember(releaseId: string, assetId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("remove_dam_release_member", { p_release_id: releaseId, p_asset_id: assetId }),
  );
}

export async function deleteDamRelease(releaseId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("delete_dam_release", { p_release_id: releaseId }),
  );
}

export async function publishDamRelease(releaseId: string, input: unknown) {
  return run(publishReleaseSchema, input, (supabase, v) =>
    supabase.rpc("publish_dam_release", {
      p_release_id: releaseId,
      p_change_summary: v.changeSummary,
      ...(v.effectiveOn ? { p_effective_on: v.effectiveOn } : {}),
    }),
  );
}

export async function retireDamRelease(releaseId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("retire_dam_release", { p_release_id: releaseId, p_reason: v.reason }),
  );
}

// Development Contexts ----------------------------------------------------------------

export async function createDevelopmentContext(input: unknown) {
  return run(createContextSchema, input, (supabase, v) =>
    supabase.rpc("create_development_context", {
      p_key: v.key,
      p_label: v.label,
      p_definition: v.definition,
    }),
  );
}

export async function reviseDevelopmentContext(contextId: string, input: unknown) {
  return run(reviseContextSchema, input, (supabase, v) =>
    supabase.rpc("revise_development_context", {
      p_context_id: contextId,
      p_label: v.label,
      p_definition: v.definition,
      p_reason: v.reason,
    }),
  );
}

export async function retireDevelopmentContext(contextId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("retire_development_context", { p_context_id: contextId, p_reason: v.reason }),
  );
}

// Engagement practice -----------------------------------------------------------------

export async function setEngagementRelease(engagementId: string, input: unknown) {
  return run(engagementReleaseSchema, input, (supabase, v) =>
    supabase.rpc("set_engagement_dam_release", {
      p_engagement_id: engagementId,
      p_release_id: v.releaseId,
      p_reason: v.reason,
    }),
  );
}

export async function setEngagementContexts(engagementId: string, input: unknown) {
  return run(engagementContextsSchema, input, (supabase, v) =>
    supabase.rpc("set_engagement_development_contexts", {
      p_engagement_id: engagementId,
      p_context_ids: v.contextIds,
      p_primary_context_id: v.primaryContextId as string,
    }),
  );
}

export async function startMethodApplication(engagementId: string, input: unknown) {
  return run(startApplicationSchema, input, (supabase, v) =>
    supabase.rpc("start_method_application", {
      p_engagement_id: engagementId,
      p_method_version_id: v.versionId,
      p_title: v.title,
      p_selection_reason: v.selectionReason,
      p_architectural_question: v.architecturalQuestion,
      ...(v.outsideReleaseReason ? { p_outside_release_reason: v.outsideReleaseReason } : {}),
      ...(v.leadMemberId ? { p_lead_member_id: v.leadMemberId } : {}),
    }),
  );
}

export async function startMethodApplicationAndOpen(
  engagementId: string,
  slug: string,
  input: unknown,
) {
  const result = await startMethodApplication(engagementId, input);
  if (result.ok && result.data) redirect(`/internal/engagements/${slug}/method/${result.data}`);
  return result;
}

export async function updateMethodApplication(applicationId: string, input: unknown) {
  return run(updateApplicationSchema, input, (supabase, v) =>
    supabase.rpc("update_method_application", {
      p_application_id: applicationId,
      p_title: v.title,
      p_selection_reason: v.selectionReason,
      p_architectural_question: v.architecturalQuestion,
      p_engagement_wide: v.engagementWide,
    }),
  );
}

export async function setApplicationPractitioners(applicationId: string, input: unknown) {
  return run(practitionersSchema, input, (supabase, v) =>
    supabase.rpc("set_method_application_practitioners", {
      p_application_id: applicationId,
      p_practitioners: [
        { engagement_member_id: v.leadMemberId, role: "lead" },
        ...v.contributorMemberIds
          .filter((id) => id !== v.leadMemberId)
          .map((id) => ({ engagement_member_id: id, role: "contributor" })),
      ],
    }),
  );
}

export async function setApplicationContexts(applicationId: string, input: unknown) {
  return run(contextsSchema, input, (supabase, v) =>
    supabase.rpc("set_method_application_contexts", {
      p_application_id: applicationId,
      p_context_ids: v.contextIds,
    }),
  );
}

export async function setApplicationDomains(applicationId: string, input: unknown) {
  return run(domainsSchema, input, (supabase, v) =>
    supabase.rpc("set_method_application_domains", {
      p_application_id: applicationId,
      p_domains: v.domains,
    }),
  );
}

export async function setStageNote(applicationId: string, stageId: string, input: unknown) {
  return run(stageNoteSchema, input, (supabase, v) =>
    supabase.rpc("set_method_application_stage_note", {
      p_application_id: applicationId,
      p_stage_id: stageId,
      p_treatment: v.treatment,
      p_reason: v.reason,
      p_note: v.note,
    }),
  );
}

export async function clearStageNote(applicationId: string, stageId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("clear_method_application_stage_note", {
      p_application_id: applicationId,
      p_stage_id: stageId,
    }),
  );
}

export async function setApplicationAsset(applicationId: string, input: unknown) {
  return run(applicationAssetSchema, input, (supabase, v) =>
    supabase.rpc("set_method_application_asset", {
      p_application_id: applicationId,
      p_asset_version_id: v.versionId,
      p_deviation_note: v.deviationNote,
    }),
  );
}

export async function removeApplicationAsset(applicationId: string, versionId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("remove_method_application_asset", {
      p_application_id: applicationId,
      p_asset_version_id: versionId,
    }),
  );
}

export async function linkApplicationElement(applicationId: string, input: unknown) {
  return run(linkElementSchema, input, (supabase, v) =>
    supabase.rpc("link_method_application_element", {
      p_application_id: applicationId,
      p_element_id: v.elementId,
      p_role: v.role,
      p_note: v.note,
    }),
  );
}

export async function unlinkApplicationElement(linkId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("unlink_method_application_element", { p_link_id: linkId }),
  );
}

export async function linkApplicationEvidence(applicationId: string, input: unknown) {
  return run(linkEvidenceSchema, input, (supabase, v) =>
    supabase.rpc("link_method_application_evidence", {
      p_application_id: applicationId,
      p_evidence_source_id: v.evidenceSourceId,
      p_role: v.role,
      ...(v.instrumentVersionId ? { p_instrument_version_id: v.instrumentVersionId } : {}),
      p_note: v.note,
    }),
  );
}

export async function unlinkApplicationEvidence(linkId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("unlink_method_application_evidence", { p_link_id: linkId }),
  );
}

export async function beginMethodApplication(applicationId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("begin_method_application", { p_application_id: applicationId }),
  );
}

export async function completeMethodApplication(applicationId: string, input: unknown) {
  return run(completeApplicationSchema, input, (supabase, v) =>
    supabase.rpc("complete_method_application", {
      p_application_id: applicationId,
      p_completion_statement: v.completionStatement,
      ...(v.retrospective ? { p_retrospective: v.retrospective } : {}),
    }),
  );
}

export async function discontinueMethodApplication(applicationId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("discontinue_method_application", {
      p_application_id: applicationId,
      p_reason: v.reason,
    }),
  );
}

export async function addApplicationAddendum(applicationId: string, input: unknown) {
  return run(addendumSchema, input, (supabase, v) =>
    supabase.rpc("add_method_application_addendum", {
      p_application_id: applicationId,
      p_body: v.body,
    }),
  );
}

// Acceptance criteria -----------------------------------------------------------------

export async function proposeCriterion(elementId: string, input: unknown) {
  return run(proposeCriterionSchema, input, (supabase, v) =>
    supabase.rpc("propose_acceptance_criterion", {
      p_element_id: elementId,
      p_body: v.body,
      ...(v.informing.versionId
        ? {
            p_informing_standard_version_id: v.informing.versionId,
            p_informing_criterion_key: v.informing.key,
          }
        : {}),
      p_client_visible: v.clientVisible,
    }),
  );
}

export async function updateCriterion(criterionId: string, input: unknown) {
  return run(proposeCriterionSchema, input, (supabase, v) =>
    supabase.rpc("update_acceptance_criterion", {
      p_criterion_id: criterionId,
      p_body: v.body,
      ...(v.informing.versionId
        ? {
            p_informing_standard_version_id: v.informing.versionId,
            p_informing_criterion_key: v.informing.key,
          }
        : {}),
      p_client_visible: v.clientVisible,
    }),
  );
}

export async function deleteCriterion(criterionId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("delete_acceptance_criterion", { p_criterion_id: criterionId }),
  );
}

export async function agreeCriterion(criterionId: string, input: unknown) {
  return run(agreeCriterionSchema, input, (supabase, v) =>
    supabase.rpc("agree_acceptance_criterion", {
      p_criterion_id: criterionId,
      p_agreed_with: v.agreedWith,
      p_agreed_on: v.agreedOn,
      ...(v.evidenceSourceId ? { p_agreement_evidence_source_id: v.evidenceSourceId } : {}),
    }),
  );
}

export async function supersedeCriterion(criterionId: string, input: unknown) {
  return run(supersedeCriterionSchema, input, (supabase, v) =>
    supabase.rpc("supersede_acceptance_criterion", {
      p_criterion_id: criterionId,
      p_new_body: v.body,
      p_reason: v.reason,
      ...(v.agreedWith && v.agreedOn
        ? { p_agreed_with: v.agreedWith, p_agreed_on: v.agreedOn }
        : {}),
    }),
  );
}

export async function withdrawCriterion(criterionId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("withdraw_acceptance_criterion", {
      p_criterion_id: criterionId,
      p_reason: v.reason,
    }),
  );
}

export async function setValidationCriterionNote(
  validationRelationshipId: string,
  criterionId: string,
  input: unknown,
) {
  return run(validationNoteSchema, input, (supabase, v) =>
    supabase.rpc("set_validation_criterion_note", {
      p_validation_relationship_id: validationRelationshipId,
      p_criterion_id: criterionId,
      p_note: v.note,
    }),
  );
}

// Practice capabilities ---------------------------------------------------------------

export async function setPracticeOverride(membershipId: string, input: unknown) {
  return run(practiceOverrideSchema, input, (supabase, v) =>
    supabase.rpc("set_practice_capability_override", {
      p_membership_id: membershipId,
      p_capability: v.capability,
      p_granted: v.granted,
      p_reason: v.reason,
    }),
  );
}

export async function clearPracticeOverride(
  membershipId: string,
  capability: "author_methodology" | "publish_methodology",
) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("clear_practice_capability_override", {
      p_membership_id: membershipId,
      p_capability: capability,
    }),
  );
}
