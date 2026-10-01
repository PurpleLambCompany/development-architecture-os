import { costUsd, type PriceTable } from "./config";
import type {
  DataBlock,
  ModelAdapter,
  NormalizedModelRequest,
  Turn,
  Usage,
} from "./adapters/types";
import { NO_USAGE } from "./adapters/types";
import { CONTEXT_PLANS, type AnchorRead, type ContextPlan } from "./kinds/plans";
import { OUTPUT_SCHEMAS, OUTPUT_SCHEMA_VERSION, type AnyKindOutput } from "./kinds/schemas";
import { isEvaluatedModel as manifestIsEvaluated } from "./prompts/manifest";
import { resolvePrompt as loadPrompt, type ResolvedPrompt } from "./prompts/load";
import type { ArchitectureIntelligenceStore, Standing } from "./store";
import {
  TOOLS,
  TOOL_CONTRACT_VERSION,
  isToolName,
  providerJsonSchema,
  toolDefinitions,
  type ToolName,
} from "./tools/registry";
import type {
  ContextRow,
  InferenceKind,
  InvocationMode,
  IssuedRow,
  ProcessingMode,
  RequestOutcome,
  Subject,
} from "./types";
import { PRE_MODEL_OUTCOMES } from "./types";
import { validateOutput } from "./validation";

/**
 * The Intelligence Gateway (proposal §10, ADR-0062). The one path from a
 * person's request to a provider and back. Server-only by construction: it
 * is reached only through ./server.ts, which imports "server-only".
 *
 * Pipeline: mode → capability → authorization and classes → budget → prompt
 * → subject and anchors → model loop (re-checking before every send) →
 * validation → evaluated-model check → persistence → audit. Nothing is sent
 * before the anchors, refusals read nothing for the model, and every
 * invocation leaves exactly one metadata-only audit record. Every read runs
 * as the requesting user; the Tool Contract cannot write, and the only write
 * is the recording operation, which the store makes through the server-only
 * path for that user (ADR-0069).
 *
 * The Gateway holds no business rule that is not in the database or a
 * reviewed prompt or plan, never falls back to another provider or model,
 * never repairs or retries an output (OD-9), and logs no content.
 *
 * 7B.2 (ADR-0069, ADR-0071): a model may validly answer that it has nothing
 * to add (outcome nothing_to_add; the reason is returned, never stored). An
 * ephemeral interpretation is returned with its citations, and the
 * recording operation holds the exact validated output for thirty minutes
 * so that its requester can keep it. Nothing is an inference until kept.
 */

export type ProviderSettings = {
  providerKey: string;
  region: string;
  requestedModel: string;
  reasoningEffort?: string;
  prices: PriceTable;
  maxRequestUsd: number;
  timeoutMs: number;
};

export type GatewayDeps = {
  store: ArchitectureIntelligenceStore;
  /** Null when no provider is configured: nothing can be sent. */
  adapter: ModelAdapter | null;
  provider: ProviderSettings | null;
  /** Read on every check, so mode off stops an invocation in progress. */
  mode: () => ProcessingMode;
  isEvaluatedModel?: (
    kind: InferenceKind,
    promptVersion: string,
    providerKey: string,
    resolvedModel: string,
  ) => boolean;
  resolvePrompt?: (kind: InferenceKind) => ResolvedPrompt;
  now?: () => Date;
};

export type InvokeInput = {
  engagementId: string;
  kind: InferenceKind;
  subject: Subject;
  mode: InvocationMode;
  /**
   * An evaluation run (the harness only): allowed only in synthetic_only
   * mode on a synthetic engagement, and only then may an ephemeral output
   * from a model not yet evaluated be returned. It is never persisted, and
   * never held for keeping.
   */
  evaluation?: boolean;
  /**
   * A person deliberately asked again where a kept interpretation was shown
   * or suppressed (IX-13, IX-14). Recorded on the request (PD-20).
   */
  interpretAgain?: boolean;
};

/** How a cited handle reads to a person: reference codes and versions. */
export type Citation = { label: string; elementId?: string; withheld?: boolean };

/** Generation provenance shown under "How this was produced". */
export type Provenance = {
  providerKey: string;
  requestedModel: string;
  resolvedModel: string;
  promptVersion: string;
  generationPolicyVersion: string;
  toolContractVersion: string;
  requestedAt: string;
};

