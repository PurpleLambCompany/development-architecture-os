# ADR-0056: Edge judgments

**Status:** Accepted (Phase 7A; approved 2026-09-30)

## Context

Phase 7A proposal (Revision 2) §15; reconciliation decisions Q4, Q6, Q7 and Q18; Kerrick's OD-9.

Phase 4 and Phase 5 let a person dismiss a signal, with a reason and optional expiry, in `intelligence_signal_dismissals` and `implementation_signal_dismissals` (ADR-0032, ADR-0039). The Development Edge needs a fuller judgment vocabulary: a person may be examining an item, may judge it immaterial, may defer it, may think the rule is wrong for the case, or may have acted on it through a governed operation. Q4 decided judgments are durable, append-only and attributed. Q6 decided promotion happens only by a person completing an existing governed operation, never automatically.

## Decision

**Judgment kinds.**

| Kind            | Meaning                                                                              | Effect on the item                                         | Required            |
| --------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------- |
| `investigating` | "I am examining this"                                                                | Stays listed, shown as being examined by the person        | Optional note       |
| `not_material`  | "This does not need action"                                                          | Leaves the list until its fingerprint changes              | Reason              |
| `deferred`      | "Not now"                                                                            | Leaves the list until `expires_on` or a fingerprint change | Reason, future date |
| `disagree`      | "The rule is wrong for this case": rule feedback, not a claim that the fact is false | Leaves the list until its fingerprint changes              | Reason              |
| `promoted`      | A person completed a governed operation prompted by the item                         | Leaves the list until its fingerprint changes; links to it | The created record  |

**Append-only.** `public.edge_judgments` stores `engagement_id`, `rule_key` (checked by `private.is_edge_rule_key` against the catalog, plus `change_reaches`), `subject_type` and exactly one matching subject column (`element_id`, `client_action_id`, `method_application_id`, `acceptance_criterion_id`; none for an `engagement` subject), `fingerprint` (1 to 1000 characters), `trigger_key`, `judgment_kind` (text with a check constraint, never an enum), `reason`, `expires_on`, `promoted_element_id`, `judged_by` and `judged_at`. Check constraints tie the reason, expiry and promoted record to their kinds. Composite same-engagement foreign keys cover every reference. `private.guard_edge_judgment` refuses inserts outside the operations' context marker (42501), sets `judged_by` to `auth.uid()` and `judged_at` to `clock_timestamp()`, and refuses every update and delete. The latest judgment for a rule, subject and fingerprint is the current one; a correction is a new judgment.

**Fingerprint and return.** An item is judged at its fingerprint (ADR-0051). When the facts that make it this item change (for example a newer substantive revision), its fingerprint changes and the item returns. `edge_items` reads the latest judgment through `private.edge_judgment_for` and reports `judged` as true for `not_material`, `disagree`, `promoted`, and `deferred` until its date; `investigating` never hides an item.

**Operations and capability.**

- `record_edge_judgment(p_engagement_id, p_rule_key, p_subject_type, p_subject_id, p_fingerprint, p_kind, p_reason, p_expires_on, p_promoted_element_id)` judges one item.
- `record_edge_event_judgment(p_engagement_id, p_trigger_key, p_kind, p_reason, p_expires_on)` records one judgment per unjudged item currently in the event, in one transaction, and returns how many. Promotion is refused at event level, because it names one created record.
- Both require **`edit_architecture`**, the capability the existing dismissal operations require, take an engagement-scoped advisory lock, and re-evaluate the item through `edge_items` first. A fingerprint (or event) that no longer matches the current facts is refused with 23514, so a stale screen cannot judge a changed item.

**The eleven existing rules (OD-9).** `not_material` and `deferred` on an existing rule go through `dismiss_intelligence_signal` or, for `implementation_past_target`, `dismiss_implementation_signal`, into the existing tables, so the Signals page and the Edge agree without a data migration. `investigating`, `disagree` and `promoted` on those rules go to `edge_judgments`. The envelope reads all three sources and takes the latest; an existing dismissal reads as `deferred` when it has an expiry and `not_material` when it has none.

**Promotion only through governed operations.** Promote never creates anything itself. The Edge offers three of the proposal's four governed operations: record a Risk, record a Decision (both through the ordinary Project Intelligence creation form) and schedule a Review (through the ordinary Review form). Each form is pre-filled and labeled as prompted by the item; the operation checks its own capability, and the record's provenance follows Q18 (`architect_judgment` by default: the rule prompted, the architect judged). `promoteEdgeItem` and `promoteToReview` in `src/domain/edge/actions.ts`:

1. re-check that the item is still current and unjudged, and refuse before creating anything if it is not;
2. create the record through its existing governed operation (`createRecord` or `createReview`);
3. record a `promoted` judgment naming the created element (`promoted_element_id`, which must be an element of the same engagement);
4. redirect to the new record.

**Open point: promotion into an acceptance criterion.** The proposal (§15.1) also lists "proposed a criterion" as a promotion, but records every promotion as "the created element's id". Acceptance criteria are not elements (ADR-0046), so `promoted_element_id` cannot name one. Phase 7A therefore does not offer criterion promotion; a person can still propose the criterion directly and judge the item. Recording a criterion promotion would need a schema change (a `promoted_criterion_id` column or a generalized reference) and is left for Kerrick's decision.

**Where whole-event judgment is offered.** The Engagement Edge offers "Judge the whole event" when an event has more than one open item. Contextual panels (ADR-0058) show only the lines bearing on their record and therefore **do not offer whole-event judgment**: judging the event there would judge lines the reader cannot see. Per-item judgment is available on both.

**Recorded, attributed, never aggregated by person.** `edge_judgments` is registered with `private.log_activity`, like the existing dismissals, because a judgment is professional record-keeping, attributed by design. No read model counts, rates, ranks or compares judgments by `judged_by`, and no page shows a person's judgment history. `disagree` judgments are kept as rule-tuning material; analysis of them (D-44) is not built.

## Consequences

- An item a person has considered stays considered until its facts change, and anyone who can read the engagement's architecture can see who judged it, when and why.
- Users without `edit_architecture` see the Edge and every panel but no judgment actions.
- Nothing is ever written to a governed record by the Edge on its own. Every write is a user-initiated operation.
- Judgment kinds are text, so a later phase could add one by migration. Phase 7A adds no AI, no scoring, no productivity data and no notification.
