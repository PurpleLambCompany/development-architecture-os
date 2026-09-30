# Phase 5 — Reviews, Deliverables and Implementation: Proposal

**Status:** Proposal only, revised. No migrations or application code have been written for this phase. Do not build until Kerrick gives final approval on §22.

**Governing question:** once Development Architecture has been designed and approved, how does the system govern making that architecture real?

**Conceptual flow:** Architecture → Implementation → Evidence → Review → Architectural Learning.

## Revision note (round 2)

Kerrick reviewed the first draft and approved D1, D3, D4, D6, D7, D10 and D12 as proposed. He amended four decisions, all incorporated below:

- **D2 — amended.** Implementation does **not** share Phase 4's `intelligence_stewardship`, `intelligence_status_changes` or `intelligence_escalations` tables. It gets its own parallel tables, reusing the _pattern_ (attention/triage, append-only field history, two-level escalation) but never the tables themselves. §7.3, §10, §11, §13, §17.
- **D5 — amended.** A new relationship, `validates` (Review → Implementation Initiative), is added and precisely defined, gated behind a dedicated operation rather than free insertion. §4.2, §7.5.
- **D8 — amended.** Each implementation status is now precisely defined; `validated` cannot be reached by a bare status edit — it requires a `validates` relationship from a qualifying review, enforced by the database. §7.2, §7.5.
- **D9 — amended.** Not every milestone becomes a sub-initiative. A new, deliberately lightweight **Implementation Checkpoint** concept covers architecturally meaningful conditions/events inside one initiative; genuinely separable realization efforts still decompose via `part_of`. §7.6.

Four new decisions this introduces are added to §22 as D13–D16.

---

## 1. Principles

1. **Reference, don't duplicate.** Phase 5 introduces governance and realization _structure_ around the architecture; it does not re-describe the architecture. Wherever an existing Phase 3/4 primitive (a core object, a Project Intelligence record, a relationship, evidence, an approval) already represents a fact, Phase 5 points at it instead of copying it.
2. **The element spine keeps doing the work.** ADR-0013's pattern — one spine row, a subtype table, versions, publication, client snapshots, evidence links, statements, relationships, reference codes — is proven across nine kinds already. Phase 5's three new element kinds (Review, Deliverable, Implementation Initiative) reuse it rather than inventing a parallel content model.
3. **Implementation is not a task tracker.** An Implementation Initiative represents the organized effort to make one or more approved architecture elements real — not a checklist, not an assignee queue, not a percent-complete bar. Sequencing and checkpoints exist only where they reflect genuine methodological meaning, never as generic subtasks.
4. **Five distinct states stay distinct** (extends ADR-0020), precisely as Kerrick restated them:
   - **Architecture state** — what has been designed and approved. The element's own lifecycle and approval axis, unchanged.
   - **Implementation state** — whether realization has begun and where it stands. New: `implementation_status`.
   - **Operating state** — whether the designed capability/system/model/application actually exists and functions in reality. A claim an initiative makes about itself (`operational`), never inferred from implementation state alone.
   - **Evidence** — what supports claims about that reality. The existing evidence system, unchanged.
   - **Review/judgment** — whether observed reality sufficiently conforms to architectural intent. New, and it is the _only_ thing that can move an initiative to `validated` — validation is a judgment, never an unsupported status edit.
5. **Project Intelligence stays the intelligence layer.** No Phase 5 table duplicates an assumption, risk, constraint, dependency, decision, recommendation or opportunity. Implementation risks are risks. Implementation decisions are decisions. Phase 5 relates to them; it does not re-invent them.
6. **Implementation's judgment apparatus is real but structurally separate.** Realization work needs triage, history and escalation exactly the way Project Intelligence does — but in Implementation's own tables, never inside Phase 4's. Intelligence about the architecture and governance of realizing it are different concerns and stay in different tables, even though they follow the same proven pattern.
7. **Clients see less than TPLCo, structurally.** Everything a client sees in Reviews, Deliverables and Implementation is a published, client-visible snapshot or an existing approval/action primitive — never a working copy, never internal stewardship, never an internal capability's-worth of detail.
8. **Stable foundations are not renegotiated.** Nothing in this phase changes the element spine, the lifecycle/approval/maturity/record-status separation, the publication boundary, the relationship-vocabulary enforcement model, capability-based authorization, RLS as the security authority, or any Phase 1–4 table's meaning. Extensions are additive.

---

## 2. Scope

### 2.1 Proposed for Phase 5

- **Reviews.** A `review` element kind representing a convened session (Executive Review or Architecture Review): participants, an agenda of existing elements and Project Intelligence records, findings recorded as statements, and outcomes that are relationships to existing or newly-created Decision/Recommendation/Risk/Assumption records, or — specifically for implementation verification — a `validates` relationship to an Implementation Initiative.
- **Deliverables.** A `deliverable` element kind representing a formal TPLCo output (blueprint, deck, map, framework, summary): versioned and published exactly like any element, using the existing approval flow for "client review" and "approved," files stored through the Phase 4 engagement-file infrastructure.
- **Implementation.** An `implementation_initiative` element kind representing the effort to realize one or more approved core objects in operating reality, with its own — structurally parallel, physically separate — stewardship, history and escalation apparatus; a `validates`-gated path to a genuinely judged `validated` status; and a new, deliberately lightweight **Implementation Checkpoint** concept for meaningful conditions/events inside one initiative.
- **Six new relationship types** connecting these kinds to the existing vocabulary (§4.2).
- **Internal UX**: review scheduling and conduct, a deliverables workspace, an implementation register per engagement and across engagements, and what appears on an architecture element's own page once a review, deliverable or initiative concerns it.
- **Client UX**: a Reviews tab, deliverables surfaced wherever they already belong, and an Implementation tab — all read-only, all published-snapshot-only.
- **Three new internal capabilities** giving Project Administrators (spec §4: "manage... meetings... deliverables and status updates") a scoped role in Reviews, Deliverables and Implementation without extending them `edit_architecture` or `publish_architecture`.

