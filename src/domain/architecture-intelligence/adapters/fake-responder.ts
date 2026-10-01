import { FAKE_MODEL, FAKE_PROVIDER_KEY } from "./fake";
import type {
  DataBlock,
  ModelAdapter,
  NormalizedModelRequest,
  NormalizedModelResponse,
  Turn,
  Usage,
} from "./types";

/**
 * The deterministic fake responder (ADR-0073, PD-2). Step A acceptance runs
 * the application against it in a non-production server: it answers every
 * kind from the handles actually issued, with schema-valid, cited output
 * that says plainly it came from the test provider. It never touches a
 * network and needs no credential. Reached only through server.ts, and only
 * when fakeProviderConfig() allows it.
 *
 * A scenario (ARCHITECTURE_INTELLIGENCE_FAKE_SCENARIO) lets acceptance show
 * each state: `interpretation` (the default), `nothing_to_add`,
 * `invalid_output`, `refusal` and `provider_error`. The resolved model
 * (ARCHITECTURE_INTELLIGENCE_FAKE_RESOLVED_MODEL) lets it show a change of
 * resolved model behind an unchanged requested model.
 */

export const FAKE_SCENARIOS = [
  "interpretation",
  "nothing_to_add",
  "invalid_output",
  "refusal",
  "provider_error",
] as const;
export type FakeScenario = (typeof FAKE_SCENARIOS)[number];

const usage: Usage = { inputTokens: 1200, outputTokens: 300, reasoningTokens: 0 };

const MARK = "Test interpretation from the deterministic fake provider.";

function blocks(request: NormalizedModelRequest): DataBlock[] {
  return request.input
    .flatMap((t: Turn) => (t.type === "data" || t.type === "tool_result" ? t.blocks : []))
    .filter((b) => !b.withheld);
}

function code(block: DataBlock | undefined): string {
  const c = (block?.content ?? {}) as Record<string, unknown>;
  const v =
    c.reference_code ?? c.subject_reference_code ?? c.reached_reference_code ?? c.review ?? null;
  return typeof v === "string" ? v : (block?.handle ?? "the record");
}

function kindOf(request: NormalizedModelRequest): string {
  return request.outputSchema.name.replace(/^dsa_/, "").replace(/_v[0-9]+$/, "");
}

function envelope(kind: string, request: NormalizedModelRequest): unknown {
  const issued = blocks(request);
  const first = issued[0];
  const a = first?.handle ?? "R1";
  const elements = issued.filter(
    (b) => b.record_type === "element_version" || b.record_type === "element_working",
  );
  const claims = [
    {
      text: `${MARK} It reads ${code(first)} as recorded and cites it.`,
      cites: [a],
    },
  ];
  const base = {
    assertion: `${MARK} The records cited bear on ${code(first)} as described in the claims.`,
    claims,
    uncertainty: "Not recorded: anything outside the records provided.",
    examination: [`Examine ${code(first)}`],
  };
  switch (kind) {
    case "explanation":
      return {
        ...base,
        payload: {
          condition_ref: a,
          connection: `${MARK} The condition in ${code(first)} connects to the statements cited.`,
        },
      };
    case "tension": {
      const x = elements[0]?.handle ?? a;
      const y = elements[1]?.handle ?? issued[1]?.handle ?? "R2";
      return {
        ...base,
        claims: [{ text: `${MARK} The two statements are read side by side.`, cites: [x, y] }],
        payload: {
          statement_a: `${x}.statements`,
          statement_b: `${y}.statements`,
          nature: "timing (test)",
          what_would_resolve: `${MARK} Whether the later revision was meant to change the earlier statement.`,
        },
      };
    }
    case "evidence_bearing": {
      const link = issued.find((b) => b.record_type === "evidence_link") ?? first;
      return {
        ...base,
        claims: [
          {
            text: `${MARK} The recorded summary is read against the statement.`,
            cites: [link?.handle ?? a],
          },
        ],
        payload: {
          apparent_bearing: `${MARK} The summary appears to bear on the statement's timing only.`,
          consistent_with_recorded_stance: "unclear",
        },
      };
    }
    case "review_brief": {
      const about = issued.slice(0, 8);
      return {
        ...base,
        payload: {
          points: (about.length > 0 ? about : [{ handle: a } as DataBlock]).map((b) => ({
            about: b.handle,
            why: `${MARK} ${code(b)} is part of what this Review examines or has changed since.`,
            cites: [b.handle],
          })),
        },
      };
    }
    case "realization_reading": {
      const intents = issued.filter((b) => b.record_type === "relationship").slice(0, 8);
      return {
        ...base,
        payload: {
          readings: (intents.length > 0 ? intents : [first ?? ({ handle: a } as DataBlock)]).map(
            (b) => ({
              intent_ref: b.handle,
              observation: `${MARK} Checkpoints and status are recorded as shown.`,
              reading: "not_enough_recorded",
            }),
          ),
        },
      };
    }
    default:
      return base;
  }
}

