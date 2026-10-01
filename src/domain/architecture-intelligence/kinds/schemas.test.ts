import { describe, expect, it } from "vitest";
import { INFERENCE_KINDS } from "../types";
import {
  KIND_SCHEMAS,
  NOTHING_TO_ADD_REASON_MAX,
  OUTPUT_SCHEMAS,
  referencedHandles,
} from "./schemas";

const base = {
  assertion: "A.",
  claims: [{ text: "C.", cites: ["R1"] }],
  uncertainty: "",
  examination: [],
};
const payloads = {
  explanation: { condition_ref: "R1", connection: "x" },
  tension: {
    statement_a: "R1.statements",
    statement_b: "R2.statements",
    nature: "timing",
    what_would_resolve: "x",
  },
  evidence_bearing: { apparent_bearing: "x", consistent_with_recorded_stance: "unclear" },
  review_brief: { points: [{ about: "R1", why: "x", cites: ["R1"] }] },
  realization_reading: {
    readings: [{ intent_ref: "R1", observation: "x", reading: "appears_to_diverge" }],
  },
} as const;

describe("inference kind schemas (proposal §13, §14)", () => {
  it.each(INFERENCE_KINDS)("%s accepts its defined shape", (kind) => {
    expect(KIND_SCHEMAS[kind].safeParse({ ...base, payload: payloads[kind] }).success).toBe(true);
  });

  it.each(INFERENCE_KINDS)(
    "%s rejects significance, score, rank, confidence and priority",
    (kind) => {
      for (const field of ["significance", "severity", "score", "rank", "confidence", "priority"]) {
        expect(
          KIND_SCHEMAS[kind].safeParse({ ...base, [field]: 1, payload: payloads[kind] }).success,
          field,
        ).toBe(false);
        expect(
          KIND_SCHEMAS[kind].safeParse({ ...base, payload: { ...payloads[kind], [field]: 1 } })
            .success,
          field,
        ).toBe(false);
      }
    },
  );

  it("requires every claim to cite", () => {
    expect(
      KIND_SCHEMAS.explanation.safeParse({
        ...base,
        claims: [{ text: "C.", cites: [] }],
        payload: payloads.explanation,
      }).success,
    ).toBe(false);
    expect(
      KIND_SCHEMAS.explanation.safeParse({ ...base, claims: [], payload: payloads.explanation })
        .success,
    ).toBe(false);
  });

  it("requires a tension's two statements to differ", () => {
    expect(
      KIND_SCHEMAS.tension.safeParse({
        ...base,
        payload: { ...payloads.tension, statement_b: "R1.statements" },
      }).success,
    ).toBe(false);
  });

  it("collects every handle an output refers to", () => {
    const out = KIND_SCHEMAS.review_brief.parse({
      ...base,
      payload: { points: [{ about: "R2", why: "x", cites: ["R3"] }] },
    });
    expect(referencedHandles("review_brief", out).sort()).toEqual(["R1", "R2", "R3"]);
  });
});

describe("version 2 outputs: interpretation or nothing to add (ADR-0071, PD-8)", () => {
  const envelope = (kind: (typeof INFERENCE_KINDS)[number]) => ({
    ...base,
    payload: payloads[kind],
  });
  it.each(INFERENCE_KINDS)("%s accepts exactly one of interpretation and reason", (kind) => {
    const s = OUTPUT_SCHEMAS[kind];
    expect(
      s.safeParse({ result: "interpretation", interpretation: envelope(kind), reason: null })
        .success,
    ).toBe(true);
    expect(
      s.safeParse({
        result: "nothing_to_add",
        interpretation: null,
        reason: "Nothing beyond the facts.",
      }).success,
    ).toBe(true);
    expect(
      s.safeParse({ result: "interpretation", interpretation: envelope(kind), reason: "x" })
        .success,
    ).toBe(false);
    expect(
      s.safeParse({ result: "interpretation", interpretation: null, reason: null }).success,
    ).toBe(false);
    expect(
      s.safeParse({ result: "nothing_to_add", interpretation: envelope(kind), reason: "x" })
        .success,
    ).toBe(false);
    expect(
      s.safeParse({ result: "nothing_to_add", interpretation: null, reason: null }).success,
    ).toBe(false);
    expect(
      s.safeParse({ result: "nothing_to_add", interpretation: null, reason: "" }).success,
    ).toBe(false);
    expect(
      s.safeParse({
        result: "nothing_to_add",
        interpretation: null,
        reason: "x".repeat(NOTHING_TO_ADD_REASON_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      s.safeParse({ result: "nothing_to_add", interpretation: null, reason: "x", score: 1 })
        .success,
    ).toBe(false);
  });
});
