"use client";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Upload a file to a one-time signed upload URL created by the server
 * (prepareFileUpload). The token alone authorizes this one path; the browser
 * client holds no session and can do nothing else.
 */
export async function uploadToSignedUrl(
  bucket: string,
  path: string,
  token: string,
  file: File,
): Promise<{ error: string | null }> {
  const client = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file, { contentType: file.type });
  return { error: error ? error.message : null };
}
