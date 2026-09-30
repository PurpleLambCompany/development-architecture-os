"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { RecordKind } from "./catalog";
import { attributesFromForm } from "./object-types";
import type { ObjectTypeKey } from "./rules";
import {
  RECORD_FIELD_SCHEMAS,
  approvalRequestSchema,
  approvalResponseSchema,
  elementSchema,
  baselineItemSchema,
  baselineSchema,
  citationSchema,
  decideSchema,
  decisionOptionSchema,
  domainAssessmentSchema,
  evidenceSourceSchema,
  externalApprovalSchema,
  externalDecisionSchema,
  lineageSchema,
  noteSchema,
  objectSchema,
  objectUpdateSchema,
  publishSchema,
  reasonSchema,
  recommendationSchema,
  recordSchema,
  relationshipSchema,
  statementSchema,
  supersedeSchema,
} from "./schemas";

/**
 * Architecture server actions. They validate input for clear messages and
 * call the database as the signed-in user. Working content (drafts,
 * statements, relationships, evidence) is written directly under column
 * grants and row-level security; lifecycle, publication, approvals,
 * decisions, assessments and baselines move only through the operations in
 * the migration, which check capabilities and every rule again.
 */

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Work<T> = { data?: T | null; error: PostgrestError | null };

function refresh() {
  revalidatePath("/internal", "layout");
  revalidatePath("/portal", "layout");
}

function dbError(error: PostgrestError): ActionResult<never> {
  if (error.code === "23505" && error.message.includes("architecture_relationships")) {
    return fail("That relationship already exists.");
  }
  if (error.code === "23505" && error.message.includes("architecture_approvals")) {
    return fail("Approval has already been requested for that version.");
  }
  if (error.code === "23505" && error.message.includes("architecture_baseline_items")) {
    return fail("That element is already in the baseline.");
  }
  return fromDatabaseError(error);
}

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  work: (supabase: Supabase, data: z.output<S>) => PromiseLike<Work<T>>,
): Promise<ActionResult<T | undefined>> {
  await requireViewer();
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await work(supabase, parsed.data);
  if (error) return dbError(error);
  refresh();
  return ok(data ?? undefined);
}

/** An update or delete that RLS silently filtered out means no permission. */
function expectRow<T>(result: { data: T[] | null; error: PostgrestError | null }): Work<T> {
  if (result.error) return { error: result.error };
  if (!result.data?.length) {
    return {
      error: {
        code: "42501",
        message: "No permission",
        details: "",
        hint: "",
        name: "PostgrestError",
      } as PostgrestError,
    };
  }
  return { data: result.data[0], error: null };
}

const empty = z.object({});

function spine(v: z.output<typeof elementSchema>) {
  return {
    title: v.title,
    summary: v.summary,
    provenance: v.provenance,
    source_reference: v.sourceReference,
    ip_classification: v.ipClassification,
    ...(v.clientVisibility ? { client_visibility: v.clientVisibility } : {}),
  };
}

// Core objects ------------------------------------------------------------------

export async function createObject(engagementId: string, input: Record<string, unknown>) {
  const parsed = objectSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const attributes = attributesFromForm(
    parsed.data.objectType as ObjectTypeKey,
    input as Record<string, string>,
  );
  if (!attributes.success) return fail("Please correct the highlighted fields.", attributes.errors);
  return run(objectSchema, input, (supabase, v) =>
    supabase.rpc("create_architecture_element", {
      p_engagement_id: engagementId,
      p_kind: "object",
      p_element: spine(v),
      p_details: {
        object_type: v.objectType,
        maturity: v.maturity,
        maturity_rationale: v.maturityRationale,
        attributes: attributes.data,
      } as Json,
    }),
  );
}

export async function updateObject(
  elementId: string,
  objectType: ObjectTypeKey,
  input: Record<string, unknown>,
) {
  const attributes = attributesFromForm(objectType, input as Record<string, string>);
  if (!attributes.success) return fail("Please correct the highlighted fields.", attributes.errors);
  return run(objectUpdateSchema, input, async (supabase, v) => {
    const element = expectRow(
      await supabase
        .from("architecture_elements")
        .update(spine(v))
        .eq("id", elementId)
        .select("id"),
    );
    if (element.error) return { error: element.error };
    const updated = expectRow(
      await supabase
        .from("architecture_objects")
        .update({
          maturity: v.maturity,
          maturity_rationale: v.maturityRationale,
          attributes: attributes.data,
        })
        .eq("element_id", elementId)
        .select("element_id"),
    );
    return { error: updated.error };
  });
}

