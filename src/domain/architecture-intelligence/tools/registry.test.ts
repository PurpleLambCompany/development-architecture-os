import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOLS, TOOL_CONTRACT_VERSION, TOOL_FUNCTIONS, providerJsonSchema } from "./registry";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261007000400_ai_context_functions.sql"),
  "utf8",
);

describe("the Tool Contract registry (proposal §12)", () => {
  it("maps every tool to one of the ten database functions, and covers all ten", () => {
    const fromSql = [...migration.matchAll(/create function public\.(ai_context_[a-z_]+)\(/g)].map(
      (m) => m[1],
    );
    expect([...fromSql].sort()).toEqual([...TOOL_FUNCTIONS].sort());
    expect(new Set(Object.values(TOOLS).map((t) => t.fn))).toEqual(new Set(TOOL_FUNCTIONS));
  });

  it("never lets a model name an engagement", () => {
    for (const [name, tool] of Object.entries(TOOLS)) {
      const schema = JSON.stringify(providerJsonSchema(tool.args));
      expect(schema, name).not.toMatch(/engagement|_id"/);
      expect(
        tool.args.safeParse({
          reference_code: "CAP-004",
          state: "published",
          rule_key: "x",
          fingerprint: "f",
          engagement_id: "e",
        }).success,
      ).toBe(false);
    }
  });

  it("emits strict JSON Schema objects", () => {
    for (const tool of Object.values(TOOLS)) {
      const schema = providerJsonSchema(tool.args);
      expect(schema).toMatchObject({ type: "object", additionalProperties: false });
      expect(Object.keys(schema.properties as object).sort()).toEqual(
        [...(schema.required as string[])].sort(),
      );
    }
  });

  it("changes version when any definition changes", () => {
    const definition = JSON.stringify(
      Object.entries(TOOLS).map(([name, t]) => [
        name,
        t.fn,
        t.description,
        t.classes,
        providerJsonSchema(t.args),
      ]),
    );
    const hash = createHash("sha256").update(definition).digest("hex");
    // Update both together: a changed hash without a new TOOL_CONTRACT_VERSION fails here.
    expect({ version: TOOL_CONTRACT_VERSION, hash }).toEqual({
      version: "2",
      hash: "f598d288604964b3862f8ddde7b980338e1ebec7c0e76be33cee3b3d309ad76b",
    });
  });
});
