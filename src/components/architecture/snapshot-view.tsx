import {
  CONFIDENCE_LABELS,
  CONSTRAINT_CATEGORY_LABELS,
  CONSTRAINT_STATUS,
  DEPENDENCY_STATUS,
  DEPENDENCY_TYPE_LABELS,
  DOMAIN_SHORT_LABELS,
  EVIDENCE_SOURCE_TYPE_LABELS,
  EVIDENCE_STANCE_LABELS,
  MATURITY_LABELS,
  OPPORTUNITY_STATUS,
  PROVENANCE_CLIENT_LABELS,
  RECOMMENDATION_PRIORITY,
  RISK_STATUS,
  STATEMENT_KINDS,
  STATEMENT_KIND_LABELS,
  VALIDATION_STATUS,
  type ConfidenceLevel,
  type ConstraintCategory,
  type ConstraintStatus,
  type DependencyStatus,
  type DependencyType,
  type OpportunityStatus,
  type RecommendationPriority,
  type RiskStatus,
  type ValidationStatus,
} from "@/domain/architecture/catalog";
import { describeAttributes } from "@/domain/architecture/object-types";
import { categoryLabel } from "@/domain/intelligence/catalog";
import type { ObjectTypeKey } from "@/domain/architecture/rules";
import {
  groupStatements,
  type ClientSnapshot,
  type SnapshotCitation,
} from "@/domain/architecture/snapshot";
import { objectType } from "@/domain/architecture/rules";
import { formatDate } from "@/lib/format";
import { DetailList } from "@/components/ui/panel";

/**
 * A published client snapshot, exactly as a client reads it. Used by the
 * portal and by "Preview as client". It renders only what the snapshot
 * holds; the snapshot itself was built without internal content.
 */
