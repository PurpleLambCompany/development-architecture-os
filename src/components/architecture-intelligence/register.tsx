import Link from "next/link";
import { ReferenceCode } from "@/components/architecture/badges";
import { EmptyState, Panel } from "@/components/ui/panel";
import { drawerForInference } from "@/domain/architecture-intelligence/experience/subjects";
import {
  INFERENCE_STATE_LABELS,
  JUDGMENT_LABELS,
  KIND_NOUNS,
} from "@/domain/architecture-intelligence/experience/words";
import { INFERENCE_KINDS } from "@/domain/architecture-intelligence/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { inferenceDrawerHref } from "./suggested";

type RegisterRow = {
  inference_id: string;
  inference_kind: string;
  subject_type: string;
  subject_element_id: string;
  subject_reference_code: string;
  second_element_id: string | null;
  second_reference_code: string | null;
  subject_version_id: string | null;
  subject_rule_key: string | null;
  subject_fingerprint: string | null;
  link_id: string | null;
  link_type: string | null;
  assertion: string;
  state: string;
  judgment_kind: string | null;
  judged_at: string | null;
  requested_at: string;
  kept_at: string;
};

export const REGISTER_STATES = ["current", "stale", "superseded"] as const;

/**
 * The kept-interpretations register (PD-16): an archive of what people kept,
 * with state and latest judgment. No requester names (the requester is in
 * each interpretation's provenance), no counts per person, no ranking or
 * scoring, no charts.
 */
export function KeptInterpretationsRegister({
  slug,
  rows,
  kind,
  state,
  href,
}: {
  slug: string;
  rows: RegisterRow[];
  kind: string | null;
  state: string | null;
  href: (next: { kind?: string | null; state?: string | null }) => string;
}) {
  const chip = (active: boolean) =>
    cn(
      "rounded-sm border px-2 py-0.5 text-xs",
      active ? "border-accent text-ink" : "border-rule text-ink-muted hover:text-ink",
    );
  return (
    <Panel
      title="Kept interpretations"
      description="Interpretations people on this engagement chose to keep, with their state and latest judgment. Suggested, never established; open one to see its citations and how it was produced."
    >
      <nav
        className="mb-4 flex flex-wrap items-center gap-2"
        aria-label="Filter kept interpretations"
      >
        <Link href={href({ kind: null })} className={chip(!kind)}>
          All kinds
        </Link>
        {INFERENCE_KINDS.map((k) => (
          <Link key={k} href={href({ kind: k })} className={chip(kind === k)}>
            {KIND_NOUNS[k]}
          </Link>
        ))}
        <span className="ml-2" />
        <Link href={href({ state: null })} className={chip(!state)}>
          Any state
        </Link>
        {REGISTER_STATES.map((s) => (
          <Link key={s} href={href({ state: s })} className={chip(state === s)}>
            {s === "superseded" ? "Superseded" : INFERENCE_STATE_LABELS[s]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title="No interpretations have been kept." />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {rows.map((r) => {
            const subject = drawerForInference(r);
            return (
              <li key={r.inference_id} className="py-3">
                <p className="text-xs text-ink-subtle">
                  {KIND_NOUNS[r.inference_kind] ?? r.inference_kind} ·{" "}
                  <ReferenceCode code={r.subject_reference_code} />
                  {r.second_reference_code ? (
                    <>
                      {" "}
                      and <ReferenceCode code={r.second_reference_code} />
                    </>
                  ) : null}{" "}
                  ·{" "}
                  {r.state === "superseded"
                    ? "Superseded"
                    : (INFERENCE_STATE_LABELS[r.state] ?? r.state)}
                  {r.judgment_kind
                    ? ` · ${JUDGMENT_LABELS[r.judgment_kind] ?? r.judgment_kind}`
                    : ""}{" "}
                  · generated {formatDate(r.requested_at)}, kept {formatDate(r.kept_at)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    r.state === "current" ? "text-ink-muted" : "text-ink-subtle",
                  )}
                >
                  {subject ? (
                    <Link
                      href={inferenceDrawerHref(slug, subject)}
                      className="hover:text-ink hover:underline"
                    >
                      {r.assertion}
                    </Link>
                  ) : (
                    r.assertion
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
