import type { Database } from "@/types/database";

/**
 * Deliverables vocabulary (Phase 5 proposal §6, §4.3). Mirrors
 * supabase/migrations/20261003000000_phase5_enums.sql; the database is the
 * authority for every rule.
 */

type Enums = Database["public"]["Enums"];
export type DeliverableType = Enums["deliverable_type"];

export const DELIVERABLE_TYPES = [
  "full_architecture_blueprint",
  "executive_strategy_deck",
  "capability_map",
  "implementation_framework",
  "measurement_model",
  "executive_summary",
  "other",
] as const satisfies readonly DeliverableType[];

export const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  full_architecture_blueprint: "Full Architecture Blueprint",
  executive_strategy_deck: "Executive Strategy Deck",
  capability_map: "Capability Map",
  implementation_framework: "Implementation Framework",
  measurement_model: "Measurement Model",
  executive_summary: "Executive Summary",
  other: "Other",
};
