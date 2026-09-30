import type { FieldSpec } from "@/components/ui/action-form";
import {
  CONFIDENCE_LABELS,
  CONFIDENCE_LEVELS,
  CONSTRAINT_CATEGORIES,
  CONSTRAINT_CATEGORY_LABELS,
  DEPENDENCY_TYPES,
  DEPENDENCY_TYPE_LABELS,
  DOMAINS,
  DOMAIN_SHORT_LABELS,
  EDITABLE_PROVENANCE,
  IP_CLASSIFICATIONS,
  IP_CLASSIFICATION_LABELS,
  MATURITY_LABELS,
  MATURITY_STATES,
  OPPORTUNITY_SCALE,
  PROVENANCE_LABELS,
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_PRIORITY,
  RISK_SCALE,
  type RecordKind,
} from "@/domain/architecture/catalog";
import {
  OBJECT_ATTRIBUTE_FIELDS,
  attributeFieldName,
  attributesToForm,
} from "@/domain/architecture/object-types";
import type { LoadedElement } from "@/domain/architecture/queries";
import {
  ACTIVE_STATUSES,
  INTELLIGENCE_CATEGORIES,
  isTerminalStatus,
  recordStatus,
  type CategorizedKind,
} from "@/domain/intelligence/catalog";
import type { ObjectTypeKey } from "@/domain/architecture/rules";

/**
 * Form field specifications for architecture elements, shared by the create
 * and edit forms. Only the choices the database accepts are offered; it
 * still checks every one.
 */

const options = <T extends string>(values: readonly T[], label: (v: T) => string) =>
  values.map((value) => ({ value, label: label(value) }));

export const yesNoOptions = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

/** Visibility is offered only to publishers; the database refuses it to anyone else. */
export function spineFields(canPublish: boolean, { recommendation = false } = {}): FieldSpec[] {
  const fields: FieldSpec[] = [
    { name: "title", label: "Title", wide: true },
    { name: "summary", label: "Summary", type: "textarea" },
  ];
  if (!recommendation) {
    fields.push({
      name: "provenance",
      label: "Provenance",
      type: "select",
      options: options(EDITABLE_PROVENANCE, (p) => PROVENANCE_LABELS[p]),
    });
  }
  fields.push(
    {
      name: "ipClassification",
      label: "IP classification",
      type: "select",
      options: options(IP_CLASSIFICATIONS, (c) => IP_CLASSIFICATION_LABELS[c]),
    },
    {
      name: "sourceReference",
      label: "Source reference",
      hint: "Where this came from, if not cited as evidence.",
    },
  );
  if (canPublish) {
    fields.push({
      name: "clientVisibility",
      label: "Client visibility",
      type: "select",
      options: [
        { value: "internal", label: "Internal only" },
        { value: "client", label: "Client-visible once published" },
      ],
      hint: "Clients see only published versions, never the working copy.",
    });
  }
  return fields;
}

export function objectFields(type: ObjectTypeKey): FieldSpec[] {
  return [
    {
      name: "maturity",
      label: "Maturity",
      type: "select",
      options: options(MATURITY_STATES, (m) => MATURITY_LABELS[m]),
    },
    {
      name: "maturityRationale",
      label: "Maturity rationale",
      hint: "Required above Undefined.",
      wide: true,
    },
    ...OBJECT_ATTRIBUTE_FIELDS[type].map((field): FieldSpec => {
      const name = attributeFieldName(field.key);
      switch (field.type) {
        case "select":
          return {
            name,
            label: field.label,
            type: "select",
            options: [
              { value: "", label: "Not set" },
              ...field.options.map(([value, label]) => ({ value, label })),
            ],
          };
        case "boolean":
          return {
            name,
            label: field.label,
            type: "select",
            options: [{ value: "", label: "Not set" }, ...yesNoOptions],
          };
        case "integer":
          return { name, label: field.label, type: "number", hint: field.hint };
        default:
          return { name, label: field.label, type: field.type, hint: field.hint };
      }
    }),
  ];
}

const scopeFields: FieldSpec[] = [
  {
    name: "domains",
    label: "Domains",
    type: "checkboxes",
    options: DOMAINS.map((d) => ({ value: d, label: DOMAIN_SHORT_LABELS[d] })),
    wide: true,
  },
  {
    name: "engagementWide",
    label: "Engagement-wide",
    type: "select",
    options: yesNoOptions,
    hint: "A record needs a domain, an element it concerns, or engagement-wide scope before review.",
  },
];

