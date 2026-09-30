# Deterministic Development Edge (Phase 7A)

Migrations, in order:

| Migration                                     | Holds                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `20261006000000_phase7a_edge_catalog.sql`     | The rule catalog (`private.edge_rules`, `public.edge_rule_catalog`) and the governed `relationship_impact_rules` matrix |
| `20261006000100_substantive_revisions.sql`    | The substantive-revision definition, its excluded-path catalog and `public.element_revisions`                           |
| `20261006000200_review_examined_versions.sql` | `review_examined_versions`, its guard, the closed examined set (OD-7) and `hold_review` with the capture step           |
| `20261006000250_criterion_agreement_time.sql` | `acceptance_criteria.agreed_recorded_at`, set by the guard on agreement, and its one-time backfill                      |
| `20261006000300_development_changes.sql`      | `public.development_changes`, the curated development-change read model                                                 |
| `20261006000400_impact_trace.sql`             | `public.impact_trace`, and the legacy comments on `intelligence_impact` and `implementation_impact`                     |
| `20261006000500_edge_rules.sql`               | The 31 new rules as private functions, one per lens, and the `change_reaches` consequence type                          |
| `20261006000600_edge_items.sql`               | `public.edge_items`, the common envelope: composition, tiers, ordering facts and the judgment join                      |
| `20261006000700_edge_judgments.sql`           | `edge_judgments`, its guard, RLS and activity logging; `record_edge_judgment` and `record_edge_event_judgment`          |
| `20261006000800_edge_briefing_marks.sql`      | `edge_briefing_marks` (own row only, never logged) and `mark_briefed_through`                                           |
| `20261006000900_practice_counts.sql`          | `public.method_practice_counts`, with the minimum n for proportions                                                     |

The agreement-time migration is numbered before the rule and change migrations that read the column. The proposal lists it eleventh.

The specification is [`docs/product/PHASE_7A_PROPOSAL.md`](../product/PHASE_7A_PROPOSAL.md) (Revision 2). The decisions are ADR-0051 to ADR-0059, with amendment notes on ADR-0032, ADR-0034, ADR-0039 and ADR-0046. The open decisions settled by Kerrick are cited here as OD-1 to OD-10.

The database is the authority for every rule below. The application offers only the choices the database accepts, and the database checks them again.

## Rules that hold throughout

