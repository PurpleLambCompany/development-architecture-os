# Reviews, Deliverables and Implementation (Phase 5)

Migrations:

- `20261003000000_phase5_enums.sql` adds the enum values (three `element_kind` values, review/deliverable/implementation-status/checkpoint enums, the `deliverable` file purpose, three capabilities).
- `20261003000100_reviews_deliverables_implementation.sql` holds everything else: tables, vocabulary extensions, operations and read models.

The specification is [`docs/product/PHASE_5_PROPOSAL.md`](../product/PHASE_5_PROPOSAL.md), the D1–D16 decisions are recorded there, and the difficult-to-reverse ones are ADR-0034 to ADR-0039.

The database is the authority for every rule below. The application offers only the choices the database accepts, and the database checks them again.

## Vocabulary

Three new element kinds on the spine (ADR-0013, ADR-0034): `review` (`REV`, subtype `reviews`), `deliverable` (`DLV`, subtype `deliverables`), `implementation_initiative` (`IMP`, subtype `implementation_initiatives`). Six new relationship types (33 → 39): `examines`, `raises`, `documents`, `implements`, `initiates`, and `validates` — the last restricted-write (ADR-0035). Implementation Checkpoints are **not** a fourth kind; `implementation_checkpoints` is a subordinate table with no spine row, no reference code and no independent lifecycle (ADR-0037).

## Rules that hold throughout

- **`validates` is written only by `record_review_validation`.** No other code path may insert a `validates` relationship. It requires `publish_architecture`, refuses unless the review is `held`, refuses unless the review already `examines` the initiative (or a core object the initiative `implements`), and refuses a duplicate (ADR-0035).
- **`validated` is unreachable by direct edit.** `update_implementation_status` (the direct-edit path, `manage_implementation`) accepts only `not_started`/`in_progress`/`operational`/`stalled`. `resolve_implementation_initiative` (`publish_architecture`) is the only path to `validated` or `abandoned`, and refuses `validated` (23514) unless a qualifying `validates` relationship from a `review`-kind element already exists (ADR-0036).
- **Reopening clears the operational date.** `reopen_implementation_initiative` returns a terminal initiative to `in_progress` and nulls `actual_operational_on`, so a reopened initiative does not carry a stale "became operational on" date forward.
- **Implementation's stewardship, history, escalation and signal-dismissal tables are physically separate from Phase 4's** (ADR-0039) — same pattern (attention/triage, append-only field history guarded by its own trigger, escalation levels, fingnerprinted dismissals) as `intelligence_*`, never the same rows. `client_actions` (ADR-0029) is the one deliberate exception: it is reused as-is for client-executive implementation escalations, since it was already kind-agnostic about its subject.
- **Status changes are append-only history.** `implementation_status_changes` rows are never updated or deleted; `private.record_implementation_changes()` writes one row per changed tracked field, and `private.guard_implementation_log()` (`BEFORE UPDATE OR DELETE`) raises 23514 on any attempt to alter one — the same mechanism as `guard_intelligence_log`, a separate instance.
- **An initiative must state its scope.** `create_implementation_initiative` refuses (23514) an initiative that `implements` zero core objects.
- **Deliverable status is fully derived**, never a stored field — computed from the existing lifecycle and approval axes (D7), consistent with how every other derived status in the schema works.
- **Categories are a controlled vocabulary.** `implementation_categories` is migration-managed reference data (`program`, `process`, `system`, `partnership`, `team_or_talent`, `governance`, `other`), its own table, never `intelligence_categories`.
- **Signals are computed, never stored as conclusions.** `implementation_signals()` evaluates one rule at launch, `implementation_past_target` (an active initiative whose `target_operational_on` has passed without reaching `validated`), against the live register each call; only a dismissal is stored, keyed by rule, element and a fingerprint of the triggering facts (ADR-0036, D16). No rule infers "stalled" from elapsed time alone — stalling is always a stated fact with a rationale.
- **Checkpoints are edited by whoever can edit the parent initiative.** No separate capability; `manage_implementation` covers both.
- **Timestamps use `clock_timestamp()`**, so histories and escalations written in one transaction still order correctly.
- **Finance never controls architecture, and the reverse.** No Phase 5 table references a finance table (ADR-0023 still holds).

## New tables

| Table                              | Holds                                                                           | Client policy                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `reviews`                          | Review type, scheduled/held timestamps, status, optional baseline, summary      | published snapshot only                                                            |
| `review_participants`              | Who participated and their role                                                 | none directly                                                                      |
| `deliverables`                     | Deliverable type, optional baseline, confidentiality                            | published snapshot only, confidential ones gated further                           |
| `implementation_initiatives`       | Category, status, target/actual operational dates, owner                        | published snapshot only                                                            |
| `implementation_stewardship`       | Attention, next review date, triage state and note                              | none                                                                               |
| `implementation_status_changes`    | Append-only field-level history: operation, field, from/to, rationale, actor    | none                                                                               |
| `implementation_escalations`       | Level (Principal Architect / client executive), reason, acknowledged/resolved   | none directly; a client-executive escalation raises a `client_actions` row instead |
| `implementation_signal_dismissals` | Rule, subject, fingerprint, reason, expiry                                      | none                                                                               |
| `implementation_checkpoints`       | Type, title, target/achieved dates, optional evidence/review/approval reference | gated per-row by `client_visible`                                                  |
| `implementation_categories`        | Controlled category vocabulary, per D2/D14                                      | n/a (reference data)                                                               |

