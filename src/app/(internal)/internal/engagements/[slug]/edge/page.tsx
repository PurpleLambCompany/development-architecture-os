import Link from "next/link";
import { getInternalArchitectureContext } from "@/domain/architecture/context";
import { briefingWindow, isNewSince } from "@/domain/edge/briefing";
import { eventsForList, groupEdgeItems } from "@/domain/edge/grouping";
import { getBriefingMark, getDevelopmentChanges, getEdgeItems } from "@/domain/edge/queries";
import {
  EDGE_LENSES,
  EDGE_LENS_LABELS,
  EPISTEMIC_DEFINITIONS,
  EPISTEMIC_LABELS,
  EPISTEMIC_STATUSES,
} from "@/domain/edge/rules";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { BriefingPanel } from "@/components/edge/briefing";
import { EdgeEventCard } from "@/components/edge/edge-event";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

export default async function EdgePage({
  params,
  searchParams,
}: PageProps<"/internal/engagements/[slug]/edge">) {
  const { slug } = await params;
  const query = await searchParams;
  const { engagement, canEdit } = await getInternalArchitectureContext(slug);
  const lens =
    typeof query.lens === "string" && (EDGE_LENSES as readonly string[]).includes(query.lens)
      ? query.lens
      : null;
  const status =
    typeof query.status === "string" &&
    (EPISTEMIC_STATUSES as readonly string[]).includes(query.status)
      ? query.status
      : null;
  const judgedView = query.view === "judged";

  const [items, mark] = await Promise.all([
    getEdgeItems(engagement.id, { includeJudged: judgedView }),
    getBriefingMark(engagement.id),
  ]);
  const window = briefingWindow(mark, new Date());
  const changes = judgedView
    ? []
    : await getDevelopmentChanges(engagement.id, { since: window.since, limit: 200 });

  const filtered = items.filter(
    (i) =>
      (!lens || i.lens === lens) &&
      (!status || i.epistemic_status === status) &&
      (judgedView ? i.judged : true),
  );
  const events = groupEdgeItems(filtered);
  const listed = judgedView ? events : eventsForList(events);
  const flagged = listed.filter((e) => e.tier === "human_flagged");
  const rest = listed.filter((e) => e.tier !== "human_flagged");
  const ambientOnly = events.length - eventsForList(events).length;
  const newEvents = judgedView
    ? []
    : eventsForList(groupEdgeItems(items)).filter((e) =>
        e.items.some((i) => isNewSince(i, window.since)),
      );

  const base = `/internal/engagements/${slug}/edge`;
  const href = (next: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { lens, status, view: judgedView ? "judged" : null, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const chip = (active: boolean) =>
    cn(
      "rounded-sm border px-2 py-0.5 text-xs",
      active ? "border-accent text-ink" : "border-rule text-ink-muted hover:text-ink",
    );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={engagement.title}
        title="Development Edge"
        description="Where the development has moved and what that movement may bear on, from deterministic rules over governed records. Advisory throughout: each item is a prompt to examine, never a conclusion, and every one says why it is here."
      />
      <ArchitectureNav slug={slug} current="edge" />

      {judgedView ? null : (
        <BriefingPanel
          slug={slug}
          engagementId={engagement.id}
          window={window}
          changes={changes}
          newEvents={newEvents}
        />
      )}

      <nav className="flex flex-wrap items-center gap-2" aria-label="Filter the Edge">
        <span className="text-xs tracking-wide text-ink-subtle uppercase">Lens</span>
        <Link href={href({ lens: null })} className={chip(!lens)}>
          All
        </Link>
        {EDGE_LENSES.map((l) => (
          <Link key={l} href={href({ lens: l })} className={chip(lens === l)}>
            {EDGE_LENS_LABELS[l]}
          </Link>
        ))}
        <span className="ml-4 text-xs tracking-wide text-ink-subtle uppercase">Kind of claim</span>
        <Link href={href({ status: null })} className={chip(!status)}>
          All
        </Link>
        {EPISTEMIC_STATUSES.map((s) => (
          <Link
            key={s}
            href={href({ status: s })}
            className={chip(status === s)}
            title={EPISTEMIC_DEFINITIONS[s]}
          >
            {EPISTEMIC_LABELS[s]}
          </Link>
        ))}
        <span className="ml-auto" />
        <Link
          href={href({ view: judgedView ? null : "judged" })}
          className="text-sm text-ink-muted hover:underline"
        >
          {judgedView ? "Back to the Edge" : "Judged items"}
        </Link>
      </nav>

      {flagged.length > 0 ? (
        <Panel
          title="Escalated or marked critical by the team"
          description="Placed here only by a person: an open escalation or critical attention on the record."
          className="border-attention/40"
        >
          {flagged.map((event) => (
            <div key={event.key} id={encodeURIComponent(event.key)}>
              <EdgeEventCard
                slug={slug}
                engagementId={engagement.id}
                event={event}
                canJudge={canEdit && !judgedView}
              />
            </div>
          ))}
        </Panel>
      ) : null}

      <Panel
        title={judgedView ? "Judged items" : "To consider"}
        description={
          judgedView
            ? "Items a person has judged, with who, when and why. A later change to an item's facts brings it back."
            : `Governance approaching first, then by reach and your responsibility. No score: every position is explained.${ambientOnly > 0 ? ` ${ambientOnly} further ${ambientOnly === 1 ? "condition appears" : "conditions appear"} only on the records they concern.` : ""}`
        }
      >
        {rest.length === 0 ? (
          <EmptyState title={judgedView ? "Nothing judged yet" : "Nothing to consider"}>
            {judgedView ? null : "No rule holds at Attention or above for these filters."}
          </EmptyState>
        ) : (
          rest.map((event) => (
            <div key={event.key} id={encodeURIComponent(event.key)}>
              <EdgeEventCard
                slug={slug}
                engagementId={engagement.id}
                event={event}
                canJudge={canEdit && !judgedView}
              />
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
