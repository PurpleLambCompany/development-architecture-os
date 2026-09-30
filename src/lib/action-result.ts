import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail("Please correct the highlighted fields.", fieldErrors);
}

/**
 * Translate database errors into plain language. RLS denials (42501) and
 * integrity-trigger rejections (23514) are expected outcomes, not crashes.
 */
export function fromDatabaseError(error: PostgrestError, slugField?: string): ActionResult<never> {
  switch (error.code) {
    case "42501":
      return fail("You do not have permission to do that.");
    case "23505":
      return slugField
        ? fail("That identifier is already in use.", { [slugField]: "Already in use" })
        : fail("That record already exists.");
    case "23514":
      return fail(error.message);
    case "P0002":
      return fail("That record was not found, or you do not have access to it.");
    case "23503":
      // A Development Edge promotion target is kept as the promotion's record (ADR-0056).
      if (error.message.includes("edge_judgments_promotion"))
        return fail(
          "This record was promoted from the Development Edge and is kept as the promotion's record. Edit it instead.",
        );
      return fail("That refers to a record from a different contract or engagement.");
    case "22023":
      return fail(error.message);
    default:
      console.error("Database error", error);
      return fail("Something went wrong. Please try again.");
  }
}
