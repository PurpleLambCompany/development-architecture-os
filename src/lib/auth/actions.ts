"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Required"),
});

const magicLinkSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
});

export async function signInWithPassword(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Same message for unknown email and wrong password.
  if (error) return fail("The email or password is incorrect.");
  return ok(undefined);
}

/**
 * Sends a one-time sign-in link to existing accounts only (DSA OS is
 * invite-only). The response is identical whether or not the account
 * exists, so this cannot be used to discover who has access.
 */
export async function sendMagicLink(input: unknown): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });
  if (error && error.status !== 400 && error.status !== 422) {
    console.error("Magic link failed", error);
  }
  return ok(undefined);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
