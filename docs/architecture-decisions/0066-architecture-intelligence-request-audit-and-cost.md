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
