// Generated from the Phase 3 vocabulary (proposal §4 and §9) and its Phase 4
// extension (Opportunity, advances, pursues; Phase 4 proposal §4). Mirrors the
// reference rows in supabase/migrations/20261001000100_architecture_core.sql
// and 20261002000100_project_intelligence.sql; vocabulary.test.ts checks
// they agree.

import type { ArchitectureDomain, ElementKind, Phase5Kind, RelationshipCategory } from "./catalog";

export const OBJECT_TYPES = [
  {
    key: "knowledge_area",
    domain: "knowledge",
    label: "Knowledge Area",
    definition:
      "A defined field of understanding that the development depends on, such as a market, a discipline or a policy field. Not a document or a source.",
  },
  {
    key: "concept",
    domain: "knowledge",
    label: "Concept",
    definition:
      "A term or idea within a knowledge area that the architecture relies on, with an agreed meaning and boundary.",
  },
  {
    key: "research_question",
    domain: "knowledge",
    label: "Research Question",
    definition:
      "A question whose answer the architecture needs, stated precisely enough to be answered. Not a research task.",
  },
  {
    key: "knowledge_gap",
    domain: "knowledge",
    label: "Knowledge Gap",
    definition:
      "Something the architecture needs to know but does not yet, with the consequence of not knowing it.",
  },
  {
    key: "regulatory_factor",
    domain: "knowledge",
    label: "Regulatory Factor",
    definition:
      "A law, regulation, licence condition or policy obligation that is part of the development's context. The limits it imposes are recorded as Constraints.",
  },
  {
    key: "competitive_factor",
    domain: "knowledge",
    label: "Competitive Factor",
    definition: "An actor, alternative or market force the development must be positioned against.",
  },
  {
    key: "system_boundary",
    domain: "knowledge",
    label: "System Boundary",
    definition:
      "The defined edge of the development system: what is inside, what is outside, and the interfaces between them.",
  },
  {
    key: "stakeholder",
    domain: "knowledge",
    label: "Stakeholder",
    definition:
      "A person, group or institution whose interests, authority or influence shape the development. Not a user account.",
  },
  {
    key: "capability",
    domain: "capability",
    label: "Capability",
    definition:
      "A durable ability the organization must have to achieve its development objective, independent of who performs it or how. Not a team, a role or a project.",
  },
  {
    key: "skill",
    domain: "capability",
    label: "Skill",
    definition: "A specific proficiency that people must hold for a capability to function.",
  },
  {
    key: "role",
    domain: "capability",
    label: "Role",
    definition:
      "A defined position of responsibility that brings skills together to deliver capabilities. Describes the position, never a named person.",
  },
  {
    key: "capability_gap",
    domain: "capability",
    label: "Capability Gap",
    definition:
      "The difference between the capability the organization has and the capability it requires, stated so that it can be closed.",
  },
  {
    key: "talent_stage",
    domain: "capability",
    label: "Talent Sequence Stage",
    definition:
      "A stage in the order in which people and capabilities are brought into the development, with the condition that triggers it.",
  },
  {
    key: "intended_outcome",
    domain: "strategic_model",
    label: "Intended Outcome",
    definition:
      "The desired condition or result that the architecture is intended to produce. Not a KPI, measurement, deliverable, activity or task. How it is measured belongs to Application Architecture (Metric).",
  },
  {
    key: "strategic_model",
    domain: "strategic_model",
    label: "Applied Strategic Model",
    definition:
      "A strategic model applied to this engagement: how it applies here and where it stops applying. The model itself belongs to the internal Method Library; this is its application.",
  },
  {
    key: "structural_leverage",
    domain: "strategic_model",
    label: "Structural Leverage",
    definition:
      "A feature of the system's structure that, when used, produces a disproportionate effect.",
  },
  {
    key: "differentiation_logic",
    domain: "strategic_model",
    label: "Differentiation Logic",
    definition:
      "The reasoning for why this development will be distinct and defensible against the alternatives.",
  },
  {
    key: "strategic_implication",
    domain: "strategic_model",
    label: "Strategic Implication",
    definition:
      "A consequence of the chosen strategy that the rest of the architecture must accommodate.",
  },
  {
    key: "operating_model",
    domain: "application",
    label: "Operating Model",
    definition:
      "How the development runs as a whole: its core flows, structures and the relationships among them.",
  },
  {
    key: "application_format",
    domain: "application",
    label: "Application Format",
    definition:
      "A concrete organizational form through which capabilities are put to work. Covers program structure and product structure.",
  },
  {
    key: "governance_body",
    domain: "application",
    label: "Governance Body",
    definition:
      "A body that holds authority over part of the development, such as a board, committee, council or steering group.",
  },
  {
    key: "decision_right",
    domain: "application",
    label: "Decision Right",
    definition:
      "The allocation of authority over a class of decisions: who decides, who is consulted, who may veto, who is informed. Not a single decision.",
  },
  {
    key: "workflow",
    domain: "application",
    label: "Workflow",
    definition:
      "A repeatable sequence by which work moves through the development, from trigger to output. Not a task list.",
  },
  {
    key: "delivery_mechanism",
    domain: "application",
    label: "Delivery Mechanism",
    definition:
      "The channel or means through which the development's value reaches its beneficiaries.",
  },
  {
    key: "metric",
    domain: "application",
    label: "Metric",
    definition:
      "A defined measure of whether an intended outcome, capability or operation is performing as designed. The measure, not the outcome itself.",
  },
  {
    key: "scaling_stage",
    domain: "application",
    label: "Scaling Stage",
    definition:
      "A stage in the planned growth of the development, with the conditions to enter and leave it.",
  },
  {
    key: "documentation_protocol",
    domain: "application",
    label: "Documentation Protocol",
    definition:
      "The rule for how a body of architectural or operating knowledge is recorded, owned and kept current.",
  },
] as const satisfies readonly {
  key: string;
  domain: ArchitectureDomain;
  label: string;
  definition: string;
}[];

