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
import { ROLE_LABELS } from "@/domain/roles/roles";
import { EngagementStatusTag } from "@/components/engagements/engagement-status";
import { NavPlaceholder } from "@/components/shell/nav-link";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";

/** Client navigation from spec §7. Only Overview is live in Phase 1. */
const CLIENT_SECTIONS = [
  "Architecture",
  "Decisions",
  "Actions",
  "Reviews",
  "Documents",
  "Implementation",
  "Billing",
  "Messages",
];

export default async function ClientEngagementPage({ params }: PageProps<"/portal/[slug]">) {
  const { slug } = await params;
  await requireClient();
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

  return (
    <div className="space-y-8">
      <nav
        className="-mt-4 flex flex-wrap gap-x-1 border-b border-rule text-sm"
        aria-label="Engagement"
      >
        <span aria-current="page" className="-mb-px border-b-2 border-accent px-3 py-2 text-ink">
          Overview
        </span>
        {CLIENT_SECTIONS.filter((s) => s !== "Billing" || seesBilling).map((section) => (
          <span key={section} className="px-0 py-0.5">
            <NavPlaceholder>{section}</NavPlaceholder>
          </span>
        ))}
      </nav>

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
        description={`Each domain moves through ${MATURITY_STATES.join(", ")}.`}
      >
        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-rule bg-rule md:grid-cols-4">
          {ARCHITECTURE_DOMAINS.map((domain, index) => (
            <li key={domain.key} className="bg-surface px-5 py-5">
              <p className="text-xs text-ink-subtle tabular-nums">0{index + 1}</p>
              <p className="mt-1 font-serif text-base leading-snug text-ink">{domain.label}</p>
              <p className="mt-3 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                State
              </p>
              <p className="text-sm text-ink-muted">Not yet recorded</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Panel title="Decisions and actions required">
          <EmptyState title="Nothing requires your attention">
            Requests, approvals and decisions will appear here.
          </EmptyState>
        </Panel>
        <Panel title="Delivered and implemented">
          <EmptyState title="No deliverables yet">
            Deliverables and implementation status will appear here.
          </EmptyState>
        </Panel>
      </div>

      {seesBilling ? (
        <Panel title="Financial snapshot">
          <EmptyState title="Billing information is not yet available">
            Contract, payment schedule and invoices will appear here.
          </EmptyState>
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
