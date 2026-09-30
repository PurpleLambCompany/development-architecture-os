import {
  addStatement,
  citeEvidence,
  deleteStatement,
  removeCitation,
  reviewAiContent,
  updateStatement,
} from "@/domain/architecture/actions";
import {
  EDITABLE_PROVENANCE,
  EVIDENCE_SOURCE_TYPE_LABELS,
  EVIDENCE_STANCES,
  EVIDENCE_STANCE_LABELS,
  PROVENANCE_LABELS,
  STATEMENT_KINDS,
  STATEMENT_KIND_LABELS,
  STATEMENT_KIND_SINGULAR,
} from "@/domain/architecture/catalog";
import type { ElementStatement } from "@/domain/architecture/queries";
import { groupStatements } from "@/domain/architecture/snapshot";
import {
  NO_APPROACH_GUIDANCE,
  internalTitlesIn,
  type ApproachGuidance,
} from "@/domain/methodology/approach";
import { ApproachHelper } from "@/components/methodology/approach-helper";
import { ActionButton, ActionForm, type FieldSpec } from "@/components/ui/action-form";
import { StatusTag } from "@/components/ui/status-tag";
import { EmptyState, Panel } from "@/components/ui/panel";
import { AiReviewTag, InternalMark, ProvenanceLabel } from "./badges";
import { yesNoOptions } from "./element-fields";

const statementFields: FieldSpec[] = [
  {
    name: "statementKind",
    label: "Kind",
    type: "select",
    options: STATEMENT_KINDS.map((k) => ({ value: k, label: STATEMENT_KIND_SINGULAR[k] })),
  },
  {
    name: "provenance",
    label: "Provenance",
    type: "select",
    options: EDITABLE_PROVENANCE.map((p) => ({ value: p, label: PROVENANCE_LABELS[p] })),
  },
  { name: "body", label: "Statement", type: "textarea" },
  {
    name: "clientVisible",
    label: "Client-visible",
    type: "select",
    options: yesNoOptions,
    hint: "Internal statements never appear in client snapshots.",
  },
  { name: "sourceReference", label: "Source reference" },
];

/**
 * The element's material statements, grouped by kind, each with its
 * provenance and the evidence it cites. Evidence stays a separate source
 * system: statements link to sources, they do not copy them.
 */
