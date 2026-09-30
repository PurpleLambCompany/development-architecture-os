import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DOMAIN_LABELS,
  RECORD_KIND_LABELS,
  approvalState,
  type RecordKind,
} from "@/domain/architecture/catalog";
import { getClientArchitectureContext, memberNames } from "@/domain/architecture/context";
import { submitContribution } from "@/domain/intelligence/actions";
import { getContributions } from "@/domain/intelligence/queries";
import {
  getClientArchitecture,
  getClientElementVersions,
  getClientPendingApprovals,
  getClientRelationships,
} from "@/domain/architecture/queries";
import { objectType, relationshipType } from "@/domain/architecture/rules";
import { formatDate, formatDateTime } from "@/lib/format";
import { ApprovalTag, ReferenceCode } from "@/components/architecture/badges";
import { ApprovalResponseForm } from "@/components/architecture/client-responses";
import { SnapshotView } from "@/components/architecture/snapshot-view";
import { ContributionCard } from "@/components/intelligence/contribution-card";
import { UploadForm } from "@/components/intelligence/upload-form";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";

export default async function ClientElementPage({
  params,
  searchParams,
}: PageProps<"/portal/[slug]/architecture/[elementId]">) {
  const { slug, elementId } = await params;
  const query = await searchParams;
  const { viewer, engagement, capabilities, canView, canRespond } =
    await getClientArchitectureContext(slug);
  if (!canView) notFound();
  const [rows, versions, relationships, pending, contributions] = await Promise.all([
    getClientArchitecture(engagement.id),
    getClientElementVersions(elementId),
    getClientRelationships(engagement.id),
    canRespond ? getClientPendingApprovals(engagement.id) : Promise.resolve([]),
    getContributions(engagement.id, elementId),
  ]);
  const canContribute = capabilities.has("submit_client_input");
  const names = memberNames(engagement);
  const nameOf = (id: string | null) => (id === viewer.id ? "You" : names(id));
  const row = rows.find((r) => r.element_id === elementId);
  if (!row || versions.length === 0) notFound();

  const shown =
    versions.find((v) => v.version_id === query.version) ??
    versions.find((v) => v.version_id === row.version_id)!;
  const titles = new Map(rows.map((r) => [r.element_id, r]));
  const connected = relationships.filter(
    (r) => r.source_element_id === elementId || r.target_element_id === elementId,
  );
  const pendingForLatest = pending.find((p) => p.element_version_id === row.version_id);
  const typeLabel =
    row.kind === "object"
      ? objectType(row.object_type)?.label
      : RECORD_KIND_LABELS[row.kind as RecordKind];

  return (
    <div className="space-y-8">
      <EngagementNav slug={slug} engagementId={engagement.id} current="architecture" />
      <PageHeader
        eyebrow={[
          row.kind === "object" && row.domain ? DOMAIN_LABELS[row.domain] : "Project Intelligence",
          typeLabel,
        ]
          .filter(Boolean)
          .join(" · ")}
        title={shown.client_snapshot.title}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <ReferenceCode code={row.reference_code} />
            <span>
              Version {shown.version_no} · published {formatDate(shown.published_at.slice(0, 10))}
            </span>
            {approvalState(shown.approval_state) !== "not_requested" ? (
              <ApprovalTag state={approvalState(shown.approval_state)} />
            ) : null}
          </span>
        }
      />

      {shown.version_id !== row.version_id ? (
        <p className="rounded-sm border border-attention/30 bg-attention-soft px-4 py-3 text-sm text-ink">
          You are reading version {shown.version_no}. The latest is version {row.version_no}.{" "}
          <Link href={`/portal/${slug}/architecture/${elementId}`} className="underline">
            Read the latest
          </Link>
        </p>
      ) : null}

      {pendingForLatest && shown.version_id === row.version_id ? (
        <Panel
          title="Your approval is requested"
          description={
            pendingForLatest.request_note ||
            `TPLCo asks you to approve version ${row.version_no} exactly as shown below.`
          }
        >
          <ApprovalResponseForm
            approvalId={pendingForLatest.id}
            label={`Respond to version ${row.version_no}`}
          />
        </Panel>
      ) : null}

      <Panel>
        <SnapshotView
          snapshot={shown.client_snapshot}
          titleOf={(id) => titles.get(id)?.title ?? null}
        />
      </Panel>

      <Panel title="Connected architecture">
        {connected.length === 0 ? (
          <EmptyState title="No published connections" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule text-sm">
            {connected.map((r) => {
              const outgoing = r.source_element_id === elementId;
              const other = titles.get(outgoing ? r.target_element_id : r.source_element_id);
              const type = relationshipType(r.relationship_type);
              if (!other || !type) return null;
              return (
                <li key={r.id} className="flex flex-wrap items-baseline gap-2 py-2">
                  <span className="text-ink-muted">
                    {outgoing ? type.label : type.inverseLabel}
                  </span>
                  <Link
                    href={`/portal/${slug}/architecture/${other.element_id}`}
                    className="group inline-flex items-baseline gap-2"
                  >
                    <ReferenceCode code={other.reference_code} />
                    <span className="text-ink group-hover:underline">{other.title}</span>
                  </Link>
                  {r.description ? (
                    <span className="w-full text-xs text-ink-muted">{r.description}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {canContribute || contributions.length > 0 ? (
        <Panel
          title="Your input"
          description="Add context, corrections or documents on this item. The Purple Lamb Company reviews each contribution and tells you how it was used."
        >
          <div className="space-y-4">
            {canContribute ? (
              <UploadForm
                engagementId={engagement.id}
                purpose="client_contribution"
                action={submitContribution.bind(null, elementId)}
                bodyLabel="Your input"
                submitLabel="Send input"
                trigger="Add input"
              />
            ) : null}
            {contributions.map((c) => (
              <ContributionCard key={c.id} contribution={c} name={nameOf} />
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title="History" description="Every published version stays readable.">
        <ul className="divide-y divide-rule border-y border-rule text-sm">
          {versions.map((v) => (
            <li
              key={v.version_id}
              className="flex flex-wrap items-start justify-between gap-3 py-3"
            >
              <span>
                <Link
                  href={`/portal/${slug}/architecture/${elementId}?version=${v.version_id}`}
                  className="font-medium text-ink hover:underline"
                >
                  Version {v.version_no}
                </Link>
                <span className="ml-2 text-xs text-ink-subtle">
                  {formatDateTime(v.published_at)}
                </span>
                {v.change_summary ? (
                  <span className="block text-ink-muted">{v.change_summary}</span>
                ) : null}
                {v.response_comment ? (
                  <span className="block text-xs text-ink-muted">“{v.response_comment}”</span>
                ) : null}
              </span>
              <span className="flex flex-col items-end gap-1">
                {approvalState(v.approval_state) !== "not_requested" ? (
                  <ApprovalTag state={approvalState(v.approval_state)} />
                ) : null}
                {v.responded_at ? (
                  <span className="text-xs text-ink-subtle">
                    {v.approval_source === "client_portal"
                      ? "In the portal"
                      : "Outside the portal, recorded by TPLCo"}
                    , {formatDate(v.responded_at.slice(0, 10))}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
