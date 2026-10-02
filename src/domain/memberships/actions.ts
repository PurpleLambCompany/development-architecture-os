"use server";

import { revalidatePath } from "next/cache";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireInternal, type InternalViewer } from "@/lib/auth/viewer";
import { publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyPracticeCapabilities } from "@/domain/methodology/queries";
import {
  ROLE_LABELS,
  canManageClientDirectory,
  createsArchitectureAuthority,
  roleSide,
  type AppRole,
} from "@/domain/roles/roles";
import { assignEngagementMemberSchema, inviteMemberSchema, updateMemberSchema } from "./schemas";

/**
 * Who may manage an organization's members. TPLCo staff are managed by
 * holders of administer_practice (D1); client members by client-directory
 * managers. Only a Principal Architect gives anyone architectural
 * authority (D2), and nobody acts on themselves (D5). These checks only
 * choose the message; the database enforces every rule
 * (private.guard_practice_membership and the membership policy).
 */
async function membershipRefusal(
  viewer: InternalViewer,
  organizationType: string,
  change: {
    userId: string | null;
    before: { role: AppRole; status: string } | null;
    after: { role: AppRole; status: string } | null;
  },
): Promise<string | null> {
  if (organizationType !== "tplco") {
    return canManageClientDirectory(viewer.role) ? null : "You do not have permission to do that.";
  }
  const { canAdminister } = await getMyPracticeCapabilities();
  if (!canAdminister) return "Only a practice administrator can manage TPLCo staff.";
  if (change.userId === viewer.id) return "You cannot change your own role or status.";
  if (
    change.after &&
    createsArchitectureAuthority(change.before, change.after) &&
    viewer.role !== "principal_architect"
  ) {
    return change.before && change.before.role === change.after.role
      ? "Only a Principal Architect can restore someone who holds architectural authority."
      : `Only a Principal Architect can make someone ${articled(ROLE_LABELS[change.after.role])}.`;
  }
  return null;
}

function articled(label: string): string {
  return /^[AEIOU]/.test(label) ? `an ${label}` : `a ${label}`;
}

function revalidateOrganization(slug: string | undefined) {
  revalidatePath(`/internal/organizations/${slug ?? ""}`);
  revalidatePath("/internal/settings/practice");
}

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

  const expectedSide = organization.type === "tplco" ? "internal" : "client";
  if (roleSide(role) !== expectedSide) {
    return fail("Choose a role that matches this organization.", {
      role: expectedSide === "internal" ? "Choose an internal role" : "Choose a client role",
    });
  }

  // Mirror the database rules so we never create an account we cannot attach.
  const refusal = await membershipRefusal(viewer, organization.type, {
    userId: null,
    before: null,
    after: { role, status: "invited" },
  });
  if (refusal) return fail(refusal);

  // A person may belong to several organizations (for example a consultant
  // advising two clients). If they already have an account, add the new
  // membership instead of sending another invitation.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (existing) {
    if (existing.id === viewer.id) return fail("You cannot change your own role or status.");
    return addExistingPerson(organization, existing, role);
  }

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

  revalidateOrganization(organization.slug);
  return ok({ outcome: "invited" as const });
}

/** Change a member's role or status (suspend, restore). */
export async function updateOrganizationMember(
  memberId: string,
  input: unknown,
): Promise<ActionResult> {
  const viewer = await requireInternal();

  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id, role, status, organizations(type, slug)")
    .eq("id", memberId)
    .maybeSingle();
  if (!member?.organizations) return fail("That member was not found.");

  if (roleSide(parsed.data.role) !== roleSide(member.role)) {
    return fail("Choose a role that matches this organization.");
  }
  const refusal = await membershipRefusal(viewer, member.organizations.type, {
    userId: member.user_id,
    before: { role: member.role, status: member.status },
    after: parsed.data,
  });
  if (refusal) return fail(refusal);

  const { data, error } = await supabase
    .from("organization_members")
    .update(parsed.data)
    .eq("id", memberId)
    .select("id");
  if (error) return fromDatabaseError(error);
  if (!data?.length) return fail("You do not have permission to do that.");

  revalidateOrganization(member.organizations.slug);
  revalidatePath("/internal", "layout");
  return ok(undefined);
}

