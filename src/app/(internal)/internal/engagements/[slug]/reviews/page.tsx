import Link from "next/link";
import { publishElement, returnToDraft } from "@/domain/architecture/actions";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import { getReviewQueue, listBaselines, loadArchitecture } from "@/domain/architecture/queries";
import { formatDateTime } from "@/lib/format";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ApprovalTag, ElementLink, LifecycleTag } from "@/components/architecture/badges";
import { elementTypeLabel } from "@/components/architecture/relationships-panel";
import { getEscalations, getSignals } from "@/domain/intelligence/queries";
import { EscalationsPanel } from "@/components/intelligence/escalations-panel";
import { createReview } from "@/domain/reviews/actions";
import { REVIEW_TYPES, REVIEW_TYPE_LABELS, reviewStatus } from "@/domain/reviews/catalog";
import { getReviewRegister } from "@/domain/reviews/queries";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { ReferenceCode } from "@/components/architecture/badges";
import { Table, Td, Th } from "@/components/ui/table";

/**
 * The review queue: working copies submitted for review, AI analysis
 * awaiting human review (empty until AI exists), and published versions
 * awaiting the client's response.
 */
export default async function ReviewsPage({
  params,
}: PageProps<"/internal/engagements/[slug]/reviews">) {
  const { slug } = await params;
  const { engagement, canPublish, canManageReviews } = await getInternalArchitectureContext(slug);
  const [architecture, queue, baselines, escalations, signals, sessions] = await Promise.all([
    loadArchitecture(engagement.id),
    getReviewQueue(),
    listBaselines(engagement.id),
    getEscalations(engagement.id, true),
    getSignals(engagement.id),
    getReviewRegister(engagement.id),
  ]);
  const nameOf = memberNames(engagement);
  const inReview = architecture.elements.filter((e) => e.lifecycle === "in_review");
  const drafts = architecture.elements.filter((e) => e.lifecycle === "draft");
  const aiElements = architecture.elements.filter((e) => e.ai_review_state === "pending");
  const aiStatements = queue.aiStatements.filter((s) => s.engagement_id === engagement.id);
  const versionElement = new Map(
    architecture.elements.flatMap((e) => e.versions.map((v) => [v.id, { e, v }] as const)),
  );
  const awaiting = architecture.approvals.filter((a) => a.response === null);
  const changesRequested = architecture.elements.filter(
    (e) => e.latestApprovalState === "changes_requested",
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Reviews"].join(" · ")}
        title="Reviews"
        description="Internal review before publication, and client responses to published versions."
      />
      <ArchitectureNav slug={slug} current="reviews" />
      <EscalationsPanel
        escalations={escalations}
        canPublish={() => canPublish}
        nameOf={nameOf}
        signals={{
          count: signals.filter((s) => !s.dismissed).length,
          href: `/internal/engagements/${slug}/intelligence/signals`,
        }}
      />

      <Panel
        title="Review sessions"
        description="Executive and Architecture Reviews: scheduled, held and cancelled, with their agenda and participants."
        actions={
          canManageReviews ? (
            <ActionForm
              fields={[
                {
                  name: "reviewType",
                  label: "Kind",
                  type: "select",
                  options: REVIEW_TYPES.map((t) => ({ value: t, label: REVIEW_TYPE_LABELS[t] })),
                },
                { name: "title", label: "Title", wide: true },
                { name: "scheduledFor", label: "Scheduled for", type: "text", hint: "YYYY-MM-DDTHH:mm" },
                { name: "summary", label: "Summary", type: "textarea" },
              ]}
              defaultValues={{ reviewType: "executive_review" }}
              action={createReview.bind(null, engagement.id)}
              submitLabel="Schedule review"
              trigger="Schedule a review"
            />
          ) : null
        }
      >
        {sessions.length === 0 ? (
          <EmptyState title="No reviews scheduled" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Review</Th>
                <Th>Kind</Th>
                <Th>Status</Th>
                <Th>When</Th>
                <Th className="text-right">Agenda</Th>
                <Th className="text-right">Participants</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((r) => {
                const status = reviewStatus(r.review_status);
                return (
                  <tr key={r.element_id}>
                    <Td>
                      <Link
                        href={`/internal/engagements/${slug}/reviews/${r.element_id}`}
                        className="group inline-flex items-baseline gap-2"
                      >
                        <ReferenceCode code={r.reference_code} />
                        <span className="text-ink group-hover:underline">{r.title}</span>
                      </Link>
                    </Td>
                    <Td className="text-ink-muted">{REVIEW_TYPE_LABELS[r.review_type]}</Td>
                    <Td>{status ? <StatusTag tone={status.tone}>{status.label}</StatusTag> : null}</Td>
                    <Td className="text-xs whitespace-nowrap text-ink-muted">
                      {r.held_at
                        ? `Held ${formatDateTime(r.held_at)}`
                        : r.scheduled_for
                          ? `Scheduled ${formatDateTime(r.scheduled_for)}`
                          : "Not yet scheduled"}
                    </Td>
                    <Td className="text-right tabular-nums">{r.agenda_count}</Td>
                    <Td className="text-right tabular-nums">{r.participant_count}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel
        title="In review"
        description="Working copies submitted for review by a holder of Publish architecture."
      >
        {inReview.length === 0 ? (
          <EmptyState title="Nothing awaiting review" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {inReview.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <span className="space-y-1">
                  <ElementLink slug={slug} element={e} />
                  <span className="block text-xs text-ink-subtle">
                    {elementTypeLabel(e)} · submitted {formatDateTime(e.updated_at)} by{" "}
                    {nameOf(e.updated_by)}
                    {e.latestVersion ? ` · currently published v${e.latestVersion.version_no}` : ""}
                  </span>
                </span>
                {canPublish ? (
                  <span className="flex flex-wrap gap-2">
                    <ActionForm
                      fields={[{ name: "changeSummary", label: "What changed", type: "textarea" }]}
                      action={publishElement.bind(null, e.id)}
                      submitLabel={`Publish v${(e.latestVersion?.version_no ?? 0) + 1}`}
                      trigger="Publish"
                    />
                    <ActionForm
                      fields={[{ name: "note", label: "What needs work", type: "textarea" }]}
                      action={returnToDraft.bind(null, e.id)}
                      submitLabel="Return"
                      trigger="Return for work"
                    />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="AI analysis awaiting review"
        description="AI-provenance content must be reviewed and accepted before it can be published. Phase 3 does not generate AI content, so this stays empty."
      >
        {aiElements.length === 0 && aiStatements.length === 0 ? (
          <EmptyState title="No AI content awaiting review" />
        ) : (
          <ul className="space-y-2 text-sm">
            {aiElements.map((e) => (
              <li key={e.id}>
                <ElementLink slug={slug} element={e} />
              </li>
            ))}
            {aiStatements.map((s) => {
              const e = architecture.byId.get(s.element_id);
              return e ? (
                <li key={s.id}>
                  <ElementLink slug={slug} element={e} />{" "}
                  <span className="text-ink-muted">· “{s.body}”</span>
                </li>
              ) : null;
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="Awaiting the client"
        description="Approval requests for exact published versions and frozen baselines."
      >
        {awaiting.length === 0 ? (
          <EmptyState title="No approvals outstanding" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>For</Th>
                <Th>Requested</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              {awaiting.map((a) => {
                const target = a.element_version_id
                  ? versionElement.get(a.element_version_id)
                  : null;
                const baseline = a.baseline_id
                  ? baselines.find((b) => b.id === a.baseline_id)
                  : null;
                return (
                  <tr key={a.id}>
                    <Td>
                      {target ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <ElementLink slug={slug} element={target.e} />
                          <span className="text-xs text-ink-subtle">v{target.v.version_no}</span>
                        </span>
                      ) : baseline ? (
                        <Link
                          href={`/internal/engagements/${slug}/baselines/${baseline.id}`}
                          className="hover:underline"
                        >
                          Baseline: {baseline.label}
                        </Link>
                      ) : null}
                    </Td>
                    <Td className="text-xs whitespace-nowrap text-ink-muted">
                      {formatDateTime(a.requested_at)}
                      <br />
                      {nameOf(a.requested_by)}
                    </Td>
                    <Td className="text-ink-muted">{a.request_note || "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel
        title="Changes requested"
        description="The client asked for changes to the latest published version. Revise the working copy and publish a new version."
      >
        {changesRequested.length === 0 ? (
          <EmptyState title="No outstanding change requests" />
        ) : (
          <ul className="space-y-2 text-sm">
            {changesRequested.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3">
                <ElementLink slug={slug} element={e} />
                <ApprovalTag state={e.latestApprovalState} />
                <span className="text-ink-muted">“{e.latestApproval?.comment}”</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Drafts" description="Working copies not yet submitted.">
        {drafts.length === 0 ? (
          <EmptyState title="No drafts" />
        ) : (
          <ul className="space-y-2 text-sm">
            {drafts.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3">
                <ElementLink slug={slug} element={e} />
                <LifecycleTag lifecycle={e.lifecycle} />
                <span className="text-xs text-ink-subtle">{elementTypeLabel(e)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
