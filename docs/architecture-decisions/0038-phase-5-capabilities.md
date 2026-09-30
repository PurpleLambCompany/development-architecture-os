# ADR-0038: Phase 5 capabilities

**Status:** Accepted (Phase 5 proposal §12, decision D6; approved 2026-09-30)

## Context

Reviews, Deliverables and Implementation are new internal work surfaces, distinct enough in who should touch them that reusing an existing capability would either over- or under-grant access — matching how Phase 4 (ADR-0031) added its own capabilities rather than widening Phase 3's.

## Decision

Three new engagement capabilities, TPLCo-only, granted per ADR-0008's existing model:

- `manage_reviews` — create/schedule/hold/cancel reviews, add participants, record agenda/findings. Default holders: Principal Architect, Architect, Researcher, Project Administrator.
- `manage_deliverables` — draft deliverables, attach files, request approval. Same default holders as `manage_reviews`.
- `manage_implementation` — create/edit initiatives and checkpoints, non-terminal status updates, link evidence. Default holders: Principal Architect, Architect, Project Administrator — **not** Researcher, since Implementation is realization work, not research.

`publish_architecture` (ADR-0024, unchanged) continues to gate the judgment-grade acts: `record_review_validation` and both terminal `resolve_implementation_initiative` transitions (`validated`, `abandoned`).

## Consequences

- No role-name checks anywhere in Phase 5's authorization: every gate is a capability check, consistent with every prior phase.
- Researchers can staff reviews and draft deliverables but cannot themselves move implementation status — a deliberate asymmetry that would need an explicit new decision to change, not a default-holders tweak.
