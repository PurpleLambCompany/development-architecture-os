# Phase 3 — Architecture Core: Proposal

**Status:** Approved for implementation 2026-09-30 (revision 3 with the final vocabulary corrections). Being built on this branch.
**Branch:** `phase-3-architecture-core` · **Date:** 2026-09-30
**Builds on:** Phase 1 (engagements, roles, capabilities, RLS) and Phase 2 (commercial engagement), both merged.
**Governing documents:** `DSA_OS_MASTER_BUILD_SPEC.md` §3, §5.2, §6, §8, §14–§15, §18–§20, §26–§27; ADR-0008 (engagement capabilities); ADR-0009 (provenance).

Phase 3 turns the Development Architecture Method into structured software. It covers:

- the four architecture domains and their objects;
- the connections between them;
- the Project Intelligence records that explain and qualify them: assumptions, risks, constraints, dependencies, decisions and recommendations;
- the evidence system they cite.

Every element carries its provenance, a lifecycle, a client-visibility setting and a version history. Every domain object also carries a maturity.

Phase 3 does not build AI or Architecture Intelligence. It builds the structured foundation that AI can work on later. Every material statement is stored as its own record, with its provenance and explicit links to evidence:

```
Architecture element
    ↓
Statement              (provenance, visibility, AI review state)
    ↓
Statement evidence link (supports, contradicts or context; locator)
    ↓
Evidence source        (reference now; attached files later)
```

That chain is what citations, uploads, research and later analysis will build on.

---

## 1. Principles

1. **Architecture is structured data, not pages.** An engagement's architecture is a connected set of typed objects and typed relationships (spec §3). Documents and deliverables are produced from it later (Phase 5), never the other way round.
2. **Four domains stay distinct.** Each core architecture object belongs to exactly one domain, fixed by its type. Project Intelligence records are not forced into one domain: they may relate to one or more domains, to specific objects, or to the engagement as a whole (§3.2).
3. **Not a task system.** Architecture objects have no assignee queue, due-date board, percent-complete or kanban columns. They have an accountable owner, a lifecycle, a maturity and evidence. Implementation tracking stays a separate axis for Phase 5 (spec §13).
4. **Provenance everywhere.** Every element and every material statement records one of the eight ADR-0009 provenance types, with who recorded it, when, and its source where one exists. AI analysis cannot reach a client unless a person has reviewed it.
5. **Working copy is internal; a published version is eligible for client visibility; approval is a separate action on a published version.** Clients read only immutable published versions. Approval never decides who may see something that TPLCo intentionally published.
6. **Authority comes from capabilities, not role names.** Roles supply defaults; engagement capabilities decide actual authority, in the database (ADR-0008).
7. **The database is the authority.** As in Phase 2:
   - visibility is enforced by RLS;
   - lifecycle changes, publication and approvals go only through `SECURITY DEFINER` operations;
   - those operations check permission, validate, write history and re-check invariants.
8. **The Method/IP boundary holds.** A client may see an object that was derived from the Method, but never the Method asset it came from. Method lineage lives in an internal-only table.
9. **Finance never controls architecture.** No architecture table references a finance table, and no finance change alters architecture state (§13).

---

## 2. Scope

### 2.1 Built in Phase 3 (approved)

- The four domain workspaces: Knowledge, Capability, Strategic Model and Application.
- Core architecture objects from the §4 type catalog, with typed attributes.
- Typed relationships between elements, with allowed pairings enforced by the database.
- The underlying Project Intelligence records: assumptions, risks, constraints, dependencies, decisions (with options) and recommendations.
- The evidence system: evidence sources, and explicit evidence links from statements and elements. Evidence is recorded by reference, and the model is ready for files to be attached later.
- Material statements inside elements, each with its own provenance, evidence links and visibility.
- Provenance (ADR-0009) and IP classification (spec §15) on every element.
- The element lifecycle, object maturity, dated domain maturity assessments, publication, versioning and minimal baselines.
- Client approvals on exact published versions and baselines, from the portal or recorded externally with evidence.
- Client decisions on decision records.
- The internal architect workspace and the client Architecture area.
- New engagement capabilities (§8.1).

### 2.2 Not in Phase 3

- **AI and Architecture Intelligence:** summarizing, gap detection, coherence checks and drafting (spec §18, §19). The `ai_analysis` provenance value and its review gate exist so that AI can later write into the structure safely.
- **The fuller Project Intelligence experience (Phase 4):**
  - register triage and filtering depth;
  - the opportunity register;
  - client actions;
  - per-area assignment for Client Contributors.
- **Executive review sessions (Phase 5):** the agenda, the live review mode and review items. Phase 3's approval record and baselines are the primitives that reviews will reuse.
- **Deliverables and implementation tracking (Phase 5).**
- **Method Library UI, templates, pattern library and Method versioning (Phase 6).** Phase 3 records only the internal lineage link to an existing `method_assets` row.
- **Graph visualization** (spec §23). Phase 3 uses trees, matrices, grouped lists and a trace view instead.
- **Evidence file uploads.** The shared upload UI is a Phase 2 pre-production requirement; files attach to existing evidence records when it arrives (§6.8).
- **Financial milestone links to architecture.** They are designed in §13 and built later.

### 2.3 Conflicts with the specification (surfaced as `CLAUDE.md` requires)

| Spec                                                                             | This proposal                                                                                                                             | Status                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| §31 puts evidence, assumptions, risks, dependencies and decisions in **Phase 4** | Their **records** are built in Phase 3. Phase 4 builds the fuller Project Intelligence **experience**                                     | Approved 2026-09-30                               |
| §26 `architecture_objects.client_visible` boolean, read directly                 | Clients read published **version snapshots**. `client_visibility` decides whether a published version reaches clients                     | Approved (publication is the visibility boundary) |
| §26 `metadata_json` on objects                                                   | `attributes` jsonb, validated per object type by a versioned schema                                                                       | Part of the §4 review                             |
| §26 `dependencies` between objects only                                          | Dependencies connect any two elements, such as a risk and a capability                                                                    | Follows the approved structural rule              |
| §26 `decisions.client_decision` free text                                        | Options, a recommended option, and the client's chosen option, recorded with who, when and how                                            | Proposed                                          |
| §11 review actions (approve, approve with comments, request revision, defer)     | Phase 3 approval responses are `approved` (with an optional comment) and `changes_requested`. `acknowledged` can be added later if needed | Approved minimum                                  |
| §5.2 "program structure" and "product structure"; §3 "Application Format"        | One type, **Application Format**, with a format kind (program, product line, team and so on)                                              | Part of the §4 review                             |

---

## 3. The element model

Everything in the architecture workspace that can be connected, evidenced, versioned, published or approved is an **element**. There are two families:

| Family                           | Kinds                                                                          | Domain rule                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **Core architecture objects**    | `object`, typed by the §4 catalog                                              | Exactly one of Knowledge, Capability, Strategic Model or Application          |
| **Project Intelligence records** | `assumption`, `risk`, `constraint`, `dependency`, `decision`, `recommendation` | Zero, one or several domains; specific elements; or the engagement as a whole |

Evidence sources are **not** elements. They are a separate source and evidence system that elements and statements cite through explicit evidence links.

### 3.1 Why one spine with subtype tables

All elements share one table (`architecture_elements`), which holds the common columns. Each kind has its own table, keyed by the same id, for the fields that kind needs.

- **Relationships, evidence links, statements, versions and approvals can use real foreign keys.** A risk can threaten a capability and a decision can affect an operating model, without polymorphic "type + id" columns that the database cannot check.
- **Each kind keeps its own fields and status.** A risk keeps probability, impact and mitigation. A decision keeps its options. A register never collapses into a generic "item".
- **One RLS model and one versioning model** cover every kind.

The alternatives were rejected:

- **A table per kind, with no spine.** This would need polymorphic links, or a join table per pair of kinds.
- **One generic table with jsonb for everything.** This is the generic task system the brief warns against.

### 3.2 Scope of Project Intelligence records

A Project Intelligence record states its scope in up to three ways, which can be combined:

- **Domains:** zero or more rows in `intelligence_record_domains` (for example, the risk "Leadership succession failure" relates to Capability and Application).
- **Specific elements:** the Project Intelligence relationships `underpins`, `threatens`, `constrains`, `mitigates`, `affects` and `addresses` (§9.4).
- **Engagement-wide:** `engagement_wide = true` when the record concerns the development as a whole.

A record must use at least one of the three, so nothing floats without scope. Core architecture objects never use `intelligence_record_domains`: their single domain comes from their type.

---

## 4. Architecture object types: vocabulary and definitions

**For final review before implementation.** These names become database keys, reference-code prefixes and, in software, the vocabulary of the Development Architecture Method. Renaming one after data exists means a migration and a rewrite of stored history, so they should be settled now.

