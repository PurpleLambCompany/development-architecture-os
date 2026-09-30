/**
 * Authoring help for approach statements (D21, §17.2). A method's identity
 * reaches a client only as text an architect writes and publishes. The editor
 * offers the approved name of an asset marked may_be_named, and warns (never
 * blocks) when an internal-only asset's title appears in client-visible text.
 * Nothing here projects library data into a client snapshot.
 */
export type ApproachGuidance = {
  /** Approved names of may_be_named assets linked to the element. */
  approved: { assetTitle: string; name: string }[];
  /** Titles of internal-only assets that must not appear in client text. */
  internalTitles: string[];
};

export const NO_APPROACH_GUIDANCE: ApproachGuidance = { approved: [], internalTitles: [] };

/** Internal-only titles that appear in `text`, ignoring case and spacing. */
export function internalTitlesIn(text: string, internalTitles: readonly string[]): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const body = norm(text);
  if (!body) return [];
  return [...new Set(internalTitles)].filter((t) => norm(t).length >= 4 && body.includes(norm(t)));
}
