import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "magiclink", "recovery", "email"];

/** Only allow redirects to local paths. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/**
 * Landing route for invitation, sign-in and recovery emails. Verifies the
 * one-time token server-side, establishes the session cookie, and
 * activates a pending invitation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  // Redirect on the canonical site origin (the one the email linked to), not
  // whatever host the server saw, so the new session cookie is sent back.
  const failure = new URL("/login?error=link", publicEnv.NEXT_PUBLIC_SITE_URL);

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(failure);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(failure);

  // Proving control of the invited address activates the membership.
  await supabase.rpc("accept_invitation");

  return NextResponse.redirect(new URL(next, publicEnv.NEXT_PUBLIC_SITE_URL));
}