export const RELATIONSHIP_TYPES = [
  {
    key: "part_of",
    category: "structure",
    label: "is part of",
    inverseLabel: "includes",
    symmetric: false,
    acyclic: true,
    definition:
      "Composition: the source is a component of the target. Builds the domain map and capability map.",
  },
  {
    key: "specializes",
    category: "structure",
    label: "is a kind of",
    inverseLabel: "has kinds",
    symmetric: false,
    acyclic: true,
    definition:
      "Classification: the source is a more specific form of the target. Builds the concept hierarchy.",
  },
  {
    key: "precedes",
    category: "structure",
    label: "precedes",
    inverseLabel: "follows",
    symmetric: false,
    acyclic: true,
    definition: "Planned order: the source comes before the target.",
  },
  {
    key: "gap_in",
    category: "structure",
    label: "is a gap in",
    inverseLabel: "has gap",
    symmetric: false,
    acyclic: false,
    definition: "The source describes a shortfall in the target.",
  },
  {
    key: "investigates",
    category: "structure",
    label: "investigates",
    inverseLabel: "is investigated by",
    symmetric: false,
    acyclic: false,
    definition:
      "A Research Question seeks evidence or clarification about the target. When the target is a Knowledge Gap, answering it may help close the gap; when the target is an Assumption, answering it tests the assumption.",
  },
  {
    key: "informs",
    category: "design_flow",
    label: "informs",
    inverseLabel: "is informed by",
    symmetric: false,
    acyclic: false,
    definition:
      "Supplies knowledge or input to the target: understanding, context or facts that the target's design or justification draws on. Informing does not by itself determine the target's form (that is shapes).",
  },
  {
    key: "serves",
    category: "design_flow",
    label: "serves",
    inverseLabel: "is served by",
    symmetric: false,
    acyclic: false,
    definition: "The source exists to bring about the target outcome.",
  },
  {
    key: "shapes",
    category: "design_flow",
    label: "shapes",
    inverseLabel: "is shaped by",
    symmetric: false,
    acyclic: false,
    definition:
      "Materially influences the design or form of the target: the strategic logic in the source determines how the target is built. Stronger than informs.",
  },
  {
    key: "implies",
    category: "design_flow",
    label: "implies",
    inverseLabel: "follows from",
    symmetric: false,
    acyclic: false,
    definition: "The target is a consequence of the source.",
  },
  {
    key: "exploits",
    category: "design_flow",
    label: "exploits",
    inverseLabel: "is exploited by",
    symmetric: false,
    acyclic: false,
    definition: "The source deliberately uses the lever.",
  },
  {
    key: "positioned_against",
    category: "design_flow",
    label: "is positioned against",
    inverseLabel: "is the reference for",
    symmetric: false,
    acyclic: false,
    definition: "The source is designed to be distinct from the target.",
  },
  {
    key: "requires",
    category: "design_flow",
    label: "requires",
    inverseLabel: "is required by",
    symmetric: false,
    acyclic: false,
    definition:
      "Architectural necessity: the source cannot exist or function as designed without the target. A structural fact about the design, distinct from a Dependency record, which tracks a condition with its own status, blocking flag and owner.",
  },
  {
    key: "implemented_through",
    category: "design_flow",
    label: "is implemented through",
    inverseLabel: "implements",
    symmetric: false,
    acyclic: false,
    definition: "The target is how the capability is put into operation.",
  },
  {
    key: "delivered_through",
    category: "design_flow",
    label: "is delivered through",
    inverseLabel: "delivers",
    symmetric: false,
    acyclic: false,
    definition: "The target is the channel through which the source's value reaches beneficiaries.",
  },
  {
    key: "measured_by",
    category: "design_flow",
    label: "is measured by",
    inverseLabel: "measures",
    symmetric: false,
    acyclic: false,
    definition:
      "The metric is how performance of the source is observed. Keeps outcome and measure separate.",
  },
  {
    key: "governed_by",
    category: "design_flow",
    label: "is governed by",
    inverseLabel: "governs",
    symmetric: false,
    acyclic: false,
    definition: "The target holds or allocates authority over the source.",
  },
  {
    key: "holds",
    category: "design_flow",
    label: "holds",
    inverseLabel: "is held by",
    symmetric: false,
    acyclic: false,
    definition: "The source is the holder named by the decision right.",
  },
  {
    key: "accountable_for",
    category: "design_flow",
    label: "is accountable for",
    inverseLabel: "is the accountability of",
    symmetric: false,
    acyclic: false,
    definition:
      "The source answers for the target's design and performance. Not a task assignment.",
  },
  {
    key: "introduces",
    category: "design_flow",
    label: "introduces",
    inverseLabel: "is introduced at",
    symmetric: false,
    acyclic: false,
    definition: "The target enters the development at the source stage.",
  },
  {
    key: "bounded_by",
    category: "design_flow",
    label: "operates within",
    inverseLabel: "bounds",
    symmetric: false,
    acyclic: false,
    definition: "The source sits inside the defined edge of the system.",
  },
  {
    key: "subject_to",
    category: "design_flow",
    label: "is subject to",
    inverseLabel: "applies to",
    symmetric: false,
    acyclic: false,
    definition: "The regulatory factor applies to the source.",
  },
  {
    key: "documented_by",
    category: "design_flow",
    label: "is documented by",
    inverseLabel: "documents",
    symmetric: false,
    acyclic: false,
    definition: "The protocol governs how knowledge about the source is recorded and kept current.",
  },
  {
    key: "has_stake_in",
    category: "design_flow",
    label: "has a stake in",
    inverseLabel: "has as stakeholder",
    symmetric: false,
    acyclic: false,
    definition: "The stakeholder's interests, authority or influence bear on the target.",
  },
  {
    key: "underpins",
    category: "intelligence",
    label: "underpins",
    inverseLabel: "rests on",
    symmetric: false,
    acyclic: false,
    definition: "The target holds only if the assumption is true.",
  },
  {
    key: "threatens",
    category: "intelligence",
    label: "threatens",
    inverseLabel: "is threatened by",
    symmetric: false,
    acyclic: false,
    definition: "If the risk occurs, the target is undermined.",
  },
  {
    key: "constrains",
    category: "intelligence",
    label: "constrains",
    inverseLabel: "is constrained by",
    symmetric: false,
    acyclic: false,
    definition: "The target must be designed within the constraint.",
  },
  {
    key: "mitigates",
    category: "intelligence",
    label: "mitigates",
    inverseLabel: "is mitigated by",
    symmetric: false,
    acyclic: false,
    definition: "The source reduces the probability or impact of the risk.",
  },
  {
    key: "affects",
    category: "intelligence",
    label: "affects",
    inverseLabel: "is affected by",
    symmetric: false,
    acyclic: false,
    definition:
      "Broader Project Intelligence impact: the record has a material bearing on the target that a more specific relationship (underpins, threatens, constrains, mitigates, addresses) does not capture. The standard link from a Decision to what its outcome changes.",
  },
  {
    key: "addresses",
    category: "intelligence",
    label: "addresses",
    inverseLabel: "is addressed by",
    symmetric: false,
    acyclic: false,
    definition:
      "The recommendation proposes a course of action in response to, or intended to change, the target.",
  },
  {
    key: "advances",
    category: "intelligence",
    label: "advances",
    inverseLabel: "is advanced by",
    symmetric: false,
    acyclic: false,
    definition:
      "If the opportunity is realized, the target is materially advanced. The mirror of threatens.",
  },
  {
    key: "pursues",
    category: "intelligence",
    label: "pursues",
    inverseLabel: "is pursued by",
    symmetric: false,
    acyclic: false,
    definition: "The source acts to realize the opportunity. The mirror of mitigates.",
  },
  {
    key: "supersedes",
    category: "lineage",
    label: "supersedes",
    inverseLabel: "is superseded by",
    symmetric: false,
    acyclic: true,
    definition:
      "Conceptual replacement: one distinct architecture element replaces another distinct element, which moves to superseded. Not version lineage. Written only by the supersede operation.",
  },
  {
    key: "conflicts_with",
    category: "lineage",
    label: "conflicts with",
    inverseLabel: "conflicts with",
    symmetric: true,
    acyclic: false,
    definition:
      "An architect has recognized a tension between the two. Recorded explicitly so it is resolved deliberately, and later available to coherence analysis.",
  },
  {
    key: "examines",
    category: "implementation",
    label: "examines",
    inverseLabel: "examined in",
    symmetric: false,
    acyclic: false,
    definition: "The review's agenda: an element or Project Intelligence record the review looks at.",
  },
  {
    key: "raises",
    category: "implementation",
    label: "raises",
    inverseLabel: "raised in",
    symmetric: false,
    acyclic: false,
    definition: "A new judgment record, or implementation initiative, produced by the review.",
  },
  {
    key: "documents",
    category: "implementation",
    label: "documents",
    inverseLabel: "documented in",
    symmetric: false,
    acyclic: false,
    definition: "What the deliverable presents or summarizes.",
  },
  {
    key: "implements",
    category: "implementation",
    label: "implements",
    inverseLabel: "implemented by",
    symmetric: false,
    acyclic: false,
    definition: "The architecture the initiative is realizing.",
  },
  {
    key: "initiates",
    category: "implementation",
    label: "initiates",
    inverseLabel: "initiated by",
    symmetric: false,
    acyclic: false,
    definition: "Why the initiative exists: the decision or recommendation that started it.",
  },
  {
    key: "validates",
    category: "implementation",
    label: "validates",
    inverseLabel: "validated by",
    symmetric: false,
    acyclic: false,
    definition:
      "Formal judgment that operating reality sufficiently conforms to architectural intent. Written only by record_review_validation — never a free-form relationship insert (D13).",
  },
] as const satisfies readonly {
  key: string;
  category: RelationshipCategory;
  label: string;
  inverseLabel: string;
  symmetric: boolean;
  acyclic: boolean;
  definition: string;
}[];