### 2.2 Not in Phase 5

- **AI/Architecture Intelligence** (Phase 7): no auto-generated findings, no auto-drafted deliverables, no coherence analysis.
- **Method Library** (Phase 6), **Portfolio Intelligence** (Phase 8), **Certification/licensing** (Phase 9): untouched.
- **Finance integration.** ADR-0023 unchanged; no Phase 5 table references any finance table.
- **Generic task/subtask management, kanban boards, percent-complete dashboards, employee productivity tracking** — excluded by principle (§1.3).
- **A new "implementation risk," "implementation decision" or similar duplicate judgment table** — excluded by principle (§1.5).
- **Checkpoints as full elements, checkpoint lifecycle/versioning/publication, checkpoint-level evidence libraries** — deliberately excluded; see the tradeoff discussion in §7.6.
- **Inferring "stalled" from silence.** Per D11, the one implementation signal built now is `implementation_past_target` (a stated target date has passed). A signal that infers stalling purely from "no status change in N days" is not built until the methodology itself establishes that rule.

### 2.3 Conflicts and ambiguities with the specification

Unchanged from round 1 (renumbered items 1–5 below remain accurate); nothing in Kerrick's amendments introduces a new spec conflict, only refinements of this proposal's own design.

1. Spec §31 names this "Phase 5 — Client Experience"; Kerrick's brief and D12 confirm the broader governance framing controls.
2. Spec §13's flat "implementation item" sketch (single status column, `blockers` free text) is superseded here by separate implementation status, evidence, and now Checkpoints for structured "notes"-equivalent — a real, if modest, departure from the literal sketch.
3. Spec §11's "defer" review action has no direct database equivalent; treated as simply not requesting approval yet.
4. Spec §12's "generated from structured project data" is explicitly Phase 7 territory; Phase 5 builds only the traceable structure.
5. `view_confidential_deliverables` (dormant since Phase 1) gets its first real use here; D10 confirms its existing default holders stand.

---

## 3. Conceptual model

Phase 5 adds three new element kinds to the existing `element_kind` enum: `review`, `deliverable`, `implementation_initiative`. Each is a full architecture element (ADR-0013) — spine row, subtype table, reference code, lifecycle, client visibility, provenance, versions, publication, client snapshots, statements, evidence links, relationships — the same infrastructure every existing kind already uses.

They do **not** join the seven kinds in `intelligence_register`. Reviews, Deliverables and Implementation Initiatives are not intelligence about the architecture; each gets its own read model (§13).

**Implementation Initiative reuses Project Intelligence's judgment _pattern_ — never its tables.** ADR-0027/0028/0032 established a proven shape (stewardship with attention/triage/next-review; append-only field-level history; two-level escalation; deterministic, dismissable signals). Implementation gets the identical shape in its own tables (`implementation_stewardship`, `implementation_status_changes`, `implementation_escalations`, `implementation_signals()`). This is the central structural decision of this revision: it keeps "what might be wrong with the architecture" (Project Intelligence) and "how is realizing the architecture going" (Implementation) as two conceptually distinct systems that happen to share a proven engineering pattern, rather than one system wearing two hats.

**Implementation Checkpoints are not elements.** A checkpoint is a small, dated fact about one initiative's progress — not a thing with its own lifecycle, versions or evidence library. See §7.6 for the full tradeoff.

### The five states, concretely, with the validation gate

| State                | Where it lives                                                                                         | Who writes it                               | How it becomes true                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Architecture state   | `architecture_elements.lifecycle` + `architecture_approvals` (unchanged)                               | Architects, via existing Phase 3 operations | Publication and approval, unchanged                                                                                |
| Implementation state | `implementation_initiatives.implementation_status`                                                     | `manage_implementation` holders             | Direct edit for `not_started`/`in_progress`/`operational`/`stalled`; a dedicated operation for the terminal states |
| Operating state      | `implementation_status = 'operational'`, asserted                                                      | Same, evidenced but unreviewed              | An owner's evidenced claim — not yet judged                                                                        |
| Evidence             | `element_evidence_links` → `evidence_sources`; optionally a checkpoint's `achieved_evidence_source_id` | `manage_implementation` holders             | Linking evidence, unchanged mechanism                                                                              |
| Review/judgment      | A `review` element's statements, plus `validates` when the finding is affirmative conformance          | Reviewers, via `record_review_validation`   | Only a held review that has `examines`'d the initiative may `validates` it                                         |

`implementation_status = 'validated'` is reachable **only** when a `validates` relationship exists from an eligible review — never from an owner's status edit alone. This is the database-enforced answer to D8.

