# Phase 6 — Method Library: Proposal

**Revision 2 (2026-09-30):** revised after Kerrick's final review. D10, D11, D13, D20, D28 and D30 changed; D33 and D34 added; §15 and §27 rewritten. All other decisions are approved as written.

**Status:** This is a proposal only. Nothing has been built for Phase 6: no migrations, schema, enum values, ADRs, domain code, seed data or UI. Enum values and table names below are _proposed_. None of them is permanent until Kerrick approves the decisions in §37.

**Governing question:** how does DSA OS govern the disciplined practice by which TPLCo performs architectural work, and how does it record each use of that practice so that both the architecture and the Method can learn?

**Governing direction:** the _Phase 6 Method Library Conceptual Review_ and the _Q1–Q17 Conceptual Decision Reconciliation_, both approved by Kerrick on 2026-09-30. Where this proposal cites a question number (Q1 to Q17), it means Kerrick's decision on it.

**Read against `main` at `dc1bec8`** (Phase 5 merged). The following were reconciled directly:

- `DSA_OS_MASTER_BUILD_SPEC.md`, `CLAUDE.md` and `README.md`;
- ADR-0001 to ADR-0040;
- the Phase 3 to 5 proposals and reports;
- `docs/database/*.md`;
- all 14 migrations;
- `supabase/seed.sql`;
- `src/domain/architecture/*`, the internal navigation, and the element page's Method lineage panel.

## Reading guide

- **§1–§6:** the frame: principles, the conceptual model, scope, conflicts with the spec and ADRs, and vocabulary.
- **§7–§22:** the design, concept by concept. Each major concept ends with a **"Why this"** block answering Kerrick's five questions:
  1. Why it belongs in DSA OS.
  2. Why it belongs in Phase 6.
  3. Why it is not document management.
  4. How it relates to Architecture.
  5. How it preserves provenance for learning.
- **§23–§32:** the build surface: schema, tables, operations, read models, capabilities, RLS, UX, tests and seed data.
- **§33–§40:** worked examples, migration and backfill, ADRs, difficult-to-reverse decisions, **D1–D34 for approval**, build order, risks, and the definition of done.

---

## 1. Principles

1. **Architecture stays the center.** Methodology acts on architecture and never becomes a fifth domain. It adds no element kind, domain or object type, and no Phase 6 record appears in a domain view as if it were architecture.
2. **Methodology is a governed practice layer** (Q1). It runs alongside every stage of the Phase 5 flow and is not a stage before it.
3. **Form decides behavior.** Every Method Asset has one of five forms (Method, Model, Standard, Instrument, Template), and the system does something different with each. If two forms would behave identically, they are one form (§8).
4. **Published methodology is immutable.** This is the same principle as element versions and frozen baselines (ADR-0014, ADR-0021). Improvement produces a new version or a new release. Nothing already used is ever edited in place.
5. **Record use, not just existence** (Q5). A Method Application records that a specific method version was actually used, for a stated reason, under stated conditions, with stated results. Static lineage alone is not enough.
6. **Reference, don't duplicate** (Phase 5 §1.1).
   - A Method Application's findings are statements.
   - Its risks, assumptions, opportunities and recommendations are Project Intelligence records.
   - Its formal outputs are Deliverables.
   - No Phase 6 table duplicates any of these.
7. **Two kinds of provenance stay separate** (Q15).
   - _Whose authority_ a claim rests on is architecture provenance (ADR-0009, ADR-0015). It is unchanged.
   - _How the work was performed_ is practice provenance. It is new in Phase 6.
   - Neither is inferred from the other.
8. **The Method/IP boundary stays structural** (ADR-0022). No client policy exists on any Phase 6 table. Anything a client learns about TPLCo's approach is authored, published text that passes the existing publication boundary.
9. **Authority is a capability, never a role name** (ADR-0008, Q11). Publishing methodology is a distinct authority. It is not a by-product of system administration.
10. **Capture what cannot be reconstructed; analyze nothing** (Q17, spec §18). Phase 6 records the facts that later learning needs. It ranks, scores, recommends and executes nothing.
11. **Stable foundations are not renegotiated.** The following are extended only additively, where they are touched at all:
    - the element spine;
    - the four domains;
    - publication and versions;
    - baselines;
    - the relationship ontology;
    - Project Intelligence;
    - Implementation;
    - Reviews and Deliverables;
    - RLS;
    - engagement isolation;
    - Contributor areas;
    - finance separation.

---

## 2. Governing conceptual model

### 2.1 The separation (approved wording, with the reconciliation's two clarifications)

| Concept            | What it is                                                                                                                            | Where it lives in DSA OS                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Architecture**   | What the development should become                                                                                                    | Element spine; four domains; typed relationships (Phase 3)                          |
| **Methodology**    | How disciplined architectural work is performed to discover, define, assess, validate or govern that architecture and its realization | Method Library, DAM releases, Method Applications (**Phase 6**)                     |
| **Implementation** | How approved Architecture becomes operating reality                                                                                   | Implementation Initiatives and Checkpoints (Phase 5)                                |
| **Evidence**       | What supports or contradicts claims about reality. Evidence does not by itself establish truth                                        | Evidence sources, and statement and element evidence links with stance (ADR-0015)   |
| **Decision**       | A formal judgment or choice arising from architectural work, intelligence or Review                                                   | Decision records; `client_decision` provenance (ADR-0021)                           |
| **Review**         | Formal architectural and governance judgment                                                                                          | Reviews; `validates` (ADR-0035, ADR-0036)                                           |
| **Learning**       | What may change Architecture or future Methodology because of observed results                                                        | Architectural learning (Phase 5 §7.4); methodological learning (**Phase 6**, §11.7) |

### 2.2 Two loops that interact but do not collapse into each other

**Engagement learning loop (Phase 5, unchanged):**

Architecture → Implementation → Evidence → Review / Decision → Architectural Learning → potentially revised Architecture

**Practice learning loop (Phase 6):**

Method Asset / DAM Release → Method Application → Architectural Work → Outputs (Architecture, Intelligence, Deliverables, Implementation or Review) → Observed Outcomes → Methodological Learning → potentially revised Method Asset / future DAM Release

**Where they meet:** the Method Application. It is the provenance bridge.

- **The engagement loop reads it** to learn how an element came to be.
- **The practice loop reads it** to learn what happened when a method version was used.

**How they stay separate:**

- **Nothing in the practice loop changes architecture state.** A Method Application creates and revises elements only through the ordinary Phase 3–5 operations, under the ordinary engagement capabilities. It records what it did afterwards.
- **Nothing in the engagement loop changes methodology.** A Review may reveal that a method served poorly. The only path to a revised Method is a new Method Asset version, published by a `publish_methodology` holder, which may cite the applications that motivated it (§11.7).

---

## 3. Scope

### 3.1 Proposed for Phase 6

1. **Method Library.**
   - Method Assets with five forms.
   - Immutable published versions, with form-specific structure.
   - Rights and origin.
   - Internal browse and detail.
2. **DAM releases.** Frozen, published collections of exact Method Asset versions. Each engagement references its release.
3. **Method Applications.** A first-class, off-spine, internal record of each actual use of a Method version on an engagement, with explicit linkage tables to elements, evidence and the assets used.
4. **Typed method lineage.** `element_method_lineage` is extended so that element-level lineage is pinned to exact asset versions and says how the asset was used:
   - a Model is _instantiated_;
   - a Template is _produced from_;
   - a Standard is _judged against_.
5. **Development Context.** A governed, extensible vocabulary recorded on engagements and snapshotted onto Method Applications.
6. **Acceptance criteria.** Engagement-specific, agreed criteria as a lightweight engagement-governance record with durable identity, fixed agreed text and capture at validation (§15). This answers "validated against what?".
7. **Approach statements.** A new statement kind for authored, client-visible descriptions of how work was approached. It is the only channel through which a client may learn a method's identity (§17).
8. **Practice capabilities.** Methodology authority (`author_methodology`, `publish_methodology`) held through TPLCo organization membership: the same capability model as engagements, in a second membership scope, because every existing capability is engagement-scoped (§27).
9. **Backfill** of the two existing Method Assets, their lineage rows and the `methodology_version` text on engagements (§34).
10. **Internal UX:**
    - Method Library;
    - Method Asset detail;
    - DAM release;
    - Apply a Method;
    - Method Application workspace;
    - contextual panels on element, Review, Implementation and Deliverable pages.
11. **Client UX:** approach statements in published snapshots, agreed acceptance criteria on client-visible architecture, and the engagement's DAM release name. Nothing else.

### 3.2 Why Phase 6

Spec §31 assigns "Method Library, templates, IP lineage, versioning, pattern library" to Phase 6. Several spec requirements are unmeetable until a record of use exists:

- "impacted engagements" (§20);
- "usage tracking" (§21);
- "frequently applied models" (§17);
- "method asset used" (§15).

Phase 7 (Architecture Intelligence) will need structured practice provenance to exist before it can reason about it. That data cannot be backfilled honestly after the fact.

---

## 4. Explicitly out of scope

Phase 6 does not build any of the following. No repository analysis found an unavoidable dependency on any of them.

| Excluded                                                                                               | Where it belongs                                       |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Architecture Intelligence, AI method recommendation, automatic method selection                        | Phase 7                                                |
| AI prompt storage, execution or orchestration; a prompt library (Q17)                                  | Phase 7                                                |
| Automated methodological learning, success scoring, cross-engagement recommendation engines            | Phase 7 / Phase 8                                      |
| Pattern Library tables, pattern conversion, pattern mining, automated pattern extraction (Q14)         | A later phase; the boundary only is defined here (§21) |
| Certification, licensing, royalty management, licensee accounts                                        | Phase 9                                                |
| Contract or rights management (Phase 6 records rights; it never decides them)                          | Out of product scope                                   |
| A universal phased DAM engagement sequence; a methodology-governed `current_phase` (Q9)                | Possibly later, once the Method defines it             |
| Method Library control of Architecture Core ontology (object types, relationship types, domains) (Q10) | Never through the library; migrations only             |
| Generic document management, LMS or course functionality, task management, workflow builders           | Never                                                  |
| Client access to any Method Library content, Method Application or lineage                             | Never (ADR-0022)                                       |
| Method-specific risks, findings, decisions or any duplicate of a Project Intelligence record           | Never (Phase 4 remains the intelligence layer)         |
| Per-stage assignees, due dates, completion percentages, stage checkboxes                               | Never                                                  |
| A Review type for method-adherence assessment                                                          | Later (practice QA, certification)                     |

---

## 5. Master Build Spec and ADR conflicts

`CLAUDE.md` requires conflicts to be surfaced rather than resolved silently. Each is listed with its proposed resolution.

| #   | Conflict or ambiguity                                                                                                                                                                                                                                                                                                         | Proposed resolution                                                                                                                                                                                                                                                                                                                        | Decision |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| C1  | **Spec §4** gives System Administrators "manage methodology/IP library". **ADR-0024** deliberately withholds architecture authority from System Administrators. The Phase 1 `method_assets` write policy checks role names (`has_internal_role(['system_administrator','principal_architect'])`), predating ADR-0008.         | Methodology authority becomes a dedicated practice capability. `publish_methodology` defaults to Principal Architects only. System Administrators administer the platform but hold no methodology authority by default. The role-name policy is removed. This formally resolves the spec §4 vs ADR-0024 tension in ADR-0024's favor (Q11). | D10, D11 |
| C2  | **Spec §20** versions "method assets" as "DAM 1.0 / 1.1 / 2.0", which reads as a version of the whole methodology. The schema has two unrelated free-text versions: `engagements.methodology_version` ('DAM 1.0') and `method_assets.version`. Both seeded assets use the _release_ label 'DAM 1.0' as their _asset_ version. | Two levels. Asset versions (e.g. 1.2) belong to individual Method Assets. DAM releases (e.g. DAM 1.1) are frozen sets of asset versions. Backfill separates the two (§34).                                                                                                                                                                 | D6, D7   |
| C3  | **Spec §14** lists "system-design patterns" and "governance patterns" as Method Library categories, while **spec §16** defines a separate Pattern Library.                                                                                                                                                                    | Patterns are not Method Assets (Q14). Those two categories are not carried into the Method Library's category vocabulary. The Pattern Library boundary is defined in §21.                                                                                                                                                                  | D25      |
| C4  | **Spec §14** lists "AI prompts" as a Method Library category; all AI is Phase 7 (spec §18, §31).                                                                                                                                                                                                                              | Not carried into Phase 6 (Q17). No compatibility stub is needed, because nothing on `main` references AI prompts.                                                                                                                                                                                                                          | D26      |
| C5  | **Spec §14** "related methodology domain" and the column `method_assets.methodology_domain` are singular. Many methods span domains.                                                                                                                                                                                          | Zero or more domains per asset version, in a join table (the same pattern as `intelligence_record_domains`, ADR-0017).                                                                                                                                                                                                                     | D3       |
| C6  | **Spec §14** has "applicable sectors" and **§17** has "engagements by sector", but engagements have no sector or development-type field. `engagement_type` is a commercial format.                                                                                                                                            | Development Context (Q13), §13.                                                                                                                                                                                                                                                                                                            | D15, D16 |
| C7  | **ADR-0009** defines `methodology_derived` as "produced by applying the Development Architecture Method". Read broadly, that covers nearly all architect work once methods are applied routinely.                                                                                                                             | Narrow reading (Q15): substantive content derived from authoritative Methodology content. The ADR-0009 text is clarified by a new ADR. The enum is unchanged. The one seeded `methodology_derived` element already conforms (§19.3).                                                                                                       | D19      |
| C8  | **ADR-0016** says object and relationship types are reference tables "so the Method Library can govern them later".                                                                                                                                                                                                           | Document only (Q10). DAM releases _document_ the vocabulary they were published against (§10.4) and never change it. ADR-0016 gets an amendment note. Its decision is unchanged.                                                                                                                                                           | D27      |
| C9  | **ADR-0022** says `methodology_derived` is shown to clients "without naming the asset". Q12 permits TPLCo to intentionally tell a client a branded method was used.                                                                                                                                                           | ADR-0022 stays intact (§17). A method's identity reaches a client only as authored text in a published approach statement, never read from a Method Asset row. No `client_visible_name` field is added.                                                                                                                                    | D21      |
| C10 | **Spec §14**: "Client users must never access this system directly." The word "directly" implies some indirect client disclosure is acceptable, but does not say what.                                                                                                                                                        | Defined precisely in §17: authored approach statements, plus the engagement's DAM release name through a single-purpose client read model.                                                                                                                                                                                                 | D21, D22 |
| C11 | **Spec §12** says deliverables are "generated from structured data". **§14** holds "templates" and "blueprint structures". The link between a Template and a Deliverable is undefined, and Phase 5 deferred generation to Phase 7.                                                                                            | A Deliverable may record, in internal lineage, the exact Template version it was _produced from_. Generation remains Phase 7.                                                                                                                                                                                                              | D18      |
| C12 | **Spec §26** sketches `method_assets` as a flat row with `usage_instructions` and one `version`. That flat shape cannot hold immutable versions, form-specific structure, or version-pinned use.                                                                                                                              | The sketch is superseded, as spec §26 permits ("a starting architecture, not an immutable schema"). §23–§24.                                                                                                                                                                                                                               | D5       |
| C13 | **Spec §15** says lineage should include "method asset used". The existing `element_method_lineage.method_version` is free text and is not pinned to anything immutable.                                                                                                                                                      | Lineage is pinned to `method_asset_versions` and given a typed role (§12.5).                                                                                                                                                                                                                                                               | D18      |
| C14 | **Spec §4** says the Principal Architect "runs diagnostics", and **§10** has a "Diagnostic Completion" milestone. Both hint that DAM defines an engagement sequence.                                                                                                                                                          | Not formalized (Q9). A diagnostic is modeled as a Method. `current_phase` stays free text.                                                                                                                                                                                                                                                 | D8       |

No conflict was found between Q1–Q17 and anything built in Phases 1–5.

---

## 6. Proposed vocabulary

Display labels can be reworded later without a migration. **Keys cannot** (§36).

