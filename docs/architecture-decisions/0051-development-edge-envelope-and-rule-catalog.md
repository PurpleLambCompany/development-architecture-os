# ADR-0051: The Development Edge envelope and rule catalog

**Status:** Accepted (Phase 7A; approved 2026-09-30)

## Context

Phase 7A proposal (Revision 2) §4 to §6, §26 and §27; reconciliation decisions Q2, Q5, Q9, Q17 and Q28; Kerrick's OD-3 and OD-9.

Phases 4 and 5 built eleven deterministic signal rules in two functions, `intelligence_signals` and `implementation_signals` (ADR-0032, ADR-0039), each with its own output shape and dismissal table. Phase 7A adds 31 new deterministic conditions and a change consequence type across every namespace: Project Intelligence, Implementation, architecture, Reviews, Deliverables, acceptance criteria and practice. Without one shape, every surface would have to understand every rule, and the Intelligence Contract (what is this, why is it here, what does it rest on, what kind of claim is it, what triggered it, what would resolve it) could not be enforced per item.

Q5 chose to extend and sit above: new rules live in their home namespace, and a common envelope and one Edge read path sit above all of them. Q28 made the rule definitions a governed, tested catalog.

## Decision

**Items are computed, never stored.** Every Development Edge item is computed on read by `public.edge_items(p_engagement_id, p_as_of, p_subject_type, p_subject_id, p_include_judged)`. No table holds conditions, events, items, first-observed times, tiers or ranks. Only human judgments (ADR-0056), the Review capture (ADR-0054) and each user's private briefing mark (ADR-0057) are stored. This generalizes ADR-0032 to all deterministic intelligence (see the ADR-0032 amendment).

**One envelope.** `edge_items` composes the two existing signal functions (called with `p_include_dismissed = true`, so the envelope applies judgment itself), the six private rule functions (`private.edge_rules_integrity`, `_realization`, `_change`, `_exposure`, `_potential`, `_learning`, each returning the composite `private.edge_raw_item`) and `private.edge_change_reaches`, and maps each into one row:

| Field                                                                                   | Contract question                        |
| --------------------------------------------------------------------------------------- | ---------------------------------------- |
| `item_key`                                                                              | Deterministic; never stored              |
| `rule_key`, `home`, `lens`                                                              | What is this?                            |
| `epistemic_status`, `producer`                                                          | What kind of claim? Deterministic or AI? |
| `subject_type`, `subject_id`, `subject_reference_code`, `subject_title`, `subject_kind` | Which record does it bear on?            |
| `variant`, `details`                                                                    | What exactly?                            |
| `basis`                                                                                 | Which governed records support it?       |
| `trigger_type`, `trigger_subject_id`, `trigger_version_id`, `trigger_at`, `trigger_key` | What changed to cause it, and when?      |
| `consequence_path`                                                                      | Why does it bear on this? (matrix path)  |
| `fingerprint`                                                                           | What makes it this item                  |
| `resolving_act`                                                                         | What governance act would resolve it?    |
| `tier`, `tier_reason`, `order_facts`                                                    | Why is it placed here? (ADR-0058)        |
| `judgment_kind`, `judged_by`, `judged_at`, `judgment_reason`, `judged` and related      | What has a person decided? (ADR-0056)    |

- `item_key` is `rule_key:subject_id:md5(fingerprint|trigger_key)`, stable across reads.
- `producer` is always `rule` in Phase 7A. The column exists so a later phase could add another producer without reshaping the envelope; nothing of Phase 7B is built.
- `basis` is a jsonb array of references (`type`, `id`, `reference_code`, `role`, and `version_id` and `version_no` wherever a version is compared), built by `private.edge_element_ref` and `private.edge_ref`. It never carries content. The UI resolves references through existing read paths, so an item never shows a reader something they cannot already read.
- `trigger_at` is always system time, or null for `state` and `date` items.
- No item carries a confidence value or a numeric score.
- Items whose subject element is retired or superseded are never produced.
- `edge_items` is `security definer` with `search_path = ''`, returns nothing unless `private.can_read_architecture(p_engagement_id)` holds, takes one engagement and never joins across engagements. Clients receive nothing.

**Epistemic statuses.** Every item has exactly one: `recorded` (a fact the team recorded, read back), `derived` (a correspondence between governed records, calculated by a fixed rule) or `worth_considering` (a pattern that may warrant a look, making no causal claim). `suggested` is reserved for Phase 7B and is never produced (`RESERVED_EPISTEMIC_STATUSES` in `src/domain/edge/rules.ts`).

**The catalog.** `private.edge_rules()` holds 42 rows: the 31 new rules (`origin = 'new'`) and the 11 Phase 4 and Phase 5 rules (`origin = 'existing'`). Each row carries `rule_key`, `candidate`, `origin`, `home`, `lens`, `epistemic_status`, `subject_type`, `trigger_type`, `time_basis`, `substantive_only`, `list_tier`, `resolving_act`, `scope` and `thresholds`. `public.edge_rule_catalog()` exposes it to internal users. The TypeScript module `src/domain/edge/rules.ts` (`EDGE_RULES`) mirrors every attribute and adds the words a person reads (`label`, `definition`, `why`) and each rule's documented `fingerprint`; `rules.test.ts` parses the migration and asserts the two agree. The database decides when a rule holds; the TypeScript carries its words.

