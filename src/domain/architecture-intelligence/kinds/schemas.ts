import { z } from "zod";
import type { InferenceKind } from "../types";

/**
 * Output schemas for the five inference kinds (proposal §13, §14, ADR-0064).
 * Strict objects: a field for significance, severity, priority, rank, score
 * or confidence cannot be returned, because no such field exists. Handles
 * (R1, R2, or R1.statements for part of a record) refer only to data issued
 * in the invocation; the Gateway checks that after parsing.
 */

export const OUTPUT_SCHEMA_VERSION = "1";

export const handle = z.string().regex(/^R[0-9]{1,3}(\.[a-z_]{1,40})?$/);

const claim = z.strictObject({
  text: z.string().min(1).max(400),
  cites: z.array(handle).min(1).max(8),
});

function envelope<P extends z.ZodType>(payload: P) {
  return z.strictObject({
    assertion: z.string().min(1).max(600),
    claims: z.array(claim).min(1).max(8),
    uncertainty: z.string().max(600),
    examination: z.array(z.string().min(1).max(200)).max(6),
    payload,
  });
}

const reading = z.enum(["appears_to_correspond", "appears_to_diverge", "not_enough_recorded"]);

export const KIND_SCHEMAS = {
  explanation: envelope(
    z.strictObject({ condition_ref: handle, connection: z.string().min(1).max(600) }),
  ),
  tension: envelope(
    z
      .strictObject({
        statement_a: handle,
        statement_b: handle,
        nature: z.string().min(1).max(120),
        what_would_resolve: z.string().min(1).max(400),
      })
      .refine((p) => p.statement_a !== p.statement_b, "The two statements must differ"),
  ),
  evidence_bearing: envelope(
    z.strictObject({
      apparent_bearing: z.string().min(1).max(400),
      consistent_with_recorded_stance: z.enum(["yes", "unclear", "no"]),
    }),
  ),
  review_brief: envelope(
    z.strictObject({
      points: z
        .array(
          z.strictObject({
            about: handle,
            why: z.string().min(1).max(300),
            cites: z.array(handle).min(1).max(8),
          }),
        )
        .min(1)
        .max(8),
    }),
  ),
  realization_reading: envelope(
    z.strictObject({
      readings: z
        .array(
          z.strictObject({ intent_ref: handle, observation: z.string().min(1).max(300), reading }),
        )
        .min(1)
        .max(8),
    }),
  ),
} as const satisfies Record<InferenceKind, z.ZodType>;

export type KindOutput<K extends InferenceKind> = z.output<(typeof KIND_SCHEMAS)[K]>;
export type AnyKindOutput = KindOutput<InferenceKind>;

/** Every handle an output refers to: claim citations and the payload's handle fields. */
export function referencedHandles(kind: InferenceKind, output: AnyKindOutput): string[] {
  const handles = output.claims.flatMap((c) => c.cites);
  const p = output.payload as Record<string, unknown>;
  switch (kind) {
    case "explanation":
      handles.push(p.condition_ref as string);
      break;
    case "tension":
      handles.push(p.statement_a as string, p.statement_b as string);
      break;
    case "review_brief":
      for (const point of p.points as { about: string; cites: string[] }[]) {
        handles.push(point.about, ...point.cites);
      }
      break;
    case "realization_reading":
      for (const r of p.readings as { intent_ref: string }[]) handles.push(r.intent_ref);
      break;
    case "evidence_bearing":
      break;
  }
  return handles;
}

/** All model-written text in an output, for the forbidden-vocabulary check. */
export function outputText(output: AnyKindOutput): string {
  const strings: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") strings.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") Object.values(node).forEach(walk);
  };
  walk({
    assertion: output.assertion,
    claims: output.claims.map((c) => c.text),
    uncertainty: output.uncertainty,
    examination: output.examination,
    payload: output.payload,
  });
  return strings.join("\n");
}
