import {
  addDecisionOption,
  deferDecision,
  deleteDecisionOption,
  recordExternalDecision,
  setDecisionRecommendation,
} from "@/domain/architecture/actions";
import {
  APPROVAL_METHODS,
  APPROVAL_METHOD_LABELS,
  DECISION_STATUS,
  PROVENANCE_LABELS,
} from "@/domain/architecture/catalog";
import type { LoadedArchitecture, LoadedElement } from "@/domain/architecture/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { ActionButton, ActionForm } from "@/components/ui/action-form";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";

/**
 * A decision's options, TPLCo's recommendation (architect judgment) and the
 * outcome (client decision, in the portal or recorded from outside it). A
 * decided decision is frozen; changing course means a new decision that
 * supersedes it.
 */
export function DecisionPanel({
  element,
  architecture,
  canEdit,
  canPublish,
  nameOf,
  today,
}: {
  element: LoadedElement;
  architecture: LoadedArchitecture;
  canEdit: boolean;
  canPublish: boolean;
  nameOf: (id: string | null) => string;
  today: string;
}) {
  if (element.record?.kind !== "decision") return null;
  const d = element.record.row;
  const options = architecture.decisionOptions.filter((o) => o.decision_element_id === element.id);
  const open = d.decision_status === "open" || d.decision_status === "recommended";
  const optionChoices = options.map((o) => ({ value: o.id, label: o.title }));
  const status = DECISION_STATUS[d.decision_status];

  return (
    <Panel
      title="Decision"
      description="Options and TPLCo's recommendation; the outcome is the client's decision."
      actions={<StatusTag tone={status.tone}>{status.label}</StatusTag>}
    >
      <div className="space-y-5">
        {options.length === 0 ? (
          <EmptyState title="No options yet" />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {options.map((option) => (
              <li key={option.id} className="space-y-1 py-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {option.title}
                  {d.recommended_option_id === option.id ? (
                    <StatusTag tone="accent">Recommended</StatusTag>
                  ) : null}
                  {d.chosen_option_id === option.id ? (
                    <StatusTag tone="positive">Chosen</StatusTag>
                  ) : null}
                </p>
                {option.description ? (
                  <p className="text-sm text-ink-muted">{option.description}</p>
                ) : null}
                {option.tradeoffs ? (
                  <p className="text-sm text-ink-muted">
                    <span className="text-ink-subtle">Trade-offs: </span>
                    {option.tradeoffs}
                  </p>
                ) : null}
                {open && canEdit ? (
                  <ActionButton
                    action={deleteDecisionOption.bind(null, option.id)}
                    label="Remove option"
                    variant="ghost"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {d.recommended_option_id ? (
          <p className="text-sm text-ink-muted">
            <span className="text-xs tracking-wide text-ink-subtle uppercase">
              {PROVENANCE_LABELS.architect_judgment}
            </span>{" "}
            {d.recommendation_rationale}
            {d.recommended_at ? (
              <span className="text-xs text-ink-subtle">
                {" "}
                · {nameOf(d.recommended_by)}, {formatDateTime(d.recommended_at)}
              </span>
            ) : null}
          </p>
        ) : null}

        {d.decision_status === "decided" ? (
          <p className="text-sm text-ink">
            <span className="text-xs tracking-wide text-ink-subtle uppercase">
              {PROVENANCE_LABELS.client_decision}
            </span>{" "}
            {d.decision_source === "client_portal"
              ? `Decided in the portal by ${nameOf(d.decided_by)}, ${formatDateTime(d.decided_at!)}.`
              : `Decided outside the portal by ${d.external_decider_name}, ${formatDate(d.external_decided_on)} (${APPROVAL_METHOD_LABELS[d.external_decision_method!]}; ${d.external_evidence}). Recorded by ${nameOf(d.recorded_by)}.`}
            {d.decision_note ? ` “${d.decision_note}”` : ""}
          </p>
        ) : null}
        {d.decision_status === "deferred" ? (
          <p className="text-sm text-ink-muted">Deferred: {d.deferred_reason}</p>
        ) : null}

        {open ? (
          <div className="flex flex-wrap items-start gap-2">
            {canEdit ? (
              <ActionForm
                fields={[
                  { name: "title", label: "Option", wide: true },
                  { name: "description", label: "Description", type: "textarea" },
                  { name: "tradeoffs", label: "Trade-offs", type: "textarea" },
                ]}
                action={addDecisionOption.bind(null, element.id)}
                submitLabel="Add option"
                trigger="Add option"
              />
            ) : null}
            {canEdit && options.length > 0 ? (
              <ActionForm
                fields={[
                  { name: "optionId", label: "Recommend", type: "select", options: optionChoices },
                  { name: "rationale", label: "Rationale", type: "textarea" },
                ]}
                defaultValues={{ optionId: d.recommended_option_id ?? options[0]!.id }}
                action={setDecisionRecommendation.bind(null, element.id)}
                submitLabel="Record recommendation"
                trigger={d.recommended_option_id ? "Change recommendation" : "Recommend an option"}
              />
            ) : null}
            {canPublish && options.length > 0 ? (
              <ActionForm
                fields={[
                  {
                    name: "optionId",
                    label: "Chosen option",
                    type: "select",
                    options: optionChoices,
                  },
                  { name: "deciderName", label: "Decided by" },
                  { name: "decidedOn", label: "Date", type: "date" },
                  {
                    name: "method",
                    label: "Method",
                    type: "select",
                    options: APPROVAL_METHODS.map((m) => ({
                      value: m,
                      label: APPROVAL_METHOD_LABELS[m],
                    })),
                  },
                  { name: "evidence", label: "Evidence" },
                  { name: "note", label: "Note", type: "textarea" },
                ]}
                defaultValues={{
                  optionId: d.recommended_option_id ?? options[0]!.id,
                  decidedOn: today,
                  method: "meeting",
                }}
                action={recordExternalDecision.bind(null, element.id)}
                submitLabel="Record decision"
                trigger="Record a decision made outside the portal"
                confirm="Record this decision? It is final; changing course needs a new decision."
              />
            ) : null}
            {canPublish ? (
              <ActionForm
                fields={[{ name: "reason", label: "Reason", type: "textarea" }]}
                action={deferDecision.bind(null, element.id)}
                submitLabel="Defer decision"
                trigger="Defer"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
