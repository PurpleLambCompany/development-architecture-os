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
import {
  getMyEngagementCapabilities,
  listCapabilityOverrides,
} from "@/domain/capabilities/queries";
import { DOMAIN_SHORT_LABELS, DOMAIN_SLUGS } from "@/domain/architecture/catalog";
import { getDomainStates, loadArchitecture } from "@/domain/architecture/queries";
import { formatMoney } from "@/domain/finance/money";
import { getBusinessToday, getEngagementFinances } from "@/domain/finance/queries";
import { listAssignableUsers } from "@/domain/memberships/queries";
import { ROLE_LABELS, canManageEngagement } from "@/domain/roles/roles";
import {
  CapabilityMatrix,
  type CapabilityCell,
  type CapabilityRow,
} from "@/components/engagements/capability-matrix";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { MaturityMark } from "@/components/architecture/badges";
import { EngagementStatusTag } from "@/components/engagements/engagement-status";
import { AddTeamMemberForm, RemoveTeamMemberButton } from "@/components/engagements/team-controls";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { assignMemberArea, removeMemberArea } from "@/domain/intelligence/actions";
import { getMemberAreas } from "@/domain/intelligence/queries";
import { areaFields } from "@/components/intelligence/fields";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
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
  // Financial figures only for people holding view_financials here; the
  // database would return nothing to anyone else.
  const myCapabilities = await getMyEngagementCapabilities(engagement.id);
  const finances = myCapabilities.has("view_financials")
    ? await getEngagementFinances(engagement.id, getBusinessToday())
    : null;
  const summary = finances?.contract ? finances.summary : null;
  const domainStates = await getDomainStates(engagement.id);
  const [areas, architecture] = await Promise.all([
    getMemberAreas(engagement.id),
    loadArchitecture(engagement.id),
  ]);
  const areaMembers = engagement.engagement_members.filter(
    (m) =>
      m.side === "client" &&
      m.status === "active" &&
      !effectiveCapabilities(
        m.role,
        overrides.filter((o) => o.engagement_member_id === m.id),
      ).includes("view_full_architecture"),
  );
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
      <ArchitectureNav slug={engagement.slug} current="engagement" />

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

      {finances ? (
        <Panel
          title="Finances"
          description="Kept separate from project progress."
          actions={
            <ButtonLink href={`/internal/finance/${engagement.slug}`} variant="secondary" size="sm">
              Open finance workspace
            </ButtonLink>
          }
        >
          {summary ? (
            <DetailList
              items={[
                {
                  label: "Revised contract value",
                  value: formatMoney(summary.revised_value_minor, summary.currency),
                },
                {
                  label: "Net invoiced",
                  value: formatMoney(summary.net_invoiced_minor, summary.currency),
                },
                {
                  label: "Outstanding invoices",
                  value: formatMoney(summary.outstanding_balance_minor, summary.currency),
                },
                { label: "Past due", value: formatMoney(summary.past_due_minor, summary.currency) },
              ]}
            />
          ) : (
            <p className="text-sm text-ink-muted">No contract yet.</p>
          )}
        </Panel>
      ) : null}

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

      {areaMembers.length > 0 ? (
        <Panel
          title="Contributor areas"
          description="Client members without the full architecture see only published elements in their areas: a domain, or an element and everything part of it. With no area they see none."
        >
          <ul className="divide-y divide-rule border-y border-rule text-sm">
            {areaMembers.map((m) => {
              const mine = areas.filter((a) => a.engagement_member_id === m.id);
              return (
                <li key={m.id} className="space-y-2 py-3">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-ink">{personName(m.profiles)}</span>
                    <span className="text-xs text-ink-subtle">{ROLE_LABELS[m.role]}</span>
                  </p>
                  {mine.length === 0 ? (
                    <p className="text-ink-subtle">No area yet: sees no architecture.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {mine.map((a) => {
                        const element = a.element_id ? architecture.byId.get(a.element_id) : null;
                        return (
                          <li
                            key={a.id}
                            className="flex items-center gap-2 rounded-sm border border-rule px-2 py-1"
                          >
                            {a.domain
                              ? `${DOMAIN_SHORT_LABELS[a.domain]} domain`
                              : element
                                ? `${element.reference_code} ${element.title}`
                                : "An element"}
                            {canManage ? (
                              <ActionButton
                                action={removeMemberArea.bind(null, a.id)}
                                label="Remove"
                                variant="ghost"
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {canManage ? (
                    <ActionForm
                      trigger="Add area"
                      fields={areaFields(
                        architecture.elements
                          .filter((e) => e.object && e.lifecycle !== "retired")
                          .map((e) => ({ value: e.id, label: `${e.reference_code} ${e.title}` })),
                      )}
                      action={assignMemberArea.bind(null, m.id)}
                      submitLabel="Add area"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <Panel
        title="Architecture"
        description="Each domain's latest assessed state. Domain maturity is an architect's dated judgment."
        actions={
          <ButtonLink
            href={`/internal/engagements/${engagement.slug}/architecture`}
            variant="secondary"
            size="sm"
          >
            Open architecture
          </ButtonLink>
        }
      >
        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-rule bg-rule sm:grid-cols-2">
          {ARCHITECTURE_DOMAINS.map((domain, index) => {
            const state = domainStates.find((s) => s.domain === domain.key);
            return (
              <li key={domain.key} className="bg-surface px-5 py-4">
                <p className="text-xs text-ink-subtle tabular-nums">0{index + 1}</p>
                <Link
                  href={`/internal/engagements/${engagement.slug}/architecture/${DOMAIN_SLUGS[domain.key]}`}
                  className="mt-1 block font-serif text-base text-ink hover:underline"
                >
                  {domain.label}
                </Link>
                <p className="mt-1 text-sm text-ink-muted">{domain.summary}</p>
                <p className="mt-3 text-sm">
                  {state ? (
                    <MaturityMark maturity={state.maturity} />
                  ) : (
                    <span className="text-ink-subtle">Not yet assessed</span>
                  )}
                </p>
              </li>
            );
          })}
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
