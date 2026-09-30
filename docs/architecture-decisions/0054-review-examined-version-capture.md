# ADR-0054: Review examined-version capture

**Status:** Accepted (Phase 7A; approved 2026-09-30)

## Context

Phase 7A proposal (Revision 2) §11 and §29.2 clarification 1; reconciliation decision Q29 and finding F5; Kerrick's OD-6 and OD-7.

A Review records its agenda as `examines` relationships (ADR-0034), and `hold_review` records a user-entered `held_at`. Neither says which version of each element the Review looked at, so "what changed since this Review" could only compare a user-entered business time against publication times, which the empirical review showed to be unreliable (F1). Q29 decided that holding a Review captures the exact latest published version of each examined element, produced by the governed hold operation, immutable, version-exact, and distinct from an Architecture Baseline. OD-7 then closed the examined set at hold.

## Decision

**The capture.** `public.review_examined_versions` (`review_element_id`, `element_id`, `engagement_id`, `element_version_id`, `captured_at`; primary key `review_element_id, element_id`) has composite same-engagement foreign keys to `architecture_elements`, and a foreign key from (`element_version_id`, `element_id`) to `element_versions`.

- `hold_review` keeps its signature, checks and effects. Inside the same transaction, after its existing checks, it locks each examined element (`for share`, in id order), sets the `dsa.review_capture` context marker, and inserts one row per unretired `examines` target with that element's `latest_version_id`. It then sets the Review `held`.
- `element_version_id` is null when the element had no published version at hold; any later publication then counts as change since the Review.
- `captured_at` is `clock_timestamp()` set by the guard: **system time**, independent of the user-entered `held_at`.

**Immutable.** `private.guard_review_examined_version` refuses any insert outside the `hold_review` context marker (42501), refuses a row whose Review is not a Review (23514), and refuses every update and delete (23514). There is no operation to change a capture.

**The examined set closes at hold (OD-7).** `private.guard_examined_set`, a trigger on `architecture_relationships`, refuses for a `held` source Review: inserting an `examines`, retiring one (setting `retired_at`) and deleting one, with 23514 "The examined set closed when this Review was held. Use a later Review for further examination." It locks the source Review first, so an insert cannot slip in between the capture and the status change. It covers every write path: the relationship operations, direct inserts under RLS and the seed. Scheduled and cancelled Reviews are unaffected. Existing relationships are preserved.

**Version-exact change.** `examined_element_revised_since_review` compares each captured version number with the element's latest content version, and `evidence_after_review` compares evidence link times with `captured_at`. Neither reads `held_at`. A later held Review whose capture reaches the current version resolves the item for the earlier Review.

**Not a baseline.** The capture is a separate table. No baseline is created, required or implied. A Review may still reference an Architecture Baseline for its own purposes; the capture does not change that. A held Review is one closed governance event: an exact examined set, exact examined versions and an immutable capture.

**No backfill (OD-6).** Reviews held before Phase 7A have no capture. Exact history is never inferred from `held_at`. A historical Review with a frozen baseline gets version-exact change through its baseline items (the `baseline` basis in `private.edge_rules_change`); one without says it predates exact examined-version capture. Its existing `examines`, including any added after its hold, are kept, and its past state is not changed.

**Reading.** Internal members read captures where `can_read_architecture` holds. Clients have no policy. The seed was reordered so REV-001's agenda (APP-001 and IMP-002) is built before it is held.

**Clarification recorded during implementation.** The guard also refuses **deleting** an `examines` from a held Review, not only inserting or retiring one, because a deletion changes the examined set as much as a retirement does.

## Consequences

- "What changed since this Review" is exact and cannot be moved by a backdated `held_at` (the F1 regression).
- A Review cannot validate something it did not examine at its hold (see the ADR-0034 amendment). Further formal examination uses a later Review.
- Correcting a mistaken agenda item after the hold is not possible; the capture still records what was examined, and a later Review is the governed correction.
- No AI, scoring or notification is involved.
