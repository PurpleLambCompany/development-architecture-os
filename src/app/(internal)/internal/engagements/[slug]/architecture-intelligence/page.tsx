import { getInternalArchitectureContext } from "@/domain/architecture/context";
import { setEngagementAiAuthorization } from "@/domain/architecture-intelligence/actions";
import {
  getArchitectureIntelligenceStanding,
  getAuthorizationHistory,
  getMonthBudget,
  getMonthOutcomes,
  getRecentRequests,
} from "@/domain/architecture-intelligence/queries";
import {
  BASIS_KINDS,
  BASIS_KIND_LABELS,
  DATA_CLASS_LABELS,
} from "@/domain/architecture-intelligence/schemas";
import { DATA_CLASSES } from "@/domain/architecture-intelligence/types";
import { ArchitectureNav } from "@/components/architecture/architecture-nav";
import { ActionForm } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, Panel } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status-tag";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate, formatDateTime, personName } from "@/lib/format";

/**
 * Architecture Intelligence on one engagement (proposal §26). 7B.1 shows
 * only governance: the external-processing authorization, its history and,
 * for authorizers, request metadata and cost. There is no inference text,
 * no request button and nothing a client can reach (OD-12).
 */

const OUTCOME_LABELS: Record<string, string> = {
  persisted: "Recorded",
  returned: "Returned, not recorded",
  refused_mode: "Refused: not enabled",
  refused_capability: "Refused: no use capability",
  refused_authorization: "Refused: not authorised",
  refused_class: "Refused: data class not authorised",
  refused_budget: "Refused: budget",
  subject_not_found: "Subject not found",
  provider_error: "Provider error",
  refusal: "Model declined",
  invalid_output: "Discarded: invalid output",
  unknown_citation: "Discarded: unknown citation",
  model_not_evaluated: "Discarded: model not evaluated",
  authorization_withdrawn: "Stopped: authorisation changed",
};

const KIND_LABELS: Record<string, string> = {
  explanation: "Explanation",
  tension: "Tension",
  evidence_bearing: "Evidence bearing",
  review_brief: "Review brief",
  realization_reading: "Realization reading",
};

const classLabel = (c: string) => DATA_CLASS_LABELS[c as keyof typeof DATA_CLASS_LABELS] ?? c;
const basisLabel = (b: string | null) =>
  b ? (BASIS_KIND_LABELS[b as keyof typeof BASIS_KIND_LABELS] ?? b) : "None";
const usd = (n: number | string | null) =>
  n === null
    ? "None"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 4,
      }).format(Number(n));

