import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * People who may be assigned to an engagement: TPLCo staff plus members
 * of the engagement's client organization. The database re-checks this
 * on insert (validate_engagement_member trigger).
 *
 * A person can belong to several organizations; each person is listed
 * once, as internal if they are TPLCo staff.
 */
export async function listAssignableUsers(clientOrganizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "user_id, role, status, organizations!inner(id, type), profiles!organization_members_user_id_fkey(first_name, last_name, email)",
    )
    .in("status", ["active", "invited"]);
  if (error) throw error;

  return data
    .filter(
      (member) =>
        member.organizations.type === "tplco" || member.organizations.id === clientOrganizationId,
    )
    .map((member) => ({
      userId: member.user_id,
      orgRole: member.role,
      status: member.status,
      side: member.organizations.type === "tplco" ? ("internal" as const) : ("client" as const),
      name: [member.profiles?.first_name, member.profiles?.last_name].filter(Boolean).join(" "),
      email: member.profiles?.email ?? "",
    }))
    .filter(
      (member, index, all) =>
        all.findIndex(
          (other) =>
            other.userId === member.userId &&
            (other.side === "internal" || other.side === member.side),
        ) === index,
    )
    .sort((a, b) => a.side.localeCompare(b.side) || a.name.localeCompare(b.name));
}
