import { OUTPUT_SCHEMAS, outputText, referencedHandles, type AnyKindOutput } from "./kinds/schemas";
import type { InferenceKind } from "./types";

/**
 * Output validation (proposal §10.2 step 9, §13.3). No repair and no retry
 * (OD-9): an output either passes every check or is rejected.
 */

/**
 * Words that assert a governed act, authority, importance or a numeric
 * confidence. A model's reading is never validation, approval, agreement,
 * verification, a priority, a rank or a score. The list is a test fixture.
 */
export const FORBIDDEN_VOCABULARY: readonly RegExp[] = [
  /\bvalidat(e|ed|es|ing|ion)\b/i,
  /\binvalidat(e|ed|es|ing|ion)\b/i,
  /\bapprov(e|ed|es|al)\b/i,
  /\bagreed\b/i,
  /\bverified\b/i,
  /\bconfirmed as (a )?fact\b/i,
  /\bcritical\b/i,
  /\b(top|high|highest|low|lowest) priority\b/i,
  /\bprioriti[sz](e|ed|es|ation)\b/i,
  /\bscor(e|es|ed|ing)\b/i,
  /\brank(s|ed|ing)?\b/i,
  /\bconfidence\b/i,
  /\bprobability\b/i,
  /\b[0-9]{1,3}(\.[0-9]+)?\s?%/,
  /\b(we|i) recommend\b/i,
  /\brecommended method\b/i,
];

export function forbiddenTerm(text: string): string | null {
  for (const pattern of FORBIDDEN_VOCABULARY) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}

export type ValidationResult =
  | { ok: true; output: AnyKindOutput }
  /** The model said, validly, that the records do not support an interpretation (IX-15). */
  | { ok: true; nothingToAdd: string }
  | { ok: false; outcome: "invalid_output" | "unknown_citation"; reason: string };

export function validateOutput(
  kind: InferenceKind,
  json: unknown,
  issuedHandles: ReadonlySet<string>,
): ValidationResult {
  const parsed = OUTPUT_SCHEMAS[kind].safeParse(json);
  if (!parsed.success) return { ok: false, outcome: "invalid_output", reason: "schema" };
  if (parsed.data.result === "nothing_to_add") {
    // Silence is validated too: its reason obeys the same vocabulary rules.
    const reason = parsed.data.reason!;
    const term = forbiddenTerm(reason);
    if (term)
      return { ok: false, outcome: "invalid_output", reason: `vocabulary:${term.toLowerCase()}` };
    return { ok: true, nothingToAdd: reason };
  }
  const output = parsed.data.interpretation as AnyKindOutput;
  for (const h of referencedHandles(kind, output)) {
    if (!issuedHandles.has(h.split(".")[0]!))
      return { ok: false, outcome: "unknown_citation", reason: h };
  }
  const term = forbiddenTerm(outputText(output));
  if (term)
    return { ok: false, outcome: "invalid_output", reason: `vocabulary:${term.toLowerCase()}` };
  return { ok: true, output };
}
