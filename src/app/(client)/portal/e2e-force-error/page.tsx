import { notFound } from "next/navigation";

/**
 * Proves the portal error boundary (C3) renders instead of the framework's
 * own crash page. Only throws when the browser suite's server sets
 * `E2E_TEST_ROUTES` (playwright.config.ts); any other environment, including
 * a real deployment, gets the ordinary not-found page.
 */
export default function ForceErrorPage(): never {
  if (process.env.E2E_TEST_ROUTES !== "1") notFound();
  throw new Error("Forced error for the browser suite (C3).");
}
