import type { Tone } from "@/components/ui/status-tag";
import type { AppRole } from "@/domain/roles/roles";
import type { Database } from "@/types/database";

/**
 * Method Library vocabulary (Phase 6 proposal §7-§17, D1-D34). Mirrors
 * supabase/migrations/20261005*; catalog.test.ts checks the two agree. The
 * database is the authority for every rule: this module only lets the UI
 * offer what will succeed.
 *
 * Methodology is a governed practice layer, not a fifth architecture domain.
 * Nothing here is ever shown to a client except the DAM release label and
 * architect-authored approach statements (ADR-0022, ADR-0049).
 */

type Enums = Database["public"]["Enums"];
export type MethodAssetForm = Enums["method_asset_form"];
export type MethodAssetVersionLifecycle = Enums["method_asset_version_lifecycle"];
export type MethodIdentityDisclosure = Enums["method_identity_disclosure"];
export type MethodAssetOrigin = Enums["method_asset_origin"];
export type MethodRightsRole = Enums["method_rights_role"];
export type DamReleaseStatus = Enums["dam_release_status"];
export type MethodApplicationState = Enums["method_application_state"];
export type MethodApplicationElementRole = Enums["method_application_element_role"];
export type MethodApplicationEvidenceRole = Enums["method_application_evidence_role"];
export type MethodStageTreatment = Enums["method_stage_treatment"];
export type MethodLineageRole = Enums["method_lineage_role"];
export type PracticeCapability = Enums["practice_capability"];
export type AcceptanceCriterionState = Enums["acceptance_criterion_state"];

type Label = { label: string; tone: Tone };

// -----------------------------------------------------------------------------
// Forms (D1): each form has one verb and one enforced behavior.
// -----------------------------------------------------------------------------
export const METHOD_ASSET_FORMS = [
  "method",
  "model",
  "standard",
  "instrument",
  "template",
] as const satisfies readonly MethodAssetForm[];

export const FORMS: Record<MethodAssetForm, { label: string; verb: string; behavior: string }> = {
  method: {
    label: "Method",
    verb: "performed",
    behavior: "Performed through a Method Application, in stages, toward expected outputs.",
  },
  model: {
    label: "Model",
    verb: "applied",
    behavior: "Instantiated into architecture; the only basis for methodology-derived content.",
  },
  standard: {
    label: "Standard",
    verb: "judged against",
    behavior: "Criteria that work, architecture or readiness is judged against. Never a verdict.",
  },
  instrument: {
    label: "Instrument",
    verb: "used within",
    behavior: "Used within a Method Application, for example to gather evidence.",
  },
  template: {
    label: "Template",
    verb: "produced from",
    behavior: "A Deliverable is produced from it. It is never a deliverable itself.",
  },
};

export function formLabel(form: MethodAssetForm | null): string {
  return form ? FORMS[form].label : "Legacy";
}

/** Modes of a Method (Kerrick's wording). */
export const METHOD_MODES = ["discover", "define", "assess", "validate", "govern"] as const;
export type MethodMode = (typeof METHOD_MODES)[number];

/** Settings a Standard may be judged in. */
export const STANDARD_SETTINGS = ["review", "completion", "assessment"] as const;
export type StandardSetting = (typeof STANDARD_SETTINGS)[number];

// -----------------------------------------------------------------------------
// Lifecycles
// -----------------------------------------------------------------------------
export const VERSION_LIFECYCLES = [
  "draft",
  "published",
  "superseded",
  "retired",
] as const satisfies readonly MethodAssetVersionLifecycle[];

export const VERSION_LIFECYCLE: Record<MethodAssetVersionLifecycle, Label> = {
  draft: { label: "Draft", tone: "attention" },
  published: { label: "Published", tone: "positive" },
  superseded: { label: "Superseded", tone: "neutral" },
  retired: { label: "Retired", tone: "negative" },
};

export const ASSET_STATUSES = ["active", "retired", "legacy"] as const;
export type MethodAssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS: Record<MethodAssetStatus, Label> = {
  active: { label: "Active", tone: "positive" },
  retired: { label: "Retired", tone: "negative" },
  legacy: { label: "Legacy", tone: "attention" },
};

export const DAM_RELEASE_STATUSES = [
  "draft",
  "published",
  "superseded",
  "retired",
] as const satisfies readonly DamReleaseStatus[];

export const DAM_RELEASE_STATUS: Record<DamReleaseStatus, Label> = VERSION_LIFECYCLE;

// -----------------------------------------------------------------------------
// Identity, origin and rights (D21, D23)
// -----------------------------------------------------------------------------
export const IDENTITY_DISCLOSURES = [
  "internal_only",
  "may_be_named",
] as const satisfies readonly MethodIdentityDisclosure[];

export const IDENTITY_DISCLOSURE: Record<MethodIdentityDisclosure, string> = {
  internal_only: "Internal only",
  may_be_named: "May be named to clients",
};

export const METHOD_ASSET_ORIGINS = [
  "tplco_developed",
  "co_developed",
  "client_owned",
  "licensed_in",
  "third_party",
] as const satisfies readonly MethodAssetOrigin[];

export const ORIGIN: Record<MethodAssetOrigin, string> = {
  tplco_developed: "TPLCo developed",
  co_developed: "Co-developed",
  client_owned: "Client owned",
  licensed_in: "Licensed in",
  third_party: "Third party",
};

export const RIGHTS_ROLES = [
  "owner",
  "co_owner",
  "licensor",
  "contributor",
] as const satisfies readonly MethodRightsRole[];

export const RIGHTS_ROLE: Record<MethodRightsRole, string> = {
  owner: "Owner",
  co_owner: "Co-owner",
  licensor: "Licensor",
  contributor: "Contributor",
};

