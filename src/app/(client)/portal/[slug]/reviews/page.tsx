import { notFound } from "next/navigation";
import { getClientArchitectureContext } from "@/domain/architecture/context";
import { getClientArchitecture, getClientPendingApprovals } from "@/domain/architecture/queries";
import { REVIEW_TYPE_LABELS, reviewStatus } from "@/domain/reviews/catalog";
import { getClientReviews } from "@/domain/reviews/queries";
import { formatDateTime } from "@/lib/format";
import { ApprovalResponseForm } from "@/components/architecture/client-responses";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

/**
 * Published reviews, in date order: summary and client-visible findings
 * only. A working review, its internal-only findings, its participants and
 * its stewardship are never sent to a client (proposal §16).
 */
export default async function ClientReviewsPage({ params }: PageProps<"/portal/[slug]/reviews">) {
  const { slug } = await params;
  const { engagement, canView, canRespond } = await getClientArchitectureContext(slug);
  if (!canView) notFound();
  const [reviews, pending, architecture] = await Promise.all([
    getClientReviews(engagement.id),
    canRespond ? getClientPendingApprovals(engagement.id) : Promise.resolve([]),
    getClientArchitecture(engagement.id),
  ]);
  const ordered = [...reviews].sort((a, b) =>
    (b.held_at ?? b.scheduled_for ?? "").localeCompare(a.held_at ?? a.scheduled_for ?? ""),
  );
  const snapshotOf = new Map(architecture.map((r) => [r.element_id, r.client_snapshot]));

  return (
    <div className="space-y-8">
      <EngagementNav slug={slug} engagementId={engagement.id} current="reviews" />
      <PageHeader
        eyebrow={engagement.organizations?.name ?? "Reviews"}
        title="Reviews"
        description="Published Executive and Architecture Reviews, with their summary and client-visible findings."
      />

      <Panel title="Reviews">
        {ordered.length === 0 ? (
          <EmptyState title="No reviews published yet" />
        ) : (
          <div className="space-y-6">
            {ordered.map((r) => {
              const status = reviewStatus(r.review_status);
              const approval = pending.find((p) => p.element_version_id === r.version_id);
              const findings = (snapshotOf.get(r.element_id)?.statements ?? []).filter(
                (s) => s.statement_kind === "finding",
              );
              return (
                <div key={r.element_id} className="space-y-2 border-l-2 border-accent/40 pl-4">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-base text-ink">{r.title}</span>
                    <span className="text-xs text-ink-subtle">
                      {REVIEW_TYPE_LABELS[r.review_type]}
                    </span>
                    {status ? <StatusTag tone={status.tone}>{status.label}</StatusTag> : null}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {r.held_at
                      ? `Held ${formatDateTime(r.held_at)}`
                      : r.scheduled_for
                        ? `Scheduled ${formatDateTime(r.scheduled_for)}`
                        : null}
                  </p>
                  {r.summary ? <p className="max-w-2xl text-sm text-ink">{r.summary}</p> : null}
                  {findings.length > 0 ? (
                    <ul className="space-y-1 text-sm text-ink">
                      {findings.map((f) => (
                        <li key={f.id}>{f.body}</li>
                      ))}
                    </ul>
                  ) : null}
                  {approval && canRespond ? (
                    <ApprovalResponseForm approvalId={approval.id} label="Respond" />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
