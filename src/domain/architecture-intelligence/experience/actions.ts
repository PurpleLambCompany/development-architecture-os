"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRecord } from "@/domain/architecture/actions";
import type { ElementKind } from "@/domain/architecture/catalog";
import { internalElementHref } from "@/domain/architecture/links";
import { judgmentSchema } from "@/domain/edge/schemas";
import type { PromotionTargetKind } from "@/domain/edge/promotion";
import { proposeCriterion } from "@/domain/methodology/actions";
import { createReview } from "@/domain/reviews/actions";
import type { AnyKindOutput } from "../kinds/schemas";
import type { Citation, Provenance } from "../gateway";
import { invokeAsUser } from "../server";
import type { RequestOutcome } from "../types";
import { getInferenceDetail, getLayer2 } from "./queries";
import { drawerFromQuery, gatewaySubject, kindFor } from "./subjects";

/**
 * Architecture Intelligence experience server actions (7B.2). Each acts as
 * the signed-in user, never the service role:
 *
 * - interpret: a person's explicit request. It re-runs the gate and the
 *   availability rule (a screen that is out of date cannot invoke) and
 *   calls the Gateway in ephemeral mode only (IX-12). Nothing becomes an
 *   inference here; the recording operation holds the exact validated
 *   output for its requester for thirty minutes.
 * - keep / keep and judge: name only the request; the database supplies the
 *   held output, so the persisted text is exactly the text shown (PD-4).
 *   Keep and judgment run in one database transaction (PD-3).
 * - judge: a kept inference; refused when stale or superseded.
 * - promote: create the governed record through its own operation, then
 *   record the `promoted` judgment naming it (IX-20).
 */

export type InterpretResult = {
  outcome: RequestOutcome;
  requestId: string | null;
  output?: AnyKindOutput;
  nothingToAddReason?: string;
  citations?: Record<string, Citation>;
  provenance?: Provenance;
  keepableUntil?: string;
};

const interpretSchema = z.strictObject({
  subject: z.string().min(1).max(2000),
  interpretAgain: z.boolean().default(false),
  confirmedLarge: z.boolean().default(false),
});

function refresh() {
  revalidatePath("/internal", "layout");
}

export async function interpret(
  engagementId: string,
  input: unknown,
): Promise<ActionResult<InterpretResult>> {
  await requireViewer();
  const parsed = interpretSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError(parsed.error);
  const subject = drawerFromQuery(Object.fromEntries(new URLSearchParams(parsed.data.subject)));
  if (!subject) return fail("That record was not found, or you do not have access to it.");

  const layer2 = await getLayer2(engagementId, subject);
  if (layer2.gate.state === "absent")
    return fail("That record was not found, or you do not have access to it.");
  if (layer2.gate.state !== "offered")
    return fail("This interpretation is not available now. Reload the page.");
  if (
    "suppressed" in layer2 &&
    (layer2.suppressed || layer2.reusable) &&
    !parsed.data.interpretAgain
  )
    return fail("This page is out of date. Reload it.");
  if (layer2.gate.large && !parsed.data.confirmedLarge)
    return fail("This is a larger request than usual. Confirm to continue.");

  const supabase = await createSupabaseServerClient();
  const result = await invokeAsUser(supabase, {
    engagementId,
    kind: kindFor(subject),
    subject: gatewaySubject(subject),
    mode: "ephemeral",
    interpretAgain: parsed.data.interpretAgain,
  });
  return ok({
    outcome: result.outcome,
    requestId: result.requestId,
    output: result.output,
    nothingToAddReason: result.nothingToAddReason,
    citations: result.citations,
    provenance: result.provenance,
    keepableUntil: result.keepableUntil,
  });
}

const requestIdSchema = z.uuid();

/** Keep a returned interpretation (only its requester; within thirty minutes). */
export async function keepInterpretation(
  engagementId: string,
  requestId: string,
): Promise<ActionResult<string>> {
  await requireViewer();
  if (!requestIdSchema.safeParse(requestId).success) return fail("Interpret again.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("keep_architecture_inference", {
    p_engagement_id: engagementId,
    p_request_id: requestId,
  });
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(data);
}

const judgmentPayload = (v: z.output<typeof judgmentSchema>) => ({
  kind: v.kind,
  ...(v.reason ? { reason: v.reason } : {}),
  ...(v.expiresOn ? { expires_on: v.expiresOn } : {}),
});

/** Judge an ephemeral interpretation: it is kept and judged in one transaction (PD-3, PD-21). */
export async function keepAndJudgeInterpretation(
  engagementId: string,
  requestId: string,
  input: Record<string, unknown>,
): Promise<ActionResult<string>> {
  await requireViewer();
  if (!requestIdSchema.safeParse(requestId).success) return fail("Interpret again.");
  const parsed = judgmentSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("keep_architecture_inference", {
    p_engagement_id: engagementId,
    p_request_id: requestId,
    p_judgment: judgmentPayload(parsed.data),
  });
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(data);
}

