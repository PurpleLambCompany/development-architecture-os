# ADR-0036: Implementation status definitions and the `validated` gate

**Status:** Accepted (Phase 5 proposal §7.2, §21, decisions D8/D16; approved 2026-09-30)

## Context

Implementation must distinguish three separate claims that generic project-management status fields conflate: that realization work happened, that the result is asserted to operate, and that a qualified reviewer has judged it sufficiently conforms to architectural intent. Collapsing these into one status field (as a kanban "done" column would) is exactly the pattern Kerrick's brief excluded.

## Decision

- `implementation_status` has six values with precise, separately-reached meanings: `not_started`, `in_progress`, `operational` (an evidenced but unreviewed claim — operating state, not yet judged), `validated` (a qualifying review has formally judged conformance), `stalled` (requires a stated reason), `abandoned` (terminal, requires a stated reason).
- `not_started` / `in_progress` / `operational` / `stalled` are reached by a direct edit (`update_implementation_status`, gated by `manage_implementation`).
- `validated` and `abandoned` are terminal and reached only through `resolve_implementation_initiative`, gated by `publish_architecture`.
- `validated` specifically is **unreachable by direct edit under any circumstance**: `resolve_implementation_initiative` refuses the transition (23514) unless a `validates` relationship (ADR-0035) already exists from a `review`-kind element to this initiative. There is no status value or code path that sets `validated` without that relationship existing first.
- One implementation signal at launch (D16): `implementation_past_target` fires for an active initiative whose `target_operational_on` has passed without reaching `validated`. No signal infers "stalled" from elapsed time alone without an actual status change — stalling is a stated fact (rationale required), never a computed inference.

## Consequences

- `validated` reliably means "a review looked at this and said so," in the database, not by convention — a query or a client snapshot can trust the status value itself rather than needing to cross-check for a relationship separately.
- Adding a way to reach `validated` other than through `resolve_implementation_initiative` (a bulk-import shortcut, an admin override) would need to independently reconstruct this same gate or it silently breaks the guarantee this ADR establishes.
