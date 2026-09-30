/**
 * Since You Were Away (proposal §14, ADR-0057).
 *
 * The briefing window starts at the user's own private mark, set only by the
 * explicit "Mark reviewed through" act. Without a mark it covers the prior 14
 * days and says so (OD-10). Nothing here reads sign-in history, page views
 * or time on the engagement, and nothing advances the mark on its own.
 */

export const FIRST_BRIEFING_DAYS = 14;

export type BriefingWindow = {
  since: string;
  until: string;
  /** True when the user has not yet marked a point, so the 14-day default applies. */
  isDefault: boolean;
};

export function briefingWindow(
  briefedThrough: string | null | undefined,
  now: Date,
): BriefingWindow {
  const until = now.toISOString();
  if (briefedThrough)
    return { since: new Date(briefedThrough).toISOString(), until, isDefault: false };
  const since = new Date(now.getTime() - FIRST_BRIEFING_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return { since, until, isDefault: true };
}

/**
 * The time the "Mark reviewed through" button passes: the newest change the
 * briefing showed, not "now", so nothing that arrived while reading is
 * skipped (§14.1). Null when the briefing showed nothing new.
 */
export function markThroughFor(occurredAts: readonly (string | null | undefined)[]): string | null {
  let newest: number | null = null;
  for (const at of occurredAts) {
    if (!at) continue;
    const t = Date.parse(at);
    if (!Number.isNaN(t) && (newest === null || t > newest)) newest = t;
  }
  return newest === null ? null : new Date(newest).toISOString();
}

/** "New on the Edge": items whose trigger time is after the mark. State and date items have none (Q7). */
export function isNewSince<T extends { trigger_at: string | null }>(
  item: T,
  since: string,
): boolean {
  return item.trigger_at !== null && Date.parse(item.trigger_at) > Date.parse(since);
}

export const FIRST_BRIEFING_NOTE = `Showing the last ${FIRST_BRIEFING_DAYS} days. Mark reviewed to set your own starting point.`;
