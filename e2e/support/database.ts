import { execFileSync } from "node:child_process";
import { localSupabase } from "./local-supabase";

/**
 * Resets the local database: every migration is re-applied, and the seed
 * is loaded only when asked. `--no-seed` gives the state of a fresh
 * installation: no organizations and no users.
 */
export function resetDatabase({ seed }: { seed: boolean }) {
  const args = ["exec", "supabase", "db", "reset", ...(seed ? [] : ["--no-seed"])];
  execFileSync("pnpm", args, { stdio: "pipe" });
}

/** Runs SQL as the local database owner, exactly as the SQL editor would. */
export function runSql(sql: string): string {
  try {
    return execFileSync("psql", [localSupabase().dbUrl, "-v", "ON_ERROR_STOP=1", "-qtAc", sql], {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Browser tests need the PostgreSQL client `psql` on PATH");
    }
    throw error;
  }
}

/** A single SQL string literal. */
export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