// Project Intelligence records -------------------------------------------------------

function recordDetails(kind: RecordKind, v: Record<string, unknown>) {
  switch (kind) {
    case "assumption":
      return {
        category: v.category,
        confidence: v.confidence,
        validation_status: v.validationStatus,
        impact_if_false: v.impactIfFalse,
        validation_note: v.validationNote,
      };
    case "risk":
      return {
        category: v.category,
        probability: v.probability,
        impact: v.impact,
        mitigation: v.mitigation,
        risk_status: v.riskStatus,
      };
    case "constraint":
      return {
        category: v.category,
        source: v.source,
        negotiable: v.negotiable,
        constraint_status: v.constraintStatus,
      };
    case "dependency":
      return {
        from_element_id: v.fromElementId,
        to_element_id: v.toElementId,
        dependency_type: v.dependencyType,
        blocking: v.blocking,
        dependency_status: v.dependencyStatus,
      };
    case "decision":
      return { context: v.context, needed_by: v.neededBy, downstream_impact: v.downstreamImpact };
    case "recommendation":
      return { rationale: v.rationale, priority: v.priority };
  }
}

function recordInput(kind: RecordKind, input: Record<string, unknown>) {
  // A recommendation is always TPLCo's assessment (checked in the database too).
  return kind === "recommendation" ? { ...input, provenance: "architect_judgment" } : input;
}

export async function createRecord(
  engagementId: string,
  kind: RecordKind,
  input: Record<string, unknown>,
) {
  const values = recordInput(kind, input);
  const details = RECORD_FIELD_SCHEMAS[kind].safeParse(values);
  if (!details.success) return fromZodError(details.error);
  return run(recordSchema, values, (supabase, v) =>
    supabase.rpc("create_architecture_element", {
      p_engagement_id: engagementId,
      p_kind: kind,
      p_element: { ...spine(v), engagement_wide: v.engagementWide },
      p_details: recordDetails(kind, details.data) as Json,
      p_domains: v.domains,
    }),
  );
}

const RECORD_TABLES = {
  assumption: "assumptions",
  risk: "risks",
  constraint: "constraints",
  dependency: "dependencies",
  decision: "decisions",
  recommendation: "recommendations",
} as const;

export async function updateRecord(
  elementId: string,
  kind: RecordKind,
  input: Record<string, unknown>,
) {
  const values = recordInput(kind, input);
  const details = RECORD_FIELD_SCHEMAS[kind].safeParse(values);
  if (!details.success) return fromZodError(details.error);
  return run(recordSchema, values, async (supabase, v) => {
    const element = expectRow(
      await supabase
        .from("architecture_elements")
        .update({ ...spine(v), engagement_wide: v.engagementWide })
        .eq("id", elementId)
        .select("id"),
    );
    if (element.error) return { error: element.error };

    // Domains: add what is new, remove what was dropped.
    const { data: current, error } = await supabase
      .from("intelligence_record_domains")
      .select("domain")
      .eq("element_id", elementId);
    if (error) return { error };
    const had = new Set((current ?? []).map((d) => d.domain));
    const want = new Set(v.domains);
    const add = [...want].filter((d) => !had.has(d));
    const remove = [...had].filter((d) => !want.has(d));
    if (add.length) {
      const r = await supabase
        .from("intelligence_record_domains")
        .insert(add.map((domain) => ({ element_id: elementId, domain }) as never));
      if (r.error) return { error: r.error };
    }
    if (remove.length) {
      const r = await supabase
        .from("intelligence_record_domains")
        .delete()
        .eq("element_id", elementId)
        .in("domain", remove);
      if (r.error) return { error: r.error };
    }

    // Decisions keep only their framing editable here; the outcome moves by operation.
    const updated = expectRow(
      await supabase
        .from(RECORD_TABLES[kind])
        .update(recordDetails(kind, details.data) as never)
        .eq("element_id", elementId)
        .select("element_id"),
    );
    return { error: updated.error };
  });
}