export type GatewayResult = {
  outcome: RequestOutcome;
  requestId: string | null;
  message: string;
  /** The validated output, for returned and persisted outcomes only. */
  output?: AnyKindOutput;
  /** The model's one-sentence reason, for nothing_to_add only. Never stored (PD-8). */
  nothingToAddReason?: string;
  /** Labels for every handle issued, for returned and persisted outcomes. */
  citations?: Record<string, Citation>;
  provenance?: Provenance;
  /**
   * For a returned outcome on the application path: the recording operation
   * holds the exact output for its requester to keep until this time.
   */
  keepableUntil?: string;
  /** What the invocation sent, by record identity (never content). */
  manifest: Record<string, unknown>[];
  errorClass?: string;
  reason?: string;
};

export const OUTCOME_MESSAGES: Record<RequestOutcome, string> = {
  persisted: "The inference was recorded.",
  returned: "The inference was returned and not recorded.",
  nothing_to_add: "DSA's records do not support an interpretation of this.",
  refused_mode: "External processing is not enabled for this engagement in this environment.",
  refused_capability: "You do not hold Architecture Intelligence use on this engagement.",
  refused_authorization: "This engagement is not authorised for external processing.",
  refused_class: "This engagement's authorisation does not include the data this request needs.",
  refused_budget: "This request would exceed the engagement's Architecture Intelligence budget.",
  subject_not_found: "That record was not found in this engagement.",
  provider_error: "The provider did not respond. Nothing was recorded.",
  refusal: "The model declined to answer. Nothing was recorded.",
  invalid_output: "The model's answer did not meet DSA's requirements and was discarded.",
  unknown_citation: "The model cited something DSA did not provide; the answer was discarded.",
  model_not_evaluated:
    "The provider's model has not been evaluated for this request; the answer was discarded.",
  authorization_withdrawn:
    "Authorisation changed during the request; it was stopped and nothing was recorded.",
};

const ELIGIBLE_STATUSES = ["proposed", "active"];

type Refusal = { outcome: RequestOutcome; reason: string };

/** Mode, capability, status, authorization, provider, region and classes, as of now. */
function checkStanding(
  standing: Standing | null,
  mode: ProcessingMode,
  plan: ContextPlan,
  provider: ProviderSettings | null,
  input: InvokeInput,
): Refusal | null {
  if (mode === "off") return { outcome: "refused_mode", reason: "mode_off" };
  if (!standing) return { outcome: "refused_capability", reason: "engagement_not_readable" };
  if (mode === "synthetic_only" && standing.dataOrigin !== "synthetic")
    return { outcome: "refused_mode", reason: "not_synthetic" };
  if (input.evaluation && !(mode === "synthetic_only" && standing.dataOrigin === "synthetic"))
    return { outcome: "refused_mode", reason: "evaluation_requires_synthetic_only" };
  if (!standing.canUse) return { outcome: "refused_capability", reason: "no_capability" };
  if (!ELIGIBLE_STATUSES.includes(standing.engagementStatus))
    return { outcome: "refused_authorization", reason: "engagement_status" };
  if (standing.authorizationState !== "authorized" || !standing.authorizationId)
    return { outcome: "refused_authorization", reason: "not_authorized" };
  if (!provider) return { outcome: "refused_mode", reason: "provider_not_configured" };
  if (
    standing.providerKey !== provider.providerKey ||
    standing.processingRegion !== provider.region
  )
    return { outcome: "refused_authorization", reason: "provider_or_region" };
  if (!plan.requiredClasses.every((c) => standing.dataClasses.includes(c)))
    return { outcome: "refused_class", reason: "class_missing" };
  return null;
}

const estimateTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);

function toBlock(issued: IssuedRow): DataBlock {
  const { row } = issued;
  return row.withheld
    ? {
        handle: issued.handle,
        record_type: row.record_type,
        data_class: row.data_class,
        withheld: true,
        withheld_reason: row.withheld_reason ?? undefined,
      }
    : {
        handle: issued.handle,
        record_type: row.record_type,
        data_class: row.data_class,
        withheld: false,
        content: row.content,
      };
}

