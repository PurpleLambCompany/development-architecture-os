import { getInternalArchitectureContext, memberNames } from "@/domain/architecture/context";
import { loadArchitecture } from "@/domain/architecture/queries";
import { handleContribution } from "@/domain/intelligence/actions";
import {
  getClientActions,
  getContributions,
  getSignals,
  getStatementOptions,
} from "@/domain/intelligence/queries";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ElementLink } from "@/components/architecture/badges";
import { ContributionCard } from "@/components/intelligence/contribution-card";
import { handleContributionFields } from "@/components/intelligence/fields";
import { IntelligenceNav } from "@/components/intelligence/intelligence-nav";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";

export default async function ClientInputPage({
  params,
}: PageProps<"/internal/engagements/[slug]/intelligence/input">) {
  const { slug } = await params;
  const { engagement, canEdit } = await getInternalArchitectureContext(slug);
  const [contributions, actions, signals, architecture, statements] = await Promise.all([
    getContributions(engagement.id),
    getClientActions(engagement.id),
    getSignals(engagement.id),
    loadArchitecture(engagement.id),
    getStatementOptions(engagement.id),
  ]);
  const name = memberNames(engagement);
  const received = contributions.filter((c) => c.status === "received");
  const handled = contributions.filter((c) => c.status !== "received");
  const card = (c: (typeof contributions)[number]) => {
    const element = architecture.byId.get(c.element_id);
    return (
      <ContributionCard
        key={c.id}
        contribution={c}
        name={name}
        element={element ? <ElementLink slug={slug} element={element} /> : null}
        controls={
          canEdit && c.status === "received" ? (
            <ActionForm
              trigger="Handle"
              fields={handleContributionFields(
                statements
                  .filter((s) => s.element_id === c.element_id)
                  .map((s) => ({ value: s.id, label: s.body.slice(0, 100) })),
              )}
              defaultValues={{ status: "incorporated", recordAsEvidence: "no" }}
              action={handleContribution.bind(null, c.id)}
              submitLabel="Save"
            />
          ) : null
        }
      />
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={[engagement.title, "Project Intelligence"].join(" · ")}
        title="Client input"
        description="Input client members add on published elements they can see. Each is incorporated or acknowledged with a note the contributor reads, and may be recorded as evidence."
      />
      <ArchitectureNav slug={slug} current="intelligence" />
      <IntelligenceNav
        slug={slug}
        current="input"
        counts={{
          requests: actions.filter((a) => a.status === "open" || a.status === "responded").length,
          input: received.length,
          signals: signals.filter((s) => !s.dismissed).length,
        }}
      />
      <Panel title="Received" description="Not yet handled, oldest first.">
        {received.length === 0 ? (
          <EmptyState title="Nothing waiting" />
        ) : (
          <div className="space-y-4">{[...received].reverse().map(card)}</div>
        )}
      </Panel>
      <Panel title="Handled">
        {handled.length === 0 ? (
          <EmptyState title="None yet" />
        ) : (
          <div className="space-y-4">{handled.map(card)}</div>
        )}
      </Panel>
    </div>
  );
}
