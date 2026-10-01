# Phase 7B.2 — Architecture Intelligence Experience: Conceptual Reconciliation

**Status:** investigation only. Revision 1, 2026-10-01, for Kerrick's review.

**Scope:** what it should feel like to develop a real-world system inside DSA IDE when the environment can interpret its own governed state. No proposal, schema, migration, application code, credential, provider call, dependency or evaluated-model change accompanies this document. The Phase 7B.2 hold in `CLAUDE.md` is unchanged.

**Read against:** `main` at `0e6e313` (Phases 1 to 7B.1 merged). Sources: `DSA_OS_MASTER_BUILD_SPEC.md` §18 and §19; `CLAUDE.md`; `README.md`; `PHASE_7_CONCEPTUAL_RECONCILIATION.md`; `PHASE_7A_PROPOSAL.md` and `PHASE_7A_REPORT.md`; `PHASE_7B_CONCEPTUAL_RECONCILIATION.md` (Revision 2, decisions B-1 to B-31); `PHASE_7B_1_PROPOSAL.md` (OD-1 to OD-17) and `PHASE_7B_1_REPORT.md`; ADR-0013 to ADR-0066 and their amendments; `docs/database/edge.md` and `architecture-intelligence.md`; the internal and client routes under `src/app`.

**Conventions.** "[fact]" marks something read from the repository. "[inference]" marks a judgment of this document. Decisions for Kerrick are numbered **IX-1** to **IX-26** and collected in §36. Earlier decisions are cited by their own numbers (B-n, OD-n, P7-Qn).

---

## 1. Executive summary

**The strongest conclusion.** DSA IDE's intelligence should be experienced as **interrogating the development**, not conversing with a model. The architect is already looking at a governed object: an element, an Edge item, a Review, an Implementation Initiative, an evidence link. Intelligence belongs on that object. It answers a small number of precise questions about it. It always shows **what DSA knows** before **what a model thinks it might mean**, and it leaves **what the person decides** explicit. Nothing it says outlives the exact versions it read.

**The reference pattern** for every interaction is the one Kerrick named for Review preparation:

> **DETERMINISTIC CONTEXT ASSEMBLY + BOUNDED AI INTERPRETATION**

DSA assembles, from governed state, everything it can establish exactly. The model is asked only the part that depends on meaning in text. In most interactions the deterministic part is the larger and more valuable part. AI is the second paragraph, not the first. [inference]

**The headline recommendations**

