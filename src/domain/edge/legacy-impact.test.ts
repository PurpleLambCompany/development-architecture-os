import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The two Phase 4/5 impact functions stay in the database for backward
 * compatibility and are documented as legacy (ADR-0055, OD-8). impact_trace
 * is authoritative: no application code may call the legacy functions.
 */

const SRC = join(__dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("legacy impact functions", () => {
  const files = sourceFiles(SRC).filter((f) => !f.endsWith(join("types", "database.ts")));

  it.each(["intelligence_impact", "implementation_impact"])(
    "no application code calls %s",
    (fn) => {
      const callers = files
        .filter((f) => readFileSync(f, "utf8").includes(`"${fn}"`))
        .map((f) => relative(SRC, f));
      expect(callers).toEqual([]);
    },
  );

  it("the element and initiative pages read impact_trace", () => {
    const pages = [
      "app/(internal)/internal/engagements/[slug]/architecture/elements/[elementId]/page.tsx",
      "app/(internal)/internal/engagements/[slug]/implementation/[initiativeId]/page.tsx",
    ];
    for (const page of pages) {
      const text = readFileSync(join(SRC, page), "utf8");
      expect(text).toContain("getImpactTrace(");
      expect(text).not.toMatch(/\bgetImpact\(/);
    }
  });
});
