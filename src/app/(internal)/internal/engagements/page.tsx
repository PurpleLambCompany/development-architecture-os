import Link from "next/link";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDateRange } from "@/lib/format";
import {
  ENGAGEMENT_TYPE_LABELS,
  ENGAGEMENT_VIEWS,
  isEngagementView,
} from "@/domain/engagements/catalog";
import { listEngagements } from "@/domain/engagements/queries";
import { canCreateEngagement } from "@/domain/roles/roles";
import { EngagementStatusTag } from "@/components/engagements/engagement-status";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Engagements" };

export default async function EngagementsPage({
  searchParams,
}: PageProps<"/internal/engagements">) {
  const viewer = await requireInternal();
  const { view: rawView } = await searchParams;
  const view = isEngagementView(rawView) ? rawView : undefined;
  const engagements = await listEngagements(view);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Engagements"
        title={view ? `${ENGAGEMENT_VIEWS[view].label} engagements` : "All engagements"}
        actions={
          canCreateEngagement(viewer.role) ? (
            <ButtonLink href="/internal/engagements/new">New engagement</ButtonLink>
          ) : null
        }
      />

      <nav className="flex gap-1 border-b border-rule text-sm" aria-label="Engagement views">
        {[
          { key: undefined, label: "All" },
          ...Object.entries(ENGAGEMENT_VIEWS).map(([key, v]) => ({ key, label: v.label })),
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.key ? `/internal/engagements?view=${tab.key}` : "/internal/engagements"}
            aria-current={view === tab.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2",
              view === tab.key
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Panel>
        {engagements.length === 0 ? (
          <EmptyState title="No engagements here">
            {canCreateEngagement(viewer.role)
              ? "Create one to get started."
              : "You are not assigned to any in this view."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Engagement</Th>
                <Th>Client</Th>
                <Th>Type</Th>
                <Th>Timeline</Th>
                <Th className="text-right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {engagements.map((engagement) => (
                <tr key={engagement.id}>
                  <Td>
                    <Link
                      href={`/internal/engagements/${engagement.slug}`}
                      className="font-medium hover:underline"
                    >
                      {engagement.title}
                    </Link>
                    {engagement.current_phase ? (
                      <p className="text-xs text-ink-subtle">{engagement.current_phase}</p>
                    ) : null}
                  </Td>
                  <Td className="text-ink-muted">{engagement.organizations?.name}</Td>
                  <Td className="text-ink-muted">
                    {ENGAGEMENT_TYPE_LABELS[engagement.engagement_type]}
                  </Td>
                  <Td className="text-ink-muted">
                    {formatDateRange(engagement.start_date, engagement.target_end_date) || "—"}
                  </Td>
                  <Td className="text-right">
                    <EngagementStatusTag status={engagement.status} />
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
