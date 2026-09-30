import type { Database } from "@/types/database";

type ElementKind = Database["public"]["Enums"]["element_kind"];

/** Where an element lives in the internal workspace: Phase 5 kinds have their own pages. */
export function internalElementHref(slug: string, kind: ElementKind, elementId: string): string {
  const base = `/internal/engagements/${slug}`;
  if (kind === "review") return `${base}/reviews/${elementId}`;
  if (kind === "deliverable") return `${base}/deliverables/${elementId}`;
  if (kind === "implementation_initiative") return `${base}/implementation/${elementId}`;
  return `${base}/architecture/elements/${elementId}`;
}
