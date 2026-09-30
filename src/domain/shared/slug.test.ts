import { describe, expect, it } from "vitest";
import { SLUG_PATTERN, slugify } from "./slug";

describe("slugify", () => {
  it("produces URL-safe identifiers that satisfy the database constraint", () => {
    for (const input of [
      "Meridian Development Authority",
      "  Harbor Commons — Foundation  ",
      "Café Économique",
      "A/B & C",
    ]) {
      const slug = slugify(input);
      expect(slug).toMatch(SLUG_PATTERN);
    }
  });

  it("is readable", () => {
    expect(slugify("Meridian Development Authority")).toBe("meridian-development-authority");
    expect(slugify("Café Économique")).toBe("cafe-economique");
  });
});