1. **No generic chat** in 7B.2, and no chat as the centre of DSA IDE at any later stage without a new reconciliation (IX-6).
2. **Object-anchored interrogation with one contextual drawer** (Model D, §30): actions on the objects that already carry governed meaning open a drawer with three layers: _What DSA knows_ (deterministic), _Interpretation_ (on request), _Judgment_ (the person's).
3. **Prepare is the flagship of 7B.2.** A Review dossier assembled deterministically from the examined-version capture, with a bounded `review_brief` interpretation on request. It is the experience that most clearly fails the Claude Test for a generic model (§29). (IX-4)
4. **Explain is mostly deterministic, already.** The 7A envelope answers "why am I seeing this?" without a model. AI adds only the connection between a condition and the subject's own statements (`explanation`). (IX-2)
5. **Examine is a verb, not a kind.** It is delivered by the three existing interpretive kinds: `tension`, `evidence_bearing`, `realization_reading`. (IX-3)
6. **Challenge does not become a separate mode or a new inference kind in 7B.2.** Its legitimate parts are deterministic (unevidenced assumptions, contradicting stances) or already covered (`tension`, `evidence_bearing`). Its speculative part ("what is the strongest opposing interpretation?") is generic-model value with a high risk of manufactured doubt. Revisit with judgment data. (IX-5, IX-9)
7. **Read the development does not belong in 7B.2.** It is not `realization_reading`. A whole-development reading exceeds the 7B.1 bounds by design, and the honest version of it is mostly a deterministic **Development Brief** that should be built first. (IX-10, IX-11)
8. **Intelligence is on demand.** Deterministic conditions may make an interpretation _available_ ("Interpret" appears where it can help). The model runs only when a person asks. No proactive or background inference. (IX-16)
9. **Same question, same answer while the basis is unchanged.** A current interpretation is reused rather than regenerated, and judged-away interpretations do not return until their basis changes. (IX-13, IX-14)
10. **Inferences reach the Edge only as `suggested`**, in their own section outside the tiers, and only when a person has asked for them and they are current (B-14, IX-17).
11. **Only people promote.** AI does not suggest promotion destinations in 7B.2 and never executes promotion. (IX-20)
12. **No client AI, no Method-aware AI, no Development Context steering** in 7B.2. (IX-21, IX-22, IX-23)
13. **Sequencing constraint.** No 7B.2 interpretation can reach a person until a real model is evaluated (OD-8). A governed seed-only real-provider evaluation is therefore the first step of 7B.2, before any user-facing work. Until the B-4 contractual prerequisites are met, 7B.2 can only be exercised on synthetic engagements. (IX-1)

---

## 2. Current intelligence foundation

What exists on `main` [fact]:

| Layer                    | What exists                                                                                                                                                                                                                                                                                                             | Where                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Living Development Model | Four domains, 27 core element kinds, 6 cross-domain Project Intelligence kinds, Review / Deliverable / Implementation Initiative, 39 typed relationships, versioned published snapshots, statements with provenance, evidence with stance, approvals, baselines                                                         | ADR-0013 to ADR-0040                                     |
| Method                   | Method Library (internal), DAM releases, Development Context, Method Applications, typed lineage, Acceptance Criteria                                                                                                                                                                                                   | ADR-0041 to ADR-0050                                     |
| Deterministic Edge       | 42 rules, one envelope (`edge_items`, computed on read), one event per triggering change, governed impact matrix and `impact_trace`, substantive revisions, Review examined-version capture, `development_changes`, a private "since you last reviewed" briefing, human judgments with fingerprints, governed promotion | ADR-0051 to ADR-0059                                     |
| Authorisation            | Versioned per-engagement external-processing authorisation, default No; data origin; processing mode; four data classes                                                                                                                                                                                                 | ADR-0060                                                 |
| Capabilities             | `use_architecture_intelligence` (Principal Architect, Architect), `authorize_external_ai_processing` (Principal Architect)                                                                                                                                                                                              | ADR-0061                                                 |
| Gateway                  | One server-only path, re-checks before every send, anchors plus at most six model-requested tool calls (OD-7), no repair, evaluated models only                                                                                                                                                                         | ADR-0062                                                 |
| Tool Contract            | Ten read-only functions, one projection, Method/IP and licensed sources withheld, evidence metadata only, people stripped, digests                                                                                                                                                                                      | ADR-0063                                                 |
| Inference model          | Five kinds; structured envelope (assertion, cited claims, uncertainty, examination, payload); basis rows pinned by version and digest; computed staleness; `suggested` / `model`                                                                                                                                        | ADR-0064                                                 |
| Prompts and evaluation   | Versioned, hash-pinned prompts; fake-adapter CI cases; seed-only live harness; **no model evaluated**                                                                                                                                                                                                                   | ADR-0065                                                 |
| Audit                    | Metadata-only request record; budget per engagement; never per person                                                                                                                                                                                                                                                   | ADR-0066                                                 |
| User-facing AI           | **None.** The Architecture Intelligence page shows authorisation, history and request metadata only (OD-12)                                                                                                                                                                                                             | `/internal/engagements/[slug]/architecture-intelligence` |

What the 7B.1 subject model already allows [fact, `kinds/plans.ts`, ADR-0064]:

| Kind                  | Subject types                                 | Context cap (tokens) | Output cap |
| --------------------- | --------------------------------------------- | -------------------- | ---------- |
| `explanation`         | Edge item, substantive revision, impact trace | 24,000               | 2,000      |
| `tension`             | Ordered pair of connected elements            | 24,000               | 2,000      |
| `evidence_bearing`    | Evidence link                                 | 16,000               | 1,500      |
| `review_brief`        | Review element                                | 32,000               | 3,000      |
| `realization_reading` | Implementation Initiative                     | 32,000               | 3,000      |

Current surfaces where intelligence could live [fact, `src/app`]: engagement overview; Edge; architecture and domain pages; element page (with the contextual Edge panel and impact panel); evidence; intelligence registers, client input and signals; reviews and Review page; deliverables; implementation and initiative page; Method Applications; baselines; the Architecture Intelligence page. Client portal: overview, actions, architecture, decisions, implementation, reviews, billing.

**What this means for the experience.** 7B.1 built a narrow, strict, per-object interpretive engine. The experience question is not "what can a model do?" but "where, in the work architects already do on these pages, does a bounded interpretation of an exact object change what they see or decide?" [inference]

---

## 3. Experience thesis

**Developing a real-world system inside DSA IDE should feel like working inside a model that knows what it is, remembers how it became that way, and can tell you, precisely and on request, what it might mean.**

Four qualities define that feeling [inference]:

1. **Grounded.** Every sentence the environment says is either a governed fact, a reproducible condition, or a cited interpretation of named versions. The architect never has to wonder which.
2. **Anchored.** Intelligence is where the work is. The architect does not leave the Review to ask about the Review.
3. **Quiet.** The environment speaks when asked, or when a deterministic condition already justifies attention. It does not narrate.
4. **Accountable.** What a model suggested, what a person judged and what was governed are all retained and attributable. Interpretations expire with the facts they read.

The test of the experience is not "did the AI say something clever?" It is **"did the architect examine what they would otherwise have missed, and decide it explicitly?"**

---

## 4. IDE differentiation

A software IDE is valuable because it understands the program's structure (types, references, call graphs), not because it can talk. Its most-used intelligence is deterministic: go to definition, find references, rename safely, show errors. Language models in IDEs add value mostly where they are anchored to that structure (the symbol under the cursor, the failing test, the diff).

The analogy holds closely for DSA [inference]:

| Software IDE                     | DSA IDE today                                          | Interpretive layer (7B.2 candidate)                       |
| -------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| Symbol, type                     | Element, kind, domain                                  | —                                                         |
| Find references / call hierarchy | Typed relationships, `impact_trace`                    | Explain why a reached record is exposed (`explanation`)   |
| Diff / blame                     | Substantive revisions, `development_changes`, versions | Explain what a revision changes for this subject          |
| Compiler errors and warnings     | Development Edge (deterministic rules)                 | Explain why this condition matters here                   |
| Tests                            | Acceptance Criteria, validation, Review capture        | Prepare: what a reviewer should examine                   |
| Code review                      | Reviews with examined versions                         | `review_brief`                                            |
| Static analysis beyond types     | —                                                      | `tension`, `evidence_bearing` (meaning across statements) |
| Runtime telemetry                | Implementation checkpoints, status                     | `realization_reading`                                     |
| Package / dependency news        | — (later: Development Environment Intelligence)        | —                                                         |

The differentiation is **not** that DSA can talk about a development. It is that DSA can attach interpretation to exact, governed, permission-shaped structure, and withdraw it when the structure moves.

What does **not** carry over: code has a compiler that decides correctness. A real-world system has no compiler. DSA's equivalent of "correct" is governed human judgment (approval, validation, agreement). That is why interpretation must never be mistaken for a verdict, and why the human-judgment layer is part of the experience, not a footnote. [inference]

---

## 5. Deterministic vs interpretive boundary

The 7B reconciliation layers stand (§8 there): **fact → deterministic condition → AI interpretation → human judgment → governed action**. This document sharpens how the user perceives them.

### 5.1 The user must be able to tell, at a glance

| Layer                   | How it looks                                                   | Typical sentence                                                                    |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Fact                    | Ordinary record text, reference codes, versions                | "CAP-004 v3, published 12 Sept."                                                    |
| Deterministic condition | The Edge envelope, rule name, basis, resolving act             | "Architecture changed after implementation validation."                             |
| Interpretation          | A labelled block: "Interpretation · suggested", with citations | "CAP-004's revised statement narrows the scope that IMP-002 was validated against." |
| Judgment                | Attributed line: who, when, kind, reason                       | "Not material — Julian Reyes, 1 Oct: scope narrowing is editorial."                 |
| Governed action         | The record it produced                                         | "Recorded DEC-007."                                                                 |

### 5.2 Rules for the boundary (additions to 7B §8.3)

1. **Deterministic first, always visible.** Wherever an interpretation is offered, the deterministic answer to the same question is shown above it, and is complete without it. [inference]
2. **An interpretation never restates a condition as its own finding.** It may only connect. (Already in the `explanation` definition.)
3. **No visual parity.** Interpretation is never styled like a governed record or an Edge item. It carries its label and its citations, and nothing else claims authority. (Calm, typographic distinction; not colour alarms.)
4. **No silent upgrade.** Interpretation text never enters a record except through a person's governed operation, and then as `ai_analysis` under the existing review gate (B-31, 7B §13.5).

---

## 6. Explain

**Purpose.** Help the architect understand governed development state.

### 6.1 What is already deterministic

| Question                                                     | Deterministic answer on `main`                                                                           | AI needed?                                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Why is this on the Development Edge?                         | Rule name and definition, basis, trigger, consequence path, resolving act, tier reason (ADR-0051, -0058) | No, except to connect the condition to the subject's own statements       |
| Why does DSA believe changing this may affect these objects? | `impact_trace` with matrix path, direction, propagation (ADR-0055)                                       | Only to say how each reached record's statements are exposed              |
| What changed since the last Review?                          | Examined versions vs current, substantive revisions with changed paths (ADR-0053, -0054)                 | Only to describe a changed path in readable prose                         |
| Why is this Implementation Initiative not validated?         | Status, checkpoints, criteria in force, `validates` relationships, implementation signals                | No. The answer is a list of governed facts                                |
| What supports this Decision?                                 | Relationships, evidence links with stance, statement provenance                                          | Only for "does the support actually say what the decision relies on?"     |
| Why does this element exist?                                 | Statements (purpose, rationale), relationships, provenance, method lineage (internal)                    | Rarely. Paraphrasing the architect's own rationale is generic-model value |
| What bears on this architecture element?                     | Relationships, evidence, Edge items with this subject, impact reach                                      | For unlinked text that appears relevant: not in 7B.2 (no link suggestion) |

### 6.2 Recommendation

- **Explain is hybrid, with the deterministic part leading.** The "Why am I seeing this?" disclosure on every Edge item, trace and revision is deterministic and should be improved as plain DSA UI regardless of AI (it is the single most-used explanation and costs nothing). [inference]
- **AI Explain = `explanation`**, offered only on the three subjects 7B.1 defined (Edge item, substantive revision, impact trace), and only as "Explain significance": _how this condition connects to this subject's governed statements_.
- **Ephemeral by default** (B-7, 7B.1 §14.1), kept only on request ("Keep this interpretation").
- **Name:** "Explain" is a good permanent verb (IX-2). It matches what a person wants, and it is honest about both halves.

---

## 7. Examine

**Purpose.** Surface meaningful relationships, tensions, gaps or implications that no rule can establish as fact.

### 7.1 Mapping of the brief's questions

| Question                                                       | Delivered by                                                              | Status in 7B.2                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Are two approved elements semantically in tension?             | `tension` on a connected pair                                             | In scope                                                                                      |
| Does new Evidence materially bear on an assumption?            | `evidence_bearing` on an evidence link                                    | In scope, with the honest limit that it reads metadata only (7B.1 §14.3)                      |
| Does implementation reality appear to diverge from intent?     | `realization_reading` on an initiative                                    | In scope                                                                                      |
| Is a Deliverable still representative of current Architecture? | Deterministic: the 7A Deliverable currency facts                          | Deterministic only. An AI reading of deliverable content would need file contents (B-16): out |
| Does anything appear inconsistent with this architecture?      | Would need a search across unconnected statements                         | Out. Unbounded search; the 7B reconciliation rejected free-reading (§9.3 item 3)              |
| What am I overlooking?                                         | Deterministic Edge for the subject, then the three kinds where they apply | The drawer answers with the Edge first; never asserts completeness                            |

### 7.2 Recommendation

- **Examine is an umbrella verb in the interface, not an inference kind** (IX-3). Its menu on an object shows only the examinations that object supports.
- **Search space comes from DSA.** `tension` is only sought along a typed relationship or governed impact path (7B.1 §14.2). This is the property that makes Examine structurally dependent on DSA (§29).
- **Persisted** when produced, because each is a requested analysis of a defined kind (7B.1 §14), but subject to reuse and quietness rules (§15).

---

## 8. Challenge

**Purpose.** Pressure-test architectural thinking.

### 8.1 Decomposition

Challenge, as briefed, mixes four different things [inference]:

| Challenge question                                                             | What it actually is                                                                                                             | Best producer                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Where are we relying on an unevidenced assumption?                             | A structural fact: Assumption records (Project Intelligence) and the elements they `underpin`, with no supporting evidence link | **Deterministic.** Computable from evidence links and stances; candidate 7A-style rule or a deterministic view |
| What evidence would weaken this?                                               | Recorded `contradicts` stances; evidence linked as `supports` whose metadata reads otherwise                                    | Deterministic (stances) + `evidence_bearing`                                                                   |
| What assumptions must be true for this to work?                                | Typed relationships (`underpins`, dependencies) + interpretation of rationale text                                              | Deterministic trace + `explanation`/`tension`                                                                  |
| What is the strongest challenge / opposing interpretation / failure condition? | Speculative argument from general knowledge                                                                                     | A generic model. Not grounded in DSA state beyond the element's own text                                       |

### 8.2 Assessment

- The first three are valuable and **already reachable** without a Challenge kind. [inference]
- The fourth is the part that "feels" like Challenge, and it fails three tests: it is reproducible by pasting the element into any model (Claude Test class A); its basis is the model's general knowledge, so it cannot be cited to versions; and it is the most likely to produce performative contrarianism, false balance and hallucinated objections.
- A credible Challenge must be distinguishable as **credible tension** (two governed statements), **missing evidence** (a structural absence), **alternative interpretation** (model reading of the same basis) or **speculation** (no basis). Only the first two can be shown with authority. The third is `tension`/`evidence_bearing`. The fourth should not be produced.

### 8.3 Recommendation

**No Challenge mode and no new inference kind in 7B.2** (IX-5, IX-9). Instead:

1. Present **"Supports and exposures"** on an element as a deterministic section of the drawer: supporting evidence, contradicting evidence, Assumption records that underpin it, and which of those have no supporting evidence. This delivers most of Challenge's value with authority and at no model cost. Whether it is a view or 7A-style rules is a proposal choice.
2. Offer `tension` and `evidence_bearing` from that section, where they apply.
3. Collect judgments on those kinds for a full cycle. If architects still lack pressure that only a model can apply, reconsider a governed `challenge` kind with a mandatory basis and a closed payload (`premise`, `dependence`, `what_would_weaken`, each cited) in a later phase.

Safeguards, if Challenge is ever added: always user-initiated; never on an element without at least one cited premise (a statement or an underpinning Assumption); no repeat on the same basis after `not_material` or `disagree`; never more than three points; "nothing consequential" is a valid answer (§15.4).

---

## 9. Prepare

**Purpose.** Prepare the architect for a governed judgment or event.

The Review is the strongest candidate in DSA for the reference pattern, because 7A already made the event exact [fact]: `review_examined_versions` fixes what was examined at the hold; `element_revisions` says what substantively changed since; acceptance criteria in force are known; Edge items on examined elements are computed; decisions due and escalations are dated. See §19 for the full design.

**Recommendation:** Prepare is in 7B.2 scope and is its flagship (IX-4), for Reviews only. "Prepare" for other governed events (a decision due, a client approval request, a baseline freeze) is a later extension of the same pattern.

---

## 10. Read

**Purpose (working).** Interpret the development as a whole.

### 10.1 Is READ `realization_reading`?

**No.** [fact] `realization_reading` is defined on one Implementation Initiative: _do its recorded state, checkpoints and criteria read as corresponding to, or diverging from, the intent it implements?_ READ is a reading of the whole Living Development Model. Sharing the word "reading" is a naming hazard (IX-11).

### 10.2 Is READ feasible in 7B.2?

**Not within the 7B.1 bounds, by design** [inference]:

- The Gateway allows anchors plus six model-requested tool calls, and the largest context plan is 32,000 tokens. A real engagement's published architecture (four domains, Project Intelligence, Reviews, implementation, evidence metadata) exceeds that by an order of magnitude. A single-invocation READ would see a sample, and the reader would not know which.
- Raising the bounds is possible (OD-7 was explicitly an evaluation bound) but turns READ into the most expensive, least evaluable and most cost-variable invocation in the system.
- The obvious workaround, per-domain readings summarised again, produces a summary of summaries: exactly the opaque "project summary" Kerrick ruled out, with a basis too wide to go meaningfully stale or to judge.

### 10.3 What READ should become

A **Development Brief**, deterministic first (§20): the structural facts that a reading would rely on, computed from governed state. A bounded interpretation can then be asked of **one section at a time** (for example "read realization across Capability"), each with its own basis. That is a later phase (IX-10).

---

## 11. Architectural Interrogation

**Principle.** Every governed object is potentially interrogable; 7B.2 should make the objects interrogable whose questions DSA can answer from exact state.

### 11.1 Object-by-object

Legend: **D** deterministic (no model), **AI** model interpretation, **H** hybrid (deterministic section + interpretation on request).

| Object                    | Interrogation                                   | Type | Governed context it receives                                                    | 7B.2?                                      |
| ------------------------- | ----------------------------------------------- | ---- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| Edge item                 | Why am I seeing this?                           | D    | Envelope: rule, basis, trigger, path, resolving act, tier reason                | Yes (improve existing UI)                  |
| Edge item                 | Explain significance                            | H    | `get_edge_item` + subject element projection (+ relationships, trace, revision) | **Yes** (`explanation`)                    |
| Architecture element      | Trace impact                                    | D    | `impact_trace`                                                                  | Exists                                     |
| Architecture element      | Explain this impact                             | H    | Trace + subject + reached elements                                              | **Yes** (`explanation` on trace)           |
| Architecture element      | Explain this revision                           | H    | Revision changed paths + element                                                | **Yes** (`explanation` on revision)        |
| Architecture element      | Supports and exposures                          | D    | Evidence links with stance, underpinning Assumption records, dependencies       | **Yes** (deterministic, §8.3)              |
| Architecture element      | Examine tension with a related element          | AI   | Both projections + connecting relationship or path                              | **Yes** (`tension`)                        |
| Evidence (link)           | Does this bear differently than recorded?       | AI   | Statement/element + evidence metadata (+ summary per OD-5) + recorded stance    | **Yes** (`evidence_bearing`)               |
| Evidence (source)         | What might this bear on?                        | D/AI | Existing links (D); unlinked candidates would need search                       | D only; unlinked search out                |
| Risk / other PI record    | What architecture appears exposed?              | D    | Relationships, `impact_trace`, Edge exposure rules                              | D only (risk is an element; trace applies) |
| Implementation Initiative | Compare implementation with intent              | H    | `get_implementation_state`                                                      | **Yes** (`realization_reading`)            |
| Review                    | What changed since this Review?                 | D    | Capture vs current                                                              | Exists in 7A; consolidate in dossier       |
| Review                    | Prepare this Review                             | H    | `get_review_context` and anchors                                                | **Yes** (`review_brief`)                   |
| Deliverable               | Does this still represent current Architecture? | D    | 7A currency facts                                                               | D only (content would need files)          |
| Acceptance Criterion      | What bears on this criterion?                   | D    | Criterion, linked initiative and checkpoints, validation notes                  | D only in 7B.2                             |
| Method Application        | Explain methodology provenance                  | D    | Lineage, release, contexts (internal)                                           | D only. Never sent (B-19)                  |
| Multiple objects          | Examine these together                          | AI   | Arbitrary set                                                                   | **No** (later, IX-8)                       |

### 11.2 Decisions surfaced

- Which objects are interrogable by AI in 7B.2: Edge items, elements (revision, trace, connected pair), evidence links, Reviews, Implementation Initiatives (IX-7).
- Multi-object interrogation: only the governed pair already defined by `tension`. Arbitrary selection is later, because its context is unbounded and it invites "summarise these" (IX-8).

---

## 12. Development Edge relationship

The distinction stands [inference, consistent with B-14 and 7B §15]:

> **DEVELOPMENT EDGE = what DSA can establish deserves attention.**
> **ARCHITECTURE INTELLIGENCE = interpretation of what that state may mean.**

### 12.1 The ideal interaction

Example deterministic item: _"Architecture changed after implementation validation"_ (realization lens, subject an Implementation Initiative, trigger a substantive revision of the element it implements).

Reference codes below are illustrative.

1. The architect opens the item. The drawer's **What DSA knows** section is complete without AI: validated at `CAP-004 v2` on 14 Aug; current `CAP-004 v3` since 12 Sept; changed paths `statements.purpose`, `statements.scope`; validating Review `REV-002`; criteria in force; resolving act "re-examine at a Review".
2. Below it: **Interpretation · Explain significance**. The architect asks. The model receives the item, the two versions, the changed paths and the initiative's state, and returns cited claims connecting the change to what was validated. It does not restate the condition, judge whether re-validation is needed or rate importance.
3. **Judgment** belongs to the deterministic item: investigating, not material, deferred, disagree, promote (schedule a Review). Judging the interpretation is separate and optional.

### 12.2 How inferences appear on the Edge

- **Never in the tiers.** Never in the overview Edge section. Never in the "since you last reviewed" briefing list of changes (7B §15.3).
- **Attached view:** an Edge item with a current kept interpretation shows a quiet line, "Interpretation kept · 1 Oct", inside its disclosure. No badge on the list row (IX-17).
- **Own section:** persisted, current, unjudged interpretations of the interpretive kinds (`tension`, `evidence_bearing`, `realization_reading`) appear in a separate section of the Engagement Edge, "Suggested interpretations", ordered deterministically by the subject's governance date and then generation time (7B §15.1). `explanation` and `review_brief` stay with their subjects and do not project.
- **Visible only to current holders of `use_architecture_intelligence`** (OD-11). Others see the Edge exactly as today, with no hint that interpretations exist (IX-18).
- Stale interpretations leave the section and the attached view; they remain readable in the subject's history.

---

## 13. Ambient intelligence

**Goal:** developmental awareness without an AI dashboard.

### 13.1 Where intelligence should be reachable

| Surface                         | Reachable intelligence (7B.2)                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Element page                    | Drawer: Supports and exposures (D); Explain revision/trace (H); Examine tension (AI)  |
| Edge page and contextual panels | Why am I seeing this (D); Explain significance (H); Suggested interpretations section |
| Evidence page                   | Per link: Examine bearing (AI)                                                        |
| Review page                     | Review dossier (D) with Prepare (H)                                                   |
| Implementation Initiative page  | Realization facts (D) with Compare with intent (H)                                    |
| Engagement overview             | Nothing new. It keeps the human-flagged and Elevated Edge only                        |
| Architecture Intelligence page  | Governance (authorisation, requests) and the kept-interpretations register            |
| Global command/search           | Not in 7B.2 (§21)                                                                     |

### 13.2 What ambient must not mean

- No "AI insight" badges on list rows, counts in navigation, or unread markers.
- No notifications (B-27).
- No proactive generation (B-25).
- The only ambient signal is the **availability** of an interpretation action, shown where the deterministic state already justifies it (an Edge item, a revision, a held Review, an initiative with `implements`). That is awareness through structure, not through alerts. [inference]

---

## 14. Epistemic pressure

**Principle tested:** DSA IDE should make it difficult to develop carelessly, not difficult to use.

### 14.1 Where pressure should come from

Pressure is most legitimate, cheapest and least irritating when it is **structural** [inference]:

| Question                           | Structural pressure that exists or is computable                                  | Interpretive pressure (on request) |
| ---------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| What changed?                      | Substantive revisions, briefing                                                   | Explain revision                   |
| What does this affect?             | `impact_trace`, consequence paths                                                 | Explain impact                     |
| What supports this?                | Evidence links and stances                                                        | Examine bearing                    |
| What challenges this?              | `contradicts` stances; open risks with relationships                              | Examine tension                    |
| What are we assuming?              | Assumption records and their `underpins` relationships                            | —                                  |
| What remains unrealized?           | Realization lens rules; initiatives without checkpoints                           | Compare implementation with intent |
| What requires judgment?            | Edge tiers; decisions due; open escalations                                       | —                                  |
| What evidence is missing?          | Elements and Assumption records without supporting links (Supports and exposures) | —                                  |
| What to examine before proceeding? | Resolving acts; Review dossier                                                    | Prepare                            |

### 14.2 How to avoid the failure modes

| Failure               | Guard                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Annoying              | Pressure appears at governed moments (opening a Review, a changed element, an Edge item), not everywhere |
| Alarmist              | No severity, score, red states or "critical" unless quoting a human-set attention value (ADR-0058)       |
| Paternalistic         | Never blocks a governed operation. Interpretation is never a precondition                                |
| Excessively skeptical | No unprompted challenge; "nothing consequential" is a valid answer                                       |
| Noisy                 | Reuse, suppression after judgment, staleness removal (§15)                                               |
| Productivity tracker  | No per-person counts, no "unread", no streaks; audit stays per engagement (ADR-0066)                     |

---

## 15. Intelligence quietness

### 15.1 On demand only

Every model invocation in 7B.2 is caused by a person's explicit action on an object (IX-16).

### 15.2 Persistence by kind

| Kind                  | Default                            | Persisted                                                                      |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `explanation`         | Ephemeral                          | When the person chooses "Keep"                                                 |
| `review_brief`        | Persisted (attached to the Review) | Always, so the reviewers see the same brief and it goes stale with the capture |
| `tension`             | Persisted                          | Always                                                                         |
| `evidence_bearing`    | Persisted                          | Always                                                                         |
| `realization_reading` | Persisted                          | Always                                                                         |

This follows B-7 and 7B.1 §14. The alternative, "everything ephemeral until kept", is quieter but loses reuse and the judgment trail (IX-12).

### 15.3 Duplicates and repetition

- **Reuse before regenerate.** A request whose kind and subject match a persisted inference whose basis is still current returns that inference ("Interpretation from 1 Oct, still current"), with no model call. A person may ask again explicitly ("Interpret again"); that is a new request in the audit (IX-13).
- **Suppression after judgment.** An inference judged `not_material` or `disagree` suppresses re-offering the same kind on the same subject until any basis digest changes, mirroring Edge fingerprints (IX-14).
- **Stale disappears from default views** and remains in history (7B §15.3 item 6).

### 15.4 Silence under uncertainty

A model that is required to produce one to eight claims will produce them. 7B.2 should allow an explicit **"nothing consequential to add"** result: a valid structured output saying the basis does not support an interpretation, shown as such ("DSA's records do not support an interpretation of this"), recorded in the audit as its own outcome, not persisted as an inference (IX-15). This needs a schema and outcome change, so it is a decision.

---

## 16. Explainability

Every persisted inference must answer **"Why am I seeing this?"** in two levels [inference]:

**Primary (always visible, plain language):**

- the assertion;
- what kind of interpretation it is ("Explanation", "Apparent tension", "Evidence bearing", "Review brief", "Realization reading");
- the records it read, as reference codes with versions ("CAP-004 v3, STM-002 v5");
- the uncertainty, in the model's words;
- "Suggested · generated 1 Oct · current" (or "stale: CAP-004 changed").

**Inspectable (one disclosure away):**

- every claim with the handles it cites, each resolving to the exact version;
- the deterministic conditions and relationships in the basis;
- records withheld from the model and why ("not authorised", "Method/IP");
- provider, resolved model, prompt version, policy version, tool contract version;
- who requested it and when; human judgments on it.

Never shown: prompts, raw context, provider bodies, token counts to non-authorizers, cost per person. [fact, ADR-0066; inference for the UI]

---

## 17. Inference lifecycle

```
requested (person, on an object)
  → refused (governance outcome, §25)  ─ audit only
  → nothing consequential (§15.4)      ─ audit only
  → interpretation returned
        ephemeral (explanation) ── kept? ──► persisted
        persisted kinds ───────────────────► persisted
persisted
  → current ──(any basis digest changes)──► stale  (computed)
  → current ──(newer inference, same kind+subject)──► superseded (computed)
  → judged: investigating | not_material | deferred | disagree | promoted
        promoted → names the governed record a person created (ADR-0056 targets)
```

States `current`, `stale` and `superseded` are computed (ADR-0064). Judgments are append-only and attributed. Nothing is deleted; nothing is rewritten. [fact for the computed states; inference for the flow]

---

## 18. Human judgment

### 18.1 Are the existing judgments sufficient?

**Yes** [inference]. With `disagree` read producer-neutrally (7B.1 §17.3, OD-17), the five 7A kinds cover the lifecycle:

| Kind            | On an inference means                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| `investigating` | "I am examining this interpretation"                                             |
| `not_material`  | "Reasonable, but it does not need action" (suppresses until the basis changes)   |
| `deferred`      | "Not now" (until a date or basis change)                                         |
| `disagree`      | "The producer is wrong for this case" (interpretation feedback; evaluation data) |
| `promoted`      | "I completed a governed operation prompted by this" (names the record)           |

### 18.2 Which inferences are judgeable

- All **persisted** inferences are judgeable.
- **Ephemeral explanations are not**: nothing persists to judge, and asking for a judgment on every explanation would be friction. If a person keeps one, it becomes judgeable.
- Judging an inference never judges the deterministic item it explains, and vice versa (7B §15.3 item 3).

### 18.3 Where inference judgments live

Two options carried from 7B.1 §17.4 (IX-19): add an `inference` subject to `edge_judgments`, or a sibling append-only table with identical semantics. Recommendation: **sibling table**, because `edge_judgments` keys on rule and fingerprint and its whole-event operation must never include inferences; a sibling keeps both clean. Either requires the ADR-0056 amendment for producer-neutral `disagree`.

### 18.4 Promotion

- **Only people promote** (B-31). Unchanged.
- **AI does not suggest a promotion destination in 7B.2** (IX-20). The four governed targets (Risk, Decision, Review, proposed Acceptance Criterion) are offered by DSA deterministically, as on Edge items. The inference's `examination` field already says what to look at; letting it also choose a destination edges toward AI-directed governance.
- **AI never executes promotion.** The promotion form opens empty of model text by default; if a person chooses to bring interpretation text into a record, it enters as `ai_analysis`, `pending`, under the existing review gate (7B §13.4).

---

## 19. Review preparation

### 19.1 The Review dossier (deterministic)

Assembled entirely from governed state, for any Review, with no model and no external processing [fact for sources; inference for the composition]:

1. Examined elements, each with the **version captured at the hold** (or, for a scheduled Review, the current version that would be examined).
2. **Changes since** the previous Review that examined each element: substantive revisions with changed paths; status publications listed separately.
3. **Evidence linked since**, with stance.
4. **Current Edge items** on examined elements, in tier order, with judgments.
5. **Acceptance criteria in force** for initiatives that implement examined elements; criteria proposed or superseded since.
6. **Implementation changes**: status transitions, checkpoints achieved or missed.
7. **Unresolved judgments**: open decisions due, open escalations, deferred Edge items whose date falls before the Review.

This dossier is valuable to every internal reader of the engagement's architecture, including those without the AI capability, and costs nothing. It should be built whether or not AI ships. [inference]

### 19.2 The interpretation (bounded, on request)

"Prepare with interpretation" asks `review_brief`: at most eight points, in the order of the examined set (never by importance), each citing the dossier's records, saying what a reviewer might examine and why. It never predicts or recommends the outcome (7B.1 §14.4).

### 19.3 Should this become the reference design?

**Yes** (IX-4). The pattern generalises cleanly:

| Experience             | Deterministic assembly                           | Bounded interpretation        |
| ---------------------- | ------------------------------------------------ | ----------------------------- |
| Prepare a Review       | Review dossier                                   | `review_brief`                |
| Explain an item        | Edge envelope                                    | `explanation`                 |
| Realization            | Initiative facts, criteria in force, checkpoints | `realization_reading`         |
| Supports and exposures | Evidence links, stances, assumptions             | `evidence_bearing`, `tension` |
| (Later) Read           | Development Brief (§20)                          | Section readings              |

The ratio matters: in each, the deterministic part should stand on its own. If an experience is worthless without the model, it is probably class A in the Claude Test (§29).

---

## 20. Development reading

### 20.1 What it must not be

Not a project summary, executive summary, health score, SWOT or generic advice (brief §16).

### 20.2 What the system can responsibly establish (deterministic Development Brief)

| Brief question                          | Deterministic answer                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Where is architecture most established? | Published, approved and baselined elements by domain; relationship density (counts, not scores) |
| Where is realization lagging?           | Approved elements with no `implements`; initiatives past target; realization-lens Edge items    |
| What changed in direction?              | Substantive revisions to purpose/strategy statements over a period; superseded elements         |
| What judgments appear imminent?         | Decisions due, scheduled Reviews, criteria awaiting agreement, within the 14-day horizon        |
| What evidence arrived?                  | Evidence linked in the period with stance                                                       |
| What remains unresolved?                | Open Project Intelligence by attention; open escalations; deferred items                        |

All of this is reproducible, permission-shaped and versionable. None of it is a grade. [inference]

### 20.3 What must remain human

- Whether the development is "on track", "strong", "weak" or "mature" (ADR-0019 already makes maturity a human judgment).
- Which tension is the most consequential.
- Whether a change of direction is good.

### 20.4 Interpretation, later

A section reading ("read realization across the Capability domain") with the section's brief as anchor and its own basis is a plausible later kind. Its Claude Test strength comes from the brief, not from the model. **Not in 7B.2** (IX-10). The name "Read" should be reserved for it and kept distinct from `realization_reading` (IX-11).

---

## 21. Command interaction

### 21.1 Classification

| Command                                                   | Class                                         |
| --------------------------------------------------------- | --------------------------------------------- |
| Go to CAP-014                                             | Navigation                                    |
| Trace impact of STM-004                                   | Deterministic query                           |
| Compare v3 and v4                                         | Deterministic query                           |
| Show changes since Monday                                 | Deterministic query                           |
| Show unresolved assumptions                               | Deterministic query                           |
| Show approved architecture with no implementation pathway | Deterministic query                           |
| Prepare REV-006                                           | Deterministic query (dossier) + AI on request |
| Explain this Edge item                                    | AI interpretation (hybrid)                    |
| Ask Architecture Intelligence…                            | Free-form AI                                  |
| Record a Decision / Promote / Approve                     | Governed mutation                             |

### 21.2 Assessment

A command surface is a strong DSA IDE idea, and most of its value is **navigation and deterministic query**, which need no AI at all [inference]. Its danger is the last two rows: "Ask Architecture Intelligence…" is generic chat with a different shape, and natural-language governed mutation erases the boundary between interpretation and action.

### 21.3 Recommendation

- **Not in 7B.2** (IX-24). Build it later, first as navigation and deterministic queries over reference codes and the Edge, with each result labelled by class.
- When AI is added to it, only as named interpretations on resolved objects ("Explain CAP-004 revision v3"), never free-form, and never mutation.

---

## 22. User-initiated vs proactive intelligence

| Model                                                          | Privacy                                   | Cost                     | Noise           | Governance                                                                | Freshness               | UX value                                 |
| -------------------------------------------------------------- | ----------------------------------------- | ------------------------ | --------------- | ------------------------------------------------------------------------- | ----------------------- | ---------------------------------------- |
| 1. Entirely user-initiated                                     | Best: data leaves only on a person's act  | Proportional to use      | Lowest          | Simplest: one person, one act, one audit row                              | Fresh at request        | Good where anchored                      |
| 2. Deterministic triggers make AI _available_; runs on request | Same as 1                                 | Same as 1                | Low             | Same as 1                                                                 | Same as 1               | Better: the right moment is shown        |
| 3. Limited proactive inference                                 | Worse: data leaves without a person's act | Grows with change volume | Risk of backlog | Needs a system requester, background processing (B-25), budget allocation | Fresh after each change | Marginal over 2; "the AI noticed" appeal |

**Recommendation: Model 2** (IX-16). It is the smallest model that makes intelligence feel present at the right moment: the Edge, a changed element, a held Review. It changes nothing in the privacy or governance model of 7B.1.

---

## 23. Client boundary

| Possibility                                   | Assessment                                                                                                                                                    | 7B.2?          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Internal architect intelligence               | The whole of this document                                                                                                                                    | Yes            |
| Client-visible AI interpretation              | Inferences are internal by construction (OD-11); exposing them breaks "publication is the client boundary" (ADR-0014)                                         | No             |
| Client-triggered AI                           | Would put external processing under client control and per-client budget; no client capability exists                                                         | No             |
| Architect-approved AI explanation for clients | The path already exists: the architect writes or accepts text into a governed record (`ai_analysis` → review gate → publication). No new AI surface is needed | No new surface |
| AI-drafted client-facing statements           | Drafting is generic-model value (7B §9.2) and needs B-23 client disclosure first                                                                              | No             |

**Recommendation: no client AI in 7B.2** (IX-21). Client snapshots, portal read models and client policies stay untouched.

---

## 24. Method/IP boundary

- **Does 7B.2 need Method-aware intelligence?** No [inference]. Every 7B.2 experience above is grounded in the engagement's architecture, evidence, Reviews and implementation.
- **Methodology provenance** (which method asset, release and application produced an element) can be shown **deterministically** to internal readers, as today. It never needs to be sent.
- **Separate authorisation** (B-19) is necessary but not sufficient: Method content would also need its own data class, projection and evaluation. Defer (IX-22).
- **No Method recommendation**, ever in this phase line (B-24).

### 24.1 Development Context

Development Context is internal, methodology-governed vocabulary (ADR-0045). Letting an architect explicitly say "examine this through the current Development Context" would send TPLCo's context definitions out and change model behaviour by a practice concept. **Not in 7B.2** (IX-23). If ever added: an explicit, visible choice on the request, a separate data class, separately authorised, recorded in the inference basis, never implicit.

---

## 25. Failure experience

**Principle:** failures are **governance states**, explained in institutional language, with what can be done next. Never a spinner that ends in "Something went wrong".

| Condition                                      | What the person sees (draft copy)                                                                                      | What they can do                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| AI not authorised for the engagement           | "External processing is not authorised for this engagement." (No interpretation actions are offered at all.)           | A Principal Architect may authorise it                  |
| User lacks use capability                      | Nothing. Interpretation actions are not shown to people without the capability                                         | —                                                       |
| Mode off / synthetic only on a real engagement | "Architecture Intelligence is not available for this engagement."                                                      | —                                                       |
| Model not evaluated                            | "Architecture Intelligence is not yet available: no model has been evaluated for this kind of interpretation."         | —                                                       |
| Budget exhausted                               | "This engagement's monthly processing budget has been reached." (Authorizers also see the month's total.)              | Authorizer may record a new authorisation               |
| Provider unavailable                           | "The external processing provider did not respond. Nothing was recorded."                                              | Try again later                                         |
| Structured output invalid                      | "The interpretation did not meet DSA's requirements and was discarded."                                                | Try again; repeated failures are evaluation data        |
| Authorisation revoked mid-request              | "Processing stopped: the engagement's authorisation changed. Nothing was recorded."                                    | —                                                       |
| Inference became stale                         | "Stale: CAP-004 has changed since this was generated." Shown with the old interpretation dimmed, and "Interpret again" | Ask again                                               |
| Insufficient governed basis                    | "DSA's records do not support an interpretation of this." (§15.4)                                                      | Add evidence or statements, through governed operations |
| Minimum sufficient context unavailable         | "Some records needed for this interpretation are not authorised for external processing: Evidence metadata."           | Authorizer may change classes                           |

The governance states map one-to-one onto the 7B.1 outcomes [fact, ADR-0066] plus the proposed "nothing consequential" outcome (IX-15, IX-26).

---

## 26. Cost principles

1. **Deterministic first.** If DSA can answer from governed state, it does, and the model is not called. Most of Explain and all of the Review dossier are free. [inference]
2. **Reuse while current.** A current persisted inference for the same kind and subject is returned without a call (§15.3).
3. **Cost is an engagement concern, never a person's.** Authorizers see month-to-date cost against budget; nobody sees per-person spend (ADR-0066).
4. **Unusual cost is disclosed before sending, not after.** If a request's estimate is high relative to the per-request ceiling (for example a large Review), the action says so ("larger request") before the person confirms. No currency figures to non-authorizers. (IX-25)
5. **No budget classes yet.** READ is out; the existing per-request ceiling and per-kind caps suffice for 7B.2's kinds. Budget classes are a READ-era decision.

---

## 27. Mobile implications

The app is responsive but desktop-first [inference]. For intelligence:

| Interaction                                   | Phone                                     | Desktop needed? |
| --------------------------------------------- | ----------------------------------------- | --------------- |
| Inspect an Edge item, "Why am I seeing this"  | Works well (single column)                | No              |
| Explain significance                          | Works: drawer becomes a full-height sheet | No              |
| Read a Review dossier and brief               | Works for reading before a meeting        | No              |
| Record a judgment on an item or inference     | Works (short form, reason)                | No              |
| Inspect implementation facts                  | Works                                     | No              |
| Examine tension (two statements side by side) | Usable stacked; comparison suffers        | Preferable      |
| Evidence bearing                              | Works                                     | No              |
| Promotion (governed forms)                    | Possible but heavy                        | Preferable      |
| Authorisation management                      | Possible                                  | Preferable      |
| Command surface (later)                       | Natural fit on mobile for navigation      | No              |

**Recommendation:** the drawer pattern must collapse to a sheet with the same three layers in the same order (IX-26 covers the shared state language). No mobile-specific intelligence features in 7B.2.

---

## 28. Development Environment Intelligence boundary

Nothing here designs monitoring. The 7B.2 experience should leave a coherent place for it [inference]:

- **Drawer layers extend naturally.** _What DSA knows_ (governed) / _What the environment shows_ (external observations, later) / _Interpretation_ / _Judgment_. External observations would sit beside, not inside, governed facts.
- **The Edge's origin model extends.** 7B §15.1 already reserves a third origin: `model` over an external source, `suggested`, with source provenance. 7B.2's "Suggested interpretations" section should be built so a later "External observations" section sits beside it, with the same judgment lifecycle.
- **The Living Development Model as monitoring specification** depends on elements and relationships, not on anything 7B.2 adds. Nothing in this document makes that harder.
- **What would make it awkward:** a chat surface (external news would become chat messages), proactive AI (monitoring would inherit an undesigned background model), or an "AI insights" feed (external and internal interpretations would merge). All three are excluded here.

---

## 29. Claude Test

**Question for each experience:** could a sophisticated user reproduce substantially the same value by exporting documents into Claude or ChatGPT?

Classes: **A** generic-model convenience; **B** improved by DSA context; **C** structurally dependent on DSA governed state.

| Experience                                           | Class                          | What DSA state makes it hard to reproduce externally                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review dossier + `review_brief`                      | **C**                          | The immutable examined-version capture, substantive-revision classification since that capture, criteria in force, Edge conditions on exactly those elements, and staleness when any of them moves. An export must reconstruct all of it by hand and cannot know when it goes stale |
| Explain significance of an Edge item                 | **C**                          | The condition is a governed rule evaluation with a fingerprint; the explanation attaches to it and expires with it; judgment on the item feeds back into the Edge                                                                                                                   |
| Explain a substantive revision                       | **B**                          | Changed paths and versions are DSA's; the prose itself is generic                                                                                                                                                                                                                   |
| Explain an impact trace                              | **C**                          | The matrix direction, propagation and depth are governed (ADR-0055); an export has no matrix                                                                                                                                                                                        |
| `tension` on a connected pair                        | **C** (proven by construction) | The pair is chosen by a typed relationship or impact path, pinned to versions; the judgment trail suppresses repeats. A generic model can find tensions in an export, but not this search space, citation form or lifecycle                                                         |
| `evidence_bearing`                                   | **B**, weak                    | Metadata only (B-16); value depends on how well architects record evidence. Evaluation must prove it is not class A                                                                                                                                                                 |
| `realization_reading`                                | **C**                          | `implements` targets at published versions, checkpoints, criteria in force, validation history                                                                                                                                                                                      |
| Supports and exposures (deterministic)               | **C**                          | Pure governed structure. No model involved                                                                                                                                                                                                                                          |
| Challenge, "strongest opposing view"                 | **A**                          | Paste the element into any model                                                                                                                                                                                                                                                    |
| Read the development (single invocation)             | **A/B**                        | A summary of whatever fits in context                                                                                                                                                                                                                                               |
| Development Brief (deterministic) + section readings | **C**                          | The brief is computed governed state; readings inherit its basis                                                                                                                                                                                                                    |
| Generic chat                                         | **A**                          | —                                                                                                                                                                                                                                                                                   |
| Command surface (navigation, queries)                | **C**                          | Reference codes, versions, Edge and trace are DSA's                                                                                                                                                                                                                                 |

**Strongest result.** _Prepare a Review_ is the clearest class C experience in DSA: its value comes from facts that exist only because 7A captured what a Review examined and classifies what changed since. A pasted document pack cannot know which version was examined, what has substantively changed, or when the brief stops being true. [inference]

**The general rule this produces:** an experience passes when its **search space, citations and lifecycle** come from DSA. Text quality alone never passes.

---

## 30. UX models

### Model A — Object-anchored actions

**Core interaction.** Each interrogable object gets inline actions ("Explain significance", "Examine tension with…", "Prepare"). Results render inline under the object.

- **Strengths:** maximum anchoring; minimal new UI; strong Claude Test.
- **Weaknesses:** results scattered across pages; inline expansion disrupts dense pages (element page already carries Edge, impact and statements); no consistent home for "what DSA knows vs interpretation vs judgment".
- **Cognitive load:** low per action, rising as actions multiply.
- **Implementation complexity:** low to medium.
- **Fit with existing UI:** good; matches contextual Edge panels.
- **Mobile:** good.
- **DEI fit:** weak; no natural place for external observations.

### Model B — Intelligence workspace

**Core interaction.** A dedicated Architecture Intelligence workspace per engagement where the architect selects objects and runs interpretations; results collected in a register.

- **Strengths:** one place to see all interpretations; good for evaluation and judgment backlog; natural home for later READ.
- **Weaknesses:** intelligence becomes a destination (contrary to principle 2); context switch away from the work; invites "dashboard" and chat drift.
- **Claude Test:** weaker; selection-and-run resembles exporting.
- **Cognitive load:** medium; another place to check.
- **Complexity:** medium.
- **Fit:** poor with the contextual Edge approach of 7A.
- **Mobile:** poor for selection; fine for reading.
- **DEI fit:** good as a home, poor as integration.

### Model C — Command + contextual intelligence

**Core interaction.** A global command surface (keyboard on desktop, search on mobile) for navigation, deterministic queries and named interpretations on resolved objects; results open in context.

- **Strengths:** fast for experts; natural IDE feel; excellent for navigation and deterministic queries.
- **Weaknesses:** discoverability; temptation to accept free text; classification of commands must be strict; large build.
- **Claude Test:** C for navigation and queries; risk of A when free text creeps in.
- **Cognitive load:** low for experts, high for occasional users.
- **Complexity:** high (parsing, resolution, classification).
- **Fit:** good long-term; not needed to deliver 7B.2's value.
- **Mobile:** good for navigation.
- **DEI fit:** neutral.

### Model D — Hybrid: object-anchored actions + one contextual drawer + Edge projection (recommended)

**Core interaction.** Interrogable objects carry a small set of actions. Every action opens **one standard drawer** (right side on desktop; full-height sheet on mobile) with three fixed layers:

1. **What DSA knows** — the deterministic assembly for that question (Edge envelope, trace, revision paths, supports and exposures, Review dossier, realization facts). Always present, complete on its own.
2. **Interpretation** — "Interpret" (or a reused current interpretation), shown as `suggested` with citations, uncertainty and state; hidden entirely for people without the capability or when not authorised.
3. **Judgment** — the person's judgment on the deterministic item and, separately, on a persisted interpretation; promotion through governed forms.

Persisted interpretive kinds project onto the Engagement Edge in "Suggested interpretations" (§12.2). The Architecture Intelligence page gains a register of kept interpretations for the engagement (use holders only). No chat. No command surface yet.

- **Strengths:** anchoring of A with one consistent mental model; the three layers make the epistemic hierarchy visible every time; deterministic value ships even with AI off; reuses the existing Edge judgment patterns.
- **Weaknesses:** drawer can feel heavy for a one-line answer; requires discipline to keep layers in order; Edge projection adds a section to an already rich page.
- **Claude Test:** strongest; every layer-1 assembly is class C.
- **Cognitive load:** low; one pattern everywhere.
- **Complexity:** medium (one drawer component, per-object assemblies, inference judgments, projection).
- **Fit:** strong; extends contextual Edge panels.
- **Mobile:** good (sheet).
- **DEI fit:** good; a fourth layer ("What the environment shows") fits between 1 and 2 later.

### Comparison

| Criterion         | A       | B      | C        | D (recommended) |
| ----------------- | ------- | ------ | -------- | --------------- |
| Anchoring         | High    | Low    | Medium   | High            |
| Epistemic clarity | Medium  | Medium | Medium   | **High**        |
| Claude Test       | Strong  | Weak   | Mixed    | **Strongest**   |
| Cognitive load    | Low→Med | Med    | Low/High | Low             |
| Build complexity  | Low     | Med    | High     | Med             |
| Fit with 7A UI    | Good    | Poor   | Good     | **Strong**      |
| Mobile            | Good    | Poor   | Good     | Good            |
| DEI fit           | Weak    | Good   | Neutral  | Good            |

---

## 31. Recommended experience architecture

```
            ┌─────────────────────────────────────────────────────────────┐
 object ───►│ Drawer                                                      │
 (Edge item,│  1 What DSA knows      deterministic assembly (no model)    │
 element,   │  2 Interpretation      on request · suggested · cited       │
 evidence   │        reuse if current │ Gateway (7B.1) │ evaluated model   │
 link,      │  3 Judgment            on item │ on interpretation │ promote │
 Review,    └─────────────────────────────────────────────────────────────┘
 initiative)          │ persisted interpretive kinds, current, unjudged
                      ▼
            Engagement Edge · "Suggested interpretations" (outside tiers)
            Architecture Intelligence page · kept-interpretations register
```

**Vocabulary in the interface** (IX-2, IX-3):

| Interface verb       | Kind                  | Object                                        |
| -------------------- | --------------------- | --------------------------------------------- |
| Explain significance | `explanation`         | Edge item, substantive revision, impact trace |
| Examine tension      | `tension`             | Connected element pair                        |
| Examine bearing      | `evidence_bearing`    | Evidence link                                 |
| Compare with intent  | `realization_reading` | Implementation Initiative                     |
| Prepare              | `review_brief`        | Review                                        |

"Challenge" and "Read" are not used in 7B.2's interface.

**Unchanged foundations:** the Gateway, Tool Contract, data classes, authorisation, capabilities, inference envelope and basis, OD-7 bound, evaluated-models gate, audit. 7B.2 adds surfaces, persistence and judgment, not a new reasoning engine. [inference]

---

## 32. Explicit 7B.2 scope (recommended)

**Prerequisite step (governed, before user-facing work):** seed-only real-provider evaluation of each kind to be exposed, manual grading, committed metadata-only report, reviewed manifest change (ADR-0065, IX-1). Only kinds that pass become available.

Then:

1. **Drawer pattern** with the three layers, on Edge items, element pages, evidence links, Reviews and Implementation Initiatives.
2. **Deterministic assemblies:** improved "Why am I seeing this?"; Supports and exposures; Review dossier; realization facts.
3. **Interpretations on request** for the five existing kinds on their 7B.1 subjects; no new kinds.
4. **Persistence and reuse:** `explanation` ephemeral unless kept; others persisted; reuse while current; "Interpret again".
5. **Judgments on inferences** (sibling append-only table, producer-neutral `disagree`; ADR-0056 amendment).
6. **Edge projection** of persisted, current, unjudged interpretive kinds into "Suggested interpretations" (ADR-0051 amendment).
7. **Kept-interpretations register** on the Architecture Intelligence page.
8. **Failure states** as governance language (§25).
9. **"Nothing consequential" outcome** (if IX-15 is approved).
10. **Browser acceptance** by every internal role, client denial, and leak tests showing no inference text to people without the capability.

---

## 33. Explicit out-of-scope

Generic chat or "Ask DSA"; command surface; Challenge mode or `challenge` kind; Read the development; Development Brief interpretation (the deterministic brief could be a separate non-AI piece of work); arbitrary multi-object interrogation; link suggestions; AI promotion suggestions or execution; proactive or background inference; notifications; client-facing or client-triggered AI; AI-drafted client text; Method-aware AI; Development Context in requests; file, image or document content; web search; embeddings or vector stores; MCP; provider-hosted state; cross-engagement learning; Pattern Library; Portfolio Intelligence; Development Environment Intelligence; real engagement processing before B-4 prerequisites; any change to OD-7 bounds without evaluation evidence.

---

## 34. Risks and failure modes

| Risk                                   | How it shows up                                                | Mitigation                                                                                          |
| -------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Interpretation read as fact            | An architect quotes a `tension` as a contradiction in a Review | Labelling, layer order, no visual parity, promotion only via governed forms with `ai_analysis` gate |
| Evaluation never passes for some kinds | `evidence_bearing` too weak on metadata only                   | Ship only kinds that pass; deterministic layers ship regardless                                     |
| Synthetic-only for a long time         | B-4 prerequisites delay real use                               | Deterministic layers deliver value on real engagements meanwhile                                    |
| Drawer becomes a dumping ground        | Every page adds "one more" section                             | Fixed three layers; per-object assemblies reviewed like Edge rules                                  |
| Edge clutter                           | "Suggested interpretations" grows                              | Only persisted, current, unjudged; stale and judged leave; only for use holders                     |
| Reuse hides improvement                | Old interpretation reused after a prompt upgrade               | Reuse only when prompt version and resolved model also match                                        |
| Judgment fatigue                       | Many persisted inferences demand judgment                      | Judgment optional; staleness and supersession clear lists without a judgment                        |
| Cost surprise                          | Large Reviews hit the ceiling                                  | Pre-send disclosure; per-request ceiling; reuse                                                     |
| Scope creep toward chat                | "Just let me ask a follow-up"                                  | IX-6 as a standing rule; follow-ups only as new named interpretations                               |
| Leaking interpretation to non-holders  | A list view counts interpretations                             | OD-11 enforced in the database; leak tests across roles                                             |
| Over-reliance                          | Architects stop reading the records                            | Deterministic layer first; interpretation cites, never replaces                                     |

---

## 35. Difficult-to-reverse decisions

| Decision                                                                 | Why hard to reverse                                                                                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Interface vocabulary (Explain, Examine, Prepare; not Challenge/Read now) | Users learn verbs; renaming later costs trust and documentation (IX-2, IX-3)                        |
| No new inference kinds in 7B.2                                           | Adding is a migration and evaluation; removing a kind with persisted data is harder (IX-9)          |
| Where inference judgments live                                           | Append-only data accumulates in the chosen table (IX-19)                                            |
| Edge projection rules                                                    | Changes ADR-0051's "items are computed" contract by adding a projected origin (IX-17)               |
| Persistence defaults                                                     | Determines what history exists; cannot retroactively persist ephemeral results (IX-12)              |
| No chat                                                                  | Once a chat surface exists, users treat it as the product (IX-6)                                    |
| Reuse semantics                                                          | Defines when two people see the same interpretation; changing later alters judgment meaning (IX-13) |
| "Nothing consequential" outcome                                          | A new audit outcome and output shape (IX-15)                                                        |
| Client AI                                                                | Any exposure is permanent from the client's point of view (IX-21)                                   |

---

## 36. Open questions requiring Kerrick's approval

Each: question; recommendation; alternatives; consequences; reversibility; why it matters.

**IX-1 Sequencing.** Is the governed real-provider evaluation the first step of 7B.2?

- **Recommendation:** yes. Seed-only evaluation, manual grading, committed report and manifest change per kind, before any user-facing work is accepted; only passing kinds ship.
- **Alternatives:** build 7B.2 UI against the fake adapter first and evaluate at the end; or evaluate in a separate mini-phase before 7B.2.
- **Consequences:** no credential or provider call happens without your instruction; 7B.2 may ship fewer kinds.
- **Reversibility:** easy.
- **Why it matters:** OD-8 refuses every unevaluated model; without evaluation 7B.2 has no AI to show.

**IX-2 Explain.** Is "Explain" the permanent interface verb, hybrid, deterministic-first, with AI only as "Explain significance" (`explanation`) on Edge items, revisions and traces?

- **Recommendation:** yes.
- **Alternatives:** AI explanation on any object; deterministic only.
- **Consequences:** "Why am I seeing this?" improves for everyone; AI explanation stays narrow.
- **Reversibility:** verb hard; scope easy.
- **Why it matters:** sets the expectation that Explain never invents.

**IX-3 Examine.** Is "Examine" an interface verb delivered by `tension`, `evidence_bearing` and `realization_reading`, not a kind?

- **Recommendation:** yes; interface labels "Examine tension", "Examine bearing", "Compare with intent".
- **Alternatives:** an `examine` kind; separate verbs without the umbrella.
- **Consequences:** no schema change.
- **Reversibility:** labels moderately hard.
- **Why it matters:** keeps the closed kind set closed.

**IX-4 Prepare.** Is Prepare (Review dossier + `review_brief`) the flagship of 7B.2, and is "deterministic assembly + bounded interpretation" the reference design for all Architecture Intelligence?

- **Recommendation:** yes to both.
- **Alternatives:** lead with Explain on the Edge.
- **Consequences:** the Review dossier ships even with AI off.
- **Reversibility:** easy.
- **Why it matters:** strongest Claude Test result; sets the pattern for later kinds.

**IX-5 Challenge mode.** Should Challenge exist as a mode in 7B.2?

- **Recommendation:** no. Deliver its grounded parts as deterministic "Supports and exposures" plus `tension`/`evidence_bearing`; revisit after judgment data.
- **Alternatives:** a user-initiated Challenge mode on existing kinds; a new `challenge` kind (IX-9).
- **Consequences:** less "pushback" feel; no manufactured doubt.
- **Reversibility:** easy to add later; hard to withdraw once used.
- **Why it matters:** credibility of the whole intelligence layer.

**IX-6 Generic chat.** Does a generic chat surface exist in 7B.2, or as the centre of DSA IDE later?

- **Recommendation:** no in 7B.2; no as the centre at any stage without a new reconciliation.
- **Alternatives:** a scoped "ask about this object" free-text box in the drawer.
- **Consequences:** follow-ups are new named interpretations, not threads.
- **Reversibility:** easy not to build; hard to remove once built.
- **Why it matters:** the Claude Test; ungoverned output; provider-state pressure.

**IX-7 Interrogable objects.** Which objects support AI interpretation in 7B.2?

- **Recommendation:** Edge items, elements (revision, impact trace, connected pair), evidence links, Reviews, Implementation Initiatives. Deterministic-only for Deliverables, Acceptance Criteria, Risks/PI (beyond element subjects), Method Applications.
- **Alternatives:** add Acceptance Criteria (would need a new subject type and kind).
- **Consequences:** matches 7B.1 subjects exactly; no Tool Contract change.
- **Reversibility:** easy to add.
- **Why it matters:** scope and evaluation effort.

**IX-8 Multi-object interrogation.** Is arbitrary multi-object interrogation in 7B.2?

- **Recommendation:** no; only the governed connected pair (`tension`).
- **Alternatives:** up to three selected elements with a shared relationship path.
- **Consequences:** no unbounded context.
- **Reversibility:** easy.
- **Why it matters:** the slide toward "summarise these".

**IX-9 Challenge inference kind.** Add a `challenge` (or `premise_exposure`) kind?

- **Recommendation:** not in 7B.2.
- **Alternatives:** add now with mandatory cited premise and closed payload.
- **Consequences:** none now.
- **Reversibility:** adding later is a migration; removing after use is hard.
- **Why it matters:** permanent vocabulary (B-15 closed set).

**IX-10 READ in 7B.2.** Does "Read the development" belong in 7B.2?

- **Recommendation:** no. Build a deterministic Development Brief first (could be separate, non-AI work); section readings later with their own proposal.
- **Alternatives:** single-invocation READ with raised bounds; per-domain readings in 7B.2.
- **Consequences:** no signature "read" feature yet.
- **Reversibility:** easy.
- **Why it matters:** OD-7 bounds; summary-of-summaries risk; Claude Test.

**IX-11 Meaning of `realization_reading`.** Confirm it means one initiative's correspondence with its intent, and reserve "Read" for a future whole-development reading.

- **Recommendation:** confirm; interface label "Compare with intent", not "Read".
- **Alternatives:** rename the kind (migration).
- **Consequences:** no schema change.
- **Reversibility:** label easy; kind name hard.
- **Why it matters:** avoids conflating two very different operations.

**IX-12 Persistence rules.** Keep 7B.1's rule: `explanation` ephemeral unless kept; `tension`, `evidence_bearing`, `review_brief`, `realization_reading` persisted on generation?

- **Recommendation:** yes.
- **Alternatives:** everything ephemeral until kept.
- **Consequences:** reuse and judgment trail exist; more stored inferences.
- **Reversibility:** hard for history.
- **Why it matters:** quietness vs accountability.

**IX-13 Caching and reuse.** Reuse a persisted inference when kind, subject, all basis digests, prompt version and resolved model match; regenerate only on "Interpret again"?

- **Recommendation:** yes; reused results show their original date and requester is not exposed beyond use holders.
- **Alternatives:** always regenerate; reuse per person only.
- **Consequences:** two use holders asking the same question see the same interpretation.
- **Reversibility:** moderate.
- **Why it matters:** cost, consistency, judgment meaning.

**IX-14 Deduplication after judgment.** Should `not_material` or `disagree` on an inference suppress re-offering the same kind on the same subject until its basis changes?

- **Recommendation:** yes, mirroring Edge fingerprints; "Interpret again" remains possible and is audited.
- **Alternatives:** suppress for the judging person only; no suppression.
- **Consequences:** quiet; repeat requests are deliberate.
- **Reversibility:** easy.
- **Why it matters:** repetitive criticism.

**IX-15 Model uncertainty.** Allow a structured "nothing consequential to add" result, recorded as an audit outcome and not persisted as an inference?

- **Recommendation:** yes.
- **Alternatives:** keep the 1-to-8-claims requirement and let uncertainty live in the `uncertainty` field.
- **Consequences:** output-schema version bump; new request outcome value.
- **Reversibility:** moderate (audit vocabulary).
- **Why it matters:** silence under uncertainty; prevents forced output.

**IX-16 Proactive vs user-initiated.** Adopt Model 2: deterministic state makes interpretation available; the model runs only on a person's request?

- **Recommendation:** yes; no proactive inference in 7B.2.
- **Alternatives:** entirely user-initiated with no availability cues; limited proactive inference.
- **Consequences:** B-25 unchanged.
- **Reversibility:** easy.
- **Why it matters:** privacy, cost, noise.

**IX-17 Edge projection.** Project persisted, current, unjudged `tension`, `evidence_bearing` and `realization_reading` into a "Suggested interpretations" section of the Engagement Edge, outside tiers; `explanation` and `review_brief` stay attached to their subjects; nothing on the overview or briefing?

- **Recommendation:** yes, with the ADR-0051 amendment B-14 anticipated.
- **Alternatives:** no projection in 7B.2 (interpretations only in the drawer and register); project all kinds.
- **Consequences:** the Edge gains one section for use holders.
- **Reversibility:** moderate.
- **Why it matters:** the Edge/Intelligence boundary in the user's eyes.

**IX-18 Visibility of existence.** Should people without `use_architecture_intelligence` see that an interpretation exists (without its text)?

- **Recommendation:** no; they see the governed state only.
- **Alternatives:** show "interpretation available to architects".
- **Consequences:** consistent with OD-11 and OD-12-style caution.
- **Reversibility:** easy.
- **Why it matters:** quiet leakage and pressure on capability grants.

**IX-19 Inference judgments storage.** Sibling append-only table vs an `inference` subject in `edge_judgments`?

- **Recommendation:** sibling table with identical kinds and semantics; ADR-0056 amended for producer-neutral `disagree`.
- **Alternatives:** extend `edge_judgments`.
- **Consequences:** whole-event judgment can never touch inferences.
- **Reversibility:** hard (data).
- **Why it matters:** judgment integrity.

**IX-20 Promotion suggestions.** May AI suggest a promotion destination?

- **Recommendation:** no in 7B.2; DSA offers the four governed targets; promotion forms open without model text unless the person brings it in as `ai_analysis`.
- **Alternatives:** AI names a suggested target in the payload.
- **Consequences:** "Only people promote" holds without nuance.
- **Reversibility:** easy to add later.
- **Why it matters:** AI-directed governance creep.

**IX-21 Client visibility.** Any client AI in 7B.2?

- **Recommendation:** none.
- **Alternatives:** architect-approved AI explanations on published elements.
- **Consequences:** client surfaces unchanged.
- **Reversibility:** exposure is irreversible.
- **Why it matters:** publication boundary, B-23 disclosure, trust.

**IX-22 Method/IP.** Any Method-aware intelligence in 7B.2?

- **Recommendation:** none; methodology provenance shown deterministically only.
- **Alternatives:** separately authorised Method data class.
- **Consequences:** B-19 unchanged.
- **Reversibility:** easy.
- **Why it matters:** TPLCo IP.

**IX-23 Development Context.** May architects explicitly include Development Context in a request?

- **Recommendation:** not in 7B.2; if later, visible, explicit, separately classed and authorised, recorded in the basis.
- **Alternatives:** allow now as an explicit toggle.
- **Consequences:** B-26 unchanged.
- **Reversibility:** easy.
- **Why it matters:** hidden steering; practice vocabulary leaving DSA.

**IX-24 Command surface.** Does a command surface belong in 7B.2?

- **Recommendation:** no; later, starting with navigation and deterministic queries, each result classed; AI only as named interpretations on resolved objects; never mutation.
- **Alternatives:** a navigation-only palette in 7B.2 (no AI).
- **Consequences:** none now.
- **Reversibility:** easy.
- **Why it matters:** the boundary between interpretation and action.

**IX-25 Cost disclosure.** Disclose unusually large requests before sending, without currency to non-authorizers; no budget classes yet?

- **Recommendation:** yes.
- **Alternatives:** no disclosure; show estimated cost to everyone.
- **Consequences:** fewer surprises; no per-person cost culture.
- **Reversibility:** easy.
- **Why it matters:** cost without productivity analytics.

**IX-26 Failure UX and mobile.** Adopt the governance-state copy of §25 and the drawer-to-sheet rule of §27 as standards for every intelligence surface?

- **Recommendation:** yes.
- **Alternatives:** per-surface design.
- **Consequences:** one state language on desktop and mobile.
- **Reversibility:** easy.
- **Why it matters:** failures that look governed, not broken.

---

## 37. Recommended next step

1. Kerrick reviews this reconciliation and answers IX-1 to IX-26.
2. On his instruction, the governed seed-only real-provider evaluation (IX-1), which needs a credential he provides and a manifest change he reviews.
3. Then `PHASE_7B_2_PROPOSAL.md`, scoped by his answers, with migrations, ADR amendments (0051 projection, 0056 producer-neutral `disagree`), acceptance criteria and browser acceptance.

Until then: no proposal, no implementation, no credential, no provider call, and the Phase 7B.2 hold stays in place.

---

## Appendix A. Principle review (brief §27)

| #   | Candidate principle                                 | Verdict | Note                                                                                             |
| --- | --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| 1   | Architecture remains the center                     | Keep    | —                                                                                                |
| 2   | Intelligence is contextual, not a destination       | Keep    | The register on the AI page is a record, not a destination for discovery                         |
| 3   | Deterministic truth outranks model inference        | Keep    | Strengthen: **deterministic first and complete on its own** (new 16)                             |
| 4   | AI should explain why it believes something matters | Refine  | "Why it _may_ matter, citing records", never _how much_ (no significance field)                  |
| 5   | Human judgment remains explicit                     | Keep    | —                                                                                                |
| 6   | AI never silently governs                           | Tighten | "AI never governs" — no silent or explicit governance by a model                                 |
| 7   | Challenge thinking without manufacturing doubt      | Keep    | Mostly delivered structurally (§8)                                                               |
| 8   | Quiet when nothing consequential to add             | Keep    | Needs IX-15 to be enforceable                                                                    |
| 9   | Every important inference traceable                 | Tighten | Every _persisted_ inference traceable to exact versions                                          |
| 10  | Exact versions matter                               | Keep    | —                                                                                                |
| 11  | Interrogate the development, not chat with a model  | Keep    | The central principle of this document                                                           |
| 12  | Reduce blind spots, not replace thinking            | Keep    | —                                                                                                |
| 13  | Make careless development harder                    | Refine  | Through **structure** first; tension with 8 resolved by putting pressure in deterministic layers |
| 14  | Respect engagement boundaries and Method/IP         | Keep    | —                                                                                                |
| 15  | Output volume is not intelligence                   | Keep    | —                                                                                                |

**Missing principles proposed:**

16. **Deterministic first, complete on its own.** If DSA can know it, DSA computes it, and the deterministic answer is shown before any interpretation.
17. **Interpretations expire with their basis.** Nothing a model said outlives the versions it read.
18. **Same question, same answer while nothing has changed.** Reuse before regenerate.
19. **Permission shapes context.** What a model may see depends on who asks and what the engagement has authorised; authorised is not included.
20. **No intelligence about people.** No interpretation of individuals' performance, behaviour or productivity, and no per-person aggregation.
21. **Failures speak governance.** A refusal explains the rule that applied, not a malfunction.

**Conflicts noted:** 7 vs 8 (challenge vs quiet) and 13 vs "not difficult to use" are resolved by placing pressure in deterministic structure, which is always present and never chatty, and interpretation on request.

## Appendix B. The DSA IDE loop (brief §24)

The proposed loop is **broadly accurate** [inference], with four corrections:

1. **Evidence and client input are inputs, not only outputs.** Evidence, client contributions, client action responses and approvals enter the Living Development Model throughout, not only after implementation.
2. **Architecture Intelligence does not feed the deterministic Edge.** It reads the model and the Edge; its persisted interpretations appear beside the Edge (`suggested`), never inside its tiers. The arrow "Edge → Intelligence" is right; any implied "Intelligence → Edge conditions" is not.
3. **Judgment does not always lead to governed action.** `not_material`, `deferred` and `disagree` end the loop at judgment, and that is a valid, recorded outcome; judgments also feed back into the Edge (fingerprint suppression) and into evaluation of rules and prompts.
4. **The Review is the governed checkpoint** where implementation, evidence and architecture are examined together; it deserves its own place in the loop between governed action and implementation/observed reality. "Observed reality" today means implementation checkpoints, validation and evidence; DSA has no direct observation channel yet.

Corrected loop:

```
LIVING DEVELOPMENT MODEL  ◄──────── evidence, client input, approvals
  ↓
DETERMINISTIC DEVELOPMENT EDGE ─────────────┐
  ↓                                         │
ARCHITECTURE INTELLIGENCE (on request,      │
  beside the Edge, suggested)               │
  ↓                                         ↓
HUMAN JUDGMENT ── not material / deferred / disagree (ends; feeds Edge and evaluation)
  ↓ promoted
GOVERNED ACTION (Risk, Decision, Review, criterion, revision)
  ↓
REVIEW (examined versions captured)
  ↓
IMPLEMENTATION / CHECKPOINTS / VALIDATION / EVIDENCE
  ↓
LIVING DEVELOPMENT MODEL

Later:
EXTERNAL DEVELOPMENT ENVIRONMENT → DEVELOPMENT ENVIRONMENT INTELLIGENCE
  → beside the Edge (suggested, external origin) → HUMAN EXAMINATION
```

## Appendix C. What not to build (brief §30)

| Feature                              | Why not                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Generic chat                         | Class A; ungoverned output; invites provider-hosted state; becomes the product by default        |
| Generic document summarisation       | Class A; needs file contents (B-16)                                                              |
| Generic brainstorming                | Class A; produces plausible content with no basis; "AI knows my development" illusion            |
| AI-generated dashboards              | A destination, not context; turns interpretation into a display of authority                     |
| Architecture health scores           | A number with no governed meaning; contrary to ADR-0058's no-score ordering and P7-Q9            |
| Maturity scores                      | Maturity is human judgment (ADR-0019)                                                            |
| AI ranking of architecture           | Order is lexicographic over governed facts (ADR-0058); AI priority was rejected (P7-Q22)         |
| Autonomous architecture editing      | AI never governs; Tool Contract is read-only (ADR-0063)                                          |
| Autonomous promotion                 | Only people promote (B-31, ADR-0056)                                                             |
| Background agents                    | B-25; privacy, cost, noise; no requester to attribute                                            |
| Generic news feed                    | Development Environment Intelligence is a later, separate phase (B-18); unmapped news is class A |
| Productivity scoring                 | B-21; ADR-0066 forbids per-person aggregation                                                    |
| Engagement-maximising notifications  | B-27; contrary to "calm, institutional"                                                          |
| "AI insights" with no governed basis | Fails the basis rule (7B §8.3 item 4); cannot go stale; cannot be judged meaningfully            |
