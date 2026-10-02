import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./e2e/support/local-supabase";

/**
 * Browser acceptance suite (V1-A, decision D12). Drives the production
 * build (`next build` then `next start`) against the local Supabase stack:
 * real auth, real row-level security and the local mail
 * catcher. Nothing in the product is mocked.
 *
 * The site URL must be http://127.0.0.1:3000, the auth server's site URL in
 * supabase/config.toml, so invitation links return to this server.
 */
const SITE_URL = "http://127.0.0.1:3000";
const supabase = localSupabase();

export default defineConfig({
  testDir: "./e2e",
  // Specs share one database and reset it in turn, so they never run in parallel.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: SITE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm start --hostname 127.0.0.1 --port 3000",
    url: `${SITE_URL}/login`,
    // Opt-in only, so a running dev server is never mistaken for the production build.
    reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
    // Covers `next build` as well as start-up.
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: supabase.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      NEXT_PUBLIC_SITE_URL: SITE_URL,
      SUPABASE_SECRET_KEY: supabase.secretKey,
      BUSINESS_TIME_ZONE: "America/Chicago",
      ARCHITECTURE_INTELLIGENCE_MODE: "off",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
