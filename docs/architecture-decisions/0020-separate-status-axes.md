# ADR-0020: Lifecycle, approval, maturity and record status are separate axes

**Status:** Accepted (Phase 3 proposal §5 and §15.8)

## Context

Collapsing "published", "approved", "mature" and "done" into one status is how architecture turns into a task tracker.

## Decision

- **Lifecycle** (`draft`, `in_review`, `published`, `superseded`, `retired`) on every element, changed only by operations.
- **Approval state** is derived per published version from `architecture_approvals`; it never moves the lifecycle.
- **Object maturity** (`undefined` … `operationalized`) on core objects, set by editors with a required rationale above `undefined`.
- **Domain maturity** per engagement and domain (ADR-0019).
- **Record status** per Project Intelligence kind (risk status, validation status, decision status and so on).
- Implementation status arrives in Phase 5 in its own table and never changes any of these automatically.

## Consequences

- Stored history keeps each meaning distinct; merging them later would lose information.
