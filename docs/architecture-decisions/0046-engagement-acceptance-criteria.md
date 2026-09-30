# ADR-0046: Engagement acceptance criteria are lightweight governance records, captured at validation

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decisions D20, D33 and D34.

Phase 5's only validation is a `validates` relationship from a held Review to an Implementation Initiative, written only by `record_review_validation` (ADR-0035, ADR-0036). A relationship pins no version, so before Phase 6 the system could not say what an initiative was validated against, other than by pointing to prose.

Kerrick's Q4 decision separates two things. A reusable methodological Standard is TPLCo practice (ADR-0041). An engagement acceptance criterion is specific to one engagement's architecture and agreed consultatively with the client. Three placements were compared:

- **A `statement_kind` value.** Rejected. Statements are edited in place, `validates` pins no version, and agreement would be conflated with approval of the whole element.
- **An existing primitive** (Metric, Intended Outcome, Checkpoint, Decision, approval). Rejected; each distorts the concept.
- **A lightweight engagement-governance record.** Chosen. It follows the Phase 5 precedent of `implementation_checkpoints` (ADR-0037): off the spine, engagement-scoped and written only through operations.

## Decision

**The record (D20, D33).** `acceptance_criteria` holds:

- `engagement_id` and a permanent reference code `ACR-nnn` from `private.next_reference_code(engagement, 'ACR')` (ADR-0025);
- one governed element (`governed_element_id`, `governed_kind`), which must be an Implementation Initiative or a core object. The composite foreign key (`id`, `engagement_id`, `kind`) cascades on delete: only a proposed criterion can sit on a draft, and it goes with the draft;
- `body`, `state` (`proposed`, `agreed`, `superseded`, `withdrawn`), `agreed_with`, `agreed_on`, `agreed_recorded_by`, an optional `agreement_evidence_source_id`, `supersedes_criterion_id`, `closure_reason`, `closed_at` and `client_visible`;
- `informing_standard_version_id` and `informing_criterion_key`: the Method Library Standard and criterion that informed it, if any. This reference is internal only. The Standard informs the criterion; it never is the criterion.

**Lifecycle.**

| Operation                                                                                    | Capability             | Rule                                                                                                                                                               |
| -------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `propose_acceptance_criterion`, `update_acceptance_criterion`, `delete_acceptance_criterion` | `edit_architecture`    | Proposed criteria only; not on a retired element. An informing Standard must be a current published Standard version and the key one of its criteria               |
| `agree_acceptance_criterion`                                                                 | `publish_architecture` | The governed element must have a published version and not be retired. Records who agreed, the date it applies from and the recorder; freezes the text and element |
| `supersede_acceptance_criterion`                                                             | `publish_architecture` | Agreed only; reason required. Creates a new `ACR` criterion carrying the governed element, informing Standard and visibility forward, proposed or agreed at once   |
| `withdraw_acceptance_criterion`                                                              | `publish_architecture` | Agreed only; reason required                                                                                                                                       |

`private.guard_acceptance_criterion` refuses any change after agreement other than the one closure to `superseded` or `withdrawn`, and refuses deleting an agreed, superseded or withdrawn criterion. A criterion is superseded at most once (unique `supersedes_criterion_id`). Writes outside the operations raise `42501`.

**Validation captures the criteria in force (D34).** `record_review_validation` keeps its Phase 5 gate unchanged: a held Review that examines the initiative, or a core object it implements, validates the initiative once. After writing the `validates` relationship it inserts one `validation_criteria` row for each criterion returned by `public.criteria_in_force(initiative)`: every agreed criterion on the initiative and on the core objects it `implements`. A validation with no agreed criteria remains valid.

- `validation_criteria` (`validation_relationship_id`, `criterion_id`, `engagement_id`, `note`, `captured_at`) has no verdict column.
- `private.guard_validation_criterion` accepts inserts only inside an architecture operation, refuses deletion, and allows only the note to change afterwards, through `set_validation_criterion_note` (`publish_architecture`).
- A capture survives the later supersession of its criterion.

**Reading.** Internal members read both tables when they can read the engagement's architecture. Clients have no policy on either table. `public.client_acceptance_criteria(engagement)` returns the code, body, state and agreement date of agreed, client-visible criteria on elements the caller may read in client form (`private.element_client_readable`, which applies Contributor area limits, ADR-0040), with the governed element's code and client-snapshot title, and the validations that captured each criterion where the caller can read the validation. A superseded or withdrawn criterion is returned only when a validation the caller can read captured it. Proposed criteria, the informing Standard, the agreement party and validation notes are never returned.

## Consequences

- "Validated against what?" is answered by data captured at the moment of judgment, and the captured text cannot change afterwards.
- The state values and `ACR` codes are permanent; agreed criteria are never deleted.
- An acceptance criterion is not an architecture element, a Method Asset, a task, a checkpoint, a Review or a score. It has no assignee, due date, progress, per-criterion evidence links or pass or fail, and no `acceptance_criterion` statement kind exists.
- Phase 6 changes one Phase 5 operation, `record_review_validation`, by addition only (ADR-0036 amendment).

## Amendment (Phase 7A, 2026-09-30)

`agreed_on` stays the business (effective) date entered by the user. `acceptance_criteria.agreed_recorded_at` (migration `20261006000250_criterion_agreement_time.sql`) is the system time of the governed agreement operation, used by Change intelligence (OD-2). The two are never conflated.

- `private.guard_acceptance_criterion` sets `agreed_recorded_at` to `clock_timestamp()` when a proposed criterion becomes agreed, clears any value supplied on insert, and freezes it with the other agreement fields.
- A one-time backfill (`private.backfill_criterion_agreement_times`) set it for criteria already agreed from the authoritative `activity_log` row that moved each from `proposed` to `agreed`, and left it null where no such row exists. In seed data that row carries the seed transaction's time.
- `criteria_predate_revision` compares only `agreed_recorded_at` with substantive revisions, and produces no item for a criterion whose agreement time was not recorded. `development_changes` dates an agreement by `agreed_recorded_at`. No Edge read derives agreement time from `activity_log`.

**Promotion from the Development Edge (ADR-0056).** A Development Edge item can be promoted into a _proposed_ criterion on the item's subject, through the ordinary `propose_acceptance_criterion` operation with a prefilled form. Promotion never agrees a criterion and changes no agreement or authority rule. The promotion judgment records the criterion as its governed promotion target, so a promoted proposal cannot be deleted while that judgment exists; it can still be edited.
