import type { Tone } from "@/components/ui/status-tag";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];
export type ArchitectureDomain = Enums["architecture_domain"];
export type ElementKind = Enums["element_kind"];
/** Project Intelligence record kinds. review/deliverable/implementation_initiative are their own kinds (Phase 5). */
export type RecordKind = Exclude<
  ElementKind,
  "object" | "review" | "deliverable" | "implementation_initiative"
>;
/** The three Phase 5 kinds that reuse the element spine outside Project Intelligence (§3). */
export type Phase5Kind = "review" | "deliverable" | "implementation_initiative";
export type ElementLifecycle = Enums["element_lifecycle"];
export type MaturityState = Enums["maturity_state"];
export type ClientVisibility = Enums["client_visibility"];
export type ProvenanceType = Enums["provenance_type"];
export type IpClassification = Enums["ip_classification"];
export type StatementKind = Enums["statement_kind"];
export type AiReviewState = Enums["ai_review_state"];
export type ApprovalResponse = Enums["approval_response"];
export type ArchitectureApprovalMethod = Enums["architecture_approval_method"];
export type EvidenceStance = Enums["evidence_stance"];
export type EvidenceSourceType = Enums["evidence_source_type"];
export type ConfidenceLevel = Enums["confidence_level"];
export type ValidationStatus = Enums["validation_status"];
export type RiskStatus = Enums["risk_status"];
export type ConstraintCategory = Enums["constraint_category"];
export type ConstraintStatus = Enums["constraint_status"];
export type DependencyType = Enums["dependency_type"];
export type DependencyStatus = Enums["dependency_status"];
export type DecisionStatus = Enums["decision_status"];
export type RecommendationPriority = Enums["recommendation_priority"];
export type OpportunityStatus = Enums["opportunity_status"];
export type SkillProficiency = Enums["skill_proficiency"];
export type BaselineStatus = Enums["baseline_status"];
export type RelationshipCategory =
  | "structure"
  | "design_flow"
  | "intelligence"
  | "lineage"
  | "implementation";

/** Derived per published version (private.approval_state). Never stored. */
export type ApprovalState =
  "not_requested" | "awaiting_response" | "approved" | "changes_requested";

type Label = { label: string; tone: Tone };

export const DOMAINS = [
  "knowledge",
  "capability",
  "strategic_model",
  "application",
] as const satisfies readonly ArchitectureDomain[];

export const DOMAIN_LABELS: Record<ArchitectureDomain, string> = {
  knowledge: "Knowledge Architecture",
  capability: "Capability Architecture",
  strategic_model: "Strategic Model Architecture",
  application: "Application Architecture",
};

/** Short names for navigation and table columns. */
export const DOMAIN_SHORT_LABELS: Record<ArchitectureDomain, string> = {
  knowledge: "Knowledge",
  capability: "Capability",
  strategic_model: "Strategic Model",
  application: "Application",
};

/** What each domain answers (proposal §4). */
export const DOMAIN_QUESTIONS: Record<ArchitectureDomain, string> = {
  knowledge: "What must be understood.",
  capability: "What the organization must be able to do.",
  strategic_model: "The logic by which the development succeeds.",
  application: "How the architecture is put into operation.",
};

/** URL segments for the domain workspaces. */
export const DOMAIN_SLUGS: Record<ArchitectureDomain, string> = {
  knowledge: "knowledge",
  capability: "capability",
  strategic_model: "strategic-model",
  application: "application",
};

export function domainFromSlug(slug: string): ArchitectureDomain | null {
  return DOMAINS.find((d) => DOMAIN_SLUGS[d] === slug) ?? null;
}

export const RECORD_KIND_LABELS: Record<RecordKind, string> = {
  assumption: "Assumption",
  risk: "Risk",
  constraint: "Constraint",
  dependency: "Dependency",
  decision: "Decision",
  recommendation: "Recommendation",
  opportunity: "Opportunity",
};