- **Intelligence is computed, never stored as a conclusion.** Every Edge item, event, tier, order and impact path is computed on read. What is stored is only what a person did or what a governed operation fixed: judgments (`edge_judgments`), briefing marks (`edge_briefing_marks`), Review captures (`review_examined_versions`) and the agreement time on a criterion (`agreed_recorded_at`). See [Computed and stored](#computed-and-stored).
- **Internal only.** Every new read function checks `private.can_read_architecture(engagement)` (internal membership and access to the engagement) or `private.is_internal()` before it returns a row. Every new table has internal-only policies, or an own-row policy for the briefing mark. A client gets nothing: an empty set from the reads, `P0002` from the operations.
- **One engagement per call.** Each function takes one engagement (or one element or asset) and never joins across engagements. `method_practice_counts` is the only cross-engagement read, and it returns counts only.
- **No score.** No item has a confidence value, a weight or a stored rank. Order is lexicographic over governed facts, and every sort key is returned in `order_facts` (ADR-0058).
- **Catalog keys are text with check constraints, never enums**, so rules stay revisable while they are tuned (proposal §5.1). No enum type or value is added in 7A.
- **Writes go through operations only.** `authenticated` has no insert, update or delete grant on any new table. Guard triggers refuse writes made without the operation's context marker (`dsa.review_capture`, `dsa.edge_judgment`) with `42501`.
- **Error codes.** `42501` permission, `23514` rule, `P0002` not found (also returned when the caller may not read the engagement).
- **Time.** Change rules compare system time or exact versions only (F1). Business dates are used only for anticipation (`checkpoint_past_target`, the existing date rules and the governance date in ordering). `held_at` and `agreed_on` are never compared.
- **Substantive revisions only.** Change rules and `change_reaches` act on substantive revisions (§12), never on status publications (F2).
- **Two Phase 1 to 6 behaviors change deliberately:** `examines` from a held Review is refused (OD-7), and agreeing a criterion records its system time (OD-2). No other Phase 1 to 6 table loses or changes a column, and no existing function changes signature.
- **Timestamps use `clock_timestamp()`.**

## Computed and stored

| Stored                                   | Written by                                               | Why it is stored                                        |
| ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `edge_judgments`                         | `record_edge_judgment`, `record_edge_event_judgment`     | A human judgment, attributed by design (ADR-0056)       |
| `edge_briefing_marks`                    | `mark_briefed_through`                                   | An explicit act by the user, private to them (ADR-0057) |
| `review_examined_versions`               | `hold_review`                                            | What a Review examined, fixed at the hold (ADR-0054)    |
| `acceptance_criteria.agreed_recorded_at` | The criterion guard, on agreement; the one-time backfill | The system time of a governed act (OD-2)                |
| `relationship_impact_rules`              | Migrations only                                          | Governed reference data (ADR-0055)                      |

Computed on every read, never stored: Edge items and their tiers, order facts, events and grouping (`groupEdgeItems` in `src/domain/edge/grouping.ts`), substantive-revision classification, impact traces, `change_reaches` consequences, development changes and practice counts. There is no table for conditions, events, items, first-observed times, scores, AI, prompts, embeddings, Patterns or notifications, and no column on `element_versions`, `architecture_relationships`, `reviews` or any signal table.

## Tables

### `relationship_impact_rules`

The governed relationship-impact direction matrix (ADR-0055, proposal §10.1). One row per link and direction: the 39 relationship types and 17 off-spine link keys, 112 rows. Mirrored in `src/domain/edge/impact-matrix.ts`.

| Column          | Type    | Notes                                                                                                                     |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `link_key`      | text    | A relationship type or an off-spine key (for example `dependency_ends`, `acceptance_criteria_governed`); `^[a-z][a-z_]*$` |
| `direction`     | text    | `source_to_target` or `target_to_source`: which end's change is being followed                                            |
| `assessment`    | text    | `yes`, `weak` or `no`                                                                                                     |
| `propagation`   | text    | `direct`, `recursive`, `terminal` or `never`                                                                              |
| `max_depth`     | int     | 0 for `never`, 1 for `direct` and `terminal`, 2 for `recursive` (checked)                                                 |
| `edge_eligible` | boolean | Generated: `assessment = 'yes' and propagation <> 'never'`                                                                |
| `hub_target`    | boolean | Whether reaching through this link groups under a hub                                                                     |
| `condition`     | text    | Optional narrowing key, for example `recurse_when_invalidated`, `agreed_in_force`, `open_actions_only`                    |
| `reason`        | text    | The matrix's "why", 1 to 300 characters, shown in the trace                                                               |

Primary key (`link_key`, `direction`). A `no` assessment must have `never` propagation. The migration refuses to complete unless every relationship type has a row in both directions, and unless the only `recursive` rows are `part_of`, `specializes` and `requires`, each from target to source. Written only by migrations; `authenticated` holds select only, and the policy admits internal users.

### `review_examined_versions`

The exact version of each element a Review examined, captured when the Review was held (Q29, ADR-0054, proposal §11).

| Column               | Type        | Notes                                                                                                                                                                                                           |
| -------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review_element_id`  | uuid        | The Review; composite same-engagement FK to `architecture_elements`                                                                                                                                             |
| `element_id`         | uuid        | The examined element; composite same-engagement FK                                                                                                                                                              |
| `engagement_id`      | uuid        | FK to `engagements`                                                                                                                                                                                             |
| `element_version_id` | uuid, null  | The latest published version at the hold; FK (`element_version_id`, `element_id`) to `element_versions`. Null means the element had no published version then, and any later publication counts as change since |
| `captured_at`        | timestamptz | Set by the guard to `clock_timestamp()`: system time of the hold, independent of the user-entered `held_at`                                                                                                     |

Primary key (`review_element_id`, `element_id`). All foreign keys are `on delete restrict`. Written only inside `hold_review`: `private.guard_review_examined_version` refuses an insert without the `dsa.review_capture` marker (`42501`), refuses a source that is not a Review (`23514`), and refuses every update and delete (`23514`, "What a held Review examined is permanent"). Select where `can_read_architecture(engagement_id)`. See [The Review capture and the closed examined set](#the-review-capture-and-the-closed-examined-set).

### `edge_judgments`

Append-only human judgments on Edge items (ADR-0056, proposal §15).

| Column                                                                               | Type              | Notes                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                                 | uuid PK           |                                                                                                                                                                                                      |
| `engagement_id`                                                                      | uuid              | FK to `engagements`                                                                                                                                                                                  |
| `rule_key`                                                                           | text              | Checked by `private.is_edge_rule_key`: a catalog key or `change_reaches`                                                                                                                             |
| `subject_type`                                                                       | text              | `element`, `client_action`, `method_application`, `acceptance_criterion` or `engagement`                                                                                                             |
| `element_id`, `client_action_id`, `method_application_id`, `acceptance_criterion_id` | uuid              | Exactly one non-null, matching `subject_type`; none for `engagement` (the engagement-level `release_moved` item). Composite same-engagement FKs                                                      |
| `fingerprint`                                                                        | text              | 1 to 1000 characters                                                                                                                                                                                 |
| `trigger_key`                                                                        | text              | At most 300 characters; copied from the current item, so an event-level judgment reads back as one act                                                                                               |
| `judgment_kind`                                                                      | text              | `investigating`, `not_material`, `deferred`, `disagree`, `promoted`                                                                                                                                  |
| `reason`                                                                             | text              | At most 2000 characters; required for every kind except `investigating` and `promoted`                                                                                                               |
| `expires_on`                                                                         | date              | Present if and only if `deferred`                                                                                                                                                                    |
| `promotion_target_kind`                                                              | text              | The governed promotion target's kind: `risk`, `decision`, `review` or `acceptance_criterion` (closed check). Present if and only if `promoted`                                                       |
| `promotion_target_element_id`                                                        | uuid              | For `risk`, `decision` and `review` only. FK `(promotion_target_element_id, engagement_id, promotion_target_element_kind)` → `architecture_elements (id, engagement_id, kind)`, `on delete restrict` |
| `promotion_target_criterion_id`                                                      | uuid              | For `acceptance_criterion` only. FK `(promotion_target_criterion_id, engagement_id)` → `acceptance_criteria (id, engagement_id)`, `on delete restrict`                                               |
| `promotion_target_element_kind`                                                      | element_kind      | Generated from `promotion_target_kind` (`risk`, `decision` or `review`; null otherwise) so the element FK checks the kind                                                                            |
| `judged_by`, `judged_at`                                                             | uuid, timestamptz | Forced by the guard to `auth.uid()` and `clock_timestamp()`                                                                                                                                          |

Indexes on (`engagement_id`, `rule_key`, `fingerprint`, `judged_at desc`) and (`engagement_id`, `trigger_key`). `private.guard_edge_judgment` refuses an insert without the `dsa.edge_judgment` marker (`42501`) and every update and delete (`23514`). A correction is a new judgment; the latest for a (rule, subject, fingerprint) is current. Recorded in `activity_log` by `private.log_activity`, like the existing dismissals. Select where `can_read_architecture(engagement_id)`. No read model aggregates judgments by `judged_by`.

### `edge_briefing_marks`

The user-private "briefed through" watermark for Since You Were Away (ADR-0057, proposal §14).

| Column            | Type        | Notes                                                  |
| ----------------- | ----------- | ------------------------------------------------------ |
| `user_id`         | uuid        | FK to `profiles`, cascade; always the caller           |
| `engagement_id`   | uuid        | FK to `engagements`, cascade                           |
| `briefed_through` | timestamptz | The system time the user says they are briefed through |
| `updated_at`      | timestamptz |                                                        |

Primary key (`user_id`, `engagement_id`). The only policy is select where `user_id = auth.uid()`; there is none for System Administrators, Principal Architects or anyone else. `authenticated` holds select only, so the row is written only by `mark_briefed_through`. The table has no activity trigger.

### `acceptance_criteria.agreed_recorded_at` (new column)

The only new column on an existing table. See [Agreement time](#agreement-time-agreed_recorded_at).

## The rule catalog

`private.edge_rules()` is an immutable SQL function returning 42 rows: 31 new rules and the 11 Phase 4 and Phase 5 signal rules consumed unchanged. `change_reaches` is a consequence type, not a condition, and has no row. `public.edge_rule_catalog()` returns the same rows to internal users (the UI and the mirror tests). The catalog is mirrored in `src/domain/edge/rules.ts`, which also carries the plain-language definition and why.

Columns: `rule_key`, `candidate` (reconciliation D-xx), `origin` (`new` or `existing`), `home`, `lens`, `epistemic_status` (`recorded`, `derived`, `worth_considering`), `subject_type`, `trigger_type`, `time_basis`, `substantive_only`, `list_tier` (`attention` or `ambient`), `resolving_act`, `scope` and `thresholds`.

| Lens        | Rules (new unless marked existing)                                                                                                                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integrity   | `statement_contradicted_by_evidence`, `relationship_to_replaced_element`, `conflict_unresolved`, `methodology_derived_without_model`, `measurement_gap`, `capability_serves_no_outcome`, `governance_allocation_gap`; existing: `assumption_unvalidated_underpins_published`, `assumption_invalidated_still_underpins` |
| Realization | `approved_without_pathway`, `operational_not_validated`, `implements_replaced_element`, `implemented_element_revised`, `validated_element_revised`, `realization_without_evidence`, `checkpoint_past_target`, `criteria_without_review_path`; existing: `implementation_past_target`                                   |
| Change      | `criteria_predate_revision`, `examined_element_revised_since_review`, `evidence_after_review`, `decision_not_reflected`, `deliverable_documents_revised`, `contribution_on_prior_version`, `method_basis_superseded`, `approval_behind_published`                                                                      |
| Exposure    | `dependencies_converge`, `escalation_before_review`, `materialized_risk_still_threatens`; existing: `risk_high_without_mitigation`, `dependency_blocking_unsatisfied`, `decision_past_needed_by`, `review_overdue`, `client_action_overdue`, `record_untriaged`                                                        |
| Potential   | `opportunity_advances_unrealized`, `opportunity_without_carrier`; existing: `opportunity_window_closing`, `opportunity_window_closed`                                                                                                                                                                                  |
| Learning    | `repeated_realization_difficulty`, `application_outputs_absent`, `application_instrument_evidence_absent`                                                                                                                                                                                                              |

Rule subjects are `element`, `client_action`, `method_application` or `acceptance_criterion`; the `release_moved` variant of `method_basis_superseded` is one engagement-level item with subject type `engagement`. Default tiers are `ambient` for `statement_contradicted_by_evidence`, `measurement_gap`, `evidence_after_review` and `method_basis_superseded`, and `attention` for the rest; some rules lower or raise an individual item's base tier (for example `approval_behind_published` is ambient while an approval request on the latest version is pending). Constants (severity 15, 2 converging dependencies, 2 realization difficulties, depth 2, 7 days untriaged, 30-day window) are in the migrations and in the `thresholds` column.

## Substantive revision

A published version n ≥ 2 is a **substantive revision** if and only if its internal snapshot differs from version n - 1 after removing, from both, the excluded paths for the element's kind (Q30, ADR-0053, proposal §12). Version 1 is a **first publication**, a separate change type. A version that differs only in excluded paths is a **status publication**. Comparison is jsonb equality of the two reduced snapshots, computed at read time from the immutable `element_versions`. `change_summary` is never parsed; it is returned verbatim. Nothing is stored on `element_versions`, and Phase 3's publication path is unchanged.

### The excluded-path catalog

Status and lifecycle fields only. Everything else is content. Defined by `private.substantive_detail_exclusions(kind)` and `private.substantive_excluded_paths(kind)`, mirrored in `src/domain/edge/substantive.ts`.

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

A decision's outcome (chosen option, note, decider, decided time, source) is content and stays substantive.

## The Review capture and the closed examined set

`hold_review` keeps its Phase 5 signature, checks (`manage_reviews`, a scheduled Review) and effects, and adds one step in the same transaction (proposal §11.3):

1. It locks the Review (`private.lock_element`).
2. It takes `for share` locks, in id order, on every element the Review examines through an unretired `examines`, so a concurrent publication is either wholly before or wholly after the capture.
3. With the `dsa.review_capture` marker on, it inserts one `review_examined_versions` row per examined element with the element's `latest_version_id` (null when unpublished), then turns the marker off.
4. It sets the Review `held`.

**The examined set closes at hold (OD-7, §11.4).** `private.guard_examined_set` (a `security definer` `BEFORE INSERT OR UPDATE OR DELETE` trigger on `architecture_relationships`) acts on `examines` rows only. It takes a `for share` lock on the source Review's element row and refuses (`23514`, "The examined set closed when this Review was held. Use a later Review for further examination.") when the Review is `held` and the write is:

- an insert of an `examines` from that Review;
- an update that retires one of its `examines` (sets `retired_at`), including through the retire operation;
- a delete of one of its `examines`.

The trigger covers every write path: the relationship operations, direct inserts under RLS and the seed. Other relationships of a held Review are unaffected. Cancelled Reviews are never held, so their `examines` are unchanged. Because `record_review_validation` requires that the Review already `examines` the initiative or what it implements, "examined" now means "examined at the hold".

**A capture is not a baseline.** A held Review is one closed governance event with an exact examined set and exact versions. No Architecture Baseline is created, required or implied, and a Review may still reference a baseline of its own.

**No backfill (OD-6).** Reviews held before 7A have no capture. Their existing `examines`, including any added after the hold, are preserved and not rewritten. The Change rules use a pre-7A Review's frozen baseline, when it has one, for version-exact comparison; without one the Review produces no change item. Exact history is never inferred from the user-entered `held_at`.

## Agreement time (`agreed_recorded_at`)

`acceptance_criteria.agreed_recorded_at timestamptz` is the system time of the governed agreement operation (OD-2, amendment note on ADR-0046). `agreed_on` stays the business (effective) date the user enters. The two are never conflated.

- `private.guard_acceptance_criterion` sets it: null on insert; `clock_timestamp()` when a proposed criterion becomes `agreed`; null while it stays proposed. No caller can supply it. Once agreed it is frozen with the other agreement fields, and any change is refused (`23514`).
- `private.agree_criterion_row` (used by `agree_acceptance_criterion`) is otherwise unchanged.
- `private.backfill_criterion_agreement_times()` ran once in the migration, with the guard disabled for that statement alone. It copies the time of the first `activity_log` update that moved each criterion from `proposed` to `agreed`, and leaves the column null where no such row exists.
- `criteria_predate_revision` compares the governed element's latest substantive revision with `agreed_recorded_at`, and produces no item when it is null. `development_changes` dates `criterion_agreed` at `agreed_recorded_at`. No Edge read derives agreement time from `activity_log` or from `agreed_on`.

## Impact

### `impact_trace` and the matrix

`public.impact_trace(p_element_id uuid, p_mode text default 'on_demand')` is the authoritative impact semantics (OD-8). It follows `relationship_impact_rules`; it is not a generic graph traversal.

- Every link is one hop, except four walks capped at depth 2: `part_of` downward (whole to parts), `specializes` downward, `requires` upward (required to requirers), and `underpins` from an invalidated assumption (the `recurse_when_invalidated` condition), continuing through the targets' `requires` and `part_of`.
- Terminal hops, joined at the start and at each reached element without adding depth or continuing: implementing initiatives (`active_implementation` when not started, in progress, operational or stalled), scheduled Reviews that examine it, held Reviews with a capture of it, Deliverables that document it, agreed criteria on it and on initiatives that implement it, open client actions about it, unhandled client contributions on it, and open Method Applications that examined it.
- Never traversed: `supersedes`, `raises`, `validates`, baselines, validation criteria, closed Method Applications, record domains and member areas.
- Retired and superseded elements are not reached. Cycles are cut by path. A record reached by several paths is reported once, with its shortest path, preferring `yes` over `weak`.
- Modes: `on_demand` includes `weak` links (labeled "may bear on"), evidence, method lineage (practice awareness, never an Edge consequence) and pending approvals. `edge` uses `yes` links only and is what `change_reaches` consumes. There is no user-selectable depth; any other mode returns nothing.

It is `security invoker`: RLS applies to every row it reads, and it returns nothing unless `can_read_architecture` holds for the start element's engagement.

Returns: `reached_type` (`element`, `acceptance_criterion`, `client_action`, `contribution`, `method_application`, `evidence_source`, `method_lineage`, `approval`), `reached_id`, `reference_code`, `title`, `kind`, `object_type`, `category`, `depth`, `via_element_id`, `link_key`, `direction`, `assessment`, `propagation`, `hub_element_id` (the via element when it is an Intended Outcome, system boundary, regulatory factor, governance body or knowledge area), `path` (jsonb steps) and `reason`.

### `change_reaches`

`private.edge_change_reaches(engagement)` starts from each live element's latest substantive revision (trigger `rev:`) and each currently invalidated assumption's latest invalidation (trigger `status:`), and follows `impact_trace` in `edge` mode to reached elements, criteria and client actions. A reached record is resolved, and produces no item, when after the trigger it has its own content version or recorded approval, a Review captured the triggering element, a criterion was agreed (`agreed_recorded_at`), or a client action was sent. Judgments are applied by the envelope.

### Legacy traces

`intelligence_impact` (Phase 4) and `implementation_impact` (Phase 5) are unchanged and kept for backward compatibility only. Their SQL comments mark them as **legacy internal read paths**: not an alternative definition of impact, and not called by any UI. A Vitest check fails if application code calls them. Removal, or conversion to wrappers, is a later cleanup with its own ADR.

## The envelope: `edge_items`

`public.edge_items(p_engagement_id uuid, p_as_of date default null, p_subject_type text default null, p_subject_id uuid default null, p_include_judged boolean default false)`, `security definer`, `search_path = ''`. It returns nothing unless `can_read_architecture(p_engagement_id)` holds.

It composes `intelligence_signals` and `implementation_signals` (consumed unchanged, with their dismissals, evaluated with `p_as_of`, default `private.business_today()`), the six private lens functions and `change_reaches`, and maps every item into one shape. Items whose subject element is retired or superseded are dropped.

| Columns                                                                                                                                                                                                     | Meaning                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item_key`                                                                                                                                                                                                  | `rule_key:subject_id:` followed by the md5 of the fingerprint and trigger key; deterministic, never stored                                                          |
| `rule_key`, `home`, `lens`, `epistemic_status`                                                                                                                                                              | From the catalog (`change_reaches`: architecture, change, derived)                                                                                                  |
| `producer`                                                                                                                                                                                                  | Always `rule` in 7A                                                                                                                                                 |
| `subject_type`, `subject_id`, `subject_reference_code`, `subject_title`, `subject_kind`, `variant`                                                                                                          | What the item is about                                                                                                                                              |
| `details`, `basis`                                                                                                                                                                                          | Fixed-vocabulary facts; `basis` is references only (`type`, `id`, `reference_code`, `role`, and `version_id`/`version_no` where a version is compared)              |
| `trigger_type`, `trigger_subject_id`, `trigger_reference_code`, `trigger_title`, `trigger_version_id`, `trigger_version_no`, `trigger_at`, `trigger_key`                                                    | What made it appear. `trigger_at` is system time, or null for state and date items. Keys: `rev:`, `status:`, `evidence:`, `decision:`, `date:`, `state:` (ADR-0052) |
| `consequence_path`                                                                                                                                                                                          | For `change_reaches`: the matrix path                                                                                                                               |
| `fingerprint`                                                                                                                                                                                               | The facts that make the item this item                                                                                                                              |
| `resolving_act`                                                                                                                                                                                             | The governance act that would resolve it (`examine_reached` for `change_reaches`)                                                                                   |
| `tier`, `tier_reason`                                                                                                                                                                                       | See below                                                                                                                                                           |
| `order_facts`                                                                                                                                                                                               | jsonb: `governance_date`, `governance_kind`, `governance_reference_code`, `reach_class`, `constrained_initiatives`, `responsible`, `trigger_at`, `reference_code`   |
| `judgment_kind`, `judged_by`, `judged_by_name`, `judged_at`, `judgment_reason`, `judgment_expires_on`, `judgment_source`, `promotion_target_kind`, `promotion_target_id`, `promotion_target_code`, `judged` | The latest judgment, from `edge_judgments` or the existing dismissal tables                                                                                         |

**Tiers (ADR-0058).** `ambient` when the item's base tier is ambient (Ambient items stay in context, even on a flagged record); otherwise `human_flagged` when the subject or trigger subject has stewardship attention `critical` or an open escalation (Phase 4 or Phase 5 tables); otherwise `elevated` when attention is `high` or a governance date falls within `private.edge_horizon_days()` (14, a governed constant, OD-4); otherwise the base tier (`attention`). Governance dates are the next scheduled Review examining the subject, a decision's `needed_by`, an unachieved checkpoint target, and a client action's `due_on`, on or after the as-of date.

**Order.** Tier, then nearest governance date, then reach class (1 active implementation or an in-force constraint that constrains initiatives, 2 published architecture, 3 an Intended Outcome, 4 other), then the reader's structural responsibility (owner, decision owner, initiative owner, Review participant, practitioner, addressee), then later `trigger_at`, then reference code and rule key.

**Filtering.** With `p_subject_id`, an item is returned when the id is its subject, trigger subject, or any element or record in its basis. Judged items are left out unless `p_include_judged`: `not_material`, `disagree` and `promoted` hide the item until its fingerprint changes; `deferred` hides it until `expires_on` passes (business date); `investigating` never hides it.

## Judgments

| Function                                                                                                                                                      | Returns                             | Checks                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `record_edge_judgment(engagement, rule_key, subject_type, subject_id, fingerprint, kind, reason?, expires_on?, promotion_target_kind?, promotion_target_id?)` | uuid of the judgment (or dismissal) | `private.require_architecture_capability(engagement, 'edit_architecture')`: `P0002` for a non-reader, `42501` without the capability. Takes the engagement's judgment lock, re-reads `edge_items` (including judged items) and refuses a fingerprint that no longer matches (`23514`, "This item has changed since it was shown...") |
| `record_edge_event_judgment(engagement, trigger_key, kind, reason?, expires_on?)`                                                                             | int, the number of items judged     | Same capability and lock. Refuses `promoted` ("Promote one item at a time"). Records one judgment per item currently listed (unjudged) under the trigger key, in one transaction; refuses when there are none (`23514`)                                                                                                              |

Both call `private.record_edge_judgment_row`, which validates the kind, requires a reason for `not_material`, `deferred` and `disagree`, requires a future business date for `deferred` and no date otherwise, and, for `promoted` and only for it, requires a governed promotion target: a kind in the closed vocabulary (`risk`, `decision`, `review`, `acceptance_criterion`), and an id that is an element of exactly that kind on the engagement, or, for `acceptance_criterion`, a criterion on the engagement that is still `proposed`. Check constraints on the table enforce the same pairing (exactly the matching reference column for the kind; none without a promotion), and the foreign keys enforce same engagement and element kind. Promotion never creates anything: the governed record is created first by its own operation, which checks its own capability; a criterion is created by `propose_acceptance_criterion` and is never agreed by promotion. Because the keys restrict deletion, a promoted draft element or proposed criterion cannot be deleted while its judgment exists (`23503`; the app explains the record is kept as the promotion's record).

**The 11 existing rules (OD-9).** `not_material` and `deferred` on an existing rule are written through `dismiss_intelligence_signal` or `dismiss_implementation_signal` into the existing dismissal tables (an expiry reads back as `deferred`, none as `not_material`), so the Signals page and the Edge agree. `investigating`, `disagree` and `promoted` on those rules go to `edge_judgments`. `private.edge_judgment_for` reads all three tables and returns the latest.

## Development changes

`public.development_changes(p_engagement_id uuid, p_since timestamptz default null, p_until timestamptz default null, p_element_id uuid default null, p_limit integer default 200)`, `security definer`, returns nothing unless `can_read_architecture`. It returns classified developmental events in system time, newest first, with `occurred_at > p_since` and `occurred_at <= p_until`, filtered to `p_element_id` as subject or related record, and at most `p_limit` rows (clamped to 1 to 1000).

Columns: `occurred_at`, `change_type`, `subject_type` (`element`, `acceptance_criterion`, `method_application`, `client_action`, `baseline`), `subject_id`, `subject_kind`, `reference_code`, `title`, `version_id`, `version_no`, `related_type`, `related_id`, `related_reference_code`, `actor_name`, `summary`.

| Change types                                                                            | Source                                                                      |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `first_publication`, `substantive_revision`, `status_publication`                       | `element_versions`, classified as above                                     |
| `element_retired`, `element_superseded`                                                 | `architecture_elements.retired_at`; the `supersedes` relationship           |
| `relationship_added`, `relationship_retired`                                            | `architecture_relationships` (not `supersedes` or `validates`)              |
| `evidence_linked`                                                                       | Statement and element evidence links, with stance                           |
| `approval_requested`, `approval_recorded`                                               | `architecture_approvals`                                                    |
| `baseline_frozen`                                                                       | `architecture_baselines`                                                    |
| `record_status_changed`, `decision_deferred`, `decision_decided`                        | `intelligence_status_changes`; `decisions.decided_at`                       |
| `escalation_opened`, `escalation_resolved`                                              | Both escalation tables                                                      |
| `client_action_answered`, `contribution_received`                                       | `client_action_responses`, `client_contributions`                           |
| `review_scheduled`, `review_held`, `review_cancelled`                                   | `activity_log` for Reviews; a hold is dated by its capture, never `held_at` |
| `validation_recorded`                                                                   | The `validates` relationship                                                |
| `implementation_status_changed`, `checkpoint_achieved`                                  | `implementation_status_changes`; `activity_log` for checkpoints             |
| `criterion_proposed`, `criterion_agreed`, `criterion_superseded`, `criterion_withdrawn` | `acceptance_criteria`; agreement at `agreed_recorded_at`, never `agreed_on` |
| `application_started`, `application_closed`, `application_addendum`                     | `activity_log` for Method Applications; `method_application_addenda`        |

`activity_log` is read only where a domain table keeps no system time for the event, and only projected fields are returned, never `metadata_json`. Excluded: working-copy saves, stewardship date and attention edits, dismissals and Edge judgments, membership and capability changes, and every Phase 2 commercial event (ADR-0023). `architecture_activity` is unchanged.

## Since You Were Away

`public.mark_briefed_through(p_engagement_id uuid, p_through timestamptz)` returns the mark it set. It raises `P0002` unless the caller is signed in and `can_read_architecture` holds, and `23514` when `p_through` is null or in the future. It upserts the caller's own row. The UI passes the time of the newest change the briefing showed, not "now"; the user may move the mark back to re-read. The briefing itself (changes since the mark, and Edge items whose `trigger_at` is after it; the prior 14 days when there is no mark, OD-10) is composed in the application from `development_changes` and `edge_items`.

## Practice counts

`public.method_practice_counts(p_asset_id uuid)`, `security definer`, returns nothing unless `private.is_internal()` (every internal member reads the Method Library). Three measures, per version of the asset:

- `stage_treatment`: per stage and treatment (`followed`, `adapted`, `skipped`), the count across closed (completed or discontinued) applications of the version;
- `co_use`: per other Method version applied in the same engagement as a closed application of this version, the count of such applications;
- `standard_informs_criteria`: for a Standard, the count of agreed (including later superseded or withdrawn) criteria it informed.

Every row carries `count`, `n` (closed applications of the version; for `standard_informs_criteria`, the count itself) and `min_n` (`private.practice_min_n()`, 5). `proportion` is returned only when `n >= 5` (OD-5), and never for `standard_informs_criteria`; the threshold is enforced in SQL. No engagement name, client name or free text is returned, and nothing is scored or ranked.

## Public functions

| Function                                  | Security | Check                                                               | Returns to a client | Readers                                          |
| ----------------------------------------- | -------- | ------------------------------------------------------------------- | ------------------- | ------------------------------------------------ |
| `edge_rule_catalog()`                     | definer  | `is_internal()`                                                     | empty               | Edge UI, mirror tests                            |
| `element_revisions(engagement, element?)` | definer  | `can_read_architecture`                                             | empty               | Element history, tests                           |
| `development_changes(...)`                | definer  | `can_read_architecture`                                             | empty               | Since You Were Away briefing                     |
| `impact_trace(element, mode)`             | invoker  | `can_read_architecture` on the start element, then RLS on every row | empty               | Element Impact trace panel; `change_reaches`     |
| `edge_items(...)`                         | definer  | `can_read_architecture`                                             | empty               | Engagement Edge, landing page, contextual panels |
| `record_edge_judgment(...)`               | definer  | `edit_architecture`                                                 | `P0002`             | Edge UI                                          |
| `record_edge_event_judgment(...)`         | definer  | `edit_architecture`                                                 | `P0002`             | Edge UI                                          |
| `mark_briefed_through(...)`               | definer  | `can_read_architecture`                                             | `P0002`             | Since You Were Away                              |
| `method_practice_counts(asset)`           | definer  | `is_internal()`                                                     | empty               | Method Asset page                                |
| `hold_review(...)` (Phase 5, redefined)   | definer  | `manage_reviews` (unchanged)                                        | unchanged           | Review page                                      |

Every function has `set search_path = ''`, is revoked from `public` and `anon`, and is granted to `authenticated`.

## Private helpers

| Helper                                                                                                                    | Purpose                                                                     |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `private.edge_rules()`                                                                                                    | The 42-row catalog                                                          |
| `private.substantive_detail_exclusions(kind)`, `substantive_excluded_paths(kind)`, `substantive_snapshot(kind, snapshot)` | The excluded-path catalog and the reduced snapshot                          |
| `private.snapshot_changed_paths(before, after)`                                                                           | Top-level and `details` keys that differ, for explanation                   |
| `private.element_revision_rows(engagement, element?)`                                                                     | Every published version, classified (unchecked; used by the checked reads)  |
| `private.element_content_state(engagement)`                                                                               | Per element: latest content version and latest substantive revision         |
| `private.edge_raw_item` (type), `edge_element_ref`, `edge_ref`                                                            | The raw item shape and basis references                                     |
| `private.edge_rules_integrity`, `_realization(engagement, as_of)`, `_change`, `_exposure`, `_potential`, `_learning`      | The 31 rules, one function per lens; unchecked, called only by `edge_items` |
| `private.edge_change_reaches(engagement)`                                                                                 | `change_reaches` consequences                                               |
| `private.edge_horizon_days()`                                                                                             | 14                                                                          |
| `private.edge_judgment_for(...)`                                                                                          | The latest judgment across `edge_judgments` and both dismissal tables       |
| `private.is_edge_rule_key(key)`                                                                                           | Check constraint on `edge_judgments.rule_key`                               |
| `private.record_edge_judgment_row(...)`                                                                                   | Validates and writes one judgment, or delegates to a dismissal              |
| `private.guard_review_examined_version()`, `guard_examined_set()`, `guard_edge_judgment()`                                | Guard triggers                                                              |
| `private.backfill_criterion_agreement_times()`                                                                            | The one-time backfill                                                       |
| `private.practice_min_n()`                                                                                                | 5                                                                           |

All are revoked from `public`, `anon` and `authenticated`.

## Concurrency

- **Judgments** take a transaction-scoped advisory lock per engagement, `pg_advisory_xact_lock(hashtextextended('edge_judgment:' || engagement_id, 0))`, before re-evaluating the item. Two judgments of the same item at once are serialized and both recorded, in order; an event judgment and a single judgment cannot interleave.
- **A hold and a publication.** `hold_review` takes `for share` locks on the examined elements before reading their latest versions, so it waits for a concurrent publication's element lock and then captures the new version.
- **A hold and an `examines` insert.** `guard_examined_set` takes a `for share` lock on the Review's element row, which `hold_review` holds for update. A concurrent insert waits for the hold to commit and is then refused.
- **Briefing marks** are a single upsert on the primary key.
- Reads take no locks.

Proven with two real sessions in `99_edge_concurrency.test.sql`.

## What is not stored or tracked

- No page views, no reading behavior, no time on page, no last visit, no sign-in use, and no record of which items a user opened.
- The briefing watermark is private to its user and unlogged: no policy lets anyone else read it, no read model exposes another user's mark, and the table has no activity trigger, because an audit row would make it readable by the roles that can read the log. It is set only by the explicit act of `mark_briefed_through`. Opening a page never sets it, and the no-mark window is never inferred from sign-in history or page views.
- No scores, confidence values, weights, ranks or first-observed times. Nothing is ordered by people's judgment history or by how often a rule fires.
- No read model counts, rates or compares judgments per person.
- No unread counts, badges or per-item "seen" state.

## Client boundary

Nothing new reaches a client. No client read model, client page, client policy or client-callable function changes, and client snapshots are unchanged. A client user calling any new read function gets an empty set, calling an operation gets `P0002`, and selecting from any new table returns no row. Client-visible content can be reached by an internal item; the item itself is never shown to the client.

## Tests

| Suite                                  | Covers                                                                                                                                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `29_edge_catalog.test.sql`             | The 42 catalog rows and their labels; the existing rules match the signal functions; matrix coverage, recursion and depth limits; no write grants; private functions not callable                                            |
| `30_substantive_revisions.test.sql`    | Status-only versus substantive publications per kind; each excluded path; the change summary never read                                                                                                                      |
| `31_review_examined_versions.test.sql` | The capture at hold, system time, null for unpublished elements, immutability, the closed examined set (insert, retire, delete), no `held_at` inference                                                                      |
| `32_impact_trace.test.sql`             | Matrix directions, the three recursive walks and the invalidated `underpins` walk, depth 2, terminal hops, modes                                                                                                             |
| `33_edge_rules.test.sql`               | A positive and a negative case for each of the 31 rules; the F1 and F2 regressions                                                                                                                                           |
| `34_edge_items.test.sql`               | The envelope, tiers, ordering facts and the existing signals                                                                                                                                                                 |
| `35_edge_judgments.test.sql`           | Capability, kinds, stale fingerprints, deferral, governed promotion targets (every kind, mismatches, criterion stays proposed, target kept), event judgments, return on a new fingerprint, existing-rule dismissals, logging |
| `36_edge_briefing_marks.test.sql`      | Own row only, no direct writes, no future marks, moving back, no activity log row, client refusal                                                                                                                            |
| `37_development_changes.test.sql`      | Classification and exclusions                                                                                                                                                                                                |
| `38_edge_client_boundary.test.sql`     | Nothing for a client from any new function or table                                                                                                                                                                          |
| `39_practice_counts.test.sql`          | Counts with n, proportions only at n ≥ 5, no engagement, client or free text                                                                                                                                                 |
| `40_criterion_agreement_time.test.sql` | The backfill, system time on agreement, `agreed_on` unchanged, frozen after agreement, no item without an agreement time                                                                                                     |
| `99_edge_concurrency.test.sql`         | Publication against hold, `examines` insert against hold, two concurrent judgments                                                                                                                                           |
