import { describe, expect, it } from "vitest";
import { internalTitlesIn } from "./approach";

describe("internalTitlesIn", () => {
  const titles = ["Capability readiness diagnostic", "Anchor-led cluster development model"];
  it("finds an internal title regardless of case and spacing", () => {
    expect(
      internalTitlesIn("Assessed with the capability  READINESS diagnostic in May.", titles),
    ).toEqual(["Capability readiness diagnostic"]);
  });
  it("finds nothing in unrelated text", () => {
    expect(internalTitlesIn("Assessed through leadership interviews.", titles)).toEqual([]);
    expect(internalTitlesIn("", titles)).toEqual([]);
  });
  it("ignores titles too short to be meaningful", () => {
    expect(internalTitlesIn("the map was drawn", ["map"])).toEqual([]);
  });
});
