import Link from "next/link";
import { ReferenceCode } from "@/components/architecture/badges";
import { EmptyState, Panel } from "@/components/ui/panel";
import type { SupportsAndExposures } from "@/domain/architecture-intelligence/experience/layer1-queries";
import { EDGE_TIER_LABELS, type EdgeTier } from "@/domain/edge/items";
import { edgeRuleLabel } from "@/domain/edge/rules";
import { formatDate } from "@/lib/format";
import { FactList, FactSection } from "./layer1";

/**
 * Supports and exposures (7B.2 proposal §7, PD-9): deterministic, no AI.
 * What the element rests on (evidence with stance, assumptions that
 * underpin it) and what it is exposed to (open risks, Edge items). Each
 * evidence link opens its drawer.
 */

const words = (v: string | null | undefined) => (v ? v.replaceAll("_", " ") : "—");

export function SupportsAndExposuresPanel({
  slug,
  data,
  evidenceHref,
}: {
  slug: string;
  data: SupportsAndExposures;
  evidenceHref: (linkId: string, linkType: string) => string;
}) {
  const el = (id: string, code: string) => (
    <Link
      href={`/internal/engagements/${slug}/architecture/elements/${id}`}
      className="hover:underline"
    >
      <ReferenceCode code={code} />
    </Link>
  );
  const empty =
    data.evidence.length + data.assumptions.length + data.risks.length + data.edge.length === 0;
  return (
    <Panel
      title="Supports and exposures"
      description="What this element rests on and what it is exposed to, from the records as they stand. Nothing here is a judgment of strength."
    >
      {empty ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <FactSection title="Evidence">
            <FactList
              items={data.evidence.map((e) => (
                <span key={e.link_id}>
                  {e.evidence_title}{" "}
                  <span className="text-xs text-ink-subtle">
                    · {words(e.stance)}
                    {e.link_type === "statement_link" ? ", on a statement" : ""}
                    {e.source_date ? `, ${formatDate(e.source_date)}` : ""}
                    {e.has_summary ? "" : ", no summary recorded"}
                  </span>{" "}
                  <Link
                    href={evidenceHref(e.link_id, e.link_type)}
                    scroll={false}
                    className="text-xs text-ink-muted hover:text-ink hover:underline"
                  >
                    This link
                  </Link>
                </span>
              ))}
            />
          </FactSection>
          <FactSection title="Assumptions that underpin it">
            <FactList
              items={data.assumptions.map((a) => (
                <span key={a.element_id}>
                  {el(a.element_id, a.reference_code)} {a.title}{" "}
                  <span className="text-xs text-ink-subtle">
                    · {words(a.validation_status)},{" "}
                    {a.has_supporting_evidence
                      ? "supporting evidence linked"
                      : "no supporting evidence linked"}
                  </span>
                </span>
              ))}
            />
          </FactSection>
          <FactSection title="Open risks related to it">
            <FactList
              items={data.risks.map((r) => (
                <span key={r.element_id}>
                  {el(r.element_id, r.reference_code)} {r.title}{" "}
                  <span className="text-xs text-ink-subtle">
                    · {words(r.risk_status)}
                    {r.severity ? `, recorded severity ${words(r.severity)}` : ""}
                  </span>
                </span>
              ))}
            />
          </FactSection>
          <FactSection title="Edge items on it">
            <FactList
              items={data.edge.map((i) => (
                <span key={i.item_key}>
                  {edgeRuleLabel(i.rule_key)}
                  {i.trigger_reference_code ? ` (from ${i.trigger_reference_code})` : ""}{" "}
                  <span className="text-xs text-ink-subtle">
                    · {EDGE_TIER_LABELS[i.tier as EdgeTier] ?? i.tier}
                  </span>
                </span>
              ))}
            />
          </FactSection>
        </div>
      )}
    </Panel>
  );
}

/** One evidence link (§7): source metadata, stance, what it is linked to, and when. */
export function EvidenceLinkFacts({
  link,
  statementBody,
  elementLabel,
}: {
  link: SupportsAndExposures["evidence"][number];
  statementBody: string | null;
  elementLabel: string;
}) {
  return (
    <div className="space-y-4">
      <FactSection title="Evidence">
        <p className="text-ink">{link.evidence_title}</p>
        <p>
          {words(link.source_type)}
          {link.source_date ? `, ${formatDate(link.source_date)}` : ""}
          {link.has_summary ? ". A summary is recorded." : ". No summary is recorded."}
        </p>
      </FactSection>
      <FactSection title="Recorded stance">{words(link.stance)}</FactSection>
      <FactSection title="Linked to">
        {link.link_type === "statement_link" && statementBody ? (
          <>
            <p>A statement on {elementLabel}:</p>
            <p className="mt-1 text-ink">{statementBody}</p>
          </>
        ) : (
          <p>{elementLabel}, as a whole</p>
        )}
        <p className="mt-1 text-xs text-ink-subtle">Linked {formatDate(link.linked_at)}</p>
      </FactSection>
    </div>
  );
}
