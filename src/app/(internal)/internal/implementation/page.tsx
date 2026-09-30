import Link from "next/link";
import { requireInternal } from "@/lib/auth/viewer";
import { listEngagements } from "@/domain/engagements/queries";
import { IMPLEMENTATION_STATUS, categoryLabel } from "@/domain/implementation/catalog";
import { getImplementationRegister, getImplementationSignals } from "@/domain/implementation/queries";
import {
  filterRegister,
  orderRegister,
  parseRegisterFilters,
  registerCounts,
  registerQuery,
  REGISTER_ORDER_EXPLANATION,
} from "@/domain/implementation/register";
import { ATTENTION, ESCALATION_LEVEL_LABELS } from "@/domain/intelligence/catalog";
import { businessToday } from "@/domain/intelligence/views";
import { ReferenceCode } from "@/components/architecture/badges";
import { CountGrid } from "@/components/intelligence/figures";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

/** Every engagement's implementation initiatives in one register (mirrors /internal/intelligence). */
export default async function ImplementationDirectoryPage({
  searchParams,
}: PageProps<"/internal/implementation">) {
  await requireInternal();
  const filters = parseRegisterFilters(await searchParams);
  const today = businessToday();
  const engagements = (await listEngagements()).filter((e) => e.status !== "archived");
  const [rows, signals] = await Promise.all([
    getImplementationRegister(null),
    Promise.all(engagements.map((e) => getImplementationSignals(e.id))),
  ]);
  const live = new Set(engagements.map((e) => e.id));
  const inScope = rows.filter((r) => live.has(r.engagement_id));
  const byId = new Map(engagements.map((e, i) => [e.id, { ...e, index: i }]));
  const signalled = new Set(
    signals.flat().flatMap((s) => (!s.dismissed ? [s.element_id] : [])),
  );
  const shown = orderRegister(filterRegister(inScope, filters, { today, signalled }), {
    today,
    signalled,
  });
  const counts = registerCounts(inScope);
  const base = "/internal/implementation";
  const here = (extra: Partial<typeof filters>) => {
    const q = registerQuery({ ...filters, ...extra });
    return q ? `${base}?${q}` : base;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Implementation"
        title="Implementation"
        description="Every engagement's implementation initiatives in one register. Each engagement keeps its own effort, evidence and judgment; nothing is compared or scored across them."
      />
      <CountGrid
        label="Needs judgment across engagements"
        items={[
          { label: "Untriaged", value: counts.untriaged, href: here({ triage: "untriaged" }) },
          { label: "Critical", value: counts.critical, href: here({ attention: "critical" }) },
          { label: "Escalated", value: counts.escalated, href: here({ escalated: true }) },
          { label: "Active", value: counts.active, href: here({ status: "active" }) },
          { label: "Validated", value: counts.validated, href: here({ status: "validated" }) },
        ]}
      />

      <Panel title="By engagement">
        {engagements.length === 0 ? (
          <EmptyState title="No engagements to show" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Engagement</Th>
                <Th className="text-right">Active</Th>
                <Th className="text-right">Untriaged</Th>
                <Th className="text-right">Escalated</Th>
                <Th className="text-right">Validated</Th>
              </tr>
            </thead>
            <tbody>
              {engagements.map((e) => {
                const c = registerCounts(inScope.filter((r) => r.engagement_id === e.id));
                const href = `/internal/engagements/${e.slug}/implementation`;
                return (
                  <tr key={e.id}>
                    <Td>
                      <Link href={href} className="text-ink hover:underline">
                        {e.title}
                      </Link>
                    </Td>
                    {[c.active, c.untriaged, c.escalated, c.validated].map((n, k) => (
                      <Td key={k} className="text-right tabular-nums">
                        {n}
                      </Td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title="Register" description={`${shown.length} shown. Order: ${REGISTER_ORDER_EXPLANATION}`}>
        {shown.length === 0 ? (
          <EmptyState title="No initiatives match">Change the filters to see more.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Initiative</Th>
                <Th>Engagement</Th>
                <Th>Status</Th>
                <Th>Category</Th>
                <Th>Attention</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const status = IMPLEMENTATION_STATUS[row.implementation_status];
                const engagement = byId.get(row.engagement_id);
                const href = engagement
                  ? `/internal/engagements/${engagement.slug}/implementation/${row.element_id}`
                  : "#";
                return (
                  <tr key={row.element_id}>
                    <Td>
                      <Link href={href} className="group inline-flex items-baseline gap-2">
                        <ReferenceCode code={row.reference_code} />
                        <span className="text-ink group-hover:underline">{row.title}</span>
                      </Link>
                    </Td>
                    <Td className="text-xs text-ink-muted">{engagement?.title}</Td>
                    <Td>
                      <StatusTag tone={status.tone}>{status.label}</StatusTag>
                    </Td>
                    <Td className="text-ink-muted">{categoryLabel(row.category)}</Td>
                    <Td>
                      <span className="flex flex-col gap-1 text-xs text-ink-muted">
                        <StatusTag tone={ATTENTION[row.attention].tone}>{ATTENTION[row.attention].label}</StatusTag>
                        {row.open_escalations.map((level) => (
                          <span key={level} className="text-negative">
                            Escalated to {ESCALATION_LEVEL_LABELS[level].toLowerCase()}
                          </span>
                        ))}
                      </span>
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
