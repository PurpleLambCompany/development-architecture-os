import { describe, expect, it } from "vitest";
import { resolveInitiativeSchema, updateStatusSchema } from "./schemas";

/**
 * The optional publication fields added to updateStatusSchema and
 * resolveInitiativeSchema (Defect 2 fix): publish defaults to false when a
 * form omits it entirely (never sent implicitly), and a "yes" checkbox/
 * select value turns it on. Publishing must always be an explicit,
 * opt-in choice, never automatic.
 */
describe("updateStatusSchema publish option", () => {
  it("defaults publish to false when the field is absent", () => {
    const parsed = updateStatusSchema.parse({
      status: "in_progress",
      rationale: "",
      changeSummary: "",
    });
    expect(parsed.publish).toBe(false);
  });

  it("parses an explicit 'no' as false", () => {
    const parsed = updateStatusSchema.parse({
      status: "in_progress",
      rationale: "",
      publish: "no",
      changeSummary: "",
    });
    expect(parsed.publish).toBe(false);
  });

  it("parses an explicit 'yes' as true", () => {
    const parsed = updateStatusSchema.parse({
      status: "in_progress",
      rationale: "",
      publish: "yes",
      changeSummary: "",
    });
    expect(parsed.publish).toBe(true);
  });

  it("accepts an optional change summary", () => {
    const parsed = updateStatusSchema.parse({
      status: "operational",
      rationale: "",
      publish: "yes",
      changeSummary: "Now operational.",
    });
    expect(parsed.changeSummary).toBe("Now operational.");
  });
});

describe("resolveInitiativeSchema publish option", () => {
  it("defaults publish to false when the field is absent", () => {
    const parsed = resolveInitiativeSchema.parse({
      status: "abandoned",
      rationale: "Vendor withdrew.",
      changeSummary: "",
    });
    expect(parsed.publish).toBe(false);
  });

  it("parses an explicit 'yes' as true", () => {
    const parsed = resolveInitiativeSchema.parse({
      status: "validated",
      rationale: "Confirmed operational.",
      publish: "yes",
      changeSummary: "",
    });
    expect(parsed.publish).toBe(true);
  });

  it("still requires a rationale regardless of publish", () => {
    const result = resolveInitiativeSchema.safeParse({
      status: "abandoned",
      rationale: "",
      publish: "yes",
      changeSummary: "",
    });
    expect(result.success).toBe(false);
  });
});
