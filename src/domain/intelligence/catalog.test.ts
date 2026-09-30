import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  ALLOWED_FILE_TYPES,
  ATTENTION_LEVELS,
  CATEGORIZED_KINDS,
  CLIENT_ACTION_KINDS,
  INTELLIGENCE_CATEGORIES,
  MAX_FILE_BYTES,
  RESOLVABLE_KINDS,
  RESOLUTION_VERBS,
  SIGNAL_RULES,
  TERMINAL_STATUSES,
  categoryLabel,
  isTerminalStatus,
  recordStatus,
} from "./catalog";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261002000100_project_intelligence.sql"),
  "utf8",
);

/** The body of a function in the migration. */
function functionBody(name: string): string {
  const start = migration.indexOf(`function ${name}(`);
  return migration.slice(start, migration.indexOf("$$;", start));
}

/** The per-kind arrays of intelligence_terminal_statuses / intelligence_active_statuses. */
function statusesByKind(name: string): Record<string, string[]> {
  const body = functionBody(name);
  return Object.fromEntries(
    [...body.matchAll(/when '(\w+)' then array\[([^\]]*)\]/g)].map(([, kind, list]) => [
      kind,
      [...list!.matchAll(/'(\w+)'/g)].map((m) => m[1]),
    ]),
  );
}

describe("the Project Intelligence vocabulary matches the migration", () => {
  it("has the same categories, in order, for each kind", () => {
    const start = migration.indexOf("insert into public.intelligence_categories (");
    const block = migration.slice(start, migration.indexOf(";\n", start));
    const rows = [...block.matchAll(/\('(\w+)', '(\w+)', '((?:[^']|'')*)', '((?:[^']|'')*)'/g)];
    const fromSql: Record<string, string[][]> = {};
    for (const [, kind, key, label, definition] of rows) {
      (fromSql[kind!] ??= []).push([key!, label!, definition!.replaceAll("''", "'")]);
    }
    expect(Object.keys(fromSql).sort()).toEqual([...CATEGORIZED_KINDS].sort());
    for (const kind of CATEGORIZED_KINDS) {
      expect(INTELLIGENCE_CATEGORIES[kind].map((c) => [c.key, c.label, c.definition])).toEqual(
        fromSql[kind],
      );
      expect(INTELLIGENCE_CATEGORIES[kind].at(-1)?.key).toBe("other");
    }
  });

  it("has the same active and terminal statuses", () => {
    expect(statusesByKind("public.intelligence_active_statuses")).toEqual(ACTIVE_STATUSES);
    expect(statusesByKind("public.intelligence_terminal_statuses")).toEqual(TERMINAL_STATUSES);
  });

  it("has the same attention levels and client action kinds", () => {
    const enumValues = (type: string) => {
      const start = migration.indexOf(`create type public.${type} as enum (`);
      const block = migration.slice(start, migration.indexOf(");", start));
      return [...block.matchAll(/'(\w+)'/g)].map((m) => m[1]);
    };
    expect(enumValues("intelligence_attention")).toEqual([...ATTENTION_LEVELS]);
    expect(enumValues("client_action_kind")).toEqual([...CLIENT_ACTION_KINDS]);
  });

  it("knows every signal rule the database evaluates and dismisses", () => {
    const signals = functionBody("public.intelligence_signals");
    const evaluated = [
      ...new Set(
        [...signals.matchAll(/select '(\w+)'(?:::text as rule_key)?, /g)].map((m) => m[1]),
      ),
    ];
    expect(evaluated.sort()).toEqual([...SIGNAL_RULES].sort());
    const dismiss = functionBody("public.dismiss_intelligence_signal");
    for (const rule of SIGNAL_RULES) expect(dismiss).toContain(`'${rule}'`);
  });

  it("accepts the same files as the bucket and the table", () => {
    expect(migration).toContain(`size_bytes between 1 and ${MAX_FILE_BYTES}`);
    const bucket = migration.slice(migration.indexOf("insert into storage.buckets"));
    for (const type of ALLOWED_FILE_TYPES) expect(bucket).toContain(`'${type}'`);
    expect(bucket).toContain(`${MAX_FILE_BYTES},`);
  });
});

describe("statuses", () => {
  it("label every active and terminal status", () => {
    for (const kind of RESOLVABLE_KINDS) {
      for (const status of [...ACTIVE_STATUSES[kind], ...TERMINAL_STATUSES[kind]]) {
        expect(recordStatus(kind, status)?.label).not.toBe(status);
      }
      for (const status of TERMINAL_STATUSES[kind]) {
        expect(RESOLUTION_VERBS[status], status).toBeTruthy();
        expect(isTerminalStatus(kind, status)).toBe(true);
      }
      for (const status of ACTIVE_STATUSES[kind])
        expect(isTerminalStatus(kind, status)).toBe(false);
    }
  });

  it("never treat decisions or recommendations as resolvable", () => {
    expect(isTerminalStatus("decision", "decided")).toBe(false);
    expect(RESOLVABLE_KINDS).not.toContain("decision");
    expect(RESOLVABLE_KINDS).not.toContain("recommendation");
  });
});

describe("categoryLabel", () => {
  it("labels known keys and falls back to the key", () => {
    expect(categoryLabel("opportunity", "land_and_asset")).toBe("Land and asset");
    expect(categoryLabel("risk", "unknown")).toBe("unknown");
    expect(categoryLabel("constraint", "temporal")).toBe("temporal");
    expect(categoryLabel("risk", null)).toBe("");
  });
});
