import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { fromDatabaseError } from "./action-result";

const fk = (message: string) =>
  ({ code: "23503", message, details: "", hint: "", name: "PostgrestError" }) as PostgrestError;

describe("fromDatabaseError", () => {
  it("explains that a Development Edge promotion target is kept", () => {
    const result = fromDatabaseError(
      fk(
        'update or delete on table "acceptance_criteria" violates foreign key constraint "edge_judgments_promotion_criterion_fk" on table "edge_judgments"',
      ),
    );
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toMatch(/promoted from the Development Edge/);
  });

  it("keeps the general message for other references", () => {
    const result = fromDatabaseError(fk('violates foreign key constraint "x_fk"'));
    expect(!result.ok && result.error).toBe(
      "That refers to a record from a different contract or engagement.",
    );
  });
});
