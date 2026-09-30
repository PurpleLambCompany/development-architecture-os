import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { METHOD_LIBRARY_BUCKET } from "@/domain/methodology/files";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Download a protected Method Library file. The file row is read as the
 * signed-in user, so row-level security decides whether it exists for them
 * (active TPLCo members only); the storage policy checks again when the
 * short-lived link is created. Clients and anyone else get 404.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/internal/method-library/files/[fileId]">,
) {
  const { fileId } = await context.params;
  if (!z.uuid().safeParse(fileId).success) return new NextResponse(null, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data: file } = await supabase
    .from("method_version_files")
    .select("object_path, file_name")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return new NextResponse(null, { status: 404 });
  const { data, error } = await supabase.storage
    .from(METHOD_LIBRARY_BUCKET)
    .createSignedUrl(file.object_path, 60, { download: file.file_name });
  if (error || !data) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
