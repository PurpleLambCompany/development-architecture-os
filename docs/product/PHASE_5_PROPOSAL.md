# Phase 5 — Reviews, Deliverables and Implementation: Proposal

**Status:** Proposal only. No migrations or application code have been written for this phase. Do not build until Kerrick approves the decisions in §26.

**Governing question:** once Development Architecture has been designed and approved, how does the system govern making that architecture real?

**Conceptual flow:** Architecture → Implementation → Evidence → Review → Architectural Learning.

---

## 1. Principles

1. **Reference, don't duplicate.** Phase 5 introduces governance and realization _structure_ around the architecture; it does not re-describe the architecture. Wherever an existing Phase 3/4 primitive (a core object, a Project Intelligence record, a relationship, evidence, an approval) already represents a fact, Phase 5 points at it instead of copying it.
2. **The element spine keeps doing the work.** ADR-0013's pattern — one spine row, a subtype table, versions, publication, client snapshots, evidence links, statements, relationships, reference codes — is proven across nine kinds already (six Phase 3 records plus core objects plus Opportunity). Phase 5's three new concerns (Review, Deliverable, Implementation Initiative) reuse it rather than inventing a parallel content model.
3. **Implementation is not a task tracker.** An Implementation Initiative represents the organized effort to make one or more approved architecture elements real — not a checklist, not an assignee queue, not a percent-complete bar. Sequencing exists only where it reflects genuine methodological dependency (via the existing `precedes`/`part_of` relationship machinery), never as generic subtasks.
4. **Five distinct states stay distinct** (extends ADR-0020): Architecture state (designed, approved) is the element's own lifecycle and approval axis, unchanged. Implementation state (being established) is new. Operating state (now exists/functions) is a claim an initiative makes about itself, never inferred. Evidence (what supports that claim) is the existing evidence system. Review/judgment (does reality conform, should the architecture change) is new, and it closes the loop by writing back to existing primitives — a returned element, a new Decision, a new Risk — never by silently updating implementation state.
5. **Project Intelligence stays the intelligence layer.** No Phase 5 table duplicates an assumption, risk, constraint, dependency, decision, recommendation or opportunity. Implementation risks are risks. Implementation decisions are decisions. Phase 5 relates to them; it does not re-invent them.
6. **Clients see less than TPLCo, structurally.** Everything a client sees in Reviews, Deliverables and Implementation is a published, client-visible snapshot or an existing approval/action primitive — never a working copy, never internal stewardship, never an internal capability's-worth of detail.
7. **Stable foundations are not renegotiated.** Nothing in this phase changes the element spine, the lifecycle/approval/maturity/record-status separation, the publication boundary, the relationship-vocabulary enforcement model, capability-based authorization, RLS as the security authority, or any Phase 1–4 table's meaning. Extensions are additive.

---

## 2. Scope

### 2.1 Proposed for Phase 5

