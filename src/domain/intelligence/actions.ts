"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ALLOWED_FILE_TYPES,
  ENGAGEMENT_FILES_BUCKET,
  MAX_FILE_BYTES,
  type EngagementFilePurpose,
} from "./catalog";
import {
  areaSchema,
  contributionSchema,
  dismissSignalSchema,
  escalateSchema,
  handleContributionSchema,
  noteSchema,
  optionalNoteSchema,
  reassignSchema,
  recordAsEvidenceSchema,
  reopenSchema,
  resolveSchema,
  respondSchema,
  sendClientActionSchema,
  triageSchema,
} from "./schemas";

/**
 * Project Intelligence server actions. Each validates its input for clear
 * messages and calls one database operation as the signed-in user; the
 * operation checks capabilities, visibility and every rule again. Nothing
 * here writes a Phase 4 table directly: those tables have no write grants.
 */

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Work<T> = { data?: T | null; error: PostgrestError | null };

function refresh() {
  revalidatePath("/internal", "layout");
  revalidatePath("/portal", "layout");
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
  if (error) {
    if (error.code === "23505" && error.message.includes("intelligence_escalations")) {
      return fail("This record is already escalated at that level.");
    }
    return fromDatabaseError(error);
  }
  refresh();
  return ok(data ?? undefined);
}

// Stewardship, resolution, escalation ------------------------------------------------

export async function triageRecord(elementId: string, input: unknown) {
  return run(triageSchema, input, (supabase, v) =>
    supabase.rpc("triage_intelligence_record", {
      p_element_id: elementId,
      p_attention: v.attention,
      ...(v.nextReviewOn ? { p_next_review_on: v.nextReviewOn } : {}),
      ...(v.note ? { p_note: v.note } : {}),
    }),
  );
}

export async function resolveRecord(elementId: string, input: unknown) {
  return run(resolveSchema, input, (supabase, v) =>
    supabase.rpc("resolve_intelligence_record", {
      p_element_id: elementId,
      p_status: v.status,
      p_rationale: v.rationale,
      p_publish: v.publish,
      ...(v.changeSummary ? { p_change_summary: v.changeSummary } : {}),
    }),
  );
}

export async function reopenRecord(elementId: string, input: unknown) {
  return run(reopenSchema, input, (supabase, v) =>
    supabase.rpc("reopen_intelligence_record", {
      p_element_id: elementId,
      p_status: v.status,
      p_rationale: v.rationale,
    }),
  );
}

export async function escalateRecord(elementId: string, input: unknown) {
  return run(escalateSchema, input, (supabase, v) =>
    supabase.rpc("escalate_intelligence_record", {
      p_element_id: elementId,
      p_level: v.level,
      p_reason: v.reason,
      ...(v.level === "client_executive" && v.addresseeMemberId
        ? { p_addressee_member_id: v.addresseeMemberId }
        : {}),
      ...(v.level === "client_executive" && v.dueOn ? { p_due_on: v.dueOn } : {}),
    }),
  );
}

export async function acknowledgeEscalation(escalationId: string) {
  return run(optionalNoteSchema, {}, (supabase) =>
    supabase.rpc("acknowledge_escalation", { p_escalation_id: escalationId }),
  );
}

export async function resolveEscalation(escalationId: string, input: unknown) {
  return run(noteSchema, input, (supabase, v) =>
    supabase.rpc("resolve_escalation", { p_escalation_id: escalationId, p_note: v.note }),
  );
}

/** Dismiss one signal: `signal` names it (rule, subject, fingerprint); `input` gives the reason. */
export async function dismissSignal(
  engagementId: string,
  signal: {
    ruleKey: string;
    elementId: string | null;
    clientActionId: string | null;
    fingerprint: string;
  },
  input: Record<string, unknown>,
) {
  const values = {
    ...input,
    ruleKey: signal.ruleKey,
    elementId: signal.elementId ?? "",
    clientActionId: signal.clientActionId ?? "",
    fingerprint: signal.fingerprint,
  };
  return run(dismissSignalSchema, values, (supabase, v) =>
    supabase.rpc("dismiss_intelligence_signal", {
      p_engagement_id: engagementId,
      p_rule_key: v.ruleKey,
      p_element_id: v.elementId as string,
      p_client_action_id: v.clientActionId as string,
      p_fingerprint: v.fingerprint,
      p_reason: v.reason,
      ...(v.expiresOn ? { p_expires_on: v.expiresOn } : {}),
    }),
  );
}

// Client requests ------------------------------------------------------------------------

export async function sendClientAction(engagementId: string, input: unknown) {
  return run(sendClientActionSchema, input, (supabase, v) =>
    supabase.rpc("send_client_action", {
      p_engagement_id: engagementId,
      p_kind: v.kind,
      p_title: v.title,
      p_request: v.request,
      p_addressee_member_id: v.addresseeMemberId,
      ...(v.dueOn ? { p_due_on: v.dueOn } : {}),
      p_subject_ids: v.subjectIds,
    }),
  );
}

