# Phase 7B — Bounded AI Architecture Intelligence: Conceptual Reconciliation

**Status:** Revision 1, for Kerrick's review. **This is an investigation, not a proposal.** It creates no migration, schema, table, enum, function, ADR, application code, prompt, provider SDK, model connection, embedding, vector store, agent, background job or monitoring service. `CLAUDE.md`'s Phase 7B hold is unchanged. No `PHASE_7B_PROPOSAL.md` exists or is implied.

**Read against:** `main` at `a052830` (Phase 7A merged as `85ecf13`; status PR `a052830`).

**Governing direction:**

- Kerrick's Phase 7B reconciliation brief (2026-09-30), items 1–32;
- the approved decisions of [`PHASE_7_CONCEPTUAL_RECONCILIATION.md`](PHASE_7_CONCEPTUAL_RECONCILIATION.md) Revision 2 (Q1–Q30, with clarifications), cited as **P7-Qn**;
- the accepted Phase 7A implementation ([`PHASE_7A_PROPOSAL.md`](PHASE_7A_PROPOSAL.md), [`PHASE_7A_REPORT.md`](PHASE_7A_REPORT.md), ADR-0051 to ADR-0059);
- [`DSA_OS_MASTER_BUILD_SPEC.md`](../../DSA_OS_MASTER_BUILD_SPEC.md), cited as **Spec §n**.

**Conventions.** Repository claims cite `path:line`, ADRs, migrations or functions. External technology claims cite official sources with the access date (all accessed 2026-09-30; see §19). **[Inference]** marks architectural judgment rather than documented fact. Questions for Kerrick are numbered **B-1** to **B-31** in §34; each earlier section points to the questions it raises.

**Source reliability note for §19.** OpenAI's documentation was read through a fetch tool that summarises pages; direct download was blocked by this environment's network policy. Items quoted verbatim are marked. §19.12 lists what could not be verified and must be checked by hand before any proposal relies on it.

---

## 1. Executive summary

**The strongest architectural conclusion.** DSA IDE's AI advantage cannot come from the model. Any model DSA can call, a user can call directly, with better tooling around it every month. What a user cannot export to a general-purpose AI is the _governed state and its discipline_: exact published versions, typed relationships with a governed impact direction, evidence with stance and provenance, Review captures of what was examined, a deterministic Edge with fingerprints, and an append-only record of human judgment on every condition. Phase 7B should therefore be designed as **governed interpretation over the Living Development Model**, not as an assistant with database access. Concretely:

1. **AI reads only through a governed, read-only DSA Tool Contract** that runs as the requesting user, for one engagement, through the same read models the UI uses. It never receives a database dump, never uses the service role, never writes.
2. **Every persisted AI output is a structured, cited, version-pinned inference** with its own epistemic status (`suggested`), producer (`model`) and full generation provenance. It becomes _stale_ automatically when any basis version changes, exactly as Edge items return when their fingerprint changes.
3. **AI outputs enter the existing judgment lifecycle** (ADR-0056) and can reach governed state only through the existing governed promotion operations, with provenance following whose authority the claim rests on (P7-Q18). AI never ranks, never declares criticality, never validates.
4. **A thin, provider-neutral Intelligence Gateway** owns provider calls, data-use authorization, context minimisation, prompt versions, model identity, cost limits and audit metadata. Provider-hosted state (stored responses, conversations, files, vector stores, hosted agents, hosted prompts, hosted evals, tracing) is not used.

**What generic AI can reproduce** (the Claude Test, §9): summarising evidence, drafting prose and deliverables, answering questions about exported documents, brainstorming risks, generic web research and competitor news summaries, "prepare me for a meeting" from a document pack. These are conveniences. They may be offered, but they are not the reason 7B exists.

**What DSA's governed model uniquely enables** (§9.3): inference that is exact about _which version_ it read and goes stale when that version changes; interpretation of _deterministic_ conditions ("why this governed correspondence matters here") without replacing them; semantic tensions that no rule can compute but that are pinned to typed relationships and specific statements; Review preparation grounded in the immutable examined-version capture; and a durable, attributed record of what humans concluded about each inference, which becomes DSA's own evaluation corpus. The value compounds because the same governed state is continuously re-read, not re-exported.

**Recommended Phase 7B boundary** (§29). The smallest coherent 7B is **internal-only, read-only, user-initiated interpretation**, delivered in two acceptance steps:

- **7B.1 Foundation (no user-visible AI):** the per-engagement external-AI-processing authorization (P7-Q19a) with its contract basis; a data-class eligibility policy; the Intelligence Gateway with one provider adapter; the read-only DSA Tool Contract over existing read models; a governed prompt registry in the repository; an inference record and its provenance; a self-hosted evaluation harness over the seed.
- **7B.2 Architecture Intelligence:** "Explain" on Edge items and records (ephemeral by default); a small closed set of **persisted inference kinds** requested by a user on a record, a Review or an Edge event; the `suggested` epistemic status in contextual panels and the Edge, never affecting deterministic order; judgment of inferences (including a new `contest` meaning) and promotion only through existing governed operations; optionally the engagement-scoped "Ask about this" (P7-Q13) once 7B.2's inference kinds are accepted.

**Development Environment Intelligence belongs later, not in 7B** (§16). It is the most distinctive idea in the brief when framed as "the architecture is the intelligence specification", but it introduces an inbound data flow, source provenance and reliability, entity resolution, scheduling and cost exposure that 7B should not carry while it is still proving the inference envelope. 7B should make it _possible_ (inference kinds and producer vocabulary that can later admit an external observation) without building monitoring, web search or entity resolution.

**Most important OpenAI facts** (§19): the Responses API **stores responses for 30 days by default** unless `store:false`; Conversations, Files, vector stores, batches and evals **are not Zero Data Retention eligible**; **reusable prompts, Evals and Agent Builder shut down on 2026-11-30** and the Assistants API already did (2026-08-26), with OpenAI now recommending prompts in versioned application code; the Agents SDK **traces full inputs and outputs to OpenAI by default**, and the Agents API is beta, US-only and not ZDR; live web search is not BAA-covered; strict tool calling and JSON-schema structured outputs are available on both OpenAI and Anthropic, so a provider-neutral contract is feasible if DSA keeps retrieval and state on its side.

**Major conflicts** (§4, §5): Spec §31 "research support" implies external retrieval that no decision authorises; Spec §14 lists "AI prompts" as a Method Library category while ADR-0050 D26 excludes them; Spec §18's capability list is mostly Claude-Test conveniences; the Q19 data-use setting does not exist yet and is a hard prerequisite; `can_read_architecture` is broader than an AI context should be; and several read functions span engagements and must be excluded from any AI tool.

**Difficult-to-reverse decisions** (§33) centre on: sending any engagement content to a provider at all; what data classes are eligible; whether Method/IP may ever leave; the inference record's shape and epistemic vocabulary; AI write authority (recommended: none); client visibility (recommended: none in 7B); and any cross-engagement learning (recommended: none).

---

## 2. Current-state inventory

What exists on `main` that 7B must build on, not around. Sources: README, the phase reports, migrations and ADRs as cited.

| Area                                  | What exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Where                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Tenancy and access                    | Organizations, engagements, internal (TPLCo) vs client sides; capability-based authorization (18 `engagement_capability` values, 2 `practice_capability` values); RLS on every table; security-definer operations; error convention 42501 / 23514 / P0002                                                                                                                                                                                                                                                                        | ADR-0002, 0003, 0008, 0024, 0031, 0038, 0044; `20260929230000_phase1_foundation.sql` |
| Architecture Core                     | One element spine (`architecture_elements`, 11 kinds); 27 object types across 4 domains; 39 typed relationships with rules; statements with provenance; immutable published versions with full internal `snapshot` and `client_snapshot`; approvals and frozen baselines; domain assessments as judgment                                                                                                                                                                                                                         | ADR-0013 to 0021, 0025; `20261001000100_architecture_core.sql`                       |
| Provenance                            | Closed 8-value `provenance_type` including `ai_analysis`; `ai_review_state` (`not_applicable`, `pending`, `accepted`, `rejected`); `review_ai_content` requires `publish_architecture`; publication refuses unreviewed AI; client snapshots carry only accepted AI statements                                                                                                                                                                                                                                                    | ADR-0009, ADR-0015; `architecture_core.sql:135-152`, `:1269`, `:2593-2596`, `:2749`  |
| Evidence                              | Evidence sources (9 source types), stance `supports`/`contradicts`/`context`, links to statements and elements, `confidence_level`; files in a private bucket, internal unless cited in a published snapshot                                                                                                                                                                                                                                                                                                                     | ADR-0015, ADR-0033                                                                   |
| Project Intelligence                  | Assumptions, risks, constraints, dependencies, decisions (with options), recommendations, opportunities; stewardship, attention, triage, escalation, history; client actions and contributions with contributor areas; 11 deterministic signals with dismissals                                                                                                                                                                                                                                                                  | ADR-0017, 0026–0032, 0040                                                            |
| Reviews, Deliverables, Implementation | Reviews (`examines`, hold, validation through `record_review_validation` only); Deliverables with baselines and approvals; Implementation Initiatives with checkpoints, status, the validated gate                                                                                                                                                                                                                                                                                                                               | ADR-0034 to 0040                                                                     |
| Acceptance Criteria                   | `ACR-nnn`, proposed → agreed (publisher, published element, `agreed_on` + system `agreed_recorded_at`) → superseded/withdrawn; captured into `validation_criteria` at validation                                                                                                                                                                                                                                                                                                                                                 | ADR-0046 + 7A amendment                                                              |
| Method Library                        | Five forms (method, model, standard, instrument, template), versions, DAM releases, origin and rights, disclosure control, typed lineage (`instantiates`, `produced_from`, `judged_against`), Method Applications (internal, off-spine, never client-readable), Development Contexts (governed, empty in migration, drive no behavior)                                                                                                                                                                                           | ADR-0041 to 0050                                                                     |
| Development Edge (7A)                 | Rule catalog (31 new + 11 existing + `change_reaches`); computed `edge_items` envelope with lens, one epistemic status (`recorded`, `derived`, `worth_considering`; `suggested` reserved), `producer` (always `rule`), version-bearing `basis` references, trigger key, fingerprint, resolving act, tiers; substantive-revision classification; Review examined-version capture; governed `impact_trace`; append-only `edge_judgments` with typed governed promotion targets; private briefing watermark; practice counts with n | ADR-0051 to 0059                                                                     |
| UX                                    | Internal workspace with contextual Edge panels on element, initiative, Review, Deliverable, Method Application and evidence pages; Engagement Edge page with briefing; client portal with overview, architecture, decisions, actions, reviews, implementation, billing and **no intelligence of any kind**                                                                                                                                                                                                                       | `src/app/(internal)`, `src/app/(client)/portal`                                      |
| AI                                    | **None.** No SDK, prompt, provider configuration, inference table, data-use setting or embedding. The only placeholders are the Edge `producer` column and the reserved `suggested` status (ADR-0051), text judgment kinds (ADR-0056), and the `ai_analysis` review gate (ADR-0015)                                                                                                                                                                                                                                              | `PHASE_7A_REPORT.md` §9; 7A AC-27                                                    |

**Gaps that matter to 7B** (all verified in the repository):

- **No data-use setting.** Nothing records whether an engagement's content may be processed externally (P7-Q19 decided in principle; P7 §38.1 item 5 names it a 7B prerequisite).
- **No file-content read path.** Files are downloadable through short-lived signed URLs only (ADR-0033); nothing extracts text.
- **Broad internal read gate.** `private.can_read_architecture(e)` = `is_internal() and can_access_engagement(e)` (`architecture_core.sql:54-62`): every assigned internal member, including Finance and Project Administrators, plus every System Administrator and Principal Architect on every engagement.
- **Cross-engagement read functions exist:** `method_library()`, `method_usage()`, `method_practice_counts()` and the internal registers with `p_engagement_id default null`. They are legitimate for their pages; they must not be AI tools.
- **`activity_log` stores full row JSON** and is readable by System Administrators and Principal Architects across engagements; P7 §29 says AI request logs must not become a second such surface.

---

## 3. What Phase 7A now makes possible

Phase 7A changed what AI can be _for_. Before 7A, an AI layer would have had to discover conditions itself, which invites exactly the failure P7 §34 names: AI becoming the authority on what matters. After 7A:

1. **The "what" is known deterministically.** 42 rules state, with a fixed rule and a version-exact basis, what may warrant a look. AI does not need to find those conditions; it may _interpret_ them.
2. **Change is known exactly.** `element_revisions` distinguishes substantive revisions from status publications through a governed snapshot diff (ADR-0053), and `development_changes` gives a curated change stream (ADR-0057). An AI can be told precisely what changed between two versions rather than guessing from prose.
3. **Reach is governed.** `impact_trace` follows a governed matrix with direction, propagation and depth ≤ 2 (ADR-0055). AI can explain a trace; it must not invent reach the matrix does not grant.
4. **Reviews know what they examined.** `review_examined_versions` is immutable and version-exact (ADR-0054). "Prepare me for this Review" can be grounded in exactly what the Review will examine and what has changed since.
5. **Judgment is durable and attributed.** `edge_judgments` records investigating, not material, deferred, disagree and promoted, with fingerprint return (ADR-0056). AI inferences can join the same lifecycle, and the judgments on them become evaluation data.
6. **Promotion has a governed target vocabulary.** A promotion names a typed target (risk, decision, review, acceptance criterion) and is only ever completed through the ordinary governed operation. AI observations can reuse this unchanged.
7. **The envelope has room.** `producer`, the reserved `suggested` status, `basis` entries with version ids, and text judgment kinds were built so 7B can add a model producer "without reshaping the envelope" (ADR-0051 `:35`; `PHASE_7A_PROPOSAL.md:1009-1024`).

