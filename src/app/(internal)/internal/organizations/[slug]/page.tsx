import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDateRange, personName } from "@/lib/format";
import { getOrganizationBySlug } from "@/domain/organizations/queries";
import {
  CLIENT_ROLES,
  INTERNAL_ROLES,
  ROLE_LABELS,
  canManageClientDirectory,
  canManageInternalStaff,
} from "@/domain/roles/roles";
import { EngagementStatusTag } from "@/components/engagements/engagement-status";
import { InviteMemberForm } from "@/components/organizations/invite-member-form";
import { MemberStatusButton } from "@/components/organizations/member-status-button";
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
  const canManage = isTplco
    ? canManageInternalStaff(viewer.role)
    : canManageClientDirectory(viewer.role);
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
            ? "TPLCo staff and their internal roles."
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
                  </Td>
                  {canManage ? (
                    <Td className="text-right">
                      {member.profiles?.id !== viewer.id ? (
                        <MemberStatusButton
                          memberId={member.id}
                          role={member.role}
                          status={member.status}
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

      {canManage ? (
        <Panel
          title="Invite a person"
          description="They receive an email to set a password. Access begins when they accept."
        >
          <InviteMemberForm
            organizationId={organization.id}
            roles={isTplco ? INTERNAL_ROLES : CLIENT_ROLES}
          />
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

      {canManage && !isTplco ? (
        <Panel title="Organization details">
          <OrganizationForm
            organization={{
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
              status: organization.status === "invited" ? "active" : organization.status,
            }}
          />
        </Panel>
      ) : null}
    </div>
  );
}
