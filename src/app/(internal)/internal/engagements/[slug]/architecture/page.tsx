import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/format";
import { recordDomainAssessment } from "@/domain/architecture/actions";
import {
  DOMAINS,
  DOMAIN_LABELS,
  DOMAIN_QUESTIONS,
  DOMAIN_SHORT_LABELS,
  DOMAIN_SLUGS,
  MATURITY_LABELS,
  MATURITY_STATES,
} from "@/domain/architecture/catalog";
import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import {
  getDomainStates,
  getArchitectureActivity,
  getMaturityDistribution,
  listDomainAssessments,
  loadArchitecture,
} from "@/domain/architecture/queries";
import { ActivityList } from "@/components/architecture/activity-list";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { InternalMark, MaturityMark } from "@/components/architecture/badges";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Table, Td, Th } from "@/components/ui/table";

export default async function ArchitectureHomePage({
  params,
}: PageProps<"/internal/engagements/[slug]/architecture">) {
  const { slug } = await params;
  const { engagement, canEdit, canPublish } = await getInternalArchitectureContext(slug);
  const [architecture, states, distribution, history, activity] = await Promise.all([
    loadArchitecture(engagement.id),
    getDomainStates(engagement.id),
    getMaturityDistribution(engagement.id),
    listDomainAssessments(engagement.id),
    getArchitectureActivity(engagement.id, 25),
  ]);
  const nameOf = memberNames(engagement);

  const live = architecture.elements.filter(
    (e) => e.lifecycle !== "retired" && e.lifecycle !== "superseded",
  );
  const inReview = live.filter((e) => e.lifecycle === "in_review").length;
  const awaitingClient = architecture.approvals.filter((a) => a.response === null).length;
  const openDecisions = live.filter(
    (e) =>
      e.record?.kind === "decision" &&
      (e.record.row.decision_status === "open" || e.record.row.decision_status === "recommended"),
  ).length;
  const workingCopies = live.filter((e) => e.lifecycle === "draft").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.organizations?.name, "Architecture"].filter(Boolean).join(" · ")}
        title={engagement.title}
        description="The four domains of the Development Architecture Method, as structured, versioned architecture."
      />
      <ArchitectureNav slug={slug} current="home" />

      <section
        aria-label="Architecture at a glance"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-rule bg-rule md:grid-cols-4"
      >
        <Figure
          label="Drafts"
          value={workingCopies}
          href={`/internal/engagements/${slug}/reviews`}
        />
        <Figure label="In review" value={inReview} href={`/internal/engagements/${slug}/reviews`} />
        <Figure
          label="Awaiting client response"
          value={awaitingClient}
          href={`/internal/engagements/${slug}/reviews`}
        />
        <Figure
          label="Open decisions"
          value={openDecisions}
          href={`/internal/engagements/${slug}/intelligence?kind=decision`}
        />
      </section>

      <Panel
        title="Where the architecture stands"
        description="Each domain's state is an architect's dated judgment. The object counts beneath it are calculated supporting information, not a score."
      >
        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-rule bg-rule lg:grid-cols-2">
          {DOMAINS.map((domain, index) => {
            const state = states.find((s) => s.domain === domain);
            const counts = distribution.filter((d) => d.domain === domain && d.object_count > 0);
            const total = counts.reduce((sum, d) => sum + d.object_count, 0);
            return (
              <li key={domain} className="space-y-3 bg-surface px-5 py-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-xs text-ink-subtle tabular-nums">0{index + 1}</p>
                    <Link
                      href={`/internal/engagements/${slug}/architecture/${DOMAIN_SLUGS[domain]}`}
                      className="font-serif text-lg text-ink hover:underline"
                    >
                      {DOMAIN_LABELS[domain]}
                    </Link>
                    <p className="text-sm text-ink-muted">{DOMAIN_QUESTIONS[domain]}</p>
                  </div>
                  {state ? <MaturityMark maturity={state.maturity} /> : null}
                </div>
                {state ? (
                  <div className="space-y-1">
                    <p className="text-sm text-ink">{state.rationale}</p>
                    <p className="flex items-center gap-2 text-xs text-ink-subtle">
                      Assessed {formatDate(state.assessed_at.slice(0, 10))} by{" "}
                      {nameOf(state.assessed_by)}
                      {state.client_visible ? null : <InternalMark />}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-subtle">No assessment recorded yet.</p>
                )}
                <p className="border-t border-rule pt-3 text-xs text-ink-muted">
                  <span className="mr-2 tracking-wide text-ink-subtle uppercase">Calculated</span>
                  {total === 0
                    ? "No objects yet."
                    : `${total} object${total === 1 ? "" : "s"}: ` +
                      MATURITY_STATES.filter((m) => counts.some((c) => c.maturity === m))
                        .map(
                          (m) =>
                            `${counts.find((c) => c.maturity === m)!.object_count} ${MATURITY_LABELS[m].toLowerCase()}`,
                        )
                        .join(", ")}
                </p>
              </li>
            );
          })}
        </ol>
      </Panel>

      {canPublish ? (
        <Panel
          title="Record a domain assessment"
          description="A dated judgment with its rationale. Earlier assessments stay in the history."
        >
          <ActionForm
            fields={[
              {
                name: "domain",
                label: "Domain",
                type: "select",
                options: DOMAINS.map((d) => ({ value: d, label: DOMAIN_LABELS[d] })),
              },
              {
                name: "maturity",
                label: "State",
                type: "select",
                options: MATURITY_STATES.map((m) => ({ value: m, label: MATURITY_LABELS[m] })),
              },
              { name: "rationale", label: "Rationale", type: "textarea" },
              {
                name: "clientVisible",
                label: "Show to the client",
                type: "select",
                options: [
                  { value: "yes", label: "Yes, on the client overview" },
                  { value: "no", label: "No, internal only" },
                ],
              },
            ]}
            defaultValues={{ domain: "knowledge", maturity: "emerging", clientVisible: "yes" }}
            action={recordDomainAssessment.bind(null, engagement.id)}
            submitLabel="Record assessment"
            trigger="Record assessment"
          />
        </Panel>
      ) : null}

      <Panel title="Assessment history">
        {history.length === 0 ? (
          <EmptyState title="No assessments yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Domain</Th>
                <Th>State</Th>
                <Th>Rationale</Th>
                <Th>Recorded</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap">{DOMAIN_SHORT_LABELS[a.domain]}</Td>
                  <Td className="whitespace-nowrap">{MATURITY_LABELS[a.maturity]}</Td>
                  <Td className="text-ink-muted">
                    {a.rationale} {a.client_visible ? null : <InternalMark />}
                  </Td>
                  <Td className="text-xs whitespace-nowrap text-ink-muted">
                    {formatDateTime(a.assessed_at)}
                    <br />
                    {nameOf(a.assessed_by)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {canEdit || activity.length > 0 ? (
        <Panel
          title="Recent activity"
          description="Architecture events on this engagement: drafting, review, publication, relationships, evidence, approvals, decisions, assessments and baselines."
        >
          <ActivityList
            events={activity}
            slug={slug}
            elementOf={(id) => architecture.byId.get(id) ?? null}
          />
        </Panel>
      ) : null}
    </div>
  );
}

function Figure({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="block bg-surface px-5 py-4 hover:bg-surface-muted">
      <p className="text-xs tracking-wide text-ink-subtle uppercase">{label}</p>
      <p className="mt-1 font-serif text-2xl text-ink tabular-nums">{value}</p>
    </Link>
  );
}
