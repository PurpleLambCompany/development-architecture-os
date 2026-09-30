import { formatFileSize } from "@/domain/intelligence/catalog";

/** Attached files. Each opens through /files, which checks access and signs a short-lived URL. */
export function FileList({
  files,
}: {
  files: readonly { id: string; filename: string; size_bytes: number }[];
}) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {files.map((f) => (
        <li key={f.id}>
          <a
            href={`/files/${f.id}`}
            target="_blank"
            rel="noopener"
            className="text-accent hover:underline"
          >
            {f.filename}
          </a>{" "}
          <span className="text-xs text-ink-subtle">{formatFileSize(f.size_bytes)}</span>
        </li>
      ))}
    </ul>
  );
}