export const RECORD_KIND_PLURALS: Record<RecordKind, string> = {
  assumption: "Assumptions",
  risk: "Risks",
  constraint: "Constraints",
  dependency: "Dependencies",
  decision: "Decisions",
  recommendation: "Recommendations",
  opportunity: "Opportunities",
};

/** Reference code prefixes. Mirrors public.element_reference_prefix. */
export const DOMAIN_PREFIXES: Record<ArchitectureDomain, string> = {
  knowledge: "KNW",
  capability: "CAP",
  strategic_model: "STR",
  application: "APP",
};

export const RECORD_PREFIXES: Record<RecordKind, string> = {
  assumption: "ASM",
  risk: "RSK",
  dependency: "DEP",
  decision: "DEC",
  recommendation: "REC",
  constraint: "CNS",
  opportunity: "OPP",
};

/** Mirrors public.element_reference_prefix for the Phase 5 kinds. */
export const PHASE_5_PREFIXES: Record<Phase5Kind, string> = {
  review: "REV",
  deliverable: "DLV",
  implementation_initiative: "IMP",
};

export function referencePrefix(kind: ElementKind, domain: ArchitectureDomain | null): string {
  if (kind === "object") {
    if (!domain) throw new Error("A core object needs a domain");
    return DOMAIN_PREFIXES[domain];
  }
  if (kind === "review" || kind === "deliverable" || kind === "implementation_initiative") {
    return PHASE_5_PREFIXES[kind];
  }
  return RECORD_PREFIXES[kind];
}

export const LIFECYCLE: Record<ElementLifecycle, Label> = {
  draft: { label: "Draft", tone: "neutral" },
  in_review: { label: "In review", tone: "attention" },
  published: { label: "Published", tone: "positive" },
  superseded: { label: "Superseded", tone: "neutral" },
  retired: { label: "Retired", tone: "neutral" },
};

export const MATURITY_STATES = [
  "undefined",
  "emerging",
  "defined",
  "structured",
  "operationalized",
] as const satisfies readonly MaturityState[];

export const MATURITY_LABELS: Record<MaturityState, string> = {
  undefined: "Undefined",
  emerging: "Emerging",
  defined: "Defined",
  structured: "Structured",
  operationalized: "Operationalized",
};

export const APPROVAL_STATE: Record<ApprovalState, Label> = {
  not_requested: { label: "Not requested", tone: "neutral" },
  awaiting_response: { label: "Awaiting response", tone: "attention" },
  approved: { label: "Approved", tone: "positive" },
  changes_requested: { label: "Changes requested", tone: "negative" },
};

export function approvalState(value: string | null | undefined): ApprovalState {
  return value && value in APPROVAL_STATE ? (value as ApprovalState) : "not_requested";
}

export const APPROVAL_RESPONSE_LABELS: Record<ApprovalResponse, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const APPROVAL_METHODS = [
  "meeting",
  "email",
  "signed_document",
  "other",
] as const satisfies readonly ArchitectureApprovalMethod[];

export const APPROVAL_METHOD_LABELS: Record<ArchitectureApprovalMethod, string> = {
  meeting: "Meeting",
  email: "Email",
  signed_document: "Signed document",
  other: "Other",
};

export const VISIBILITY_LABELS: Record<ClientVisibility, string> = {
  internal: "Internal only",
  client: "Client-visible when published",
};

export const PROVENANCE_TYPES = [
  "client_source",
  "public_source",
  "architect_observation",
  "architect_judgment",
  "client_decision",
  "ai_analysis",
  "methodology_derived",
  "system_derived",
] as const satisfies readonly ProvenanceType[];

/** Internal labels. */
export const PROVENANCE_LABELS: Record<ProvenanceType, string> = {
  client_source: "Client source",
  public_source: "Public source",
  architect_observation: "Architect observation",
  architect_judgment: "Architect judgment",
  client_decision: "Client decision",
  ai_analysis: "AI analysis",
  methodology_derived: "Methodology-derived",
  system_derived: "System-derived",
};

