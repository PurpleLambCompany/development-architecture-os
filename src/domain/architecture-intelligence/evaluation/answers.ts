import { fake, type FakeStep } from "../adapters/fake";
import type { DataBlock, NormalizedModelRequest, Turn } from "../adapters/types";
import type { InferenceKind } from "../types";

/** The handles issued so far in a request, in order, with their blocks. */
export function issuedBlocks(request: NormalizedModelRequest): DataBlock[] {
  return request.input.flatMap((t: Turn) =>
    t.type === "data" || t.type === "tool_result" ? t.blocks : [],
  );
}

const firstVisible = (request: NormalizedModelRequest, n = 0) =>
  issuedBlocks(request).filter((b) => !b.withheld)[n]?.handle ?? "R1";

/** A valid, cited, clean answer for each kind, built from what was actually issued. */
export function validAnswer(
  kind: InferenceKind,
  request: NormalizedModelRequest,
  overrides: Record<string, unknown> = {},
) {
  const a = firstVisible(request, 0);
  const b = firstVisible(request, 1);
  const payloads: Record<InferenceKind, unknown> = {
    explanation: {
      condition_ref: a,
      connection: `The condition in ${a} reaches the statements of ${b}.`,
    },
    tension: {
      statement_a: `${a}.statements`,
      statement_b: `${b}.statements`,
      nature: "timing",
      what_would_resolve: "Whether the delegated authority precedes the site option deadline.",
    },
    evidence_bearing: {
      apparent_bearing: "The survey appears to bear on site timing only.",
      consistent_with_recorded_stance: "unclear",
    },
    review_brief: {
      points: [{ about: a, why: "A revision since capture changed its summary.", cites: [a] }],
    },
    realization_reading: {
      readings: [
        {
          intent_ref: a,
          observation: "Checkpoints are recorded as in progress.",
          reading: "not_enough_recorded",
        },
      ],
    },
  };
  return {
    assertion: "The recorded statements bear on each other as cited.",
    claims: [{ text: "The subject's statement is connected to the cited record.", cites: [a] }],
    uncertainty: "Not recorded: the timing of the decision.",
    examination: [`Examine ${a}`],
    payload: payloads[kind],
    ...overrides,
  };
}

/** An interpretation in the version 2 output shape (ADR-0071). */
export const interpretation = (envelope: unknown) => ({
  result: "interpretation",
  interpretation: envelope,
  reason: null,
});

/** "Nothing to add" in the version 2 output shape (IX-15). */
export const nothingToAdd = (reason: string) => ({
  result: "nothing_to_add",
  interpretation: null,
  reason,
});

export const answer =
  (
    kind: InferenceKind,
    overrides: Record<string, unknown> = {},
    resolvedModel?: string,
  ): FakeStep =>
  (request) =>
    fake.output(interpretation(validAnswer(kind, request, overrides)), resolvedModel);

export const silence =
  (
    reason = "The recorded summary says too little to read a bearing from.",
    resolvedModel?: string,
  ): FakeStep =>
  () =>
    fake.output(nothingToAdd(reason), resolvedModel);
