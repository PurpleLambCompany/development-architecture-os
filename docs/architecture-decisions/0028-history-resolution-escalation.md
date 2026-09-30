# ADR-0028: Status history, resolution and escalation

**Status:** Accepted (Phase 4 proposal §7 and §15.8–15.9; approved 2026-09-30)

## Context

A register must show how each record changed over time, and why. Resolution (closing, accepting, invalidating, lapsing) and escalation are judgments that need a stated reason.

## Decision

- `intelligence_status_changes` is append-only. Triggers on the subtype and stewardship tables write one row for each change to a tracked field (statuses, scores, confidence, validation, blocking, negotiable, priority, category, attention, triage state, next review), with the actor, the operation and the rationale when one was given. No role can insert, change or delete a row directly.
- Terminal statuses are reached and left only through `resolve_intelligence_record` and `reopen_intelligence_record`, each with a required rationale. Risk acceptance needs `publish_architecture`. Resolution may publish the new version in the same transaction for publishers; otherwise the change waits for publication like any other.
- `risk_status` gains `materialized`: the risk has occurred and stays in the register as such.
- Escalation has two levels, `principal_architect` and `client_executive`, with one open escalation per record and level. A client-executive escalation needs `publish_architecture` and a published, client-visible record, and is delivered as an `executive_attention` client action. Escalation never changes status, lifecycle, visibility or maturity.

## Consequences

- History is complete from Phase 4 onward; earlier changes appear only as published versions.
- Enum values (`materialized`) are permanent.