/** What clients read (proposal §7). */
export const PROVENANCE_CLIENT_LABELS: Record<ProvenanceType, string> = {
  client_source: "From your organization",
  public_source: "Public source",
  architect_observation: "TPLCo observation",
  architect_judgment: "TPLCo assessment",
  client_decision: "Your decision",
  ai_analysis: "AI-assisted analysis (reviewed)",
  methodology_derived: "From the Development Architecture Method",
  system_derived: "Calculated",
};

/**
 * Provenance an editor may choose. client_decision and system_derived are
 * written only by operations; ai_analysis only by AI, which Phase 3 does not
 * build.
 */
export const EDITABLE_PROVENANCE = [
  "client_source",
  "public_source",
  "architect_observation",
  "architect_judgment",
  "methodology_derived",
] as const satisfies readonly ProvenanceType[];

/** Provenance allowed on an evidence source (checked in the database). */
export const EVIDENCE_PROVENANCE = [
  "client_source",
  "public_source",
  "architect_observation",
  "architect_judgment",
  "methodology_derived",
] as const satisfies readonly ProvenanceType[];

export const IP_CLASSIFICATIONS = [
  "project_work_product",
  "client_confidential",
  "client_owned_source_material",
  "public_source",
  "licensed_third_party_source",
  "generated_analysis",
  "tplco_method_ip",
] as const satisfies readonly IpClassification[];

export const IP_CLASSIFICATION_LABELS: Record<IpClassification, string> = {
  tplco_method_ip: "TPLCo Method IP (never client-visible)",
  client_confidential: "Client confidential",
  client_owned_source_material: "Client-owned source material",
  project_work_product: "Project work product",
  public_source: "Public source",
  licensed_third_party_source: "Licensed third-party source",
  generated_analysis: "Generated analysis",
};

export const STATEMENT_KINDS = [
  "finding",
  "observation",
  "rationale",
  "implication",
  "definition",
  "note",
] as const satisfies readonly StatementKind[];

export const STATEMENT_KIND_LABELS: Record<StatementKind, string> = {
  finding: "Findings",
  observation: "Observations",
  rationale: "Rationale",
  implication: "Implications",
  definition: "Definitions",
  note: "Notes",
};

export const STATEMENT_KIND_SINGULAR: Record<StatementKind, string> = {
  finding: "Finding",
  observation: "Observation",
  rationale: "Rationale",
  implication: "Implication",
  definition: "Definition",
  note: "Note",
};

export const AI_REVIEW: Record<AiReviewState, Label> = {
  not_applicable: { label: "Not AI", tone: "neutral" },
  pending: { label: "AI: awaiting review", tone: "attention" },
  accepted: { label: "AI: accepted", tone: "positive" },
  rejected: { label: "AI: rejected", tone: "negative" },
};

export const EVIDENCE_STANCES = [
  "supports",
  "contradicts",
  "context",
] as const satisfies readonly EvidenceStance[];

export const EVIDENCE_STANCE_LABELS: Record<EvidenceStance, string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  context: "Context",
};

export const EVIDENCE_SOURCE_TYPES = [
  "document",
  "interview",
  "meeting_notes",
  "dataset",
  "publication",
  "regulation",
  "web",
  "internal_analysis",
  "other",
] as const satisfies readonly EvidenceSourceType[];

export const EVIDENCE_SOURCE_TYPE_LABELS: Record<EvidenceSourceType, string> = {
  document: "Document",
  interview: "Interview",
  meeting_notes: "Meeting notes",
  dataset: "Dataset",
  publication: "Publication",
  regulation: "Regulation",
  web: "Web page",
  internal_analysis: "Internal analysis",
  other: "Other",
};

