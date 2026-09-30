# Phase 7A — Deterministic Development Edge: Proposal

**Status:** Revision 2, **approved and implementation-ready**. Kerrick approved the proposal on 2026-09-30 and decided OD-1 to OD-10 (§29), with five clarifications (§29.2). This revision records those decisions. OD-7 changed the recommendation: a held Review's examined set is now closed (§11.4). Nothing in this proposal has been built: no migration, schema, table, function, enum value, ADR, domain code, seed data, test or UI. Names are proposed until implementation.

**Changed in Revision 2:** §1, §10.6, §11, §12.2, §13.2, §14.2, §17.1, §19, §21, §22, §23, §24, §25, §26, §28, §29 and §30. Sections changed because of OD-7 are §11.1 to §11.4, §19, §21, §22, §23, §24.1, §25, §26 and §28 (AC-32).

**Governing direction:**

- `PHASE_7_CONCEPTUAL_RECONCILIATION.md`, Revision 2 (PR #9), approved in principle on 2026-09-30;
- Kerrick's decisions on Q1–Q28, including the clarified Q1, Q3, Q19, Q20 and Q23;
- Kerrick's decisions on Q29 and Q30 (2026-09-30), recorded in the reconciliation;
- the principle Kerrick added with those decisions: **one triggering change → one primary Edge event**.

Where this proposal cites a question (Q1 to Q30), it means Kerrick's decision on it. Where it cites a candidate (D-01 to D-44), finding (F1 to F6) or matrix row, it means the reconciliation's §11.8 and §13.4.

**Read against `main` at `90ee72e`** (Phase 6 complete). The following were rechecked directly for this proposal:

- `hold_review`, `record_review_validation` and `validation_criteria`;
- `private.build_element_snapshot`, the subtype tables it serializes, and the status enums;
- `intelligence_signals`, `implementation_signals` and both dismissal tables and operations;
- `architecture_activity`, `intelligence_impact` and `implementation_impact`;
- `acceptance_criteria` (agreement fields), `architecture_approvals`, decisions (`decided_at`);
- `supabase/seed.sql` (it holds REV-001 through `hold_review`);
- the mirror-test pattern in `src/domain/architecture/vocabulary.test.ts`.

## Reading guide

| If you want to…                                   | Read          |
| ------------------------------------------------- | ------------- |
| Know what 7A is in one page                       | §1            |
| See every rule and how each is judged             | §4, §5        |
| See how one change becomes one event              | §6, §7        |
| See what the user sees                            | §8, §16, §23  |
| See how the Q29 and Q30 decisions are carried out | §11, §12      |
| See the security, client and privacy boundaries   | §14, §18, §19 |
| See what would be built                           | §21, §22      |
| Approve or change something                       | §28, §29, §30 |

---

## 1. Executive summary

Phase 7A turns the Living Development Model that Phases 1–6 already built into a working **Development Edge**: a calm, deterministic, internal-only layer that tells an architect what bears on the development right now, what changed, and what may warrant examination because of it. It uses no AI.

What 7A adds, in outline:

1. **31 new deterministic conditions** plus the **11 existing Phase 4/5 signals**, all computed on read, all described in one governed **rule catalog** (§4, §5).
2. **One common intelligence envelope** that every item maps into: what it is, why it surfaced, what it rests on (with versions), its epistemic status, what triggered it and what governance act would resolve it (§6).
3. **Trigger grouping:** every item carries its triggering change. Items that share a trigger are one **Edge event**, so "APP-001 was revised" appears once with its consequences under it, not as five alerts (§7).
4. **A governed impact matrix** over all 39 relationship types and the off-spine links, with direct propagation by default, four depth-capped recursive walks, and terminal hops. It replaces the semantics of the two existing impact traces for the Edge (§10).
5. **Review examined-version capture (Q29):** `hold_review` records the exact latest published version of each examined element, immutably, and the examined set closes at hold (OD-7). Change since a Review becomes version-exact (§11).
6. **A type-aware definition of substantive revision (Q30):** a publication is a revision only if its snapshot changes outside an explicit, tested list of lifecycle and status fields. `change_summary` is never parsed (§12).
7. **A curated development-change read model** across Phases 3–6, built on `activity_log` without exposing it (§13).
8. **Since You Were Away:** a user-private "briefed through" watermark that only the user sets and reads. No view tracking (§14).
9. **Durable, attributable human judgments** on items (Investigating, Not material, Deferred, Disagree, Promoted), append-only, with fingerprints so an item returns when its facts change (§15).
10. **Contextual Edge panels** on elements, initiatives, Reviews, Deliverables, decisions, evidence and Method Applications (§16).
11. **Narrow Practice Intelligence:** per-application conditions, and counts with a minimum n on Method Asset pages (§17).

What stays true: deterministic conclusions are computed, never stored. Only human judgments, the Review capture and the user's own watermark are stored. Nothing reaches clients. Nothing is scored, ranked across people or developments, pushed, or promoted automatically.

**Shape:** 11 migrations, 9 new ADRs and 4 ADR amendment notes, 13 new pgTAP files and 7 Vitest suites, a reordered seed, and UI changes on existing internal pages plus one new route. No new dependency.

---

## 2. Phase 7A goals and non-goals

### 2.1 Goals

| #   | Goal                                                                                                         | Measured by (see §28) |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------- |
| G1  | Surface every approved deterministic condition, correctly, with no status-publication or business-date noise | AC-1 to AC-6          |
| G2  | Every surfaced item satisfies the Intelligence Contract                                                      | AC-7, AC-8            |
| G3  | One triggering change produces one primary Edge event                                                        | AC-9, AC-10           |
| G4  | Impact follows the governed direction matrix, bounded and explainable                                        | AC-11 to AC-13        |
| G5  | "What changed since this Review" is version-exact                                                            | AC-14, AC-15          |
| G6  | A user can see what changed since they last reviewed, privately                                              | AC-16 to AC-18        |
| G7  | Human judgment on items is durable, attributable and reversible by a newer judgment                          | AC-19 to AC-21        |
| G8  | The Edge appears where the work is, contextually                                                             | AC-22                 |
| G9  | Ordering is deterministic and explained; the top tier is human-set only                                      | AC-23, AC-24          |
| G10 | No client, cross-engagement, AI, scoring or surveillance path exists                                         | AC-25 to AC-30        |

### 2.2 Non-goals (and the constraint each preserves)

| Not in 7A                                                      | Constraint                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| Any AI inference, explanation, summary or drafting             | No AI implementation (Phase 7B)                               |
| Any model-provider SDK, prompt, provider abstraction           | No model provider integration (7B)                            |
| Embeddings, vector store, semantic search                      | No embeddings or vector store                                 |
| Cross-engagement architectural recurrence                      | No cross-engagement architectural learning (Q10)              |
| Pattern Library, Pattern candidates                            | Not Phase 7 (Q23)                                             |
| Any change to the client portal or client read models          | No client-facing intelligence (Q2, Q12)                       |
| A chat or "ask" surface                                        | No generic chatbot (Q13); conversational access is 7B at most |
| Email, push, badges, unread counts                             | No notification system (Q24)                                  |
| View logs, last-seen, time-on-page, per-person activity counts | No productivity monitoring (Q7)                               |
| Any numeric importance, health, maturity or quality score      | No scoring of people, developments or architecture (Q9)       |
| Free graph traversal, arbitrary depth, graph visualization     | No generic graph traversal (§10)                              |
| Creating or changing a governed record from an item            | No automatic promotion (Q6)                                   |
| Stored intelligence conclusions or caches                      | Deterministic conclusions computed, not stored (ADR-0032)     |
| The Q19 data-use settings                                      | 7B prerequisites, not 7A                                      |
| Deliverable generation                                         | Not 7A (Q25)                                                  |
| Elapsed-time stall inference or outcome prediction             | Phase 5 D16, Q21                                              |
| Version pinning on `implements` or `validates`                 | Q26: timestamps suffice for those two                         |

---

## 3. Relationship to DSA IDE, the Living Development Model and the Development Edge

| Concept (Q1)              | What it means in 7A                                                                                                                          | What it is not                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| DSA IDE                   | The product paradigm 7A serves. The Edge is the IDE's "problems" pane, "find usages" and "what changed" for a real-world development         | A rename. Repository and system references stay "DSA OS" |
| Living Development Model  | The governed records of Phases 1–6, read through new read models. 7A adds an interpretive layer, the Review capture and the user's watermark | A table, type, schema object or materialized graph       |
| Architecture Intelligence | The phase's name. 7A is its deterministic half                                                                                               | AI                                                       |
| Development Edge          | The experience: the engagement Edge, the briefing and the contextual panels, all built from one envelope                                     | A dashboard, feed, notification channel or record type   |
| Intelligence Contract     | Enforced per item by the envelope (§6) and the catalog (§5), and tested (§24)                                                                | Documentation only                                       |

**The IDE analogy stays honest (reconciliation §3.2).** The Edge reports correspondence between governed records. It never claims to verify operating reality, and its copy never says "error", "broken" or "failing".

**Claude Test.** Every 7A capability depends on authoritative, version-exact, permission-scoped state and its history: realization correspondence, change since a Review, typed impact, what changed since the user last reviewed. None can be reproduced by exporting documents to a general AI conversation (reconciliation §5).

---

## 4. Final deterministic intelligence inventory

### 4.1 Totals

| Group                                      | Count                        | Source                                                                 |
| ------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------- |
| Existing Phase 4 signals                   | 10                           | `intelligence_signals` (unchanged)                                     |
| Existing Phase 5 signal                    | 1                            | `implementation_signals` (unchanged)                                   |
| New conditions                             | **31**                       | 23 that remained and 8 that were narrowed in §11.8.3                   |
| Change consequences from the impact matrix | 1 consequence type           | `change_reaches`: D-07 merged and generalized (§10.5); not a condition |
| Merged into other mechanisms               | D-07, D-27, D-34, D-35       | See 4.3                                                                |
| Deferred                                   | D-43 (as an Edge item), D-44 | D-43 becomes a practice count (§17); D-44 waits                        |
| Dropped as an Edge condition               | D-38                         | Kept as a fact in the element panel ("serves 3 outcomes")              |

**One reconciling detail.** Revision 2 counted 31 new conditions and listed D-27 separately as "merge the application and engagement variants into one item". The only faithful way to carry both is to fold D-27 into D-26: both mean "the practice basis under open method work has moved". This proposal therefore has **31 rule keys covering 32 candidates**, with D-26 and D-27 as two variants of `method_basis_superseded`. No candidate is lost and none is added.

### 4.2 Dispositions carried from the empirical review

| Disposition         | Candidates                                                                                                                               | How 7A carries it                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Remain (existing)   | D-01, D-02, D-18, D-29, D-30, D-36                                                                                                       | The 11 existing rules, consumed unchanged through the envelope                                   |
| Remain (new)        | D-05, D-06, D-08, D-09, D-10, D-13, D-14, D-15, D-16, D-17, D-19, D-20, D-23, D-24, D-25, D-26, D-28, D-31, D-32, D-33, D-39, D-40, D-41 | New rule keys (§5.2)                                                                             |
| Narrow              | D-03 (generalized), D-04, D-11, D-12, D-21, D-22, D-37, D-42                                                                             | New rule keys with the narrowed scope written into the catalog                                   |
| Merge               | D-07, D-27, D-34, D-35                                                                                                                   | D-07 → `change_reaches`; D-27 → variant of D-26; D-34 → reach factor; D-35 → tier factor on D-02 |
| Defer               | D-43, D-44                                                                                                                               | D-43 as a Method Asset count with minimum n; D-44 not built                                      |
| Drop (as Edge item) | D-38                                                                                                                                     | Element panel fact only                                                                          |

### 4.3 How the four merges work

- **D-07 (dependent architecture changed) → `change_reaches`.** A substantive revision propagates along the matrix (`requires` upward, `part_of` and `specializes` downward, and the direct Yes links), and each reached element is a consequence inside the revision's event. There is no standalone "requires target changed" rule.
- **D-27 (DAM release moved) → `method_basis_superseded`, variant `release_moved`.** One engagement-level item listing the affected open applications.
- **D-34 (constraint reaches several paths) → reach factor.** When an item's subject is an in-force constraint, the number of initiatives it constrains counts toward the item's reach in ordering (§9). It is never its own item.
- **D-35 (critical premise unsupported) → tier factor.** Human attention `high` on the subject raises any item to Elevated; `critical` raises it to the human-flagged tier (§9). D-02 is the item; attention decides its tier.

### 4.4 The findings, applied

| Finding | Where 7A applies it                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| F1      | Change rules compare system time only, or exact versions. Business dates are used only by anticipation rules (§5.3) |
| F2      | Change rules act on substantive revisions only (§12)                                                                |
| F3      | Every item carries a trigger; items are grouped into events by trigger (§7)                                         |
| F4      | Scope is an explicit catalog attribute on every rule, including the 11 existing rules (§5.1, OD-3)                  |
| F5      | `hold_review` captures examined versions (§11)                                                                      |
| F6      | `impact_trace` implements the matrix; the existing traces are no longer used by the Edge (§10)                      |

---

## 5. Rule catalog design

### 5.1 Catalog attributes

Every rule, existing and new, has one catalog entry. The catalog exists twice, deliberately: as a SQL function `private.edge_rules()` that the read path joins, and as a TypeScript module `src/domain/edge/rules.ts` that the UI reads. A Vitest suite parses the migration and asserts that the two agree, the way `vocabulary.test.ts` mirrors the relationship rules (Q28).

| Attribute           | Meaning                                                                                     | Values                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `rule_key`          | Stable identifier, `^[a-z][a-z_]*$` like the Phase 4 keys                                   | Text                                                                                              |
| `candidate`         | Reconciliation candidate(s)                                                                 | D-xx                                                                                              |
| `home`              | The namespace whose tables are the rule's primary source (ADR-0039 reading)                 | `intelligence`, `implementation`, `architecture`, `review`, `deliverable`, `criteria`, `practice` |
| `lens`              | Primary Edge lens (reconciliation §7)                                                       | Integrity, Realization, Change, Exposure, Potential, Learning                                     |
| `epistemic_status`  | What kind of claim DSA is making (reconciliation §9.2)                                      | `recorded`, `derived`, `worth_considering`. (`suggested` is reserved for 7B and unused)           |
| `subject_type`      | What the item is about                                                                      | `element`, `client_action`, `method_application`, `acceptance_criterion`                          |
| `scope`             | Which subjects are evaluated                                                                | For example: `published`, `live` (draft and published, not retired or superseded), type limits    |
| `trigger_type`      | What makes the item appear, and so how it groups                                            | `substantive_revision`, `status_change`, `evidence_link`, `decision`, `date`, `state`             |
| `time_basis`        | What the rule compares                                                                      | `system_time`, `exact_version`, `business_date` (anticipation only), `none`                       |
| `substantive_only`  | Whether only substantive revisions count (§12)                                              | Boolean; true for every rule whose trigger is a revision                                          |
| `list_tier`         | The rule's default tier (§9.2)                                                              | `ambient`, `attention`                                                                            |
| `resolving_act`     | The governance act that would make the condition stop holding (reconciliation §27)          | Text key with a plain-language label and a link target                                            |
| `definition`, `why` | Plain-language definition and why it matters (TypeScript only; the SQL carries the key)     | Text                                                                                              |
| `fingerprint`       | The facts that make the item this item; a change brings a judged item back                  | Documented per rule                                                                               |
| `thresholds`        | Any constant, with its value and reason (C9: constants live in migrations, documented here) | For example: severity ≥ 15; ≥ 2 converging dependencies                                           |

Catalog keys are **text with check constraints**, not Postgres enums, wherever they are stored (judgments). Enum values cannot be removed, and the catalog must stay revisable while rules are tuned.

### 5.2 The 31 new rules

"S" in the trigger column means the rule counts **substantive revisions only** (§12). "Time" is the comparison basis (F1). Tiers are the rule's default before ordering factors (§9).

#### Integrity (7)

| #   | Rule key                             | Cand. | Status   | Home         | Subject and scope                                                                                                                                         | Trigger (time)         | Resolving governance act                                                              | Tier                                                                              |
| --- | ------------------------------------ | ----- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | `statement_contradicted_by_evidence` | D-03  | Derived  | architecture | Published element with a statement carrying `contradicts` evidence                                                                                        | Evidence link (system) | Revise the statement and publish, record the assumption's validation status, or judge | Attention if the element is an Assumption or underpins something; else Ambient    |
| 2   | `relationship_to_replaced_element`   | D-05  | Derived  | architecture | Live element with an unretired relationship whose other end is superseded or retired (never `supersedes` itself)                                          | State                  | Retire or re-point the relationship                                                   | Attention                                                                         |
| 3   | `conflict_unresolved`                | D-06  | Recorded | architecture | Unretired `conflicts_with` between two published elements                                                                                                 | State                  | Retire the relationship with a reason, or judge (accepted tension)                    | Attention; Ambient on both elements                                               |
| 4   | `methodology_derived_without_model`  | D-08  | Recorded | architecture | Element or statement with `methodology_derived` provenance and no `instantiates` lineage                                                                  | State                  | Record lineage (Phase 6), or publish with corrected provenance                        | Attention                                                                         |
| 5   | `measurement_gap`                    | D-09  | Derived  | architecture | Variant `outcome_unmeasured`: published Intended Outcome with no `measured_by`. Variant `metric_unattached`: published Metric that measures nothing       | State                  | Relate a Metric, or judge                                                             | Ambient                                                                           |
| 6   | `capability_serves_no_outcome`       | D-10  | Derived  | architecture | Published Capability that `serves` no Intended Outcome, directly or through its `part_of` ancestors; the item states what it does relate to               | State                  | Relate it to an outcome, or judge                                                     | Attention                                                                         |
| 7   | `governance_allocation_gap`          | D-11  | Derived  | architecture | Variant `decision_right_unheld`: published Decision Right with no `holds`. Variant `body_governs_nothing`: published Governance Body that governs nothing | State                  | Relate a holder or governed element, or judge                                         | `decision_right_unheld` Attention; `body_governs_nothing` Ambient only (narrowed) |

#### Realization (8)

| #   | Rule key                       | Cand. | Status   | Home           | Subject and scope                                                                                                                                                                                  | Trigger (time)          | Resolving governance act                                                                                                   | Tier                                              |
| --- | ------------------------------ | ----- | -------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 8   | `approved_without_pathway`     | D-12  | Derived  | architecture   | Capability or Application Format with an approved or published version, and no incoming `implements` on it or its `part_of` descendants (depth ≤ 2), and for a Capability no `implemented_through` | State                   | Create an initiative that implements it, or relate an operating form, or judge                                             | Attention                                         |
| 9   | `operational_not_validated`    | D-13  | Recorded | implementation | Initiative with status `operational` and no `validates`. The item names the next scheduled Review that examines it, if any                                                                         | Status change           | Record a validation through a held Review                                                                                  | Attention                                         |
| 10  | `implements_replaced_element`  | D-14  | Derived  | implementation | Live initiative that `implements` a superseded or retired element                                                                                                                                  | State                   | Re-point or retire the `implements` relationship, or change the initiative's status                                        | Attention                                         |
| 11  | `implemented_element_revised`  | D-15  | Derived  | implementation | Initiative in `not_started`, `in_progress`, `stalled` or `operational` whose implemented element has a substantive revision published after the `implements` relationship was created              | **S** revision (system) | A Review held after the revision that examines the initiative or the element (its capture shows the new version), or judge | Attention                                         |
| 12  | `validated_element_revised`    | D-16  | Derived  | implementation | `validated` initiative whose implemented element has a substantive revision published after the `validates` relationship was created                                                               | **S** revision (system) | A Review held after the revision that examines the initiative, or judge                                                    | Attention                                         |
| 13  | `realization_without_evidence` | D-17  | Derived  | implementation | `operational` or `validated` initiative with no element evidence link and no checkpoint achieved with evidence                                                                                     | State                   | Link evidence to the initiative or a checkpoint                                                                            | Attention; `validated` orders above `operational` |
| 14  | `checkpoint_past_target`       | D-19  | Recorded | implementation | Checkpoint not achieved whose `target_on` is before the business date                                                                                                                              | Date (business)         | Achieve the checkpoint or record a new target                                                                              | Attention                                         |
| 15  | `criteria_without_review_path` | D-20  | Derived  | implementation | Initiative with agreed criteria in force and no scheduled or held Review that examines it or an element it implements                                                                              | State                   | Schedule a Review that examines it                                                                                         | Attention                                         |

#### Change (8)

| #   | Rule key                                | Cand.      | Status   | Home         | Subject and scope                                                                                                                                                                                                                                                                                | Trigger (time)                              | Resolving governance act                                                                    | Tier                                                           |
| --- | --------------------------------------- | ---------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 16  | `criteria_predate_revision`             | D-04       | Derived  | criteria     | Agreed criterion in force whose governed element has a substantive revision published after `agreed_recorded_at` (system time, OD-2), never after `agreed_on`. A criterion whose agreement time could not be backfilled produces no item, and its panel says the agreement time was not recorded | **S** revision (system)                     | Supersede the criterion with a newly agreed one, or judge                                   | Attention                                                      |
| 17  | `examined_element_revised_since_review` | D-21       | Derived  | review       | Held Review with a captured examined version (§11) where that element now has a substantive revision later than the captured version. Reviews held before 7A: only if they have a baseline (compared version-exact)                                                                              | **S** revision (exact version)              | A later held Review that examines the element (its capture becomes the reference), or judge | Attention; Ambient on the element                              |
| 18  | `evidence_after_review`                 | D-22       | Derived  | review       | Held Review with a capture, where evidence was linked to a captured element (statement or element link) after the capture time. `contradicts` orders first                                                                                                                                       | Evidence link (system)                      | A later held Review that examines the element, or judge                                     | Attention for `contradicts`; Ambient otherwise                 |
| 19  | `decision_not_reflected`                | D-23       | Derived  | intelligence | Decided decision whose `decided_at` (system) is later than the latest substantive version of an element it `affects`                                                                                                                                                                             | Decision (system)                           | A substantive revision of the affected element, or judge ("needs no revision")              | Attention                                                      |
| 20  | `deliverable_documents_revised`         | D-24       | Derived  | deliverable  | Deliverable, not superseded or retired, documenting an element with a substantive revision later than the version in the Deliverable's baseline (exact) or, without a baseline, published after its latest approval was recorded (system)                                                        | **S** revision (exact version, else system) | Publish a new Deliverable version and record its approval, or judge                         | Attention                                                      |
| 21  | `contribution_on_prior_version`         | D-25       | Derived  | intelligence | Unhandled client contribution made on a version after which the element has a substantive revision                                                                                                                                                                                               | **S** revision (exact version)              | Handle the contribution                                                                     | Attention                                                      |
| 22  | `method_basis_superseded`               | D-26, D-27 | Recorded | practice     | Variant `pinned_version_superseded`: open Method Application pinned to a Method version since superseded. Variant `release_moved`: open applications started under a DAM release that is no longer the engagement's, or older than the latest published release; one engagement-level item       | State                                       | None required (pins are deliberate, ADR-0043); judge, or change the engagement's release    | `pinned_version_superseded` Ambient; `release_moved` Attention |
| 23  | `approval_behind_published`             | D-28       | Derived  | architecture | Element whose latest approved version is not its latest published version, and a substantive revision lies between them. Ambient only while an approval request on the latest version is pending                                                                                                 | **S** revision (exact version)              | Request and record approval of the latest version                                           | Attention                                                      |

#### Exposure (3)

| #   | Rule key                            | Cand. | Status  | Home         | Subject and scope                                                                                             | Trigger (time) | Resolving governance act                                                       | Tier                                                                                     |
| --- | ----------------------------------- | ----- | ------- | ------------ | ------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 24  | `dependencies_converge`             | D-31  | Derived | intelligence | Live element that is the `to` end of two or more blocking, unsatisfied dependencies (threshold 2, documented) | Status change  | Satisfy or re-scope a dependency, or judge                                     | Attention                                                                                |
| 25  | `escalation_before_review`          | D-32  | Derived | intelligence | Open escalation on a risk that `threatens` an element examined by a scheduled Review                          | State          | Resolve the escalation, or hold the Review with the risk on its agenda         | Attention; always shown human-flagged, because its open escalation is a human act (§9.2) |
| 26  | `materialized_risk_still_threatens` | D-33  | Derived | intelligence | Risk with status `materialized` and an unretired `threatens` to a live element                                | Status change  | Revise the threatened architecture, retire the relationship, or close the risk | Attention                                                                                |

#### Potential (2)

| #   | Rule key                          | Cand. | Status            | Home         | Subject and scope                                                                                                                           | Trigger (time) | Resolving governance act                             | Tier      |
| --- | --------------------------------- | ----- | ----------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------- | --------- |
| 27  | `opportunity_advances_unrealized` | D-37  | Worth considering | intelligence | Opportunity `identified`, `evaluating` or `pursuing` that `advances` a Capability or Application Format no initiative implements (narrowed) | State          | Decide how to pursue it (`pursues`), or judge        | Attention |
| 28  | `opportunity_without_carrier`     | D-39  | Derived           | intelligence | Opportunity `evaluating` with no `pursues` from any capability, decision or recommendation                                                  | State          | Relate a carrier, or change the opportunity's status | Attention |

#### Learning (3)

| #   | Rule key                                 | Cand. | Status            | Home           | Subject and scope                                                                                                                         | Trigger (time) | Resolving governance act                                                                              | Tier      |
| --- | ---------------------------------------- | ----- | ----------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- | --------- |
| 29  | `repeated_realization_difficulty`        | D-40  | Worth considering | implementation | Element whose implementing initiatives together record two or more transitions into `stalled` or `abandoned`, or reopenings (threshold 2) | Status change  | None required; examine the architecture, or judge. Worded "worth examining" (recurrence is not cause) | Attention |
| 30  | `application_outputs_absent`             | D-41  | Derived           | practice       | Completed Method Application with a declared output (`method_version_outputs`) that has no corresponding `produced` link                  | State          | Record the output through ordinary operations, or record an addendum explaining it                    | Attention |
| 31  | `application_instrument_evidence_absent` | D-42  | Derived           | practice       | Completed or discontinued Method Application whose Method declares an Instrument that no `gathered` evidence cites (narrowed)             | State          | Link gathered evidence, or record an addendum                                                         | Attention |

### 5.3 The 11 existing rules in the catalog

These are consumed unchanged (§26). The catalog records what they actually do today, including their current scope (F4). OD-3 keeps that scope, deliberately.

| Rule key                                     | Cand. | Lens        | Status   | Home           | Scope today                                  | Trigger (time)  | Resolving governance act                       | Tier                    |
| -------------------------------------------- | ----- | ----------- | -------- | -------------- | -------------------------------------------- | --------------- | ---------------------------------------------- | ----------------------- |
| `assumption_unvalidated_underpins_published` | D-02  | Integrity   | Derived  | intelligence   | Live assumption; published target            | Status change   | Validate or invalidate the assumption          | Attention (D-35 raises) |
| `assumption_invalidated_still_underpins`     | D-01  | Integrity   | Derived  | intelligence   | Live assumption and target                   | Status change   | Revise or retire the underpinned architecture  | Attention               |
| `risk_high_without_mitigation`               | D-29  | Exposure    | Derived  | intelligence   | Live risk, severity ≥ 15, open or mitigating | State           | Relate a mitigation                            | Attention               |
| `dependency_blocking_unsatisfied`            | D-30  | Exposure    | Derived  | intelligence   | Live dependency; published `from` end        | Status change   | Satisfy or re-scope the dependency             | Attention               |
| `decision_past_needed_by`                    | D-36  | Exposure    | Recorded | intelligence   | Live decision, open or recommended           | Date (business) | Record the decision or a new needed-by date    | Attention               |
| `opportunity_window_closing`                 | D-36  | Potential   | Recorded | intelligence   | Live opportunity, identified or evaluating   | Date (business) | Decide pursuit                                 | Attention               |
| `opportunity_window_closed`                  | D-36  | Potential   | Recorded | intelligence   | Live opportunity (drafts included)           | Date (business) | Update the opportunity's status                | Attention               |
| `review_overdue`                             | D-36  | Exposure    | Recorded | intelligence   | Live record with a stewardship review date   | Date (business) | Review the record and set the next date        | Attention               |
| `client_action_overdue`                      | D-36  | Exposure    | Recorded | intelligence   | Open client action                           | Date (business) | Follow up the action                           | Attention               |
| `record_untriaged`                           | D-36  | Exposure    | Recorded | intelligence   | Live record untriaged > 7 days               | Date (business) | Triage the record                              | Attention               |
| `implementation_past_target`                 | D-18  | Realization | Recorded | implementation | Live initiative before validation            | Date (business) | Record a new target or the initiative's status | Attention               |

### 5.4 Fingerprints

A fingerprint is the minimal set of facts that make an item _this_ item, so that a judged item returns only when those facts change (ADR-0032). For the new rules:

- **Revision-triggered rules:** the id of the latest substantive version that triggers the item. A newer substantive revision brings a judged item back; a status-only publication does not.
- **Evidence-triggered rules:** the sorted ids of the triggering links.
- **Decision-triggered rules:** the decision's latest version id and the affected element's latest substantive version id.
- **State rules:** the ids and statuses that define the state (for example, the retired end's id and lifecycle for `relationship_to_replaced_element`).
- **Date rules:** the date compared (as today).

Fingerprints are bounded text (≤ 1000 characters, as today). Each rule's fingerprint is written into the TypeScript catalog and asserted in pgTAP.

---

## 6. Common intelligence envelope

### 6.1 Shape

`public.edge_items(p_engagement_id uuid, p_as_of date default null, p_subject_type text default null, p_subject_id uuid default null, p_include_judged boolean default false)` returns one row per item. It composes the two existing signal functions, the new rule functions and `change_reaches` consequences, and maps each into this shape:

| Field                                                                                   | Contract question (reconciliation §10)      | Source                                                                                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `item_key`                                                                              | —                                           | Deterministic: rule key, subject and fingerprint. Stable across reads; never stored                                               |
| `rule_key`, `home`, `lens`                                                              | What is this?                               | Catalog                                                                                                                           |
| `epistemic_status`                                                                      | Deterministic or AI? What kind of claim?    | Catalog. Always `recorded`, `derived` or `worth_considering` in 7A                                                                |
| `producer`                                                                              | Deterministic or AI?                        | Constant `rule` in 7A. The column exists so 7B can add `model` without reshaping the envelope. Nothing else of 7B is built        |
| `subject_type`, `subject_id`, `subject_reference_code`, `subject_title`, `subject_kind` | Which architecture does it bear on?         | Rule output                                                                                                                       |
| `variant`                                                                               | What exactly?                               | Rule output (for example `outcome_unmeasured`)                                                                                    |
| `details`                                                                               | What are you telling me?                    | Rule output, as the Phase 4 `details` jsonb already does                                                                          |
| `basis`                                                                                 | Which governed records support it?          | jsonb array of `{type, id, reference_code, version_id?, version_no?, role}`. Versions are included wherever a version is compared |
| `trigger_type`, `trigger_subject_id`, `trigger_version_id`, `trigger_at`                | What changed to cause it? When?             | Rule output; `trigger_at` is always system time, or null for `state` and `date` items                                             |
| `trigger_key`                                                                           | —                                           | Deterministic grouping key (§7.2)                                                                                                 |
| `consequence_path`                                                                      | Why does it bear on this?                   | For `change_reaches` and grouped rule items: the matrix path (relationship types, directions, depth)                              |
| `fingerprint`                                                                           | —                                           | Rule output (§5.4)                                                                                                                |
| `resolving_act`                                                                         | What authority does it have? What can I do? | Catalog. Every item is advisory; this names the governance act that would resolve it                                              |
| `tier`, `tier_reason`                                                                   | Why is it placed here?                      | §9: computed from governed facts, with a short reason code                                                                        |
| `order_facts`                                                                           | —                                           | The ordering facts (governance date, reach counts, responsibility) as jsonb, for explanation and tests                            |
| `judgment_kind`, `judged_by`, `judged_at`, `judgment_reason`, `judgment_expires_on`     | What has a person decided?                  | Latest judgment for this rule, subject and fingerprint (§15), or the existing dismissal for the 11 existing rules                 |

"When was it generated" is answered by the read itself (computed now) and by `trigger_at` (when its fact arose). No first-observed time is stored (Q7).

### 6.2 Rules for the envelope

1. Every item has exactly one epistemic status, one lens, one tier and one resolving act.
2. No item has a confidence value (reconciliation §9.2 rule 4).
3. `basis` never contains content, only references. The UI resolves references through existing read paths, so an item never shows a reader something they cannot already read.
4. The function is `security definer` with `set search_path = ''` and checks `private.can_read_architecture(p_engagement_id)` first, as the signal functions do. It takes one engagement and never joins across engagements.
5. Items for retired or superseded subjects are never produced.
6. The envelope is the only shape the UI consumes. The two signal functions keep their own shapes for the existing Signals page (§26).

---

## 7. Trigger grouping semantics

### 7.1 The principle

**One triggering change → one primary Edge event.** When one substantive change causes several consequences, the Edge shows one event for the change, and the consequences under it, each with its own basis. The user sees the shared trigger first.

Using the seeded Harbor engagement (acceptance scenario S3, §25), a substantive revision of APP-001 appears as follows. Version numbers, dates and the change summary are illustrative.

> **APP-001 Community Governance Council was revised** (v2 → v3, published 14 October) · Derived
> _Change summary: "Membership extended to district partners."_ (shown as the author wrote it; not interpreted)
>
> - IMP-001 and IMP-003 implement it and are still active. Reality may be tracking the earlier design.
> - ACR-001 and ACR-002 are agreed criteria in force on IMP-001, which implements it.
> - REV-001 examined v2 when it was held. Its judgment predates this revision.
> - DLV-001 documents it. It was approved before this revision.
>
> Why this is here: 4 records reached · 2 active initiatives · published architecture.
> What would resolve it: a Review that examines the revised version; a new Deliverable version; or your judgment on each.

### 7.2 Trigger keys

| Trigger type           | Trigger key                                         | Event heading                                        |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `substantive_revision` | `rev:` + element id + latest substantive version id | "X was revised"                                      |
| `status_change`        | `status:` + subject id + status history row id      | "X became invalidated / materialized / operational…" |
| `evidence_link`        | `evidence:` + element id + evidence source id       | "New evidence on X"                                  |
| `decision`             | `decision:` + decision id + decision version id     | "DEC-004 was decided"                                |
| `date`                 | `date:` + subject id + rule key                     | The rule's own heading                               |
| `state`                | `state:` + subject id                               | "Conditions on X"                                    |

### 7.3 Grouping rules

1. **Every item belongs to exactly one event.** Its event is its trigger key.
2. **Revisions coalesce per element.** If an element has several substantive revisions since a consequence's reference point, the event covers them all, keyed on the latest ("revised twice since REV-001: v2 → v4"). A newer revision replaces the event rather than adding another.
3. **Standing conditions group by subject.** Items with `state` triggers on one subject form one event ("IMP-001: operational, not validated; no evidence cited"). This extends the principle to conditions that have no single triggering change, so a subject never appears as a cluster.
4. **Rule items and matrix consequences merge.** If the same record is reached by a rule (for example `implemented_element_revised`) and by `change_reaches` under the same trigger, one consequence is shown: the rule's item, with the matrix path added to its basis.
5. **Different triggers stay separate.** If CAP-004 and CAP-001 are both revised and both reach IMP-002, there are two events. The contextual panel on IMP-002 shows both triggers.
6. **Hubs collapse.** When a consequence set passes through a hub (Intended Outcome, system boundary, regulatory factor, governance body, knowledge area; matrix §13.4.7), the hub's reached elements are shown as one line with a count, expandable.
7. **The event's tier is the highest tier among its items.** Its order facts are the strongest among its items (§9).
8. **The envelope keeps every item.** Grouping is a presentation of the envelope, computed by one pure function `groupEdgeItems(items)` in `src/domain/edge/grouping.ts`, used by every surface and tested directly. No event is stored.
9. **Judgment works at both levels.** A user can judge one consequence, or judge the whole event, which records one judgment per item in one operation (§15.4).

---

## 8. Development Edge experience model

### 8.1 Surfaces

| Surface                               | Route (existing unless marked new)                                                     | Shows                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Engagement Edge**                   | `/internal/engagements/[slug]/edge` (new)                                              | The ordered list of events at Attention tier or above, filterable by lens and epistemic status, with a "judged" view                    |
| **Briefing: since you last reviewed** | Top of the Engagement Edge                                                             | Developmental changes and new events since the user's watermark, grouped by trigger (§14)                                               |
| **Engagement overview**               | `/internal/engagements/[slug]`                                                         | A short "Development Edge" section: the human-flagged and Elevated events, and a link to the Edge                                       |
| **Contextual panels**                 | Element, initiative, Review, Deliverable, decision, evidence, Method Application pages | Everything that bears on the object, Ambient included (§16)                                                                             |
| **Internal landing**                  | `/internal`                                                                            | "Engagements with something to consider": one line per engagement the user can read with Elevated or human-flagged events, alphabetical |
| **Signals**                           | `/internal/engagements/[slug]/intelligence/signals`                                    | Unchanged in behavior; gains a link to the Edge (§26)                                                                                   |

### 8.2 Anatomy of an event

1. **Heading:** the trigger in plain language, with the governed reference code and title.
2. **Labels:** lens and epistemic status in words ("Change · Derived"). No icons that read as severity.
3. **Consequences:** one line each, with the reached record, the relationship in words ("implements it"), and its own basis link.
4. **Why this is here:** the tier reason and the order facts in words ("REV-003 examines this on 12 October").
5. **What would resolve it:** the resolving act, linked to the governed operation's page.
6. **Judgment:** Investigating, Not material, Defer, Disagree, Promote (§15). Visible only to users who may judge.
7. **Change summary:** shown verbatim when the trigger is a revision, labeled as the author's words.

### 8.3 Voice

The existing voice continues: "a prompt to look, never a conclusion", "a trace to read, not a score", "Calculated" beside judgment. Items say "may warrant examination", "reality may be tracking the earlier design", "worth examining". They never say "error", "violation", "at risk" (unless quoting a record), "health", "score" or "critical". Plain language comes first, with the governed term available (reconciliation §26).

---

## 9. Deterministic-first prioritization

### 9.1 No score

There is no weighted sum, no numeric importance and no stored rank. Order is lexicographic over governed facts, and every position is explained in words (Q9). The same inputs always give the same order.

### 9.2 Tiers

| Tier (key)      | Label shown                                | Where it appears           | What places an item here                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `human_flagged` | "Escalated or marked critical by the team" | Top of the Edge, set apart | **Only** human-set states: the subject (or trigger subject) has stewardship attention `critical`, or an open escalation (Q22)                                                                                                                                                          |
| `elevated`      | "Governance approaching"                   | Top of the Edge list       | A governance event within the horizon (OD-4: 14 days, a governed constant, not user-configurable in 7A) touches the subject: a scheduled Review examining it, a decision `needed_by`, a checkpoint target, a client action due. Or human attention `high` on the subject (D-35 merged) |
| `attention`     | none (the default list)                    | Engagement Edge, briefing  | The rule's `list_tier` is `attention`                                                                                                                                                                                                                                                  |
| `ambient`       | none                                       | Contextual panels only     | The rule's `list_tier` is `ambient`                                                                                                                                                                                                                                                    |

A rule can never produce `human_flagged` by itself. An item from `escalation_before_review` is human-flagged because an escalation is a human act, not because the rule says so. The word "critical" appears only where it quotes the human-set attention value.

### 9.3 Order within a tier

1. **Governance proximity:** nearest recorded governance date first (business dates, anticipation only, F1).
2. **Reach class:** active implementation reached, then published architecture reached, then an Intended Outcome reached, then other. Reach counts include initiatives constrained by an in-force constraint subject (D-34 merged).
3. **Responsibility:** items whose subject or consequence the user owns or holds come first. Responsibility is structural: element owner, decision owner, initiative owner, Method Application practitioner, Review participant, client action addressee (§14.5 of the reconciliation).
4. **Recency:** later `trigger_at` first.
5. **Reference code:** a stable last key.

Every sort key is returned in `order_facts` and rendered as the "why this is here" line. Ordering is implemented once in `src/domain/edge/ordering.ts` and tested with fixtures.

### 9.4 What never affects order

AI (none exists), people's judgment history, how often a rule fires, time since a record was last touched (Phase 5 D16), anything about another engagement.

---

## 10. Impact-analysis architecture

### 10.1 Governed direction matrix

The reconciliation's §13.4 matrix becomes a governed table, `public.relationship_impact_rules`, seeded by migration and readable by internal users, like the relationship rules table. It is mirrored in `src/domain/edge/impact-matrix.ts` and a Vitest suite asserts that every one of the 39 relationship types in `vocabulary.ts` has exactly one row per direction.

| Column          | Meaning                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `link_key`      | A relationship type, or an off-spine link key (for example `acceptance_criteria.governed_element`)                                                              |
| `direction`     | `source_to_target` or `target_to_source`: which end's change is being followed                                                                                  |
| `assessment`    | `yes`, `weak` or `no`                                                                                                                                           |
| `propagation`   | `direct`, `recursive`, `terminal` or `never`                                                                                                                    |
| `max_depth`     | 1 for direct and terminal; 2 for recursive                                                                                                                      |
| `edge_eligible` | True only when `assessment = yes` and propagation is not `never`. Weak links appear only in on-demand traces                                                    |
| `hub_target`    | Whether reaching through this link groups under a hub (§7.3 rule 6)                                                                                             |
| `condition`     | Optional narrowing, for example `underpins` recursion only when the assumption is `invalidated`, or Method Application links only while the application is open |
| `reason`        | The matrix's "why", shown in the trace                                                                                                                          |

### 10.2 Direct versus recursive propagation

Only four walks recurse (matrix §13.4.7):

| Walk                           | Direction                                                                            | Depth | Ends at (terminal)                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------ | ----- | -------------------------------------------------------------------- |
| `part_of`                      | Downward: whole → parts → sub-parts                                                  | ≤ 2   | `implements`, `examines`, `documents`, criteria, open client actions |
| `specializes`                  | Downward: general → specializations                                                  | ≤ 2   | Same                                                                 |
| `requires`                     | Upward: required → requirers                                                         | ≤ 2   | Same                                                                 |
| `underpins` (invalidated only) | Assumption → targets, then the targets' `requires` (upward) and `part_of` (downward) | ≤ 2   | Same                                                                 |

Every other Yes link is direct: one hop, then terminal hops only. `supersedes`, `raises`, `validates`, baselines, `validation_criteria`, closed Method Applications, record domains and contributor areas are **never** traversed.

### 10.3 Depth boundaries

- Depth counts architecture hops. Terminal hops (from a reached element to its initiatives, Reviews, Deliverables, criteria and open client actions) do not add depth, and never continue.
- Maximum architecture depth is 2 in every mode. There is no user-selectable depth.
- Cycles are cut by path, as the existing traces do.
- A result reached by two paths is reported once, with its shortest path.

### 10.4 Off-spine joins

At each reached element, the trace joins, without traversing further:

| Reached category       | Join                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Active implementation  | Incoming `implements` from live initiatives                                                                |
| Acceptance Criteria    | `acceptance_criteria.governed_element_id` (agreed, in force); and criteria in force on reached initiatives |
| Reviews                | Incoming `examines` from scheduled Reviews, and held Reviews with a capture of the element                 |
| Deliverables           | Incoming `documents` from non-superseded Deliverables                                                      |
| Evidence               | Statement and element evidence links (on-demand trace only)                                                |
| Client exposure        | Open client actions with the element as subject                                                            |
| Contributions          | Unhandled contributions on the element                                                                     |
| Practice               | Open Method Applications that `examined` the element (internal)                                            |
| Methodology provenance | Lineage rows (on-demand trace, internal practice panel only; never an Edge consequence)                    |
| Governance events      | Filters of the above by date and state: scheduled Reviews, decisions due, pending approvals                |

### 10.5 Two consumers, one function

`public.impact_trace(p_element_id uuid, p_mode text default 'on_demand')` is `security invoker`, so RLS applies to every row it reads, as with the existing traces.

- **`on_demand`:** "What would be affected if this changed?" Includes weak links, labeled "may bear on". Also answers the hypothetical question (reconciliation §31): the same trace, started from an element the user names, with no change recorded.
- **`edge`:** Yes links only. Used by `change_reaches` inside `edge_items`, starting from each substantive revision (and each invalidation) that is not yet resolved or judged.

`change_reaches` is the consequence type for these results: "X was revised; Y is reached through R and may warrant examination". It is resolved for a reached record when that record has its own substantive revision or approval after the trigger, or when a judgment is recorded.

### 10.6 The existing traces

`impact_trace` is the **authoritative impact semantics** for Phase 7A (OD-8). `intelligence_impact` and `implementation_impact` stay in place, unchanged, for backward compatibility only. Once `impact_trace` exists, no UI surface calls them; the element page's Impact trace panel switches to `impact_trace` in `on_demand` mode. They are documented as **legacy internal read paths** in `docs/database/edge.md` and in their SQL comments, and they are not an alternative definition of impact. A Vitest check fails if application code calls them. Removal, or conversion to wrappers, is a later cleanup with its own ADR.

---

## 11. Review examined-version capture (Q29)

### 11.1 What is captured

When `hold_review` holds a Review, it records, for every element the Review `examines` at that moment (unretired `examines` relationships), the element's latest published version. From then on the Review's examined set is **closed** (§11.4). A held Review is one closed governance event: an exact examined set, exact examined versions, and an immutable capture. It is not a baseline and does not become a second baseline system.

Proposed table `public.review_examined_versions`:

| Column               | Type                                | Notes                                                                                              |
| -------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `review_element_id`  | uuid                                | The Review; composite same-engagement FK                                                           |
| `element_id`         | uuid                                | The examined element; composite same-engagement FK                                                 |
| `engagement_id`      | uuid                                |                                                                                                    |
| `element_version_id` | uuid, null                          | The latest published version at hold. Null means the element had no published version, and says so |
| `captured_at`        | timestamptz                         | `clock_timestamp()` at hold: **system time**, independent of the user-entered `held_at`            |
| Primary key          | (`review_element_id`, `element_id`) |                                                                                                    |

### 11.2 Properties Kerrick required

| Requirement                                    | How                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produced by the governed hold-review operation | Written only inside `hold_review`. A guard trigger refuses inserts outside the operation's context marker, as `validation_criteria` does for `record_review_validation` |
| Immutable after the Review is held             | Guard triggers refuse update and delete; there is no operation to change it                                                                                             |
| Version-exact                                  | Stores `element_version_id`, never a timestamp comparison                                                                                                               |
| Supports exact "change since Review"           | `examined_element_revised_since_review` and `evidence_after_review` compare against it (§5.2 #17, #18)                                                                  |
| Examined set closed at hold (OD-7)             | New `examines` from a held Review are refused, and existing ones cannot be retired (§11.4)                                                                              |
| Distinct from an Architecture Baseline         | Separate table. No baseline is created, required or implied. A Review may still reference a baseline for its own purposes; the capture does not change that             |

### 11.3 Behavior and edge cases

- `hold_review` keeps its signature and all its existing checks. The capture is an added step inside the same transaction.
- **Examined elements with no published version** are captured with a null version. Any later publication then counts as change since the Review.
- **`examines` added after the Review is held** is refused from 7A onward (OD-7, §11.4). Additional formal examination uses a later Review.
- **Reviews held before 7A** have no capture and are **not backfilled** (OD-6). Exact history is never inferred from the user-entered `held_at`. A historical Review with a frozen baseline gets version-exact change through the baseline; one without says "This Review predates exact examined-version capture". Their existing `examines` relationships, including any added after the hold, are preserved, and their past state is not mutated.
- **Cancelled Reviews** are never held, so never captured. OD-7 closes the set only for held Reviews; a cancelled Review's `examines` are unchanged by 7A.
- Captures are internal: no client policy, no client read model.

### 11.4 The examined set closes at hold (OD-7)

**Rule.** Once a Review's status is `held`:

- inserting an `examines` relationship with that Review as source is refused (23514, "The examined set closed when this Review was held. Use a later Review for further examination.");
- retiring one of its existing `examines` relationships is refused with the same reason, because retirement would also change the examined set (see §29.3);
- existing relationships are preserved, and captures are never changed.

**Where it is enforced.** A guard trigger on `architecture_relationships` (before insert, and before an update that sets `retired_at`) for `relationship_type = 'examines'` checks the source Review's status. This covers every write path: the relationship operations, direct inserts under RLS (as the pgTAP suites use), and the seed. `hold_review` itself is unchanged apart from the capture, and takes the Review's lock first, so a concurrent insert cannot slip in between the capture and the status change.

**Phase 5 conflict check (Kerrick's condition).** Phase 5 has **no governed correction mechanism** that needs post-hold `examines`:

- ADR-0034, ADR-0035, ADR-0038 and the Phase 5 proposal describe `examines` as "the review's agenda", recorded under `manage_reviews`. None provides for adding to the agenda after the hold.
- `record_review_validation` requires that the held Review already `examines` the initiative or an object it implements. Under OD-7, that means "examined at the hold", which is the stricter and intended reading of "a review cannot validate something it never actually looked at" (Phase 5 proposal §7.5).
- No pgTAP suite adds `examines` after a hold (16, 19, 26 and 99 all add it first).

What does conflict, and must change with 7A:

1. **The seed.** `supabase/seed.sql` holds Harbor's REV-001 and then adds its `examines` to APP-001 and, later, to IMP-002 before validating IMP-002. Both inserts would now be refused. The seed is reordered: IMP-002 is created and published first, both `examines` are added, then REV-001 is held (capturing both), then IMP-002 is validated. The end state is the same.
2. **The Review page.** The agenda section invites adding items from "Connected architecture" at any status. After the hold, those controls are hidden and the page says the agenda closed at hold.
3. **Workflow.** An initiative not on a held Review's agenda can no longer be validated by that Review. A new Review examining it is needed. This is the intended consequence and is written into the ADR-0034 amendment note (§21.2).

Existing production Reviews that gained `examines` after their hold keep them. Nothing is migrated or rewritten.

---

## 12. Substantive revision definition (Q30)

### 12.1 Definition

A published element version _v_n_ (n ≥ 2) is a **substantive revision** if and only if its full internal snapshot differs from the snapshot of _v_n−1_ after removing, from both, the **excluded paths** for the element's kind. Version 1 is a **first publication**, a separate change type, never a revision (§13).

- Comparison is jsonb equality of the two reduced snapshots, computed at read time.
- The `changed_paths` (top-level and `details` keys that differ) are returned for explanation.
- `change_summary` is **never parsed**. It is shown verbatim, labeled as the author's words.

### 12.2 The excluded-path set

Explicit, type-aware, governed by ADR and migration, and mirrored in `src/domain/edge/substantive.ts` with a test that compares it against the migration and against the snapshot builder's keys.

| Kind                        | Excluded paths (status and lifecycle only)                       | Why these are status                                                                                                      |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| All kinds (element)         | `ai_review_state`, `ai_reviewed_by`, `ai_reviewed_at`            | The AI review gate's state, which changes when pending content is accepted                                                |
| All kinds (each statement)  | `statements[].ai_review_state`, `statements[].ai_reviewed_by`    | Same, per statement                                                                                                       |
| `object`                    | `details.maturity`, `details.maturity_rationale`                 | Object maturity is its own governed status and judgment axis (ADR-0020); it never creates a Change event by itself (OD-1) |
| `assumption`                | `details.validation_status`, `details.validation_note`           | Validation status and the note written with it                                                                            |
| `risk`                      | `details.risk_status`                                            | Record status                                                                                                             |
| `constraint`                | `details.constraint_status`                                      | Record status                                                                                                             |
| `dependency`                | `details.dependency_status`                                      | Record status                                                                                                             |
| `decision`                  | `details.decision_status`, `details.deferred_reason`             | Decision status. The outcome (chosen option, note, decider, decided time, source) is content and **stays substantive**    |
| `opportunity`               | `details.opportunity_status`                                     | Record status                                                                                                             |
| `recommendation`            | none                                                             | Has no status field; `priority` is content                                                                                |
| `review`                    | `details.review_status`, `details.held_at`                       | Written by holding or cancelling                                                                                          |
| `deliverable`               | none                                                             | Has no status field in its snapshot                                                                                       |
| `implementation_initiative` | `details.implementation_status`, `details.actual_operational_on` | Written by status publication (F2: the IMP-001 v1 → v2 diff)                                                              |

Everything else is substantive, including title, summary, statements and their evidence, relationships' reflected fields, owners, visibility, dates that describe the design, and every `details` field not listed. The list is deliberately short: it names status, and nothing else is suppressed.

### 12.3 Where it is computed

- `private.substantive_snapshot(p_kind element_kind, p_snapshot jsonb)` is an immutable function that removes the excluded paths for that kind.
- `public.element_revisions(p_engagement_id uuid, p_element_id uuid default null)` is a `security definer` read function (checking `can_read_architecture`) that returns, per published version: element, version id and number, previous version id, `published_at`, `change_type` (`first_publication`, `substantive_revision` or `status_publication`), `changed_paths` and `change_summary`.
- Every Change rule and `change_reaches` read this function. Nothing is stored on `element_versions`, and Phase 3's publication path is unchanged. Changing the definition later is a migration to one function, with its tests.

### 12.4 Test obligations

For every kind: a status-only publication is `status_publication`; a publication changing one non-excluded field is `substantive_revision`; each excluded path is individually proven excluded; and the TypeScript mirror equals the SQL list.

---

## 13. Curated development-change read model

### 13.1 Function

`public.development_changes(p_engagement_id uuid, p_since timestamptz default null, p_until timestamptz default null, p_element_id uuid default null, p_limit integer default 200)`, `security definer`, checking `can_read_architecture`. It reads `activity_log` and the domain tables and returns classified developmental events. Like `architecture_activity`, it **projects** fields; it never returns `metadata_json`, so the restriction on the raw log (reconciliation G2) is respected.

| Column                                                  | Meaning                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| `occurred_at`                                           | System time of the operation                                        |
| `change_type`                                           | The classification below                                            |
| `subject_type`, `subject_id`, `reference_code`, `title` | What changed                                                        |
| `version_id`, `version_no`                              | For publications                                                    |
| `related_type`, `related_id`, `related_reference_code`  | The other end, where there is one                                   |
| `actor_name`                                            | Who performed the operation, as `architecture_activity` shows today |
| `summary`                                               | Short, fixed-vocabulary description; `change_summary` where given   |

### 13.2 Classification (Phases 3–6)

| Change type                                                 | Source                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| First publication, substantive revision, status publication | `element_versions` with §12                                                        |
| Retired, superseded                                         | Element lifecycle operations                                                       |
| Relationship added, retired                                 | `architecture_relationships`                                                       |
| Evidence linked (with stance)                               | Statement and element evidence links                                               |
| Approval requested, recorded                                | `architecture_approvals`                                                           |
| Baseline frozen                                             | `architecture_baselines`                                                           |
| Record status changed (with rationale)                      | `intelligence_status_changes`                                                      |
| Escalation opened, resolved                                 | `intelligence_escalations`                                                         |
| Decision decided, deferred                                  | `decisions`                                                                        |
| Client action answered, contribution received               | `client_action_events`, `client_contributions`                                     |
| Review scheduled, held, cancelled                           | `reviews` (held uses capture time, not `held_at`)                                  |
| Validation recorded                                         | `validates` + `validation_criteria`                                                |
| Implementation status changed (with rationale)              | `implementation_status_changes`                                                    |
| Checkpoint achieved                                         | `implementation_checkpoints`                                                       |
| Criterion proposed, agreed, superseded, withdrawn           | `acceptance_criteria`; agreement at `agreed_recorded_at` (OD-2), never `agreed_on` |
| Method Application started, closed, addendum recorded       | Phase 6 tables (internal)                                                          |

### 13.3 Excluded as noise or out of scope

Working-copy saves, stewardship date and attention edits, dismissals and Edge judgments (they are about intelligence, not the development), membership and capability changes, and all Phase 2 commercial events (ADR-0023 keeps commercial one-way from architecture).

`architecture_activity` is not changed. Element Activity panels keep using it in 7A.

---

## 14. Since You Were Away

### 14.1 The watermark

Proposed table `public.edge_briefing_marks`:

| Column            | Type                         | Notes                                                  |
| ----------------- | ---------------------------- | ------------------------------------------------------ |
| `user_id`         | uuid                         | `auth.uid()` only                                      |
| `engagement_id`   | uuid                         |                                                        |
| `briefed_through` | timestamptz                  | The system time the user says they are briefed through |
| `updated_at`      | timestamptz                  |                                                        |
| Primary key       | (`user_id`, `engagement_id`) |                                                        |

- **User-private.** RLS allows a user to read and write only their own rows. There is no policy for System Administrators, Principal Architects or anyone else. No read model, function or report exposes another user's mark.
- **Not audited into `activity_log`.** An audit row would make the mark readable by the roles that can read the log, which would be view tracking by another route. The table is deliberately left out of the activity triggers, and a pgTAP test proves no log row is written.
- **Set only by an explicit act.** One operation, `mark_briefed_through(p_engagement_id, p_through timestamptz)`. The UI's button "Mark reviewed through [time]" passes the time of the newest change the briefing showed, not "now", so nothing that arrived while reading is skipped. The user may also move the mark back to re-read. Opening a page never sets it.
- Requires `can_read_architecture` on the engagement.

### 14.2 The briefing

At the top of the Engagement Edge:

1. **What changed:** `development_changes` since the mark, grouped by trigger (§7), ordered by the same facts as the Edge (§9). Status publications are listed under their subject, after substantive changes.
2. **What is new on the Edge:** events whose `trigger_at` is after the mark (Q7: "new" is derived from basis timestamps, not from stored first-observed times). `state` and `date` items have no trigger time; they appear in the Edge, not in "new".
3. **No mark yet:** the briefing covers the prior 14 days and says so on the page ("Showing the last 14 days. Mark reviewed to set your own starting point.") (OD-10). The window is never inferred from sign-in history, page views or how long the user has been on the engagement.

The briefing is a document, not a feed: no unread counts, badges, dots or per-item "seen" state.

### 14.3 What is never recorded

Page views, time on page, last visit, last sign-in use, which items a user opened, and anything readable by a manager about who looked at what (Q7, reconciliation §14.5).

---

## 15. Intelligence judgment lifecycle

### 15.1 Judgment kinds

| Kind            | Meaning                                                                                                                                      | Effect on the item                                                                   | Extra fields                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| `investigating` | "I am examining this"                                                                                                                        | Stays listed, marked "Being examined by [name] since [date]"                         | Optional note                  |
| `not_material`  | "This does not need action", with a reason                                                                                                   | Leaves the list until its fingerprint changes                                        | Reason required                |
| `deferred`      | "Not now"                                                                                                                                    | Leaves the list until `expires_on` (business date) or a fingerprint change           | Reason and future `expires_on` |
| `disagree`      | "The rule is wrong for this case": rule feedback, not a claim that the fact is false                                                         | Leaves the list until its fingerprint changes; retained as internal rule-tuning data | Reason required                |
| `promoted`      | A person completed a governed operation prompted by the item (created a Risk, recorded a Decision, scheduled a Review, proposed a criterion) | Leaves the list until its fingerprint changes; the item links to the record          | The created element's id       |

The latest judgment for a (rule, subject, fingerprint) is the current one. A correction is a new judgment. Nothing is edited or deleted.

### 15.2 Storage

Proposed table `public.edge_judgments`, append-only:

| Column                                                                               | Notes                                                             |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `id`, `engagement_id`                                                                |                                                                   |
| `rule_key`                                                                           | Text, checked against the catalog                                 |
| `element_id`, `client_action_id`, `method_application_id`, `acceptance_criterion_id` | Exactly one non-null (the subject); composite same-engagement FKs |
| `fingerprint`                                                                        | ≤ 1000 characters                                                 |
| `trigger_key`                                                                        | So an event-level judgment can be read back as one act            |
| `judgment_kind`                                                                      | Text with a check constraint (§5.1: no enum)                      |
| `reason`, `expires_on`, `promoted_element_id`                                        | As required by the kind                                           |
| `judged_by`, `judged_at`                                                             | `auth.uid()`, `clock_timestamp()`                                 |

Guard triggers refuse update and delete. The table is recorded in `activity_log` like the existing dismissals, because a judgment is professional record-keeping, attributed by design (Q4).

### 15.3 Operations and capability

- `record_edge_judgment(p_engagement_id, p_rule_key, p_subject_type, p_subject_id, p_fingerprint, p_kind, p_reason, p_expires_on, p_promoted_element_id)`.
- `record_edge_event_judgment(p_engagement_id, p_trigger_key, p_kind, p_reason, p_expires_on)` records one judgment per item currently in the event, in one transaction, and returns how many.
- Both require **`edit_architecture`**, the capability both existing dismissal operations already require. The operation re-evaluates the item and refuses a fingerprint that no longer matches the current facts (23514), so a stale screen cannot judge a changed item.
- **Promote** never creates anything itself. The UI opens the existing creation or governance operation, pre-filled from the item, and that operation checks its own capability. Only after the governed record exists does the UI record `promoted` with its id. The record's provenance follows Q18: `architect_judgment` by default, because the rule prompted and the architect judged.

### 15.4 The 11 existing rules

`not_material` and `deferred` on the existing rules continue to go through `dismiss_signal` and `dismiss_implementation_signal` into the existing tables, so the Signals page and the Edge agree without a migration of data. `investigating`, `disagree` and `promoted` on the existing rules go to `edge_judgments`. The envelope reads both (OD-9).

### 15.5 What judgments are not

Never a count per person, never a rate per person, never a comparison between people, never shown on a profile. No read model aggregates judgments by `judged_by`. Disagreement data is kept for rule tuning, but D-44 (analysis of it) is not built in 7A.

---

## 16. Contextual Edge surfaces

Each panel reads `edge_items` filtered to the object as subject, trigger or basis, and groups with `groupEdgeItems`. Ambient items appear here and nowhere else.

| Surface                   | Panel name                          | Contents                                                                                                                               | Replaces or extends                                 |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Architecture element      | "Bearing on this element"           | Existing open records, then Edge events where the element is subject, trigger or reached; the D-38 fact ("serves 3 outcomes")          | Extends the existing Bearing panel                  |
| Architecture element      | "Impact trace"                      | `impact_trace` in `on_demand` mode, grouped by category, hubs collapsed, weak links labeled                                            | Replaces the existing trace's data source           |
| Implementation Initiative | "Correspondence"                    | Rules 9–15 for this initiative, criteria in force, and revision events reaching it                                                     | New panel                                           |
| Review                    | "Since this Review was held"        | The capture with each element's current version, rules 17–18, escalations touching examined elements, decisions due, pending approvals | New panel (scheduled Reviews: "Before this Review") |
| Deliverable               | "Currency"                          | Rule 20 against the baseline or latest approval                                                                                        | New panel                                           |
| Decision                  | "Reflected in architecture?"        | Rule 19, per affected element                                                                                                          | New panel                                           |
| Evidence                  | "This evidence bears on"            | Statements (with stance), elements, initiatives, criteria agreements and applications citing it; Edge items it triggers                | New panel on the evidence page                      |
| Method Application        | "Practice conditions"               | Rules 22, 30, 31 (internal)                                                                                                            | New panel                                           |
| Domain page               | "Revised since the latest judgment" | Count of substantive revisions in the domain after the latest domain assessment. Ambient; judgment is never computed (ADR-0019)        | New line                                            |

---

## 17. Practice Intelligence boundary

### 17.1 In 7A

1. **Per-application conditions inside the engagement:** `method_basis_superseded`, `application_outputs_absent`, `application_instrument_evidence_absent`. Internal, engagement-scoped, like every other rule.
2. **Counts on the Method Asset page** (the deferred D-43, and reconciliation §21):
   - stage treatments (`followed`, `adapted`, `skipped`) per stage of each version, across closed applications;
   - Methods applied together within the same engagement (co-use), per version pair;
   - Standards informing agreed criteria, per Standard version.

   Each is a count with its n. The denominator n is always shown. A proportion is shown only when n ≥ 5 closed applications of the version (OD-5). Below that the page says "Fewer than 5 closed applications (n = 3); no proportion is shown". The threshold is a product and governance threshold for avoiding meaningless small-sample proportions, not a statistical-validity claim, and the page never describes any n as significant. No engagement names, client names or free text are shown.

3. Readable by users who can read the Method Library, through a `security definer` function `method_practice_counts(p_asset_id)`.

### 17.2 Not in 7A

Summaries of stage-note or addendum free text, outcome attribution to Methods, any Method score or rank, recommendations to change a Method, automatic Method changes, cross-engagement architecture comparison, and D-44 rule-tuning analytics. Method revision stays the Phase 6 authoring flow with learning sources.

---

## 18. Client boundary

- **Nothing new reaches a client.** No client read model, client page, client policy or client-callable function changes.
- Every new function checks `private.can_read_architecture`, which requires internal membership. Every new table has internal-only policies or none.
- Client-side content that a client could already read (a published statement, a client action) can be _reached_ by an internal item. The item itself is never shown to the client.
- Tests (§24) assert that a client user calling each new function gets nothing (P0002 or an empty set) and cannot read any new table.
- Anything a client should know is still authored by TPLCo through existing governed channels (Q2, Q12).

---

## 19. Security and RLS

| Object                                                   | Access                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `edge_items`, `element_revisions`, `development_changes` | `security definer`, `search_path = ''`, first check `can_read_architecture(engagement)`; one engagement per call        |
| `impact_trace`                                           | `security invoker`: RLS applies to every row read                                                                       |
| `relationship_impact_rules`                              | Select for internal users; writes only by migration                                                                     |
| `architecture_relationships` (`examines`)                | Guard trigger: no insert and no retirement of `examines` from a held Review (OD-7, §11.4)                               |
| `acceptance_criteria.agreed_recorded_at`                 | Written only by `agree_acceptance_criterion` and the backfill; frozen with the other agreement fields                   |
| `review_examined_versions`                               | Select where `can_read_architecture`; insert only inside `hold_review`; no update or delete                             |
| `edge_judgments`                                         | Select where `can_read_architecture`; insert only through the two operations (`edit_architecture`); no update or delete |
| `edge_briefing_marks`                                    | Select, insert and update only where `user_id = auth.uid()`; nothing else; not logged                                   |
| `method_practice_counts`                                 | Method Library readers; counts only; minimum n enforced in SQL, not only in UI                                          |

Other obligations:

- **Engagement isolation:** composite same-engagement foreign keys on every new table; no function joins engagements; the landing page calls the Edge once per engagement the user can read.
- **Method/IP:** practice rules and counts stay internal (ADR-0022, ADR-0043, D32).
- **No new log surface:** no new table stores content; `basis` and details hold references and fixed-vocabulary facts.
- **No service-role reads** in application code for any Edge surface.
- **Operation discipline:** the new operations use the existing `begin_architecture_operation` pattern and error codes (42501 capability, 23514 rule, P0002 visibility).

---

## 20. Performance considerations

- **Scale:** engagements are small graphs (the seed has 37 and 7 elements). Rules are set-based SQL per engagement.
- **Substantive diff:** one jsonb equality per consecutive version pair, after removing a few keys. `element_versions` is already indexed by element and version number. This is computed at read time; if measurement shows it is slow, the fix is a deterministic, recomputable cache keyed by version (inputs are immutable), not a stored conclusion.
- **Impact:** recursion is capped at depth 2 on four link types. The `edge` mode starts only from unresolved, unjudged revisions.
- **Landing page:** calls one engagement at a time. If many engagements make it slow, the fallback is to compute on demand per engagement row, not to cache across engagements.
- **Targets to verify during implementation** (not promises): `edge_items` under 300 ms on the seed; under 1.5 s on a synthetic engagement of 2,000 elements, 6,000 relationships and 10 versions per element, generated in a rolled-back test fixture. `impact_trace` under 200 ms on the same fixture.
- **No materialized views, background jobs or cross-request caches in 7A** (reconciliation §17 principle 5).

---

## 21. ADR changes and amendments required

### 21.1 New ADRs (proposed numbers)

| ADR      | Title                                                    | Decides                                                                                                                                                       |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-0051 | The Development Edge envelope and rule catalog           | Computed items; one envelope; epistemic statuses; catalog attributes; mirrored catalog; homes; existing signals consumed unchanged; no enums                  |
| ADR-0052 | One triggering change, one primary Edge event            | Trigger keys; grouping rules; coalescing revisions; subject grouping for standing conditions; grouping is presentation, never stored                          |
| ADR-0053 | Substantive revision                                     | The definition; the type-aware excluded-path list; read-time computation; `change_summary` never parsed; first publication is not a revision                  |
| ADR-0054 | Review examined-version capture                          | Captured by `hold_review`; immutable; version-exact; the examined set closes at hold; not a baseline or second baseline system; no backfill                   |
| ADR-0055 | Relationship impact matrix and impact trace              | The governed matrix; four recursive walks at depth ≤ 2; terminal hops; never-traversed links; two modes; `impact_trace` authoritative; old traces legacy only |
| ADR-0056 | Edge judgments                                           | Kinds; append-only; fingerprint and return; `edit_architecture`; event-level judgment; promotion only through governed operations; no per-person aggregation  |
| ADR-0057 | Development change read model and the briefing watermark | Curated classification over `activity_log` without exposing it; system time; user-private, unlogged watermark set only explicitly                             |
| ADR-0058 | Deterministic-first ordering and Edge tiers              | Tiers; human-only top tier and its name; lexicographic keys; explanations; 14-day horizon constant; nothing scored                                            |
| ADR-0059 | Practice Intelligence in Phase 7A                        | In-engagement practice rules; counts with n always shown; proportions from n ≥ 5, not a significance claim; no free text; no scoring                          |

### 21.2 Amendment notes on existing ADRs

| ADR      | Amendment                                                                                                                                                                                                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-0032 | (Q16) "Computed; only judgments stored" is generalized to all deterministic intelligence. The sentence on future AI findings is reconciled: `ai_analysis` with the review gate governs AI-drafted content entering architecture; AI observations are a separate, non-architecture artifact (7B); ephemeral assistance is not stored (Q3) |
| ADR-0034 | (OD-7) A Review's agenda (`examines`) closes when the Review is held. New `examines` from a held Review are refused and existing ones cannot be retired; further formal examination uses a later Review. The validation gate (ADR-0035) therefore means "examined at the hold"                                                           |
| ADR-0046 | (OD-2) `agreed_on` stays the business (effective) date entered by the user. `agreed_recorded_at` is the system time of the governed agreement operation, used by Change intelligence. The two are never conflated                                                                                                                        |
| ADR-0039 | The implementation namespace stays separate for governed records and dismissals. Edge judgments and the envelope read across namespaces without writing either, which is consistent with ADR-0039's separation of storage                                                                                                                |

No ADR is superseded. ADR-0009 (provenance), ADR-0019 (judgment never computed), ADR-0020 (status axes) and ADR-0036 (validation gate) are relied on, not changed.

### 21.3 Documentation that changes with 7A

- `CLAUDE.md` "Current Build Phase" (it still says Phase 7 is on hold): updated in the first implementation commit, once Kerrick says to begin.
- `docs/database/reviews-deliverables-implementation.md`: the closed examined set.
- `docs/database/edge.md` (new), and links from `docs/database/schema.md`.
- `README.md` phase line at the end of 7A.

---

## 22. Migration and schema proposal

All names are proposed. Timestamps continue the existing sequence. No Phase 1–6 table loses or changes a column, and no existing function changes signature. Two Phase 1–6 behaviors change deliberately: `examines` is refused after a hold (OD-7), and agreement records its system time (OD-2).

| #   | Migration (proposed)                          | Contents                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20261006000000_phase7a_edge_catalog.sql`     | `private.edge_rules()` (42 catalog rows); `public.edge_rule_catalog()` read for the UI and mirror tests; `public.relationship_impact_rules` table and seed rows (39 types × 2 directions, plus off-spine link keys); RLS                                                                                        |
| 2   | `20261006000100_substantive_revisions.sql`    | `private.substantive_snapshot(kind, snapshot)` with the excluded-path list; `public.element_revisions(...)`                                                                                                                                                                                                     |
| 3   | `20261006000200_review_examined_versions.sql` | `review_examined_versions` table, guards, RLS; `hold_review` redefined with the capture step (same signature and checks); guard trigger closing the examined set of held Reviews (OD-7)                                                                                                                         |
| 4   | `20261006000300_development_changes.sql`      | `public.development_changes(...)`                                                                                                                                                                                                                                                                               |
| 5   | `20261006000400_impact_trace.sql`             | `public.impact_trace(element, mode)`                                                                                                                                                                                                                                                                            |
| 6   | `20261006000500_edge_rules.sql`               | Private rule functions, one per lens (`private.edge_rules_integrity(...)` and so on), implementing the 31 rules and `change_reaches`                                                                                                                                                                            |
| 7   | `20261006000600_edge_items.sql`               | `public.edge_items(...)`: composition, tiering, order facts, judgment join                                                                                                                                                                                                                                      |
| 8   | `20261006000700_edge_judgments.sql`           | `edge_judgments` table, guards, RLS, activity registration; `record_edge_judgment`, `record_edge_event_judgment`                                                                                                                                                                                                |
| 9   | `20261006000800_edge_briefing_marks.sql`      | `edge_briefing_marks` table, RLS (own rows only), no activity trigger; `mark_briefed_through`                                                                                                                                                                                                                   |
| 10  | `20261006000900_practice_counts.sql`          | `public.method_practice_counts(asset)` with minimum n                                                                                                                                                                                                                                                           |
| 11  | `20261006001000_criterion_agreement_time.sql` | Adds `acceptance_criteria.agreed_recorded_at timestamptz`, set to `clock_timestamp()` inside `agree_acceptance_criterion` and frozen with the other agreement fields; backfilled for agreed criteria from the authoritative agreement row in `activity_log`, left null where none exists; `agreed_on` unchanged |

**Not created:** no enum type or value; no table for conditions, events, items, first-observed times, scores, AI, prompts, providers, embeddings, data-use settings, Patterns or notifications; no column on `element_versions`, `architecture_relationships`, `reviews` or any signal table; no change to any client read model. The only new column on an existing table is `acceptance_criteria.agreed_recorded_at`.

**Seed:** `supabase/seed.sql` is reordered so REV-001's `examines` precede its hold (§11.4), and gains the scenario data in §25 through real operations.

---

## 23. UX implications

1. **New route and navigation.** "Edge" joins the engagement's internal navigation beside Architecture, Intelligence, Reviews and Implementation.
2. **Calm defaults.** Only Attention and above are listed. Ambient stays in panels. Nothing animates, counts up or blinks. No badges or unread numbers anywhere.
3. **One event per trigger.** The list's unit is the event, never the rule. Consequences are indented under their trigger.
4. **Labels, not colors, carry meaning.** Lens and epistemic status are words. The human-flagged tier is set apart by position and a rule line, not red.
5. **Explanations are always visible,** not hidden behind hover: "Why this is here" and "What would resolve it" are part of each event.
6. **Judgment is quiet.** A small action row; a reason field where required; the judged view is one click away and shows who judged what, when and why.
7. **Promote opens the real form.** Pre-filled, clearly labeled "prompted by this Edge item", never submitted automatically.
8. **Change summaries are quoted,** in the author's words, labeled.
9. **The Signals page keeps working** with a line pointing to the Edge.
10. **The Review page closes its agenda at hold.** Controls to add agenda items are hidden once the Review is held, and the agenda reads "Closed when this Review was held on [date]. Use a later Review for further examination."
11. **The landing page lists engagements alphabetically,** never ordered by how much they have, and shows no totals across engagements.
12. **Accessibility:** events are a list with headings; actions are buttons with text; the ordering explanation is text.
13. **Manual browser acceptance** before merge (Kerrick's standing requirement since Phase 5), walking the scenarios in §25 as a Principal Architect, a Researcher, a user without `edit_architecture`, and a client.

Copy for every rule (definition, why, heading templates, resolving act label) is part of the TypeScript catalog and is reviewed with Kerrick during implementation.

---

## 24. Testing strategy

### 24.1 Database (pgTAP)

| File (proposed)                        | Covers                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `29_edge_catalog.test.sql`             | 42 catalog rows; keys match the signal functions' keys; matrix covers all 39 types in both directions; `never` links never traversed                                                                                                                                                                             |
| `30_substantive_revisions.test.sql`    | Per kind: status-only → `status_publication`; one content field → `substantive_revision`; each excluded path proven excluded; v1 → `first_publication`; `change_summary` has no effect                                                                                                                           |
| `31_review_examined_versions.test.sql` | Capture on hold; null for unpublished; system time independent of `held_at`; guards refuse insert outside `hold_review`, update and delete; `examines` insert and retirement refused on a held Review and allowed on a scheduled one; existing relationships preserved; `hold_review`'s existing tests unchanged |
| `32_impact_trace.test.sql`             | Each recursive walk's direction and depth cap; terminal hops; weak links only on demand; RSK-001 and CAP-005 now reached from CAP-001; REV-001, DLV-001, criteria and MUS-001 (open only) from APP-001 (F6 regressions)                                                                                          |
| `33_edge_rules.test.sql`               | Each of the 31 rules: one positive and one negative fixture; the F1 regression (backdated `held_at` and `agreed_on` produce nothing); the F2 regression (IMP-001's status publication produces nothing)                                                                                                          |
| `34_edge_items.test.sql`               | Envelope fields present for every rule; exactly one epistemic status; tiers; `human_flagged` only from human-set state; order facts; existing signals unchanged through the envelope                                                                                                                             |
| `35_edge_judgments.test.sql`           | Each kind; fingerprint return; expiry; stale fingerprint refused; event-level judgment; append-only; capability; existing dismissals still honored                                                                                                                                                               |
| `36_edge_briefing_marks.test.sql`      | Own row only; a System Administrator and a Principal Architect cannot read another user's mark; no `activity_log` row; explicit operation only                                                                                                                                                                   |
| `37_development_changes.test.sql`      | Classification of each change type; noise excluded; commercial excluded; no `metadata_json` returned; system time used                                                                                                                                                                                           |
| `38_edge_client_boundary.test.sql`     | A client gets nothing from every new function and table                                                                                                                                                                                                                                                          |
| `40_criterion_agreement_time.test.sql` | `agreed_recorded_at` set by the agree operation in system time; `agreed_on` untouched; frozen after agreement; backfill from `activity_log`; null without a log row, and no `criteria_predate_revision` item then                                                                                                |
| `39_practice_counts.test.sql`          | Counts; minimum n; no engagement or free text in output; readers only                                                                                                                                                                                                                                            |
| `99_edge_concurrency.test.sql`         | Concurrent judgments on one item; hold versus publish race (capture is consistent with the lock order)                                                                                                                                                                                                           |

### 24.2 Application (Vitest)

| Suite                        | Covers                                                                                                                                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `edge/rules.test.ts`         | TypeScript catalog equals the migration's catalog; every rule has definition, why, resolving act, fingerprint description; no forbidden words in copy ("score", "health", "error"; "critical" only in the human tier label) |
| `edge/impact-matrix.test.ts` | Mirror of the matrix; every vocabulary relationship type covered; recursion only on the four walks                                                                                                                          |
| `edge/substantive.test.ts`   | Mirror of the excluded paths; every path exists in the snapshot builder's output for its kind                                                                                                                               |
| `edge/grouping.test.ts`      | The §7.3 rules, including the APP-001 example, coalescing, merging and hub collapse                                                                                                                                         |
| `edge/ordering.test.ts`      | Lexicographic order, tie-breaks and the explanation strings                                                                                                                                                                 |
| `edge/legacy-impact.test.ts` | No application code calls `intelligence_impact` or `implementation_impact` (OD-8)                                                                                                                                           |
| `edge/briefing.test.ts`      | Default window; "new" from trigger time; the mark passed is the newest shown change                                                                                                                                         |

### 24.3 Before any push

`pnpm check`, `pnpm test`, `pnpm build` and `pnpm db:test` locally, as CI runs them. Then the manual browser acceptance pass (§23 item 13).

---

## 25. Seed and acceptance scenarios

### 25.1 Seed additions

First, the one required reordering (§11.4): Harbor's IMP-002 is created and published, REV-001's `examines` of APP-001 and IMP-002 are added, and only then is REV-001 held and IMP-002 validated. The resulting data is the same, and REV-001 now carries a capture.

Then, appended through real operations only, so the demo shows the Edge working:

1. **Harbor:** a substantive revision of APP-001 (summary and a statement changed) published after REV-001 was held, IMP-001 and IMP-003 implement it, and DLV-001 was baselined.
2. **Harbor:** a substantive revision of KNW-001 after IMP-002 was validated.
3. **Harbor:** a new scheduled Review, REV-002, examining APP-001 and IMP-001, within the Elevated horizon.
4. **Meridian:** a substantive revision of CAP-004, which CAP-001 `requires`.
5. **Meridian:** ASM-001 given attention `high` (shows the D-35 merge).
6. **Meridian:** one decision decided after the latest version of an element it affects.

Existing seed facts already exercise many rules: IMP-001 operational and not validated; IMP-001 and IMP-002 without evidence; APP-003 in conflict with APP-004; STR-001 unmeasured; CAP-002 serving no outcome; Harbor MUS-001's absent outputs and evidence; Meridian's DAM release; the existing signals.

### 25.2 Acceptance scenarios

| #   | Scenario                                                        | Expected                                                                                                                                         |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | IMP-001's operational status publication (its v2)               | `status_publication`. No Change item. ACR-001 and ACR-002 produce no `criteria_predate_revision` (F2 regression)                                 |
| S2  | REV-001 held with a backdated `held_at`                         | Capture uses system time. No `examined_element_revised_since_review` item before any real revision (F1 regression)                               |
| S3  | APP-001 revised substantively (seed 1)                          | **One** event "APP-001 was revised", consequences IMP-001, IMP-003, ACR-001, ACR-002 (via IMP-001), REV-001, DLV-001. Closed MUS-001 not reached |
| S4  | KNW-001 revised after IMP-002 validated (seed 2)                | One event with `validated_element_revised` on IMP-002                                                                                            |
| S5  | REV-002 scheduled within 14 days examining APP-001              | The S3 event and IMP-001's conditions are Elevated, with "REV-002 examines this on [date]"                                                       |
| S6  | CAP-004 revised (seed 4)                                        | One event; CAP-001 reached through `requires` (upward); nothing reached through `serves` recursively                                             |
| S7  | Judge the S3 event Not material                                 | All its items leave the list; the judged view shows one act with its reason. A second substantive revision of APP-001 brings them back           |
| S8  | Mark reviewed through the newest change                         | The briefing is empty until a new change; another user's briefing is unaffected; no `activity_log` row                                           |
| S9  | ASM-001 attention set to `critical` by a person                 | Its item moves to the human-flagged tier with that reason. No rule can do the same                                                               |
| S10 | A client user of Harbor                                         | Sees no Edge, no item, no new panel; portal unchanged                                                                                            |
| S11 | A Researcher without `edit_architecture`                        | Sees the Edge and panels; has no judgment actions                                                                                                |
| S12 | Method Asset page for Capability Readiness Diagnostic 1.1       | Stage treatment counts with "n = 1"; no proportion; no engagement or client name                                                                 |
| S13 | Promote `materialized_risk_still_threatens` into a new Decision | The Decision form opens pre-filled; nothing is created until submitted; afterward the item shows "Promoted to DEC-00x" and leaves the list       |
| S14 | `impact_trace(CAP-001, 'on_demand')`                            | Includes RSK-001 (`threatens`) and CAP-005 (`gap_in`), which the old trace missed (F6)                                                           |
| S15 | Add an `examines` to held REV-001, then try to retire one       | Both refused with the closed-agenda reason; REV-001's relationships and capture unchanged; a new scheduled Review can examine the element        |
| S16 | Agree a criterion                                               | `agreed_recorded_at` is the operation's system time; `agreed_on` is what the user entered; the seeded ACR-001 and ACR-002 are backfilled         |

---

## 26. Backward compatibility with Phase 4/5 Signals

| Existing                                                           | After 7A                                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `intelligence_signals`, `implementation_signals`                   | Unchanged: same rules, thresholds, scope, output shape and dismissal behavior. Read by the Edge through the envelope |
| `dismiss_signal`, `dismiss_implementation_signal` and their tables | Unchanged; still used for Not material and Defer on the 11 rules (OD-9)                                              |
| Signals page                                                       | Unchanged behavior, plus a link to the Edge                                                                          |
| `intelligence_impact`, `implementation_impact`                     | Unchanged; no longer used by the UI (OD-8)                                                                           |
| `architecture_activity`                                            | Unchanged                                                                                                            |
| `hold_review`                                                      | Same signature, checks and effects, plus the capture                                                                 |
| `examines` on a held Review                                        | **Changed (OD-7):** new ones and retirements refused; existing ones kept. The seed is reordered (§11.4)              |
| `acceptance_criteria`                                              | **Changed (OD-2):** one added column, set by the agree operation and backfilled; `agreed_on` unchanged               |
| `intelligence_impact`, `implementation_impact` callers             | Legacy internal read paths only (OD-8)                                                                               |
| `element_versions`, snapshots, publication                         | Unchanged                                                                                                            |
| Client read models and portal                                      | Unchanged                                                                                                            |
| ADR-0039 namespaces                                                | Respected: no implementation record is written by intelligence operations or vice versa                              |

The 11 existing rules keep their current scope, including draft Project Intelligence where a rule already includes it, such as `opportunity_window_closed` (F4). OD-3 keeps this deliberately, and the catalog states each rule's scope so it stays intentional.

---

## 27. Explicit exclusions for 7B

7A builds **none** of the following. They are 7B (or later) and each needs its own approval:

- persisted AI inference and its provenance fields (reconciliation §18);
- AI explanation of items, AI summaries, AI drafting;
- engagement-scoped conversational access;
- provider abstraction, provider SDKs, prompt governance and prompt versions;
- the two Q19 permitted-use settings and their contract basis;
- the Q20 purpose-limited context assembly;
- human promotion of AI observations;
- the `suggested` epistemic status in use.

What 7A leaves room for, without building it: the envelope's `producer` field (always `rule`); the reserved `suggested` status in the catalog's documented set (never produced); `basis` entries that already carry version ids; judgment kinds that are text with a check constraint, so 7B can add `contest` or `keep` by migration; and subject columns on `edge_judgments` that can gain one more nullable reference. No 7B table, column, function, enum or setting is created.

Later than 7B: cross-engagement architectural recurrence, the Pattern Library, generalized Development Intelligence, certification, Portfolio Intelligence and broad client-facing AI.

---

## 28. Acceptance criteria for Phase 7A

Phase 7A is accepted when all of the following hold on the branch, CI is green ("App" and "Database"), and Kerrick's manual browser pass is complete.

**Rules**

- **AC-1** All 31 new rules and the 11 existing rules appear in both catalogs, which match (Vitest), with every attribute in §5.1.
- **AC-2** Each new rule has a passing positive and negative pgTAP fixture.
- **AC-3** No Change rule compares a business date with system time (F1 regression tests pass).
- **AC-4** No status-only publication triggers a Change rule or `change_reaches` (F2 regression tests pass).
- **AC-5** The existing 11 rules return exactly what they returned before 7A on the seed.
- **AC-6** D-38 produces no item; D-43 produces no Edge item; D-44 is not built.

**Envelope and grouping**

- **AC-7** Every item has lens, one epistemic status, basis (with versions where compared), trigger, resolving act, tier and tier reason.
- **AC-8** No item carries a confidence value or numeric score, and `producer` is always `rule`.
- **AC-9** Scenario S3 shows exactly one event for APP-001's revision, with all its consequences and their bases.
- **AC-10** Grouping follows every rule in §7.3 (Vitest).

**Impact**

- **AC-11** `impact_trace` follows the matrix: four recursive walks, depth ≤ 2, terminal hops, never-traversed links.
- **AC-12** The matrix covers all 39 relationship types in both directions and matches its TypeScript mirror.
- **AC-13** The F6 omissions are reached (S14).

**Review capture and revisions**

- **AC-14** `hold_review` writes one immutable, version-exact capture row per examined element, in system time, and nothing else can write, change or delete one.
- **AC-15** `examined_element_revised_since_review` and `evidence_after_review` use the capture, never `held_at`. The substantive-revision excluded paths match §12.2 exactly, in SQL and TypeScript, and `change_summary` has no effect.

**Since You Were Away**

- **AC-16** The briefing shows changes and new events since the user's own mark.
- **AC-17** No one but the user can read their mark, including System Administrators and Principal Architects.
- **AC-18** Setting a mark writes no `activity_log` row; no page view writes anything.

**Judgment**

- **AC-19** All five judgment kinds work, are append-only and attributed, and return with a changed fingerprint.
- **AC-20** Judging requires `edit_architecture`; a stale fingerprint is refused.
- **AC-21** Promotion creates nothing by itself; the created record is linked from the judgment.

**Surfaces and order**

- **AC-22** Every panel in §16 renders from the envelope, with Ambient items only in panels.
- **AC-23** Ordering is lexicographic and explained, identical across surfaces (Vitest fixtures).
- **AC-24** Only human-set attention or an open escalation places an item in the top tier.

**Boundaries**

- **AC-25** A client gets nothing from any new function, table or page (S10).
- **AC-26** No function reads across engagements.
- **AC-27** No AI, provider SDK, prompt, embedding or vector dependency or table exists (`package.json` and migrations checked).
- **AC-28** No notification, badge, unread count or push exists.
- **AC-29** No read model aggregates judgments or activity by person; no page shows per-person counts.
- **AC-30** No automatic write to any governed record exists; every write is a user-initiated operation.
- **AC-31** Practice counts always show n, show no proportion below 5 closed applications, never describe a threshold as statistically significant, and name no engagement.

**Final decisions**

- **AC-32** A held Review's examined set is closed: new `examines` and retirements are refused on every write path, existing relationships and captures are unchanged, and the seed builds REV-001's agenda before its hold (OD-7).
- **AC-33** `agreed_recorded_at` is set only by the agreement operation in system time and by the one-time backfill; `agreed_on` is unchanged; no Edge read derives agreement time from `activity_log` (OD-2).
- **AC-34** No UI surface calls `intelligence_impact` or `implementation_impact`; both are documented as legacy internal read paths, and `impact_trace` is the only impact semantics the Edge uses (OD-8).

---

## 29. Implementation decisions

### 29.1 Decided by Kerrick (2026-09-30)

| #     | Decision                                                                                                                                                                                                                      | Where applied        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| OD-1  | **Yes.** `maturity` and `maturity_rationale` are excluded from the substantive diff; object maturity is its own governed status and judgment axis                                                                             | §12.2                |
| OD-2  | **Yes.** Add `agreed_recorded_at`, set from system time inside the agreement operation, backfilled from the authoritative `activity_log` row where possible, never derived on Edge reads; `agreed_on` stays the business date | §5.2 #16, §13.2, §22 |
| OD-3  | **Keep** the 11 existing rules' scope, including drafts where a rule already includes them; the catalog makes each scope explicit                                                                                             | §5.3, §26            |
| OD-4  | **14 days**, a documented governed constant, not user-configurable in 7A                                                                                                                                                      | §9.2                 |
| OD-5  | **5 closed applications** before a proportion; n always shown; a governance threshold, not a significance claim                                                                                                               | §17.1                |
| OD-6  | **No backfill** of captures; historical Reviews use their frozen baseline or say they predate exact capture; nothing is inferred from `held_at`                                                                               | §11.3                |
| OD-7  | **Changed:** once a Review is held, new `examines` are refused; existing ones are preserved; a later Review is used for further examination; past captures are never mutated                                                  | §11.4                |
| OD-8  | **Keep temporarily**, unchanged, as legacy internal read paths; the UI stops using them; `impact_trace` is authoritative                                                                                                      | §10.6                |
| OD-9  | **Keep** the existing dismissal tables and operations for the 11 rules; the Edge consumes them; `edge_judgments` only for judgment kinds without an established mechanism                                                     | §15.4                |
| OD-10 | **14 days** before a first mark, stated on the page; never inferred from sign-in, page views or membership                                                                                                                    | §14.2                |

### 29.2 Clarifications carried into the proposal

1. **A held Review is a closed governance event:** exact examined set, exact versions, immutable capture. Not a baseline, and not a second baseline system (§11.1, §11.4).
2. **`impact_trace` is authoritative;** the older functions remain only for backward compatibility (§10.6).
3. **n = 5 is a display and governance threshold,** not a statistical-validity claim (§17.1).
4. **One triggering change, one primary Edge event,** with downstream consequences grouped beneath it (§7).
5. **No 7B implementation:** no AI, provider SDK, embeddings, prompt execution, persisted AI inference, conversational assistant or cross-engagement architectural learning (§2.2, §27).

### 29.3 One consequence of OD-7 stated for confirmation

Kerrick's OD-7 names new `examines` links. This proposal also refuses **retiring** an `examines` from a held Review, because retirement changes the examined set as much as an addition does, and "preserve existing relationships" implies it. If Kerrick prefers retirement to stay possible (for example, to correct a mistaken agenda item after the hold), the guard drops that one check and the capture still records what was examined. This does not block implementation.

### 29.4 Remaining open decisions

None. The proposal is implementation-ready.

---

## 30. Review summary

### 30.1 Proposed migration set

1. `20261006000000_phase7a_edge_catalog.sql`: rule catalog and impact matrix.
2. `20261006000100_substantive_revisions.sql`: excluded paths and `element_revisions`.
3. `20261006000200_review_examined_versions.sql`: capture table, `hold_review` capture step, and the closed examined set (OD-7).
4. `20261006000300_development_changes.sql`: curated change read model.
5. `20261006000400_impact_trace.sql`: governed traversal.
6. `20261006000500_edge_rules.sql`: the 31 rules and `change_reaches`.
7. `20261006000600_edge_items.sql`: the envelope, tiers and order facts.
8. `20261006000700_edge_judgments.sql`: judgments and their operations.
9. `20261006000800_edge_briefing_marks.sql`: the private watermark.
10. `20261006000900_practice_counts.sql`: Method Asset counts with minimum n.
11. `20261006001000_criterion_agreement_time.sql`: `agreed_recorded_at` and its backfill (OD-2).

### 30.2 Proposed ADR set

New: ADR-0051 (envelope and catalog), ADR-0052 (one trigger, one event), ADR-0053 (substantive revision), ADR-0054 (Review examined-version capture), ADR-0055 (impact matrix and trace), ADR-0056 (Edge judgments), ADR-0057 (change read model and watermark), ADR-0058 (ordering and tiers), ADR-0059 (Practice Intelligence in 7A).
Amendment notes: ADR-0032 (Q16), ADR-0034 (the agenda closes at hold, OD-7), ADR-0039 (reading across namespaces), ADR-0046 (agreement business date versus system time, OD-2).

### 30.3 Final 7A acceptance criteria

**34 criteria**, AC-1 to AC-34 in §28, plus green CI and Kerrick's manual browser pass over scenarios S1 to S16.

### 30.4 Readiness

OD-1 to OD-10 are decided (§29.1). No open decision remains; §29.3 states one consequence of OD-7 for confirmation, which does not block work. **The proposal is implementation-ready.** Implementation begins only when Kerrick says so.

### 30.5 Confirmation

**No Phase 7A implementation was performed.** This proposal (Revisions 1 and 2) and the updates to `PHASE_7_CONCEPTUAL_RECONCILIATION.md` recording the Q29 and Q30 decisions are the only changes. No migration, schema, table, function, enum, ADR, domain code, seed data, test, UI, AI service, provider SDK, embedding or vector store was created, and no Phase 1–6 behavior was changed.
