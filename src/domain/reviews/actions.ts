"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";
import { fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addParticipantSchema,
  cancelReviewSchema,
  createReviewSchema,
  holdReviewSchema,
  recordValidationSchema,
  updateReviewSchema,
} from "./schemas";

/**
 * Review server actions. Each validates its input for clear messages and
 * calls one database operation as the signed-in user; the operation checks
 * capabilities and every rule again.
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
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(data ?? undefined);
}

export async function createReview(engagementId: string, input: unknown) {
  return run(createReviewSchema, input, (supabase, v) =>
    supabase.rpc("create_review", {
      p_engagement_id: engagementId,
      p_review_type: v.reviewType,
      p_title: v.title,
      ...(v.scheduledFor ? { p_scheduled_for: v.scheduledFor } : {}),
      ...(v.baselineId ? { p_baseline_id: v.baselineId } : {}),
      ...(v.summary ? { p_summary: v.summary } : {}),
    }),
  );
}

/** Direct edit of a review's own working fields (manage_reviews, V1-A B2). */
export async function updateReview(elementId: string, input: unknown) {
  return run(updateReviewSchema, input, async (supabase, v) => {
    const result = await supabase
      .from("reviews")
      .update({
        review_type: v.reviewType,
        scheduled_for: v.scheduledFor,
        baseline_id: v.baselineId,
        summary: v.summary,
      })
      .eq("element_id", elementId)
      .select("element_id");
    if (result.error || result.data?.length) return result;
    // Row-level security filtered the update out: no manage_reviews.
    return {
      data: null,
      error: {
        code: "42501",
        message: "No permission",
        details: "",
        hint: "",
        name: "PostgrestError",
      } as PostgrestError,
    };
  });
}

export async function addReviewParticipant(reviewElementId: string, input: unknown) {
  return run(addParticipantSchema, input, (supabase, v) =>
    supabase.rpc("add_review_participant", {
      p_review_element_id: reviewElementId,
      p_engagement_member_id: v.engagementMemberId,
      p_role: v.role,
    }),
  );
}

export async function holdReview(elementId: string, input: unknown) {
  return run(holdReviewSchema, input, (supabase, v) =>
    supabase.rpc("hold_review", {
      p_element_id: elementId,
      ...(v.heldAt ? { p_held_at: v.heldAt } : {}),
      ...(v.summary ? { p_summary: v.summary } : {}),
    }),
  );
}

export async function cancelReview(elementId: string, input: unknown) {
  return run(cancelReviewSchema, input, (supabase, v) =>
    supabase.rpc("cancel_review", { p_element_id: elementId, p_reason: v.reason }),
  );
}

/**
 * Record a review's validation of an implementation initiative (D5): the
 * only way a `validates` relationship is written. Refused (23514) unless
 * the review is held, already examines the initiative (or a core object it
 * implements), and has not already validated it.
 */
export async function recordReviewValidation(reviewElementId: string, input: unknown) {
  return run(recordValidationSchema, input, (supabase, v) =>
    supabase.rpc("record_review_validation", {
      p_review_element_id: reviewElementId,
      p_initiative_element_id: v.initiativeElementId,
    }),
  );
}
