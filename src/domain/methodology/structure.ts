import type { Database } from "@/types/database";

/**
 * Plain-text editing of a version's ordered structure: one item per line,
 * with optional " | " separated parts. Keys are derived from the title and
 * made unique within the list; the database checks their shape again.
 *
 *   Stages     Title | purpose | guidance
 *   Criteria   Statement | guidance
 *   Sections   Title | guidance
 */

type ElementKind = Database["public"]["Enums"]["element_kind"];
type DeliverableType = Database["public"]["Enums"]["deliverable_type"];

export function toKey(text: string, fallback = "item"): string {
  let key = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/, "");
  if (!/^[a-z]/.test(key)) key = `${fallback}_${key}`.slice(0, 40).replace(/_+$/, "");
  return key || fallback;
}

function uniqueKeys<T extends { key: string }>(items: T[]): T[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const n = (seen.get(item.key) ?? 0) + 1;
    seen.set(item.key, n);
    if (n === 1) return item;
    const suffix = `_${n}`;
    return { ...item, key: item.key.slice(0, 40 - suffix.length) + suffix };
  });
}

function lines(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((part) => part.trim()));
}

export type StageInput = { key: string; title: string; purpose: string; guidance: string };
export type CriterionInput = { key: string; statement: string; guidance: string };
export type SectionInput = { title: string; guidance: string };

export function parseStages(text: string): StageInput[] {
  return uniqueKeys(
    lines(text).map(([title = "", purpose = "", ...rest]) => ({
      key: toKey(title, "stage"),
      title,
      purpose,
      guidance: rest.join(" | "),
    })),
  );
}

export function parseCriteria(text: string): CriterionInput[] {
  return uniqueKeys(
    lines(text).map(([statement = "", ...rest]) => ({
      key: toKey(statement.split(/\s+/).slice(0, 6).join(" "), "criterion"),
      statement,
      guidance: rest.join(" | "),
    })),
  );
}

export function parseSections(text: string): SectionInput[] {
  return lines(text).map(([title = "", ...rest]) => ({ title, guidance: rest.join(" | ") }));
}

const join = (...parts: string[]) => {
  const trimmed = [...parts];
  while (trimmed.length > 1 && !trimmed[trimmed.length - 1]) trimmed.pop();
  return trimmed.join(" | ");
};

export const stagesToText = (stages: { title: string; purpose: string; guidance: string }[]) =>
  stages.map((s) => join(s.title, s.purpose, s.guidance)).join("\n");
export const criteriaToText = (criteria: { statement: string; guidance: string }[]) =>
  criteria.map((c) => join(c.statement, c.guidance)).join("\n");
export const sectionsToText = (sections: { title: string; guidance: string }[]) =>
  sections.map((s) => join(s.title, s.guidance)).join("\n");

/** Expected outputs as checkbox values: object:<type>, deliverable:<type>, kind:<kind>. */
export type OutputInput = {
  output_kind: ElementKind;
  object_type_key?: string;
  deliverable_type?: DeliverableType;
};

export function outputValue(o: {
  output_kind: ElementKind;
  object_type_key: string | null;
  deliverable_type: DeliverableType | null;
}): string {
  if (o.output_kind === "object" && o.object_type_key) return `object:${o.object_type_key}`;
  if (o.output_kind === "deliverable" && o.deliverable_type) {
    return `deliverable:${o.deliverable_type}`;
  }
  return `kind:${o.output_kind}`;
}

export function parseOutputs(values: string[]): OutputInput[] {
  return values.map((value) => {
    const [prefix, rest = ""] = value.split(":");
    if (prefix === "object") {
      return rest ? { output_kind: "object", object_type_key: rest } : { output_kind: "object" };
    }
    if (prefix === "deliverable") {
      return rest
        ? { output_kind: "deliverable", deliverable_type: rest as DeliverableType }
        : { output_kind: "deliverable" };
    }
    return { output_kind: rest as ElementKind };
  });
}
