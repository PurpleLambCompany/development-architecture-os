import type { Tone } from "@/components/ui/status-tag";
import {
  CONSTRAINT_STATUS,
  DECISION_STATUS,
  DEPENDENCY_STATUS,
  OPPORTUNITY_STATUS,
  RISK_STATUS,
  VALIDATION_STATUS,
  type RecordKind,
} from "@/domain/architecture/catalog";
import type { Database } from "@/types/database";

/**
 * Project Intelligence vocabulary (Phase 4 proposal §4 to §9). Mirrors
 * supabase/migrations/20261002000100_project_intelligence.sql; catalog.test.ts
 * checks the two agree. The database is the authority for every rule.
 */

type Enums = Database["public"]["Enums"];
export type IntelligenceAttention = Enums["intelligence_attention"];
export type TriageState = Enums["triage_state"];
export type EscalationLevel = Enums["escalation_level"];
export type ClientActionKind = Enums["client_action_kind"];
export type ClientActionStatus = Enums["client_action_status"];
export type ContributionStatus = Enums["contribution_status"];
export type EngagementFilePurpose = Enums["engagement_file_purpose"];

type Label = { label: string; tone: Tone };

// Categories ---------------------------------------------------------------------

/** Record kinds with a controlled category list (constraints keep their Phase 3 enum). */
export const CATEGORIZED_KINDS = [
  "assumption",
  "risk",
  "decision",
  "recommendation",
  "opportunity",
] as const satisfies readonly RecordKind[];
export type CategorizedKind = (typeof CATEGORIZED_KINDS)[number];

export type Category = { key: string; label: string; definition: string };

export const INTELLIGENCE_CATEGORIES: Record<CategorizedKind, readonly Category[]> = {
  assumption: [
    {
      key: "market",
      label: "Market",
      definition: "Demand, pricing, competition or the behavior of the market.",
    },
    {
      key: "stakeholder",
      label: "Stakeholder",
      definition: "The commitment, support or behavior of a stakeholder.",
    },
    { key: "financial", label: "Financial", definition: "Capital, funding, costs or revenue." },
    {
      key: "capability",
      label: "Capability",
      definition: "Whether the organization has, or can build, a capability.",
    },
    {
      key: "regulatory",
      label: "Regulatory",
      definition: "What law, regulation or policy will allow or require.",
    },
    {
      key: "operational",
      label: "Operational",
      definition: "How the development will operate day to day.",
    },
    {
      key: "timing",
      label: "Timing",
      definition: "When something will happen or become available.",
    },
    { key: "other", label: "Other", definition: "Anything the categories above do not describe." },
  ],
  risk: [
    {
      key: "strategic",
      label: "Strategic",
      definition: "The strategy itself proves wrong or is overtaken.",
    },
    {
      key: "financial",
      label: "Financial",
      definition: "Capital, funding, costs or revenue fall short.",
    },
    {
      key: "capability",
      label: "Capability",
      definition: "A required capability, role or skill is missing or lost.",
    },
    {
      key: "governance",
      label: "Governance",
      definition: "Authority, decision rights or oversight fail.",
    },
    {
      key: "stakeholder",
      label: "Stakeholder",
      definition: "A stakeholder withdraws, resists or changes position.",
    },
    {
      key: "regulatory",
      label: "Regulatory",
      definition: "Law, regulation or policy changes or is not met.",
    },
    {
      key: "delivery",
      label: "Delivery",
      definition: "The development cannot be put into operation as designed.",
    },
    {
      key: "reputational",
      label: "Reputational",
      definition: "Standing with the public, partners or funders is damaged.",
    },
    {
      key: "external",
      label: "External",
      definition: "Events outside the development's influence.",
    },
    { key: "other", label: "Other", definition: "Anything the categories above do not describe." },
  ],
  decision: [
    {
      key: "structural",
      label: "Structural",
      definition: "The form or structure of the development.",
    },
    {
      key: "governance",
      label: "Governance",
      definition: "Authority, decision rights or oversight.",
    },
    {
      key: "investment",
      label: "Investment",
      definition: "Where capital or resources are committed.",
    },
    {
      key: "partnership",
      label: "Partnership",
      definition: "Who the development works with, and on what terms.",
    },
    { key: "sequencing", label: "Sequencing", definition: "The order in which things happen." },
    { key: "other", label: "Other", definition: "Anything the categories above do not describe." },
  ],
  recommendation: [
    {
      key: "structural",
      label: "Structural",
      definition: "The form or structure of the development.",
    },
    { key: "capability", label: "Capability", definition: "Capabilities, roles and skills." },
    {
      key: "governance",
      label: "Governance",
      definition: "Authority, decision rights or oversight.",
    },
    { key: "strategic", label: "Strategic", definition: "The strategic model and its logic." },
    { key: "operational", label: "Operational", definition: "How the development operates." },
    { key: "other", label: "Other", definition: "Anything the categories above do not describe." },
  ],
  opportunity: [
    {
      key: "partnership",
      label: "Partnership",
      definition: "A partner or alliance that becomes available.",
    },
    {
      key: "funding",
      label: "Funding",
      definition: "Capital, grants or financing that becomes available.",
    },
    { key: "market", label: "Market", definition: "Demand or a market position that opens up." },
    {
      key: "land_and_asset",
      label: "Land and asset",
      definition: "Sites, buildings or other assets that become available.",
    },
    { key: "talent", label: "Talent", definition: "People or expertise that become available." },
    {
      key: "policy",
      label: "Policy",
      definition: "A change in policy or regulation that opens a path.",
    },
    { key: "other", label: "Other", definition: "Anything the categories above do not describe." },
  ],
};

