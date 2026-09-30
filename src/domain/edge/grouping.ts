/**
 * Trigger grouping (proposal §7, ADR-0055).
 *
 * One triggering change is one Edge event. `groupEdgeItems` is the only place
 * items become events; every surface uses it and no event is stored. The
 * envelope keeps every item: grouping only presents them.
 *
 * Rules implemented here (§7.3):
 *  1. every item belongs to exactly one event, keyed by its trigger key;
 *  2. revisions coalesce per element (the database keys a revision event on
 *     the element's latest substantive version, so this holds by construction);
 *  3. standing conditions group by subject (`state:` + subject id);
 *  4. a rule item and a `change_reaches` consequence on the same record under
 *     the same trigger merge into one consequence: the rule's item, with the
 *     matrix path added;
 *  5. different triggers stay separate;
 *  6. consequences reached through a hub other than the trigger itself
 *     collapse to one line with a count;
 *  7. the event's tier is its highest item tier, and its order facts the
 *     strongest among its items.
 */

import { edgeRuleLabel } from "./rules";
import { CHANGE_REACHES_KEY, type EdgeItem, type PathStep, tierRank } from "./items";
import { compareOrderKeys, orderKeyOf, strongestOrderKey, type OrderKey } from "./ordering";

export type EdgeConsequence = {
  key: string;
  subjectType: string;
  subjectId: string;
  referenceCode: string | null;
  title: string | null;
  kind: string | null;
  /** The item shown: a rule's item when one exists, otherwise the matrix consequence. */
  primary: EdgeItem;
  /** Every item behind this line, so judging the line judges each of them. */
  items: EdgeItem[];
  /** Matrix paths from `change_reaches` items merged into this line. */
  matrixPaths: PathStep[][];
  tier: string;
  orderKey: OrderKey;
};

export type EdgeHubGroup = {
  hubElementId: string;
  hubReferenceCode: string | null;
  consequences: EdgeConsequence[];
};

export type EdgeEvent = {
  key: string;
  triggerType: string;
  triggerSubjectId: string | null;
  triggerReferenceCode: string | null;
  triggerTitle: string | null;
  triggerVersionNo: number | null;
  triggerAt: string | null;
  /** The author's change summary, shown verbatim and never interpreted (Q30). */
  changeSummary: string | null;
  /** Consequences shown one per line. */
  consequences: EdgeConsequence[];
  /** Consequences collapsed under a hub (rule 6). */
  hubs: EdgeHubGroup[];
  /** Every item in the event. */
  items: EdgeItem[];
  tier: string;
  orderKey: OrderKey;
  lenses: string[];
  epistemicStatuses: string[];
};