- **Homes** follow the ADR-0039 reading: `intelligence`, `implementation`, `architecture`, `review`, `deliverable`, `criteria` or `practice`, naming the namespace whose tables are the rule's primary source.
- **Lenses:** `integrity`, `realization`, `change`, `exposure`, `potential`, `learning`.
- **Trigger types:** `substantive_revision`, `status_change`, `evidence_link`, `decision`, `date`, `state` (ADR-0052).
- **Time bases:** `system_time`, `exact_version`, `business_date` (anticipation rules only) or `none`.
- **List tiers:** `ambient` or `attention` (ADR-0058).
- **Subject types:** `element`, `client_action`, `method_application`, `acceptance_criterion` and `engagement`.
- **Thresholds** are constants in the rule functions and are stated in the catalog's `thresholds` column (for example "2 or more converging dependencies", "Severity 15 or more").

**`change_reaches` is a consequence type, not a condition.** It has no catalog row. Its envelope attributes are fixed in `CHANGE_REACHES` (home `architecture`, lens `change`, `derived`, `attention`, resolving act `examine_reached`) and by the defaults in `edge_items` (ADR-0055).

**The existing signals are consumed unchanged** (OD-3). Their rules, thresholds, scope (including draft Project Intelligence where a rule already includes it) and output shape are not modified. The catalog states each one's scope so it stays intentional. The Signals page keeps its behavior. The envelope maps each signal's `details` into `basis` and reads its existing dismissals (OD-9, ADR-0056).

**No enums.** Catalog keys are text with check constraints wherever they are stored (`edge_judgments.rule_key` is checked by `private.is_edge_rule_key`; `relationship_impact_rules` columns by check constraints). No enum type or value is created, because enum values cannot be removed and the catalog must stay revisable while rules are tuned.

**Clarifications recorded during implementation.**

1. `method_basis_superseded` variant `release_moved` has an **engagement subject**: one engagement-level item (`subject_type = 'engagement'`, `subject_id` the engagement) whose `details.applications` and `basis` list the affected open Method Applications. The catalog row keeps `subject_type = 'method_application'` for the rule, which is the `pinned_version_superseded` variant's subject. `engagement` was added to the envelope's subject types and to `edge_judgments.subject_type` for this variant.
2. Some rules decide their tier per item rather than only from the catalog default: `statement_contradicted_by_evidence` is Attention when the element is an Assumption or underpins something, else Ambient; `evidence_after_review` is Attention when any link contradicts; `approval_behind_published` is Ambient while an approval request on the latest version is pending; `governance_allocation_gap` is Ambient for `body_governs_nothing`; `method_basis_superseded` is Attention for `release_moved`. The catalog's `thresholds` column records each of these.

## Consequences

- Every surface (the Engagement Edge, the overview section, the contextual panels) reads one shape, and grouping and ordering are written once (ADR-0052, ADR-0058).
- The Intelligence Contract is enforced per item by the envelope and tested, not only documented.
- A new rule is a new rule function row, a catalog row in both mirrors, and its tests. Removing a rule is equally local, because nothing is stored per rule except judgments keyed by text.
- Phase 7A has no AI, no model producer, no scoring, no notification and no client-facing intelligence. The Phase 7B hold stands: the `producer` column and the reserved `suggested` status leave room without building anything.

## Amendment (2026-10-01): model inferences are not Edge items in 7B.1

Phase 7B.1 begins to use the reserved vocabulary, but outside the Edge: Architecture Intelligence inferences are stored in `public.architecture_inferences` with `producer = 'model'` and `epistemic_status = 'suggested'` fixed by check constraints (ADR-0064). Nothing in 7B.1 places an inference in the Edge envelope, changes the rule catalog, or shows inference text anywhere (OD-12). Edge projection of inferences remains a 7B.2 question and needs its own approval. The Edge is read by the Tool Contract (`ai_context_edge_item`) only as context, through the same per-field classification; practice-lens items are Method/IP and never leave DSA.

## Amendment (Phase 7B.2, 2026-10-01): Suggested interpretations beside the envelope

Phase 7B.2 Step A (IX-17, PD-15; ADR-0068) adds a projected section of **stored** model inferences beside the Edge, never inside it. The envelope is unchanged: `edge_items`, the rule catalog, tiers, ordering, fingerprints and `producer` values are exactly as above, and no rule reads an inference.

- `public.suggested_interpretations(engagement)` returns kept `tension`, `evidence_bearing` and `realization_reading` inferences (`producer = 'model'`, `epistemic_status = 'suggested'`) that are current and whose latest judgment is none, `investigating`, or a deferral whose date has come. It returns an empty set to anyone without `use_architecture_intelligence`.
- The Engagement Edge shows them in a separate **Suggested interpretations** section below every tier, described as "Interpretations kept by architects on this engagement. Suggested, not established by DSA's rules." The section and its heading are absent for non-holders and when processing is `off`.
- They are never mixed into the envelope, never tiered, counted, ranked or severity-styled, never judged through `edge_judgments` (they have their own table, ADR-0070), and never appear in the overview's Development Edge section, the "Since you were away" briefing, contextual Edge panels or whole-event judgment. They are ordered by the subject's nearest governance date and then keep time, never by importance.
- `suggested` remains a status no rule produces. A kept `explanation` or `review_brief` is never projected; it appears only in its subject's intelligence drawer (ADR-0067).
- The Edge item drawer (ADR-0067) reads the envelope and catalog as its deterministic layer ("Why am I seeing this?"). "Explain significance" is offered on an item only by the availability rule of ADR-0068, which reads the envelope and changes nothing.
