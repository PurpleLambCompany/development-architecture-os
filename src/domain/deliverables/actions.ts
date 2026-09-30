"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";
import { fail, fromDatabaseError, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireViewer } from "@/lib/auth/viewer";
import {
  ALLOWED_FILE_TYPES,
  ENGAGEMENT_FILES_BUCKET,
  MAX_FILE_BYTES,
} from "@/domain/intelligence/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { attachDeliverableFileSchema, createDeliverableSchema, updateDeliverableSchema } from "./schemas";

/**
 * Deliverable server actions. Each validates its input for clear messages
 * and calls one database operation as the signed-in user; the operation
 * checks capabilities and every rule again.
 */

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Work<T> = { data?: T | null; error: PostgrestError | null };

function refresh() {
  revalidatePath("/internal", "layout");
  revalidatePath("/portal", "layout");
}

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  work: (supabase: Supabase, data: z.output<S>) => PromiseLike<Work<T>>,
): Promise<ActionResult<T | undefined>> {
  await requireViewer();
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await work(supabase, parsed.data);
  if (error) return fromDatabaseError(error);
  refresh();
  return ok(data ?? undefined);
}

export async function createDeliverable(engagementId: string, input: unknown) {
  return run(createDeliverableSchema, input, (supabase, v) =>
    supabase.rpc("create_deliverable", {
      p_engagement_id: engagementId,
      p_deliverable_type: v.deliverableType,
      p_title: v.title,
      ...(v.baselineId ? { p_baseline_id: v.baselineId } : {}),
      p_confidential: v.confidential,
      ...(v.summary ? { p_summary: v.summary } : {}),
    }),
  );
}

/** An update or delete that RLS silently filtered out means no permission. */
function expectRow<T>(result: { data: T[] | null; error: PostgrestError | null }): Work<T> {
  if (result.error) return { error: result.error };
  if (!result.data?.length) {
    return {
      error: { code: "42501", message: "No permission", details: "", hint: "", name: "PostgrestError" } as PostgrestError,
    };
  }
  return { data: result.data[0], error: null };
}

/** Direct edit of a deliverable's own working fields (manage_deliverables). */
export async function updateDeliverable(elementId: string, input: unknown) {
  return run(updateDeliverableSchema, input, async (supabase, v) =>
    expectRow(
      await supabase
        .from("deliverables")
        .update({
          deliverable_type: v.deliverableType,
          baseline_id: v.baselineId,
          confidential: v.confidential,
        })
        .eq("element_id", elementId)
        .select("element_id"),
    ),
  );
}

/** Attach already-uploaded files to a deliverable's currently published version. */
export async function attachDeliverableFile(elementId: string, input: unknown) {
  return run(attachDeliverableFileSchema, input, (supabase, v) =>
    supabase.rpc("attach_deliverable_file", { p_element_id: elementId, p_file_ids: v.fileIds }),
  );
}

/**
 * Prepare one deliverable file upload: register it (the database checks
 * manage_deliverables and fixes the storage path), then create a one-time
 * upload URL for that path as the signed-in user. The browser sends the
 * file straight to storage; it is attached with attachDeliverableFile only
 * once it has finished uploading.
 */
export async function prepareDeliverableFileUpload(
  engagementId: string,
  file: { name: string; type: string; size: number },
): Promise<ActionResult<{ fileId: string; path: string; token: string }>> {
  await requireViewer();
  if (!file.name || file.size <= 0) return fail("Choose a file to upload.");
  if (file.size > MAX_FILE_BYTES) return fail(`${file.name} is larger than 25 MB.`);
  if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
    return fail(`${file.name}: upload a PDF, image, text, CSV, Word, Excel or PowerPoint file.`);
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("register_engagement_file", {
    p_engagement_id: engagementId,
    p_purpose: "deliverable",
    p_filename: file.name,
    p_content_type: file.type,
    p_size_bytes: file.size,
  });
  if (error) return fromDatabaseError(error);
  const registered = data?.[0];
  if (!registered) return fail("The file could not be registered.");
  const signed = await supabase.storage
    .from(ENGAGEMENT_FILES_BUCKET)
    .createSignedUploadUrl(registered.object_path);
  if (signed.error || !signed.data) {
    console.error("Signed upload URL failed", signed.error);
    return fail("The file could not be uploaded. Please try again.");
  }
  return ok({ fileId: registered.file_id, path: registered.object_path, token: signed.data.token });
}