/** Delete a draft that was never published (RLS refuses anything else). */
export async function deleteElement(elementId: string) {
  return run(empty, {}, async (supabase) =>
    expectRow(
      await supabase.from("architecture_elements").delete().eq("id", elementId).select("id"),
    ),
  );
}

// Statements and evidence --------------------------------------------------------------

export async function addStatement(elementId: string, input: unknown) {
  return run(statementSchema, input, (supabase, v) =>
    supabase
      .from("architecture_statements")
      .insert({
        element_id: elementId,
        statement_kind: v.statementKind,
        body: v.body,
        provenance: v.provenance,
        source_reference: v.sourceReference,
        client_visible: v.clientVisible,
      } as never)
      .select("id")
      .single(),
  );
}

export async function updateStatement(statementId: string, input: unknown) {
  return run(statementSchema, input, async (supabase, v) =>
    expectRow(
      await supabase
        .from("architecture_statements")
        .update({
          statement_kind: v.statementKind,
          body: v.body,
          provenance: v.provenance,
          source_reference: v.sourceReference,
          client_visible: v.clientVisible,
        })
        .eq("id", statementId)
        .select("id"),
    ),
  );
}

export async function deleteStatement(statementId: string) {
  return run(empty, {}, async (supabase) =>
    expectRow(
      await supabase.from("architecture_statements").delete().eq("id", statementId).select("id"),
    ),
  );
}

export async function citeEvidence(statementId: string, input: unknown) {
  return run(citationSchema, input, (supabase, v) =>
    supabase
      .from("statement_evidence_links")
      .insert({
        statement_id: statementId,
        evidence_source_id: v.evidenceSourceId,
        stance: v.stance,
        locator: v.locator,
        note: v.note,
      } as never)
      .select("id")
      .single(),
  );
}

export async function removeCitation(linkId: string) {
  return run(empty, {}, async (supabase) =>
    expectRow(
      await supabase.from("statement_evidence_links").delete().eq("id", linkId).select("id"),
    ),
  );
}

export async function citeEvidenceOnElement(elementId: string, input: unknown) {
  return run(citationSchema, input, (supabase, v) =>
    supabase
      .from("element_evidence_links")
      .insert({
        element_id: elementId,
        evidence_source_id: v.evidenceSourceId,
        stance: v.stance,
        locator: v.locator,
        note: v.note,
      } as never)
      .select("id")
      .single(),
  );
}

export async function removeElementCitation(linkId: string) {
  return run(empty, {}, async (supabase) =>
    expectRow(await supabase.from("element_evidence_links").delete().eq("id", linkId).select("id")),
  );
}

function evidenceRow(v: z.output<typeof evidenceSourceSchema>) {
  return {
    title: v.title,
    source_type: v.sourceType,
    provenance: v.provenance,
    reference: v.reference,
    url: v.url,
    publisher_author: v.publisherAuthor,
    source_date: v.sourceDate,
    accessed_date: v.accessedDate,
    external_reference: v.externalReference,
    summary: v.summary,
    notes: v.notes,
    ip_classification: v.ipClassification,
    ...(v.clientVisibility ? { client_visibility: v.clientVisibility } : {}),
  };
}

export async function createEvidenceSource(engagementId: string, input: unknown) {
  return run(evidenceSourceSchema, input, (supabase, v) =>
    supabase
      .from("evidence_sources")
      .insert({ engagement_id: engagementId, ...evidenceRow(v) })
      .select("id")
      .single(),
  );
}

export async function updateEvidenceSource(sourceId: string, input: unknown) {
  return run(evidenceSourceSchema, input, async (supabase, v) =>
    expectRow(
      await supabase
        .from("evidence_sources")
        .update(evidenceRow(v))
        .eq("id", sourceId)
        .select("id"),
    ),
  );
}

// Relationships ---------------------------------------------------------------------

export async function addRelationship(
  engagementId: string,
  sourceElementId: string,
  input: unknown,
) {
  return run(relationshipSchema, input, (supabase, v) =>
    supabase
      .from("architecture_relationships")
      .insert({
        engagement_id: engagementId,
        source_element_id: sourceElementId,
        target_element_id: v.targetElementId,
        relationship_type: v.relationshipType,
        required_proficiency: v.requiredProficiency,
        description: v.description,
        provenance: v.provenance,
        ...(v.clientVisibility ? { client_visibility: v.clientVisibility } : {}),
      })
      .select("id")
      .single(),
  );
}