export async function respondToClientAction(actionId: string, input: unknown) {
  return run(respondSchema, input, (supabase, v) =>
    supabase.rpc("respond_to_client_action", {
      p_action_id: actionId,
      p_body: v.body,
      ...(v.linkUrl ? { p_link_url: v.linkUrl } : {}),
      p_file_ids: v.fileIds,
    }),
  );
}

export async function reassignClientAction(actionId: string, input: unknown) {
  return run(reassignSchema, input, (supabase, v) =>
    supabase.rpc("reassign_client_action", {
      p_action_id: actionId,
      p_member_id: v.memberId,
      ...(v.note ? { p_note: v.note } : {}),
    }),
  );
}

export async function closeClientAction(actionId: string, input: unknown) {
  return run(optionalNoteSchema, input, (supabase, v) =>
    supabase.rpc("close_client_action", {
      p_action_id: actionId,
      ...(v.note ? { p_note: v.note } : {}),
    }),
  );
}

export async function returnClientAction(actionId: string, input: unknown) {
  return run(noteSchema, input, (supabase, v) =>
    supabase.rpc("return_client_action", { p_action_id: actionId, p_note: v.note }),
  );
}

export async function withdrawClientAction(actionId: string, input: unknown) {
  return run(noteSchema, input, (supabase, v) =>
    supabase.rpc("withdraw_client_action", { p_action_id: actionId, p_note: v.note }),
  );
}

export async function recordResponseAsEvidence(responseId: string, input: unknown) {
  return run(recordAsEvidenceSchema, input, (supabase, v) =>
    supabase.rpc("record_response_as_evidence", {
      p_response_id: responseId,
      ...(v.title ? { p_title: v.title } : {}),
      ...(v.statementId ? { p_statement_id: v.statementId, p_stance: v.stance } : {}),
    }),
  );
}

// Client input -------------------------------------------------------------------------------

export async function submitContribution(elementId: string, input: unknown) {
  return run(contributionSchema, input, (supabase, v) =>
    supabase.rpc("submit_client_contribution", {
      p_element_id: elementId,
      p_body: v.body,
      ...(v.linkUrl ? { p_link_url: v.linkUrl } : {}),
      p_file_ids: v.fileIds,
    }),
  );
}

export async function handleContribution(contributionId: string, input: unknown) {
  return run(handleContributionSchema, input, (supabase, v) =>
    supabase.rpc("handle_client_contribution", {
      p_contribution_id: contributionId,
      p_status: v.status,
      p_note: v.note,
      p_record_as_evidence: v.recordAsEvidence,
      ...(v.statementId ? { p_statement_id: v.statementId } : {}),
    }),
  );
}

// Contributor areas ----------------------------------------------------------------------------

export async function assignMemberArea(memberId: string, input: unknown) {
  return run(areaSchema, input, (supabase, v) =>
    supabase.rpc("assign_member_area", {
      p_member_id: memberId,
      ...(v.domain ? { p_domain: v.domain } : {}),
      ...(v.elementId ? { p_element_id: v.elementId } : {}),
    }),
  );
}

export async function removeMemberArea(areaId: string) {
  return run(optionalNoteSchema, {}, (supabase) =>
    supabase.rpc("remove_member_area", { p_area_id: areaId }),
  );
}

// Files ----------------------------------------------------------------------------------------

/**
 * Prepare one upload: register the file (the database checks who may upload
 * what and fixes the storage path), then create a one-time upload URL for
 * that path as the signed-in user (the storage policy accepts only a
 * registered path by its uploader). The browser sends the file straight to
 * storage, so large files never pass through the application server. The
 * file is attached to a response, input or evidence source separately, and
 * only once it is in storage.
 */
export async function prepareFileUpload(
  engagementId: string,
  purpose: EngagementFilePurpose,
  file: { name: string; type: string; size: number },
  evidenceSourceId?: string,
): Promise<ActionResult<{ fileId: string; path: string; token: string }>> {
  await requireViewer();
  if (!file.name || file.size <= 0) return fail("Choose a file to upload.");
  if (file.size > MAX_FILE_BYTES) return fail(`${file.name} is larger than 25 MB.`);
  if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
    return fail(`${file.name}: upload a PDF, image, text, CSV, Word, Excel or PowerPoint file.`);
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("register_engagement_file", {
    p_engagement_id: engagementId,
    p_purpose: purpose,
    p_filename: file.name,
    p_content_type: file.type,
    p_size_bytes: file.size,
    ...(evidenceSourceId ? { p_evidence_source_id: evidenceSourceId } : {}),
  });
  if (error) return fromDatabaseError(error);
  const registered = data?.[0];
  if (!registered) return fail("The file could not be registered.");
  const signed = await supabase.storage
    .from(ENGAGEMENT_FILES_BUCKET)
    .createSignedUploadUrl(registered.object_path);
  if (signed.error || !signed.data) {
    console.error("Signed upload URL failed", signed.error);
    return fail("The file could not be uploaded. Please try again.");
  }
  return ok({ fileId: registered.file_id, path: registered.object_path, token: signed.data.token });
}

/** After an evidence file is stored: refresh the pages that list it. */
export async function evidenceFileStored() {
  await requireViewer();
  refresh();
  return ok(undefined);
}