/** For Prepare, the first turn asks for evidence and implementation state (PD-13b). */
function reviewToolCalls(
  request: NormalizedModelRequest,
): Extract<NormalizedModelResponse, { kind: "tool_calls" }> | null {
  const capture = blocks(request).find((b) => b.record_type === "review_capture");
  const examined = ((capture?.content as { examined?: { reference_code: string; kind: string }[] })
    ?.examined ?? []) as { reference_code: string; kind: string }[];
  const calls: { name: string; arguments: unknown }[] = [];
  const element = examined.find((e) => e.kind !== "implementation_initiative");
  const initiative = examined.find((e) => e.kind === "implementation_initiative");
  if (element)
    calls.push({ name: "get_evidence", arguments: { reference_code: element.reference_code } });
  if (initiative)
    calls.push({
      name: "get_implementation_state",
      arguments: { reference_code: initiative.reference_code },
    });
  if (calls.length === 0) return null;
  return {
    kind: "tool_calls",
    calls: calls.map((c, i) => ({
      callId: `fake_call_${i}`,
      name: c.name,
      arguments: JSON.stringify(c.arguments),
    })),
    usage,
    resolvedModel: FAKE_MODEL,
    providerRequestId: "fake-responder",
  };
}

export class DeterministicFakeAdapter implements ModelAdapter {
  readonly providerKey = FAKE_PROVIDER_KEY;
  constructor(
    private readonly scenario: FakeScenario = "interpretation",
    private readonly resolvedModel: string = FAKE_MODEL,
  ) {}

  async invoke(request: NormalizedModelRequest): Promise<NormalizedModelResponse> {
    const kind = kindOf(request);
    const meta = { usage, resolvedModel: this.resolvedModel, providerRequestId: "fake-responder" };
    switch (this.scenario) {
      case "provider_error":
        return { kind: "error", errorClass: "timeout", retryable: true };
      case "refusal":
        return { kind: "refusal", ...meta };
      case "invalid_output":
        return {
          kind: "output",
          json: { result: "interpretation", interpretation: {}, reason: null },
          ...meta,
        };
      case "nothing_to_add":
        return {
          kind: "output",
          json: {
            result: "nothing_to_add",
            interpretation: null,
            reason:
              "Test answer from the deterministic fake provider: the records provided say too little to interpret.",
          },
          ...meta,
        };
      default: {
        const asked = request.input.some((t) => t.type === "tool_call");
        if (kind === "review_brief" && !asked) {
          const calls = reviewToolCalls(request);
          if (calls?.kind === "tool_calls") return { ...calls, resolvedModel: this.resolvedModel };
        }
        return {
          kind: "output",
          json: { result: "interpretation", interpretation: envelope(kind, request), reason: null },
          ...meta,
        };
      }
    }
  }
}

export function fakeScenario(env: Record<string, string | undefined> = process.env): FakeScenario {
  const s = env.ARCHITECTURE_INTELLIGENCE_FAKE_SCENARIO;
  return (FAKE_SCENARIOS as readonly string[]).includes(s ?? "")
    ? (s as FakeScenario)
    : "interpretation";
}

export function fakeResolvedModel(env: Record<string, string | undefined> = process.env): string {
  const m = env.ARCHITECTURE_INTELLIGENCE_FAKE_RESOLVED_MODEL;
  return m && /^dsa-fake-model-[0-9]$/.test(m) ? m : FAKE_MODEL;
}