/** Remove a relationship that was never published (RLS refuses anything else). */
export async function deleteRelationship(relationshipId: string) {
  return run(empty, {}, async (supabase) =>
    expectRow(
      await supabase
        .from("architecture_relationships")
        .delete()
        .eq("id", relationshipId)
        .select("id"),
    ),
  );
}

export async function retireRelationship(relationshipId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("retire_relationship", { p_relationship_id: relationshipId, p_reason: v.reason }),
  );
}

// Decisions -------------------------------------------------------------------------

export async function addDecisionOption(decisionId: string, input: unknown) {
  return run(decisionOptionSchema, input, (supabase, v) =>
    supabase
      .from("decision_options")
      .insert({
        decision_element_id: decisionId,
        title: v.title,
        description: v.description,
        tradeoffs: v.tradeoffs,
      } as never)
      .select("id")
      .single(),
  );
}

export async function deleteDecisionOption(optionId: string) {
  return run(empty, {}, async (supabase) =>
    expectRow(await supabase.from("decision_options").delete().eq("id", optionId).select("id")),
  );
}

export async function setDecisionRecommendation(decisionId: string, input: unknown) {
  return run(recommendationSchema, input, (supabase, v) =>
    supabase.rpc("set_decision_recommendation", {
      p_decision_id: decisionId,
      p_option_id: v.optionId,
      p_rationale: v.rationale,
    }),
  );
}

/** A client chooses an option (approve_architecture and view_architecture). */
export async function decideDecision(decisionId: string, input: unknown) {
  return run(decideSchema, input, (supabase, v) =>
    supabase.rpc("decide_decision", {
      p_decision_id: decisionId,
      p_option_id: v.optionId,
      p_note: v.note || undefined,
    }),
  );
}

export async function recordExternalDecision(decisionId: string, input: unknown) {
  return run(externalDecisionSchema, input, (supabase, v) =>
    supabase.rpc("record_external_decision", {
      p_decision_id: decisionId,
      p_option_id: v.optionId,
      p_decider_name: v.deciderName,
      p_decided_on: v.decidedOn,
      p_method: v.method,
      p_evidence: v.evidence,
      p_note: v.note || undefined,
    }),
  );
}

export async function deferDecision(decisionId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("defer_decision", { p_decision_id: decisionId, p_reason: v.reason }),
  );
}

// Method lineage (internal only) ------------------------------------------------------

export async function addLineage(elementId: string, input: unknown) {
  return run(lineageSchema, input, (supabase, v) =>
    supabase
      .from("element_method_lineage")
      .insert({
        element_id: elementId,
        method_asset_id: v.methodAssetId,
        method_version: v.methodVersion,
        note: v.note,
      } as never)
      .select("id")
      .single(),
  );
}

export async function removeLineage(lineageId: string) {
  return run(empty, {}, async (supabase) =>
    expectRow(
      await supabase.from("element_method_lineage").delete().eq("id", lineageId).select("id"),
    ),
  );
}

// Lifecycle operations ------------------------------------------------------------------

export async function submitForReview(elementId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("submit_element_for_review", { p_element_id: elementId }),
  );
}

export async function returnToDraft(elementId: string, input: unknown) {
  return run(noteSchema, input, (supabase, v) =>
    supabase.rpc("return_element_to_draft", { p_element_id: elementId, p_note: v.note }),
  );
}

export async function publishElement(elementId: string, input: unknown) {
  return run(publishSchema, input, (supabase, v) =>
    supabase.rpc("publish_element_version", {
      p_element_id: elementId,
      p_change_summary: v.changeSummary,
    }),
  );
}

export async function retireElement(elementId: string, input: unknown) {
  return run(reasonSchema, input, (supabase, v) =>
    supabase.rpc("retire_element", { p_element_id: elementId, p_reason: v.reason }),
  );
}

export async function supersedeElement(oldElementId: string, input: unknown) {
  return run(supersedeSchema, input, (supabase, v) =>
    supabase.rpc("supersede_element", {
      p_old_element_id: oldElementId,
      p_new_element_id: v.newElementId,
      p_reason: v.reason,
    }),
  );
}

export async function reviewAiContent(
  elementId: string,
  statementId: string | null,
  accept: boolean,
) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("review_ai_content", {
      p_element_id: elementId,
      p_statement_id: statementId as string,
      p_accept: accept,
    }),
  );
}