function detailString(item: EdgeItem, key: string): string | null {
  const v = item.details?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function hubOf(item: EdgeItem): string | null {
  if (item.rule_key !== CHANGE_REACHES_KEY) return null;
  const hub = detailString(item, "hub_element_id");
  const trigger = detailString(item, "trigger_element_id") ?? item.trigger_subject_id;
  return hub && hub !== trigger ? hub : null;
}

function consequenceKey(item: EdgeItem): string {
  return `${item.subject_type}:${item.subject_id}`;
}

function buildConsequence(items: EdgeItem[]): EdgeConsequence {
  const ruleItems = items.filter((i) => i.rule_key !== CHANGE_REACHES_KEY);
  const byOrder = (list: EdgeItem[]) =>
    [...list].sort((a, b) => compareOrderKeys(orderKeyOf(a), orderKeyOf(b)));
  const primary = byOrder(ruleItems.length > 0 ? ruleItems : items)[0];
  const keys = items.map(orderKeyOf);
  return {
    key: consequenceKey(primary),
    subjectType: primary.subject_type,
    subjectId: primary.subject_id,
    referenceCode: primary.subject_reference_code,
    title: primary.subject_title,
    kind: primary.subject_kind,
    primary,
    items: byOrder(items),
    matrixPaths: items
      .filter((i) => i.rule_key === CHANGE_REACHES_KEY && Array.isArray(i.consequence_path))
      .map((i) => i.consequence_path as PathStep[]),
    tier: [...items].sort((a, b) => tierRank(a.tier) - tierRank(b.tier))[0].tier,
    orderKey: strongestOrderKey(keys),
  };
}

function refCodeFor(items: EdgeItem[], id: string): string | null {
  for (const item of items) {
    if (item.subject_id === id && item.subject_reference_code) return item.subject_reference_code;
    if (item.trigger_subject_id === id && item.trigger_reference_code) return item.trigger_reference_code;
    for (const ref of item.basis ?? []) {
      if (ref.id === id && ref.reference_code) return ref.reference_code;
    }
  }
  return null;
}

function buildEvent(key: string, items: EdgeItem[]): EdgeEvent {
  const bySubject = new Map<string, EdgeItem[]>();
  for (const item of items) {
    const k = consequenceKey(item);
    bySubject.set(k, [...(bySubject.get(k) ?? []), item]);
  }
  const all = [...bySubject.values()].map(buildConsequence).sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));

  // Rule 6: a hub collapses only when two or more lines pass through it.
  const hubMembers = new Map<string, EdgeConsequence[]>();
  for (const c of all) {
    if (c.primary.rule_key !== CHANGE_REACHES_KEY) continue;
    const hub = hubOf(c.primary);
    if (hub) hubMembers.set(hub, [...(hubMembers.get(hub) ?? []), c]);
  }
  const hubs: EdgeHubGroup[] = [];
  const collapsed = new Set<string>();
  for (const [hub, members] of hubMembers) {
    if (members.length < 2) continue;
    hubs.push({ hubElementId: hub, hubReferenceCode: refCodeFor(items, hub), consequences: members });
    for (const m of members) collapsed.add(m.key);
  }
  hubs.sort((a, b) => compareOrderKeys(a.consequences[0].orderKey, b.consequences[0].orderKey));

  const head = [...items].sort((a, b) => compareOrderKeys(orderKeyOf(a), orderKeyOf(b)))[0];
  const withTrigger = items.find((i) => i.trigger_subject_id) ?? head;
  const orderKey = strongestOrderKey(items.map(orderKeyOf));
  const summaries = items.map((i) => detailString(i, "change_summary")).filter((s): s is string => s !== null);
  return {
    key,
    triggerType: head.trigger_type,
    triggerSubjectId: withTrigger.trigger_subject_id,
    triggerReferenceCode: withTrigger.trigger_reference_code,
    triggerTitle: withTrigger.trigger_title,
    triggerVersionNo: withTrigger.trigger_version_no,
    triggerAt: withTrigger.trigger_at,
    changeSummary: head.trigger_type === "substantive_revision" ? (summaries[0] ?? null) : null,
    consequences: all.filter((c) => !collapsed.has(c.key)),
    hubs,
    items,
    tier: orderKey.tier,
    orderKey,
    lenses: [...new Set(items.map((i) => i.lens))].sort(),
    epistemicStatuses: [...new Set(items.map((i) => i.epistemic_status))].sort(),
  };
}

/** Group envelope items into ordered events. Pure; no item is dropped. */
export function groupEdgeItems(items: readonly EdgeItem[]): EdgeEvent[] {
  const byTrigger = new Map<string, EdgeItem[]>();
  for (const item of items) {
    byTrigger.set(item.trigger_key, [...(byTrigger.get(item.trigger_key) ?? []), item]);
  }
  return [...byTrigger.entries()]
    .map(([key, list]) => buildEvent(key, list))
    .sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
}

/** The event heading in plain language (§7.2, §8.2 item 1). */
export function eventHeading(event: EdgeEvent): string {
  const first = event.items[0];
  const code = event.triggerReferenceCode ?? first.subject_reference_code;
  const title = event.triggerReferenceCode ? event.triggerTitle : first.subject_title;
  const name = [code, title].filter(Boolean).join(" ") || "This engagement";
  switch (event.triggerType) {
    case "substantive_revision":
      return `${name} was revised`;
    case "status_change":
      return `${name} changed status`;
    case "evidence_link":
      return `New evidence on ${name}`;
    case "decision":
      return `${name} was decided`;
    case "date":
      return `${edgeRuleLabel(first.rule_key)}: ${[first.subject_reference_code, first.subject_title].filter(Boolean).join(" ")}`;
    default:
      return first.subject_type === "engagement"
        ? edgeRuleLabel(first.rule_key)
        : `Conditions on ${[first.subject_reference_code, first.subject_title].filter(Boolean).join(" ") || name}`;
  }
}

/** Items a person would judge when judging the whole event (§7.3 rule 9). */
export function eventItems(event: EdgeEvent): EdgeItem[] {
  return event.items;
}

/** Events at or above a tier: the Engagement Edge list omits Ambient (§8.1). */
export function eventsForList(events: readonly EdgeEvent[]): EdgeEvent[] {
  return events.filter((e) => e.tier !== "ambient");
}
