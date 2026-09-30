import { notFound } from "next/navigation";
import { requireInternal } from "@/lib/auth/viewer";
import { formatDate, formatDateTime } from "@/lib/format";
import { getMyEngagementCapabilities } from "@/domain/capabilities/queries";
import {
  createChangeOrder,
  createContract,
  createMilestone,
  createRenewalContract,
  deleteContractDraft,
  deleteMilestone,
  executeContract,
  setContractStatus,
  setMilestoneStatus,
  submitChangeOrder,
  updateChangeOrder,
  updateContractDraft,
  updateMilestone,
  recordExternalApproval,
  voidChangeOrder,
  addFinanceNote,
} from "@/domain/finance/actions";
import {
  APPROVAL_SOURCE_LABELS,
  CHANGE_ORDER_STATUS,
  CONTRACT_STATUS,
  EXTERNAL_APPROVAL_METHODS,
  EXTERNAL_APPROVAL_METHOD_LABELS,
  MILESTONE_STATE,
  MILESTONE_TRIGGERS,
  MILESTONE_TRIGGER_LABELS,
  PAYMENT_STRUCTURES,
  PAYMENT_STRUCTURE_LABELS,
} from "@/domain/finance/catalog";
import { formatMoney, formatSignedMoney, toDecimalString } from "@/domain/finance/money";
import {
  getBusinessToday,
  getEngagementFinances,
  getFinanceEngagementBySlug,
  listFinanceNotes,
  type LoadedFinances,
} from "@/domain/finance/queries";
import { ActionButton, ActionForm, type FieldSpec } from "@/components/finance/action-form";
import { CashPanels } from "@/components/finance/cash-panels";
import { InvoicesPanel } from "@/components/finance/invoices-panel";
import { InternalSummary } from "@/components/finance/summary-panels";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList, EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";

const contractFields: FieldSpec[] = [
  { name: "title", label: "Title", wide: true },
  {
    name: "currency",
    label: "Currency",
    type: "select",
    options: [{ value: "USD", label: "USD" }],
  },
  { name: "originalValue", label: "Original contract value", type: "money" },
  {
    name: "paymentStructure",
    label: "Payment structure",
    type: "select",
    options: PAYMENT_STRUCTURES.map((v) => ({ value: v, label: PAYMENT_STRUCTURE_LABELS[v] })),
  },
  {
    name: "paymentTermsDays",
    label: "Payment terms (days)",
    type: "number",
    hint: "For example 30 for Net 30",
  },
  { name: "deposit", label: "Deposit", type: "money", hint: "Optional" },
  { name: "effectiveDate", label: "Effective date", type: "date" },
  { name: "startDate", label: "Start date", type: "date" },
  { name: "endDate", label: "End date", type: "date" },
  { name: "notes", label: "Internal notes", type: "textarea" },
];

const milestoneFields: FieldSpec[] = [
  { name: "sequence", label: "Order", type: "number" },
  { name: "title", label: "Title" },
  { name: "amount", label: "Amount", type: "money" },
  {
    name: "dueDate",
    label: "Planned date",
    type: "date",
    hint: "May be left blank until an event occurs",
  },
  {
    name: "triggerType",
    label: "Triggered",
    type: "select",
    options: MILESTONE_TRIGGERS.map((v) => ({ value: v, label: MILESTONE_TRIGGER_LABELS[v] })),
  },
  {
    name: "stageLabel",
    label: "Project stage label",
    hint: "Text only. Never linked to architecture progress.",
  },
  { name: "description", label: "Description", type: "textarea" },
];

const changeOrderFields: FieldSpec[] = [
  { name: "title", label: "Title" },
  {
    name: "amount",
    label: "Fee impact",
    type: "money",
    hint: "Use a minus sign for a reduction, such as -3,000",
    placeholder: "0.00",
  },
  { name: "description", label: "Description", type: "textarea" },
  { name: "scopeImpact", label: "Scope impact", type: "textarea" },
  { name: "scheduleImpact", label: "Schedule impact", type: "textarea" },
];

const reasonField: FieldSpec[] = [{ name: "reason", label: "Reason", type: "textarea" }];

/**
 * The finance workspace for one engagement. Offers only what the viewer may
 * do (manage_financials; executive authority for execution and external
 * approvals); the database enforces the same rules on every action.
 */
