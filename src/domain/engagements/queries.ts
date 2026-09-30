import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ENGAGEMENT_VIEWS, type EngagementView } from "./catalog";

const listColumns = `id, title, slug, engagement_type, status, current_phase, start_date,
  target_end_date, organizations(id, name, slug)`;

/** Engagements visible to the viewer (RLS decides), optionally filtered by view. */
export async function listEngagements(view?: EngagementView) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("engagements").select(listColumns).order("start_date", {
    ascending: false,
    nullsFirst: false,
  });
  if (view) query = query.in("status", [...ENGAGEMENT_VIEWS[view].statuses]);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getEngagementBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagements")
    .select(
      `id, client_organization_id, title, slug, engagement_type, objective, description,
       methodology_version, status, current_phase, start_date, target_end_date, created_at,
       updated_at, organizations(id, name, slug),
       engagement_members(id, side, role, status, user_id,
         profiles!engagement_members_user_id_fkey(id, first_name, last_name, email))`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type EngagementDetail = NonNullable<Awaited<ReturnType<typeof getEngagementBySlug>>>;

/** Recent audited changes; RLS limits this to administrators and principals. */
export async function listRecentActivity(limit = 8) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select(
      "id, action_type, entity_type, created_at, profiles(first_name, last_name), engagements(title, slug), organizations(name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