export default async function ArchitectureIntelligencePage({
  params,
}: PageProps<"/internal/engagements/[slug]/architecture-intelligence">) {
  const { slug } = await params;
  const { engagement } = await getInternalArchitectureContext(slug);
  const [standing, history] = await Promise.all([
    getArchitectureIntelligenceStanding(engagement.id),
    getAuthorizationHistory(engagement.id),
  ]);
  const current = history[0] ?? null;
  const authorized = current?.state === "authorized";
  const mode = process.env.ARCHITECTURE_INTELLIGENCE_MODE;
  const budget = standing?.canAuthorize ? await getMonthBudget(engagement.id) : null;
  const [requests, outcomes] = standing?.canAuthorize
    ? await Promise.all([
        getRecentRequests(engagement.id),
        budget ? getMonthOutcomes(engagement.id, budget.month_started_at) : Promise.resolve([]),
      ])
    : [[], []];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={engagement.title}
        title="Architecture Intelligence"
        description="Whether this engagement's governed records may be sent to an external AI provider when a person requests an interpretation, and under what authority. Authorising a class makes it eligible; each request still sends only the minimum it needs."
      />
      <ArchitectureNav slug={slug} current="architecture-intelligence" />

      <div className="space-y-2 text-sm text-ink-muted">
        {standing?.dataOrigin === "synthetic" ? (
          <p>
            <StatusTag tone="accent">Synthetic</StatusTag> Synthetic engagement: may be processed
            for evaluation only.
          </p>
        ) : mode !== "enabled" ? (
          <p>External processing of client engagements is not enabled in this environment.</p>
        ) : null}
        <p>
          {standing?.canUse
            ? "You hold Architecture Intelligence use on this engagement."
            : "You do not hold Architecture Intelligence use on this engagement."}
        </p>
      </div>

      <Panel
        title="External processing authorisation"
        description="Append-only: every change is a new version, attributed and dated."
      >
        {authorized && current ? (
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-subtle">State</dt>
              <dd>
                <StatusTag tone="positive">Authorised</StatusTag>
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Data classes</dt>
              <dd>{current.data_classes.map(classLabel).join(", ")}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Provider and region</dt>
              <dd>
                {current.provider_key}, {current.processing_region}
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Basis</dt>
              <dd>
                {basisLabel(current.basis_kind)}: {current.basis_reference}
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Monthly budget</dt>
              <dd>{usd(current.monthly_budget_usd)}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Effective from</dt>
              <dd>{formatDate(current.effective_from)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-subtle">Recorded by</dt>
              <dd>
                {personName(current.authorized_by)}, {formatDateTime(current.authorized_at)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-ink">
            <StatusTag>Not authorised</StatusTag> Not authorised for external processing.
          </p>
        )}

        {standing?.canAuthorize ? (
          <div className="mt-6 space-y-3 border-t border-rule pt-4">
            <p className="max-w-3xl text-sm text-ink-muted">
              Authorising a data class allows DSA to send it to the named provider when a person
              requests Architecture Intelligence. It does not send anything now, and it does not
              mean the class is included in every request: each request sends only the minimum that
              request needs. Revoking stops future processing. It cannot recall data already sent.
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionForm
                trigger="Change authorisation"
                submitLabel="Record authorisation"
                action={setEngagementAiAuthorization.bind(null, engagement.id)}
                hidden={{ state: "authorized" }}
                defaultValues={
                  current && authorized
                    ? {
                        dataClasses: current.data_classes,
                        providerKey: current.provider_key ?? "",
                        processingRegion: current.processing_region ?? "",
                        basisKind: current.basis_kind ?? "",
                        basisReference: current.basis_reference ?? "",
                        monthlyBudgetUsd: String(current.monthly_budget_usd ?? ""),
                      }
                    : { providerKey: "openai" }
                }
                fields={[
                  {
                    name: "dataClasses",
                    label: "Data classes",
                    type: "checkboxes",
                    options: DATA_CLASSES.map((c) => ({ value: c, label: classLabel(c) })),
                    hint: "Method/IP, approach statements, files, finance, activity and client-authored text have no class and are never sent.",
                    wide: true,
                  },
                  { name: "providerKey", label: "Provider" },
                  { name: "processingRegion", label: "Processing region" },
                  {
                    name: "basisKind",
                    label: "Basis",
                    type: "select",
                    options: BASIS_KINDS.map((b) => ({ value: b, label: BASIS_KIND_LABELS[b] })),
                    hint: "Synthetic evaluation is accepted for synthetic engagements only, and only there.",
                  },
                  {
                    name: "basisReference",
                    label: "Basis reference",
                    hint: "The agreement, addendum or instruction",
                  },
                  { name: "monthlyBudgetUsd", label: "Monthly budget (USD)", type: "number" },
                  {
                    name: "effectiveFrom",
                    label: "Effective from",
                    type: "date",
                    hint: "Blank for today",
                  },
                  { name: "basisNote", label: "Note", type: "textarea", wide: true },
                ]}
              />
              {authorized ? (
                <ActionForm
                  trigger="Revoke"
                  variant="danger"
                  submitLabel="Revoke authorisation"
                  confirm="Revoke external processing? Future requests will be refused. Processing already done cannot be recalled."
                  action={setEngagementAiAuthorization.bind(null, engagement.id)}
                  hidden={{ state: "not_authorized" }}
                  fields={[{ name: "basisNote", label: "Reason", type: "textarea", wide: true }]}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title="History" description="Every authorisation and revocation, newest first.">
        {history.length === 0 ? (
          <EmptyState title="No authorisation has been recorded">
            The engagement has never been authorised for external processing.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Version</Th>
                <Th>State</Th>
                <Th>Classes</Th>
                <Th>Basis</Th>
                <Th>Budget</Th>
                <Th>Recorded</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <Td>{a.sequence_no}</Td>
                  <Td>
                    {a.state === "authorized" ? "Authorised" : "Revoked"}
                    {a.state !== "authorized" && a.basis_note ? (
                      <span className="block text-xs text-ink-muted">{a.basis_note}</span>
                    ) : null}
                  </Td>
                  <Td>{a.data_classes.map(classLabel).join(", ") || "None"}</Td>
                  <Td>
                    {basisLabel(a.basis_kind)}
                    {a.basis_reference ? (
                      <span className="block text-xs text-ink-muted">{a.basis_reference}</span>
                    ) : null}
                  </Td>
                  <Td>{a.state === "authorized" ? usd(a.monthly_budget_usd) : "None"}</Td>
                  <Td>
                    {personName(a.authorized_by)}
                    <span className="block text-xs text-ink-muted">
                      {formatDateTime(a.authorized_at)}, effective {formatDate(a.effective_from)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {standing?.canAuthorize ? (
        <Panel
          title="Requests"
          description="Metadata of each request on this engagement: for security, provenance and cost. No prompt, context or answer text is kept here, and nothing is totalled per person."
        >
          {budget ? (
            <p className="mb-4 text-sm text-ink">
              This month: {usd(budget.month_to_date_usd)} of{" "}
              {budget.monthly_budget_usd === null
                ? "no budget (not authorised)"
                : usd(budget.monthly_budget_usd)}{" "}
              across {budget.month_requests} {budget.month_requests === 1 ? "request" : "requests"}.
              {outcomes.length > 0 ? (
                <span className="block text-xs text-ink-muted">
                  {outcomes.map(([o, n]) => `${OUTCOME_LABELS[o] ?? o}: ${n}`).join(" · ")}
                </span>
              ) : null}
            </p>
          ) : null}
          {requests.length === 0 ? (
            <EmptyState title="No requests yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Kind</Th>
                  <Th>Requested by</Th>
                  <Th>Mode</Th>
                  <Th>Outcome</Th>
                  <Th>Prompt</Th>
                  <Th>Resolved model</Th>
                  <Th className="text-right">Tokens</Th>
                  <Th className="text-right">Cost</Th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <Td>{formatDateTime(r.requested_at)}</Td>
                    <Td>{KIND_LABELS[r.inference_kind] ?? r.inference_kind}</Td>
                    <Td>{personName(r.requested_by)}</Td>
                    <Td>{r.mode === "persist" ? "Record" : "Ephemeral"}</Td>
                    <Td>{OUTCOME_LABELS[r.outcome] ?? r.outcome}</Td>
                    <Td>{r.prompt_version ?? "None"}</Td>
                    <Td>{r.resolved_model ?? "None"}</Td>
                    <Td className="text-right tabular-nums">{r.input_tokens + r.output_tokens}</Td>
                    <Td className="text-right tabular-nums">{usd(r.estimated_cost_usd)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
