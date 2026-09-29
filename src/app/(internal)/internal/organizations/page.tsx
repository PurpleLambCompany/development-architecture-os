import Link from "next/link";
import { requireInternal } from "@/lib/auth/viewer";
import { listOrganizations } from "@/domain/organizations/queries";
import { canManageClientDirectory } from "@/domain/roles/roles";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata = { title: "Organizations" };

export default async function OrganizationsPage() {
  const viewer = await requireInternal();
  const organizations = await listOrganizations();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clients"
        title="Organizations"
        description="TPLCo and the client organizations it serves."
        actions={
          canManageClientDirectory(viewer.role) ? (
            <ButtonLink href="/internal/organizations/new">New client organization</ButtonLink>
          ) : null
        }
      />
      <Panel>
        {organizations.length === 0 ? (
          <EmptyState title="No organizations yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Organization</Th>
                <Th>Type</Th>
                <Th className="text-right">Members</Th>
                <Th className="text-right">Engagements</Th>
                <Th className="text-right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id}>
                  <Td>
                    <Link
                      href={`/internal/organizations/${org.slug}`}
                      className="font-medium hover:underline"
                    >
                      {org.name}
                    </Link>
                  </Td>
                  <Td className="text-ink-muted">{org.type === "tplco" ? "TPLCo" : "Client"}</Td>
                  <Td className="text-right text-ink-muted tabular-nums">{org.memberCount}</Td>
                  <Td className="text-right text-ink-muted tabular-nums">
                    {org.type === "client" ? org.engagementCount : "—"}
                  </Td>
                  <Td className="text-right">
                    <StatusTag tone={org.status === "active" ? "positive" : "neutral"}>
                      {org.status}
                    </StatusTag>
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
