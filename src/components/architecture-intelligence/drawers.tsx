import Link from "next/link";
import { ReferenceCode } from "@/components/architecture/badges";
import { judgmentFields } from "@/components/edge/judgment-fields";
import { ActionForm } from "@/components/ui/action-form";
import { getVersionSnapshot, loadArchitecture } from "@/domain/architecture/queries";
import { relationshipType } from "@/domain/architecture/rules";
import { internalElementHref } from "@/domain/architecture/links";
import {
  getReviewDossier,
  getStatementBody,
  getSupportsAndExposures,
} from "@/domain/architecture-intelligence/experience/layer1-queries";
import type { DrawerSubject } from "@/domain/architecture-intelligence/experience/subjects";
import { judgeEdgeItem } from "@/domain/edge/actions";
import { PROMOTION_LABELS, type PromotionTargetKind } from "@/domain/edge/promotion";
import { getEdgeItems, getElementRevisions, getImpactTrace } from "@/domain/edge/queries";
import { getCheckpoints, getStatusHistory } from "@/domain/implementation/queries";
import { getCriteriaInForce } from "@/domain/methodology/queries";
import { itemLine } from "@/domain/edge/words";
import { formatDate } from "@/lib/format";
import { ReviewDossierView } from "./dossier";
import { IntelligenceDrawer } from "./drawer";
import {
  EdgeItemFacts,
  FactList,
  FactSection,
  PairFacts,
  RevisionFacts,
  TraceFacts,
} from "./layer1";
import { EvidenceLinkFacts } from "./supports";

/**
 * One server component per drawer subject (7B.2 proposal §6.3, §7). Each
 * reads its own layer 1 as the signed-in user and hands the subject to the
 * standard drawer. A subject that cannot be read shows "This record is no
 * longer available." in place of layer 1, with no interpretation layer.
 */

type DrawerProps = {
  engagementId: string;
  slug: string;
  subject: DrawerSubject;
  closeHref: string;
  canJudge: boolean;
};

const CRITERION_HOLDERS = ["object", "implementation_initiative"];

/** Governed promotions offered on a kept interpretation: the same closed set as the Edge (IX-20). */
function promotionsFor(slug: string, element: { id: string; kind: string } | undefined) {
  return (inferenceId: string) => {
    const base = `/internal/engagements/${slug}`;
    const q = (extra: Record<string, string> = {}) =>
      new URLSearchParams({ promoteInference: inferenceId, ...extra }).toString();
    const targets: { kind: PromotionTargetKind; href: string }[] = [
      { kind: "risk", href: `${base}/intelligence?${q({ new: "risk" })}` },
      { kind: "decision", href: `${base}/intelligence?${q({ new: "decision" })}` },
      { kind: "review", href: `${base}/reviews?${q()}` },
    ];
    if (element && CRITERION_HOLDERS.includes(element.kind))
      targets.push({
        kind: "acceptance_criterion",
        href: `${internalElementHref(slug, element.kind as never, element.id)}?${q()}#criteria`,
      });
    return targets.map((t) => ({ label: PROMOTION_LABELS[t.kind], href: t.href }));
  };
}

function Unavailable({ closeHref }: { closeHref: string }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-ink/20 p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="mt-20 rounded-sm border border-rule bg-surface px-5 py-4 text-sm text-ink-muted">
        This record is no longer available.{" "}
        <Link href={closeHref} scroll={false} className="underline hover:text-ink">
          Close
        </Link>
      </div>
    </div>
  );
}

