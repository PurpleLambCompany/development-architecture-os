import { StatusTag } from "@/components/ui/status-tag";
import {
  ENGAGEMENT_STATUS_LABELS,
  ENGAGEMENT_STATUS_TONES,
  type EngagementStatus,
} from "@/domain/engagements/catalog";

export function EngagementStatusTag({ status }: { status: EngagementStatus }) {
  return (
    <StatusTag tone={ENGAGEMENT_STATUS_TONES[status]}>{ENGAGEMENT_STATUS_LABELS[status]}</StatusTag>
  );
}
