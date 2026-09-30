# ADR-0018: Typed relationships with allowed pairings enforced by the database

**Status:** Accepted (Phase 3 proposal §9 and §15.6, vocabulary approved 2026-09-30)

## Context

The four domains meet only through typed relationships with specific meanings in the Method. A generic "related to" link would dissolve the domains into one undifferentiated graph.

## Decision

- 31 relationship types in `relationship_types` (5 structural, 18 design flow, 6 Project Intelligence, 2 lineage and tension); allowed pairings in `relationship_rules`. A relationship is accepted only if a rule matches its source and target kind and object type.
- Self-links and cross-engagement links are refused (composite foreign keys).
- `part_of`, `specializes`, `precedes` and `supersedes` are acyclic. A trigger locks the engagement's relationship scope (a transaction advisory lock keyed on the engagement) and refuses any insert that would create a path back to the source, so concurrent inserts cannot jointly create a cycle.
- `conflicts_with` is symmetric and stored once per pair in canonical order (`source < target`), by check constraint and unique index; the insert trigger normalizes the order.
- Only Role **requires** Skill carries a qualifier (`required_proficiency`).
- `supersedes` is written only by `supersede_element`.
- Published relationships are immutable; changing one means retiring it and creating another, so baselines can cite relationship ids.

## Consequences

- Removing or renaming a relationship type means rewriting links; adding a type or pairing is a migration.
