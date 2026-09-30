import type { Database } from "@/types/database";
import type { Tone } from "@/components/ui/status-tag";

export type EngagementType = Database["public"]["Enums"]["engagement_type"];
export type EngagementStatus = Database["public"]["Enums"]["engagement_status"];
export type ArchitectureDomain = Database["public"]["Enums"]["architecture_domain"];

export const ENGAGEMENT_TYPES = [
  "development_architecture_sprint",
  "development_architecture_intensive",
  "embedded_development_partner",
  "cohort",
  "custom",
] as const satisfies readonly EngagementType[];

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  development_architecture_sprint: "Development Architecture Sprint",
  development_architecture_intensive: "Development Architecture Intensive",
  embedded_development_partner: "Embedded Development Partner",
  cohort: "Cohort",
  custom: "Custom Engagement",
};

export const ENGAGEMENT_STATUSES = [
  "proposed",
  "active",
  "paused",
  "completed",
  "archived",
] as const satisfies readonly EngagementStatus[];

export const ENGAGEMENT_STATUS_LABELS: Record<EngagementStatus, string> = {
  proposed: "Proposed",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

export const ENGAGEMENT_STATUS_TONES: Record<EngagementStatus, Tone> = {
  proposed: "neutral",
  active: "accent",
  paused: "attention",
  completed: "positive",
  archived: "neutral",
};

/** The internal navigation groups engagements into these views (spec §28). */
export const ENGAGEMENT_VIEWS = {
  active: { label: "Active", statuses: ["active", "paused"] },
  upcoming: { label: "Upcoming", statuses: ["proposed"] },
  completed: { label: "Completed", statuses: ["completed", "archived"] },
} as const satisfies Record<string, { label: string; statuses: readonly EngagementStatus[] }>;

export type EngagementView = keyof typeof ENGAGEMENT_VIEWS;

export function isEngagementView(value: unknown): value is EngagementView {
  return typeof value === "string" && value in ENGAGEMENT_VIEWS;
}

/** The four architecture domains, in method order (spec §5.2). */
export const ARCHITECTURE_DOMAINS: { key: ArchitectureDomain; label: string; summary: string }[] = [
  {
    key: "knowledge",
    label: "Knowledge Architecture",
    summary: "Domain map, research questions, evidence and system boundaries.",
  },
  {
    key: "capability",
    label: "Capability Architecture",
    summary: "Capabilities, skills, gaps, readiness and talent sequencing.",
  },
  {
    key: "strategic_model",
    label: "Strategic Model Architecture",
    summary: "Applied models, assumptions, leverage and strategic implications.",
  },
  {
    key: "application",
    label: "Application Architecture",
    summary: "Operating model, governance, decision rights and measurement.",
  },
];

/** Maturity vocabulary from spec §8. Phase 1 displays it; Phase 3 records it. */
export const MATURITY_STATES = [
  "Undefined",
  "Emerging",
  "Defined",
  "Structured",
  "Operationalized",
] as const;