---

## 4. Vocabulary

### 4.1 New element kinds

| Kind                        | Prefix | Subtype table                | Domain                                                   | Notes              |
| --------------------------- | ------ | ---------------------------- | -------------------------------------------------------- | ------------------ |
| `review`                    | `REV`  | `reviews`                    | none (spans domains, like Project Intelligence records)  | Convened session   |
| `deliverable`               | `DLV`  | `deliverables`               | none                                                     | Formal output      |
| `implementation_initiative` | `IMP`  | `implementation_initiatives` | none, but usually implements a single-domain core object | Realization effort |

Implementation Checkpoints are **not** a fourth kind (§7.6) — they are rows in `implementation_checkpoints`, subordinate to an initiative, with no spine row, no reference code and no independent lifecycle.

### 4.2 New relationship types (33 existing → 39)

| Type            | Source → target                                                                                                            | Inverse label      | Notes                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `examines`      | Review → any element or Project Intelligence record                                                                        | "examined in"      | The review's agenda                                                                                                                                                  |
| `raises`        | Review → assumption / risk / constraint / dependency / decision / recommendation / opportunity / implementation_initiative | "raised in"        | A new judgment record produced by the review                                                                                                                         |
| `documents`     | Deliverable → any element                                                                                                  | "documented in"    | What the deliverable presents or summarizes                                                                                                                          |
| `implements`    | Implementation Initiative → core object                                                                                    | "implemented by"   | The architecture the initiative is realizing                                                                                                                         |
| `initiates`     | Decision or Recommendation → Implementation Initiative                                                                     | "initiated by"     | Why the initiative exists                                                                                                                                            |
| **`validates`** | Review → Implementation Initiative                                                                                         | **"validated by"** | Formal judgment that operating reality sufficiently conforms to architectural intent — see §7.5 for its precise definition and the operation that alone may write it |

Existing pairings extend to the three new kinds exactly as in round 1 (§4.2 of the first draft, unchanged): `part_of`, `precedes`, `threatens`/`mitigates`, `underpins`, `constrains`, `affects`/`addresses`, `has_stake_in`/`subject_to`, `conflicts_with` all extend to include Reviews, Deliverables and Implementation Initiatives as appropriate. `advances`/`pursues` (Opportunity) are not extended.

### 4.3 Categories and controlled vocabularies

- **Implementation categories** live in a **new, own table**, `implementation_categories` (not `intelligence_categories` — D2). Proposed: `program`, `process`, `system`, `partnership`, `team_or_talent`, `governance`, `other`.
- **Review type**: fixed enum, `executive_review` / `architecture_review`.
- **Deliverable type**: fixed enum, `full_architecture_blueprint` / `executive_strategy_deck` / `capability_map` / `implementation_framework` / `measurement_model` / `executive_summary` / `other`.
- **Implementation Checkpoint type**: fixed enum (§7.6), `design_approved` / `agreement_executed` / `operational_entry` / `scheduled_review` / `other`.

---

## 5. Reviews model

Unchanged in shape from round 1 (§5 of the first draft): `reviews` subtype table (review_type, scheduled_for, held_at, review_status, optional baseline_id, summary), `review_participants`, agenda via `examines`, findings as statements, outcomes via `raises` and/or approvals.

**One addition**: when a review's purpose includes judging whether an Implementation Initiative's operating reality conforms to architectural intent, its outcome is recorded through `record_review_validation` (§7.5), not a bare `raises` relationship — `raises` is for producing a _new_ judgment record (a risk, a decision); `validates` is for a specific, formal, positive conformance finding about an initiative already on the review's agenda.

Spec §11's client review actions (approve / approve with comments / request revision / defer / assign decision owner) map to existing primitives exactly as in round 1.

---

## 6. Deliverables model

Unchanged from round 1 — D7 confirmed the design as proposed: deliverable status is fully derived from the existing lifecycle + approval axes (no new status field), files reuse the Phase 4 engagement-file infrastructure with a new `deliverable` purpose, and `documents`/optional `baseline_id` provide traceability.

---

## 7. Implementation model

### 7.1 What an implementation initiative is

The organized effort to move one or more approved core objects from architecture state into operating reality. Not a task, not a subtask list, not a percent-complete bar.

### 7.2 Structure and precise status definitions (D8)