export async function SubjectDrawer(props: DrawerProps) {
  const { engagementId, slug, subject, closeHref, canJudge } = props;
  const architecture = await loadArchitecture(engagementId);
  const element = architecture.byId.get(subject.elementId);
  if (!element) return <Unavailable closeHref={closeHref} />;
  const line = (
    <span>
      <ReferenceCode code={element.reference_code} /> {element.title}
      {element.latestVersion
        ? ` · v${element.latestVersion.version_no} published ${formatDate(element.latestVersion.published_at)}`
        : ""}
    </span>
  );
  const common = {
    engagementId,
    slug,
    subject,
    closeHref,
    canJudge,
    subjectLine: line,
    promotionsFor: promotionsFor(slug, element),
  };

  switch (subject.drawer) {
    case "edge": {
      const items = await getEdgeItems(engagementId, {
        subjectId: subject.elementId,
        subjectType: "element",
        includeJudged: true,
      });
      const item = items.find(
        (i) =>
          i.rule_key === subject.ruleKey &&
          i.fingerprint === subject.fingerprint &&
          i.subject_type === "element" &&
          i.subject_id === subject.elementId,
      );
      if (!item) return <Unavailable closeHref={closeHref} />;
      return (
        <IntelligenceDrawer
          {...common}
          layer1={<EdgeItemFacts item={item} slug={slug} />}
          itemJudgment={
            canJudge && !item.judged ? (
              <ActionForm
                trigger="Judge the item"
                fields={judgmentFields}
                defaultValues={{ kind: "investigating" }}
                action={judgeEdgeItem.bind(null, engagementId, {
                  ruleKey: item.rule_key,
                  subjectType: item.subject_type,
                  subjectId: item.subject_id,
                  fingerprint: item.fingerprint,
                })}
                submitLabel="Record judgment"
              />
            ) : undefined
          }
        />
      );
    }
    case "revision": {
      const revisions = await getElementRevisions(engagementId, subject.elementId);
      const rev = revisions.find((r) => r.version_id === subject.versionId);
      if (!rev) return <Unavailable closeHref={closeHref} />;
      const fromNo =
        element.versions.find((v) => v.id === rev.previous_version_id)?.version_no ?? null;
      const [before, after] = await Promise.all([
        rev.previous_version_id ? getVersionSnapshot(rev.previous_version_id) : null,
        getVersionSnapshot(rev.version_id),
      ]);
      const touched = [rev.previous_version_id, rev.version_id];
      const approvals = architecture.approvals
        .filter((a) => a.element_version_id && touched.includes(a.element_version_id))
        .map((a) => {
          const no = element.versions.find((v) => v.id === a.element_version_id)?.version_no;
          return `v${no}: ${a.response ? `${a.response.replaceAll("_", " ")}${a.responded_at ? ` ${formatDate(a.responded_at)}` : ""}` : `requested ${formatDate(a.requested_at)}`}`;
        });
      return (
        <IntelligenceDrawer
          {...common}
          layer1={
            <RevisionFacts
              code={element.reference_code ?? ""}
              fromNo={fromNo}
              toNo={rev.version_no}
              publishedAt={rev.published_at}
              changedPaths={rev.changed_paths ?? []}
              changeSummary={rev.change_summary ?? ""}
              before={before as never}
              after={after as never}
              statusPublications={revisions
                .filter(
                  (r) =>
                    r.change_type === "status_publication" &&
                    r.version_no < rev.version_no &&
                    (fromNo === null || r.version_no > fromNo),
                )
                .map((r) => ({ versionNo: r.version_no, publishedAt: r.published_at }))}
              approvals={approvals}
            />
          }
        />
      );
    }
    case "trace": {
      const [trace, items] = await Promise.all([
        getImpactTrace(subject.elementId),
        getEdgeItems(engagementId),
      ]);
      const reached = new Set(trace.map((r) => r.reached_id));
      return (
        <IntelligenceDrawer
          {...common}
          layer1={
            <TraceFacts
              slug={slug}
              code={element.reference_code ?? ""}
              trace={trace}
              reachedItems={items.filter((i) => reached.has(i.subject_id) && !i.judged)}
            />
          }
        />
      );
    }
    case "pair": {
      const other = architecture.byId.get(subject.secondElementId);
      if (!other) return <Unavailable closeHref={closeHref} />;
      const [revisions, items] = await Promise.all([
        getElementRevisions(engagementId),
        getEdgeItems(engagementId),
      ]);
      const lastSubstantive = (id: string) =>
        revisions
          .filter((r) => r.element_id === id && r.change_type === "substantive_revision")
          .map((r) => r.published_at)
          .sort()
          .at(-1) ?? null;
      const ids = [element.id, other.id];
      const side = (e: typeof element) => ({
        id: e.id,
        code: e.reference_code ?? "",
        title: e.title,
        kind: e.kind,
        versionNo: e.latestVersion?.version_no ?? null,
        publishedAt: e.latestVersion?.published_at ?? null,
        lastSubstantiveAt: lastSubstantive(e.id),
      });
      const relationships = architecture.relationships
        .filter(
          (r) =>
            !r.retired_at && ids.includes(r.source_element_id) && ids.includes(r.target_element_id),
        )
        .map((r) => {
          const from = architecture.byId.get(r.source_element_id);
          const to = architecture.byId.get(r.target_element_id);
          return `${from?.reference_code} ${relationshipType(r.relationship_type)?.label.toLowerCase() ?? r.relationship_type} ${to?.reference_code}`;
        });
      const reads = (i: (typeof items)[number]) => {
        const touched = new Set([
          i.subject_id,
          i.trigger_subject_id,
          ...(i.basis ?? []).map((b) => b.id),
          ...(i.consequence_path ?? []).map((s) => s.to_id),
        ]);
        return ids.every((id) => touched.has(id));
      };
      return (
        <IntelligenceDrawer
          {...common}
          subjectLine={
            <span>
              <ReferenceCode code={element.reference_code} /> and{" "}
              <ReferenceCode code={other.reference_code} />
            </span>
          }
          layer1={
            <PairFacts
              slug={slug}
              a={side(element)}
              b={side(other)}
              relationships={relationships}
              sharedItems={items.filter((i) => !i.judged && reads(i))}
            />
          }
        />
      );
    }
    case "evidence": {
      const supports = await getSupportsAndExposures(engagementId, subject.elementId);
      const link = supports.evidence.find(
        (e) => e.link_id === subject.linkId && e.link_type === subject.linkType,
      );
      if (!link) return <Unavailable closeHref={closeHref} />;
      const body = link.statement_id ? await getStatementBody(link.statement_id) : null;
      return (
        <IntelligenceDrawer
          {...common}
          layer1={
            <EvidenceLinkFacts
              link={link}
              statementBody={body}
              elementLabel={`${element.reference_code} ${element.title}`}
            />
          }
        />
      );
    }
    case "review": {
      const dossier = await getReviewDossier(engagementId, subject.elementId);
      if (!dossier) return <Unavailable closeHref={closeHref} />;
      return (
        <IntelligenceDrawer
          {...common}
          keepLabel="Keep for this Review"
          layer1={
            <ReviewDossierView
              dossier={dossier}
              slug={slug}
              edgeHref={`/internal/engagements/${slug}/edge?view=judged`}
            />
          }
        />
      );
    }
    case "initiative": {
      if (element.kind !== "implementation_initiative")
        return <Unavailable closeHref={closeHref} />;
      const [history, checkpoints, criteria, items] = await Promise.all([
        getStatusHistory(element.id),
        getCheckpoints(element.id),
        getCriteriaInForce(element.id),
        getEdgeItems(engagementId, { subjectId: element.id, subjectType: "element" }),
      ]);
      const implementsTargets = architecture.relationships.filter(
        (r) =>
          !r.retired_at &&
          r.source_element_id === element.id &&
          r.relationship_type === "implements",
      );
      const validations = architecture.relationships.filter(
        (r) =>
          !r.retired_at &&
          r.target_element_id === element.id &&
          r.relationship_type === "validates",
      );
      const revisions = await getElementRevisions(engagementId);
      const words = (v: string | null | undefined) => (v ? v.replaceAll("_", " ") : "—");
      return (
        <IntelligenceDrawer
          {...common}
          layer1={
            <div className="space-y-4">
              <FactSection title="Status and history">
                <FactList
                  items={history
                    .filter((h) => h.field === "implementation_status")
                    .map((h) => (
                      <span key={h.id}>
                        {h.from_value ? `${words(h.from_value)} to ` : "Started as "}
                        {words(h.to_value)}, {formatDate(h.changed_at)}
                        {h.rationale ? `: ${h.rationale}` : ""}
                      </span>
                    ))}
                />
              </FactSection>
              <FactSection title="Checkpoints">
                <FactList
                  items={checkpoints.map((c) => (
                    <span key={c.id}>
                      {c.title}
                      {c.target_on ? `, target ${formatDate(c.target_on)}` : ""}
                      {c.achieved_on ? `, achieved ${formatDate(c.achieved_on)}` : ", not achieved"}
                    </span>
                  ))}
                />
              </FactSection>
              <FactSection title="Implements">
                <FactList
                  items={implementsTargets.map((r) => {
                    const t = architecture.byId.get(r.target_element_id);
                    const last = revisions
                      .filter(
                        (v) =>
                          v.element_id === r.target_element_id &&
                          v.change_type === "substantive_revision",
                      )
                      .map((v) => v.published_at)
                      .sort()
                      .at(-1);
                    return (
                      <span key={r.id}>
                        <ReferenceCode code={t?.reference_code ?? null} /> {t?.title}
                        {t?.latestVersion ? `, v${t.latestVersion.version_no}` : ", not published"}
                        {last ? `; last substantive revision ${formatDate(last)}` : ""}
                      </span>
                    );
                  })}
                />
              </FactSection>
              <FactSection title="Criteria in force">
                <FactList
                  items={criteria.map((c) => (
                    <span key={c.id}>
                      <ReferenceCode code={c.reference_code} /> {c.body}
                      {c.agreed_on ? ` (agreed ${formatDate(c.agreed_on)})` : ""}
                    </span>
                  ))}
                />
              </FactSection>
              <FactSection title="Validation">
                <FactList
                  items={validations.map((r) => {
                    const by = architecture.byId.get(r.source_element_id);
                    return (
                      <span key={r.id}>
                        Validated by <ReferenceCode code={by?.reference_code ?? null} /> {by?.title}
                      </span>
                    );
                  })}
                />
              </FactSection>
              <FactSection title="Implementation Edge items">
                <FactList
                  items={items.map((i) => (
                    <span key={i.item_key}>{itemLine(i)}</span>
                  ))}
                />
              </FactSection>
            </div>
          }
        />
      );
    }
  }
}
