import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDate, formatDateRange, personName } from "@/lib/format";
import { getMyPracticeCapabilities } from "@/domain/methodology/queries";
import { getOrganizationBySlug } from "@/domain/organizations/queries";
import {
  CLIENT_ROLES,
  ROLE_LABELS,
  assignablePracticeRoles,
  canManageClientDirectory,
  createsArchitectureAuthority,
  type AppRole,
} from "@/domain/roles/roles";
import { EngagementStatusTag } from "@/components/engagements/engagement-status";
import { InviteMemberForm } from "@/components/organizations/invite-member-form";
import { MemberActions } from "@/components/organizations/member-actions";
import { OrganizationForm } from "@/components/organizations/organization-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

export default async function OrganizationPage({
  params,
}: PageProps<"/internal/organizations/[slug]">) {
  const { slug } = await params;
  const viewer = await requireInternal();
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  const isTplco = organization.type === "tplco";
  // TPLCo staff are managed by practice administrators (D1); only a
  // Principal Architect may give architectural authority (D2).
  const { canAdminister } = await getMyPracticeCapabilities();
  const canManage = isTplco ? canAdminister : canManageClientDirectory(viewer.role);
  const roleOptions: readonly AppRole[] = isTplco
    ? assignablePracticeRoles(viewer.role, canAdminister)
    : canManage
      ? CLIENT_ROLES
      : [];
  const authorityNote =
    isTplco && canManage && viewer.role !== "principal_architect"
      ? "Only a Principal Architect can invite or appoint Principal Architects, Architects and Researchers, or restore them after a suspension."
      : null;
  const members = [...organization.organization_members].sort((a, b) =>
    personName(a.profiles).localeCompare(personName(b.profiles)),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={isTplco ? "TPLCo" : "Client organization"}
        title={organization.name}
        description={
          <StatusTag tone={organization.status === "active" ? "positive" : "neutral"}>
            {organization.status}
          </StatusTag>
        }
      />

      <Panel
        title="Members"
        description={
          isTplco
            ? "TPLCo staff and their practice roles. A person's role on each engagement follows their practice role."
            : "People from this organization and their client roles."
        }
      >
        {members.length === 0 ? (
          <EmptyState title="No members yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                {canManage ? <Th className="text-right">Access</Th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <Td className="font-medium">{personName(member.profiles)}</Td>
                  <Td className="text-ink-muted">{member.profiles?.email}</Td>
                  <Td className="text-ink-muted">{ROLE_LABELS[member.role]}</Td>
                  <Td>
                    <StatusTag
                      tone={
                        member.status === "active"
                          ? "positive"
                          : member.status === "invited"
                            ? "attention"
                            : "neutral"
                      }
                    >
                      {member.status}
                    </StatusTag>
                    {member.status === "invited" ? (
                      <p className="mt-1 text-xs text-ink-subtle">
                        Sent {formatDate(member.updated_at)}
                      </p>
                    ) : null}
                  </Td>
                  {canManage ? (
                    <Td className="text-right">
                      {member.profiles?.id !== viewer.id ? (
                        <MemberActions
                          memberId={member.id}
                          name={personName(member.profiles)}
                          role={member.role}
                          status={member.status}
                          roleOptions={roleOptions}
                          canRestore={
                            !isTplco ||
                            viewer.role === "principal_architect" ||
                            !createsArchitectureAuthority(
                              { role: member.role, status: member.status },
                              { role: member.role, status: "active" },
                            )
                          }
                        />
                      ) : (
                        <span className="text-xs text-ink-subtle">You</span>
                      )}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {canManage && roleOptions.length > 0 ? (
        <Panel
          title="Invite a person"
          description="They receive an email to set a password. Access begins when they accept. A pending invitation can be re-sent or revoked from the member list."
        >
          {authorityNote ? <p className="mb-4 text-sm text-ink-muted">{authorityNote}</p> : null}
          <InviteMemberForm organizationId={organization.id} roles={roleOptions} />
        </Panel>
      ) : null}

      {!isTplco ? (
        <Panel title="Engagements">
          {organization.engagements.length === 0 ? (
            <EmptyState title="No engagements visible to you" />
          ) : (
            <ul className="divide-y divide-rule/70">
              {organization.engagements.map((engagement) => (
                <li key={engagement.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Link
                      href={`/internal/engagements/${engagement.slug}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {engagement.title}
                    </Link>
                    <p className="text-xs text-ink-subtle">
                      {formatDateRange(engagement.start_date, engagement.target_end_date)}
                    </p>
                  </div>
                  <EngagementStatusTag status={engagement.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {canManage ? (
        <Panel
          title={isTplco ? "Practice details" : "Organization details"}
          description={
            isTplco
              ? "The practice's name and identifier. The practice organization is never suspended or archived from here."
              : undefined
          }
        >
          <OrganizationForm
            organization={{
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
              status: organization.status === "invited" ? "active" : organization.status,
            }}
            showStatus={!isTplco}
          />
        </Panel>
      ) : null}
    </div>
  );
}
