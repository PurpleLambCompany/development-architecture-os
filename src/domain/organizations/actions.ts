"use server";

import { revalidatePath } from "next/cache";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireInternal } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageClientDirectory } from "@/domain/roles/roles";
import { organizationInputSchema, organizationUpdateSchema } from "./schemas";

export async function createClientOrganization(
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const viewer = await requireInternal();
  if (!canManageClientDirectory(viewer.role)) return fail("You do not have permission to do that.");

  const parsed = organizationInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .insert({ name: parsed.data.name, slug: parsed.data.slug, type: "client" });
  if (error) return fromDatabaseError(error, "slug");

  revalidatePath("/internal/organizations");
  return ok({ slug: parsed.data.slug });
}

export async function updateOrganization(
  organizationId: string,
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  await requireInternal();

  const parsed = organizationUpdateSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", organizationId)
    .select("slug");
  if (error) return fromDatabaseError(error, "slug");
  // RLS filters rows the viewer may not update, so zero rows means denied.
  if (!data?.length) return fail("You do not have permission to do that.");

  revalidatePath("/internal/organizations");
  return ok({ slug: parsed.data.slug });
}