There are **27 core architecture object types**: Knowledge 8, Capability 5, Strategic Model 5 and Application 9. Revision 2 had 28; moving Constraint out of Knowledge Architecture (§4.5) leaves 27. No type has been added to replace it.

There are also **six Project Intelligence record kinds**: Assumption, Risk, Constraint, Dependency, Decision and Recommendation.

### 4.0 Naming rules

- **Architecture, not work.** Every type names something that is part of the development system: an ability, a structure, a condition, a logic, a measure. No type names a task, a deliverable, a meeting or a status.
- **Singular nouns.** Each type has a permanent database key (`snake_case`) and a display label. The label can be reworded later without a migration; the key cannot.
- **Definitions say what the type is not,** where there is a nearby concept it could drift into.
- **Readiness is not maturity.**
  - **Maturity** (Undefined → Operationalized) describes how well the **architecture** of an object is defined. It applies to every object. Domain maturity is a separate, dated judgment per domain.
  - **Capability readiness** describes whether the **client organization currently has** a capability. It is a Capability attribute only, and never feeds object or domain maturity.
- **Outcomes are not measures.** An Intended Outcome (Strategic Model) is the desired condition. A Metric (Application) is how it is measured. The two are connected by a relationship (§9), never merged.
- **Features the spec lists that are views** (domain map, concept hierarchy, capability map, role-to-skill mapping, model library) are built from objects and relationships and are not types.
- **Reference codes use a permanent three-letter prefix per domain or record kind:**
  - `KNW`, `CAP`, `STR`, `APP` for the four domains;
  - `ASM` (Assumption), `RSK` (Risk), `CNS` (Constraint), `DEP` (Dependency), `DEC` (Decision), `REC` (Recommendation) for Project Intelligence records;
  - examples: `CAP-004`, `CNS-002`. Codes stay stable even if a type is later renamed or split.

### 4.1 Knowledge Architecture: what must be understood (8 types)

| Key                  | Label              | Definition                                                                                                                                             | Key attributes                                                                                                                   |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `knowledge_area`     | Knowledge Area     | A defined field of understanding that the development depends on, such as a market, a discipline or a policy field. Not a document or a source         | Scope statement; criticality (foundational, significant, contextual)                                                             |
| `concept`            | Concept            | A term or idea within a knowledge area that the architecture relies on, with an agreed meaning and boundary                                            | Definition; what it excludes                                                                                                     |
| `research_question`  | Research Question  | A question whose answer the architecture needs, stated precisely enough to be answered. Not a research task                                            | Question; why it matters; status (open, answered, set aside); answer summary                                                     |
| `knowledge_gap`      | Knowledge Gap      | Something the architecture needs to know but does not yet, with the consequence of not knowing it                                                      | What is unknown; consequence if unresolved; closure approach                                                                     |
| `regulatory_factor`  | Regulatory Factor  | A law, regulation, licence condition or policy obligation that is part of the development's context. The limits it imposes are recorded as Constraints | Jurisdiction; instrument; obligation; binding (mandatory, conditional)                                                           |
| `competitive_factor` | Competitive Factor | An actor, alternative or market force the development must be positioned against                                                                       | Actor or force; current position; implication                                                                                    |
| `system_boundary`    | System Boundary    | The defined edge of the development system: what is inside, what is outside, and the interfaces between them                                           | Inside; outside; interfaces                                                                                                      |
| `stakeholder`        | Stakeholder        | A person, group or institution whose interests, authority or influence shape the development. Not a user account                                       | Kind (individual, group, institution); interest; influence (low, moderate, high); stance (supportive, neutral, opposed, unknown) |

Views: the **domain map** and **concept hierarchy** are built from `part_of` and `specializes` relationships among knowledge areas and concepts.

### 4.2 Capability Architecture: what the organization must be able to do (5 types)

| Key              | Label                 | Definition                                                                                                                                                | Key attributes                                                                                                                                                              |
| ---------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capability`     | Capability            | A durable ability the organization must have to achieve its development objective, independent of who performs it or how. Not a team, a role or a project | Tier (strategic, core, enabling); leadership capability (yes, no); current readiness (absent, emerging, partial, established); ownership model (internal, external, shared) |
| `skill`          | Skill                 | A specific proficiency that people must hold for a capability to function                                                                                 | Skill family; baseline proficiency (foundational, proficient, expert)                                                                                                       |
| `role`           | Role                  | A defined position of responsibility that brings skills together to deliver capabilities. Describes the position, never a named person                    | Purpose; sourcing (internal, external, shared); leadership role (yes, no); indicative capacity                                                                              |
| `capability_gap` | Capability Gap        | The difference between the capability the organization has and the capability it requires, stated so that it can be closed                                | Current state; required state; closure approach (develop, hire, partner, acquire, outsource)                                                                                |
| `talent_stage`   | Talent Sequence Stage | A stage in the order in which people and capabilities are brought into the development, with the condition that triggers it                               | Sequence; trigger condition                                                                                                                                                 |

Views: the **capability map** (capabilities through `part_of`) and the **role-to-skill matrix** (`role requires skill`, with the proficiency that role needs carried as the relationship's qualifier, §9.1).

### 4.3 Strategic Model Architecture: the logic by which the development succeeds (5 types)

| Key                     | Label                   | Definition                                                                                                                                                                                           | Key attributes                                               |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `intended_outcome`      | Intended Outcome        | The desired condition or result that the architecture is intended to produce. Not a KPI, measurement, deliverable, activity or task. How it is measured belongs to Application Architecture (Metric) | Desired condition; horizon (near, medium, long); beneficiary |
| `strategic_model`       | Applied Strategic Model | A strategic model applied to this engagement: how it applies here and where it stops applying. The model itself belongs to the internal Method Library; this is its application                      | Model name; application; applicability limits                |
| `structural_leverage`   | Structural Leverage     | A feature of the system's structure that, when used, produces a disproportionate effect                                                                                                              | Lever; mechanism; expected effect (qualitative)              |
| `differentiation_logic` | Differentiation Logic   | The reasoning for why this development will be distinct and defensible against the alternatives                                                                                                      | Basis of difference; defensibility; conditions it relies on  |
| `strategic_implication` | Strategic Implication   | A consequence of the chosen strategy that the rest of the architecture must accommodate                                                                                                              | Implication; horizon                                         |

Covered without a type of its own:

- **Model library:** the internal Method Library (Phase 6). An applied model may link to its Method asset through internal-only lineage (§6.9).
- **Model assumptions:** Assumption records linked with `underpins`.
- **Risk implications:** Risk records linked with `threatens`.

### 4.4 Application Architecture: how the architecture is put into operation (9 types)

| Key                      | Label                  | Definition                                                                                                                                     | Key attributes                                                                                                                                    |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operating_model`        | Operating Model        | How the development runs as a whole: its core flows, structures and the relationships among them                                               | Model form; core flows; key interfaces                                                                                                            |
| `application_format`     | Application Format     | A concrete organizational form through which capabilities are put to work (spec §3). Covers the spec's program structure and product structure | Format kind (program, product line, team, unit, venture, partnership, initiative, other); purpose; participants or audience; cadence or life span |
| `governance_body`        | Governance Body        | A body that holds authority over part of the development, such as a board, committee, council or steering group                                | Mandate; membership; cadence; escalation route                                                                                                    |
| `decision_right`         | Decision Right         | The allocation of authority over a class of decisions: who decides, who is consulted, who may veto, who is informed. Not a single decision     | Decision class; decides; consulted; veto; informed                                                                                                |
| `workflow`               | Workflow               | A repeatable sequence by which work moves through the development, from trigger to output. Not a task list                                     | Trigger; stages summary; outputs                                                                                                                  |
| `delivery_mechanism`     | Delivery Mechanism     | The channel or means through which the development's value reaches its beneficiaries                                                           | Channel; form; reach                                                                                                                              |
| `metric`                 | Metric                 | A defined measure of whether an intended outcome, capability or operation is performing as designed. The measure, not the outcome itself       | Definition; unit; direction (increase, decrease, maintain); target; cadence; data source                                                          |
| `scaling_stage`          | Scaling Stage          | A stage in the planned growth of the development, with the conditions to enter and leave it                                                    | Sequence; entry condition; exit condition                                                                                                         |
| `documentation_protocol` | Documentation Protocol | The rule for how a body of architectural or operating knowledge is recorded, owned and kept current                                            | Artifact; update rule; audience                                                                                                                   |

Views: the **operating model outline**, the **decision-rights matrix** (governance bodies × decision classes), the **measurement system** (metric → what it measures) and the **scaling sequence**.

Who is accountable for a workflow or a documentation protocol is a relationship to a Role (`accountable_for`, §9), not a text attribute, so it can be traced.

### 4.5 Project Intelligence records (cross-domain; not core objects)

Each record may relate to the engagement as a whole, to one or more domains, and/or to specific elements (§3.2).

