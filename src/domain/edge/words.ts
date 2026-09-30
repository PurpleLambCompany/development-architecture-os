/**
 * The words an Edge item is read in (proposal §8.2, §8.3). Plain language
 * first, the governed term available; never "error", "violation", "health"
 * or "score". Items say what may warrant a look, never a conclusion.
 */

import { RELATIONSHIP_TYPES } from "@/domain/architecture/vocabulary";
import { edgeRule, edgeRuleLabel, VARIANT_LABELS } from "./rules";
import { CHANGE_REACHES_KEY, type EdgeItem } from "./items";

const RELATIONSHIP_LABEL = new Map<string, string>(RELATIONSHIP_TYPES.map((t) => [t.key, t.label]));

/** How an off-spine link reads, from the reached record's side. */
const OFF_SPINE_WORDS: Record<string, string> = {
  dependency_ends: "is an end of a dependency on it",
  statement_evidence_links: "is evidence cited on it",
  element_evidence_links: "is evidence linked to it",
  checkpoint_support: "is a checkpoint that relies on it",
  acceptance_criteria_governed:
    "is an agreed criterion in force on an initiative that implements it",
  validation_criteria: "is a validation that captured criteria on it",
  baseline_items: "froze it in a baseline",
  approval_version: "is an approval of it",
  client_action_subjects: "is an open client request about it",
  contribution_version: "is client input on it",
  method_application_elements: "is an open Method Application that examined it",
  method_application_evidence: "is evidence a Method Application gathered for it",
  element_method_lineage: "is its method lineage",
  dam_release: "is the DAM release behind it",
  intelligence_record_domains: "scopes it to a domain",
  engagement_member_areas: "is an area assignment covering it",
  domain_assessments: "is a domain judgment covering it",
};

/** "implements APP-001", "APP-001 is accountable for it", from a matrix step. */
export function linkWords(
  linkKey: string | undefined,
  direction: string | undefined,
  triggerCode: string,
): string {
  if (!linkKey) return "";
  const offSpine = OFF_SPINE_WORDS[linkKey];
  if (offSpine) return offSpine.replace(/\bit\b/, triggerCode);
  const label = RELATIONSHIP_LABEL.get(linkKey) ?? linkKey.replaceAll("_", " ");
  return direction === "target_to_source"
    ? `${label} ${triggerCode}`
    : `${triggerCode} ${label} it`;
}

function str(item: EdgeItem, key: string): string | null {
  const v = item.details?.[key];
  return typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null;
}

/** One line for a consequence or condition: what holds, in the item's own facts. */
export function itemLine(item: EdgeItem): string {
  const trigger = item.trigger_reference_code ?? "the revised element";
  switch (item.rule_key) {
    case CHANGE_REACHES_KEY: {
      const words = linkWords(
        str(item, "link_key") ?? undefined,
        str(item, "direction") ?? undefined,
        trigger,
      );
      const reason = str(item, "reason");
      return [words, reason].filter(Boolean).join(". ");
    }
    case "implemented_element_revised":
      return `Implements ${str(item, "implemented_reference_code") ?? trigger}, revised to v${str(item, "revision_version_no") ?? "?"} after the implements link was recorded. Reality may be tracking the earlier design.`;
    case "validated_element_revised":
      return `Validated before ${str(item, "implemented_reference_code") ?? trigger} was revised to v${str(item, "revision_version_no") ?? "?"}. The validation predates the current design.`;
    case "examined_element_revised_since_review": {
      const examined = str(item, "examined_version_no");
      return `Examined ${str(item, "examined_reference_code") ?? trigger} ${examined ? `at v${examined}` : "before it was published"} when it was held; it is now at v${str(item, "current_version_no") ?? "?"}. Its judgment predates this revision.`;
    }
    case "evidence_after_review":
      return `New evidence on ${str(item, "examined_reference_code") ?? trigger}, linked after this Review captured it.`;
    case "deliverable_documents_revised":
      return str(item, "reference_point") === "baseline"
        ? `Documents ${str(item, "documented_reference_code") ?? trigger}, which has been revised since the version in its baseline.`
        : `Documents ${str(item, "documented_reference_code") ?? trigger}. It was approved before this revision.`;
    case "criteria_predate_revision":
      return `Agreed before ${str(item, "governed_reference_code") ?? trigger} was revised to v${str(item, "revision_version_no") ?? "?"}.`;
    case "decision_not_reflected":
      return `Decided after the latest version of ${str(item, "affected_reference_code") ?? "an element it affects"}. The architecture may not yet reflect it.`;
    case "contribution_on_prior_version":
      return `Client input made on v${str(item, "contribution_version_no") ?? "?"} is still unhandled; the element is now revised.`;
    case "approval_behind_published":
      return `Approved at v${str(item, "approved_version_no") ?? "?"}; published through v${str(item, "latest_version_no") ?? "?"} with a substantive revision since.`;
    default: {
      const rule = edgeRule(item.rule_key);
      const variant = item.variant ? VARIANT_LABELS[item.variant] : null;
      return [variant, rule?.definition ?? edgeRuleLabel(item.rule_key)].filter(Boolean).join(". ");
    }
  }
}

export const CHANGE_TYPE_WORDS: Record<string, string> = {
  first_publication: "First published",
  substantive_revision: "Revised",
  status_publication: "Status published",
  element_retired: "Retired",
  element_superseded: "Superseded",
  relationship_added: "Relationship added",
  relationship_retired: "Relationship retired",
  evidence_linked: "Evidence linked",
  approval_requested: "Approval requested",
  approval_recorded: "Approval recorded",
  baseline_frozen: "Baseline frozen",
  record_status_changed: "Status changed",
  decision_deferred: "Decision deferred",
  decision_decided: "Decision made",
  escalation_opened: "Escalated",
  escalation_resolved: "Escalation resolved",
  client_action_answered: "Client request answered",
  contribution_received: "Client input received",
  review_scheduled: "Review scheduled",
  review_held: "Review held",
  review_cancelled: "Review cancelled",
  validation_recorded: "Validation recorded",
  implementation_status_changed: "Implementation status changed",
  checkpoint_achieved: "Checkpoint achieved",
  criterion_proposed: "Criterion proposed",
  criterion_agreed: "Criterion agreed",
  criterion_superseded: "Criterion superseded",
  criterion_withdrawn: "Criterion withdrawn",
  application_started: "Method Application started",
  application_closed: "Method Application closed",
  application_addendum: "Method Application addendum",
};

/** Substantive and developmental changes lead; status publications follow (§14.2). */
export function changeRank(changeType: string): number {
  if (changeType === "status_publication") return 2;
  if (changeType === "substantive_revision" || changeType === "first_publication") return 0;
  return 1;
}
