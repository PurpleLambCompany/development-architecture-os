import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * People who may be assigned to an engagement: active TPLCo staff plus
 * active members of the engagement's client organization. Invited and
 * suspended people are not offered (V1-A A3, A5). The database re-checks
 * membership, and that an internal person's engagement role is their
 * practice role, on insert (validate_engagement_member trigger).
 *
 * A person can belong to several organizations; each person is listed
 * once, as internal if they are TPLCo staff.
 */
export async function listAssignableUsers(clientOrganizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "user_id, role, status, organizations!inner(id, type), profiles!organization_members_user_id_fkey(first_name, last_name, email, status)",
    )
    .eq("status", "active");
  if (error) throw error;

  return data
    .filter(
      (member) =>
        member.profiles?.status === "active" &&
        (member.organizations.type === "tplco" || member.organizations.id === clientOrganizationId),
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