| Kind             | Prefix | Label          | Definition                                                                                                                                                                                                            | Key fields                                                                                                                                       |
| ---------------- | ------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assumption`     | `ASM`  | Assumption     | Something treated as true that the architecture depends on, with the consequence if it proves false. Not a fact: facts are statements with evidence                                                                   | Category; confidence (low, medium, high); validation status (unvalidated, validating, validated, invalidated); impact if false                   |
| `risk`           | `RSK`  | Risk           | An uncertain event or condition that could undermine the architecture or its application. Not a constraint: a risk may or may not occur                                                                               | Category; probability (1–5); impact (1–5); severity (calculated); mitigation; status (open, mitigating, accepted, closed)                        |
| `constraint`     | `CNS`  | Constraint     | A given condition the architecture must work within: regulatory, financial, physical, contractual, political or temporal. Not a risk: a constraint already applies. Not a preference: it cannot simply be chosen away | Category; source; negotiable (yes, no); status (in force, relaxed, lifted)                                                                       |
| `dependency`     | `DEP`  | Dependency     | A condition in which one element cannot proceed, hold or succeed without another                                                                                                                                      | From element; to element; type (prerequisite, sequence, input, funding, external); blocking (yes, no); status (open, satisfied, at risk, broken) |
| `decision`       | `DEC`  | Decision       | A choice that must be made, with its options, TPLCo's recommendation and the outcome. Not a Decision Right, which allocates authority over a class of decisions                                                       | Context; options; recommended option; chosen option; decided by, when and how; status (open, recommended, decided, deferred, superseded)         |
| `recommendation` | `REC`  | Recommendation | TPLCo's recommended course of action, for the client to consider and respond to. Always `architect_judgment` provenance                                                                                               | Rationale; priority (critical, important, advisable)                                                                                             |

### 4.6 Deliberately not object types

- **Evidence Source:** a separate evidence system (§6.8).
- **Opportunity:** the Phase 4 opportunity register.
- **Deliverable** and **Implementation Action:** Phase 5.
- **Method asset** and **Pattern:** Phase 6, internal only.

### 4.7 Vocabulary decisions (confirmed 2026-09-30)

1. **Application Format** is one type with a format kind.
2. **Intended Outcome** belongs to Strategic Model Architecture, defined strictly as the desired condition or result. It is never a KPI, measurement, deliverable, activity or task.
3. **Constraint** is a cross-domain Project Intelligence record (`CNS`), not a Knowledge Architecture object.
4. **Capability tier and capability readiness** are approved, and readiness stays distinct from maturity.
5. **Reference prefixes:** `KNW`, `CAP`, `STR`, `APP`; `ASM`, `RSK`, `CNS`, `DEP`, `DEC`, `REC`.

Attribute schemas are Zod definitions in `src/domain/architecture/object-types.ts`, versioned with the type.

- **Database:** checks that `attributes` is a JSON object under a size limit and carries its schema version.
- **Domain layer:** validates the shape.
- **Changing a type:**
  - it can gain optional attributes without a migration;
  - renaming or removing an attribute needs a migration that rewrites stored rows.

---

## 5. Status models

Five separate axes. None is derived from another, and none is a task status.

| Axis                           | Applies to                   | Values                                                                        | Set by                                                           |
| ------------------------------ | ---------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Lifecycle**                  | Every element                | `draft`, `in_review`, `published`, `superseded`, `retired`                    | Operations only                                                  |
| **Approval state**             | Each published version       | Derived: not requested, awaiting response, `approved`, `changes_requested`    | Client approval responses (or recorded external approvals)       |
| **Object maturity**            | Core architecture objects    | `undefined`, `emerging`, `defined`, `structured`, `operationalized` (spec §8) | Editors, as a judgment with a rationale                          |
| **Domain maturity assessment** | Each engagement × domain     | The same five states                                                          | `publish_architecture` holders, as a dated, append-only judgment |
| **Record status**              | Project Intelligence records | Per kind (§6.5)                                                               | Editors, or the client for decision outcomes                     |

The lifecycle states mean:

- **Draft:** a working copy, internal only.
- **In review:** submitted for internal review by a holder of `publish_architecture`.
- **Published:** at least one version has been published. That version is visible to authorized client users when the element is client-visible, whether or not anyone has approved it.
- **Superseded:** replaced by another element, which the record names.
- **Retired:** no longer part of the architecture. It stays in history.

Editing continues on the working copy after publication. The client keeps seeing the last published version until the next one is published.

Approval is recorded **per version** and never moves the lifecycle. An element can show, for example: "Published v3 · v2 approved · v3 awaiting response".

Domain maturity is **never computed** (spec §8: "avoid simplistic arbitrary scoring"). The workspace shows the distribution of object maturity in that domain as system-derived supporting information. The domain state itself is an architect's dated judgment with a written rationale, and each assessment is kept as history.

Implementation status (Designed, Accepted, Implementation Started, Operational, Validated) arrives in Phase 5 in its own table. It never changes lifecycle or maturity automatically.

---

## 6. Database schema

The naming and mechanics follow Phase 1 and Phase 2:

- `uuid` ids, and `created_by`, `created_at` and `updated_at` columns everywhere;
- every table carries `engagement_id`;
- composite foreign keys keep every child in the same engagement as its parent;
- child rows inherit `engagement_id` by trigger;
- column-limited grants.

### 6.1 Enums

| Enum                         | Values                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture_domain`        | Exists (Phase 1): `knowledge`, `capability`, `strategic_model`, `application`                                                                              |
| `ip_classification`          | Exists (Phase 1)                                                                                                                                           |
| `provenance_type` (ADR-0009) | `client_source`, `public_source`, `architect_observation`, `architect_judgment`, `client_decision`, `ai_analysis`, `methodology_derived`, `system_derived` |
| `element_kind`               | `object`, `assumption`, `risk`, `constraint`, `dependency`, `decision`, `recommendation`                                                                   |
| `element_lifecycle`          | `draft`, `in_review`, `published`, `superseded`, `retired`                                                                                                 |
| `maturity_state`             | `undefined`, `emerging`, `defined`, `structured`, `operationalized`                                                                                        |
| `client_visibility`          | `internal`, `client`                                                                                                                                       |
| `statement_kind`             | `finding`, `observation`, `rationale`, `implication`, `definition`, `note`                                                                                 |
| `ai_review_state`            | `not_applicable`, `pending`, `accepted`, `rejected`                                                                                                        |
| `approval_response`          | `approved`, `changes_requested` (`acknowledged` may be added later)                                                                                        |
| `approval_source`            | Exists (Phase 2): `portal`, `external`                                                                                                                     |
| `evidence_stance`            | `supports`, `contradicts`, `context`                                                                                                                       |
| Per-record statuses          | See §6.5                                                                                                                                                   |

Object types and relationship types are reference tables rather than enums (§6.2), so the Method Library can govern them later without altering an enum.

### 6.2 Reference data (migration-managed; readable by signed-in users, writable by no one)

- **`architecture_object_types`:**
  - columns: `key` (pk), `domain`, `label`, `definition`, `attribute_schema_version`, `sort_order`;
  - unique on `(domain, key)`, so objects reference `(domain, object_type)` together.
- **`relationship_types`:** `key`, `label`, `inverse_label`, `definition`, `symmetric`.
- **`relationship_rules`:**
  - columns: `relationship_type`, `source_kind`, `source_object_type` (null = any object), `target_kind`, `target_object_type` (null = any);
  - a relationship is accepted only if a rule matches (§9).

### 6.3 `architecture_elements` (the spine)

| Column                                                               | Notes                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `id`, `engagement_id`                                                | `unique (id, engagement_id)` so children can use composite FKs                                    |
| `kind`                                                               | `element_kind`; `unique (id, kind)` so subtype tables can pin their kind                          |
| `reference_code`                                                     | Engagement-scoped, permanent: `CAP-004`, `KNW-012`, `RSK-003`. Assigned at creation, never reused |
| `title`, `summary`                                                   | The summary is the element's own statement; its provenance is below                               |
| `lifecycle`                                                          | `element_lifecycle`; changed only by operations                                                   |
| `client_visibility`                                                  | `internal` by default; a published version reaches clients only when `client`                     |
| `provenance`, `source_reference`                                     | ADR-0009. `source_reference` is free text when no evidence source record exists                   |
| `ip_classification`                                                  | Spec §15; defaults to `project_work_product`                                                      |
| `engagement_wide`                                                    | Project Intelligence records only (§3.2); always false for objects                                |
| `owner_user_id`                                                      | The accountable person (internal or client member of the engagement). Not an assignee queue       |
| `methodology_version`                                                | Copied from the engagement at creation (spec §20)                                                 |
| `latest_version_id`                                                  | The most recent published version; maintained by operations                                       |
| `ai_review_state`, `ai_reviewed_by`, `ai_reviewed_at`                | Must be `accepted` before an `ai_analysis` element can be published                               |
| `created_by`, `created_at`, `updated_by`, `updated_at`, `retired_at` |                                                                                                   |

