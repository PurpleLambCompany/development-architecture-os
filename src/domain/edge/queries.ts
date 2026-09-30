import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { toEdgeItems, type EdgeItem } from "./items";

/**
 * Development Edge reads (Phase 7A). Every query runs as the signed-in user;
 * the database functions check internal access and return nothing to a
 * client. Nothing here stores a conclusion: items are computed on read.
 */

type Fn<K extends keyof Database["public"]["Functions"]> = Database["public"]["Functions"][K];
export type ImpactTraceRow = Fn<"impact_trace">["Returns"][number];
export type DevelopmentChangeRow = Fn<"development_changes">["Returns"][number];
export type ElementRevisionRow = Fn<"element_revisions">["Returns"][number];
export type PracticeCountRow = Fn<"method_practice_counts">["Returns"][number];

/** All items for an engagement, or those bearing on one subject (as subject, trigger or basis). */
export const getEdgeItems = cache(
  async (
    engagementId: string,
    options: { subjectId?: string; subjectType?: string; includeJudged?: boolean } = {},
  ): Promise<EdgeItem[]> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("edge_items", {
      p_engagement_id: engagementId,
      ...(options.subjectId ? { p_subject_id: options.subjectId } : {}),
      ...(options.subjectType ? { p_subject_type: options.subjectType } : {}),
      ...(options.includeJudged ? { p_include_judged: true } : {}),
    });
    if (error) throw error;
    return toEdgeItems(data);
  },
);

/** The governed impact trace (on demand: Yes and Weak links, evidence, lineage, approvals). */
export async function getImpactTrace(elementId: string): Promise<ImpactTraceRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("impact_trace", {
    p_element_id: elementId,
    p_mode: "on_demand",
  });
  if (error) throw error;
  return data ?? [];
}

export async function getDevelopmentChanges(
  engagementId: string,
  options: { since?: string; until?: string; elementId?: string; limit?: number } = {},
): Promise<DevelopmentChangeRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("development_changes", {
    p_engagement_id: engagementId,
    ...(options.since ? { p_since: options.since } : {}),
    ...(options.until ? { p_until: options.until } : {}),
    ...(options.elementId ? { p_element_id: options.elementId } : {}),
    ...(options.limit ? { p_limit: options.limit } : {}),
  });
  if (error) throw error;
  return data ?? [];
}

export async function getElementRevisions(
  engagementId: string,
  elementId?: string,
): Promise<ElementRevisionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("element_revisions", {
    p_engagement_id: engagementId,
    ...(elementId ? { p_element_id: elementId } : {}),
  });
  if (error) throw error;
  return data ?? [];
}

/** The viewer's own "briefed through" mark on an engagement. RLS returns only their row. */
export async function getBriefingMark(engagementId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("edge_briefing_marks")
    .select("briefed_through")
    .eq("engagement_id", engagementId)
    .maybeSingle();
  if (error) throw error;
  return data?.briefed_through ?? null;
}

export async function getPracticeCounts(assetId: string): Promise<PracticeCountRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("method_practice_counts", { p_asset_id: assetId });
  if (error) throw error;
  return data ?? [];
}

/** What each held or scheduled Review captured, for the Review page. */
export async function getReviewCapture(reviewElementId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("review_examined_versions")
    .select("element_id, element_version_id, captured_at")
    .eq("review_element_id", reviewElementId);
  if (error) throw error;
  return data ?? [];
}