const categoryField = (kind: CategorizedKind): FieldSpec => ({
  name: "category",
  label: "Category",
  type: "select",
  options: INTELLIGENCE_CATEGORIES[kind].map((c) => ({ value: c.key, label: c.label })),
});

const scaleOptions = (scale: readonly number[]) =>
  scale.map((n) => ({ value: String(n), label: String(n) }));

/**
 * The fields of a Project Intelligence record. The status select offers only
 * active statuses: resolved statuses are reached by Resolve, with a
 * rationale. When the record is already resolved (`resolved`), the status is
 * left out and changes only by Reopen.
 */
export function recordFields(
  kind: RecordKind,
  elementOptions: { value: string; label: string }[] = [],
  { resolved = false }: { resolved?: boolean } = {},
): FieldSpec[] {
  const status = (name: string): FieldSpec[] =>
    resolved || kind === "decision" || kind === "recommendation"
      ? []
      : [
          {
            name,
            label: "Status",
            type: "select",
            options: ACTIVE_STATUSES[kind].map((value) => ({
              value,
              label: recordStatus(kind, value)?.label ?? value,
            })),
            hint: "Resolve the record, with a rationale, to close it.",
          },
        ];
  const kindFields: Record<RecordKind, FieldSpec[]> = {
    assumption: [
      categoryField("assumption"),
      {
        name: "confidence",
        label: "Confidence",
        type: "select",
        options: options(CONFIDENCE_LEVELS, (c) => CONFIDENCE_LABELS[c]),
      },
      ...status("validationStatus"),
      { name: "impactIfFalse", label: "Impact if false", type: "textarea" },
      { name: "validationNote", label: "Validation note", type: "textarea" },
    ],
    risk: [
      categoryField("risk"),
      ...status("riskStatus"),
      {
        name: "probability",
        label: "Probability (1–5)",
        type: "select",
        options: scaleOptions(RISK_SCALE),
      },
      { name: "impact", label: "Impact (1–5)", type: "select", options: scaleOptions(RISK_SCALE) },
      { name: "mitigation", label: "Mitigation", type: "textarea" },
    ],
    constraint: [
      {
        name: "category",
        label: "Category",
        type: "select",
        options: options(CONSTRAINT_CATEGORIES, (c) => CONSTRAINT_CATEGORY_LABELS[c]),
      },
      ...status("constraintStatus"),
      { name: "source", label: "Source of the constraint" },
      { name: "negotiable", label: "Negotiable", type: "select", options: yesNoOptions },
    ],
    dependency: [
      { name: "fromElementId", label: "Depends (from)", type: "select", options: elementOptions },
      { name: "toElementId", label: "On (to)", type: "select", options: elementOptions },
      {
        name: "dependencyType",
        label: "Type",
        type: "select",
        options: options(DEPENDENCY_TYPES, (t) => DEPENDENCY_TYPE_LABELS[t]),
      },
      ...status("dependencyStatus"),
      { name: "blocking", label: "Blocking", type: "select", options: yesNoOptions },
    ],
    decision: [
      categoryField("decision"),
      { name: "context", label: "Context", type: "textarea" },
      { name: "neededBy", label: "Needed by", type: "date" },
      { name: "downstreamImpact", label: "Downstream impact", type: "textarea" },
    ],
    recommendation: [
      categoryField("recommendation"),
      {
        name: "priority",
        label: "Priority",
        type: "select",
        options: options(RECOMMENDATION_PRIORITIES, (p) => RECOMMENDATION_PRIORITY[p].label),
      },
      { name: "rationale", label: "Rationale", type: "textarea" },
    ],
    opportunity: [
      categoryField("opportunity"),
      ...status("opportunityStatus"),
      {
        name: "value",
        label: "Value if realized (1–5)",
        type: "select",
        options: scaleOptions(OPPORTUNITY_SCALE),
      },
      {
        name: "feasibility",
        label: "Feasibility (1–5)",
        type: "select",
        options: scaleOptions(OPPORTUNITY_SCALE),
      },
      { name: "windowOpensOn", label: "Window opens", type: "date" },
      {
        name: "windowClosesOn",
        label: "Window closes",
        type: "date",
        hint: "A signal appears 30 days before it closes.",
      },
      { name: "pursuitApproach", label: "How it would be pursued", type: "textarea" },
    ],
  };
  return [...kindFields[kind], ...scopeFields];
}

