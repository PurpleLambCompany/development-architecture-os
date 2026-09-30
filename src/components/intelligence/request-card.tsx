import type { ReactNode } from "react";
import type { LoadedElement } from "@/domain/architecture/queries";
import {
  CLIENT_ACTION_EVENT_LABELS,
  CLIENT_ACTION_KIND_LABELS,
  CLIENT_ACTION_STATUS,
  CLIENT_ACTION_STATUS_FOR_CLIENT,
} from "@/domain/intelligence/catalog";
import type { LoadedClientAction } from "@/domain/intelligence/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { StatusTag } from "@/components/ui/status-tag";
import { FileList } from "./file-list";

/**
 * One client request: what was asked, of whom, about what, and every
 * response and event. Controls are passed in, so internal and client pages
 * share the record and differ only in what each viewer may do.
 */
export function RequestCard({
  action,
  audience,
  today,
  name,
  subject,
  controls,
  responseControls,
}: {
  action: LoadedClientAction;
  audience: "internal" | "client";
  today: string;
  name: (userId: string | null) => string;
  /** How to show a subject element, or null when the viewer cannot see it. */
  subject: (elementId: string) => ReactNode;
  controls?: ReactNode;
  responseControls?: (response: LoadedClientAction["responses"][number]) => ReactNode;
}) {
  const status = (audience === "client" ? CLIENT_ACTION_STATUS_FOR_CLIENT : CLIENT_ACTION_STATUS)[
    action.status
  ];
  const overdue = action.status === "open" && !!action.due_on && action.due_on < today;
  const subjects = action.subjects.map(subject).filter(Boolean);
  return (
    <article
      id={action.reference_code}
      className="rounded-sm border border-rule bg-surface px-5 py-4"
      aria-labelledby={`${action.id}-title`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
            <span className="font-mono">{action.reference_code}</span>
            <span>{CLIENT_ACTION_KIND_LABELS[action.kind]}</span>
          </p>
          <h3 id={`${action.id}-title`} className="mt-1 font-serif text-lg text-ink">
            {action.title}
          </h3>
        </div>
        <span className="flex flex-wrap items-center gap-2">
          {overdue ? <StatusTag tone="negative">Overdue</StatusTag> : null}
          <StatusTag tone={status.tone}>{status.label}</StatusTag>
        </span>
      </header>
      <p className="mt-2 text-sm text-ink-muted">
        {audience === "client" ? "For" : "To"} {name(action.addressed_to_user_id)}
        {action.due_on ? ` · due ${formatDate(action.due_on)}` : ""} · sent{" "}
        {formatDate(action.sent_at)}
        {audience === "internal" ? ` by ${name(action.sent_by)}` : ""}
      </p>
      <p className="mt-3 text-sm whitespace-pre-line text-ink">{action.request}</p>
      {subjects.length ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-xs tracking-wide text-ink-subtle uppercase">About</span>
          {subjects.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </p>
      ) : null}

      {action.responses.length ? (
        <section className="mt-4 space-y-3 border-t border-rule pt-3" aria-label="Responses">
          {action.responses.map((r) => (
            <div key={r.id} className="text-sm">
              <p className="text-xs text-ink-subtle">
                {name(r.responded_by)} responded {formatDateTime(r.responded_at)}
                {audience === "internal" && r.recorded_as_evidence_at
                  ? ` · recorded as evidence ${formatDate(r.recorded_as_evidence_at)}`
                  : ""}
              </p>
              <p className="mt-1 whitespace-pre-line text-ink">{r.body}</p>
              {r.link_url ? (
                <a
                  href={r.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-accent hover:underline"
                >
                  {r.link_url}
                </a>
              ) : null}
              <FileList files={r.files} />
              {responseControls ? <div className="mt-2">{responseControls(r)}</div> : null}
            </div>
          ))}
        </section>
      ) : null}

      <details className="mt-3 text-xs text-ink-muted">
        <summary className="cursor-pointer text-ink-subtle">History</summary>
        <ol className="mt-2 space-y-1">
          {action.events.map((e) => (
            <li key={e.id}>
              {formatDateTime(e.created_at)} · {CLIENT_ACTION_EVENT_LABELS[e.event] ?? e.event}
              {e.actor_user_id ? ` by ${name(e.actor_user_id)}` : ""}
              {e.event === "reassigned" ? ` to ${name(e.to_user_id)}` : ""}
              {e.note ? `: ${e.note}` : ""}
            </li>
          ))}
        </ol>
      </details>
      {controls ? <div className="mt-4 flex flex-wrap items-start gap-2">{controls}</div> : null}
    </article>
  );
}

/** The element list offered as subjects: published and client-visible only. */
export function subjectOptions(elements: readonly LoadedElement[]) {
  return elements
    .filter((e) => e.lifecycle === "published" && e.client_visibility === "client")
    .map((e) => ({ value: e.id, label: `${e.reference_code} ${e.title}` }));
}