/** Judge a kept interpretation (Investigating, Not material, Defer, Disagree). */
export async function judgeInference(
  engagementId: string,
  inferenceId: string,
  input: Record<string, unknown>,
): Promise<ActionResult<string>> {
  await requireViewer();
  const parsed = judgmentSchema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const v = parsed.data;
  const { data, error } = await supabase.rpc("record_architecture_inference_judgment", {
    p_engagement_id: engagementId,
    p_inference_id: inferenceId,
    p_kind: v.kind,
    ...(v.reason ? { p_reason: v.reason } : {}),
    ...(v.expiresOn ? { p_expires_on: v.expiresOn } : {}),
  });
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(data);
}

// Promotion from a kept inference (IX-20) ----------------------------------------

/** The interpretation's own words, as an `ai_analysis` statement under the review gate. */
function broughtText(detail: NonNullable<Awaited<ReturnType<typeof getInferenceDetail>>>) {
  const body = [detail.assertion, ...detail.claims.map((c) => `- ${c.text}`)].join("\n");
  return body.length > 4000 ? `${body.slice(0, 3997)}...` : body;
}

async function promoteInference(
  engagementId: string,
  inferenceId: string,
  targetKind: PromotionTargetKind,
  bringText: boolean,
  create: () => Promise<ActionResult<unknown>>,
): Promise<ActionResult<string>> {
  await requireViewer();
  const detail = await getInferenceDetail(engagementId, inferenceId);
  if (!detail) return fail("That interpretation was not found, or you do not have access to it.");
  if (detail.state !== "current")
    return fail("This interpretation is stale: its basis has changed. Interpret again.");
  const created = await create();
  if (!created.ok) return created;
  const targetId = created.data;
  if (typeof targetId !== "string")
    return fail("The record was created, but its id was not returned.");
  const supabase = await createSupabaseServerClient();
  if (bringText && targetKind !== "acceptance_criterion") {
    // Enters as ai_analysis: the database marks it pending under the AI review gate.
    const { error: textError } = await supabase.from("architecture_statements").insert({
      element_id: targetId,
      statement_kind: "observation",
      body: broughtText(detail),
      provenance: "ai_analysis",
      source_reference: `Kept interpretation (${detail.inference_kind}, prompt ${detail.provenance.prompt_version})`,
      client_visible: false,
    } as never);
    if (textError) return fromDatabaseError(textError);
  }
  const { error } = await supabase.rpc("record_architecture_inference_judgment", {
    p_engagement_id: engagementId,
    p_inference_id: inferenceId,
    p_kind: "promoted",
    p_promotion_target_kind: targetKind,
    p_promotion_target_id: targetId,
  });
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(targetId);
}

const wantsText = (input: Record<string, unknown>) => input.bringInterpretationText === "yes";

function withoutBring(input: Record<string, unknown>) {
  const rest = { ...input };
  delete rest.bringInterpretationText;
  return rest;
}

/** Promote a kept inference into a new Risk or Decision. */
export async function promoteInferenceToRecord(
  engagementId: string,
  slug: string,
  kind: "risk" | "decision",
  inferenceId: string,
  input: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  if (kind !== "risk" && kind !== "decision") return fail("Promote only to a Risk or a Decision.");
  const result = await promoteInference(engagementId, inferenceId, kind, wantsText(input), () =>
    createRecord(engagementId, kind, withoutBring(input)),
  );
  if (!result.ok) return result;
  redirect(
    `/internal/engagements/${encodeURIComponent(slug)}/architecture/elements/${result.data}`,
  );
}

/** Promote a kept inference by scheduling a Review. */
export async function promoteInferenceToReview(
  engagementId: string,
  slug: string,
  inferenceId: string,
  input: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  const result = await promoteInference(engagementId, inferenceId, "review", wantsText(input), () =>
    createReview(engagementId, withoutBring(input)),
  );
  if (!result.ok) return result;
  redirect(`/internal/engagements/${encodeURIComponent(slug)}/reviews/${result.data}`);
}

/** Promote a kept inference by proposing a criterion on its subject element. */
export async function promoteInferenceToCriterion(
  engagementId: string,
  slug: string,
  elementKind: ElementKind,
  elementId: string,
  inferenceId: string,
  input: Record<string, unknown>,
): Promise<ActionResult<unknown>> {
  const result = await promoteInference(
    engagementId,
    inferenceId,
    "acceptance_criterion",
    false,
    () => proposeCriterion(elementId, input),
  );
  if (!result.ok) return result;
  redirect(`${internalElementHref(encodeURIComponent(slug), elementKind, elementId)}#criteria`);
}
