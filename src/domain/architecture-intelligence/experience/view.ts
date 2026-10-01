import type { InferenceKind } from "../types";
import type { InterpretResult } from "./actions";
import type { InferenceDetail } from "./queries";

/**
 * One shape for an interpretation on screen, whether it was just returned
 * (ephemeral, held for keeping) or read back as a kept inference. Text is
 * exactly the validated output; citations are labels (codes and versions).
 */
export type InterpretationView = {
  kind: InferenceKind;
  assertion: string;
  claims: { text: string; cites: string[] }[];
  uncertainty: string;
  examination: string[];
  payload: Record<string, unknown>;
  citations: Record<string, { label: string; elementId: string | null; withheld: boolean }>;
  provenance: {
    providerKey: string;
    requestedModel: string;
    resolvedModel: string;
    promptVersion: string;
    generationPolicyVersion: string;
    toolContractVersion: string;
    requestedAt: string;
    keptAt: string | null;
    requestedByName: string | null;
  };
};

export function viewFromDetail(d: InferenceDetail): InterpretationView {
  return {
    kind: d.inference_kind,
    assertion: d.assertion,
    claims: d.claims,
    uncertainty: d.uncertainty,
    examination: d.examination ?? [],
    payload: d.payload ?? {},
    citations: Object.fromEntries(
      Object.entries(d.citations ?? {}).map(([h, c]) => [
        h,
        { label: c.label, elementId: c.element_id ?? null, withheld: false },
      ]),
    ),
    provenance: {
      providerKey: d.provenance.provider_key,
      requestedModel: d.provenance.requested_model,
      resolvedModel: d.provenance.resolved_model,
      promptVersion: d.provenance.prompt_version,
      generationPolicyVersion: d.provenance.generation_policy_version,
      toolContractVersion: d.provenance.tool_contract_version,
      requestedAt: d.provenance.requested_at,
      keptAt: d.provenance.kept_at,
      requestedByName: d.provenance.requested_by_name,
    },
  };
}

export function viewFromResult(kind: InferenceKind, r: InterpretResult): InterpretationView | null {
  if (!r.output || !r.provenance) return null;
  const o = r.output;
  return {
    kind,
    assertion: o.assertion,
    claims: o.claims,
    uncertainty: o.uncertainty,
    examination: o.examination,
    payload: o.payload as Record<string, unknown>,
    citations: Object.fromEntries(
      Object.entries(r.citations ?? {}).map(([h, c]) => [
        h,
        { label: c.label, elementId: c.elementId ?? null, withheld: c.withheld ?? false },
      ]),
    ),
    provenance: { ...r.provenance, keptAt: null, requestedByName: null },
  };
}

/** A handle's label: `R3` or a part of it, `R3.statements`. */
export function citationLabel(view: InterpretationView, handle: string): string {
  const [base, part] = handle.split(".");
  const c = view.citations[base ?? handle];
  const label = c?.label ?? handle;
  return part ? `${label}, ${part.replaceAll("_", " ")}` : label;
}

export function citationElement(view: InterpretationView, handle: string): string | null {
  return view.citations[handle.split(".")[0] ?? handle]?.elementId ?? null;
}
