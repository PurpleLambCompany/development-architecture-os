import type { Tone } from "@/components/ui/status-tag";
import type { Database } from "@/types/database";

/**
 * Reviews vocabulary (Phase 5 proposal §5, §4.3). Mirrors
 * supabase/migrations/20261003000000_phase5_enums.sql and
 * 20261003000100_reviews_deliverables_implementation.sql; the database is
 * the authority for every rule.
 */

type Enums = Database["public"]["Enums"];
export type ReviewType = Enums["review_type"];
export type ReviewStatus = Enums["review_status"];
export type ReviewParticipantRole = Enums["review_participant_role"];

type Label = { label: string; tone: Tone };

export const REVIEW_TYPES = [
  "executive_review",
  "architecture_review",
] as const satisfies readonly ReviewType[];

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  executive_review: "Executive Review",
  architecture_review: "Architecture Review",
};

export const REVIEW_STATUSES = [
  "scheduled",
  "held",
  "cancelled",
] as const satisfies readonly ReviewStatus[];

export const REVIEW_STATUS: Record<ReviewStatus, Label> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  held: { label: "Held", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const REVIEW_PARTICIPANT_ROLES = [
  "organizer",
  "reviewer",
  "presenter",
  "attendee",
] as const satisfies readonly ReviewParticipantRole[];

export const REVIEW_PARTICIPANT_ROLE_LABELS: Record<ReviewParticipantRole, string> = {
  organizer: "Organizer",
  reviewer: "Reviewer",
  presenter: "Presenter",
  attendee: "Attendee",
};

export function reviewStatus(status: ReviewStatus | string | null | undefined): Label | null {
  if (!status) return null;
  return (REVIEW_STATUS as Record<string, Label>)[status] ?? { label: status, tone: "neutral" };
}
