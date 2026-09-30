import Link from "next/link";
import { requireInternal } from "@/lib/auth/viewer";
import { getMyEngagementCapabilities } from "@/domain/capabilities/queries";
import { listEngagements } from "@/domain/engagements/queries";
import { getRegister, getSignals } from "@/domain/intelligence/queries";
import {
  filterRegister,
  orderRegister,
  parseRegisterFilters,
  registerCounts,
  registerQuery,
} from "@/domain/intelligence/register";
import { businessToday } from "@/domain/intelligence/views";
import { CountGrid } from "@/components/intelligence/figures";
import {
  KindTabs,
  RegisterFilterForm,
  RegisterTable,
} from "@/components/intelligence/register-view";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

export default async function IntelligenceDirectoryPage({
  searchParams,
}: PageProps<"/internal/intelligence">) {
  await requireInternal();
  const filters = parseRegisterFilters(await searchParams);
  const today = businessToday();
  const engagements = (await listEngagements()).filter((e) => e.status !== "archived");
  const [rows, signals, capabilities] = await Promise.all([
    getRegister(null),
    Promise.all(engagements.map((e) => getSignals(e.id))),
    Promise.all(engagements.map((e) => getMyEngagementCapabilities(e.id))),
  ]);
  const live = new Set(engagements.map((e) => e.id));
  const inScope = rows.filter((r) => live.has(r.engagement_id));
  const byId = new Map(engagements.map((e, i) => [e.id, { ...e, index: i }]));
  const signalled = new Set(
    signals.flat().flatMap((s) => (!s.dismissed && s.element_id ? [s.element_id] : [])),
  );
  const shown = orderRegister(
    filterRegister(inScope, filters, { today, signalled }),
    filters.kind,
    { today },
  );
  const counts = registerCounts(inScope, today);
  const base = "/internal/intelligence";
  const here = (extra: Partial<typeof filters>) => {
    const q = registerQuery({ ...filters, ...extra });
    return q ? `${base}?${q}` : base;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence"
        title="Project Intelligence"
        description="Every engagement's assumptions, risks, constraints, dependencies, decisions, recommendations and opportunities in one register. Each engagement keeps its own records; nothing is compared or scored across them."
      />
      <CountGrid
        label="Needs judgment across engagements"
        items={[
          { label: "Untriaged", value: counts.untriaged, href: here({ triage: "untriaged" }) },
          { label: "Critical", value: counts.critical, href: here({ attention: "critical" }) },
          { label: "Escalated", value: counts.escalated, href: here({ escalated: true }) },
          {
            label: "Reviews overdue",
            value: counts.reviewsOverdue,
            href: here({ review: "overdue" }),
          },
          { label: "Open signals", value: signalled.size, href: here({ signalled: true }) },
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
                <Th className="text-right">Open records</Th>
                <Th className="text-right">Untriaged</Th>
                <Th className="text-right">Escalated</Th>
                <Th className="text-right">Reviews overdue</Th>
                <Th className="text-right">Signals</Th>
              </tr>
            </thead>
            <tbody>
              {engagements.map((e, i) => {
                const c = registerCounts(
                  inScope.filter((r) => r.engagement_id === e.id),
                  today,
                );
                const open = Object.values(c.byKind).reduce((a, b) => a + b, 0);
                const s = signals[i]!.filter((x) => !x.dismissed).length;
                const href = `/internal/engagements/${e.slug}/intelligence`;
                return (
                  <tr key={e.id}>
                    <Td>
                      <Link href={href} className="text-ink hover:underline">
                        {e.title}
                      </Link>
                    </Td>
                    {[open, c.untriaged, c.escalated, c.reviewsOverdue].map((n, k) => (
                      <Td key={k} className="text-right tabular-nums">
                        {n}
                      </Td>
                    ))}
                    <Td className="text-right tabular-nums">
                      <Link href={`${href}/signals`} className="hover:underline">
                        {s}
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      <KindTabs base={base} filters={filters} counts={counts.byKind} />
      <RegisterFilterForm base={base} filters={filters} />
      <RegisterTable
        rows={shown}
        filters={filters}
        today={today}
        recordHref={(row) =>
          `/internal/engagements/${byId.get(row.engagement_id)?.slug}/architecture/elements/${row.element_id}`
        }
        engagementLabel={(row) => byId.get(row.engagement_id)?.title ?? ""}
        canTriage={(row) => {
          const e = byId.get(row.engagement_id);
          return !!e && capabilities[e.index]!.has("edit_architecture");
        }}
      />
    </div>
  );
}
