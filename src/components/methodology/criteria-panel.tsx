import Link from "next/link";
import {
  agreeCriterion,
  deleteCriterion,
  proposeCriterion,
  supersedeCriterion,
  updateCriterion,
  withdrawCriterion,
} from "@/domain/methodology/actions";
import { ACCEPTANCE_CRITERION_STATE } from "@/domain/methodology/catalog";
import { getElementCriteria, getStandardCriterionOptions } from "@/domain/methodology/queries";
import { promoteToCriterion } from "@/domain/edge/actions";
import { getCriterionPromotions } from "@/domain/edge/queries";
import { edgeRuleLabel } from "@/domain/edge/rules";
import type { ElementKind } from "@/domain/architecture/catalog";
import type { CriterionPromotion } from "@/domain/edge/promotion";
import { promoteInferenceToCriterion } from "@/domain/architecture-intelligence/experience/actions";
import { formatDate } from "@/lib/format";
import { ActionButton, ActionForm, type FieldSpec } from "@/components/ui/action-form";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

export type InheritedCriterion = {
  id: string;
  referenceCode: string;
  body: string;
  governedLabel: string;
  governedHref: string;
};

/**
 * Acceptance criteria (D20): what this element must satisfy to be accepted,
 * agreed with the client. Proposals are edited freely and deleted; agreed
 * text is frozen and only superseded or withdrawn, with a reason. There is
 * no pass or fail here: a Review judges, and validation captures the agreed
 * criteria in force at that moment.
 */
