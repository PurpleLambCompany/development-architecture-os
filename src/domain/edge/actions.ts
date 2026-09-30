"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";
import { fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRecord } from "@/domain/architecture/actions";
import type { RecordKind } from "@/domain/architecture/catalog";
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
 * its own capability), and only once it exists record the promotion (§15.3).
 */
export async function promoteEdgeItem(
  engagementId: string,
  kind: RecordKind,
  item: EdgeItemRef,
  input: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  const created = await createRecord(engagementId, kind, input);
  if (!created.ok) return created;
  const elementId = created.data as string | undefined;
  if (!elementId) return created;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_edge_judgment", {
    p_engagement_id: engagementId,
    p_rule_key: item.ruleKey,
    p_subject_type: item.subjectType,
    p_subject_id: item.subjectId,
    p_fingerprint: item.fingerprint,
    p_kind: "promoted",
    p_promoted_element_id: elementId,
  });
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(elementId);
}

/** Set the viewer's own briefing mark. Only this explicit act moves it. */
export async function markBriefedThrough(engagementId: string, input: Record<string, unknown>) {
  return run(markBriefedSchema, input, (supabase, v) =>
    supabase.rpc("mark_briefed_through", { p_engagement_id: engagementId, p_through: v.through }),
  );
}
