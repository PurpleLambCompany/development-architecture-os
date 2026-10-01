import type { ProviderSettings } from "../gateway";
import type { Standing } from "../store";
import type { ProcessingMode } from "../types";
import type { DrawerKind } from "./subjects";

/**
 * Whether an interpretation action is offered on a subject, and if not, the
 * governance state a holder sees instead (7B.2 proposal §5.2, §9, §23).
 * Pure: the server gathers the facts and this decides, so every surface
 * shows the same state for the same facts. The Gateway re-runs its own
 * checks on every request; this never grants anything it would refuse.
 */

export type GateFacts = {
  mode: ProcessingMode;
  standing: Standing | null;
  /** The provider and requested model named in the environment, with or without a credential. */
  configured: { providerKey: string; requestedModel: string } | null;
  /** Whether the kind's current prompt lists an evaluated model for `configured`. */
  evaluated: boolean;
  /** The complete provider settings, or null when nothing can be sent. */
  provider: ProviderSettings | null;
  requiredClasses: readonly string[];
  /** The Gateway's pre-send estimate for the kind, or null when unpriced. */
  estimateUsd: number | null;
  monthToDateUsd: number | null;
  rule: { holds: boolean; reason: string | null };
};

export type GateState =
  /** No layer 2 at all: AI off, or the viewer does not hold the capability (IX-18). */
  | { state: "absent" }
  /** A governance state in place of the action. */
  | { state: "unavailable"; text: string; authorizerLink: boolean }
  /** The deterministic rule does not hold here. */
  | { state: "not_offered" }
  | { state: "offered"; reason: string; large: boolean };

const ELIGIBLE_STATUSES = ["proposed", "active"];

export const GATE_COPY = {
  notForEngagement: "Architecture Intelligence is not available for this engagement.",
  notAuthorised: "External processing is not authorised for this engagement.",
  classNotAuthorised: "External processing is not authorised for the data this needs.",
  notEvaluated: "Not yet available: no model has been evaluated for this kind of interpretation.",
  notConfigured: "Not yet available: no external processing provider is configured here.",
  budget: "This engagement's monthly processing budget would be exceeded.",
} as const;

/** Shown to holders when the deterministic rule does not hold, by drawer. */
export const NOT_OFFERED_COPY: Record<DrawerKind, string> = {
  edge: "An explanation is offered for Edge items that are not ambient and arise from a substantive revision or a consequence path.",
  revision:
    "An explanation is offered for substantive revisions that change statements or the summary.",
  trace:
    "An explanation is offered when changing this element reaches other elements through propagating relationships.",
  pair: "Tension is examined only for connected elements with published statements, where the Edge reads both or one was revised after the other.",
  evidence:
    "Bearing is examined only for current links to live elements whose evidence has a recorded summary.",
  review: "Preparation is offered for scheduled or held Reviews that examine at least one element.",
  initiative:
    "Comparison with intent is offered when the initiative implements a published element and has checkpoints or has moved beyond its initial status.",
};

export function composeGate(f: GateFacts): GateState {
  if (f.mode === "off" || !f.standing || !f.standing.canUse) return { state: "absent" };
  const s = f.standing;
  const unavailable = (text: string) => ({
    state: "unavailable" as const,
    text,
    authorizerLink: s.canAuthorize,
  });
  if (f.mode === "synthetic_only" && s.dataOrigin !== "synthetic")
    return { state: "unavailable", text: GATE_COPY.notForEngagement, authorizerLink: false };
  if (
    !ELIGIBLE_STATUSES.includes(s.engagementStatus) ||
    s.authorizationState !== "authorized" ||
    !s.authorizationId
  )
    return unavailable(GATE_COPY.notAuthorised);
  if (!f.requiredClasses.every((c) => s.dataClasses.includes(c)))
    return unavailable(GATE_COPY.classNotAuthorised);
  if (!f.configured) return unavailable(GATE_COPY.notConfigured);
  if (!f.evaluated)
    return { state: "unavailable", text: GATE_COPY.notEvaluated, authorizerLink: false };
  if (!f.provider) return unavailable(GATE_COPY.notConfigured);
  if (s.providerKey !== f.provider.providerKey || s.processingRegion !== f.provider.region)
    return unavailable(GATE_COPY.notAuthorised);
  if (
    f.estimateUsd === null ||
    f.estimateUsd > f.provider.maxRequestUsd ||
    f.monthToDateUsd === null ||
    s.monthlyBudgetUsd === null ||
    f.monthToDateUsd + f.estimateUsd > s.monthlyBudgetUsd
  )
    return unavailable(GATE_COPY.budget);
  if (!f.rule.holds || !f.rule.reason) return { state: "not_offered" };
  return {
    state: "offered",
    reason: f.rule.reason,
    large: f.estimateUsd > f.provider.maxRequestUsd / 2,
  };
}
