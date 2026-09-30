import { z } from "zod";
import type { ObjectTypeKey } from "./rules";

/**
 * Type-specific attributes of core architecture objects (proposal §4). They
 * are stored in architecture_objects.attributes as a JSON object with a
 * numeric schema_version; every field is optional, because an object is
 * built up over the engagement. Keys are snake_case in storage.
 *
 * The database checks the envelope (an object, schema_version present,
 * size); these schemas check the fields. Unknown keys are refused so the
 * vocabulary cannot drift silently.
 */

export const ATTRIBUTE_SCHEMA_VERSION = 1;

export type AttributeField =
  | { key: string; label: string; type: "text" | "textarea"; hint?: string }
  | { key: string; label: string; type: "select"; options: readonly (readonly [string, string])[] }
  | { key: string; label: string; type: "boolean" }
  | { key: string; label: string; type: "integer"; hint?: string };

const text = (key: string, label: string, hint?: string): AttributeField => ({
  key,
  label,
  type: "text",
  hint,
});
const long = (key: string, label: string, hint?: string): AttributeField => ({
  key,
  label,
  type: "textarea",
  hint,
});
const select = (
  key: string,
  label: string,
  options: readonly (readonly [string, string])[],
): AttributeField => ({ key, label, type: "select", options });
const flag = (key: string, label: string): AttributeField => ({ key, label, type: "boolean" });
const integer = (key: string, label: string, hint?: string): AttributeField => ({
  key,
  label,
  type: "integer",
  hint,
});

const HORIZON = [
  ["near", "Near term"],
  ["medium", "Medium term"],
  ["long", "Long term"],
] as const;
const SOURCING = [
  ["internal", "Internal"],
  ["external", "External"],
  ["shared", "Shared"],
] as const;
const PROFICIENCY = [
  ["foundational", "Foundational"],
  ["proficient", "Proficient"],
  ["expert", "Expert"],
] as const;

