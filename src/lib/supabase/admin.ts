import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Service-role client. Bypasses RLS.
 *
 * Used ONLY to create and remove auth accounts during invitations
 * (see domain/memberships/actions.ts). Never use it to read or write
 * application data: that must go through the user-scoped client so
 * RLS decides what is allowed. See ADR-0005.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