export function SnapshotView({
  snapshot,
  titleOf,
}: {
  snapshot: ClientSnapshot;
  /** Resolves another element's title (for dependencies), when the reader may see it. */
  titleOf?: (elementId: string) => string | null;
}) {
  const details = snapshot.details ?? {};
  const facts = snapshotFacts(snapshot, titleOf);
  const groups = groupStatements(snapshot.statements ?? [], STATEMENT_KINDS);

  return (
    <div className="space-y-6">
      {snapshot.summary ? (
        <p className="max-w-3xl font-serif text-base leading-relaxed text-ink">
          {snapshot.summary}
        </p>
      ) : null}
      <p className="text-xs tracking-wide text-ink-subtle uppercase">
        {PROVENANCE_CLIENT_LABELS[snapshot.provenance]}
      </p>
      {facts.length > 0 ? <DetailList items={facts} /> : null}

      {details.options && details.options.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">
            Options
          </p>
          <ul className="divide-y divide-rule border-y border-rule">
            {details.options.map((option) => (
              <li key={option.id} className="py-3">
                <p className="flex flex-wrap items-baseline gap-2 text-sm font-medium text-ink">
                  {option.title}
                  {details.recommended_option_id === option.id ? (
                    <span className="text-xs font-normal text-ink-subtle uppercase">
                      Recommended · {PROVENANCE_CLIENT_LABELS.architect_judgment}
                    </span>
                  ) : null}
                  {details.chosen_option_id === option.id ? (
                    <span className="text-xs font-normal text-positive uppercase">Chosen</span>
                  ) : null}
                </p>
                {option.description ? (
                  <p className="mt-1 text-sm text-ink-muted">{option.description}</p>
                ) : null}
                {option.tradeoffs ? (
                  <p className="mt-1 text-sm text-ink-muted">
                    <span className="text-ink-subtle">Trade-offs: </span>
                    {option.tradeoffs}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {details.recommendation_rationale ? (
            <p className="mt-3 text-sm text-ink-muted">
              <span className="text-ink-subtle">Why TPLCo recommends it: </span>
              {details.recommendation_rationale}
            </p>
          ) : null}
        </div>
      ) : null}

      {groups.map((group) => (
        <div key={group.kind}>
          <p className="mb-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">
            {STATEMENT_KIND_LABELS[group.kind]}
          </p>
          <ul className="space-y-3">
            {group.statements.map((statement) => (
              <li key={statement.id} className="border-l-2 border-rule pl-4">
                <p className="text-sm text-ink">{statement.body}</p>
                <p className="mt-1 text-xs text-ink-subtle">
                  {PROVENANCE_CLIENT_LABELS[statement.provenance]}
                </p>
                <Citations citations={statement.evidence} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {snapshot.evidence && snapshot.evidence.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">
            Evidence
          </p>
          <Citations citations={snapshot.evidence} />
        </div>
      ) : null}
    </div>
  );
}

export function Citations({ citations }: { citations: SnapshotCitation[] | undefined }) {
  if (!citations || citations.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {citations.map((c, index) => (
        <li key={`${c.source.id}-${index}`} className="text-xs text-ink-muted">
          <span className="text-ink-subtle">{EVIDENCE_STANCE_LABELS[c.stance]}: </span>
          {c.source.url ? (
            <a href={c.source.url} className="underline" rel="noreferrer noopener" target="_blank">
              {c.source.title}
            </a>
          ) : (
            c.source.title
          )}
          {c.source.publisher_author ? ` · ${c.source.publisher_author}` : ""}
          {c.source.source_date ? ` · ${formatDate(c.source.source_date)}` : ""}
          {` · ${EVIDENCE_SOURCE_TYPE_LABELS[c.source.source_type]}`}
          {c.locator ? ` · ${c.locator}` : ""}
        </li>
      ))}
    </ul>
  );
}

function snapshotFacts(
  snapshot: ClientSnapshot,
  titleOf?: (elementId: string) => string | null,
): { label: string; value: string }[] {
  const d = snapshot.details ?? {};
  const facts: { label: string; value: string }[] = [];
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

  if (snapshot.kind === "object") {
    const type = objectType(str(d.object_type));
    if (type) facts.push({ label: "Type", value: type.label });
    if (d.maturity) facts.push({ label: "Maturity", value: MATURITY_LABELS[d.maturity] });
    if (d.maturity_rationale)
      facts.push({ label: "Maturity rationale", value: d.maturity_rationale });
    for (const row of describeAttributes(str(d.object_type) as ObjectTypeKey, d.attributes)) {
      facts.push({ label: row.label, value: row.value });
    }
    return facts;
  }

  const scope = snapshot.engagement_wide
    ? "Engagement-wide"
    : (snapshot.domains ?? []).map((x) => DOMAIN_SHORT_LABELS[x]).join(", ");
  if (scope) facts.push({ label: "Scope", value: scope });

  switch (snapshot.kind) {
    case "assumption":
      facts.push(
        { label: "Category", value: categoryLabel("assumption", str(d.category)) },
        { label: "Confidence", value: CONFIDENCE_LABELS[d.confidence as ConfidenceLevel] ?? "" },
        {
          label: "Validation",
          value: VALIDATION_STATUS[d.validation_status as ValidationStatus]?.label ?? "",
        },
        { label: "Impact if false", value: str(d.impact_if_false) },
      );
      break;
    case "risk":
      facts.push(
        { label: "Category", value: categoryLabel("risk", str(d.category)) },
        { label: "Status", value: RISK_STATUS[d.risk_status as RiskStatus]?.label ?? "" },
        {
          label: "Probability × impact",
          value: `${str(d.probability)} × ${str(d.impact)} = ${str(d.severity)}`,
        },
        { label: "Mitigation", value: str(d.mitigation) },
      );
      break;
    case "constraint":
      facts.push(
        {
          label: "Category",
          value: CONSTRAINT_CATEGORY_LABELS[d.category as ConstraintCategory] ?? "",
        },
        {
          label: "Status",
          value: CONSTRAINT_STATUS[d.constraint_status as ConstraintStatus]?.label ?? "",
        },
        { label: "Source", value: str(d.source) },
        { label: "Negotiable", value: d.negotiable ? "Yes" : "No" },
      );
      break;
    case "dependency":
      facts.push(
        { label: "From", value: titleOf?.(str(d.from_element_id)) ?? "" },
        { label: "On", value: titleOf?.(str(d.to_element_id)) ?? "" },
        { label: "Type", value: DEPENDENCY_TYPE_LABELS[d.dependency_type as DependencyType] ?? "" },
        {
          label: "Status",
          value: `${DEPENDENCY_STATUS[d.dependency_status as DependencyStatus]?.label ?? ""}${d.blocking ? " · blocking" : ""}`,
        },
      );
      break;
    case "decision":
      facts.push(
        { label: "Category", value: categoryLabel("decision", str(d.category)) },
        { label: "Context", value: str(d.context) },
        { label: "Needed by", value: d.needed_by ? formatDate(str(d.needed_by)) : "" },
        { label: "Downstream impact", value: str(d.downstream_impact) },
      );
      break;
    case "recommendation":
      facts.push(
        {
          label: "Priority",
          value: RECOMMENDATION_PRIORITY[d.priority as RecommendationPriority]?.label ?? "",
        },
        { label: "Rationale", value: str(d.rationale) },
      );
      break;
    case "opportunity":
      facts.push(
        { label: "Category", value: categoryLabel("opportunity", str(d.category)) },
        {
          label: "Status",
          value: OPPORTUNITY_STATUS[d.opportunity_status as OpportunityStatus]?.label ?? "",
        },
        {
          label: "Value × feasibility",
          value: `${str(d.value)} × ${str(d.feasibility)} = ${str(d.attractiveness)}`,
        },
        {
          label: "Window closes",
          value: d.window_closes_on ? formatDate(str(d.window_closes_on)) : "",
        },
        { label: "How it would be pursued", value: str(d.pursuit_approach) },
      );
      break;
  }
  return facts.filter((f) => f.value);
}
