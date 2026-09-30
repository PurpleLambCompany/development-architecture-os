"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRecord } from "@/domain/architecture/actions";
import { createReview } from "@/domain/reviews/actions";
import { proposeCriterion } from "@/domain/methodology/actions";
import type { ElementKind, RecordKind } from "@/domain/architecture/catalog";
import { internalElementHref } from "@/domain/architecture/links";
import type { PromotionTargetKind } from "./promotion";
import { judgmentSchema, markBriefedSchema, type EdgeItemRef } from "./schemas";

/**
 * Development Edge server actions. Each validates its input for clear
 * messages and calls one database operation as the signed-in user; the
 * operation checks edit_architecture, re-evaluates the item and refuses a
 * stale fingerprint. Nothing here writes a table directly.
 */

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Work<T> = { data?: T | null; error: PostgrestError | null };

function refresh() {
  revalidatePath("/internal", "layout");
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

/** Judge one item (Investigating, Not material, Defer, Disagree). */
export async function judgeEdgeItem(
  engagementId: string,
  item: EdgeItemRef,
  input: Record<string, unknown>,
) {
  return run(judgmentSchema, input, (supabase, v) =>
    supabase.rpc("record_edge_judgment", {
      p_engagement_id: engagementId,
      p_rule_key: item.ruleKey,
      p_subject_type: item.subjectType,
      p_subject_id: item.subjectId,
      p_fingerprint: item.fingerprint,
      p_kind: v.kind,
      ...(v.reason ? { p_reason: v.reason } : {}),
      ...(v.expiresOn ? { p_expires_on: v.expiresOn } : {}),
    }),
  );
}

/** Judge every item of one event in one act (§7.3 rule 9). */
export async function judgeEdgeEvent(
  engagementId: string,
  triggerKey: string,
  input: Record<string, unknown>,
) {
  return run(judgmentSchema, input, (supabase, v) =>
    supabase.rpc("record_edge_event_judgment", {
      p_engagement_id: engagementId,
      p_trigger_key: triggerKey,
      p_kind: v.kind,
      ...(v.reason ? { p_reason: v.reason } : {}),
      ...(v.expiresOn ? { p_expires_on: v.expiresOn } : {}),
    }),
  );
}

/**
 * Promote: create the governed record through its own operation (which checks
 * its own capability and rules), and only once it exists record the promotion
 * with its governed promotion target, a closed kind and the record's id
 * (§15.3, ADR-0056). The item is re-checked first, so a stale promotion
 * creates nothing.
 */
async function promote(
  engagementId: string,
  item: EdgeItemRef,
  targetKind: PromotionTargetKind,
  create: () => Promise<ActionResult<unknown>>,
): Promise<ActionResult<string>> {
  await requireViewer();
  const supabase = await createSupabaseServerClient();
  const { data: current, error: readError } = await supabase.rpc("edge_items", {
    p_engagement_id: engagementId,
    p_subject_id: item.subjectId,
    p_subject_type: item.subjectType,
  });
  if (readError) return fromDatabaseError(readError);
  const stillHolds = (current ?? []).some(
    (row) => row.rule_key === item.ruleKey && row.fingerprint === item.fingerprint && !row.judged,
  );
  if (!stillHolds) {
    return fail(
      "This item has changed or been judged since the page loaded. Reload the Edge and promote it again.",
    );
  }
  const created = await create();
  if (!created.ok) return created;
  const targetId = created.data;
  if (typeof targetId !== "string")
    return fail("The record was created, but its id was not returned.");
  const { error } = await supabase.rpc("record_edge_judgment", {
    p_engagement_id: engagementId,
    p_rule_key: item.ruleKey,
    p_subject_type: item.subjectType,
    p_subject_id: item.subjectId,
    p_fingerprint: item.fingerprint,
    p_kind: "promoted",
    p_promotion_target_kind: targetKind,
    p_promotion_target_id: targetId,
  });
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(targetId);
}

/** Promote into a new Project Intelligence record (a Risk or a Decision). */
export async function promoteEdgeItem(
  engagementId: string,
  slug: string,
  kind: RecordKind,
  item: EdgeItemRef,
  input: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  if (kind !== "risk" && kind !== "decision") return fail("Promote only to a Risk or a Decision.");
  const result = await promote(engagementId, item, kind, () =>
    createRecord(engagementId, kind, input),
  );
  if (!result.ok) return result;
  redirect(
    `/internal/engagements/${encodeURIComponent(slug)}/architecture/elements/${result.data}`,
  );
}

/** Promote by scheduling a Review. */
export async function promoteToReview(
  engagementId: string,
  slug: string,
  item: EdgeItemRef,
  input: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  const result = await promote(engagementId, item, "review", () =>
    createReview(engagementId, input),
  );
  if (!result.ok) return result;
  redirect(`/internal/engagements/${encodeURIComponent(slug)}/reviews/${result.data}`);
}

/**
 * Promote by proposing an acceptance criterion on the item's own subject,
 * through the ordinary proposal operation. The criterion is only proposed:
 * agreement stays the separate governed act it always was.
 */
export async function promoteToCriterion(
  engagementId: string,
  slug: string,
  elementKind: ElementKind,
  item: EdgeItemRef,
  input: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  if (item.subjectType !== "element") return fail("A criterion is proposed on a governed element.");
  const result = await promote(engagementId, item, "acceptance_criterion", () =>
    proposeCriterion(item.subjectId, input),
  );
  if (!result.ok) return result;
  redirect(
    `${internalElementHref(encodeURIComponent(slug), elementKind, item.subjectId)}#criteria`,
  );
}

/** Set the viewer's own briefing mark. Only this explicit act moves it. */
export async function markBriefedThrough(engagementId: string, input: Record<string, unknown>) {
  return run(markBriefedSchema, input, (supabase, v) =>
    supabase.rpc("mark_briefed_through", { p_engagement_id: engagementId, p_through: v.through }),
  );
}
