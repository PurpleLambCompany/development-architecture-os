import Link from "next/link";
import {
  addRelationship,
  deleteRelationship,
  retireRelationship,
} from "@/domain/architecture/actions";
import {
  DOMAIN_SHORT_LABELS,
  EDITABLE_PROVENANCE,
  PHASE_5_KIND_LABELS,
  PROVENANCE_LABELS,
  RECORD_KIND_LABELS,
  RELATIONSHIP_CATEGORY_LABELS,
  SKILL_PROFICIENCIES,
  SKILL_PROFICIENCY_LABELS,
  isPhase5Kind,
  type RelationshipCategory,
} from "@/domain/architecture/catalog";
import type {
  LoadedArchitecture,
  LoadedElement,
  RelationshipRow,
} from "@/domain/architecture/queries";
import {
  allowedRelationshipTypes,
  elementClass,
  objectType,
  relationshipType,
  type RelationshipTypeKey,
} from "@/domain/architecture/rules";
import { RELATIONSHIP_TYPES } from "@/domain/architecture/vocabulary";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { ElementLink, InternalMark } from "./badges";

export function elementTypeLabel(element: LoadedElement): string {
  if (element.object) return objectType(element.object.object_type)?.label ?? "Object";
  if (isPhase5Kind(element.kind)) return PHASE_5_KIND_LABELS[element.kind];
  return RECORD_KIND_LABELS[element.kind as keyof typeof RECORD_KIND_LABELS];
}

export function elementOptionLabel(element: LoadedElement): string {
  return `${element.reference_code ?? "—"} · ${element.title} (${elementTypeLabel(element)})`;
}

/** Whether a relationship crosses domains (either end outside the other's domains). */
function crossesDomains(a: LoadedElement, b: LoadedElement) {
  if (!a.object || !b.object) return false;
  return a.object.domain !== b.object.domain;
}

/**
 * Connected architecture: typed relationships in both directions, grouped
 * by relationship category. Pairings, same-engagement and acyclic rules
 * are enforced in the database; the form offers only types the source
 * element can hold.
 */
