import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Organizations the viewer may see (RLS decides). TPLCo first. */
export async function listOrganizations() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, type, status, created_at, organization_members(count), engagements(count)",
    )
    .order("type", { ascending: false })
    .order("name");
  if (error) throw error;
  return data.map((org) => ({
    ...org,
    memberCount: org.organization_members[0]?.count ?? 0,
    engagementCount: org.engagements[0]?.count ?? 0,
  }));
}

export async function listClientOrganizations() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("type", "client")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data;
}

export async function getOrganizationBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(
      `id, name, slug, type, status, created_at,
       organization_members(id, role, status, created_at, updated_at,
         profiles!organization_members_user_id_fkey(id, first_name, last_name, email, status)),
       engagements(id, title, slug, status, engagement_type, start_date, target_end_date)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}
