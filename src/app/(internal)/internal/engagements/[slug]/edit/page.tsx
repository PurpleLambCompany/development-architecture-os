import { notFound, redirect } from "next/navigation";
import { requireInternal } from "@/lib/auth/viewer";
import { getEngagementBySlug } from "@/domain/engagements/queries";
import { canArchiveEngagement, canManageEngagement } from "@/domain/roles/roles";
import { EngagementForm } from "@/components/engagements/engagement-form";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export const metadata = { title: "Edit engagement" };

export default async function EditEngagementPage({
  params,
}: PageProps<"/internal/engagements/[slug]/edit">) {
  const { slug } = await params;
  const viewer = await requireInternal();
  const engagement = await getEngagementBySlug(slug);
  if (!engagement) notFound();

  const myAssignment = engagement.engagement_members.find(
    (m) => m.user_id === viewer.id && m.status === "active",
  );
  if (!canManageEngagement(viewer.role, myAssignment?.role ?? null)) {
    redirect(`/internal/engagements/${engagement.slug}`);
  }

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        eyebrow={engagement.organizations?.name ?? "Engagement"}
        title="Edit engagement"
      />
      <Panel>
        <EngagementForm
          mode="edit"
          engagementId={engagement.id}
          canArchive={canArchiveEngagement(viewer.role)}
          initial={{
            title: engagement.title,
            slug: engagement.slug,
            engagementType: engagement.engagement_type,
            objective: engagement.objective,
            description: engagement.description,
            currentPhase: engagement.current_phase,
            status: engagement.status,
            startDate: engagement.start_date ?? "",
            targetEndDate: engagement.target_end_date ?? "",
          }}
        />
      </Panel>
    </div>
  );
}