Supersession is recorded by the `supersedes` relationship (§9.5), written only by the `supersede_element` operation.

The domain is not on the spine. It lives on `architecture_objects` (exactly one) and in `intelligence_record_domains` (zero or more).

### 6.4 `architecture_objects` (core architecture objects)

| Column                  | Notes                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `element_id`            | PK; FK `(element_id, kind='object')` to the spine                                                    |
| `domain`, `object_type` | Both required; FK to `architecture_object_types (domain, key)`, so the type fixes exactly one domain |
| `maturity`              | `maturity_state`, default `undefined`                                                                |
| `maturity_rationale`    | Required when maturity is above `undefined`                                                          |
| `attributes`            | jsonb object, ≤ 32 KB, validated against the type's schema version                                   |

### 6.5 Project Intelligence tables (one per kind, PK `element_id`, FK to the spine with the kind pinned)

- **`intelligence_record_domains`:**
  - `element_id` and `domain`, unique together;
  - refuses core objects (kind must not be `object`).
- **`assumptions`:**
  - `category`;
  - `confidence` (`low`, `medium`, `high`);
  - `validation_status` (`unvalidated`, `validating`, `validated`, `invalidated`);
  - `impact_if_false`;
  - `validation_note`.
- **`risks`:**
  - `category`;
  - `probability` (1 to 5) and `impact` (1 to 5);
  - `severity`, a generated column = probability × impact, never typed in;
  - `mitigation`;
  - `risk_status` (`open`, `mitigating`, `accepted`, `closed`).
- **`dependencies`:**
  - `from_element_id` and `to_element_id`, same-engagement FKs, not equal to each other or to the dependency itself;
  - `dependency_type` (`prerequisite`, `sequence`, `input`, `funding`, `external`), named so as not to echo the `requires` and `informs` relationships;
  - `blocking`, a boolean;
  - `dependency_status` (`open`, `satisfied`, `at_risk`, `broken`).
- **`decisions`:**
  - `context`;
  - `decision_status` (`open`, `recommended`, `decided`, `deferred`, `superseded`);
  - `decision_owner_user_id`;
  - `needed_by` (date);
  - `recommended_option_id`, recorded as `architect_judgment`;
  - `chosen_option_id`, `decision_note`, `decided_by`, `decided_at`, `decision_source` (`portal` or `external`);
  - for external decisions: approver name, method and evidence;
  - `downstream_impact`.
  - A decision's outcome carries provenance `client_decision` automatically.
- **`decision_options`:**
  - `id`, `decision_element_id` (same-engagement FK), `title`, `description`, `tradeoffs`, `sort_order`;
  - editable only while the decision is open.
- **`constraints`:**
  - `category` (`regulatory`, `financial`, `physical`, `contractual`, `political`, `temporal`, `other`);
  - `source` (where the constraint comes from; a Regulatory Factor can be linked with `subject_to` or `informs`);
  - `negotiable`, a boolean;
  - `constraint_status` (`in_force`, `relaxed`, `lifted`).
- **`recommendations`:**
  - `rationale`;
  - `priority` (`critical`, `important`, `advisable`).
  - The client's response is an approval on a published version (§6.11).

### 6.6 `architecture_statements` (material statements)

These are the ADR-0009 "material statement within" an element. Findings, rationale and implications are rows, not paragraphs inside a text blob, so that each carries its own provenance and evidence. The same structure is what later analysis will read and write.

| Column                                                 | Notes                                                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `id`, `engagement_id`, `element_id`                    | Same-engagement FK                                                                                                   |
| `statement_kind`, `body`                               | `body` ≤ 4,000 characters                                                                                            |
| `provenance`, `source_reference`                       | Required                                                                                                             |
| `client_visible`                                       | Default false; only meaningful when the element is client-visible                                                    |
| `ai_review_state`, `ai_reviewed_by`, `ai_reviewed_at`  | `pending` is required on insert when provenance is `ai_analysis`; a pending or rejected statement is never published |
| `sort_order`, `created_by`, `created_at`, `updated_at` |                                                                                                                      |

Every change to a statement's provenance is written to the activity log with the old and new value, as ADR-0009 requires.

### 6.7 `architecture_relationships`

| Column                                          | Notes                                                                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `engagement_id`                           |                                                                                                                                              |
| `source_element_id`, `target_element_id`        | Same-engagement composite FKs; not equal; unique with `relationship_type` while active                                                       |
| `relationship_type`                             | FK to `relationship_types`; must match a `relationship_rules` row                                                                            |
| `required_proficiency`                          | Only for Role **requires** Skill (§9.1); null otherwise                                                                                      |
| `description`, `provenance`, `source_reference` |                                                                                                                                              |
| `client_visibility`                             | Default `internal`                                                                                                                           |
| `published_at`, `retired_at`                    | Immutable once published. Changing a published relationship means retiring it and creating a new one, so baselines can cite relationship ids |

### 6.8 Evidence (a source system, not architecture objects)

**`evidence_sources`**, designed so that a file can be attached later without changing this table:

| Column                                   | Notes                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`, `engagement_id`, `title`           |                                                                                                                       |
| `source_type`                            | `document`, `interview`, `meeting_notes`, `dataset`, `publication`, `regulation`, `web`, `internal_analysis`, `other` |
| `provenance`                             | Restricted to `client_source`, `public_source`, `architect_observation`, `architect_judgment`, `system_derived`       |
| `reference`                              | The citation as it should read                                                                                        |
| `url`                                    | HTTPS only                                                                                                            |
| `publisher_author`                       |                                                                                                                       |
| `source_date`, `accessed_date`           |                                                                                                                       |
| `external_reference`                     | An identifier in another system, such as a document number or a data-room path                                        |
| `notes`, `summary`                       |                                                                                                                       |
| `ip_classification`, `client_visibility` | Licensed third-party sources default to internal                                                                      |

**Files later.** When the upload system arrives, files attach through a child table, `evidence_source_files` (`evidence_source_id`, storage object, content type, size, checksum, uploaded by and at). A source can then hold one file or several, such as successive drafts of a document. The evidence record, its links and its citations do not change. The table is created with the upload system, not in Phase 3.

**Evidence links:**

- **`statement_evidence_links`:** the primary chain.
  - Columns: `statement_id`, `evidence_source_id`, `stance` (`supports`, `contradicts`, `context`), `locator` (page, timestamp, section), `note`.
  - Same-engagement FKs.
- **`element_evidence_links`:** the same shape, for evidence that bears on a whole element.

"Contradicts" is recorded from day one. It is the evidence signal that coherence checks will need later.

### 6.9 `element_method_lineage` (internal only)

- **Columns:** `element_id`, `method_asset_id`, `method_version`, `note`.
- **Clients:** no select policy. A client can see an element with provenance `methodology_derived` and its derived content, but never which Method asset produced it or how.

### 6.10 Versions and baselines

- **`element_versions`** (append-only; no update or delete for anyone):
  - `id` (the version id that approvals and baselines reference), `element_id`, `version_no` (1, 2, 3 per element);
  - `snapshot` jsonb: the spine, subtype fields, statements with their provenance, and evidence links, as they were at publication;
  - `client_snapshot` jsonb: the same, filtered to client-visible statements and evidence, without internal-only fields;
  - `client_visible_at_publication`, `change_summary`, `published_by`, `published_at`, `methodology_version`.
- **`architecture_baselines`:**
  - `id`, `engagement_id`, `label` (for example "Executive Architecture v1"), `description`;
  - `status` (`draft`, `frozen`), `frozen_by`, `frozen_at`.
- **`architecture_baseline_items`:**
  - `baseline_id`, `element_version_id`;
  - one version per element per baseline;
  - references, never copies.
- **`architecture_baseline_relationships`:**
  - `baseline_id`, `relationship_id`;
  - the published relationships active when the baseline froze.
- **`architecture_baseline_assessments`:**
  - `baseline_id`, `domain_assessment_id`;
  - the domain states current when the baseline froze.

A frozen baseline cannot change. Because every item is an immutable version id, comparing two baselines is set arithmetic:

- elements added or removed;
- elements whose version changed (with both snapshots to compare);
- relationships added or retired;
- domain states that moved.

Phase 3 builds a `compare_baselines(a, b)` read model. The same comparison works between a baseline and the current published architecture ("what changed since the last executive review"), and later for what Architecture Intelligence detects.

### 6.11 `architecture_approvals`

| Column                                                                                                                          | Notes                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `engagement_id`                                                                                                           |                                                                                                                                                                                      |
| `element_version_id` or `baseline_id`                                                                                           | Exactly one. An approval always concerns an exact immutable published version or frozen baseline                                                                                     |
| `requested_by`, `requested_at`, `request_note`                                                                                  | Set when TPLCo asks for a response                                                                                                                                                   |
| `response` (`approved`, `changes_requested`), `comment`, `responded_by`, `responded_at`                                         | Approver, decision, timestamp and comment. Written once by the response operation; immutable                                                                                         |
| `approval_source` (`portal`, `external`)                                                                                        |                                                                                                                                                                                      |
| `external_approver_name`, `external_approved_on`, `external_approval_method`, `external_evidence`, `recorded_by`, `recorded_at` | Required when external: the client's approver, the approval date and method, the evidence reference, the TPLCo user who recorded it and when. Shown distinctly from portal approvals |

A newer published version does not alter an approval of an older one. The older approval remains true of the version it names.

### 6.12 `domain_assessments` (append-only)

- **Columns:** `engagement_id`, `domain`, `maturity`, `rationale` (required), `client_visible`, `assessed_by`, `assessed_at`.
- **Provenance:** always `architect_judgment`.
- **Current state:** the latest row per domain.

### 6.13 `architecture_reference_counters`

One row per `(engagement_id, prefix)`, incremented in the creating transaction under a row lock. It works like the Phase 2 document numbers: sequential, never reused, and gaps are tolerated.

### 6.14 Relationships at a glance

```
engagements ─┬─ architecture_elements ─┬─ architecture_objects ── architecture_object_types  (exactly one domain)
             │   (spine; kind)          ├─ assumptions / risks / dependencies / decisions / recommendations
             │                          │    └─ intelligence_record_domains                  (zero or more domains)
             │                          ├─ architecture_statements ── statement_evidence_links ─┐
             │                          ├─ element_evidence_links ─────────────────────────────┤
             │                          ├─ element_versions ─┬─ architecture_approvals          │
             │                          │                    └─ architecture_baseline_items ─ architecture_baselines
             │                          └─ element_method_lineage ── method_assets (internal)   │
             ├─ architecture_relationships (element ↔ element; relationship_rules)             │
             ├─ evidence_sources ───────────────────────────────────────────────────────────────┘
             │    └─ evidence_source_files (with the upload system, later)
             └─ domain_assessments