**[Inference]** The consequence is a clean division of labour: _rules establish; AI interprets; people judge; governed operations act._ This is the brief's hierarchy (DETERMINISTIC FACT → deterministic condition → AI interpretation → human judgment → governed action), and 7A has already built every layer except the third.

---

## 4. Master Build Spec reconciliation

The spec (`DSA_OS_MASTER_BUILD_SPEC.md`) was written before Phases 1–7A. Where it and `main` differ, later ADRs and P7 decisions govern; this section records only divergences that bear on 7B.

### 4.1 What the spec says about intelligence

- **§18 Architecture Intelligence (post-MVP)** (`:726-746`): "AI should sit underneath the methodology, not replace it." Ten future capabilities: summarize evidence; identify knowledge gaps; identify unsupported assumptions; identify architecture contradictions; suggest relevant internal models; detect missing capabilities; analyze dependencies; prepare executive review briefs; draft deliverables from structured project data; run structural coherence analysis. "The system must always distinguish: source evidence; architect judgment; AI-generated analysis; client decision."
- **§19 Structural Coherence Engine (future premium)** (`:750-771`).
- **§31 roadmap** (`:1398-1425`): Phase 7 "Architecture Intelligence: AI-assisted analysis, research support, coherence checks"; Phase 8 "Portfolio Intelligence: cross-engagement intelligence and internal metrics"; Phase 9 Certification/Licensing.
- The spec never mentions Living Development Model, DSA IDE, Development Edge, external or competitive monitoring, or notifications. Those terms come from Kerrick's Phase 7 brief as recorded in P7 (`PHASE_7_CONCEPTUAL_RECONCILIATION.md:19`, `:127`).

### 4.2 Divergences that matter to 7B

| #   | Spec                                                                                            | `main` / later decision                                                                                                                                                              | 7B consequence                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| S1  | Phase 7 = AI analysis, research support, coherence checks (`:1419`)                             | Split into 7A (deterministic, done) and 7B (bounded AI, on hold) (P7 §0.1, Q17)                                                                                                      | 7B inherits only the AI part; coherence checks' deterministic subset already exists as Integrity rules (P7-Q27) |
| S2  | "Research support" (`:1419`)                                                                    | Undecided. P7 C2 reads it as external retrieval, "a data-transfer decision" (`:1266`); Q19/Q20 constrain outbound data, nothing authorises inbound external content                  | **Conflict.** Decide whether 7B includes any external research (B-17)                                           |
| S3  | "AI prompts" as a Method Library category (§14 `:631`)                                          | ADR-0050 D26: "There is no category, form, table or storage for AI prompts. Prompt governance is designed in Phase 7." P7-Q14: prompt governance comes with the provider abstraction | **Conflict.** Prompts are product configuration, not Method IP (P7-Q15). Decide where they live (B-8)           |
| S4  | §18 capabilities (summaries, drafts, briefs)                                                    | P7 §1.3 and §5: value that lives mainly in LLM output is "a convenience, not a moat"                                                                                                 | These are allowed only as grounded conveniences; they do not define 7B (§9)                                     |
| S5  | §12 deliverables "generated from structured project data"                                       | P7-Q25: if ever, only from published versions with `produced_from` lineage, as a working copy with `ai_analysis` review                                                              | Deliverable drafting is out of 7B (§30)                                                                         |
| S6  | §16 Pattern Library in Phase 6                                                                  | ADR-0050; P7-Q23: explicitly not Phase 7, a separately governed later workstream                                                                                                     | No Pattern functionality in 7B (§26)                                                                            |
| S7  | §17 Portfolio Intelligence ("recurring capability gaps", "recurring risks")                     | P7-Q10: no cross-engagement recurrence in Phase 7                                                                                                                                    | No cross-engagement AI in 7B (§25)                                                                              |
| S8  | §15 `ip_classification` "Generated Analysis"                                                    | Enum value `generated_analysis` exists (`phase1_foundation.sql:66`); nothing writes it; P7-Q18 provenance follows authority                                                          | Do not start using it for AI output without a decision (B-6)                                                    |
| S9  | Product name "DSA OS"                                                                           | P7-Q1: DSA IDE is the paradigm users see; repository and system references not renamed; Living Development Model is never a table, type or schema object                             | 7B must not create a "living model" object; names remain a documentation matter                                 |
| S10 | Client nav "Messages" and "Documents" (`:343`, `:346`)                                          | Neither exists; no notification delivery; email pending a provider decision in every report                                                                                          | Notifications stay out of 7B (P7-Q24; §28)                                                                      |
| S11 | "Distinguish source evidence; architect judgment; AI-generated analysis; client decision" (§18) | Implemented for content entering architecture (`ai_analysis` + review gate). Not yet for AI _observations_, which are not architecture (ADR-0032 amendment)                          | 7B must add the observation-side distinction (§13) without widening `provenance_type`                           |

### 4.3 What the spec gets right that 7B should keep

"AI should sit underneath the methodology, not replace it" (§18) is the correct governing sentence and is consistent with every later decision. So is the four-way distinction in §18: 7B's epistemic model (§13) is its implementation for observations.

---

## 5. ADR reconciliation

ADRs that constrain 7B, what they decide, and whether 7B conflicts with them.

| ADR                                     | Decides                                                                                                                                                                                                  | 7B must                                                                                                                                                                                                       | Conflict?                                                                                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0003 Authorization in the database      | Authorization lives in RLS and definer operations, not the UI                                                                                                                                            | Run every AI tool read as the user under RLS/definer checks; no application-layer filtering of a broader read                                                                                                 | No                                                                                                                                                                 |
| 0005 / service role                     | Service-role client only for invitations (`src/lib/supabase/admin.ts`)                                                                                                                                   | Never assemble AI context with the service role (P7 §20)                                                                                                                                                      | No                                                                                                                                                                 |
| 0009 / 0015 Provenance                  | Closed 8-value `provenance_type`; `ai_analysis` never final without review; adding a value needs an ADR; history cannot be relabelled                                                                    | Keep the enum; use `ai_analysis` only when AI-drafted content enters architecture; AI observations get their own record with their own epistemic vocabulary (P7-Q16, Q18)                                     | **Only if** 7B were to add a provenance value; recommended not to (B-5)                                                                                            |
| 0014 Publication is the client boundary | Clients read only `client_snapshot`; hiding is a database property                                                                                                                                       | Any future client-facing AI may read only client read models; 7B has none (B-22)                                                                                                                              | No                                                                                                                                                                 |
| 0019 Domain maturity is judgment        | Domain state is always `architect_judgment`; calculated distribution never sets it                                                                                                                       | AI may not set or suggest a maturity state as a value; it may explain the distribution                                                                                                                        | No                                                                                                                                                                 |
| 0022 / 0043 / 0049 Method/IP internal   | Lineage, Method Applications and the Method Library are never client-readable; naming a method to a client is an authored act                                                                            | AI must not send Method content externally by default (P7 §29), must not name `internal_only` assets in client-visible drafts, must not recommend methods (B-24)                                              | No                                                                                                                                                                 |
| 0024 / 0031 / 0038 / 0044 Capabilities  | Capability-based checks, never role names; practice capabilities for TPLCo-wide authority                                                                                                                | Express AI authority as capabilities (§12.4, B-10); a practice-level authority (for example prompt governance) would be a new `practice_capability` value, which is an enum change (B-9)                      | No, but enum additions are permanent choices                                                                                                                       |
| 0032 + 7A amendment                     | Signals computed; `ai_analysis` + review gate governs AI-drafted content entering architecture; "AI observations … are a separate artifact that is not architecture. Ephemeral assistance is not stored" | 7B builds exactly that separate artifact                                                                                                                                                                      | No; 7B implements the amendment                                                                                                                                    |
| 0033 Engagement files                   | Private bucket; evidence files internal; signed URLs with the caller's session                                                                                                                           | File-content reading is a _new_ read path needing the same checks (P7 §29.2); recommended out of 7B (§21)                                                                                                     | No                                                                                                                                                                 |
| 0035 / 0036 `validates` restricted      | Validation only by `record_review_validation` with `publish_architecture`                                                                                                                                | AI must never produce, propose as fact, or label anything "validated"; external support is "support", never validation (§16.3)                                                                                | No                                                                                                                                                                 |
| 0045 Development Context                | Governed, internal, empty in migration, drives no behavior                                                                                                                                               | 7B must not start using contexts to drive AI behavior without a decision (B-26)                                                                                                                               | No                                                                                                                                                                 |
| 0046 Acceptance criteria                | Proposed vs agreed; agreement is a publisher act                                                                                                                                                         | AI may prefill a _proposed_ criterion only through the ordinary promotion path                                                                                                                                | No                                                                                                                                                                 |
| 0050 Pattern boundary, D26              | Pattern Library later; no AI prompt storage in Phase 6                                                                                                                                                   | Prompt governance must be designed in 7B (B-8); no pattern mining                                                                                                                                             | Tension with Spec §14 only                                                                                                                                         |
| 0051 Edge envelope                      | Items computed, never stored; exactly one epistemic status; `suggested` reserved for 7B; `producer` always `rule`; basis is references only; no confidence value or score; one engagement; internal      | AI inferences are _stored_ (they cannot be recomputed), so they are a different record that projects into the same envelope shape (§15). Adding `suggested` and `producer = model` is anticipated             | **Design tension:** "items are computed, never stored" vs persisted inference. Resolved by keeping inferences in their own table and projecting them (§15.2, B-14) |
| 0053 Substantive revision               | No AI decides substance; `change_summary` never parsed                                                                                                                                                   | AI must not reclassify revisions; it may _describe_ a substantive diff the system already computed. Reading `change_summary` as model input is allowed only as quoted author text, never as a classifier (§8) | No                                                                                                                                                                 |
| 0055 Impact trace                       | No generic traversal; matrix-governed reach; nothing scored                                                                                                                                              | AI may explain a trace; any AI-suggested reach beyond the matrix is an inference labelled `suggested`, never a trace row                                                                                      | No                                                                                                                                                                 |
| 0056 Judgments and promotion            | Append-only judgments; promotion only through governed operations; closed typed promotion targets; kinds are text                                                                                        | Reuse for inferences; add at most one kind (`contest`) or a clarified meaning of `disagree` (B-13); promotion targets unchanged                                                                               | No                                                                                                                                                                 |
| 0057 Briefing watermark                 | User-private, no view tracking, no per-person counts                                                                                                                                                     | AI must not add behavioral telemetry; request audit metadata is a security log, not a usage metric (§23.6)                                                                                                    | No                                                                                                                                                                 |
| 0058 Ordering and tiers                 | Human-flagged tier is human-set only; nothing scored; "What never affects order: AI (none exists)…"                                                                                                      | AI inferences never enter tiers or change order (P7-Q9, Q22)                                                                                                                                                  | No, if §15.3 is followed                                                                                                                                           |
| 0059 Practice counts                    | Cross-engagement counts with n ≥ 5, no free text, no names, no AI                                                                                                                                        | AI must not summarise stage notes or addenda across engagements                                                                                                                                               | No                                                                                                                                                                 |

---

## 6. DSA IDE product-thesis assessment

**The thesis.** "DSA IDE is an Integrated Development Environment for real-world systems."

**What the repository supports** [inference, from §2 and §7]:

- **Integrated.** Yes. Architecture, evidence, Project Intelligence, Reviews, Deliverables, Implementation, Acceptance Criteria, method practice and a deterministic Edge share one element spine, one relationship vocabulary, one version model and one authorization model. An IDE's defining property, that each tool understands the same underlying structure, holds.
- **Development environment.** Yes, in the specific sense of a governed working copy, publication as release, immutable versions, baselines as tags, typed references, impact analysis, conditions ("diagnostics") and a change log. The analogy to a software IDE is real at the level of _structure_, and 7A deliberately made it so.
- **Real-world systems.** Partly. What is developed is represented by sector-neutral vocabulary; who operates the system and how is TPLCo-shaped (§7).

**Where the IDE analogy should not be pushed** [inference]:

- A software IDE can _run_ the system and test it. DSA cannot verify reality; it records what people observed and judged. P7 (`:152`) already cautions that "the IDE framing should never imply that DSA verifies reality". This matters directly to 7B: an AI in an IDE is trusted because the compiler and tests catch its errors. DSA has no compiler for reality. Its equivalent safeguards are the deterministic rules, the governed operations and human judgment. That is why AI must remain beneath them.
- "Diagnostics" in DSA are conditions that may warrant a look, not errors (ADR-0051 language). AI must keep that register: it may say "this may bear on", never "this is wrong".

**Implication for 7B.** The IDE thesis argues _for_ tool-based, structured, version-aware AI (the way code assistants read symbols, types and diffs rather than raw text) and _against_ a chat window over documents. It is the strongest argument for the DSA Tool Contract (§12).

---

## 7. Universal-development claim assessment and boundaries

**Claim under test.** The developmental substrate stays coherent across businesses, institutions, programs, products, academic fields, commercial and economic developments, social systems, capabilities, ecosystems and initiatives.

**Evidence for** (repository facts):

- The 27 object types, 11 record kinds and 39 relationship types are sector-neutral; a search of `vocabulary.ts`, `object-types.ts` and all migrations found no sector-specific terms. Definitions are methodological ("A defined field of understanding that the development depends on, such as a market, a discipline or a policy field").
- Development Context is governed data, not an enum, and deliberately empty in migration (ADR-0045), so new kinds of development need no schema change.
- P7 (`:154`): "Nothing in Phases 1–6 hard-codes a sector … The main assumptions that narrow the paradigm are about who operates it, not what is developed."

**Evidence against or limiting:**

