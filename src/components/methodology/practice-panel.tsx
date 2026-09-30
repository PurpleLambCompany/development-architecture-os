import Link from "next/link";
import { addLineage, removeLineage } from "@/domain/architecture/actions";
import { listMethodAssets } from "@/domain/architecture/queries";
import {
  ELEMENT_ROLE,
  LINEAGE_ROLE,
  LINEAGE_RULES,
  lineageRolesForKind,
  type MethodApplicationElementRole,
  type MethodLineageRole,
} from "@/domain/methodology/catalog";
import {
  getElementPracticeContext,
  getTemplateDeliverableTypes,
} from "@/domain/methodology/queries";
import type { Database } from "@/types/database";
import { InternalMark } from "@/components/architecture/badges";
import { ApplicationStateTag, FormBadge } from "@/components/methodology/badges";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { EmptyState, Panel } from "@/components/ui/panel";

type ElementKind = Database["public"]["Enums"]["element_kind"];

/**
 * Practice (§29.6): how TPLCo's methodology bears on one element. Method
 * Applications that examined, produced, revised or informed it, and the
 * typed lineage it records against exact Model, Template and Standard
 * versions. Internal only: nothing here reaches a client snapshot.
 */
export async function PracticePanel({
  slug,
  elementId,
  kind,
  editable,
  methodologyDerived,
  deliverableType,
  title = "Practice",
}: {
  slug: string;
  elementId: string;
  kind: ElementKind;
  editable: boolean;
  /** The element or one of its statements is methodology_derived (D19). */
  methodologyDerived: boolean;
  /** For a Deliverable: only Templates of its type can be produced from. */
  deliverableType?: Database["public"]["Enums"]["deliverable_type"];
  title?: string;
}) {
  const [rows, assets, templateTypes] = await Promise.all([
    getElementPracticeContext(elementId),
    listMethodAssets(),
    deliverableType ? getTemplateDeliverableTypes() : Promise.resolve(new Map<string, string>()),
  ]);
  const applications = rows.filter((r) => r.source === "application");
  const lineage = rows.filter((r) => r.source === "lineage");
  const roles = lineageRolesForKind(kind);
  const options = roles.flatMap((role) =>
    assets
      .filter(
        (a) =>
          a.form === LINEAGE_RULES[role].form &&
          a.status === "active" &&
          a.method_asset_versions?.lifecycle === "published" &&
          !a.method_asset_versions.legacy &&
          (role !== "produced_from" ||
            !deliverableType ||
            templateTypes.get(a.method_asset_versions.id) === deliverableType),
      )
      .map((a) => ({
        value: `${role}:${a.method_asset_versions!.id}`,
        label: `${LINEAGE_ROLE[role]} · ${a.title} ${a.method_asset_versions!.version_label ?? ""}`,
      })),
  );
  const instantiates = lineage.some((l) => l.role === "instantiates" && !l.legacy);
  const blocked = methodologyDerived && !instantiates;

  return (
    <Panel
      title={title}
      description="The methodology behind this element. Internal only: never in a client snapshot."
      actions={<InternalMark />}
    >
      <div className="space-y-5">
        {blocked ? (
          <p className="rounded-sm border border-attention/40 bg-attention/5 px-3 py-2 text-sm text-ink">
            This element carries methodology-derived content, so it cannot be published until it
            records the Model it instantiates.
          </p>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-xs tracking-wide text-ink-subtle uppercase">Method Applications</h3>
          {applications.length === 0 ? (
            <p className="text-sm text-ink-subtle">No Method Application links this element.</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule text-sm">
              {applications.map((a) => (
                <li key={a.record_id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="text-ink-subtle">
                    {ELEMENT_ROLE[a.role as MethodApplicationElementRole]} by
                  </span>
                  <Link
                    href={`/internal/engagements/${slug}/method/${a.application_id}`}
                    className="text-ink hover:underline"
                  >
                    {a.application_code} · {a.application_title}
                  </Link>
                  {a.application_state ? <ApplicationStateTag state={a.application_state} /> : null}
                  <span className="text-ink-subtle">
                    applying{" "}
                    <Link
                      href={`/internal/method-library/${a.asset_id}`}
                      className="hover:underline"
                    >
                      {a.asset_title}
                    </Link>{" "}
                    {a.version_label}
                  </span>
                  {a.note ? <span className="text-ink-muted">· {a.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs tracking-wide text-ink-subtle uppercase">Lineage</h3>
          {lineage.length === 0 ? (
            <EmptyState title="No lineage recorded" />
          ) : (
            <ul className="divide-y divide-rule border-y border-rule text-sm">
              {lineage.map((l) => (
                <li
                  key={l.record_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-subtle">
                      {LINEAGE_ROLE[l.role as MethodLineageRole]}
                    </span>
                    <FormBadge form={l.form} />
                    <Link
                      href={`/internal/method-library/${l.asset_id}`}
                      className="hover:underline"
                    >
                      {l.asset_title}
                    </Link>
                    <span className="text-ink-subtle">{l.version_label}</span>
                    {l.note ? <span className="text-ink-muted">· {l.note}</span> : null}
                  </span>
                  {editable && !l.legacy && l.role !== "legacy_derived_from" ? (
                    <ActionButton
                      action={removeLineage.bind(null, l.record_id)}
                      label="Remove"
                      variant="ghost"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {editable && options.length > 0 ? (
            <ActionForm
              fields={[
                {
                  name: "target",
                  label: "Lineage",
                  type: "select",
                  options,
                  wide: true,
                },
                { name: "note", label: "Note" },
              ]}
              defaultValues={{ target: options[0]!.value }}
              action={addLineage.bind(null, elementId)}
              submitLabel="Record lineage"
              trigger="Record lineage"
            />
          ) : null}
          {editable && roles.length > 0 && options.length === 0 ? (
            <p className="text-sm text-ink-subtle">
              {deliverableType
                ? "No published Template produces this kind of Deliverable yet."
                : `No published ${roles.map((r) => LINEAGE_RULES[r].form).join(" or ")} versions to record yet.`}
            </p>
          ) : null}
        </section>
      </div>
    </Panel>
  );
}
