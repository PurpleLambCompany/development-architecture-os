"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import {
  ALLOWED_FILE_TYPES,
  ENGAGEMENT_FILES_BUCKET,
  MAX_FILE_BYTES,
  type EngagementFilePurpose,
} from "@/domain/intelligence/catalog";
import { evidenceFileStored, prepareFileUpload } from "@/domain/intelligence/actions";
import { uploadToSignedUrl } from "@/lib/supabase/browser-storage";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";

const ACCEPT = ALLOWED_FILE_TYPES.join(",");

/** Send each chosen file straight to storage; returns the registered file ids. */
async function uploadFiles(
  engagementId: string,
  purpose: EngagementFilePurpose,
  files: File[],
  evidenceSourceId?: string,
): Promise<{ ids: string[]; error: string | null }> {
  const ids: string[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) return { ids, error: `${file.name} is larger than 25 MB.` };
    const prepared = await prepareFileUpload(
      engagementId,
      purpose,
      { name: file.name, type: file.type, size: file.size },
      evidenceSourceId,
    );
    if (!prepared.ok) return { ids, error: prepared.error };
    const { error } = await uploadToSignedUrl(
      ENGAGEMENT_FILES_BUCKET,
      prepared.data.path,
      prepared.data.token,
      file,
    );
    if (error) return { ids, error: `${file.name} could not be uploaded. Please try again.` };
    ids.push(prepared.data.fileId);
  }
  return { ids, error: null };
}

/**
 * A written response or input with an optional link and files. Files go
 * straight to storage first; the words are sent with the stored files' ids,
 * and the database attaches only files this person registered.
 */
export function UploadForm({
  engagementId,
  purpose,
  action,
  bodyLabel,
  submitLabel,
  trigger,
  hint,
}: {
  engagementId: string;
  purpose: Exclude<EngagementFilePurpose, "evidence">;
  action: (input: {
    body: string;
    linkUrl: string;
    fileIds: string[];
  }) => Promise<ActionResult<unknown>>;
  bodyLabel: string;
  submitLabel: string;
  trigger?: string;
  hint?: string;
}) {
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(!trigger);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-4 rounded-sm border border-rule bg-surface px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const body = String(data.get("body") ?? "");
        const linkUrl = String(data.get("linkUrl") ?? "");
        const files = (data.getAll("files") as File[]).filter((f) => f.size > 0);
        setError(null);
        setFieldErrors({});
        startTransition(async () => {
          if (!body.trim()) {
            setFieldErrors({ body: "Write something before sending." });
            return;
          }
          const uploaded = await uploadFiles(engagementId, purpose, files);
          if (uploaded.error) {
            setError(uploaded.error);
            return;
          }
          const result = await action({ body, linkUrl, fileIds: uploaded.ids });
          if (!result.ok) {
            setError(result.error);
            setFieldErrors(result.fieldErrors ?? {});
            return;
          }
          formRef.current?.reset();
          if (trigger) setOpen(false);
          router.refresh();
        });
      }}
    >
      <Field label={bodyLabel} htmlFor={`${id}-body`} hint={hint} error={fieldErrors.body}>
        <Textarea id={`${id}-body`} name="body" rows={5} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Link"
          htmlFor={`${id}-link`}
          hint="Optional. An https link to a document."
          error={fieldErrors.linkUrl}
        >
          <Input id={`${id}-link`} name="linkUrl" type="url" placeholder="https://" />
        </Field>
        <Field
          label="Files"
          htmlFor={`${id}-files`}
          hint="Optional. PDF, image, text, CSV or Office files up to 25 MB each."
          error={fieldErrors.fileIds}
        >
          <Input id={`${id}-files`} name="files" type="file" multiple accept={ACCEPT} />
        </Field>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : submitLabel}
        </Button>
        {trigger ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** Upload files to an evidence source (internal editors). */
export function EvidenceFileUpload({
  engagementId,
  evidenceSourceId,
}: {
  engagementId: string;
  evidenceSourceId: string;
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
          const uploaded = await uploadFiles(engagementId, "evidence", files, evidenceSourceId);
          if (uploaded.error) setError(uploaded.error);
          else form.reset();
          await evidenceFileStored();
          router.refresh();
        });
      }}
    >
      <label htmlFor={`${id}-files`} className="sr-only">
        Evidence files
      </label>
      <Input
        id={`${id}-files`}
        name="files"
        type="file"
        multiple
        accept={ACCEPT}
        className="max-w-xs"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </form>
  );
}