export const CONFIDENCE_LEVELS = [
  "low",
  "medium",
  "high",
] as const satisfies readonly ConfidenceLevel[];
export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const VALIDATION_STATUSES = [
  "unvalidated",
  "validating",
  "validated",
  "invalidated",
] as const satisfies readonly ValidationStatus[];
export const VALIDATION_STATUS: Record<ValidationStatus, Label> = {
  unvalidated: { label: "Unvalidated", tone: "neutral" },
  validating: { label: "Being validated", tone: "attention" },
  validated: { label: "Validated", tone: "positive" },
  invalidated: { label: "Invalidated", tone: "negative" },
};

export const RISK_STATUSES = [
  "open",
  "mitigating",
  "accepted",
  "closed",
  "materialized",
] as const satisfies readonly RiskStatus[];
export const RISK_STATUS: Record<RiskStatus, Label> = {
  open: { label: "Open", tone: "attention" },
  mitigating: { label: "Mitigating", tone: "accent" },
  accepted: { label: "Accepted", tone: "neutral" },
  closed: { label: "Closed", tone: "neutral" },
  materialized: { label: "Materialized", tone: "negative" },
};

/** Probability and impact are rated 1 to 5 (checked in the database). */
export const RISK_SCALE = [1, 2, 3, 4, 5] as const;

export const CONSTRAINT_CATEGORIES = [
  "regulatory",
  "financial",
  "physical",
  "contractual",
  "political",
  "temporal",
  "other",
] as const satisfies readonly ConstraintCategory[];
export const CONSTRAINT_CATEGORY_LABELS: Record<ConstraintCategory, string> = {
  regulatory: "Regulatory",
  financial: "Financial",
  physical: "Physical",
  contractual: "Contractual",
  political: "Political",
  temporal: "Temporal",
  other: "Other",
};

export const CONSTRAINT_STATUSES = [
  "in_force",
  "relaxed",
  "lifted",
] as const satisfies readonly ConstraintStatus[];
export const CONSTRAINT_STATUS: Record<ConstraintStatus, Label> = {
  in_force: { label: "In force", tone: "attention" },
  relaxed: { label: "Relaxed", tone: "neutral" },
  lifted: { label: "Lifted", tone: "neutral" },
};

export const DEPENDENCY_TYPES = [
  "prerequisite",
  "sequence",
  "input",
  "funding",
  "external",
] as const satisfies readonly DependencyType[];
export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  prerequisite: "Prerequisite",
  sequence: "Sequence",
  input: "Input",
  funding: "Funding",
  external: "External",
};

export const DEPENDENCY_STATUSES = [
  "open",
  "satisfied",
  "at_risk",
  "broken",
] as const satisfies readonly DependencyStatus[];
export const DEPENDENCY_STATUS: Record<DependencyStatus, Label> = {
  open: { label: "Open", tone: "neutral" },
  satisfied: { label: "Satisfied", tone: "positive" },
  at_risk: { label: "At risk", tone: "attention" },
  broken: { label: "Broken", tone: "negative" },
};

export const DECISION_STATUS: Record<DecisionStatus, Label> = {
  open: { label: "Open", tone: "neutral" },
  recommended: { label: "Recommendation made", tone: "attention" },
  decided: { label: "Decided", tone: "positive" },
  deferred: { label: "Deferred", tone: "neutral" },
  superseded: { label: "Superseded", tone: "neutral" },
};

export const RECOMMENDATION_PRIORITIES = [
  "critical",
  "important",
  "advisable",
] as const satisfies readonly RecommendationPriority[];
export const RECOMMENDATION_PRIORITY: Record<RecommendationPriority, Label> = {
  critical: { label: "Critical", tone: "negative" },
  important: { label: "Important", tone: "attention" },
  advisable: { label: "Advisable", tone: "neutral" },
};

