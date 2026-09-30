import { z } from "zod";
import { isIsoDate } from "@/domain/finance/business-date";
import {
  APPROVAL_METHODS,
  CONFIDENCE_LEVELS,
  CONSTRAINT_CATEGORIES,
  CONSTRAINT_STATUSES,
  DEPENDENCY_STATUSES,
  DEPENDENCY_TYPES,
  DOMAINS,
  EDITABLE_PROVENANCE,
  EVIDENCE_PROVENANCE,
  EVIDENCE_SOURCE_TYPES,
  EVIDENCE_STANCES,
  IP_CLASSIFICATIONS,
  MATURITY_STATES,
  RECOMMENDATION_PRIORITIES,
  RISK_STATUSES,
  SKILL_PROFICIENCIES,
  STATEMENT_KINDS,
  VALIDATION_STATUSES,
} from "./catalog";
import { OBJECT_TYPES, RELATIONSHIP_TYPES } from "./vocabulary";

/**
 * Form schemas for architecture actions. Forms send strings; these validate
 * and convert them. The database re-checks every rule (pairings, cycles,
 * visibility authority, lifecycle); these exist to give clear field errors.
 */

const id = z.uuid("Choose a record");
const text = (max: number) =>
  z.string().trim().max(max, `At most ${max.toLocaleString()} characters`);
const required = (max: number) => text(max).min(1, "Required");
const nullableText = (max: number) => text(max).transform((value) => (value === "" ? null : value));
const date = z.string().trim().refine(isIsoDate, "Enter a date (YYYY-MM-DD)");
const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || isIsoDate(value), "Enter a date (YYYY-MM-DD)")
  .transform((value) => (value === "" ? null : value));
const optionalId = z
  .string()
  .trim()
  .refine((value) => value === "" || z.uuid().safeParse(value).success, "Choose a record")
  .transform((value) => (value === "" ? null : value));

/** "yes"/"no" from a select, or a checkbox-like value. */
const yesNo = z
  .string()
  .default("no")
  .transform((value) => value === "yes" || value === "true" || value === "on");
const rating = z.coerce.number().int().min(1, "1 to 5").max(5, "1 to 5");

const provenance = z.enum(EDITABLE_PROVENANCE, "Choose a provenance");
const visibility = z.enum(["internal", "client"], "Choose visibility");
const ipClassification = z.enum(IP_CLASSIFICATIONS, "Choose a classification");

const objectTypeKey = z.enum(
  OBJECT_TYPES.map((t) => t.key) as [string, ...string[]],
  "Choose an object type",
);
const relationshipTypeKey = z.enum(
  RELATIONSHIP_TYPES.map((t) => t.key).filter((k) => k !== "supersedes") as [string, ...string[]],
  "Choose a relationship",
);

/** The spine fields every element shares. */
const elementFields = {
  title: required(200),
  summary: text(4000),
  provenance,
  sourceReference: text(1000),
  ipClassification,
  clientVisibility: visibility,
};

export const elementSchema = z.object(elementFields);

/** A core object. Type-specific attributes (attr_*) are parsed by object-types.ts. */
export const objectSchema = z
  .object({
    ...elementFields,
    objectType: objectTypeKey,
    maturity: z.enum(MATURITY_STATES),
    maturityRationale: text(2000),
  })
  .refine((v) => v.maturity === "undefined" || v.maturityRationale.length > 0, {
    path: ["maturityRationale"],
    message: "Explain the maturity judgment",
  })
  .refine((v) => !(v.ipClassification === "tplco_method_ip" && v.clientVisibility === "client"), {
    path: ["clientVisibility"],
    message: "Method IP is never client-visible",
  });

export const objectUpdateSchema = z
  .object({
    ...elementFields,
    maturity: z.enum(MATURITY_STATES),
    maturityRationale: text(2000),
  })
  .refine((v) => v.maturity === "undefined" || v.maturityRationale.length > 0, {
    path: ["maturityRationale"],
    message: "Explain the maturity judgment",
  })
  .refine((v) => !(v.ipClassification === "tplco_method_ip" && v.clientVisibility === "client"), {
    path: ["clientVisibility"],
    message: "Method IP is never client-visible",
  });

/** Scope of a Project Intelligence record: domains, and/or engagement-wide. */
const recordScope = {
  domains: z.preprocess(
    (value) =>
      value === undefined || value === false ? [] : typeof value === "string" ? [value] : value,
    z.array(z.enum(DOMAINS)),
  ),
  engagementWide: yesNo,
};

const recordBase = z.object({
  ...elementFields,
  // Recommendations are always TPLCo's assessment (checked in the database).
  ...recordScope,
});

