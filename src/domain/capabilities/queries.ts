import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EngagementCapability } from "./catalog";

/** The signed-in person's effective capabilities on an engagement (evaluated in the database). */
export async function getMyEngagementCapabilities(
  engagementId: string,
): Promise<Set<EngagementCapability>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_engagement_capabilities", {
    target_engagement_id: engagementId,
  });
  if (error) throw error;
  return new Set(data ?? []);
}

/** Overrides on an engagement that the viewer may see (RLS decides). */
export async function listCapabilityOverrides(engagementId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagement_member_capability_overrides")
    .select("engagement_member_id, capability, granted, reason")
    .eq("engagement_id", engagementId);
  if (error) throw error;
  return data;
}