| Term                                         | Definition in DSA OS                                                                                                                                                                        | Status                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Development Architecture Method™ (DAM)**   | TPLCo's methodology as a whole, published as numbered **DAM releases**                                                                                                                      | Spec                       |
| **Method Library**                           | The governed, internal collection of Method Assets and DAM releases                                                                                                                         | Spec §14                   |
| **Method Asset**                             | The governed, reusable unit of methodology: one identity, one form, and a history of immutable versions (Q2)                                                                                | Spec §14, §15, §26; schema |
| **Method Asset version**                     | One immutable, published state of a Method Asset's content, with a version label (e.g. 1.2)                                                                                                 | New                        |
| **Form**                                     | How an asset behaves when used: Method (performed), Model (applied), Standard (judged against), Instrument (used within), Template (produced from)                                          | New (Q3)                   |
| **Category**                                 | What an asset is about (spec §14's subject categories, less patterns and AI prompts). Descriptive and searchable; never behavioral                                                          | Spec §14                   |
| **DAM release**                              | A frozen, published collection of exact Method Asset versions, e.g. _Development Architecture Method™ 1.1_                                                                                  | New (Q8)                   |
| **Method Application** _(working term, D12)_ | One actual use of one exact Method version on one engagement, for a stated reason, recording its scope, inputs, instruments used, adaptations, outputs and closure                          | New (Q5, Q6)               |
| **Practice provenance**                      | The record of _how_ architectural work was performed: Method Applications and typed method lineage                                                                                          | New                        |
| **Development Context**                      | A governed descriptor of the kind of development system in which methodology was applied (e.g. commercial or real-estate development). Recorded on engagements; snapshotted on applications | New (Q13)                  |
| **Methodological standard**                  | A reusable Method Library Standard: enduring criteria governing the quality and integrity of Development Architecture practice                                                              | New (Q4)                   |
| **Acceptance criterion**                     | An engagement-specific criterion, agreed consultatively between TPLCo and the client, against which realization of particular architecture will be judged. **Not a Method Asset**           | New (Q4)                   |
| **Approach statement**                       | Authored, publishable text on an element describing how the work behind it was approached. The only channel for client-facing method identity                                               | New (Q12)                  |
| **Methodological learning**                  | A change to methodology motivated by observed results, recorded as a new asset version citing the applications that informed it                                                             | New                        |
| **Pattern**                                  | Reusable architectural knowledge about recurring development-system structures, problems or responses. **Not a Method Asset.** Later phase                                                  | Spec §16 (Q14)             |

**Not introduced (Q3):**

- **Framework.** Ordinary usage maps onto existing forms (§8.3). The word also collides with the _Implementation Framework_ deliverable type.
- **Procedure.** A procedure is the ordered stages inside a Method.

**Vocabulary collisions to guard in UI copy.** None of these existing terms is reused for methodology:

- **Workflow** (Application Architecture) is the _client's_ operating sequence. A Method's stages are not a Workflow.
- **Documentation Protocol** is the client's record-keeping rule. Instruments are TPLCo's.
- **Decision Right** is client authority, not a decision method.
- **Model** already appears in:
  - Strategic Model Architecture;
  - Applied Strategic Model;
  - Operating Model;
  - the Measurement Model deliverable.

  UI copy says "Method Library Model" wherever ambiguity is possible.

- **Application** already appears in:
  - Application Architecture;
  - Application Format.

  UI copy always says "Method Application", never bare "Application" (D12).

- **`architecture_approval_method`** (meeting, email, signed document) is shown in UI copy as "approval channel" wherever methodology also appears.

---

## 7. Method Asset model

### 7.1 What a Method Asset is

A Method Asset is **one governed identity** with three parts:

- **one form**, fixed for the asset's life;
- **one category**, a subject, used for browsing;
- **an ordered history of versions**, each of which is draft, published, superseded or retired.

The identity is stable across versions: _Capability Readiness Diagnostic_ remains the same asset at 1.0, 1.1 and 2.0. Its content lives only in versions. Rights and origin belong to the identity, with append-only history (§16).

**Why the identity is split from its versions.** Today's `method_assets` row mixes identity with content (description, version text, status). The split lets a published version stay immutable while the asset evolves. It is the same separation as `architecture_elements` (identity) and `element_versions` (immutable content) in Phase 3.

### 7.2 Minimum operational structure

Kerrick asked for the minimum structure that makes an asset _usable_, not merely readable. The test applied to each candidate field:

> Does the system, or a practitioner inside it, do something different because this field exists? Or can the field be checked against what a Method Application actually did?

If neither is true, the field is prose inside the instructions, or it is omitted.

| Candidate                                  | Decision                                                        | Where                                                                                | Why                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Purpose / **architectural question**       | **Required, all forms**                                         | `method_asset_versions.architectural_question`                                       | The reason to choose the asset; the first line of every browse row                                                  |
| **Applicability** (when to use, when not)  | **Required, all forms**                                         | `applicability`, `exclusions`                                                        | Prevents misuse; becomes a learnable condition later                                                                |
| Prerequisites                              | Optional, Method only                                           | `prerequisites` (prose)                                                              | Shown on Apply; not enforced, because enforcing it would make the method a workflow engine                          |
| Required / expected inputs                 | Optional, Method and Instrument                                 | `expected_inputs` (prose)                                                            | Guidance; actual inputs are recorded on the application                                                             |
| Evidence expectations                      | Optional, Method and Instrument                                 | `evidence_expectations` (prose) + typed evidence kinds                               | Instruments declare the evidence source types they collect (e.g. interview), checkable against application evidence |
| Instructions / **stages**                  | **Stages required for Method**; instructions for all            | `method_version_stages` (ordered rows); `practitioner_instructions` (protected text) | Stages are the discipline. Each stage note on an application points at a stage (§11.5)                              |
| Roles                                      | Optional, Method only                                           | `practitioner_roles` (prose)                                                         | Guidance only. Never assignment. Never names a person                                                               |
| **Expected outputs**                       | **Required for Method and Model**; implicit for Template        | `method_version_outputs` (typed rows)                                                | The decisive link to architecture: compared with what the application actually produced (§11.6)                     |
| Applicable **domains**                     | Zero or more, all forms                                         | `method_version_domains`                                                             | Browse and scope; zero means domain-neutral                                                                         |
| Applicable **Development Contexts**        | Zero or more, all forms                                         | `method_version_contexts`                                                            | Zero means any context. Learning compares _declared_ applicability with _actual_ use                                |
| Possible Project Intelligence outputs      | Part of expected outputs                                        | `method_version_outputs` with a PI record kind                                       | "The library describes what a method may produce; the application records what it actually produced" (Kerrick §14)  |
| Possible Deliverables                      | Part of expected outputs                                        | `method_version_outputs` with a `deliverable_type`                                   | Same                                                                                                                |
| Review implications                        | Optional prose, Method; Standards declare where they are judged | `review_implications`; `standard_judged_in`                                          | Tells an architect when a Review should follow. Never schedules one                                                 |
| Implementation implications                | Optional prose, Method                                          | `implementation_implications`                                                        | Same. Never creates an initiative                                                                                   |
| **Completion / use criteria**              | **Required, Method**                                            | `completion_criteria` (prose) + optional cited Standard version                      | Closure of a Method Application states how these were met (§11.4)                                                   |
| Provenance (author, basis, change summary) | **Required, all forms**                                         | `authored_by`, `change_summary`, `derived_from_version_id`, `learning_sources`       | Governance and derivation (§9, §11.7, §16)                                                                          |
| Ownership / IP                             | **Required, all forms (on the asset)**                          | `origin`, rights holders, `ip_classification`                                        | §16                                                                                                                 |
| Version and lifecycle                      | **Required, all forms**                                         | `version_label`, `version_no`, `lifecycle`                                           | §9                                                                                                                  |
| Client-visible identity                    | Internal guidance only                                          | `identity_disclosure`, `disclosable_name` (internal fields)                          | §17. Never read by clients                                                                                          |

**Not included:**

- per-stage assignees, due dates or status;
- mandatory fields per stage;
- automated gating on prerequisites;
- scoring logic as data;
- rich documents as the asset's body.

Protected content (practitioner instructions, instrument items, scoring guidance) is long-form **text** plus, for Templates and Instruments only, an attached file. It is deliberately not structured in Phase 6. Structuring it would turn the library into a form builder.

### 7.3 Why this

- **Why DSA OS:** the spec makes DSA OS "the digital operating environment for the Development Architecture Method™". An environment for a method must hold that method as governed, structured, versioned material.
- **Why Phase 6:** spec §31. Phases 1–5 left a stub (`method_assets`) that cannot hold versions, forms or use.
- **Why not document management:** every required field above either drives behavior (form, stages, expected outputs, lifecycle) or is compared against recorded use (applicability, contexts, outputs, completion criteria). Documents have neither property. Free-form content is confined to protected instructions.
- **Relation to Architecture:** expected outputs and domains are stated in DSA's own vocabulary (object types, element kinds, deliverable types). The asset _points at_ architecture and never contains it.
- **Provenance for learning:** declared applicability, contexts and outputs are the baseline against which later phases compare actual use and actual results.

---

## 8. Method Asset forms and behavior

### 8.1 The test Kerrick asked for

Each form is kept only if it produces **different structural behavior**: different records, different permitted links, or a different role in another phase's operations. All five pass. No sixth form does.

| Form           | Verb                        | What the system does differently                                                                                                                                                                                                                      | Required structure beyond the common fields                                         | Behavior it must not have                                              |
| -------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Method**     | performed                   | **Only form that can be the subject of a Method Application.** Stage notes point at its stages; closure is judged against its completion criteria; expected outputs are compared with actual outputs                                                  | Stages (≥ 1), modes, expected outputs (≥ 1), completion criteria                    | Cannot be instantiated into an element; cannot be a DAM "phase"        |
| **Model**      | applied (into architecture) | **Only form an element may _instantiate_** (lineage role `instantiates`). This is the one legitimate basis for element-level `methodology_derived` (§19.3). Example: an Applied Strategic Model instantiates a strategic model from the Model Library | Expected outputs (the object types it is applied into), applicability limits        | Not "performed": it has no stages and no Method Application of its own |
| **Standard**   | judged against              | **Only form that can be cited as a criterion basis.** A Review or element may carry `judged_against` lineage; a Method's completion criteria may cite it; an acceptance criterion may cite it (§15)                                                   | Ordered criteria rows; where it is judged (review, completion, maturity)            | Never computes a verdict (ADR-0036: validation is a judgment)          |
| **Instrument** | used within                 | **Recorded as _used_ by a Method Application.** May be named as the instrument that gathered a piece of evidence                                                                                                                                      | Evidence source types it collects; usage guidance; optional attached file           | Cannot be applied alone; has no stages; produces no architecture       |
| **Template**   | produced from               | **Only form a Deliverable may be _produced from_** (lineage role `produced_from`, pinned version)                                                                                                                                                     | The `deliverable_type` it produces; ordered section outline; optional attached file | Not a deliverable itself; generation stays Phase 7                     |

**Why only Methods are applied (D2).** Kerrick's practice loop runs "Method Asset → Method Application → Architectural Work". The other four forms participate _inside_ that work, or at the element level:

- A Model is applied _into_ architecture. Its record is the element and its `instantiates` lineage. A second record would duplicate the element.
- Standards, Instruments and Templates are _components_ an application records as used (`method_application_assets`).

Rejected alternative: letting a Model be a Method Application's subject. Every model application would then produce two records of the same act. Spec §17's "frequently applied models" is fully answerable from `instantiates` lineage pinned to Model versions.

### 8.2 Composition

A Method version may declare **components**: the exact versions of Instruments, Models, Standards and Templates it normally uses. The composition is guidance, and it is pinned at publication. A Method Application records the components **actually** used, which may differ, with a note. Example: _Capability Readiness Diagnostic 1.1_ uses:

- _Leadership Capability Interview Guide 1.0_ (an Instrument);
- _Capability Readiness Scale 1.0_ (a Standard);
- _Capability Map Template 2.0_ (a Template).

### 8.3 How ordinary professional terms map onto the five forms (Q3)

| Everyday term                                                  | Usually maps to                                                                     | Test                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Diagnostic framework                                           | **Method** (+ Instrument + Standard components)                                     | Performed in stages; produces findings                                    |
| Decision framework                                             | **Method** if it is a process; **Model** if it is a structure applied to a decision | Is it performed, or applied into architecture?                            |
| Measurement framework                                          | **Model** (the measurement structure) or **Standard** (targets and thresholds)      | Applied into Metrics, or judged against?                                  |
| Risk framework                                                 | **Standard** (scales, thresholds) or **Model** (a risk taxonomy)                    | Same test                                                                 |
| Research protocol                                              | **Method**                                                                          | Performed                                                                 |
| Procedure                                                      | **Method** (a small one) or the **stages** of a larger one                          | Performed                                                                 |
| Question library, interview guide, survey, scoring rubric      | **Instrument**                                                                      | Used within a method                                                      |
| Capability taxonomy, architecture taxonomy                     | **Model**                                                                           | Applied into architecture (instantiated as Capabilities, Knowledge Areas) |
| Strategic model                                                | **Model**                                                                           | Applied as an Applied Strategic Model (existing object type)              |
| Template, blueprint structure                                  | **Template**                                                                        | Produced from                                                             |
| Accreditation criteria, zoning code, regulation (the client's) | **Not a Method Asset.** Regulatory Factor / Constraint (existing architecture)      | The development's obligation, not TPLCo practice                          |
| System-design pattern, governance pattern                      | **Not a Method Asset.** Pattern Library (later)                                     | Reusable architecture, not practice (§21)                                 |

"Framework" and "Procedure" survive as **words in categories and titles**. They are never structural forms.

### 8.4 Categories

A category is subject classification only, recorded in `method_asset_categories`. It is a migration-managed reference table, the same mechanism as `intelligence_categories`. It is seeded from spec §14, less the two pattern categories and AI prompts (C3, C4):

- diagnostic frameworks;
- architecture taxonomies;
- question libraries;
- templates;
- strategic models;
- decision frameworks;
- research protocols;
- capability taxonomies;
- measurement frameworks;
- risk frameworks;
- blueprint structures;
- other.

The category is **independent of form**. A "diagnostic framework" asset can be a Method or an Instrument. Categories cannot drive behavior (D4).

### 8.5 Why this

- **Why DSA OS:** the five verbs are how the Development Architecture Method's material is actually used in architectural work.
- **Why Phase 6:** permanent form keys must exist before the first published asset.
- **Why not document management:** a document library has one behavior ("open it"). Here each form has a distinct, enforced behavior, and the database refuses the wrong one. A Template cannot be the subject of a Method Application. A Method cannot be instantiated into an element.
- **Relation to Architecture:** Models become architecture only by being instantiated into an ordinary element. Every other form acts on architecture without becoming it.
- **Provenance for learning:** the verb is recorded with every use: which Method was performed, which Model instantiated, which Standard judged against, which Instrument used, which Template produced from.

---

## 9. Method Asset versioning and lifecycle

### 9.1 Asset lifecycle

`method_assets.status` takes the values `active`, `retired` or `legacy`. `legacy` exists only for assets carried over from before Phase 6 and not yet adopted into a form (§34, D28).

- **Retiring an asset** retires its current published version and prevents new versions.
- **History is unaffected.** Every version stays readable, and every application and lineage row that pins one stays valid.

### 9.2 Version lifecycle

| State        | Meaning                                              | Editable                             | Can be newly applied, instantiated or produced from | Reached by                                                             |
| ------------ | ---------------------------------------------------- | ------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- |
| `draft`      | Being authored                                       | Yes, by `author_methodology` holders | No                                                  | `create_method_asset`, `create_method_asset_version`                   |
| `published`  | The current authoritative version                    | **Never**                            | Yes                                                 | `publish_method_asset_version` (`publish_methodology`)                 |
| `superseded` | A later version of the same asset has been published | Never                                | No (existing uses keep their pin)                   | Automatic, when a later version is published                           |
| `retired`    | Withdrawn without replacement (e.g. found unsound)   | Never                                | No                                                  | `retire_method_asset_version` (`publish_methodology`, reason required) |

**Rules:**

- **At most one draft and at most one published version per asset at a time.**
- **Publication is irreversible.** Correcting a published version means publishing a new version. Even a typographic fix is a new minor version with a change summary. This matches element versions.
- **Immutability is enforced in the database.** A guard trigger refuses any update or delete of a non-draft version and of its child rows (stages, outputs, domains, contexts, components, criteria, sections, file attachments), with `23514`. This follows the `guard_architecture_baseline` and `guard_implementation_log` precedent.
- **Versions carry both a label and an ordinal.** The label (e.g. `1.2`, `2.0`) is chosen at publication. Its major/minor meaning is TPLCo's convention and is not enforced. It is unique per asset. `version_no` is a monotonic integer used for ordering.
- **Snapshots are not needed.** A published version and its child rows _are_ the immutable record. This mirrors approvals pinning `element_versions` (ADR-0021).

### 9.3 Supersession and "upgrade"

- **Publishing version n+1 supersedes version n automatically.**
- **Existing Method Applications, lineage rows and DAM release memberships keep their pin forever.**
- **An in-flight Method Application is never re-pinned** (D17). To move work to a newer version, the architect discontinues the application with a reason and starts a new one that `continues` it. Both records stay interpretable, and the change of version is itself recorded practice.

### 9.4 Why this

Kerrick's versioning brief asked "can a published method change?" and "how do historical results remain interpretable?".

- **Answer:** no, a published method cannot change.
- **Interpretability:** every historical use points at content that cannot move. Change summaries between versions and learning sources (§11.7) explain _why_ the content changed.

This is ADR-0014's principle applied to methodology, not a new principle.

---

## 10. DAM Release model

### 10.1 What a release is (Q8)

A DAM release is a **named, published, frozen collection of exact Method Asset versions**, at most one version per asset.

- **Identity:** `version_label` (e.g. `1.1`, unique) and a display title (_Development Architecture Method™ 1.1_).
- **Lifecycle:** `draft` → `published` → `superseded` or `retired`.
- **Membership:** only **published** asset versions may be members. Membership is editable only while the release is a draft.
- **Publication** freezes membership and writes a system-built **vocabulary record** (§10.4). It requires `publish_methodology`.
- **Historical immutability:** a guard refuses changes to a published release and its members. A release remains interpretable after its members are superseded, because members are pinned versions and versions are immutable.
- **Supersession:** publishing release n+1 marks n `superseded`. Engagements on n stay on n until deliberately moved (§10.3).

### 10.2 Assets outside a release

A published asset version need not belong to any release. A pilot method is one example. It can still be applied, but only with a stated reason (D9). The application records the engagement's release and a derived flag, `version_in_release`. A later reader can then tell "used as part of DAM 1.1" from "used alongside DAM 1.1".

### 10.3 Engagements and releases

- **`engagements.dam_release_id`** is a new nullable FK to a published release.
- **`engagements.methodology_version` stays**, because every element and element version already copies it (ADR-0013). A trigger keeps it equal to the release label. Existing copying therefore continues unchanged, and historical element rows keep the text they already carry.
- **Changing an engagement's release** uses `set_engagement_dam_release(engagement, release, reason)`. It requires `publish_architecture` on that engagement, because this is an engagement governance act and not a methodology-publication act. It is logged with the reason.
- **The engagement edit form** stops offering free text for methodology version and offers published releases instead.
- **`current_phase` is untouched** (Q9, D8).

### 10.4 Documenting, not governing, vocabulary (Q10)

At publication, a release stores a read-only `vocabulary_record` built by the system: the keys and labels of domains, object types, element kinds and relationship types in force at that moment. This fulfills "DAM may document the Architecture vocabulary associated with a release".

**The library cannot change the vocabulary.** Object and relationship types remain migration-managed reference tables (ADR-0016). No Phase 6 operation writes to `architecture_object_types`, `relationship_types` or `relationship_rules`.

### 10.5 Why this

- **Why DSA OS:** spec §20 requires "each engagement should record the methodology version used". Q8 defines what a version of the methodology is.
- **Why Phase 6:** licensing and certification (Phase 9) need to say "licensed for DAM 1.1". Auditability needs "this engagement ran under DAM 1.0". Both need a frozen, inspectable definition.
- **Why not document management:** a release is a set of pinned identities, not a bundle of files. "Impacted templates" and "impacted engagements" (spec §20) become queries.
- **Relation to Architecture:** a release documents the ontology it was published against and never alters it.
- **Provenance for learning:** every application records its engagement's release. Phase 7 can compare outcomes across releases.

---

## 11. Method Application model

### 11.1 What it is (Q5)

**One actual use of one exact published Method version, on one engagement, for a stated reason**, recording:

- the conditions (Development Context and scope);
- the inputs (elements and evidence drawn on);
- the components actually used;
- the adaptations made;
- the outputs (elements created, revised, examined or informed);
- the closure (completion criteria met, and the architect's retrospective).

It is an **internal practice and provenance record**, not an element (§12.1).

### 11.2 Minimum Phase 6 model

Kerrick listed sixteen questions a Method Application should answer. The table shows which are recorded as fields in Phase 6, which are derived at read time, and which are deferred.

| Question                                          | Phase 6                                  | How                                                                                        |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Exact asset and version                           | **Recorded**                             | `method_asset_version_id` (form must be Method; lifecycle must be published at start)      |
| Under which DAM release                           | **Recorded**                             | `dam_release_id` = the engagement's release at start; `version_in_release` derived         |
| Which engagement                                  | **Recorded**                             | `engagement_id`                                                                            |
| Why selected                                      | **Recorded, required**                   | `selection_reason`                                                                         |
| Development Context                               | **Recorded (snapshot)**                  | `method_application_contexts`, copied from the engagement at start, editable until closure |
| Who performed it                                  | **Recorded**                             | `method_application_practitioners` (engagement members; lead / contributor)                |
| When                                              | **Recorded**                             | `started_on`, `closed_on`, `created_at`                                                    |
| What Architecture it acted on                     | **Recorded**                             | Scope: `engagement_wide`, `method_application_domains`, element links with role `examined` |
| What evidence and inputs informed it              | **Recorded**                             | Evidence links `drew_on`; element links `examined`                                         |
| What Project Intelligence it consumed / produced  | **Recorded**                             | Element links `examined` / `produced` / `revised` to PI records (§18)                      |
| What Architecture it created / informed / changed | **Recorded**                             | Element links `produced` / `revised` / `informed`, with the version observed at closure    |
| What Deliverables resulted                        | **Recorded**                             | Element links `produced` to Deliverables                                                   |
| Participation in Implementation or Review         | **Recorded**                             | Element links `examined` / `informed` to initiatives and Reviews (§20)                     |
| Adaptations made                                  | **Recorded**                             | Stage notes with treatment `adapted` / `skipped` + reason; component deviations            |
| What outcome followed                             | **Derived later, not recorded**          | Joins from linked elements to implementation status, review findings, supersession (§22)   |
| What later learning is attributable               | **Recorded from the practice side only** | `method_version_learning_sources` (§11.7). Attribution from outcomes is Phase 7            |

### 11.3 Lifecycle (D17)

| State          | Meaning                                                                                            | Transitions                       |
| -------------- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| `planned`      | Intentionally begun; scope and reason stated; work not yet under way                               | → `in_progress`, → `discontinued` |
| `in_progress`  | Work under way; stage notes, links and components being recorded                                   | → `completed`, → `discontinued`   |
| `completed`    | Closed. `completion_statement` (how completion criteria were met) required; retrospective optional | Terminal                          |
| `discontinued` | Closed without completion. Reason required. May name a continuing application                      | Terminal                          |

- **Closure freezes the record.** After `completed` or `discontinued`, a guard refuses changes to the row, its links, its stage notes and its components.
- **Addenda.** A later insight is recorded in `method_application_addenda`, which is append-only, dated and attributed. This preserves "what we knew at closure" while allowing later reflection. It is the same idea as ADR-0028's append-only history.
- **No other states:** no approval state, no percent complete, no per-stage status.

### 11.4 Closure

`complete_method_application(application, completion_statement, retrospective)`:

- requires at least one element link or one evidence link, because an application that touched nothing is not a completed use;
- captures `observed_version_id` for every `produced` or `revised` element link: the element's `latest_version_id` at that moment, which may be null for a still-draft element;
- does **not** require every expected output to be present. Divergence between expected and actual output is information, not an error. It is shown on the closure screen.

### 11.5 Stages and adaptations

A stage note (`method_application_stage_notes`) references the _pinned version's_ stage row. It carries:

- `treatment`: `followed`, `adapted` or `skipped`, with a reason required for the last two;
- free-form working notes (internal).

There is **no stage status, assignee or date**. The UI presents stages as quiet sections with notes, never as checkboxes (§29.5).

### 11.6 Outputs compared with expectations

The Method version declares expected outputs (§7.2). The application records actual links. The read model `method_application_detail` lays the two side by side, for example:

> expected Capability Gap: 2 produced · expected Recommendation: none produced

This is **display, not enforcement**. It is the smallest mechanism that makes a method operational rather than merely readable.

### 11.7 Methodological learning (the practice loop's return path)

A new Method Asset version may cite the applications that motivated it, in `method_version_learning_sources`: version → application, with a note. This is the practice loop's traceable closing arc:

> DAM Capability Readiness Diagnostic 1.1 was revised after applications on Harbor and Meridian found the leadership interview stage too long for small organizations.

It is written by authors of the new draft version. It is visible only internally. No automated attribution is attempted.

### 11.8 Why this

- **Why DSA OS:** the Method is TPLCo's product. Recording its actual use is how an operating system for a methodology differs from a library of it.
- **Why Phase 6:** spec §15, §17, §20 and §21 all presuppose it. Each engagement run without it is practice history lost for good.
- **Why not document management:** there is no document here. It is a structured record of an act, with typed links to the architecture it touched.
- **Relation to Architecture:** it points at elements, and elements never depend on it. Removing Phase 6 entirely would leave every element valid.
- **Provenance for learning:** version, release, context, reason, scope, components, adaptations, outputs, closure and learning sources are every fact §22 needs that cannot be reconstructed later.

---

## 12. Off-spine linkage and provenance model

### 12.1 The off-spine decision, tested against the repository (Q7)

Q7 asks the proposal to challenge the off-spine decision only for a compelling repository reason. The repository was checked:

| Spine infrastructure a Method Application would inherit  | Needed?                                                                                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client visibility, publication, `client_snapshot`        | **No, harmful.** Applications are internal by definition (ADR-0022). A spine row would carry a `client_visibility` column that must never be `client` |
| Element versions                                         | **No.** An application is a record of an act, closed once, not published repeatedly                                                                   |
| Reference codes (ADR-0025)                               | Useful, and available without the spine. `architecture_reference_counters` is keyed by engagement and prefix, not by spine row (§12.6)                |
| Statements with provenance and evidence links            | **No.** Findings belong on the elements they concern. Working notes are practice notes, not architecture statements                                   |
| `architecture_relationships` (typed links, `examines`)   | **The real cost.** Both ends are hard FKs to `architecture_elements (id, engagement_id)`. A non-spine record cannot use any typed relationship        |
| Lifecycle axes, maturity, AI review state, record status | **No.** None apply to an act of work                                                                                                                  |

**Conclusion: no compelling reason.** Putting applications on the spine would pollute the architecture ontology with a non-architecture kind. It would expose every architecture read model, register, domain view and trace to a record that is not architecture. Each of those would need exclusion logic, and the reverse risk (leaking into client snapshots) is the ADR-0022 hazard.

**The cost is real and is designed below.** Four link tables, a counter prefix, guard triggers, activity logging and read models. It is sized in the build order (§38).

### 12.2 Design principle for the linkage

- **Never write to `architecture_relationships`.** Phase 6 adds no relationship types and no `relationship_rules`. The typed ontology between elements is untouched (ADR-0018).
- **Link, never copy.** Every link references an existing row by FK with a composite engagement key, so it can never cross engagements. This is the same pattern as `element_evidence_links` and `element_method_lineage`.
- **A closed role vocabulary per link table.** Allowed element kinds per role are checked in the operation, as `relationship_rules` does for relationships.
- **Internal only.** No client policy on any link table. Snapshots never read them.

### 12.3 The four link tables

| Table                         | Links a Method Application to                                                            | Roles (proposed)                                                                                                                                                                                                                                                                                                                                                                                                   | Why it is needed                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `method_application_elements` | Any element: core objects, PI records, Deliverables, Reviews, Implementation Initiatives | `examined`: the element was a subject or input of the work (assessed, tested, investigated). `produced`: the element was created by this work. `revised`: an existing element was materially changed by this work. `informed`: the work's results were supplied to the element without the application producing or changing it (a Decision's deliberation, a Review's agenda, an initiative's readiness judgment) | Answers "what did it act on" and "what did it produce", in both directions; replaces the inexpressible `examines` |
| `method_application_evidence` | Evidence sources                                                                         | `drew_on`: existing evidence used as input. `gathered`: evidence created during the work (optionally naming the Instrument version used)                                                                                                                                                                                                                                                                           | Answers "what evidence informed it" and "did an Instrument collect evidence"                                      |
| `method_application_assets`   | Method Asset versions (Instrument, Model, Standard, Template)                            | `used`, with an optional `deviation_note` when it differs from the Method's declared components                                                                                                                                                                                                                                                                                                                    | Answers "which exact components were actually used"                                                               |
| `method_application_domains`  | Architecture domains                                                                     | (scope)                                                                                                                                                                                                                                                                                                                                                                                                            | Domain-level scope without naming elements, the ADR-0017 pattern                                                  |

**Role and kind rules.** They are enforced by `link_method_application_element`:

| Role       | Allowed target kinds                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `examined` | any                                                                      |
| `produced` | `object`, all seven PI kinds, `deliverable`                              |
| `revised`  | `object`, all seven PI kinds, `deliverable`, `implementation_initiative` |
| `informed` | `decision`, `recommendation`, `review`, `implementation_initiative`      |

- **Reviews are never `produced`.** A Review is convened, not produced by method work.
- **Implementation Initiatives are never `produced`.** They are initiated by Decisions and Recommendations (`initiates`, ADR-0034).
- **At most one row per (application, element, role).** One element may carry several roles: examined, then revised.

**What these links deliberately are not:**

- **Not a relationship between elements.** They never appear in trace views as architecture.
- **Not evidence.** They carry no stance.
- **Not a substitute for `raises` or `validates`.** A Review's outcomes and validations remain Review operations.

**Historical reference for removed drafts (D30).** Each element link captures the element's reference code, kind, object type and title when linked, refreshed at closure with `observed_version_id`. If an unpublished linked draft is later deleted under the ordinary Phase 3 rule, the link keeps its captured identity, `element_id` becomes null (`on delete set null (element_id)`) and `element_removed_at` is stamped. Drafts stay disposable, and the application still says what it examined or produced.

### 12.4 Method Application ↔ element traceability (D14, D18)

Two complementary element-level views, both internal:

- **Practice provenance of an element** (`element_practice_context`):
  - every application that examined, produced, revised or informed the element, with method, version and closure state;
  - every typed lineage row (`instantiates`, `produced_from`, `judged_against`) pinned to an asset version.
- **Practice footprint of an application** (`method_application_detail`): every linked element grouped by domain and kind, with expected outputs alongside.

### 12.5 Typed method lineage (the existing table, extended)

`element_method_lineage` today links an element to an asset with free-text `method_version`. It is extended additively:

| New column                | Meaning                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `method_asset_version_id` | FK to the exact published version (backfilled; `method_version` text kept read-only for history)                                                                                                                               |
| `lineage_role`            | `instantiates` (Model → core object) · `produced_from` (Template → Deliverable) · `judged_against` (Standard → Review, core object or Implementation Initiative) · `legacy_derived_from` (pre-Phase-6 rows only; not writable) |

**Form ↔ role ↔ kind** is enforced by trigger. A Method can no longer be written as element lineage at all: Method use is recorded only by a Method Application (D18). This is the enforcement of "form decides behavior".

**Why keep lineage separate from Method Applications.** Instantiation, production-from-template and judgment-against-standard are facts about an **element**. They hold whether or not the act was recorded as a Method Application. For example, a Deliverable is produced from a Template regardless of which method work preceded it.

### 12.6 Identity and reference codes (D13)

Method Applications get engagement-scoped reference codes, **`MUS-nnn`** (`MUS-001`, `MUS-002`), from `architecture_reference_counters` via `private.next_reference_code`, the ADR-0025 mechanism.

- **The codes are internal only.** They never appear in a client read model.
- **The code is not an abbreviation of the display name.** The record remains a _Method Application_; `MUS` avoids confusion with the many _map_ concepts in Development Architecture (D13).

Method Assets and DAM releases are TPLCo-wide, not engagement-scoped. They are identified by title plus version label (_Capability Readiness Diagnostic 1.1_; _DAM 1.1_) and a stable `key` slug. They get no three-letter code, because ADR-0025's codes are engagement-scoped by design.

### 12.7 Why this

- **Why DSA OS:** traceability between how work was done and what it produced is the point of practice provenance.
- **Why Phase 6:** the links must exist from the first application. Missing links cannot be backfilled honestly.
- **Why not document management:** typed, role-checked, FK-enforced links, not attachments or mentions.
- **Relation to Architecture:** architecture never depends on these links. The relationship ontology is untouched.
- **Provenance for learning:** every "produced by" and "drew on" fact is a queryable row with a pinned method version.

---

## 13. Development Context model

### 13.1 What it is (Q13)

A Development Context is the **type of development environment** in which architecture work happens. Examples:

- a college developing an institutional capability;
- a region developing an industry cluster;
- a real-estate district being planned;
- a community developing a new service.

It is the condition that most determines whether a method fits. It is also the variable Phase 7 learning most needs.

### 13.2 Representation (D15, D16)

| Question                          | Recommendation                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enum or governed list?            | **A governed reference table, `development_contexts`**, not an enum. Each row has an immutable `key`, `label`, `definition` and `status` (active or retired). No Postgres enum values are created                                                                                                                                                           |
| Who governs it?                   | Holders of **`publish_methodology`** add, redefine or retire contexts through operations (`create_development_context`, `revise_development_context`, `retire_development_context`), each logged. Architects propose contexts in conversation, not in the system                                                                                            |
| Engagement, application, or both? | **Both.** The engagement declares its contexts (`engagement_development_contexts`, one or more, one marked primary). Each Method Application **snapshots** the engagement's contexts at start, adjustable until closure (§11.2)                                                                                                                             |
| Multiple contexts?                | **Yes.** A regional industrial-development engagement can also be a workforce-system engagement. Exactly one may be marked primary per engagement                                                                                                                                                                                                           |
| Declared applicability on assets? | `method_version_contexts`, zero or more rows. Zero means "any context". Published with the version and immutable                                                                                                                                                                                                                                            |
| Historical interpretability       | Keys never change and rows are never deleted. A redefinition keeps the key and is recorded in `development_context_revisions` (append-only: prior label and definition, reason, who, when). A retired context stays on every historical row. Application snapshots mean a later change to the engagement's contexts cannot rewrite what applied at the time |
| Who sets engagement contexts?     | Members with **`edit_architecture`** on the engagement, through `set_engagement_development_contexts`, logged                                                                                                                                                                                                                                               |
| Client visibility                 | **None in Phase 6.** Contexts are internal classification. A client-facing description of the development belongs in the engagement's own description or in architecture                                                                                                                                                                                    |

**Not seeded by migration.** Kerrick's contexts (college, region, district, community) are illustrations, not a taxonomy TPLCo has established (Q4's "do not invent" principle applied here). The migration creates an **empty** table. The four examples appear only in `supabase/seed.sql` for demonstration. TPLCo's first real contexts are created in production by a Principal Architect.

### 13.3 Why this

- **Why DSA OS:** the Development Architecture Method is applied across very different development environments. Without context, method use cannot be compared.
- **Why Phase 6:** the snapshot on each Method Application must exist from the first application, or those applications are uninterpretable for learning.
- **Why not document management:** it is a classification used to filter applicability and to group outcomes, not content.
- **Relation to Architecture:** it classifies the engagement and the practice. It is **not** an architecture element and is **not** related to elements. What the development _is_ remains the architecture's job (Institution, Ecosystem Actor, Development Initiative).
- **Provenance for learning:** declared applicability, the engagement's contexts, and each application's snapshot are the three facts learning compares.

---

## 14. Standards model

### 14.1 Methodological Standards (Q4)

A **Standard-form Method Asset** is TPLCo practice: what TPLCo judges work, architecture or readiness against. It is versioned, published and immutable like every asset.

- **Structure:** ordered criteria rows (`standard_version_criteria`), each with:
  - `key`;
  - `statement`: the criterion;
  - optional `guidance`: how to judge it;
  - optional `scale`: text describing levels, if the Standard is scaled.
- **Where it may be judged:** `judged_in` is a set of review, completion and assessment. It is guidance only.

A Standard is **used**:

- by a Method version citing it in its completion criteria;
- by a Method Application recording it as a used component;
- by an element carrying `judged_against` lineage. The element may be a Review (the review judged work against this Standard), a core object, or an Implementation Initiative.

A Standard **never computes a verdict**. Judgment stays with the architect (ADR-0036).

**No reusable Standards are seeded in the migration.** One seed-only demonstration Standard (Capability Readiness Scale) exists in `seed.sql`. This follows Q4: "Do not invent standards that TPLCo has not actually established."

### 14.2 Why this is not the same as engagement standards

| Methodological Standard                             | Engagement acceptance criterion (§15)                                |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| TPLCo practice, reused across engagements           | Specific to one engagement's architecture                            |
| Authored and published by TPLCo methodology holders | Authored by engagement architects; agreed with the client            |
| Internal (protected IP)                             | Client-visible once agreed, on published client-visible architecture |
| Versioned in the Method Library                     | Fixed once agreed; revised by supersession                           |
| Answers "is this good work by TPLCo's standard?"    | Answers "does this meet what this development agreed success means?" |

Keeping them separate prevents two failures:

- **leakage of IP:** a client-visible criterion copied from a protected Standard;
- **governance by the library:** a library change silently altering what an engagement agreed.

An acceptance criterion _may_ record the Standard version and criterion that informed it (an internal-only field on the criterion). The Standard informs the criterion; it never is the criterion, and the reference is never client-visible (D20, D29).

### 14.3 Why this

- **Why DSA OS:** reviews and validation already happen (Phase 5). Standards make "against what?" explicit and reusable.
- **Why Phase 6:** Standards are a Method Library form. Without one, Q3's five forms are incomplete.
- **Why not document management:** criteria rows are citable, pinned and recorded as used; they are not a PDF.
- **Relation to Architecture:** judged against, never embedded.
- **Provenance for learning:** every `judged_against` row pins the exact Standard version used in a judgment.

---

## 15. Engagement acceptance criteria

_Revised after Kerrick's final review: D20 approved for Phase 6; placement reconsidered._

### 15.1 The gap, as the repository actually has it

- **Validation targets.** Phase 5's only validation is a `validates` relationship from a held Review to an **Implementation Initiative**. It is written only by `record_review_validation`, and `relationship_rules` allows no other target. The Review must first examine the initiative, or a core object the initiative `implements` (ADR-0036).
- **Validation pins nothing.** A `validates` row is an ordinary relationship: it carries provenance and timestamps, not an element version. It therefore does not record what the initiative, or the objects it implements, said at the moment of validation.
- **The system cannot answer "validated against what?"** It can only point to prose.

### 15.2 What the concept needs to preserve

Kerrick's chain:

> Architecture → agreed criterion → Implementation → Evidence → Review → Validation

Tested against that chain, the **minimum** a criterion needs is:

| Need                                                | Required in Phase 6? | Why                                                                                                 |
| --------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| Durable identity that survives edits to its element | **Yes**              | A validation must point at _this_ criterion, not at whatever the element says today                 |
| The architecture it governs                         | **Yes**              | One governed element: the initiative, or a core object an initiative implements                     |
| Criterion text, fixed once agreed                   | **Yes**              | "Validated against" is meaningless if the text can change afterward                                 |
| Who agreed it, and when it became applicable        | **Yes**              | This is what distinguishes a criterion from an architect's note                                     |
| Revision history                                    | **Yes, minimally**   | Supersession (new criterion replaces old) rather than edit-in-place                                 |
| Which criteria a validation was made against        | **Yes**              | Captured at the moment of validation                                                                |
| An optional reusable Standard that informed it      | **Yes, internal**    | Q4's split: the Standard informs, it is not the criterion                                           |
| Per-criterion evidence links                        | **No**               | Evidence already attaches to checkpoints and initiatives (Phase 5). The validation note may cite it |
| Per-criterion verdict or score                      | **No**               | Validation remains one judgment (ADR-0036)                                                          |

### 15.3 Options compared

**Option A: `statement_kind = acceptance_criterion`** (the original recommendation).

- **For:**
  - reuses statements, provenance, evidence links and client snapshots;
  - one enum value.
- **Against:**
  - Statements are edited in place (`architecture_statements.body` is mutable). Their history survives only inside element-version snapshots, and only if a version was published between the edit and the validation.
  - `validates` pins no version, so a validation cannot say which criterion text it was judged against.
  - Agreement would be the whole element's version approval. This conflates "the client approved this Capability's description" with "the client agreed these are the success criteria".
  - A Standard can be cited only at the element level (lineage), not per criterion.
- **Verdict:** preserves most of the semantics on paper, but loses the two things that make a criterion a criterion: fixed agreed text and validation traceability.

**Option B: a lightweight engagement-governance record** (recommended).

- One off-spine table, `acceptance_criteria`, plus one capture table, `validation_criteria`. Details in §15.4.
- **For:** all seven "Yes" needs above, with no change to the element spine, statements or snapshots.
- **Against:**
  - Two tables, a small set of operations and one client read model.
  - A permanent state enum.
  - An addition to one Phase 5 operation (D34).

**Option C: an existing Phase 3–5 primitive.**

| Candidate                 | Why it distorts the concept                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Metric + `measures`       | Metrics are architecture elements; they are quantitative; a Metric measures an outcome, it is not an agreement about what validation requires |
| Intended Outcome          | An element; it states a desired condition, not the test of whether an initiative achieved it                                                  |
| Implementation Checkpoint | Excluded by Kerrick. A checkpoint is a dated progress fact, not a standing criterion                                                          |
| Decision                  | An element with its own lifecycle and options; agreeing criteria is not a choice among options                                                |
| Architecture approval     | Pins an element version or baseline, not an individual criterion; no per-criterion identity                                                   |
| Statement (Option A)      | See above                                                                                                                                     |

No existing primitive fits without distortion.

### 15.4 Recommended model (Option B)

**`acceptance_criteria`** is an engagement-governance record. It follows the Phase 5 precedent of `implementation_checkpoints`: off-spine, engagement-scoped, written only through operations.

| Field                                                      | Purpose                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engagement_id`, `reference_code` (`ACR-nnn`)              | Durable identity, citable in review notes (D33). Engagement-scoped counter (ADR-0025)                                                                                                                                       |
| `governed_element_id`                                      | The architecture it governs. Composite FK to the element. Kind must be `implementation_initiative` or `object` (core object). `on delete cascade`: only a proposed criterion can sit on a draft, and it goes with the draft |
| `body`                                                     | Criterion text. Editable while `proposed`; **immutable once agreed** (guard trigger)                                                                                                                                        |
| `state`                                                    | `proposed` → `agreed` → `superseded` or `withdrawn`                                                                                                                                                                         |
| `agreed_with`, `agreed_on`, `agreed_recorded_by`           | Who agreed it (free text naming the party, e.g. "Executive Sponsor and steering committee"), the date it became applicable, and the TPLCo member who recorded it                                                            |
| `agreement_evidence_source_id`                             | Optional: the meeting notes or signed document recording the agreement (existing evidence source)                                                                                                                           |
| `supersedes_criterion_id`, `closure_reason`                | Revision: a new criterion supersedes an agreed one; withdrawal and supersession require a reason                                                                                                                            |
| `informing_standard_version_id`, `informing_criterion_key` | **Internal only.** The Method Library Standard version and criterion row that informed it, if any. Never returned to clients                                                                                                |
| `client_visible`                                           | Default true once agreed. The criterion reaches a client only if the governed element is published and client-visible                                                                                                       |

**`validation_criteria`** is the capture table: `validation_relationship_id`, `criterion_id`, `note`.

- When `record_review_validation` writes a `validates` relationship, it records every **agreed** criterion in force at that moment:
  - criteria on the initiative;
  - criteria on the core objects the initiative `implements`.
- The architect may add a note per criterion, saying how the evidence addressed it.
- **There is no verdict column.** The validation remains one judgment, and the ADR-0036 gate is unchanged (D34).

**Lifecycle rules:**

| Transition                       | Capability                                                    | Rule                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Propose, edit, delete a proposal | `edit_architecture`                                           | Proposed criteria are working material and may be deleted                                                                                          |
| Agree                            | `publish_architecture`                                        | The governed element must already be published. Records party, date and recorder; freezes text and governed element                                |
| Supersede                        | `publish_architecture`                                        | Creates the replacement (proposed or agreed) and closes the old one with a reason                                                                  |
| Withdraw                         | `publish_architecture`                                        | Reason required                                                                                                                                    |
| Delete an agreed criterion       | Nobody                                                        | Agreed, superseded and withdrawn criteria are never deleted                                                                                        |
| Delete a governed draft element  | Existing Phase 3 rule (`edit_architecture`, unpublished only) | Unchanged. A draft can carry only proposed criteria, which go with it. Published elements are never deleted, so agreed criteria are never orphaned |

**Reading it:**

- **Internal.** The element page gets an "Acceptance criteria" panel. The Implementation Initiative page shows the criteria in force (its own plus those on objects it implements). The Review validation dialog shows those criteria as "Validated against", with a note field per criterion.
- **Client.** `client_acceptance_criteria(engagement)` returns the code, body, state, agreement date and governed element for agreed, client-visible criteria on published, client-visible elements. For validations the client can already see, it returns the captured criteria. **It never returns the informing Standard.**
- **Area limits.** Contributor visibility follows the governed element (ADR-0040).

### 15.5 Why the added schema is justified, and why it stays lightweight

- **Justified.** Each column answers one of the seven needs in §15.2. Without them, "validated against what?" can only be answered by prose.
- **Not an Architecture element.** It has no spine row, no versions, no relationships and no publication cycle. It is a governance fact _about_ an element, like a checkpoint is a fact about an initiative.
- **Not a Method Asset.** It is engagement-specific and agreed with the client. A Standard may inform it, recorded internally, and it never becomes the Standard (§14.2).
- **Not a task, checkpoint, Review or score.**
  - It has no assignee, due date or status beyond the agreement lifecycle.
  - It records no progress.
  - It is not held or convened.
  - It has no pass or fail.
- **Lightweight.**
  - two tables and one enum;
  - six operations: propose, update, agree, supersede, withdraw, and set the validation note;
  - one client read model;
  - one addition inside an existing Phase 5 operation.
- **What it drops from Option A.** No `acceptance_criterion` statement kind is added. The `approach` statement kind (D21) is unaffected.

### 15.6 Why this

- **Why DSA OS:** validation is already a governed act (Phase 5). Its basis must be governed too.
- **Why Phase 6:** Q4 split Standards from engagement criteria, and Kerrick approved building criteria now.
- **Why not document management:** fixed agreed text, identity, and capture at validation. A document holds none of these.
- **Relation to Architecture:** it governs an element without being one.
- **Provenance for learning:** Phase 7 can compare which criteria (and which informing Standards) were agreed, validated against and superseded.

---

## 16. IP, rights and provenance model

### 16.1 Principle (Q16)

**TPLCo owns methodology by default. Exceptions must be recorded. The system records rights and never decides them.** There is no licensing, royalty, entitlement or enforcement engine.

### 16.2 Model (D23)

| Element                     | Where                                                        | Values / shape                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Origin**                  | `method_assets.origin` (new enum `method_asset_origin`)      | `tplco_developed` (default) · `co_developed` · `client_owned` · `licensed_in` · `third_party`                                                                                                                                                                                                                                                                                                                             |
| **Rights holders**          | `method_asset_rights_holders`, append-only                   | `organization_id` (FK, when the holder is an organization in DSA OS, including `licensed_practice` organizations) **or** `external_holder_name`; `holder_role` (`owner`, `co_owner`, `licensor`, `contributor`); `agreement_reference` (text, e.g. a contract number or contract id in Phase 2); `effective_on`; `note`; `recorded_by`; `recorded_at`. A correction is a new row that marks the prior row `superseded_by` |
| **Usage restriction**       | `method_assets.usage_restriction` (text, optional)           | e.g. "May be used only in engagements with the co-developing client". Displayed on Apply as a warning. **Not enforced**                                                                                                                                                                                                                                                                                                   |
| **Handling classification** | `method_assets.ip_classification` (existing enum, unchanged) | Default `tplco_method_ip`. `licensed_third_party_source` and `public_source` remain available. **No new values**                                                                                                                                                                                                                                                                                                          |
| **Version provenance**      | `method_asset_versions`                                      | `authored_by`, `derived_from_version_id` (a prior version of this or another asset), `external_basis` (text: e.g. "Adapted from ISO 21001 clause 7"), `change_summary`, learning sources (§11.7)                                                                                                                                                                                                                          |

**Why origin and rights are separate from `ip_classification`.** `ip_classification` answers _how must this be handled_. Origin and rights answer _who owns it and on what terms_. A co-developed method is still handled as protected method IP. Merging the two would force a new classification value for each ownership case. It would also make every Phase 3 handling rule depend on ownership.

**Co-developed or client-owned methodology is still internal.** Client users do not gain library access because they co-own an asset. Sharing content with a co-owner remains an out-of-system, agreement-governed act in Phase 6 (§30).

### 16.3 Provenance across the system

- **Asset level:** origin, rights holders, derivation, external basis.
- **Version level:** author, change summary, learning sources, and the publisher with timestamp.
- **Use level:** Method Application (who, when, why, context, adaptations).
- **Element level:** typed lineage, and `methodology_derived` narrowed (§19.3).

### 16.4 Why this

- **Why DSA OS:** licensing and certification (Phase 9) and co-development with clients are part of TPLCo's model. The records have to exist before Phase 9 can govern them.
- **Why Phase 6:** the first asset needs an origin, and origin is hard to reconstruct later.
- **Why not document management:** rights are structured, append-only and linked to organizations and contracts.
- **Relation to Architecture:** none directly. Rights never flow into elements.
- **Provenance for learning:** Phase 7 can exclude or segregate assets by origin, for example not learning from client-owned methodology without permission.

---

## 17. Client-visible methodology identity

### 17.1 What clients may see (Q12, D21, D22)

| May clients see…                                                  | Phase 6                                                                                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The DAM release their engagement is conducted under               | **Yes.** Label and title only (_Development Architecture Method™ 1.1_), via `client_engagement_methodology(engagement)`. No client policy on `dam_releases` |
| A branded method name, where TPLCo has chosen to name it          | **Yes, through authored approach statements only** (§17.2)                                                                                                  |
| Method content, stages, instruments, standards, templates         | **Never**                                                                                                                                                   |
| Method Applications, practitioner notes, stage notes, adaptations | **Never**                                                                                                                                                   |
| Method lineage on elements                                        | **Never**                                                                                                                                                   |
| Development Contexts                                              | **No** (§13.2)                                                                                                                                              |
| Asset origin and rights                                           | **No**, including for a client that co-owns the asset (§16.2)                                                                                               |

### 17.2 Approach statements, not a `client_visible_name` field

**Recommendation.** A new `statement_kind` value, **`approach`**, that an architect writes on the element concerned. It follows existing statement rules: client-visible when the element and the statement are published, versioned in `client_snapshot`, and carrying provenance. Example on a Capability Gap:

> Assessed using TPLCo's Capability Readiness Diagnostic™, through leadership interviews and a document review.

- **The approved name is guidance, not data flow.** Each asset version carries two internal fields:
  - `identity_disclosure`: `internal_only` or `may_be_named`;
  - `disclosable_name`, e.g. "Capability Readiness Diagnostic™".
- **Authoring help.** When an architect writes an approach statement on an element linked to a Method Application, the editor offers "Insert approved name" for assets marked `may_be_named`. It warns (and does not block) when an `internal_only` asset's title appears in client-visible text.
- **ADR-0022 is unchanged.** No client read model ever reads a Method Library table (other than the release label in §17.1). Naming is always an explicit, authored, published, approvable act. It is never automatic.

**Why not `client_visible_name` projected automatically.** Automatic projection would create a path from the library into client snapshots, which ADR-0022 exists to prevent. It would also name methods on elements the architect never chose to annotate. And it would make a library edit silently change client-visible text. The approach-statement route satisfies Q12 ("naming must be explicit, not automatic") with no new client data path.

**Cost.** One more permanent `statement_kind` value (§36).

---

## 18. Project Intelligence integration

### 18.1 Principle: the library describes, the application records, the element exists once

Project Intelligence records (Assumption, Risk, Constraint, Dependency, Decision, Recommendation, and Opportunity from D3) remain ordinary spine elements, with all Phase 4 rules intact.

- **Phase 6 never creates a PI record automatically.** A method may _declare_ that it can produce Risks and Recommendations (`method_version_outputs`). An architect creates each record through the existing Phase 4 operations.
- **The link is added by the Method Application.** The architect links the application to the record with the role `produced`, `revised` or `examined`.
- **No duplicate record type exists.** There is no "method finding" or "method recommendation" type.

### 18.2 Integration points

| Need                                                                 | Mechanism                                                                                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A Method surfaced a Risk                                             | Application → Risk, role `produced`. The Risk's own provenance may be `architect_judgment` or `architect_observation` with evidence as usual |
| A Method tested an Assumption                                        | Application → Assumption, `examined`; the Assumption is revised by the architect if its validation state changed (Phase 4), then `revised`   |
| A Decision was informed by method results                            | Application → Decision, `informed`. The Decision's rationale remains its own statement                                                       |
| A Recommendation came from a Method                                  | Application → Recommendation, `produced`. The Recommendation keeps Phase 4 lineage (`addresses`, `recommends`, …)                            |
| "Which of this engagement's Risks came from structured method work?" | Read model `method_application_register` joined through `method_application_elements`                                                        |

### 18.3 Provenance values

- `methodology_derived` is **not** used on PI records created by method work.
- The **Method Application link** is the practice provenance.
- The **statement provenance** remains the epistemic provenance: observation, judgment or client decision.
- This is Q15's narrow reading (§19.3).

---

## 19. Architecture Core integration

### 19.1 What changes in the Architecture Core

| Change                                                                                                                                        | Nature                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `statement_kind` + `approach`                                                                                                                 | One permanent enum value (D21)                                   |
| `element_method_lineage` + `method_asset_version_id`, + `lineage_role`                                                                        | Additive columns; backfill; trigger enforcing form ↔ role ↔ kind |
| `engagements.dam_release_id`; `methodology_version` synchronized by trigger                                                                   | Additive                                                         |
| Element publication check: a `methodology_derived` statement on an element requires `instantiates` lineage to a published Model version (D19) | New validation in the publish operation                          |
| Method lineage panel replaced by a "Practice" panel (§29.6)                                                                                   | UI                                                               |

### 19.2 What does not change

- no new element kinds;
- no new object types;
- no new relationship types or rules;
- no change to versions, baselines, approvals or visibility;
- no change to the client snapshot builder, except that the new `approach` statement kind flows through the existing statement path;
- no change to Phase 3 draft deletion: Method Application links keep a captured reference instead of blocking it (D30);
- no change to how `methodology_version` text is copied onto elements.

### 19.3 `methodology_derived`, narrowed (Q15, D19)

**Meaning:** the content was **literally taken from TPLCo's Method**. Examples:

- a strategic model instantiated as an Applied Strategic Model;
- a capability taxonomy instantiated into Capabilities.

**It does not mean** "discovered while using a method", which is ordinary observation or judgment. It also does not mean "structured by a template", which is `produced_from` lineage.

**Enforcement:** publishing an element fails if it has a `methodology_derived` statement or provenance and no `instantiates` lineage to a published Model version.

**Seed check.** The Meridian element _Anchor-led cluster development_ (Applied Strategic Model, `methodology_derived`) has lineage to _Strategic Model Library Index_. That index is **not** a Model and is not turned into one (D28). The backfill keeps it as a legacy asset and turns the row into `legacy_derived_from` lineage. The element is already published, and published versions are not re-validated, so nothing breaks. Its next published version will need `instantiates` lineage to a proper Model, which the build-time seed authors (_Anchor-led cluster development model 1.0_). The capability element's lineage to _Capability Readiness Diagnostic_ also becomes `legacy_derived_from`, and its statements are not `methodology_derived`. **The seed stays valid under the narrow reading without rewriting history.**

### 19.4 Architecture is never replaced

Every fact about the development remains an element. The Method Library can be removed conceptually and the architecture still stands complete. Practice links only annotate how the architecture came to be.

---

## 20. Phase 5 integration

| Phase 5 concept                          | Phase 6 integration                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implementation Initiatives**           | Application → Initiative: `examined` (a readiness assessment examined it), `revised` (method work materially changed its scope), `informed` (results supplied to its owner). A Method never _initiates_ an initiative: `initiates` remains Decision/Recommendation → Initiative (ADR-0034). An Initiative may carry `judged_against` lineage to a Standard                                                                                                                  |
| **Implementation Checkpoints**           | No direct link in Phase 6. Checkpoints already reference evidence and reviews. A checkpoint's evidence may be `gathered` by a Method Application, which gives an indirect trace                                                                                                                                                                                                                                                                                             |
| **Evidence**                             | `method_application_evidence` (`drew_on`, `gathered`, optional Instrument version). Evidence remains "what supports claims" (Q1). Methods are never evidence, and evidence is never a Method Asset                                                                                                                                                                                                                                                                          |
| **Reviews**                              | **Reviews do not `examine` Method Applications in Phase 6 (D24).** `examines` is an element-to-element relationship, and applications are off-spine. Instead: (a) Application → Review, `informed` (results brought to the Review); (b) Review → Standard, `judged_against` lineage; (c) a Review may examine the _elements_ an application produced, as today. A formal methodological review (reviewing how well a method was applied) is Phase 7 governance, not Phase 6 |
| **Deliverables**                         | Deliverable → Template, `produced_from` lineage (pinned version). Application → Deliverable, `produced`. Confidentiality and visibility are unchanged. Template content never enters the deliverable file automatically (no generation)                                                                                                                                                                                                                                     |
| **Validation (`validates`)**             | The gate is unchanged (ADR-0036): a held Review validates an Implementation Initiative only. `record_review_validation` also captures the agreed acceptance criteria in force, those on the initiative and on the core objects it implements, into `validation_criteria`, with an optional note per criterion and no verdict (§15, D34)                                                                                                                                     |
| **Implementation status publication**    | Unchanged. Client status updates never mention Method Applications                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Area-limited Contributors (ADR-0040)** | Method Applications are readable to anyone with `can_read_architecture` on the engagement. **Area limits are not applied to applications in Phase 6**; a Contributor sees an application but its element links are filtered through `element_in_member_areas` in the read model. A Contributor cannot create applications without `edit_architecture` (D32)                                                                                                                 |

---

## 21. Pattern Library boundary (Q14, D25)

**Defined now; nothing converts, nothing is built.**

|                         | Method Library (Phase 6)                             | Pattern Library (later)                                                                                                      |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Holds                   | How TPLCo **works**: practice                        | What **worked** as architecture: reusable, abstracted architecture structures (e.g. "anchor-institution cluster governance") |
| Origin                  | Authored by TPLCo                                    | Abstracted from engagement architecture after completion, with client rights respected                                       |
| Unit                    | Method Asset versions                                | Pattern: an anonymized structure of object types and relationships, with conditions and evidence of results                  |
| Relation to engagements | Applied (Method Application) or instantiated (Model) | Instantiated into new architecture                                                                                           |
| Confidentiality risk    | TPLCo IP                                             | **Client-derived**: requires abstraction and consent rules                                                                   |

**Boundary rules, effective in Phase 6:**

1. The categories "system design patterns" and "governance patterns" are **not** Method Asset categories (C3).
2. A Model is not a Pattern. A Model is authored practice. A Pattern is abstracted evidence of results. A Pattern may later be _promoted_ into a Model through normal authoring, with learning sources recorded.
3. **No Phase 6 table, column or enum anticipates patterns.** The Pattern Library will reference elements and baselines, which already exist and are immutable.
4. Nothing in engagement architecture is copied into the Method Library by any Phase 6 operation.

---

## 22. Phase 7 learning and data boundary

### 22.1 What Phase 6 records, so Phase 7 can learn

| Learnable question (Kerrick §19)                      | Phase 6 facts that make it answerable                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Which methods are used most, where                    | Method Applications × asset version × engagement contexts × domains                                                 |
| Which produce implementation                          | Application → element links (`produced`, `informed`) → Phase 5 `initiates`/`implements` → initiative status history |
| Which are adapted                                     | Stage notes (`adapted`, `skipped` + reasons), component deviations                                                  |
| Which assumptions they surface, and whether they held | Application → Assumption links + Phase 4 assumption validation history                                              |
| Whether recommendations were accepted                 | Application → Recommendation → Phase 4 status history → Decisions                                                   |
| What changed between versions and why                 | Change summaries, learning sources, `derived_from_version_id`                                                       |
| Whether a method fits a context                       | Declared version contexts vs. application context snapshots vs. outcomes                                            |
| Declared vs. actual outputs                           | `method_version_outputs` vs. application element links                                                              |

### 22.2 What Phase 6 deliberately does not do

- **No scoring** of methods, applications or practitioners.
- **No aggregate dashboards or analytics** beyond simple counts on the asset page ("where used").
- **No automated attribution** of outcomes to methods.
- **No cross-engagement pattern extraction.**
- **No AI:** no prompts (Q17), no generation, no summarization of applications.

### 22.3 Data rules for later learning, set now

- **Client confidentiality.** Learning across engagements must respect each engagement's classification (ADR-0013). Phase 6 adds no cross-engagement read path for non-TPLCo users. The only cross-engagement read models are internal and show titles, codes and counts.
- **Origin.** Client-owned and licensed-in methodology is marked (§16). Phase 7 must decide whether it may learn from such assets.
- **Practice history survives deletion.** Published elements are never deleted. When an unpublished draft linked to a Method Application is deleted, the link keeps a captured reference (code, kind, type, title) and a removal timestamp (D30), so learning still sees what the work produced, and drafts stay disposable.

---

## 23. Schema changes (summary)

Proposed only. Nothing below exists until the decisions are approved and a migration is written.

**New enums.** Permanent values, listed in §36:

| Enum                               | Values                                                                          | Decision |
| ---------------------------------- | ------------------------------------------------------------------------------- | -------- |
| `method_asset_form`                | `method`, `model`, `standard`, `instrument`, `template`                         | D1       |
| `method_asset_version_lifecycle`   | `draft`, `published`, `superseded`, `retired`                                   | D6       |
| `dam_release_status`               | `draft`, `published`, `superseded`, `retired`                                   | D7       |
| `method_application_state`         | `planned`, `in_progress`, `completed`, `discontinued`                           | D17      |
| `method_application_element_role`  | `examined`, `produced`, `revised`, `informed`                                   | D14      |
| `method_application_evidence_role` | `drew_on`, `gathered`                                                           | D14      |
| `method_stage_treatment`           | `followed`, `adapted`, `skipped`                                                | D17      |
| `method_lineage_role`              | `instantiates`, `produced_from`, `judged_against`, `legacy_derived_from`        | D18      |
| `method_asset_origin`              | `tplco_developed`, `co_developed`, `client_owned`, `licensed_in`, `third_party` | D23      |
| `method_rights_role`               | `owner`, `co_owner`, `licensor`, `contributor`                                  | D23      |
| `method_identity_disclosure`       | `internal_only`, `may_be_named`                                                 | D21      |
| `practice_capability`              | `author_methodology`, `publish_methodology`                                     | D10, D11 |
| `acceptance_criterion_state`       | `proposed`, `agreed`, `superseded`, `withdrawn`                                 | D20      |

**Extended enums:**

- `statement_kind`: adds `approach` (D21). No `acceptance_criterion` statement kind (D20).
- `activity_action`: adds values as needed for the new operations, following the Phase 5 precedent.

**No changes** to:

- `architecture_domain`, `element_kind`, `provenance_type`, `ip_classification`, `organization_type`;
- `engagement_capability`: methodology capabilities are **not** engagement capabilities (D10). The engagement capability tables and functions are untouched.

**Check-constraint values (reversible, not enums):** `method_assets.status` adds `legacy` (D28).

**New reference tables** (migration-managed):

- `method_asset_categories` (D4).

**New governed table** (operation-managed, empty in migration):

- `development_contexts` (D15).

**Changed tables:**

- `method_assets`: reshaped (§24).
- `element_method_lineage`: typed and pinned (§12.5).
- `engagements`: `dam_release_id` added.

**Storage:** a new private bucket, **`method-library`**, for Template and Instrument files.

- Internal read only.
- Writes only through operations by `author_methodology` holders on draft versions.
- It is not `engagement-files`, because method IP must never share a bucket whose policies grant client reads.

## 24. Tables and important fields

Conventions throughout:

- `uuid` primary keys;
- `created_by` / `created_at`;
- `updated_at` where mutable;
- activity logging via the existing `private.log_activity` pattern;
- composite `(id, engagement_id)` foreign keys wherever a row belongs to an engagement.

### Method Library (TPLCo-wide)

| Table                                  | Important fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `method_assets`                        | `key` (unique slug, immutable), `title`, `form` (immutable after the first publish; null only while `legacy`), `category_key` → `method_asset_categories`, `origin`, `usage_restriction`, `ip_classification` (default `tplco_method_ip`), `status` (`active`/`retired`), `current_version_id` (the published version, maintained by operations), `steward_user_id` (renamed from `owner_user_id`, to avoid confusion with IP ownership)                                                                                                                                                                                                                                                                  |
| `method_asset_categories`              | `key`, `label`, `description`, `sort_order`, `active`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `method_asset_versions`                | `asset_id`, `legacy` (backfilled only, D28), `version_no` (monotonic), `version_label` (unique per asset, set at publish), `lifecycle`, `architectural_question`, `summary`, `applicability`, `exclusions`, `prerequisites`, `expected_inputs`, `evidence_expectations`, `practitioner_roles`, `completion_criteria`, `review_implications`, `implementation_implications`, `practitioner_instructions` (protected), `internal_notes`, `modes` (subset of discover/define/assess/validate/govern, Method only), `identity_disclosure`, `disclosable_name`, `change_summary`, `derived_from_version_id`, `external_basis`, `authored_by`, `published_by`, `published_at`, `effective_on`, `retired_reason` |
| `method_version_domains`               | `version_id`, `domain`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `method_version_contexts`              | `version_id`, `context_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `method_version_stages`                | `version_id`, `ordinal`, `key`, `title`, `purpose`, `guidance` (protected)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `method_version_outputs`               | `version_id`, `output_kind` (`element_kind`), `object_type_key` (for kind `object`), `deliverable_type` (for kind `deliverable`), `note`. A check ensures exactly the relevant key is set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `method_version_components`            | `version_id`, `component_version_id` (published; form ≠ method), `note`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `standard_version_criteria`            | `version_id`, `ordinal`, `key`, `statement`, `guidance`, `scale`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `standard_version_judged_in`           | `version_id`, `setting` (`review`, `completion`, `assessment`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `instrument_version_evidence_types`    | `version_id`, `evidence_source_type`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `template_version_spec`                | `version_id` (PK), `deliverable_type`, `section_outline` (ordered text rows in `template_version_sections`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `method_version_files`                 | `version_id`, `storage_path` (bucket `method-library`), `file_name`, `content_type`, `byte_size`; Template/Instrument only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `method_version_learning_sources`      | `version_id`, `method_application_id`, `note`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `method_asset_rights_holders`          | §16.2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `dam_releases`                         | `version_label` (unique), `title`, `status`, `summary`, `change_summary`, `effective_on`, `supersedes_release_id`, `vocabulary_record` (jsonb, system-built at publish), `published_by`, `published_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `dam_release_members`                  | `release_id`, `asset_id`, `asset_version_id`; unique (`release_id`, `asset_id`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `development_contexts`                 | `key` (immutable), `label`, `definition`, `status`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `development_context_revisions`        | `context_id`, `prior_label`, `prior_definition`, `reason`, `revised_by`, `revised_at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `practice_role_capability_defaults`    | `role` (internal roles only), `capability`; migration-only, like `role_capability_defaults`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `practice_member_capability_overrides` | `organization_member_id` (TPLCo membership), `capability`, `granted`, `reason`, `created_by`, `created_at`; same trigger and audit pattern as `engagement_member_capability_overrides`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Engagement-scoped

| Table                              | Important fields                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engagements` (changed)            | + `dam_release_id`                                                                                                                                                                                                                                                                                                            |
| `engagement_development_contexts`  | `engagement_id`, `context_id`, `is_primary` (partial unique: one primary)                                                                                                                                                                                                                                                     |
| `method_applications`              | `engagement_id`, `reference_code` (`MUS-nnn`), `method_asset_version_id`, `dam_release_id` (at start), `title`, `selection_reason`, `architectural_question`, `engagement_wide`, `state`, `started_on`, `closed_on`, `completion_statement`, `retrospective`, `discontinued_reason`, `continues_application_id`               |
| `method_application_practitioners` | `application_id`, `engagement_member_id`, `role` (`lead`/`contributor`); exactly one lead while open                                                                                                                                                                                                                          |
| `method_application_contexts`      | `application_id`, `context_id`                                                                                                                                                                                                                                                                                                |
| `method_application_domains`       | `application_id`, `domain`                                                                                                                                                                                                                                                                                                    |
| `method_application_stage_notes`   | `application_id`, `stage_id` (must belong to the pinned version), `treatment`, `reason`, `note`                                                                                                                                                                                                                               |
| `method_application_elements`      | `application_id`, `engagement_id`, `element_id` (nullable), `role`, `observed_version_id` (set at closure), `captured_reference_code`, `captured_kind`, `captured_object_type_key`, `captured_title`, `captured_at`, `element_removed_at`, `note`; FK (`element_id`, `engagement_id`) `on delete set null (element_id)` (D30) |
| `method_application_evidence`      | `application_id`, `engagement_id`, `evidence_source_id`, `role`, `instrument_version_id`, `note`                                                                                                                                                                                                                              |
| `method_application_assets`        | `application_id`, `asset_version_id` (published; form ≠ method), `deviation_note`                                                                                                                                                                                                                                             |
| `method_application_addenda`       | `application_id`, `body`, `created_by`, `created_at`; append-only                                                                                                                                                                                                                                                             |
| `acceptance_criteria`              | `engagement_id`, `reference_code` (`ACR-nnn`), `governed_element_id`, `body`, `state`, `agreed_with`, `agreed_on`, `agreed_recorded_by`, `agreement_evidence_source_id`, `supersedes_criterion_id`, `closure_reason`, `informing_standard_version_id`, `informing_criterion_key` (internal), `client_visible` (§15.4)         |
| `validation_criteria`              | `validation_relationship_id`, `criterion_id`, `note`; written by `record_review_validation` (D34)                                                                                                                                                                                                                             |
| `element_method_lineage` (changed) | + `method_asset_version_id`, + `lineage_role`; `method_version` text retained read-only; unique becomes (`element_id`, `method_asset_version_id`, `lineage_role`)                                                                                                                                                             |

## 25. Operations

All writes go through `security definer` functions in `public`. They check capability through `private.*`, validate, log activity and return the row. **There are no direct table write grants to `authenticated`**, the Phase 5 pattern (ADR-0034). Reads use RLS policies plus read-model functions.

| Operation                                                                                                         | Capability                                  | Key rules                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_method_asset(key, title, form, category, origin, …)`                                                      | `author_methodology`                        | Creates asset + draft v1                                                                                                                                                                                      |
| `update_method_asset(…)`                                                                                          | `author_methodology`                        | Title, category, steward, usage restriction; `form` only before first publish                                                                                                                                 |
| `create_method_asset_version(asset, from_version)`                                                                | `author_methodology`                        | One draft per asset; copies the published version's content and children                                                                                                                                      |
| `update_method_asset_version(…)`, child add/remove functions                                                      | `author_methodology`                        | Draft only (guard trigger backstops)                                                                                                                                                                          |
| `publish_method_asset_version(version, label, change_summary)`                                                    | **`publish_methodology`**                   | Form requirements met (§7.2, §8.1); label unique; supersedes prior published version; sets `current_version_id`                                                                                               |
| `retire_method_asset_version(version, reason)`                                                                    | **`publish_methodology`**                   | Published only                                                                                                                                                                                                |
| `retire_method_asset(asset, reason)`                                                                              | **`publish_methodology`**                   | Retires current version                                                                                                                                                                                       |
| `record_method_rights_holder(…)`, `supersede_rights_holder(…)`                                                    | **`publish_methodology`**                   | Append-only                                                                                                                                                                                                   |
| `attach_method_version_file(…)` / `remove_…`                                                                      | `author_methodology`                        | Draft, Template/Instrument only                                                                                                                                                                               |
| `create_dam_release(label, title)`, `set_dam_release_member(release, version)`, `remove_…`                        | `author_methodology`                        | Draft only; published versions only; one per asset                                                                                                                                                            |
| `publish_dam_release(release, change_summary)`                                                                    | **`publish_methodology`**                   | Freezes; builds vocabulary record; supersedes prior published release                                                                                                                                         |
| `retire_dam_release(release, reason)`                                                                             | **`publish_methodology`**                   | Cannot retire a release any active engagement is on                                                                                                                                                           |
| `create_/revise_/retire_development_context(…)`                                                                   | **`publish_methodology`**                   | Revisions append-only                                                                                                                                                                                         |
| `set_practice_capability_override(member, capability, granted, reason)`                                           | **`publish_methodology`**; never on oneself | Capability-based (D11); last-holder guard; logged                                                                                                                                                             |
| `adopt_legacy_method_asset(asset, form)`                                                                          | **`publish_methodology`**                   | Legacy assets only; sets the form and opens the first proper draft (D28)                                                                                                                                      |
| `propose_acceptance_criterion(element, body, informing_standard?)`, `update_…`, `delete_…`                        | `edit_architecture`                         | Proposed state only; governed element must be an Implementation Initiative or a core object                                                                                                                   |
| `agree_acceptance_criterion(criterion, agreed_with, agreed_on, evidence?)`                                        | `publish_architecture`                      | Governed element must be published; freezes text                                                                                                                                                              |
| `supersede_acceptance_criterion(criterion, new_body, reason)`, `withdraw_acceptance_criterion(criterion, reason)` | `publish_architecture`                      | Agreed criteria only; append-only history                                                                                                                                                                     |
| `set_validation_criterion_note(validation, criterion, note)`                                                      | `publish_architecture`                      | Note only; no verdict (D34)                                                                                                                                                                                   |
| `set_engagement_dam_release(engagement, release, reason)`                                                         | `publish_architecture` on the engagement    | Published release only                                                                                                                                                                                        |
| `set_engagement_development_contexts(engagement, contexts[], primary)`                                            | `edit_architecture` on the engagement       | Active contexts only                                                                                                                                                                                          |
| `start_method_application(engagement, version, title, reason, …)`                                                 | `edit_architecture`                         | Version: form `method`, lifecycle `published`; snapshots release and contexts; lead = caller unless given; reason required if the version is not in the engagement's release (D9); warns on usage restriction |
| `update_method_application(…)`, practitioners, contexts, domains, stage notes, assets                             | `edit_architecture`                         | Open states only                                                                                                                                                                                              |
| `link_method_application_element(app, element, role, note)` / `unlink_…`                                          | `edit_architecture`                         | Role/kind rules (§12.3); same engagement                                                                                                                                                                      |
| `link_method_application_evidence(…)` / `unlink_…`                                                                | `edit_architecture`                         | Instrument version must be a used component or declared component                                                                                                                                             |
| `begin_method_application(app)`                                                                                   | `edit_architecture`                         | `planned` → `in_progress`                                                                                                                                                                                     |
| `complete_method_application(app, completion_statement, retrospective)`                                           | `edit_architecture`                         | §11.4; freezes                                                                                                                                                                                                |
| `discontinue_method_application(app, reason, continued_by?)`                                                      | `edit_architecture`                         | Freezes                                                                                                                                                                                                       |
| `add_method_application_addendum(app, body)`                                                                      | `edit_architecture`                         | Closed applications only                                                                                                                                                                                      |
| `add_method_version_learning_source(version, app, note)`                                                          | `author_methodology`                        | Draft version; closed application                                                                                                                                                                             |
| `record_method_lineage(element, version, role, note)` / `remove_…`                                                | `edit_architecture` (existing)              | Replaces direct lineage inserts; form ↔ role ↔ kind; published version                                                                                                                                        |

## 26. Read models

| Read model                                  | Audience                           | Returns                                                                                                                                                          |
| ------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `method_library(filters)`                   | Internal                           | Assets with current published version, form, category, domains, contexts, question, release membership, use count                                                |
| `method_asset_detail(asset, version?)`      | Internal                           | Version content and children; version history; rights; releases containing it; learning sources                                                                  |
| `method_usage(asset)`                       | Internal                           | Applications, lineage rows and releases per version, across engagements; titles, codes and counts only (§22.3)                                                   |
| `dam_release_contents(release)`             | Internal                           | Members; diff against the prior release (added, removed, re-versioned); engagements on the release                                                               |
| `method_application_register(engagement)`   | Internal (`can_read_architecture`) | Applications, state, method and version, lead, dates, link counts                                                                                                |
| `method_application_detail(application)`    | Internal                           | Everything in §11, with expected vs. actual outputs; element links filtered by area for area-limited members                                                     |
| `element_practice_context(element)`         | Internal                           | Applications linked to the element (role, method, version, state) and typed lineage                                                                              |
| `client_acceptance_criteria(engagement)`    | **Client**                         | Agreed, client-visible criteria on published client-visible elements, and the criteria captured for validations the client can see; never the informing Standard |
| `client_engagement_methodology(engagement)` | **Client**                         | `{ release_label, release_title }` for the engagement's release, or null. Nothing else                                                                           |

## 27. Capabilities

_Revised after Kerrick's final review (D10). Neither approach is implemented._

### 27.1 The requirement

- `author_methodology` and `publish_methodology` are **TPLCo-wide**. There is no engagement to hold them on.
- Authority is **capability-based**, never a hard-coded role check.
- A System Administrator gets **no methodological authority** by being a System Administrator.
- Prefer **one coherent capability philosophy**, without destabilizing the Phase 1–5 engagement model.

### 27.2 What the current engagement machinery is

From `20260929233000_engagement_capabilities.sql` and its successors:

| Part                                              | Shape                                                                                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `engagement_capability` enum                      | 18 values, all meaningful per engagement                                                                                                                                                                                 |
| `role_capability_defaults (role, capability)`     | Migration-only reference data; `capability` is typed `engagement_capability`; a check ties side-restricted capabilities to the role's side                                                                               |
| `engagement_member_capability_overrides`          | `engagement_member_id` **not null** FK to `engagement_members`; `engagement_id` **not null** (denormalized for RLS and the audit log); `granted boolean`; `reason`                                                       |
| `private.member_has_capability(member, cap)`      | Override wins; else role default                                                                                                                                                                                         |
| `private.has_engagement_capability(eng, cap)`     | Requires an active engagement membership with a valid side; plus the role-based portfolio financial exception for `view_financials`                                                                                      |
| `public.my_engagement_capabilities(eng)`          | Iterates `enum_range(null::engagement_capability)`                                                                                                                                                                       |
| `private.can_manage_capability(eng, member, cap)` | Who may grant or revoke: a role-based rule per capability family (Principal Architects only for `edit_architecture` and `publish_architecture`, never self)                                                              |
| App mirror                                        | `src/domain/capabilities/catalog.ts` (`ENGAGEMENT_CAPABILITIES`, labels typed `Record<EngagementCapability, string>`), the engagement capability matrix, and the Zod override schema (`z.enum(ENGAGEMENT_CAPABILITIES)`) |
| Tests                                             | `03_engagement_capabilities` asserts per-role default counts                                                                                                                                                             |

### 27.3 Approach U: extend the engagement machinery with a scope

Add `author_methodology` and `publish_methodology` to `engagement_capability`, and a `capability_scope(cap)` function returning `engagement` or `practice`, the same pattern as `capability_side`.

| Area           | Consequence                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enum           | Two permanent values in an enum named for engagements. They can never be removed                                                                                                                                                                                                                                                                 |
| Defaults       | Rows in `role_capability_defaults` work unchanged. Per-role counts in suite 03 change                                                                                                                                                                                                                                                            |
| Overrides      | The override table cannot hold a TPLCo-wide override: both `engagement_member_id` and `engagement_id` are not null. Either they become nullable, with a new `organization_member_id` and an exclusive-or check (**the nullable engagement semantics Kerrick named**), or a second override table is added anyway                                 |
| Checks         | `has_engagement_capability(eng, 'publish_methodology')` would return true for any engagement a Principal Architect belongs to and false elsewhere. That is meaningless, so it must refuse practice values explicitly. Library RLS still needs a check with no engagement argument: either `has_engagement_capability(null, …)` or a new function |
| Listing        | `my_engagement_capabilities` would list practice capabilities per engagement unless filtered                                                                                                                                                                                                                                                     |
| Administration | `can_manage_capability` gains a third branch keyed on scope                                                                                                                                                                                                                                                                                      |
| App            | Every use of `ENGAGEMENT_CAPABILITIES` (the matrix, the engagement page and the Zod schema) must filter out practice values, or the matrix would offer "Publish methodology" as a per-engagement toggle. The labels map must gain entries                                                                                                        |
| RLS clarity    | Every existing policy keeps working, but readers must now know that some values of the engagement enum are not engagement capabilities                                                                                                                                                                                                           |

**Assessment:** it touches the enum, the override table, three functions, three UI or schema sites and one test suite, and it needs nullable engagement semantics or a second table anyway. **These are the distortions Kerrick asked to avoid.**

### 27.4 Approach P: one capability model, two membership scopes (recommended)

**The unifying rule** (to be stated in ADR-0044):

> A capability is always held **through a membership**, and its scope is the scope of that membership.
>
> - An engagement membership (`engagement_members`) carries **engagement capabilities**.
> - A TPLCo organization membership (`organization_members` in the single TPLCo organization) carries **practice capabilities**.
>
> Both scopes use the same three parts and the same semantics:
>
> 1. role defaults as migration-only reference data;
> 2. per-membership overrides with `granted` and a reason, logged;
> 3. one private check function.

This is **one philosophy with two storage scopes**, not a second architecture. Storage is separate only because the capability column is typed, and because the thing an override attaches to differs. Nothing is nullable.

| Part                      | Engagement scope (unchanged)                  | Practice scope (new, mirrors it)                                                                                                                  |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability enum           | `engagement_capability`                       | `practice_capability`: `author_methodology`, `publish_methodology`                                                                                |
| Role defaults             | `role_capability_defaults (role, capability)` | `practice_role_capability_defaults (role, capability)`; internal roles only (check)                                                               |
| Holding membership        | `engagement_members` row                      | Active `organization_members` row in the TPLCo organization                                                                                       |
| Overrides                 | `engagement_member_capability_overrides`      | `practice_member_capability_overrides (organization_member_id, capability, granted, reason)`; same trigger pattern, same audit logging            |
| Effective check           | `private.has_engagement_capability(eng, cap)` | `private.has_practice_capability(cap)`                                                                                                            |
| Caller's list (UI)        | `public.my_engagement_capabilities(eng)`      | `public.my_practice_capabilities()`                                                                                                               |
| Who administers overrides | `private.can_manage_capability` (existing)    | `private.can_manage_practice_capability(member, cap)`: **holders of `publish_methodology`**, never on themselves. Capability-based, no role check |
| App mirror                | `catalog.ts` (unchanged)                      | `src/domain/capabilities/practice.ts`, same structure                                                                                             |

**Consequences:**

- **Engagement machinery:** no change to the engagement enum, tables, functions, UI or suite 03.
- **Schema:** one enum, two tables and three functions, all new.
- **RLS:** every Method Library write goes through operations that call `has_practice_capability`. Library reads remain `is_internal()`. No policy anywhere mixes scopes.
- **Operations:** each methodology operation names exactly one practice capability (§25).
- **Safety:** the last effective holder of `publish_methodology` cannot be revoked. Only TPLCo memberships can hold practice capabilities, so client and licensed-practice users never qualify.
- **Future use:** any later TPLCo-wide authority (for example Pattern Library curation or licensing administration) adds a `practice_capability` value, never an engagement one.
- **Deliberately not changed:** the role-based portfolio financial exception (`has_portfolio_financial_access`) could later move into the practice scope. Phase 6 leaves it alone, because the engagement model is stable.

### 27.5 Defaults (D11)

| Practice capability   | Principal Architect | Architect | Researcher | System Administrator | Project / Finance Administrator | Client roles |
| --------------------- | ------------------- | --------- | ---------- | -------------------- | ------------------------------- | ------------ |
| `author_methodology`  | ✓                   | ✓         | —          | —                    | —                               | never        |
| `publish_methodology` | ✓                   | —         | —          | **—**                | —                               | never        |

- **Viewing the library** remains every internal member's right, unchanged (`is_internal()`).
- **System Administrators** hold no practice capability by default. One can receive it only by an explicit, logged override from an existing `publish_methodology` holder.

### 27.6 Engagement-side capabilities

**No new engagement capabilities.**

- Method Applications use `edit_architecture` (write) and `can_read_architecture` (read).
- Acceptance criteria use `edit_architecture` to propose and `publish_architecture` to agree (§15).
- Engagement release changes use `publish_architecture`.

### 27.7 Why this

- **Why DSA OS:** Q11 separates methodological authority from system authority.
- **Why Phase 6:** publishing requires it from the first asset.
- **Why not document management:** these are audited practice authorities, not folder permissions.
- **Relation to Architecture:** it never grants any architecture right.
- **Provenance for learning:** every publication records who exercised the authority.

## 28. RLS and security model

| Surface                                                                                                                                                                | Select                                                                                  | Insert / update / delete                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Library tables (assets, versions, children, releases, rights, contexts, categories, capability tables)                                                                 | `is_internal()` (active TPLCo member). **No client or licensed-practice policy at all** | None to `authenticated`; operations only                                |
| `method-library` storage bucket                                                                                                                                        | `is_internal()`                                                                         | None; upload via signed URLs issued by an operation for a draft version |
| Engagement-scoped practice and governance tables (`method_applications` and children, `engagement_development_contexts`, `acceptance_criteria`, `validation_criteria`) | `private.can_read_architecture(engagement_id)` **and** `is_internal()`                  | None; operations only                                                   |
| `element_method_lineage`                                                                                                                                               | Unchanged (`can_read_architecture`), plus `is_internal()` added                         | Direct grants **revoked**; operations only                              |
| `engagements.dam_release_id`                                                                                                                                           | Existing engagement policy (clients can read the id)                                    | Operation only                                                          |
| `client_engagement_methodology`                                                                                                                                        | `security definer`; returns label and title for members of the engagement               | —                                                                       |

**Security invariants.** Each is tested in pgTAP as a client, licensed-practice user, Researcher and System Administrator:

1. **No client or licensed-practice session can select any row from any Method Library table, practice table or storage object.** "Client users must never access Method/IP content."
2. **Client snapshots never contain any Method Library field.** The builder is unchanged, and a regression test asserts that the key sets are unchanged.
3. **The only client-readable methodology is the release label and title,** plus architect-authored `approach` statements under existing statement visibility rules. Agreed acceptance criteria reach clients only through `client_acceptance_criteria`, which never returns the informing Standard.
4. **A published version, a published release, a closed application and a revision row cannot be changed by anyone, including through operations.** This is enforced by guard triggers, not UI.
5. **No permission depends on hidden UI.** Every operation re-checks capability. UI hiding is convenience only.
6. **Capabilities, not role names,** everywhere in Phase 6, including administration of practice capability overrides (§27.4).

## 29. Internal UX

The nav placeholder "Method Library" under "Later phases" becomes a real top-level internal section. Engagement pages gain a "Method" tab.

### 29.1 Method Library home (`/internal/method-library`)

- **Search box and filters:** form, category, domain, Development Context, release, status.
- **Rows:**
  - title and form badge (Method, Model, Standard, Instrument, Template);
  - the architectural question, as the first line;
  - current version label;
  - release chips (e.g. "DAM 1.1");
  - "Used in N engagements".
- **Default view:** active assets in the latest published release.
- **Toggle:** show retired assets and assets outside any release.
- **"New asset"** is visible only to `author_methodology` holders and re-checked server-side.

### 29.2 Method Asset page

- **Header:** title, form, version selector (published history plus a draft if one exists), origin badge (hidden when `tplco_developed`), identity-disclosure marker.
- **Tabs:**
  - **Overview:** question, applicability and exclusions, domains, contexts, expected outputs, modes.
  - **Structure:** the form-specific tab: stages (Method), criteria (Standard), section outline (Template), evidence types (Instrument), and components.
  - **Practitioner guidance:** protected instructions and files, with a "TPLCo protected method IP" banner.
  - **History:** versions with change summaries, learning sources, and a diff against the previous version (field-level).
  - **Where used:** releases, applications and lineage, from `method_usage`.
  - **Rights:** origin, rights holders, restriction.
- **Draft editing:**
  - a form-aware editor with required-field checklist;
  - "Publish" opens a confirmation showing the version label, change summary, the prior version that will be superseded, and every open application pinned to the prior version (informational).

### 29.3 DAM Releases (`/internal/method-library/releases`)

- **The list shows** each release with its status and the number of engagements on it.
- **The release page shows:**
  - members table;
  - "Changes from DAM x.y" diff (added, removed, re-versioned);
  - documented vocabulary (read-only);
  - engagements on this release.
- **Draft releases** add a member picker (published versions only), with a warning when an asset's newer version exists.

### 29.4 Development Contexts (`/internal/method-library/contexts`)

- **The list shows** each context's label, definition, status and usage counts.
- **`publish_methodology` holders** can create, revise (reason required) and retire contexts.
- **Revision history** is shown inline.

### 29.5 Engagement "Method" tab (`/internal/engagements/[slug]/method`)

- **Header:**
  - the engagement's DAM release, with a change action for `publish_architecture` holders;
  - Development Contexts, edited by `edit_architecture` holders.
- **Method Applications register:** code, title, method and version, lead, state, dates, counts of produced, revised and examined elements.
- **"Apply a method":**
  - A picker filtered to Method-form published versions.
  - It ranks those in the engagement's release first, then by context fit.
  - It shows applicability, exclusions and the usage restriction.
  - The architect enters the reason (required), the question and the scope.
- **Application page:**
  - **Header:** method, version, release, state, context snapshot, practitioners.
  - **Stages:** each stage from the pinned version, rendered as a section with its guidance collapsed. For each, the architect records a treatment and a note. There are no checkboxes, percentages or due dates.
  - **Inputs:** examined elements and evidence drawn on, picked with the existing element and evidence pickers.
  - **Components used:** pre-filled from declared components; deviations are noted.
  - **Outputs:** produced, revised and informed elements. "Create element from here" opens the existing element creation flow and links the result on return. The expected vs. actual outputs panel sits alongside.
  - **Close:** Complete (completion statement, with the method's completion criteria shown) or Discontinue (reason, optional continuation). Closed applications show an addenda list.

### 29.6 Element page: the "Practice" panel

This replaces the "Method lineage" panel (lines ~521–563 of the element page).

- **"Method Applications":** role, code, method and version, state, each linked.
- **"Method lineage":** role (instantiates, produced from, judged against, legacy), asset and version.
- **Adding lineage** is form-aware. The role list depends on the element kind, and the asset picker depends on the role.
- **On an element with a `methodology_derived` statement and no `instantiates` lineage,** the panel shows a publish-blocking notice.

### 29.7 Statement editor and acceptance criteria

- **Statement editor:** the kind selector gains **Approach**, with an "Insert approved method name" menu (names from linked applications' assets marked `may_be_named`) and a warning when text matches the title of an `internal_only` asset.
- **Acceptance criteria panel** on Implementation Initiative and core object pages:
  - propose, edit and agree criteria;
  - supersede or withdraw with a reason;
  - an optional "Informed by Standard" picker (internal);
  - agreed criteria show their code, party and date.

### 29.8 Review and Deliverable touchpoints

- **Review validation dialog:** "Validated against" lists the agreed criteria in force for the initiative (its own and those on objects it implements), with a note field per criterion and no verdict. A warning appears when there are none.
- **Review page:** a "Judged against" line (Standards) and "Informed by" (Method Applications with an `informed` link).
- **Deliverable page:** "Produced from", the Template and version.

## 30. Client UX

Deliberately minimal.

- **Engagement overview:** one line, "Conducted under the **Development Architecture Method™ 1.1**", when the engagement has a release. The line comes from `client_engagement_methodology`.
- **Element pages:** approach statements appear under "Approach" (ordinary published statements). Agreed acceptance criteria appear under "Acceptance criteria" with their code and agreement date.
- **Implementation (client view):** a validated initiative shows the criteria it was validated against, where the client can already see the validation.
- **Nothing else.**
  - No library, applications, stages, instruments, standards, templates, lineage, contexts or rights.
  - No link or route exists under `/client` for any of them.
  - Tests assert that the routes return 404 and that the data calls fail under RLS.

## 31. Testing strategy

**pgTAP** (new files; existing suites unchanged except where noted):

- **`21_method_library.sql`**
  - forms and form-specific publish requirements;
  - version immutability (every child table);
  - single draft and single published version;
  - supersession;
  - retirement;
  - rights append-only;
  - categories;
  - release composition, freeze and vocabulary record;
  - Development Context governance and revisions.
- **`22_method_applications.sql`**
  - start rules: Method form only, published only, reason when outside the release;
  - release and context snapshots;
  - role/kind link rules;
  - cross-engagement refusal;
  - closure rules and `observed_version_id`;
  - freeze after closure; addenda;
  - `MUS` codes;
  - captured references survive deletion of a linked draft, including on closed applications (D30);
  - area-filtered detail for Contributors;
  - lineage form ↔ role ↔ kind;
  - the `methodology_derived` publish check.
- **`23_method_client_boundary.sql`**
  - every new table and bucket denies client, licensed-practice and anonymous roles;
  - client snapshot key-set regression;
  - `client_engagement_methodology` returns only the label and title;
  - the `approach` statement kind follows visibility rules;
  - `client_acceptance_criteria` never returns the informing Standard.
- **`24_practice_capabilities.sql`**
  - defaults per role;
  - overrides administered only by `publish_methodology` holders;
  - engagement capability tables and functions unchanged;
  - no self-override;
  - last-holder guard;
  - System Administrator has no default authority;
  - non-TPLCo organizations never qualify.
- **`25_method_backfill.sql`:** the §34 backfill results on seed data, including legacy assets and adoption.
- **`26_acceptance_criteria.sql`:**
  - lifecycle and immutability after agreement;
  - agreement requires a published governed element;
  - supersession history;
  - capture at `record_review_validation`, with the ADR-0036 gate unchanged;
  - area limits.
- **`99_method_concurrency.sql`**
  - two concurrent publishes of versions of the same asset;
  - concurrent release publish and member edit;
  - concurrent `MUS` and `ACR` code allocation;
  - concurrent agree and supersede of one criterion.

**Existing suites:**

- Suites asserting the `statement_kind` and `activity_action` enum value lists and the `element_method_lineage` grants are updated deliberately.
- Suite 18/19 validation tests gain assertions for criteria capture; the existing validation gate assertions stay unchanged.
- Everything else must pass unchanged.

**Vitest:**

- Zod schemas and TypeScript mirrors of every new enum, checked against the database lists (existing pattern);
- form-requirement helpers;
- expected-vs-actual output comparison;
- release diff.

**Browser acceptance pass** (as in Phase 5, before merge). Scripted walkthroughs:

- as Principal Architect: author, publish, release, context;
- as Architect: apply, link, close, delete a linked draft after closure, approach statement, propose acceptance criteria;
- as Researcher: read-only library;
- as System Administrator: no publish;
- as Contributor: area-filtered application;
- as client: only the release line and authored statements.

Results are written up as in Phase 5.

## 32. Seed and demo strategy

All in `supabase/seed.sql` only; **no methodology content in migrations** (Q4).

- **Contexts** (demo only): "Institutional capability development (college)", "Regional industry cluster development", "Real-estate district development", "Community service development".
- **Assets** (demo content, clearly fictional):
  - _Capability Readiness Diagnostic_ (legacy 'DAM 1.0' version, adopted as a Method; 1.0 and 1.1 published), with 4 stages, `may_be_named` "Capability Readiness Diagnostic™";
  - _Leadership Capability Interview Guide_ (Instrument, 1.0);
  - _Capability Readiness Scale_ (Standard, 1.0, 5 criteria);
  - _Strategic Model Library Index_: left as the backfilled **legacy** asset, unchanged (D28);
  - _Anchor-led cluster development model_ (Model, 1.0), newly authored; the Meridian Applied Strategic Model gains `instantiates` lineage to it beside its legacy row;
  - _Capability Map_ (Template, 1.0, `deliverable_type` capability map or the closest existing type).
- **Releases:** DAM 1.0 (published, backfill) and DAM 1.1 (published: Diagnostic 1.1 and the new assets); a DAM 1.2 draft.
- **Applications:**
  - on **Harbor**, one completed Diagnostic application linking existing Harbor elements (examined Capabilities; produced an existing Capability Gap and Recommendation), with one adapted stage;
  - on **Meridian**, one in-progress application.
- **Acceptance criteria:** two agreed criteria on an existing Harbor Implementation Initiative, one informed by the demo Standard.
- **No new elements are created,** so Meridian and Harbor count assertions in suites 01–20 are unaffected (the Phase 5 precedent).

## 33. Cross-domain examples

Each flow is: context → asset/version → application → inputs/evidence → work → outputs → implementation/review → outcome/learning.

### 33.1 A college developing an institutional capability

1. **Context.** The engagement declares _Institutional capability development_ (primary). It runs under DAM 1.1.
2. **Asset and version.** The architect picks _Capability Readiness Diagnostic 1.1_ (Method, in the release, context fits).
3. **Application.** MUS-001 "Readiness of advising capability".
   - Reason: "Board asked whether advising can scale before the enrollment initiative."
   - Scope: Capability domain.
   - Lead: the Architect.
4. **Inputs and evidence.**
   - Examined: Capabilities _Academic advising_ and _Enrollment management_.
   - Drew on: the institutional self-study (document).
   - Gathered: 6 leadership interviews, recorded as evidence, Instrument _Leadership Capability Interview Guide 1.0_.
5. **Work.** Stage 2 was adapted (group interviews instead of individual ones, with a reason). The Capability Readiness Scale 1.0 was used.
6. **Outputs.**
   - Produced: Capability Gap _Advising capacity for adult learners_; Risk _Advisor attrition_; Recommendation _Establish a shared advising model_.
   - Revised: Capability _Academic advising_ (maturity judgment updated).
   - The Capability Gap carries an approach statement: "Assessed using TPLCo's Capability Readiness Diagnostic™ through leadership interviews".
7. **Implementation and review.**
   - The Recommendation leads to a Decision, which initiates Implementation Initiative _Shared advising pilot_ (Phase 5).
   - Two acceptance criteria are agreed with the steering committee on the initiative (ACR-001, ACR-002). ACR-001 was informed internally by the Capability Readiness Scale 1.0.
   - An Executive Review examines the initiative and validates it. The validation captures ACR-001 and ACR-002 as "Validated against", and the Review shows "Informed by MUS-001".
8. **Outcome and learning.**
   - MUS-001 is completed with its completion statement. The retrospective notes the interview stage was too long for a small college.
   - Diagnostic 1.2 is drafted, citing MUS-001 as a learning source.

### 33.2 A region developing an industry cluster

1. **Context.** _Regional industry cluster development_; DAM 1.1.
2. **Asset.** _Anchor-led cluster development 1.0_ (Model).
3. **Application.** Not applicable: a Model is **instantiated**, not applied.
4. **Instantiation.** The architect creates the Applied Strategic Model _Anchor-led aerospace cluster_ with `instantiates` lineage to the Model 1.0. Its statement "Clusters grow around one anchor employer…" is `methodology_derived`, so publication is allowed.
5. **Surrounding method work.** A separate _Capability Readiness Diagnostic 1.1_ application (MUS-002) examines ecosystem actors and produces Dependencies (_Anchor supplier training pipeline_).
6. **Outputs, implementation and review.** Development Initiatives realize the Applied Strategic Model (Phase 3 relationships, unchanged). An Architecture Review examines the model's elements.
7. **Outcome and learning.** The Model's "where used" shows this instantiation. Phase 7 can compare the implementation status of initiatives realizing instantiations of this Model across regions.

### 33.3 A real-estate district being planned

1. **Context.** _Real-estate district development_; DAM 1.1.
2. **Asset and version.** No Method in the release covers district phasing. The architect applies a published pilot Method, _District Phasing Workshop 0.9_, outside the release, with the required reason "Pilot; not yet in release".
3. **Application.** MUS-001; `version_in_release` = false.
4. **Inputs.**
   - Examined: Regulatory Factor _Zoning overlay_; Constraints.
   - Drew on: the zoning code (regulation evidence).
5. **Work.** Stage 3 was skipped (no market study available, with a reason).
6. **Outputs.**
   - Produced: Development Initiatives _Phase 1 parcels_; Assumptions _Utility capacity sufficient_.
   - A Deliverable _District phasing blueprint_ is `produced_from` the _Blueprint Template 1.0_.
7. **Implementation and review.** The Assumption is later invalidated in Phase 4; the Decision is superseded.
8. **Outcome and learning.**
   - The application's skipped stage and the invalidated Assumption are both on record.
   - The pilot Method's authors cite MUS-001 when publishing 1.0 and propose it for DAM 1.2.

### 33.4 A community developing a new service

1. **Context.** _Community service development_; DAM 1.0 (an older engagement).
2. **Asset and version.** _Capability Readiness Diagnostic 1.0_ is in DAM 1.0 and still applicable. Version 1.1 exists but is not in DAM 1.0.
3. **Application.** The architect applies 1.1 anyway, with the reason "1.1 shortens stage 2 for small organizations". The application records release DAM 1.0 and `version_in_release` = false.
4. **Inputs and work.** Examined Institution _Community health collaborative_. Stage notes are recorded.
5. **Outputs and review.**
   - Produced: Capability Gap and Recommendation.
   - Informed: an Executive Review.
6. **Implementation.** The engagement's release is later moved to DAM 1.1 (`publish_architecture`, reason logged). MUS-001 keeps its recorded release, DAM 1.0.
7. **Outcome and learning.** Phase 7 can tell that 1.1 was used ahead of its release, where, and with what result.

---

## 34. Migration and backfill implications

Existing data on `main` is small: two `method_assets` rows and two `element_method_lineage` rows, all seed data. Production is assumed to hold at most the same shape. The backfill is written to be correct for any number of rows and is tested (`25_method_backfill.sql`).

| Step | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Create the new enums, tables, the bucket and the practice capability defaults. The engagement capability tables are not touched                                                                                                                                                                                                                                                                                                                             |
| 2    | Reshape `method_assets`:<br>• add `key` (slugified from the title), a nullable `form`, `category_key` (mapped from the free-text `category`, or `other`), `origin` = `tplco_developed`, `current_version_id`;<br>• rename `owner_user_id` → `steward_user_id`;<br>• **every existing asset becomes `legacy`** (a pre-Phase-6 `retired` asset stays `retired`). No form is inferred, because the migration cannot know what an asset is without inventing it |
| 3    | For each asset, create one **legacy version**: `legacy = true`, lifecycle `published` (frozen), `version_label` = the original text (e.g. 'DAM 1.0'), `summary` = the original `description`, domains from `methodology_domain`. It is exempt from form requirements and cannot be applied, instantiated, used, cited or added to a new release                                                                                                             |
| 4    | **No renaming and no form assignment (D28).** _Strategic Model Library Index_ keeps its name and meaning as a legacy asset. Assets become proper forms only through `adopt_legacy_method_asset`, by a `publish_methodology` holder, after build                                                                                                                                                                                                             |
| 5    | Create DAM release **1.0**, `published`, containing every legacy version, so 'DAM 1.0' remains exactly what existed. `vocabulary_record` is built from the current reference tables                                                                                                                                                                                                                                                                         |
| 6    | For every engagement whose `methodology_version` = 'DAM 1.0', set `dam_release_id` to release 1.0. Other values are left with a null release and listed in the report. The text column is not changed                                                                                                                                                                                                                                                       |
| 7    | Lineage: every row gets `method_asset_version_id` = the legacy version and `lineage_role` = `legacy_derived_from`; `method_version` text is kept read-only. The migration **reports** published elements with `methodology_derived` provenance and no `instantiates` lineage (on seed data: the Meridian Applied Strategic Model), so a proper Model can be authored and linked                                                                             |
| 8    | Drop `method_assets.version`, `methodology_domain` and `description`, now held on versions. Replace the role-name write policy with the operation-only model                                                                                                                                                                                                                                                                                                |
| 9    | Revoke direct grants on `element_method_lineage`; add the new operations                                                                                                                                                                                                                                                                                                                                                                                    |

**The backfill does not change:**

- any architecture element;
- any element version or snapshot;
- any baseline, approval or client-visible field.

The `methodology_derived` publish check (D19) applies to future publications only. Already-published versions are immutable and are not re-validated.

**Build-time seed changes** (not made now): adopt _Capability Readiness Diagnostic_ as a Method; author _Anchor-led cluster development model 1.0_; add `instantiates` lineage from the Meridian Applied Strategic Model to it, leaving its legacy row to the Index in place (§32).

**Application code touched at build time:**

- `listMethodAssets` and the lineage actions (`src/domain/architecture/queries.ts`, `actions.ts`);
- the element page panel;
- the engagement edit form (methodology version → release picker);
- the nav placeholder;
- the statement-kind mirrors;
- the Review validation dialog and `record_review_validation` (criteria capture, D34).

---

## 35. ADRs required

Written at build time, not now.

| ADR                | Title                                                                                                              | Decisions                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 0041               | Method Assets: five forms, identity, immutable versions and legacy assets                                          | D1–D6, D28, D29                            |
| 0042               | DAM releases are frozen sets of asset versions; no DAM phases                                                      | D7, D8, D22                                |
| 0043               | Method Applications are off-spine practice records with explicit linkage                                           | D2, D9, D12–D14, D17, D24, D30–D32         |
| 0044               | Capabilities are scoped by membership: the practice scope and `publish_methodology` (resolves spec §4 vs ADR-0024) | D10, D11                                   |
| 0045               | Development Context                                                                                                | D15, D16                                   |
| 0046               | Engagement acceptance criteria are lightweight governance records, captured at validation                          | D20, D33, D34                              |
| 0047               | Methodology provenance: typed lineage and the narrow `methodology_derived`                                         | D18, D19 (clarifies ADR-0009)              |
| 0048               | Method origin and rights are recorded, not decided                                                                 | D23                                        |
| 0049               | Client-visible methodology identity through approach statements                                                    | D21 (ADR-0022 unchanged, cross-referenced) |
| 0050               | Method Library / Pattern Library boundary; AI prompts excluded                                                     | D25, D26                                   |
| ADR-0016 amendment | Note: releases document the vocabulary; the Method Library does not govern it                                      | D27                                        |
| ADR-0009 note      | Pointer to ADR-0047                                                                                                | D19                                        |
| ADR-0036 note      | Validation also captures the agreed criteria in force; the gate is unchanged                                       | D34                                        |

---

## 36. Difficult-to-reverse decisions

| Item                                                            | Why hard to reverse                                                                                        | Decision |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| `method_asset_form` values                                      | Postgres enum values cannot be dropped; published assets carry them forever                                | D1       |
| `statement_kind` + `approach`                                   | Enum value; statements appear in immutable client snapshots                                                | D21      |
| `acceptance_criterion_state` values and `ACR` codes             | Enum values and permanent reference codes; agreed criteria are never deleted                               | D20, D33 |
| `method_lineage_role`, `method_application_element_role` values | Enum values; recorded on immutable closed applications                                                     | D14, D18 |
| `method_asset_origin` values                                    | Enum values; rights history is append-only                                                                 | D23      |
| `practice_capability` and the membership-scope rule             | Every later TPLCo-wide authority extends this scope                                                        | D10      |
| The name "Method Application" and prefix `MUS`                  | Reference codes are permanent (ADR-0025); the name enters UI, ADRs and client-adjacent vocabulary          | D12, D13 |
| Version and release immutability                                | Once published data exists, relaxing immutability breaks interpretability                                  | D6, D7   |
| Off-spine placement                                             | Moving applications onto the spine later means a data migration into `architecture_elements` and new kinds | D14      |
| Adoption of a legacy asset into a form                          | Form is immutable once adopted; the legacy version itself never changes                                    | D28      |
| Development Context keys                                        | Immutable once referenced                                                                                  | D15      |

Everything else (tables, read models, UI, defaults and override rules) is ordinary migration work and reversible.

---

## 37. Decisions requiring approval (D1–D34)

Each decision gives the question, the recommendation, the alternatives, the consequences and the reversibility.

**Revision 2 status:** Kerrick approved every decision except D10, D13, D20, D28 and D30, which are revised below. D11 changed as a direct consequence of D10. D33 and D34 are new. Everything else is unchanged.

### Method Assets

**D1. Permanent Method Asset form values.**

- **Question:** which values become the permanent `method_asset_form` enum?
- **Recommendation:** `method`, `model`, `standard`, `instrument`, `template`. Exactly Q3's five, each with distinct enforced behavior (§8.1).
- **Alternatives:**
  - add `framework` or `procedure` (rejected by Q3 and by the test in §8.3);
  - a reference table instead of an enum. This is more flexible, but form drives database behavior (triggers, checks), which argues for an enum.
- **Consequences:** a sixth form later means an enum addition and new behavior rules.
- **Reversibility:** additions are easy. Removal or renaming is effectively impossible.

**D2. Only Methods can be the subject of a Method Application.**

- **Question:** which forms can be "applied"?
- **Recommendation:** Method only. Models are _instantiated_ through lineage. Standards, Instruments and Templates are recorded as components used.
- **Alternatives:** Methods and Models (this duplicates the element record); any form (applications lose meaning).
- **Consequences:** the question "how often was this Model used" is answered from lineage, not applications.
- **Reversibility:** relaxing it later is easy. Tightening it after data exists is hard.

**D3. Domains per asset version.**

- **Question:** one domain, or several?
- **Recommendation:** zero or more, via a join table. Zero means domain-neutral.
- **Alternatives:** keep a single `methodology_domain`.
- **Consequences:** `methodology_domain` is dropped after backfill.
- **Reversibility:** easy.

**D4. Categories.**

- **Question:** how are categories governed?
- **Recommendation:** a migration-managed reference table seeded from spec §14, less patterns and AI prompts. Categories never drive behavior.
- **Alternatives:** keep free text (inconsistent browse); an enum (too rigid for a descriptive list).
- **Consequences:** a new category is a small migration.
- **Reversibility:** easy.

**D5. Identity/version split; spec §26 sketch superseded.**

- **Question:** adopt the asset (identity) plus version (content) structure?
- **Recommendation:** yes (§7.1, §24).
- **Alternatives:** the flat spec §26 row with a `version` text column. It cannot pin immutable content.
- **Consequences:** every use pins a version id.
- **Reversibility:** hard once versions are referenced.

**D6. Method Asset version immutability and lifecycle.**

- **Question:** can a published version change?
- **Recommendation:**
  - lifecycle draft → published → superseded or retired;
  - published versions and all their children immutable, enforced by trigger;
  - one draft and one published version per asset;
  - corrections are new versions.
- **Alternatives:**
  - allow "editorial" edits to published versions (breaks interpretability);
  - multiple concurrently published versions (makes "current" ambiguous; releases already allow pinning older versions).
- **Consequences:** even typo fixes create versions.
- **Reversibility:** relaxing it later is technically easy but undermines history already relied upon.

**D29. Reusable (methodological) Standards.**

- **Question:** how are TPLCo Standards represented, and are any seeded?
- **Recommendation:**
  - a Standard-form asset with ordered criteria rows and "judged in" settings;
  - used by citation, components and `judged_against` lineage, and as the optional internal informing source of an engagement acceptance criterion (D20), never as the criterion itself;
  - it never computes a verdict;
  - **none seeded in migrations**; one demonstration Standard in `seed.sql` only.
- **Alternatives:**
  - structured scales with scoring (drifts into automated judgment);
  - Standards as free text on Methods (not citable or pinnable).
- **Consequences:** TPLCo authors its real Standards after build.
- **Reversibility:** easy to extend with structure later.

### DAM releases

**D7. DAM release composition and immutability.**

- **Question:** what is a release, and when is it frozen?
- **Recommendation:**
  - a set of published asset versions, at most one per asset;
  - editable while draft, frozen at publish;
  - supersession on the next publish;
  - `engagements.dam_release_id` with `methodology_version` text synchronized by trigger;
  - changing an engagement's release requires `publish_architecture` and a reason.
- **Alternatives:**
  - releases containing assets rather than versions (not reproducible);
  - multiple versions of one asset per release (ambiguous);
  - drop the text column (breaks ADR-0013 copying).
- **Consequences:** release diffs and impacted-engagement lists become queries.
- **Reversibility:** immutability is hard to relax once relied on.

**D8. No DAM phases; `current_phase` ungoverned.**

- **Question:** does a release define an engagement sequence?
- **Recommendation:** no (Q9). `current_phase` stays free text. Diagnostics are Methods. Releases document vocabulary without governing it (§10.4).
- **Alternatives:** a release-defined phase list driving `current_phase` (rejected by Q9).
- **Consequences:** milestone names such as "Diagnostic Completion" remain commercial labels.
- **Reversibility:** a phased method can be added later without undoing anything.

**D22. The DAM release label is client-visible.**

- **Question:** do clients see the engagement's release?
- **Recommendation:** yes. Label and title only, through a single-purpose read model. No client policy on `dam_releases`.
- **Alternatives:**
  - hide it (contrary to Q12);
  - a client policy on `dam_releases` (exposes other columns and other releases).
- **Consequences:** one line on the client overview.
- **Reversibility:** easy.

### Method Application

**D12. Permanent name.**

- **Question:** what is the permanent name for the record of an actual method use?
- **Recommendation: "Method Application"**, always as the two-word compound in UI and documents.
- **Alternatives considered:**
  - **"Method Use":** clear and plain, but weak as a noun for a record with a lifecycle. The recommended fallback, with prefix `MUS`.
  - **"Applied Method":** rejected, because it parallels _Applied Strategic Model_, which is architecture.
  - **"Method Run":** mechanical; implies automation.
  - **"Practice Record":** generic; loses the link to a Method.
  - "Method Engagement": excluded by Kerrick.
- **Consequences:** "Application" alone is never used in UI, to avoid confusion with the Application domain and software applications.
- **Reversibility:** a label change is easy before build and costly after, because it appears in ADRs and codes.

**D13. Identity and reference-code strategy.** _(Revised: prefix changed to `MUS`.)_

- **Question:** how are Method Applications identified?
- **Recommendation:**
  - engagement-scoped internal reference codes **`MUS-nnn`** (`MUS-001`, `MUS-002`) through the existing counters (ADR-0025);
  - the display and record name stays **Method Application** (D12 unchanged). The code does not need to abbreviate the name;
  - Method Assets and releases are identified by key, title and version label, with no three-letter code.
- **Alternatives:**
  - `MAP` (rejected: it collides with the many map concepts in Development Architecture, such as capability maps);
  - `MTH`;
  - no code (weakens citation in notes and reviews).
- **Consequences:**
  - `MUS` reads naturally as "method use", which is what the record is;
  - the UI always shows the method title beside the code.
- **Reversibility:** codes are permanent once issued.

**D14. Off-spine linkage structure.**

- **Question:** how does an off-spine application connect to architecture?
- **Recommendation:**
  - four link tables (§12.3);
  - element roles `examined`, `produced`, `revised`, `informed`, with kind rules;
  - evidence roles `drew_on`, `gathered`;
  - components `used`;
  - domain scope;
  - no writes to `architecture_relationships`.
- **Alternatives:**
  - put applications on the spine and use typed relationships (rejected in §12.1);
  - a single polymorphic link table (loses FK integrity);
  - fewer roles (loses the produced/revised distinction learning needs).
- **Consequences:** there is a cost in tables, operations and read models, sized in §38.
- **Reversibility:** role values are permanent. Moving onto the spine later requires a migration.

**D9. Which versions may be applied.**

- **Question:** may an architect apply a draft version, or a version outside the engagement's release?
- **Recommendation:**
  - published versions only;
  - versions outside the release are allowed **with a required reason**;
  - `version_in_release` is recorded.
- **Alternatives:**
  - release members only (blocks pilots, forces release churn);
  - drafts allowed (unpinned practice).
- **Consequences:** pilots are visible and explained.
- **Reversibility:** easy.

**D17. Method Application lifecycle and status.**

- **Question:** what states does an application have?
- **Recommendation:**
  - `planned` → `in_progress` → `completed` / `discontinued`;
  - the pin never changes; an upgrade means discontinue and continue;
  - closure freezes the record; addenda are append-only;
  - stage notes carry a treatment (followed, adapted, skipped), not a status.
- **Alternatives:**
  - an approval state (duplicates Phase 3 approvals);
  - per-stage status and assignees (becomes a task manager);
  - editable after closure (loses "what we knew then").
- **Consequences:** a mistaken closure is corrected by an addendum, not an edit.
- **Reversibility:** states can be added; freezing is hard to relax.

**D30. Method Application → Architecture provenance.** _(Revised: drafts stay disposable.)_

- **Question:** what does the system record about the architecture an application touched, and what happens if a linked unpublished draft is later deleted?
- **Recommendation: an application-side historical reference, captured on the link row.**
  - `method_application_elements.element_id` becomes nullable, with FK `(element_id, engagement_id)` **`on delete set null (element_id)`**. This is the repository's existing pattern (for example `owner_member_id` on implementation initiatives).
  - Each link row carries a small captured identity: `captured_reference_code`, `captured_kind`, `captured_object_type_key`, `captured_title`, `captured_at`. These are written when the link is made and refreshed at closure, together with `observed_version_id` (the published version at closure, or null for a draft).
  - When the element row disappears, a trigger sets `element_removed_at`. The closure-freeze guard permits exactly this one change on a frozen application: `element_id` → null, with `element_removed_at` set.
  - Published elements are never deleted (Phase 3 guard), so for them `observed_version_id` remains the authoritative immutable reference.
  - Reference codes are never reused (counters are monotonic), so a captured code stays unambiguous.
- **The sequence Kerrick asked about:**
  1. MUS-004 produces draft Capability Gap CAP-031, "Advising capacity for adult learners". The link row captures CAP-031, `object`, `capability_gap` and the title.
  2. MUS-004 closes. The draft is still unpublished, so `observed_version_id` is null and the captured title is refreshed.
  3. The architect decides the gap should never be published.
  4. The draft is deleted under the existing Phase 3 rule: editors may remove unpublished elements. Its statements, evidence links and relationships cascade away as today.
  5. The link row survives with `element_id` null and `element_removed_at` set. The application still reads: _"produced CAP-031 Capability Gap 'Advising capacity for adult learners' (draft, removed after closure on 2026-11-02)"_. An addendum may explain why, but none is required.
- **Alternatives:**
  - `on delete restrict` (the original recommendation; makes drafts undeletable, rejected by Kerrick);
  - `on delete cascade` (silently erases what the work produced);
  - a full snapshot of the draft (duplicates architecture);
  - a tombstone element (a duplicate spine row, excluded).
- **Consequences:**
  - no change to Phase 3 deletion rules;
  - five captured columns plus one timestamp on one link table;
  - read models show removed drafts distinctly;
  - evidence links on the application are unaffected, because evidence sources are not deleted with elements.
- **Reversibility:** easy.

**D31. Method Application → Project Intelligence provenance.**

- **Question:** how are PI records produced by method work recorded?
- **Recommendation:**
  - ordinary Phase 4 records, linked with `produced`, `revised`, `examined` or `informed`;
  - no automatic creation;
  - no method-specific record types;
  - `methodology_derived` not used on them.
- **Alternatives:** a "method finding" record (duplicates PI); auto-creating records from expected outputs (removes judgment).
- **Consequences:** none to Phase 4.
- **Reversibility:** easy.

**D24. Reviews and Method Applications.**

- **Question:** can Reviews examine Method Applications?
- **Recommendation:**
  - not formally in Phase 6;
  - an application may be linked to a Review as `informed`;
  - a Review may carry `judged_against` lineage to a Standard;
  - Reviews continue to examine elements and to validate Implementation Initiatives;
  - a methodological review of method application quality is Phase 7 governance.
- **Alternatives:**
  - a new link table Review → application (feasible; adds a Phase 5 surface change);
  - putting applications on the spine to use `examines` (rejected, D14).
- **Consequences:** "how well was the method applied" is judged in retrospectives, not Reviews, for now.
- **Reversibility:** easy to add later.

**D32. Area-limited Contributor visibility.**

- **Question:** how do ADR-0040 area limits apply to applications?
- **Recommendation:**
  - applications are visible to anyone who can read the engagement's architecture;
  - element links in read models are filtered by `element_in_member_areas`;
  - creation requires `edit_architecture`.
- **Alternatives:** hide whole applications unless every link is in-area (hides practice unnecessarily); no filtering (leaks element titles out of area).
- **Consequences:** a Contributor may see an application with some links hidden, shown as "N items outside your areas".
- **Reversibility:** easy.

### Provenance and lineage

**D18. Typed, version-pinned method lineage.**

- **Question:** how does element lineage to methodology work?
- **Recommendation:**
  - pin lineage to `method_asset_version_id`;
  - roles `instantiates` (Model → object), `produced_from` (Template → Deliverable), `judged_against` (Standard → Review, object or Implementation Initiative), and read-only `legacy_derived_from`;
  - a Method cannot be element lineage; its use is a Method Application;
  - writes through operations only.
- **Alternatives:** keep free text (not pinned); a single untyped link (loses the verb).
- **Consequences:** the existing lineage UI is replaced by a form-aware one.
- **Reversibility:** role values are permanent.

**D19. Narrow `methodology_derived` with a publish check.**

- **Question:** what does `methodology_derived` mean, and is it enforced?
- **Recommendation:**
  - content literally taken from TPLCo Method content (Q15);
  - enforced by requiring `instantiates` lineage to a published Model version when publishing an element with `methodology_derived` provenance;
  - ADR-0009 clarified;
  - the enum is unchanged;
  - the seed stays valid given D28.
- **Alternatives:** narrow by documentation only, with no enforcement (drifts back to the broad reading); also accept Standard or Template lineage as justification (those are not "content taken").
- **Consequences:** architects must record the Model when claiming this provenance.
- **Reversibility:** the check is easy to relax.

**D23. Method IP and ownership vocabulary.**

- **Question:** how are origin and rights recorded?
- **Recommendation:**
  - `method_asset_origin`: `tplco_developed`, `co_developed`, `client_owned`, `licensed_in`, `third_party`;
  - append-only rights holders (organization or external name; `owner`, `co_owner`, `licensor`, `contributor`; agreement reference);
  - usage restriction as a warning;
  - `ip_classification` unchanged;
  - no licensing logic;
  - co-owners gain no system access.
- **Alternatives:**
  - new `ip_classification` values (conflates handling with ownership);
  - a free-text ownership note (not queryable for Phase 7 or Phase 9).
- **Consequences:** Phase 9 licensing can build on recorded rights.
- **Reversibility:** enum values are permanent; the rest is easy.

### Development Context

**D15. Development Context representation and governance.**

- **Question:** how is Development Context represented and who governs it?
- **Recommendation:**
  - a governed table with immutable keys, not an enum;
  - managed by `publish_methodology` holders through logged operations;
  - append-only revision history;
  - retired values remain on history;
  - **empty in migration**; examples only in `seed.sql`.
- **Alternatives:**
  - an enum (rejected, Q13);
  - free text per engagement (not comparable);
  - migration-managed reference table (too slow for a practice vocabulary still forming).
- **Consequences:** TPLCo must define its first contexts in production.
- **Reversibility:** easy; keys are permanent.

**D16. Development Context placement and multiplicity.**

- **Question:** engagement, application or both? One or many?
- **Recommendation:**
  - both;
  - one or more per engagement with one primary, set by `edit_architecture` holders;
  - each application snapshots the engagement's contexts at start, adjustable until closure;
  - asset versions declare applicable contexts (zero = any);
  - internal only.
- **Alternatives:** engagement only (loses historical accuracy when contexts change); application only (repetitive and inconsistent).
- **Consequences:** learning compares declared, engagement and application contexts.
- **Reversibility:** easy.

### Capabilities

**D10. Capability architecture for methodology authority.** _(Revised after comparing both approaches against the repository, §27.3–§27.4.)_

- **Question:** should TPLCo-wide methodology authority extend the existing engagement-capability machinery, or live in its own scope?
- **Recommendation: Approach P, one capability model with two membership scopes.**
  - A capability is always held through a membership, and its scope is that membership's scope. Engagement membership carries engagement capabilities. TPLCo organization membership carries practice capabilities.
  - The practice scope mirrors the engagement scope exactly:
    - a `practice_capability` enum;
    - `practice_role_capability_defaults`, migration-only;
    - `practice_member_capability_overrides` on the TPLCo `organization_members` row, with `granted` and a reason, logged;
    - `private.has_practice_capability`;
    - `public.my_practice_capabilities`.
  - The engagement enum, tables, functions, UI and tests are untouched.
- **Alternatives:**
  - **Approach U:** add the two values to `engagement_capability` with a scope function. It requires nullable engagement semantics on the override table, or a second override table anyway. It also needs explicit refusals in `has_engagement_capability`, filtering in `my_engagement_capabilities`, and filtering in three UI and schema sites. It puts permanent non-engagement values in an engagement-named enum;
  - a generic scoped-capability table replacing the enum (redesigns a stable model; rejected).
- **Consequences:**
  - one new enum, two tables and three functions;
  - ADR-0044 states the membership-scope rule, so later TPLCo-wide authorities extend `practice_capability` instead of inventing a third mechanism.
- **Reversibility:** hard once relied on. Approach P can still be folded into a unified table later without touching the engagement model.

**D11. Methodology capabilities, defaults and administration.** _(Changed as a consequence of D10: override administration is now capability-based.)_

- **Question:** which practice capabilities exist, who holds them by default, and who may grant them?
- **Recommendation:**
  - `author_methodology`: Principal Architect and Architect by default;
  - `publish_methodology`: Principal Architect only (System Administrator none, per Q11);
  - overrides granted or revoked only by holders of **`publish_methodology`**, never on themselves. There is no role-name check;
  - the last effective `publish_methodology` holder cannot be revoked;
  - library read access is unchanged for all internal members.
- **Alternatives:**
  - override administration restricted to the Principal Architect role (the original draft; a role check, which Kerrick's requirement excludes);
  - only `publish_methodology` (Architects could not draft).
- **Consequences:**
  - resolves spec §4 vs ADR-0024 in ADR-0024's favor;
  - a System Administrator can hold methodological authority only through an explicit, logged grant by a methodology authority.
- **Reversibility:** defaults are easy to change.

### Engagement standards and client identity

**D20. Engagement acceptance criteria.** _(Revised: approved for Phase 6; placement changed.)_

- **Question:** what structure should engagement acceptance criteria have?
- **Recommendation: Option B, a lightweight engagement-governance record** (§15.4):
  - `acceptance_criteria` with durable identity (`ACR-nnn`, D33), one governed element (an Implementation Initiative or a core object), text frozen once agreed, and a lifecycle of `proposed` → `agreed` → `superseded` / `withdrawn`;
  - agreement records who agreed, when it became applicable, who recorded it, and optional agreement evidence. Agreeing requires the governed element to be published;
  - an internal-only optional reference to the informing Standard version and criterion;
  - `validation_criteria` captures the agreed criteria in force when a Review validates (D34);
  - no statement kind is added.
- **Alternatives:**
  - **A.** `statement_kind = acceptance_criterion`. Rejected: statements are edited in place, `validates` pins no version, and agreement would be conflated with whole-element approval;
  - **C.** Metric, Intended Outcome, Checkpoint, Decision or approval. Rejected: each distorts the concept (§15.3);
  - a spine element, a Method Asset, a task, a checkpoint, a Review or scoring. Excluded by Kerrick.
- **Consequences:**
  - two tables, one enum (`acceptance_criterion_state`), six operations, one client read model and one addition inside `record_review_validation`;
  - no change to statements, snapshots or the spine.
- **Reversibility:** the state enum and codes are permanent; everything else is easy.

**D21. Client-visible methodology identity (ADR-0022).**

- **Question:** how does a branded method name reach a client?
- **Recommendation:**
  - a new `statement_kind` value `approach`, authored by the architect;
  - internal `identity_disclosure` and `disclosable_name` on versions as authoring guidance only;
  - **no `client_visible_name` field and no automatic projection**;
  - **ADR-0022 unchanged.**
- **Alternatives:**
  - a `client_visible_name` projected into client snapshots (a new library-to-client path);
  - free text in existing `note` statements (no guidance or checks).
- **Consequences:** naming is always explicit, versioned and approvable.
- **Reversibility:** enum value permanent.

### Boundaries and ADRs

**D25. Pattern Library boundary.**

- **Question:** where does the Method Library end and the Pattern Library begin?
- **Recommendation:**
  - boundary per §21;
  - pattern categories removed;
  - no Phase 6 schema anticipates patterns.
- **Alternatives:** keep pattern categories as Method Assets for now (blurs practice and client-derived architecture).
- **Consequences:** none now.
- **Reversibility:** easy.

**D26. AI prompts excluded.**

- **Question:** are AI prompts part of the Method Library?
- **Recommendation:** no category, table or form for AI prompts (Q17).
- **Alternatives:** a placeholder category (invites premature use).
- **Consequences:** Phase 7 designs prompt governance.
- **Reversibility:** easy.

**D27. ADR-0016.**

- **Question:** does ADR-0016 change?
- **Recommendation:** an amendment note only. Reference tables remain migration-managed; releases _document_ the vocabulary in force at publication; the Method Library never writes to vocabulary tables.
- **Alternatives:** let the library govern types (rejected, Q10).
- **Consequences:** none to existing behavior.
- **Reversibility:** easy.

**D28. Migration of existing Method Assets and lineage.** _(Revised: history preserved, no renaming.)_

- **Question:** how are pre-Phase-6 assets and lineage migrated without rewriting what they meant?
- **Recommendation: backfill every existing asset as a legacy asset, and never assign a form by inference.**
  - **Legacy state.**
    - `method_assets.status` gains `legacy`. It is a check-constraint value, not an enum.
    - `form` may be null only while the asset is `legacy` (or `retired` without ever being adopted).
    - Each existing asset gets one **legacy version**: published and frozen, `legacy = true`, with its original label ('DAM 1.0'), original description and domains.
    - A legacy version:
      - is exempt from form requirements;
      - can never be applied, instantiated, used as a component, cited as a Standard, or added to any new release;
      - is valid only as the target of `legacy_derived_from` lineage and as a member of the backfilled DAM 1.0 release.
  - **Adoption.** `adopt_legacy_method_asset(asset, form)` (`publish_methodology`) gives a legacy asset a form and opens its first proper draft. Publishing that draft supersedes the legacy version, which remains readable. An asset that is never adopted, such as the **Strategic Model Library Index**, stays legacy with its name and meaning intact.
  - **Lineage.**
    - Every existing lineage row becomes `legacy_derived_from`, pinned to the legacy version. The free-text `method_version` is kept read-only.
    - The migration **reports** every published element with `methodology_derived` provenance and no `instantiates` lineage, so a Principal Architect can author the proper Model and record `instantiates` lineage.
    - The legacy row stays alongside it as history.
  - **Seed, at build time only.**
    - _Capability Readiness Diagnostic_ is adopted as a Method.
    - A proper Model (_Anchor-led cluster development model 1.0_) is authored.
    - The Meridian Applied Strategic Model gains `instantiates` lineage to it, beside its untouched legacy row to the Index.
  - **No `index` form** is introduced.
- **Alternatives:**
  - backfill the Index as a Model and rename it (rejected by Kerrick);
  - add an `index` form (rejected);
  - infer forms for all assets in the migration (guesses meaning);
  - drop and reseed (loses continuity).
- **Consequences:**
  - The seeded `methodology_derived` element is already published and is not re-validated. Its next published version will require the new `instantiates` lineage (D19), which the seed provides.
  - DAM 1.0 remains reproducible as exactly what existed.
- **Reversibility:** the legacy state is a check value (easy). Adoption is permanent per asset.

### Added in the revision

**D33. Acceptance criterion reference codes.** _(New, from D20.)_

- **Question:** do acceptance criteria get engagement-scoped reference codes, and with what prefix?
- **Recommendation:** yes, **`ACR-nnn`**, through the existing counters (ADR-0025). Codes are citable in Review notes and client conversations.
- **Alternatives:**
  - `ACC` (reads as "account");
  - `CRT`;
  - no code, with identity by uuid only (weak for human citation).
- **Consequences:** one more engagement-scoped prefix. It is internal and client-visible, like element codes.
- **Reversibility:** codes are permanent once issued.

**D34. Validation captures the criteria in force.** _(New, from D20; touches one Phase 5 operation.)_

- **Question:** how does a validation record what it was validated against?
- **Recommendation:**
  - `record_review_validation` additionally writes one `validation_criteria` row per agreed criterion in force at that moment: those governing the initiative and those governing core objects it `implements`;
  - architects may add a per-criterion note;
  - no per-criterion verdict;
  - no new precondition. The ADR-0036 gate is unchanged, and a validation with no agreed criteria remains valid, with a UI warning;
  - an ADR-0036 amendment note records the capture.
- **Alternatives:**
  - the architect selects criteria manually (can omit inconvenient ones);
  - require at least one agreed criterion before validating (changes the Phase 5 gate; not proposed).
- **Consequences:** "validated against what?" is answered by data captured at the moment of judgment.
- **Reversibility:** easy.

---

## 38. Recommended implementation and build order

Each step lands with its pgTAP and vitest tests, and CI must be green ("App", "Database") before the next.

1. **Vocabulary and capabilities:**
   - enums;
   - practice-scope defaults, overrides, `has_practice_capability` and `my_practice_capabilities`;
   - the `approach` statement kind;
   - suite 24.
2. **Library core:**
   - `method_assets` reshape;
   - versions and child tables;
   - guard triggers;
   - categories;
   - rights;
   - `method-library` bucket;
   - operations;
   - suite 21 (library parts).
3. **Backfill** (§34), suite 25.
4. **DAM releases and Development Contexts:** tables, operations, engagement release and contexts, synchronization trigger; suite 21 (release and context parts).
5. **Method Applications:** tables, `MUS` codes, link tables with captured references, closure and freeze, addenda, learning sources; suite 22.
6. **Acceptance criteria:** tables, `ACR` codes, operations, capture in `record_review_validation`; suite 26.
7. **Typed lineage and provenance:** lineage columns and operations, `methodology_derived` publish check.
8. **Read models and the client boundary:** `client_engagement_methodology`, `client_acceptance_criteria`; suite 23; snapshot regression; suite 99.
9. **Internal UX:** library, asset pages, releases, contexts, engagement Method tab, application page, Practice panel, statement editor, acceptance criteria panel.
10. **Phase 5 touchpoints and client UX:** "Validated against", Review and Deliverable lines, client overview line.
11. **Seed and demo data; ADRs 0041–0050 and the ADR-0016, ADR-0009 and ADR-0036 notes; documentation** (`docs/database/method-library.md`, CLAUDE.md, README).
12. **Browser acceptance pass** by role, with written results. Fix, re-verify, then request merge.

A single PR, as for Phases 3–5, with these as reviewable commits.

---

## 39. Risks and failure modes

| Risk                                                                                       | Mitigation                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Method IP leaks to clients** through a new read path                                     | No client policy on any library or practice table; one purpose-built client read model; snapshot key regression; suite 23                |
| **Method Applications become a task manager** (stages as checklists, assignees, deadlines) | No stage status, assignee or date in the schema (D17); UI renders stages as notes                                                        |
| **The library quietly governs architecture** (types, phases, required outputs)             | No writes to vocabulary tables; expected outputs are display only; no DAM phases (D8, D27)                                               |
| **Architects stop recording applications** because it feels like overhead                  | Minimal required fields (reason, method, closure); "Create element from here" makes linking a by-product of work; retrospective optional |
| **Broad `methodology_derived` creeps back**                                                | Publish check (D19)                                                                                                                      |
| **Invented methodology** (standards, contexts, stages TPLCo never established)             | Nothing methodological in migrations; backfill waives requirements instead of inventing content; seed is demonstration only              |
| **Removed drafts make application history unreadable**                                     | Captured code, kind, type and title on each link, with a removal timestamp (D30)                                                         |
| **Two capability scopes confuse administration**                                           | One model stated in ADR-0044; identical shape and naming; practice capabilities on their own settings page                               |
| **Release/engagement drift**: engagements left on old releases indefinitely                | Release page lists engagements per release; moving is explicit and logged; no automatic migration                                        |
| **Acceptance criteria drift into scoring or tasks**                                        | No verdict, assignee, date or progress columns; validation stays one judgment (D20, D34)                                                 |
| **Legacy assets look like real methodology**                                               | `legacy` status and banner; cannot be applied or released; adoption is an explicit act (D28)                                             |
| **Enum permanence** locks in a wrong value                                                 | All permanent values listed in §36 for explicit approval before any migration                                                            |
| **Concurrency** (double publish, code allocation, release edits during publish)            | Row locks in operations; counters reuse the ADR-0025 mechanism; suite 99                                                                 |
| **Scope creep into Phase 7** (analytics, scoring, AI)                                      | Read models limited to lists and counts; out-of-scope table (§4)                                                                         |

---

## 40. Definition of Phase 6 completion

Phase 6 is complete when **all** of the following are true on `main`:

1. Every approved decision D1–D34 is implemented as approved, with ADRs 0041–0050 and the ADR-0016, ADR-0009 and ADR-0036 notes written.
2. A `publish_methodology` holder can author, publish, supersede and retire assets of all five forms, and publish a DAM release. A System Administrator without an override cannot do any of these, and this is tested.
3. An architect can apply a published Method version on an engagement, record its context, scope, inputs, evidence, components, stage treatments and outputs, and complete or discontinue it. The closed record cannot be changed, and this is tested.
4. Every element shows its practice provenance. Every Method Asset shows where it has been used. Every release shows its members, its changes and the engagements on it.
5. `methodology_derived` publication requires `instantiates` lineage. Deliverables can record `produced_from`; Reviews and elements can record `judged_against`.
6. Acceptance criteria can be proposed, agreed, superseded and withdrawn; a validation captures the criteria in force; and criteria and approach statements reach clients only as §15 and §17 describe.
7. Deleting a linked unpublished draft leaves its Method Application history readable (D30).
8. Clients see exactly the release label, authored approach statements and agreed acceptance criteria, and nothing else. Every client-denial test passes.
9. Existing data is backfilled as §34 describes. All pre-existing pgTAP suites pass, with only the deliberate enum-list and grant updates.
10. CI ("App", "Database") is green on the final head.
11. A role-by-role browser acceptance pass has been completed and written up, with every defect fixed and re-verified.
12. `CLAUDE.md`, `README.md` and `docs/database/method-library.md` reflect the merged state.
13. Kerrick has reviewed and explicitly approved the merge.

**Not required for completion:**

- deliverable generation;
- AI;
- Pattern Library;
- analytics or learning dashboards;
- licensing;
- DAM phases.
