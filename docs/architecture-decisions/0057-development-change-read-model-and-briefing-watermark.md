# ADR-0057: Development change read model and the briefing watermark

**Status:** Accepted (Phase 7A; approved 2026-09-30)

## Context

Phase 7A proposal (Revision 2) §13 and §14; reconciliation decisions Q7 and Q24 and restriction G2 on the raw log; Kerrick's OD-2 and OD-10.

An architect returning to an engagement needs to know what changed while they were away. Two things are needed: a curated, classified account of developmental change across Phases 3 to 6, and a starting point for "since". `activity_log` records every write, but its `metadata_json` holds full before and after rows and must not be exposed as a read model. Q7 allowed one piece of user state: an explicit, user-controlled "briefed through" time per user and engagement, private to the user, with "new" derived from basis timestamps and no view tracking.

## Decision

**The change read model.** `public.development_changes(p_engagement_id, p_since, p_until, p_element_id, p_limit)` is `security definer`, returns nothing unless `can_read_architecture` holds, and returns classified developmental events in **system time**, newest first (`p_limit` defaults to 200, at most 1000). Like `architecture_activity`, it **projects** fields (`occurred_at`, `change_type`, subject, version, related record, `actor_name`, a fixed-vocabulary `summary`) and never returns `metadata_json`.

| Change types                                                                            | Source                                                                      |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `first_publication`, `substantive_revision`, `status_publication`                       | `element_versions`, classified by ADR-0053                                  |
| `element_retired`, `element_superseded`                                                 | `architecture_elements`, `supersedes` relationships                         |
| `relationship_added`, `relationship_retired`                                            | `architecture_relationships`                                                |
| `evidence_linked` (with stance)                                                         | Statement and element evidence links                                        |
| `approval_requested`, `approval_recorded`                                               | `architecture_approvals`                                                    |
| `baseline_frozen`                                                                       | `architecture_baselines`                                                    |
| `record_status_changed`, `decision_deferred`, `decision_decided`                        | `intelligence_status_changes`, `decisions.decided_at`                       |
| `escalation_opened`, `escalation_resolved`                                              | Both escalation tables                                                      |
| `client_action_answered`, `contribution_received`                                       | `client_action_responses`, `client_contributions`                           |
| `review_scheduled`, `review_held`, `review_cancelled`                                   | The `reviews` log rows; a hold is dated by its capture                      |
| `validation_recorded`                                                                   | `validates` relationships                                                   |
| `implementation_status_changed`, `checkpoint_achieved`                                  | `implementation_status_changes`, checkpoint log rows                        |
| `criterion_proposed`, `criterion_agreed`, `criterion_superseded`, `criterion_withdrawn` | `acceptance_criteria`; agreement at `agreed_recorded_at`, never `agreed_on` |
| `application_started`, `application_closed`, `application_addendum`                     | Method Application log rows and `method_application_addenda` (internal)     |

The domain tables are the source wherever they keep a system time. `activity_log` is read only for events whose domain table keeps none: Review status (entity `reviews`), checkpoint achievement (`implementation_checkpoints`) and Method Application state (`method_applications`), and only the fields listed are projected from it.

**Excluded as noise or out of scope:** working-copy saves, stewardship date and attention edits, dismissals and Edge judgments, membership and capability changes, and every Phase 2 commercial event (ADR-0023). `architecture_activity` is unchanged, and element Activity panels keep using it.

**Business dates never date a change.** A Review hold is dated by its capture time (ADR-0054), never `held_at`; a criterion agreement by `agreed_recorded_at` (see the ADR-0046 amendment), never `agreed_on`.

**The briefing watermark.** `public.edge_briefing_marks` (`user_id`, `engagement_id`, `briefed_through`, `updated_at`; primary key `user_id, engagement_id`):

- **User-private.** RLS allows a user to select only their own row. There is no policy for System Administrators, Principal Architects or anyone else, and no read model, function or report exposes another user's mark.
- **Set only by an explicit act.** The one write path is `public.mark_briefed_through(p_engagement_id, p_through)`, which requires `can_read_architecture` and refuses a time in the future. The "Mark reviewed through [time]" button passes the time of the newest change the briefing showed (`markThroughFor` in `src/domain/edge/briefing.ts`), not "now", so nothing that arrived while reading is skipped. The user may move the mark back to re-read. Opening a page never sets it.
- **Not logged.** The table has no activity trigger. An audit row would make the mark readable by the roles that can read the log, which would be view tracking by another route.

**The briefing.** At the top of the Engagement Edge: the development changes since the mark (substantive changes before status publications), and "new on the Edge": events with an item whose `trigger_at` is after the mark (`isNewSince`). `state` and `date` items have no trigger time and appear on the Edge, not under "new". Without a mark, the briefing covers the prior 14 days (`FIRST_BRIEFING_DAYS`) and says so on the page (OD-10); the window is never inferred from sign-in history, page views or membership. The briefing is a document, not a feed: no unread counts, badges, dots or per-item seen state.

**Clarifications recorded during implementation.**

1. `review_scheduled` comes from the **insert** log row of `reviews`, because a Review is created scheduled; `review_held` and `review_cancelled` come from update rows that change `review_status`.
2. The mark is **stored and compared at full microsecond precision.** The page passes the database's timestamp string back to `mark_briefed_through` unchanged (a JavaScript `Date` would round it to milliseconds), and `development_changes` returns changes strictly after `p_since`, so marking reviewed covers the newest change exactly and does not show it again.
3. Seed data writes many operations in one transaction. `activity_log.created_at` defaults to `now()`, the transaction's start time, so **seeded activity rows share one timestamp**, and changes dated from the log in the seed (Review status, checkpoint achievement, Method Application state, and backfilled agreement times) appear simultaneous. Operations performed through the application run in their own transactions and are dated individually.
4. The proposal described insert and update policies for the mark. The implementation grants select on the user's own row only and routes every write through `mark_briefed_through`, which writes only the caller's own row.

## Consequences

- An architect can be briefed on exactly what changed since the point they chose, without the system recording what they viewed, when they signed in or how long they stayed.
- The raw log's restriction holds: no new surface exposes `metadata_json`.
- Phase 7A records no page views, time on page, last visit, sign-in use or items opened, sends no notification, and produces no per-person activity counts.
