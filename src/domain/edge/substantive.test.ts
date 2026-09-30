import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ELEMENT_KINDS,
  EXCLUDED_BY_KIND,
  EXCLUDED_FOR_ALL_KINDS,
  excludedPaths,
  substantiveSnapshot,
} from "./substantive";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261006000100_substantive_revisions.sql"),
  "utf8",
);

function sqlExclusions(): Record<string, string[]> {
  const start = sql.indexOf("function private.substantive_detail_exclusions(");
  const body = sql.slice(start, sql.indexOf("$$;", start));
  return Object.fromEntries(
    [...body.matchAll(/when '(\w+)' then array\[([^\]]*)\]/g)].map(([, kind, list]) => [
      kind,
      [...list.matchAll(/'(\w+)'/g)].map((m) => `details.${m[1]}`),
    ]),
  );
}

describe("substantive revision", () => {
  it("excludes the same status and lifecycle paths as the database, for every kind", () => {
    const fromSql = sqlExclusions();
    expect(Object.keys(fromSql).sort()).toEqual([...ELEMENT_KINDS].sort());
    for (const kind of ELEMENT_KINDS) expect(EXCLUDED_BY_KIND[kind]).toEqual(fromSql[kind]);
    for (const path of EXCLUDED_FOR_ALL_KINDS) expect(sql).toContain(`'${path}'`);
  });

  it("keeps maturity out of the diff (OD-1) and every content field in it", () => {
    expect(excludedPaths("object")).toContain("details.maturity");
    for (const kind of ELEMENT_KINDS) {
      for (const content of ["title", "summary", "statements", "details.category"]) {
        expect(excludedPaths(kind)).not.toContain(content);
      }
    }
  });

  it("never parses change_summary (Q30)", () => {
    expect(sql).not.toMatch(/change_summary\s*(~|like|ilike|similar)/i);
    expect(sql).not.toMatch(/(position|strpos|regexp_\w+)\([^)]*change_summary/i);
  });

  it("reduces a snapshot so a status-only change compares equal", () => {
    const before = {
      title: "Stand-up",
      summary: "s",
      ai_review_state: "reviewed",
      details: { implementation_status: "in_progress", target_operational_on: "2026-12-01" },
      statements: [{ body: "b", ai_review_state: "pending", ai_reviewed_by: null }],
    };
    const statusOnly = {
      ...before,
      ai_review_state: "pending",
      details: {
        ...before.details,
        implementation_status: "operational",
        actual_operational_on: "2026-10-01",
      },
      statements: [{ body: "b", ai_review_state: "reviewed", ai_reviewed_by: "u" }],
    };
    const substantive = {
      ...before,
      details: { ...before.details, target_operational_on: "2027-01-01" },
    };
    const kind = "implementation_initiative" as const;
    expect(substantiveSnapshot(kind, statusOnly)).toEqual(substantiveSnapshot(kind, before));
    expect(substantiveSnapshot(kind, substantive)).not.toEqual(substantiveSnapshot(kind, before));
  });
});
