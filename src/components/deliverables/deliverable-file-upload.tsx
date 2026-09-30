"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ALLOWED_FILE_TYPES, ENGAGEMENT_FILES_BUCKET, MAX_FILE_BYTES } from "@/domain/intelligence/catalog";
import { attachDeliverableFile, prepareDeliverableFileUpload } from "@/domain/deliverables/actions";
import { uploadToSignedUrl } from "@/lib/supabase/browser-storage";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const ACCEPT = ALLOWED_FILE_TYPES.join(",");

/**
 * Upload one or more files and attach them to a deliverable's currently
 * published version. The deliverable must already be published: the file
 * documents a specific, immutable version (attach_deliverable_file).
 */
export function DeliverableFileUpload({
  engagementId,
  elementId,
}: {
  engagementId: string;
  elementId: string;
}) {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      noValidate
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const files = (new FormData(form).getAll("files") as File[]).filter((f) => f.size > 0);
        setError(null);
        if (files.length === 0) {
          setError("Choose a file to upload.");
          return;
        }
        startTransition(async () => {
          const ids: string[] = [];
          for (const file of files) {
            if (file.size > MAX_FILE_BYTES) {
              setError(`${file.name} is larger than 25 MB.`);
              return;
            }
            const prepared = await prepareDeliverableFileUpload(engagementId, {
              name: file.name,
              type: file.type,
              size: file.size,
            });
            if (!prepared.ok) {
              setError(prepared.error);
              return;
            }
            const uploaded = await uploadToSignedUrl(
              ENGAGEMENT_FILES_BUCKET,
              prepared.data.path,
              prepared.data.token,
              file,
            );
            if (uploaded.error) {
              setError(`${file.name} could not be uploaded. Please try again.`);
              return;
            }
            ids.push(prepared.data.fileId);
          }
          const attached = await attachDeliverableFile(elementId, { fileIds: ids });
          if (!attached.ok) {
            setError(attached.error);
            return;
          }
          form.reset();
          router.refresh();
        });
      }}
    >
      <Field label="Files" htmlFor={`${id}-files`} hint="PDF, image, text, CSV or Office files up to 25 MB each.">
        <Input id={`${id}-files`} name="files" type="file" multiple accept={ACCEPT} className="max-w-xs" />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Uploading…" : "Attach to this version"}
      </Button>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </form>
  );
}
