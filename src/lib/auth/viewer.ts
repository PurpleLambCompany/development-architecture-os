import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { roleSide, type AppRole, type MemberSide } from "@/domain/roles/roles";

export type ViewerMembership = {
  organizationId: string;
  organizationName: string;
  role: AppRole;
  side: MemberSide;
};

export type Viewer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  /** Active memberships in active organizations. A person may belong to several. */
  memberships: ViewerMembership[];
  /**
   * internal when the person has an active TPLCo membership, client when
   * they only have client memberships, null when they have none.
   */
  side: MemberSide | null;
  /** The TPLCo role for internal users; null for client users, whose role is per organization. */
  internalRole: AppRole | null;
};

/**
 * The signed-in user, their profile and organization memberships. Cached per
 * request. Used for navigation and to decide which actions to offer; the
 * database still enforces every permission.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, email, status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("role, status, organization_id, organizations(name, status)")
      .eq("user_id", user.id),
  ]);

  const firstName = profile?.first_name ?? "";
  const lastName = profile?.last_name ?? "";
  const email = profile?.email ?? user.email ?? "";

  // Access requires an active profile, an active membership and an active
  // organization, exactly as the database helpers do.
  const memberships: ViewerMembership[] =
    profile?.status === "active"
      ? (rows ?? [])
          .filter((m) => m.status === "active" && m.organizations?.status === "active")
          .map((m) => ({
            organizationId: m.organization_id,
            organizationName: m.organizations?.name ?? "",
            role: m.role,
            side: roleSide(m.role),
          }))
      : [];

  const internal = memberships.find((m) => m.side === "internal");

  return {
    id: user.id,
    email,
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(" ") || email,
    memberships,
    side: internal ? "internal" : memberships.length > 0 ? "client" : null,
    internalRole: internal?.role ?? null,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export type InternalViewer = Viewer & {
  side: "internal";
  /** The viewer's TPLCo role. */
  role: AppRole;
  organizationName: string;
};
export type ClientViewer = Viewer & { side: "client" };

export async function requireInternal(): Promise<InternalViewer> {
  const viewer = await requireViewer();
  const internal = viewer.memberships.find((m) => m.side === "internal");
  if (viewer.side !== "internal" || !internal) redirect("/");
  return {
    ...viewer,
    side: "internal",
    role: internal.role,
    organizationName: internal.organizationName,
  };
}

export async function requireClient(): Promise<ClientViewer> {
  const viewer = await requireViewer();
  if (viewer.side !== "client") redirect("/");
  return viewer as ClientViewer;
}

/** Where a viewer lands after signing in. */
export function homePathFor(viewer: Viewer | null): string {
  if (!viewer) return "/login";
  if (viewer.side === "internal") return "/internal";
  if (viewer.side === "client") return "/portal";
  return "/no-access";
}
