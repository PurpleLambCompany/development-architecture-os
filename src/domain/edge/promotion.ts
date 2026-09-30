import { internalElementHref } from "@/domain/architecture/links";
import type { ElementKind } from "@/domain/architecture/catalog";
import type { EdgeItem } from "./items";
import type { EdgeItemRef } from "./schemas";
import { itemLine } from "./words";

/**
 * Promotion from the Development Edge (ADR-0056, proposal §15). An item is
 * promoted only by a person completing an ordinary governed operation; the
 * Edge prefills the form and, once the record exists, records a `promoted`
 * judgment naming it as the governed promotion target. The vocabulary is
 * closed and matches the database check on edge_judgments.
 */
export const PROMOTION_TARGET_KINDS = [
  "risk",
  "decision",
  "review",
  "acceptance_criterion",
] as const;
export type PromotionTargetKind = (typeof PROMOTION_TARGET_KINDS)[number];

export const PROMOTION_LABELS: Record<PromotionTargetKind, string> = {
  risk: "Record a Risk",
  decision: "Record a Decision",
  review: "Schedule a Review",
  acceptance_criterion: "Propose an acceptance criterion",
};

/** Element kinds that carry acceptance criteria (ADR-0046). */
const CRITERION_HOLDERS: readonly string[] = ["object", "implementation_initiative"];

type PromotableItem = {
  rule_key: string;
  subject_type: string;
  subject_id: string;
  subject_kind: string | null;
  fingerprint: string;
};

/**
 * The promotions an item offers. A Risk, Decision or Review may answer any
 * item about a governed record; a criterion is proposed on the item's own
 * subject, so it is offered only when that subject can carry criteria.
 */
export function promotionTargetsFor(item: PromotableItem): PromotionTargetKind[] {
  if (item.subject_type !== "element" && item.subject_type !== "client_action") return [];
  const targets: PromotionTargetKind[] = ["risk", "decision", "review"];
  if (item.subject_type === "element" && CRITERION_HOLDERS.includes(item.subject_kind ?? ""))
    targets.push("acceptance_criterion");
  return targets;
}

/** Where the prefilled governed form for a promotion lives. */
export function promotionHref(slug: string, item: PromotableItem, kind: PromotionTargetKind) {
  const params = new URLSearchParams({
    promoteRule: item.rule_key,
    promoteType: item.subject_type,
    promoteId: item.subject_id,
    promoteFp: item.fingerprint,
  });
  const base = `/internal/engagements/${slug}`;
  switch (kind) {
    case "review":
      return `${base}/reviews?${params.toString()}`;
    case "acceptance_criterion":
      return `${internalElementHref(slug, item.subject_kind as ElementKind, item.subject_id)}?${params.toString()}#criteria`;
    default:
      return `${base}/intelligence?${new URLSearchParams({ new: kind, ...Object.fromEntries(params) }).toString()}`;
  }
}

/** The item a page was opened to promote, from its query string. */
export function promotionFromQuery(
  query: Record<string, string | string[] | undefined>,
): EdgeItemRef | null {
  const param = (key: string) => (typeof query[key] === "string" && query[key] ? query[key] : null);
  const ruleKey = param("promoteRule");
  const subjectType = param("promoteType");
  const subjectId = param("promoteId");
  const fingerprint = param("promoteFp");
  return ruleKey && subjectType && subjectId && fingerprint
    ? { ruleKey, subjectType, subjectId, fingerprint }
    : null;
}

/**
 * An Edge item being promoted into a proposed criterion on this element
 * (ADR-0056). The form is the ordinary proposal, prefilled; submitting it
 * proposes the criterion and records it as the item's promotion target.
 */
export type CriterionPromotion = {
  engagementId: string;
  slug: string;
  elementKind: ElementKind;
  item: EdgeItemRef;
  /** What the item says, shown with the form and offered as a first draft. */
  itemLine: string;
};

/**
 * The criterion promotion a page was opened for, when the item is about this
 * element, can carry a criterion, and is still current and unjudged in
 * `items` (the element's own unjudged Edge items). Otherwise none.
 */
export function criterionPromotionFor(
  query: Record<string, string | string[] | undefined>,
  items: readonly EdgeItem[],
  context: { engagementId: string; slug: string; elementId: string; elementKind: ElementKind },
): CriterionPromotion | null {
  const ref = promotionFromQuery(query);
  if (!ref || ref.subjectType !== "element" || ref.subjectId !== context.elementId) return null;
  const item = items.find(
    (i) =>
      i.rule_key === ref.ruleKey &&
      i.subject_type === ref.subjectType &&
      i.subject_id === ref.subjectId &&
      i.fingerprint === ref.fingerprint &&
      !i.judged,
  );
  if (!item || !promotionTargetsFor(item).includes("acceptance_criterion")) return null;
  return {
    engagementId: context.engagementId,
    slug: context.slug,
    elementKind: context.elementKind,
    item: ref,
    itemLine: itemLine(item),
  };
}