export const assumptionFields = z.object({
  category: text(100),
  confidence: z.enum(CONFIDENCE_LEVELS),
  validationStatus: z.enum(VALIDATION_STATUSES),
  impactIfFalse: text(2000),
  validationNote: text(2000),
});
export const riskFields = z.object({
  category: text(100),
  probability: rating,
  impact: rating,
  mitigation: text(2000),
  riskStatus: z.enum(RISK_STATUSES),
});
export const constraintFields = z.object({
  category: z.enum(CONSTRAINT_CATEGORIES),
  source: text(1000),
  negotiable: yesNo,
  constraintStatus: z.enum(CONSTRAINT_STATUSES),
});
export const dependencyFields = z
  .object({
    fromElementId: id,
    toElementId: id,
    dependencyType: z.enum(DEPENDENCY_TYPES),
    blocking: yesNo,
    dependencyStatus: z.enum(DEPENDENCY_STATUSES),
  })
  .refine((v) => v.fromElementId !== v.toElementId, {
    path: ["toElementId"],
    message: "Choose two different elements",
  });
export const decisionFields = z.object({
  context: text(4000),
  neededBy: optionalDate,
  downstreamImpact: text(4000),
});
export const recommendationFields = z.object({
  rationale: text(4000),
  priority: z.enum(RECOMMENDATION_PRIORITIES),
});

export const RECORD_FIELD_SCHEMAS = {
  assumption: assumptionFields,
  risk: riskFields,
  constraint: constraintFields,
  dependency: dependencyFields,
  decision: decisionFields,
  recommendation: recommendationFields,
} as const;

export const recordSchema = recordBase;

export const statementSchema = z.object({
  statementKind: z.enum(STATEMENT_KINDS),
  body: required(4000),
  provenance,
  sourceReference: text(1000),
  clientVisible: yesNo,
});

export const citationSchema = z.object({
  evidenceSourceId: id,
  stance: z.enum(EVIDENCE_STANCES),
  locator: text(300),
  note: text(1000),
});

export const evidenceSourceSchema = z
  .object({
    title: required(300),
    sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
    provenance: z.enum(EVIDENCE_PROVENANCE),
    reference: text(1000),
    url: z
      .string()
      .trim()
      .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Use an https:// address")
      .transform((v) => (v === "" ? null : v)),
    publisherAuthor: text(300),
    sourceDate: optionalDate,
    accessedDate: optionalDate,
    externalReference: text(500),
    summary: text(4000),
    notes: text(4000),
    ipClassification,
    clientVisibility: visibility,
  })
  .refine((v) => !(v.ipClassification === "tplco_method_ip" && v.clientVisibility === "client"), {
    path: ["clientVisibility"],
    message: "Method IP is never client-visible",
  });

export const relationshipSchema = z
  .object({
    targetElementId: id,
    relationshipType: relationshipTypeKey,
    requiredProficiency: z
      .enum([...SKILL_PROFICIENCIES, ""])
      .default("")
      .transform((v) => (v === "" ? null : v)),
    description: text(1000),
    provenance: provenance.default("architect_judgment"),
    clientVisibility: visibility,
  })
  .refine((v) => !(v.requiredProficiency && v.relationshipType !== "requires"), {
    path: ["requiredProficiency"],
    message: "Proficiency applies only to a role requiring a skill",
  });

export const decisionOptionSchema = z.object({
  title: required(200),
  description: text(4000),
  tradeoffs: text(4000),
});

export const lineageSchema = z.object({
  methodAssetId: id,
  methodVersion: required(50),
  note: text(1000),
});

export const reasonSchema = z.object({ reason: required(2000) });
export const noteSchema = z.object({ note: required(2000) });
export const publishSchema = z.object({ changeSummary: text(2000) });

export const supersedeSchema = z.object({
  newElementId: id,
  reason: required(2000),
});

export const domainAssessmentSchema = z.object({
  domain: z.enum(DOMAINS),
  maturity: z.enum(MATURITY_STATES),
  rationale: required(4000),
  clientVisible: yesNo,
});

export const approvalRequestSchema = z.object({ note: text(2000) });

export const approvalResponseSchema = z
  .object({
    response: z.enum(["approved", "changes_requested"]),
    comment: text(2000),
  })
  .refine((v) => v.response === "approved" || v.comment.length > 0, {
    path: ["comment"],
    message: "Say what should change",
  });

export const externalApprovalSchema = z
  .object({
    response: z.enum(["approved", "changes_requested"]),
    approverName: required(200),
    approverTitle: text(200),
    approvedOn: date,
    method: z.enum(APPROVAL_METHODS),
    evidence: required(1000),
    comment: text(2000),
  })
  .refine((v) => v.response === "approved" || v.comment.length > 0, {
    path: ["comment"],
    message: "Say what should change",
  });

export const recommendationSchema = z.object({
  optionId: id,
  rationale: required(2000),
});

export const decideSchema = z.object({
  optionId: id,
  note: text(2000),
});

export const externalDecisionSchema = z.object({
  optionId: id,
  deciderName: required(200),
  decidedOn: date,
  method: z.enum(APPROVAL_METHODS),
  evidence: required(1000),
  note: text(2000),
});

export const baselineSchema = z.object({
  label: required(200),
  description: text(2000),
});

export const baselineItemSchema = z.object({ elementVersionId: id });

export { id as idSchema, nullableText, optionalId };
