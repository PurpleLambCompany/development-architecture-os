import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ENGAGEMENT_FILES_BUCKET } from "@/domain/intelligence/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Download an engagement file. The file row is read as the signed-in user,
 * so row-level security decides whether it exists for them (TPLCo readers;
 * the uploader; clients who can see the response or input it belongs to).
 * The storage policy checks the same rule again when the short-lived link
 * is created. Anyone else gets 404.
 */
export async function GET(_request: NextRequest, context: RouteContext<"/files/[fileId]">) {
  const { fileId } = await context.params;
  if (!z.uuid().safeParse(fileId).success) return new NextResponse(null, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data: file } = await supabase
    .from("engagement_files")
    .select("object_path, filename")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return new NextResponse(null, { status: 404 });
  const { data, error } = await supabase.storage
    .from(ENGAGEMENT_FILES_BUCKET)
    .createSignedUrl(file.object_path, 60, { download: file.filename });
  if (error || !data) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
