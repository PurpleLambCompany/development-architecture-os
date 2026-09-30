/**
 * Deterministic-first ordering (proposal §9, ADR-0055).
 *
 * No score: order is lexicographic over governed facts the database returns
 * in `order_facts`, and every position can be said in words. The same inputs
 * always give the same order. Nothing about judgment history, rule frequency,
 * record staleness or another engagement is an input (§9.4).
 */

import { REACH_CLASS_LABELS, type OrderFacts, type ReachClass, tierRank } from "./items";

/** The sort keys of one item or event, as the comparator reads them. */
export type OrderKey = {
  tier: string;
  governanceDate: string | null;
  reachClass: ReachClass;
  responsible: boolean;
  triggerAt: string | null;
  referenceCode: string;
  /** Final tiebreak so equal facts still give one order. */
  tiebreak: string;
};

export function reachClassOf(facts: OrderFacts | null | undefined): ReachClass {
  const n = Number(facts?.reach_class ?? 4);
  return (n >= 1 && n <= 4 ? n : 4) as ReachClass;
}

export function orderKeyOf(item: {
  tier: string;
  order_facts: OrderFacts | null;
  trigger_at: string | null;
  subject_reference_code: string | null;
  trigger_reference_code: string | null;
  item_key: string;
}): OrderKey {
  const f = item.order_facts ?? {};
  return {
    tier: item.tier,
    governanceDate: f.governance_date ?? null,
    reachClass: reachClassOf(f),
    responsible: f.responsible === true,
    triggerAt: item.trigger_at ?? f.trigger_at ?? null,
    referenceCode: f.reference_code ?? item.subject_reference_code ?? item.trigger_reference_code ?? "",
    tiebreak: item.item_key,
  };
}

function compareNullableAsc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

function compareNullableDesc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return Date.parse(a) > Date.parse(b) ? -1 : Date.parse(a) < Date.parse(b) ? 1 : 0;
}

/**
 * §9.2 then §9.3: tier; nearest governance date; reach class; the reader's
 * structural responsibility; later trigger; reference code.
 */
export function compareOrderKeys(a: OrderKey, b: OrderKey): number {
  return (
    tierRank(a.tier) - tierRank(b.tier) ||
    compareNullableAsc(a.governanceDate, b.governanceDate) ||
    a.reachClass - b.reachClass ||
    Number(b.responsible) - Number(a.responsible) ||
    compareNullableDesc(a.triggerAt, b.triggerAt) ||
    a.referenceCode.localeCompare(b.referenceCode, "en") ||
    a.tiebreak.localeCompare(b.tiebreak, "en")
  );
}

/** The strongest facts among several keys (§7.3 rule 7): each fact taken at its strongest. */
export function strongestOrderKey(keys: readonly OrderKey[]): OrderKey {
  if (keys.length === 0) throw new Error("strongestOrderKey needs at least one key");
  const sorted = [...keys].sort(compareOrderKeys);
  const dates = keys.map((k) => k.governanceDate).filter((d): d is string => d !== null).sort();
  const triggers = keys.map((k) => k.triggerAt).filter((d): d is string => d !== null);
  triggers.sort((x, y) => Date.parse(y) - Date.parse(x));
  return {
    tier: sorted[0].tier,
    governanceDate: dates[0] ?? null,
    reachClass: Math.min(...keys.map((k) => k.reachClass)) as ReachClass,
    responsible: keys.some((k) => k.responsible),
    triggerAt: triggers[0] ?? null,
    referenceCode: sorted[0].referenceCode,
    tiebreak: sorted[0].tiebreak,
  };
}

const GOVERNANCE_KIND_LABELS: Record<string, string> = {
  review_scheduled: "is scheduled for",
  decision_needed_by: "is needed by",
  checkpoint_target: "has a checkpoint due",
  client_action_due: "is due",
};

function formatBusinessDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Why this is here", in words, from the order facts (§8.2 item 4). */
export function describeOrderFacts(facts: OrderFacts | null | undefined): string[] {
  const f = facts ?? {};
  const lines: string[] = [];
  if (f.governance_date) {
    const what = GOVERNANCE_KIND_LABELS[f.governance_kind ?? ""] ?? "is scheduled for";
    const who = f.governance_reference_code ?? "Governance";
    lines.push(`${who} ${what} ${formatBusinessDate(f.governance_date)}`);
  }
  const reach = reachClassOf(f);
  if (reach < 4) lines.push(`Reaches ${REACH_CLASS_LABELS[reach]}`);
  if (f.constrained_initiatives) {
    lines.push(
      `Constrains ${f.constrained_initiatives} ${f.constrained_initiatives === 1 ? "initiative" : "initiatives"}`,
    );
  }
  if (f.responsible) lines.push("You hold responsibility here");
  return lines;
}
