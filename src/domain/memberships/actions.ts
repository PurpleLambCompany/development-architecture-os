"use server";

import { revalidatePath } from "next/cache";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireInternal } from "@/lib/auth/viewer";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canManageClientDirectory,
  canManageInternalStaff,
  roleSide,
  type AppRole,
} from "@/domain/roles/roles";
import { assignEngagementMemberSchema, inviteMemberSchema, updateMemberSchema } from "./schemas";

/**
 * Invite a new person into an organization.
 *
 * The service-role client is used for one thing only: creating the auth
 * account and sending the invitation email. The membership itself is
 * written with the viewer's own session, so RLS decides whether the
 * viewer may add people to this organization. If RLS refuses, the auth
 * account is removed again. See ADR-0005.
 */
export async function inviteOrganizationMember(
  organizationId: string,
  input: unknown,
): Promise<ActionResult<{ outcome: "invited" | "added" }>> {
  const viewer = await requireInternal();

  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { email, firstName, lastName, role } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, type, slug")
    .eq("id", organizationId)
    .maybeSingle();
  if (!organization) return fail("Organization not found.");

  // Mirror the database rules so we never create an account we cannot attach.
  const allowed =
    organization.type === "tplco"
      ? canManageInternalStaff(viewer.role)
      : canManageClientDirectory(viewer.role);
  if (!allowed) return fail("You do not have permission to do that.");

  const expectedSide = organization.type === "tplco" ? "internal" : "client";
  if (roleSide(role) !== expectedSide) {
    return fail("Choose a role that matches this organization.", {
      role: expectedSide === "internal" ? "Choose an internal role" : "Choose a client role",
    });
  }

  // A person may belong to several organizations (for example a consultant
  // advising two clients). If they already have an account, add the new
  // membership instead of sending another invitation.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (existing) return addExistingPerson(organization, existing, role);

  const admin = createSupabaseAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { first_name: firstName, last_name: lastName },
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
  });
  if (inviteError || !invited.user) {
    console.error("Invitation failed", inviteError);
    return fail("The invitation could not be sent. Please try again.");
  }

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: organization.id,
    user_id: invited.user.id,
    role,
    status: "invited",
  });
  if (memberError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return fromDatabaseError(memberError);
  }

  revalidatePath(`/internal/organizations/${organization.slug}`);
  return ok({ outcome: "invited" as const });
}

export async function updateOrganizationMember(
  memberId: string,
  input: unknown,
): Promise<ActionResult> {
  await requireInternal();

  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_members")
    .update(parsed.data)
    .eq("id", memberId)
    .select("organizations(slug)");
  if (error) return fromDatabaseError(error);
  if (!data?.length) return fail("You do not have permission to do that.");

  revalidatePath(`/internal/organizations/${data[0]?.organizations?.slug ?? ""}`);
  return ok(undefined);
}

export async function assignEngagementMember(
  engagementId: string,
  input: unknown,
): Promise<ActionResult> {
  await requireInternal();

  const parsed = assignEngagementMemberSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("engagement_members").insert({
    engagement_id: engagementId,
    user_id: parsed.data.userId,
    role: parsed.data.role,
    side: roleSide(parsed.data.role),
  });
  if (error) {
    if (error.code === "23505") return fail("This person is already on the engagement.");
    return fromDatabaseError(error);
  }

  revalidatePath("/internal", "layout");
  revalidatePath("/portal", "layout");
  return ok(undefined);
}

export async function removeEngagementMember(memberId: string): Promise<ActionResult> {
  await requireInternal();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagement_members")
    .delete()
    .eq("id", memberId)
    .select("id");
  if (error) return fromDatabaseError(error);
  if (!data?.length) return fail("You do not have permission to do that.");

  revalidatePath("/internal", "layout");
  revalidatePath("/portal", "layout");
  return ok(undefined);
}

/**
 * Add someone who already has an account to another organization. If they
 * have already accepted an invitation elsewhere the membership is active
 * at once; otherwise it stays invited and is activated, with their other
 * memberships, when they accept.
 */
async function addExistingPerson(
  organization: { id: string; slug: string },
  person: { id: string; status: string },
  role: AppRole,
): Promise<ActionResult<{ outcome: "invited" | "added" }>> {
  const supabase = await createSupabaseServerClient();
  const { data: activeElsewhere } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", person.id)
    .eq("status", "active")
    .limit(1);
  const alreadyAccepted = person.status === "active" && (activeElsewhere?.length ?? 0) > 0;

  const { error } = await supabase.from("organization_members").insert({
    organization_id: organization.id,
    user_id: person.id,
    role,
    status: alreadyAccepted ? "active" : "invited",
  });
  if (error) {
    if (error.code === "23505") {
      return fail("This person is already a member of this organization.", {
        email: "Already a member",
      });
    }
    return fromDatabaseError(error);
  }

  revalidatePath(`/internal/organizations/${organization.slug}`);
  return ok({ outcome: "added" as const });
}
