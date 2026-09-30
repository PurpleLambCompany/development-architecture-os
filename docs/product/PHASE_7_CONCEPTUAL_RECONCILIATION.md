# Phase 7 Conceptual Reconciliation

## Architecture Intelligence, the Living Development Model and the Development Edge

**Status:** Conceptual reconciliation for Kerrick's review. This is **not** `PHASE_7_PROPOSAL.md`.
**Inspected:** `main` at `90ee72e` (Phase 6 complete and merged, PR #7 and PR #8).
**Date:** 2026-09-30

This document reconciles the product direction in Kerrick's Phase 7 brief with the system that actually exists after Phases 1–6. It creates no migration, schema, enum, ADR, code, UI, AI service, provider SDK, embedding or vector store, and it changes no Phase 1–6 behavior. Where a question is difficult, it is surfaced in §37 (Q1–Q28) rather than settled.

### How to read the evidence in this document

Claims about the current system cite the file that establishes them. Three kinds of claim are distinguished throughout:

- **Verified:** read directly from a migration, read model, ADR or page on `main`.
- **Derivable:** not built, but computable today from existing tables with ordinary SQL, without schema change. These were reasoned from the schema, not executed; §38 recommends executing them before the proposal.
- **Inferred:** a judgment about product direction, labeled as such.

Terms from the brief (DSA IDE, Living Development Model, Architecture Intelligence, Development Edge, Intelligence Contract, Edge lenses, intelligence levels) are used as **working terms** for this reconciliation only. Q1 asks whether they enter repository terminology.

---

## 1. Executive conclusion

1. **The Living Development Model already substantially exists.** Phases 1–6 built a governed, typed, versioned and append-only representation of a development: one element spine carrying 27 core object types and ten record kinds (seven Project Intelligence kinds, Review, Deliverable, Implementation Initiative) (ADR-0013, ADR-0026, ADR-0034), 39 typed and rule-checked relationships (ADR-0018), immutable published versions and baselines (ADR-0014, ADR-0021), statement-level provenance and evidence stance (ADR-0015), append-only record, implementation and methodology histories (ADR-0028, ADR-0039, ADR-0043), a gated path from architecture to validated operating reality (ADR-0035, ADR-0036), criteria captured at the moment of validation (ADR-0046), and version-pinned practice provenance (ADR-0043, ADR-0047). No new graph store, materialized model or duplicate data model is needed to have a Living Development Model. **What is missing is the interpretive layer over it**, not the model itself (§4).

2. **The strongest Phase 7 opportunity is deterministic, not generative.** Forty-four meaningful conditions can be derived today with SQL over existing tables (§11). Only eleven exist as rules (ten Phase 4 intelligence signals and one Phase 5 implementation signal, each with the fingerprinted dismissal mechanism). The most valuable un-built ones concern **Realization** and **Change** across phase boundaries: architecture revised after it was validated, implemented or agreed against; approved architecture with no implementation pathway; evidence that arrived after a Review; Deliverables documenting elements revised since their baseline. These are exactly the conditions a general-purpose AI conversation cannot see, because they depend on authoritative version history and timing rather than on reading documents.

3. **The Claude Test is passed by structure, and only by structure** (§5). A sophisticated user exporting documents into a frontier model can reproduce summarization, contradiction-spotting within a document set, drafting and most one-shot reasoning. They cannot reproduce continuous change awareness against authoritative, version-pinned, permission-scoped state; the validation gate; longitudinal provenance; or governed promotion. DSA's advantage must therefore be built on those, with AI as an interpreter over them. Any Phase 7 capability whose value lives mainly in the LLM output should be treated as a convenience, not a moat.

4. **Phase 4 Signals should be kept, generalized under a common envelope, and consumed by the Development Edge, not superseded or duplicated** (§12). Signals are the Level 1–2 deterministic substrate. The Edge is an experience that composes signals, impact, change and (later) inference, contextually. The Phase 4 precedent that "facts are computed; only human judgments are stored, keyed by a fingerprint of the facts" is the right foundation for the whole intelligence lifecycle.

5. **Five structural gaps matter** (§36): (a) no unified, capability-aware change stream across Phases 3–6 (the curated `architecture_activity` read model stops at Phase 4 tables, and raw `activity_log` is readable only by System Administrators and Principal Architects); (b) two impact traversals with fixed, different relationship subsets that miss incoming Project Intelligence, Acceptance Criteria, Reviews, Deliverables and Method Applications; (c) no common envelope, first-observed time or epistemic status for surfaced intelligence; (d) no per-user "briefed through" state; (e) no data-use classification governing whether an engagement's records may be sent to an AI provider or learned from across engagements. None requires redesigning Phases 1–6.

6. **One ADR needs reconciliation before any AI design**: ADR-0032 (and Phase 4 proposal §11) pre-commits that "future AI findings will be stored, not computed, with `ai_analysis` provenance and the Phase 3 review gate". That was written before the distinctions in this brief (ephemeral assistance versus durable inference; intelligence observation versus architecture content). §35 recommends an amendment note, not a reversal (Q16).

7. **Recommended conceptual shape of Phase 7** (inferred, for decision): an internal-only, deterministic-first Development Edge for Engagement Intelligence (conditions, impact, change awareness, contextual panels, judgment lifecycle), with AI inference admitted only as a bounded, explicitly labeled, persisted-on-election layer after the deterministic layer exists. Clients receive nothing new automatically. Cross-engagement learning, Pattern Library, Portfolio Intelligence and scenario simulation wait. Whether AI enters Phase 7 at all, or a later sub-phase, is Q17.

---

## 2. Current-system findings

### 2.1 What exists, by phase

| Phase                                   | What it contributes to a Living Development Model                                                                                                                                                                                                                                                                                                    | Key sources                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1 Foundation                            | Organizations, engagements, per-membership roles, capability defaults and overrides, `activity_log` (append-only, full before/after row JSON)                                                                                                                                                                                                        | `20260929230000_phase1_foundation.sql`, ADR-0007, ADR-0008            |
| 2 Commercial                            | Contracts, milestones, invoices, payments; kept one-way from architecture                                                                                                                                                                                                                                                                            | ADR-0023                                                              |
| 3 Architecture Core                     | Element spine, 27 core object types, six record kinds, 31 typed relationships with rules and acyclicity, statements with provenance, evidence sources and stance-bearing links, immutable versions with full and client snapshots, approvals pinned to versions, baselines, `compare_baselines`, domain assessments, curated `architecture_activity` | `docs/database/architecture.md`, ADR-0013–0025                        |
| 4 Project Intelligence                  | Opportunity kind, `advances`/`pursues`, stewardship (attention, triage, next review), append-only `intelligence_status_changes`, escalations, client actions and contributions, contributor areas, engagement files, **ten deterministic signals with fingerprinted dismissals**, `intelligence_impact`                                              | `docs/database/intelligence.md`, ADR-0026–0033                        |
| 5 Reviews, Deliverables, Implementation | Review, Deliverable and Implementation Initiative kinds; `examines`, `raises`, `documents`, `implements`, `initiates`, restricted-write `validates`; separate implementation stewardship, history, escalation and dismissals; checkpoints; one signal; `implementation_impact`                                                                       | `docs/database/reviews-deliverables-implementation.md`, ADR-0034–0040 |
| 6 Method Library                        | Five method forms, immutable versions, DAM releases, Development Contexts, off-spine Method Applications with element and evidence links, stage treatments and closure, Acceptance Criteria captured at validation, typed version-pinned lineage                                                                                                     | `docs/database/method-library.md`, ADR-0041–0050                      |

### 2.2 Properties that hold everywhere and matter for intelligence

- **The database is the authority.** Every state change goes through an operation that checks capability (42501), rule (23514) or visibility (P0002). Intelligence can therefore rely on the state it reads being governed.
- **Permissions are capabilities, never role names.** Internal readers see engagements by assignment (System Administrators and Principal Architects see all). Any intelligence computed "as the user" inherits this through `security invoker` read models.
- **Publication is the client boundary.** Clients never read live tables; they read immutable `client_snapshot`s (ADR-0014). Working copies, stewardship, signals, lineage, Method Applications and the Method Library have no client policy at all.
- **Separate status axes.** Lifecycle, approval, object maturity, domain maturity, record status and implementation status are kept apart (ADR-0020). Intelligence must never collapse them.
- **Judgment is attributed, never computed.** Domain maturity is a dated architect judgment beside a labeled "Calculated" distribution (ADR-0019). This is the clearest existing precedent for how DSA should show derived intelligence next to human judgment.
- **Signals are computed; judgments are stored.** Phase 4 and 5 signals are evaluated on read. Only a dismissal is stored, with a reason, an optional expiry and a fingerprint of the facts, so a signal returns when its facts change (ADR-0032).
- **No elapsed-time stall inference.** Phase 5 D16 refused to infer "stalled" from elapsed time; stalling is a stated fact with a rationale. This constrains Foresight (§8, Q21).
- **No AI of any kind exists.** `package.json` has no model-provider SDK. `ai_analysis` provenance and `ai_review_state` (`not_applicable`, `pending`, `accepted`, `rejected`) exist on elements and statements, and `review_ai_content` exists, but nothing creates AI content.

### 2.3 What the user sees today (verified from `src/app`)

| Surface                                              | Existing intelligence-like content                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internal landing (`/internal`)                       | Active engagements; "Recent activity" from raw `activity_log`, shown only to roles that can read it                                                                                                                                                                                         |
| Engagement overview (`/internal/engagements/[slug]`) | Engagement facts, architecture summary, team, capabilities, contributor areas, finances. No intelligence                                                                                                                                                                                    |
| Element detail                                       | Stewardship (records) or **"Bearing on this element"** (open records related to it), Decision, Statements, Relationships, Versions, **Impact trace** (up to three steps, "a trace to read, not a score"), Implementation, Reviewed in, Documented in, Criteria, Practice, History, Activity |
| Signals (`/intelligence/signals`)                    | The ten Phase 4 rules, "a prompt to look, never a conclusion", with dismissal                                                                                                                                                                                                               |
| Implementation initiative                            | Status history, stewardship, checkpoints, evidence, Impact, Activity; implementation signal on the register                                                                                                                                                                                 |
| Review detail                                        | Session, participants, agenda (examined elements), validation with criteria captured, Activity                                                                                                                                                                                              |
| Method Application                                   | Stages with treatments, inputs, components, outputs, addenda                                                                                                                                                                                                                                |
| Cross-engagement registers                           | `/internal/intelligence` ("nothing is compared or scored across them"), `/internal/implementation`, `/internal/reviews`                                                                                                                                                                     |
| Client portal overview                               | Project snapshot, "Where we are in the architecture", "What is required from us", "Delivered and implemented", financial snapshot                                                                                                                                                           |

The interface already has the language the brief asks for: "a prompt to look, never a conclusion", "a trace to read, not a score", "Calculated" beside judgment. The Development Edge should continue that voice.

---

## 3. DSA IDE fit

**Working definition (brief §1):** an Integrated Development Environment for real-world systems, moving developmental intent from Concept → Architecture → Implementation → Evidence → Review → Operating Reality → Learning.

### 3.1 How the existing system maps to that arc

| Arc stage         | Existing structures                                                                                                                 | Fit                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Concept           | Engagement objective and description; Intended Outcome objects; Research Questions; Knowledge Gaps                                  | Present, but begins inside an engagement created by TPLCo. There is no pre-engagement "I want to develop…" entry |
| Architecture      | Four domains, 27 core types, typed relationships, statements, versions, baselines, domain judgments                                 | Strong                                                                                                           |
| Implementation    | Implementation Initiatives (`implements`, `initiates`), checkpoints, implementation status                                          | Strong                                                                                                           |
| Evidence          | Evidence sources, statement links with stance, element links, files, client contributions promoted to evidence                      | Strong                                                                                                           |
| Review            | Reviews (`examines`, `raises`), approvals pinned to versions, `validates` gate, criteria captured                                   | Strong                                                                                                           |
| Operating Reality | `operational`, `validated` status; `actual_operational_on`; checkpoints achieved with evidence                                      | Present; reality is recorded as human assertions plus evidence, which is correct                                 |
| Learning          | Assumption validation history, dismissal reasons, Method Application stage treatments, learning sources on method versions, addenda | Present at practice level; no architecture-level learning loop and no cross-development learning (intended)      |

### 3.2 Assessment

The existing architecture supports the IDE paradigm well, because it already treats development as governed computational state rather than documents (spec §3). The analogy holds in specific ways that are worth keeping precise (inferred):

- **Source and build:** working copies versus immutable published versions and baselines.
- **Type system:** the object vocabulary, relationship rules and acyclicity checks, which already refuse ill-formed architecture at write time.
- **Tests:** Acceptance Criteria and the `validates` gate.
- **Diagnostics:** signals, which are the IDE's "problems" pane.
- **Go to references / find usages:** Bearing, Impact, Reviewed in, Documented in, Practice panels.
- **History / blame:** versions, status histories, activity.

The analogy breaks where it should: real-world development has no compiler, correctness is judged by people, and "operating reality" is asserted and evidenced rather than executed. The IDE framing should never imply that DSA verifies reality.

**Domain-agnosticism.** Nothing in Phases 1–6 hard-codes a sector. Development Context is a governed, empty-in-migration table (ADR-0045), and the object vocabulary is methodological rather than sector-specific. The main assumptions that narrow the paradigm are about _who operates it_ (TPLCo, §25), not _what is developed_.

**Recommendation:** accept DSA IDE as a product paradigm without renaming Phase 1–6 structures (Q1). The spec's product name is "Development Systems Architecture OS"; whether "IDE" replaces or sits under "OS" is a naming decision with documentation-wide consequences, not a schema one.

---

## 4. Living Development Model findings

**Working definition:** the continuously interpretable, governed computational representation of a development, its current state, relationships, realization, evidence and history.

**Answer: yes. DSA already possesses the structural ingredients of a Living Development Model**, as a property of relationships among existing primitives. It does not need a new table, graph database or materialized object.

### 4.1 The ingredients, precisely

| Brief's ingredient                                                                 | Where it lives                                                                                                                                                                                             | Connected by                                                                                                        | Temporal/immutable form                                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Engagement                                                                         | `engagements`                                                                                                                                                                                              | Every table's `engagement_id`, composite same-engagement FKs                                                        | `activity_log`                                                                        |
| Development Context                                                                | `development_contexts`, `engagement_development_contexts`, `method_application_contexts`                                                                                                                   | Engagement, application snapshot                                                                                    | `development_context_revisions` (append-only); application snapshot frozen at closure |
| Intended Outcomes                                                                  | `architecture_objects` (type `intended_outcome`)                                                                                                                                                           | `serves`, `measured_by`, `advances`, `affects`                                                                      | `element_versions`                                                                    |
| Architecture elements                                                              | `architecture_elements` + subtypes                                                                                                                                                                         | All relationship types                                                                                              | `element_versions` (full and client snapshots)                                        |
| Architecture relationships                                                         | `architecture_relationships`                                                                                                                                                                               | Rules table; acyclic types                                                                                          | `created_at`, `published_at`, `retired_at` with reason; captured in frozen baselines  |
| Versions                                                                           | `element_versions`                                                                                                                                                                                         | Approvals, baselines, contributions (`element_version_id`), Method Application `observed_version_id`                | Immutable                                                                             |
| Baselines                                                                          | `architecture_baselines`, `_items`, `_relationships`, `_assessments`                                                                                                                                       | Reviews and Deliverables (`baseline_id`), approvals                                                                 | Frozen                                                                                |
| Provenance                                                                         | `provenance` on elements, statements, relationships; `ai_review_state`                                                                                                                                     | Eight-value closed enum (ADR-0009)                                                                                  | Provenance changes audited                                                            |
| Method Assets / DAM releases                                                       | `method_assets`, `method_asset_versions`, `dam_releases`, `dam_release_members`                                                                                                                            | `engagements.dam_release_id`                                                                                        | Published versions and releases frozen                                                |
| Method Applications                                                                | `method_applications` + link tables                                                                                                                                                                        | `method_application_elements` (roles), `_evidence`, `_assets`                                                       | Frozen at closure; addenda append-only                                                |
| Project Intelligence                                                               | Seven record kinds on the spine                                                                                                                                                                            | `underpins`, `threatens`, `constrains`, `mitigates`, `affects`, `addresses`, `advances`, `pursues`; dependency ends | `intelligence_status_changes`                                                         |
| Client Actions                                                                     | `client_actions`, `_subjects`, `_responses`, `_events`                                                                                                                                                     | Subjects are published client-visible elements                                                                      | `client_action_events`                                                                |
| Evidence                                                                           | `evidence_sources`, `statement_evidence_links` (stance), `element_evidence_links`, `engagement_files`                                                                                                      | Statements, elements, applications, checkpoints, criteria agreement                                                 | `created_at`; files immutable in storage                                              |
| Decisions                                                                          | `decisions`, `decision_options`                                                                                                                                                                            | `affects`, `initiates`, `pursues`, `mitigates`                                                                      | Frozen when decided; outcome with `client_decision` provenance                        |
| Assumptions / Risks / Constraints / Dependencies / Recommendations / Opportunities | Subtype tables                                                                                                                                                                                             | See Project Intelligence                                                                                            | Status history                                                                        |
| Signals                                                                            | `intelligence_signals()`, `implementation_signals()`                                                                                                                                                       | Rule over live state                                                                                                | Computed; dismissals stored                                                           |
| Implementation Initiatives                                                         | `implementation_initiatives`                                                                                                                                                                               | `implements`, `initiates`, `validates`, `mitigates`                                                                 | `implementation_status_changes`                                                       |
| Implementation Checkpoints                                                         | `implementation_checkpoints`                                                                                                                                                                               | Evidence source, Review, approval references                                                                        | Timestamps                                                                            |
| Acceptance Criteria                                                                | `acceptance_criteria`, `validation_criteria`                                                                                                                                                               | Governed element; captured at validation                                                                            | Frozen on agreement; supersession chain                                               |
| Reviews                                                                            | `reviews`, `review_participants`                                                                                                                                                                           | `examines`, `raises`, `validates`, optional baseline                                                                | Held timestamp                                                                        |
| Deliverables                                                                       | `deliverables`                                                                                                                                                                                             | `documents`, optional baseline, `produced_from` lineage                                                             | Versions and approvals                                                                |
| Validation                                                                         | `validates` relationship + `validation_criteria`                                                                                                                                                           | Review → Initiative                                                                                                 | Written once, by one operation                                                        |
| Append-only histories                                                              | `intelligence_status_changes`, `implementation_status_changes`, `client_action_events`, `domain_assessments`, `development_context_revisions`, `method_application_addenda`, `method_asset_rights_holders` | Per record                                                                                                          | Guard triggers refuse update/delete                                                   |
| Publication                                                                        | `element_versions`, relationship auto-publication                                                                                                                                                          | Client read models                                                                                                  | Immutable                                                                             |
| Activity / change                                                                  | `activity_log` (all phases, by trigger)                                                                                                                                                                    | Entity type and id                                                                                                  | Append-only; full row JSON                                                            |

### 4.2 What makes it "living"

A model is living when three questions can be answered about it at any time, from authoritative data: _what is true now_, _what was true then_, and _what changed between_. DSA answers the first comprehensively, the second through versions, baselines and histories, and the third partially:

- **Element-level change** is fully recoverable (versions, `compare_baselines`, status histories).
- **Engagement-level change across phases** is recorded in `activity_log` for every phase, but the only curated, capability-aware reader (`architecture_activity`, last defined in `20261002000100_project_intelligence.sql`) knows Phase 3–4 entity types only. Reviews, Deliverables, Implementation, Acceptance Criteria and Method Applications are logged but not readable as curated change by Architects and Researchers.
- **Relationship-level time** exists (`created_at`, `published_at`, `retired_at`), but relationships pin no element version. "Implemented against which version?" and "validated against which version?" are answerable only by comparing timestamps (Derivable), except where Phase 6 captured versions explicitly (`observed_version_id`, `validation_criteria`).

### 4.3 Gaps, without duplication

1. A **curated, capability-aware change stream** covering Phases 3–6 (extend the existing read model pattern; do not build event sourcing). See §14.
2. A **unified impact traversal** that walks both directions and all governance links (extend the two existing recursive functions; no graph store). See §13.
3. An **intelligence envelope** (what, why, basis, epistemic status, first observed) over existing signals. See §10, §12.
4. **Per-user developmental state** limited to an explicit "briefed through" watermark. See §14, §14.5.
5. **Version correspondence** for `implements` and `validates` is derivable from timestamps; whether to pin versions later is Q26, not a Phase 7 prerequisite.

The Living Development Model should remain a **concept and an access pattern**, not an object. Materializing it would duplicate the spine and invite drift between the model and the governed records.

---

## 5. Structural Advantage and the Claude Test

**Test (brief §2, §37):** a core DSA capability is not complete if its principal value can be reproduced through a well-prompted general-purpose AI conversation. Assume general AI keeps improving rapidly.

### 5.1 What general AI will do well, regardless of DSA

Given exported documents, a frontier model can summarize evidence, extract assumptions, spot contradictions within the supplied text, propose missing capabilities, draft deliverables and executive briefs, suggest risks, and reason about "what if" in prose. It will do this increasingly well. Spec §18's list of future capabilities ("summarize evidence", "identify knowledge gaps", "draft deliverables") is, taken alone, reproducible.

### 5.2 What it structurally lacks

A conversation over exports has no authoritative state, no memory of what was true at a governed moment, no enforcement, no permission boundary, and no continuity. Specifically, it cannot:

1. **Know what is authoritative.** It cannot tell a working draft from a published version, a proposed criterion from an agreed one, or an unreviewed AI statement from an accepted one, unless the export says so, and nothing keeps the export current.
2. **Detect change continuously.** It sees a snapshot. It cannot notice that a capability was revised two days after the initiative implementing it was validated.
3. **Traverse typed, governed relationships.** It infers relationships from prose; DSA stores 39 typed, rule-checked ones and can traverse them exactly.
4. **Respect permission and confidentiality boundaries.** It sees whatever was pasted. DSA assembles context as the user, through RLS, per engagement.
5. **Hold longitudinal provenance.** It cannot say who asserted what, on what evidence, under which Method version and DAM release, and what it replaced.
6. **Enforce governance.** It cannot prevent a validation without a held Review, or a publication of unreviewed AI content.
7. **Accumulate promoted learning.** It can remember a user's chats, not a practice's governed, rights-reviewed learning.

### 5.3 Claude Test applied to candidate capabilities

| Capability                        | Reproducible by export + prompt?                                                | DSA advantage required for it to count                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summarize evidence for an element | Yes                                                                             | Only as convenience. Advantage comes if the summary is scoped by stance, provenance and version, and cites governed records                                 |
| Detect unsupported assumptions    | Mostly                                                                          | Deterministic: assumption `underpins` published elements, validation status, evidence stance, confidence, status history (Phase 4 signal already does part) |
| Detect contradictions             | Within a document set, yes                                                      | `conflicts_with` records, `contradicts` stance, invalidated assumptions still underpinning, superseded elements still referenced. Structural, continuous    |
| Impact analysis "if X changes"    | Approximately, if the whole architecture is exported and the model infers links | Exact typed traversal across architecture, records, implementation, criteria, reviews, deliverables and practice, as the user, on current state             |
| "What changed since I was away"   | No                                                                              | Requires authoritative change history and a per-user watermark                                                                                              |
| Realization correspondence        | No                                                                              | Version and timing correspondence between architecture, implementation, validation and criteria                                                             |
| Draft a deliverable               | Yes                                                                             | Only if generated from published versions with lineage to the Template (`produced_from`) and cited records; otherwise a convenience                         |
| Prepare an executive review brief | Largely                                                                         | Advantage: "what changed since the review baseline", open escalations touching examined elements, decisions due, criteria in force                          |
| Suggest relevant methods          | Yes, generically                                                                | Advantage: Development Context, declared applicability, where a method was applied and how it was adapted (internal practice data)                          |
| Recurring-pattern insight         | Only within what one user pasted                                                | Governed, promoted, rights-reviewed cross-development learning (later phases)                                                                               |
| Conversational Q&A                | Yes, over exports                                                               | Advantage exists only if answers are grounded in live, permission-aware, cited state and distinguish epistemic status                                       |

### 5.4 Conclusion

DSA's defensibility is **the development living computationally in DSA**: authoritative state, continuous change, exact traversal, governed transitions, permission-aware assembly and accumulated provenance. AI should be treated as an interpreter over that model, replaceable by a better one tomorrow. A Phase 7 whose centerpiece is AI output (summaries, drafts, chat) would fail the test; a Phase 7 whose centerpiece is the deterministic Edge over the Living Development Model, with AI interpreting it, passes. This is also the only strategy robust to model improvement: better models make the second strategy stronger and the first weaker.

---

## 6. Development Edge model

**Working definition:** the contextual experience through which DSA IDE surfaces what matters, what changed, what is emerging, what may be misaligned, and what deserves human judgment.

### 6.1 What the Edge is and is not

The Edge is an **experience layer**, not a record type or a table. It composes:

| Source                                                                                                  | Level          | Exists today                        |
| ------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------- |
| Deterministic conditions (signals, generalized)                                                         | 1–2            | Partially (11 rules)                |
| Impact traces                                                                                           | 2              | Partially (two functions)           |
| Change awareness                                                                                        | 1–2            | Recorded, not curated across phases |
| Governance proximity (reviews scheduled, decisions due, criteria awaiting agreement, approvals pending) | 1              | Data exists; not composed           |
| Human stewardship (attention, triage, escalation)                                                       | Human judgment | Yes                                 |
| AI inference                                                                                            | 3–4            | No                                  |

Relationships to the things the brief says the Edge is not:

- **Phase 4 Signals** are one input. The Edge consumes them (§12).
- **Notifications:** the Edge does not push. DSA has no email or notification infrastructure today; Phase 7 should not introduce push for intelligence (§14, Q24).
- **Dashboard:** the Edge appears contextually on existing pages and as one briefing; it is not a new metrics page.
- **AI chat:** conversational access, if any, sits on top of the Edge and the model (§19).
- **A new Project Intelligence kind:** intelligence observations are not records. A Risk is a governed claim someone owns; an observation is a prompt to look. Promotion (§16) is the bridge.

### 6.2 Where the Edge operates

Engagement level (briefing and ordered conditions), and contextually on Architecture elements, Implementation Initiatives, Reviews, Method Applications, Evidence, Decisions and Deliverables (§15). A cross-engagement internal landing may show _which engagements have something_ for the user, but never compares engagements (consistent with `/internal/intelligence`: "nothing is compared or scored across them").

---

## 7. Edge lenses

The six lenses are useful as an **internal organizing and UX grouping**, not yet as stored classification (brief: no permanent enums). Each lens answers a different question the architect actually asks, and every candidate in §11 maps to one primary lens. The table assesses derivability of the brief's examples.

| Lens        | Example (brief)                                                      | Derivable today?                                                                       | Basis                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integrity   | Architecture relationships no longer align                           | Partly                                                                                 | Relationships to retired/superseded elements are filtered from traces; relationships whose end was superseded remain as rows (derivable). "Align" in a semantic sense is inference |
| Integrity   | Assumption underlying approved architecture contradicted             | Yes                                                                                    | `underpins` + `validation_status = invalidated` (Phase 4 signal, without "approved" filter); or `contradicts` evidence on the assumption's statements while unvalidated (new)      |
| Integrity   | Acceptance Criteria may no longer correspond to revised architecture | Yes                                                                                    | Agreed criterion `agreed_on` earlier than governed element's latest `element_versions.published_at`                                                                                |
| Integrity   | Dependent architecture has changed                                   | Yes                                                                                    | `requires`/`part_of`/dependency ends where target published a newer version after source's latest version                                                                          |
| Realization | Approved architecture has no implementation pathway                  | Yes                                                                                    | Latest version approved; no incoming `implements`; for capabilities, also no `implemented_through`                                                                                 |
| Realization | Implementation operating but not validated                           | Yes                                                                                    | `implementation_status = operational`, no `validates` (state fact, no elapsed-time threshold)                                                                                      |
| Realization | Implementation corresponds to superseded architecture                | Yes                                                                                    | `implements` target lifecycle `superseded`/`retired`; or target revised after the `implements` relationship or validation                                                          |
| Realization | Evidence does not sufficiently support an operating claim            | Partly                                                                                 | "No evidence cited on an operational initiative" is derivable; "sufficiently" is judgment or inference                                                                             |
| Change      | Architecture revision affects active implementation                  | Yes                                                                                    | Published version after `implements` created, initiative active                                                                                                                    |
| Change      | Evidence arrived after a Review                                      | Yes                                                                                    | Evidence linked to examined elements with `created_at > held_at`                                                                                                                   |
| Change      | A Decision changed a condition relied on elsewhere                   | Partly                                                                                 | Decision `decided_at` later than latest version of elements it `affects` (derivable); "relied on" semantics beyond typed links is inference                                        |
| Change      | Methodology changed after an application                             | Yes                                                                                    | Pinned Method version superseded while application open; engagement release changed after application start                                                                        |
| Exposure    | Unresolved dependencies converge on one element                      | Yes                                                                                    | Count of blocking unsatisfied dependencies by `to_element_id`                                                                                                                      |
| Exposure    | Escalated risks affect an upcoming Review                            | Yes                                                                                    | Open escalation on risk that `threatens` an element a scheduled Review `examines`                                                                                                  |
| Exposure    | Critical assumptions remain unsupported                              | Yes, if "critical" means human attention `critical`/`high` or `impact_if_false` stated | Stewardship attention + validation status + no `supports` evidence                                                                                                                 |
| Exposure    | Constraints affect multiple implementation paths                     | Yes                                                                                    | In-force constraint `constrains` ≥2 initiatives or elements implemented by distinct initiatives                                                                                    |
| Potential   | Opportunity may satisfy an unrealized capability                     | Partly                                                                                 | Open opportunity `advances` a capability with no implementing initiative (derivable); "may satisfy" beyond that link is inference                                                  |
| Potential   | One capability supports multiple outcomes                            | Yes                                                                                    | Capability `serves` ≥2 Intended Outcomes                                                                                                                                           |
| Potential   | New partner or asset changes implementation possibilities            | No                                                                                     | Needs inference over new stakeholders/evidence against initiatives                                                                                                                 |
| Learning    | Repeated implementation variance suggests reconsideration            | Partly                                                                                 | Status history shows repeated `stalled`/reopen on initiatives implementing one element (derivable within engagement); interpretation is inference                                  |
| Learning    | A Method repeatedly requires the same adaptation                     | Yes (internal, cross-engagement counts)                                                | `method_application_stage_notes` treatment by stage across applications of one version                                                                                             |
| Learning    | Evidence consistently contradicts an assumption                      | Yes                                                                                    | Count of `contradicts` links on the assumption's statements vs `supports`                                                                                                          |

**Assessment:** Integrity, Realization, Change and Exposure are strongly deterministic today. Potential is weakly deterministic and benefits most from inference. Learning is deterministic at engagement and practice level, and becomes cross-development (Phase 8 and later) beyond that.

**Caution (inferred):** lenses should group, not multiply. Showing six labeled buckets on every page would be a dashboard. The recommended UX is one ordered list with a lens label per item, filterable, and contextual panels that show only what bears on the object.

---

## 8. Intelligence levels

| Level                     | Question                                               | Mechanism                                                                                          | Existing examples                                                          |
| ------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1 Deterministic Awareness | What is true in the governed system?                   | Read governed state                                                                                | Registers, statuses, "Bearing on this element", decisions past `needed_by` |
| 2 Derived Insight         | What does the structured state logically imply?        | Deterministic computation across records                                                           | Most Phase 4 signals; impact traces; `compare_baselines`                   |
| 3 Architectural Inference | What might this mean?                                  | AI interpretation of governed records, labeled inferential                                         | None                                                                       |
| 4 Development Foresight   | What deserves consideration before it becomes obvious? | Deterministic anticipation (dates, governance proximity, convergence) and, later, AI or recurrence | `opportunity_window_closing`; nothing else                                 |

### 8.1 Usefulness

- **As internal classification and design guidance: useful.** The levels discipline which mechanism is allowed to produce which kind of claim, and which lifecycle applies (§16).
- **As UX language: not recommended directly.** Users should see epistemic status ("Recorded", "Derived", "Suggested", "Worth considering"), not "Level 3". Levels describe _how_ a claim was produced; epistemic status describes _what kind of claim it is_. The two correlate but are different axes (a Level 2 derivation and a Level 4 anticipation are both deterministic).
- **As schema: not now.** If Phase 7 persists intelligence, a producer type (rule vs. model) and an epistemic status are enough; a level column would be redundant.

### 8.2 Foresight without prediction

In Phase 7, Level 4 should be almost entirely **deterministic anticipation**: approaching dates already recorded (decision `needed_by`, opportunity window, scheduled Review, checkpoint `target_on`, initiative `target_operational_on`), approaching governance events with unresolved inputs (a Review scheduled to examine elements with open blocking dependencies), and convergence (several conditions bearing on one element). It should not extrapolate trends, estimate probabilities of outcomes, or infer stalls from elapsed time (Phase 5 D16). Historical recurrence as foresight ("in similar developments…") requires cross-development knowledge and is later (§22). See Q21.

---

## 9. Epistemic model

### 9.1 What DSA already encodes

| Epistemic difference                           | Existing encoding                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Who a claim rests on                           | `provenance_type` (eight values) on elements, statements, relationships (ADR-0009, ADR-0015) |
| Evidence direction                             | `evidence_stance`: `supports`, `contradicts`, `context`                                      |
| AI content reviewed or not                     | `ai_review_state`, reviewer, time; publication refuses unreviewed AI                         |
| Client decision vs architect recommendation    | Decision `recommended_*` vs `decided_*`, `outcome_provenance`, `decision_source`             |
| Derived vs judged                              | "Calculated" object maturity distribution beside dated domain judgment (ADR-0019)            |
| Computed prompt vs conclusion                  | Signals `system_derived`, "a prompt to look, never a conclusion"                             |
| Assumption confidence                          | `confidence_level` (`low`, `medium`, `high`), `validation_status`                            |
| Record status as judgment                      | Resolution with rationale (ADR-0028)                                                         |
| Validation as formal judgment                  | `validates`, only through a held Review                                                      |
| Practice provenance vs architecture provenance | Method Applications and lineage vs provenance (ADR-0047)                                     |

### 9.2 What Phase 7 would add

Provenance answers "whose authority does this governed claim rest on". Intelligence needs a different axis: "what kind of assertion is DSA making to me right now". Recommended epistemic statuses for surfaced intelligence (working set, not an enum):

| User-facing sense               | Status                    | Produced by                      | Example                                                      |
| ------------------------------- | ------------------------- | -------------------------------- | ------------------------------------------------------------ |
| DSA knows this                  | **Recorded**              | Read of governed state           | "Decision DEC-004 is past its needed-by date"                |
| DSA derived this                | **Derived**               | Deterministic rule or traversal  | "CAP-003 was revised after IMP-002 was validated"            |
| DSA suspects this               | **Suggested** (inference) | AI over cited records            | "The revised CAP-003 may no longer satisfy ACR-002"          |
| DSA recommends considering this | **Worth considering**     | Rule or AI, framed as a question | "Consider whether REV-003 should examine CAP-003's revision" |
| (Excluded in Phase 7)           | Prediction                | —                                | "IMP-002 will miss its target"                               |

Rules:

1. A surfaced item has exactly one epistemic status, shown on the item.
2. A **Recommendation** as a governed Project Intelligence kind remains an architect-authored record; "worth considering" is not a Recommendation and must not be styled like one.
3. **Prediction of outcomes is excluded** from Phase 7. Anticipation of recorded conditions is allowed (§8.2).
4. **Confidence** is shown only where methodologically meaningful: never on Recorded or Derived items (they are true or false), and on Suggested items only as a coarse, explained qualifier if at all. A numeric model probability should not be shown (Q12).
5. Epistemic status is **not** a new `provenance_type` value. If an inference is promoted into a governed record, the record gets ordinary provenance (Q18).

---

## 10. Intelligence Contract

**Principle:** every surfaced intelligence assertion can explain what it is, why it surfaced, what it is based on, and what epistemic status it has.

| Contract question                   | Deterministic condition (computed)                                                   | AI inference (persisted)                         |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| What are you telling me?            | Rule template + details (Phase 4 `details` jsonb already carries this)               | Stored assertion text                            |
| Why are you telling me this?        | Rule definition (static, versioned in code/migration)                                | Stored basis summary (not chain-of-thought)      |
| Which governed records support it?  | The rule's subject and details (element ids, codes)                                  | Stored list of basis record ids **and versions** |
| Which architecture does it bear on? | Subject + impact trace at read time                                                  | Stored subjects                                  |
| Deterministic or AI?                | Rule key → deterministic                                                             | Producer = model                                 |
| When was it generated?              | Computed now; **first observed** is not recorded today                               | Stored                                           |
| What changed to cause it?           | Derivable from basis timestamps (latest `published_at`, `created_at`, status change) | Stored trigger reference                         |
| How confident?                      | Not applicable                                                                       | Coarse qualifier if any                          |
| What authority does it have?        | None; advisory (`system_derived`)                                                    | None; advisory, never governed                   |
| What can the user do?               | Judgment actions (§16) + link to the governing operation                             | Same, plus Promote                               |

**Dynamic vs persisted:** for deterministic intelligence, every contract field except _first observed_ can be derived at read time. First observed matters only if "Since You Were Away" includes _intelligence changes_ ("three new conditions since you last looked"). Two options exist: persist a lightweight observation watermark per rule, subject and fingerprint, or define "new" relative to basis timestamps (a condition is new if its triggering fact postdates the user's watermark). The second needs no new persistence and is recommended first (Q7). For AI inference, all fields must be persisted at generation time, because the model, prompt and basis cannot be reconstructed later.

**Rule definitions as governed artifacts (inferred):** today thresholds are constants inside SQL functions (ADR-0032). The Contract's "why" is best served by a stable rule catalog in code (key, lens, plain-language definition, why it matters, basis tables), mirrored and tested the way vocabulary mirrors are (`vocabulary.test.ts`, `catalog.test.ts`). This is documentation discipline, not a new table.

---

## 11. Deterministic intelligence inventory

Conditions DSA could surface **today, without an LLM**, from the Phase 1–6 schema. Each is **Derivable** (reasoned from the schema, not executed) unless marked as an existing signal. Trivial notifications ("a record was created") are excluded. "Existing" names the Phase 4/5 rule where one exists.

Column key: **Surfaces** — E engagement briefing, A architecture element, I implementation initiative, R review, M method application, V evidence, D decision, L deliverable. **Keep** — C computed on read; P would need persistence beyond today's dismissal tables.

### 11.1 Integrity

| #    | Condition                                                                                                   | Sources                                                                      | Why it matters                                                | Surfaces | Existing                                     | Keep | False-positive concerns                                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- | -------- | -------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| D-01 | Invalidated assumption still `underpins` a live element                                                     | `assumptions`, `architecture_relationships`                                  | Architecture rests on a premise known false                   | E A      | `assumption_invalidated_still_underpins`     | C    | Low; the relationship may be kept deliberately as history (dismiss)                                                                  |
| D-02 | Unvalidated/validating assumption `underpins` a published element                                           | same + `element_versions`                                                    | Published claim rests on an untested premise                  | E A      | `assumption_unvalidated_underpins_published` | C    | Noisy early in an engagement; ordering by attention helps                                                                            |
| D-03 | Assumption's statements carry more `contradicts` than `supports` evidence while status is not `invalidated` | `architecture_statements`, `statement_evidence_links`                        | Evidence disagrees with the recorded status                   | E A V    | No                                           | C    | Stance counts are crude; one strong source can outweigh several weak ones. Present as "contradicting evidence exists", not a balance |
| D-04 | Agreed Acceptance Criterion predates the governed element's latest published version                        | `acceptance_criteria.agreed_on`, `element_versions.published_at`             | Criteria may no longer correspond to revised architecture     | A I R    | No                                           | C    | Many revisions are editorial; `change_summary` helps the reader judge                                                                |
| D-05 | Relationship whose other end is `superseded` or `retired`, still unretired                                  | `architecture_relationships`, `architecture_elements.lifecycle`              | Architecture points at replaced architecture                  | A        | No (traces silently drop such ends)          | C    | Supersession via `supersedes` may intentionally leave history links                                                                  |
| D-06 | Unretired `conflicts_with` between two published elements                                                   | `architecture_relationships`                                                 | A recognized tension remains unresolved                       | E A      | No                                           | C    | Some tensions are accepted by design; dismiss with reason                                                                            |
| D-07 | Element `requires`/is `part_of` a target that published a newer version after the source's latest version   | relationships, `element_versions`                                            | Dependent architecture may need reconsideration               | A        | No                                           | C    | Frequent in active drafting; restrict to published sources                                                                           |
| D-08 | `methodology_derived` element or statement without `instantiates` lineage (pre-Phase 6 publications)        | `architecture_elements`, `architecture_statements`, `element_method_lineage` | Provenance claim lacks its Model; publish would now refuse it | A        | Reported once by migration notice only       | C    | None; this is a governance fact                                                                                                      |
| D-09 | Intended Outcome with no `measured_by` Metric; Metric measuring nothing                                     | `architecture_objects`, relationships                                        | Spec §19 "metrics ↔ intended outcomes" measurement gap        | E A      | No                                           | C    | Early-stage architecture legitimately incomplete; show only for published outcomes                                                   |
| D-10 | Capability that `serves` no Intended Outcome                                                                | same                                                                         | Spec §19 "strategy ↔ capability"; orphan capability           | A        | No                                           | C    | Capabilities may serve via `part_of` a parent; walk `part_of` first                                                                  |
| D-11 | Decision Right with no holder (`holds`), or Governance Body governing nothing                               | same                                                                         | Spec §19 "governance ↔ responsibility"                        | A        | No                                           | C    | Low                                                                                                                                  |

### 11.2 Realization

| #    | Condition                                                                                                                                           | Sources                                                                               | Why it matters                                                    | Surfaces | Existing                     | Keep | False-positive concerns                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- | ---------------------------- | ---- | -------------------------------------------------------------------------------------- |
| D-12 | Approved architecture with no implementation pathway (latest version approved; no incoming `implements`; for capabilities no `implemented_through`) | `architecture_approvals`, relationships                                               | Approved intent with no route to reality                          | E A      | No                           | C    | Knowledge-domain objects rarely need implementation; restrict by domain/type           |
| D-13 | Initiative `operational` without a `validates` relationship                                                                                         | `implementation_initiatives`, relationships                                           | Reality claimed but not judged (state fact, no elapsed threshold) | E I R    | No                           | C    | Validation may be intentionally scheduled; show the next scheduled Review examining it |
| D-14 | Initiative `implements` an element now `superseded` or `retired`                                                                                    | same                                                                                  | Realizing replaced architecture                                   | E A I    | No                           | C    | Low                                                                                    |
| D-15 | Implemented element published a newer version after the `implements` relationship was created, initiative active                                    | relationships `created_at`, `element_versions`                                        | Reality may be tracking an older design                           | A I      | No                           | C    | Editorial revisions; show `change_summary`                                             |
| D-16 | Validated initiative whose implemented element published a newer version after validation                                                           | `validates.created_at`, `validation_criteria.captured_at`, versions                   | Validation was against earlier architecture                       | A I R    | No                           | C    | Same as above                                                                          |
| D-17 | `operational` or `validated` initiative with no cited evidence                                                                                      | `element_evidence_links` on the initiative, checkpoints `achieved_evidence_source_id` | Operating claim without evidence                                  | I        | No                           | C    | Evidence may sit on checkpoints only; include those                                    |
| D-18 | Initiative past `target_operational_on`, not validated                                                                                              | `implementation_initiatives`                                                          | Recorded target missed                                            | E I      | `implementation_past_target` | C    | Existing, tuned                                                                        |
| D-19 | Checkpoint past `target_on`, not achieved                                                                                                           | `implementation_checkpoints`                                                          | A dated condition inside an initiative slipped                    | I        | No                           | C    | Date-based fact only; not a stall inference                                            |
| D-20 | Initiative has agreed criteria in force but no scheduled or held Review examines it                                                                 | `criteria_in_force`, `reviews`, `examines`                                            | Criteria exist with no path to judgment                           | I R      | No                           | C    | Low                                                                                    |

### 11.3 Change

| #    | Condition                                                                                   | Sources                                                              | Why it matters                                                    | Surfaces | Existing                                                         | Keep | False-positive concerns                                          |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- | ---------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| D-21 | Elements examined by a Review changed since its baseline (or since it was held)             | `reviews.baseline_id`, `compare_baselines(baseline, null)`, versions | "What changed since this Review was prepared"                     | R A      | `compare_baselines` exists; not surfaced on Reviews              | C    | None; it is a diff                                               |
| D-22 | Evidence linked to an examined element after the Review was held                            | `evidence_sources.created_at`, links, `reviews.held_at`, `examines`  | Evidence arrived after judgment                                   | R V      | No                                                               | C    | Context-stance evidence is weak; rank `contradicts` first        |
| D-23 | Decision decided after the latest version of elements it `affects`                          | `decisions.decided_at`, `affects`, versions                          | Decision not yet reflected in architecture                        | D A      | No                                                               | C    | Some decisions need no revision; dismiss                         |
| D-24 | Deliverable `documents` elements revised since its baseline or its latest approval          | `deliverables.baseline_id`, `documents`, versions, approvals         | Deliverable may be stale                                          | L        | No                                                               | C    | Superseded deliverables should be excluded                       |
| D-25 | Client contribution made on a version that is no longer latest, still unhandled             | `client_contributions.element_version_id`, `status`                  | Input may refer to superseded content                             | A        | No                                                               | C    | Low                                                              |
| D-26 | Open Method Application pinned to a Method version since superseded                         | `method_applications`, `method_asset_versions.lifecycle`             | Methodology changed under active work                             | M        | No                                                               | C    | Pins are deliberate (ADR-0043); the item is awareness, not error |
| D-27 | Engagement's DAM release changed after an application started, or a newer release published | `dam_releases`, `engagements.dam_release_id`, `method_applications`  | Practice context shifted                                          | M E      | No                                                               | C    | Internal practice only                                           |
| D-28 | Approved version is not the latest published version (approval drift)                       | `architecture_approvals`, `element_versions`                         | Client has approved an earlier version than what is now published | A E      | Shown per element ("Published v3 · v2 approved"), not aggregated | C    | Intentional when a new version awaits approval                   |

### 11.4 Exposure

| #    | Condition                                                                                                                                  | Sources                                                                      | Why it matters                                       | Surfaces | Existing                          | Keep | False-positive concerns                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------- | -------- | --------------------------------- | ---- | --------------------------------------------------- |
| D-29 | Active risk severity ≥ 15 with nothing `mitigates` it                                                                                      | `risks`, relationships                                                       | Unmitigated high exposure                            | E A      | `risk_high_without_mitigation`    | C    | Existing                                            |
| D-30 | Blocking dependency not satisfied                                                                                                          | `dependencies`                                                               | Blocked architecture                                 | E A      | `dependency_blocking_unsatisfied` | C    | Existing                                            |
| D-31 | Two or more blocking unsatisfied dependencies converge on one element                                                                      | `dependencies.to_element_id`                                                 | Concentrated exposure                                | E A      | No                                | C    | Threshold is a design choice; show count, not score |
| D-32 | Open escalation on a risk that `threatens` an element examined by a scheduled Review                                                       | `intelligence_escalations`, `threatens`, `examines`, `reviews.scheduled_for` | Governance event approaching with escalated exposure | E R      | No                                | C    | Low                                                 |
| D-33 | Materialized risk still `threatens` live elements                                                                                          | `risks.risk_status = materialized`                                           | Realized risk not yet reflected                      | E A      | No                                | C    | Low                                                 |
| D-34 | In-force constraint `constrains` two or more initiatives (or elements implemented by distinct initiatives)                                 | `constraints`, relationships                                                 | Constraint shapes several paths                      | E I      | No                                | C    | Broad constraints are normal; order low             |
| D-35 | Assumption with human attention `critical`/`high` and no `supports` evidence                                                               | `intelligence_stewardship`, links                                            | Critical premise unsupported                         | E A      | No                                | C    | Depends on attention being maintained               |
| D-36 | Decision past `needed_by`; open client action overdue; opportunity window closing/closed; record review overdue; record untriaged > 7 days | Phase 4 tables                                                               | Governance timing                                    | E D      | Five existing rules               | C    | Existing                                            |

### 11.5 Potential

| #    | Condition                                                                                        | Sources                                   | Why it matters                               | Surfaces | Existing | Keep | False-positive concerns                                     |
| ---- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------- | -------- | -------- | ---- | ----------------------------------------------------------- |
| D-37 | Open opportunity `advances` a capability that no initiative implements                           | `opportunities`, `advances`, `implements` | Opportunity intersects unrealized capability | E A      | No       | C    | Link semantics are the architect's; this only restates them |
| D-38 | Capability `serves` two or more Intended Outcomes                                                | relationships                             | Leverage point                               | A        | No       | C    | Informational; ambient only                                 |
| D-39 | Opportunity with no `pursues` from any capability, decision or recommendation while `evaluating` | `opportunities`, `pursues`                | Evaluated opportunity with no carrier        | E        | No       | C    | Early evaluation is normal                                  |

### 11.6 Learning (engagement and internal practice)

| #    | Condition                                                                                                                              | Sources                                   | Why it matters                                                                     | Surfaces             | Existing                                         | Keep | False-positive concerns                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------- |
| D-40 | Initiatives implementing one element repeatedly `stalled`, reopened or abandoned                                                       | `implementation_status_changes`           | Repeated realization difficulty may indicate architecture deserves reconsideration | A                    | No                                               | C    | Recurrence is not cause (§20); phrase as "worth examining"                                   |
| D-41 | Completed Method Application whose declared outputs (`method_version_outputs`) have no corresponding `produced` link                   | Phase 6 tables                            | Expected output absent                                                             | M                    | No                                               | C    | Declared outputs are "normally", not "always"                                                |
| D-42 | Instrument declared by the Method but no `gathered` evidence cites it                                                                  | `method_application_evidence`, components | Expected evidence absent                                                           | M                    | No                                               | C    | Same                                                                                         |
| D-43 | A stage of one Method version `adapted` or `skipped` in a majority of its closed applications (internal, cross-engagement counts only) | `method_application_stage_notes`          | Practice Intelligence: the Method may need revision                                | Method Library asset | No (`method_usage` gives counts, not treatments) | C    | Small numbers; show counts with n, never a rate alone; see §21 on confidentiality of reasons |
| D-44 | Dismissals of one rule concentrated on one kind of subject                                                                             | `intelligence_signal_dismissals`          | The rule may be mis-tuned (learning about DSA itself)                              | Internal admin       | No                                               | C    | Needs volume                                                                                 |

### 11.7 Observations on the inventory

- **Forty-four candidates; the eleven existing rules account for six of them** (D-36 groups six Phase 4 timing rules), so thirty-eight are new. Most new value is in Realization (D-12 to D-20) and Change (D-21 to D-28), which span phase boundaries that no single phase's signal function was scoped to cross.
- **Every candidate can stay computed.** None needs its conclusion stored. The only persistence the inventory needs is what Phase 4 already has: human judgments keyed by fingerprint.
- **Version/timing conditions (D-04, D-07, D-15, D-16, D-23, D-24) depend on `element_versions.published_at` and relationship `created_at`.** They are the clearest Claude Test winners.
- **Several conditions are structural coherence** (D-05, D-06, D-09, D-10, D-11), i.e., a deterministic subset of spec §19's Structural Coherence Engine. Q27 asks whether that subset belongs in Phase 7.
- **False positives are dominated by incompleteness during active drafting.** The mitigation is scope (published elements only, domain/type restrictions) and ordering (§15), not suppression.

---

## 12. Phase 4 Signals reconciliation

### 12.1 What a Signal is today (verified)

| Question            | Answer                                                                                                                                                                                | Source                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Meaning             | A named, deterministic rule that "points at something needing judgment"; "a prompt to look, never a conclusion"                                                                       | ADR-0032; signals page             |
| Generation          | SQL functions `intelligence_signals(engagement, as_of, include_dismissed)` (ten rules) and `implementation_signals(...)` (one rule), evaluated on each call against the live register | `20261002000100`, `20261003000100` |
| Persistence         | None for the signal. Dismissals only: `intelligence_signal_dismissals`, `implementation_signal_dismissals` (rule, subject, fingerprint, reason, expiry, who, when)                    | ADR-0032, ADR-0039                 |
| Lifecycle           | Present while facts hold → dismissed (with reason, optional expiry) → returns when fingerprint changes or dismissal expires                                                           | ADR-0032                           |
| Client visibility   | None. Internal only; functions are `security definer` and check `can_read_architecture`                                                                                               | migrations                         |
| Stewardship         | Separate: attention and triage live on the record (`intelligence_stewardship`), not on the signal                                                                                     | ADR-0027                           |
| Escalation          | Separate: escalation is on the record; a signal can prompt a human to escalate but never escalates                                                                                    | ADR-0028                           |
| Record or artifact? | **Derived artifact.** Signals are not Project Intelligence records, have no spine row, no reference code, no provenance column; the rule output is `system_derived` in meaning        | ADR-0032                           |
| Thresholds          | Constants in the function (severity 15, 30 days, 7 days)                                                                                                                              | ADR-0032                           |

### 12.2 Overlap with the Development Edge

Signals are the Edge's Level 1–2 **condition** substrate. They do not cover impact, change awareness, governance proximity, context, prioritization, or inference, and they are split across two functions and two dismissal tables by design (ADR-0039).

### 12.3 Options

| Option                               | Description                                                                                                                                                                                                                                                                                                                                                                                               | Assessment                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Extend Signals                    | Add rules to the two functions (and a third for Phase 6)                                                                                                                                                                                                                                                                                                                                                  | Keeps precedent; the split grows (each namespace gets its own function and dismissal table); no common envelope                                                         |
| B. Consume Signals                   | The Edge reads the existing functions as-is plus new sources                                                                                                                                                                                                                                                                                                                                              | No duplication, but the Edge must reconcile heterogeneous shapes                                                                                                        |
| C. Supersede Signals                 | Replace with a new intelligence abstraction and migrate dismissals                                                                                                                                                                                                                                                                                                                                        | Duplicates Phase 4/5 work, breaks ADR-0039's namespace decision, loses nothing it could not keep                                                                        |
| D. Envelope over rules (recommended) | Keep every rule deterministic and computed. Add new rules where their source tables live (respecting ADR-0039's separate namespaces). Define one **intelligence envelope** (rule key, lens, epistemic status, subject, basis records, trigger time, details, judgment state) that every rule's output maps into, and one Edge read path that composes them. Judgments keep using fingerprinted dismissals | Extends and consumes without superseding; one experience, many governed sources; AI inference later maps into the same envelope with a different producer and lifecycle |

**Recommendation: D** (Q5). "Signal" remains the name for a deterministic rule output; "Development Edge" is the experience; "intelligence item" (working term) is anything surfaced in the envelope, of which a signal is one kind.

### 12.4 Consequences for existing decisions

- ADR-0032's "computed; dismissals stored" becomes the general principle for deterministic intelligence. No change.
- ADR-0039's separation holds: implementation rules stay in the implementation namespace. Cross-namespace rules (D-15, D-16, D-21) need a home; a read model that reads both namespaces without writing either is consistent with ADR-0039, which separates _storage_, not _reading_.
- ADR-0032's sentence on future AI findings needs reconciliation (§35, C1; Q16).
- The dismissal tables' `expires_on` already implements "Defer"; `reason` already implements "Not material". §16 builds on this.

---

## 13. Impact-analysis capability

**Target experience (brief §26):** architecture element X changed; DSA identifies dependent architecture, related Project Intelligence, active implementation, Acceptance Criteria, Reviews, Deliverables, evidence, methodology provenance and upcoming governance events that may warrant examination.

### 13.1 What exists (verified)

| Function                                    | Walks                                                                                                                                                                                                                       | Misses                                                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intelligence_impact(element, depth ≤ 5)`   | Depth 0: any outgoing non-lineage relationship and dependency ends. Depth > 0: outgoing `part_of`, `serves`, `shapes`, `informs`, `implies`, `implemented_through`, `delivered_through`, `measured_by`; incoming `requires` | Incoming Project Intelligence (`underpins`, `threatens`, `constrains`, `mitigates`, `affects`, `addresses` pointing _at_ X); `implements`, `examines`, `documents`, `validates`; everything off the spine |
| `implementation_impact(element, depth ≤ 5)` | Depth 0: incoming `implements`. Depth > 0: every non-lineage relationship in both directions                                                                                                                                | Starts only from implemented architecture; no off-spine links                                                                                                                                             |
| Element page panels                         | Bearing, Reviewed in, Documented in, Implementation, Criteria, Practice                                                                                                                                                     | One hop each; not composed into one answer                                                                                                                                                                |

Both are `security invoker` recursive CTEs with cycle protection, filtered to live elements. They are the right mechanism.

### 13.2 What a complete answer needs, and whether the data exists

| Impact category              | Data                                                                   | Traversal needed                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Dependent architecture       | Relationships                                                          | Incoming `requires`, `part_of` children, `specializes` children, `serves`/`shapes`/`informs` targets |
| Related Project Intelligence | Relationships, dependency ends                                         | Incoming PI relationships to X and to X's ancestors                                                  |
| Active Implementation        | `implements`, initiative status                                        | Incoming `implements` to X and to affected architecture                                              |
| Acceptance Criteria          | `acceptance_criteria.governed_element_id`                              | Direct off-spine join (not a relationship)                                                           |
| Reviews                      | `examines`, `reviews.baseline_id`, `baseline_items`                    | Incoming `examines`; baselines containing X's versions                                               |
| Deliverables                 | `documents`, `baseline_id`                                             | Incoming `documents`; baselines                                                                      |
| Evidence                     | Statement and element evidence links                                   | Direct                                                                                               |
| Methodology provenance       | `element_method_lineage`, `method_application_elements`                | Direct off-spine joins                                                                               |
| Upcoming governance events   | Scheduled Reviews, decisions due, pending approvals, criteria proposed | Filter of the above by date/state                                                                    |
| Client exposure              | Client visibility, open client actions with X as subject               | Direct                                                                                               |

**All the data exists.** The gap is a unified traversal that (a) walks incoming relationships selectively by type, (b) joins the off-spine governance tables at each reached element, and (c) groups results by category rather than depth. That is an extension of the existing recursive SQL, not a graph database. Postgres recursive CTEs over an engagement-scoped relationship table of this size are adequate; spec §23 separately excludes complex graph visualization, and neither is needed.

### 13.3 Traversal semantics to decide (inferred)

- **Direction matters per type.** Impact of changing a Capability should reach what `requires` it and what it `serves`, but not every sibling that is `part_of` the same parent. A per-relationship-type impact direction table (documentation mirrored in code, like the vocabulary) is the governed way to express this.
- **Depth is a presentation choice.** Direct (1 hop) impacts are Derived; distant ones are "may bear on". Beyond two or three hops, relevance decays and noise dominates.
- **Change-triggered vs on-demand.** On-demand impact ("what would be affected if X changed") is a read. Change-triggered impact ("X changed; these may warrant examination") combines the traversal with the change stream (§14) and conditions like D-15/D-16/D-21/D-24.

**Recommendation:** impact analysis over known relationships belongs in Phase 7 (Q8). It is the capability most clearly outside the reach of an export-and-prompt workflow.

---

## 14. Change awareness: Since You Were Away

**Concept:** since your last meaningful session, what changed that matters?

### 14.1 Does DSA record enough change history?

| Change                                                                                          | Recorded                                                              | Curated reader today                                        |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Architecture element create, edit, submit, publish, retire, supersede                           | `activity_log`, `element_versions`                                    | `architecture_activity`                                     |
| Relationships, statements, evidence, lineage, approvals, decisions, assessments, baselines      | `activity_log`                                                        | `architecture_activity`                                     |
| Project Intelligence status, stewardship, escalation, client actions, contributions, dismissals | `activity_log`, `intelligence_status_changes`, `client_action_events` | `architecture_activity`, `intelligence_history`             |
| Reviews, Deliverables, Implementation status, checkpoints, escalations                          | `activity_log`, `implementation_status_changes`                       | Per-object history only; **not** in `architecture_activity` |
| Acceptance Criteria, validation captures                                                        | `activity_log`                                                        | **None curated**                                            |
| Method Applications, Method Library, releases, contexts                                         | `activity_log`                                                        | **None curated** for engagement readers                     |
| Intelligence conditions appearing/disappearing                                                  | Not recorded (computed)                                               | None                                                        |

**Finding:** the history is complete from Phase 4 onward (and from Phase 3 through versions); the curated reader is incomplete. `activity_log` is readable only by System Administrators and Principal Architects, and stores full before/after row JSON, including internal content, so it cannot simply be opened to more readers.

### 14.2 Does user last-seen/session state exist?

No. `profiles` holds identity and status only. There is no last-visit, last-viewed or briefing state. Supabase `auth.users.last_sign_in_at` exists but measures sign-in, not a meaningful session, and using it would edge toward monitoring.

### 14.3 Can meaningful change be derived?

Yes, with a curated read model that classifies raw events into developmental events (published, revised, validated, decided, evidence added, criterion agreed, application closed, status changed with rationale) and drops noise (working-copy saves, stewardship date edits). The Phase 3/4 `architecture_activity` classification is the pattern; it needs the Phase 5/6 vocabulary. Materiality can then be ordered using the same governed factors as the Edge (§15): governance proximity, implementation reach, the user's responsibility.

### 14.4 Is a new event model necessary?

**No event-sourcing system is justified.** `activity_log` already is the event record. What is needed:

1. A curated, capability-aware developmental change read model covering Phases 3–6 (extension, not new store).
2. A per-user, per-engagement **"briefed through"** timestamp that the user controls (Q7). It should be set by an explicit user act ("Mark as reviewed") or by opening the briefing, never by passive page-view tracking, and be readable only by that user.
3. Optionally, intelligence-change awareness defined from basis timestamps (§10).

The briefing is a document-like summary grouped by what changed, ordered by materiality, each item linking to the governed record. It is not a feed and has no unread counts or badges.

### 14.5 User and session awareness

What DSA knows today (Verified):

| Fact                                             | Where                                                                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Current user, organization memberships and roles | `profiles`, `organization_members`                                                                                                        |
| Engagement participation and role                | `engagement_members`                                                                                                                      |
| Effective engagement capabilities                | `my_engagement_capabilities`                                                                                                              |
| Practice capabilities                            | `my_practice_capabilities`                                                                                                                |
| Contributor areas (clients)                      | `engagement_member_areas`                                                                                                                 |
| Responsibility                                   | Element `owner_user_id`, decision owner, initiative owner, Method Application practitioners, Review participants, client action addressee |
| Last activity / last visit / recently viewed     | **Not recorded** (only `activity_log` actor on writes, and Supabase sign-in time)                                                         |

**Preserve explicitly (Q7):** no productivity scoring, no employee monitoring, no time-on-page tracking, no performance ranking, no view logs. The Edge may use _responsibility_ (structural, already recorded) and an _explicit, user-controlled briefing watermark_ (only the user can read it). It must not expose to managers who looked at what, and dismissal and judgment records, which are attributed, should be framed as professional record-keeping, not throughput. Activity counts per person should never be displayed.

---

## 15. Contextual Edge

Which contextual questions existing relationships already answer (Derivable unless noted).

| Surface                   | Question                                                                  | Answerable today from                                                                                                                                                                 | Gap                                                                   |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Architecture element      | What bears on this element right now?                                     | "Bearing" panel (open records), signals whose subject or details reference it, D-04/05/07/12/15/16/23/28, impact                                                                      | Signals are not shown on element pages; one composed panel is missing |
| Implementation Initiative | Does reality still correspond to current architecture?                    | D-14, D-15, D-16, D-17, D-19, D-20, `criteria_in_force`                                                                                                                               | Correspondence by timestamps, not pinned versions (Q26)               |
| Review                    | What changed since this Review was prepared?                              | `compare_baselines(review.baseline_id, null)` for examined elements; D-22, D-32; pending approvals; decisions due                                                                     | Reviews without a baseline need "since held/scheduled" by timestamps  |
| Method Application        | Are expected inputs or evidence absent? Has repeated adaptation occurred? | D-41, D-42, D-26, D-27; D-43 at library level                                                                                                                                         | Adaptation recurrence is cross-engagement (internal)                  |
| Evidence record           | What claims, architecture or implementation does this bear on?            | `statement_evidence_links` (with stance), `element_evidence_links`, checkpoints, applications (`drew_on`/`gathered`), criteria agreement evidence, contributions promoted to evidence | No reverse panel exists on the evidence page today; data is complete  |
| Decision                  | What does this decision change, and has architecture caught up?           | `affects`, `initiates`, `pursues`, `mitigates`; D-23                                                                                                                                  | None structural                                                       |
| Deliverable               | Is what it documents still current?                                       | `documents`, baseline, D-24                                                                                                                                                           | None structural                                                       |
| Engagement                | What matters now?                                                         | Composition of all above, ordered                                                                                                                                                     | Prioritization (§15.1) and briefing (§14)                             |

### 15.1 Edge prioritization

Avoid a single opaque importance score (brief §15). Every governed factor the brief lists is available deterministically:

| Factor                            | Deterministic basis                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architectural reach               | Size and kinds of the impact trace (how many published elements, whether an Intended Outcome is reached)                                                |
| Active implementation impact      | Count of active initiatives reached                                                                                                                     |
| Governance proximity              | Scheduled Review examining it; decision `needed_by`; pending approval; proposed criteria awaiting agreement; client action due                          |
| Evidence strength                 | `contradicts` vs `supports` links; evidence recency                                                                                                     |
| Escalation state                  | Open escalation, level                                                                                                                                  |
| Human attention                   | Stewardship `attention` (`critical`, `high`, `routine`, `watch`)                                                                                        |
| Recency                           | Trigger time vs the user's watermark                                                                                                                    |
| Unresolved dependencies           | Blocking unsatisfied dependencies reached                                                                                                               |
| User responsibility               | `owner_user_id`, `decision_owner_user_id`, initiative `owner_member_id`, Method Application practitioners, Review participants, client action addressee |
| Relationship to Intended Outcomes | Path to an Intended Outcome via `serves`/`measured_by`/`advances`                                                                                       |
| Current work context              | The page the user is on (contextual panels filter by subject)                                                                                           |

**Recommended ordering method (inferred):** lexicographic, explainable tiers rather than a weighted sum. For example: (1) human-escalated or human-marked critical; (2) governance event within a short horizon; (3) active implementation reached; (4) published architecture reached; (5) everything else; with recency and user responsibility breaking ties. Each item shows _why it is placed where it is_ in words ("Review REV-003 examines this on 12 October"). AI interpretation can add explanation of an item, never its rank, in Phase 7 (Q9).

### 15.2 Interruption model

| Tier (working names) | Where it appears                              | What may place an item here                                                                                     |
| -------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Ambient              | Contextual panels on the relevant object only | Any Derived or Suggested item                                                                                   |
| Attention            | Engagement Edge list and briefing             | Deterministic conditions meeting a scope rule                                                                   |
| Elevated             | Top of the Edge list, marked                  | Deterministic governance criteria (governance event imminent with an unresolved condition) or human escalation  |
| Critical             | Top, distinct                                 | **Only** human judgment: stewardship `attention = critical` or an open escalation. Never AI; never a rule alone |

Note the naming collision: `intelligence_attention` already has a `critical` value (human-set), and `recommendation_priority` has `critical`. The Edge's top tier should be defined as exactly those human-set states, or named differently, to avoid two meanings of "critical" (Q22). No tier sends email or push in Phase 7 (Q24).

---

## 16. Intelligence judgment lifecycle

### 16.1 Existing precedent

Phase 4/5 dismissals already provide an append-only-in-practice judgment with reason, expiry and fingerprint-based return. Record stewardship provides attention and triage. Escalation provides a formal elevation path.

### 16.2 Recommended judgment vocabulary (working, not an enum)

| Response     | Deterministic condition                                                                                                            | AI inference                                                              | Stored?                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------ |
| Investigate  | Acknowledged; stays visible to others as "being examined by …"                                                                     | Same                                                                      | Yes (who, when)                      |
| Not material | Dismiss with reason; returns if fingerprint changes (existing)                                                                     | Dismiss with reason; inference expires with its basis                     | Yes (existing mechanism)             |
| Disagree     | Rarely meaningful: a derived fact is true. Disagreement means "the rule is wrong for this case"; recorded as rule feedback         | Contest with reason; valuable learning data about inference quality       | Yes                                  |
| Defer        | Dismiss with expiry (existing `expires_on`)                                                                                        | Same                                                                      | Yes                                  |
| Promote      | Open the governing operation (create Risk, record Decision, schedule Review, propose criterion) pre-filled, with a provenance link | Same; the only path by which inference content can enter governed records | Yes, as a link from record to origin |

### 16.3 Answers to the brief's lifecycle questions

- **Own lifecycle?** Deterministic conditions: no; they exist while facts hold, and only the human judgment has a lifecycle (Phase 4 model). AI inferences: yes, because they are persisted assertions that can go stale.
- **Append-only judgment?** Yes. Judgments are small, attributable, and are the learning signal. Corrections are new judgments.
- **Suppress repeated identical intelligence?** Yes, by fingerprint, exactly as Phase 4. The fingerprint must capture the facts that make the item _this_ item, so a material change returns it.
- **Disagreement as learning data?** Yes, internally, for tuning rules and prompts. It must not become cross-engagement training data without the promotion flow (§23).
- **Promotion preserves provenance?** Yes. The promoted record links back to the originating item (and, for inference, its model, prompt version and basis). The record's own provenance follows whose authority the claim now rests on (Q18).
- **Expire when basis changes?** Yes for AI inference: an inference whose basis records have newer versions is marked stale, not deleted, and leaves the default view. Deterministic items expire automatically when facts change.
- **Different semantics?** Yes, as the table shows. The central difference: a derived condition is true or false and only its materiality is judged; an inference is plausible or not and its truth is judged.

**Against a graveyard:** AI inferences not acted on should fall out of view when stale or after a governed horizon, remain queryable for audit and learning, and never accumulate as an open queue.

---

## 17. Persistence analysis

| Category                             | Store?                                                                     | Principle                                                                                                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Computed intelligence                | No                                                                         | Derived at read time from governed state. Never store a conclusion that can be recomputed (ADR-0032 generalized)                                                                                        |
| Persisted deterministic intelligence | Only judgments, and optionally a first-observed watermark                  | Store what a human decided about a condition, keyed by fingerprint. Store first-observed only if Since You Were Away needs intelligence deltas that basis timestamps cannot provide                     |
| Persisted AI inference               | Yes, when surfaced proactively in the Edge or elected by the user ("Keep") | Everything needed to explain and audit it (§18), its basis versions, its judgments, its staleness. Never an element; never a statement; never a Project Intelligence record                             |
| Ephemeral AI assistance              | No, as an assertion                                                        | Answers in the current interaction (explain this, summarize these) are not durable intelligence. Whether the interaction itself is logged for security audit is a separate security decision (§29, Q20) |

Principles:

1. **Governed records are the only authority.** Nothing in intelligence storage is ever read as architecture.
2. **Persist judgments, not conclusions,** for deterministic intelligence.
3. **Persist inference with its basis or not at all.** An inference without basis versions cannot satisfy the Intelligence Contract.
4. **Persistence follows engagement isolation.** Any intelligence storage is engagement-scoped with the same RLS pattern as Phase 4 stewardship (internal only, `can_read_architecture`).
5. **No derived caches that outlive permission checks.** If computed intelligence is ever cached for performance, the cache is keyed by engagement and invalidated on change, and reads re-check access.

---

## 18. AI provenance requirements

If Phase 7 persists AI inference, each item needs:

| Field                                                                           | Why                                                                                                                  |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Provider and model identifier (as data)                                         | Audit; provider independence (§30)                                                                                   |
| Generation timestamp                                                            | Contract                                                                                                             |
| Prompt/instruction version (governed)                                           | Reproducibility of intent; ADR-0050 assigns prompt governance to Phase 7                                             |
| Generation policy version                                                       | Which rules governed context assembly and output checks                                                              |
| Basis records **with versions** (element version ids, record ids, evidence ids) | Contract; staleness detection                                                                                        |
| Retrieval sources, if retrieval was used                                        | Contract; confidentiality audit                                                                                      |
| Method/Standard version involved, if any                                        | Practice provenance; internal only                                                                                   |
| Requesting user, if user-initiated                                              | Accountability; not surveillance                                                                                     |
| Engagement id                                                                   | Isolation                                                                                                            |
| Concise basis summary (what the inference rests on)                             | Explainability. **Not** hidden chain-of-thought, which should not be requested, stored or presented as the reasoning |
| Epistemic status and any coarse confidence qualifier                            | Contract                                                                                                             |
| Subsequent human judgments                                                      | Lifecycle                                                                                                            |
| Supersession/staleness                                                          | Lifecycle                                                                                                            |

**Not stored:** raw prompts containing client content beyond what audit requires (Q20), model-private reasoning, or full context payloads by default. The basis list plus prompt version should be sufficient to explain; storing full payloads duplicates confidential content into another table and log surface.

**Relationship to `ai_analysis` provenance:** `ai_analysis` + `ai_review_state` is the correct mechanism for AI-_drafted content that enters architecture_ (a statement or element drafted by AI, reviewed before publication). It is not the right mechanism for intelligence observations, which never enter architecture. Keeping these separate avoids filling working copies with pending AI statements (§35, C1).

---

## 19. Conversational intelligence boundary

Conversation should sit on top of the Living Development Model and the Edge, not replace them. Classification of the brief's example questions:

| Question                                                 | Deterministic today                             | Needs retrieval     | Needs AI reasoning                  | Needs cross-development knowledge |
| -------------------------------------------------------- | ----------------------------------------------- | ------------------- | ----------------------------------- | --------------------------------- |
| What should I be thinking about right now?               | The ordered Edge answers it                     | —                   | Optional narration                  | —                                 |
| What changed?                                            | Curated change read model + watermark           | —                   | Optional summary                    | —                                 |
| What bears on this capability?                           | Bearing + impact                                | —                   | —                                   | —                                 |
| Why is this implementation at risk?                      | Conditions D-14–D-20, D-29–D-34 reaching it     | —                   | Explanation combining them          | —                                 |
| What evidence contradicts this assumption?               | `contradicts` links                             | Evidence content    | Summarizing content                 | —                                 |
| What would be affected if this architecture changed?     | Impact traversal                                | —                   | —                                   | —                                 |
| What opportunities intersect this unrealized capability? | `advances`/`pursues` (D-37)                     | Opportunity content | Semantic intersections beyond links | —                                 |
| Why did DSA surface this?                                | Intelligence Contract fields                    | —                   | —                                   | —                                 |
| What did we believe before this changed?                 | Versions, `compare_baselines`, status histories | Statement content   | Narrative                           | —                                 |
| How have similar developments handled this?              | —                                               | —                   | —                                   | Yes (later)                       |

**Finding:** most high-value questions are answered deterministically; AI adds _narration and semantic reach_, not the answer's authority. A conversational surface in Phase 7 is therefore optional. If included, it should be scoped to one engagement, run as the user, answer from governed records with citations and epistemic labels, be ephemeral by default, and have "Keep as intelligence" as the only persistence path. A generic chatbot is not recommended (Q13).

---

## 20. Engagement Intelligence

Each engagement is a private intelligence domain. The existing system already enforces this for every read path intelligence would use:

- Every engagement-scoped table carries `engagement_id` with composite same-engagement foreign keys; no relationship, link or application can cross engagements (ADR-0013, ADR-0043).
- Internal access is by assignment; `security invoker` read models inherit it.
- Signals and impact functions are per engagement.

**How Phase 7 performs engagement-level intelligence without weakening the boundary (inferred principles):**

1. **One engagement per computation.** Deterministic rules and traversals take an engagement and never join across engagements.
2. **One engagement per AI context.** An AI request's context is assembled for exactly one engagement, as the requesting user, through the same read models the UI uses. No service-role context assembly.
3. **No shared retrieval corpus.** If retrieval or embeddings are ever used, the index is engagement-partitioned and enforced by RLS or equivalent, never a global index filtered in application code.
4. **Intelligence storage is engagement-scoped and internal-only**, with the Phase 4 stewardship RLS pattern.
5. **Cross-engagement reads remain the existing internal registers**, which list without comparing.

These principles cost little now and are very hard to retrofit after a shared index or cross-engagement cache exists.

---

## 21. Practice Intelligence

**What TPLCo is learning about how Development Architecture is practiced.**

Phase 6 deliberately recorded the facts this needs (Phase 6 proposal §22.1): applications by version, context and domain; stage treatments with reasons; component deviations; declared vs actual outputs; learning sources; outcomes via links to Phase 4/5 records.

| Brief example                                            | Data today                                                                    | Scope                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A Method repeatedly requires the same adaptation         | Stage notes by version (D-43)                                                 | Cross-engagement internal counts                                                       |
| Certain Methods are used together                        | Applications per engagement; components per application                       | Cross-engagement internal counts                                                       |
| Certain Development Contexts expose gaps in Methodology  | Declared contexts vs application contexts vs discontinuations and adaptations | Cross-engagement; contexts are empty in production until TPLCo defines them (ADR-0045) |
| Architects repeatedly promote the same kind of inference | Requires Phase 7 promotion records                                            | Later                                                                                  |
| A Standard repeatedly informs Acceptance Criteria        | `acceptance_criteria.informing_standard_version_id`                           | Cross-engagement internal counts                                                       |

**Distinction worth preserving:** practice records are TPLCo's own, internal and never client-readable (D32), but their _free-text_ fields (stage reasons, completion statements, deviation notes, addenda) are written inside client engagements and can carry client-confidential content. Counts and structured fields are practice data; free text is engagement data.

**Recommendation (Q11):** Phase 7 may surface (a) per-application practice conditions inside the engagement (D-41, D-42, D-26, D-27) and (b) structured, count-based practice facts on a Method Asset page (D-43, co-use, standard-informs-criteria), shown with n and never as rates or scores, readable by practice-capability holders. Phase 7 should not summarize stage-note free text across engagements, attribute outcomes to methods, score methods, or modify Method Assets. Method revision remains the Phase 6 authoring flow with learning sources.

---

## 22. Development Intelligence

**Reusable knowledge about development itself, derived from governed experience across developments.**

The Master Build Spec places nothing of this kind in Phase 7. Spec §31 lists Phase 7 as "AI-assisted analysis, research support, coherence checks", Phase 8 as "cross-engagement intelligence and internal metrics", and spec §16's Pattern Library is where reusable structural knowledge lives. So Phase 7 should not build Development Intelligence.

**What Phase 7 should capture now so later Development Intelligence needs no redesign:**

| Future need                 | Already captured                                                                                                                       | Phase 7 should add or preserve                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Comparable structure        | Controlled object types, relationship types, categories (`intelligence_categories`, `implementation_categories`), Development Contexts | Keep categories controlled; do not introduce free-text classification in intelligence                          |
| Outcome history             | Status histories, validation, criteria captures                                                                                        | Nothing new                                                                                                    |
| What architects judged      | Dismissal reasons, resolution rationales, domain judgments                                                                             | Judgments on intelligence items with structured reasons (§16)                                                  |
| What AI got right and wrong | Nothing                                                                                                                                | Inference judgments (Disagree, Promote) with basis                                                             |
| Rights to learn             | Method origin and rights (ADR-0048)                                                                                                    | **Nothing captures whether an engagement's data may be learned from.** This is the largest pre-requisite (Q19) |
| Abstraction path            | Immutable versions and frozen baselines that a Pattern could reference (ADR-0050)                                                      | Nothing                                                                                                        |

---

## 23. Knowledge Promotion Principle

**Cross-engagement learning must be promoted, not leaked.**

The conceptual flow (engagement observation → candidate learning → human review → abstraction → rights/confidentiality review → approved reusable knowledge) already has a working precedent inside the practice: a closed Method Application becomes a learning source on a draft Method version, which is reviewed and published by a `publish_methodology` holder (ADR-0043, ADR-0044). That is promotion, not leakage, for methodology.

| Destination                                                           | Promotion path                                                                                  | Phase                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| Method revisions                                                      | Learning sources → draft → publish (exists)                                                     | Phase 6, exists        |
| Standards                                                             | Same authoring flow                                                                             | Exists                 |
| Practice Intelligence                                                 | Structured counts over internal practice records                                                | Phase 7 (bounded, §21) |
| Pattern Library                                                       | Abstraction of engagement architecture after completion with client rights respected (ADR-0050) | Later                  |
| Development Intelligence / cross-engagement Architecture Intelligence | Requires Pattern Library or equivalent governed store                                           | Later                  |

**Phase 7 need:** none of the full flow, except to ensure that nothing in Phase 7 creates a path by which engagement content becomes cross-engagement content without it: no global index, no cross-engagement cache, no prompt library built from engagement examples, no fine-tuning or provider-side training on engagement data (§29).

---

## 24. Pattern Library boundary

**Master Build Spec:** §16 defines the Pattern Library (internal architects convert non-confidential structural learning into reusable patterns); §31 assigned "pattern library" to Phase 6. **Phase 6** deliberately did not build it and fixed the boundary (ADR-0050): patterns are not Method Assets; a Model is not a Pattern; nothing anticipates patterns; the Pattern Library is "a later phase".

**Finding:** no phase currently owns the Pattern Library. Phase 7's spec description does not include it; Phase 8 is "cross-engagement intelligence". This is an unassigned deliverable (Q23).

| Possible Phase 7 responsibility                                                       | Recommendation                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Identify possible recurring conditions within one engagement                          | Yes (D-40)                                            |
| Identify recurring conditions across engagements                                      | No, beyond internal practice counts (Q10)             |
| Preserve provenance necessary for later Pattern candidates                            | Yes, by not weakening what exists; nothing new needed |
| Surface "worth examining" recurrence internally                                       | Within engagement and practice counts only            |
| Automatically create Patterns, publish them, claim causality, convert engagement data | No                                                    |

---

## 25. Multi-audience future

The brief's three stages: architect-led (I), professional DSA IDE for other practitioners (II), universal "I want to develop…" (III). Phase 7 builds none of II or III. Assumptions in the current system that bear on them (Verified):

| Assumption                                               | Where                                     | Effect on Stage II/III                                                                                  |
| -------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Exactly one `tplco` organization (partial unique index)  | Phase 1                                   | Stage II needs many practice organizations; `organization_type` already reserves `licensed_practice`    |
| "Internal" side means TPLCo membership                   | `member_side`, engagement member triggers | A licensed firm's architects are "internal" to their engagements, not TPLCo's                           |
| Practice capabilities require an active TPLCo membership | `private.has_practice_capability`         | Method authority is TPLCo-singular by design (ADR-0044); Stage II needs per-practice or licensed access |
| Method Library is TPLCo-wide                             | Phase 6                                   | Licensed practitioners would read authorized subsets (spec §21)                                         |
| Engagements belong to a client organization              | `engagements.client_organization_id`      | Stage III "I want to develop…" for an individual has no client/practice separation                      |

**Phase 7 should avoid adding new TPLCo-singular assumptions (inferred):**

- Key intelligence storage by engagement and by user, not by "TPLCo internal".
- Express intelligence authority in capabilities (engagement or practice scope), never in role names or "is TPLCo".
- Keep rule definitions and prompts free of TPLCo's service-model vocabulary where a methodological term exists (for example, "Review" and "Initiative", not "sprint deliverable").
- Keep cross-engagement practice intelligence as a _practice-scoped_ capability, so a future licensed practice could have its own.

---

## 26. Progressive Architectural Disclosure

**Rigor underneath, simplicity above.** A future non-expert should be able to start with plain language and have DSA progressively surround it with structure.

The existing architecture is well suited: the vocabulary is typed and rule-checked, AI-drafted content already has a governed entry path (`ai_analysis`, pending review, cannot publish unreviewed), and working copies are internal until published. Recognizing "manufacture, distribute and service the product nationally" as candidate Capabilities is structurally an AI-drafted working-copy element awaiting review.

**What Phase 7 must avoid hard-coding (inferred):**

1. **UI that assumes the user knows the ontology.** Intelligence items should be phrased in plain language with the governed term available, not the reverse.
2. **Rules that assume an expert is present.** For example, a rule that fires only on `triaged` records assumes a triage practice.
3. **Candidate generation as publication.** Any "candidate record" from inference must be a draft working copy through existing creation operations, never a published element.
4. **The assumption that every user holds `edit_architecture`.** Candidate preparation for a user who cannot edit must stop at a suggestion.

---

## 27. Professional judgment and escalation

**Principle:** Architecture Intelligence should recognize when complexity, uncertainty, risk or governance requirements warrant professional architectural judgment rather than impersonating expertise.

Existing mechanisms already express "needs professional judgment": escalation to Principal Architect, `publish_architecture` gates on validation, acceptance of risks and AI review, and domain maturity as architect judgment. In Stage I every user is a professional, so automated referral is not needed in Phase 7.

**What to preserve now:** intelligence items should record _which governance act would resolve them_ (for example, "requires a Review", "requires a decision by the decision owner", "requires `publish_architecture`"). That single field, derivable from the rule catalog, is what a later referral mechanism would need. No referral is built.

---

## 28. Client intelligence boundary

| Category                                                            | Client in Phase 7?              | Existing channel                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Internal architectural intelligence (conditions, impact, inference) | No                              | —                                                                                                                        |
| Client-safe deterministic status and context                        | Already exists                  | Portal overview, "What is required from us", domain states, client decisions, client implementation, acceptance criteria |
| Client-facing authored recommendations                              | Already exists                  | Published Recommendation records, client actions, published statements                                                   |
| AI inference                                                        | No                              | —                                                                                                                        |
| Proprietary methodology, practice, cross-engagement knowledge       | Never (ADR-0022, ADR-0043, D32) | —                                                                                                                        |

**Recommendation (Q2, Q12):** Architecture Intelligence is internal-only in Phase 7. Anything a client should know is **authored** by TPLCo through existing governed channels (a client action, a published statement or record). A later phase may consider client-safe deterministic context (for example, "since your last visit: two elements published, one decision awaiting you") computed only from what the client can already read; that needs its own approval because even derived facts about published content could reveal internal timing.

Decisions requiring explicit approval before any client intelligence: whether derived conditions may be shown to clients at all; whether AI may ever produce client-visible text (it would pass through `ai_analysis` review); whether client users get a "since you were away" briefing.

---

## 29. Security and confidentiality implications

Nothing is implemented. These are the choices Phase 7 would face, ordered by reversibility.

### 29.1 Difficult or impossible to reverse

| Choice                                                     | Why irreversible                                                                              | Recommendation                                                                                                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sending engagement content to a model provider             | Data leaves DSA; deletion depends on provider terms                                           | Require a governed per-engagement data-use setting (and contract basis) before any AI processing; zero-retention/no-training terms; send the minimum basis (Q19, Q20)               |
| Sending TPLCo Method content to a provider                 | Method IP leaves DSA                                                                          | Separate decision from client data; default to not sending Method content (Q20)                                                                                                     |
| Creating embeddings or a vector index                      | Derived data inherits confidentiality and deletion obligations; indexes tend to become shared | Not in Phase 7; if ever, engagement-partitioned and RLS-enforced (§20)                                                                                                              |
| Cross-engagement retrieval or caching                      | Leakage cannot be recalled                                                                    | Not in Phase 7 (§23)                                                                                                                                                                |
| Learning from licensed third-party or client-owned sources | Rights                                                                                        | `ip_classification` (`licensed_third_party_source`, `client_owned_source_material`) and method origin (ADR-0048) should exclude such content from AI processing unless rights allow |

### 29.2 Reversible but important

| Area                                  | Implication                                                                                                                                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS                                   | Intelligence read models should be `security invoker` where possible; `security definer` functions (as the signal functions are) must check engagement access first, as they do today                                                                                       |
| Organization and engagement isolation | One engagement per computation and per AI context (§20)                                                                                                                                                                                                                     |
| Method/IP boundary                    | Intelligence surfaced to clients never exists; internal intelligence referencing Method versions stays internal                                                                                                                                                             |
| Files                                 | Engagement files are in a private bucket with signed URLs; AI access to file contents would be a new read path and needs the same checks                                                                                                                                    |
| AI context assembly                   | Assemble as the user through existing read models; never with the service role; include client snapshots vs full snapshots deliberately                                                                                                                                     |
| Logs                                  | `activity_log` already stores full row JSON readable by System Administrators and Principal Architects across all engagements. AI request logs must not add a second such surface; application logs and any observability vendor must not receive prompts or client content |
| Cached intelligence                   | Engagement-keyed; re-check access on read                                                                                                                                                                                                                                   |
| Unreviewed AI in snapshots            | Already refused by `publish_element_version`                                                                                                                                                                                                                                |

---

## 30. Provider independence

**Current repository:** no model-provider SDK, no prompts, no AI configuration (verified `package.json`; ADR-0050 excluded prompt storage). There is nothing to unwind.

**Where DSA's defensibility lives** (§5): the Living Development Model, governed context assembly, provenance, Methodology, promoted learning and the interaction model. None depends on a provider.

**Recommendations (inferred):**

1. A thin server-side interface for "produce an inference from this assembled, permission-checked context under this prompt version", with provider and model recorded as data on every persisted item.
2. Prompts and generation policies as governed, versioned artifacts owned by the practice (ADR-0050 assigned prompt governance to Phase 7), stored in the repository or a governed table, never inside provider-specific tooling.
3. No provider-specific features (hosted retrieval, provider-side memory, provider-side file stores) that would move the Living Development Model or context into the provider.
4. Evaluation of intelligence quality on DSA's own judgments (Promote/Disagree), so a model change can be assessed against DSA data.

Whether a provider abstraction is required now depends on whether AI is in Phase 7 at all (Q14, Q17).

---

## 31. Scenario-analysis boundary

|                  | Impact analysis over known relationships                                         | Simulation/prediction of outcomes                      |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Question         | "If this partner withdraws, what in the architecture depends on it?"             | "If this partner withdraws, will the initiative fail?" |
| Mechanism        | Traversal from the Stakeholder/Opportunity/Dependency across typed relationships | Probabilistic modeling, AI prediction                  |
| Epistemic status | Derived                                                                          | Prediction                                             |
| Governed?        | Yes, every step is a recorded relationship                                       | No                                                     |
| Phase            | Close to Phase 7 (same as §13, starting from a hypothetical change)              | Later, if ever                                         |

"What if" as **hypothetical impact** ("show what would be affected if X were removed or changed") is simply impact analysis with a hypothetical trigger and fits Phase 7. Structured scenarios with persisted assumptions and alternative architectures resemble baselines and branches and deserve their own phase.

---

## 32. Existing UX implications

The established design direction (institutional, calm, typographic, no gamification, no dashboards) and the existing copy ("a prompt to look, never a conclusion"; "a trace to read, not a score"; "Calculated") already define the Edge's voice.

| Surface                 | Natural placement (inferred)                                                                                                                                                      | Avoid                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Global internal landing | Replace or sit beside "Recent activity" with "Your engagements with something to consider", one line per engagement with the count of Elevated/Attention items and the top reason | Cross-engagement comparison, charts   |
| Engagement overview     | A "Development Edge" section: the briefing (since you last reviewed) and the ordered list, each item with lens, epistemic label and reason                                        | Tiles, gauges, completion percentages |
| Architecture element    | Extend "Bearing on this element" into one composed panel: conditions whose subject or basis includes the element, then the impact trace                                           | Duplicating the existing Impact panel |
| Project Intelligence    | Signals page becomes the engagement Edge list (or links to it), filtered to Project Intelligence                                                                                  | A second signals page                 |
| Implementation          | "Correspondence" panel: D-14–D-20 for this initiative                                                                                                                             | A health score                        |
| Review detail           | "Since this review was prepared": `compare_baselines` for examined elements, evidence after held, escalations touching examined elements, criteria in force                       | Auto-generated agenda                 |
| Method Application      | Absent expected outputs and inputs; methodology changes since start                                                                                                               | Adherence scoring                     |
| Evidence                | "This evidence bears on": statements (with stance), elements, initiatives, applications                                                                                           | Evidence-strength scores              |
| Client portal           | No change in Phase 7                                                                                                                                                              | Any intelligence                      |

---

## 33. Relationship to later phases

| Later phase (spec)                                                       | Phase 7 establishes                                                                    | Phase 7 deliberately does not                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Pattern Library (spec §16; unassigned since Phase 6)                     | Provenance and immutable references stay intact; within-engagement recurrence surfaced | Pattern tables, candidates, extraction, publication               |
| Portfolio Intelligence (Phase 8, spec §17)                               | Controlled categories and structured judgments that Phase 8 could aggregate            | Cross-engagement dashboards, recurring-risk metrics, benchmarking |
| Certification/Licensing (Phase 9, spec §21)                              | No new TPLCo-singular assumptions (§25)                                                | Licensed access to intelligence                                   |
| Generalized analytics                                                    | Nothing                                                                                | Anything                                                          |
| AI automation                                                            | Human-governed promotion path                                                          | Any automated write to governed records                           |
| Cross-client benchmarking                                                | Nothing                                                                                | Anything                                                          |
| Structural Coherence Engine (spec §19, "future premium")                 | Possibly the deterministic coherence subset (D-05, D-06, D-09–D-11) (Q27)              | A coherence report or AI coherence engine                         |
| Deliverable generation (spec §12; deferred to Phase 7 by Phases 5 and 6) | Decision on whether generation is in Phase 7 (Q25)                                     | —                                                                 |

---

## 34. Failure modes

| Failure mode                                  | How it would happen                                                          | Structural protection (existing or recommended)                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| DSA becomes an AI wrapper                     | Value concentrated in model output                                           | Deterministic-first Edge (§5, Q9, Q17)                                                                                                    |
| Alert fatigue                                 | Every rule surfaces everywhere                                               | Scope rules, tiers, fingerprinted judgments, no push (§15, §16)                                                                           |
| AI hallucination enters governed Architecture | Inference copied into records                                                | Inference never becomes a record except via Promote through existing operations; `ai_analysis` review gate for AI-drafted text (§16, §18) |
| Opaque importance scoring                     | Weighted AI score                                                            | Lexicographic, explained tiers; AI explains, never ranks (§15.1)                                                                          |
| Stale persisted inferences                    | Basis changes                                                                | Basis versions stored; staleness by version comparison (§16)                                                                              |
| Duplicate Project Intelligence                | Intelligence items modeled as records, or promotion creating near-duplicates | Items are not records; promotion shows existing related records before creating (§6, §16)                                                 |
| Cross-client leakage                          | Shared index, cache, prompt examples                                         | One engagement per computation and context; no global index (§20)                                                                         |
| Methodology/IP leakage                        | Method content in client-visible output or provider requests                 | Internal-only intelligence; separate decision on sending Method content (§29)                                                             |
| Excessive token/model cost                    | AI run on every change                                                       | Deterministic layer first; AI on demand or bounded triggers                                                                               |
| Intelligence latency                          | Traversals on every page                                                     | Scoped contextual queries; engagement-sized graphs; measure before caching                                                                |
| Over-reliance on embeddings                   | Semantic search substitutes for typed relationships                          | Typed traversal is the primary path; embeddings not in Phase 7                                                                            |
| Architecture subordinate to AI                | Users accept suggestions as architecture                                     | Epistemic labels; human-only promotion; AI never critical                                                                                 |
| Blind acceptance                              | Promote is one click                                                         | Promotion requires completing the governed operation's fields; judgments recorded                                                         |
| Universal IDE becomes generic                 | Diluting the Development Architecture Method vocabulary                      | Governed vocabulary is the substrate; plain language is a presentation layer (§26)                                                        |
| Overfitting to TPLCo's service model          | Rules and prompts encode TPLCo's current offerings                           | Capability-based authority; methodological vocabulary (§25)                                                                               |
| Building Phase 8/9 early                      | Cross-engagement features "because the data is there"                        | Explicit boundaries (§21–§24, §33)                                                                                                        |
| Surveillance creep                            | Last-seen and view tracking                                                  | Explicit user-controlled watermark only (§14.5)                                                                                           |
| Rule drift without governance                 | Thresholds changed silently                                                  | Rule catalog mirrored and tested; thresholds documented (§10)                                                                             |

---

## 35. Master Build Spec / ADR conflicts

### 35.1 Conflicts or tensions requiring a decision

| #   | Source                                                                                                  | Tension                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Recommendation                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | ADR-0032; Phase 4 proposal §11                                                                          | "Future AI findings will be stored, not computed, with `ai_analysis` provenance and the Phase 3 review gate; it will appear in the same panel." The brief distinguishes ephemeral assistance from durable inference, and intelligence observations from architecture content. `ai_analysis` provenance lives on elements, statements and relationships; applying it to observations would either create pending AI statements in working copies or stretch the enum's meaning | Amendment note on ADR-0032: `ai_analysis` + review gate governs AI-drafted **content entering architecture**; AI **intelligence observations** are a separate, non-architecture artifact with their own provenance (§18). "Stored, not computed" holds for durable inference; ephemeral assistance is not stored (Q16) |
| C2  | Spec §31 Phase 7 "AI-assisted analysis, research support, coherence checks"; spec §18 list              | The brief positions Phase 7 as a deterministic-first Development Edge. "Research support" implies external retrieval (web), which is a data-transfer decision                                                                                                                                                                                                                                                                                                                 | Treat §18/§31 as the direction, and the brief as its refinement. Decide whether AI and external research are in Phase 7 (Q17, Q20)                                                                                                                                                                                     |
| C3  | Spec §19 Structural Coherence Engine ("future premium")                                                 | Several deterministic Integrity conditions are coherence checks                                                                                                                                                                                                                                                                                                                                                                                                               | Decide whether the deterministic subset is Phase 7 (Q27)                                                                                                                                                                                                                                                               |
| C4  | Spec §16 and §31 (Pattern Library in Phase 6); ADR-0050 ("a later phase")                               | No phase owns the Pattern Library                                                                                                                                                                                                                                                                                                                                                                                                                                             | Assign explicitly (Q23)                                                                                                                                                                                                                                                                                                |
| C5  | Spec §12 ("generated from structured project data"); Phase 5 and Phase 6 deferred generation to Phase 7 | The brief does not mention deliverable generation                                                                                                                                                                                                                                                                                                                                                                                                                             | Decide whether generation is in Phase 7 (Q25)                                                                                                                                                                                                                                                                          |
| C6  | Spec §14 "AI prompts"; ADR-0050 D26 "Prompt governance is designed in Phase 7"                          | If Phase 7 includes AI, it must include prompt governance                                                                                                                                                                                                                                                                                                                                                                                                                     | Include prompt governance with any AI (Q14)                                                                                                                                                                                                                                                                            |
| C7  | Spec title "Development Systems Architecture OS"; README and CLAUDE.md                                  | The brief introduces "DSA IDE"                                                                                                                                                                                                                                                                                                                                                                                                                                                | Terminology decision (Q1)                                                                                                                                                                                                                                                                                              |
| C8  | Phase 5 D16 "no elapsed-time stall inference"                                                           | Foresight could drift into time-based inference                                                                                                                                                                                                                                                                                                                                                                                                                               | Keep D16 as a rule for Phase 7 (Q21)                                                                                                                                                                                                                                                                                   |
| C9  | ADR-0032 thresholds are constants in functions                                                          | Prioritization and scope rules may want tuning                                                                                                                                                                                                                                                                                                                                                                                                                                | Keep constants in migrations, documented in the rule catalog; no user-tunable thresholds in Phase 7                                                                                                                                                                                                                    |
| C10 | `intelligence_attention = critical`, `recommendation_priority = critical`                               | Brief's "Critical" interruption tier                                                                                                                                                                                                                                                                                                                                                                                                                                          | Define the top tier as the human-set states, or rename the tier (Q22)                                                                                                                                                                                                                                                  |
| C11 | CLAUDE.md "do not create a Phase 7 branch, proposal …"                                                  | This reconciliation creates a review branch                                                                                                                                                                                                                                                                                                                                                                                                                                   | Authorized by Kerrick's brief (§42.4) for this document only; CLAUDE.md is not changed here                                                                                                                                                                                                                            |

### 35.2 Consistent (no conflict)

Spec §18's "must always distinguish source evidence, architect judgment, AI-generated analysis, client decision" is consistent with, and extended by, §9. Spec §25 "no cross-client data leakage" and §27 "No client user can access method_assets" are preserved by §20, §28 and §29. ADR-0009's closed provenance list is unchanged by the recommendations (epistemic status is a separate axis). ADR-0019 (judgment never computed) is the model for §9. ADR-0039 is respected (§12.4).

---

## 36. Structural gaps in Phases 1–6

None requires redesigning Phases 1–6; each is an extension.

| #   | Gap                                                                                                                       | Evidence                                                                                            | Needed for                                                  | Nature                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| G1  | Curated, capability-aware change read model stops at Phase 4 entity types                                                 | `architecture_activity` entity list in `20261002000100`; Phase 5/6 tables logged but not classified | Since You Were Away; Change lens                            | Extend read model                           |
| G2  | Raw `activity_log` readable only by System Administrators and Principal Architects, with full row JSON across engagements | Phase 1 policy                                                                                      | Any broader change awareness must go through curated models | Constraint to respect, not open             |
| G3  | Two impact traversals with fixed, different subsets; no incoming PI; no off-spine joins                                   | §13.1                                                                                               | Impact analysis                                             | Extend recursive SQL                        |
| G4  | No common envelope over the two signal functions; no Phase 6 rules; no cross-namespace rules                              | §12                                                                                                 | Development Edge                                            | New read path; judgments reuse dismissals   |
| G5  | No first-observed time for conditions                                                                                     | ADR-0032 (computed only)                                                                            | Intelligence deltas in the briefing                         | Derive from basis timestamps first (Q7)     |
| G6  | No per-user briefing watermark                                                                                            | `profiles`                                                                                          | Since You Were Away                                         | Small, user-private state (Q7)              |
| G7  | No AI provenance or prompt governance structures                                                                          | ADR-0050                                                                                            | Any persisted inference                                     | New, only if AI is in Phase 7               |
| G8  | No engagement-level data-use classification (AI processing, cross-engagement learning)                                    | No column or table; `ip_classification` is per record                                               | Any AI; any later learning                                  | New governance decision (Q19)               |
| G9  | `implements` and `validates` pin no element version                                                                       | ADR-0046 context                                                                                    | Realization correspondence                                  | Derivable by timestamps now; pinning is Q26 |
| G10 | Signals are not shown on element, review or initiative pages                                                              | `src/app`                                                                                           | Contextual Edge                                             | UI only                                     |
| G11 | No reverse "bears on" view for an evidence source                                                                         | `evidence/page.tsx`                                                                                 | Contextual Edge on Evidence                                 | UI and read model only                      |
| G12 | Development Contexts are empty in production until TPLCo defines them                                                     | ADR-0045                                                                                            | Practice Intelligence by context                            | Practice task, not engineering              |

---

## 37. Questions requiring conceptual decisions

Each question lists the recommendation, alternatives, consequences, informing structures and reversibility. These are conceptual decisions, not Phase 7 implementation decisions.

**Q1. Do the five product concepts enter repository terminology?** (DSA IDE, Living Development Model, Architecture Intelligence, Development Edge, Intelligence Contract)

- **Recommendation:** Adopt all five as **product and documentation terms** in a Phase 7 glossary. Keep "Architecture Intelligence" as the phase name (spec §18, §31). Use "Development Edge" and "Intelligence Contract" in UI copy and docs. Use "Living Development Model" as a concept only, never a table or type name. Treat "DSA IDE" as the product paradigm; decide separately whether the product name changes from "DSA OS" (README, CLAUDE.md, spec title), because that is a brand decision.
- **Alternatives:** adopt only in docs; adopt as code names (tables, modules); defer.
- **Consequences:** code names would harden concepts into schema before their meaning settles; docs-only keeps them flexible.
- **Informing structures:** spec title and §31; README and CLAUDE.md phase lines; ADR-0016's rule that vocabulary is governed.
- **Reversibility:** docs terms easy; schema names hard; product rename moderate.

**Q2. Is Architecture Intelligence internal-only initially?**

- **Recommendation:** Yes, for all of Phase 7.
- **Alternatives:** client-safe deterministic context in Phase 7; client AI summaries after review.
- **Consequences:** clients keep the authored portal; no risk of internal timing or method exposure.
- **Informing structures:** ADR-0014, ADR-0022, ADR-0027 (attention never reaches clients), ADR-0043 D32.
- **Reversibility:** easy to widen later; hard to retract once clients rely on it.

**Q3. May AI inferences be persisted?**

- **Recommendation:** Yes, only when surfaced proactively in the Edge or elected by the user, with full provenance and basis versions (§17, §18), as a non-architecture artifact.
- **Alternatives:** never persist (ephemeral only); persist everything generated.
- **Consequences:** never-persist makes the Contract and learning impossible; persist-everything creates the graveyard and a confidential-content store.
- **Informing structures:** ADR-0032's "stored, not computed"; `ai_analysis` gate.
- **Reversibility:** stored inference can be deleted; data sent to a provider cannot be recalled (independent of this choice).

**Q4. Should user judgments on intelligence be durable?**

- **Recommendation:** Yes, append-only, attributed, with reasons, extending the dismissal model (§16).
- **Alternatives:** ephemeral (UI state only); durable but editable.
- **Consequences:** durable judgments give suppression, audit and learning; they are attributed, so framing must avoid productivity readings (§14.5).
- **Informing structures:** `intelligence_signal_dismissals`, `implementation_signal_dismissals`, ADR-0028 append-only histories.
- **Reversibility:** moderate; history once kept should be kept.

**Q5. Should deterministic intelligence extend Phase 4 Signals or sit above them?**

- **Recommendation:** Both, as Option D (§12.3): new rules are signals in their home namespace; a common envelope and one Edge read path sit above all of them.
- **Alternatives:** extend only; supersede with a new abstraction.
- **Consequences:** no duplication; ADR-0039 respected; one experience.
- **Informing structures:** ADR-0032, ADR-0039, the two signal functions.
- **Reversibility:** moderate; the envelope shape becomes a contract for UI and later AI.

**Q6. Can intelligence be promoted into Project Intelligence?**

- **Recommendation:** Yes, only by a human completing the existing creation or governance operation (create Risk, record Decision, propose criterion, schedule Review), pre-filled, with a link to the originating item. Never automatic.
- **Alternatives:** no promotion (users re-type); automatic record creation on thresholds.
- **Consequences:** preserves human sovereignty; gives Practice Intelligence its "architects repeatedly promote" signal.
- **Informing structures:** Phase 4 operations; `create_architecture_element`; ADR-0043 D31 (method work creates ordinary records through ordinary operations).
- **Reversibility:** easy.

**Q7. Does "Since You Were Away" warrant user-state persistence?**

- **Recommendation:** Yes, minimally: one explicit, user-controlled "briefed through" timestamp per user and engagement, private to the user. Derive "new" intelligence from basis timestamps rather than storing first-observed times. No view tracking.
- **Alternatives:** use sign-in time; track page views; fixed windows ("last 7 days") with no state.
- **Consequences:** meaningful briefings without surveillance; fixed windows are stateless but miss or repeat.
- **Informing structures:** `profiles` (no such state); `activity_log`; Phase 5 D16's aversion to inferred behavior.
- **Reversibility:** easy.

**Q8. Does impact analysis belong in Phase 7?**

- **Recommendation:** Yes: unified traversal over known relationships and off-spine governance links, on demand and change-triggered, including hypothetical "what if X changed" (§13, §31).
- **Alternatives:** keep the two existing traces; defer.
- **Consequences:** the strongest Claude Test capability; modest engineering (recursive SQL).
- **Informing structures:** `intelligence_impact`, `implementation_impact`, relationship vocabulary.
- **Reversibility:** easy (read models).

**Q9. Is Development Edge prioritization deterministic-first?**

- **Recommendation:** Yes: explained lexicographic tiers from governed factors (§15.1). AI may explain an item, not rank it, in Phase 7.
- **Alternatives:** weighted score; AI ranking.
- **Consequences:** transparent, stable, testable ordering; less "clever".
- **Informing structures:** ADR-0019 (no computed judgment), stewardship attention, escalation.
- **Reversibility:** easy.

**Q10. Does cross-engagement recurrence detection belong in Phase 7?**

- **Recommendation:** No, beyond structured internal practice counts on Method Assets (Q11). Architecture recurrence across engagements waits for the promotion flow and Pattern Library.
- **Alternatives:** internal-only architecture recurrence (for example, "this dependency configuration appears in 3 engagements").
- **Consequences:** avoids the most leakage-prone capability and the "recurrence is truth" trap.
- **Informing structures:** ADR-0050; Phase 6 §22.3; spec §17 (Phase 8).
- **Reversibility:** easy to add later; hard to retract once users rely on it.

**Q11. Does Practice Intelligence begin in Phase 7?**

- **Recommendation:** Yes, narrowly (§21): per-application conditions in the engagement, and structured counts with n on Method Asset pages; no free-text aggregation, no scoring, no automatic Method changes.
- **Alternatives:** defer entirely to Phase 8; include AI summaries of stage notes.
- **Consequences:** uses the data Phase 6 was designed to capture; keeps client content out of cross-engagement views.
- **Informing structures:** Phase 6 §22, ADR-0043, `method_usage`.
- **Reversibility:** easy.

**Q12. What client-safe intelligence, if any, should exist?**

- **Recommendation:** None new in Phase 7 (§28). Later candidate: a client briefing computed only from client-readable published content, approved separately.
- **Alternatives:** client-visible derived conditions on published architecture; reviewed AI summaries.
- **Consequences:** zero new exposure.
- **Informing structures:** client read models, `element_client_readable`, contributor areas.
- **Reversibility:** easy.

**Q13. Does conversational access belong in Phase 7?**

- **Recommendation:** Not as a general chatbot. Optionally, an engagement-scoped "ask about this" that answers from governed records with citations and epistemic labels, ephemeral by default, if AI is in Phase 7 at all (§19).
- **Alternatives:** full conversational assistant; none.
- **Consequences:** conversational AI is the most reproducible capability under the Claude Test; its value is only as an interface to the model.
- **Informing structures:** §19 classification.
- **Reversibility:** easy.

**Q14. Is provider abstraction required now?**

- **Recommendation:** Only if AI is in Phase 7, and then minimal (§30): provider and model as data, governed prompt versions, no provider-hosted memory or retrieval. Prompt governance comes with it (ADR-0050).
- **Alternatives:** direct single-provider integration; full multi-provider framework.
- **Consequences:** cheap insurance; avoids lock-in without over-engineering.
- **Informing structures:** `package.json` (no SDK), ADR-0050 D26.
- **Reversibility:** moderate.

**Q15. Are any new global knowledge structures justified before the Pattern Library?**

- **Recommendation:** No. Rule and prompt catalogs are practice/product configuration, not knowledge. Practice counts are read models over existing tables.
- **Alternatives:** a "candidate learning" store in Phase 7.
- **Consequences:** keeps the promotion principle intact until rights and abstraction exist.
- **Informing structures:** ADR-0050, §23.
- **Reversibility:** a global store is hard to unwind once populated.

**Q16. How should ADR-0032's AI sentence be reconciled?**

- **Recommendation:** Amendment note (with the Phase 7 ADRs, not now): `ai_analysis` + review gate governs AI-drafted content entering architecture; AI observations are a separate non-architecture artifact; durable inference is stored, ephemeral assistance is not.
- **Alternatives:** follow ADR-0032 literally (AI findings as pending `ai_analysis` statements or elements); supersede ADR-0032.
- **Consequences:** literal reading would fill working copies with pending AI content and blur architecture with intelligence.
- **Informing structures:** ADR-0009, ADR-0015, ADR-0032.
- **Reversibility:** moderate.

**Q17. Should Phase 7 include AI at all, or be split?**

- **Recommendation:** Split: **7A** deterministic Development Edge (inventory rules, envelope, impact, change awareness, briefing, contextual panels, judgment lifecycle, Practice Intelligence counts); **7B** bounded AI inference and optional conversational access, after 7A exists and after Q19/Q20 are decided. Each with its own proposal and acceptance.
- **Alternatives:** one Phase 7 with both; AI first.
- **Consequences:** 7A passes the Claude Test without any provider; 7B then interprets a model that already works.
- **Informing structures:** spec §31; §5 of this document.
- **Reversibility:** easy (sequencing).

**Q18. What provenance does a promoted record carry?**

- **Recommendation:** Provenance follows whose authority the claim rests on. If the architect adopts and states it, `architect_judgment` with a link to the originating item; if AI-drafted text is kept, `ai_analysis` with `pending` review under the existing gate. Deterministic-condition promotions are `architect_judgment` (the rule prompted; the architect judged).
- **Alternatives:** always `ai_analysis` for anything AI touched; a new provenance value (requires an ADR per ADR-0009).
- **Consequences:** keeps the eight-value list; keeps the review gate meaningful.
- **Informing structures:** ADR-0009, ADR-0015, ADR-0047 (narrow reading precedent).
- **Reversibility:** hard for records created (history is permanent).

**Q19. Is a per-engagement data-use classification required before any AI or learning?**

- **Recommendation:** Yes: a governed engagement setting (who may set it, with contract basis) stating whether engagement content may be processed by an AI provider, and separately whether it may contribute to cross-engagement learning after promotion. Default: neither.
- **Alternatives:** blanket policy in contracts only; per-record flags only (`ip_classification`).
- **Consequences:** makes consent explicit and enforceable in the database.
- **Informing structures:** `ip_classification`, ADR-0048 origin and rights, Phase 6 §22.3.
- **Reversibility:** the setting is reversible; processing done under it is not.

**Q20. What may be sent to a model provider, and what is logged?**

- **Recommendation:** Minimum basis only; published or working content per a stated policy; no TPLCo Method content by default; zero-retention and no-training terms; no prompts or client content in application logs or third-party observability; audit log records request metadata and basis ids, not payloads.
- **Alternatives:** full context; include Method content; payload logging.
- **Consequences:** limits irreversible exposure.
- **Informing structures:** spec §25; `activity_log` breadth (G2).
- **Reversibility:** irreversible once sent.

**Q21. Should Phase 5 D16 (no elapsed-time inference) govern Phase 7 Foresight?**

- **Recommendation:** Yes. Foresight uses recorded dates and governance proximity only.
- **Alternatives:** allow elapsed-time heuristics as Suggested items.
- **Consequences:** keeps "calm" and avoids manufactured urgency.
- **Informing structures:** Phase 5 D16; `implementation_past_target`.
- **Reversibility:** easy.

**Q22. What is the top interruption tier, and what is it called?**

- **Recommendation:** Define it as exactly the human-set states (attention `critical`, open escalation), and name it so it does not read as a new AI or rule output.
- **Alternatives:** a rule-defined critical tier.
- **Consequences:** AI and rules never declare criticality.
- **Informing structures:** `intelligence_attention`, escalations, brief §14.
- **Reversibility:** easy.

**Q23. Which phase owns the Pattern Library?**

- **Recommendation:** Assign it explicitly as its own phase after Portfolio Intelligence, or as the first part of Phase 8, preceded by the data-use classification (Q19). Not Phase 7.
- **Alternatives:** Phase 7; leave unassigned.
- **Consequences:** removes an ambiguity carried since Phase 6.
- **Informing structures:** spec §16, §31; ADR-0050.
- **Reversibility:** easy (planning).

**Q24. Does the Edge send any notification in Phase 7?**

- **Recommendation:** No. In-product only. Notification delivery (email) remains the separate pre-production requirement already recorded.
- **Alternatives:** email for Elevated/Critical.
- **Consequences:** calm; no notification-volume failure mode.
- **Informing structures:** no notification infrastructure exists.
- **Reversibility:** easy.

**Q25. Is deliverable generation (spec §12) in Phase 7?**

- **Recommendation:** Not in 7A. If ever, generate only from published versions with `produced_from` Template lineage, as a Deliverable working copy with `ai_analysis` review where AI drafts text.
- **Alternatives:** include in Phase 7; separate phase.
- **Consequences:** generation is high Claude-Test reproducibility unless structurally grounded.
- **Informing structures:** Phase 5 proposal (spec §12 generation deferred to Phase 7), Phase 6 proposal C11 and D18, ADR-0047.
- **Reversibility:** easy.

**Q26. Should `implements` and `validates` correspondence be version-pinned later?**

- **Recommendation:** Not in Phase 7; derive from timestamps (D-15, D-16) and revisit if false positives are material.
- **Alternatives:** pin versions on these relationships now.
- **Consequences:** pinning would change Phase 5 semantics and require a migration; timestamps are adequate for surfacing.
- **Informing structures:** ADR-0046 context, `validation_criteria`, `observed_version_id`.
- **Reversibility:** pinning is hard to undo.

**Q27. Does the deterministic subset of the Structural Coherence Engine belong in Phase 7?**

- **Recommendation:** Yes, as Integrity-lens rules (D-05, D-06, D-09–D-11) without a "Structural Coherence Report" product.
- **Alternatives:** defer all of spec §19.
- **Consequences:** coherence becomes continuous rather than a report.
- **Informing structures:** spec §19; `conflicts_with` definition ("later available to coherence analysis").
- **Reversibility:** easy.

**Q28. Should rule definitions be a governed, tested catalog?**

- **Recommendation:** Yes: a rule catalog in code (key, lens, definition, why it matters, resolving governance act, basis) mirrored against the SQL and tested, like the vocabulary mirrors.
- **Alternatives:** definitions only in SQL comments.
- **Consequences:** satisfies the Contract's "why"; supports §27 escalation later.
- **Informing structures:** `vocabulary.test.ts`, `catalog.test.ts` mirror tests.
- **Reversibility:** easy.

---

## 38. Recommendations before the formal Phase 7 proposal

1. **Answer Q1–Q28**, at minimum Q2, Q5, Q7, Q8, Q16, Q17, Q19, which shape everything else.
2. **Execute the inventory read-only** against seed data (Meridian and Harbor) in a local database, without migrations, to measure which candidates fire, how often, and with what false positives. Drop or rescope noisy candidates before the proposal. This turns "Derivable" into "Verified".
3. **Define impact direction per relationship type** (§13.3) as a short table for review; it is the core of impact analysis and a methodological, not technical, decision.
4. **Draft the Edge's user-facing language** (epistemic labels, tier names, judgment actions) for review in the same voice as existing copy.
5. **Decide the data-use and provider policy** (Q19, Q20) with legal and contract input before any AI design, since it is the only genuinely irreversible choice.
6. **Assign the Pattern Library** (Q23) so Phase 7 scope is bounded by a named neighbor.
7. **Then write `PHASE_7_PROPOSAL.md`** (or 7A), with the amendment to ADR-0032 and the new ADRs proposed there, not before.

---

## Appendix A. Sources inspected

- `DSA_OS_MASTER_BUILD_SPEC.md` (§1, §3, §6, §11–§21, §23, §25–§27, §31–§33)
- `CLAUDE.md`, `README.md`
- ADR-0009, 0013, 0014, 0015, 0017, 0019, 0020, 0022, 0023, 0027, 0028, 0030, 0032, 0043, 0045, 0046, 0047, 0050
- `docs/database/schema.md`, `architecture.md`, `intelligence.md`, `reviews-deliverables-implementation.md`, `method-library.md`
- Phase 3–6 proposals (AI, Phase 7 and learning sections) and reports
- Migrations: `20260929230000_phase1_foundation.sql` (activity log and policy), `20261002000100_project_intelligence.sql` (`intelligence_impact`, `intelligence_signals`, `architecture_activity`), `20261003000100_reviews_deliverables_implementation.sql` (`implementation_impact`, `implementation_signals`)
- `src/domain/architecture/vocabulary.ts` (39 relationship types and rules), `src/types/database.ts` (columns and enums), `src/app` (internal and client pages), `src/components/intelligence/element-panels.tsx`, `package.json`
