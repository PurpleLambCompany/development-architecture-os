import { requireInternal } from "@/lib/auth/viewer";
import { EngagementDirectory } from "@/components/architecture/engagement-directory";
import { PageHeader } from "@/components/ui/page-header";

export default async function IntelligenceDirectoryPage() {
  await requireInternal();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence"
        title="Project Intelligence"
        description="Assumptions, risks, constraints, dependencies, decisions and recommendations, per engagement."
      />
      <EngagementDirectory section="intelligence" />
    </div>
  );
}
