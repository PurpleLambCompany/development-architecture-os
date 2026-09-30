import { z } from "zod";
import { isIsoDate } from "@/domain/finance/business-date";
import { DOMAINS, EVIDENCE_SOURCE_TYPES } from "@/domain/architecture/catalog";
import { DELIVERABLE_TYPES } from "@/domain/deliverables/catalog";
import {
  ELEMENT_ROLES,
  EVIDENCE_ROLES,
  IDENTITY_DISCLOSURES,
  METHOD_ASSET_FORMS,
  METHOD_ASSET_ORIGINS,
  METHOD_MODES,
  PRACTICE_CAPABILITIES,
  RIGHTS_ROLES,
  STAGE_TREATMENTS,
  STANDARD_SETTINGS,
} from "./catalog";
import { METHOD_FILE_MAX_BYTES, METHOD_FILE_TYPES } from "./files";

/**
 * Form schemas for Method Library and practice actions. Forms send strings;
 * these give clear field errors. The database re-checks every rule (form,
 * lifecycle, capability, release, lineage and client boundary).
 */

const id = z.uuid("Choose a record");
const text = (max: number) =>
  z.string().trim().max(max, `At most ${max.toLocaleString()} characters`);
const required = (max: number) => text(max).min(1, "Required");
const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || isIsoDate(value), "Enter a date (YYYY-MM-DD)")
  .transform((value) => (value === "" ? null : value));
const date = z.string().trim().refine(isIsoDate, "Enter a date (YYYY-MM-DD)");
const optionalId = z
  .string()
  .trim()
  .refine((value) => value === "" || z.uuid().safeParse(value).success, "Choose a record")
  .transform((value) => (value === "" ? null : value));
const yesNo = z
  .string()
  .default("no")
  .transform((value) => value === "yes" || value === "true" || value === "on");

/** Checkbox groups arrive as an array, a single string or false. */
const list = <T extends z.ZodType<string>>(item: T) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value : typeof value === "string" && value ? [value] : []),
    z.array(item),
  );

const form = z.enum(METHOD_ASSET_FORMS, "Choose a form");
const categoryKey = z.string().regex(/^[a-z][a-z_]*$/, "Choose a category");
const versionLabel = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 .-]{0,39}$/, "Letters, digits, spaces, dots and dashes");

// Method Assets -----------------------------------------------------------------------

export const createAssetSchema = z.object({
  title: required(200),
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "Lowercase letters, digits and dashes"),
  form,
  categoryKey,
  origin: z.enum(METHOD_ASSET_ORIGINS).default("tplco_developed"),
});

export const updateAssetSchema = z.object({
  title: required(200),
  categoryKey,
  usageRestriction: text(2000),
});

export const adoptLegacySchema = z.object({ form, categoryKey });
export const reasonSchema = z.object({ reason: required(2000) });
export const originSchema = z.object({
  origin: z.enum(METHOD_ASSET_ORIGINS, "Choose an origin"),
  reason: required(2000),
});

export const rightsHolderSchema = z
  .object({
    organizationId: optionalId.optional(),
    externalHolderName: text(200),
    holderRole: z.enum(RIGHTS_ROLES, "Choose a role"),
    agreementReference: text(200),
    effectiveOn: optionalDate,
    note: text(2000),
  })
  .refine((v) => !!v.organizationId !== !!v.externalHolderName, {
    message: "Name an organization or an outside holder, not both",
    path: ["externalHolderName"],
  });

// Version content ---------------------------------------------------------------------

export const versionContentSchema = z.object({
  architecturalQuestion: text(2000),
  summary: text(4000),
  applicability: text(4000),
  exclusions: text(4000),
  prerequisites: text(4000).default(""),
  expectedInputs: text(4000),
  evidenceExpectations: text(4000),
  practitionerRoles: text(4000).default(""),
  completionCriteria: text(4000).default(""),
  completionStandardVersionId: optionalId.default(""),
  reviewImplications: text(4000).default(""),
  implementationImplications: text(4000).default(""),
  practitionerInstructions: text(20000),
  internalNotes: text(4000),
  modes: list(z.enum(METHOD_MODES)),
  identityDisclosure: z.enum(IDENTITY_DISCLOSURES).default("internal_only"),
  disclosableName: text(200),
  changeSummary: text(4000),
  externalBasis: text(4000),
});

export type VersionContent = z.output<typeof versionContentSchema>;

/** Only the fields a form uses; method-only fields are sent empty otherwise. */
export function toVersionContent(v: VersionContent, isMethod: boolean) {
  const methodOnly = (value: string) => (isMethod ? value : "");
  return {
    architectural_question: v.architecturalQuestion,
    summary: v.summary,
    applicability: v.applicability,
    exclusions: v.exclusions,
    prerequisites: methodOnly(v.prerequisites),
    expected_inputs: v.expectedInputs,
    evidence_expectations: v.evidenceExpectations,
    practitioner_roles: methodOnly(v.practitionerRoles),
    completion_criteria: methodOnly(v.completionCriteria),
    completion_standard_version_id: isMethod ? v.completionStandardVersionId : null,
    review_implications: methodOnly(v.reviewImplications),
    implementation_implications: methodOnly(v.implementationImplications),
    practitioner_instructions: v.practitionerInstructions,
    internal_notes: v.internalNotes,
    modes: isMethod ? v.modes : [],
    identity_disclosure: v.identityDisclosure,
    disclosable_name: v.identityDisclosure === "may_be_named" ? v.disclosableName : "",
    change_summary: v.changeSummary,
    external_basis: v.externalBasis,
  };
}

