"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addCheckpointSchema,
  createInitiativeSchema,
  dismissSignalSchema,
  escalateSchema,
  noteSchema,
  optionalNoteSchema,
  recordCheckpointAchievedSchema,
  reopenInitiativeSchema,
  resolveInitiativeSchema,
  triageSchema,
  updateInitiativeDetailsSchema,
  updateStatusSchema,
} from "./schemas";

/**
 * Implementation server actions. Each validates its input for clear
 * messages and calls one database operation as the signed-in user; the
 * operation checks capabilities and every rule again. Nothing here writes
 * an implementation table directly: those tables have no write grants
 * outside the operations below.
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
    if (error.code === "23505" && error.message.includes("implementation_escalations")) {
      return fail("This initiative is already escalated at that level.");
    }
    return fromDatabaseError(error);
  }
  refresh();
  return ok(data ?? undefined);
}

// Initiative lifecycle ----------------------------------------------------------------

export async function createInitiative(engagementId: string, input: unknown) {
  return run(createInitiativeSchema, input, (supabase, v) =>
    supabase.rpc("create_implementation_initiative", {
      p_engagement_id: engagementId,
      p_title: v.title,
      p_implements_element_ids: v.implementsElementIds,
      p_category: v.category,
      ...(v.targetOperationalOn ? { p_target_operational_on: v.targetOperationalOn } : {}),
      ...(v.ownerMemberId ? { p_owner_member_id: v.ownerMemberId } : {}),
      ...(v.summary ? { p_summary: v.summary } : {}),
    }),
  );
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

/** Direct edit of category, target date and owner (manage_implementation). */
export async function updateInitiativeDetails(elementId: string, input: unknown) {
  return run(updateInitiativeDetailsSchema, input, async (supabase, v) =>
    expectRow(
      await supabase
        .from("implementation_initiatives")
        .update({
          category: v.category,
          target_operational_on: v.targetOperationalOn,
          owner_member_id: v.ownerMemberId,
        })
        .eq("element_id", elementId)
        .select("element_id"),
    ),
  );
}

/** Direct edit among the non-terminal statuses (not_started/in_progress/operational/stalled). */
export async function updateImplementationStatus(elementId: string, input: unknown) {
  return run(updateStatusSchema, input, (supabase, v) =>
    supabase.rpc("update_implementation_status", {
      p_element_id: elementId,
      p_status: v.status,
      ...(v.rationale ? { p_rationale: v.rationale } : {}),
      p_publish: v.publish,
      ...(v.changeSummary ? { p_change_summary: v.changeSummary } : {}),
    }),
  );
}

/**
 * The only way to reach validated or abandoned. validated additionally
 * requires an existing qualifying `validates` relationship — recorded only
 * by record_review_validation — or the database refuses with 23514.
 */
export async function resolveInitiative(elementId: string, input: unknown) {
  return run(resolveInitiativeSchema, input, (supabase, v) =>
    supabase.rpc("resolve_implementation_initiative", {
      p_element_id: elementId,
      p_status: v.status,
      p_rationale: v.rationale,
      p_publish: v.publish,
      ...(v.changeSummary ? { p_change_summary: v.changeSummary } : {}),
    }),
  );
}

export async function reopenInitiative(elementId: string, input: unknown) {
  return run(reopenInitiativeSchema, input, (supabase, v) =>
    supabase.rpc("reopen_implementation_initiative", {
      p_element_id: elementId,
      p_rationale: v.rationale,
    }),
  );
}

// Stewardship, escalation, signals -----------------------------------------------------

export async function triageInitiative(elementId: string, input: unknown) {
  return run(triageSchema, input, (supabase, v) =>
    supabase.rpc("triage_implementation", {
      p_element_id: elementId,
      p_attention: v.attention,
      ...(v.nextReviewOn ? { p_next_review_on: v.nextReviewOn } : {}),
      ...(v.note ? { p_note: v.note } : {}),
    }),
  );
}

export async function escalateInitiative(elementId: string, input: unknown) {
  return run(escalateSchema, input, (supabase, v) =>
    supabase.rpc("escalate_implementation", {
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
    supabase.rpc("acknowledge_implementation_escalation", { p_escalation_id: escalationId }),
  );
}

export async function resolveEscalation(escalationId: string, input: unknown) {
  return run(noteSchema, input, (supabase, v) =>
    supabase.rpc("resolve_implementation_escalation", {
      p_escalation_id: escalationId,
      p_note: v.note,
    }),
  );
}

export async function dismissSignal(engagementId: string, input: unknown) {
  return run(dismissSignalSchema, input, (supabase, v) =>
    supabase.rpc("dismiss_implementation_signal", {
      p_engagement_id: engagementId,
      p_element_id: v.elementId,
      p_fingerprint: v.fingerprint,
      p_reason: v.reason,
      ...(v.expiresOn ? { p_expires_on: v.expiresOn } : {}),
    }),
  );
}

// Checkpoints ---------------------------------------------------------------------------

export async function addCheckpoint(elementId: string, input: unknown) {
  return run(addCheckpointSchema, input, (supabase, v) =>
    supabase.rpc("add_implementation_checkpoint", {
      p_element_id: elementId,
      p_checkpoint_type: v.checkpointType,
      p_title: v.title,
      ...(v.targetOn ? { p_target_on: v.targetOn } : {}),
      ...(v.relatedReviewId ? { p_related_review_id: v.relatedReviewId } : {}),
      ...(v.relatedApprovalId ? { p_related_approval_id: v.relatedApprovalId } : {}),
      p_client_visible: v.clientVisible,
    }),
  );
}

export async function recordCheckpointAchieved(checkpointId: string, input: unknown) {
  return run(recordCheckpointAchievedSchema, input, (supabase, v) =>
    supabase.rpc("record_checkpoint_achieved", {
      p_checkpoint_id: checkpointId,
      ...(v.achievedOn ? { p_achieved_on: v.achievedOn } : {}),
      ...(v.achievedEvidenceSourceId
        ? { p_achieved_evidence_source_id: v.achievedEvidenceSourceId }
        : {}),
    }),
  );
}
