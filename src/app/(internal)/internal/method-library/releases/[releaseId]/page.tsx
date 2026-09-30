import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  deleteDamRelease,
  publishDamRelease,
  removeDamReleaseMember,
  retireDamRelease,
  setDamReleaseMember,
  updateDamRelease,
} from "@/domain/methodology/actions";
import { formLabel } from "@/domain/methodology/catalog";
import { diffRelease, type ReleaseMember } from "@/domain/methodology/compare";
import {
  getDamReleaseMembers,
  getDamReleases,
  getMyPracticeCapabilities,
  getUsableVersions,
} from "@/domain/methodology/queries";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { FormBadge, ReleaseTag } from "@/components/methodology/badges";
import { LibraryNav } from "@/components/methodology/library-nav";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

const CHANGE_LABEL = {
  added: "Added",
  removed: "Removed",
  re_versioned: "New version",
  unchanged: "Unchanged",
} as const;

export default async function DamReleasePage({
  params,
}: PageProps<"/internal/method-library/releases/[releaseId]">) {
  await requireInternal();
  const { releaseId } = await params;
  if (!z.uuid().safeParse(releaseId).success) notFound();
  const [releases, practice] = await Promise.all([getDamReleases(), getMyPracticeCapabilities()]);
  const release = releases.find((r) => r.id === releaseId);
  if (!release) notFound();
  // The release it follows: the one it supersedes, else the current published one.
  const prior =
    releases.find((r) => r.id === release.supersedes_release_id) ??
    (release.status === "draft" ? releases.find((r) => r.status === "published") : undefined);
  const [members, priorMembers, usable] = await Promise.all([
    getDamReleaseMembers(release.id),
    prior ? getDamReleaseMembers(prior.id) : Promise.resolve([]),
    release.status === "draft" ? getUsableVersions() : Promise.resolve([]),
  ]);
  const toMember = (m: (typeof members)[number]): ReleaseMember => ({
    assetId: m.asset_id,
    assetTitle: m.method_assets?.title ?? "",
    versionId: m.asset_version_id,
    versionLabel: m.method_asset_versions?.version_label ?? null,
  });
  const changes = diffRelease(priorMembers.map(toMember), members.map(toMember));
  const memberByAsset = new Map(members.map((m) => [m.asset_id, m]));
  const draft = release.status === "draft";
  const vocabulary = release.vocabulary_record as {
    object_types?: unknown[];
    relationship_types?: unknown[];
  } | null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="DAM release"
        title={`DAM ${release.version_label}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ReleaseTag status={release.status} />
            <span>{release.title}</span>
          </span>
        }
        actions={
          draft ? (
            <>
              {practice.canPublish ? (
                <ActionForm
                  trigger="Publish release"
                  submitLabel="Publish"
                  confirm="Publish this release? It becomes frozen and supersedes the current release. Engagements stay on their release until moved."
                  action={publishDamRelease.bind(null, release.id)}
                  fields={[
                    { name: "effectiveOn", label: "Effective on", type: "date" },
                    { name: "changeSummary", label: "Change summary", type: "textarea" },
                  ]}
                  defaultValues={{ changeSummary: release.change_summary }}
                />
              ) : null}
              {practice.canAuthor ? (
                <ActionButton
                  action={deleteDamRelease.bind(null, release.id)}
                  label="Delete draft"
                  variant="ghost"
                  confirm="Delete this draft release?"
                />
              ) : null}
            </>
          ) : release.status === "published" || release.status === "superseded" ? (
            practice.canPublish ? (
              <ActionForm
                trigger="Retire release"
                variant="danger"
                submitLabel="Retire"
                action={retireDamRelease.bind(null, release.id)}
                fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
              />
            ) : null
          ) : null
        }
      />
      <LibraryNav current="releases" />

      <Panel title="About this release">
        <DetailList
          items={[
            { label: "Summary", value: release.summary },
            { label: "Change summary", value: release.change_summary },
            { label: "Effective", value: formatDate(release.effective_on) },
            { label: "Published", value: formatDate(release.published_at) },
            ...(release.retired_reason
              ? [{ label: "Retired", value: release.retired_reason }]
              : []),
          ]}
        />
        {draft && practice.canAuthor ? (
          <div className="mt-4">
            <ActionForm
              trigger="Edit"
              submitLabel="Save"
              action={updateDamRelease.bind(null, release.id)}
              fields={[
                { name: "title", label: "Title", wide: true },
                { name: "summary", label: "Summary", type: "textarea" },
                { name: "changeSummary", label: "Change summary", type: "textarea" },
              ]}
              defaultValues={{
                title: release.title,
                summary: release.summary,
                changeSummary: release.change_summary,
              }}
            />
          </div>
        ) : null}
      </Panel>

      <Panel
        title={prior ? `Changes from DAM ${prior.version_label}` : "Members"}
        description="Exact versions, one per asset."
      >
        {changes.length === 0 ? (
          <EmptyState title="No members yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Asset</Th>
                <Th>Form</Th>
                <Th>Version</Th>
                <Th>Change</Th>
                {draft && practice.canAuthor ? <Th /> : null}
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => {
                const m = memberByAsset.get(c.member.assetId);
                return (
                  <tr
                    key={`${c.change}-${c.member.assetId}`}
                    className={c.change === "removed" ? "text-ink-subtle" : undefined}
                  >
                    <Td>
                      <Link
                        href={`/internal/method-library/${c.member.assetId}`}
                        className="hover:underline"
                      >
                        {c.member.assetTitle}
                      </Link>
                    </Td>
                    <Td>{m ? <FormBadge form={m.method_assets?.form ?? null} /> : null}</Td>
                    <Td className="tabular-nums">
                      {c.member.versionLabel}
                      {c.change === "re_versioned" ? (
                        <span className="text-ink-subtle"> (was {c.priorVersionLabel})</span>
                      ) : null}
                      {m &&
                      m.method_assets?.current_version_id &&
                      m.method_assets.current_version_id !== m.asset_version_id ? (
                        <span className="ml-2 text-xs text-attention">Newer version published</span>
                      ) : null}
                    </Td>
                    <Td>{CHANGE_LABEL[c.change]}</Td>
                    {draft && practice.canAuthor ? (
                      <Td className="text-right">
                        {c.change !== "removed" ? (
                          <ActionButton
                            action={removeDamReleaseMember.bind(null, release.id, c.member.assetId)}
                            label="Remove"
                            variant="ghost"
                          />
                        ) : null}
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {draft && practice.canAuthor ? (
          <div className="mt-4">
            <ActionForm
              trigger="Add or update a member"
              submitLabel="Set member"
              action={setDamReleaseMember.bind(null, release.id)}
              fields={[
                {
                  name: "versionId",
                  label: "Published version",
                  type: "select",
                  options: usable.map((u) => ({
                    value: u.version.id,
                    label: `${u.asset.title} · ${formLabel(u.asset.form)} ${u.version.version_label ?? ""}`,
                  })),
                  wide: true,
                },
              ]}
              defaultValues={{ versionId: usable[0]?.version.id ?? "" }}
            />
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Documented vocabulary"
        description="The architecture vocabulary in force when the release was published. A record, never a control."
      >
        {vocabulary ? (
          <p className="text-sm text-ink">
            {vocabulary.object_types?.length ?? 0} object types ·{" "}
            {vocabulary.relationship_types?.length ?? 0} relationship types
          </p>
        ) : (
          <p className="text-sm text-ink-subtle">Recorded when the release is published.</p>
        )}
      </Panel>

      <Panel title="Engagements on this release">
        {release.engagements.length === 0 ? (
          <EmptyState title="None" />
        ) : (
          <ul className="space-y-1 text-sm">
            {release.engagements.map((e) => (
              <li key={e.id}>
                <Link href={`/internal/engagements/${e.slug}/method`} className="hover:underline">
                  {e.title}
                </Link>{" "}
                <span className="text-ink-subtle">· {e.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