export const OBJECT_ATTRIBUTE_FIELDS: Record<ObjectTypeKey, readonly AttributeField[]> = {
  // Knowledge
  knowledge_area: [
    long("scope_statement", "Scope"),
    select("criticality", "Criticality", [
      ["foundational", "Foundational"],
      ["significant", "Significant"],
      ["contextual", "Contextual"],
    ]),
  ],
  concept: [long("definition", "Definition"), long("excludes", "Excludes")],
  research_question: [
    long("question", "Question"),
    long("why_it_matters", "Why it matters"),
    select("status", "Status", [
      ["open", "Open"],
      ["answered", "Answered"],
      ["set_aside", "Set aside"],
    ]),
    long("answer_summary", "Answer"),
  ],
  knowledge_gap: [
    long("unknown", "What is not known"),
    long("consequence_if_unresolved", "Consequence if unresolved"),
    long("closure_approach", "How it will be closed"),
  ],
  regulatory_factor: [
    text("jurisdiction", "Jurisdiction"),
    text("instrument", "Instrument"),
    long("obligation", "Obligation"),
    select("binding", "Binding", [
      ["mandatory", "Mandatory"],
      ["conditional", "Conditional"],
    ]),
  ],
  competitive_factor: [
    text("actor_or_force", "Actor or force"),
    long("current_position", "Current position"),
    long("implication", "Implication"),
  ],
  system_boundary: [
    long("inside", "Inside the system"),
    long("outside", "Outside the system"),
    long("interfaces", "Interfaces"),
  ],
  stakeholder: [
    select("stakeholder_kind", "Kind", [
      ["individual", "Individual"],
      ["group", "Group"],
      ["institution", "Institution"],
    ]),
    long("interest", "Interest"),
    select("influence", "Influence", [
      ["low", "Low"],
      ["moderate", "Moderate"],
      ["high", "High"],
    ]),
    select("stance", "Stance", [
      ["supportive", "Supportive"],
      ["neutral", "Neutral"],
      ["opposed", "Opposed"],
      ["unknown", "Unknown"],
    ]),
  ],
  // Capability
  capability: [
    select("tier", "Tier", [
      ["strategic", "Strategic"],
      ["core", "Core"],
      ["enabling", "Enabling"],
    ]),
    flag("leadership_capability", "Leadership capability"),
    select("current_readiness", "Current readiness", [
      ["absent", "Absent"],
      ["emerging", "Emerging"],
      ["partial", "Partial"],
      ["established", "Established"],
    ]),
    select("ownership_model", "Ownership", SOURCING),
  ],
  skill: [
    text("skill_family", "Skill family"),
    select("baseline_proficiency", "Baseline proficiency", PROFICIENCY),
  ],
  role: [
    long("purpose", "Purpose"),
    select("sourcing", "Sourcing", SOURCING),
    flag("leadership_role", "Leadership role"),
    text("indicative_capacity", "Indicative capacity", "For example, 1 FTE or 0.5 FTE."),
  ],
  capability_gap: [
    long("current_state", "Current state"),
    long("required_state", "Required state"),
    select("closure_approach", "Closure approach", [
      ["develop", "Develop"],
      ["hire", "Hire"],
      ["partner", "Partner"],
      ["acquire", "Acquire"],
      ["outsource", "Outsource"],
    ]),
  ],
  talent_stage: [
    integer("sequence", "Sequence", "Position in the talent sequence, starting at 1."),
    long("trigger_condition", "Trigger condition"),
  ],
  // Strategic Model
  intended_outcome: [
    long("desired_condition", "Desired condition"),
    select("horizon", "Horizon", HORIZON),
    text("beneficiary", "Beneficiary"),
  ],
  strategic_model: [
    text("model_name", "Model"),
    long("application", "How it applies here"),
    long("applicability_limits", "Where it stops applying"),
  ],
  structural_leverage: [
    text("lever", "Lever"),
    long("mechanism", "Mechanism"),
    long("expected_effect", "Expected effect"),
  ],
  differentiation_logic: [
    long("basis_of_difference", "Basis of difference"),
    long("defensibility", "Defensibility"),
    long("conditions_relied_on", "Conditions relied on"),
  ],
  strategic_implication: [
    long("implication", "Implication"),
    select("horizon", "Horizon", HORIZON),
  ],
  // Application
  operating_model: [
    text("model_form", "Form"),
    long("core_flows", "Core flows"),
    long("key_interfaces", "Key interfaces"),
  ],
  application_format: [
    select("format_kind", "Format", [
      ["program", "Program"],
      ["product_line", "Product line"],
      ["team", "Team"],
      ["unit", "Unit"],
      ["venture", "Venture"],
      ["partnership", "Partnership"],
      ["initiative", "Initiative"],
      ["other", "Other"],
    ]),
    long("purpose", "Purpose"),
    long("participants", "Participants"),
    text("cadence", "Cadence"),
  ],
  governance_body: [
    long("mandate", "Mandate"),
    long("membership", "Membership"),
    text("cadence", "Cadence"),
    long("escalation_route", "Escalation route"),
  ],
  decision_right: [
    text("decision_class", "Decision class"),
    text("decides", "Decides"),
    text("consulted", "Consulted"),
    text("veto", "Veto"),
    text("informed", "Informed"),
  ],
  workflow: [
    long("trigger", "Trigger"),
    long("stages_summary", "Stages"),
    long("outputs", "Outputs"),
  ],
  delivery_mechanism: [text("channel", "Channel"), text("form", "Form"), long("reach", "Reach")],
  metric: [
    long("definition", "Definition"),
    text("unit", "Unit"),
    select("direction", "Direction", [
      ["increase", "Increase"],
      ["decrease", "Decrease"],
      ["maintain", "Maintain"],
    ]),
    text("target", "Target"),
    text("cadence", "Cadence"),
    text("data_source", "Data source"),
  ],
  scaling_stage: [
    integer("sequence", "Sequence", "Position in the scaling sequence, starting at 1."),
    long("entry_condition", "Entry condition"),
    long("exit_condition", "Exit condition"),
  ],
  documentation_protocol: [
    text("artifact", "Artifact"),
    long("update_rule", "Update rule"),
    text("audience", "Audience"),
  ],
};