function manifestEntry(issued: IssuedRow): Record<string, unknown> {
  const { row } = issued;
  return Object.fromEntries(
    Object.entries({
      handle: issued.handle,
      record_type: row.record_type,
      record_id: row.record_id,
      version_id: row.version_id,
      anchor_id: row.anchor_id,
      variant: row.variant,
      data_class: row.data_class,
      digest: row.withheld ? null : row.digest,
      origin: issued.origin,
      withheld: row.withheld,
    }).filter(([, v]) => v !== null && v !== undefined),
  );
}

function addUsage(total: Usage, more: Usage | undefined): Usage {
  if (!more) return total;
  return {
    inputTokens: total.inputTokens + more.inputTokens,
    outputTokens: total.outputTokens + more.outputTokens,
    reasoningTokens: total.reasoningTokens + more.reasoningTokens,
  };
}

export async function invokeArchitectureIntelligence(
  deps: GatewayDeps,
  input: InvokeInput,
): Promise<GatewayResult> {
  const now = deps.now ?? (() => new Date());
  const requestedAt = now().toISOString();
  const plan = CONTEXT_PLANS[input.kind];
  const isEvaluated = deps.isEvaluatedModel ?? manifestIsEvaluated;
  const { store, provider, adapter } = deps;

  const issued: IssuedRow[] = [];
  const toolCalls: Record<string, unknown>[] = [];
  let usage: Usage = NO_USAGE;
  let resolvedModel: string | null = null;
  let providerRequestId: string | null = null;
  let authorizationId: string | null = null;
  let prompt: ResolvedPrompt | null = null;

  const audit = (outcome: RequestOutcome, extra: Record<string, unknown> = {}) => {
    const preModel = PRE_MODEL_OUTCOMES.includes(outcome);
    const priced =
      provider && !preModel
        ? (costUsd(provider.prices, resolvedModel ?? provider.requestedModel, usage) ??
          costUsd(provider.prices, provider.requestedModel, usage) ??
          0)
        : 0;
    return Object.fromEntries(
      Object.entries({
        outcome,
        mode: input.mode,
        inference_kind: input.kind,
        subject_type: input.subject.type,
        subject_element_id: input.subject.elementId,
        authorization_id: authorizationId,
        requested_at: requestedAt,
        prompt_id: prompt ? input.kind : null,
        prompt_version: prompt?.prompt.promptVersion ?? null,
        generation_policy_version: prompt?.policyVersion ?? null,
        tool_contract_version: TOOL_CONTRACT_VERSION,
        provider_key: adapter?.providerKey ?? null,
        requested_model: provider?.requestedModel ?? null,
        resolved_model: resolvedModel,
        provider_request_id: providerRequestId,
        manifest: issued.map(manifestEntry),
        tool_calls: toolCalls,
        input_tokens: preModel ? 0 : usage.inputTokens,
        output_tokens: preModel ? 0 : usage.outputTokens,
        reasoning_tokens: preModel ? 0 : usage.reasoningTokens,
        estimated_cost_usd: Number(priced.toFixed(6)),
        interpret_again: input.interpretAgain ? true : undefined,
        ...extra,
      }).filter(([, v]) => v !== null && v !== undefined),
    );
  };

  const finish = async (
    outcome: RequestOutcome,
    extra: { errorClass?: string; reason?: string; nothingToAddReason?: string } = {},
  ): Promise<GatewayResult> => {
    const recorded = await store.record(
      input.engagementId,
      audit(outcome, extra.errorClass ? { error_class: extra.errorClass } : {}),
      null,
    );
    return {
      outcome,
      requestId: "requestId" in recorded ? recorded.requestId : null,
      message: OUTCOME_MESSAGES[outcome],
      manifest: issued.map(manifestEntry),
      ...extra,
    };
  };

  // 1 to 3. Mode, capability, authorization, provider, region, classes.
  if (!plan.subjectTypes.includes(input.subject.type))
    return finish("subject_not_found", { reason: "subject_type" });
  const mode = deps.mode();
  if (mode === "off") return finish("refused_mode", { reason: "mode_off" });
  const standing = await store.standing(input.engagementId);
  const refused = checkStanding(standing, mode, plan, provider, input);
  if (refused) return finish(refused.outcome, { reason: refused.reason });
  authorizationId = standing!.authorizationId;
  if (!adapter || !provider) return finish("refused_mode", { reason: "provider_not_configured" });

  // 4. Model eligibility and budget, before anything is read for the model.
  prompt = (deps.resolvePrompt ?? loadPrompt)(input.kind);
  if (!provider.prices[provider.requestedModel])
    return finish("model_not_evaluated", { reason: "model_not_priced" });
  if (
    !input.evaluation &&
    !isEvaluated(
      input.kind,
      prompt.prompt.promptVersion,
      adapter.providerKey,
      provider.requestedModel,
    )
  )
    return finish("model_not_evaluated", { reason: "requested_model_not_evaluated" });
  const estimate = requestEstimateUsd(input.kind, provider)!;
  if (estimate > provider.maxRequestUsd)
    return finish("refused_budget", { reason: "request_ceiling" });
  const monthToDate = await store.monthToDateUsd(input.engagementId);
  if (monthToDate === null || standing!.monthlyBudgetUsd === null)
    return finish("refused_budget", { reason: "budget_unavailable" });
  if (monthToDate + estimate > standing!.monthlyBudgetUsd)
    return finish("refused_budget", { reason: "monthly_budget" });

  // 6 and 7. The subject and its anchors, read deterministically as the user.
  const issue = (rows: ContextRow[], origin: IssuedRow["origin"]) => {
    const blocks = rows.map((row) => {
      const entry: IssuedRow = { handle: `R${issued.length + 1}`, origin, row };
      issued.push(entry);
      return toBlock(entry);
    });
    return blocks;
  };
  const params = (tool: ToolName, args: Record<string, unknown>, elementId: string) => ({
    p_engagement_id: input.engagementId,
    ...TOOLS[tool].params(args, elementId),
    ...(tool === "get_evidence" ? { p_include_summary: plan.includeEvidenceSummary } : {}),
  });

  const anchorRows: ContextRow[] = [];
  for (const [index, read] of plan.anchor(input.subject).entries()) {
    const rows = await readAnchor(store, read, params);
    if ("error" in rows) {
      return rows.error === "42501"
        ? finish("authorization_withdrawn", { reason: "anchor_refused" })
        : finish("subject_not_found", { reason: `anchor_${index}` });
    }
    const kept = read.keep ? rows.rows.filter(read.keep) : rows.rows;
    if (index === 0 && kept.length === 0)
      return finish("subject_not_found", { reason: "empty_subject" });
    anchorRows.push(...kept);
  }
  if (input.subject.type === "element_pair") {
    const second = anchorRows.find(
      (r) => r.record_id === (input.subject as { secondElementId: string }).secondElementId,
    );
    const code = (second?.content as { reference_code?: string } | null)?.reference_code;
    const connected = anchorRows.some(
      (r) =>
        r.record_type === "relationship" &&
        (r.content as { other_reference_code?: string } | null)?.other_reference_code === code,
    );
    if (!code || !connected) return finish("subject_not_found", { reason: "pair_not_connected" });
  }
  const turns: Turn[] = [{ type: "data", blocks: issue(anchorRows, "anchor") }];

  // 8. The model loop.
  const tools = toolDefinitions(plan.permittedTools);
  const schema = {
    name: `dsa_${input.kind}_v${OUTPUT_SCHEMA_VERSION}`,
    schema: providerJsonSchema(OUTPUT_SCHEMAS[input.kind]),
  };
  const task = [
    `Question: ${plan.question}`,
    `Subject: ${describeSubject(input.subject, issued)}`,
    "Answer from the record data below, citing handles. Request more only through the tools offered.",
  ].join("\n");
  let executedCalls = 0;
  for (let round = 0; ; round++) {
    // Re-check everything before every send (proposal §23).
    const nowStanding = await store.standing(input.engagementId);
    const stillRefused = checkStanding(nowStanding, deps.mode(), plan, provider, input);
    if (stillRefused || nowStanding!.authorizationId !== authorizationId)
      return finish("authorization_withdrawn", {
        reason: stillRefused?.reason ?? "authorization_replaced",
      });

    const request: NormalizedModelRequest = {
      instructions: prompt.instructions,
      task,
      input: turns,
      tools,
      outputSchema: schema,
      model: {
        requested: provider.requestedModel,
        reasoningEffort: provider.reasoningEffort,
        maxOutputTokens: plan.maxOutputTokens,
      },
      timeoutMs: provider.timeoutMs,
    };
    const response = await adapter.invoke(request);
    usage = addUsage(usage, response.usage);
    if (response.kind === "error")
      return finish("provider_error", { errorClass: response.errorClass });
    resolvedModel = response.resolvedModel;
    providerRequestId = response.providerRequestId;
    if (response.kind === "refusal") return finish("refusal");

    if (response.kind === "tool_calls") {
      if (round > plan.maxToolCalls) return finish("invalid_output", { reason: "tool_loop" });
      for (const call of response.calls) {
        turns.push({
          type: "tool_call",
          callId: call.callId,
          name: call.name,
          arguments: call.arguments,
        });
        const result = await runToolCall(call, executedCalls >= plan.maxToolCalls);
        if (result === "withdrawn")
          return finish("authorization_withdrawn", { reason: "tool_refused" });
        if (!result.refused) executedCalls++;
        turns.push({
          type: "tool_result",
          callId: call.callId,
          blocks: result.blocks,
          refused: result.refused,
        });
      }
      continue;
    }

    // 9. Validation: schema, citations, vocabulary. No repair (OD-9).
    const handles = new Set(issued.map((i) => i.handle));
    const valid = validateOutput(input.kind, response.json, handles);
    if (!valid.ok) return finish(valid.outcome, { reason: valid.reason });

    // 10. The resolved model must have been evaluated (OD-8).
    const evaluated = isEvaluated(
      input.kind,
      prompt.prompt.promptVersion,
      adapter.providerKey,
      response.resolvedModel,
    );
    if (!evaluated && !(input.evaluation && input.mode === "ephemeral"))
      return finish("model_not_evaluated", { reason: "resolved_model_not_evaluated" });

    // Silence is an answer (IX-15): audited with its tokens, never an
    // inference, its reason returned and not stored.
    if ("nothingToAdd" in valid)
      return finish("nothing_to_add", { nothingToAddReason: valid.nothingToAdd });

    // 11 and 12. Persist with the audit record, or return.
    const provenance: Provenance = {
      providerKey: adapter.providerKey,
      requestedModel: provider.requestedModel,
      resolvedModel: response.resolvedModel,
      promptVersion: prompt.prompt.promptVersion,
      generationPolicyVersion: prompt.policyVersion,
      toolContractVersion: TOOL_CONTRACT_VERSION,
      requestedAt,
    };
    const citations = Object.fromEntries(issued.map((i) => [i.handle, citationFor(i)]));
    if (input.mode === "ephemeral" && input.evaluation) {
      const result = await finish("returned");
      return result.requestId ? { ...result, output: valid.output, citations, provenance } : result;
    }
    if (input.mode === "ephemeral") {
      // Held for keeping: the recording operation verifies the basis now and
      // keeps the exact output for its requester (ADR-0069).
      const held = await store.record(
        input.engagementId,
        audit("returned"),
        inferenceRecord(valid.output),
      );
      if ("error" in held) {
        return finish(held.error.code === "42501" ? "authorization_withdrawn" : "invalid_output", {
          reason: `hold_${held.error.code}`,
        });
      }
      return {
        outcome: "returned",
        requestId: held.requestId,
        message: OUTCOME_MESSAGES.returned,
        output: valid.output,
        manifest: issued.map(manifestEntry),
        citations,
        provenance,
        keepableUntil: new Date(now().getTime() + KEEP_WINDOW_MS).toISOString(),
      };
    }
    const recorded = await store.record(
      input.engagementId,
      audit("persisted"),
      inferenceRecord(valid.output),
    );
    if ("error" in recorded) {
      return finish(
        recorded.error.code === "42501" ? "authorization_withdrawn" : "invalid_output",
        {
          reason: `persist_${recorded.error.code}`,
        },
      );
    }
    return {
      outcome: "persisted",
      requestId: recorded.requestId,
      message: OUTCOME_MESSAGES.persisted,
      output: valid.output,
      manifest: issued.map(manifestEntry),
      citations,
      provenance,
    };
  }

  async function runToolCall(
    call: { name: string; arguments: string },
    overLimit: boolean,
  ): Promise<{ blocks: DataBlock[]; refused?: string } | "withdrawn"> {
    const log = (entry: Record<string, unknown>) =>
      toolCalls.push({ name: call.name.slice(0, 100), ...entry });
    const refuse = (why: string) => {
      log({ refused: true });
      return { blocks: [], refused: why };
    };
    if (overLimit) return refuse("The tool call limit for this request has been reached.");
    // The registry is the only dispatch table; anything else is refused.
    if (!isToolName(call.name) || !plan.permittedTools.includes(call.name))
      return refuse("That tool is not available.");
    let raw: unknown;
    try {
      raw = JSON.parse(call.arguments);
    } catch {
      return refuse("Arguments must be JSON.");
    }
    const parsed = TOOLS[call.name].args.safeParse(raw);
    if (!parsed.success) return refuse("Arguments do not match the tool.");
    const args = parsed.data as Record<string, unknown>;
    const code = args.reference_code as string;
    // Only reference codes already present in the data provided can be followed.
    if (!issued.some((i) => !i.row.withheld && JSON.stringify(i.row.content).includes(`"${code}"`)))
      return refuse("Use a reference code from the data provided.");
    const elementId = await store.elementByReference(input.engagementId, code);
    if (!elementId) return refuse("Not found.");
    const rows = await store.callTool(TOOLS[call.name].fn, params(call.name, args, elementId));
    if ("error" in rows) {
      if (rows.error.code === "42501") return "withdrawn";
      return refuse("Not found.");
    }
    const projected = estimateTokens(turns) + estimateTokens(rows.rows);
    if (projected > plan.maxContextTokens)
      return refuse("The context limit for this request has been reached.");
    const blocks = issue(rows.rows, "tool_call");
    log({
      arguments: Object.fromEntries(
        Object.entries(args).map(([k, v]) => [k, String(v).slice(0, 200)]),
      ),
      result_count: blocks.length,
    });
    return { blocks };
  }

  function inferenceRecord(output: AnyKindOutput): Record<string, unknown> {
    const s = input.subject;
    const payload = { ...(output.payload as Record<string, unknown>) };
    if (s.type === "evidence_link") {
      // The recorded stance is echoed from the record, never from the model.
      const link = issued.find(
        (i) => i.row.record_type === "evidence_link" && i.row.record_id === s.linkId,
      );
      payload.recorded_stance =
        (link?.row.content as { stance?: string } | undefined)?.stance ?? null;
    }
    const revisionVersion =
      s.type === "revision"
        ? (s.versionId ?? issued.find((i) => i.row.record_type === "revision")?.row.version_id)
        : undefined;
    return Object.fromEntries(
      Object.entries({
        output_schema_version: OUTPUT_SCHEMA_VERSION,
        assertion: output.assertion,
        claims: output.claims,
        uncertainty: output.uncertainty,
        examination: output.examination,
        payload,
        prompt_content_hash: prompt!.contentHash,
        reasoning_effort: provider!.reasoningEffort,
        subject_second_element_id: s.type === "element_pair" ? s.secondElementId : undefined,
        subject_version_id: revisionVersion,
        subject_rule_key: s.type === "edge_item" ? s.ruleKey : undefined,
        subject_fingerprint: s.type === "edge_item" ? s.fingerprint : undefined,
        subject_link_id: s.type === "evidence_link" ? s.linkId : undefined,
        subject_link_type: s.type === "evidence_link" ? s.linkType : undefined,
        basis: issued
          .filter((i) => !i.row.withheld)
          .map((i) => ({
            handle: i.handle,
            record_type: i.row.record_type,
            record_id: i.row.record_id,
            version_id: i.row.version_id,
            anchor_id: i.row.anchor_id,
            variant: i.row.variant,
            data_class: i.row.data_class,
            digest: i.row.digest,
            origin: i.origin,
          })),
      }).filter(([, v]) => v !== undefined),
    );
  }
}

