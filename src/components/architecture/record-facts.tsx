import {
  CONFIDENCE_LABELS,
  CONSTRAINT_CATEGORY_LABELS,
  CONSTRAINT_STATUS,
  DEPENDENCY_STATUS,
  DEPENDENCY_TYPE_LABELS,
  OPPORTUNITY_STATUS,
  RECOMMENDATION_PRIORITY,
  RISK_STATUS,
  VALIDATION_STATUS,
} from "@/domain/architecture/catalog";
import type { LoadedArchitecture, LoadedElement } from "@/domain/architecture/queries";
import { categoryLabel } from "@/domain/intelligence/catalog";
import { formatDate } from "@/lib/format";
import { DetailList } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { ElementLink } from "./badges";

/** The type-specific fields of a Project Intelligence record. */
export function RecordFacts({
  element,
  architecture,
  slug,
}: {
  element: LoadedElement;
  architecture: LoadedArchitecture;
  slug: string;
}) {
  const record = element.record;
  if (!record) return null;
  switch (record.kind) {
    case "assumption": {
      const r = record.row;
      return (
        <DetailList
          items={[
            { label: "Category", value: categoryLabel("assumption", r.category) },
            { label: "Confidence", value: CONFIDENCE_LABELS[r.confidence] },
            {
              label: "Validation",
              value: (
                <StatusTag tone={VALIDATION_STATUS[r.validation_status].tone}>
                  {VALIDATION_STATUS[r.validation_status].label}
                </StatusTag>
              ),
            },
            { label: "Impact if false", value: r.impact_if_false },
            { label: "Validation note", value: r.validation_note },
          ]}
        />
      );
    }
    case "risk": {
      const r = record.row;
      return (
        <DetailList
          items={[
            { label: "Category", value: categoryLabel("risk", r.category) },
            {
              label: "Status",
              value: (
                <StatusTag tone={RISK_STATUS[r.risk_status].tone}>
                  {RISK_STATUS[r.risk_status].label}
                </StatusTag>
              ),
            },
            {
              label: "Probability × impact",
              value: `${r.probability} × ${r.impact} = ${r.severity}`,
            },
            { label: "Mitigation", value: r.mitigation },
          ]}
        />
      );
    }
    case "constraint": {
      const r = record.row;
      return (
        <DetailList
          items={[
            { label: "Category", value: CONSTRAINT_CATEGORY_LABELS[r.category] },
            { label: "Status", value: CONSTRAINT_STATUS[r.constraint_status].label },
            { label: "Source", value: r.source },
            { label: "Negotiable", value: r.negotiable ? "Yes" : "No" },
          ]}
        />
      );
    }
    case "dependency": {
      const r = record.row;
      const from = architecture.byId.get(r.from_element_id);
      const to = architecture.byId.get(r.to_element_id);
      return (
        <DetailList
          items={[
            { label: "From", value: from ? <ElementLink slug={slug} element={from} /> : null },
            { label: "Depends on", value: to ? <ElementLink slug={slug} element={to} /> : null },
            { label: "Type", value: DEPENDENCY_TYPE_LABELS[r.dependency_type] },
            {
              label: "Status",
              value: (
                <span className="flex items-center gap-2">
                  <StatusTag tone={DEPENDENCY_STATUS[r.dependency_status].tone}>
                    {DEPENDENCY_STATUS[r.dependency_status].label}
                  </StatusTag>
                  {r.blocking ? <StatusTag tone="negative">Blocking</StatusTag> : null}
                </span>
              ),
            },
          ]}
        />
      );
    }
    case "decision": {
      const r = record.row;
      return (
        <DetailList
          items={[
            { label: "Category", value: categoryLabel("decision", r.category) },
            { label: "Context", value: r.context },
            { label: "Needed by", value: r.needed_by ? formatDate(r.needed_by) : null },
            { label: "Downstream impact", value: r.downstream_impact },
          ]}
        />
      );
    }
    case "recommendation": {
      const r = record.row;
      return (
        <DetailList
          items={[
            { label: "Category", value: categoryLabel("recommendation", r.category) },
            {
              label: "Priority",
              value: (
                <StatusTag tone={RECOMMENDATION_PRIORITY[r.priority].tone}>
                  {RECOMMENDATION_PRIORITY[r.priority].label}
                </StatusTag>
              ),
            },
            { label: "Rationale", value: r.rationale },
          ]}
        />
      );
    }
    case "opportunity": {
      const r = record.row;
      return (
        <DetailList
          items={[
            { label: "Category", value: categoryLabel("opportunity", r.category) },
            {
              label: "Status",
              value: (
                <StatusTag tone={OPPORTUNITY_STATUS[r.opportunity_status].tone}>
                  {OPPORTUNITY_STATUS[r.opportunity_status].label}
                </StatusTag>
              ),
            },
            {
              label: "Value × feasibility",
              value: `${r.value} × ${r.feasibility} = ${r.attractiveness}`,
            },
            {
              label: "Window",
              value:
                r.window_opens_on || r.window_closes_on
                  ? [
                      r.window_opens_on ? `opens ${formatDate(r.window_opens_on)}` : null,
                      r.window_closes_on ? `closes ${formatDate(r.window_closes_on)}` : null,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : null,
            },
            { label: "How it would be pursued", value: r.pursuit_approach },
          ]}
        />
      );
    }
  }
}
