# ADR-0053: Substantive revision

**Status:** Accepted (Phase 7A; approved 2026-09-30)

## Context

Phase 7A proposal (Revision 2) §12; reconciliation decision Q30 and finding F2; Kerrick's OD-1.

Publishing a new element version is how every status change in Phases 3 to 5 reaches the governed record. IMP-001's move to `operational` created its version 2, which differs from version 1 only in status. A Change rule that treated every new version as a revision would report that the design changed when only its status did. Q30 decided that, for Phase 7A Change intelligence, a publication is a substantive revision only when the governed snapshot changes outside lifecycle and status fields, using an explicit, type-aware, governed and tested list, and that `change_summary` is never parsed to decide substance.

## Decision

**Definition.** A published version _n_ (n ≥ 2) is a **substantive revision** if and only if its internal snapshot differs from the snapshot of version _n − 1_ after removing, from both, the excluded paths for the element's kind. Version 1 is a **first publication**, a separate change type and never a revision. A later version that differs only in excluded paths is a **status publication**.

**The excluded paths** (status and lifecycle only; everything else is content):

| Kind                        | Excluded paths                                                   |
| --------------------------- | ---------------------------------------------------------------- |
| Every kind (element)        | `ai_review_state`, `ai_reviewed_by`, `ai_reviewed_at`            |
| Every kind (each statement) | `statements[].ai_review_state`, `statements[].ai_reviewed_by`    |
| `object`                    | `details.maturity`, `details.maturity_rationale` (OD-1)          |
| `assumption`                | `details.validation_status`, `details.validation_note`           |
| `risk`                      | `details.risk_status`                                            |
| `constraint`                | `details.constraint_status`                                      |
| `dependency`                | `details.dependency_status`                                      |
| `decision`                  | `details.decision_status`, `details.deferred_reason`             |
| `recommendation`            | none                                                             |
| `opportunity`               | `details.opportunity_status`                                     |
| `review`                    | `details.review_status`, `details.held_at`                       |
| `deliverable`               | none                                                             |
| `implementation_initiative` | `details.implementation_status`, `details.actual_operational_on` |

A decision's outcome (chosen option, note, decider, decided time, source) is content and stays substantive. Object maturity is its own governed status and judgment axis (ADR-0019, ADR-0020) and never creates a Change event by itself.

**Where it is computed** (migration `20261006000100_substantive_revisions.sql`):

- `private.substantive_detail_exclusions(kind)` and `private.substantive_excluded_paths(kind)` hold the list.
- `private.substantive_snapshot(kind, snapshot)` is an immutable function that removes the excluded paths.
- `private.snapshot_changed_paths(before, after)` returns the top-level and `details` keys that differ, for explanation only.
- `private.element_revision_rows(engagement, element)` classifies every published version as `first_publication`, `substantive_revision` or `status_publication`, with its `changed_paths` and `change_summary`, using jsonb equality of consecutive reduced snapshots.
- `private.element_content_state(engagement)` gives, per element, its latest content version (first publication or substantive revision), its latest substantive revision and the revision count. Every Change rule and `change_reaches` read it.
- `public.element_revisions(engagement, element)` is the internal read (`security definer`, returning rows only where `can_read_architecture` holds).

**Computed at read time.** Nothing is stored on `element_versions`, and Phase 3's publication path is unchanged. The inputs are immutable versions, so the classification is reproducible. Changing the definition later is a migration to these functions, with their tests.

**`change_summary` is never parsed.** It has no effect on classification. Where it is shown, it is quoted verbatim and labeled as the author's words.

**Mirrored and tested.** `src/domain/edge/substantive.ts` (`EXCLUDED_FOR_ALL_KINDS`, `EXCLUDED_BY_KIND`) mirrors the list; `substantive.test.ts` asserts that it equals the migration's list and that every excluded path exists in the snapshot builder's output for its kind. The database tests prove, per kind, that a status-only publication is a status publication, that one content change is a substantive revision, and that each excluded path is individually excluded.

## Consequences

- Change rules (ADR-0051) act on substantive revisions only, so status publications produce no Change item and no `change_reaches` consequence (the F2 regression).
- The list is deliberately short. It names status and nothing else is suppressed; a changed title, summary, statement, owner, visibility or design date is always a revision.
- The briefing (ADR-0057) shows status publications too, listed after substantive changes, because they remain real governed events.
- No AI, heuristics or text interpretation decide substance.
