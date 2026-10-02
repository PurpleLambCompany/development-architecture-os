import type { DeliverableFile } from "@/domain/deliverables/queries";
import { FileList } from "@/components/intelligence/file-list";

/**
 * A deliverable's files, grouped by the published version each was attached
 * to, newest first (D9). Earlier versions' files stay listed under their own
 * version; nothing is carried forward to a later one.
 */
export function DeliverableFilesByVersion({
  files,
  currentVersionNo,
}: {
  files: readonly DeliverableFile[];
  currentVersionNo: number | null;
}) {
  const versions = [...new Set(files.map((f) => f.version_no))];
  return (
    <div className="space-y-4">
      {versions.map((versionNo) => {
        const inVersion = files.filter((f) => f.version_no === versionNo);
        return (
          <section key={versionNo} aria-label={`Version ${versionNo} files`}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Version {versionNo}
              {versionNo === currentVersionNo ? " · current" : ""}
            </h3>
            <FileList files={inVersion} />
          </section>
        );
      })}
    </div>
  );
}
