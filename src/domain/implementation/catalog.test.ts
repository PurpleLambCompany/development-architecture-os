import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IMPLEMENTATION_CATEGORIES,
  IMPLEMENTATION_CHECKPOINT_TYPES,
  IMPLEMENTATION_SIGNAL_RULES,
  IMPLEMENTATION_STATUSES,
  NON_TERMINAL_STATUSES,
  TERMINAL_STATUSES,
  categoryLabel,
  isTerminalStatus,
} from "./catalog";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261003000100_reviews_deliverables_implementation.sql"),
  "utf8",
);
const enums = readFileSync(
  join(process.cwd(), "supabase/migrations/20261003000000_phase5_enums.sql"),
  "utf8",
);

function enumValues(file: string, type: string): string[] {
  const start = file.indexOf(`create type public.${type} as enum (`);
  const block = file.slice(start, file.indexOf(");", start));
  return [...block.matchAll(/'(\w+)'/g)].map((m) => m[1] as string);
}

describe("the Implementation vocabulary matches the migration", () => {
  it("has the same categories, in order, ending with other", () => {
    const start = migration.indexOf("insert into public.implementation_categories (");
    const block = migration.slice(start, migration.indexOf(";\n", start));
    const rows = [...block.matchAll(/\('(\w+)', '((?:[^']|'')*)', '((?:[^']|'')*)', \d+\)/g)];
    const fromSql = rows.map(([, key, label, definition]) => [
      key,
      label,
      definition!.replaceAll("''", "'"),
    ]);
    expect(IMPLEMENTATION_CATEGORIES.map((c) => [c.key, c.label, c.definition])).toEqual(fromSql);
    expect(IMPLEMENTATION_CATEGORIES.at(-1)?.key).toBe("other");
  });

  it("has the same implementation_status values", () => {
    expect(enumValues(enums, "implementation_status")).toEqual([...IMPLEMENTATION_STATUSES]);
  });

  it("has the same implementation_checkpoint_type values", () => {
    expect(enumValues(enums, "implementation_checkpoint_type")).toEqual([
      ...IMPLEMENTATION_CHECKPOINT_TYPES,
    ]);
  });

  it("treats only validated and abandoned as terminal, reached only through resolve_implementation_initiative", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(["abandoned", "validated"]);
    expect([...NON_TERMINAL_STATUSES].sort()).toEqual(
      ["in_progress", "not_started", "operational", "stalled"].sort(),
    );
    expect([...TERMINAL_STATUSES, ...NON_TERMINAL_STATUSES].sort()).toEqual(
      [...IMPLEMENTATION_STATUSES].sort(),
    );
    for (const status of TERMINAL_STATUSES) expect(isTerminalStatus(status)).toBe(true);
    for (const status of NON_TERMINAL_STATUSES) expect(isTerminalStatus(status)).toBe(false);
  });

  it("grants direct edits only to the non-terminal statuses (no implementation_status column grant)", () => {
    // The implementation_initiatives direct-edit grant names category/target/owner but not
    // implementation_status: the status column is written only by the operations.
    const line = migration
      .split("\n")
      .find((l) => l.startsWith("grant update") && l.includes("public.implementation_initiatives"));
    expect(line).toBeTruthy();
    expect(line).not.toContain("implementation_status)");
    expect(line).not.toMatch(/\(implementation_status[,)]/);
  });

  it("knows the one signal rule Implementation evaluates and dismisses", () => {
    const signals = migration.slice(
      migration.indexOf("function public.implementation_signals"),
      migration.indexOf("$$;", migration.indexOf("function public.implementation_signals")),
    );
    const evaluated = [
      ...new Set([...signals.matchAll(/select '(\w+)'::text as rule_key/g)].map((m) => m[1])),
    ];
    expect(evaluated.sort()).toEqual([...IMPLEMENTATION_SIGNAL_RULES].sort());
  });
});

describe("categoryLabel", () => {
  it("labels a known key and falls back to the key", () => {
    expect(categoryLabel("team_or_talent")).toBe("Team or talent");
    expect(categoryLabel("unknown")).toBe("unknown");
    expect(categoryLabel(null)).toBe("");
  });
});
