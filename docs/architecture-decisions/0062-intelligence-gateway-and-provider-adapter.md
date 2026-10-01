# ADR-0062: Intelligence Gateway and provider adapter boundary

**Status:** Accepted (Phase 7B.1; approved 2026-10-01)

## Context

Phase 7B.1 proposal §10, §11, §23 and §24; reconciliation decision B-3; Kerrick's OD-7, OD-8, OD-9 and OD-15.

## Decision

**One path.** `src/domain/architecture-intelligence/gateway.ts` is the only path from a person's request to a provider. It runs as the requesting user (never the service role, ADR-0005 amendment; since 7B.2 it records through one server-only call, see the Step A review amendment below) and is reached from the application only through `server.ts`, which imports `server-only`. In 7B.1 no application route calls it (OD-12); only the evaluation harness does.

**Pipeline.** mode → capability → authorisation, engagement status, provider, region and required classes → model eligibility and budget → prompt → subject and anchors → model loop → validation → evaluated-model check → persistence → audit. Steps before the anchors read nothing for the model and send nothing. Every invocation writes exactly one metadata-only audit record (ADR-0066).

**Re-check before every send.** Before each provider call the Gateway re-reads the mode and the requester's standing; if the mode is off, the capability is gone, the engagement is no longer eligible, a required class was removed, or the authorisation in force is not the one the invocation started under, it stops with `authorization_withdrawn` and persists nothing. The recording operation re-checks again under a shared lock that serialises with authorisation changes (ADR-0064).

**Bounded loop (OD-7).** Fixed anchors, then at most six model-requested Tool Contract calls. This is a 7B.1 evaluation and safety bound, not a permanent product limit. Calls over the limit, to a tool outside the kind's plan, to an unknown name, with invalid arguments, or naming a reference code not present in the data already provided are refused without any database call. A model that keeps calling tools is stopped (`invalid_output`).

**No repair (OD-9), no fallback.** An invalid output is rejected; there is no second call to fix it and no retry with a changed prompt. Retryable transport errors (timeout, rate limit, unavailability) are retried at most twice before any output; authentication and bad-request errors never are. No fallback to another provider or model, ever.

**Evaluated models only (OD-8).** Any resolved model id not listed for the prompt version in the manifest is material: the output is refused (`model_not_evaluated`). A requested model that is unpriced or unevaluated is refused before anything is sent. The only exception is an ephemeral evaluation run (the harness, `synthetic_only` mode, synthetic engagement), whose output is returned for grading and never persisted.

**Budget.** Before sending, a conservative estimate (turns × context and output caps at the requested model's configured price) must fit within the per-request ceiling (`ARCHITECTURE_INTELLIGENCE_MAX_REQUEST_USD`) and, with month-to-date cost, within the authorisation's monthly budget. Actual cost is recorded from reported usage.

**Adapter boundary (OD-15).** `ModelAdapter` translates a normalised request into one provider's shape and back. `FunctionToolDefinition` is the only tool type it can express, so provider-hosted tools (web search, file search, code execution, MCP, computer use) cannot be requested. The OpenAI adapter uses `fetch` against the Responses API with no SDK: `store: false` always; never `previous_response_id`, `conversation`, `background`, hosted prompts, `include` or metadata; function tools only, strict; structured output by strict JSON schema; reasoning items discarded; the resolved model read from the response. No request or response body is logged. A deterministic `FakeModelAdapter` serves CI and pipeline evaluation.

**Configuration.** Provider, credential, region, base URL, requested model, reasoning effort, price table and per-request ceiling are server environment variables, validated by `providerConfig()`. Incomplete configuration means nothing can be sent.

## Consequences

Adding a provider means an adapter, an evaluation report per kind and an authorisation naming it. The Gateway contains no business rule that is not in the database, a reviewed prompt or a reviewed context plan.

## Amendment (Phase 7B.2, 2026-10-01): the application path, holding for keeping, and the fake provider

Phase 7B.2 Step A (IX-12, IX-16, IX-25; PD-2, PD-3, PD-4, PD-17; ADR-0067 to ADR-0073) adds an application route to the Gateway. The pipeline, the re-check before every send, the bounded loop, no repair, no fallback and the evaluated-models rule are unchanged.

- **Ephemeral only, on a person's action.** The `interpret` server action (`experience/actions.ts`) is the only application caller. It re-runs the gate and the availability rule, then calls the Gateway through `server.ts` in `ephemeral` mode, as the requesting user. No model call happens without a person's explicit action, and a source scan (`imports.test.ts`) proves no application module requests `persist`, which remains for the evaluation harness on synthetic engagements only.
- **Holding for keeping.** A valid ephemeral interpretation is recorded as `returned` together with its validated output, which `record_architecture_intelligence_request` verifies like a persisted inference and holds, unreadable, for its requester for thirty minutes (`KEEP_WINDOW_MS`; ADR-0069). If holding is refused, the request ends `authorization_withdrawn` (`42501`) or `invalid_output`, and nothing is shown. An evaluation run's ephemeral output is still never held.
- **Silence.** A valid `nothing_to_add` answer from an evaluated model ends as outcome `nothing_to_add`, its reason returned and never stored (ADR-0071).
- **Large requests.** `isLargeRequest` compares the existing pre-send estimate with half the per-request ceiling (PD-17). Above it, the person confirms before anything is sent; no figure is shown.
- **Providers.** `activeProvider` selects a configured real provider or, only under ADR-0073's conditions (provider `fake`, mode `synthetic_only`, `NODE_ENV` not `production`), the deterministic fake, with the test manifest overlay as its evaluated-model check. Naming `fake` outside those conditions selects nothing; it never falls back to a real provider.

## Amendment (Phase 7B.2 Step A review, 2026-10-01): server-only recording

The Gateway still reads, plans, calls the Tool Contract and re-checks as the requesting user. Recording alone changes: the Gateway's store records through `record_architecture_intelligence_request_for`, executable only by `service_role`, for the requester the Auth server verified, and that operation runs every recording check as that person (ADR-0069 amendment, migration `20261008000800`). The user-session client can no longer record. A model's output therefore reaches storage only after the Gateway validated it.