export const domainsSchema = z.object({ domains: list(z.enum(DOMAINS)) });
export const structureTextSchema = z.object({ text: text(20000) });
export const outputsSchema = z.object({
  outputs: list(z.string().regex(/^(object|deliverable|kind):[a-z_]*$/)),
});
export const componentsSchema = z.object({ componentVersionIds: list(z.uuid()) });
export const contextsSchema = z.object({ contextIds: list(z.uuid()) });
export const judgedInSchema = z.object({ settings: list(z.enum(STANDARD_SETTINGS)) });
export const evidenceTypesSchema = z.object({ types: list(z.enum(EVIDENCE_SOURCE_TYPES)) });
export const templateSpecSchema = z.object({
  deliverableType: z.enum(DELIVERABLE_TYPES, "Choose a deliverable type"),
  sections: text(20000),
});

export const publishVersionSchema = z.object({
  versionLabel,
  changeSummary: required(4000),
  effectiveOn: optionalDate,
});

export const learningSourceSchema = z.object({ applicationId: id, note: text(2000) });
export const fileSchema = z.object({
  fileName: required(200),
  contentType: z.enum(METHOD_FILE_TYPES, "Upload a PDF, text, CSV, Word, Excel or PowerPoint file"),
  sizeBytes: z.coerce.number().int().positive().max(METHOD_FILE_MAX_BYTES, "At most 25 MB"),
});

// DAM releases ------------------------------------------------------------------------

export const createReleaseSchema = z.object({
  versionLabel: z
    .string()
    .trim()
    .regex(/^[0-9]+(\.[0-9]+){0,2}$/, "A release label such as 1.1"),
  title: required(200),
  summary: text(4000),
});
export const updateReleaseSchema = z.object({
  title: required(200),
  summary: text(4000),
  changeSummary: text(4000),
});
export const releaseMemberSchema = z.object({ versionId: id });
export const publishReleaseSchema = z.object({
  changeSummary: required(4000),
  effectiveOn: optionalDate,
});

// Development Contexts ----------------------------------------------------------------

export const createContextSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{0,59}$/, "Lowercase letters, digits and underscores"),
  label: required(120),
  definition: required(2000),
});
export const reviseContextSchema = z.object({
  label: required(120),
  definition: required(2000),
  reason: required(2000),
});

// Engagement practice -----------------------------------------------------------------

export const engagementReleaseSchema = z.object({ releaseId: id, reason: required(2000) });
export const engagementContextsSchema = z
  .object({ contextIds: list(z.uuid()), primaryContextId: optionalId })
  .refine((v) => !v.primaryContextId || v.contextIds.includes(v.primaryContextId), {
    message: "The primary context must be one of the chosen contexts",
    path: ["primaryContextId"],
  });

export const startApplicationSchema = z.object({
  versionId: id,
  title: required(200),
  selectionReason: required(4000),
  architecturalQuestion: text(2000),
  outsideReleaseReason: text(2000),
  leadMemberId: optionalId,
});
export const updateApplicationSchema = z.object({
  title: required(200),
  selectionReason: required(4000),
  architecturalQuestion: text(2000),
  engagementWide: yesNo,
});
export const practitionersSchema = z.object({
  leadMemberId: id,
  contributorMemberIds: list(z.uuid()),
});
export const stageNoteSchema = z.object({
  treatment: z.enum(STAGE_TREATMENTS, "Choose a treatment"),
  reason: text(2000),
  note: text(4000),
});
export const applicationAssetSchema = z.object({ versionId: id, deviationNote: text(2000) });
export const linkElementSchema = z.object({
  elementId: id,
  role: z.enum(ELEMENT_ROLES, "Choose a role"),
  note: text(2000),
});
export const linkEvidenceSchema = z.object({
  evidenceSourceId: id,
  role: z.enum(EVIDENCE_ROLES, "Choose a role"),
  instrumentVersionId: optionalId,
  note: text(2000),
});
export const completeApplicationSchema = z.object({
  completionStatement: required(4000),
  retrospective: text(4000),
});
export const addendumSchema = z.object({ body: required(4000) });

// Acceptance criteria -----------------------------------------------------------------

/** "versionId:key" from the informing Standard picker, or empty. */
const informing = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[0-9a-f-]{36}:[a-z][a-z0-9_]*$/.test(v), "Choose a criterion")
  .transform((v) => {
    if (!v) return { versionId: null, key: null };
    const [versionId, key] = v.split(":") as [string, string];
    return { versionId, key };
  });

export const proposeCriterionSchema = z.object({
  body: required(2000),
  informing: z.string().default("").pipe(informing),
  clientVisible: yesNo,
});
export const agreeCriterionSchema = z.object({
  agreedWith: required(300),
  agreedOn: date,
  evidenceSourceId: optionalId,
});
export const supersedeCriterionSchema = z.object({
  body: required(2000),
  reason: required(2000),
  agreedWith: text(300),
  agreedOn: optionalDate,
});
export const validationNoteSchema = z.object({ note: text(2000) });

// Practice capabilities ---------------------------------------------------------------

export const practiceOverrideSchema = z.object({
  capability: z.enum(PRACTICE_CAPABILITIES),
  granted: yesNo,
  reason: required(2000),
});
