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
 * refused (OD-8: every model change is material). It is empty: no real
 * provider has been evaluated yet, so every real-provider output is refused
 * as model_not_evaluated until a reviewed pull request adds one (Step B,
 * ADR-0073).
 *
 * 7B.2 (PD-19): every version 1 prompt is retired in favour of version 2,
 * which adds the nothing-to-add answer (output schema version 2). Version 1
 * was never evaluated on a real model; its files stay as pinned history.
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

/**
 * The generation policy in force. Version 1 (7B.1) is retired with the
 * version 1 prompts (PD-19); its file stays, pinned below, as history.
 */
export const GENERATION_POLICY = {
  version: "v2",
  file: "generation-policy/v2.md",
  contentHash: "a283d9bb80c4e9ce4b22a9f175eabe737b0054f4f6483fb1f5b9dc2f0a1a7e05",
} as const;

export const RETIRED_GENERATION_POLICIES = [
  {
    version: "v1",
    file: "generation-policy/v1.md",
    contentHash: "e2ea9c5beb70c5b869ccb05c2e1e3101b0b564d97d63c7e635020d661df65adb",
  },
] as const;

export const PROMPT_MANIFEST: Record<InferenceKind, readonly PromptVersion[]> = {
  explanation: [
    {
      promptVersion: "v1",
      file: "explanation/v1.md",
      contentHash: "0681321abaf793191508f9acd6ded8ec69cbb6b2ed8e2b08bbb5310ec216522b",
      outputSchemaVersion: "1",
      status: "retired",
      evaluatedModels: [],
    },
    {
      promptVersion: "v2",
      file: "explanation/v2.md",
      contentHash: "b1db6026407791d40343081c947f8365ae032ebe92189a98993d04cfe55eca16",
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
      outputSchemaVersion: "1",
      status: "retired",
      evaluatedModels: [],
    },
    {
      promptVersion: "v2",
      file: "tension/v2.md",
      contentHash: "0d479a09400940a954bb580aceaca27cc59e54af53a22fc420e98e8577349308",
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
      outputSchemaVersion: "1",
      status: "retired",
      evaluatedModels: [],
    },
    {
      promptVersion: "v2",
      file: "evidence_bearing/v2.md",
      contentHash: "7242c2a95abf11de6569b64b0e0ac670cbb9234818e490d86bb43bb7838a6035",
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
      outputSchemaVersion: "1",
      status: "retired",
      evaluatedModels: [],
    },
    {
      promptVersion: "v2",
      file: "review_brief/v2.md",
      contentHash: "21a6c15588b40439abee2cb3d0b0d2339b9ea87667c9831852cc4bb23fe13a5f",
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
      outputSchemaVersion: "1",
      status: "retired",
      evaluatedModels: [],
    },
    {
      promptVersion: "v2",
      file: "realization_reading/v2.md",
      contentHash: "40ff577c535a0499186cc24fa6db404bb9ae85db24f116b8cb8c7fdf6b607e0c",
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
