import Link from "next/link";
import { requireInternal } from "@/lib/auth/viewer";
import { getReviewQueue } from "@/domain/architecture/queries";
import { formatDateTime } from "@/lib/format";
import { ReferenceCode } from "@/components/architecture/badges";
import { getMyEngagementCapabilities } from "@/domain/capabilities/queries";
import { getEscalations } from "@/domain/intelligence/queries";
import { EscalationsPanel } from "@/components/intelligence/escalations-panel";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

/** Review work across every engagement the viewer can read. */
export default async function ReviewQueuePage() {
  const viewer = await requireInternal();
  const [queue, escalations] = await Promise.all([getReviewQueue(), getEscalations(null, true)]);
  const engagementIds = [...new Set(escalations.map((x) => x.engagement_id))];
  const capabilities = new Map(
    await Promise.all(
      engagementIds.map(async (id) => [id, await getMyEngagementCapabilities(id)] as const),
    ),
  );
  const nameOf = (id: string | null) => (id === viewer.id ? "you" : "TPLCo");
  const elementHref = (slug: string | undefined, id: string) =>
    `/internal/engagements/${slug}/architecture/elements/${id}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reviews"
        title="Review queue"
        description="Escalated records, working copies in review, AI analysis awaiting review, and approvals awaiting clients, across your engagements."
      />
      <EscalationsPanel
        escalations={escalations}
        canPublish={(id) => capabilities.get(id)?.has("publish_architecture") ?? false}
        nameOf={nameOf}
        showEngagement
      />
      <Panel title="In review">
        {queue.inReview.length === 0 ? (
          <EmptyState title="Nothing awaiting review" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Element</Th>
                <Th>Engagement</Th>
                <Th>Submitted</Th>
              </tr>
            </thead>
            <tbody>
              {queue.inReview.map((e) => (
                <tr key={e.id}>
                  <Td>
                    <Link href={elementHref(e.engagements?.slug, e.id)} className="hover:underline">
                      <ReferenceCode code={e.reference_code} /> {e.title}
                    </Link>
                  </Td>
                  <Td className="text-ink-muted">{e.engagements?.title}</Td>
                  <Td className="text-xs text-ink-muted">{formatDateTime(e.updated_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <Panel
        title="AI analysis awaiting review"
        description="Empty until Architecture Intelligence exists; nothing in Phase 3 creates AI content."
      >
        {queue.aiElements.length + queue.aiStatements.length === 0 ? (
          <EmptyState title="No AI content awaiting review" />
        ) : (
          <ul className="space-y-1 text-sm">
            {queue.aiElements.map((e) => (
              <li key={e.id}>
                <Link href={elementHref(e.engagements?.slug, e.id)} className="hover:underline">
                  {e.reference_code} {e.title}
                </Link>
              </li>
            ))}
            {queue.aiStatements.map((s) => (
              <li key={s.id}>
                <Link
                  href={elementHref(s.engagements?.slug, s.element_id)}
                  className="hover:underline"
                >
                  {s.body}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Awaiting clients">
        {queue.awaiting.length === 0 ? (
          <EmptyState title="No approvals outstanding" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Engagement</Th>
                <Th>For</Th>
                <Th>Requested</Th>
              </tr>
            </thead>
            <tbody>
              {queue.awaiting.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <Link
                      href={`/internal/engagements/${a.engagements?.slug}/reviews`}
                      className="hover:underline"
                    >
                      {a.engagements?.title}
                    </Link>
                  </Td>
                  <Td className="text-ink-muted">
                    {a.baseline_id ? "Baseline" : "Published version"}
                    {a.request_note ? ` · ${a.request_note}` : ""}
                  </Td>
                  <Td className="text-xs text-ink-muted">{formatDateTime(a.requested_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