async function readAnchor(
  store: ArchitectureIntelligenceStore,
  read: AnchorRead,
  params: (
    tool: ToolName,
    args: Record<string, unknown>,
    elementId: string,
  ) => Record<string, unknown>,
): Promise<{ rows: ContextRow[] } | { error: string }> {
  const call = (args: Record<string, unknown>) =>
    store.callTool(TOOLS[read.tool].fn, {
      ...params(read.tool, args, read.elementId),
      ...read.extraParams,
    });
  let result = await call(read.args ?? {});
  // An element with no published version is read in its working state.
  if (
    "error" in result &&
    result.error.code === "P0002" &&
    read.tool === "get_element" &&
    read.args?.state === "published"
  )
    result = await call({ ...read.args, state: "working" });
  return "error" in result ? { error: result.error.code } : result;
}

function describeSubject(subject: Subject, issued: IssuedRow[]): string {
  const handleOf = (id: string) =>
    issued.find((i) => i.row.record_id === id)?.handle ?? "(not provided)";
  switch (subject.type) {
    case "edge_item":
      return `the Development Edge item ${subject.ruleKey} on ${handleOf(subject.elementId)}`;
    case "revision":
      return `the latest substantive revision of ${handleOf(subject.elementId)}`;
    case "impact_trace":
      return `the governed impact trace from ${handleOf(subject.elementId)}`;
    case "element_pair":
      return `the statements of ${handleOf(subject.elementId)} and ${handleOf(subject.secondElementId)}`;
    case "evidence_link":
      return `the evidence link ${handleOf(subject.linkId)} on ${handleOf(subject.elementId)}`;
    case "element":
      return `${handleOf(subject.elementId)}`;
  }
}

