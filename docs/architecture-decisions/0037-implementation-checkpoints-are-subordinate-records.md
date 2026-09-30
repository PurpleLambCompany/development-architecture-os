# ADR-0037: Implementation Checkpoints are subordinate records, not elements

**Status:** Accepted (Phase 5 proposal §7.6, §21, decisions D9/D15; approved 2026-09-30)

## Context

An initiative needs to record meaningful conditions or events inside its own realization (a design being approved, a first agreement being executed, a system entering operation, a scheduled post-implementation review) without becoming a task list. The test for whether something belongs on the element spine (ADR-0013) is whether it could reasonably have its own owner, its own status lifecycle, and outlive or be reused outside its parent — a Checkpoint fails that test by design; a genuinely separable piece of realization work is instead a sub-initiative via `part_of`.

## Decision

- `implementation_checkpoints` is a plain table, not a fourth `element_kind`: no spine row, no reference code, no independent versioning, no lifecycle beyond "not yet achieved / achieved" (derived from `achieved_on is null`), no approval workflow, no dedicated history table.
- Columns: `implementation_initiative_id` (parent), `checkpoint_type` (`design_approved` / `agreement_executed` / `operational_entry` / `scheduled_review` / `other`), `title`, `target_on`, `achieved_on`, `achieved_evidence_source_id` (a single optional citation, not an evidence library), `related_review_id`, `related_approval_id`, `client_visible`.
- Editable by whoever holds `manage_implementation` on the parent initiative — the same capability governing the initiative, not a separate authority.
- Sub-initiatives (`part_of`) remain the mechanism for realization work that is genuinely separable — its own owner, its own status, potential reuse. Checkpoints are facts about one initiative's progress, never a hierarchy.

## Consequences

- Checkpoints structurally cannot accumulate their own sub-relationships or evidence library, so they cannot grow into a de facto subtask/kanban system without a deliberate schema change.
- If usage later shows checkpoints need real independence (their own owner, cross-initiative reuse, a richer evidence library), promoting them to a full element kind is a genuine migration — new reference prefix, spine participation, backfill — not a small addition. This cost was accepted knowingly (§7.6's tradeoff table) in favor of the lighter shape Kerrick's brief called for.
