import type { ReactNode } from "react";
import { CONTRIBUTION_STATUS } from "@/domain/intelligence/catalog";
import type { LoadedContribution } from "@/domain/intelligence/queries";
import { formatDateTime } from "@/lib/format";
import { StatusTag } from "@/components/ui/status-tag";
import { FileList } from "./file-list";

/** One piece of client input on an element, and how TPLCo handled it. */
export function ContributionCard({
  contribution,
  name,
  element,
  controls,
}: {
  contribution: LoadedContribution;
  name: (userId: string | null) => string;
  element?: ReactNode;
  controls?: ReactNode;
}) {
  const status = CONTRIBUTION_STATUS[contribution.status];
  return (
    <article className="rounded-sm border border-rule bg-surface px-5 py-4 text-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-ink-subtle">
          {name(contribution.submitted_by)} · {formatDateTime(contribution.submitted_at)}
          {element ? <> · on {element}</> : null}
        </p>
        <StatusTag tone={status.tone}>{status.label}</StatusTag>
      </header>
      <p className="mt-2 whitespace-pre-line text-ink">{contribution.body}</p>
      {contribution.link_url ? (
        <a
          href={contribution.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-accent hover:underline"
        >
          {contribution.link_url}
        </a>
      ) : null}
      <FileList files={contribution.files} />
      {contribution.handled_at ? (
        <p className="mt-3 border-t border-rule pt-2 text-xs text-ink-muted">
          {status.label} by {name(contribution.handled_by)} {formatDateTime(contribution.handled_at)}
          {contribution.handling_note ? `: ${contribution.handling_note}` : ""}
        </p>
      ) : null}
      {controls ? <div className="mt-3">{controls}</div> : null}
    </article>
  );
}
