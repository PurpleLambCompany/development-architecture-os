import Link from "next/link";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import { loadArchitecture } from "@/domain/architecture/queries";
import { createInitiative, triageInitiative } from "@/domain/implementation/actions";
import {
  IMPLEMENTATION_CATEGORIES,
  IMPLEMENTATION_STATUS,
  IMPLEMENTATION_STATUSES,
  categoryLabel,
} from "@/domain/implementation/catalog";
import {
  getImplementationRegister,
  getImplementationSignals,
} from "@/domain/implementation/queries";
import {
  filterRegister,
  orderRegister,
  parseRegisterFilters,
  registerCounts,
  registerQuery,
  REGISTER_ORDER_EXPLANATION,
} from "@/domain/implementation/register";
import {
  ATTENTION,
  ATTENTION_LEVELS,
  ESCALATION_LEVEL_LABELS,
  TRIAGE_STATE,
} from "@/domain/intelligence/catalog";
import { businessToday } from "@/domain/intelligence/views";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ReferenceCode } from "@/components/architecture/badges";
import { elementOptionLabel } from "@/components/architecture/relationships-panel";
import { CountGrid } from "@/components/intelligence/figures";
import { triageFields } from "@/components/intelligence/fields";
import { ActionForm } from "@/components/ui/action-form";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

/**
 * The Implementation register (proposal §7, §15): every initiative on this
 * engagement, joined with Implementation's own stewardship and escalation
 * tables, filterable by status/category/owner/attention/triage.
 */
