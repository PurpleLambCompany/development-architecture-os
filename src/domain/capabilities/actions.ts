"use server";

import { revalidatePath } from "next/cache";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireInternal } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setCapabilitySchema } from "./schemas";

/**
 * Grant or revoke one capability for one engagement member, or return it
 * to the role default. The role definition is never changed. RLS
 * (private.can_manage_capability) decides whether the viewer may do this.
 */
export async function setMemberCapability(input: unknown): Promise<ActionResult> {
  await requireInternal();

  const parsed = setCapabilitySchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  const { memberId, capability, setting, reason } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: member } = await supabase
    .from("engagement_members")
    .select("engagement_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return fail("You do not have permission to do that.");

  if (setting === "default") {
    const { data, error } = await supabase
      .from("engagement_member_capability_overrides")
      .delete()
      .eq("engagement_member_id", memberId)
      .eq("capability", capability)
      .select("id");
    if (error) return fromDatabaseError(error);
    if (!data?.length) {
      // Either there was no override, or RLS refused the delete.
      const { count } = await supabase
        .from("engagement_member_capability_overrides")
        .select("id", { count: "exact", head: true })
        .eq("engagement_member_id", memberId)
        .eq("capability", capability);
      if (count) return fail("You do not have permission to do that.");
    }
  } else {
    const { error } = await supabase.from("engagement_member_capability_overrides").upsert(
      {
        engagement_member_id: memberId,
        engagement_id: member.engagement_id,
        capability,
        granted: setting === "grant",
        reason,
      },
      { onConflict: "engagement_member_id,capability" },
    );
    if (error) return fromDatabaseError(error);
  }

  revalidatePath("/internal", "layout");
  revalidatePath("/portal", "layout");
  return ok(undefined);
}
