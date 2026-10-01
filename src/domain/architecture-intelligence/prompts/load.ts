import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { InferenceKind } from "../types";
import { GENERATION_POLICY, currentPrompt, type PromptVersion } from "./manifest";

export const PROMPTS_DIR = join(process.cwd(), "src/domain/architecture-intelligence/prompts");

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function readPinned(file: string, contentHash: string): string {
  const text = readFileSync(join(PROMPTS_DIR, file), "utf8");
  // Fail closed: a prompt that does not match its pinned hash is never sent.
  if (sha256(text) !== contentHash)
    throw new Error(`Prompt file ${file} does not match its manifest hash`);
  return text;
}

export type ResolvedPrompt = {
  prompt: PromptVersion;
  policyVersion: string;
  /** Generation policy then the kind's prompt: the exact instructions sent. */
  instructions: string;
  /** SHA-256 of the exact instructions sent. */
  contentHash: string;
};

export function resolvePrompt(kind: InferenceKind): ResolvedPrompt {
  const prompt = currentPrompt(kind);
  const policy = readPinned(GENERATION_POLICY.file, GENERATION_POLICY.contentHash);
  const text = readPinned(prompt.file, prompt.contentHash);
  const instructions = `${policy}\n\n${text}`;
  return {
    prompt,
    policyVersion: GENERATION_POLICY.version,
    instructions,
    contentHash: sha256(instructions),
  };
}
