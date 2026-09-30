import Link from "next/link";
import { getInternalArchitectureContext } from "@/domain/architecture/context";
import { listBaselines } from "@/domain/architecture/queries";
import { approvalState, APPROVAL_STATE, LIFECYCLE } from "@/domain/architecture/catalog";
import { createDeliverable } from "@/domain/deliverables/actions";
import { DELIVERABLE_TYPES, DELIVERABLE_TYPE_LABELS } from "@/domain/deliverables/catalog";
import { getDeliverableRegister } from "@/domain/deliverables/queries";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { InternalMark, ReferenceCode } from "@/components/architecture/badges";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

/**
 * The Deliverables register (proposal §6, §15): every formal TPLCo output,
 * with its status derived exactly as an ordinary element's is (lifecycle +
 * approval), filterable by type.
 */
export default async function DeliverablesPage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/deliverables">) {
  const { slug } = await params;
  const query = await searchParams;
  const { engagement, canManageDeliverables } = await getInternalArchitectureContext(slug);
  const [rows, baselines] = await Promise.all([
    getDeliverableRegister(engagement.id),
    listBaselines(engagement.id),
  ]);
  const typeFilter =
    typeof query.type === "string" &&
    (DELIVERABLE_TYPES as readonly string[]).includes(query.type)
      ? query.type
      : null;
  const shown = typeFilter ? rows.filter((r) => r.deliverable_type === typeFilter) : rows;
  const creating = query.new === "1" && canManageDeliverables;
  const base = `/internal/engagements/${slug}/deliverables`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Deliverables"].join(" · ")}
        title="Deliverables"
        description="Formal TPLCo outputs — blueprints, decks, maps, frameworks, summaries — versioned and published like any element, with files attached to the exact version they document."
      />
      <ArchitectureNav slug={slug} current="deliverables" />

      <nav className="flex flex-wrap gap-2" aria-label="Deliverable type">
        <Link
          href={base}
          aria-current={!typeFilter ? "page" : undefined}
          className={
            !typeFilter
              ? "rounded-sm border border-accent bg-accent-soft px-3 py-1.5 text-sm text-accent"
              : "rounded-sm border border-rule px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
          }
        >
          All ({rows.length})
        </Link>
        {DELIVERABLE_TYPES.map((t) => (
          <Link
            key={t}
            href={`${base}?type=${t}`}
            aria-current={typeFilter === t ? "page" : undefined}
            className={
              typeFilter === t
                ? "rounded-sm border border-accent bg-accent-soft px-3 py-1.5 text-sm text-accent"
                : "rounded-sm border border-rule px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
            }
          >
            {DELIVERABLE_TYPE_LABELS[t]} ({rows.filter((r) => r.deliverable_type === t).length})
          </Link>
        ))}
      </nav>

      {canManageDeliverables ? (
        creating ? (
          <Panel title="New deliverable">
            <ActionForm
              fields={[
                {
                  name: "deliverableType",
                  label: "Kind",
                  type: "select",
                  options: DELIVERABLE_TYPES.map((t) => ({ value: t, label: DELIVERABLE_TYPE_LABELS[t] })),
                },
                { name: "title", label: "Title", wide: true },
                {
                  name: "baselineId",
                  label: "Baseline",
                  type: "select",
                  options: [
                    { value: "", label: "None" },
                    ...baselines.map((b) => ({ value: b.id, label: b.label })),
                  ],
                },
                {
                  name: "confidential",
                  label: "Confidential",
                  type: "select",
                  options: [
                    { value: "no", label: "No" },
                    { value: "yes", label: "Yes — needs view_confidential_deliverables" },
                  ],
                },
                { name: "summary", label: "Summary", type: "textarea", wide: true },
              ]}
              defaultValues={{ deliverableType: "other", confidential: "no" }}
              action={createDeliverable.bind(null, engagement.id)}
              submitLabel="Create deliverable"
            />
            <Link href={base} className="mt-3 inline-block text-sm text-ink-muted hover:underline">
              Cancel
            </Link>
          </Panel>
        ) : (
          <Link
            href={`${base}?new=1`}
            className="inline-flex h-8 items-center rounded-sm bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover"
          >
            New deliverable
          </Link>
        )
      ) : null}

      <Panel title="Register" description={`${shown.length} shown.`}>
        {shown.length === 0 ? (
          <EmptyState title="No deliverables yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Deliverable</Th>
                <Th>Kind</Th>
                <Th>Status</Th>
                <Th>Approval</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.element_id}>
                  <Td>
                    <Link
                      href={`${base}/${row.element_id}`}
                      className="group inline-flex items-baseline gap-2"
                    >
                      <ReferenceCode code={row.reference_code} />
                      <span className="text-ink group-hover:underline">{row.title}</span>
                    </Link>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      {row.confidential ? <InternalMark>Confidential</InternalMark> : null}
                      {row.client_visibility === "internal" ? <InternalMark /> : null}
                    </span>
                  </Td>
                  <Td className="text-ink-muted">{DELIVERABLE_TYPE_LABELS[row.deliverable_type]}</Td>
                  <Td>
                    <StatusTag tone={LIFECYCLE[row.lifecycle].tone}>
                      {LIFECYCLE[row.lifecycle].label}
                    </StatusTag>
                  </Td>
                  <Td>
                    {row.approval_state ? (
                      <StatusTag tone={APPROVAL_STATE[approvalState(row.approval_state)].tone}>
                        {APPROVAL_STATE[approvalState(row.approval_state)].label}
                      </StatusTag>
                    ) : (
                      <span className="text-xs text-ink-subtle">Not yet published</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
