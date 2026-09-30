import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Method Library and practice reads. Every query runs as the signed-in user:
 * the read models return nothing to a client, and RLS limits the
 * engagement-scoped ones to internal readers of that engagement. The two
 * client read models return only the release label and title, and agreed
 * acceptance criteria (never the informing Standard).
 */

type Fn = Database["public"]["Functions"];

export type MethodLibraryRow = Fn["method_library"]["Returns"][number];
export type MethodUsageRow = Fn["method_usage"]["Returns"][number];
export type MethodApplicationRegisterRow = Fn["method_application_register"]["Returns"][number];
export type ElementPracticeRow = Fn["element_practice_context"]["Returns"][number];
export type ClientEngagementMethodology = Fn["client_engagement_methodology"]["Returns"][number];
export type ClientAcceptanceCriterionRow = Fn["client_acceptance_criteria"]["Returns"][number];

export const getMethodLibrary = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("method_library");
  if (error) throw error;
  return data ?? [];
});

export const getMethodUsage = cache(async (assetId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("method_usage", { p_asset_id: assetId });
  if (error) throw error;
  return data ?? [];
});

export const getMethodApplicationRegister = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("method_application_register", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
});

export const getElementPracticeContext = cache(async (elementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("element_practice_context", {
    p_element_id: elementId,
  });
  if (error) throw error;
  return data ?? [];
});

export const getClientEngagementMethodology = cache(
  async (engagementId: string): Promise<ClientEngagementMethodology | null> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("client_engagement_methodology", {
      p_engagement_id: engagementId,
    });
    if (error) throw error;
    return data?.[0] ?? null;
  },
);

export const getClientAcceptanceCriteria = cache(async (engagementId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("client_acceptance_criteria", {
    p_engagement_id: engagementId,
  });
  if (error) throw error;
  return data ?? [];
});