export function isCategorizedKind(kind: string): kind is CategorizedKind {
  return (CATEGORIZED_KINDS as readonly string[]).includes(kind);
}

/** The label of a category key, or the key itself when it is not in the list. */
export function categoryLabel(kind: RecordKind, key: string | null | undefined): string {
  if (!key) return "";
  if (!isCategorizedKind(kind)) return key;
  return INTELLIGENCE_CATEGORIES[kind].find((c) => c.key === key)?.label ?? key;
}

// Statuses -------------------------------------------------------------------------

/** Kinds that are resolved and reopened. Decisions and recommendations have their own workflow. */
export const RESOLVABLE_KINDS = [
  "assumption",
  "risk",
  "constraint",
  "dependency",
  "opportunity",
] as const satisfies readonly RecordKind[];
export type ResolvableKind = (typeof RESOLVABLE_KINDS)[number];

export function isResolvableKind(kind: string): kind is ResolvableKind {
  return (RESOLVABLE_KINDS as readonly string[]).includes(kind);
}

/** Mirrors public.intelligence_active_statuses. */
export const ACTIVE_STATUSES: Record<ResolvableKind, readonly string[]> = {
  assumption: ["unvalidated", "validating"],
  risk: ["open", "mitigating"],
  constraint: ["in_force"],
  dependency: ["open", "at_risk"],
  opportunity: ["identified", "evaluating", "pursuing"],
};

/** Mirrors public.intelligence_terminal_statuses: reached only by resolving, with a rationale. */
export const TERMINAL_STATUSES: Record<ResolvableKind, readonly string[]> = {
  assumption: ["validated", "invalidated"],
  risk: ["closed", "accepted", "materialized"],
  constraint: ["relaxed", "lifted"],
  dependency: ["satisfied", "broken"],
  opportunity: ["realized", "declined", "lapsed"],
};

export function isTerminalStatus(kind: RecordKind, status: string | null | undefined): boolean {
  return isResolvableKind(kind) && !!status && TERMINAL_STATUSES[kind].includes(status);
}

/** The label and tone of any record status. */
export function recordStatus(kind: RecordKind, status: string | null | undefined): Label | null {
  if (!status) return null;
  const table: Partial<Record<RecordKind, Record<string, Label>>> = {
    assumption: VALIDATION_STATUS,
    risk: RISK_STATUS,
    constraint: CONSTRAINT_STATUS,
    dependency: DEPENDENCY_STATUS,
    decision: DECISION_STATUS,
    opportunity: OPPORTUNITY_STATUS,
  };
  return table[kind]?.[status] ?? { label: status, tone: "neutral" };
}

/** What resolving to a status means, for the resolve form. */
export const RESOLUTION_VERBS: Record<string, string> = {
  validated: "Validate",
  invalidated: "Invalidate",
  closed: "Close",
  accepted: "Accept",
  materialized: "Record as materialized",
  relaxed: "Record as relaxed",
  lifted: "Record as lifted",
  satisfied: "Record as satisfied",
  broken: "Record as broken",
  realized: "Record as realized",
  declined: "Decline",
  lapsed: "Record as lapsed",
};

// Stewardship ------------------------------------------------------------------------

export const ATTENTION_LEVELS = [
  "critical",
  "high",
  "routine",
  "watch",
] as const satisfies readonly IntelligenceAttention[];

export const ATTENTION: Record<IntelligenceAttention, Label & { description: string }> = {
  critical: {
    label: "Critical",
    tone: "negative",
    description: "Needs the Principal Architect's attention now. A note is required.",
  },
  high: { label: "High", tone: "attention", description: "Review this week." },
  routine: { label: "Routine", tone: "neutral", description: "Review on the normal cycle." },
  watch: { label: "Watch", tone: "neutral", description: "No action; keep an eye on it." },
};

export const TRIAGE_STATE: Record<TriageState, Label> = {
  untriaged: { label: "Untriaged", tone: "attention" },
  triaged: { label: "Triaged", tone: "neutral" },
};

export const ESCALATION_LEVELS = [
  "principal_architect",
  "client_executive",
] as const satisfies readonly EscalationLevel[];

export const ESCALATION_LEVEL_LABELS: Record<EscalationLevel, string> = {
  principal_architect: "Principal Architect",
  client_executive: "Client executive",
};

