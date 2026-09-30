import type { Tone } from "@/components/ui/status-tag";
import type {
  EscalationLevel,
  IntelligenceAttention,
  TriageState,
} from "@/domain/intelligence/catalog";
import type { Database } from "@/types/database";

/**
 * Implementation vocabulary (Phase 5 proposal §7, §4.3). Mirrors
 * supabase/migrations/20261003000100_reviews_deliverables_implementation.sql;
 * catalog.test.ts checks the two agree. The database is the authority for
 * every rule.
 *
 * Implementation reuses Project Intelligence's stewardship/escalation enums
 * (intelligence_attention, triage_state, escalation_level) but writes to its
 * own tables (D2) — never Phase 4's.
 */

type Enums = Database["public"]["Enums"];
export type ImplementationStatus = Enums["implementation_status"];
export type ImplementationCheckpointType = Enums["implementation_checkpoint_type"];

type Label = { label: string; tone: Tone };

export type Category = { key: string; label: string; definition: string };

/** Mirrors public.implementation_categories, in sort order. */
export const IMPLEMENTATION_CATEGORIES: readonly Category[] = [
  {
    key: "program",
    label: "Program",
    definition: "A coordinated program of initiatives realizing part of the architecture.",
  },
  {
    key: "process",
    label: "Process",
    definition: "A repeatable operating process being put into practice.",
  },
  {
    key: "system",
    label: "System",
    definition: "A software system, platform or tool being built or deployed.",
  },
  {
    key: "partnership",
    label: "Partnership",
    definition: "An external partnership or agreement being formed.",
  },
  {
    key: "team_or_talent",
    label: "Team or talent",
    definition: "A team, role or capability being built or hired.",
  },
  {
    key: "governance",
    label: "Governance",
    definition: "A governance body, decision right or oversight mechanism being put in place.",
  },
  { key: "other", label: "Other", definition: "Anything the categories above do not describe." },
];

export function categoryLabel(key: string | null | undefined): string {
  if (!key) return "";
  return IMPLEMENTATION_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

// Statuses ---------------------------------------------------------------------------

export const IMPLEMENTATION_STATUSES = [
  "not_started",
  "in_progress",
  "operational",
  "validated",
  "stalled",
  "abandoned",
] as const satisfies readonly ImplementationStatus[];

/** Reached only by resolve_implementation_initiative, with a rationale (§7.2, §11). */
export const TERMINAL_STATUSES = [
  "validated",
  "abandoned",
] as const satisfies readonly ImplementationStatus[];

/** Directly editable by manage_implementation, non-terminal (§11). */
export const NON_TERMINAL_STATUSES = [
  "not_started",
  "in_progress",
  "operational",
  "stalled",
] as const satisfies readonly ImplementationStatus[];

export function isTerminalStatus(
  status: ImplementationStatus | string | null | undefined,
): boolean {
  return !!status && (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export const IMPLEMENTATION_STATUS: Record<ImplementationStatus, Label> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "accent" },
  operational: { label: "Operational", tone: "positive" },
  validated: { label: "Validated", tone: "positive" },
  stalled: { label: "Stalled", tone: "negative" },
  abandoned: { label: "Abandoned", tone: "neutral" },
};

export function implementationStatus(
  status: ImplementationStatus | string | null | undefined,
): Label | null {
  if (!status) return null;
  return (
    (IMPLEMENTATION_STATUS as Record<string, Label>)[status] ?? { label: status, tone: "neutral" }
  );
}

// Checkpoints ------------------------------------------------------------------------------

export const IMPLEMENTATION_CHECKPOINT_TYPES = [
  "design_approved",
  "agreement_executed",
  "operational_entry",
  "scheduled_review",
  "other",
] as const satisfies readonly ImplementationCheckpointType[];

export const IMPLEMENTATION_CHECKPOINT_TYPE_LABELS: Record<ImplementationCheckpointType, string> = {
  design_approved: "Design approved",
  agreement_executed: "Agreement executed",
  operational_entry: "Operational entry",
  scheduled_review: "Scheduled review",
  other: "Other",
};

// Signals --------------------------------------------------------------------------------

/** Implementation's own signal rule (§13, D16): separate from intelligence_signals(). */
export const IMPLEMENTATION_SIGNAL_RULES = ["implementation_past_target"] as const;
export type ImplementationSignalRule = (typeof IMPLEMENTATION_SIGNAL_RULES)[number];

export const IMPLEMENTATION_SIGNAL_RULE_LABELS: Record<
  ImplementationSignalRule,
  { label: string; attention: Tone }
> = {
  implementation_past_target: {
    label: "Target operational date has passed",
    attention: "attention",
  },
};

// Re-exported stewardship types (implementation's own tables, Project Intelligence's enums) ---

export type { EscalationLevel, IntelligenceAttention, TriageState };
