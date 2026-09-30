import { requireInternal } from "@/lib/auth/viewer";
import { EngagementDirectory } from "@/components/architecture/engagement-directory";
import { PageHeader } from "@/components/ui/page-header";

export default async function ArchitectureDirectoryPage() {
  await requireInternal();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Architecture"
        title="Engagement architecture"
        description="Each engagement's four domains and their latest assessed state. Open an engagement to work in its architecture."
      />
      <EngagementDirectory section="architecture" />
    </div>
  );
}