export default async function ImplementationPage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/implementation">) {
  const { slug } = await params;
  const query = await searchParams;
  const filters = parseRegisterFilters(query);
  const { engagement, canEdit, canManageImplementation } =
    await getInternalArchitectureContext(slug);
  const [architecture, rows, signals] = await Promise.all([
    loadArchitecture(engagement.id),
    getImplementationRegister(engagement.id),
    getImplementationSignals(engagement.id),
  ]);
  const today = businessToday();
  const signalled = new Set(signals.filter((s) => !s.dismissed).map((s) => s.element_id));
  const shown = orderRegister(filterRegister(rows, filters, { today, signalled }), {
    today,
    signalled,
  });
  const counts = registerCounts(rows);
  const nameOf = memberNames(engagement);
  const base = `/internal/engagements/${slug}/implementation`;
  const here = (extra: Partial<typeof filters>) => {
    const q = registerQuery({ ...filters, ...extra });
    return q ? `${base}?${q}` : base;
  };
  const creating = query.new === "1" && canManageImplementation;
  const objects = architecture.elements.filter(
    (e) => e.kind === "object" && e.lifecycle !== "retired" && e.lifecycle !== "superseded",
  );
  const owners = engagement.engagement_members
    .filter((m) => m.side === "internal" && m.status === "active")
    .map((m) => ({ value: m.id, label: nameOf(m.user_id) }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Implementation"].join(" · ")}
        title="Implementation"
        description="The organized effort to realize approved architecture in operating reality: status, evidence, checkpoints, and — only through a held review's judgment — validation."
      />
      <ArchitectureNav slug={slug} current="implementation" />

      <CountGrid
        label="Needs judgment"
        items={[
          { label: "Untriaged", value: counts.untriaged, href: here({ triage: "untriaged" }) },
          { label: "Critical", value: counts.critical, href: here({ attention: "critical" }) },
          { label: "Escalated", value: counts.escalated, href: here({ escalated: true }) },
          { label: "Active", value: counts.active, href: here({ status: "active" }) },
          { label: "Validated", value: counts.validated, href: here({ status: "validated" }) },
        ]}
      />

      <form
        method="get"
        action={base}
        className="rounded-sm border border-rule bg-surface px-5 py-4"
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <label className="space-y-1 text-xs text-ink-subtle">
            <span className="block tracking-wide uppercase">Status</span>
            <Select name="status" defaultValue={filters.status} className="h-9">
              <option value="active">Open (unresolved)</option>
              <option value="resolved">Resolved</option>
              <option value="all">Any status</option>
              {IMPLEMENTATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {IMPLEMENTATION_STATUS[s].label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-xs text-ink-subtle">
            <span className="block tracking-wide uppercase">Category</span>
            <Select name="category" defaultValue={filters.category ?? ""} className="h-9">
              <option value="">Any</option>
              {IMPLEMENTATION_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-xs text-ink-subtle">
            <span className="block tracking-wide uppercase">Attention</span>
            <Select name="attention" defaultValue={filters.attention ?? ""} className="h-9">
              <option value="">Any</option>
              {ATTENTION_LEVELS.map((a) => (
                <option key={a} value={a}>
                  {ATTENTION[a].label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-xs text-ink-subtle">
            <span className="block tracking-wide uppercase">Triage</span>
            <Select name="triage" defaultValue={filters.triage ?? ""} className="h-9">
              <option value="">Any</option>
              <option value="untriaged">{TRIAGE_STATE.untriaged.label}</option>
              <option value="triaged">{TRIAGE_STATE.triaged.label}</option>
            </Select>
          </label>
          <label className="space-y-1 text-xs text-ink-subtle">
            <span className="block tracking-wide uppercase">Search</span>
            <Input name="q" defaultValue={filters.q} className="h-9" placeholder="Title or code" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink">
          {(
            [
              ["escalated", "Escalated", filters.escalated],
              ["signals", "Open signals", filters.signalled],
            ] as const
          ).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2">
              <input
                type="checkbox"
                name={name}
                value="yes"
                defaultChecked={checked}
                className="size-4 accent-accent"
              />
              {label}
            </label>
          ))}
          <span className="ml-auto flex gap-2">
            <Link href={base} className="self-center text-sm text-ink-muted hover:underline">
              Clear filters
            </Link>
            <button
              type="submit"
              className="h-8 rounded-sm border border-rule-strong bg-surface px-3 text-sm text-ink hover:bg-surface-muted"
            >
              Apply
            </button>
          </span>
        </div>
      </form>

      {canManageImplementation ? (
        creating ? (
          <Panel title="New initiative">
            <ActionForm
              fields={[
                { name: "title", label: "Title", wide: true },
                {
                  name: "implementsElementIds",
                  label: "Implements",
                  type: "checkboxes",
                  options: objects.map((o) => ({ value: o.id, label: elementOptionLabel(o) })),
                  wide: true,
                  hint: "At least one core architecture object.",
                },
                {
                  name: "category",
                  label: "Category",
                  type: "select",
                  options: IMPLEMENTATION_CATEGORIES.map((c) => ({ value: c.key, label: c.label })),
                },
                { name: "targetOperationalOn", label: "Target operational date", type: "date" },
                {
                  name: "ownerMemberId",
                  label: "Owner",
                  type: "select",
                  options: [{ value: "", label: "Unassigned" }, ...owners],
                },
                { name: "summary", label: "Summary", type: "textarea", wide: true },
              ]}
              defaultValues={{ category: "other" }}
              action={createInitiative.bind(null, engagement.id)}
              submitLabel="Create initiative"
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
            New initiative
          </Link>
        )
      ) : null}

      <Panel
        title="Register"
        description={`${shown.length} shown. Order: ${REGISTER_ORDER_EXPLANATION}`}
      >
        {shown.length === 0 ? (
          <EmptyState title="No initiatives match">Change the filters to see more.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Initiative</Th>
                <Th>Status</Th>
                <Th>Category</Th>
                <Th>Owner</Th>
                <Th>Attention</Th>
                <Th className="w-40">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const status = IMPLEMENTATION_STATUS[row.implementation_status];
                const pastTarget =
                  !!row.target_operational_on &&
                  row.target_operational_on < today &&
                  ["not_started", "in_progress", "operational"].includes(row.implementation_status);
                return (
                  <tr key={row.element_id}>
                    <Td>
                      <Link
                        href={`${base}/${row.element_id}`}
                        className="group inline-flex items-baseline gap-2"
                      >
                        <ReferenceCode code={row.reference_code} />
                        <span className="text-ink group-hover:underline">{row.title}</span>
                      </Link>
                      {row.checkpoint_count > 0 ? (
                        <span className="mt-1 block text-xs text-ink-subtle">
                          {row.achieved_checkpoint_count} of {row.checkpoint_count} checkpoints
                          achieved
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="flex flex-col gap-1">
                        <StatusTag tone={status.tone}>{status.label}</StatusTag>
                        {pastTarget ? (
                          <span className="text-xs text-negative">Past target date</span>
                        ) : null}
                      </span>
                    </Td>
                    <Td className="text-ink-muted">{categoryLabel(row.category)}</Td>
                    <Td className="text-ink-muted">
                      {row.owner_member_id ? nameOf(row.owner_member_id) : "—"}
                    </Td>
                    <Td>
                      <span className="flex flex-col gap-1 text-xs text-ink-muted">
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusTag tone={ATTENTION[row.attention].tone}>
                            {ATTENTION[row.attention].label}
                          </StatusTag>
                          {row.triage_state === "untriaged" ? (
                            <span className="text-attention">Untriaged</span>
                          ) : null}
                        </span>
                        {row.open_escalations.map((level) => (
                          <span key={level} className="text-negative">
                            Escalated to {ESCALATION_LEVEL_LABELS[level].toLowerCase()}
                          </span>
                        ))}
                      </span>
                    </Td>
                    <Td>
                      {canEdit ? (
                        <ActionForm
                          trigger="Triage"
                          fields={triageFields}
                          defaultValues={{
                            attention: row.attention,
                            nextReviewOn: row.next_review_on ?? "",
                          }}
                          action={triageInitiative.bind(null, row.element_id)}
                          submitLabel="Save triage"
                          className="min-w-72"
                        />
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
