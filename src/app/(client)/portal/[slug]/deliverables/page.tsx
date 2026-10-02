import { notFound } from "next/navigation";
import { getClientArchitectureContext } from "@/domain/architecture/context";
import { getClientPendingApprovals } from "@/domain/architecture/queries";
import { DELIVERABLE_TYPE_LABELS } from "@/domain/deliverables/catalog";
import {
  getClientDeliverables,
  getDeliverableFiles,
  getVersionNumbers,
} from "@/domain/deliverables/queries";
import { formatDate } from "@/lib/format";
import { ApprovalResponseForm } from "@/components/architecture/client-responses";
import { DeliverableFilesByVersion } from "@/components/deliverables/deliverable-files";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";

/**
 * Deliverables the client may read (V1-A B3): published, client-visible,
 * within their areas, and confidential ones only with
 * view_confidential_deliverables. Each lists its files by the version they
 * were attached to (D9). The database decides every row and file; a
 * deliverable or file the client may not read is simply absent, and its
 * download link answers 404.
 */
export default async function ClientDeliverablesPage({
  params,
}: PageProps<"/portal/[slug]/deliverables">) {
  const { slug } = await params;
  const { engagement, canView, canRespond } = await getClientArchitectureContext(slug);
  if (!canView) notFound();
  const [deliverables, pending] = await Promise.all([
    getClientDeliverables(engagement.id),
    canRespond ? getClientPendingApprovals(engagement.id) : Promise.resolve([]),
  ]);
  const [files, versionNo] = await Promise.all([
    Promise.all(deliverables.map((d) => getDeliverableFiles(d.element_id))),
    getVersionNumbers(deliverables.map((d) => d.version_id)),
  ]);

  return (
    <div className="space-y-8">
      <EngagementNav slug={slug} engagementId={engagement.id} current="deliverables" />
      <PageHeader
        eyebrow={engagement.organizations?.name ?? "Deliverables"}
        title="Deliverables"
        description="Published deliverables shared with you, with their files by version."
      />

      <Panel title="Deliverables">
        {deliverables.length === 0 ? (
          <EmptyState title="No deliverables yet" />
        ) : (
          <div className="space-y-6">
            {deliverables.map((d, index) => {
              const approval = pending.find((p) => p.element_version_id === d.version_id);
              return (
                <article
                  key={d.element_id}
                  aria-label={d.title ?? d.reference_code}
                  className="space-y-2 border-l-2 border-accent/40 pl-4"
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-base text-ink">{d.title}</span>
                    <span className="text-xs text-ink-subtle">
                      {DELIVERABLE_TYPE_LABELS[d.deliverable_type]}
                    </span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    Version {versionNo.get(d.version_id) ?? "—"}, published{" "}
                    {formatDate(d.published_at)}
                  </p>
                  {d.summary ? <p className="max-w-2xl text-sm text-ink">{d.summary}</p> : null}
                  {files[index].length > 0 ? (
                    <DeliverableFilesByVersion
                      files={files[index]}
                      currentVersionNo={versionNo.get(d.version_id) ?? null}
                    />
                  ) : (
                    <p className="text-xs text-ink-subtle">No files attached.</p>
                  )}
                  {approval && canRespond ? (
                    <ApprovalResponseForm approvalId={approval.id} label="Respond" />
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