- **Reviews.** A `review` element kind representing a convened session (Executive Review or Architecture Review): participants, an agenda of existing elements and Project Intelligence records, findings recorded as statements, and outcomes that are relationships to existing or newly-created Decision/Recommendation/Risk/Assumption records — never a parallel decision mechanism.
- **Deliverables.** A `deliverable` element kind representing a formal TPLCo output (blueprint, deck, map, framework, summary): versioned and published exactly like any element, using the existing approval flow for "client review" and "approved," files stored through the Phase 4 engagement-file infrastructure, and traceable to the architecture and evidence it was produced from.
- **Implementation.** An `implementation_initiative` element kind representing the effort to realize one or more approved core objects in operating reality: an implementation status distinct from architecture lifecycle, evidence of operation, and full reuse of Project Intelligence's stewardship, history and escalation apparatus (extended, not duplicated) rather than a new implementation-specific judgment system.
- **Four to five new relationship types** connecting these kinds to the existing vocabulary (§7).
- **Internal UX**: review scheduling and conduct, a deliverables workspace, an implementation register per engagement and across engagements, and what appears on an architecture element's own page once a review, deliverable or initiative concerns it.
- **Client UX**: a Reviews tab, deliverables surfaced wherever they already belong (Overview, Architecture, a lightweight Documents view), and an Implementation tab — all read-only, all published-snapshot-only.
- **Two or three new internal capabilities** giving Project Administrators (spec §4: "manage... meetings... deliverables and status updates") a scoped role in Reviews, Deliverables and Implementation without extending them `edit_architecture` or `publish_architecture` (ADR-0024's tight guarding of drafting and publishing authority is preserved).

### 2.2 Not in Phase 5

- **AI/Architecture Intelligence** (Phase 7): no auto-generated findings, no auto-drafted deliverables, no coherence analysis. Phase 5 captures the structured relationships (`examines`, `documents`, `raises`, `implements`) that a future AI phase will read, but computes nothing itself beyond the same kind of deterministic signal Phase 4 already established.
- **Method Library** (Phase 6): review agendas and deliverable content may cite the Method the way any element already can (`element_method_lineage`), but no method-asset UI is built.
- **Portfolio Intelligence** (Phase 8): no cross-engagement implementation dashboard. `implementation_register` is engagement-scoped and cross-engagement like `intelligence_register` already is for internal readers, but no aggregate metrics are computed.
- **Certification/licensing** (Phase 9): untouched.
- **Finance integration.** ADR-0023 (architecture never depends on finance) is unchanged. A deliverable or an implementation initiative may be _discussed_ alongside a payment milestone in conversation, but no Phase 5 table references `payment_milestones`, `contracts` or any finance table. The reserved `payment_milestone_architecture_links` table from ADR-0023 remains unbuilt and remains finance-owned when it is eventually built.
- **Generic task/subtask management, kanban boards, percent-complete dashboards, employee productivity tracking** — excluded by principle, not merely by omission (§1.3, master spec §13 and §23).
- **A new "implementation risk," "implementation decision" or similar duplicate judgment table** — excluded by principle (§1.5).
- **Milestone-as-a-table.** "Milestones or checkpoints where methodologically justified" (Kerrick's brief) are represented as sub-initiatives via `part_of`, not a new table (§9.3).

### 2.3 Conflicts and ambiguities with the specification

Surfaced per `CLAUDE.md`'s instruction to raise conflicts before an expensive change, and per the master spec's own §31 phase sequence, which the current proposal reconciles rather than following literally:

1. **Spec §31 names this "Phase 5 — Client Experience"** (reviews, approvals, deliverables, implementation visibility, polished client dashboard); Kerrick's brief names it "Reviews, Deliverables, and Implementation" and gives it a governance framing broader than "client experience polish." This proposal follows Kerrick's brief as the authoritative statement of Phase 5's intent (`CLAUDE.md` names the master spec authoritative, but Kerrick's own direct instruction on phase content controls when the two are in tension, consistent with how Phase 3 and 4 each substantially exceeded their one-line spec §31 description).
2. **Spec §13 ("Implementation Tracking")** proposes a flat `implementation_status` on a generic "implementation item" (Designed → Accepted → Implementation Started → Operational → Validated) with a single `linked architecture object`, owner, target date, evidence, blockers and notes on one table. This proposal treats "Designed" and "Accepted" as architecture-side states (already covered by lifecycle and approval) rather than implementation states, uses `part_of` decomposition instead of a `blockers` free-text field, and represents "notes" as statements or Project Intelligence records rather than a text column — all changes that make the spec's minimal sketch consistent with ADR-0020's separation of axes and with Kerrick's explicit instruction to reuse Project Intelligence rather than add parallel fields. Flagged because it is a real, if modest, departure from §26's literal table sketch.
3. **Spec §11 ("Executive Review Mode")** lists client actions during a review as "approve / approve with comments / request revision / defer / assign decision owner." The first four already exist as `architecture_approvals` responses and Decision assignment (§21 below); "defer" has no direct existing equivalent (the closest is `defer_decision`, which defers a _decision_, not a whole review). This proposal treats "defer" at the review level as simply not requesting approval yet — no new status is needed — and flags this as a minor simplification rather than a gap.
4. **Spec §12 ("Deliverable System")** describes deliverables as "generated from structured project data where possible," listing an implicit auto-drafting capability. That capability is explicitly Phase 7 territory (spec §18: "draft deliverables from structured project data"). Phase 5 builds the traceable _structure_ (what a deliverable documents) that a future phase would read; it does not generate content.
5. **The existing `view_confidential_deliverables` capability** was defined in Phase 1 (ADR-0008) and has sat unused ever since — no deliverable table existed to gate. This proposal is the first to give it meaning (§20). Worth flagging only because its Phase 1 default holders (System Administrator, Principal Architect, Architect, Researcher, Project Administrator, Executive Sponsor, Client Project Lead) were set four phases ago without a deliverable model in view; §26 asks Kerrick to confirm those defaults still make sense now that the capability does something.

---

## 3. Conceptual model

Phase 5 adds three new element kinds to the existing `element_kind` enum (`assumption`, `risk`, `constraint`, `dependency`, `decision`, `recommendation`, `opportunity`, `object` — the eight established today): `review`, `deliverable`, `implementation_initiative`. Each is a full architecture element (ADR-0013): one `architecture_elements` spine row, one subtype table, a permanent reference code, lifecycle, client visibility, provenance, IP classification, versions, publication, client snapshots, statements, evidence links, method lineage and relationships — exactly the same infrastructure every existing kind already uses, extended additively.

They do **not** join the seven kinds in `intelligence_register` — that register is specifically the intelligence layer (facts that inform judgment about the architecture: what might be wrong, what might happen, what was decided). Reviews, Deliverables and Implementation Initiatives are not intelligence about the architecture; a Review is an event, a Deliverable is an output, an Implementation Initiative is an operational fact-in-progress. Each gets its own read model (§13).

**Implementation Initiative is the one exception that reuses Project Intelligence's judgment apparatus** (stewardship, append-only history, escalation), because Kerrick's brief asks implementation to connect to exactly that apparatus, and because an initiative's status genuinely is the kind of thing that needs triage, a next-review date and escalation the way a risk does. It is described in `INTELLIGENCE_CATEGORIES`-adjacent terms in §9 without being a member of the register that filters by "is this a concern about the architecture."

### The five states, concretely

| State                | Where it lives                                                                                                                                          | Who writes it                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Architecture state   | `architecture_elements.lifecycle` + `architecture_approvals` (unchanged)                                                                                | Architects, via existing Phase 3 operations                          |
| Implementation state | `implementation_initiatives.implementation_status`                                                                                                      | Implementation-capable internal members, via new Phase 5 operations  |
| Operating state      | The same `implementation_status` value `operational`/`validated`, asserted, not computed                                                                | Same, with a required rationale on the terminal transition           |
| Evidence             | `element_evidence_links` → `evidence_sources` (unchanged, already generic)                                                                              | Whoever holds `edit_architecture` or the new `manage_implementation` |
| Review/judgment      | A `review` element's statements, plus any Decision/Risk/Recommendation it `raises`, plus `return_element_to_draft` when architecture itself must change | Reviewers, via existing and new operations together                  |

---

## 4. Vocabulary

### 4.1 New element kinds

| Kind                        | Prefix | Subtype table                | Domain                                                                               | Notes              |
| --------------------------- | ------ | ---------------------------- | ------------------------------------------------------------------------------------ | ------------------ |
| `review`                    | `REV`  | `reviews`                    | none (spans domains, like Project Intelligence records — ADR-0017's pattern extends) | Convened session   |
| `deliverable`               | `DLV`  | `deliverables`               | none                                                                                 | Formal output      |
| `implementation_initiative` | `IMP`  | `implementation_initiatives` | none, but usually implements a single-domain core object                             | Realization effort |

### 4.2 New relationship types (extends the 33 from ADR-0018/0026 to 37 or 38 — see D6)

| Type         | Source → target                                                                                                            | Inverse label    | Notes                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `examines`   | Review → any element or Project Intelligence record                                                                        | "examined in"    | The review's agenda                                                                                                                                                        |
| `raises`     | Review → assumption / risk / constraint / dependency / decision / recommendation / opportunity / implementation_initiative | "raised in"      | A new judgment record produced by the review — never a duplicate, always a real Phase 3/4/5 record                                                                         |
| `documents`  | Deliverable → any element                                                                                                  | "documented in"  | What the deliverable presents or summarizes                                                                                                                                |
| `implements` | Implementation Initiative → core object                                                                                    | "implemented by" | The architecture the initiative is realizing. Restricted to core objects (§4.1's `object` kind), not Project Intelligence records — you implement a Capability, not a Risk |
| `initiates`  | Decision or Recommendation → Implementation Initiative                                                                     | "initiated by"   | Why the initiative exists                                                                                                                                                  |

Existing pairings extend to the three new kinds as follows (mirroring how Opportunity's pairings extended in ADR-0026):

- `part_of` — an Implementation Initiative may be `part_of` another Implementation Initiative (decomposition; already acyclic-checked). A Review or Deliverable is never decomposed this way.
- `precedes` — any of the three kinds may precede another instance of the same or a different Phase 5 kind (sequencing reviews, deliverable versions conceptually, or initiative phases), already acyclic-checked.
- `threatens` / `mitigates` — a Risk may threaten a Deliverable or an Implementation Initiative exactly as it threatens any element; a Recommendation or Decision may mitigate one.
- `underpins` — an Assumption may underpin an Implementation Initiative.
- `constrains` — a Constraint may constrain an Implementation Initiative or a Deliverable.
- `affects` / `addresses` — unchanged, extended to the new kinds as targets.
- `has_stake_in` / `subject_to` — a Stakeholder object may have a stake in a Review or an Implementation Initiative.
- `conflicts_with` — two Implementation Initiatives may conflict (competing approaches to the same capability).
- `supersedes` — a later Deliverable version conceptually supersedes an earlier one at the _element_ level already (via `element_versions`); `supersedes` as a relationship is reserved, as today, for `supersede_element`'s own use in retiring one element in favor of another (a superseding Deliverable that fully replaces an earlier, retired one).

`advances`/`pursues` (Opportunity) are not extended to the new kinds — an Opportunity is pursued through a Decision or a Recommendation, which may then `initiate` an Implementation Initiative; no direct Opportunity → Initiative relationship is needed.

### 4.3 Categories

- Implementation Initiatives get a controlled category vocabulary the same way Assumptions/Risks/Decisions/Recommendations/Opportunities do (ADR-0027): `intelligence_categories` gains an `implementation_initiative` kind. Proposed categories, for review: `program`, `process`, `system`, `partnership`, `team_or_talent`, `governance`, `other`.
- Reviews get a controlled `review_type`: `executive_review`, `architecture_review` (a fixed two-value enum on the subtype table, not a categories-table entry, since master spec §11 names exactly these two and the set is not expected to grow the way Opportunity categories did).
- Deliverables get a controlled `deliverable_type` (a fixed enum, per spec §12): `full_architecture_blueprint`, `executive_strategy_deck`, `capability_map`, `implementation_framework`, `measurement_model`, `executive_summary`, `other`.

---

## 5. Reviews model

### 5.1 What a review is

A convened session — Executive Review or Architecture Review — that examines existing architecture and Project Intelligence, records findings, and produces (or reuses) judgment. It is not a meeting-notes feature: every substantive outcome is a relationship to a real record, not free text sitting outside the model.

### 5.2 Structure

- `reviews` (subtype): `review_type`, `scheduled_for` (timestamptz, nullable until scheduled), `held_at` (timestamptz, nullable until held), `review_status` (`scheduled`, `held`, `cancelled`), optional `baseline_id` (references a frozen `architecture_baselines` row — baselines are not elements, so this is a direct FK, mirroring how `architecture_approvals.baseline_id` already works), summary (short text, the client-visible headline once published).
- `review_participants`: review element id, `engagement_member_id`, role (`convener`, `presenter`, `decision_maker`, `attendee`), `attended` (boolean, set after the fact). Genuinely new — no existing table captures session attendance.
- Agenda: `examines` relationships from the review to whatever is on the agenda — elements, risks, decisions, an opportunity nearing its window, a signal-flagged record. The reviewer builds the agenda by relating, not by copying data into the review.
- Findings: `architecture_statements` attached to the review element, exactly as any element already carries statements, with the existing provenance and `client_visible` flag per statement.
- Outcomes: `raises` relationships from the review to new or existing Decision, Recommendation, Risk or Assumption records, and/or `architecture_approvals` requested against the baseline the review presented, and/or (rare) `return_element_to_draft` when the review concludes the architecture itself needs to change before anything else proceeds.
- Publication: a review publishes like any element (`publish_element_version`), producing a client snapshot containing the summary, client-visible findings, and the client-visible portion of its agenda and outcomes (only elements/records the client can already see appear; nothing is exposed that publication doesn't already allow).

### 5.3 Client actions during a review (spec §11)

All four map to existing primitives — no new client-facing decision mechanism:

| Spec action                     | Existing primitive                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Approve / approve with comments | `respond_to_architecture_approval` on the review's baseline or on individual element versions on its agenda |
| Request revision                | `respond_to_architecture_approval` with `changes_requested`                                                 |
| Defer                           | Simply not requesting approval on that item yet; no status is stored at the review level                    |
| Assign decision owner           | The existing `decision_owner_user_id` on a Decision record the review `raises`                              |

### 5.4 History

A review's history is its `element_versions` (each publish is a version, exactly like any element) plus `architecture_activity`. No new append-only history table is needed — reviews change rarely and coarsely (scheduled → held → published), unlike a risk's status, which changes often enough to need field-level history (ADR-0028).

---

## 6. Deliverables model

### 6.1 What a deliverable is

A formal TPLCo output, traceable to the architecture and evidence it was produced from, versioned and approved exactly like any element.

### 6.2 Structure

- `deliverables` (subtype): `deliverable_type`, optional `baseline_id` (the frozen baseline this deliverable was produced from, when it was produced from one), `confidential` (boolean, gates `view_confidential_deliverables` — §20).
- `documents` relationships to the specific elements it presents or summarizes (in addition to, or instead of, a `baseline_id`).
- File/output: `engagement_files` gains a fourth purpose, `deliverable`, and a nullable `element_version_id` column (alongside its existing response/contribution/evidence-source columns) so a deliverable's rendered file attaches to the specific published version it belongs to. A new version means a new file; the old one stays attached to the old, immutable version (consistent with ADR-0033: files are never replaced).
- Status: entirely derived from the existing lifecycle + approval axes (§6.3) — no new status field.

### 6.3 Status mapping (spec's draft/internal review/client review/approved/superseded)

| Spec status     | Derived from                                                      |
| --------------- | ----------------------------------------------------------------- |
| Draft           | `lifecycle = 'draft'`                                             |
| Internal review | `lifecycle = 'in_review'`                                         |
| Client review   | `lifecycle = 'published'`, an approval requested, no response yet |
| Approved        | `lifecycle = 'published'`, latest approval = `approved`           |
| Superseded      | `lifecycle = 'superseded'`                                        |

This is the same derivation the Reviews queue page already performs for architecture elements generally (`src/app/(internal)/internal/engagements/[slug]/reviews/page.tsx`); a Deliverables page reuses the identical queries, filtered to `kind = 'deliverable'`.

### 6.4 Client acknowledgement

Spec asks for "client acknowledgement/acceptance where appropriate." This is the existing approval mechanism (`request_architecture_approval` / `respond_to_architecture_approval`) — "where appropriate" means TPLCo chooses whether to request approval on a given deliverable, not a new acceptance concept.

---

## 7. Implementation model

### 7.1 What an implementation initiative is

The organized effort to move one or more approved core objects from architecture state into operating reality. Not a task, not a subtask list, not a percent-complete bar.

### 7.2 Structure

- `implementation_initiatives` (subtype): `category` (§4.3), `implementation_status` (`not_started`, `in_progress`, `operational`, `validated`, `stalled`, `abandoned`), `target_operational_on` (date, optional), `actual_operational_on` (date, set only when status reaches `operational`), owner (`owner_member_id`, an `engagement_members` row — internal, since implementation is TPLCo's tracked work product, per spec's "owner" field and Project Administrator's charter).
- `implements` relationships to the core object(s) it realizes (§4.2). An initiative implementing zero core objects is refused at submit, mirroring how a Project Intelligence record must state its scope before leaving draft (ADR-0017's pattern).
- Decomposition/sequencing: `part_of` for genuine sub-initiatives ("Institutional Partnership Program" may decompose into "Partner identification," "Agreement negotiation," "Onboarding," each its own initiative with its own status and target date) and `precedes` where one sub-initiative must finish before another starts — both already acyclic-checked by the existing relationship machinery. This is how "milestones or checkpoints where methodologically justified" (Kerrick's brief) are represented: as real, individually-trackable initiatives, never as an unstructured checklist field.
- Evidence of operation: `element_evidence_links` to `evidence_sources`, exactly as any element already links evidence — no new evidence table.
- Risks, assumptions, dependencies, decisions concerning the initiative: existing relationships (`threatens`, `underpins`, and dependency ends already reference any element) to existing Project Intelligence records — no new "implementation risk" kind.

### 7.3 Stewardship, history, escalation, signals — reused, not duplicated

Per Kerrick's explicit instruction to connect implementation to Project Intelligence's own apparatus rather than rebuild it:

- `intelligence_stewardship` gains `implementation_initiative` as an accepted kind (its check constraint widens; every column and rule stays the same — attention, triage state, next review date).
- `intelligence_status_changes` gains `implementation_initiatives.implementation_status` (and `target_operational_on`, `owner_member_id`, category) as tracked fields, through the same trigger pattern already covering the seven Project Intelligence subtype tables.
- `intelligence_escalations` gains `implementation_initiative` as an escalatable kind — a stalled, high-stakes initiative can be escalated to a Principal Architect or a client executive exactly like an overdue risk.
- `intelligence_signals` gains one new rule: `implementation_stalled` (an initiative in `in_progress` with no status change in 30 days) or `implementation_past_target` (past `target_operational_on` and not yet `operational`) — deterministic, computed, no AI, following ADR-0032's pattern exactly. Proposed as one new rule for review, not a batch, to keep the addition legible.
- Resolution: `validated` and `abandoned` are terminal (mirroring `intelligence_terminal_statuses`), reached only through a rationale-requiring operation, exactly like `resolve_intelligence_record`.

These are all additive widenings of existing Phase 4 tables and functions — no new stewardship, history or escalation table.

**`implementation_initiative` is deliberately excluded from `intelligence_register`.** That register answers "what do we need to worry about or decide," which is what the seven Project Intelligence kinds are for. An initiative answers "what is being built and where does it stand" — a different question, with its own register (§13).

### 7.4 The architectural learning loop, concretely

Kerrick's brief: Designed Architecture → Implementation → Observed Reality → Evidence → Review → Decision/Intelligence → Architecture revision when necessary.

1. An architecture element is approved (existing Phase 3 machinery).
2. An Implementation Initiative `implements` it and its status moves toward `operational`.
3. Evidence accumulates on the initiative (`element_evidence_links`), asserting operating reality.
4. A Review `examines` the initiative (and, through it, transitively, the architecture element and its evidence).
5. The review's finding (a statement) records whether reality conforms. If it doesn't:
   - the review `raises` a Risk or a Decision naming the variance, and/or
   - a Principal Architect/Architect calls `return_element_to_draft` on the architecture element, reopening it for revision — the loop closes back into ordinary Phase 3 editing.
6. If it does conform, the initiative moves to `validated`, closing the loop with a positive result, still visible in its history.

Nothing here is new machinery at step 5–6 beyond what Phase 3/4 already built; Phase 5's job was steps 2–4.

---

## 8. Architecture ↔ Implementation relationships

Covered structurally in §4.2 and §7.2. Summary: `implements` (Initiative → core object, the only relationship an initiative has to the thing it is realizing), `initiates` (Decision/Recommendation → Initiative, why it started), `part_of`/`precedes` (Initiative → Initiative, decomposition and sequencing), plus every existing Project-Intelligence-to-element relationship extended to also target initiatives (§4.2).

---

## 9. Evidence and verification model

No new evidence system. `evidence_sources` and `element_evidence_links` (Phase 3, already domain-general) are the single evidence library for architecture content, deliverable substantiation and implementation verification alike. What differs by context is only which element the link is attached to and what the evidence is asserting:

- On an architecture element, evidence supports a design claim ("the market analysis behind this Capability").
- On a Deliverable, evidence supports what the deliverable presents (often the same evidence already linked to the elements it `documents`).
- On an Implementation Initiative, evidence supports an operating-reality claim ("this partnership program is live" — a photo, a signed agreement, a report).

"Verification that something actually exists or operates as designed" (Kerrick's brief) is this: an initiative's evidence, examined by a Review, and the review's own finding — there is no separate "verification" table or status. The claim is the `implementation_status`; the support is the evidence; the check is the review.

---

## 10. Schema changes

### 10.1 New enum values (own migration, as in Phases 2–4)

- `element_kind`: `+ 'review'`, `+ 'deliverable'`, `+ 'implementation_initiative'`.
- New: `review_type` (`executive_review`, `architecture_review`), `review_status` (`scheduled`, `held`, `cancelled`), `review_participant_role` (`convener`, `presenter`, `decision_maker`, `attendee`), `deliverable_type` (`full_architecture_blueprint`, `executive_strategy_deck`, `capability_map`, `implementation_framework`, `measurement_model`, `executive_summary`, `other`), `implementation_status` (`not_started`, `in_progress`, `operational`, `validated`, `stalled`, `abandoned`).
- `engagement_file_purpose`: `+ 'deliverable'`.
- `relationship_types`: 4–5 new rows (§4.2).

### 10.2 New tables

| Table                        | Holds                                                                    | Client policy                                                   |
| ---------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `reviews`                    | review_type, scheduled_for, held_at, review_status, baseline_id, summary | published snapshot only                                         |
| `review_participants`        | review, member, role, attended                                           | internal only                                                   |
| `deliverables`               | deliverable_type, baseline_id, confidential                              | published snapshot only (gated further by `confidential` — §20) |
| `implementation_initiatives` | category, implementation_status, target/actual operational dates, owner  | published snapshot only                                         |

### 10.3 Widened existing tables/functions

| Object                                                          | Change                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `intelligence_categories`                                       | + kind `implementation_initiative`                                           |
| `intelligence_stewardship`                                      | kind check widened to accept `implementation_initiative`                     |
| `intelligence_status_changes` triggers                          | widened to watch `implementation_initiatives`                                |
| `intelligence_escalations`                                      | kind check widened                                                           |
| `intelligence_signals()`                                        | + rule `implementation_stalled` (or similar — final rule set for §26 review) |
| `intelligence_terminal_statuses`/`intelligence_active_statuses` | + `implementation_initiative` kind (`validated`, `abandoned` terminal)       |
| `engagement_files`                                              | + purpose `deliverable`, + nullable `element_version_id`                     |
| `relationship_rules`                                            | regenerated to include the new pairings (§4.2), exactly as every prior phase |

No Phase 1–4 table's existing columns, constraints or meaning change. Every change above is an additive widening (new enum value, new nullable column, a check constraint's accepted set growing) of the kind Phases 2–4 each already made to earlier phases' tables without incident.

---

## 11. Operations

| Operation                                                                                                                                       | Capability                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `create_review`, `add_review_participant`, `hold_review` (sets `held_at`, `review_status = 'held'`)                                             | `manage_reviews` (new — §12)                                                                                   |
| `cancel_review`                                                                                                                                 | `manage_reviews`                                                                                               |
| `submit_element_for_review`, `publish_element_version`, `return_element_to_draft` (unchanged, apply to `review` kind too)                       | `edit_architecture` / `publish_architecture` (unchanged)                                                       |
| `create_deliverable`, `attach_deliverable_file`                                                                                                 | `manage_deliverables` (new)                                                                                    |
| Publication/approval of a deliverable                                                                                                           | `edit_architecture` / `publish_architecture` / `approve_architecture` (unchanged, apply to `deliverable` kind) |
| `create_implementation_initiative`, `set_implementation_status` (rationale required on `validated`/`abandoned`), `link_implementation_evidence` | `manage_implementation` (new)                                                                                  |
| Triage/escalation/dismissal of an initiative                                                                                                    | `edit_architecture` (unchanged — same as every other Project-Intelligence-style operation today)               |
| Publishing an initiative's version, or its terminal `validated` status                                                                          | `publish_architecture` (unchanged)                                                                             |

Every operation follows the existing pattern exactly: `SECURITY DEFINER`, locks the row, checks capability (42501), validates (23514), writes history where applicable.

---

## 12. Capabilities and RLS

### 12.1 New internal capabilities

| Capability              | Side     | Default holders                                                        | Grants                                                                     |
| ----------------------- | -------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `manage_reviews`        | internal | Principal Architect, Architect, Researcher, Project Administrator      | Create/schedule/hold/cancel reviews, add participants, add agenda/findings |
| `manage_deliverables`   | internal | Principal Architect, Architect, Researcher, Project Administrator      | Draft deliverables, attach files, request approval                         |
| `manage_implementation` | internal | Principal Architect, Architect, Project Administrator (not Researcher) | Create/edit initiatives, update status, link evidence                      |

Publishing (making any of the three client-visible, or reaching an initiative's terminal status) always requires `publish_architecture`, unchanged and still Principal-Architect/Architect-only, still granted only by Principal Architects (ADR-0024 amendment, untouched). These three new capabilities give Project Administrators real, spec-chartered (§4) work in Reviews, Deliverables and Implementation without ever letting them touch architecture content or publish anything — resolving the §2.3(5) tension without weakening ADR-0024.

No new client capability. Clients read published Reviews/Deliverables/Implementation exactly as they read any published, client-visible element, under `view_architecture` — except confidential deliverables (§20), which also need `view_confidential_deliverables` (Phase 1, finally used).

### 12.2 RLS

No new pattern. `reviews`, `deliverables`, `implementation_initiatives` and `review_participants` follow the identical internal/client split every subtype table already follows: internal readers via engagement access, clients via `element_version_snapshot`/`client_snapshot` and `view_architecture` only, with `review_participants` (internal scheduling detail) carrying no client policy at all — the same treatment `intelligence_stewardship` gets.

---

## 13. Read models

| Function                                                         | Returns                                                                                                                                                                     | Access                                                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `review_register(engagement?)`                                   | Every review the caller may read, with participant and agenda counts                                                                                                        | internal: one or all engagements                                                               |
| `implementation_register(engagement?)`                           | Every initiative, with stewardship, escalation and evidence counts joined in — mirrors `intelligence_register`'s shape                                                      | internal: one or all engagements                                                               |
| `deliverable_register(engagement?)`                              | Every deliverable with its derived status (§6.3)                                                                                                                            | internal: one or all engagements                                                               |
| `client_reviews`, `client_deliverables`, `client_implementation` | Published, client-visible rows of each, in the same shape as `client_architecture` already returns for core elements                                                        | client, `view_architecture` (+ `view_confidential_deliverables` for confidential deliverables) |
| `implementation_impact(element, depth)`                          | What implements a given architecture element and what that implementation, in turn, threatens/depends on — reuses `intelligence_impact`'s traversal, scoped to `implements` | internal                                                                                       |

---

## 14. Architecture-learning/feedback loop

Covered in full in §7.4. Summarized for this section: the loop is not a new mechanism; it is the composition of Phase 5's new relationships (`implements`, `examines`, `raises`) with Phase 3/4's existing write path (`return_element_to_draft`, creating a Decision/Risk). Phase 5's contribution is making the loop _traceable_ — every step is a relationship or a version, never a note in someone's memory.

---

## 15. Internal UX

- **Engagement navigation** gains two items alongside the existing Architecture/Intelligence/Reviews structure: **Deliverables** and **Implementation**. The existing `/internal/engagements/[slug]/reviews` page is extended (not replaced) to also show scheduled/held sessions, keeping its current publish/approval queue content, which remains exactly correct for architecture generally.
- **Reviews page**: a session list (scheduled, held, cancelled), a review detail page showing agenda (`examines`), participants, findings (statements), and outcomes (`raises` targets and any approvals requested), with the existing publish/approval controls reused for making it client-visible.
- **Deliverables page**: a register (draft/internal review/client review/approved/superseded, derived per §6.3), filterable by type; a deliverable detail page showing its file, what it `documents`, and its approval state.
- **Implementation page**: an engagement register mirroring the Intelligence register's shape (status, attention, escalation, next review), filterable by status/category/owner; a cross-engagement `/internal/implementation` page mirroring `/internal/intelligence`.
- **On an architecture element's own page**: a new panel, "Implementation," listing any initiative that `implements` this element with its current status — the direct answer to Kerrick's question about what should appear on the element page once implementation exists. A "Reviewed in" panel lists reviews that `examine` this element. A "Documented in" panel lists deliverables that `document` it. All three follow the existing pattern already used for "Bearing on this element" (Phase 4).

---

## 16. Client UX

- **Reviews tab** (new, spec §7): published reviews in date order, each showing its summary, client-visible findings, and any approval requested on its baseline — reusing the existing approval-response UI.
- **Deliverables**: not necessarily a new top-level tab — spec's client nav already lists "Documents"; published deliverables appear there, alongside a deliverable-specific badge on the Overview ("2 deliverables pending your review"), reusing the existing Actions-tab pattern from Phase 4 for anything that needs a response.
- **Implementation tab** (new, spec §7): published initiatives grouped by the architecture element they implement, each showing status, target date (if client-visible) and any client-visible evidence citations — never internal stewardship, owner assignments or sub-initiative scheduling detail.
- Consistent with Phases 3–4's UX direction throughout: calm, typographic, no progress bars invented beyond the existing five-value maturity/status vocabularies, no graph visualization, contextual relationships shown as linked lists exactly as Phase 4 already renders "Bearing on this element."

---

## 17. Integration with Phase 4 Project Intelligence

Detailed throughout (§7.3 especially). In one line: Implementation Initiatives are Project-Intelligence-adjacent (reuse stewardship/history/escalation/signals) without being Project Intelligence records (excluded from `intelligence_register`); Reviews and Deliverables are architecture-adjacent (reuse lifecycle/versioning/publication/approval) without being either. Nothing Phase 4 built changes shape; three of its tables and one of its functions widen their accepted-kind set.

---

## 18. Testing strategy

Following the Phase 3/4 pattern exactly:

- **New pgTAP suites**: `16_reviews.test.sql`, `17_deliverables.test.sql`, `18_implementation.test.sql` — capability matrix, lifecycle/publication reuse, relationship-rule enforcement for the new types, the widened stewardship/history/escalation/signal behavior for initiatives, client visibility (including `confidential` deliverables), and a concurrency suite (`99_implementation_concurrency.test.sql`, mirroring `99_intelligence_concurrency.test.sql`) for simultaneous status changes and escalations.
- **TypeScript**: a `catalog.test.ts`-style dynamic mirror check for the new categories/enums, `register.test.ts`-equivalent unit tests for `implementation_register` filtering/ordering.
- **`vocabulary.test.ts`** extended to check the new relationship types and pairings against the migration, exactly as it already does for all 33.
- No Playwright suite planned, consistent with the known limitation already accepted for Phases 1–4.

---

## 19. Seed changes

Extend `supabase/seed.sql` with: one held, published Executive Review on the seeded engagement (with participants and a finding); one approved Deliverable (Executive Summary) documenting a couple of seeded elements; two or three Implementation Initiatives against seeded Capability/Application objects at different statuses (`in_progress`, `operational`), one with a sub-initiative via `part_of`, one escalated, to exercise every new UI state in local development.

---

## 20. Relationship to Phases 6–9

Unchanged from Phase 4's own framing, restated for this phase: Phase 5 captures structure (relationships, evidence, findings) that Phase 6 (Method Library) will draw templates from, Phase 7 (Architecture Intelligence) will analyze, and Phase 8 (Portfolio Intelligence) will aggregate across engagements. None of that analysis, templating or aggregation is built now. The `confidential` flag on deliverables and the IP-classification field every element already carries (ADR-0016) are the seams Phase 6's pattern library will eventually use to decide what may leave an engagement — already sufficient, so nothing new is added for that purpose now.

---

## 21. Difficult-to-reverse decisions

1. **Adding `review`, `deliverable`, `implementation_initiative` as permanent `element_kind` values.** Like every prior kind, this is permanent — Postgres enum values are never removed (ADR-0024's own reasoning).
2. **Implementation Initiative reusing (not duplicating) Phase 4's stewardship/history/escalation/signal tables**, by widening their kind-check constraints rather than building parallel Phase-5-only tables. This is the single biggest structural bet in this proposal — it keeps the system smaller and more consistent, but it does mean Phase 4's tables now serve two conceptually different purposes (intelligence about the architecture, and status of realizing it) under one roof. The alternative (a fully parallel `implementation_stewardship`/`implementation_status_changes`/`implementation_escalations` set) was rejected as pure duplication contrary to Kerrick's brief, but is recorded here as the fallback if review finds the shared tables get confusing in practice.
3. **New reference prefixes `REV`, `DLV`, `IMP`** — permanent and cited by clients and documents, per ADR-0025.
4. **New relationship types are permanent** once elements exist that use them (ADR-0018).
5. **Three new internal capabilities**, extending who can touch what without extending `edit_architecture`/`publish_architecture` themselves — a new, permanent authorization surface (enum values, ADR-0024's own reasoning).
6. **`implementation_initiative`'s exclusion from `intelligence_register`.** Reversing this later (folding initiatives into the intelligence register) would change what every "how many open items" count on the existing Intelligence pages means.

---

## 22. Explicit decisions requiring approval

| #   | Decision                                                                                                                                                                                                                                                                                                                                                       | Recommended                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| D1  | Adopt three new element kinds (`review`, `deliverable`, `implementation_initiative`) on the existing spine, rather than separate non-element tables?                                                                                                                                                                                                           | **Yes** — reuses proven infrastructure end to end (§3)           |
| D2  | Implementation Initiative reuses/widens Phase 4's stewardship, history, escalation and signal tables rather than getting its own parallel set?                                                                                                                                                                                                                 | **Yes**, with the fallback in §21.2 noted if it proves confusing |
| D3  | Implementation Initiative is excluded from `intelligence_register` (it gets its own `implementation_register`)?                                                                                                                                                                                                                                                | **Yes** — different question, different register (§3)            |
| D4  | Reference prefixes: `REV` (review), `DLV` (deliverable), `IMP` (implementation initiative)?                                                                                                                                                                                                                                                                    | **Yes**, or specify alternatives                                 |
| D5  | New relationship types: `examines`, `raises`, `documents`, `implements`, `initiates` — approve the set and the pairings in §4.2?                                                                                                                                                                                                                               | **Yes**, with any wording changes wanted                         |
| D6  | Three new internal capabilities (`manage_reviews`, `manage_deliverables`, `manage_implementation`) with the default holders in §12.1, deliberately giving Project Administrators scoped access without `edit_architecture`/`publish_architecture`?                                                                                                             | **Yes** — resolves the §2.3(5) spec tension cleanly              |
| D7  | Deliverable status is fully derived from existing lifecycle + approval (no new status field), per §6.3?                                                                                                                                                                                                                                                        | **Yes** — avoids a second, redundant status axis                 |
| D8  | Implementation status values: `not_started`, `in_progress`, `operational`, `validated`, `stalled`, `abandoned`, with `validated`/`abandoned` terminal?                                                                                                                                                                                                         | **Yes**, or specify alternatives                                 |
| D9  | Milestones/checkpoints represented only as `part_of`-decomposed sub-initiatives, never a dedicated milestone table?                                                                                                                                                                                                                                            | **Yes** — matches "not a task tracker" (§1.3)                    |
| D10 | `view_confidential_deliverables` (dormant since Phase 1) gates a new `confidential` boolean on deliverables; confirm its existing default holders (System Administrator, Principal Architect, Architect, Researcher, Project Administrator internally; Executive Sponsor, Client Project Lead on the client side) still make sense now that it does something? | **Confirm as-is**, or adjust                                     |
| D11 | One new deterministic signal, `implementation_stalled`/`implementation_past_target`, added to `intelligence_signals()`?                                                                                                                                                                                                                                        | **Yes**, or defer signal work entirely to a later pass           |
| D12 | Confirm Phase 5 proceeds under this brief's framing (governance of realizing approved architecture) rather than master spec §31's narrower "Client Experience" framing, per §2.3(1)?                                                                                                                                                                           | **Confirm**                                                      |

---

## 23. Build order once approved

Following the Phase 3/4 precedent (schema and domain layer first, then internal UI, then client UI, then docs):

1. Enum migration (`element_kind` additions, new enums, `engagement_file_purpose` addition).
2. Main Phase 5 migration: `reviews`, `review_participants`, `deliverables`, `implementation_initiatives`; widened `intelligence_categories`, `intelligence_stewardship`, `intelligence_status_changes` triggers, `intelligence_escalations`, `intelligence_terminal_statuses`/`intelligence_active_statuses`, `intelligence_signals()`; new relationship types and regenerated `relationship_rules`; new capabilities and `role_capability_defaults`; operations; read models.
3. `src/domain/reviews/`, `src/domain/deliverables/`, `src/domain/implementation/` domain layers (schemas, queries, actions), plus the `src/domain/architecture/vocabulary.ts` and `src/domain/intelligence/catalog.ts` mirror updates and their dynamic tests.
4. pgTAP suites 16–18 and the concurrency suite.
5. Internal UI: Reviews (extend existing page), Deliverables, Implementation (engagement + cross-engagement), element-page panels.
6. Client UI: Reviews tab, Documents/Deliverables surfacing, Implementation tab.
7. Seed data, `docs/database/reviews-deliverables-implementation.md` (or split per area), README/rls.md updates, `PHASE_5_REPORT.md`.
8. Full verification: `pnpm check`, `pnpm build`, `npx supabase db reset`, `npx supabase test db`, `pnpm db:types` — same bar as every prior phase.

---

**Next step:** Kerrick reviews §21–22 and responds with decisions (approve as recommended, or amend). No migration or code is written until that response arrives.