export function StatementsPanel({
  elementId,
  statements,
  evidenceOptions,
  canEdit,
  canPublish,
  frozen,
  approach = NO_APPROACH_GUIDANCE,
}: {
  elementId: string;
  statements: ElementStatement[];
  evidenceOptions: { value: string; label: string }[];
  canEdit: boolean;
  canPublish: boolean;
  frozen: boolean;
  /** Approved names and internal-only titles for approach statements (§17.2). */
  approach?: ApproachGuidance;
}) {
  const editable = canEdit && !frozen;
  const helper = <ApproachHelper guidance={approach} />;
  const groups = groupStatements(statements, STATEMENT_KINDS);
  return (
    <Panel
      title="Statements"
      description="Findings, rationale and implications, each with its provenance and cited evidence."
    >
      <div className="space-y-6">
        {groups.length === 0 ? <EmptyState title="No statements yet" /> : null}
        {groups.map((group) => (
          <div key={group.kind}>
            <p className="mb-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">
              {STATEMENT_KIND_LABELS[group.kind]}
            </p>
            <ul className="space-y-4">
              {group.statements.map((statement) => (
                <li key={statement.id} className="space-y-2 border-l-2 border-rule pl-4">
                  <p className="text-sm text-ink">{statement.body}</p>
                  <p className="flex flex-wrap items-center gap-2">
                    <ProvenanceLabel provenance={statement.provenance} />
                    {statement.client_visible ? null : <InternalMark />}
                    {statement.client_visible &&
                    internalTitlesIn(statement.body, approach.internalTitles).length > 0 ? (
                      <StatusTag tone="attention">Names an internal-only method</StatusTag>
                    ) : null}
                    <AiReviewTag state={statement.ai_review_state} />
                    {statement.source_reference ? (
                      <span className="text-xs text-ink-subtle">
                        · {statement.source_reference}
                      </span>
                    ) : null}
                  </p>
                  {statement.statement_evidence_links.length > 0 ? (
                    <ul className="space-y-1">
                      {statement.statement_evidence_links.map((link) => (
                        <li
                          key={link.id}
                          className="flex flex-wrap items-center gap-2 text-xs text-ink-muted"
                        >
                          <span className="text-ink-subtle">
                            {EVIDENCE_STANCE_LABELS[link.stance]}:
                          </span>
                          <span>{link.evidence_sources?.title}</span>
                          {link.evidence_sources ? (
                            <span className="text-ink-subtle">
                              {EVIDENCE_SOURCE_TYPE_LABELS[link.evidence_sources.source_type]}
                            </span>
                          ) : null}
                          {link.locator ? <span>· {link.locator}</span> : null}
                          {link.evidence_sources?.client_visibility === "internal" ? (
                            <InternalMark>Internal source</InternalMark>
                          ) : null}
                          {editable ? (
                            <ActionButton
                              action={removeCitation.bind(null, link.id)}
                              label="Remove"
                              variant="ghost"
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {statement.ai_review_state === "pending" && canPublish ? (
                    <div className="flex gap-2">
                      <ActionButton
                        action={reviewAiContent.bind(null, elementId, statement.id, true)}
                        label="Accept AI statement"
                      />
                      <ActionButton
                        action={reviewAiContent.bind(null, elementId, statement.id, false)}
                        label="Reject"
                        variant="danger"
                      />
                    </div>
                  ) : null}
                  {editable ? (
                    <div className="flex flex-wrap items-start gap-2">
                      {evidenceOptions.length > 0 ? (
                        <ActionForm
                          fields={[
                            {
                              name: "evidenceSourceId",
                              label: "Evidence source",
                              type: "select",
                              options: evidenceOptions,
                              wide: true,
                            },
                            {
                              name: "stance",
                              label: "Stance",
                              type: "select",
                              options: EVIDENCE_STANCES.map((s) => ({
                                value: s,
                                label: EVIDENCE_STANCE_LABELS[s],
                              })),
                            },
                            {
                              name: "locator",
                              label: "Locator",
                              hint: "Page, section or timestamp.",
                            },
                            { name: "note", label: "Note (internal)", type: "textarea" },
                          ]}
                          defaultValues={{
                            evidenceSourceId: evidenceOptions[0]!.value,
                            stance: "supports",
                          }}
                          action={citeEvidence.bind(null, statement.id)}
                          submitLabel="Cite"
                          trigger="Cite evidence"
                        />
                      ) : null}
                      <ActionForm
                        fields={statementFields}
                        defaultValues={{
                          statementKind: statement.statement_kind,
                          provenance: statement.provenance,
                          body: statement.body,
                          clientVisible: statement.client_visible ? "yes" : "no",
                          sourceReference: statement.source_reference,
                        }}
                        action={updateStatement.bind(null, statement.id)}
                        submitLabel="Save statement"
                        trigger="Edit"
                        extra={helper}
                      />
                      <ActionButton
                        action={deleteStatement.bind(null, statement.id)}
                        label="Delete"
                        variant="ghost"
                        confirm="Delete this statement from the working copy? Published versions keep it."
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {editable ? (
          <ActionForm
            fields={statementFields}
            defaultValues={{
              statementKind: "finding",
              provenance: "architect_judgment",
              clientVisible: "yes",
            }}
            action={addStatement.bind(null, elementId)}
            submitLabel="Add statement"
            trigger="Add statement"
            extra={helper}
          />
        ) : null}
      </div>
    </Panel>
  );
}
