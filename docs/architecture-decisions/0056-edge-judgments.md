# ADR-0056: Edge judgments

**Status:** Accepted (Phase 7A; approved 2026-09-30; promotion model amended 2026-09-30 to the governed promotion target, on Kerrick's decision that Edge items are promotable into a proposed acceptance criterion)

## Context

Phase 7A proposal (Revision 2) §15; reconciliation decisions Q4, Q6, Q7 and Q18; Kerrick's OD-9.

Phase 4 and Phase 5 let a person dismiss a signal, with a reason and optional expiry, in `intelligence_signal_dismissals` and `implementation_signal_dismissals` (ADR-0032, ADR-0039). The Development Edge needs a fuller judgment vocabulary: a person may be examining an item, may judge it immaterial, may defer it, may think the rule is wrong for the case, or may have acted on it through a governed operation. Q4 decided judgments are durable, append-only and attributed. Q6 decided promotion happens only by a person completing an existing governed operation, never automatically.

## Decision

**Judgment kinds.**

| Kind            | Meaning                                                                              | Effect on the item                                         | Required                      |
| --------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------- |
| `investigating` | "I am examining this"                                                                | Stays listed, shown as being examined by the person        | Optional note                 |
| `not_material`  | "This does not need action"                                                          | Leaves the list until its fingerprint changes              | Reason                        |
| `deferred`      | "Not now"                                                                            | Leaves the list until `expires_on` or a fingerprint change | Reason, future date           |
| `disagree`      | "The rule is wrong for this case": rule feedback, not a claim that the fact is false | Leaves the list until its fingerprint changes              | Reason                        |
| `promoted`      | A person completed a governed operation prompted by the item                         | Leaves the list until its fingerprint changes; links to it | The governed promotion target |

**Append-only.** `public.edge_judgments` stores `engagement_id`, `rule_key` (checked by `private.is_edge_rule_key` against the catalog, plus `change_reaches`), `subject_type` and exactly one matching subject column (`element_id`, `client_action_id`, `method_application_id`, `acceptance_criterion_id`; none for an `engagement` subject), `fingerprint` (1 to 1000 characters), `trigger_key`, `judgment_kind` (text with a check constraint, never an enum), `reason`, `expires_on`, the governed promotion target (below), `judged_by` and `judged_at`. Check constraints tie the reason, expiry and promotion target to their kinds. Composite same-engagement foreign keys cover every reference. `private.guard_edge_judgment` refuses inserts outside the operations' context marker (42501), sets `judged_by` to `auth.uid()` and `judged_at` to `clock_timestamp()`, and refuses every update and delete. The latest judgment for a rule, subject and fingerprint is the current one; a correction is a new judgment.

**Fingerprint and return.** An item is judged at its fingerprint (ADR-0051). When the facts that make it this item change (for example a newer substantive revision), its fingerprint changes and the item returns. `edge_items` reads the latest judgment through `private.edge_judgment_for` and reports `judged` as true for `not_material`, `disagree`, `promoted`, and `deferred` until its date; `investigating` never hides an item.

**Operations and capability.**

- `record_edge_judgment(p_engagement_id, p_rule_key, p_subject_type, p_subject_id, p_fingerprint, p_kind, p_reason, p_expires_on, p_promotion_target_kind, p_promotion_target_id)` judges one item.
- `record_edge_event_judgment(p_engagement_id, p_trigger_key, p_kind, p_reason, p_expires_on)` records one judgment per unjudged item currently in the event, in one transaction, and returns how many. Promotion is refused at event level, because it names one governed target.
- Both require **`edit_architecture`**, the capability the existing dismissal operations require, take an engagement-scoped advisory lock, and re-evaluate the item through `edge_items` first. A fingerprint (or event) that no longer matches the current facts is refused with 23514, so a stale screen cannot judge a changed item.

**The eleven existing rules (OD-9).** `not_material` and `deferred` on an existing rule go through `dismiss_intelligence_signal` or, for `implementation_past_target`, `dismiss_implementation_signal`, into the existing tables, so the Signals page and the Edge agree without a data migration. `investigating`, `disagree` and `promoted` on those rules go to `edge_judgments`. The envelope reads all three sources and takes the latest; an existing dismissal reads as `deferred` when it has an expiry and `not_material` when it has none.

**Promotion only through governed operations.** Promote never creates anything itself. A person completes an existing governed operation, prefilled and labeled as prompted by the item; that operation checks its own capability and rules; and only once the governed record exists is a `promoted` judgment recorded naming it. The record's provenance follows Q18 (`architect_judgment` by default: the rule prompted, the architect judged).

**The governed promotion target.** A promotion does not assume it creates an element. It records a typed reference to the governed record the promotion produced, from a small closed vocabulary covering the approved Phase 7A destinations:

| `promotion_target_kind` | Governed operation                                                                  | Typed reference (same-engagement foreign key)                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `risk`                  | Record a Risk (ordinary Project Intelligence creation, `createRecord`)              | `promotion_target_element_id` → `architecture_elements (id, engagement_id, kind)`; the generated `promotion_target_element_kind` makes the key require a Risk |
| `decision`              | Record a Decision (the same form)                                                   | `promotion_target_element_id`, which the key requires to be a Decision                                                                                        |
| `review`                | Schedule a Review (ordinary Review form, `createReview`)                            | `promotion_target_element_id`, which the key requires to be a Review                                                                                          |
| `acceptance_criterion`  | Propose an acceptance criterion (ordinary proposal, `propose_acceptance_criterion`) | `promotion_target_criterion_id` → `acceptance_criteria (id, engagement_id)`                                                                                   |

This follows the table's own subject pattern (a closed type plus one typed column per target table), so every reference is a real foreign key. There is no free-form polymorphic link to arbitrary DSA tables. The kind is a check-constrained closed list. A check constraint requires exactly the matching column for the kind, and none without a promotion. `on delete restrict` keeps the target for as long as the judgment exists.

The judgment row preserves the originating Edge item (rule, subject, fingerprint and trigger key), the target kind and id, who promoted it and when, and the reason when one is given.

`private.record_edge_judgment_row` checks the target again before insert:

- the kind must be in the vocabulary;
- a Risk, Decision or Review must be an element of exactly that kind on the engagement;
- an acceptance criterion must be on the engagement and still `proposed`.

`edge_items` returns `promotion_target_kind`, `promotion_target_id` and `promotion_target_code`, so the Edge reads "Promoted to ACR-003" (or RSK-, DEC-, REV-) without a second lookup.

`promoteEdgeItem`, `promoteToReview` and `promoteToCriterion` in `src/domain/edge/actions.ts`:

1. re-check that the item is still current and unjudged, and refuse before creating anything if it is not;
2. create the record through its existing governed operation (`createRecord`, `createReview` or `proposeCriterion`);
3. record a `promoted` judgment naming the governed promotion target (its kind and id);
4. redirect to the record.

**Promotion into an acceptance criterion.**

- **When it is offered.** The Edge offers "Propose an acceptance criterion" only when the item's subject can carry criteria: a core object or an Implementation Initiative (ADR-0046). The criterion is proposed on that subject.
- **The prefilled form.** The link opens the subject's page with the ordinary Acceptance criteria proposal form open. The item's sentence is the first draft. "Client can see it" defaults to No, because the draft comes from internal intelligence.
- **The person completes it.** The person submits the ordinary governed proposal. `propose_acceptance_criterion` still requires `edit_architecture`.
- **Promotion never agrees a criterion.** A criterion is recorded as the promotion target only while it is `proposed`. Agreement remains the separate Phase 6 act: a publisher, on a published element, records who agreed and from when, and the system sets `agreed_recorded_at`.
- **The provenance link runs both ways.** On the criterion's side, a criterion that is a promotion target reads "Promoted from the Development Edge (rule) on date".
- **A promoted proposal is kept.** Because the judgment keeps its target, the foreign key refuses deleting a promoted proposal, and the UI says the record is kept as the promotion's record. It can still be edited. Once agreed, it is superseded or withdrawn as usual.

**Where whole-event judgment is offered.** The Engagement Edge offers "Judge the whole event" when an event has more than one open item. Contextual panels (ADR-0058) show only the lines bearing on their record and therefore **do not offer whole-event judgment**: judging the event there would judge lines the reader cannot see. Per-item judgment is available on both.

**Recorded, attributed, never aggregated by person.** `edge_judgments` is registered with `private.log_activity`, like the existing dismissals, because a judgment is professional record-keeping, attributed by design. No read model counts, rates, ranks or compares judgments by `judged_by`, and no page shows a person's judgment history. `disagree` judgments are kept as rule-tuning material; analysis of them (D-44) is not built.

## Consequences

- An item a person has considered stays considered until its facts change, and anyone who can read the engagement's architecture can see who judged it, when and why.
- Users without `edit_architecture` see the Edge and every panel but no judgment actions.
- Nothing is ever written to a governed record by the Edge on its own. Every write is a user-initiated operation.
- A promotion names its governed promotion target by kind and typed reference, not as "the created element", so a destination that is not an element (an acceptance criterion) is recorded with the same integrity. Adding a destination is a migration that extends the closed vocabulary and adds its typed column; no generic link can do it silently.
- A draft Risk, Decision or Review, or a proposed criterion, that is a promotion target cannot be deleted while the judgment exists.
- Judgment kinds are text, so a later phase could add one by migration. Phase 7A adds no AI, no scoring, no productivity data and no notification.
