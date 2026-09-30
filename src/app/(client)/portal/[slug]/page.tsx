import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth/viewer";
import { formatDate, personName } from "@/lib/format";
import {
  ARCHITECTURE_DOMAINS,
  ENGAGEMENT_TYPE_LABELS,
  MATURITY_STATES,
} from "@/domain/engagements/catalog";
import { getEngagementBySlug } from "@/domain/engagements/queries";
import { getMyEngagementCapabilities } from "@/domain/capabilities/queries";
import { PROVENANCE_CLIENT_LABELS } from "@/domain/architecture/catalog";
import {
  getClientDecisions,
  getClientPendingApprovals,
  getDomainStates,
} from "@/domain/architecture/queries";
import { MaturityMark } from "@/components/architecture/badges";
import { ROLE_LABELS } from "@/domain/roles/roles";
import { EngagementStatusTag } from "@/components/engagements/engagement-status";
import { formatMoney } from "@/domain/finance/money";
import { getBusinessToday, getEngagementFinances } from "@/domain/finance/queries";
import { getClientActions } from "@/domain/intelligence/queries";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";

export default async function ClientEngagementPage({ params }: PageProps<"/portal/[slug]">) {
  const { slug } = await params;
  const viewer = await requireClient();
  // RLS returns nothing for engagements outside the viewer's assignments.
  const engagement = await getEngagementBySlug(slug);
  if (!engagement) notFound();

  const internalTeam = engagement.engagement_members.filter(
    (m) => m.side === "internal" && m.status === "active",
  );
  const clientTeam = engagement.engagement_members.filter(
    (m) => m.side === "client" && m.status !== "suspended",
  );
  // Financial visibility is a capability evaluated in the database (role
  // default plus any per-engagement override), not a role name. Phase 2
  // financial tables enforce the same check in RLS.
  const capabilities = await getMyEngagementCapabilities(engagement.id);
  const seesBilling = capabilities.has("view_financials");
  const finances = seesBilling
    ? await getEngagementFinances(engagement.id, getBusinessToday())
    : null;
  const summary = finances?.contract ? finances.summary : null;
  // Published domain states are shown to every client member of the engagement.
  const domainStates = await getDomainStates(engagement.id);
  const canRespond =
    capabilities.has("view_architecture") && capabilities.has("approve_architecture");
  const [pendingApprovals, decisions] = canRespond
    ? await Promise.all([
        getClientPendingApprovals(engagement.id),
        getClientDecisions(engagement.id),
      ])
    : [[], []];
  const openDecisions = decisions.filter(
    (d) => d.decision_status === "open" || d.decision_status === "recommended",
  ).length;
  const actions = await getClientActions(engagement.id);
  const myRequests = actions.filter(
    (a) => a.status === "open" && a.addressed_to_user_id === viewer.id,
  ).length;
  const awaitingCount = pendingApprovals.length + openDecisions + myRequests;
  const parts = [
    [myRequests, "request"],
    [pendingApprovals.length, "approval request"],
    [openDecisions, "decision"],
  ] as const;

  return (
    <div className="space-y-8">
      <EngagementNav slug={engagement.slug} engagementId={engagement.id} current="overview" />

      <PageHeader
        eyebrow={[
          engagement.organizations?.name,
          ENGAGEMENT_TYPE_LABELS[engagement.engagement_type],
        ]
          .filter(Boolean)
          .join(" · ")}
        title={engagement.title}
        description={<EngagementStatusTag status={engagement.status} />}
      />

      <Panel title="Project snapshot">
        <div className="space-y-6">
          {engagement.objective ? (
            <p className="max-w-3xl font-serif text-lg leading-relaxed text-ink">
              {engagement.objective}
            </p>
          ) : null}
          <DetailList
            items={[
              { label: "Current phase", value: engagement.current_phase },
              {
                label: "Engagement type",
                value: ENGAGEMENT_TYPE_LABELS[engagement.engagement_type],
              },
              { label: "Start date", value: formatDate(engagement.start_date) },
              { label: "Target completion", value: formatDate(engagement.target_end_date) },
            ]}
          />
        </div>
      </Panel>

      <Panel
        title="Where we are in the architecture"
        description={`Each domain moves through ${MATURITY_STATES.join(", ")}. The state is TPLCo's dated assessment.`}
      >
        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-rule bg-rule md:grid-cols-4">
          {ARCHITECTURE_DOMAINS.map((domain, index) => {
            const state = domainStates.find((s) => s.domain === domain.key);
            return (
              <li key={domain.key} className="space-y-2 bg-surface px-5 py-5">
                <p className="text-xs text-ink-subtle tabular-nums">0{index + 1}</p>
                <p className="font-serif text-base leading-snug text-ink">{domain.label}</p>
                <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">State</p>
                {state ? (
                  <>
                    <MaturityMark maturity={state.maturity} />
                    <p className="text-sm text-ink-muted">{state.rationale}</p>
                    <p className="text-xs text-ink-subtle">
                      {PROVENANCE_CLIENT_LABELS.architect_judgment} ·{" "}
                      {formatDate(state.assessed_at.slice(0, 10))}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">Not yet recorded</p>
                )}
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Panel
          title="What is required from us"
          actions={
            awaitingCount > 0 ? (
              <ButtonLink href={`/portal/${engagement.slug}/actions`} variant="secondary" size="sm">
                Respond
              </ButtonLink>
            ) : null
          }
        >
          {awaitingCount > 0 ? (
            <p className="text-sm text-ink">
              {awaitingCount} item{awaitingCount === 1 ? "" : "s"} awaiting your response:{" "}
              {parts
                .filter(([n]) => n > 0)
                .map(([n, label]) => `${n} ${label}${n === 1 ? "" : "s"}`)
                .join(", ")}
              .
            </p>
          ) : (
            <EmptyState title="Nothing requires your attention">
              Requests, approvals and decisions will appear here.
            </EmptyState>
          )}
        </Panel>
        <Panel title="Delivered and implemented">
          <EmptyState title="No deliverables yet">
            Deliverables and implementation status will appear here.
          </EmptyState>
        </Panel>
      </div>

      {seesBilling ? (
        <Panel
          title="Financial snapshot"
          actions={
            summary ? (
              <ButtonLink href={`/portal/${engagement.slug}/billing`} variant="secondary" size="sm">
                View billing
              </ButtonLink>
            ) : null
          }
        >
          {summary ? (
            <DetailList
              items={[
                {
                  label: "Revised contract value",
                  value: formatMoney(summary.revised_value_minor, summary.currency),
                },
                {
                  label: "Currently due",
                  value: formatMoney(summary.currently_due_minor, summary.currency),
                },
                {
                  label: "Next payment",
                  value: summary.next_payment_amount_minor
                    ? `${formatMoney(summary.next_payment_amount_minor, summary.currency)}${summary.next_payment_date ? ` · ${formatDate(summary.next_payment_date)}` : ""}`
                    : null,
                },
                {
                  label: "Net remaining to collect",
                  value: formatMoney(summary.net_remaining_to_collect_minor, summary.currency),
                },
              ]}
            />
          ) : (
            <EmptyState title="Billing information is not yet available">
              Contract, payment schedule and invoices will appear here.
            </EmptyState>
          )}
        </Panel>
      ) : null}

      <Panel title="Engagement team">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <TeamList heading="The Purple Lamb Company" members={internalTeam} />
          <TeamList heading={engagement.organizations?.name ?? "Your team"} members={clientTeam} />
        </div>
      </Panel>
    </div>
  );
}

function TeamList({
  heading,
  members,
}: {
  heading: string;
  members: {
    id: string;
    role: keyof typeof ROLE_LABELS;
    profiles: { first_name: string; last_name: string; email: string } | null;
  }[];
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">{heading}</p>
      <ul className="space-y-2">
        {members.map((member) => (
          <li key={member.id} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-ink">{personName(member.profiles)}</span>
            <span className="text-ink-muted">{ROLE_LABELS[member.role]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