- The spec frames DSA as TPLCo consulting infrastructure; its worked example is real estate (`:85-90`) and its pattern examples are economic development, university, nonprofit and commercial development (`:678-685`).
- All seed data is regional or civic development (innovation district, workforce program, community expansion; contexts `real_estate_district`, `regional_industry_cluster`, `community_service`, `institutional_capability`).
- The operator model is TPLCo-singular: exactly one `tplco` organization; "internal" means TPLCo; engagements require a client organization; `engagement_type` and `deliverable_type` are TPLCo offerings (P7 §25).
- Some enums carry an organizational-development slant (`constraint_category` includes `political`; `dependency_type` includes `funding`). They are broad, not sector-specific.
- The vocabulary assumes an _organized_ development with governance, roles, capabilities and outcomes. It has not been exercised on, for example, an academic field or an ecosystem with no owning organization. Whether "governance body", "decision right" and "operating model" fit those cases is untested.

**Conclusion** [inference]. The repository supports a _defensible_ claim: "a governed environment for architecting the development of organized real-world initiatives, with sector-neutral vocabulary." It does not yet support "any real-world system" or "any concept", because (a) only one family of developments has been exercised, (b) the operator model is single-practice, and (c) Stage III ("I want to develop…") is explicitly unbuilt (P7 §25).

**What 7B should and should not assume:**

- **Should:** keep prompts, inference kinds and tool contracts free of sector vocabulary and of TPLCo service-model vocabulary (P7 §25 guidance), so AI does not narrow the substrate.
- **Should not:** use AI to _simulate_ universality by improvising domain frames the vocabulary lacks. If an AI inference needs a concept the vocabulary cannot represent, that is a signal for a governed vocabulary change (ADR-0016), not something AI should paper over.
- **Should not:** use Development Context to steer AI behavior yet (ADR-0045 "drive no behavior"); if 7B wants context-sensitive prompts, that is a decision (B-26).
- **Should not:** claim domain expertise. The model's general knowledge of, say, zoning law is not DSA knowledge; it is unverified external content (§16.3).

---

## 8. Deterministic vs AI reasoning boundary

**Principle.** Where the system can know something exactly from governed state, it must compute it; AI may only explain it. AI is reserved for questions whose answer depends on _meaning in text_, _judgment of relevance_, or _synthesis across records_ that no fixed rule captures, and its answers are always labelled as inference.

### 8.1 The layers

| Layer                   | Producer                           | Authority               | Stored?                                           | Example                                                                                                               |
| ----------------------- | ---------------------------------- | ----------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Fact                    | People through governed operations | Governed                | Yes, versioned                                    | RSK-001 status is `materialized`                                                                                      |
| Deterministic condition | Rule (7A)                          | Derived, reproducible   | No (computed)                                     | "A materialized risk still threatens published architecture"                                                          |
| AI interpretation       | Model, via tools                   | Advisory, `suggested`   | Ephemeral by default; persisted by P7-Q3 criteria | "RSK-001's statement that anchor land is unavailable appears to undercut STM-002's rationale, which assumes the land" |
| Human judgment          | Person                             | Attributed, append-only | Yes                                               | "Not material: land alternative recorded in DEC-004"                                                                  |
| Governed action         | Person via the ordinary operation  | Governed                | Yes                                               | Revise STM-002; record DEC-005                                                                                        |

AI never skips a layer. In particular it never turns an interpretation into a fact (no writes), never turns a condition into a judgment (no auto-dismissal), and never turns an interpretation into a condition (it does not create rule-producer items or change tiers).

### 8.2 The brief's candidate questions, classified

| Question                                                          | Deterministic part (exists or computable)                                                                                | AI part                                                                                                                                           | Not the system's to answer                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| What am I overlooking?                                            | Edge items for the engagement, by tier and order                                                                         | Semantic tensions no rule computes (§14 kinds), each cited                                                                                        | Anything implying the Edge is complete; "overlooking" is never asserted, only "may bear on" |
| What changed?                                                     | `development_changes`, `element_revisions` with changed paths                                                            | A readable description of a computed substantive diff                                                                                             | Whether a change was _good_                                                                 |
| Why does this matter?                                             | Rule definition, resolving act, impact trace, governance dates                                                           | Explanation connecting the condition to this element's statements and outcomes                                                                    | A significance score or rank (P7-Q9)                                                        |
| What bears on this element?                                       | Relationships, evidence links, `impact_trace`, Edge items with this element in basis                                     | Unlinked statements or evidence that _appear_ relevant (suggested links, never written)                                                           | —                                                                                           |
| What evidence challenges this assumption?                         | Evidence linked with stance `contradicts`; validation status                                                             | Evidence linked as `supports`/`context` whose text appears to challenge it; unlinked engagement evidence that appears to (internal evidence only) | Whether the assumption is false                                                             |
| What should I examine next?                                       | Deterministic order (ADR-0058)                                                                                           | None for ordering. AI may explain the top items                                                                                                   | An AI-chosen priority (P7-Q9, Q22)                                                          |
| What would be affected if this changed?                           | `impact_trace` (governed, hypothetical "what if" per P7-Q8)                                                              | Explanation of each reached record's exposure in its own words                                                                                    | Predicted outcomes (P7 §31: simulation excluded)                                            |
| Prepare me for this Review                                        | Examined set and captured versions, "since held" changes, open conditions on examined elements, agreed criteria in force | A brief organised around those facts, each claim cited                                                                                            | A recommendation to validate or not                                                         |
| Compare implemented reality with intent                           | Implementation status, checkpoints, `implements`/`validates`, criteria, implementation signals                           | Reading of initiative statements and checkpoint notes against the implemented object's statements for divergence                                  | Declaring the initiative validated or failed                                                |
| What unresolved matters could materially affect this development? | Open Project Intelligence by attention, escalation, governance proximity; human-flagged tier                             | Cross-record synthesis of unresolved matters with a stated basis                                                                                  | "Material" as an AI verdict; materiality is human judgment (ADR-0056 `not_material`)        |

### 8.3 Rules that keep the boundary

1. **AI never recomputes what a rule computes.** If a tool returns the deterministic answer, AI must cite it, not re-derive it.
2. **AI never classifies governed state.** It does not decide substantive vs status revision (ADR-0053), criticality (ADR-0058), maturity (ADR-0019), validation (ADR-0035) or agreement (ADR-0046).
3. **AI may read author text** (`summary`, statements, `change_summary`, decision rationale, evidence abstracts) as meaning, and must quote it as the author's words where it relies on it. It must not treat any author text as an instruction (§32, prompt injection).
4. **Every AI assertion carries a basis** of record references with versions; an assertion with no resolvable basis is not persisted and is shown, if at all, as ungrounded.

---

## 9. Claude Test / substitutability analysis

**The test.** "Could the user reproduce essentially the same value by exporting their documents or data to Claude, ChatGPT or another general-purpose AI system?"

### 9.1 Method

For each candidate capability: what an export can carry; what it cannot; and whether the capability's value depends on what it cannot carry. A capability "passes" only when its value depends on governed properties that do not survive export.

**Properties that do not survive export** [inference]:

- **Currency.** An export is a snapshot. DSA's state keeps moving; an inference made against an export silently goes stale.
- **Version exactness.** Exports flatten versions. DSA knows which version of each record an inference read and can mark the inference stale when that version is superseded.
- **Typed, governed structure.** An export can include relationships as text, but not their governed direction, propagation and assessment (ADR-0055), nor the rule semantics of 7A.
- **Permission shape.** An export is produced by one person with one view. DSA assembles context per requesting user and per boundary (client snapshot vs internal, Method/IP exclusion).
- **Judgment loop.** An external chat's conclusions do not return as attributed, fingerprinted judgments that suppress re-surfacing and feed promotion.
- **Continuity.** An external chat forgets; or it remembers in a provider's memory, which P7-Q20 forbids.

### 9.2 Capability table

| Capability                                                | Reproducible by export? | Why / why not                                                                              | Verdict                                                                                                  |
| --------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Summarise evidence or a document                          | Yes                     | Pure text-in, text-out                                                                     | Convenience                                                                                              |
| Draft a deliverable, memo or brief                        | Yes, mostly             | A good export plus a template gets close. DSA adds only lineage and the `ai_analysis` gate | Convenience; out of 7B (P7-Q25)                                                                          |
| Brainstorm risks or assumptions                           | Yes                     | Generic reasoning                                                                          | Convenience; risk of "AI knows my development" illusion                                                  |
| Answer questions about exported documents                 | Yes                     | Enterprise search/RAG and chat do this well                                                | Convenience                                                                                              |
| Web research on a topic                                   | Yes                     | Every general AI has web search                                                            | Convenience unless tied to the model (§16)                                                               |
| Competitor news summaries                                 | Yes                     | Commodity CI tools and search agents                                                       | Convenience unless mapped to governed elements (§18)                                                     |
| "Prepare me for this Review" from a document pack         | Largely                 | If the pack is current and complete                                                        | Passes **only** when grounded in the examined-version capture and "since held" computation (§9.3 item 4) |
| Explain a deterministic Edge condition                    | Partly                  | The rule and basis can be exported, but not re-evaluated as state changes                  | Passes when explanation is attached to the live item and goes stale with it                              |
| Find semantic tensions across typed records               | Partly                  | A strong model given a full export can spot contradictions                                 | Passes when pinned to versions, typed relationships and judgment return; fails as a one-off report       |
| Suggest missing relationships or evidence links           | Partly                  | Export loses the relationship rules and governed vocabulary                                | Passes when proposals are constrained to `relationship_rules` and land as governed drafts                |
| Compare implementation with intent                        | Partly                  | Needs implementation state, criteria in force, validation history                          | Passes when bound to `criteria_in_force` and validation captures                                         |
| Development Environment monitoring mapped to architecture | No, not continuously    | Needs the live model as the specification and a durable judged trail                       | Distinctive, but later (§16)                                                                             |

### 9.3 Where DSA is plausibly hard to substitute

These are _architectural_ claims about what the design makes possible, not market claims.

