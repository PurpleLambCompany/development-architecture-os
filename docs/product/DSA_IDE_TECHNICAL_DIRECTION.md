# DSA IDE — Technical Direction

**Status: direction, approved in principle. Not authorization.**
Written 2026-10-03 against commit `1d0282e` (`main`, clean working tree).
Revisable. This document is expected to change as V1 teaches us things.

---

## 1. Purpose

This document records the long-term technical direction for Development Systems Architecture OS: that it should mature into a **DSA IDE** — a governed computational environment for modeling, interrogating, comparing, governing and observing development systems as architecture.

It exists for one reason: **to prevent V1 decisions from accidentally foreclosing that future.** It is not a plan, not a phase proposal, and not a commitment to build anything.

It answers three questions:

1. What must DSA eventually become, technically, for a Development Systems Architect to have professional-grade tooling for organizations comparable to what a software engineer has for software?
2. Which parts of that destination does the system already support, and which current decisions could constrain it?
3. What must be preserved — and what must be refused — while V1-A through V1-E are built?

It deliberately does **not** answer how or when any of it gets built.

---

## 2. Status and non-authorization

**DIRECTION IS NOT AUTHORIZATION.**

This document authorizes no implementation. It does not alter the governing V1 roadmap (`V1_ROADMAP_RECONCILIATION.md`, accepted 2026-10-02, PR #14). It does not lift the §6.1 freeze on Architecture Intelligence, Development Edge or Method Library capability expansion. It does not release Architecture Intelligence Step B, which remains on hold pending separate explicit authorization.

Specifically, nothing here permits:

- starting any work described in §9 (Long-term technical systems)
- building the Architecture Canvas (§10)
- building Portfolio IDE capability (§11)
- building the Structural Coherence Engine (§12)
- connecting any external observation source (§13)
- any schema, migration, RLS, API, authorization or UI change

Everything in this document is **non-binding as to implementation**. The parts that _are_ binding are narrow and stated explicitly in §14 (security and governance constraints), §15 (terminology discipline) and §17 (seams to preserve). Those bind by restating existing governance, not by creating new obligations.

The governing sequence remains unchanged:

```
V1-A  Workflow Closure      →  Gate A
V1-B  Production Foundation →  Gate B  →  supervised pilot begins
V1-C  Participation and Awareness
V1-D  Engagement Outputs
V1-E  Discovery and Scale   →  V1 complete
```

---

## 3. Non-goals, and spec §23

### 3.1 Spec §23 remains in force

The authoritative specification, **§23 — DO NOT BUILD IN FIRST MVP**, lists items that bear directly on this direction. They remain outside the authorized MVP:

- **advanced portfolio analytics**
- **full AI coherence engine**
- **complex graph visualization**
- **real-time collaborative whiteboard**

Three of these map onto concepts described in this document: Portfolio IDE (§11), the Structural Coherence Engine (§12) and the Architecture Canvas (§10). **Their presence here does not move them out of §23.** A future reader who takes this document as license to build any of them has misread it.

The governing V1 roadmap independently places the same items post-V1. Roadmap §5.4 already lists "Graph visualization (spec §23)", "Command palette, cross-engagement analytics", and "Pattern Library, Portfolio Intelligence, certification and licensing (spec §16, §17, §21, §23)" in its post-V1 column. This document is consistent with that placement and does not change it.

### 3.2 This is not a mandate to imitate a software IDE

The objective is **technical depth, not visual resemblance**. This document does not authorize, encourage, or anticipate building something that looks like VS Code or Cursor.

UI sophistication must emerge from architecture and workflow, not substitute for them. An information-dense interface over a system that cannot answer architectural questions is worse than a plain interface over one that can. If a future increment produces impressive panes and no new computational capability, it has failed this direction rather than fulfilled it.

### 3.3 DSA is not software development

The IDE analogy describes a _class of tooling depth_. It does not claim that development architecture is software, or that software engineering practice transfers.

DSA retains its own:

- **ontology** — architecture domains, object types, typed relationships, evidence, decisions
- **governance model** — capability-based authorization, publication as the client boundary, governed adoption
- **epistemology** — provenance, evidence chains, judgment that is dated and attributed rather than computed
- **professional vocabulary** — the terms in §15
- **lifecycle** — propose, compare, review, decide, approve, publish, implement, observe
- **architectural discipline** — what the practice asserts, and on what basis

The computational object is **development architecture**. Not source code.

---

## 4. Definition of "IDE" in DSA

> **DSA IDE is a governed computational environment for modeling, interrogating, comparing, governing, and observing development systems as architecture.**

"IDE" is used here in its technical sense, not as branding or metaphor.

A software IDE is distinguished from a text editor by what it _understands_, not by how it looks. It holds a formal model of the artifact, resolves references, computes dependencies, validates against a type system, surfaces diagnostics before failure, tracks history, compares states, and generates outputs. The interface is downstream of all that.

The standard this direction sets is that a Development Systems Architect working on an organization should eventually have a comparable depth of understanding available in their tooling. Today an architect working on an organization has roughly what a programmer had before compilers: a medium that stores what they wrote, and no capacity to tell them it is inconsistent.

What distinguishes a **governed** computational environment from a merely computational one — and this is the whole of DSA's difference — is that every operation runs inside an authorization and accountability model. In a software IDE, a refactor is a mechanical transformation anyone with write access may perform. In DSA, the equivalent act changes what a practice asserts to a client under contract. The computation is in service of governance, not a substitute for it.

---

## 5. Relationship to spec §19 — this is partly recovery, not expansion

**The authoritative specification already contains this destination.**

Spec **§19 — STRUCTURAL COHERENCE ENGINE (FUTURE)** (line 750) names it as a future premium capability, and specifies its responsibilities. Verbatim, it is to evaluate relationships such as:

- strategy ↔ capability
- capability ↔ operations
- operations ↔ objectives
- governance ↔ responsibility
- metrics ↔ intended outcomes
- knowledge ↔ decisions

and surface:

- contradictions
- missing dependencies
- unsupported assumptions
- governance conflicts
- measurement gaps
- implementation drift

with a potential output of a **Structural Coherence Report**.

This matters for how the whole document should be read. The DSA IDE direction is **not simply new scope**. It is in substantial part the **recovery, clarification and technical maturation of a destination already present in the authoritative specification** — one that subsequent phase work stopped referencing while building the governed substrate that would eventually be required to deliver it.

Spec §18 similarly places Architecture Intelligence as POST-MVP and states that AI should sit _underneath_ the methodology rather than replace it. The direction in §9.5 of this document is continuous with that, not a departure from it.

Two consequences:

1. **The burden of proof shifts.** The question is not "should DSA acquire a coherence engine?" — the specification already answered that. The question is what it must compute, on what evidence, with what defensible semantics, and when.
2. **The freeze is unaffected.** §19 says FUTURE. §23 says the full AI coherence engine is not in the first MVP. Both remain true. Recovery of a stated destination is not acceleration toward it.

---

## 6. Current computational foundations

**DSA IDE is not being proposed on top of an empty CRUD application.** A substantial governed computational substrate already exists. This section records what was verified against the repository at `1d0282e`, because the single most likely way to damage this direction is to rebuild something that already works.

Everything in this section is **BUILT** unless marked otherwise.

### 6.1 Stable element identity across versions

`architecture_relationships.source_element_id` and `target_element_id` reference `public.architecture_elements` — **not** `element_versions`. Versions are append-only snapshots hanging off a stable element identity.

This is the most important enabling fact in the system. Had relationships been attached to versions, questions of the form "what has depended on this element over time" would be close to unanswerable, and any future graph capability would have required migrating the entire architecture corpus. It was not built that way.

_Source: `supabase/migrations/20261001000100_architecture_core.sql`._

### 6.2 Append-only element versions

`public.element_versions` carries `snapshot` and `client_snapshot` as separate `jsonb` columns, unique on `(element_id, version_no)`, with updates and deletes refused by trigger. Published history cannot be rewritten — not by policy, but structurally.

`client_snapshot` is the client-visible projection; `snapshot` is internal. The separation is at the column level, and column grants differ.

### 6.3 Typed, first-class relationships with database-enforced rules

Relationships are rows, not implied foreign keys. `relationship_type` is a typed reference, and legal `(source kind, relationship type, target kind)` pairings are enforced by the `relationship_rules` table through the `guard_architecture_relationship()` trigger — in the database, not in application code.

A formal architecture language (§9.1) therefore partially exists already, and exists in the right layer. _ADR-0016 (object type vocabulary), ADR-0018 (relationship vocabulary), ADR-0013 (element spine)._

### 6.4 Selective acyclicity

Four relationship types are marked `is_acyclic` and enforced on insert by a recursive CTE under an advisory lock: **`part_of`, `specializes`, `precedes`, `supersedes`**. Others permit cycles deliberately, because feedback is a real property of organizations.

Any future whole-graph analysis inherits a graph whose acyclicity guarantees are already explicit per edge type. That is a meaningful head start: the hard part of graph analysis is usually knowing which cycles are errors.

### 6.5 Recursive traversal, already governed

`public.impact_trace()` walks the relationship graph under a governed propagation matrix (`public.relationship_impact_rules`), with per-edge-type propagation (`direct`, `recursive`, `terminal`, `never`), a fixed depth bound, and cycle cutting by path. It is proven by `supabase/tests/51_impact_trace_definer.test.sql` to return identical rows to internal readers under either security model, and nothing to clients.

Traversal is not theoretical here. It is built, bounded and tested. _ADR-0055._

### 6.6 Database-enforced provenance separation for AI

Verified directly in `supabase/migrations/20261007000600_architecture_inferences.sql`:

```sql
epistemic_status  text not null default 'suggested' check (epistemic_status = 'suggested'),
producer          text not null default 'model'     check (producer = 'model'),
```

An AI inference **cannot** be stored claiming to be anything other than a suggestion produced by a model. This is a check constraint, not a convention. The principle that deterministic findings and AI interpretations must remain distinguishable is, on the AI side, already true by construction.

See §9.5.1 for the asymmetry this leaves on the deterministic side.

### 6.7 Authorization in the database

Row-level security is the authoritative layer; application code is not relied on. Permissions are evaluated through **capabilities**, never role-name checks. Architecture authority capabilities (`edit_architecture`, `publish_architecture`, `use_architecture_intelligence`, `authorize_external_ai_processing`) are separated from practice administration, and a System Administrator does not hold them by default.

_ADR-0003 (authorization in the database), ADR-0008 (engagement capabilities), ADR-0074 (practice administration and architectural authority)._

### 6.8 Publication as the client boundary

Clients read published immutable snapshots. Approval is a separate recorded act and **never gates visibility**. Live working tables have no client read policy at all. _ADR-0014, ADR-0021, ADR-0020 (separate status axes)._

### 6.9 Architecture baselines

`public.architecture_baselines` plus baseline items capture a set of specific immutable version identifiers, with a `frozen` status. `public.compare_baselines()` performs set arithmetic between two frozen baselines.

This is today the **only** comparison capability in the system, and the only object that addresses more than one element at once. See §17.1 — it is the most important seam in this document.

### 6.10 Development Edge — deterministic rules

A deterministic rule catalog, mirrored between `private.edge_rules()` and `src/domain/edge/rules.ts`, produces Edge items computed on read and never stored. One triggering change yields one primary event. Human judgments are recorded append-only in `edge_judgments`. No AI is involved.

_ADR-0051 (envelope and rule catalog), ADR-0052 (one triggering change, one primary event), ADR-0056 (edge judgments)._

### 6.11 Architecture Intelligence — read-only, fail-closed, internal

A read-only Tool Contract that withholds Method/IP, licensed sources, evidence content and people. Read-only-ness is proven by `47_ai_no_mutation.test.sql`. Recording runs through a server-only path executable solely by `service_role`. Unevaluated models are refused. The `ARCHITECTURE_INTELLIGENCE_MODE` kill switch defaults off and fails closed. Clients see nothing AI-produced (`46_ai_client_boundary.test.sql`).

Step A is merged and accepted. **Step B remains on hold.** _ADR-0060, ADR-0064, ADR-0067 through ADR-0073._

### 6.12 Summary of foundations

| Capability                                 | Status                          | Where                                                     |
| ------------------------------------------ | ------------------------------- | --------------------------------------------------------- |
| Stable element identity across versions    | BUILT                           | `architecture_elements`, `architecture_relationships`     |
| Append-only published versions             | BUILT                           | `element_versions`                                        |
| Typed relationships, DB-enforced pairings  | BUILT                           | `relationship_rules`, `guard_architecture_relationship()` |
| Selective acyclicity                       | BUILT                           | `relationship_types.is_acyclic`                           |
| Governed recursive traversal               | BUILT                           | `impact_trace()`, `relationship_impact_rules`             |
| Provenance separation (AI side)            | BUILT                           | `architecture_inferences` check constraints               |
| Provenance separation (deterministic side) | PARTIAL — convention only       | `edge_items.producer`                                     |
| Capability-based authorization in RLS      | BUILT                           | ADR-0003, ADR-0008, ADR-0074                              |
| Publication as client boundary             | BUILT                           | ADR-0014                                                  |
| Architecture baselines and comparison      | PARTIAL — frozen baselines only | `architecture_baselines`, `compare_baselines()`           |
| Deterministic rule engine                  | BUILT                           | Development Edge                                          |
| Read-only, fail-closed AI layer            | BUILT (Step A)                  | Architecture Intelligence                                 |
| Whole-architecture version object          | **NOT BUILT**                   | — see §17.1                                               |
| Structural coherence analysis              | **NOT BUILT**                   | spec §19, FUTURE                                          |

---

## 7. IDE conceptual mapping

This mapping is a **starting model for reasoning**, not a specification and not a naming scheme. The normative DSA vocabulary is in §15. The software analogy in its raw form is confined to the non-normative appendix (§20).

| Software concept       | DSA correspondence                                                | Status                                      |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| Project / repository   | Engagement architecture                                           | BUILT                                       |
| Source files           | Architecture elements                                             | BUILT                                       |
| Folders / modules      | Architecture domains and structural organization                  | BUILT                                       |
| Symbols / types        | Object types, actors, capabilities, processes, systems, resources | BUILT                                       |
| References / imports   | Typed architecture relationships                                  | BUILT                                       |
| Dependency graph       | Architecture relationship graph                                   | BUILT                                       |
| Language / type system | Formal DSA ontology and schema                                    | PARTIAL                                     |
| Compiler               | Architecture validation                                           | PARTIAL — pairings validated; coherence not |
| Linter                 | Structural coherence analysis                                     | NOT BUILT — spec §19                        |
| Errors                 | Structural contradictions, invalid architecture                   | NOT BUILT                                   |
| Warnings               | Exposures, risks, weak evidence, unresolved dependencies          | PARTIAL — Development Edge                  |
| Version control        | Governed architecture history                                     | BUILT                                       |
| Commit                 | Governed published version                                        | BUILT                                       |
| Diff                   | **Architecture comparison**                                       | PARTIAL — frozen baselines only             |
| Branch                 | **Proposed architecture**                                         | NOT BUILT                                   |
| Merge                  | **Governed adoption**                                             | NOT BUILT                                   |
| Tests                  | Architecture assertions                                           | NOT BUILT — see §8.3                        |
| Debugger               | Dependency, causality and evidence tracing                        | PARTIAL — `impact_trace()`                  |
| Search                 | Global architecture search                                        | PARTIAL                                     |
| Go to definition       | Navigate to an architecture entity                                | PARTIAL                                     |
| Find references        | Locate everywhere an entity participates                          | PARTIAL                                     |
| Refactoring            | Governed structural change                                        | PARTIAL                                     |
| Build                  | Production of architecture outputs and deliverables               | NOT BUILT — V1-D                            |
| Deploy                 | Movement of approved architecture into implementation             | PARTIAL                                     |
| Runtime observation    | Observation of operating organizational state                     | NOT BUILT — see §13                         |
| Extensions / tooling   | Methods, integrations, specialized tools                          | PARTIAL — Method Library                    |

**The Copilot row has been deliberately removed.** See §8.1.

---

## 8. Where the IDE analogy breaks

The mapping above is useful. These four points are where following it would cause real damage, and they are the most important part of this document.

### 8.1 Architecture Intelligence is not a copilot

**The Copilot analogy is struck from this direction.**

A copilot writes into your buffer. That is its defining behavior, and it is precisely what Architecture Intelligence is architecturally constructed _not_ to do: read-only transactions proven by test; recording executable only by `service_role` through a server-verified path; fail-closed when the mode is off or the model unevaluated; invisible to clients.

Importing the word imports the expectation of a system that proposes edits into the work surface. Every structural guarantee in Phase 7B exists to prevent that.

Architecture Intelligence is **contextual, explanatory, analytical and non-authoring**. It may surface relationships, implications, evidence, contradictions, questions, interpretations and possible concerns. It must not silently mutate governed architecture.

**Human governance remains the boundary between intelligence and architectural change.**

The nearest honest software analogue is hover documentation and the problems panel — contextual, explanatory, never authoring.

### 8.2 Git vocabulary is not DSA vocabulary

In git, a branch is private, cheap and deletable; a merge is a mechanical three-way text operation. Neither is true here.

A **proposed architecture** is a governance artifact with an accountable author. **Governed adoption** is a recorded human decision with a decider and a timestamp. Published versions are immutable by trigger, so history rewriting is not restricted — it is impossible.

Most decisively: **ADR-0014 decouples approval from visibility.** Publication makes something client-visible; approval is a separate, later, recorded act. Git has no analogue for this, because git has no concept of a reader whose access is governed separately from the state of history.

Normative DSA language is **PROPOSAL**, **COMPARISON**, **GOVERNED ADOPTION** — never branch, diff, merge. The git framing is permitted only in the non-normative appendix (§20).

### 8.3 Architecture assertions are not software tests

Software tests are executable, deterministic, and re-runnable at near-zero marginal cost, and their failure is unambiguous.

Architecture assertions may eventually become deterministic and re-evaluable, but they differ in **semantics** (what it means for an architecture to be wrong is contested in a way that a failing assertion about code is not), **evidence requirements** (an assertion may depend on evidence whose quality is itself a judgment), **governance** (who may assert, who may waive) and **consequences** (a failing assertion may be a finding requiring professional judgment, not a defect requiring a fix).

The nearest built analogue is the Development Edge, but Edge rules are **reactive** — keyed to change triggers — which is a different computational shape from a standing assertion suite. Do not claim the two are computationally identical.

### 8.4 "Runtime observation" is where this direction could damage governance

This is the highest-risk item in the entire direction. It is treated in full in §13.

---

## 9. Long-term technical systems

Eight areas preserved for future investigation. **None is authorized.** Each is framed as _how existing foundations could evolve_, not as a replacement for them.

### 9.1 Formal architecture language

**Partially exists.** Object types, typed relationships, DB-enforced pairings, provenance and evidence are already a formal, machine-checked representation. What is absent is the richer layer: invariants, states with semantics, validation rules beyond pairing legality, and domain-specific constructs.

**Do not introduce a new ontology during V1.** The existing vocabulary is the thing to evaluate and extend, not to replace. See §9.8 and §17.4 on the limits of extensibility.

### 9.2 Architecture graph engine

**Partially exists** in `impact_trace()`. The future question is what _other_ governed traversals are defensible, and under what semantics — not whether traversal is possible.

Candidate questions a mature engine might answer: what depends on this; what does this depend on; what supports it; what evidence bears on it; what decisions produced it; what initiatives modify it; what objectives it serves; what exposure propagates through it.

Every such traversal must respect tenant, engagement, client-visibility and authorization boundaries. See §11.2 and §14.

### 9.3 Structural coherence engine

See §12. Already specified in spec §19.

### 9.4 Whole-architecture lifecycle and state comparison

See §17.1. The seam is `architecture_baselines`.

The conceptual lifecycle is:

```
CURRENT → PROPOSE → COMPARE → REVIEW → DECIDE → APPROVE → PUBLISH → IMPLEMENT → OBSERVE
```

Of these, CURRENT, REVIEW, DECIDE, APPROVE, PUBLISH and IMPLEMENT have real implementations. COMPARE exists only between frozen baselines. PROPOSE and OBSERVE do not exist.

**Do not design or implement a scenario or versioning subsystem now.**

### 9.5 Architecture Intelligence

Direction: toward contextual professional intelligence situated in the architect's working context — explain this element, trace these dependencies, identify evidence requiring attention, surface contradictions, summarize changes, prepare material for review — and away from a general chat surface.

Three constraints are permanent:

1. **AI suggestion → human architectural judgment → governed action.** The chain may not be shortened.
2. **AI must never silently modify governed architecture.**
3. **Step B remains on hold** until separately authorized.

#### 9.5.1 A provenance asymmetry to record now

On the AI side, provenance is a check constraint (§6.6). On the deterministic side, `edge_items.producer` is a plain nullable `text` column in a computed envelope, set to `'rule'` by comment convention only:

```sql
-- producer is always 'rule' in 7A (the column exists so a later phase can add
-- another producer without reshaping the envelope; nothing of 7B is built).
```

This is correct today, because Edge items are computed on read and never persisted. It stops being correct the moment a Structural Coherence Engine **persists** deterministic findings: at that point AI inferences would be constrained to declare their producer while deterministic findings would not, and the guarantee becomes one-sided.

**Future requirement (not now):** persisted Structural Coherence findings must carry constrained provenance. The system should eventually be able to structurally distinguish, at minimum:

| Class                     | Meaning                                      |
| ------------------------- | -------------------------------------------- |
| **DETERMINISTIC FINDING** | Computed by stated rules from recorded state |
| **AI INTERPRETATION**     | Suggested by a model; never established fact |
| **HUMAN JUDGMENT**        | Asserted by a named person on a date         |
| **GOVERNED DECISION**     | Decided through an authorized governance act |

Recording this now costs one paragraph. Retrofitting it costs a migration over persisted findings.

### 9.6 Engagement IDE and Portfolio IDE

See §11.

### 9.7 Observation of real-world system state

See §13.

### 9.8 Extensible architecture tooling and integrations

The Method Library is the existing substrate. Extensibility in DSA today means **governed extension** (§17.4), not user-defined ontology.

---

## 10. Architecture Canvas

The Architecture Canvas is preserved as the conceptual **future central work surface** of DSA IDE.

**Not authorized for implementation.**

### 10.1 Concept

A surface through which an architect moves between architecture elements, relationships, evidence, decisions, implementation, observations, findings and historical states — travelling from macro-system understanding to an individual governed object without losing context.

The conceptual shell is:

```
NAVIGATOR  |  CANVAS  |  INSPECTOR
```

where **Canvas** is the primary architectural working surface.

### 10.2 What the Canvas must not become

**The Architecture Canvas must not become a generic node graph or a digital whiteboard.** Spec §23 excludes both complex graph visualization and real-time collaborative whiteboarding from the first MVP, and the exclusion is substantive rather than merely a matter of timing.

A whiteboard lets anyone draw anything. The Canvas exists to **expose and manipulate governed architecture through authorized operations**. Every object on it is a governed object; every manipulation is an authorized operation subject to the same RLS and capability checks as any other path into the system. A Canvas that permits ungoverned drawing has abandoned the thing that makes DSA defensible.

### 10.3 Terminology note on "Canvas"

As directed, the term was checked against the authoritative system before adoption. Two incidental, non-authoritative uses exist:

- `docs/product/PHASE_3_PROPOSAL.md` — "it needs no graph canvas", describing an absence
- `docs/product/PHASE_1_REPORT.md` — "warm paper canvas", describing the visual background of the design system

Neither is a defined DSA term, so **"Architecture Canvas" is available**. The second is worth noting: the design system already uses "canvas" informally for the page background surface. When the Canvas concept becomes concrete, the design-system usage should be renamed rather than the architectural one. Flagged here rather than changed, per instruction.

"Navigator" has no existing use. "Inspector" appears once, in `PHASE_7B_1_PROPOSAL.md` OD-12, as a rejected alternative ("a read-only inference inspector") — not a defined term.

---

## 11. Engagement IDE and Portfolio IDE

The IDE concept operates at two levels, and the boundary between them is an architectural constraint, not a product preference.

### 11.1 Definitions

**Engagement IDE** — reasoning, modeling, governance, implementation tracking and intelligence **within one client engagement**. This is where architecture lives. All traversal, coherence analysis, comparison and intelligence operate here.

**Portfolio IDE** — authorized aggregation and navigation **across multiple independent engagement architectures**. The stress case to design against is an internal practice carrying at least eleven simultaneous clients spanning the eleven GICS economic sectors.

### 11.2 The engagement boundary is enforced by composite foreign key

Verified in `supabase/migrations/20261001000100_architecture_core.sql`:

```sql
constraint architecture_relationships_source_fk foreign key (source_element_id, engagement_id)
  references public.architecture_elements (id, engagement_id) on delete cascade,
constraint architecture_relationships_target_fk foreign key (target_element_id, engagement_id)
  references public.architecture_elements (id, engagement_id) on delete cascade,
```

A relationship **cannot** cross engagements. Not "is not permitted to" — cannot, structurally. The architecture graph is partitioned by engagement at the database level.

**This is a property to preserve, not a limitation to remove.**

### 11.3 The consequence for Portfolio IDE

**Portfolio IDE must never be conceptualized as one graph spanning multiple clients.** It is an aggregation _over_ many separate graphs.

| Portfolio IDE may aggregate (where authorized) | Portfolio IDE must never create             |
| ---------------------------------------------- | ------------------------------------------- |
| Counts                                         | Cross-engagement architecture relationships |
| States                                         | Cross-engagement traversal                  |
| Dates and deadlines                            | A unified multi-client architecture graph   |
| Risk and findings summaries                    | Any path between two clients' elements      |
| Progress                                       |                                             |
| Portfolio-level metadata                       |                                             |

Aggregate practice intelligence must remain distinguishable from exposure of client-specific information.

### 11.4 The specific leak risk

Practice-level users (System Administrator, Principal Architect, Finance Administrator) already have portfolio-wide visibility by design, so for them a portfolio view exposes nothing new.

The risk is giving an **assignment-limited** user — a Project Administrator — a portfolio summary. Counts, deadlines or economics across engagements they are not assigned to would breach tenant isolation **without exposing a single readable row**, through aggregate inference alone. The risk is sharpest where the population is small: with one engagement per client, a count distinguishes existence from absence.

Portfolio capability must therefore be gated at the practice level, explicitly, and proven in pgTAP rather than assumed.

---

## 12. Structural coherence

### 12.1 Already specified

Spec §19 defines the responsibilities (§5 above). This section records only what reconciliation adds.

### 12.2 The Development Edge is a foundation, not the engine

The Edge is **event-triggered**: it answers "what changed, and what does that change bear on?" A Structural Coherence Engine is **standing**: it answers "what contradictions exist in this architecture right now?"

These are different computational shapes with different triggering, caching and cost characteristics. The Edge is the right foundation — deterministic, rule-catalogued, with governed impact propagation and recorded human judgments — but **conflating the two is the most likely implementation error**, and would produce an engine that only ever notices problems introduced by recent edits.

### 12.3 The depth-2 bound is a governed epistemic boundary

`impact_trace()` is bounded at depth 2, hard-coded, with the source comment _"There is no user-selectable depth."_

**This bound is not a performance setting.** It expresses what the system is willing to claim is affected. Beyond a defensible proximity, a propagation claim becomes speculation presented with the authority of computation — which is precisely the failure mode a governed system must avoid.

**Do not simply increase this depth for the Structural Coherence Engine.** Whole-architecture analysis must define its **own defensible semantics**: what it claims, on what basis, with what confidence, and how a reader is to distinguish a structural fact from an inference about structure. Raising a constant is not a substitute for answering that.

### 12.4 Deterministic and interpretive findings remain separable

The §9.5.1 provenance requirement applies in full to anything this engine persists.

---

## 13. Observation and evidence

### 13.1 The permanent principle

> **OBSERVATION MAY PRODUCE EVIDENCE.**
> **OBSERVATION MAY NOT PRODUCE JUDGMENT.**

Future ERP, CRM, HRIS, GIS, financial, operational, sensor or other machine-generated signals may eventually become evidence available to DSA.

They must never automatically:

- determine domain maturity
- validate implementation initiatives
- approve architecture
- adopt proposals
- make governance decisions

### 13.2 Why this is the highest-risk item

Two existing governance guarantees sit directly in the path of an observation loop, and both would be natural engineering casualties:

- **ADR-0019 — domain maturity is a dated judgment, never a score.** An observation feed creates immediate, obvious pressure to compute maturity from observed data. Doing so would convert an attributed professional judgment into a derived number, and the client-facing defensibility of the assessment with it.
- **ADR-0036 — implementation status and the validated gate.** An initiative reaches `validated` only through a `validates` relationship from a Review. An observation loop that auto-validates from external completion signals would bypass the recorded human act that the gate exists to capture.

Both would be reasonable-looking engineering decisions. Both would be governance regressions. They are recorded here so that a future implementer meets the objection before writing the code rather than after.

### 13.3 Machine-originated evidence is an unsolved provenance problem

The evidence chain (ADR-0015) assumes human-attributed provenance. Machine-ingested enterprise data is a provenance class with no model today — no account of attribution, freshness, authority, contestability or correction. This is a genuine open problem, recorded as DQ-6, not a detail of integration plumbing.

### 13.4 Designed, implemented and observed state

The long-term value of observation is the ability to distinguish **designed state** from **implemented state** from **observed state** — and to make divergence between them visible as a finding for professional judgment. That is the goal. It is reached by making divergence _legible_, not by making the system _resolve_ it.

---

## 14. Security and governance constraints

These restate existing governance. They bind any future IDE work.

1. **Engagement isolation is preserved absolutely.** Portfolio capability must not weaken it (§11). The composite-FK partition stands.
2. **New traversal inherits governed authorization.** Any future traversal must follow a governed propagation matrix with a stated bound and per-row RLS evaluation, after the pattern of `impact_trace()` and its proof in `51_impact_trace_definer.test.sql`. Traversal must not be wired to the deprecated `intelligence_impact` / `implementation_impact` functions, which do not follow the matrix.
3. **Capability logic is not duplicated in TypeScript.** The database is authoritative. `src/domain/capabilities/catalog.ts` mirrors database logic for display; authorization decisions must call the database, or overrides silently stop applying.
4. **Fail-closed posture is preserved.** Unavailable, unevaluated or unauthorized means _nothing happens and nothing is offered_ — not a degraded result.
5. **Publication remains the client boundary.** No IDE surface may expose working state, Method/IP, Edge items or AI output to a client. ADR-0014 governs.
6. **Architecture authority remains separate from practice administration.** ADR-0074 stands; a System Administrator does not acquire architectural authority by virtue of building new surfaces.
7. **Aggregates are a disclosure channel.** Counts over small populations leak. Portfolio features require explicit practice-level gating and adversarial pgTAP proof.

---

## 15. Terminology discipline

Several terms already carry authoritative DSA meaning. Future IDE terminology **must not silently overload them**.

| Term               | Existing authoritative meaning                                                                                                                          | Severity                     | Rule                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **domain**         | One of four architecture domains — Knowledge, Capability, Strategic Model, Application (ADR-0016). Also `src/domain/` as the business-logic code layer. | **High** — already ambiguous | Always qualify: "architecture domain" or "code layer". Never introduce a third sense.                                                           |
| **implementation** | `implementation_initiatives` is a Phase 5 element kind with a governed `validated` gate (ADR-0034, ADR-0036, ADR-0039).                                 | **High**                     | Never use unqualified for the act of realizing architecture. Say "Implementation Initiative" for the record, "implementation work" for the act. |
| **workspace**      | Spec §5.2, _Development Architecture Workspace_ — each engagement contains four architecture workspaces.                                                | **High**                     | **Preserved as specified.** The IDE shell uses NAVIGATOR \| CANVAS \| INSPECTOR, never "workspace" for a pane.                                  |
| **element**        | The core unit of architecture; `architecture_elements` (ADR-0013).                                                                                      | Medium                       | Qualify as "architecture element" where UI elements are also in scope.                                                                          |
| **reference**      | Reference _codes_ — permanent engagement-scoped element identifiers (ADR-0025).                                                                         | Low                          | Prefer "navigate to" and "participations" over IDE "go to definition" / "find references" in normative text.                                    |
| **build**          | `next build`. CI.                                                                                                                                       | Low                          | Do not use for deliverable generation in normative text. Say "generate deliverables".                                                           |
| **deploy**         | Production deployment (V1-B).                                                                                                                           | Low                          | Do not use for moving architecture into implementation. Say "move into implementation".                                                         |
| **runtime**        | Next.js / operational sense.                                                                                                                            | Low                          | Do not use for organizational operation. Say "observed state".                                                                                  |
| **test**           | Vitest, pgTAP, Playwright.                                                                                                                              | Low                          | Do not use for architecture assertions. Say "architecture assertion" (§8.3).                                                                    |
| **canvas**         | No authoritative meaning. Informal design-system use for the page background.                                                                           | Low                          | "Architecture Canvas" is available. See §10.3.                                                                                                  |

---

## 16. Compatibility with V1-A → V1-E

**Nothing in this document changes V1 scope, sequence or gates.**

| Phase                            | Changed by this document? |
| -------------------------------- | ------------------------- |
| V1-A Workflow Closure            | No                        |
| V1-B Production Foundation       | No                        |
| V1-C Participation and Awareness | No                        |
| V1-D Engagement Outputs          | No                        |
| V1-E Discovery and Scale         | No                        |
| Gate A / Gate B conditions       | No                        |
| Roadmap §6.1 freeze              | No — remains in force     |
| Architecture Intelligence Step B | No — remains on hold      |

V1 work should favor decisions that are **compatible** with this direction, **reversible** where the future is uncertain, **non-destructive** to existing architectural semantics, and **capable of supporting richer computation later**.

V1 must **not** build speculative IDE infrastructure. This direction is not a justification for scope expansion in any phase.

> **PRESERVE THE DESTINATION. BUILD ONLY THE AUTHORIZED PHASE.**

---

## 17. Architectural seams to preserve now

Five seams. Preserving them costs nothing today; losing them is expensive later.

### 17.1 `architecture_baselines` is the whole-architecture state seam

**There is no first-class whole-architecture version object.** Versioning is strictly per element (`element_versions`, unique on `(element_id, version_no)`). No object represents "the state of this engagement's architecture at time T".

Every capability in §9.4 — architecture-level comparison, historical reconstruction, proposed architectures, scenario modeling, scenario comparison, governed adoption — requires one. The only existing candidate is `architecture_baselines` plus its items.

**Preserve baselines as the generalization point.** Specifically: do not narrow baseline semantics so that a baseline can only ever be a manual, client-facing milestone. A future proposal or scenario model will need baselines to serve also as cheap internal reference points.

**Do not design or implement a scenario subsystem now.**

### 17.2 Element identity must remain stable and relationship-addressable

Relationships must continue to reference elements, never versions (§6.1). Any change that attaches relationships to versions would be very difficult to reverse.

### 17.3 Provenance must remain constrainable

Before any deterministic finding is **persisted**, the provenance classes in §9.5.1 must be settled. While findings are computed on read, nothing is at risk.

### 17.4 Governed extension, not user-defined ontology

Extensibility in DSA today means **governed extension** through migrations, architecture rules, database constraints, RLS policies and typed application updates. Adding an element kind requires an enum change, a subtype table, a guard trigger, hand-written RLS, `relationship_rules` registration, and a matching TypeScript update, with `vocabulary.test.ts` failing on drift.

This is sound discipline and it has worked. It does **not** mean arbitrary user-defined ontology.

**Genuinely user-extensible element types are a separate future research problem** (DQ-3). The blocking issue is RLS policy generation: today every new kind requires hand-written policies, and user-defined types would require generating authorization policy from user input — a materially different and more dangerous problem than adding a type.

### 17.5 The depth bound must remain a stated semantic

If the bound in `impact_trace()` is ever changed, the change must be accompanied by a stated justification of what the system now claims (§12.3). It must not drift as a tuning parameter.

---

## 18. Deferred technical questions

Open. Not scheduled. Not authorized.

| #         | Question                                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DQ-1**  | What is the defensible semantics of whole-architecture coherence analysis — what does the system claim, on what basis, and how does a reader distinguish a structural fact from an inference about structure? (§12.3) |
| **DQ-2**  | What object represents whole-architecture state, and is it a generalization of `architecture_baselines` or something new? (§17.1)                                                                                     |
| **DQ-3**  | Can element types become user-extensible without generating RLS policy from user input, and if not, what is the safe subset? (§17.4)                                                                                  |
| **DQ-4**  | What provenance model governs persisted Structural Coherence findings, and how are the four classes in §9.5.1 enforced?                                                                                               |
| **DQ-5**  | What is a "proposed architecture" as a governance object — who may author one, what is its visibility, can it be withdrawn, and what record does withdrawal leave?                                                    |
| **DQ-6**  | What provenance, freshness, authority and contestability model governs machine-originated evidence? (§13.3)                                                                                                           |
| **DQ-7**  | Which additional governed traversals are defensible beyond `impact_trace()`, and what bound does each require?                                                                                                        |
| **DQ-8**  | How does Portfolio IDE aggregate across engagements without aggregate inference leaking engagement existence or size? (§11.4)                                                                                         |
| **DQ-9**  | What are architecture assertions, formally — their evidence requirements, waiver governance, and consequences? (§8.3)                                                                                                 |
| **DQ-10** | Does the Architecture Canvas require a persisted layout model, and if so, is layout governed state or user preference?                                                                                                |
| **DQ-11** | How is divergence between designed, implemented and observed state represented without implying the system can resolve it? (§13.4)                                                                                    |

---

## 19. Candidate post-V1 research sequence

**Candidate only. Not a plan. Not authorized. Subject to what the pilot teaches.**

The ordering principle is that each step should be answerable with evidence from real use, and each should be cheap to abandon.

| Step   | Focus                                               | Why here                                                                |
| ------ | --------------------------------------------------- | ----------------------------------------------------------------------- |
| **R1** | Settle provenance classes (DQ-4)                    | Cheapest, and blocks anything that persists findings                    |
| **R2** | Define whole-architecture state (DQ-2)              | Blocks comparison, proposals and scenarios                              |
| **R3** | Define coherence semantics (DQ-1)                   | The core intellectual problem; needs real architectures to test against |
| **R4** | Governed traversal catalogue (DQ-7)                 | Extends a proven mechanism                                              |
| **R5** | Proposed architecture as a governance object (DQ-5) | Needs R2                                                                |
| **R6** | Architecture assertions (DQ-9)                      | Needs R3                                                                |
| **R7** | Portfolio aggregation safety (DQ-8)                 | Independent; gated on practice scale justifying it                      |
| **R8** | Canvas interaction model (DQ-10)                    | Last, deliberately — the surface should follow the computation          |
| **R9** | Machine-originated evidence (DQ-6)                  | Highest governance risk; should not be attempted before R1              |

R8's position is intentional. The Canvas is the most visible item and the most likely to be pulled forward for the wrong reasons. A work surface over computation that does not yet exist is a mockup.

---

## 20. Non-normative IDE analogy appendix

**NON-NORMATIVE.** Explanatory only. Nothing in this appendix is DSA vocabulary, and nothing in it may be cited as a design requirement.

The software-development framing below is retained because it is useful for explaining the direction to a technical audience. Where it conflicts with §15 or §8, those sections govern.

| Software        | Rough DSA analogue              | Caution                                               |
| --------------- | ------------------------------- | ----------------------------------------------------- |
| Repository      | Engagement architecture         | —                                                     |
| Commit          | Governed published version      | Immutable; cannot be rewritten or rebased             |
| Branch          | Proposed architecture           | Not private, not cheap, not deletable without record  |
| Diff            | Architecture comparison         | Exists only between frozen baselines today            |
| Merge           | Governed adoption               | A recorded human decision, not a mechanical operation |
| Linter          | Structural coherence analysis   | Standing, not reactive                                |
| Compiler errors | Structural contradictions       | Contestable in a way compiler errors are not          |
| Test suite      | Architecture assertions         | See §8.3 — not computationally equivalent             |
| Debugger        | Dependency and evidence tracing | Bounded by governed depth                             |
| Build           | Deliverable generation          | —                                                     |
| Deploy          | Movement into implementation    | Gated by Review, not by pipeline                      |
| Runtime         | Observed organizational state   | May produce evidence, never judgment                  |
| Copilot         | **No analogue. Struck.**        | See §8.1                                              |

---

## 21. Explicit non-authorization statement

**This document authorizes nothing.**

It does not authorize implementation of any capability described in it. It does not alter the V1-A → V1-E roadmap, its gates, or its sequence. It does not lift the roadmap §6.1 freeze on Architecture Intelligence, Development Edge or Method Library capability expansion. It does not release Architecture Intelligence Step B. It does not modify spec §23, which remains in force.

No product code, database schema, migration, RLS policy, API, authorization behavior or UI implementation is changed by this document.

Any work arising from this direction requires separate, explicit authorization, and — where it would add capability in a frozen area — stops and goes to Kerrick first.

> **DIRECTION IS NOT AUTHORIZATION.**
> **PRESERVE THE DESTINATION. BUILD ONLY THE AUTHORIZED PHASE.**