// -----------------------------------------------------------------------------
// Method Applications (D14, D17)
// -----------------------------------------------------------------------------
export const APPLICATION_STATES = [
  "planned",
  "in_progress",
  "completed",
  "discontinued",
] as const satisfies readonly MethodApplicationState[];

export const APPLICATION_STATE: Record<MethodApplicationState, Label> = {
  planned: { label: "Planned", tone: "neutral" },
  in_progress: { label: "In progress", tone: "accent" },
  completed: { label: "Completed", tone: "positive" },
  discontinued: { label: "Discontinued", tone: "negative" },
};

export function isClosedApplication(state: MethodApplicationState): boolean {
  return state === "completed" || state === "discontinued";
}

export const ELEMENT_ROLES = [
  "examined",
  "produced",
  "revised",
  "informed",
] as const satisfies readonly MethodApplicationElementRole[];

export const ELEMENT_ROLE: Record<MethodApplicationElementRole, string> = {
  examined: "Examined",
  produced: "Produced",
  revised: "Revised",
  informed: "Informed",
};

type ElementKind = Enums["element_kind"];
const PI_KINDS: readonly ElementKind[] = [
  "assumption",
  "risk",
  "constraint",
  "dependency",
  "decision",
  "recommendation",
  "opportunity",
];

/** Which element kinds each link role may target (§12.3; enforced in the database). */
export const ELEMENT_ROLE_KINDS: Record<
  MethodApplicationElementRole,
  readonly ElementKind[] | "any"
> = {
  examined: "any",
  produced: ["object", ...PI_KINDS, "deliverable"],
  revised: ["object", ...PI_KINDS, "deliverable", "implementation_initiative"],
  informed: ["decision", "recommendation", "review", "implementation_initiative"],
};

export function roleAllowsKind(role: MethodApplicationElementRole, kind: ElementKind): boolean {
  const kinds = ELEMENT_ROLE_KINDS[role];
  return kinds === "any" || kinds.includes(kind);
}

export const EVIDENCE_ROLES = [
  "drew_on",
  "gathered",
] as const satisfies readonly MethodApplicationEvidenceRole[];

export const EVIDENCE_ROLE: Record<MethodApplicationEvidenceRole, string> = {
  drew_on: "Drew on",
  gathered: "Gathered",
};

export const STAGE_TREATMENTS = [
  "followed",
  "adapted",
  "skipped",
] as const satisfies readonly MethodStageTreatment[];

export const STAGE_TREATMENT: Record<MethodStageTreatment, string> = {
  followed: "Followed",
  adapted: "Adapted",
  skipped: "Skipped",
};

// -----------------------------------------------------------------------------
// Typed lineage (D18)
// -----------------------------------------------------------------------------
export const LINEAGE_ROLES = [
  "instantiates",
  "produced_from",
  "judged_against",
  "legacy_derived_from",
] as const satisfies readonly MethodLineageRole[];

export const LINEAGE_ROLE: Record<MethodLineageRole, string> = {
  instantiates: "Instantiates",
  produced_from: "Produced from",
  judged_against: "Judged against",
  legacy_derived_from: "Derived from (pre-Phase 6)",
};

/** Form and element kinds each writable lineage role accepts. */
export const LINEAGE_RULES: Record<
  Exclude<MethodLineageRole, "legacy_derived_from">,
  { form: MethodAssetForm; kinds: readonly ElementKind[] }
> = {
  instantiates: { form: "model", kinds: ["object"] },
  produced_from: { form: "template", kinds: ["deliverable"] },
  judged_against: { form: "standard", kinds: ["review", "object", "implementation_initiative"] },
};

export function lineageRolesForKind(
  kind: ElementKind,
): Exclude<MethodLineageRole, "legacy_derived_from">[] {
  return (Object.keys(LINEAGE_RULES) as Exclude<MethodLineageRole, "legacy_derived_from">[]).filter(
    (role) => LINEAGE_RULES[role].kinds.includes(kind),
  );
}

// -----------------------------------------------------------------------------
// Practice capabilities (D10, D11)
// -----------------------------------------------------------------------------
// administer_practice (V1-A, D1) is practice administration, not Method
// authority: who invites, suspends and re-roles TPLCo staff and edits the
// practice organization. Its holders administer it; publish_methodology
// holders administer the two Method capabilities.
export const PRACTICE_CAPABILITIES = [
  "author_methodology",
  "publish_methodology",
  "administer_practice",
] as const satisfies readonly PracticeCapability[];

export const PRACTICE_CAPABILITY_LABELS: Record<PracticeCapability, string> = {
  author_methodology: "Author methodology",
  publish_methodology: "Publish methodology",
  administer_practice: "Administer the practice",
};

/** Mirrors public.practice_role_capability_defaults. */
export const PRACTICE_ROLE_DEFAULTS: Partial<Record<AppRole, readonly PracticeCapability[]>> = {
  principal_architect: ["author_methodology", "publish_methodology", "administer_practice"],
  architect: ["author_methodology"],
  system_administrator: ["administer_practice"],
};

// -----------------------------------------------------------------------------
// Acceptance criteria (D20)
// -----------------------------------------------------------------------------
export const ACCEPTANCE_CRITERION_STATES = [
  "proposed",
  "agreed",
  "superseded",
  "withdrawn",
] as const satisfies readonly AcceptanceCriterionState[];

export const ACCEPTANCE_CRITERION_STATE: Record<AcceptanceCriterionState, Label> = {
  proposed: { label: "Proposed", tone: "attention" },
  agreed: { label: "Agreed", tone: "positive" },
  superseded: { label: "Superseded", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "negative" },
};

/** Element kinds an acceptance criterion may govern. */
export const CRITERION_GOVERNED_KINDS: readonly ElementKind[] = [
  "implementation_initiative",
  "object",
];