// Domain maturity (a dated architect judgment, never computed) ---------------------------

export async function recordDomainAssessment(engagementId: string, input: unknown) {
  return run(domainAssessmentSchema, input, (supabase, v) =>
    supabase.rpc("record_domain_assessment", {
      p_engagement_id: engagementId,
      p_domain: v.domain,
      p_maturity: v.maturity,
      p_rationale: v.rationale,
      p_client_visible: v.clientVisible,
    }),
  );
}

// Approvals ------------------------------------------------------------------------------

type ApprovalTarget = { versionId: string } | { baselineId: string };

function targetArgs(target: ApprovalTarget) {
  return {
    p_element_version_id: ("versionId" in target ? target.versionId : null) as string,
    p_baseline_id: ("baselineId" in target ? target.baselineId : null) as string,
  };
}

export async function requestApproval(target: ApprovalTarget, input: unknown) {
  return run(approvalRequestSchema, input, (supabase, v) =>
    supabase.rpc("request_architecture_approval", { ...targetArgs(target), p_note: v.note }),
  );
}

/** A client answers an approval request; final once recorded. */
export async function respondToApproval(approvalId: string, input: unknown) {
  return run(approvalResponseSchema, input, (supabase, v) =>
    supabase.rpc("respond_to_architecture_approval", {
      p_approval_id: approvalId,
      p_response: v.response,
      p_comment: v.comment || undefined,
    }),
  );
}

export async function recordExternalApproval(target: ApprovalTarget, input: unknown) {
  return run(externalApprovalSchema, input, (supabase, v) =>
    supabase.rpc("record_external_architecture_approval", {
      ...targetArgs(target),
      p_response: v.response,
      p_approver_name: v.approverName,
      p_approver_title: v.approverTitle,
      p_approved_on: v.approvedOn,
      p_method: v.method,
      p_evidence: v.evidence,
      p_comment: v.comment || undefined,
    }),
  );
}

// Baselines ------------------------------------------------------------------------------

export async function createBaseline(engagementId: string, input: unknown) {
  return run(baselineSchema, input, (supabase, v) =>
    supabase
      .from("architecture_baselines")
      .insert({ engagement_id: engagementId, label: v.label, description: v.description })
      .select("id")
      .single(),
  );
}

/** Add one published version to a draft baseline; the element comes from the version. */
export async function addBaselineItem(baselineId: string, input: unknown) {
  return run(baselineItemSchema, input, async (supabase, v) => {
    const { data: version, error } = await supabase
      .from("element_versions")
      .select("element_id")
      .eq("id", v.elementVersionId)
      .maybeSingle();
    if (error) return { error };
    if (!version) {
      return {
        error: {
          code: "P0002",
          message: "Version not found",
          details: "",
          hint: "",
          name: "PostgrestError",
        } as PostgrestError,
      };
    }
    return supabase.from("architecture_baseline_items").insert({
      baseline_id: baselineId,
      element_id: version.element_id,
      element_version_id: v.elementVersionId,
    } as never);
  });
}

/** Add the latest published version of every published element not yet in the baseline. */
export async function addAllPublishedToBaseline(
  baselineId: string,
  items: { elementId: string; versionId: string }[],
) {
  return run(empty, {}, async (supabase) => {
    if (items.length === 0) return { error: null };
    return supabase.from("architecture_baseline_items").insert(
      items.map(
        (i) =>
          ({
            baseline_id: baselineId,
            element_id: i.elementId,
            element_version_id: i.versionId,
          }) as never,
      ),
    );
  });
}

export async function removeBaselineItem(baselineId: string, elementId: string) {
  return run(empty, {}, async (supabase) =>
    expectRow(
      await supabase
        .from("architecture_baseline_items")
        .delete()
        .eq("baseline_id", baselineId)
        .eq("element_id", elementId)
        .select("element_id"),
    ),
  );
}

export async function freezeBaseline(baselineId: string) {
  return run(empty, {}, (supabase) =>
    supabase.rpc("freeze_baseline", { p_baseline_id: baselineId }),
  );
}

export async function deleteBaseline(baselineId: string) {
  return run(empty, {}, async (supabase) =>
    expectRow(
      await supabase.from("architecture_baselines").delete().eq("id", baselineId).select("id"),
    ),
  );
}
