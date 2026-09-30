/**
 * Substantive revision (Phase 7A proposal §12, Q30, ADR-0053).
 *
 * A published version n ≥ 2 is a substantive revision if its internal snapshot
 * differs from version n − 1 after removing, from both, the excluded paths for
 * the element's kind. The list names status and lifecycle fields only; every
 * other field is content. `change_summary` is never parsed.
 *
 * Mirrors `private.substantive_excluded_paths` in
 * supabase/migrations/20261006000100_substantive_revisions.sql;
 * substantive.test.ts checks the two agree and that every path exists in the
 * snapshot builder's output for its kind.
 */

export const ELEMENT_KINDS = [
  "object",
  "assumption",
  "risk",
  "constraint",
  "dependency",
  "decision",
  "recommendation",
  "opportunity",
  "review",
  "deliverable",
  "implementation_initiative",
] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

/** Excluded for every kind: the AI review gate's state, on the element and on each statement. */
export const EXCLUDED_FOR_ALL_KINDS = [
  "ai_review_state",
  "ai_reviewed_by",
  "ai_reviewed_at",
  "statements[].ai_review_state",
  "statements[].ai_reviewed_by",
] as const;

/** Excluded per kind: status and lifecycle fields in `details`. */
export const EXCLUDED_BY_KIND: Record<ElementKind, readonly string[]> = {
  object: ["details.maturity", "details.maturity_rationale"],
  assumption: ["details.validation_status", "details.validation_note"],
  risk: ["details.risk_status"],
  constraint: ["details.constraint_status"],
  dependency: ["details.dependency_status"],
  decision: ["details.decision_status", "details.deferred_reason"],
  recommendation: [],
  opportunity: ["details.opportunity_status"],
  review: ["details.review_status", "details.held_at"],
  deliverable: [],
  implementation_initiative: ["details.implementation_status", "details.actual_operational_on"],
};

export function excludedPaths(kind: ElementKind): string[] {
  return [...EXCLUDED_FOR_ALL_KINDS, ...EXCLUDED_BY_KIND[kind]];
}

export const CHANGE_TYPES = [
  "first_publication",
  "substantive_revision",
  "status_publication",
] as const;
export type RevisionChangeType = (typeof CHANGE_TYPES)[number];

export const CHANGE_TYPE_LABELS: Record<RevisionChangeType, string> = {
  first_publication: "First publication",
  substantive_revision: "Substantive revision",
  status_publication: "Status publication",
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/**
 * The reduced snapshot, as the SQL computes it. Used by tests and to explain a
 * classification; the database remains the authority.
 */
export function substantiveSnapshot(
  kind: ElementKind,
  snapshot: Record<string, Json>,
): Record<string, Json> {
  const out: Record<string, Json> = { ...snapshot };
  for (const path of EXCLUDED_FOR_ALL_KINDS) {
    if (!path.includes(".") && !path.includes("[")) delete out[path];
  }
  const details = out.details;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const reduced = { ...details };
    for (const path of EXCLUDED_BY_KIND[kind]) delete reduced[path.slice("details.".length)];
    out.details = reduced;
  }
  const statements = out.statements;
  if (Array.isArray(statements)) {
    out.statements = statements.map((s) => {
      if (!s || typeof s !== "object" || Array.isArray(s)) return s;
      const copy = { ...s };
      delete copy.ai_review_state;
      delete copy.ai_reviewed_by;
      return copy;
    });
  }
  return out;
}
