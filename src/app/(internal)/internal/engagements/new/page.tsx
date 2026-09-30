import { redirect } from "next/navigation";
import { requireInternal } from "@/lib/auth/viewer";
import { listClientOrganizations } from "@/domain/organizations/queries";
import { canArchiveEngagement, canCreateEngagement } from "@/domain/roles/roles";
import { EngagementForm } from "@/components/engagements/engagement-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";

export const metadata = { title: "New engagement" };

export default async function NewEngagementPage() {
  const viewer = await requireInternal();
  if (!canCreateEngagement(viewer.role)) redirect("/internal/engagements");
  const organizations = await listClientOrganizations();

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Engagements"
        title="New engagement"
        description="You will be added to the engagement team automatically."
      />
      <Panel>
        {organizations.length === 0 ? (
          <EmptyState title="Create a client organization first">
            <div className="mt-4">
              <ButtonLink href="/internal/organizations/new" variant="secondary">
                New client organization
              </ButtonLink>
            </div>
          </EmptyState>
        ) : (
          <EngagementForm
            mode="create"
            organizations={organizations}
            canArchive={canArchiveEngagement(viewer.role)}
          />
        )}
      </Panel>
    </div>
  );
}