/**
 * Send a fresh invitation email for a pending membership (A5). The viewer's
 * own session first proves they may manage the membership: a no-op write
 * that RLS and the membership guard must accept, and that records who
 * re-sent it. Only then is the service role used to send the email.
 */
export async function resendInvitation(memberId: string): Promise<ActionResult> {
  const viewer = await requireInternal();

  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select(
      "user_id, role, status, organizations(type, slug), profiles!organization_members_user_id_fkey(email)",
    )
    .eq("id", memberId)
    .maybeSingle();
  if (!member?.organizations || !member.profiles) return fail("That invitation was not found.");
  if (member.status !== "invited") return fail("Only a pending invitation can be re-sent.");

  const refusal = await membershipRefusal(viewer, member.organizations.type, {
    userId: member.user_id,
    before: { role: member.role, status: member.status },
    after: null,
  });
  if (refusal) return fail(refusal);

  const { data: touched, error } = await supabase
    .from("organization_members")
    .update({ status: "invited" })
    .eq("id", memberId)
    .eq("status", "invited")
    .select("id");
  if (error) return fromDatabaseError(error);
  if (!touched?.length) return fail("You do not have permission to do that.");

  const admin = createSupabaseAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(member.profiles.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
  });
  if (inviteError) {
    console.error("Invitation resend failed", inviteError);
    return fail(
      "The invitation could not be sent. If this person has already signed in, they can use a sign-in link instead.",
    );
  }

  revalidateOrganization(member.organizations.slug);
  return ok(undefined);
}

/**
 * Withdraw a pending invitation (A5). The membership is deleted with the
 * viewer's own session, so RLS and the membership guard decide (only
 * invited rows can be deleted). If the person then belongs nowhere and has
 * never signed in, their account is removed too, so the emailed link no
 * longer works.
 */
export async function revokeInvitation(memberId: string): Promise<ActionResult> {
  const viewer = await requireInternal();

  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id, role, status, organizations(type, slug)")
    .eq("id", memberId)
    .maybeSingle();
  if (!member?.organizations) return fail("That invitation was not found.");
  if (member.status !== "invited") {
    return fail("Only a pending invitation can be revoked; suspend an accepted member instead.");
  }
  const refusal = await membershipRefusal(viewer, member.organizations.type, {
    userId: member.user_id,
    before: { role: member.role, status: member.status },
    after: null,
  });
  if (refusal) return fail(refusal);

  const { data: removed, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("status", "invited")
    .select("id");
  if (error) return fromDatabaseError(error);
  if (!removed?.length) return fail("You do not have permission to do that.");

  const { data: remaining } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", member.user_id)
    .limit(1);
  if (!remaining?.length) {
    const admin = createSupabaseAdminClient();
    const { data: account } = await admin.auth.admin.getUserById(member.user_id);
    if (account.user && !account.user.last_sign_in_at) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(member.user_id);
      if (deleteError) console.error("Removing a revoked invitee's account failed", deleteError);
    }
  }

  revalidateOrganization(member.organizations.slug);
  return ok(undefined);
}

/**
 * Add someone to an engagement team. An internal person's engagement role
 * is their practice role (D3) and is taken from their TPLCo membership,
 * never from the form; the database enforces the same rule.
 */
export async function assignEngagementMember(
  engagementId: string,
  input: unknown,
): Promise<ActionResult> {
  await requireInternal();

  const parsed = assignEngagementMemberSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: practice } = await supabase
    .from("organization_members")
    .select("role, status, organizations!inner(type)")
    .eq("user_id", parsed.data.userId)
    .eq("organizations.type", "tplco")
    .maybeSingle();

  let role: AppRole;
  if (practice) {
    if (practice.status !== "active") {
      return fail("Only someone who has accepted their invitation can join an engagement.");
    }
    role = practice.role;
  } else if (parsed.data.role) {
    role = parsed.data.role;
  } else {
    return fail("Choose a role.", { role: "Choose a role" });
  }

  const { error } = await supabase.from("engagement_members").insert({
    engagement_id: engagementId,
    user_id: parsed.data.userId,
    role,
    side: roleSide(role),
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
 * memberships, when they accept (or after a re-sent invitation).
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

  revalidateOrganization(organization.slug);
  return ok({ outcome: "added" as const });
}
