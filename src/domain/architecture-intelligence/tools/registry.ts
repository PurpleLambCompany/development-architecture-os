import { z } from "zod";
import type { DataClass } from "../types";

/**
 * The read-only Tool Contract, application side (proposal §12, ADR-0063).
 *
 * The registry is the only dispatch table from a model's tool call to the
 * database: each entry names one public.ai_context_* function, which reads
 * as the requesting user and cannot write (proven in pgTAP 47). A name that
 * is not here is refused before anything is called. Arguments never carry
 * an engagement: the Gateway fixes it. Elements are named by reference code
 * and resolved by the Gateway within the engagement.
 */

export const TOOL_CONTRACT_VERSION = "1";

export const TOOL_FUNCTIONS = [
  "ai_context_element",
  "ai_context_relationships",
  "ai_context_impact",
  "ai_context_revision",
  "ai_context_edge_item",
  "ai_context_evidence",
  "ai_context_intelligence",
  "ai_context_criteria",
  "ai_context_review",
  "ai_context_implementation",
] as const;
export type ToolFunction = (typeof TOOL_FUNCTIONS)[number];

const referenceCode = z
  .string()
  .regex(/^[A-Z]{2,4}-[0-9]{3,4}$/)
  .describe("A reference code that appears in the data provided, such as CAP-004");

type ToolDefinition = {
  description: string;
  fn: ToolFunction;
  args: z.ZodObject;
  classes: readonly DataClass[];
  /** Database parameters, given the element id the reference code resolved to. */
  params: (args: Record<string, unknown>, elementId: string) => Record<string, unknown>;
};

const onElement = (key: string) => (_: Record<string, unknown>, elementId: string) => ({
  [key]: elementId,
});

export const TOOLS = {
  get_element: {
    description:
      "One element's governed projection: published (latest version) or working state, with its statements.",
    fn: "ai_context_element",
    args: z.strictObject({
      reference_code: referenceCode,
      state: z.enum(["published", "working"]),
    }),
    classes: ["published_architecture", "working_architecture"],
    params: (a, id) => ({ p_element_id: id, p_state: a.state }),
  },
  get_relationships: {
    description:
      "One element's typed relationships, with the other element's reference code, kind and title.",
    fn: "ai_context_relationships",
    args: z.strictObject({ reference_code: referenceCode }),
    classes: ["published_architecture", "working_architecture"],
    params: onElement("p_element_id"),
  },
  trace_impact: {
    description: "The governed impact reach from one element, within the governed depth.",
    fn: "ai_context_impact",
    args: z.strictObject({ reference_code: referenceCode }),
    classes: ["published_architecture", "working_architecture"],
    params: onElement("p_element_id"),
  },
  get_revision: {
    description:
      "One element's latest substantive revision: change type, changed paths and quoted change summary.",
    fn: "ai_context_revision",
    args: z.strictObject({ reference_code: referenceCode }),
    classes: ["published_architecture"],
    params: onElement("p_element_id"),
  },
  get_edge_item: {
    description: "One Development Edge item on an element, by rule key and fingerprint.",
    fn: "ai_context_edge_item",
    args: z.strictObject({
      rule_key: z.string().regex(/^[a-z_]{1,100}$/),
      reference_code: referenceCode,
      fingerprint: z.string().min(1).max(1000),
    }),
    classes: ["published_architecture", "working_architecture"],
    params: (a, id) => ({ p_rule_key: a.rule_key, p_element_id: id, p_fingerprint: a.fingerprint }),
  },
  get_evidence: {
    description:
      "Recorded evidence metadata linked to an element and its statements: titles, types, stances. Never file contents.",
    fn: "ai_context_evidence",
    args: z.strictObject({ reference_code: referenceCode }),
    classes: ["evidence_metadata"],
    params: onElement("p_element_id"),
  },
  get_project_intelligence: {
    description:
      "Project Intelligence records (assumptions, risks, constraints, dependencies, decisions, recommendations, opportunities) related to an element.",
    fn: "ai_context_intelligence",
    args: z.strictObject({ reference_code: referenceCode }),
    classes: ["project_intelligence"],
    params: onElement("p_element_id"),
  },
  get_acceptance_criteria: {
    description: "Acceptance criteria in force for an element.",
    fn: "ai_context_criteria",
    args: z.strictObject({ reference_code: referenceCode }),
    classes: ["published_architecture", "working_architecture"],
    params: onElement("p_element_id"),
  },
  get_review_context: {
    description:
      "A Review's examined set: versions at capture, revisions since and open conditions.",
    fn: "ai_context_review",
    args: z.strictObject({ reference_code: referenceCode }),
    classes: ["published_architecture"],
    params: onElement("p_review_element_id"),
  },
  get_implementation_state: {
    description:
      "An Implementation Initiative's recorded state, checkpoints and the intent it implements.",
    fn: "ai_context_implementation",
    args: z.strictObject({ reference_code: referenceCode }),
    classes: ["published_architecture", "working_architecture", "project_intelligence"],
    params: onElement("p_initiative_element_id"),
  },
} as const satisfies Record<string, ToolDefinition>;

export type ToolName = keyof typeof TOOLS;

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(TOOLS, name);
}

/** Strip JSON Schema keywords a provider's strict mode may not accept; DSA validates fully afterwards. */
export function providerJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node)) {
        if (
          [
            "$schema",
            "minLength",
            "maxLength",
            "minItems",
            "maxItems",
            "pattern",
            "format",
          ].includes(key)
        )
          continue;
        out[key] = strip(value);
      }
      return out;
    }
    return node;
  };
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>;
}

export type FunctionToolDefinition = {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
};

/** Function tool definitions for the tools a kind permits. Functions only, by construction. */
export function toolDefinitions(names: readonly ToolName[]): FunctionToolDefinition[] {
  return names.map((name) => ({
    name,
    description: TOOLS[name].description,
    parameters: providerJsonSchema(TOOLS[name].args),
  }));
}