```

No arrow points to or from any Phase 2 finance table.

---

## 7. Provenance in practice

| Provenance              | Typical records                                   | Client label                               | Rules                                                                              |
| ----------------------- | ------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `client_source`         | Interview findings, client documents, client data | "From your organization"                   | Should cite an evidence source or reference                                        |
| `public_source`         | Regulation, market data, research                 | "Public source"                            | Should cite an evidence source or reference                                        |
| `architect_observation` | What TPLCo saw directly                           | "TPLCo observation"                        |                                                                                    |
| `architect_judgment`    | Conclusions, maturity ratings, recommendations    | "TPLCo assessment"                         | Default for recommendations, maturity and domain assessments                       |
| `client_decision`       | Decision outcomes, approvals                      | "Your decision"                            | Set only by the decision and approval operations, never typed in                   |
| `ai_analysis`           | Nothing in Phase 3 creates it                     | "AI-assisted analysis (reviewed)"          | Must be reviewed and accepted before publication; the reviewer is shown internally |
| `methodology_derived`   | Objects produced by applying the Method           | "From the Development Architecture Method" | Lineage stays internal (§6.9)                                                      |
| `system_derived`        | Counts, rollups, reference codes                  | "Calculated"                               | Only the system writes it                                                          |

The database refuses `client_decision` and `system_derived` on direct inserts. Only operations may write them, so no one can type "the client decided" into a record.

---

## 8. Access control and RLS

### 8.1 Engagement capabilities

New values are added to `engagement_capability` in their own migration, as in Phase 2. Roles supply defaults; TPLCo-only per-member overrides adjust them (ADR-0008, unchanged). **Every architecture permission check uses capabilities, never role names.**

| Capability                        | Side     | Meaning                                                                                                                                                                                  | Default holders                                                           |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `edit_architecture` (new)         | internal | Create and edit working copies, statements, relationships, evidence and Project Intelligence records; submit for review                                                                  | Principal Architect, Architect, Researcher                                |
| `publish_architecture` (new)      | internal | Publish versions, set client visibility, request client approval, record external approvals and decisions with evidence, freeze baselines, record domain assessments, review AI analysis | Principal Architect, Architect                                            |
| `view_architecture` (new)         | client   | See published, client-visible architecture                                                                                                                                               | Executive Sponsor, Client Project Lead, Client Contributor, Client Viewer |
| `approve_architecture` (existing) | client   | Respond to approval requests (approved, changes requested) and choose an option on a decision. Requires `view_architecture`                                                              | Executive Sponsor, Client Project Lead                                    |

Consequences of these defaults:

- **System Administrators** hold neither `edit_architecture` nor `publish_architecture` by default. Technical administration does not confer intellectual publishing authority. TPLCo can grant either by override on a specific engagement. System Administrators keep their Phase 1 read access to every engagement.
- **Researchers** draft but do not publish.
- **Project Administrators and Finance Administrators** neither edit nor publish.
- **Client Finance** holds no architecture capability by default. They see the high-level published domain states on the overview, plus their financial environment (Phase 2). An override can grant `view_architecture`.

`edit_architecture` follows from your principle that authority comes from capabilities: the same governance boundary applies to drafting as to publishing.

### 8.2 Who can do what

| Action                                                                                                              | Authority                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read the working architecture (live tables)                                                                         | Internal members who can access the engagement (Phase 1: System Administrators and Principal Architects everywhere, others only when assigned). Finance Administrators: none unless assigned |
| Create and edit working copies, statements, relationships, evidence, records                                        | `edit_architecture`                                                                                                                                                                          |
| Submit for internal review                                                                                          | `edit_architecture`                                                                                                                                                                          |
| Publish, set visibility, request approval, freeze baselines, assess domains, review AI content, retire or supersede | `publish_architecture`                                                                                                                                                                       |
| Record an external client approval or decision, with evidence                                                       | `publish_architecture`                                                                                                                                                                       |
| Client: read published, client-visible architecture                                                                 | `view_architecture`                                                                                                                                                                          |
| Client: respond to approval requests; decide decisions                                                              | `approve_architecture` + `view_architecture`                                                                                                                                                 |
| Client: see domain states on the overview                                                                           | Any active client member of the engagement                                                                                                                                                   |
| Client: see Method lineage, working copies, internal statements, unreviewed AI analysis, internal relationships     | Never                                                                                                                                                                                        |

### 8.3 Row-level rules

- **Live tables** (`architecture_elements`, subtypes, statements, relationships, evidence, lineage, counters):
  - internal readers only, and no client select policy at all;
  - clients never read working copies, even of client-visible elements.
- **`element_versions`:** clients read only the `client_snapshot` column, through a security-invoker read model, and only for:
  - elements with `client_visibility = 'client'`;
  - elements that are not retired;
  - callers holding `view_architecture`.
  - Approval state plays no part. A published version is visible whether or not it has been approved.
  - The full `snapshot` column is not granted to clients (column privilege). This is tested.
- **Published relationships:** clients see a relationship only when it is published, client-visible and active, and both ends are visible to them.
- **`evidence_sources`:** clients see a source only when it is client-visible and linked to a statement or element in a version they can see.
- **`architecture_approvals`:**
  - clients with `view_architecture` see requests and responses on versions they can see;
  - holders of `approve_architecture` respond only through `respond_to_architecture_approval`;
  - rows are immutable after response.
- **`domain_assessments`:** clients see the latest client-visible assessment per domain on engagements they belong to. This is the only architecture record Client Finance sees by default.
- **Reference tables:** readable by all signed-in users; writable by no one.
- **Everywhere:** anonymous users have no privileges. Suspending a membership removes access immediately, as in Phases 1 and 2.

### 8.4 Operations (`SECURITY DEFINER`)

Each operation follows the Phase 2 pattern:

1. Lock the element (or baseline) row.
2. Check permission with capability helpers (42501).
3. Validate the transition (23514), or return P0002 if the record is not visible.
4. Write the change and its activity-log entry.
5. Re-check invariants.

The operations are:

- `submit_element_for_review`, `return_element_to_draft`
- `publish_element_version`:
  - creates the next `element_versions` row and both snapshots;
  - sets the lifecycle to `published`;
  - refuses unreviewed AI content.
- `request_architecture_approval`, `respond_to_architecture_approval` (client), `record_external_architecture_approval`
- `retire_element`, `supersede_element`
- `record_domain_assessment`
- `review_ai_content`: accept or reject a statement or element with `ai_analysis` provenance.
- `set_decision_recommendation`, `decide_decision` (client, or external with evidence), `defer_decision`
- `freeze_baseline`

Direct writes are limited to working content, under column-limited grants. Only operations can write:

- lifecycle and version pointers;
- reference codes;
- AI review columns;
- `client_decision` or `system_derived` provenance.

---

## 9. Relationship vocabulary: how the four domains connect without collapsing into one system

**For final review before implementation.** Relationship keys are permanent in the same way as object types. The database accepts only the pairings listed here (`relationship_rules`).

The domains stay distinct by construction:

- **Each core object type belongs to one domain.** It is fixed in the catalog, and the database checks it.
- **Each domain has its own views, built for its questions:**
  - Knowledge: the domain map and research questions.
  - Capability: the capability map, the role-to-skill matrix and gaps.
  - Strategic Model: intended outcomes and applied models, with their assumptions and implications.
  - Application: the operating model outline, the decision-rights matrix and the measurement system.
- **There is no shared "items" list across domains.**
- **Maturity is judged per domain.**
- **Project Intelligence records sit across the domains** rather than inside one, and name the domains and elements they concern (§3.2).
- **Domains meet only through the typed relationships below.** Each relationship carries a specific meaning in the Method. None is a generic "related to" link.

### 9.1 Conventions

- **Direction.** Every relationship is directional and reads as a sentence: _source_ **label** _target_. For example: Capability "Commercial Acquisition" **is measured by** Metric "Qualified Acquisitions / Month". The target's page shows the inverse label: Metric **measures** Capability. One type, `conflicts_with`, is symmetric.
- **Allowed pairings only.** Each type lists its allowed sources and targets. The database refuses any other pairing, any link to the same element, and any link across engagements.
- **Shorthand in the tables:**
  - "Knowledge object", "Capability object", "Strategic Model object" and "Application object" mean any core type of that domain.
  - "Core object" means any of the 27 core types.
  - "Record" means any Project Intelligence record.
  - "Element" means any core object or record.
- **Acyclic types.** `part_of`, `specializes`, `precedes` and `supersedes` must never form a cycle. The database enforces this: an insert that would create a path from the target back to the source (directly or through any chain of the same type) is refused by a trigger that runs under the engagement's relationship lock, so two concurrent inserts cannot together create a cycle.
- **Canonical symmetric storage.** `conflicts_with` is stored once per pair, in canonical order (`source_element_id < target_element_id`), enforced by a check constraint and a unique index on the ordered pair. A↔B and B↔A can never exist as two relationships; the operation that records a conflict normalizes the order before inserting.
- **Each relationship carries** its own provenance, description, client visibility and publication state (§6.7).
- **One qualifier.** The only relationship with an attribute is Role **requires** Skill, which carries the proficiency that role needs (foundational, proficient, expert). That attribute feeds the role-to-skill matrix. Every other relationship is the link alone.
- **Things that are deliberately not relationships:**
  - evidence links (§6.8), which have stance and locator;
  - Dependency records (§6.5), which have their own from, to, blocking and status;
  - domain scope of records (`intelligence_record_domains`);
  - Method lineage (§6.9, internal only).

### 9.1a Semantic boundaries (confirmed 2026-09-30)

These pairs are easy to blur, so their boundaries are fixed:

- **`informs`** supplies knowledge or input. It does not by itself determine form.
- **`shapes`** materially influences design or form.
- **`affects`** is broader Project Intelligence impact, used when no more specific record relationship fits.
- **`requires`** is architectural necessity between elements. It is distinct from a tracked Dependency record, which carries status, blocking and an owner.
- **`supersedes`** is the conceptual replacement of one distinct architecture element by another. It is not ordinary version lineage: revisions of the same element are published versions (§6.10).

### 9.2 Structure within a domain (5 types)

| Key            | Reads (inverse)                   | Allowed source → target                                                                                                                                                                                                                  | Definition                                                                                                                                                                                                         |
| -------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `part_of`      | is part of (includes)             | Knowledge Area → Knowledge Area; Concept → Concept, Knowledge Area; Capability → Capability; Application Format → Application Format, Operating Model; Workflow → Operating Model, Application Format; Governance Body → Governance Body | Composition: the source is a component of the target. Builds the domain map and capability map                                                                                                                     |
| `specializes`  | is a kind of (has kinds)          | Concept → Concept                                                                                                                                                                                                                        | Classification: the source is a more specific form of the target. Builds the concept hierarchy                                                                                                                     |
| `precedes`     | precedes (follows)                | Talent Sequence Stage → Talent Sequence Stage; Scaling Stage → Scaling Stage                                                                                                                                                             | Planned order: the source comes before the target                                                                                                                                                                  |
| `gap_in`       | is a gap in (has gap)             | Capability Gap → Capability; Knowledge Gap → Knowledge Area, Concept                                                                                                                                                                     | The source describes a shortfall in the target                                                                                                                                                                     |
| `investigates` | investigates (is investigated by) | Research Question → Knowledge Gap, Knowledge Area, Concept, Assumption                                                                                                                                                                   | A Research Question seeks evidence or clarification about the target. When the target is a Knowledge Gap, answering it may help close the gap; when the target is an Assumption, answering it tests the assumption |

### 9.3 Design flow across domains (18 types)

The main path of the Method: understanding (Knowledge) shapes the logic of success (Strategic Model), which determines what the organization must be able to do (Capability), which is put into operation (Application) and measured against intended outcomes.

| Key                   | Reads (inverse)                               | Allowed source → target                                                                                                            | Definition                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `informs`             | informs (is informed by)                      | Knowledge object → Strategic Model object, Capability object, Application object, record                                           | Supplies knowledge or input to the target: understanding, context or facts that the target's design or justification draws on. Informing does not by itself determine the target's form (that is `shapes`)                                |
| `serves`              | serves (is served by)                         | Strategic Model object (other than Intended Outcome), Capability object, Application object → Intended Outcome                     | The source exists to bring about the target outcome                                                                                                                                                                                       |
| `shapes`              | shapes (is shaped by)                         | Applied Strategic Model, Structural Leverage, Differentiation Logic, Strategic Implication → Capability object, Application object | Materially influences the design or form of the target: the strategic logic in the source determines how the target is built. Stronger than `informs`                                                                                     |
| `implies`             | implies (follows from)                        | Applied Strategic Model, Differentiation Logic, Structural Leverage → Strategic Implication                                        | The target is a consequence of the source                                                                                                                                                                                                 |
| `exploits`            | exploits (is exploited by)                    | Applied Strategic Model, Differentiation Logic, Application object → Structural Leverage                                           | The source deliberately uses the lever                                                                                                                                                                                                    |
| `positioned_against`  | is positioned against (is the reference for)  | Differentiation Logic, Applied Strategic Model, Application Format, Delivery Mechanism → Competitive Factor                        | The source is designed to be distinct from the target                                                                                                                                                                                     |
| `requires`            | requires (is required by)                     | Capability → Capability, Skill, Role, Knowledge Area; Role → Skill (with proficiency); Application object → Capability, Role       | Architectural necessity: the source cannot exist or function as designed without the target. A structural fact about the design, distinct from a Dependency record, which tracks a condition with its own status, blocking flag and owner |
| `implemented_through` | is implemented through (implements)           | Capability → Operating Model, Application Format, Workflow, Delivery Mechanism                                                     | The target is how the capability is put into operation                                                                                                                                                                                    |
| `delivered_through`   | is delivered through (delivers)               | Operating Model, Application Format → Delivery Mechanism                                                                           | The target is the channel through which the source's value reaches beneficiaries                                                                                                                                                          |
| `measured_by`         | is measured by (measures)                     | Intended Outcome, Capability, Application object (other than Metric) → Metric                                                      | The metric is how performance of the source is observed. Keeps outcome and measure separate                                                                                                                                               |
| `governed_by`         | is governed by (governs)                      | Capability, Application object (other than Governance Body and Decision Right) → Governance Body, Decision Right                   | The target holds or allocates authority over the source                                                                                                                                                                                   |
| `holds`               | holds (is held by)                            | Governance Body, Role → Decision Right                                                                                             | The source is the holder named by the decision right                                                                                                                                                                                      |
| `accountable_for`     | is accountable for (is the accountability of) | Role, Governance Body → Capability, Application Format, Workflow, Documentation Protocol, Metric, Scaling Stage                    | The source answers for the target's design and performance. Not a task assignment                                                                                                                                                         |
| `introduces`          | introduces (is introduced at)                 | Talent Sequence Stage → Role, Capability; Scaling Stage → Role, Capability, Application Format, Delivery Mechanism                 | The target enters the development at the source stage                                                                                                                                                                                     |
| `bounded_by`          | operates within (bounds)                      | Core object (other than System Boundary) → System Boundary                                                                         | The source sits inside the defined edge of the system                                                                                                                                                                                     |
| `subject_to`          | is subject to (applies to)                    | Core object (other than Regulatory Factor), record → Regulatory Factor                                                             | The regulatory factor applies to the source                                                                                                                                                                                               |
| `documented_by`       | is documented by (documents)                  | Core object (other than Documentation Protocol) → Documentation Protocol                                                           | The protocol governs how knowledge about the source is recorded and kept current                                                                                                                                                          |
| `has_stake_in`        | has a stake in (has as stakeholder)           | Stakeholder → element (other than Stakeholder)                                                                                     | The stakeholder's interests, authority or influence bear on the target                                                                                                                                                                    |

### 9.4 Project Intelligence relationships (6 types)

Records point at the elements they concern. Together with the record's domains and `engagement_wide` flag, these relationships make up its scope (§3.2).

| Key          | Reads (inverse)                | Allowed source → target                                                | Definition                                                                                                                                                                                                                                                                |
| ------------ | ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `underpins`  | underpins (rests on)           | Assumption → core object, Decision, Recommendation                     | The target holds only if the assumption is true                                                                                                                                                                                                                           |
| `threatens`  | threatens (is threatened by)   | Risk → element (other than Risk)                                       | If the risk occurs, the target is undermined                                                                                                                                                                                                                              |
| `constrains` | constrains (is constrained by) | Constraint → core object, Decision, Recommendation                     | The target must be designed within the constraint                                                                                                                                                                                                                         |
| `mitigates`  | mitigates (is mitigated by)    | Capability object, Application object, Decision, Recommendation → Risk | The source reduces the probability or impact of the risk                                                                                                                                                                                                                  |
| `affects`    | affects (is affected by)       | Project Intelligence record → element (other than itself)              | Broader Project Intelligence impact: the record has a material bearing on the target that a more specific relationship (`underpins`, `threatens`, `constrains`, `mitigates`, `addresses`) does not capture. The standard link from a Decision to what its outcome changes |
| `addresses`  | addresses (is addressed by)    | Recommendation → element (other than Recommendation)                   | The recommendation proposes a course of action in response to, or intended to change, the target                                                                                                                                                                          |

### 9.5 Lineage and tension (2 types)

| Key              | Reads (inverse)               | Allowed source → target                                                          | Definition                                                                                                                                                                                                                                                                                        |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supersedes`     | supersedes (is superseded by) | Element → element of the same kind (and, for core objects, the same object type) | Conceptual replacement: one distinct architecture element replaces another distinct element, which moves to `superseded`. Not version lineage: a new version of the same element is a new published version (§6.10), never a `supersedes` link. Written only by the `supersede_element` operation |
| `conflicts_with` | conflicts with (symmetric)    | Element ↔ element                                                                | An architect has recognized a tension between the two, for example a Decision Right that contradicts a Governance Body's mandate. Recorded explicitly so it is resolved deliberately, and later available to coherence analysis                                                                   |

