/**
 * Architecture Intelligence vocabulary (Phase 7B.1, ADR-0060 to ADR-0066).
 * Mirrors the database's closed sets: private.ai_inference_kinds(),
 * private.ai_data_classes() and the request outcome check.
 */

export const INFERENCE_KINDS = [
  "explanation",
  "tension",
  "evidence_bearing",
  "review_brief",
  "realization_reading",
] as const;
export type InferenceKind = (typeof INFERENCE_KINDS)[number];

export const DATA_CLASSES = [
  "published_architecture",
  "working_architecture",
  "project_intelligence",
  "evidence_metadata",
] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

export const REQUEST_OUTCOMES = [
  "persisted",
  "returned",
  "refused_mode",
  "refused_capability",
  "refused_authorization",
  "refused_class",
  "refused_budget",
  "subject_not_found",
  "provider_error",
  "refusal",
  "invalid_output",
  "unknown_citation",
  "model_not_evaluated",
  "authorization_withdrawn",
] as const;
export type RequestOutcome = (typeof REQUEST_OUTCOMES)[number];

/** Outcomes reached before any model call: they carry no tokens or cost. */
export const PRE_MODEL_OUTCOMES: readonly RequestOutcome[] = [
  "refused_mode",
  "refused_capability",
  "refused_authorization",
  "refused_class",
  "refused_budget",
  "subject_not_found",
];

export type ProcessingMode = "off" | "synthetic_only" | "enabled";
export type InvocationMode = "ephemeral" | "persist";

/** What an invocation is about. Element ids are resolved within the fixed engagement. */
export type Subject =
  | { type: "edge_item"; elementId: string; ruleKey: string; fingerprint: string }
  | { type: "revision"; elementId: string; versionId?: string }
  | { type: "impact_trace"; elementId: string }
  | { type: "element"; elementId: string }
  | { type: "element_pair"; elementId: string; secondElementId: string }
  | {
      type: "evidence_link";
      elementId: string;
      linkId: string;
      linkType: "statement_link" | "element_link";
    };
export type SubjectType = Subject["type"];

/** One row as a Tool Contract function returns it (public.ai_context_row). */
export type ContextRow = {
  record_type: string;
  record_id: string;
  version_id: string | null;
  anchor_id: string | null;
  variant: string | null;
  data_class: string;
  withheld: boolean;
  withheld_reason: string | null;
  digest: string | null;
  content: unknown;
};

/** A context row placed in an invocation, under the handle the model cites. */
export type IssuedRow = { handle: string; origin: "anchor" | "tool_call"; row: ContextRow };