export function RelationshipsPanel({
  engagementId,
  slug,
  element,
  architecture,
  canEdit,
  canPublish,
  frozen,
  locked,
  pairHref,
}: {
  engagementId: string;
  slug: string;
  element: LoadedElement;
  architecture: LoadedArchitecture;
  canEdit: boolean;
  canPublish: boolean;
  frozen: boolean;
  /**
   * Relationship types that can no longer be added or retired here, with the
   * reason shown in place (a held Review's closed examined set, ADR-0054).
   */
  locked?: { types: RelationshipTypeKey[]; reason: string };
  /** The drawer that reads this element and a related one side by side (7B.2 §6.3). */
  pairHref?: (otherId: string) => string;
}) {
  const isLocked = (key: string) => locked?.types.includes(key as RelationshipTypeKey) ?? false;
  const rows = architecture.relationships
    .filter((r) => r.source_element_id === element.id || r.target_element_id === element.id)
    .map((r) => {
      const outgoing = r.source_element_id === element.id;
      const other = architecture.byId.get(outgoing ? r.target_element_id : r.source_element_id);
      const type = relationshipType(r.relationship_type);
      return { r, outgoing, other, type };
    })
    .filter((row) => row.other && row.type);

  const categories = Object.keys(RELATIONSHIP_CATEGORY_LABELS) as RelationshipCategory[];

  const source = elementClass(element.kind, element.object?.object_type ?? null);
  const candidates = architecture.elements.filter(
    (e) => e.id !== element.id && e.lifecycle !== "retired" && e.lifecycle !== "superseded",
  );
  const allowedTypes = new Set<RelationshipTypeKey>();
  const targets = candidates.filter((candidate) => {
    const types = allowedRelationshipTypes(
      source,
      elementClass(candidate.kind, candidate.object?.object_type ?? null),
    );
    types.forEach((t) => allowedTypes.add(t));
    return types.length > 0;
  });
  // validates is written only by record_review_validation (D13); never offered
  // as a free-form relationship insert here.
  const typeOptions = RELATIONSHIP_TYPES.filter(
    (t) => allowedTypes.has(t.key) && t.key !== "validates" && !isLocked(t.key),
  ).map((t) => ({ value: t.key, label: t.label }));

  return (
    <Panel
      title="Connected architecture"
      description="Typed relationships. Cross-domain links are marked. Published relationships are retired, never edited."
    >
      <div className="space-y-6">
        {rows.length === 0 ? <EmptyState title="No relationships yet" /> : null}
        {locked ? <p className="text-sm text-ink-muted">{locked.reason}</p> : null}
        {categories.map((category) => {
          const inCategory = rows.filter((row) => row.type!.category === category);
          if (inCategory.length === 0) return null;
          return (
            <div key={category}>
              <p className="mb-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                {RELATIONSHIP_CATEGORY_LABELS[category]}
              </p>
              <ul className="divide-y divide-rule border-y border-rule">
                {inCategory.map(({ r, outgoing, other, type }) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span
                      className={
                        r.retired_at
                          ? "flex flex-wrap items-baseline gap-2 text-sm text-ink-subtle line-through"
                          : "flex flex-wrap items-baseline gap-2 text-sm"
                      }
                    >
                      <span className="text-ink-muted">
                        {outgoing ? type!.label : type!.inverseLabel}
                      </span>
                      <ElementLink slug={slug} element={other!} />
                      {r.required_proficiency ? (
                        <span className="text-xs text-ink-subtle">
                          ({SKILL_PROFICIENCY_LABELS[r.required_proficiency]})
                        </span>
                      ) : null}
                      {crossesDomains(element, other!) ? (
                        <span className="text-xs text-accent">
                          ↔ {DOMAIN_SHORT_LABELS[other!.object!.domain]}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2">
                      {pairHref && !r.retired_at ? (
                        <Link
                          href={pairHref(other!.id)}
                          scroll={false}
                          className="text-xs text-ink-muted hover:text-ink hover:underline"
                        >
                          Side by side
                        </Link>
                      ) : null}
                      {r.client_visibility === "internal" ? <InternalMark /> : null}
                      <RelationshipState r={r} />
                      {isLocked(r.relationship_type) ? null : (
                        <RelationshipControls
                          r={r}
                          canEdit={canEdit && !frozen}
                          canPublish={canPublish}
                        />
                      )}
                    </span>
                    {r.description || r.retirement_reason ? (
                      <p className="w-full text-xs text-ink-muted">
                        {r.retired_at ? `Retired: ${r.retirement_reason}` : r.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {canEdit && !frozen && targets.length > 0 ? (
          <ActionForm
            fields={[
              {
                name: "relationshipType",
                label: "This element…",
                type: "select",
                options: typeOptions,
              },
              {
                name: "targetElementId",
                label: "Target",
                type: "select",
                options: targets.map((t) => ({ value: t.id, label: elementOptionLabel(t) })),
                wide: true,
              },
              {
                name: "requiredProficiency",
                label: "Required proficiency",
                type: "select",
                options: [
                  { value: "", label: "Not applicable" },
                  ...SKILL_PROFICIENCIES.map((p) => ({
                    value: p,
                    label: SKILL_PROFICIENCY_LABELS[p],
                  })),
                ],
                hint: "Only for a role requiring a skill.",
              },
              {
                name: "provenance",
                label: "Provenance",
                type: "select",
                options: EDITABLE_PROVENANCE.map((p) => ({
                  value: p,
                  label: PROVENANCE_LABELS[p],
                })),
              },
              ...(canPublish
                ? [
                    {
                      name: "clientVisibility",
                      label: "Client visibility",
                      type: "select" as const,
                      options: [
                        { value: "client", label: "Client-visible once both ends are published" },
                        { value: "internal", label: "Internal only" },
                      ],
                    },
                  ]
                : []),
              { name: "description", label: "Description", type: "textarea" },
            ]}
            defaultValues={{
              relationshipType: typeOptions[0]?.value ?? "",
              targetElementId: targets[0]!.id,
              provenance: "architect_judgment",
              clientVisibility: "client",
            }}
            action={addRelationship.bind(null, engagementId, element.id)}
            submitLabel="Add relationship"
            trigger="Add relationship"
          />
        ) : null}
      </div>
    </Panel>
  );
}

function RelationshipState({ r }: { r: RelationshipRow }) {
  if (r.retired_at) return <StatusTag tone="neutral">Retired</StatusTag>;
  if (r.published_at) return <StatusTag tone="positive">Published</StatusTag>;
  return <StatusTag tone="neutral">Draft</StatusTag>;
}

function RelationshipControls({
  r,
  canEdit,
  canPublish,
}: {
  r: RelationshipRow;
  canEdit: boolean;
  canPublish: boolean;
}) {
  if (r.retired_at || r.relationship_type === "supersedes") return null;
  if (!r.published_at) {
    return canEdit ? (
      <ActionButton
        action={deleteRelationship.bind(null, r.id)}
        label="Remove"
        variant="ghost"
        confirm="Remove this unpublished relationship?"
      />
    ) : null;
  }
  return canPublish ? (
    <ActionForm
      fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
      action={retireRelationship.bind(null, r.id)}
      submitLabel="Retire relationship"
      variant="danger"
      trigger="Retire"
    />
  ) : null;
}
