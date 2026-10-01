# ADR-0070: Judgments on kept inferences

**Status:** Accepted (Phase 7B.2 Step A; decisions approved by Kerrick 2026-10-01)

## Context

Phase 7B.2 proposal §18 and §19; reconciliation decisions IX-14, IX-19 and IX-20; 7B.1 decision B-13 and OD-17 (`contest` is `disagree`); Kerrick's PD-6, PD-14, PD-15, PD-18 and PD-21.

A kept interpretation needs the same considered lifecycle as a Development Edge item: a person may be examining it, may judge it immaterial, may defer it, may think the producer is wrong for the case, or may have acted on it through a governed operation. IX-19 decided this lives in a sibling append-only table with the ADR-0056 semantics, so that `edge_judgments` is not overloaded and a judgment on an inference can never be mistaken for a judgment on a deterministic item. IX-20 decided that the model never suggests a promotion destination; only people select and execute promotion.

## Decision

**A sibling table.** `public.architecture_inference_judgments` stores `engagement_id`, `inference_id` (same-engagement foreign key to `architecture_inferences`), `judgment_kind`, `reason` (up to 2000 characters), `expires_on`, the governed promotion target, `judged_by` and `judged_at`. The vocabulary is exactly ADR-0056's, producer-neutral:

| Kind            | On a kept inference                                                                                                           | Required                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `investigating` | Stays where it is listed; shown as being examined                                                                             | Optional note                 |
| `not_material`  | Leaves Suggested interpretations; suppresses re-offering the same kind on the same subject until the basis changes (ADR-0068) | Reason                        |
| `deferred`      | Leaves Suggested interpretations until `expires_on`, then returns if still current (PD-15)                                    | Reason, future business date  |
| `disagree`      | "The producer is wrong for this case": interpretation feedback, retained as evaluation data; leaves the list and suppresses   | Reason                        |
| `promoted`      | A person completed a governed operation prompted by the inference; names the record; leaves the list                          | The governed promotion target |

`judgment_kind` and `promotion_target_kind` are text with check constraints, never enums. Check constraints tie the reason, the expiry and the promotion target to their kinds. The promotion target uses ADR-0056's closed vocabulary and typed columns: `promotion_target_element_id` with a generated `promotion_target_element_kind` and a same-engagement foreign key to `architecture_elements (id, engagement_id, kind)` that requires a Risk, Decision or Review, or `promotion_target_criterion_id` with a same-engagement foreign key to `acceptance_criteria`. Every reference is `on delete restrict`, so a promotion target is kept for as long as the judgment exists.

**Append-only.** `private.guard_architecture_inference_judgment` refuses an insert outside the operations' marker (`42501`), sets `judged_by` to `auth.uid()` and `judged_at` to `clock_timestamp()`, and refuses every update and delete for every role (`23514`). The latest judgment on an inference (`private.inference_latest_judgment`, by `judged_at` then id) is the current one; a correction is a new judgment. RLS allows select only to current holders of `use_architecture_intelligence` on the engagement (OD-11). There is no client policy.

**Operation and capability (PD-6).** `public.record_architecture_inference_judgment(engagement, inference, kind, reason?, expires_on?, promotion_target_kind?, promotion_target_id?)` requires `use_architecture_intelligence` (to see the inference at all) **and** `edit_architecture` (as Edge judgments do), through `private.require_inference_judgment_capability`. It takes an engagement-scoped advisory lock and refuses an inference that is not `current`: a stale one ("This interpretation is stale: its basis has changed. Interpret again.") and a superseded one ("A newer interpretation of this has been kept. Judge that one."), both `23514`. `private.record_inference_judgment_row` mirrors `private.record_edge_judgment_row`: a known kind; a reason for `not_material`, `deferred` and `disagree`; a deferral date after the business today and no date otherwise; and for `promoted`, a target of the named kind on the engagement (a Risk, Decision or Review element, or an acceptance criterion still `proposed`). A holder of use without `edit_architecture` reads judgments but records none.

**An ephemeral interpretation is judged only by keeping it (PD-21).** Judging from the drawer before Keep calls `keep_architecture_inference` with the judgment, which keeps and judges in one transaction (ADR-0069). There is no other way to judge an interpretation that was not kept.

**Engagement-wide (PD-14), computed return (PD-15).** A judgment applies for every holder on the engagement. Nothing is ever cleared or rewritten: staleness, computed by `architecture_inference_state`, ends suppression and removes an inference from Suggested interpretations; an `investigating` judgment leaves it listed; a `deferred` judgment whose date has come returns it if it is still current.

**The two judgments never cross.** A judgment on an inference never judges the Edge item it may concern, and an Edge judgment never judges an inference. Inference judgments are never written to `edge_judgments`, and `edge_items` does not read them.

**Promotion only through governed operations (IX-20).** The judgment layer of a kept, current interpretation offers the governed destinations deterministically, as on Edge items: Record a Risk, Record a Decision, Schedule a Review, and Propose an acceptance criterion only when the subject element can carry criteria (a core object or an Implementation Initiative, ADR-0046). The model never suggests or ranks one, and no output field names one. `promoteInferenceToRecord`, `promoteInferenceToReview` and `promoteInferenceToCriterion` (`experience/actions.ts`):

1. re-read the inference and refuse before creating anything unless it is `current`;
2. create the record through its ordinary governed operation (`createRecord` for a Risk or Decision, `createReview`, or `proposeCriterion` on the subject element), which checks its own capability and rules;
3. record a `promoted` judgment naming the governed record by kind and id;
4. redirect to the record.

**Bringing the interpretation's text.** The governed form opens **without** model text. For a Risk, Decision or Review the person may choose to bring the interpretation's text: the assertion and claims are inserted as one `observation` statement on the new record with provenance `ai_analysis`, `client_visible = false` and a source reference naming the kind and prompt version. The existing Phase 3 guard sets an `ai_analysis` statement's review state to `pending`, so it stays under the AI review gate (`review_ai_content`) until a person accepts it. It is never client visible on entry. A promotion to an acceptance criterion never brings text; the person writes the proposed criterion.

**Outside `activity_log` (PD-18).** Like every Architecture Intelligence table (OD-10), inference judgments are not registered with `private.log_activity`; the table is itself the attributed record. This differs deliberately from `edge_judgments`, which are logged (ADR-0056). `disagree` and `not_material` reasons are evaluation data about prompts and models, read by kind, prompt version and resolved model, never by person. No read model counts, rates, ranks or compares judgments by `judged_by`; judges' names appear only on an inference's own judgment history in its drawer.

## Consequences

- A kept interpretation can be examined, set aside, disagreed with or acted on with the same vocabulary and integrity as an Edge item, and the deterministic and model-produced records stay in separate tables.
- The people who may suppress interpretations for the engagement are those who may already judge Edge items and also read interpretations.
- A Risk, Decision or Review created from an inference, or a proposed criterion, cannot be deleted while the promotion judgment exists. Brought text is reviewed AI content, never an established statement.
- If the governed record is created but the judgment is then refused (for example the inference went stale in between), the record stands without a promotion link, as with Edge promotion (ADR-0056).
- Implementation notes: a `promoted` judgment, like `investigating`, needs no reason (proposal §18.1 said "required except for `investigating`"; ADR-0056 already exempts `promoted`). A superseded inference is refused as well as a stale one. `record_architecture_inference_judgment` judges only a kept inference (`kept_at` set): an evaluation-harness `persist` row, never shown to anyone, is refused as not found (`48_ai_keep_and_judge`).
