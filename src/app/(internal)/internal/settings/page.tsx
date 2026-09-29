import { requireInternal } from "@/lib/auth/viewer";
import { ROLE_LABELS } from "@/domain/roles/roles";
import { ProfileForm } from "@/components/shell/profile-form";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, Panel } from "@/components/ui/panel";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireInternal();

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader eyebrow="Settings" title="Your profile" />
      <Panel title="Account">
        <DetailList
          items={[
            { label: "Email", value: viewer.email },
            { label: "Role", value: ROLE_LABELS[viewer.role] },
            { label: "Organization", value: viewer.organizationName },
          ]}
        />
      </Panel>
      <Panel title="Name">
        <ProfileForm firstName={viewer.firstName} lastName={viewer.lastName} />
      </Panel>
    </div>
  );
}