/**
 * Pairing rules as written in the migration: (type, sources, targets). Tokens:
 * an object type, a record kind, @knowledge/@capability/@strategic_model/
 * @application, @core, @record, @element, and -token to exclude. supersedes
 * is added separately as same kind and type.
 */
export const RELATIONSHIP_RULE_SPEC: readonly (readonly [
  string,
  readonly string[],
  readonly string[],
])[] = [
  ["part_of", ["knowledge_area"], ["knowledge_area"]],
  ["part_of", ["concept"], ["concept", "knowledge_area"]],
  ["part_of", ["capability"], ["capability"]],
  ["part_of", ["application_format"], ["application_format", "operating_model"]],
  ["part_of", ["workflow"], ["operating_model", "application_format"]],
  ["part_of", ["governance_body"], ["governance_body"]],
  ["specializes", ["concept"], ["concept"]],
  ["precedes", ["talent_stage"], ["talent_stage"]],
  ["precedes", ["scaling_stage"], ["scaling_stage"]],
  ["gap_in", ["capability_gap"], ["capability"]],
  ["gap_in", ["knowledge_gap"], ["knowledge_area", "concept"]],
  [
    "investigates",
    ["research_question"],
    ["knowledge_gap", "knowledge_area", "concept", "assumption"],
  ],
  ["informs", ["@knowledge"], ["@strategic_model", "@capability", "@application", "@record"]],
  [
    "serves",
    ["@strategic_model", "-intended_outcome", "@capability", "@application"],
    ["intended_outcome"],
  ],
  [
    "shapes",
    ["strategic_model", "structural_leverage", "differentiation_logic", "strategic_implication"],
    ["@capability", "@application"],
  ],
  [
    "implies",
    ["strategic_model", "differentiation_logic", "structural_leverage"],
    ["strategic_implication"],
  ],
  [
    "exploits",
    ["strategic_model", "differentiation_logic", "@application"],
    ["structural_leverage"],
  ],
  [
    "positioned_against",
    ["differentiation_logic", "strategic_model", "application_format", "delivery_mechanism"],
    ["competitive_factor"],
  ],
  ["requires", ["capability"], ["capability", "skill", "role", "knowledge_area"]],
  ["requires", ["role"], ["skill"]],
  ["requires", ["@application"], ["capability", "role"]],
  [
    "implemented_through",
    ["capability"],
    ["operating_model", "application_format", "workflow", "delivery_mechanism"],
  ],
  ["delivered_through", ["operating_model", "application_format"], ["delivery_mechanism"]],
  ["measured_by", ["intended_outcome", "capability", "@application", "-metric"], ["metric"]],
  [
    "governed_by",
    ["capability", "@application", "-governance_body", "-decision_right"],
    ["governance_body", "decision_right"],
  ],
  ["holds", ["governance_body", "role"], ["decision_right"]],
  [
    "accountable_for",
    ["role", "governance_body"],
    [
      "capability",
      "application_format",
      "workflow",
      "documentation_protocol",
      "metric",
      "scaling_stage",
    ],
  ],
  ["introduces", ["talent_stage"], ["role", "capability"]],
  [
    "introduces",
    ["scaling_stage"],
    ["role", "capability", "application_format", "delivery_mechanism"],
  ],
  ["bounded_by", ["@core", "-system_boundary"], ["system_boundary"]],
  ["subject_to", ["@core", "-regulatory_factor", "@record"], ["regulatory_factor"]],
  ["documented_by", ["@core", "-documentation_protocol"], ["documentation_protocol"]],
  ["has_stake_in", ["stakeholder"], ["@element", "-stakeholder"]],
  ["underpins", ["assumption"], ["@core", "decision", "recommendation"]],
  ["threatens", ["risk"], ["@element", "-risk"]],
  ["constrains", ["constraint"], ["@core", "decision", "recommendation"]],
  ["mitigates", ["@capability", "@application", "decision", "recommendation"], ["risk"]],
  ["affects", ["@record"], ["@element"]],
  ["addresses", ["recommendation"], ["@element", "-recommendation"]],
  ["conflicts_with", ["@element"], ["@element"]],
];