export default async function FinanceWorkspacePage({
  params,
}: PageProps<"/internal/finance/[slug]">) {
  const { slug } = await params;
  const viewer = await requireInternal();
  const entry = await getFinanceEngagementBySlug(slug);
  if (!entry) notFound();

  const today = getBusinessToday();
  const [capabilities, finances, notes] = await Promise.all([
    getMyEngagementCapabilities(entry.engagementId),
    getEngagementFinances(entry.engagementId, today),
    listFinanceNotes(entry.engagementId),
  ]);
  const canManage = capabilities.has("manage_financials");
  const isExecutive =
    viewer.role === "system_administrator" || viewer.role === "principal_architect";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Finance · ${entry.clientName}`}
        title={entry.title}
        description={`Figures as of ${formatDate(today)}, business time (America/Chicago).`}
        actions={
          <ButtonLink href="/internal/finance" variant="secondary">
            Portfolio
          </ButtonLink>
        }
      />

      {finances.contract === null ? (
        <Panel title="Contract">
          <EmptyState title="No contract yet">
            {canManage
              ? "Draft the contract for this engagement."
              : "No contract has been drafted."}
          </EmptyState>
          {canManage ? (
            <ActionForm
              fields={contractFields}
              defaultValues={{
                currency: "USD",
                paymentStructure: "milestone",
                paymentTermsDays: "30",
              }}
              action={createContract.bind(null, entry.engagementId)}
              submitLabel="Create draft contract"
              trigger="Draft a contract"
            />
          ) : null}
        </Panel>
      ) : (
        <Workspace
          finances={finances as LoadedFinances}
          engagementId={entry.engagementId}
          canManage={canManage}
          isExecutive={isExecutive}
          today={today}
          notes={notes}
        />
      )}
    </div>
  );
}

function Workspace({
  finances,
  engagementId,
  canManage,
  isExecutive,
  today,
  notes,
}: {
  finances: LoadedFinances;
  engagementId: string;
  canManage: boolean;
  isExecutive: boolean;
  today: string;
  notes: Awaited<ReturnType<typeof listFinanceNotes>>;
}) {
  const { contract, summary } = finances;
  const currency = contract.currency;
  const status = CONTRACT_STATUS[contract.status];
  const isDraft = contract.status === "draft";
  const isCurrent = contract.status === "executed" || contract.status === "active";
  const otherContracts = finances.contracts.filter((c) => c.id !== contract.id);

  return (
    <>
      <Panel
        title={contract.title}
        description={`${PAYMENT_STRUCTURE_LABELS[contract.payment_structure]} · Net ${contract.payment_terms_days} · ${currency}`}
        actions={<StatusTag tone={status.tone}>{status.label}</StatusTag>}
      >
        <div className="space-y-5">
          <DetailList
            items={[
              {
                label: "Original contract value",
                value: formatMoney(contract.original_value_minor, currency),
              },
              {
                label: "Deposit",
                value: contract.deposit_minor
                  ? formatMoney(contract.deposit_minor, currency)
                  : null,
              },
              { label: "Effective date", value: formatDate(contract.effective_date) },
              {
                label: "Term",
                value: [formatDate(contract.start_date), formatDate(contract.end_date)]
                  .filter(Boolean)
                  .join(" – "),
              },
              {
                label: "Executed",
                value: contract.executed_on
                  ? `${formatDate(contract.executed_on)} · signed by ${contract.client_signatory_name}${contract.client_signatory_title ? `, ${contract.client_signatory_title}` : ""}`
                  : null,
              },
              { label: "Internal notes", value: contract.notes },
            ]}
          />
          {canManage ? (
            <div className="flex flex-wrap items-start gap-2 border-t border-rule pt-4">
              {isDraft ? (
                <>
                  <ActionForm
                    fields={contractFields}
                    defaultValues={{
                      title: contract.title,
                      currency: contract.currency,
                      originalValue: toDecimalString(contract.original_value_minor, currency),
                      paymentStructure: contract.payment_structure,
                      paymentTermsDays: String(contract.payment_terms_days),
                      deposit: contract.deposit_minor
                        ? toDecimalString(contract.deposit_minor, currency)
                        : "",
                      effectiveDate: contract.effective_date ?? "",
                      startDate: contract.start_date ?? "",
                      endDate: contract.end_date ?? "",
                      notes: contract.notes,
                    }}
                    action={updateContractDraft.bind(null, contract.id)}
                    submitLabel="Save draft"
                    trigger="Edit draft"
                  />
                  {isExecutive ? (
                    <ActionForm
                      fields={[
                        { name: "executedOn", label: "Date executed", type: "date" },
                        { name: "signatoryName", label: "Client signatory" },
                        { name: "signatoryTitle", label: "Signatory title" },
                      ]}
                      defaultValues={{ executedOn: today }}
                      action={executeContract.bind(null, contract.id)}
                      submitLabel="Execute contract"
                      trigger="Execute"
                      confirm="Executing locks the contract value and currency permanently. Continue?"
                    />
                  ) : null}
                  <ActionButton
                    action={deleteContractDraft.bind(null, contract.id)}
                    label="Delete draft"
                    variant="danger"
                    confirm="Delete this draft contract?"
                  />
                </>
              ) : null}
              {contract.status === "executed" ? (
                <ActionButton
                  action={setContractStatus.bind(null, contract.id, "active")}
                  label="Mark active"
                />
              ) : null}
              {isCurrent ? (
                <>
                  <ActionButton
                    action={setContractStatus.bind(null, contract.id, "completed")}
                    label="Mark completed"
                    confirm="Mark this contract completed?"
                  />
                  {isExecutive ? (
                    <ActionButton
                      action={setContractStatus.bind(null, contract.id, "terminated")}
                      label="Terminate"
                      variant="danger"
                      confirm="Terminate this contract? This cannot be undone."
                    />
                  ) : null}
                  <ActionForm
                    fields={contractFields}
                    defaultValues={{
                      title: contract.title,
                      currency: contract.currency,
                      originalValue: "",
                      paymentStructure: contract.payment_structure,
                      paymentTermsDays: String(contract.payment_terms_days),
                    }}
                    action={createRenewalContract.bind(null, contract.id, engagementId)}
                    submitLabel="Create renewal draft"
                    trigger="Prepare renewal"
                  />
                </>
              ) : null}
            </div>
          ) : null}
          {otherContracts.length > 0 ? (
            <div className="border-t border-rule pt-4">
              <p className="mb-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Other contracts
              </p>
              <ul className="space-y-2 text-sm">
                {otherContracts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3">
                    <StatusTag tone={CONTRACT_STATUS[c.status].tone}>
                      {CONTRACT_STATUS[c.status].label}
                    </StatusTag>
                    <span>{c.title}</span>
                    <span className="text-ink-muted tabular-nums">
                      {formatMoney(c.original_value_minor, c.currency)}
                    </span>
                    {c.status === "draft" && canManage && isExecutive ? (
                      <ActionForm
                        fields={[
                          { name: "executedOn", label: "Date executed", type: "date" },
                          { name: "signatoryName", label: "Client signatory" },
                          { name: "signatoryTitle", label: "Signatory title" },
                        ]}
                        defaultValues={{ executedOn: today }}
                        action={executeContract.bind(null, c.id)}
                        submitLabel={
                          c.supersedes_contract_id ? "Execute and supersede" : "Execute contract"
                        }
                        trigger="Execute"
                        confirm="Executing locks this contract's value and supersedes the current contract. Continue?"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Panel>

      {summary ? (
        <Panel title="Financial position">
          <InternalSummary summary={summary} />
        </Panel>
      ) : null}

      <MilestonesPanel finances={finances} canManage={canManage} />
      <ChangeOrdersPanel
        finances={finances}
        canManage={canManage}
        isExecutive={isExecutive}
        today={today}
      />
      <InvoicesPanel finances={finances} canManage={canManage} today={today} />
      <CashPanels finances={finances} canManage={canManage} today={today} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Panel
          title="Financial activity"
          description="Every financial change, newest first. Permanent."
        >
          {finances.events.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="space-y-3 text-sm">
              {finances.events.map((event) => (
                <li
                  key={event.id}
                  className="flex items-baseline justify-between gap-4 border-b border-rule/70 pb-2"
                >
                  <span>
                    {event.summary}
                    {!event.client_visible ? (
                      <span className="ml-2">
                        <StatusTag>Internal</StatusTag>
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-ink-subtle">
                    {formatDateTime(event.occurred_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Internal notes" description="Never visible to the client.">
          <div className="space-y-4">
            {canManage ? (
              <ActionForm
                fields={[{ name: "body", label: "Note", type: "textarea" }]}
                action={addFinanceNote.bind(null, engagementId, "contract", contract.id)}
                submitLabel="Add note"
              />
            ) : null}
            {notes.length === 0 ? (
              <p className="text-sm text-ink-muted">No notes.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {notes.map((note) => (
                  <li key={note.id} className="border-b border-rule/70 pb-2">
                    <p className="whitespace-pre-line">{note.body}</p>
                    <p className="mt-1 text-xs text-ink-subtle">
                      {formatDateTime(note.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function MilestonesPanel({
  finances,
  canManage,
}: {
  finances: LoadedFinances;
  canManage: boolean;
}) {
  const { contract, milestones } = finances;
  const currency = contract.currency;
  const nextSequence = Math.max(0, ...milestones.map((m) => m.sequence)) + 1;
  const scheduled = milestones
    .filter((m) => m.status !== "cancelled")
    .reduce((sum, m) => sum + m.amount_minor, 0);

  return (
    <Panel
      title="Payment plan"
      description={`Milestones total ${formatMoney(scheduled, currency)}. A milestone is a plan, not a bill; payment state comes from its invoices.`}
    >
      <div className="space-y-4">
        {milestones.length === 0 ? (
          <EmptyState title="No milestones yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Milestone</Th>
                <Th className="text-right">Amount</Th>
                <Th>Planned</Th>
                <Th className="text-right">Invoiced</Th>
                <Th>State</Th>
                {canManage ? <Th /> : null}
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => {
                const state = MILESTONE_STATE[m.payment_state];
                const unbilled = m.billed_minor === 0;
                return (
                  <tr key={m.milestone_id}>
                    <Td className="text-ink-subtle tabular-nums">{m.sequence}</Td>
                    <Td>
                      <p className="font-medium">{m.title}</p>
                      <p className="text-xs text-ink-subtle">
                        {[MILESTONE_TRIGGER_LABELS[m.trigger_type], m.stage_label]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatMoney(m.amount_minor, currency)}
                    </Td>
                    <Td>{formatDate(m.due_date)}</Td>
                    <Td className="text-right tabular-nums">
                      {formatMoney(m.billed_minor, currency)}
                    </Td>
                    <Td>
                      <StatusTag tone={state.tone}>{state.label}</StatusTag>
                    </Td>
                    {canManage ? (
                      <Td className="space-y-2 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {m.status === "planned" ? (
                            <ActionButton
                              action={setMilestoneStatus.bind(
                                null,
                                m.milestone_id,
                                "ready_to_invoice",
                              )}
                              label="Ready"
                            />
                          ) : null}
                          {m.status === "ready_to_invoice" && unbilled ? (
                            <ActionButton
                              action={setMilestoneStatus.bind(null, m.milestone_id, "planned")}
                              label="Not ready"
                              variant="ghost"
                            />
                          ) : null}
                          {(m.status === "planned" || m.status === "ready_to_invoice") &&
                          unbilled ? (
                            <ActionButton
                              action={setMilestoneStatus.bind(null, m.milestone_id, "cancelled")}
                              label="Cancel"
                              variant="ghost"
                              confirm="Cancel this milestone? It stays in the history."
                            />
                          ) : null}
                          {m.status === "planned" && unbilled ? (
                            <ActionButton
                              action={deleteMilestone.bind(null, m.milestone_id)}
                              label="Delete"
                              variant="danger"
                              confirm="Delete this milestone?"
                            />
                          ) : null}
                        </div>
                        {m.status !== "cancelled" && m.status !== "invoiced" && unbilled ? (
                          <ActionForm
                            className="text-left"
                            fields={milestoneFields}
                            defaultValues={{
                              sequence: String(m.sequence),
                              title: m.title,
                              amount: toDecimalString(m.amount_minor, currency),
                              dueDate: m.due_date ?? "",
                              triggerType: m.trigger_type,
                              stageLabel: m.stage_label ?? "",
                              description: m.description,
                            }}
                            action={updateMilestone.bind(null, m.milestone_id)}
                            submitLabel="Save milestone"
                            trigger="Edit"
                          />
                        ) : null}
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {canManage ? (
          <ActionForm
            fields={milestoneFields}
            defaultValues={{ sequence: String(nextSequence), triggerType: "on_date" }}
            action={createMilestone.bind(null, contract.id)}
            submitLabel="Add milestone"
            trigger="Add milestone"
          />
        ) : null}
      </div>
    </Panel>
  );
}

function ChangeOrdersPanel({
  finances,
  canManage,
  isExecutive,
  today,
}: {
  finances: LoadedFinances;
  canManage: boolean;
  isExecutive: boolean;
  today: string;
}) {
  const { contract, changeOrders, changeOrderEvents } = finances;
  const currency = contract.currency;
  const isCurrent = contract.status === "executed" || contract.status === "active";

  return (
    <Panel
      title="Change orders"
      description="Only approved change orders change the contract value. Approved and rejected are final."
    >
      <div className="space-y-4">
        {changeOrders.length === 0 ? (
          <EmptyState title="No change orders" />
        ) : (
          <ul className="divide-y divide-rule">
            {changeOrders.map((co) => {
              const state = CHANGE_ORDER_STATUS[co.status];
              const history = changeOrderEvents.filter((e) => e.change_order_id === co.id);
              return (
                <li key={co.id} className="space-y-2 py-4 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-medium">
                      <span className="mr-2 text-ink-subtle tabular-nums">
                        {co.number ? `CO-${co.number}` : "Draft"}
                      </span>
                      {co.title}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">
                        {formatSignedMoney(co.amount_minor, currency)}
                      </span>
                      <StatusTag tone={state.tone}>{state.label}</StatusTag>
                    </div>
                  </div>
                  {co.description ? (
                    <p className="text-sm text-ink-muted">{co.description}</p>
                  ) : null}
                  {co.scope_impact || co.schedule_impact ? (
                    <p className="text-sm text-ink-muted">
                      {[
                        co.scope_impact && `Scope: ${co.scope_impact}`,
                        co.schedule_impact && `Schedule: ${co.schedule_impact}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {co.status === "approved" && co.approval_source ? (
                    <p className="text-xs text-ink-subtle">
                      {APPROVAL_SOURCE_LABELS[co.approval_source]}
                      {co.approval_source === "external_recorded_by_tplco"
                        ? ` · ${co.external_approver_name}${co.external_approver_title ? `, ${co.external_approver_title}` : ""} · ${EXTERNAL_APPROVAL_METHOD_LABELS[co.external_approval_method!]} on ${formatDate(co.external_approved_on)} · evidence: ${co.evidence_reference ?? co.evidence_path}`
                        : ` · ${formatDateTime(co.decided_at!)}`}
                    </p>
                  ) : null}
                  {co.decision_note ? (
                    <p className="text-xs text-ink-subtle">Note: {co.decision_note}</p>
                  ) : null}
                  {history.length > 0 ? (
                    <details className="text-xs text-ink-subtle">
                      <summary className="cursor-pointer">History</summary>
                      <ul className="mt-1 space-y-0.5">
                        {history.map((e) => (
                          <li key={e.id}>
                            {formatDateTime(e.occurred_at)} · {e.from_status ?? "new"} →{" "}
                            {e.to_status}
                            {e.contract_value_before_minor !== null &&
                            e.contract_value_after_minor !== null
                              ? ` · contract value ${formatMoney(e.contract_value_before_minor, currency)} → ${formatMoney(e.contract_value_after_minor, currency)}`
                              : ""}
                            {e.note ? ` · ${e.note}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {canManage ? (
                    <div className="flex flex-wrap items-start gap-2">
                      {co.status === "draft" ? (
                        <>
                          <ActionForm
                            fields={changeOrderFields}
                            defaultValues={{
                              title: co.title,
                              amount: toDecimalString(co.amount_minor, currency),
                              description: co.description,
                              scopeImpact: co.scope_impact,
                              scheduleImpact: co.schedule_impact,
                            }}
                            action={updateChangeOrder.bind(null, co.id)}
                            submitLabel="Save draft"
                            trigger="Edit"
                          />
                          {isCurrent ? (
                            <ActionButton
                              action={submitChangeOrder.bind(null, co.id)}
                              label="Submit to client"
                              variant="primary"
                              confirm="Submit this change order? The client will see it and it gets a permanent number."
                            />
                          ) : null}
                        </>
                      ) : null}
                      {co.status === "submitted" && isExecutive ? (
                        <ActionForm
                          fields={[
                            { name: "approverName", label: "Client approver" },
                            { name: "approverTitle", label: "Approver title" },
                            { name: "approvedOn", label: "Date approved", type: "date" },
                            {
                              name: "method",
                              label: "Method",
                              type: "select",
                              options: EXTERNAL_APPROVAL_METHODS.map((v) => ({
                                value: v,
                                label: EXTERNAL_APPROVAL_METHOD_LABELS[v],
                              })),
                            },
                            {
                              name: "evidenceReference",
                              label: "Evidence",
                              wide: true,
                              hint: "Where the signed approval is kept, or the email reference",
                            },
                          ]}
                          defaultValues={{ approvedOn: today, method: "signed_document" }}
                          action={recordExternalApproval.bind(null, co.id)}
                          submitLabel="Record approval"
                          trigger="Record external approval"
                          confirm="Record that the client approved this change order outside the portal? This is final."
                        />
                      ) : null}
                      {co.status === "draft" || co.status === "submitted" ? (
                        <ActionForm
                          fields={reasonField}
                          action={voidChangeOrder.bind(null, co.id)}
                          submitLabel="Withdraw"
                          variant="danger"
                          trigger="Withdraw"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {canManage && contract.status !== "void" ? (
          <ActionForm
            fields={changeOrderFields}
            action={createChangeOrder.bind(null, contract.id)}
            submitLabel="Create draft change order"
            trigger="New change order"
          />
        ) : null}
      </div>
    </Panel>
  );
}
