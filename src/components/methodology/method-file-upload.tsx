"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { prepareMethodFileUpload } from "@/domain/methodology/actions";
import {
  METHOD_FILE_MAX_BYTES,
  METHOD_FILE_TYPES,
  METHOD_LIBRARY_BUCKET,
} from "@/domain/methodology/files";
import { uploadToSignedUrl } from "@/lib/supabase/browser-storage";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Upload protected practitioner files to a draft Instrument or Template
 * version. The operation registers the path; only its author may upload to
 * it, and only while the version is a draft.
 */
export function MethodFileUpload({ versionId }: { versionId: string }) {
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
          for (const file of files) {
            if (file.size > METHOD_FILE_MAX_BYTES) {
              setError(`${file.name} is larger than 25 MB.`);
              return;
            }
            const prepared = await prepareMethodFileUpload(versionId, {
              fileName: file.name,
              contentType: file.type,
              sizeBytes: file.size,
            });
            if (!prepared.ok || !prepared.data) {
              setError(prepared.ok ? "The file could not be registered." : prepared.error);
              return;
            }
            const uploaded = await uploadToSignedUrl(
              METHOD_LIBRARY_BUCKET,
              prepared.data.path,
              prepared.data.token,
              file,
            );
            if (uploaded.error) {
              setError(`${file.name} could not be uploaded. Please try again.`);
              return;
            }
          }
          form.reset();
          router.refresh();
        });
      }}
    >
      <Field
        label="Files"
        htmlFor={`${id}-files`}
        hint="PDF, text, CSV or Office files up to 25 MB each."
      >
        <Input
          id={`${id}-files`}
          name="files"
          type="file"
          multiple
          accept={METHOD_FILE_TYPES.join(",")}
          className="max-w-xs"
        />
      </Field>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Uploading…" : "Attach to this draft"}
      </Button>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </form>
  );
}
