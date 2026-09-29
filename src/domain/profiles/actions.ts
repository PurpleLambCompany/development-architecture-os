"use server";

import { revalidatePath } from "next/cache";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { passwordSchema, profileNameSchema } from "./schemas";

export async function updateOwnName(input: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = profileNameSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: parsed.data.firstName, last_name: parsed.data.lastName })
    .eq("id", viewer.id);
  if (error) return fromDatabaseError(error);

  revalidatePath("/", "layout");
  return ok(undefined);
}

export async function setOwnPassword(input: unknown): Promise<ActionResult> {
  await requireViewer();
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message);
  return ok(undefined);
}