- `implementation_initiatives` (subtype): `category` (§4.3), `implementation_status`, `target_operational_on` (date, optional), `actual_operational_on` (date, set only when status reaches `operational`), `owner_member_id` (an `engagement_members` row).
- `implements` relationships to the core object(s) it realizes. An initiative implementing zero core objects is refused at submit (mirrors ADR-0017's "must state its scope" pattern).
- Decomposition/sequencing for genuinely separable efforts: `part_of` and `precedes`, unchanged from round 1 (§7.2 of the first draft) — see §7.6 for how this now differs from Checkpoints.

**`implementation_status` values, precisely defined:**

| Value         | Meaning                                                                                                                                                                                                 | Reached by                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `not_started` | The initiative exists (its architecture is approved, the initiative is created) but no realization work has begun.                                                                                      | Default at creation                                                                                                                |
| `in_progress` | Realization work is actively underway toward what the initiative `implements`.                                                                                                                          | Direct edit, `manage_implementation`                                                                                               |
| `operational` | The owner asserts the capability/system/model/application now exists and functions in reality. **An evidenced but unreviewed claim** — operating state, not yet judged.                                 | Direct edit, `manage_implementation`, sets `actual_operational_on`                                                                 |
| `validated`   | A qualifying Review has formally judged, via a `validates` relationship, that operating reality sufficiently conforms to architectural intent. **Not reachable by direct edit under any circumstance.** | `resolve_implementation_initiative`, `publish_architecture`, only when a qualifying `validates` relationship already exists (§7.5) |
| `stalled`     | Realization work was underway but is not currently advancing. Requires a stated reason.                                                                                                                 | `manage_implementation`, rationale required                                                                                        |
| `abandoned`   | Realization was discontinued before reaching operating state, or reality was judged not to conform and no further attempt is planned. Terminal.                                                         | `resolve_implementation_initiative`, `publish_architecture`, rationale required                                                    |

Terminal: `validated`, `abandoned`. Active: `not_started`, `in_progress`, `operational`, `stalled`. This is Implementation's own, single-kind version of ADR-0028's terminal/active split — simpler than Phase 4's per-kind function since there is exactly one kind (constants, not a lookup function).

### 7.3 Stewardship, history and escalation — Implementation's own tables (D2)

Structurally identical to ADR-0027/0028/0032's pattern, physically separate from Phase 4's tables:

- **`implementation_stewardship`**: one row per initiative — attention (`critical`/`high`/`routine`/`watch`), triage state, triaged by/when, next review date. Internal only, never in a client snapshot. Same shape as `intelligence_stewardship`, own table.
- **`implementation_status_changes`**: append-only, one row per changed tracked field (`implementation_status`, `target_operational_on`, `owner_member_id`, `category`, attention, triage state, next review), with actor, operation and rationale. Guarded by its own `guard_implementation_log` trigger (`BEFORE UPDATE OR DELETE`, raises 23514) — the same mechanism as `guard_intelligence_log`, a separate instance of it.
- **`implementation_escalations`**: level (`principal_architect` / `client_executive`), reason, acknowledged/resolved, one open escalation per initiative per level. A client-executive escalation still delivers as an `executive_attention` **`client_actions`** row — Phase 4's client-action machinery is reused directly here (it is already kind-agnostic about its subject; this is not one of the three tables D2 asked to keep separate).
- **`implementation_signals()`**: its own function, evaluated per engagement, separate from `intelligence_signals()`. One rule at launch (D11): `implementation_past_target` — an active initiative (`not_started`, `in_progress`, `operational`) whose `target_operational_on` has passed without reaching `validated`. No rule infers stalling from elapsed time alone.

### 7.4 Evidence and the architectural learning loop

No new evidence system (unchanged from round 1): `element_evidence_links` → `evidence_sources` support an initiative's operating-reality claim exactly as they support any element. The loop:

1. An architecture element is approved (Phase 3).
2. An Implementation Initiative `implements` it; status moves toward `operational`, evidence accumulates.
3. A Review `examines` the initiative.
4. The review's finding, if conformance holds, is recorded as a `validates` relationship via `record_review_validation` — the initiative may now reach `validated`.
5. If conformance does not hold, the review instead `raises` a Risk or Decision, and/or a Principal Architect/Architect calls `return_element_to_draft` on the architecture element — the loop closes back into ordinary Phase 3 editing. No `validates` relationship is written, and the initiative cannot reach `validated` from this review.

### 7.5 The `validates` relationship, precisely (D5)

**Chosen: `validates`, not `verifies`.** In verification-and-validation terms, _verification_ asks "did we build it to spec," while _validation_ asks "does it fulfill the intent it was built for." Kerrick's own D8 language — "sufficient conformance between operating reality and approved **architectural intent**" — is a validation question, not a narrower spec-conformance check, and it names the target status `validated`. Naming the relationship `validates` makes the connection between the relationship and the status it unlocks self-evident in the schema, not just in documentation.

**Definition:** `validates` (Review → Implementation Initiative) records that a specific, held review has formally judged that the initiative's asserted operating state sufficiently conforms to the architectural intent of the element(s) it implements. It is a judgment, not a checklist item — a review may examine an initiative extensively and choose not to validate it.

**Written only by `record_review_validation(review, initiative)`** — never by a free-form relationship insert, unlike most relationship types:

- Requires `publish_architecture` (the same weight as accepting a risk or publishing a baseline — this is a judgment-grade act, not routine editing).
- Refuses (23514) unless the review's `review_status = 'held'`.
- Refuses (23514) unless the review already `examines` this initiative (or a core object the initiative `implements`) — a review cannot validate something it never actually looked at.
- Refuses (23514) if a `validates` relationship from this review to this initiative already exists (idempotent, not repeatable).
- Writes the relationship; does **not** itself change `implementation_status` — `resolve_implementation_initiative(initiative, 'validated', rationale)` is a separate, subsequent call that checks the relationship exists. Keeping these two steps separate means the review records its judgment when it happens, and the initiative's owner (who may be a different person, e.g. a Project Administrator) formally closes the initiative afterward — matching how `decide_decision` and `resolve_intelligence_record` are already separate from the discussion that leads to them.

### 7.6 Implementation Checkpoints (D9)

**The distinction, stated precisely, as Kerrick asked:**

- **Implementation Initiative** = something being made real — an effort with an owner, a status, evidence, and (optionally) sub-initiatives for genuinely separable pieces of that effort.
- **Implementation Checkpoint** = a meaningful condition or event _inside_ one initiative, used to govern or verify its realization — not itself an effort with its own owner or status lifecycle.

The test for which one applies: **could this reasonably be assigned its own owner, tracked to its own `operational`/`validated` status, and potentially outlive or be reused outside the parent initiative?** If yes, it is a sub-initiative (`part_of`). If it is simply a fact about _this_ initiative's progress — a condition reached, an event that occurred, a review that is planned — it is a Checkpoint.

Kerrick's four examples, classified:

| Example                                | Checkpoint type                                                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| An operating model being approved      | `design_approved` — references the architecture approval that satisfied it (optional `related_approval_id`)                                          |
| A first agreement being executed       | `agreement_executed` — evidence-backed (optional `achieved_evidence_source_id`)                                                                      |
| A system entering operation            | `operational_entry` — often coincides with the initiative reaching `operational`, but can also mark one component of a larger initiative reaching it |
| A scheduled post-implementation review | `scheduled_review` — references a `review` element once one is scheduled (optional `related_review_id`)                                              |

**Structure — the minimum necessary:**

`implementation_checkpoints`: `implementation_initiative_id` (the parent), `checkpoint_type` (fixed enum above, plus `other`), `title`, `target_on` (date, optional), `achieved_on` (date, nullable until reached), `achieved_evidence_source_id` (nullable FK to `evidence_sources`), `related_review_id` (nullable FK to a `review` element's id), `related_approval_id` (nullable FK to `architecture_approvals`), `client_visible` (boolean, defaulting false — mirrors how `architecture_statements` already carry their own visibility flag independent of their parent, applied here to checkpoints).

That is the entire table. No status enum beyond "not yet achieved / achieved" (derived from `achieved_on is null`), no lifecycle, no versioning, no approval workflow, no dedicated history table, no reference code. A checkpoint is directly editable by whoever holds `manage_implementation` on the parent initiative — the same capability governing the initiative itself, not a separate authority.

**Element vs. subordinate record — the tradeoff, as asked:**

|                      | As an element (rejected)                                                                                                                                     | As a subordinate record (proposed)                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consistency          | Maximum — free versioning, publication, evidence-library richness, relationships                                                                             | Lower — a genuinely different, smaller shape                                                                                                                                             |
| Weight               | A 4th new element kind, a 4th reference-code prefix (`CHK-nnn`), full lifecycle ceremony for what is often a one-line fact                                   | Minimal — one table, no ceremony                                                                                                                                                         |
| Risk of scope creep  | High — an element with its own lifecycle and relationships is one refactor away from becoming a de facto subtask system, which is exactly what §1.3 excludes | Low — a checkpoint structurally cannot accumulate its own sub-relationships or evidence library, so it cannot grow into a task tracker                                                   |
| Future cost if wrong | None — nothing to undo                                                                                                                                       | If checkpoints later need real independence (their own owner, their own evidence library, cross-initiative reuse), promoting them to elements is a genuine migration, not a small change |

**Recommendation: subordinate record.** The "lightweight," "minimum structure necessary" language in Kerrick's brief, combined with the explicit warning against task-list/kanban/subtask patterns, points at the smaller shape. The identified future cost (§21/D15) is real but modest, and promoting a well-used subordinate table to an element later is a normal, additive migration, not a redesign — Phase 4 already did exactly this shape of expansion when Opportunity was promoted from "a spec aspiration" to a full element kind.

No new append-only history table for checkpoints — a checkpoint has essentially one meaningful transition (`achieved_on` being set), captured by the timestamp itself. If usage shows checkpoints need field-level history later, that is a small additive migration, not a design change.

---

## 8. Architecture ↔ Implementation relationships

`implements` (Initiative → core object), `initiates` (Decision/Recommendation → Initiative), `validates` (Review → Initiative, §7.5), `part_of`/`precedes` (Initiative → Initiative, for separable decomposition only — §7.6 distinguishes this from Checkpoints), plus every existing Project-Intelligence-to-element relationship extended to also target initiatives (§4.2).

---

## 9. Evidence and verification model

No new evidence system for initiatives — `element_evidence_links`/`evidence_sources` remain the one evidence library, exactly as round 1 proposed. What is new in this revision is that "verification" now has a _formal, enforced_ mechanism rather than an informal one: `validates` plus `record_review_validation` (§7.5) is specifically the verification step Kerrick asked for — "formal verification that implemented reality sufficiently conforms to architectural intent" is not a phrase describing a feeling a reviewer has; it is a specific relationship, written by a specific operation, checked by a specific database rule before `validated` can ever be set.

Checkpoint evidence (`achieved_evidence_source_id`) is a lighter-weight companion: a single, optional citation for a single fact, not a library — consistent with §7.6's "minimum necessary" design.

---

## 10. Schema changes

### 10.1 New enum values (own migration, as in Phases 2–4)

- `element_kind`: `+ 'review'`, `+ 'deliverable'`, `+ 'implementation_initiative'`.
- New: `review_type`, `review_status`, `review_participant_role`, `deliverable_type`, `implementation_status` (with `validated`/`abandoned` terminal, enforced in application logic and the resolve operation, not by the enum itself), `implementation_checkpoint_type`.
- `engagement_file_purpose`: `+ 'deliverable'`.
- `relationship_types`: 6 new rows (§4.2), including `validates`.

### 10.2 New tables

| Table                           | Holds                                                                                                                                    | Client policy                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reviews`                       | review_type, scheduled_for, held_at, review_status, baseline_id, summary                                                                 | published snapshot only                                                                                                                                        |
| `review_participants`           | review, member, role, attended                                                                                                           | internal only                                                                                                                                                  |
| `deliverables`                  | deliverable_type, baseline_id, confidential                                                                                              | published snapshot only                                                                                                                                        |
| `implementation_initiatives`    | category, implementation_status, target/actual operational dates, owner                                                                  | published snapshot only                                                                                                                                        |
| `implementation_stewardship`    | attention, triage state, next review — **own table, not `intelligence_stewardship`**                                                     | none                                                                                                                                                           |
| `implementation_status_changes` | append-only field-level history — **own table, not `intelligence_status_changes`**                                                       | none                                                                                                                                                           |
| `implementation_escalations`    | level, reason, acknowledged/resolved — **own table, not `intelligence_escalations`**                                                     | none directly (a client-executive escalation surfaces only through the `executive_attention` client action it raises, via the existing `client_actions` table) |
| `implementation_categories`     | reference data, per §4.3 — **own table, not `intelligence_categories`**                                                                  | reference data, readable by all signed-in users                                                                                                                |
| `implementation_checkpoints`    | checkpoint_type, target/achieved dates, evidence/review/approval references, client_visible — subordinate to an initiative, no spine row | inherits the parent initiative's visibility, gated additionally by its own `client_visible`                                                                    |

### 10.3 Widened existing objects

Much smaller than round 1, now that D2 removed the Phase 4 table widening:

| Object               | Change                                                   |
| -------------------- | -------------------------------------------------------- |
| `element_kind`       | + `review`, `deliverable`, `implementation_initiative`   |
| `engagement_files`   | + purpose `deliverable`, + nullable `element_version_id` |
| `relationship_rules` | regenerated to include the 6 new pairings                |

**Nothing in Phase 4's tables changes.** `intelligence_stewardship`, `intelligence_status_changes`, `intelligence_escalations`, `intelligence_categories`, `intelligence_register` and `intelligence_signals()` are untouched by this phase — their kind-check constraints, columns and behavior are exactly what Phase 4 shipped.

---

## 11. Operations

| Operation                                                                                                                            | Capability                                                                                                                                       | Notes                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_review`, `add_review_participant`, `hold_review`, `cancel_review`                                                            | `manage_reviews`                                                                                                                                 | Unchanged from round 1                                                                                                                                       |
| `record_review_validation(review, initiative)`                                                                                       | `publish_architecture`                                                                                                                           | New (§7.5) — the only way a `validates` relationship is written                                                                                              |
| `create_deliverable`, `attach_deliverable_file`                                                                                      | `manage_deliverables`                                                                                                                            | Unchanged                                                                                                                                                    |
| `create_implementation_initiative`                                                                                                   | `manage_implementation`                                                                                                                          |                                                                                                                                                              |
| Direct edits to `implementation_status` among `not_started`/`in_progress`/`operational`/`stalled`, and to category/owner/target date | `manage_implementation`                                                                                                                          | Working-content edits, like Project Intelligence records today; written to `implementation_status_changes` by trigger                                        |
| `resolve_implementation_initiative(initiative, status, rationale)` — `status` ∈ {`validated`, `abandoned`}                           | `publish_architecture`; `validated` additionally requires an existing qualifying `validates` relationship (23514 if absent)                      | One operation covering both terminal transitions — simpler than Phase 4's resolve/reopen split, since Implementation has one kind and a smaller status space |
| `reopen_implementation_initiative(initiative, rationale)`                                                                            | `publish_architecture`                                                                                                                           | Back to `in_progress` from a terminal status                                                                                                                 |
| Triage / escalate / acknowledge / dismiss-signal, for Implementation                                                                 | `edit_architecture` for triage/escalation to Principal Architect level (mirrors Phase 4); `publish_architecture` for client-executive escalation | Same permission shape as Phase 4, operating on Implementation's own tables                                                                                   |
| `add_implementation_checkpoint`, edit a checkpoint, `record_checkpoint_achieved`                                                     | `manage_implementation`                                                                                                                          | Direct edits, no lifecycle ceremony (§7.6)                                                                                                                   |

Publishing an initiative's version (making it client-visible) and every element-level operation on `review`/`deliverable`/`implementation_initiative` reuse Phase 3's unchanged `publish_element_version`/`return_element_to_draft` etc.

---

## 12. Capabilities and RLS

Unchanged from round 1 — D6 confirmed as proposed:

| Capability              | Side     | Default holders                                                        | Grants                                                                               |
| ----------------------- | -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `manage_reviews`        | internal | Principal Architect, Architect, Researcher, Project Administrator      | Create/schedule/hold/cancel reviews, add participants, add agenda/findings           |
| `manage_deliverables`   | internal | Principal Architect, Architect, Researcher, Project Administrator      | Draft deliverables, attach files, request approval                                   |
| `manage_implementation` | internal | Principal Architect, Architect, Project Administrator (not Researcher) | Create/edit initiatives and checkpoints, update status (non-terminal), link evidence |

`publish_architecture` still governs `record_review_validation` and both terminal `resolve_implementation_initiative` transitions — scarce, Principal-Architect/Architect-only, granted only by Principal Architects (ADR-0024, untouched).

**RLS**: `implementation_stewardship`, `implementation_status_changes` and `implementation_escalations` get the identical internal-only policy shape as their Phase 4 counterparts — same rule, separate table, separate policy statements. `implementation_checkpoints` is readable by whoever can read its parent initiative, with `client_visible` gating what a client additionally sees. No new pattern; more policy statements than round 1 (since nothing is shared), but no new kind of rule.

---

## 13. Read models

| Function                                                         | Returns                                                                                                    | Access                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `review_register(engagement?)`                                   | Every review the caller may read, with participant and agenda counts                                       | internal                                                                                       |
| `implementation_register(engagement?)`                           | Every initiative, joined with **Implementation's own** stewardship/escalation tables and checkpoint counts | internal                                                                                       |
| `implementation_signals(engagement, as_of?, include_dismissed?)` | `implementation_past_target`, evaluated against the live register                                          | internal — **own function**, separate from `intelligence_signals()`                            |
| `deliverable_register(engagement?)`                              | Every deliverable with its derived status                                                                  | internal                                                                                       |
| `client_reviews`, `client_deliverables`, `client_implementation` | Published, client-visible rows of each                                                                     | client, `view_architecture` (+ `view_confidential_deliverables` for confidential deliverables) |
| `implementation_impact(element, depth)`                          | What implements a given architecture element and what that implementation, in turn, threatens/depends on   | internal                                                                                       |

---

## 14. Architecture-learning/feedback loop

Restated with the validation gate explicit (§7.4): the loop's closing step is no longer "the review's finding, informally" — it is specifically `record_review_validation` (positive case) or a `raises`/`return_element_to_draft` (negative case). Every step is a relationship, a status change with rationale, or a version — never a note in someone's memory, and the one step that finalizes success (`validated`) cannot happen without the judgment step actually being recorded.

---

## 15. Internal UX

Unchanged from round 1 in shape (Deliverables and Implementation nav items, extended Reviews page, element-page panels), with one addition: an initiative's detail page shows its Checkpoints as a short, dated list (achieved/pending) beneath its status and evidence — not a separate tab, not a board, just a compact list consistent with how "Bearing on this element" already renders elsewhere.

---

## 16. Client UX

Unchanged from round 1. Published checkpoints (`client_visible = true`) appear as short milestones-reached notes on the client Implementation tab's initiative cards — e.g. "First agreement executed — Aug 2026" — never as a task list, never with internal ones shown.

---

## 17. Integration with Phase 4 Project Intelligence

**Restated precisely, per D2:** Implementation shares Project Intelligence's _pattern_ — attention/triage stewardship, append-only field history, two-level escalation, deterministic dismissable signals — implemented as Implementation's own tables and functions. It shares Phase 4's _tables_ in exactly one place: `client_actions`, for delivering a client-executive escalation, because that table is already generic about its subject and reusing it is not the kind of table-widening D2 excluded. Every other Phase 4 table is untouched by this phase.

---

## 18. Testing strategy

- **New pgTAP suites**: `16_reviews.test.sql`, `17_deliverables.test.sql`, `18_implementation.test.sql` (capability matrix, lifecycle/publication reuse, relationship-rule enforcement for the six new types, Implementation's own stewardship/history/escalation/signal behavior, checkpoint CRUD and visibility), `19_implementation_validation.test.sql` (specifically: `record_review_validation`'s three refusal cases — review not held, review doesn't examine the initiative, relationship already exists — and `resolve_implementation_initiative` refusing `validated` without a qualifying relationship), and a concurrency suite (`99_implementation_concurrency.test.sql`).
- **TypeScript**: dynamic mirror checks for the new categories/enums (mirroring `catalog.test.ts`'s pattern, but against Implementation's own reference tables), unit tests for `implementation_register` filtering/ordering.
- **`vocabulary.test.ts`** extended to check all six new relationship types and pairings, including `validates`'s restricted-write behavior at the domain-layer level (the UI never offers a free-form `validates` insert).
- No Playwright suite planned, consistent with the accepted limitation from Phases 1–4.

---

## 19. Seed changes

Extend `supabase/seed.sql` with: one held, published Executive Review with participants and a finding; one approved Deliverable documenting seeded elements; two or three Implementation Initiatives at different statuses, including one `operational` initiative with a `design_approved` and an `agreement_executed` checkpoint, one `validated` initiative with a `validates` relationship from a held review that also `examines` it (to exercise the full gate end-to-end locally), and one escalated, stalled initiative.

---

## 20. Relationship to Phases 6–9

Unchanged from round 1.

---

## 21. Difficult-to-reverse decisions (updated)

Carried over from round 1, still accurate: adding the three new `element_kind` values (1); new reference prefixes `REV`/`DLV`/`IMP` (3); new relationship types are permanent (4); three new capabilities are a permanent authorization surface (5); `implementation_initiative`'s exclusion from `intelligence_register` (6).

New in this revision:

- **Implementation's tables are a permanent, separate namespace from Phase 4's** (D2/D14) — the opposite bet from round 1's recommendation, now the approved direction. Reversing this later (merging the table sets) would be a larger migration than reversing the original bet would have been, precisely because the two are now developed independently from the start.
- **`validates` is a restricted-write relationship type**, unlike every other relationship in the vocabulary, which are ordinary `edit_architecture` inserts (D5/D13). This is a new _kind_ of relationship-authorization rule, not just a new relationship — a precedent that a future phase might want to reuse or might find inconsistent with the general "relationships are direct inserts" pattern.
- **Implementation Checkpoints are subordinate records, not elements** (D9/D15) — permanent shape; promoting them to elements later, if ever needed, is a genuine migration, not a small change (§7.6's tradeoff table).
- **`validated` is hard-gated by a database rule requiring a prior `validates` relationship from a review that also `examines` the initiative** (D8/D16) — a permanent business rule embedded in `resolve_implementation_initiative`, not a UI convention.

---

## 22. Explicit decisions requiring approval (round 2)

**Confirmed unchanged from round 1** (no further action needed): D1 (three new element kinds on the spine), D3 (Implementation excluded from `intelligence_register`), D4 (reference prefixes REV/DLV/IMP), D6 (three new capabilities as proposed), D7 (deliverable status fully derived), D10 (`view_confidential_deliverables` defaults as-is), D12 (Phase 5 framing per Kerrick's brief).

**Amended and now finalized as follows — please confirm each:**

| #   | Decision                                                   | Final shape in this revision                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2  | Implementation's stewardship/history/escalation            | **Own tables** (`implementation_stewardship`, `implementation_status_changes`, `implementation_escalations`), same pattern as Phase 4, never Phase 4's tables. Confirm this shape.                                                                         |
| D5  | New Review → Implementation relationship                   | **`validates`** (not `verifies`), defined in §7.5, written only by `record_review_validation`. Confirm the name and the restricted-write design.                                                                                                           |
| D8  | Implementation status definitions and the `validated` gate | Precise definitions in §7.2; `validated` unreachable without a prior `validates` relationship, per §7.5's three-check gate. Confirm.                                                                                                                       |
| D9  | Milestones/checkpoints                                     | Sub-initiatives (`part_of`) for genuinely separable efforts; a new, subordinate-record **Implementation Checkpoint** (§7.6) for conditions/events inside one initiative. Confirm the checkpoint structure and the subordinate-record (not element) choice. |

**New decisions introduced by these amendments:**

| #   | Decision                                                                                                                                                                                                                                 | Recommended                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| D13 | `validates` relationship is written only by `record_review_validation`, requiring `publish_architecture`, a held review, and that the review already `examines` the initiative — never a free-form relationship insert like other types? | **Yes** — the gate is only meaningful if it can't be bypassed by an ordinary edit |
| D14 | Implementation's tables are a permanent, separate namespace from Phase 4's Project Intelligence tables, sharing pattern but not schema (§21)?                                                                                            | **Yes**, per D2                                                                   |
| D15 | Implementation Checkpoints are subordinate records (own table, no spine row, no lifecycle), not a fourth element kind, accepting the future-promotion cost if that ever proves wrong (§7.6's tradeoff table)?                            | **Yes** — matches "lightweight" and "minimum structure necessary"                 |
| D16 | `implementation_past_target` is the only implementation signal built now; no signal infers stalling from elapsed time without a status change?                                                                                           | **Yes**, per D11                                                                  |

---

## 23. Build order once approved

Unchanged in shape from round 1, with Implementation's schema now larger (its own stewardship/history/escalation/categories/signals, distinct from Phase 4's) and Checkpoints added as a lightweight subordinate table:

1. Enum migration (`element_kind` additions, new enums including `implementation_checkpoint_type`, `engagement_file_purpose` addition).
2. Main Phase 5 migration: `reviews`, `review_participants`, `deliverables`, `implementation_initiatives`, `implementation_stewardship`, `implementation_status_changes` (+ `guard_implementation_log`), `implementation_escalations`, `implementation_categories`, `implementation_checkpoints`; new relationship types (including `validates`) and regenerated `relationship_rules`; new capabilities and `role_capability_defaults`; operations (including `record_review_validation` and `resolve_implementation_initiative`'s gate check); read models (including standalone `implementation_signals()`).
3. `src/domain/reviews/`, `src/domain/deliverables/`, `src/domain/implementation/` domain layers, plus `vocabulary.ts` mirror updates and their dynamic tests.
4. pgTAP suites 16–19 and the concurrency suite.
5. Internal UI: Reviews (extend existing page), Deliverables, Implementation (engagement + cross-engagement, with checkpoints on the initiative detail page), element-page panels.
6. Client UI: Reviews tab, Documents/Deliverables surfacing, Implementation tab (with published checkpoints as short notes).
7. Seed data, database docs, README/rls.md updates, `PHASE_5_REPORT.md`.
8. Full verification: `pnpm check`, `pnpm build`, `npx supabase db reset`, `npx supabase test db`, `pnpm db:types`.

---

**Next step:** Kerrick reviews §21–22 and gives final approval, or amends further. No migration or code is written until that approval arrives.
