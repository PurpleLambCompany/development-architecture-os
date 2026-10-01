# ADR-0066: Architecture Intelligence request audit and cost

**Status:** Accepted (Phase 7B.1; approved 2026-10-01)

## Context

Phase 7B.1 proposal §20 and §21; reconciliation decisions B-21 and B-22; Kerrick's OD-10.

## Decision

**One metadata-only row per invocation.** `public.architecture_intelligence_requests`: requester and times (from the session and the clock; the start cannot be backdated by more than fifteen minutes or placed in the future), kind, mode, subject, outcome (closed list of fourteen), authorisation, prompt, policy and contract versions, provider, requested and resolved model, provider request id, manifest (identities only), tool-call log (names, argument codes, result counts, refusals), tokens, estimated cost, and an error class. No prompt, context, output or provider error body is stored, here or anywhere. Refusals before any model call carry no tokens or cost. Append-only; written only by the recording operation; not in `activity_log` (OD-10).

**Readers.** Holders of `authorize_external_ai_processing` on the engagement. Not Architects, Researchers, Project Administrators, Finance, System Administrators or clients.

**Never per person.** No read model counts, totals, ranks or compares anything per person (tested: only the budget function and the recording operation touch the table, no view exists over it, nothing groups by requester). The only aggregate is per engagement: `public.architecture_intelligence_budget(eng)` (monthly budget, month-to-date cost, request count), readable by use or authorise holders because the Gateway enforces the budget as the requester. The page lists individual requests and per-engagement outcome counts for the month, never per-person totals.

**Standing.** `public.architecture_intelligence_standing(eng)` returns the caller's use and authorise standing, the engagement's data origin and status and the authorisation in force, for the Gateway's checks and the page. It reads no architecture.

## Consequences

Retention follows the engagement. Cost governance has four layers: per-kind caps, per-request ceiling, per-engagement monthly budget, and the provider's own hard limit.

## Amendment (Phase 7B.2, 2026-10-01): `nothing_to_add`, `interpret_again` and reuse

Phase 7B.2 Step A (IX-13, IX-14, IX-15, IX-25; PD-8, PD-13a, PD-17, PD-20; ADR-0068, ADR-0071), migration `20261008000000_ai_request_outcomes_v2.sql`.

- **A fifteenth outcome.** `nothing_to_add`: the model answered, validly, that DSA's records do not support an interpretation. It carries tokens and estimated cost like any model call, needs the use capability when recorded, and never carries an inference or a held output. The model's reason is not stored, here or anywhere.
- **`interpret_again`.** `architecture_intelligence_requests.interpret_again boolean not null default false` records that a person deliberately asked again where a kept interpretation was shown for reuse or a judgment suppressed re-offering. It is a flag, not an outcome, and is accepted by the recording operation's allowlist only as a boolean.
- **`returned` may hold an output.** On the application path a `returned` request is recorded together with its validated output, which is held for keeping in `pending_architecture_inferences` (ADR-0069). The audit row itself still carries identities only.
- **Reuse writes no audit row.** Showing a kept, current interpretation in place of a new request calls no provider and records nothing: nothing leaves DSA.
- **Two more readers of single rows, never aggregates.** `keep_architecture_inference` reads the caller's own request to confirm it is `returned`, `ephemeral` and theirs. `public.current_architecture_inference` reads the resolved model most recently recorded on the engagement for the configured provider and requested model, so reuse ends when the resolved model changes (PD-13a). It returns an inference id and resolved model, never a request row, and reads nothing per person. `45_ai_requests` now asserts that exactly four functions touch the table: the budget, the recording operation, keeping and reuse; no view exists over it and nothing groups by requester.
- **Large requests.** The pre-send estimate is also compared with half the per-request ceiling; above it the person confirms first (PD-17). No currency or budget figure is shown for this; budget figures remain on the Architecture Intelligence page for authorisers.