/** The recording operation holds a returned interpretation this long (ADR-0069). */
export const KEEP_WINDOW_MS = 30 * 60 * 1000;

/**
 * The pre-send cost estimate for one invocation of a kind (OD-7 bounds):
 * every turn at the plan's context and output caps, at the requested
 * model's configured price. Null when the requested model has no price.
 */
export function requestEstimateUsd(
  kind: InferenceKind,
  provider: Pick<ProviderSettings, "prices" | "requestedModel">,
): number | null {
  const plan = CONTEXT_PLANS[kind];
  const price = provider.prices[provider.requestedModel];
  if (!price) return null;
  const turnsBound = plan.maxToolCalls + 2;
  return (
    (turnsBound *
      (plan.maxContextTokens * price.inputPerMTok + plan.maxOutputTokens * price.outputPerMTok)) /
    1_000_000
  );
}

/**
 * Whether a request is larger than usual: its estimate exceeds half the
 * per-request ceiling (IX-25, PD-17). The person confirms before sending.
 * No figure is shown to anyone for this.
 */
export function isLargeRequest(
  kind: InferenceKind,
  provider: Pick<ProviderSettings, "prices" | "requestedModel" | "maxRequestUsd">,
): boolean {
  const estimate = requestEstimateUsd(kind, provider);
  return estimate !== null && estimate > provider.maxRequestUsd / 2;
}

