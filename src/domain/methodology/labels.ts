import {
  PHASE_5_KIND_LABELS,
  RECORD_KIND_LABELS,
  isPhase5Kind,
} from "@/domain/architecture/catalog";
import { OBJECT_TYPES } from "@/domain/architecture/vocabulary";
import { DELIVERABLE_TYPE_LABELS } from "@/domain/deliverables/catalog";
import type { Database } from "@/types/database";

type ElementKind = Database["public"]["Enums"]["element_kind"];
type DeliverableType = Database["public"]["Enums"]["deliverable_type"];

export function objectTypeLabel(key: string | null | undefined): string {
  return OBJECT_TYPES.find((t) => t.key === key)?.label ?? key ?? "Core object";
}

export function elementKindLabel(kind: ElementKind): string {
  if (kind === "object") return "Core object";
  if (isPhase5Kind(kind)) return PHASE_5_KIND_LABELS[kind];
  return RECORD_KIND_LABELS[kind as keyof typeof RECORD_KIND_LABELS] ?? kind;
}

/** An expected output or a captured link, in words. */
export function outputLabel(o: {
  output_kind: ElementKind;
  object_type_key?: string | null;
  deliverable_type?: DeliverableType | null;
}): string {
  if (o.output_kind === "object") return objectTypeLabel(o.object_type_key);
  if (o.output_kind === "deliverable" && o.deliverable_type) {
    return `${DELIVERABLE_TYPE_LABELS[o.deliverable_type]} (Deliverable)`;
  }
  return elementKindLabel(o.output_kind);
}