/**
 * Phase 4 additions, as written in the Project Intelligence migration. The
 * Phase 3 rules above also expand to Opportunity wherever they name @record
 * or @element, as the migration regenerates them.
 */
export const PHASE_4_RULE_SPEC: readonly (readonly [
  string,
  readonly string[],
  readonly string[],
])[] = [
  ["underpins", ["assumption"], ["opportunity"]],
  ["constrains", ["constraint"], ["opportunity"]],
  ["advances", ["opportunity"], ["@element", "-risk", "-opportunity"]],
  ["pursues", ["@capability", "@application", "decision", "recommendation"], ["opportunity"]],
];

/**
 * Phase 5 additions, as written in 20261003000100_reviews_deliverables_implementation.sql.
 * Existing pairings are extended to the three new kinds by naming them
 * explicitly (§4.2); @record and @element keep their Phase 3/4 meaning.
 */
export const PHASE_5_RULE_SPEC: readonly (readonly [
  string,
  readonly string[],
  readonly string[],
])[] = [
  ["part_of", ["implementation_initiative"], ["implementation_initiative"]],
  ["precedes", ["implementation_initiative"], ["implementation_initiative"]],
  ["threatens", ["risk"], ["review", "deliverable", "implementation_initiative"]],
  ["mitigates", ["implementation_initiative"], ["risk"]],
  ["underpins", ["assumption"], ["review", "deliverable", "implementation_initiative"]],
  ["constrains", ["constraint"], ["review", "deliverable", "implementation_initiative"]],
  [
    "affects",
    ["review", "deliverable", "implementation_initiative"],
    ["review", "deliverable", "implementation_initiative"],
  ],
  ["affects", ["@record"], ["review", "deliverable", "implementation_initiative"]],
  ["affects", ["review", "deliverable", "implementation_initiative"], ["@element"]],
  ["addresses", ["recommendation"], ["review", "deliverable", "implementation_initiative"]],
  ["has_stake_in", ["stakeholder"], ["review", "deliverable", "implementation_initiative"]],
  ["subject_to", ["review", "deliverable", "implementation_initiative"], ["regulatory_factor"]],
  ["conflicts_with", ["review", "deliverable", "implementation_initiative"], ["@element"]],
  ["conflicts_with", ["@element"], ["review", "deliverable", "implementation_initiative"]],
  [
    "conflicts_with",
    ["review", "deliverable", "implementation_initiative"],
    ["review", "deliverable", "implementation_initiative"],
  ],
  ["examines", ["review"], ["@element", "review", "deliverable", "implementation_initiative"]],
  [
    "raises",
    ["review"],
    [
      "assumption",
      "risk",
      "constraint",
      "dependency",
      "decision",
      "recommendation",
      "opportunity",
      "implementation_initiative",
    ],
  ],
  ["documents", ["deliverable"], ["@element", "review", "deliverable", "implementation_initiative"]],
  ["implements", ["implementation_initiative"], ["@core"]],
  ["initiates", ["decision", "recommendation"], ["implementation_initiative"]],
  ["validates", ["review"], ["implementation_initiative"]],
];

export const RECORD_KINDS = [
  "assumption",
  "risk",
  "constraint",
  "dependency",
  "decision",
  "recommendation",
  "opportunity",
] as const satisfies readonly Exclude<
  ElementKind,
  "object" | "review" | "deliverable" | "implementation_initiative"
>[];

/** The three Phase 5 kinds, as plain rule tokens (not @record/@element - see PHASE_5_RULE_SPEC). */
export const PHASE_5_KINDS = [
  "review",
  "deliverable",
  "implementation_initiative",
] as const satisfies readonly Phase5Kind[];
