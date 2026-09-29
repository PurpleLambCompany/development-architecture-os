import { redirect } from "next/navigation";
import { requireInternal } from "@/lib/auth/viewer";
import { canManageClientDirectory } from "@/domain/roles/roles";
import { OrganizationForm } from "@/components/organizations/organization-form";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export const metadata = { title: "New client organization" };

export default async function NewOrganizationPage() {
  const viewer = await requireInternal();
  if (!canManageClientDirectory(viewer.role)) redirect("/internal/organizations");

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader eyebrow="Clients" title="New client organization" />
      <Panel>
        <OrganizationForm />
      </Panel>
    </div>
  );
}