/** Fields recorded in the status history, as intelligence_status_changes names them. */
export const HISTORY_FIELD_LABELS: Record<string, string> = {
  category: "Category",
  confidence: "Confidence",
  validation_status: "Validation",
  probability: "Probability",
  impact: "Impact",
  risk_status: "Status",
  negotiable: "Negotiable",
  constraint_status: "Status",
  dependency_type: "Type",
  blocking: "Blocking",
  dependency_status: "Status",
  decision_status: "Status",
  priority: "Priority",
  value: "Value",
  feasibility: "Feasibility",
  opportunity_status: "Status",
  attention: "Attention",
  triage_state: "Triage",
  next_review_on: "Next review",
};

export const HISTORY_OPERATION_LABELS: Record<string, string> = {
  created: "Recorded",
  edit: "Edited",
  resolved: "Resolved",
  reopened: "Reopened",
  triaged: "Triaged",
};

// Client actions ------------------------------------------------------------------------

export const CLIENT_ACTION_KINDS = [
  "question",
  "information_request",
  "confirmation",
  "review_request",
  "executive_attention",
] as const satisfies readonly ClientActionKind[];

/** Kinds TPLCo sends directly. Executive attention is raised only by escalation. */
export const SENDABLE_CLIENT_ACTION_KINDS = [
  "question",
  "information_request",
  "confirmation",
  "review_request",
] as const satisfies readonly ClientActionKind[];

/** Kinds that must name the elements the client should look at. */
export const SUBJECT_REQUIRED_KINDS: readonly ClientActionKind[] = [
  "confirmation",
  "review_request",
  "executive_attention",
];

export const CLIENT_ACTION_KIND_LABELS: Record<ClientActionKind, string> = {
  question: "Question",
  information_request: "Information request",
  confirmation: "Confirmation",
  review_request: "Review request",
  executive_attention: "Executive attention",
};

export const CLIENT_ACTION_STATUS: Record<ClientActionStatus, Label> = {
  open: { label: "Awaiting the client", tone: "attention" },
  responded: { label: "Responded", tone: "accent" },
  closed: { label: "Closed", tone: "positive" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

/** What clients read. */
export const CLIENT_ACTION_STATUS_FOR_CLIENT: Record<ClientActionStatus, Label> = {
  open: { label: "Awaiting your response", tone: "attention" },
  responded: { label: "Response sent", tone: "accent" },
  closed: { label: "Complete", tone: "positive" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const CLIENT_ACTION_EVENT_LABELS: Record<string, string> = {
  sent: "Sent",
  responded: "Responded",
  returned: "Returned for more",
  closed: "Closed",
  withdrawn: "Withdrawn",
  reassigned: "Reassigned",
};

export const CONTRIBUTION_STATUS: Record<ContributionStatus, Label> = {
  received: { label: "Received", tone: "attention" },
  incorporated: { label: "Incorporated", tone: "positive" },
  acknowledged: { label: "Acknowledged", tone: "neutral" },
};

// Signals --------------------------------------------------------------------------------

export const SIGNAL_RULES = [
  "assumption_unvalidated_underpins_published",
  "assumption_invalidated_still_underpins",
  "risk_high_without_mitigation",
  "dependency_blocking_unsatisfied",
  "decision_past_needed_by",
  "opportunity_window_closing",
  "opportunity_window_closed",
  "review_overdue",
  "record_untriaged",
  "client_action_overdue",
] as const;
export type SignalRule = (typeof SIGNAL_RULES)[number];

/** Deterministic rules over the register (ADR-0032). Never AI. */
export const SIGNAL_RULE_LABELS: Record<SignalRule, { label: string; attention: Tone }> = {
  assumption_unvalidated_underpins_published: {
    label: "Unvalidated assumption underpins published architecture",
    attention: "attention",
  },
  assumption_invalidated_still_underpins: {
    label: "Invalidated assumption still underpins architecture",
    attention: "negative",
  },
  risk_high_without_mitigation: {
    label: "High-severity risk with nothing mitigating it",
    attention: "negative",
  },
  dependency_blocking_unsatisfied: {
    label: "Blocking dependency not yet satisfied",
    attention: "attention",
  },
  decision_past_needed_by: { label: "Decision past its needed-by date", attention: "negative" },
  opportunity_window_closing: {
    label: "Opportunity window closes within 30 days",
    attention: "attention",
  },
  opportunity_window_closed: {
    label: "Opportunity window has closed while still open",
    attention: "negative",
  },
  review_overdue: { label: "Review date has passed", attention: "attention" },
  record_untriaged: { label: "Untriaged for more than a week", attention: "neutral" },
  client_action_overdue: { label: "Client request overdue", attention: "attention" },
};

export function signalLabel(rule: string): { label: string; attention: Tone } {
  return (
    (SIGNAL_RULE_LABELS as Record<string, { label: string; attention: Tone }>)[rule] ?? {
      label: rule,
      attention: "neutral",
    }
  );
}

// Files ------------------------------------------------------------------------------------

/** Mirrors engagement_files_size_bytes_check and the bucket's file size limit. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Mirrors engagement_files_content_type_check and the bucket's allowed MIME types. */
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const ENGAGEMENT_FILES_BUCKET = "engagement-files";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
