# ADR-0021: Approvals and baselines reference immutable version ids

**Status:** Accepted (Phase 3 proposal §6.10, §6.11, §12 and §15.9, decisions 16.1.4 and 16.1.5)

## Context

A client approval is a commitment about exactly what was shown. A baseline is the basis of every later comparison.

## Decision

- `architecture_approvals` targets exactly one of an `element_versions` row or a frozen `architecture_baselines` row. Responses are `approved` (optional comment) or `changes_requested` (comment required), written once, then immutable.
- Portal responses need `approve_architecture` and `view_architecture`. External approvals are recorded by a `publish_architecture` holder with the approver, date, method, evidence reference, recorder and time, and are marked `external_recorded_by_tplco` (the Phase 2 `approval_source` enum).
- An approval of v2 stays true of v2 after v3 is published.
- Baselines are minimal: items reference version ids (one per element), relationships and domain assessments reference ids; `freeze_baseline` locks them. `compare_baselines` is set arithmetic over ids.
- Decisions: options, a recommended option (`architect_judgment`) and the client's choice (`client_decision`); a decided decision is frozen.

## Consequences

- Versions and frozen baselines can never be edited or deleted; corrections are new versions or baselines.
