import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { RegisterRow } from "./register";

/**
 * Project Intelligence reads. Every query runs as the signed-in user:
 * row-level security and the read models decide what comes back. Internal
 * readers see stewardship, history, escalations, signals and every request;
 * clients see only the requests and input the database lets them see.
 */

type Tables = Database["public"]["Tables"];
type Row<T extends keyof Tables> = Tables[T]["Row"];

export type SignalRow = Database["public"]["Functions"]["intelligence_signals"]["Returns"][number];
export type HistoryRow = Database["public"]["Functions"]["intelligence_history"]["Returns"][number];
export type ImpactRow = Database["public"]["Functions"]["intelligence_impact"]["Returns"][number];
export type EscalationRow = Row<"intelligence_escalations">;
export type StewardshipRow = Row<"intelligence_stewardship">;
export type EngagementFileRow = Row<"engagement_files">;
export type AreaRow = Row<"engagement_member_areas">;

/** Every record the viewer may read: one engagement, or all of them (internal only). */
export const getRegister = cache(async (engagementId: string | null): Promise<RegisterRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "intelligence_register",
    engagementId ? { p_engagement_id: engagementId } : {},
  );
  if (error) throw error;
  return (data ?? []) as unknown as RegisterRow[];
});

/** Signals for an engagement (internal only), optionally with dismissed ones. */
export const getSignals = cache(async (engagementId: string, includeDismissed = false) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("intelligence_signals", {
    p_engagement_id: engagementId,
    p_include_dismissed: includeDismissed,
  });
  if (error) throw error;
  return data ?? [];
});

export async function getStewardship(elementId: string): Promise<StewardshipRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("intelligence_stewardship")
    .select("*")
    .eq("element_id", elementId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRecordHistory(elementId: string): Promise<HistoryRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("intelligence_history", { p_element_id: elementId });
  if (error) throw error;
  return data ?? [];
}

export async function getImpact(elementId: string, depth = 3): Promise<ImpactRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("intelligence_impact", {
    p_element_id: elementId,
    p_depth: depth,
  });
  if (error) throw error;
  return data ?? [];
}

/** Escalations of an engagement, or open ones across every engagement the viewer reads. */
export const getEscalations = cache(async (engagementId: string | null, openOnly = false) => {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("intelligence_escalations")
    .select(
      "*, architecture_elements(id, kind, reference_code, title), engagements(slug, title), client_actions(id, reference_code, status)",
    )
    .order("raised_at", { ascending: false });
  if (engagementId) query = query.eq("engagement_id", engagementId);
  if (openOnly) query = query.is("resolved_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
});

export type LoadedEscalation = Awaited<ReturnType<typeof getEscalations>>[number];

/** Client requests of an engagement with subjects, responses, events and files (RLS decides). */
export const getClientActions = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const [actions, subjects, responses, events, files] = await Promise.all([
    supabase
      .from("client_actions")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("sent_at", { ascending: false }),
    supabase.from("client_action_subjects").select("*").eq("engagement_id", engagementId),
    supabase
      .from("client_action_responses")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("responded_at"),
    supabase
      .from("client_action_events")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("created_at"),
    supabase
      .from("engagement_files")
      .select("*")
      .eq("engagement_id", engagementId)
      .not("client_action_response_id", "is", null),
  ]);
  for (const r of [actions, subjects, responses, events, files]) if (r.error) throw r.error;
  return (actions.data ?? []).map((action) => ({
    ...action,
    subjects: (subjects.data ?? [])
      .filter((s) => s.action_id === action.id)
      .map((s) => s.element_id),
    responses: (responses.data ?? [])
      .filter((r) => r.action_id === action.id)
      .map((response) => ({
        ...response,
        files: (files.data ?? []).filter((f) => f.client_action_response_id === response.id),
      })),
    events: (events.data ?? []).filter((e) => e.action_id === action.id),
  }));
});

export type LoadedClientAction = Awaited<ReturnType<typeof getClientActions>>[number];

/** Client input on an engagement (or one element), with files (RLS decides). */
export const getContributions = cache(async (engagementId: string, elementId?: string) => {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("client_contributions")
    .select("*")
    .eq("engagement_id", engagementId)
    .order("submitted_at", { ascending: false });
  if (elementId) query = query.eq("element_id", elementId);
  const [contributions, files] = await Promise.all([
    query,
    supabase
      .from("engagement_files")
      .select("*")
      .eq("engagement_id", engagementId)
      .not("client_contribution_id", "is", null),
  ]);
  if (contributions.error) throw contributions.error;
  if (files.error) throw files.error;
  return (contributions.data ?? []).map((c) => ({
    ...c,
    files: (files.data ?? []).filter((f) => f.client_contribution_id === c.id),
  }));
});

export type LoadedContribution = Awaited<ReturnType<typeof getContributions>>[number];

/** Contributor areas of an engagement: every one for internal readers, a client's own otherwise. */
export const getMemberAreas = cache(async (engagementId: string): Promise<AreaRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagement_member_areas")
    .select("*")
    .eq("engagement_id", engagementId)
    .order("assigned_at");
  if (error) throw error;
  return data ?? [];
});

/** Files attached to evidence sources of an engagement (internal only by RLS). */
export async function getEvidenceFiles(engagementId: string): Promise<EngagementFileRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagement_files")
    .select("*")
    .eq("engagement_id", engagementId)
    .not("evidence_source_id", "is", null)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

/** Statements of an engagement, for citing client words as evidence (internal only by RLS). */
export const getStatementOptions = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("architecture_statements")
    .select("id, element_id, body, sort_order")
    .eq("engagement_id", engagementId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
});
