import type { ToolName } from "../tools/registry";
import type { DataClass, InferenceKind, Subject, SubjectType } from "../types";

/**
 * Context plans (proposal §9.2, §14). AUTHORISED ⊇ PERMITTED ⊇ INCLUDED:
 * a class is sent only because the kind's plan needs it for this subject,
 * or because the model asked through a permitted tool within the limits.
 *
 * MAX_TOOL_CALLS is the 7B.1 evaluation and safety bound (OD-7): fixed
 * anchors plus at most six model-requested Tool Contract calls. It is not a
 * permanent product limit; changing it is a reviewed change to this file.
 */
export const MAX_TOOL_CALLS = 6;

/** One deterministic read the Gateway performs before the first model call. */
export type AnchorRead = {
  tool: ToolName;
  elementId: string;
  args?: Record<string, unknown>;
  /** Database parameters the model can never set (for example a pinned version). */
  extraParams?: Record<string, unknown>;
  /** Keep only these rows (for example the subject's own evidence link). */
  keep?: (row: { record_type: string; record_id: string; content: unknown }) => boolean;
};

export type ContextPlan = {
  subjectTypes: readonly SubjectType[];
  requiredClasses: readonly DataClass[];
  permittedTools: readonly ToolName[];
  maxToolCalls: number;
  maxContextTokens: number;
  maxOutputTokens: number;
  /** Evidence summaries are included for evidence_bearing and tension only (OD-5). */
  includeEvidenceSummary: boolean;
  anchor: (subject: Subject) => AnchorRead[];
  question: string;
};

const elementAnchor = (elementId: string): AnchorRead => ({
  tool: "get_element",
  elementId,
  args: { state: "published" },
});

export const CONTEXT_PLANS: Record<InferenceKind, ContextPlan> = {
  explanation: {
    subjectTypes: ["edge_item", "revision", "impact_trace"],
    requiredClasses: ["published_architecture"],
    permittedTools: [
      "get_element",
      "get_relationships",
      "trace_impact",
      "get_revision",
      "get_project_intelligence",
    ],
    maxToolCalls: MAX_TOOL_CALLS,
    maxContextTokens: 24000,
    maxOutputTokens: 2000,
    includeEvidenceSummary: false,
    question:
      "Why does this deterministic condition, change or trace bear on this subject, in the terms of its own governed statements?",
    anchor: (s) => {
      if (s.type === "edge_item")
        return [
          {
            tool: "get_edge_item",
            elementId: s.elementId,
            args: { rule_key: s.ruleKey, fingerprint: s.fingerprint },
          },
          elementAnchor(s.elementId),
        ];
      if (s.type === "revision")
        return [
          {
            tool: "get_revision",
            elementId: s.elementId,
            extraParams: { p_version_id: s.versionId ?? null },
          },
          elementAnchor(s.elementId),
        ];
      return [{ tool: "trace_impact", elementId: s.elementId }, elementAnchor(s.elementId)];
    },
  },
  tension: {
    subjectTypes: ["element_pair"],
    requiredClasses: ["published_architecture"],
    permittedTools: ["get_element", "get_relationships", "trace_impact", "get_evidence"],
    maxToolCalls: MAX_TOOL_CALLS,
    maxContextTokens: 24000,
    maxOutputTokens: 2000,
    includeEvidenceSummary: true,
    question:
      "Do these two governed statements, on elements connected by a typed relationship or governed impact path, appear to be in tension?",
    anchor: (s) =>
      s.type === "element_pair"
        ? [
            elementAnchor(s.elementId),
            elementAnchor(s.secondElementId),
            { tool: "get_relationships", elementId: s.elementId },
          ]
        : [],
  },
  evidence_bearing: {
    subjectTypes: ["evidence_link"],
    requiredClasses: ["evidence_metadata"],
    permittedTools: ["get_element", "get_evidence"],
    maxToolCalls: MAX_TOOL_CALLS,
    maxContextTokens: 16000,
    maxOutputTokens: 1500,
    includeEvidenceSummary: true,
    question:
      "From its recorded metadata, does this evidence appear to bear on this statement differently from, or more specifically than, its recorded stance?",
    anchor: (s) =>
      s.type === "evidence_link"
        ? [
            { tool: "get_element", elementId: s.elementId, args: { state: "working" } },
            {
              tool: "get_evidence",
              elementId: s.elementId,
              keep: (row) => row.record_id === s.linkId,
            },
          ]
        : [],
  },
  review_brief: {
    subjectTypes: ["element"],
    requiredClasses: ["published_architecture"],
    permittedTools: [
      "get_element",
      "get_edge_item",
      "get_project_intelligence",
      "get_acceptance_criteria",
      "get_revision",
    ],
    maxToolCalls: MAX_TOOL_CALLS,
    maxContextTokens: 32000,
    maxOutputTokens: 3000,
    includeEvidenceSummary: false,
    question:
      "Given what this Review examined or will examine, what has changed and what remains open: what should a reviewer look at?",
    anchor: (s) => [{ tool: "get_review_context", elementId: s.elementId }],
  },
  realization_reading: {
    subjectTypes: ["element"],
    requiredClasses: ["published_architecture"],
    permittedTools: ["get_element", "get_acceptance_criteria", "get_project_intelligence"],
    maxToolCalls: MAX_TOOL_CALLS,
    maxContextTokens: 32000,
    maxOutputTokens: 3000,
    includeEvidenceSummary: false,
    question:
      "Do this Implementation Initiative's recorded state, checkpoints and criteria read as corresponding to, or diverging from, the intent it implements?",
    anchor: (s) => [{ tool: "get_implementation_state", elementId: s.elementId }],
  },
};
