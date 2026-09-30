import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DECISION_STATUS,
  PROVENANCE_CLIENT_LABELS,
  approvalState,
} from "@/domain/architecture/catalog";
import { getClientArchitectureContext } from "@/domain/architecture/context";
import {
  getClientBaselines,
  getClientDecisions,
  getClientPendingApprovals,
  getClientVersions,
} from "@/domain/architecture/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { ApprovalTag, ReferenceCode } from "@/components/architecture/badges";
import { ApprovalResponseForm, DecisionForm } from "@/components/architecture/client-responses";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

/**
 * Awaiting your response: approval requests for exact published versions
 * and frozen baselines, and decisions with TPLCo's recommendation. Every
 * response is recorded with who, which version and when, and is final.
 */
export default async function ClientDecisionsPage({
  params,
}: PageProps<"/portal/[slug]/decisions">) {
  const { slug } = await params;
  const { engagement, canView, canRespond } = await getClientArchitectureContext(slug);
  if (!canView) notFound();
  const [pending, decisions, baselines] = await Promise.all([
    getClientPendingApprovals(engagement.id),
    getClientDecisions(engagement.id),
    getClientBaselines(engagement.id),
  ]);
  const versions = await getClientVersions(
    pending.map((p) => p.element_version_id).filter(Boolean) as string[],
  );
  const open = decisions.filter(
    (d) => d.decision_status === "open" || d.decision_status === "recommended",
  );
  const closed = decisions.filter((d) => !open.includes(d));

  return (
    <div className="space-y-8">
      <EngagementNav slug={slug} engagementId={engagement.id} current="decisions" />
      <PageHeader
        eyebrow={engagement.organizations?.name ?? "Decisions"}
        title="Decisions and approvals"
        description={
          canRespond
            ? "Items awaiting your response. Each response applies to the exact version shown."
            : "Decisions and approval requests on your engagement. Your role does not respond to them."
        }
      />

      <Panel title="Approval requests">
        {pending.length === 0 ? (
          <EmptyState title="No approval requests outstanding" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {pending.map((p) => {
              const version = versions.find((v) => v.id === p.element_version_id);
              const baseline = baselines.find((b) => b.id === p.baseline_id);
              return (
                <li key={p.id} className="space-y-2 py-4">
                  {version ? (
                    <p className="text-sm">
                      <Link
                        href={`/portal/${slug}/architecture/${version.element_id}`}
                        className="group inline-flex items-baseline gap-2"
                      >
                        <ReferenceCode code={version.client_snapshot.reference_code} />
                        <span className="text-ink group-hover:underline">
                          {version.client_snapshot.title}
                        </span>
                      </Link>
                      <span className="ml-2 text-xs text-ink-subtle">
                        Version {version.version_no}
                      </span>
                    </p>
                  ) : baseline ? (
                    <p className="text-sm text-ink">
                      Baseline: {baseline.label}{" "}
                      <span className="text-xs text-ink-subtle">
                        {baseline.architecture_baseline_items.length} items, frozen{" "}
                        {baseline.frozen_at ? formatDate(baseline.frozen_at.slice(0, 10)) : ""}
                      </span>
                    </p>
                  ) : null}
                  <p className="text-xs text-ink-muted">
                    Requested {formatDateTime(p.requested_at)}
                    {p.request_note ? ` · ${p.request_note}` : ""}
                  </p>
                  {canRespond ? (
                    <ApprovalResponseForm
                      approvalId={p.id}
                      label={version ? `Respond to version ${version.version_no}` : "Respond"}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Decisions awaiting a choice">
        {open.length === 0 ? (
          <EmptyState title="No open decisions" />
        ) : (
          <div className="space-y-6">
            {open.map((d) => (
              <div key={d.element_id} className="space-y-3 border-l-2 border-accent/40 pl-4">
                <p className="flex flex-wrap items-baseline gap-2">
                  <ReferenceCode code={d.reference_code} />
                  <Link
                    href={`/portal/${slug}/architecture/${d.element_id}`}
                    className="font-serif text-base text-ink hover:underline"
                  >
                    {d.title}
                  </Link>
                  {d.needed_by ? (
                    <span className="text-xs text-ink-subtle">
                      Needed by {formatDate(d.needed_by)}
                    </span>
                  ) : null}
                </p>
                {d.context ? <p className="text-sm text-ink-muted">{d.context}</p> : null}
                <ul className="space-y-2">
                  {d.options.map((o) => (
                    <li key={o.id} className="text-sm">
                      <span className="font-medium text-ink">{o.title}</span>
                      {o.id === d.recommended_option_id ? (
                        <span className="ml-2 text-xs text-ink-subtle uppercase">
                          Recommended · {PROVENANCE_CLIENT_LABELS.architect_judgment}
                        </span>
                      ) : null}
                      {o.description ? (
                        <span className="block text-ink-muted">{o.description}</span>
                      ) : null}
                      {o.tradeoffs ? (
                        <span className="block text-xs text-ink-muted">
                          Trade-offs: {o.tradeoffs}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {d.recommendation_rationale ? (
                  <p className="text-sm text-ink-muted">
                    <span className="text-ink-subtle">Why TPLCo recommends it: </span>
                    {d.recommendation_rationale}
                  </p>
                ) : null}
                {canRespond && d.options.length > 0 ? (
                  <DecisionForm
                    decisionId={d.element_id}
                    options={d.options}
                    recommendedOptionId={d.recommended_option_id}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Decided and deferred">
        {closed.length === 0 ? (
          <EmptyState title="Nothing decided yet" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule text-sm">
            {closed.map((d) => {
              const chosen = d.options.find((o) => o.id === d.chosen_option_id);
              const status = DECISION_STATUS[d.decision_status];
              return (
                <li key={d.element_id} className="space-y-1 py-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <ReferenceCode code={d.reference_code} />
                    <span className="text-ink">{d.title}</span>
                    <StatusTag tone={status.tone}>{status.label}</StatusTag>
                  </p>
                  {chosen ? (
                    <p className="text-ink-muted">
                      {PROVENANCE_CLIENT_LABELS.client_decision}: {chosen.title}
                      {d.decided_by_name ? ` · ${d.decided_by_name}` : ""}
                      {d.decided_at ? `, ${formatDate(d.decided_at.slice(0, 10))}` : ""}
                      {d.decision_source === "external_recorded_by_tplco"
                        ? " (outside the portal, recorded by TPLCo)"
                        : ""}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Baselines" description="Frozen snapshots of the architecture at agreed points.">
        {baselines.length === 0 ? (
          <EmptyState title="No baselines shared yet" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule text-sm">
            {baselines.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <span className="text-ink">{b.label}</span>
                  <span className="ml-2 text-xs text-ink-subtle">
                    {b.architecture_baseline_items.length} items · frozen{" "}
                    {b.frozen_at ? formatDate(b.frozen_at.slice(0, 10)) : ""}
                  </span>
                  {b.description ? (
                    <span className="block text-xs text-ink-muted">{b.description}</span>
                  ) : null}
                </span>
                {b.architecture_approvals[0] ? (
                  <ApprovalTag
                    state={approvalState(
                      b.architecture_approvals[0].response ?? "awaiting_response",
                    )}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
