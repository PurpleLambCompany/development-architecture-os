import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INFERENCE_KINDS } from "../types";
import { PROMPTS_DIR, resolvePrompt, sha256 } from "./load";
import { GENERATION_POLICY, PROMPT_MANIFEST } from "./manifest";

const files = [
  GENERATION_POLICY.file,
  ...Object.values(PROMPT_MANIFEST).flatMap((v) => v.map((p) => p.file)),
];
const seed = readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8");

describe("prompt governance (proposal §18, AC-17)", () => {
  it("pins every prompt file to its hash: versions are immutable", () => {
    expect(sha256(readFileSync(join(PROMPTS_DIR, GENERATION_POLICY.file), "utf8"))).toBe(
      GENERATION_POLICY.contentHash,
    );
    for (const versions of Object.values(PROMPT_MANIFEST)) {
      for (const v of versions)
        expect(sha256(readFileSync(join(PROMPTS_DIR, v.file), "utf8")), v.file).toBe(v.contentHash);
    }
  });

  it("has exactly one current version per kind", () => {
    for (const kind of INFERENCE_KINDS) {
      expect(PROMPT_MANIFEST[kind].filter((v) => v.status === "current")).toHaveLength(1);
      expect(resolvePrompt(kind).contentHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("contains no engagement data, reference codes or Method content", () => {
    const names = [...seed.matchAll(/'(Meridian[^']*|Harbor[^']*)'/g)].map((m) =>
      m[1]!.split(/[,:]/)[0]!.trim(),
    );
    for (const file of files) {
      const text = readFileSync(join(PROMPTS_DIR, file), "utf8");
      expect(text, file).not.toMatch(/\b[A-Z]{3}-[0-9]{3}\b/);
      for (const name of ["Meridian", "Harbor", ...names]) expect(text, file).not.toContain(name);
      expect(text, file).not.toMatch(
        /\b(DAM|Development Architecture Method|Method Library|practice count)\b/,
      );
    }
  });

  it("lists no evaluated real-provider model without a committed report", () => {
    for (const versions of Object.values(PROMPT_MANIFEST))
      for (const v of versions)
        for (const m of v.evaluatedModels)
          expect(() => readFileSync(join(process.cwd(), m.report))).not.toThrow();
  });
});