**In total: 31 relationship types**: 5 structural, 18 design flow, 6 Project Intelligence and 2 lineage and tension.

### 9.6 Worked example (spec §3)

1. Capability "Commercial Acquisition" **requires** Skill "Property Underwriting".
2. Knowledge Area "Commercial Real Estate Market" **informs** Capability "Commercial Acquisition".
3. Risk "Capital Availability" **threatens** Capability "Commercial Acquisition".
4. Capability "Commercial Acquisition" **is measured by** Metric "Qualified Acquisitions / Month".
5. Capability "Commercial Acquisition" **is implemented through** Application Format "Acquisition Team".
6. Capability "Commercial Acquisition" **serves** Intended Outcome "A self-sustaining commercial property portfolio".

The database refuses pairings the Method does not define: a Metric that **requires** a Stakeholder, an Intended Outcome that **is measured by** another Intended Outcome, or a Risk that **informs** a Capability.

### 9.7 Trace view

Every element page has a **trace view** that walks these relationships:

- **upstream:** why this exists (evidence, knowledge, strategy, outcomes);
- **downstream:** what depends on it (capabilities, application, metrics).

It shows provenance at each step. It is the structural backbone that coherence analysis will use later, and it needs no graph canvas.

---

## 10. Internal architect experience

The Architecture menu becomes live: Knowledge, Capability, Strategic Models and Application. The Intelligence menu becomes live for the Project Intelligence records and evidence.