function fieldSchema(field: AttributeField): z.ZodType {
  switch (field.type) {
    case "text":
      return z.string().trim().max(300, "At most 300 characters");
    case "textarea":
      return z.string().trim().max(4000, "At most 4,000 characters");
    case "select":
      return z.enum(field.options.map(([value]) => value) as [string, ...string[]]);
    case "boolean":
      return z.boolean();
    case "integer":
      return z.number().int().min(1).max(99);
  }
}

/** The stored attributes of one object type (schema_version included). */
export function attributeSchema(type: ObjectTypeKey) {
  const shape: Record<string, z.ZodType> = {
    schema_version: z.literal(ATTRIBUTE_SCHEMA_VERSION),
  };
  for (const field of OBJECT_ATTRIBUTE_FIELDS[type])
    shape[field.key] = fieldSchema(field).optional();
  return z.strictObject(shape);
}

export type StoredAttributes = { schema_version: number } & Record<
  string,
  string | number | boolean
>;

/** Form field name for an attribute, kept apart from the element's own fields. */
export const attributeFieldName = (key: string) => `attr_${key}`;

/**
 * Turn form values (all strings) into stored attributes. Empty values are
 * left out, so clearing a field removes it.
 */
export function attributesFromForm(
  type: ObjectTypeKey,
  values: Record<string, string | undefined>,
): { success: true; data: StoredAttributes } | { success: false; errors: Record<string, string> } {
  const raw: Record<string, unknown> = { schema_version: ATTRIBUTE_SCHEMA_VERSION };
  const errors: Record<string, string> = {};
  for (const field of OBJECT_ATTRIBUTE_FIELDS[type]) {
    const value = values[attributeFieldName(field.key)]?.trim() ?? "";
    if (value === "") continue;
    if (field.type === "boolean") raw[field.key] = value === "yes";
    else if (field.type === "integer") {
      const n = Number(value);
      if (!Number.isInteger(n)) errors[attributeFieldName(field.key)] = "Enter a whole number";
      else raw[field.key] = n;
    } else raw[field.key] = value;
  }
  const parsed = attributeSchema(type).safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = attributeFieldName(String(issue.path[0]));
      errors[key] ??= issue.message;
    }
  }
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: raw as StoredAttributes };
}

/** Stored attributes as form default values. */
export function attributesToForm(type: ObjectTypeKey, attributes: unknown): Record<string, string> {
  const stored = (attributes ?? {}) as Record<string, unknown>;
  const values: Record<string, string> = {};
  for (const field of OBJECT_ATTRIBUTE_FIELDS[type]) {
    const value = stored[field.key];
    if (value === undefined || value === null) continue;
    values[attributeFieldName(field.key)] =
      field.type === "boolean" ? (value ? "yes" : "no") : String(value);
  }
  return values;
}

/** Attributes as label/value pairs for display, in field order. */
export function describeAttributes(
  type: ObjectTypeKey,
  attributes: unknown,
): { key: string; label: string; value: string }[] {
  const stored = (attributes ?? {}) as Record<string, unknown>;
  const rows: { key: string; label: string; value: string }[] = [];
  for (const field of OBJECT_ATTRIBUTE_FIELDS[type] ?? []) {
    const value = stored[field.key];
    if (value === undefined || value === null || value === "") continue;
    let shown = String(value);
    if (field.type === "boolean") shown = value ? "Yes" : "No";
    if (field.type === "select") shown = field.options.find(([v]) => v === value)?.[1] ?? shown;
    rows.push({ key: field.key, label: field.label, value: shown });
  }
  return rows;
}

/** A single attribute's display value, or null. */
export function attributeValue(type: ObjectTypeKey, attributes: unknown, key: string) {
  return describeAttributes(type, attributes).find((row) => row.key === key)?.value ?? null;
}
