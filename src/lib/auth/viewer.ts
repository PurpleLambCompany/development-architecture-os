import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { roleSide, type AppRole, type MemberSide } from "@/domain/roles/roles";

export type Viewer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  /** null when the account has no active organization membership. */
  side: MemberSide | null;
  role: AppRole | null;
  organizationId: string | null;
  organizationName: string | null;
  membershipStatus: string | null;
};

/**
 * The signed-in user, their profile and organization role. Cached per
 * request. Used for navigation and to decide which actions to offer;
 * the database still enforces every permission.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, email, status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("role, status, organization_id, organizations(name, status)")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const firstName = profile?.first_name ?? "";
  const lastName = profile?.last_name ?? "";
  const email = profile?.email ?? user.email ?? "";

  // Access requires an active profile, an active membership and an active
  // organization, exactly as the database helpers do.
  const hasAccess =
    profile?.status === "active" &&
    membership?.status === "active" &&
    membership.organizations?.status === "active";

  return {
    id: user.id,
    email,
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(" ") || email,
    side: hasAccess ? roleSide(membership.role) : null,
    role: hasAccess ? membership.role : null,
    organizationId: membership?.organization_id ?? null,
    organizationName: membership?.organizations?.name ?? null,
    membershipStatus: membership?.status ?? null,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export type InternalViewer = Viewer & { side: "internal"; role: AppRole };
export type ClientViewer = Viewer & { side: "client"; role: AppRole; organizationId: string };

export async function requireInternal(): Promise<InternalViewer> {
  const viewer = await requireViewer();
  if (viewer.side !== "internal" || !viewer.role) redirect("/");
  return viewer as InternalViewer;
}

export async function requireClient(): Promise<ClientViewer> {
  const viewer = await requireViewer();
  if (viewer.side !== "client" || !viewer.role || !viewer.organizationId) redirect("/");
  return viewer as ClientViewer;
}

/** Where a viewer lands after signing in. */
export function homePathFor(viewer: Viewer | null): string {
  if (!viewer) return "/login";
  if (viewer.side === "internal") return "/internal";
  if (viewer.side === "client") return "/portal";
  return "/no-access";
}