- **Engagement architecture home:**
  - the four domains, each with its current maturity assessment, rationale and date;
  - the maturity distribution of its objects, labeled "Calculated";
  - counts of working copies awaiting review, published versions awaiting a client response, and open decisions.
- **Domain workspace, one per domain, with views built for that domain:**
  - **Knowledge:** an indented domain map (knowledge areas and concepts), research questions by status, knowledge gaps and the system boundary.
  - **Capability:** a capability map with tier, readiness and ownership columns, a role-to-skill matrix, gaps and the talent sequence.
  - **Strategic Model:** intended outcomes and applied models, each with its linked assumptions, implications, leverage and differentiation logic.
  - **Application:** the operating model outline, application formats, a decision-rights matrix (governance bodies × decision classes), the measurement system (metric → what it measures) and the scaling sequence.
- **Element page:**
  - A header with:
    - reference code, type, domain (or scope, for records);
    - lifecycle, published version and approval state;
    - maturity, visibility, provenance and IP classification.
  - The summary, then statements grouped by kind, each labeled with its provenance and its cited evidence.
  - Connected architecture, grouped by relationship type, with cross-domain links marked; related assumptions, risks, dependencies and decisions.
  - Method lineage (internal).
  - Versions and approvals; activity.
  - **Preview as client:** shows exactly the `client_snapshot` that publishing would produce.
- **Project Intelligence records:**
  - assumptions, risks (with a probability × impact grid), constraints, dependencies (blocking first), decisions (options, recommendation, outcome) and recommendations;
  - each record shows its domains, the elements it concerns, or "Engagement-wide".
  - Phase 3 keeps these as plain structured lists. Triage and filtering depth is Phase 4.
- **Evidence library:** sources with type, provenance, date, publisher or author, citation, and the statements and elements that cite them.
- **Review queue** (holders of `publish_architecture`):
  - working copies in review;
  - AI-provenance content awaiting review (empty until AI exists);
  - approval requests awaiting the client.
- **Baselines:**
  - create a baseline, choose the element versions, freeze;
  - request client approval;
  - compare with another baseline or with the current published architecture.

The design stays as in Phases 1 and 2: calm, typographic, dense where the work is dense (matrices, registers), with no gamification or progress bars.

---

## 11. Client experience

The client Architecture area answers "Where are we in the architecture?" (spec §7):

- **Overview:** the "Where we are in the architecture" panel shows the published domain states and rationale to every client member of the engagement, including Client Finance.
- **Architecture** (`view_architecture`):
  - the four domains, each with its current state and its published, client-visible objects in the domain's own view (map, matrix, table);
  - each object shows its latest published summary and client-visible statements, with plain provenance labels (§7) and cited evidence;
  - each object also shows its approval state ("Approved", "Awaiting response" or "Changes requested"). The label is information, never a gate on seeing the object.
- **Awaiting your response** (`approve_architecture`):
  - approval requests for exact published versions and baselines, answered with **Approve** or **Request changes**, with an optional comment;
  - decisions with their options, TPLCo's recommendation marked as a TPLCo assessment, and a choice;
  - every response is recorded with who, which version and when, and is final.
- **History:** earlier published versions stay readable. The client can see what they approved and what changed since.
- **Never shown:**
  - working copies;
  - internal statements;
  - internal relationships;
  - unreviewed AI analysis;
  - Method lineage, Method assets or templates;
  - anything belonging to other clients.

The client navigation gains Architecture and Decisions. Actions, Reviews, Documents and Implementation stay muted until their phases.

---

## 12. Approvals and decisions in detail

- **What an approval is for.** An approval request targets one exact published element version or one frozen baseline.
  - The response applies to that version only.
  - If TPLCo later publishes version 3, the approval of version 2 remains true of version 2. The element shows "Published v3 · v2 approved · v3 awaiting response".
- **The responses:**
  - **Approved:** the version is accepted, with an optional comment.
  - **Changes requested:** a comment is required. The element stays published, and TPLCo revises the working copy and publishes a new version.
  - `acknowledged` can be added later if some artifacts need receipt rather than approval.
- **Approval and visibility are separate.** Approval never controls whether authorized client users can see a published version.
- **External approvals and decisions** are recorded by a holder of `publish_architecture`. They need:
  - approver name;
  - date;
  - method (meeting, email, signed document, other);
  - evidence reference.
  - They are shown distinctly from portal approvals, exactly as in Phase 2.
- **Decisions:**
  - The architect records options and marks a recommended option (`architect_judgment`).
  - The client chooses an option, or it is recorded externally, and that outcome is `client_decision` provenance.
  - A decided decision is frozen. Changing course means a new decision that supersedes it.

---

## 13. Financial milestones and architecture (designed now, built later)

Phase 2 deliberately gave milestones only a text `stage_label`. The future link is designed so that finance may **refer to** architecture, while architecture never depends on finance.

- **The link table:** a later link table, `payment_milestone_architecture_links (payment_milestone_id, element_version_id or baseline_id, note)`, owned by the finance side:
  - written only by financial managers;
  - both ends in the same engagement (composite FKs).