`engagement_files` gains a `deliverable` purpose, reusing Phase 4's upload infrastructure — no new file table.

## Capabilities (ADR-0038)

| Capability              | Side     | Default holders                                                        |
| ----------------------- | -------- | ---------------------------------------------------------------------- |
| `manage_reviews`        | internal | Principal Architect, Architect, Researcher, Project Administrator      |
| `manage_deliverables`   | internal | Principal Architect, Architect, Researcher, Project Administrator      |
| `manage_implementation` | internal | Principal Architect, Architect, Project Administrator (not Researcher) |

`publish_architecture` (Phase 3, ADR-0024) continues to gate `record_review_validation` and both terminal `resolve_implementation_initiative` transitions; nothing new is granted to System Administrators by default.

## Operations

| Function                                                                                                                          | Gate                    | Notes                                                               |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| `create_review`, `add_review_participant`, `hold_review`, `cancel_review`                                                         | `manage_reviews`        |                                                                     |
| `record_review_validation`                                                                                                        | `publish_architecture`  | Writes only the `validates` relationship (ADR-0035)                 |
| `create_deliverable`, `attach_deliverable_file`                                                                                   | `manage_deliverables`   |                                                                     |
| `create_implementation_initiative`, `update_implementation_status`, `add_implementation_checkpoint`, `record_checkpoint_achieved` | `manage_implementation` | Non-terminal status transitions only                                |
| `resolve_implementation_initiative`, `reopen_implementation_initiative`                                                           | `publish_architecture`  | Only path to `validated`/`abandoned`; gated per ADR-0036            |
| `triage_implementation`, `escalate_implementation`, `acknowledge_implementation_escalation`, `resolve_implementation_escalation`  | `manage_implementation` |                                                                     |
| `dismiss_implementation_signal`                                                                                                   | `manage_implementation` | Stores a dismissal, never suppresses the underlying computed signal |

## Read models

| Function                                                         | Returns                                                                                                  | Access                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `review_register(engagement?)`                                   | Every review the caller may read, with participant and agenda counts                                     | internal                                                                                       |
| `deliverable_register(engagement?)`                              | Every deliverable with its derived status                                                                | internal                                                                                       |
| `implementation_register(engagement?)`                           | Every initiative, joined with Implementation's own stewardship/escalation tables and checkpoint counts   | internal                                                                                       |
| `implementation_signals(engagement, as_of?, include_dismissed?)` | `implementation_past_target`, evaluated against the live register                                        | internal — own function, separate from `intelligence_signals()`                                |
| `implementation_impact(element, depth)`                          | What implements a given architecture element and what that implementation, in turn, threatens/depends on | internal (`security invoker`, RLS on `architecture_elements` still applies)                    |
| `client_reviews`, `client_deliverables`, `client_implementation` | Published, client-visible rows of each                                                                   | client, `view_architecture` (+ `view_confidential_deliverables` for confidential deliverables) |

Note: `intelligence_register()`'s existing `e.kind <> 'object'` filter (Phase 4) also now returns `review`/`deliverable`/`implementation_initiative` rows for an engagement that has them — a pre-existing broad filter, not a Phase 5 change, and `implementation_initiative` remains excluded from it as designed (D3) only in the sense that Implementation has its own dedicated register; the shared register's filter was never kind-specific to begin with.

## Spec acceptance checks and where they are proven

| Check                                                                                                 | pgTAP |
| ----------------------------------------------------------------------------------------------------- | :---: |
| A review can be scheduled, held, cancelled, and records participants/findings                         |   ✓   |
| A deliverable can be drafted, attached, and its status derives correctly                              |   ✓   |
| An initiative can be created, its status updated (non-terminal), triaged and escalated                |   ✓   |
| `record_review_validation` refuses an unheld review, an unexamined initiative, and a duplicate        |   ✓   |
| `resolve_implementation_initiative` refuses `validated` without a qualifying `validates` relationship |   ✓   |
| `validated` is provably unreachable through `update_implementation_status`                            |   ✓   |
| Reopening a terminal initiative clears `actual_operational_on`                                        |   ✓   |
| Concurrent status updates/escalations/signal dismissals stay consistent                               |   ✓   |
| Client users never reach `implementation_stewardship` or the escalations table                        |   ✓   |

## Tests

`supabase/tests/16_reviews.test.sql`, `17_deliverables.test.sql`, `18_implementation.test.sql`, `19_implementation_validation.test.sql` (the `record_review_validation`/`resolve_implementation_initiative` gate, end to end), and `99_implementation_concurrency.test.sql`. `src/domain/reviews/`, `src/domain/deliverables/` and `src/domain/implementation/` each have `catalog.test.ts` and `register.test.ts` covering the pure filtering/ordering logic and vocabulary mirrors in TypeScript.

## Seed data note

Phase 5 demo fixtures (one held review, one approved deliverable, three implementation initiatives spanning `operational`, `validated` via a real `record_review_validation` + `resolve_implementation_initiative` call, and `stalled`) were added to the **Community Expansion Architecture** engagement (`harbor-community-expansion`, `e...03`), not Meridian. Meridian's pgTAP suites (16–19, 99_implementation_concurrency) assert exact reference codes and register counts that new elements would have broken; Harbor has no Phase-5-specific suite asserting exact counts, only three pre-existing Phase 1/3/4 test files (`07_architecture_access`, `12_intelligence_registers`, `14_contributor_areas`) whose Harbor-scoped counts were updated to match. Open the Harbor engagement, not Meridian, to see the new Reviews/Deliverables/Implementation UI populated with demo data.
