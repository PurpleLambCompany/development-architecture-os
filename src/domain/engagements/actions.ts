"use server";

import { revalidatePath } from "next/cache";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireInternal } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canCreateEngagement } from "@/domain/roles/roles";
import { engagementCreateSchema, engagementUpdateSchema, toEngagementRow } from "./schemas";

export async function createEngagement(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const viewer = await requireInternal();
  if (!canCreateEngagement(viewer.role)) return fail("You do not have permission to do that.");

  const parsed = engagementCreateSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  // No RETURNING: the creator is assigned by a database trigger after the
  // insert, so we read the row back separately (ADR-0003).
  const { error } = await supabase.from("engagements").insert({
    client_organization_id: parsed.data.clientOrganizationId,
    ...toEngagementRow(parsed.data),
  });
  if (error) return fromDatabaseError(error, "slug");

  revalidatePath("/internal", "layout");
  return ok({ slug: parsed.data.slug });
}

export async function updateEngagement(
  engagementId: string,
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  await requireInternal();

  const parsed = engagementUpdateSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagements")
    .update(toEngagementRow(parsed.data))
    .eq("id", engagementId)
    .select("slug");
  if (error) return fromDatabaseError(error, "slug");
  if (!data?.length) return fail("You do not have permission to do that.");

  revalidatePath("/internal", "layout");
  revalidatePath("/portal", "layout");
  return ok({ slug: parsed.data.slug });
}
