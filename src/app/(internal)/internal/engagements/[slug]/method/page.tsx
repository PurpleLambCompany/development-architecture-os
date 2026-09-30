import Link from "next/link";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import {
  setEngagementContexts,
  setEngagementRelease,
  startMethodApplicationAndOpen,
} from "@/domain/methodology/actions";
import {
  getDamReleaseMembers,
  getDamReleases,
  getDevelopmentContexts,
  getEngagementPractice,
  getMethodApplicationRegister,
  getMethodLibrary,
  getUsableVersions,
} from "@/domain/methodology/queries";
import { formatDate } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ReferenceCode } from "@/components/architecture/badges";
import { ApplicationStateTag, ReleaseChip } from "@/components/methodology/badges";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

/**
 * The engagement's practice (§29.5): the DAM release it is conducted under,
 * its Development Contexts, and its Method Applications. Internal only.
 * Nothing here is an architecture element; applications sit beside the
 * architecture and link to it.
 */
export default async function EngagementMethodPage({
  params,
}: PageProps<"/internal/engagements/[slug]/method">) {
  const { slug } = await params;
  const { engagement, canEdit, canPublish } = await getInternalArchitectureContext(slug);
  const [practice, releases, contexts, register, usable, library] = await Promise.all([
    getEngagementPractice(engagement.id),
    getDamReleases(),
    getDevelopmentContexts(),
    getMethodApplicationRegister(engagement.id),
    getUsableVersions(),
    getMethodLibrary(),
  ]);
  const releaseMembers = practice.release ? await getDamReleaseMembers(practice.release.id) : [];
  const inRelease = new Set(releaseMembers.map((m) => m.asset_version_id));
  const engagementContextKeys = new Set(
    practice.contexts.map((c) => c.development_contexts?.key).filter(Boolean) as string[],
  );
  const contextFit = (assetId: string) =>
    (library.find((l) => l.asset_id === assetId)?.context_keys ?? []).filter((k) =>
      engagementContextKeys.has(k),
    ).length;
  // Published Methods, those in the engagement's release first, then by context fit.
  const methods = usable
    .filter((u) => u.asset.form === "method")
    .map((u) => ({ ...u, inRelease: inRelease.has(u.version.id), fit: contextFit(u.asset.id) }))
    .sort(
      (a, b) =>
        Number(b.inRelease) - Number(a.inRelease) ||
        b.fit - a.fit ||
        a.asset.title.localeCompare(b.asset.title),
    );
  const nameOf = memberNames(engagement);
  const internalMembers = engagement.engagement_members.filter(
    (m) => m.side === "internal" && m.status === "active",
  );
  const memberName = (memberId: string | null) =>
    nameOf(internalMembers.find((m) => m.id === memberId)?.user_id ?? null);
  const primary = practice.contexts.find((c) => c.is_primary);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Method"].join(" · ")}
        title="Method"
        description="How TPLCo's methodology is being practised on this engagement. Internal only: clients see the release line and any approach statements an architect writes, nothing more."
      />
      <ArchitectureNav slug={slug} current="method" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="DAM release" description="The release this engagement is conducted under.">
          {practice.release ? (
            <p className="flex items-center gap-2 text-sm text-ink">
              <ReleaseChip
                label={practice.release.version_label}
                href={`/internal/method-library/releases/${practice.release.id}`}
              />
              {practice.release.title}
            </p>
          ) : (
            <p className="text-sm text-ink-subtle">No release recorded.</p>
          )}
          {canPublish ? (
            <div className="mt-4">
              <ActionForm
                trigger="Change release"
                submitLabel="Change"
                action={setEngagementRelease.bind(null, engagement.id)}
                fields={[
                  {
                    name: "releaseId",
                    label: "Release",
                    type: "select",
                    options: releases
                      .filter((r) => r.status === "published" || r.status === "superseded")
                      .map((r) => ({ value: r.id, label: `DAM ${r.version_label} (${r.status})` })),
                  },
                  { name: "reason", label: "Reason", type: "textarea" },
                ]}
                defaultValues={{
                  releaseId: releases.find((r) => r.status === "published")?.id ?? "",
                }}
              />
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Development Contexts"
          description="What kind of development this is. Internal."
        >
          {practice.contexts.length === 0 ? (
            <p className="text-sm text-ink-subtle">None declared.</p>
          ) : (
            <ul className="space-y-1 text-sm text-ink">
              {practice.contexts.map((c) => (
                <li key={c.context_id}>
                  {c.development_contexts?.label}
                  {c.is_primary ? <span className="text-ink-subtle"> · primary</span> : null}
                </li>
              ))}
            </ul>
          )}
          {canEdit && contexts.some((c) => c.status === "active") ? (
            <div className="mt-4">
              <ActionForm
                trigger="Edit contexts"
                submitLabel="Save"
                action={setEngagementContexts.bind(null, engagement.id)}
                fields={[
                  {
                    name: "contextIds",
                    label: "Contexts",
                    type: "checkboxes",
                    options: contexts
                      .filter((c) => c.status === "active")
                      .map((c) => ({ value: c.id, label: c.label })),
                    wide: true,
                  },
                  {
                    name: "primaryContextId",
                    label: "Primary",
                    type: "select",
                    options: [
                      { value: "", label: "None" },
                      ...contexts
                        .filter((c) => c.status === "active")
                        .map((c) => ({ value: c.id, label: c.label })),
                    ],
                  },
                ]}
                defaultValues={{
                  contextIds: practice.contexts.map((c) => c.context_id),
                  primaryContextId: primary?.context_id ?? "",
                }}
              />
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel
        title="Method Applications"
        description="Each records one use of one exact published Method version, for a stated reason."
        actions={
          canEdit && methods.length > 0 ? (
            <ActionForm
              trigger="Apply a method"
              submitLabel="Start application"
              action={startMethodApplicationAndOpen.bind(null, engagement.id, slug)}
              fields={[
                {
                  name: "versionId",
                  label: "Method",
                  type: "select",
                  options: methods.map((m) => ({
                    value: m.version.id,
                    label: `${m.asset.title} ${m.version.version_label ?? ""}${
                      m.inRelease ? "" : " (outside this engagement's release)"
                    }`,
                  })),
                  wide: true,
                },
                { name: "title", label: "Title", wide: true },
                {
                  name: "selectionReason",
                  label: "Why this method",
                  type: "textarea",
                },
                {
                  name: "architecturalQuestion",
                  label: "The question it answers here",
                  type: "textarea",
                },
                {
                  name: "outsideReleaseReason",
                  label: "Reason for using a version outside the release",
                  hint: "Required only when the version is outside this engagement's release",
                  type: "textarea",
                },
                {
                  name: "leadMemberId",
                  label: "Lead",
                  type: "select",
                  options: [
                    { value: "", label: "Me" },
                    ...internalMembers.map((m) => ({ value: m.id, label: nameOf(m.user_id) })),
                  ],
                },
              ]}
              defaultValues={{ versionId: methods[0]?.version.id ?? "" }}
            />
          ) : null
        }
      >
        {register.length === 0 ? (
          <EmptyState title="No Method Applications yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Application</Th>
                <Th>Method</Th>
                <Th>Lead</Th>
                <Th>State</Th>
                <Th>Dates</Th>
                <Th className="text-right">Links</Th>
              </tr>
            </thead>
            <tbody>
              {register.map((r) => (
                <tr key={r.application_id}>
                  <Td>
                    <ReferenceCode code={r.reference_code} />
                  </Td>
                  <Td>
                    <Link
                      href={`/internal/engagements/${slug}/method/${r.application_id}`}
                      className="hover:underline"
                    >
                      {r.title}
                    </Link>
                  </Td>
                  <Td>
                    <Link
                      href={`/internal/method-library/${r.asset_id}`}
                      className="hover:underline"
                    >
                      {r.asset_title}
                    </Link>{" "}
                    <span className="text-ink-subtle">{r.version_label}</span>
                    {!r.version_in_release ? (
                      <p className="text-xs text-attention">Outside the release</p>
                    ) : null}
                  </Td>
                  <Td>{memberName(r.lead_member_id)}</Td>
                  <Td>
                    <ApplicationStateTag state={r.state} />
                  </Td>
                  <Td className="text-ink-muted">
                    {formatDate(r.started_on)}
                    {r.closed_on ? ` to ${formatDate(r.closed_on)}` : ""}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {r.element_link_count} elements · {r.evidence_link_count} evidence
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {canEdit && methods.length > 0 ? (
        <Panel
          title="Methods available"
          description="Current published Methods, those in this engagement's release first, then by fit with its Development Contexts."
        >
          <ul className="divide-y divide-rule">
            {methods.map((m) => (
              <li key={m.version.id} className="space-y-1 py-3 text-sm first:pt-0 last:pb-0">
                <p>
                  <Link
                    href={`/internal/method-library/${m.asset.id}`}
                    className="font-medium hover:underline"
                  >
                    {m.asset.title}
                  </Link>{" "}
                  <span className="text-ink-subtle">
                    {m.version.version_label}
                    {m.inRelease ? " · in this release" : " · outside this release"}
                    {m.fit ? ` · fits ${m.fit} of this engagement's contexts` : ""}
                  </span>
                </p>
                {m.version.architectural_question ? (
                  <p className="text-ink">{m.version.architectural_question}</p>
                ) : null}
                {m.version.applicability ? (
                  <p className="text-ink-muted">Applies to: {m.version.applicability}</p>
                ) : null}
                {m.version.exclusions ? (
                  <p className="text-ink-muted">Not for: {m.version.exclusions}</p>
                ) : null}
                {m.asset.usage_restriction ? (
                  <p className="text-attention">Restriction: {m.asset.usage_restriction}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
