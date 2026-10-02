import { execFileSync } from "node:child_process";

/**
 * Connection details of the local Supabase stack, read from
 * `supabase status`. These are the CLI's well-known local development
 * values, never a hosted project's; nothing here is committed.
 */
export type LocalSupabase = {
  apiUrl: string;
  dbUrl: string;
  mailpitUrl: string;
  publishableKey: string;
  secretKey: string;
};

let cached: LocalSupabase | null = null;

export function localSupabase(): LocalSupabase {
  if (cached) return cached;
  let output: string;
  try {
    output = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Local Supabase is not running. Start it with `pnpm db:start` first.");
  }
  // The CLI may print a notice about stopped optional services before the JSON.
  const status = JSON.parse(output.slice(output.indexOf("{"))) as Record<string, string>;
  const required = ["API_URL", "DB_URL", "MAILPIT_URL", "PUBLISHABLE_KEY", "SECRET_KEY"];
  for (const key of required) {
    if (!status[key]) throw new Error(`supabase status did not report ${key}`);
  }
  for (const url of [status.API_URL, status.DB_URL]) {
    const host = new URL(url).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") {
      throw new Error("Browser tests only run against a local Supabase stack");
    }
  }
  cached = {
    apiUrl: status.API_URL,
    dbUrl: status.DB_URL,
    mailpitUrl: status.MAILPIT_URL,
    publishableKey: status.PUBLISHABLE_KEY,
    secretKey: status.SECRET_KEY,
  };
  return cached;
}
