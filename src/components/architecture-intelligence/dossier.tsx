import Link from "next/link";
import { ReferenceCode } from "@/components/architecture/badges";
import type { ReviewDossier } from "@/domain/architecture-intelligence/experience/layer1-queries";
import { EDGE_TIER_LABELS, type EdgeTier } from "@/domain/edge/items";
import { edgeRuleLabel } from "@/domain/edge/rules";
import { formatDate, formatDateTime } from "@/lib/format";
import { FactList, FactSection } from "./layer1";

/**
 * The deterministic Review dossier (7B.2 proposal §8). Exact: every line names
 * records and versions, nothing is summarised, nothing is ranked. Ordered by
 * the examined set as recorded, then by time. Internal only.
 */

const COMPARE_WORDS: Record<string, string> = {
  captured_at_hold: "since the version captured at the hold",
  prior_review: "since the most recent earlier held Review that examined it",
  first_review: "first Review of this element",
  no_capture: "will be examined at the hold",
};

const words = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : String(v).replaceAll("_", " ");

export function ReviewDossierView({
  dossier,
  slug,
  edgeHref,
}: {
  dossier: ReviewDossier;
  slug: string;
  edgeHref: string;
}) {
  const el = (id: string, code: string) => (
    <Link
      href={`/internal/engagements/${slug}/architecture/elements/${id}`}
      className="hover:underline"
    >
      <ReferenceCode code={code} />
    </Link>
  );
  const held = dossier.review.status === "held";
  const changes = dossier.changes.filter((c) => c.change_type !== "status_publication");
  const statusPublications = dossier.changes.filter((c) => c.change_type === "status_publication");
  return (
    <div className="space-y-5">
      <FactSection title="Examined">
        <FactList
          items={dossier.examined.map((x) => (
            <span key={x.element_id}>
              {el(x.element_id, x.reference_code)} {x.title}
              {held
                ? x.examined_version_no
                  ? `, examined at v${x.examined_version_no}`
                  : ", examined before it was published"
                : x.latest_version_no
                  ? `, v${x.latest_version_no} now; will be examined at the hold`
                  : "; will be examined at the hold"}
              {x.latest_version_no && held && x.latest_version_no !== x.examined_version_no
                ? ` (now v${x.latest_version_no})`
                : ""}
              <span className="text-xs text-ink-subtle">
                {" "}
                · {COMPARE_WORDS[x.compare_basis] ?? ""}
                {x.prior_review_code ? ` (${x.prior_review_code})` : ""}
              </span>
            </span>
          ))}
        />
      </FactSection>
      <FactSection title="Changes since">
        <FactList
          items={changes.map((c) => (
            <span key={c.version_id}>
              {el(c.element_id, c.reference_code)} v{c.version_no}, {formatDateTime(c.published_at)}
              {c.changed_paths?.length ? `: ${c.changed_paths.map(words).join(", ")} changed` : ""}
              {c.change_summary ? `. ${c.change_summary}` : ""}
            </span>
          ))}
        />
        {statusPublications.length > 0 ? (
          <p className="mt-2 text-xs text-ink-subtle">
            Status publications:{" "}
            {statusPublications
              .map((c) => `${c.reference_code} v${c.version_no} (${formatDate(c.published_at)})`)
              .join("; ")}
          </p>
        ) : null}
      </FactSection>
      <FactSection title="Evidence since">
        <FactList
          items={dossier.evidence.map((e) => (
            <span key={e.link_id}>
              {el(e.element_id, e.reference_code)} {e.evidence_title}, {words(e.stance)}, linked{" "}
              {formatDate(e.linked_at)}
            </span>
          ))}
        />
      </FactSection>
      <FactSection title="Edge conditions">
        <FactList
          items={dossier.edge.map((i) => (
            <span key={i.item_key}>
              <ReferenceCode code={i.subject_reference_code} /> {edgeRuleLabel(i.rule_key)}
              {i.trigger_reference_code && i.trigger_reference_code !== i.subject_reference_code
                ? ` (from ${i.trigger_reference_code}${i.trigger_version_no ? ` v${i.trigger_version_no}` : ""})`
                : ""}
              <span className="text-xs text-ink-subtle">
                {" "}
                · {EDGE_TIER_LABELS[i.tier as EdgeTier] ?? i.tier}
              </span>
            </span>
          ))}
        />
        {dossier.edge_judged_count > 0 ? (
          <p className="mt-1 text-xs text-ink-subtle">
            {dossier.edge_judged_count} judged.{" "}
            <Link href={edgeHref} className="underline hover:text-ink">
              See the judged view
            </Link>
          </p>
        ) : null}
      </FactSection>
      <FactSection title="Acceptance criteria">
        <FactList
          items={dossier.criteria.map((c) => (
            <span key={c.criterion_id}>
              <ReferenceCode code={c.reference_code} /> on {c.governs}: {words(c.state)}
              {c.agreed_on ? `, agreed ${formatDate(c.agreed_on)}` : ""}
              {c.in_force ? ", in force" : ""}
              {c.changed_since ? " · changed since the comparison point" : ""}
            </span>
          ))}
        />
      </FactSection>
      <FactSection title="Implementation">
        <FactList
          items={dossier.implementation.map((m, i) => (
            <span key={i}>
              {el(m.initiative_id, m.reference_code)}{" "}
              {m.kind === "status_change"
                ? `${m.from_value ? `${words(m.from_value)} to ` : "started as "}${words(m.to_value)}${m.at ? `, ${formatDate(m.at)}` : ""}`
                : m.kind === "checkpoint_achieved"
                  ? `checkpoint "${m.title}" achieved ${formatDate(m.achieved_on)} (target ${formatDate(m.target_on)})`
                  : `checkpoint "${m.title}" missed its target of ${formatDate(m.target_on)}`}
            </span>
          ))}
        />
      </FactSection>
      <FactSection title="Unresolved matters">
        <FactList
          items={[
            ...dossier.unresolved.decisions.map((d) => (
              <span key={`d:${d.element_id}`}>
                {el(d.element_id, d.reference_code)} {d.title}: open decision
                {d.needed_by ? `, needed by ${formatDate(d.needed_by)}` : ""}
              </span>
            )),
            ...dossier.unresolved.escalations.map((x) => (
              <span key={`x:${x.element_id}:${x.raised_at}`}>
                {el(x.element_id, x.reference_code)} open {words(x.source)} escalation to{" "}
                {words(x.level)}, raised {formatDate(x.raised_at)}
              </span>
            )),
            ...dossier.unresolved.deferred_edge.map((d, i) => (
              <span key={`e:${i}`}>
                <ReferenceCode code={d.subject_reference_code} /> {edgeRuleLabel(d.rule_key)}:
                deferred until {formatDate(d.expires_on)}
              </span>
            )),
          ]}
        />
      </FactSection>
    </div>
  );
}