1. **Version-pinned, self-invalidating inference.** An inference stores the exact versions it read. When any basis record publishes a new version, the inference is marked stale and leaves the default view (P7 §16). A chat transcript cannot do this.
2. **Interpretation on top of deterministic conditions.** 7A produces conditions with a fixed rule, basis and resolving act. AI explains _why this condition matters here_ using the element's own statements, without being the source of the condition. Generic AI would have to rediscover the condition and could not say it is governed.
3. **Tension detection constrained by typed structure.** Candidate tensions are only sought along governed relationships and impact paths (for example an assumption that `underpins` an element whose rationale now conflicts with a decision). The search space and the citation form come from DSA, not from a free reading of documents.
4. **Review preparation from immutable captures.** `review_examined_versions` fixes what was examined; `element_revisions` says what substantively changed since; criteria in force are known. The brief is a reading of governed facts, not of a document pack.
5. **Attributed judgment as evaluation data.** Every "not material", "disagree/contest" and "promoted" on an inference, with its reason, becomes a per-engagement, internal record of inference quality. Over time it tells TPLCo which inference kinds help and which do not, on its own work (P7 §30: evaluate on DSA's own judgments).
6. **Permission-shaped context.** The same question asked by a Researcher and a Principal Architect assembles different, correctly bounded context, and Method/IP never leaves unless separately authorised.

### 9.4 Weak capabilities that do not pass

- A general chat panel ("Ask DSA anything").
- Free-form summaries of whole engagements.
- Deliverable or deck generation.
- Generic web research, news feeds and competitor alerts not mapped to governed elements.
- AI-assigned priority, criticality or health scores.
- Method recommendation from free-text similarity.

They should not define 7B. Some may appear as conveniences later if grounded and governed.

---

## 10. DSA Architect analysis

**What it should be** [inference]. Not an agent and not a general chatbot. The right shape is a **contextual reasoning interface**: an intelligence surface that is always _about something governed_ (an element, an Edge event, a Review, an initiative, an engagement), reads only through the Tool Contract as the user, answers in structured, cited form, and offers governed next steps as links to ordinary operations.

| Candidate role             | Assessment                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversational assistant   | Only as P7-Q13's engagement-scoped "Ask about this": ephemeral, cited, epistemically labelled, "Keep" as the only persistence path. Not a free chat                   |
| Architectural analyst      | Yes: this is the core. Requested analyses of a closed set of kinds on a governed subject (§14)                                                                        |
| Reasoning interface        | Yes: explanation of conditions, traces and changes                                                                                                                    |
| Development copilot        | Partly: it can _prefill_ governed forms (as promotion already does) but never submits                                                                                 |
| Agent                      | **No for 7B.** Autonomy over governed state contradicts ADR-0035's logic and P7 §34 "Architecture subordinate to AI". Read-only tool use in one request is not agency |
| Contextual command surface | Partly, and mostly non-AI (§27.3)                                                                                                                                     |

**Naming.** "DSA Architect" risks implying the AI _is_ an architect, which cuts against "AI interprets; people judge". Alternatives: "Architecture Intelligence" (the phase name; P7 recommends keeping it), "Interpret", "Examine". Name is a product decision (B-29).

**Constraints it must never break:**

1. One engagement per context (P7 §20).
2. Runs as the requesting user; no service role.
3. No write tools; proposals are prefilled forms the user completes.
4. No ranking; no criticality; no validation language.
5. Every sentence that makes a claim cites a governed record and version, or is labelled as general reasoning without basis.
6. Ephemeral by default (P7-Q3).

---

## 11. Intelligence Gateway analysis

**Recommendation.** Yes, a gateway belongs in 7B (7B.1), and it should be _thin_: a server-side module with a narrow interface, not a platform.

```
DSA surface (server action)
  → Intelligence Gateway
      - data-use authorization check (engagement setting, data classes)
      - prompt/version resolution (repository registry)
      - context assembly via DSA Tool Contract (as the user)
      - provider adapter (one in 7B)
      - structured-output validation (schema, citations resolvable)
      - provenance capture (provider, resolved model id, versions, basis)
      - audit metadata (no payloads), cost/budget guard
  → provider API
```

| Concern                   | Recommendation                                                                                                                                       | Why                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Provider abstraction      | One adapter interface; one implementation in 7B                                                                                                      | Q14 minimal; OpenAI and Anthropic both support strict tools and JSON-schema output (§19, §20)    |
| Model selection           | Per inference kind, as configuration in the prompt registry; record the _resolved_ model id from each response                                       | Models change monthly (§19.1); requested ids may be aliases                                      |
| Tool contracts            | Provider-neutral JSON Schema definitions generated from DSA's own tool registry (§12)                                                                | Both providers take JSON Schema tools                                                            |
| Structured outputs        | Validate every persisted output against DSA's schema _after_ the provider returns, even when the provider enforces a schema                          | Provider schema subsets differ and limits are unverified (§19.3 gaps)                            |
| Provenance                | Stored on the inference record (§13.3)                                                                                                               | P7 §10, §18                                                                                      |
| Data-use policy           | Enforced in the gateway before any call; refuse when the engagement is not authorised or a data class is excluded                                    | P7-Q19a, Q20                                                                                     |
| Engagement authorization  | The gateway takes an engagement id and the user's session; all reads run through the Tool Contract                                                   | P7 §20                                                                                           |
| Retry/failure             | Bounded retries on transient errors; no silent fallback to another provider or model without recording it; a failed request persists nothing         | Honest provenance                                                                                |
| Observability             | Metrics only (latency, token counts, error class). No prompts, outputs or client content to logs or third-party observability; no provider tracing   | P7 §29.2; Agents SDK tracing sends full I/O by default (§19.7)                                   |
| Token/cost governance     | Per-engagement and global budgets; provider project hard limits as a backstop                                                                        | Hard spend limits exist (§19.15)                                                                 |
| Retention/privacy         | `store:false` always; ZDR (or equivalent) contractually before any client content is sent; no hosted conversations/files/vector stores/prompts/evals | These are stored by default or not ZDR-eligible (§19.10–19.11)                                   |
| Prompt/version governance | Prompts as versioned files in the repository, reviewed like code; the version id recorded on each output                                             | OpenAI's hosted prompts shut down 2026-11-30 and it now recommends code-managed prompts (§19.13) |
| Provider replacement      | Adapter swap plus re-running the evaluation set; old inferences keep their recorded provider/model                                                   | Provenance never rewritten                                                                       |
| In 7B or deferred?        | **In 7B.1**, as a prerequisite; without it every other 7B piece couples to a provider                                                                | P7 §38.2                                                                                         |

**What the gateway must not become:** a place where business logic, ranking or policy decisions hide. Policy lives in the database (the setting) and in reviewed prompt files; the gateway only enforces and records.

---

## 12. DSA Tool Contract analysis

**Recommendation.** A governed, **read-only** DSA Tool Contract should be foundational to 7B. It is the single most important architectural choice: it is what makes the AI "architecture-native" rather than "documents in a prompt".

### 12.1 Shape

- A **registry** of named tools, each with: a JSON Schema for arguments; the DSA read function(s) it calls; the capability it requires; the data classes it may return; its output shape (references first, content second); and a version.
- Tools execute **server-side, as the requesting user**, through the user's Supabase session, so RLS and definer checks apply exactly as for the UI (ADR-0003). The model only ever sees tool _results_.
- Tools are **engagement-bound**: the gateway fixes the engagement id; a tool cannot be asked about another engagement, and tools never take a null engagement.

### 12.2 Candidate tools mapped to existing reads

These names are illustrative; approving names is a proposal-stage act.

| Tool (illustrative)        | Backed by (existing)                                                                       | Notes                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `get_element` (at version) | `element_version_snapshot` (internal full), `architecture_elements` + statements under RLS | Returns statements with provenance and AI review state; excludes lineage unless Method class authorised |
| `get_related`              | `architecture_relationships` under RLS, `relationship_types`                               | Typed, with direction                                                                                   |
| `compare_versions`         | `element_revisions` (changed paths), two snapshots                                         | Uses the governed diff; AI does not diff                                                                |
| `trace_impact`             | `impact_trace(element, mode)`                                                              | Governed reach only                                                                                     |
| `get_bearing_evidence`     | `element_evidence_links`, `statement_evidence_links`, `evidence_sources`                   | Metadata and stance; **no file contents** in 7B                                                         |
| `get_project_intelligence` | `intelligence_register(engagement)`, `intelligence_history`                                | Bound to the engagement (never null)                                                                    |
| `get_implementation_state` | `implementation_register(engagement)`, checkpoints, `implementation_signals`               |                                                                                                         |
| `get_acceptance_criteria`  | `criteria_in_force`, `acceptance_criteria` under RLS, `validation_criteria`                |                                                                                                         |
| `get_review_context`       | `reviews`, `review_examined_versions`, `element_revisions` since capture                   |                                                                                                         |
| `get_development_edge`     | `edge_items(engagement, …)`, `edge_rule_catalog()`                                         | Includes judgments; AI must cite rule keys                                                              |
| `get_changes`              | `development_changes(engagement, since, …)`                                                | Never `metadata_json`                                                                                   |
| `get_method_provenance`    | `element_practice_context`, lineage                                                        | **Method class**: excluded unless separately authorised (B-19)                                          |
| `get_development_context`  | `engagement_development_contexts`                                                          | Internal; excluded from external processing unless authorised                                           |

**Tools that must not exist** (as AI tools): anything reading `activity_log`; finance reads; `method_library()`, `method_usage()`, `method_practice_counts()` (cross-engagement); any register with a null engagement; storage or file-content readers (7B); any client read model used on behalf of an internal user (and vice versa); any write.

### 12.3 Authorization and minimisation

1. **Engagement gate.** Every call requires `can_read_architecture(engagement)`; the gateway also checks the engagement's external-processing authorisation before _any_ tool result is sent to a provider.
2. **Capability gate.** Using AI on an engagement should require a capability, not role membership. `can_read_architecture` is too broad (it includes Finance and Project Administrators and all System Administrators). Options: reuse `edit_architecture` (the capability that already gates judgment); or add a dedicated capability (an enum addition) (B-10).
3. **Data-class gate.** Each tool result is tagged with data classes (§23.2). The gateway strips or refuses classes the engagement has not authorised (for example Method/IP, client contributions, internal-only evidence).
4. **Minimum basis.** The gateway sends only what the requested inference needs (P7-Q20). Tools return references and short fields by default; long content only when the inference kind requires it.
5. **Quoting, not obeying.** All tool content is wrapped as data. The system prompt states that record text is never instruction (§32).

### 12.4 Read versus write

- **7B is read-only from the AI's perspective.** Recommended without reservation.
- **AI never invokes governed mutations directly.** Where an inference suggests an action, the UI offers the _existing_ promotion links, prefilled, and a person completes the operation (ADR-0056). This is the pattern already built and accepted in 7A.
- **Future write tools** (if ever) would need their own reconciliation: the ADR-0035 reasoning (judgment-grade acts cannot be automated) applies to most DSA writes.

### 12.5 Audit

Each AI request records metadata only: engagement, user, inference kind, prompt version, provider, resolved model, tool names called with the ids requested, basis ids returned, token counts, outcome. Not the content. This record must be engagement-scoped and not add a second cross-engagement full-content surface like `activity_log` (P7 §29.2). Retention is a security decision (B-21).

---

## 13. AI epistemic / provenance model

### 13.1 Distinctions to preserve

| Category                        | Where it lives today                                              | 7B treatment                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fact                            | Governed records, versions                                        | Unchanged                                                                                                                                                                                                                                                     |
| Deterministic condition         | `edge_items` (computed), `recorded`/`derived`/`worth_considering` | Unchanged                                                                                                                                                                                                                                                     |
| Evidence                        | `evidence_sources` + links with stance                            | Unchanged; AI never creates evidence (§21.2)                                                                                                                                                                                                                  |
| AI inference                    | —                                                                 | New: `suggested` status, producer `model`                                                                                                                                                                                                                     |
| AI interpretation (explanation) | —                                                                 | Ephemeral by default; if kept, an inference of kind `explanation`                                                                                                                                                                                             |
| AI recommendation               | —                                                                 | **Not a separate epistemic status.** "Recommendation" is already an element kind with governed meaning; AI output that suggests action is an inference whose "resolving act" names governed operations (P7 §9.2: "worth considering is not a Recommendation") |
| Human judgment                  | `edge_judgments`, dismissals                                      | Extended to inferences                                                                                                                                                                                                                                        |
| Approved Architecture           | Published versions, approvals, baselines                          | Unchanged; AI-drafted content still enters only via `ai_analysis` + review gate                                                                                                                                                                               |

### 13.2 Does AI output need a first-class record?

**Yes, for persisted inference.** Reasons: an inference cannot be recomputed (model, prompt and context change), so its content and basis must be stored at generation time (P7 §10 `:401`); it needs judgments and staleness; it must be engagement-scoped and internal (P7 §17).

**Recommended shape** (conceptual; not a schema):

- identity: id, engagement, inference kind, subject reference(s) (typed, like Edge subjects), created at;
- content: assertion (short), basis summary (not chain-of-thought), structured payload per kind (§14);
- basis: record references **with version ids**, and the rule keys / Edge item fingerprints it interprets;
- epistemic status: `suggested`; producer: `model`;
- provenance: provider, resolved model id, prompt id and version, generation-policy version, tool contract version, requesting user (if user-initiated), trigger (user request vs later proactive);
- lifecycle: current / stale (computed from basis versions) / superseded (by a newer inference of the same kind on the same subject);
- judgments: through the same append-only mechanism as Edge items.

**What it must never be** (P7 §17): an element, a statement, a Project Intelligence record, a provenance value, or anything a client reads.

### 13.3 Persist vs ephemeral (P7-Q3 applied)

| Output                                    | Default       | Persist when                                                         |
| ----------------------------------------- | ------------- | -------------------------------------------------------------------- |
| "Explain this item/record"                | Ephemeral     | User chooses "Keep"                                                  |
| "Ask about this" answer                   | Ephemeral     | User chooses "Keep" (becomes an inference with its cited basis)      |
| Requested analysis of a closed kind (§14) | Persisted     | Always, because it is intentionally requested and enters a lifecycle |
| Proactive inference (system-initiated)    | **Not in 7B** | Would require background processing (§28, B-25)                      |

**Not stored** (P7 §18): raw prompts containing client content beyond audit needs; model-private reasoning; full context payloads. Encrypted reasoning items returned under `store:false` (§19.1) are not retained.

### 13.4 What can be promoted, and how

- Only through existing governed operations and the closed promotion-target vocabulary (ADR-0056): Risk, Decision, Review, proposed Acceptance Criterion. No new target is needed for 7B.
- **Provenance of the promoted record follows P7-Q18**: if the architect states it in their own words, `architect_judgment` with a link to the inference; if AI-drafted text is kept, `ai_analysis` with `pending` review under the existing gate. No new provenance value (B-5).
- The inference records that it was promoted and to what, like Edge items.

### 13.5 What requires human review and what can never become Architecture directly

- Every AI-drafted sentence entering an element or statement: `ai_analysis`, `pending`, accepted only by `review_ai_content` (`publish_architecture`). Already enforced by the database.
- Never directly: publication, approval, baseline, validation, agreement of a criterion, domain maturity, criticality, stewardship, escalation, judgment on behalf of a person.

### 13.6 Vocabulary decisions surfaced

- Adding `suggested` to Edge epistemic statuses: anticipated by ADR-0051; text + check, reversible by migration (B-12).
- Adding `model` as a producer value: same (B-12).
- **Not** adding a `provenance_type` value: recommended (B-5). Adding one would be permanent (ADR-0009).
- Whether to begin writing `ip_classification = generated_analysis` on anything: recommended not in 7B (B-6).

---

## 14. Structured-output analysis

**Recommendation.** Persisted inference must be structured; ephemeral explanation may be prose with structured citations.

### 14.1 A minimal common envelope

Every persisted inference (all kinds):

- `assertion` (one or two sentences);
- `subjects` (typed references);
- `basis` (typed references with version ids; rule keys; Edge fingerprints);
- `citations` (which basis entry supports which part of the assertion);
- `uncertainty` (coarse and qualitative: what is not known or not recorded; **no numeric probability**, P7 §9.2);
- `examination` (what a person would look at to judge it, expressed as governed acts: "examine STM-002's rationale", "record a Decision");
- provenance (filled by the gateway, never by the model).

"Significance" is deliberately **not** a field. The model may say _why_ something may matter; it may not rate _how much_ (P7-Q9, Q22).

### 14.2 Candidate inference kinds (closed, small)

Illustrative; the exact set is a proposal decision (B-15).

| Kind                  | Question it answers                                                                           | Deterministic anchor                                                   | Why AI                                                  |
| --------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `explanation`         | Why does this condition/trace/change matter here?                                             | An Edge item, trace or revision                                        | Connects rule semantics to the element's own statements |
| `tension`             | Do two governed statements appear to conflict?                                                | A typed relationship or impact path between them                       | Meaning in text                                         |
| `evidence_bearing`    | Does this evidence appear to support or challenge this statement, beyond its recorded stance? | An evidence link or shared subject                                     | Meaning in text; never changes the recorded stance      |
| `review_brief`        | What should a reviewer examine, given captures and changes?                                   | Examined versions, revisions since, open conditions, criteria in force | Synthesis across records                                |
| `realization_reading` | Do implementation records read as diverging from implemented intent?                          | `implements`, checkpoints, criteria in force                           | Meaning in text                                         |
| `link_suggestion`     | Is a relationship or evidence link apparently missing?                                        | `relationship_rules` constrain allowed types                           | Proposal only; creates nothing                          |

### 14.3 What would prematurely constrain later intelligence

- Encoding inference kinds, statuses or producers as Postgres enums. Use text with check constraints, as 7A did (ADR-0051 "No enums").
- A generic "AI finding" with free-form category, which would become an ungoverned dumping ground.
- Schema fields for external sources, entities or monitoring interests (§16–18) before those are designed.
- A confidence number, which invites ranking.

---

## 15. Development Edge integration

### 15.1 One Edge, labelled origins

The cleanest model [inference] is **one Development Edge** in which every item says _what produced it and with what authority_, rather than three products:

| Origin           | Producer                        | Epistemic status                             | Stored?               | Order                                                                                                                             |
| ---------------- | ------------------------------- | -------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic    | `rule`                          | `recorded` / `derived` / `worth_considering` | Computed              | Tiers and lexicographic keys (ADR-0058)                                                                                           |
| Interpretive     | `model`                         | `suggested`                                  | Persisted inference   | **Never in tiers.** Shown in its own section, ordered deterministically (for example by the subject's governance date, then time) |
| External (later) | `model` over an external source | `suggested` (with source provenance)         | Persisted observation | Same as interpretive                                                                                                              |

The brief's "Deterministic / Interpretive / External Edge" names are useful as _labels on items and filters_, not as separate pages. A user must always be able to answer "why am I seeing this, and on what authority" from the item itself (P7 §9.2: exactly one epistemic status).

### 15.2 Reconciling "items are computed, never stored"

ADR-0051 says Edge items are computed. Inferences are stored. Recommended resolution: inferences live in their own table; `edge_items` (or a sibling read) _projects_ current, non-stale inferences into the same envelope shape with `producer = model`, `epistemic_status = suggested`, their stored basis and a fingerprint derived from their basis versions. The deterministic rules' semantics are untouched. This needs an ADR amendment to 0051 (B-14).

### 15.3 Non-contamination rules

1. AI never creates, suppresses, re-tiers or reorders a deterministic item.
2. An inference _about_ a deterministic item is shown attached to it ("Interpretation available"), never merged into its text.
3. Judging an inference never judges the deterministic item it explains, and vice versa.
4. Whole-event judgment (ADR-0056) never includes inferences unless the user explicitly selects them.
5. The briefing ("Since you last reviewed", ADR-0057) lists governed changes only; new inferences may be counted separately, never mixed with changes.
6. Stale inferences leave the default view but remain queryable (P7 §16 "against a graveyard").

---

## 16. Development Environment Intelligence analysis

**Working definition (from the brief).** "Development Environment Intelligence continuously monitors authorized external information and identifies developments that may support, challenge, expose, create opportunity for, or otherwise bear on a client's Living Development Model."

### 16.1 Assessment

**It is the most distinctive capability in the brief, and it does not belong in 7B.**

- **Distinctive** [inference]: the relationship "external environment ↔ governed architecture" is exactly what generic news feeds, CI tools and chat assistants lack, because they have no governed model to map onto. It passes the Claude Test _if_ mapping and judgment are governed (§9.2).
- **Not 7B** because it adds, all at once:
  1. an **inbound** data flow (external content entering an engagement), which no decision authorises (Spec §31 "research support" is unresolved, §4 S2);
  2. **source provenance and reliability** (who published, when, retrieved how, licence, reliability class);
  3. **entity resolution** (is this "Harbor Group" the competitor recorded in KNW-004?), the classic source of confident hallucination;
  4. **continuous/background processing**, scheduling and cost exposure (§28);
  5. **outbound query leakage**: web queries are generated from context, so confidential strategy can leak into search queries (§19.4 [inference]);
  6. **notification pressure**, the first thing users will ask for once monitoring exists (P7-Q24 says no).
- 7B's inference envelope, judgment lifecycle and Tool Contract are prerequisites. Building external intelligence before they are proven would put unproven machinery under the highest-risk input.

### 16.2 The governance rule, examined

The brief's flow:

> External source → relevance assessment → architecture mapping → Development Edge → human examination → Evidence / Project Intelligence when appropriate → architectural judgment → possible Architecture revision

**It is correct, with three refinements** [inference]:

1. **Capture before assessment.** A retrieved external item must first be recorded as an immutable **external observation** (source, URL, retrieved at, publisher, content hash, licence/reliability class) _before_ any AI reads it for relevance. Otherwise the basis of the relevance judgment cannot be reproduced.
2. **Evidence is a human act.** An external observation becomes Evidence only when a person creates an `evidence_sources` row (type `web` or `publication`) through the existing operation and links it with a stance. AI may _suggest_ the stance; the person records it. This keeps ADR-0015's chain honest.
3. **Project Intelligence is a promotion.** Opportunity, Risk, Decision or Review arise from an observation only through the governed promotion path (ADR-0056), as for any Edge item.

### 16.3 "Validation" must not be reused

"Validation" has a governed meaning: `validates` written only by `record_review_validation` (ADR-0035/0036), and `validation_status` on assumptions. External information may _support_ or _challenge_; it never validates or invalidates. Recommended vocabulary for later: "appears to support", "appears to challenge", "context change", "may create an opportunity", "may expose", "competitive movement", "requires examination". These should be text with check constraints when designed, not enums (§14.3).

### 16.4 What 7B should do now for it

Only leave room, as 7A did for 7B:

- the inference envelope can later accept an inference whose basis includes an external observation reference;
- producer vocabulary is text, so an external producer could be added;
- nothing about monitoring interests, entities, sources or schedules is created.

---

## 17. Architecture-derived monitoring analysis

**Idea.** The Living Development Model itself determines what is worth watching: the architecture becomes the intelligence specification.

**Assessment** [inference]. This is the right principle and the correct answer to "not a generic news feed". The repository already contains the raw material:

- Knowledge objects such as `regulatory_factor`, `competitive_factor`, `stakeholder`, `knowledge_area`, `system_boundary`;
- Project Intelligence with `external` dependencies, `regulatory`/`political`/`financial` constraints, opportunities, risks with status;
- intended outcomes, metrics with targets, governance bodies.

A **monitoring interest** could be derived from these with a fixed rule (for example each published `competitive_factor` and each `external` dependency proposes an interest) and **confirmed by a person** before anything is watched. Deriving interests deterministically, then letting AI draft search terms for human approval, keeps the architecture as the specification and the human as the authority.

**Risks:**

- Interest explosion: every element becomes a feed. Mitigation: interests only from specific kinds, confirmed individually, with explicit expiry.
- Query leakage: search terms derived from confidential architecture reveal strategy (for example a planned acquisition target). Mitigation: interests are reviewed as _outbound disclosures_; confidential elements excluded by default.
- Sector drift: examples in the brief (zoning, journals, labour markets) are domain vocabulary. The interest model must stay sector-neutral (§7).

**Placement.** Later, with Development Environment Intelligence. 7B builds none of it (B-18).

---

## 18. Competitive-intelligence analysis

**Framing.** The value is not "Competitor X announced something" but "Competitor X's development appears to bear on STM-004, CAP-011 and OPP-003, for these reasons".

| Question                                      | Recommendation (for the later phase)                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How are competitors represented?              | Already representable as `competitive_factor` objects (Knowledge domain) and `positioned_against` / `differentiation_logic` relationships. No new "entity" table should be created until a real need is shown |
| Entity resolution in 7B?                      | **No.** It is the highest hallucination risk in the brief                                                                                                                                                     |
| Source reliability                            | Recorded on the external observation as a governed class (primary filing, official statement, reputable press, other), set by a person or a fixed source list, never by the model                             |
| Relevance                                     | Derived from governed links: an observation is relevant to the elements the confirmed monitoring interest came from, plus AI-suggested extensions labelled `suggested`                                        |
| Relation to Evidence and Project Intelligence | As §16.2: observation → (human) evidence with stance → (human) promotion                                                                                                                                      |
| Preventing hallucinated entity matching       | Match only to entities a person has recorded; require the source to name the entity verbatim; show the matched passage; unresolved matches are shown as unmatched, never forced                               |
| Continuous competitive monitoring             | Later than 7B; after Development Environment Intelligence is accepted                                                                                                                                         |

**Ethical boundary.** Competitive intelligence must use lawful, public or licensed sources, respect terms of use, and never profile private individuals. This is a policy decision for the later phase (B-18).

---

## 19. Current OpenAI capability research

All sources accessed **2026-09-30**. Pages under `platform.openai.com/docs` now redirect to `developers.openai.com/api/docs`. "Documented" means stated on the page; "[inference]" is DSA-specific judgment. See §19.12 for gaps.

### 19.1 Reasoning models

- **Documented.** Current flagships: `gpt-6-astra` ("most capable"), `gpt-6.1-sol` ("near-Astra performance … at a lower cost"), `gpt-6-luna` ("most efficient"), each with ~1.05M-token context; `reasoning.effort` ranges `none | minimal | low | medium | high | xhigh | max` with per-model support; reasoning tokens billed as output; with `store:false` or ZDR, reasoning items are returned as `encrypted_content`. GPT-6 model pages show no dated snapshot ids. Launches: Astra 2026-09-03, Sol and Luna 2026-09-22, 6.1 Sol 2026-09-29. (https://developers.openai.com/api/docs/models; …/models/gpt-6-astra; …/guides/reasoning; …/changelog)
- **DSA use:** interpretation over tool results; review briefs.
- **In 7B?** Yes (the model family is an operational choice).
- **Governance:** record the _resolved_ model id from each response; pin per inference kind; re-evaluate on change; do not store encrypted reasoning.
- **Lock-in:** low if model identity is data (P7-Q14).
- **Other providers:** yes; equivalent reasoning models exist.

### 19.2 Tool / function calling

- **Documented.** `{type:"function", name, description, parameters (JSON Schema), strict}`; results returned as `function_call_output`; `tool_choice` `auto | required | none | specific`; custom free-text tools; guidance "fewer than 20 functions available at the start of a turn"; tool search for deferred tool loading on newer models. (https://developers.openai.com/api/docs/guides/function-calling)
- **DSA use:** the DSA Tool Contract (§12).
- **In 7B?** Yes: foundational.
- **Governance:** tools executed server-side as the user; results tagged by data class; the model never receives credentials; tool set ≤ ~15 per inference kind.
- **Lock-in:** low; the contract is JSON Schema.
- **Other providers:** Anthropic documents client tools with `strict: true`, `tool_choice` `auto|any|tool|none`, and `disable_parallel_tool_use` (https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview).

### 19.3 Structured outputs

- **Documented.** Responses API `text.format: {type:"json_schema", strict:true}`; "only Structured Outputs ensure schema adherence"; `additionalProperties:false` and all fields required; refusals "programmatically detectable"; under ZDR the schema itself is cached ("Structured Outputs schema caching" listed as a ZDR consideration). (https://developers.openai.com/api/docs/guides/structured-outputs; …/guides/your-data)
- **DSA use:** the inference envelope (§14).
- **In 7B?** Yes.
- **Governance:** DSA validates again after return; schemas contain no client content (they are cached).
- **Lock-in:** low; Anthropic offers `output_config.format` json_schema with documented limits (max 20 strict tools, 24 optional parameters, 16 union-type parameters; numeric/length constraints unsupported; incompatible with Citations) (https://platform.claude.com/docs/en/build-with-claude/structured-outputs).

### 19.4 Web search

- **Documented.** `web_search` tool (and legacy `web_search_preview`); agentic search actions `search`, `open_page`, `find_in_page`; deep research in background mode; `url_citation` annotations; `sources` list via `include`; **verbatim:** "inline citations must be made clearly visible and clickable in your user interface"; `filters.allowed_domains`/`blocked_domains` up to 100; `external_web_access` live vs cache-only; **verbatim:** "Web Search with live internet access is not HIPAA eligible and is not covered by a BAA"; cache-only mode BAA-eligible only with a ZDR project; preview variants ignore `external_web_access`. (https://developers.openai.com/api/docs/guides/tools-web-search; …/guides/your-data)
- **DSA use:** Development Environment Intelligence and external research (later).
- **In 7B?** **No** (recommended; B-17).
- **Governance (later):** outbound query review; domain allow-lists; capture of every source as an external observation; citations displayed; no confidential terms in queries.
- **Lock-in:** medium (search index and citation shape are provider-specific); normalise citations to DSA's own observation type.
- **Other providers:** Anthropic documents a web search server tool (ZDR-eligible per its retention page).

### 19.5 File search / vector stores

- **Documented.** `file_search` over `vector_store_ids` with `file_citation` annotations; configurable static chunking; storage priced per GB-day beyond 1 GB; `expires_after`; **Files and vector stores retain data "until deleted" and are not ZDR-eligible.** (https://developers.openai.com/api/docs/guides/tools-file-search; …/guides/retrieval; …/guides/your-data)
- **DSA use:** research over uploaded documents.
- **In 7B?** **No.** Provider-hosted retrieval contradicts P7 §20 (engagement-partitioned, RLS-enforced indexes only) and P7-Q20 (no provider-hosted memory or retrieval).
- **Lock-in:** high.
- **Other providers:** Anthropic's Files API is also not ZDR-eligible.

### 19.6 Multimodal inputs

- **Documented.** `input_image` (PNG, JPEG, WEBP, GIF; `detail` levels); `input_file` for PDF (text and page images), DOCX, PPTX, XLSX (first 1,000 rows per sheet), CSV and text, each under 50 MB; GPT-6 models accept text and image input, text output; audio through separate models. (https://developers.openai.com/api/docs/guides/images-vision; …/guides/file-inputs; …/guides/audio)
- **DSA use:** reading evidence files, diagrams, site photographs, workshop boards.
- **In 7B?** **No** (§21); it depends on a file-content read path that does not exist.
- **Lock-in:** low for images/PDF (both providers accept them inline).

### 19.7 Agents and agentic workflows

- **Documented.** Agents SDK (Python/TypeScript) with agents, handoffs, guardrails, sessions, MCP and tracing; SDK supports non-OpenAI models via adapters. **Verbatim:** "Tracing is enabled by default"; traces include LLM and tool inputs and outputs; `trace_include_sensitive_data` defaults to true; **verbatim:** "Tracing is unavailable for organizations that use OpenAI's APIs under a Zero Data Retention (ZDR) policy." The **Agents API** (managed harness) is **beta**; **verbatim:** "currently supports data residency only in the United States and does not support Zero Data Retention (ZDR)." **Agent Builder is deprecated, shutting down 2026-11-30.** (https://developers.openai.com/api/docs/guides/agents; …/guides/agents-api/overview; …/guides/agent-builder; https://openai.github.io/openai-agents-python/tracing/)
- **DSA use:** none needed in 7B; a single request with read-only tool calls is sufficient.
- **In 7B?** **No.**
- **Governance if ever:** tracing disabled or redirected; no hosted agent state.
- **Lock-in:** high for the Agents API; medium for the SDK.

### 19.8 MCP

- **Documented.** Responses API `type:"mcp"` tool with `server_url`, `allowed_tools`, `require_approval`; **verbatim:** "By default, OpenAI will request your approval before any data is shared with a connector or remote MCP server"; **verbatim:** "A malicious server can exfiltrate sensitive data from anything that enters the model's context"; data sent to an MCP server is subject to that server's retention; `connector_id` deprecated for models after 2026-09-01. MCP specification current version 2026-07-28 (Resources, Prompts, Tools; hosts "must obtain explicit user consent before invoking any tool"). (https://developers.openai.com/api/docs/guides/tools-connectors-mcp; https://modelcontextprotocol.io/specification/latest)
- **DSA use:** two distinct possibilities: (a) DSA _consuming_ third-party MCP servers (not wanted: exfiltration risk, third-party retention); (b) DSA _exposing_ its Tool Contract as an MCP server to external AI clients (for example an architect's own Claude or ChatGPT). (b) would let generic AI read governed state; it collapses the boundary §9 depends on and moves permission enforcement to an external host.
- **In 7B?** **No** for both (B-20).
- **Lock-in:** MCP is provider-neutral, which is its appeal; the Tool Contract should be _compatible_ with MCP's tool shape so this remains a later option.

### 19.9 Realtime / voice

- **Documented.** Realtime API GA over WebRTC/WebSocket/SIP with function calling and MCP; GPT-Live and `gpt-realtime-2.1` models. (https://developers.openai.com/api/docs/guides/realtime)
- **In 7B?** No. Low relevance to a structured, version-exact product. Possible later for workshop capture, which would itself be evidence intake (§21).

### 19.10 Conversation state

- **Documented.** **Verbatim:** "Responses are stored by default." Response objects saved 30 days by default; `store:false` disables; the Conversations API keeps items with "no 30 day TTL"; `previous_response_id` chaining bills prior input again; under ZDR `store` is always treated as false. (https://developers.openai.com/api/docs/guides/conversation-state; …/guides/migrate-to-responses; …/guides/your-data)
- **DSA use:** none; DSA keeps its own (ephemeral or persisted) state.
- **Governance:** `store:false` on every call; never use Conversations; "Ask about this" context is rebuilt from the Tool Contract per turn.

### 19.11 Enterprise data controls

- **Documented.** **Verbatim:** "data sent to the OpenAI API is not used to train or improve OpenAI models (unless you explicitly opt in…)"; abuse-monitoring logs kept 30 days by default; **ZDR** by approval, with `/v1/responses` and `/v1/chat/completions` eligible and **`/v1/conversations`, `/v1/files`, `/v1/vector_stores`, `/v1/batches`, `/v1/evals` not eligible**; ZDR limitations include background mode (~10 minutes on disk), live web search, file search, code interpreter, MCP and extended prompt caching; **Modified Abuse Monitoring** excludes customer content from abuse logs; data residency in 10 regions with in-region inference only in the US and EU, region fixed at project creation, EU access requiring ZDR or similar; SOC 2 Type 2, BAA and DPA available. (https://developers.openai.com/api/docs/guides/your-data; https://openai.com/enterprise-privacy/)
- **DSA consequence:** the only architecture consistent with P7-Q20 is Responses (or equivalent) with `store:false`, no hosted state, and a ZDR or Modified Abuse Monitoring agreement in place before client content is sent. That is a contract matter, not code (B-4).

### 19.12 Background, batch, webhooks

- **Documented.** Background mode stores data ~10 minutes even with `store:false`; Batch gives 50% discount with a 24-hour window and is not ZDR-eligible; webhooks signed, retried up to 72 hours. (https://developers.openai.com/api/docs/guides/background; …/guides/batch; …/guides/webhooks)
- **In 7B?** No. Relevant only to later monitoring; Batch's ZDR ineligibility is a constraint on it.

### 19.13 Prompt management

- **Documented.** Reusable prompt objects deprecated (announced 2026-06-03); **`v1/prompts` shuts down 2026-11-30**; OpenAI recommends "code-managed, versioned" prompts passed as `instructions`. (https://developers.openai.com/api/docs/guides/prompting; …/deprecations)
- **DSA consequence:** prompts in the repository, reviewed as code, versioned by id (B-8). This aligns with P7 §30.

### 19.14 Evals, snapshots, deprecation policy

- **Documented.** **Evals deprecated: read-only 2026-10-31, shut down 2026-11-30**; Assistants API shut down 2026-08-26; minimum deprecation notice "at least 6 months" for GA models, 3 months for specialised variants, possibly 2 weeks for previews. (https://developers.openai.com/api/docs/deprecations; …/guides/evals)
- **DSA consequence:** evaluation must be DSA's own: a fixed seed-based set plus the accumulated human judgments on inferences (P7 §30). Never depend on preview models for persisted inference.

### 19.15 Usage and cost controls

- **Documented.** Project-level rate limits and model allow-lists; soft and **hard** spend limits (requests fail at the limit); Costs and Usage APIs. (https://developers.openai.com/api/docs/guides/rate-limits; https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects)
- **DSA consequence:** provider hard limits are a backstop; DSA still needs its own per-engagement budget so one engagement cannot exhaust another's allowance.

### 19.16 Gaps to verify by hand

The fetch tool could not return: Structured Outputs schema limits and refusal shape; the `parallel_tool_calls` default and `allowed_tools`; web-search pricing and the underlying search provider; vector-store limits; whether GPT-6 ids are fixed snapshots or aliases; per-model endpoint tables for Sol and Luna; MCP client features beyond Elicitation. None of these changes the recommendations; several would matter to a proposal.

---

## 20. Provider-independence analysis

**Findings.** OpenAI and Anthropic both document: strict tool calling with JSON Schema; JSON-schema structured outputs; web search tools; document/file citations; no training on API data by default; ZDR-style regimes; and, on both, hosted file storage, batch and MCP connectors fall outside ZDR (§19, Anthropic retention page https://platform.claude.com/docs/en/manage-claude/api-and-data-retention). Parameter shapes differ (`text.format` vs `output_config.format`; different citation objects).

**Recommendation** [inference]:

1. DSA owns: tool definitions (JSON Schema), output schemas, prompt text and versions, retrieval (none in 7B), citations (normalised to DSA basis references), conversation state (none, or DSA-side), evaluation.
2. The adapter owns only: request shaping, schema dialect translation, error mapping, and returning the resolved model id and token usage.
3. Avoid provider-only features in 7B: hosted prompts, conversations, files, vector stores, agents, tracing, evals, deep research, background mode.
4. Keep the Tool Contract MCP-compatible in shape, without exposing it (§19.8).
5. Choose the provider by contract terms (ZDR, residency, DPA) first and capability second. Kerrick's brief names OpenAI; the architecture should not require it (B-3).

---

## 21. Research, file and multimodal analysis

### 21.1 Finding is not promoting

Retrieving or finding information is not the same as promoting it into governed Evidence. Evidence in DSA is a governed record with source type, stance and provenance (ADR-0015). AI may _find_ and _suggest_; a person _records_.

### 21.2 Retrieval options

| Option                                                                  | Fit                                                                                                                                                         |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider-hosted retrieval (vector stores, file search)                  | **Rejected** for DSA: not ZDR-eligible, provider memory, global index filtered in application code (P7 §20, Q20)                                            |
| DSA-owned retrieval with embeddings                                     | Possible later, only engagement-partitioned and RLS-enforced (P7 §29). Needs a text-extraction path, an embedding provider decision and storage. **Not 7B** |
| No retrieval; tools over governed records                               | **7B.** The governed records _are_ the index: elements, statements, evidence metadata, relationships, criteria, captures                                    |
| Direct file input per request (PDF/image sent inline for one inference) | Possible later without an index; still a new file-content read path through `can_read_engagement_file` and data-class checks. **Not 7B** by default (B-16)  |

### 21.3 Multimodal

Photographs, maps, floor plans, workshop boards, charts and transcripts are evidence _intake_ problems first: the governed question is how such material becomes an evidence source with provenance and rights. Nothing in 7B should process media. When it comes, the order should be: file-content read path with checks → per-request inline analysis producing an inference that cites the file → only then any index.

---

## 22. Client-boundary analysis

**Recommendation: no client-facing Phase 7B output of any kind** (P7-Q2, Q12; `CLAUDE.md:29` "do not build … client-facing Architecture Intelligence").

| Surface                                        | 7B                                                                                                                                                                  | Later condition                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Internal architect AI                          | Yes                                                                                                                                                                 | —                                                                                              |
| Client-facing explanations                     | No                                                                                                                                                                  | Only from client-readable published content (client read models), separately approved (P7-Q12) |
| Client-facing external intelligence            | No                                                                                                                                                                  | After external intelligence exists internally and a client policy is approved                  |
| Client AI interaction (chat)                   | No                                                                                                                                                                  | Would need a client Tool Contract over `client_*` read models only                             |
| AI-generated content in published Architecture | Already governed: `ai_analysis`, `pending`, accepted by a publisher before it can be published; clients see only accepted statements (`architecture_core.sql:1269`) | Unchanged                                                                                      |
| AI provenance visible to clients               | Not in 7B                                                                                                                                                           | Decide whether accepted AI-drafted statements should say so in the portal (B-23)               |

**Watch-point** [inference]: AI-drafted text that names methods. ADR-0049 makes naming a method to a client an authored act; the editor warns but does not block `internal_only` names (`src/domain/methodology/approach.ts`). If 7B ever drafts client-visible statements, prompts must not receive `internal_only` method identities.

---

## 23. Security and data-use analysis

### 23.1 Engagement-level authorisation (prerequisite)

P7-Q19(a): a governed per-engagement setting for external AI processing, default **No**, with its contractual basis recorded. Open design points (B-1, B-2):

- who may set it (a capability, never a role name; candidates: `publish_architecture` holder vs Principal Architect via a new capability);
- what it records (who, when, contract reference, data classes authorised, provider/region authorised);
- whether it is versioned (append-only history, like rights records in ADR-0048), which is recommended;
- what revoking does (stops future processing; cannot recall what was sent: "the setting is reversible; processing done under it is not", P7 `:1477`).

### 23.2 Data classes

Recommended default eligibility when an engagement is authorised [inference]:

| Class                                      | Examples                                                                                                                       | Default when authorised                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Published architecture (internal snapshot) | Published elements, statements, relationships                                                                                  | Eligible                                                                          |
| Working copies (unpublished)               | Draft elements and statements                                                                                                  | Eligible for internal inference only; decision (B-2)                              |
| Project Intelligence                       | Assumptions, risks, decisions, rationale                                                                                       | Eligible                                                                          |
| Evidence metadata                          | Title, type, stance, citation, abstract                                                                                        | Eligible                                                                          |
| Evidence and file contents                 | Uploaded documents                                                                                                             | **Not in 7B**                                                                     |
| Client contributions and responses         | Client-authored text                                                                                                           | Separate flag; default excluded (client-authored content has its own sensitivity) |
| Method/IP                                  | Method Assets, lineage, Method Applications, stage notes, Development Contexts                                                 | **Excluded**; separate TPLCo authorisation (§24, B-19)                            |
| Licensed or client-owned sources           | `ip_classification` `licensed_third_party_source`, `client_owned_source_material`; method origin `licensed_in`, `client_owned` | **Excluded** unless rights allow (P7 §29)                                         |
| Financial                                  | Contracts, invoices, payments                                                                                                  | **Never** (ADR-0023 one-way; no purpose)                                          |
| Activity log, audit                        | `activity_log`                                                                                                                 | **Never**                                                                         |
| Personal data                              | Names of client staff, participants                                                                                            | Minimise: send roles or member references, not names, unless needed (B-2)         |

### 23.3 Training, retention, deletion, logging

- No training on client content (provider default for API; confirm contractually).
- `store:false`; ZDR or Modified Abuse Monitoring before any client content leaves (§19.11).
- DSA-side: persisted inferences follow engagement lifecycle; deleting or archiving an engagement must cover them; retention period for request audit metadata is a decision (B-21).
- No prompts or client content in application logs, error trackers or third-party observability; provider tracing off.

### 23.4 Residency

If a client requires EU (or other) residency, the provider project's region is fixed at creation and in-region inference exists only in the US and EU (§19.11). Residency should be a field on the authorisation, checked by the gateway (B-4).

### 23.5 Cross-engagement learning

P7-Q19(b) (contribution of abstracted, promoted learning to cross-development intelligence) stays **unused** in 7B. No cross-engagement retrieval, caching, prompt examples drawn from engagements, or fine-tuning (P7 §23).

### 23.6 Not surveillance

AI request audit records are security records. They must not become usage metrics, per-person activity counts or productivity signals (ADR-0057). No view tracking; no "most active user"; no AI-usage leaderboard.

---

## 24. Method / IP boundary

| Question                                                      | Recommendation                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| May AI reason over Method Assets and Applications internally? | Only with a model that does not leave DSA's trust boundary, which 7B does not have. With an external provider, see below                                                                                                                      |
| May they be sent to external providers?                       | **Not by default** (P7 §29 "default to not sending"). Requires a separate TPLCo-level authorisation distinct from the engagement setting, because the IP belongs to TPLCo (or to licensors and clients under ADR-0048), not to the engagement |
| Separate Method/IP control?                                   | **Yes** (B-19). Engagement authorisation must never implicitly authorise Method content                                                                                                                                                       |
| May AI recommend Methods?                                     | **No in 7B.** ADR-0050 already excludes "method recommendation or automatic method selection"; Development Contexts "drive no behavior"                                                                                                       |
| Automated Method selection                                    | Premature; would need outcome attribution the practice rejects (ADR-0043, ADR-0059)                                                                                                                                                           |
| Citing methodology provenance                                 | Internally, an inference may cite a lineage reference (`instantiates` Model version) as basis **by id**, without sending the Method's content; client-visible text never names `internal_only` methods (ADR-0049)                             |
| Stage notes and addenda                                       | Engagement data written in practice records (P7 §21 `:1020`); never aggregated across engagements; excluded with the Method class                                                                                                             |

---

## 25. Cross-engagement boundary

**Recommendation: no cross-engagement AI in 7B** (P7-Q10, Q19(b), Q20; ADR-0059).

| Candidate                                                             | 7B? | Why                                                                                               |
| --------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------- |
| Retrieval across engagements                                          | No  | P7 §20: engagement-partitioned only; `can_read_architecture` is per engagement                    |
| Prompt examples drawn from other engagements                          | No  | Silent cross-engagement leakage through the prompt                                                |
| Caching responses across engagements                                  | No  | Same                                                                                              |
| Fine-tuning on engagement content                                     | No  | P7-Q19(b) unused; provider training off                                                           |
| Recurrence detection ("this risk appears in 4 engagements")           | No  | P7-Q10; recurrence is portfolio intelligence                                                      |
| Using `method_practice_counts` (already cross-engagement) as AI input | No  | It is TPLCo practice data, internal and aggregate; sending it externally is a Method/IP act (§24) |

**What 7B can do that helps later, without crossing the boundary** [inference]: per-engagement judgments on inferences (agree, disagree/contest, not material, promoted) accumulate as governed, engagement-scoped records. When a future phase designs cross-engagement learning, it will have human-judged material to _propose_ abstracting, under P7-Q19(b) consent and a Principal-level review. 7B builds nothing that reads them across engagements.

---

## 26. Pattern Library boundary

**Recommendation: no Pattern Library functionality in 7B** (ADR-0050; P7-Q23; `CLAUDE.md:29`).

- No pattern mining, pattern suggestion, pattern candidate records, or "this looks like pattern X".
- The inference record should not contain a field that anticipates patterns (for example `pattern_ref`); adding one later is cheap, removing one is not.
- The relationship of 7B to the future Pattern Library is only this: human-judged, promoted inferences are one possible _source_ of candidate patterns, reviewed by people, with provenance to engagement records and consent (§25). That is a later design.

---

## 27. UX implications

### 27.1 Principles

- AI output is always visibly _interpretation_: labelled "Suggested", attributed to "Architecture Intelligence" (or the chosen name, B-29) with the inference kind, basis links and "as of" version, and never styled like a governed fact.
- Deterministic facts stay first; AI never precedes the facts it interprets on a page.
- No numeric confidence, no scores, no ranking, no severity colour on AI items (P7-Q9, Q22).
- Stale inferences say so and are not silently refreshed.
- One primary action per AI item: examine the basis. Then judge (agree, contest, not material) or promote through the existing forms.
- Calm and institutional: no typing animation, no avatar, no chat bubbles as the main surface.

### 27.2 Surfaces

| Surface                       | 7B.1                                                                      | 7B.2                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Element page                  | —                                                                         | "Explain this element's position" (ephemeral); persisted inferences about the element in a separate panel under the deterministic Edge panel |
| Development Edge (engagement) | —                                                                         | Suggested items with an origin filter (rule / model); excluded from tiers (§15)                                                              |
| Change view                   | —                                                                         | "Explain this change" (ephemeral) using `element_revisions` diff                                                                             |
| Review workspace              | —                                                                         | Review brief (persisted kind), cited to review scope elements                                                                                |
| Implementation                | —                                                                         | Realization reading (persisted kind), cited to trace and metrics                                                                             |
| Engagement settings           | External AI processing setting and history (B-1)                          | —                                                                                                                                            |
| Practice settings             | Prompt registry view (read-only, from the repository); evaluation results | —                                                                                                                                            |
| Global navigation             | —                                                                         | No global AI entry point in 7B; AI is contextual                                                                                             |
| Client portal                 | Nothing                                                                   | Nothing                                                                                                                                      |

### 27.3 Command bar

A command bar is useful and mostly **not AI**. Recommended separation:

| Kind                | Example                                                  | Authority                                                  |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Navigation          | "Go to CAP-011", "Open Review REV-002"                   | Plain search over records the user can read                |
| Deterministic query | "Show edge items for STM-004", "Trace impact of KNW-003" | Existing reads, exact results                              |
| AI request          | "Explain why CAP-011 is on the Edge"                     | Gateway; labelled output; ephemeral unless kept            |
| Governed action     | "Promote this to a Risk", "Record judgment"              | Opens the existing governed form; never executes from text |

Free text is never parsed into a governed action. A navigation/deterministic command bar can ship before or without AI, and belongs to general UX work rather than 7B (B-29 covers naming only).

### 27.4 IDE principles and their tensions

| IDE principle                 | DSA equivalent                            | Tension                                                                    |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| Continuous diagnostics        | Development Edge (deterministic, on read) | Continuous AI diagnostics need background processing (§28)                 |
| Go to definition / references | Element page, relationships, trace        | None                                                                       |
| Refactor with preview         | Governed promotion with a form            | AI must never apply changes                                                |
| Linting                       | Integrity rules                           | AI "lint" risks becoming ranking; keep AI output as items without severity |
| Copilot                       | "Ask about this"                          | Chat drift toward a general assistant (§10)                                |
| Test runner                   | Acceptance criteria, reviews              | AI must not "pass" or "validate"                                           |

---

## 28. Notification and continuous-awareness analysis

**Recommendation: no notifications, no background AI, no continuous processing in 7B** (P7-Q24; ADR-0057).

- Every 7B inference is user-initiated, synchronous, one engagement.
- Awareness is _pull_: the Edge and element pages show current items when opened. That is already an IDE-like "diagnostics on open" experience without push.
- When continuous processing is considered (with DEI), its model should be: scheduled, engagement-authorised, budgeted, producing Edge items only; never pushing to people; no digest, badge, streak, count of unread items, "you haven't looked at…", or per-person activity measure. If notifications are ever introduced, they should be opt-in per person, limited to explicit subscriptions on specific records, and designed as a separate decision (B-27).
- No gamification. No employee surveillance. No attention-maximisation mechanics.

---

## 29. Candidate Phase 7B scope

The smallest coherent 7B that proves the thesis (§1) [inference]:

### 7B.1 — Governed AI foundation (no user-visible AI output yet, except in evaluation)

1. External AI processing authorisation per engagement (P7-Q19(a)), versioned, default No (B-1), with data classes (B-2).
2. AI-use capability (B-10).
3. Intelligence Gateway: one provider adapter, `store:false`, no hosted state, per-engagement budget, audit metadata (B-3, B-11, B-21).
4. Read-only Tool Contract over existing reads, excluding Method/IP, financial, activity log and file contents (§12, B-20).
5. Repository prompt registry with versions (B-8).
6. Inference record, provenance and staleness model (B-7, B-12, B-15); no new `provenance_type` value (B-5).
7. Self-hosted evaluation harness over seed engagements; prompt-injection test set (§32).
8. Contractual prerequisite: ZDR or equivalent in place before any real client engagement is authorised (B-4). Seed data may be used for evaluation without it.

### 7B.2 — Architecture Intelligence (internal, user-initiated)

1. Ephemeral "Explain" on element, Edge item and change.
2. A closed, small set of persisted inference kinds (B-15), each with a structured output schema.
3. `suggested` inferences projected into the Edge, excluded from tiers (B-14).
4. Judgments on inferences using the existing append-only mechanism, with `contest` (B-13).
5. Promotion via existing governed operations only (B-31).
6. Optionally "Ask about this", scoped to one engagement and read-only tools; ephemeral unless kept (B-7).

Each step should be proposed, reviewed and browser-accepted separately, as in prior phases.

---

## 30. Explicit out of scope for Phase 7B

- Development Environment Intelligence, external monitoring, monitoring interests, external observations, web search, deep research (B-17, B-18).
- Competitive intelligence and entity resolution (B-18).
- File-content reading, multimodal, embeddings, vector stores, provider retrieval (B-16).
- Background, scheduled or continuous AI; batch; webhooks (B-25).
- Notifications of any kind (B-27).
- Client-facing AI of any kind (B-22).
- Method/IP content sent to providers; method recommendation; Development Context steering (B-19, B-24, B-26).
- Cross-engagement learning, recurrence, fine-tuning; Pattern Library; Portfolio Intelligence (B-28).
- AI writes of any kind: AI never creates, edits, publishes, validates, agrees criteria, records judgments or promotes.
- AI scoring, ranking, severity, numeric confidence, maturity suggestions.
- MCP server exposure or MCP client consumption (B-20).
- Provider-hosted prompts, conversations, agents, tracing, evals.
- New `provenance_type` values (B-5).
- Productivity or usage analytics of AI use.

---

## 31. Relationship to later phases

| Later capability                        | Depends on from 7B                                           | Additional decisions needed                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development Environment Intelligence    | Inference record, Gateway, Tool Contract, judgments, contest | Inbound data policy, external observation record, source provenance and reliability, monitoring interests, outbound query review, background processing |
| Competitive intelligence                | DEI                                                          | Entity model, entity resolution, lawful-source policy                                                                                                   |
| Research and file intelligence          | Gateway, data classes                                        | File-content read path, DSA-owned retrieval, embedding provider                                                                                         |
| Client-facing Architecture Intelligence | Inference kinds, evaluation history                          | Client Tool Contract over `client_*` read models, client disclosure of AI provenance (B-23)                                                             |
| Pattern Library                         | Promoted, human-judged inferences                            | P7-Q23 workstream, consent (P7-Q19(b))                                                                                                                  |
| Portfolio Intelligence                  | Pattern Library                                              | P7-Q10 reversal, TPLCo authority                                                                                                                        |
| Method intelligence                     | Method/IP authorisation                                      | ADR-0050 revision; no automated selection                                                                                                               |
| Notifications                           | Continuous processing                                        | Separate notification design (B-27)                                                                                                                     |

---

## 32. Risks and failure modes

| Risk                                   | Where it enters                                                                          | Mitigation                                                                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI read as authority                   | Styling, wording, placement                                                              | Always labelled Suggested; never in tiers; no scores; facts first (§27)                                                                                                                      |
| Prompt injection from record text      | Client contributions, evidence citations, statements, change summaries read by the model | Tool results treated as data in the prompt; no tool with write power exists; output validated against schemas; basis ids verified to exist and be readable; injection test set in evaluation |
| Hallucinated basis                     | Model cites ids that do not exist or were not returned                                   | Gateway rejects any inference citing an id not returned by a tool call in that request                                                                                                       |
| Hallucinated relationships or entities | Link suggestions, entity matching                                                        | Suggestions only; typed relationships from the vocabulary only; no entity resolution in 7B                                                                                                   |
| Silent staleness                       | Architecture changes after an inference                                                  | Basis version ids and fingerprint; stale marked, never refreshed silently                                                                                                                    |
| Data leakage to provider               | Context assembly                                                                         | Engagement setting, data classes, minimisation, `store:false`, ZDR, no Method/IP, no finance, no activity log                                                                                |
| Leakage across engagements             | Caching, examples, retrieval                                                             | None exist in 7B                                                                                                                                                                             |
| Provider change or deprecation         | Model retirement, API shutdowns (§19.14)                                                 | Model identity is data; resolved id recorded; evaluation rerun on change; no provider-only features                                                                                          |
| Cost overrun                           | Long context, reasoning tokens                                                           | Per-engagement budget in DSA plus provider hard limit                                                                                                                                        |
| Chatbot drift                          | "Ask about this"                                                                         | Scoped to one engagement, read-only tools, ephemeral; no global chat                                                                                                                         |
| Surveillance drift                     | Audit records reused as metrics                                                          | Audit is security-only; no per-person analytics (ADR-0057)                                                                                                                                   |
| Vocabulary erosion                     | AI produces generic PM language                                                          | Prompts use the Method vocabulary; outputs mapped to typed relationships and kinds                                                                                                           |
| Over-trust in evaluation               | Small seed set                                                                           | Evaluation is a gate, not proof; human judgments on real use are the ongoing evidence                                                                                                        |
| Unreproducible outputs                 | Non-deterministic models                                                                 | Persist output with prompt version, resolved model and basis versions; never expect regeneration to match                                                                                    |
| "Validated by AI" language             | Copy, prompts                                                                            | Banned vocabulary in prompts and schemas; review copy                                                                                                                                        |

---

## 33. Difficult-to-reverse decisions

| Decision                                         | Why hard to reverse                                                                        | Question      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------- |
| Adding a `provenance_type` value                 | Enum additions are permanent in Postgres practice; history cannot be relabelled (ADR-0009) | B-5           |
| Writing `generated_analysis` on records          | Classification becomes part of historical records                                          | B-6           |
| Inference record shape and persistence           | Persisted inferences become history judgments point at                                     | B-7, B-31     |
| Adding a practice or engagement capability value | Enum addition                                                                              | B-9, B-10     |
| Sending any engagement content to a provider     | Cannot be recalled (P7 `:1477`)                                                            | B-1, B-2, B-4 |
| Sending Method/IP content                        | Cannot be recalled; IP exposure                                                            | B-19          |
| Provider contract and residency                  | Region fixed at project creation (§19.11)                                                  | B-4           |
| Exposing an MCP server                           | External clients integrate against it                                                      | B-20          |
| Client visibility of AI                          | Once shown to clients, expectations and contracts follow                                   | B-22, B-23    |
| Background processing and notifications          | Behaviour people come to rely on; attention mechanics hard to withdraw                     | B-25, B-27    |
| Cross-engagement learning                        | Abstracted learning cannot be un-learned                                                   | B-28          |
| Product naming                                   | Public vocabulary                                                                          | B-29          |

Reversible by migration or code: `suggested`/`model` text values (B-12), judgment kind `contest` (B-13), Edge projection (B-14), inference kinds (B-15), prompt storage (B-8), adapter choice (B-3, B-11).

---

## 34. Open questions requiring approval

Each question gives a recommendation, the alternatives, the consequences, reversibility and why it matters.

**B-1. Engagement authorisation for external AI processing.** How is P7-Q19(a) represented, and who may set it?

- _Recommendation:_ a versioned, append-only per-engagement record (default No) holding who, when, contract reference, authorised data classes and authorised provider/region; set by holders of a capability (B-10), not a role name.
- _Alternatives:_ a boolean on `engagements`; a TPLCo-wide switch.
- _Consequences:_ history shows exactly what was authorised when; the gateway can enforce it.
- _Reversibility:_ setting reversible; processing done under it is not.
- _Why it matters:_ it is the only gate between client content and a third party.

**B-2. Eligible data classes.** Which classes (§23.2) may be sent once an engagement is authorised?

- _Recommendation:_ published architecture, working copies, Project Intelligence and evidence metadata; client-authored contributions only with a separate flag; personal names minimised; file contents, Method/IP, licensed sources, financial and activity log excluded.
- _Alternatives:_ published-only; everything readable by the user.
- _Consequences:_ working-copy inclusion makes AI useful during drafting but sends unpublished strategy.
- _Reversibility:_ policy reversible; past transfers not.
- _Why it matters:_ defines what "context-minimised" (P7-Q20) means in practice.

**B-3. Provider abstraction and first provider.** Build one adapter, and which provider first?

- _Recommendation:_ the minimal adapter of P7-Q14 with DSA owning tools, schemas, prompts, state and evaluation; choose the first provider by contract terms (ZDR, DPA, residency). OpenAI is viable with `store:false` and ZDR; no OpenAI-only features.
- _Alternatives:_ OpenAI-specific integration (Agents SDK, hosted prompts); a multi-provider router from the start.
- _Consequences:_ slightly more code than direct use; provider switch stays a configuration and evaluation exercise.
- _Reversibility:_ reversible.
- _Why it matters:_ OpenAI is retiring prompts, evals and Agent Builder on 2026-11-30 (§19.13–19.14); coupling would already be costly.

**B-4. Contractual prerequisites.** Is ZDR (or Modified Abuse Monitoring) and a DPA required before any real engagement is authorised?

- _Recommendation:_ yes; seed engagements may be used before that for evaluation. Residency, if required by a client, recorded on the authorisation.
- _Alternatives:_ standard API terms (30-day abuse logs).
- _Consequences:_ possible delay while approval is obtained; EU residency requires ZDR or similar.
- _Reversibility:_ region is fixed at provider project creation.
- _Why it matters:_ the confidentiality commitment to clients.

**B-5. AI provenance vocabulary.** Add a `provenance_type` value for inferences?

- _Recommendation:_ no. Inferences carry their own producer and kind in their own record; AI-drafted content entering architecture uses existing `ai_analysis` with review (P7-Q18).
- _Alternatives:_ add `ai_inference` or similar.
- _Consequences:_ the eight-value vocabulary stays intact.
- _Reversibility:_ adding is permanent (ADR-0009).
- _Why it matters:_ provenance is the audit trail of the Architecture.

**B-6. `generated_analysis` classification.** Start writing `ip_classification = generated_analysis`?

- _Recommendation:_ not in 7B; revisit if AI-drafted artefacts become files or deliverables.
- _Alternatives:_ tag every persisted inference.
- _Consequences:_ none now.
- _Reversibility:_ classification becomes part of historical records.
- _Why it matters:_ it bears on IP ownership claims.

**B-7. First-class AI record and persistence.** Is there one inference table, and what persists?

- _Recommendation:_ one engagement-scoped, append-only inference table; explanations and "Ask" answers ephemeral unless kept; requested closed-kind analyses persisted.
- _Alternatives:_ everything ephemeral; storing inferences inside `edge_items`-like computed views; storing every exchange.
- _Consequences:_ judgments and promotions can point at persisted inferences; ephemeral use leaves only audit metadata.
- _Reversibility:_ persisted records become history.
- _Why it matters:_ P7-Q3 ephemeral default must hold while allowing governed follow-through.

**B-8. Prompt storage and versioning.** Where do prompts live?

- _Recommendation:_ in the repository, versioned by id, reviewed through PRs; the inference records prompt id and version. No provider-hosted prompts; no prompt storage in the Method Library (resolves Spec §14 vs ADR-0050 D26).
- _Alternatives:_ database-stored prompts editable in the product; provider prompt objects (shutting down).
- _Consequences:_ prompt changes need a code release.
- _Reversibility:_ reversible.
- _Why it matters:_ prompts encode the Method's reasoning and are TPLCo IP.

**B-9. Practice authority for prompt governance.** Does prompt approval need a new `practice_capability`?

- _Recommendation:_ no in 7B; PR review governs prompts. Revisit only if prompts become editable in the product.
- _Alternatives:_ add `govern_ai_prompts`.
- _Reversibility:_ enum addition is permanent.
- _Why it matters:_ avoids a permanent vocabulary change for a need that does not yet exist.

**B-10. Capability to use AI on an engagement.** Which capability gates AI use?

- _Recommendation:_ reuse `edit_architecture` (already gating judgments) for 7B, plus the engagement authorisation; revisit a dedicated capability if a need appears.
- _Alternatives:_ a new `use_architecture_intelligence` capability; `can_read_architecture` (too broad: includes Finance and Project Administrators).
- _Consequences:_ read-only internal roles cannot use AI.
- _Reversibility:_ reuse is reversible; a new value is permanent.
- _Why it matters:_ least privilege over a data-transfer action.

**B-11. Provider and model identity storage; switching.** How is model identity recorded?

- _Recommendation:_ text fields for provider and the _resolved_ model id returned by the response, plus configured model; no enums; a switch requires rerunning the evaluation set and is recorded.
- _Alternatives:_ enum of models; storing only the configured alias.
- _Consequences:_ inferences remain attributable after models retire.
- _Reversibility:_ reversible.
- _Why it matters:_ GPT-6 pages show no dated snapshots (§19.1).

**B-12. `suggested` and `model` values.** Add `suggested` to Edge epistemic statuses and `model` as producer?

- _Recommendation:_ yes, as anticipated by ADR-0051, text with check constraints.
- _Alternatives:_ a separate AI panel with no Edge presence.
- _Reversibility:_ reversible by migration.
- _Why it matters:_ one Edge with labelled origins is the IDE thesis.

**B-13. Judging inferences.** How do people disagree with an inference?

- _Recommendation:_ reuse append-only `edge_judgments` semantics with an added kind `contest` (the inference is wrong on its basis), distinct from `not_material`.
- _Alternatives:_ reuse `disagree` with a clarified meaning; separate inference judgment table.
- _Reversibility:_ text kind; reversible.
- _Why it matters:_ contested inferences are the evaluation signal.

**B-14. Edge integration.** Amend ADR-0051 so stored inferences are projected into the Edge envelope, excluded from tiers?

- _Recommendation:_ yes.
- _Alternatives:_ separate surface only; include in tiers.
- _Consequences:_ ADR amendment; deterministic semantics untouched.
- _Reversibility:_ reversible.
- _Why it matters:_ tier inclusion would let AI rank (P7-Q9/Q22).

**B-15. Inference kinds and structured-output schemas.** Which closed set?

- _Recommendation:_ start with explanation, tension, evidence_bearing, review_brief, realization_reading; `link_suggestion` only if the evaluation shows it reliable. Common envelope, no significance field, no numeric confidence.
- _Alternatives:_ free-form text; larger set.
- _Reversibility:_ kinds are text; schemas versioned.
- _Why it matters:_ the kinds define what an AI finding can be.

**B-16. File contents.** May 7B read evidence file contents or images?

- _Recommendation:_ no.
- _Alternatives:_ per-request inline PDF/image analysis through `can_read_engagement_file`.
- _Why it matters:_ new read path; licensed and client-owned material; not ZDR-eligible when using provider files.

**B-17. External research in 7B.** Does "research support" (Spec §31) include web search in 7B?

- _Recommendation:_ no; it arrives with DEI.
- _Alternatives:_ cache-only web search for internal users.
- _Consequences:_ 7B stays inward-looking; Spec S2 conflict recorded as deferred.
- _Why it matters:_ inbound external content and outbound query leakage.

**B-18. Development Environment Intelligence, monitoring and competitive intelligence.** 7B or later?

- _Recommendation:_ later, as its own phase, requiring decisions on the external-observation record, source provenance and reliability, monitoring-interest model (derived from architecture, human-confirmed), entity model, lawful-source policy and background processing.
- _Alternatives:_ a thin DEI slice in 7B.2.
- _Why it matters:_ highest value and highest risk; needs 7B's machinery proven first.

**B-19. Method/IP eligibility.** Separate TPLCo authorisation for Method content?

- _Recommendation:_ yes; excluded by default; engagement authorisation never implies it.
- _Alternatives:_ treat as engagement data.
- _Reversibility:_ disclosure is not reversible.
- _Why it matters:_ the Method is TPLCo's core IP.

**B-20. Tool Contract design and MCP.** Read-only, internal, not exposed through MCP?

- _Recommendation:_ yes: read-only tools executed as the user; no write tools; MCP-compatible shape; no MCP server or client in 7B.
- _Alternatives:_ write tools with approval; MCP server for external AI clients.
- _Why it matters:_ write tools or external exposure remove the governance DSA is built on.

**B-21. Audit record.** What is recorded, for how long?

- _Recommendation:_ metadata only (§12.5), engagement-scoped, internal, retained for the engagement's life; never used for per-person analytics.
- _Alternatives:_ storing full prompts and outputs; no audit.
- _Why it matters:_ accountability without surveillance or a second copy of client content.

**B-22. Client visibility.** Any client-facing AI in 7B?

- _Recommendation:_ none.
- _Why it matters:_ PUBLICATION is the client boundary; client AI needs its own Tool Contract over `client_*` models.

**B-23. AI provenance in the client portal.** Should accepted AI-drafted statements disclose AI origin to clients?

- _Recommendation:_ decide before any client-visible AI drafting; for 7B, internal provenance is sufficient because no AI drafting of client-visible statements is proposed.
- _Alternatives:_ always disclose; never disclose.
- _Why it matters:_ client trust and possible contractual or regulatory disclosure duties.

**B-24. Method recommendation.** Confirm no method recommendation or selection.

- _Recommendation:_ confirmed out (ADR-0050).
- _Why it matters:_ automated methodology selection would replace architectural judgment.

**B-25. Background or continuous processing.** Any in 7B?

- _Recommendation:_ none; all inference user-initiated and synchronous.
- _Alternatives:_ nightly refresh of stale inferences.
- _Why it matters:_ cost, data transfer without a person present, and a path toward notifications.

**B-26. Development Context steering AI.** May Development Contexts select prompts?

- _Recommendation:_ no in 7B (ADR-0045 "drive no behavior").
- _Why it matters:_ it would be method selection by another name.

**B-27. Notification model.** Confirm no notifications in 7B, and the principles for later.

- _Recommendation:_ confirmed; later only opt-in per person on explicit records, no digests, badges or counts.
- _Why it matters:_ attention mechanics are hard to withdraw.

**B-28. Cross-engagement learning and Pattern Library.** Confirm none in 7B.

- _Recommendation:_ confirmed; per-engagement judgments accumulate for a future governed design.
- _Why it matters:_ abstraction cannot be undone.

**B-29. Naming.** "DSA Architect", "Architecture Intelligence", or another name?

- _Recommendation:_ "Architecture Intelligence" for the capability; avoid naming the AI as an architect.
- _Alternatives:_ "DSA Architect"; "Interpret".
- _Reversibility:_ public vocabulary is hard to reverse.
- _Why it matters:_ the name sets expectations of authority.

**B-30. Phase 7B boundary.** Approve 7B as two steps (7B.1 foundation, 7B.2 Architecture Intelligence), internal-only, read-only, user-initiated?

- _Recommendation:_ yes, each with its own proposal and browser acceptance.
- _Alternatives:_ one combined phase; 7B.1 only.
- _Why it matters:_ it sets what the next proposal may contain.

**B-31. What an AI finding is and what may be promoted.** Confirm an AI finding is only a persisted inference of an approved kind with a verified basis, and that promotion is only to the existing targets (Risk, Decision, Review, proposed Acceptance Criterion) by a person through existing operations, with provenance following P7-Q18.

- _Recommendation:_ confirmed; no new promotion target; AI never promotes.
- _Alternatives:_ allow promotion to Opportunity or Assumption; allow AI-prefilled forms to submit directly.
- _Reversibility:_ promoted records become governed history.
- _Why it matters:_ it is the point where interpretation turns into architecture.

---

## 35. Recommended next step

1. Kerrick reviews this document and answers B-1 to B-31 (at minimum B-1, B-2, B-3, B-4, B-5, B-7, B-10, B-18, B-19, B-30).
2. In parallel, and outside the repository: confirm the provider contract route (ZDR or equivalent, DPA, residency), since it gates any real engagement.
3. Then, and only on explicit instruction, draft `PHASE_7B_PROPOSAL.md` for **7B.1 only**, reflecting the answers, with ADR drafts for the inference record, the Gateway and Tool Contract, and the ADR-0051 amendment.
4. `CLAUDE.md`'s Phase 7B hold stays in place until the proposal is approved.
