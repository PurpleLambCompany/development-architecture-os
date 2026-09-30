# ADR-0032: Intelligence signals are computed; dismissals are stored

**Status:** Accepted (Phase 4 proposal §11 and §15.11, decision D11; approved 2026-09-30)

## Context

Architecture Intelligence (Phase 7) will point out gaps and tensions. Phase 4 prepares for it without AI.

## Decision

- Signals are named, deterministic rules evaluated by `intelligence_signals(engagement, as_of)` for internal readers only. Each carries a rule key, the element concerned, a fingerprint of the facts that fired it, and details.
- A signal never changes a record. Its provenance is `system_derived`.
- `intelligence_signal_dismissals` stores who dismissed which signal, why, the fingerprint at the time and an optional expiry. A dismissed signal returns when its fingerprint changes or the dismissal expires.
- Thresholds (severity 15 or more, a 30-day opportunity window, 7 days untriaged) are constants in the function.
- Future AI findings will be stored, not computed, with `ai_analysis` provenance and the Phase 3 review gate.

## Consequences

Dismissal reasons become structured material for later analysis.
