import { describe, expect, it } from "vitest";
import { internalElementHref } from "./links";

describe("internalElementHref", () => {
  it("sends Phase 5 kinds to their own pages", () => {
    expect(internalElementHref("m", "review", "x")).toBe("/internal/engagements/m/reviews/x");
    expect(internalElementHref("m", "deliverable", "x")).toBe(
      "/internal/engagements/m/deliverables/x",
    );
    expect(internalElementHref("m", "implementation_initiative", "x")).toBe(
      "/internal/engagements/m/implementation/x",
    );
  });
  it("sends objects and records to the element page", () => {
    expect(internalElementHref("m", "object", "x")).toBe(
      "/internal/engagements/m/architecture/elements/x",
    );
    expect(internalElementHref("m", "risk", "x")).toBe(
      "/internal/engagements/m/architecture/elements/x",
    );
  });
});