/** Is this record already resolved (its status reached only by Resolve)? */
export function isResolvedRecord(element: LoadedElement): boolean {
  const record = element.record;
  if (!record) return false;
  return isTerminalStatus(record.kind, recordStatusValue(record));
}

/** The status column of a loaded record, whatever its kind. */
export function recordStatusValue(record: NonNullable<LoadedElement["record"]>): string | null {
  switch (record.kind) {
    case "assumption":
      return record.row.validation_status;
    case "risk":
      return record.row.risk_status;
    case "constraint":
      return record.row.constraint_status;
    case "dependency":
      return record.row.dependency_status;
    case "decision":
      return record.row.decision_status;
    case "opportunity":
      return record.row.opportunity_status;
    case "recommendation":
      return null;
  }
}

export const newElementDefaults = {
  provenance: "architect_judgment",
  ipClassification: "project_work_product",
  clientVisibility: "internal",
  maturity: "undefined",
};

export const newRecordDefaults: Record<RecordKind, Record<string, string>> = {
  assumption: { category: "other", confidence: "medium", validationStatus: "unvalidated" },
  risk: { category: "other", riskStatus: "open", probability: "3", impact: "3" },
  constraint: { category: "other", constraintStatus: "in_force", negotiable: "no" },
  dependency: { dependencyType: "prerequisite", dependencyStatus: "open", blocking: "no" },
  decision: { category: "other" },
  recommendation: { category: "other", priority: "important" },
  opportunity: {
    category: "other",
    opportunityStatus: "identified",
    value: "3",
    feasibility: "3",
  },
};

/** Current values of an element as form defaults. */
export function elementDefaults(element: LoadedElement): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {
    title: element.title,
    summary: element.summary,
    provenance: element.provenance,
    ipClassification: element.ip_classification,
    sourceReference: element.source_reference,
    clientVisibility: element.client_visibility,
  };
  if (element.object) {
    values.maturity = element.object.maturity;
    values.maturityRationale = element.object.maturity_rationale;
    Object.assign(
      values,
      attributesToForm(element.object.object_type as ObjectTypeKey, element.object.attributes),
    );
  }
  const record = element.record;
  if (record) {
    values.domains = element.domains;
    values.engagementWide = element.engagement_wide ? "yes" : "no";
    switch (record.kind) {
      case "assumption":
        Object.assign(values, {
          category: record.row.category,
          confidence: record.row.confidence,
          validationStatus: record.row.validation_status,
          impactIfFalse: record.row.impact_if_false,
          validationNote: record.row.validation_note,
        });
        break;
      case "risk":
        Object.assign(values, {
          category: record.row.category,
          riskStatus: record.row.risk_status,
          probability: String(record.row.probability),
          impact: String(record.row.impact),
          mitigation: record.row.mitigation,
        });
        break;
      case "constraint":
        Object.assign(values, {
          category: record.row.category,
          constraintStatus: record.row.constraint_status,
          source: record.row.source,
          negotiable: record.row.negotiable ? "yes" : "no",
        });
        break;
      case "dependency":
        Object.assign(values, {
          fromElementId: record.row.from_element_id,
          toElementId: record.row.to_element_id,
          dependencyType: record.row.dependency_type,
          dependencyStatus: record.row.dependency_status,
          blocking: record.row.blocking ? "yes" : "no",
        });
        break;
      case "decision":
        Object.assign(values, {
          category: record.row.category,
          context: record.row.context,
          neededBy: record.row.needed_by ?? "",
          downstreamImpact: record.row.downstream_impact,
        });
        break;
      case "recommendation":
        Object.assign(values, {
          category: record.row.category,
          priority: record.row.priority,
          rationale: record.row.rationale,
        });
        break;
      case "opportunity":
        Object.assign(values, {
          category: record.row.category,
          opportunityStatus: record.row.opportunity_status,
          value: String(record.row.value),
          feasibility: String(record.row.feasibility),
          windowOpensOn: record.row.window_opens_on ?? "",
          windowClosesOn: record.row.window_closes_on ?? "",
          pursuitApproach: record.row.pursuit_approach,
        });
        break;
    }
  }
  return values;
}