export const OPPORTUNITY_STATUSES = [
  "identified",
  "evaluating",
  "pursuing",
  "realized",
  "declined",
  "lapsed",
] as const satisfies readonly OpportunityStatus[];
export const OPPORTUNITY_STATUS: Record<OpportunityStatus, Label> = {
  identified: { label: "Identified", tone: "neutral" },
  evaluating: { label: "Being evaluated", tone: "attention" },
  pursuing: { label: "Being pursued", tone: "accent" },
  realized: { label: "Realized", tone: "positive" },
  declined: { label: "Declined", tone: "neutral" },
  lapsed: { label: "Lapsed", tone: "neutral" },
};

/** Opportunity value and feasibility are rated 1 to 5 (checked in the database). */
export const OPPORTUNITY_SCALE = [1, 2, 3, 4, 5] as const;

export const SKILL_PROFICIENCIES = [
  "foundational",
  "proficient",
  "expert",
] as const satisfies readonly SkillProficiency[];
export const SKILL_PROFICIENCY_LABELS: Record<SkillProficiency, string> = {
  foundational: "Foundational",
  proficient: "Proficient",
  expert: "Expert",
};

export const RELATIONSHIP_CATEGORY_LABELS: Record<RelationshipCategory, string> = {
  structure: "Structure",
  design_flow: "Design flow",
  intelligence: "Project Intelligence",
  lineage: "Lineage and tension",
  implementation: "Reviews, deliverables and implementation",
};

export const BASELINE_STATUS: Record<BaselineStatus, Label> = {
  draft: { label: "Draft", tone: "neutral" },
  frozen: { label: "Frozen", tone: "accent" },
};

/** Architecture activity events, as returned by public.architecture_activity. */
export const ARCHITECTURE_EVENT_LABELS: Record<string, string> = {
  element_created: "Created",
  element_edited: "Working copy edited",
  draft_deleted: "Draft deleted",
  submitted_for_review: "Submitted for review",
  returned_from_review: "Returned from review",
  element_retired: "Retired",
  element_superseded: "Superseded",
  ai_content_reviewed: "AI content reviewed",
  provenance_changed: "Provenance changed",
  version_published: "Version published",
  statement_added: "Statement added",
  statement_edited: "Statement edited",
  statement_removed: "Statement removed",
  evidence_cited: "Evidence cited",
  citation_edited: "Citation edited",
  citation_removed: "Citation removed",
  evidence_source_added: "Evidence source added",
  evidence_source_edited: "Evidence source edited",
  evidence_source_removed: "Evidence source removed",
  lineage_recorded: "Method lineage recorded",
  lineage_removed: "Method lineage removed",
  relationship_added: "Relationship added",
  relationship_edited: "Relationship edited",
  relationship_published: "Relationship published",
  relationship_retired: "Relationship retired",
  relationship_removed: "Relationship removed",
  decision_option_added: "Decision option added",
  decision_option_edited: "Decision option edited",
  decision_option_removed: "Decision option removed",
  decision_recommended: "Recommendation recorded",
  decision_recorded: "Decision recorded",
  decision_deferred: "Decision deferred",
  approval_requested: "Approval requested",
  approval_recorded: "External approval recorded",
  approval_responded: "Client responded",
  domain_assessed: "Domain assessment recorded",
  baseline_created: "Baseline created",
  baseline_frozen: "Baseline frozen",
  baseline_deleted: "Baseline deleted",
  record_resolved: "Resolved",
  record_reopened: "Reopened",
  record_triaged: "Triaged",
  escalation_raised: "Escalated",
  escalation_acknowledged: "Escalation acknowledged",
  escalation_resolved: "Escalation resolved",
  client_action_sent: "Request sent to the client",
  client_action_responded: "Client responded to a request",
  client_action_closed: "Request closed",
  client_action_returned: "Request returned for more",
  client_action_withdrawn: "Request withdrawn",
  client_action_reassigned: "Request reassigned",
  response_recorded_as_evidence: "Client response recorded as evidence",
  contribution_received: "Client input received",
  contribution_handled: "Client input handled",
  area_assigned: "Area assigned",
  area_removed: "Area removed",
  signal_dismissed: "Signal dismissed",
};
