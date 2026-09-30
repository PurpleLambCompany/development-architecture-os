import { notFound } from "next/navigation";
import { getClientArchitectureContext } from "@/domain/architecture/context";
import { getClientArchitecture, getClientRelationships } from "@/domain/architecture/queries";
import { IMPLEMENTATION_CHECKPOINT_TYPE_LABELS, IMPLEMENTATION_STATUS, categoryLabel } from "@/domain/implementation/catalog";
import { getClientImplementation } from "@/domain/implementation/queries";
import { formatDate } from "@/lib/format";
import { ReferenceCode } from "@/components/architecture/badges";
import { EngagementNav } from "@/components/portal/engagement-nav";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

/**
 * Published implementation initiatives, grouped by the architecture element
 * they implement. Never internal stewardship, owner assignments or a
 * non-client-visible checkpoint (proposal §16) — client_implementation
 * already returns only what a published version and client_visible
 * checkpoints make available.
 */
export default async function ClientImplementationPage({
  params,
}: PageProps<"/portal/[slug]/implementation">) {
  const { slug } = await params;
  const { engagement, canView } = await getClientArchitectureContext(slug);
  if (!canView) notFound();
  const [initiatives, relationships, architecture] = await Promise.all([
    getClientImplementation(engagement.id),
    getClientRelationships(engagement.id),
    getClientArchitecture(engagement.id),
  ]);
  const titleOf = new Map(architecture.map((r) => [r.element_id, r]));
  const implementsMap = new Map<string, string[]>();
  for (const r of relationships) {
    if (r.relationship_type !== "implements") continue;
    implementsMap.set(r.source_element_id, [
      ...(implementsMap.get(r.source_element_id) ?? []),
      r.target_element_id,
    ]);
  }

  // Group by the (first) element implemented; an initiative with no
  // resolvable target (unlikely: implements is required at creation) falls
  // under "Other".
  const groups = new Map<string, typeof initiatives>();
  for (const initiative of initiatives) {
    const targets = implementsMap.get(initiative.element_id) ?? [];
    const key = targets[0] ?? "other";
    groups.set(key, [...(groups.get(key) ?? []), initiative]);
  }

  return (
    <div className="space-y-8">
      <EngagementNav slug={slug} engagementId={engagement.id} current="implementation" />
      <PageHeader
        eyebrow={engagement.organizations?.name ?? "Implementation"}
        title="Implementation"
        description="Published initiatives realizing the architecture, grouped by what they implement — status, target date and the milestones reached so far."
      />

      {initiatives.length === 0 ? (
        <Panel title="Implementation">
          <EmptyState title="No published initiatives yet" />
        </Panel>
      ) : (
        [...groups.entries()].map(([targetId, rows]) => {
          const target = titleOf.get(targetId);
          return (
            <Panel key={targetId} title={target ? target.client_snapshot.title : "Other"}>
              <div className="space-y-6">
                {rows.map((row) => {
                  const status = IMPLEMENTATION_STATUS[row.implementation_status];
                  const checkpoints = (row.checkpoints ?? []) as {
                    id: string;
                    checkpoint_type: string;
                    title: string;
                    target_on: string | null;
                    achieved_on: string | null;
                  }[];
                  return (
                    <div key={row.element_id} className="space-y-2 border-l-2 border-accent/40 pl-4">
                      <p className="flex flex-wrap items-center gap-2">
                        <ReferenceCode code={row.reference_code} />
                        <span className="font-serif text-base text-ink">{row.title}</span>
                        <span className="text-xs text-ink-subtle">{categoryLabel(row.category)}</span>
                        <StatusTag tone={status.tone}>{status.label}</StatusTag>
                      </p>
                      {row.summary ? <p className="max-w-2xl text-sm text-ink">{row.summary}</p> : null}
                      {row.target_operational_on ? (
                        <p className="text-xs text-ink-muted">
                          Target {formatDate(row.target_operational_on)}
                        </p>
                      ) : null}
                      {checkpoints.length > 0 ? (
                        <ul className="space-y-1 text-sm text-ink-muted">
                          {checkpoints.map((c) => (
                            <li key={c.id}>
                              {c.achieved_on ? (
                                <span>
                                  {IMPLEMENTATION_CHECKPOINT_TYPE_LABELS[
                                    c.checkpoint_type as keyof typeof IMPLEMENTATION_CHECKPOINT_TYPE_LABELS
                                  ] ?? c.title}
                                  {": "}
                                  {c.title} — {formatDate(c.achieved_on)}
                                </span>
                              ) : (
                                <span>
                                  {c.title}
                                  {c.target_on ? ` (targeted ${formatDate(c.target_on)})` : ""}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Panel>
          );
        })
      )}
    </div>
  );
}
