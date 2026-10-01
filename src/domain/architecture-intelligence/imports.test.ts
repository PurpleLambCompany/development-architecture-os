import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const moduleDir = join(root, "src/domain/architecture-intelligence");

function files(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const full = join(path, name);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}
const all = files(join(root, "src"));
const imports = (file: string) =>
  [...readFileSync(file, "utf8").matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);

describe("module boundaries (proposal §10.1, §29.2)", () => {
  it("lets only the Gateway's wiring and tests import the provider adapters", () => {
    for (const file of all) {
      const rel = relative(moduleDir, file);
      if (!imports(file).some((i) => /adapters\/(openai|fake)/.test(i))) continue;
      expect(
        [
          "server.ts",
          "evaluation/fixtures.ts",
          "evaluation/answers.ts",
          "evaluation/cases.ts",
        ].includes(rel) || rel.endsWith(".test.ts"),
        rel,
      ).toBe(true);
    }
  });

  it("keeps the Gateway away from server actions and mutation modules", () => {
    for (const file of files(moduleDir).filter((f) => !/\/(actions|queries)\.ts$/.test(f))) {
      for (const i of imports(file)) {
        expect(i, file).not.toMatch(/actions|@\/lib\/supabase\/admin|next\/cache|next\/navigation/);
      }
    }
    // The action module records an authorization only; it never reaches the Gateway or a provider.
    for (const i of imports(join(moduleDir, "actions.ts"))) {
      expect(i).not.toMatch(/^\.\/(gateway|server|adapters|store|tools)/);
    }
    for (const i of imports(join(moduleDir, "queries.ts"))) {
      expect(i).not.toMatch(/^\.\/(gateway|server|adapters|tools)/);
    }
  });

  it("is never imported by a client component, and the entry point is server-only", () => {
    for (const file of all) {
      const text = readFileSync(file, "utf8");
      if (!/^["']use client["']/m.test(text)) continue;
      expect(
        imports(file).some(
          (i) => i.includes("architecture-intelligence/") && !i.endsWith("/types"),
        ),
        file,
      ).toBe(false);
    }
    expect(readFileSync(join(moduleDir, "server.ts"), "utf8")).toMatch(/^import "server-only";/);
  });

  it("is reached from the application only through server.ts or the read-only queries", () => {
    for (const file of all) {
      if (file.startsWith(moduleDir)) continue;
      for (const i of imports(file).filter((x) => x.includes("architecture-intelligence"))) {
        expect(
          [
            "@/domain/architecture-intelligence/queries",
            "@/domain/architecture-intelligence/actions",
            "@/domain/architecture-intelligence/types",
            "@/domain/architecture-intelligence/schemas",
          ],
          `${file}: ${i}`,
        ).toContain(i);
      }
    }
  });
});
