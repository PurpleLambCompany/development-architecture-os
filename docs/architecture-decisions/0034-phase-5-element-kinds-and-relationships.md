# ADR-0034: Phase 5 element kinds, reference prefixes and relationship vocabulary

**Status:** Accepted (Phase 5 proposal §4, §21; approved 2026-09-30)

## Context

Phase 5 governs realizing approved architecture into operating reality: Reviews (formal judgment sessions), Deliverables (formal outputs) and Implementation Initiatives (realization efforts). These need the same versioning, publication, evidence and relationship machinery every other element kind already has (ADR-0013), not a parallel structure.

## Decision

- Three new `element_kind` values join the spine: `review` (prefix `REV`, subtype table `reviews`), `deliverable` (prefix `DLV`, subtype table `deliverables`), `implementation_initiative` (prefix `IMP`, subtype table `implementation_initiatives`). None belongs to a single domain, the same as Project Intelligence records.
- Six new relationship types join the vocabulary (33 → 39): `examines` (Review → any element or Project Intelligence record — the review's agenda), `raises` (Review → a new judgment record, including an Implementation Initiative), `documents` (Deliverable → any element), `implements` (Implementation Initiative → core object — the architecture being realized), `initiates` (Decision or Recommendation → Implementation Initiative), `validates` (Review → Implementation Initiative — see ADR-0036 for its restricted-write rule).
- Existing pairings (`part_of`, `precedes`, `threatens`/`mitigates`, `underpins`, `constrains`, `affects`/`addresses`, `has_stake_in`/`subject_to`, `conflicts_with`) extend to the three new kinds where they make sense. `advances`/`pursues` (Opportunity-specific) do not extend.

## Consequences

- Reference codes, versioning, publication, evidence links and statements work identically for Reviews, Deliverables and Implementation Initiatives, with no Phase-5-specific exceptions in that machinery.
- The reference prefixes and relationship types are permanent vocabulary; removing or renaming any of them later is a migration touching every element or relationship that used them, not a local change.

## Amendment (Phase 7A, 2026-09-30)

A Review's agenda (`examines`) closes when the Review is held (OD-7). The trigger `private.guard_examined_set` on `architecture_relationships` refuses a new `examines` from a held Review, and refuses retiring or deleting an existing one, with "The examined set closed when this Review was held. Use a later Review for further examination." Existing relationships are preserved, including those that Reviews held before Phase 7A gained after their hold, and `hold_review` captures the exact version of each examined element (ADR-0054). Further formal examination uses a later Review. The validation gate (ADR-0035, ADR-0036) therefore means "examined at the hold": a held Review can validate an initiative only if it examined the initiative, or a core object it implements, when it was held.
