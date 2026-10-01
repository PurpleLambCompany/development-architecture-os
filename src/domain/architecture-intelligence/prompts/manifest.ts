import type { InferenceKind } from "../types";
import { OUTPUT_SCHEMA_VERSION } from "../kinds/schemas";

/**
 * Prompt governance (proposal §18, ADR-0065).
 *
 * Versions are immutable: each entry pins the SHA-256 of its file, and a
 * test recomputes it. Changing a prompt means adding v2, never editing v1.
 * Exactly one version per kind is current; the Gateway uses only that one.
 *
 * evaluatedModels lists the resolved provider model ids each version has
 * been evaluated on, each with its report under
 * docs/evaluation/architecture-intelligence/. Any other resolved model is
 * refused (OD-8: every model change is material). It is empty in 7B.1: no
 * real provider has been evaluated yet, so every real-provider output is
 * refused as model_not_evaluated until a reviewed pull request adds one.
 */

export type EvaluatedModel = { providerKey: string; resolvedModel: string; report: string };

export type PromptVersion = {
  promptVersion: string;
  file: string;
  contentHash: string;
  outputSchemaVersion: string;
  status: "draft" | "current" | "retired";
  evaluatedModels: readonly EvaluatedModel[];
};

export const GENERATION_POLICY = {
  version: "v1",
  file: "generation-policy/v1.md",
  contentHash: "e2ea9c5beb70c5b869ccb05c2e1e3101b0b564d97d63c7e635020d661df65adb",
} as const;

export const PROMPT_MANIFEST: Record<InferenceKind, readonly PromptVersion[]> = {
  explanation: [
    {
      promptVersion: "v1",
      file: "explanation/v1.md",
      contentHash: "0681321abaf793191508f9acd6ded8ec69cbb6b2ed8e2b08bbb5310ec216522b",
      outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
      status: "current",
      evaluatedModels: [],
    },
  ],
  tension: [
    {
      promptVersion: "v1",
      file: "tension/v1.md",
      contentHash: "9e27665553a947bf50e34d74207312ebd4c9dbd65c5b6584cf9605bdabe8075d",
      outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
      status: "current",
      evaluatedModels: [],
    },
  ],
  evidence_bearing: [
    {
      promptVersion: "v1",
      file: "evidence_bearing/v1.md",
      contentHash: "cda6e1c3c92b332033f0d0cba85b49dd50667cc71b5e1de59acb86f6a1a5775a",
      outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
      status: "current",
      evaluatedModels: [],
    },
  ],
  review_brief: [
    {
      promptVersion: "v1",
      file: "review_brief/v1.md",
      contentHash: "05923f98e590dff96bbd0cf8ad2321f61116218649116b78c19f79cdc10d9cd8",
      outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
      status: "current",
      evaluatedModels: [],
    },
  ],
  realization_reading: [
    {
      promptVersion: "v1",
      file: "realization_reading/v1.md",
      contentHash: "ab3da3face35cec1743d692b4d2fea40770f672409839716d43160f2538b1224",
      outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
      status: "current",
      evaluatedModels: [],
    },
  ],
};

export function currentPrompt(kind: InferenceKind): PromptVersion {
  const current = PROMPT_MANIFEST[kind].filter((v) => v.status === "current");
  if (current.length !== 1)
    throw new Error(`Exactly one current prompt version is required for ${kind}`);
  return current[0]!;
}

export function isEvaluatedModel(
  kind: InferenceKind,
  promptVersion: string,
  providerKey: string,
  resolvedModel: string,
): boolean {
  return PROMPT_MANIFEST[kind].some(
    (v) =>
      v.promptVersion === promptVersion &&
      v.evaluatedModels.some(
        (m) => m.providerKey === providerKey && m.resolvedModel === resolvedModel,
      ),
  );
}
