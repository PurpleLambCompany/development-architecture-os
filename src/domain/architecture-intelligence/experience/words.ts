import type { RequestOutcome } from "../types";

/**
 * The words of the intelligence experience (7B.2 proposal §21, §23, §24).
 * Every state reads as a calm sentence in the interpretation layer, never as
 * an error banner, and no copy here names a currency, a budget figure, a
 * person's usage or a ranking.
 */

export const LAYER_LABELS = {
  knows: "What DSA knows",
  interpretation: "Interpretation · suggested",
  judgment: "Judgment",
} as const;

/** What a holder sees in place of an interpretation when a request ends without one. */
export const FAILURE_COPY: Partial<Record<RequestOutcome, { text: string; retry: boolean }>> = {
  refused_mode: {
    text: "Architecture Intelligence is not available for this engagement.",
    retry: false,
  },
  refused_capability: {
    text: "Processing stopped: the engagement's authorisation changed. Nothing was recorded.",
    retry: false,
  },
  refused_authorization: {
    text: "External processing is not authorised for this engagement.",
    retry: false,
  },
  refused_class: {
    text: "External processing is not authorised for the data this needs.",
    retry: false,
  },
  refused_budget: {
    text: "This engagement's monthly processing budget would be exceeded.",
    retry: false,
  },
  subject_not_found: { text: "This record is no longer available.", retry: false },
  provider_error: {
    text: "The external processing provider did not respond. Nothing was recorded.",
    retry: true,
  },
  refusal: {
    text: "The interpretation did not meet DSA's requirements and was discarded.",
    retry: true,
  },
  invalid_output: {
    text: "The interpretation did not meet DSA's requirements and was discarded.",
    retry: true,
  },
  unknown_citation: {
    text: "The interpretation did not meet DSA's requirements and was discarded.",
    retry: true,
  },
  model_not_evaluated: {
    text: "The provider returned a model that has not been evaluated. Nothing was shown or recorded.",
    retry: false,
  },
  authorization_withdrawn: {
    text: "Processing stopped: the engagement's authorisation changed. Nothing was recorded.",
    retry: false,
  },
};

export const NOTHING_TO_ADD_TEXT = "DSA's records do not support an interpretation of this.";
export const NOTHING_TO_ADD_REASON_LABEL = "Reason given by the model (not recorded)";

export const LARGE_REQUEST_CONFIRM = "This is a larger request than usual. Continue?";

/** Stale reasons from architecture_inference_state, in plain words. */
export const STALE_PHRASES: Record<string, string> = {
  basis_removed: "A record it read was retired or removed",
  edge_item_changed: "The Edge item changed",
  newer_version_published: "A newer version of an element it read was published",
  basis_changed: "A record it read changed",
  class_no_longer_authorised: "A kind of data it used is no longer authorised",
};

export function stalePhrase(reason: string): string {
  return STALE_PHRASES[reason] ?? "A record it read changed";
}

export const INFERENCE_STATE_LABELS: Record<string, string> = {
  current: "Current",
  stale: "Stale",
  superseded: "Superseded by a newer kept interpretation",
};

export const JUDGMENT_LABELS: Record<string, string> = {
  investigating: "Investigating",
  not_material: "Not material",
  deferred: "Deferred",
  disagree: "Disagree",
  promoted: "Promoted",
};

/** Suppression wording (IX-14), by the judgment that suppresses. */
export function suppressionLine(kind: string, judgedOn: string): string {
  // Suppression is engagement-wide (PD-14): the line names the judgment, not
  // the viewer; who judged is shown with the judgment below.
  const what =
    kind === "disagree"
      ? "An architect disagreed with this interpretation"
      : "This interpretation was judged not material";
  return `${what} on ${judgedOn}. It is not offered again until the records it read change.`;
}

export const REALIZATION_READINGS: Record<string, string> = {
  appears_to_correspond: "Appears to correspond to the intent",
  appears_to_diverge: "Appears to diverge from the intent",
  not_enough_recorded: "Not enough is recorded to say",
};

export const BEARING_CONSISTENCY: Record<string, string> = {
  yes: "Yes",
  unclear: "Unclear",
  no: "No",
};

export const KIND_NOUNS: Record<string, string> = {
  explanation: "Explanation of significance",
  tension: "Examined tension",
  evidence_bearing: "Examined bearing",
  realization_reading: "Comparison with intent",
  review_brief: "Review preparation",
};

export const EVIDENCE_LIMIT_NOTE =
  "Read from the recorded summary and metadata only; the evidence file is not read.";

export const SUGGESTED_DESCRIPTION =
  "Interpretations kept by architects on this engagement. Suggested, not established by DSA's rules.";