- **Direction:** it is the only connection, and it points from finance to architecture. No architecture table has a column or FK referring to finance, and no architecture operation reads a finance table.
- **Architecture does not change finance automatically.** An approved baseline may be shown to a financial manager as the reason to mark a milestone "ready to invoice". Marking it stays a manual finance action (`set_milestone_status`), never a trigger.
- **Finance never changes architecture.** Payment state, overdue invoices or a voided contract never change an element's lifecycle, maturity, visibility or approvals.
- **Visibility of links:**
  - a link is visible only to someone who can see both the milestone (`view_financials`) and the architecture target;
  - a client without `view_financials` sees no link, and a finance-only client sees no architecture detail through it.

Phase 3 enforces the direction now: a pgTAP test asserts that no Phase 3 table has a foreign key into any finance table.

---

## 14. Test strategy

The same layers as Phase 2, with the database carrying most of the weight.

**pgTAP** (new files):

- **`07_architecture_access`:** the capability matrix end to end:
  - each internal role, assigned and unassigned;
  - a System Administrator reads but cannot edit or publish by default, and can after an override;
  - a Researcher edits but cannot publish;
  - a Finance Administrator has no architecture access;
  - the Executive Sponsor, Project Lead, Contributor and Viewer all see published, client-visible versions whether or not they are approved;
  - only `approve_architecture` holders respond or decide;
  - Client Finance sees domain states only, and more after a `view_architecture` override;
  - a multi-organization advisor, and anonymous users;
  - clients never read live tables, the full snapshot, Method lineage, internal statements, internal relationships, working copies or unreviewed AI content;
  - suspension removes access.
- **`08_architecture_integrity`:**
  - each core object has exactly one domain, matching its type;
  - intelligence records accept zero or more domains, elements or engagement-wide scope, and refuse having none;
  - relationship rules (allowed and refused pairings);
  - cycles refused for `part_of`, `specializes`, `precedes` and `supersedes`, including through longer chains and under concurrent inserts;
  - `conflicts_with` stored once per pair in canonical order, with the reversed duplicate refused;
  - cross-engagement links refused (composite FKs);
  - dependency endpoints valid;
  - reference codes sequential and never reused;
  - `client_decision` and `system_derived` provenance refused on direct writes;
  - the AI review gate;
  - provenance changes audited;
  - lifecycle changes only through operations;
  - required maturity rationale;
  - decided decisions frozen;
  - no FK from any architecture table into finance tables.
- **`09_architecture_versions`:**
  - publishing creates immutable versions and snapshots;
  - the client sees the published snapshot, not later working edits;
  - approvals reference exact version ids and are immutable;
  - an approval of v2 survives the publication of v3;
  - baselines reference versions rather than copying them, and freeze;
  - `compare_baselines` reports added, removed and changed elements, relationships and domain states;
  - published relationships are immutable and retired relationships are preserved;
  - the client snapshot omits internal statements and evidence.
- **`99_architecture_concurrency`:**
  - two sessions publishing the same element get sequential version numbers;
  - two sessions creating elements get distinct reference codes.

**Vitest:**

- every object type has a Zod attribute schema, and the schemas accept seed data;
- the catalog mirrors the database type lists;
- provenance labels are complete;
- relationship rules in the domain layer mirror the database rules;
- the client snapshot builder filters correctly.

**Playwright:**

1. An Architect creates objects in all four domains, links them across domains, cites evidence on statements and submits for review.
2. A Researcher can draft but cannot publish. A System Administrator cannot publish without an override.
3. A Principal publishes and requests approval.
4. The Viewer and Contributor see the published version immediately.
5. The Executive Sponsor requests changes; after v2 is published, the Project Lead approves it.
6. Client Finance sees only the domain states.
7. The Finance Administrator sees no architecture.
8. The Project Lead records a decision.

**Seed:** a realistic Meridian architecture, created through the operations as in Phase 2:

- about 25 objects across the four domains, reproducing the spec §3 example chain;
- evidence cited on statements, assumptions, risks (one spanning two domains, one engagement-wide), a dependency and a decision with options;
- one approved version, one awaiting response, and two frozen baselines to compare.

---

## 15. Difficult-to-reverse decisions

| #   | Decision                                                                                          | Why it is hard to reverse                                                                    |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | **Element spine with subtype tables** (§3.1)                                                      | Every relationship, version, approval and future AI output keys on element ids               |
| 2   | **Publication is the client visibility boundary; clients read published snapshots only** (§8.3)   | Defines what "the client saw"; approvals and audit depend on it                              |
| 3   | **Provenance at element and statement level, closed enum; statement → evidence chain** (ADR-0009) | Historical records cannot be re-labeled honestly after the fact                              |
| 4   | **Object type vocabulary, one domain per core type; attributes in validated jsonb** (§4)          | Keys, codes and stored attributes follow it; renaming later means rewriting history          |
| 5   | **Project Intelligence records are multi-domain** (§3.2)                                          | Forcing them into one domain later would lose meaning                                        |
| 6   | **Relationship types and allowed pairings enforced by the database** (§9)                         | The vocabulary becomes part of the Method as software; removing a type means rewriting links |
| 7   | **Domain maturity is a dated judgment, never a computed score** (§5)                              | Clients will read and compare states over time                                               |
| 8   | **Separate axes: lifecycle, approval, maturity, record status, later implementation** (§5)        | Merging them later would lose meaning in stored history                                      |
| 9   | **Approvals and baselines reference immutable version ids** (§6.10, §6.11)                        | They are client commitments and the basis of every later comparison                          |
| 10  | **Method lineage in an internal-only table** (§6.9)                                               | Protects Method/IP structurally rather than by filtering                                     |
| 11  | **One-way finance → architecture link** (§13)                                                     | Prevents billing from controlling architecture                                               |
| 12  | **New capability enum values** (§8.1)                                                             | Postgres enum values cannot be removed                                                       |
| 13  | **Permanent reference codes and prefixes** (§4.0, §6.13)                                          | Clients and documents will cite them                                                         |

Each will get an ADR (0013 onward) with the build.

---

## 16. Decisions

### 16.1 Approved 2026-09-30 (revision 2 applies them)

1. **Scope:** build the underlying assumption, risk, constraint, dependency, decision, recommendation and evidence records in Phase 3. Phase 4 builds the fuller Project Intelligence experience. Evidence stays a source system; statements connect to it through explicit evidence links.
2. **Client visibility:** publication, not approval, is the boundary. Executive Sponsor, Client Project Lead, Client Contributor and Client Viewer see published, client-visible architecture. Only approvers approve. Client Finance sees high-level published domain states plus their financial environment.
3. **Publishing authority:** `publish_architecture` defaults to Principal Architect and Architect only. Researchers, Project Administrators, Finance Administrators and System Administrators do not publish by default. Checks use capabilities, not role names.
4. **Client approval:** the existing `approve_architecture` capability, held by default by Executive Sponsor and Client Project Lead. Each approval references an exact immutable published version, and records approver, version, timestamp and comment. Responses: `approved` and `changes_requested`.
5. **Baselines:** minimal, referencing immutable versions rather than copying them, and built so that comparisons can answer what changed.
6. **Evidence:** references in Phase 3, with files attaching to existing evidence records later.
7. **Structural rule:** core architecture objects belong to exactly one domain. Project Intelligence records may relate to one or more domains, to specific elements, or to the engagement as a whole.

Preserved unchanged: immutable published snapshots, statement-level provenance, human review of AI-derived content, dated architect maturity judgments and one-way finance-to-architecture linking.

### 16.2 Approved 2026-09-30 (revision 3 applies them)

1. **`edit_architecture`:** approved as proposed (Principal Architect, Architect and Researcher by default).
2. **External approvals:** recorded by holders of `publish_architecture`, preserving the external approver, approval date and method, evidence reference, recording user and recorded timestamp.
3. **Vocabulary:** Application Format as one type with a format kind; Intended Outcome in Strategic Model Architecture, defined strictly as the desired condition or result; capability tier and readiness, with readiness distinct from maturity; prefixes `KNW`, `CAP`, `STR`, `APP`, `ASM`, `RSK`, `DEP`, `DEC`, `REC`.
4. **Constraint** moves from Knowledge Architecture to a cross-domain Project Intelligence record, prefix `CNS`. The core catalog is now 27 types.

### 16.3 Awaiting review

1. **§4** (27 core object types and six Project Intelligence record kinds) and **§9** (31 relationship types, with direction, allowed pairings and definitions). These are the remaining vocabulary reviews before implementation approval. No migration is written until they are approved.

---

## 17. Build order once approved

1. ADRs 0013 onward for the decisions in §15.
2. Capability migration (the new enum values), then the architecture migration: reference data, tables, guards, RLS, operations and read models.
3. pgTAP tests (07, 08, 09, 99) and seed data.
4. Domain layer: type catalog, Zod schemas, provenance labels, queries, actions.
5. Internal workspace, then the client Architecture area.
6. Playwright run-through, docs (`docs/database/architecture.md`), README and the end-of-phase report.

As before, each step is checked locally and in CI, with the end-of-phase report before the merge.
