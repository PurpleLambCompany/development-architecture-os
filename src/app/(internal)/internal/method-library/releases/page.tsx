import Link from "next/link";
import { createDamReleaseAndOpen } from "@/domain/methodology/actions";
import { getDamReleases, getMyPracticeCapabilities } from "@/domain/methodology/queries";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { ReleaseTag } from "@/components/methodology/badges";
import { LibraryNav } from "@/components/methodology/library-nav";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

/**
 * DAM releases (§29.3): frozen sets of exact published Method Asset
 * versions. A release documents the architecture vocabulary in force; it
 * never governs it, and it has no phases.
 */
export default async function DamReleasesPage() {
  await requireInternal();
  const [releases, practice] = await Promise.all([getDamReleases(), getMyPracticeCapabilities()]);
  const hasDraft = releases.some((r) => r.status === "draft");
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Method Library"
        title="DAM releases"
        description="Each release of the Development Architecture Method™ is a frozen set of published asset versions. Engagements are conducted under one release."
      />
      <LibraryNav current="releases" />
      <Panel
        title="Releases"
        actions={
          practice.canAuthor && !hasDraft ? (
            <ActionForm
              trigger="Draft a release"
              submitLabel="Create draft"
              action={createDamReleaseAndOpen}
              fields={[
                { name: "versionLabel", label: "Release label", hint: "e.g. 1.1" },
                {
                  name: "title",
                  label: "Title",
                  hint: "e.g. Development Architecture Method™ 1.1",
                },
                { name: "summary", label: "Summary", type: "textarea" },
              ]}
            />
          ) : null
        }
      >
        {releases.length === 0 ? (
          <EmptyState title="No releases" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Release</Th>
                <Th>Status</Th>
                <Th>Effective</Th>
                <Th className="text-right">Engagements</Th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link
                      href={`/internal/method-library/releases/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      DAM {r.version_label}
                    </Link>
                    <p className="text-xs text-ink-muted">{r.title}</p>
                  </Td>
                  <Td>
                    <ReleaseTag status={r.status} />
                  </Td>
                  <Td>{formatDate(r.effective_on)}</Td>
                  <Td className="text-right tabular-nums">{r.engagements.length}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