function str(content: unknown, key: string): string | undefined {
  const v = (content as Record<string, unknown> | null)?.[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : undefined;
}

/** A citation label from an issued row's projection: codes and versions only. */
export function citationFor(issued: IssuedRow): Citation {
  const { row } = issued;
  const c = row.content;
  if (row.withheld)
    return { label: "A record not authorised for external processing", withheld: true };
  const code = str(c, "reference_code");
  switch (row.record_type) {
    case "element_version":
      return { label: `${code} v${str(c, "version_no")}`, elementId: row.record_id };
    case "element_working":
      return { label: `${code} (working)`, elementId: row.record_id };
    case "revision":
      return { label: `${code} v${str(c, "version_no")} revision`, elementId: row.record_id };
    case "relationship":
      return {
        label: `${str(c, "from")} ${(str(c, "relationship_type") ?? "").replaceAll("_", " ")} ${str(c, "other_reference_code")}`,
        elementId: row.anchor_id ?? undefined,
      };
    case "impact_reach":
      return {
        label: `${str(c, "reached_reference_code")} (reached from ${str(c, "from")})`,
        elementId: row.record_id,
      };
    case "edge_item":
      return {
        label: `Edge item on ${str(c, "subject_reference_code")}`,
        elementId: row.record_id,
      };
    case "evidence_link":
      return { label: `Evidence: ${str(c, "evidence_title")}` };
    case "acceptance_criterion":
      return { label: code ?? "An acceptance criterion" };
    case "review_capture":
      return { label: `${str(c, "review")} examined set`, elementId: row.record_id };
    case "checkpoint":
      return { label: `Checkpoint: ${str(c, "title")}` };
    default:
      return { label: row.record_type };
  }
}
