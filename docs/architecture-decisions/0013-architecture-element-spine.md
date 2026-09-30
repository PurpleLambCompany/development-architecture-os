# ADR-0013: Architecture elements share one spine with subtype tables

**Status:** Accepted (Phase 3 proposal §3.1 and §15.1, approved 2026-09-30)

## Context

Core architecture objects (27 types across four domains) and Project Intelligence records (assumptions, risks, constraints, dependencies, decisions, recommendations) must be connected, evidenced, versioned, published and approved in the same way. A risk must be able to threaten a capability, and a decision must be able to affect an operating model, with foreign keys the database can check.

## Decision

- Every element has one row in `architecture_elements` (the spine): engagement, kind, reference code, title, summary, lifecycle, client visibility, provenance, IP classification, owner, methodology version, AI review state and the latest published version.
- Each kind has its own table keyed by the same id, with the kind pinned by a composite foreign key `(element_id, kind)`: `architecture_objects`, `assumptions`, `risks`, `constraints`, `dependencies`, `decisions` (with `decision_options`) and `recommendations`.
- Relationships, statements, evidence links, versions, approvals and lineage reference the spine id with same-engagement composite foreign keys `(element_id, engagement_id)`.
- Rejected: a table per kind with polymorphic links (unchecked), and one generic jsonb table (a task system by another name).

## Consequences

- Every later feature (reviews, deliverables, AI analysis) keys on element ids; changing this later would rewrite every link.
- A spine row without its subtype row is refused at commit by a deferred constraint trigger.
