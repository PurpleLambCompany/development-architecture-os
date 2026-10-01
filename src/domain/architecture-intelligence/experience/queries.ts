import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestEstimateUsd } from "../gateway";
import { CONTEXT_PLANS } from "../kinds/plans";
import { currentPrompt } from "../prompts/manifest";
import { deployment } from "../server";
import { supabaseStore } from "../store";
import type { InferenceKind } from "../types";
import { composeGate, type GateState } from "./gate";
import { kindFor, subjectJson, type DrawerSubject } from "./subjects";

/**
 * Read models for the intelligence drawer, Suggested interpretations and the
 * kept-interpretations register. Every read runs as the signed-in user, so
 * the database decides: kept inferences are readable only by holders of
 * use_architecture_intelligence (OD-11), and the layer-1 dossiers by anyone
 * who reads the engagement's architecture. Nothing here calls a provider.
 */

export type CitationView = { label: string; elementId?: string | null; withheld?: boolean };

export type JudgmentView = {
  kind: string;
  reason: string | null;
  expires_on: string | null;
  judged_by_name: string | null;
  judged_at: string;
  promotion_target_kind: string | null;
  promotion_target_code: string | null;
};

export type InferenceDetail = {
  id: string;
  inference_kind: InferenceKind;
  subject: Record<string, string>;
  assertion: string;
  claims: { text: string; cites: string[] }[];
  uncertainty: string;
  examination: string[];
  payload: Record<string, unknown>;
  provenance: {
    provider_key: string;
    requested_model: string;
    resolved_model: string;
    prompt_version: string;
    generation_policy_version: string;
    tool_contract_version: string;
    requested_at: string;
    kept_at: string | null;
    requested_by_name: string | null;
  };
  state: "current" | "stale" | "superseded";
  stale_reasons: string[];
  citations: Record<string, { label: string; element_id: string | null; record_type: string }>;
  judgments: JudgmentView[];
};

export type Layer2 =
  | { gate: { state: "absent" } }
  | {
      gate: Exclude<GateState, { state: "absent" }>;
      kind: InferenceKind;
      /** The kept interpretation to show: the reusable one, else the newest kept. */
      kept: InferenceDetail | null;
      /** Whether `kept` is reusable now (IX-13, PD-13a): current, same prompt and model. */
      reusable: boolean;
      suppressed: { kind: string; judgedAt: string } | null;
    };

export async function getInferenceDetail(
  engagementId: string,
  inferenceId: string,
): Promise<InferenceDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("architecture_inference_detail", {
    p_engagement_id: engagementId,
    p_inference_id: inferenceId,
  });
  if (error || !data) return null;
  return data as unknown as InferenceDetail;
}

/**
 * Layer 2 of a drawer: the gate (§5.2), the deterministic availability rule
 * (§9), reuse (§16) and suppression (IX-14), all as of now. Absent, with no
 * further read, for anyone without the capability or with AI off.
 */
export async function getLayer2(engagementId: string, subject: DrawerSubject): Promise<Layer2> {
  const d = deployment();
  if (d.mode === "off") return { gate: { state: "absent" } };
  const supabase = await createSupabaseServerClient();
  const store = supabaseStore(supabase);
  const standing = await store.standing(engagementId);
  if (!standing?.canUse) return { gate: { state: "absent" } };

  const kind = kindFor(subject);
  const json = subjectJson(subject);
  const promptVersion = currentPrompt(kind).promptVersion;
  const [availability, monthToDate, reuse] = await Promise.all([
    supabase.rpc("architecture_intelligence_availability", {
      p_engagement_id: engagementId,
      p_kind: kind,
      p_subject: json,
    }),
    store.monthToDateUsd(engagementId),
    d.configured
      ? supabase.rpc("current_architecture_inference", {
          p_engagement_id: engagementId,
          p_kind: kind,
          p_subject: json,
          p_prompt_version: promptVersion,
          p_provider_key: d.configured.providerKey,
          p_requested_model: d.configured.requestedModel,
        })
      : Promise.resolve({ data: [] as { inference_id: string; resolved_model: string }[] }),
  ]);
  const a = availability.data?.[0];
  const evaluated = d.configured
    ? d.isEvaluatedModel(kind, promptVersion, d.configured.providerKey, d.configured.requestedModel)
    : false;
  const gate = composeGate({
    mode: d.mode,
    standing,
    configured: d.configured,
    evaluated,
    provider: d.provider,
    requiredClasses: CONTEXT_PLANS[kind].requiredClasses,
    estimateUsd: d.provider ? requestEstimateUsd(kind, d.provider) : null,
    monthToDateUsd: monthToDate,
    rule: { holds: a?.rule_holds ?? false, reason: a?.reason ?? null },
  });
  if (gate.state === "absent") return { gate };

  // Reuse only an inference whose resolved model is evaluated for this prompt.
  const candidate = reuse.data?.[0];
  const reusableId =
    candidate && d.configured
      ? d.isEvaluatedModel(kind, promptVersion, d.configured.providerKey, candidate.resolved_model)
        ? candidate.inference_id
        : null
      : null;
  const shownId = reusableId ?? a?.latest_inference_id ?? null;
  const kept = shownId ? await getInferenceDetail(engagementId, shownId) : null;
  return {
    gate,
    kind,
    kept,
    reusable: reusableId !== null,
    suppressed:
      a?.suppressed && a.latest_judgment_kind && a.latest_judged_at
        ? { kind: a.latest_judgment_kind, judgedAt: a.latest_judged_at }
        : null,
  };
}

/** Kept interpretations on the Edge's separate section (IX-17); empty for non-holders. */
export async function getSuggestedInterpretations(engagementId: string) {
  if (deployment().mode === "off") return null;
  const supabase = await createSupabaseServerClient();
  const standing = await supabaseStore(supabase).standing(engagementId);
  if (!standing?.canUse) return null;
  const { data, error } = await supabase.rpc("suggested_interpretations", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data;
}

/** The kept-interpretations register (PD-16); null for non-holders and with AI off. */
export async function getKeptRegister(
  engagementId: string,
  filter: { kind?: string | null; state?: string | null },
) {
  if (deployment().mode === "off") return null;
  const supabase = await createSupabaseServerClient();
  const standing = await supabaseStore(supabase).standing(engagementId);
  if (!standing?.canUse) return null;
  const { data, error } = await supabase.rpc("kept_architecture_inferences", {
    p_engagement_id: engagementId,
    p_kind: filter.kind ?? undefined,
    p_state: filter.state ?? undefined,
  });
  if (error) throw error;
  return data;
}

/** Whether the viewer holds use_architecture_intelligence (controls which affordances render). */
export async function viewerUsesIntelligence(engagementId: string): Promise<boolean> {
  if (deployment().mode === "off") return false;
  const supabase = await createSupabaseServerClient();
  const standing = await supabaseStore(supabase).standing(engagementId);
  return standing?.canUse ?? false;
}
