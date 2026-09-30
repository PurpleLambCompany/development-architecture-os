import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDate, personName } from "@/lib/format";
import { ARCHITECTURE_DOMAINS, ENGAGEMENT_TYPE_LABELS } from "@/domain/engagements/catalog";
import { getEngagementBySlug } from "@/domain/engagements/queries";
import {
  ENGAGEMENT_CAPABILITIES,
  ROLE_CAPABILITY_DEFAULTS,
  canManageCapability,
  capabilitySide,
  effectiveCapabilities,
  type EngagementCapability,
} from "@/domain/capabilities/catalog";
import { listCapabilityOverrides } from "@/domain/capabilities/queries";
import { listAssignableUsers } from "@/domain/memberships/queries";
import { ROLE_LABELS, canManageEngagement } from "@/domain/roles/roles";
import {
  CapabilityMatrix,
  type CapabilityCell,
  type CapabilityRow,
} from "@/components/engagements/capability-matrix";
import { EngagementStatusTag } from "@/components/engagements/engagement-status";
import { AddTeamMemberForm, RemoveTeamMemberButton } from "@/components/engagements/team-controls";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

export default async function EngagementPage({
  params,
}: PageProps<"/internal/engagements/[slug]">) {
  const { slug } = await params;
  const viewer = await requireInternal();
  const engagement = await getEngagementBySlug(slug);
  if (!engagement) notFound();

  const myAssignment = engagement.engagement_members.find(
    (m) => m.user_id === viewer.id && m.status === "active",
  );
  const canManage = canManageEngagement(viewer.role, myAssignment?.role ?? null);

  const assignedIds = new Set(engagement.engagement_members.map((m) => m.user_id));
  const candidates = canManage
    ? (await listAssignableUsers(engagement.client_organization_id)).filter(
        (u) => !assignedIds.has(u.userId),
      )
    : [];

  const overrides = await listCapabilityOverrides(engagement.id);
  const capabilityRows: CapabilityRow[] = engagement.engagement_members
    .filter((m) => m.status === "active")
    .sort((a, b) => a.side.localeCompare(b.side))
    .map((member) => {
      const memberOverrides = overrides.filter((o) => o.engagement_member_id === member.id);
      const effective = effectiveCapabilities(member.role, memberOverrides);
      const cells = Object.fromEntries(
        ENGAGEMENT_CAPABILITIES.map((capability): [EngagementCapability, CapabilityCell] => {
          const override = memberOverrides.find((o) => o.capability === capability);
          const side = capabilitySide(capability);
          return [
            capability,
            {
              byDefault: ROLE_CAPABILITY_DEFAULTS[member.role].includes(capability),
              setting: override ? (override.granted ? "grant" : "revoke") : "default",
              effective: effective.includes(capability),
              applicable: side === null || side === member.side,
              canManage: canManageCapability({
                viewerRole: viewer.role,
                viewerEngagementRole: myAssignment?.role ?? null,
                isSelf: member.user_id === viewer.id,
                capability,
              }),
            },
          ];
        }),
      ) as Record<EngagementCapability, CapabilityCell>;
      return {
        memberId: member.id,
        name: personName(member.profiles),
        roleLabel: ROLE_LABELS[member.role],
        cells,
      };
    });

  const internalTeam = engagement.engagement_members.filter((m) => m.side === "internal");
  const clientTeam = engagement.engagement_members.filter((m) => m.side === "client");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={engagement.organizations?.name ?? "Engagement"}
        title={engagement.title}
        description={
          <span className="flex items-center gap-3">
            <EngagementStatusTag status={engagement.status} />
            <span>{ENGAGEMENT_TYPE_LABELS[engagement.engagement_type]}</span>
          </span>
        }
        actions={
          canManage ? (
            <ButtonLink href={`/internal/engagements/${engagement.slug}/edit`} variant="secondary">
              Edit engagement
            </ButtonLink>
          ) : null
        }
      />

      <Panel title="Engagement">
        <div className="space-y-6">
          {engagement.objective ? (
            <p className="max-w-3xl font-serif text-lg leading-relaxed text-ink">
              {engagement.objective}
            </p>
          ) : null}
          <DetailList
            items={[
              {
                label: "Client",
                value: engagement.organizations ? (
                  <Link
                    href={`/internal/organizations/${engagement.organizations.slug}`}
                    className="hover:underline"
                  >
                    {engagement.organizations.name}
                  </Link>
                ) : null,
              },
              { label: "Current phase", value: engagement.current_phase },
              { label: "Start date", value: formatDate(engagement.start_date) },
              { label: "Target end date", value: formatDate(engagement.target_end_date) },
              { label: "Methodology version", value: engagement.methodology_version },
              { label: "Last updated", value: formatDate(engagement.updated_at) },
            ]}
          />
          {engagement.description ? (
            <div className="border-t border-rule pt-5">
              <p className="mb-1 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Description and scope
              </p>
              <p className="max-w-3xl text-sm leading-relaxed whitespace-pre-line text-ink-muted">
                {engagement.description}
              </p>
            </div>
          ) : null}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TeamPanel
          title="Internal team"
          members={internalTeam}
          canManage={canManage}
          viewerId={viewer.id}
        />
        <TeamPanel
          title="Client team"
          members={clientTeam}
          canManage={canManage}
          viewerId={viewer.id}
        />
      </div>

      {canManage ? (
        <Panel
          title="Add to team"
          description="TPLCo staff, or people from this client organization."
        >
          <AddTeamMemberForm engagementId={engagement.id} candidates={candidates} />
        </Panel>
      ) : null}

      {capabilityRows.length > 0 ? (
        <Panel
          title="Capabilities"
          description="What each active member may do on this engagement. Roles supply defaults; an override applies to this engagement only and never changes the role."
        >
          <CapabilityMatrix rows={capabilityRows} />
        </Panel>
      ) : null}

      <Panel title="Architecture" description="The four domains are structured in a later phase.">
        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:grid-cols-2">
          {ARCHITECTURE_DOMAINS.map((domain, index) => (
            <li key={domain.key} className="bg-surface px-5 py-4">
              <p className="text-xs text-ink-subtle tabular-nums">0{index + 1}</p>
              <p className="mt-1 font-serif text-base text-ink">{domain.label}</p>
              <p className="mt-1 text-sm text-ink-muted">{domain.summary}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

type Member = {
  id: string;
  role: import("@/domain/roles/roles").AppRole;
  status: string;
  user_id: string;
  profiles: { first_name: string; last_name: string; email: string } | null;
};

function TeamPanel({
  title,
  members,
  canManage,
  viewerId,
}: {
  title: string;
  members: Member[];
  canManage: boolean;
  viewerId: string;
}) {
  return (
    <Panel title={title}>
      {members.length === 0 ? (
        <EmptyState title="No one assigned yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              {canManage ? <Th className="text-right" /> : null}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <Td>
                  <p className="font-medium">{personName(member.profiles)}</p>
                  <p className="text-xs text-ink-subtle">{member.profiles?.email}</p>
                </Td>
                <Td className="text-ink-muted">
                  {ROLE_LABELS[member.role]}
                  {member.status !== "active" ? (
                    <span className="ml-2">
                      <StatusTag>{member.status}</StatusTag>
                    </span>
                  ) : null}
                </Td>
                {canManage ? (
                  <Td className="text-right">
                    {member.user_id !== viewerId ? (
                      <RemoveTeamMemberButton
                        memberId={member.id}
                        name={personName(member.profiles)}
                      />
                    ) : null}
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
