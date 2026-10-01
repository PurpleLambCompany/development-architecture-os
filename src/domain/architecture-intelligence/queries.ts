import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseStore } from "./store";

/**
 * Read models for the Architecture Intelligence page. Metadata only: no
 * query here reads an inference's text (OD-12). Every read runs as the
 * signed-in user, so RLS decides: authorizations for internal readers of the
 * engagement, the request audit for authorizers only.
 */

export async function getArchitectureIntelligenceStanding(engagementId: string) {
  const supabase = await createSupabaseServerClient();
  return supabaseStore(supabase).standing(engagementId);
}

const person = "first_name, last_name, email";

export async function getAuthorizationHistory(engagementId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagement_ai_authorizations")
    .select(
      `id, sequence_no, state, data_classes, provider_key, processing_region, basis_kind, basis_reference, basis_note,
       monthly_budget_usd, effective_from, authorized_at, authorized_by:profiles!engagement_ai_authorizations_authorized_by_fkey(${person})`,
    )
    .eq("engagement_id", engagementId)
    .order("sequence_no", { ascending: false });
  if (error) throw error;
  return data;
}

/** The month's budget position: per engagement, never per person. */
export async function getMonthBudget(engagementId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("architecture_intelligence_budget", {
    p_engagement_id: engagementId,
  });
  if (error) return null;
  return data?.[0] ?? null;
}

/** Recent requests, for authorizers (RLS returns nothing to anyone else). */
export async function getRecentRequests(engagementId: string, limit = 50) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("architecture_intelligence_requests")
    .select(
      `id, requested_at, inference_kind, mode, outcome, prompt_version, resolved_model, input_tokens, output_tokens,
       estimated_cost_usd, requested_by:profiles!architecture_intelligence_requests_requested_by_fkey(${person})`,
    )
    .eq("engagement_id", engagementId)
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** Outcome counts for the current month (UTC), per engagement. */
export async function getMonthOutcomes(engagementId: string, monthStartedAt: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("architecture_intelligence_requests")
    .select("outcome")
    .eq("engagement_id", engagementId)
    .gte("requested_at", monthStartedAt);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of data) counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}
