/**
 * The Development Edge envelope as the application reads it (proposal §6).
 *
 * `public.edge_items` returns one row per item; this module gives those rows
 * a typed shape for the pure grouping and ordering functions. The database
 * decides every item, tier and order fact; nothing here adds or removes one.
 */

export const EDGE_TIERS = ["human_flagged", "elevated", "attention", "ambient"] as const;
export type EdgeTier = (typeof EDGE_TIERS)[number];

export const EDGE_TIER_LABELS: Record<EdgeTier, string> = {
  human_flagged: "Escalated or marked critical by the team",
  elevated: "Governance approaching",
  attention: "To consider",
  ambient: "In context",
};

export const TIER_REASON_LABELS: Record<string, string> = {
  attention_critical: "The team marked it critical",
  open_escalation: "An escalation is open",
  attention_high: "The team set attention to high",
  governance_within_horizon: "Governance is approaching",
  rule_default: "A rule holds",
  ambient_rule: "Shown in context only",
};

export function tierRank(tier: string): number {
  const i = EDGE_TIERS.indexOf(tier as EdgeTier);
  return i === -1 ? EDGE_TIERS.length : i;
}

/** A governed reference in an item's basis. Never content (§6.2 rule 3). */
export type EdgeRef = {
  type: string;
  id: string;
  reference_code?: string | null;
  version_id?: string | null;
  version_no?: number | null;
  role?: string | null;
};

export type ReachClass = 1 | 2 | 3 | 4;

export const REACH_CLASS_LABELS: Record<ReachClass, string> = {
  1: "active implementation",
  2: "published architecture",
  3: "an Intended Outcome",
  4: "other records",
};

export type OrderFacts = {
  governance_date?: string | null;
  governance_kind?: string | null;
  governance_reference_code?: string | null;
  reach_class?: number | null;
  constrained_initiatives?: number | null;
  responsible?: boolean | null;
  trigger_at?: string | null;
  reference_code?: string | null;
};

export type PathStep = {
  to_id?: string;
  link_key?: string;
  direction?: string;
  terminal?: boolean;
};

export type EdgeItem = {
  item_key: string;
  rule_key: string;
  home: string;
  lens: string;
  epistemic_status: string;
  producer: string;
  subject_type: string;
  subject_id: string;
  subject_reference_code: string | null;
  subject_title: string | null;
  subject_kind: string | null;
  variant: string | null;
  details: Record<string, unknown> | null;
  basis: EdgeRef[] | null;
  trigger_type: string;
  trigger_subject_id: string | null;
  trigger_reference_code: string | null;
  trigger_title: string | null;
  trigger_version_id: string | null;
  trigger_version_no: number | null;
  trigger_at: string | null;
  trigger_key: string;
  consequence_path: PathStep[] | null;
  fingerprint: string;
  resolving_act: string;
  tier: string;
  tier_reason: string;
  order_facts: OrderFacts | null;
  judgment_kind: string | null;
  judged_by: string | null;
  judged_by_name: string | null;
  judged_at: string | null;
  judgment_reason: string | null;
  judgment_expires_on: string | null;
  judgment_source: string | null;
  promoted_element_id: string | null;
  judged: boolean;
};

/** The database types jsonb as `Json`; the envelope's shape is fixed (§6.1). */
export function toEdgeItems(rows: readonly unknown[] | null | undefined): EdgeItem[] {
  return (rows ?? []) as EdgeItem[];
}

export const CHANGE_REACHES_KEY = "change_reaches";

export const JUDGMENT_KINDS = [
  "investigating",
  "not_material",
  "deferred",
  "disagree",
  "promoted",
] as const;
export type JudgmentKind = (typeof JUDGMENT_KINDS)[number];

export const JUDGMENT_LABELS: Record<JudgmentKind, string> = {
  investigating: "Investigating",
  not_material: "Not material",
  deferred: "Deferred",
  disagree: "Disagree",
  promoted: "Promoted",
};
