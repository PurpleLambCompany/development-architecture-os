import Link from "next/link";
import type { ReactNode } from "react";
import { NOT_OFFERED_COPY } from "@/domain/architecture-intelligence/experience/gate";
import { getLayer2 } from "@/domain/architecture-intelligence/experience/queries";
import {
  ACTION_LABELS,
  DRAWER_QUESTIONS,
  drawerQuery,
  type DrawerSubject,
} from "@/domain/architecture-intelligence/experience/subjects";
import { viewFromDetail } from "@/domain/architecture-intelligence/experience/view";
import { LAYER_LABELS } from "@/domain/architecture-intelligence/experience/words";
import { DrawerKeys } from "./drawer-keys";
import { InterpretationLayer } from "./interpretation-layer";

/**
 * The standard intelligence drawer (7B.2 proposal §6). Three fixed layers in
 * the same order on every surface and device: what DSA knows (complete,
 * deterministic, never collapsed), the interpretation (holders only; absent,
 * with no heading or placeholder, for everyone else) and judgment (the item
 * and the interpretation judged separately). A drawer on desktop, a full
 * sheet below `md`. Its state is the URL, so it links and reloads; opening
 * it never calls a model.
 */
export async function IntelligenceDrawer({
  engagementId,
  slug,
  subject,
  subjectLine,
  closeHref,
  canJudge,
  layer1,
  itemJudgment,
  keepLabel = "Keep",
  promotionsFor,
}: {
  engagementId: string;
  slug: string;
  subject: DrawerSubject;
  /** e.g. "CAP-004 · Capability · v3 published 12 Sept" */
  subjectLine: ReactNode;
  closeHref: string;
  canJudge: boolean;
  layer1: ReactNode;
  itemJudgment?: ReactNode;
  keepLabel?: string;
  /** Deterministic governed promotions for a kept interpretation, by its id. */
  promotionsFor?: (inferenceId: string) => { label: string; href: string }[];
}) {
  const layer2 = await getLayer2(engagementId, subject);
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Intelligence">
      <DrawerKeys closeHref={closeHref} />
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close"
        className="absolute inset-0 hidden bg-ink/20 md:block"
      />
      <aside className="absolute inset-0 flex flex-col overflow-y-auto bg-surface md:inset-y-0 md:right-0 md:left-auto md:w-[36rem] md:border-l md:border-rule md:shadow-xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-rule bg-surface px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm text-ink-muted">{subjectLine}</div>
            <h2 className="mt-0.5 font-serif text-lg text-ink">
              {DRAWER_QUESTIONS[subject.drawer]}
            </h2>
          </div>
          <Link
            href={closeHref}
            scroll={false}
            className="shrink-0 rounded-sm border border-rule px-2 py-1 text-sm text-ink-muted hover:text-ink"
          >
            Close
          </Link>
        </header>
        <section className="space-y-3 px-5 py-4" aria-label={LAYER_LABELS.knows}>
          <h3 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
            {LAYER_LABELS.knows}
          </h3>
          {layer1}
        </section>
        {layer2.gate.state === "absent" ? (
          itemJudgment ? (
            <section
              className="space-y-3 border-t border-rule px-5 py-4"
              aria-label={LAYER_LABELS.judgment}
            >
              <h3 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
                {LAYER_LABELS.judgment}
              </h3>
              {itemJudgment}
            </section>
          ) : null
        ) : "kind" in layer2 ? (
          <InterpretationLayer
            key={drawerQuery(subject)}
            engagementId={engagementId}
            slug={slug}
            kind={layer2.kind}
            subjectQuery={drawerQuery(subject)}
            actionLabel={ACTION_LABELS[layer2.kind]}
            gate={layer2.gate}
            notOfferedText={NOT_OFFERED_COPY[subject.drawer]}
            kept={
              layer2.kept
                ? {
                    id: layer2.kept.id,
                    view: viewFromDetail(layer2.kept),
                    state: layer2.kept.state,
                    staleReasons: layer2.kept.stale_reasons,
                    judgments: layer2.kept.judgments,
                  }
                : null
            }
            reusable={layer2.reusable}
            suppressed={layer2.suppressed}
            canJudge={canJudge}
            keepLabel={keepLabel}
            promotions={
              layer2.kept && layer2.kept.state === "current" && promotionsFor
                ? promotionsFor(layer2.kept.id)
                : []
            }
            authorizerHref={`/internal/engagements/${slug}/architecture-intelligence`}
            itemJudgment={itemJudgment}
          />
        ) : null}
      </aside>
    </div>
  );
}
