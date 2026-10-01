import Link from "next/link";
import { ReferenceCode } from "@/components/architecture/badges";
import { EmptyState } from "@/components/ui/panel";
import {
  drawerForInference,
  drawerQuery,
  type DrawerSubject,
} from "@/domain/architecture-intelligence/experience/subjects";
import {
  JUDGMENT_LABELS,
  KIND_NOUNS,
  SUGGESTED_DESCRIPTION,
} from "@/domain/architecture-intelligence/experience/words";
import { formatDate } from "@/lib/format";

/**
 * Where a kept interpretation's drawer lives: an initiative's on its page,
 * a Review's on its page, everything else on the subject element's page.
 */
export function inferenceDrawerHref(slug: string, subject: DrawerSubject): string {
  const base = `/internal/engagements/${slug}`;
  const path =
    subject.drawer === "initiative"
      ? `${base}/implementation/${subject.elementId}`
      : subject.drawer === "review"
        ? `${base}/reviews/${subject.elementId}`
        : subject.drawer === "edge"
          ? `${base}/edge`
          : `${base}/architecture/elements/${subject.elementId}`;
  return `${path}?${drawerQuery(subject)}`;
}

type SuggestedRow = {
  inference_id: string;
  inference_kind: string;
  subject_type: string;
  subject_element_id: string;
  subject_reference_code: string;
  subject_title: string;
  second_element_id: string | null;
  second_reference_code: string | null;
  link_id: string | null;
  link_type: string | null;
  assertion: string;
  requested_at: string;
  kept_at: string;
  judgment_kind: string | null;
  judged_at: string | null;
};

/**
 * Suggested interpretations (IX-17, 7B.2 proposal §20): kept model
 * inferences beside the Edge, never inside it. No tier, no count, no
 * ranking, no severity styling; ordered by the subject's nearest governance
 * date, then keep time. Absent entirely for non-holders.
 */
export function SuggestedInterpretations({ slug, rows }: { slug: string; rows: SuggestedRow[] }) {
  return (
    <section
      aria-labelledby="suggested-interpretations"
      className="space-y-3 border-t border-rule pt-6"
    >
      <div>
        <h2 id="suggested-interpretations" className="font-serif text-base text-ink-muted">
          Suggested interpretations
        </h2>
        <p className="mt-0.5 text-sm text-ink-subtle">{SUGGESTED_DESCRIPTION}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No interpretations have been kept." />
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {rows.map((r) => {
            const subject = drawerForInference({
              inference_kind: r.inference_kind,
              subject_type: r.subject_type,
              subject_element_id: r.subject_element_id,
              second_element_id: r.second_element_id,
              link_id: r.link_id,
              link_type: r.link_type,
            });
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
                  · kept {formatDate(r.kept_at)}
                  {r.judgment_kind
                    ? ` · ${JUDGMENT_LABELS[r.judgment_kind] ?? r.judgment_kind}${r.judged_at ? ` ${formatDate(r.judged_at)}` : ""}`
                    : ""}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
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
    </section>
  );
}