export async function CriteriaPanel({
  elementId,
  published,
  canEdit,
  canPublish,
  evidenceOptions,
  inherited = [],
  promotion,
  inferencePromotion,
}: {
  elementId: string;
  /** Criteria are agreed only on a published element. */
  published: boolean;
  canEdit: boolean;
  canPublish: boolean;
  evidenceOptions: { value: string; label: string }[];
  /** For an initiative: agreed criteria on the core objects it implements. */
  inherited?: InheritedCriterion[];
  /** Opened from the Development Edge to promote an item into a criterion. */
  promotion?: CriterionPromotion | null;
  /** A kept interpretation being promoted into a proposed criterion here (IX-20). */
  inferencePromotion?: {
    engagementId: string;
    slug: string;
    elementKind: ElementKind;
    inferenceId: string;
    line: string;
  } | null;
}) {
  const [criteria, standardOptions] = await Promise.all([
    getElementCriteria(elementId),
    canEdit ? getStandardCriterionOptions() : Promise.resolve([]),
  ]);
  const promotedFrom = await getCriterionPromotions(criteria.map((c) => c.id));
  const promoting = canEdit && promotion ? promotion : null;
  const promotingInference =
    canEdit && !promoting && inferencePromotion ? inferencePromotion : null;
  const open = criteria.filter((c) => c.state === "proposed" || c.state === "agreed");
  const closed = criteria.filter((c) => c.state === "superseded" || c.state === "withdrawn");
  const proposalFields = [
    { name: "body", label: "Criterion", type: "textarea" },
    {
      name: "informing",
      label: "Informed by a Standard (internal only)",
      type: "select",
      options: [{ value: "", label: "None" }, ...standardOptions],
      wide: true,
    },
    {
      name: "clientVisible",
      label: "Client can see it",
      type: "select",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No, internal only" },
      ],
    },
  ] satisfies FieldSpec[];

  return (
    <div id="criteria" className="scroll-mt-6">
      <Panel
        title="Acceptance criteria"
        description={
          promotingInference
            ? `Promoted from a kept interpretation (${promotingInference.line}). Proposing records the criterion as the interpretation's promotion; agreement is still recorded separately.`
            : promoting
              ? `Promoted from the Development Edge (${edgeRuleLabel(promoting.item.ruleKey)}). Proposing records the criterion as the item's promotion; agreement is still recorded separately.`
              : "What must be true for this to be accepted, agreed with the client. Agreed text is frozen."
        }
        actions={
          canEdit && !promoting && !promotingInference ? (
            <ActionForm
              trigger="Propose a criterion"
              submitLabel="Propose"
              action={proposeCriterion.bind(null, elementId)}
              fields={proposalFields}
              defaultValues={{ clientVisible: "yes", informing: "" }}
            />
          ) : null
        }
      >
        <div className="space-y-4">
          {promotingInference ? (
            <section className="space-y-2 rounded-sm border border-rule p-4">
              <p className="text-sm text-ink-muted">
                Write the criterion in your own words. It is proposed, not agreed, and internal only
                unless you choose otherwise.
              </p>
              <ActionForm
                submitLabel="Propose"
                action={promoteInferenceToCriterion.bind(
                  null,
                  promotingInference.engagementId,
                  promotingInference.slug,
                  promotingInference.elementKind,
                  elementId,
                  promotingInference.inferenceId,
                )}
                fields={proposalFields}
                defaultValues={{ body: "", clientVisible: "no", informing: "" }}
              />
            </section>
          ) : null}
          {promoting ? (
            <section className="space-y-2 rounded-sm border border-rule p-4">
              <p className="text-sm text-ink-muted">
                The Development Edge noted: {promoting.itemLine} Write the criterion that answers
                it. It is proposed, not agreed, and internal only unless you choose otherwise.
              </p>
              <ActionForm
                submitLabel="Propose"
                action={promoteToCriterion.bind(
                  null,
                  promoting.engagementId,
                  promoting.slug,
                  promoting.elementKind,
                  promoting.item,
                )}
                fields={proposalFields}
                defaultValues={{ body: promoting.itemLine, clientVisible: "no", informing: "" }}
              />
            </section>
          ) : null}
          {open.length === 0 && inherited.length === 0 ? (
            <EmptyState title="No acceptance criteria">
              A Review can still validate without criteria; the record will say none were agreed.
            </EmptyState>
          ) : null}
          {open.length > 0 ? (
            <ul className="divide-y divide-rule border-y border-rule text-sm">
              {open.map((c) => {
                const state = ACCEPTANCE_CRITERION_STATE[c.state];
                const informedBy = c.method_asset_versions?.method_assets?.title;
                return (
                  <li key={c.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-subtle">{c.reference_code}</span>
                      <StatusTag tone={state.tone}>{state.label}</StatusTag>
                      {!c.client_visible ? <StatusTag>Internal only</StatusTag> : null}
                    </div>
                    <p className="text-ink">{c.body}</p>
                    <p className="text-xs text-ink-subtle">
                      {c.state === "agreed"
                        ? `Agreed with ${c.agreed_with}, applies from ${formatDate(c.agreed_on!)}`
                        : "Proposed, not yet agreed"}
                      {informedBy
                        ? ` · Informed by ${informedBy} ${c.method_asset_versions?.version_label ?? ""}`
                        : ""}
                      {promotedFrom.has(c.id)
                        ? ` · Promoted from the Development Edge (${edgeRuleLabel(promotedFrom.get(c.id)!.ruleKey)}) on ${formatDate(promotedFrom.get(c.id)!.judgedAt.slice(0, 10))}`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {c.state === "proposed" && canEdit ? (
                        <>
                          <ActionForm
                            trigger="Edit"
                            submitLabel="Save"
                            action={updateCriterion.bind(null, c.id)}
                            fields={proposalFields}
                            defaultValues={{
                              body: c.body,
                              informing: c.informing_criterion_key
                                ? `${c.informing_standard_version_id}:${c.informing_criterion_key}`
                                : "",
                              clientVisible: c.client_visible ? "yes" : "no",
                            }}
                          />
                          <ActionButton
                            action={deleteCriterion.bind(null, c.id)}
                            label="Delete"
                            variant="ghost"
                            confirm="Delete this proposed criterion?"
                          />
                        </>
                      ) : null}
                      {c.state === "proposed" && canPublish && published ? (
                        <ActionForm
                          trigger="Record agreement"
                          submitLabel="Record agreement"
                          action={agreeCriterion.bind(null, c.id)}
                          confirm="Once agreed, the text is frozen."
                          fields={[
                            { name: "agreedWith", label: "Agreed with", wide: true },
                            { name: "agreedOn", label: "Applies from", type: "date" },
                            {
                              name: "evidenceSourceId",
                              label: "Evidence of agreement",
                              type: "select",
                              options: [{ value: "", label: "None" }, ...evidenceOptions],
                            },
                          ]}
                        />
                      ) : null}
                      {c.state === "proposed" && canPublish && !published ? (
                        <span className="text-xs text-ink-subtle">
                          Publish the element before recording agreement.
                        </span>
                      ) : null}
                      {c.state === "agreed" && canPublish ? (
                        <>
                          <ActionForm
                            trigger="Supersede"
                            submitLabel="Supersede"
                            action={supersedeCriterion.bind(null, c.id)}
                            fields={[
                              { name: "body", label: "New criterion", type: "textarea" },
                              { name: "reason", label: "Reason", type: "textarea" },
                              {
                                name: "agreedWith",
                                label: "Agreed with (if already agreed)",
                              },
                              { name: "agreedOn", label: "Applies from", type: "date" },
                            ]}
                            defaultValues={{ body: c.body }}
                          />
                          <ActionForm
                            trigger="Withdraw"
                            variant="danger"
                            submitLabel="Withdraw"
                            action={withdrawCriterion.bind(null, c.id)}
                            fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
                          />
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {inherited.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-xs tracking-wide text-ink-subtle uppercase">
                Also in force, from the objects this implements
              </h3>
              <ul className="space-y-2 text-sm">
                {inherited.map((c) => (
                  <li key={c.id}>
                    <span className="font-mono text-xs text-ink-subtle">{c.referenceCode}</span>{" "}
                    <span className="text-ink">{c.body}</span>{" "}
                    <Link href={c.governedHref} className="text-ink-subtle hover:underline">
                      on {c.governedLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {closed.length > 0 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-muted">
                Superseded and withdrawn ({closed.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {closed.map((c) => (
                  <li key={c.id} className="text-ink-muted">
                    <span className="font-mono text-xs">{c.reference_code}</span>{" "}
                    {ACCEPTANCE_CRITERION_STATE[c.state].label}
                    {c.closed_at ? ` ${formatDate(c.closed_at)}` : ""}: {c.body}
                    <span className="block text-xs text-ink-subtle">{c.closure_reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
