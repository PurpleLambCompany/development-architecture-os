import Link from "next/link";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDateRange, formatDateTime, personName } from "@/lib/format";
import { listEngagements, listRecentActivity } from "@/domain/engagements/queries";
import { listOrganizations } from "@/domain/organizations/queries";
import { ENGAGEMENT_TYPE_LABELS } from "@/domain/engagements/catalog";
import {
  canCreateEngagement,
  canReadActivityLog,
  canSeeAllEngagements,
} from "@/domain/roles/roles";
import { EngagementStatusTag } from "@/components/engagements/engagement-status";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata = { title: "Dashboard" };

export default async function InternalDashboard() {
  const viewer = await requireInternal();
  const [engagements, organizations, activity] = await Promise.all([
    listEngagements(),
    listOrganizations(),
    canReadActivityLog(viewer.role) ? listRecentActivity() : Promise.resolve([]),
  ]);

  const active = engagements.filter((e) => e.status === "active" || e.status === "paused");
  const upcoming = engagements.filter((e) => e.status === "proposed");
  const clients = organizations.filter((o) => o.type === "client" && o.status === "active");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="TPLCo Workspace"
        title={`Good day, ${viewer.firstName || viewer.displayName}`}
        description={
          canSeeAllEngagements(viewer.role)
            ? "An overview of every engagement in the practice."
            : "An overview of the engagements you are assigned to."
        }
        actions={
          canCreateEngagement(viewer.role) ? (
            <ButtonLink href="/internal/engagements/new">New engagement</ButtonLink>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:grid-cols-3">
        <Figure
          label="Active engagements"
          value={active.length}
          href="/internal/engagements?view=active"
        />
        <Figure
          label="Upcoming engagements"
          value={upcoming.length}
          href="/internal/engagements?view=upcoming"
        />
        <Figure
          label="Client organizations"
          value={clients.length}
          href="/internal/organizations"
        />
      </div>

      <Panel title="Active engagements">
        {active.length === 0 ? (
          <EmptyState title="No active engagements" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Engagement</Th>
                <Th>Client</Th>
                <Th>Current phase</Th>
                <Th>Timeline</Th>
                <Th className="text-right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {active.map((engagement) => (
                <tr key={engagement.id}>
                  <Td>
                    <Link
                      href={`/internal/engagements/${engagement.slug}`}
                      className="font-medium hover:underline"
                    >
                      {engagement.title}
                    </Link>
                    <p className="text-xs text-ink-subtle">
                      {ENGAGEMENT_TYPE_LABELS[engagement.engagement_type]}
                    </p>
                  </Td>
                  <Td className="text-ink-muted">{engagement.organizations?.name}</Td>
                  <Td className="text-ink-muted">{engagement.current_phase || "—"}</Td>
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

      {canReadActivityLog(viewer.role) ? (
        <Panel
          title="Recent activity"
          description="Audited changes to organizations, engagements and teams."
        >
          {activity.length === 0 ? (
            <EmptyState title="No recorded activity yet" />
          ) : (
            <ul className="divide-y divide-rule/70">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-baseline justify-between gap-4 py-2.5 text-sm"
                >
                  <span className="text-ink">
                    <span className="text-ink-muted">
                      {entry.profiles ? personName(entry.profiles) : "System"}
                    </span>{" "}
                    {describeActivity(entry.action_type, entry.entity_type)}{" "}
                    {entry.engagements?.title ?? entry.organizations?.name ?? ""}
                  </span>
                  <span className="shrink-0 text-xs text-ink-subtle">
                    {formatDateTime(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function Figure({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="bg-surface px-6 py-5 transition-colors hover:bg-surface-muted">
      <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">{label}</p>
      <p className="mt-2 font-serif text-3xl text-ink">{value}</p>
    </Link>
  );
}

const ENTITY_LABELS: Record<string, string> = {
  organizations: "organization",
  organization_members: "organization membership in",
  engagements: "engagement",
  engagement_members: "team assignment on",
};

function describeActivity(action: string, entity: string) {
  const verb = action === "insert" ? "created" : action === "update" ? "updated" : "removed";
  return `${verb} ${ENTITY_LABELS[entity] ?? entity}`;
}
