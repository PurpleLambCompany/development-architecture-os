# Phase 3 — Architecture Core: Proposal

**Status:** Proposal for review. No migrations or application code until it is approved.
**Branch:** `phase-3-architecture-core` · **Date:** 2026-09-30
**Builds on:** Phase 1 (engagements, roles, capabilities, RLS) and Phase 2 (commercial engagement), both merged.
**Governing documents:** `DSA_OS_MASTER_BUILD_SPEC.md` §3, §5.2, §6, §8, §14–§15, §18–§20, §26–§27; ADR-0008 (engagement capabilities); ADR-0009 (provenance).

Phase 3 turns the Development Architecture Method into structured software: the four architecture domains, their objects, the connections between them, and the records that explain why each object exists. These include evidence, assumptions, risks, dependencies, decisions and recommendations. Every object carries its provenance, a status, a maturity, a client-visibility setting and a version history.

Phase 3 does not build AI or Architecture Intelligence. It builds the structured foundation that AI can work on later. Every material statement is stored as its own record, with provenance and evidence, so later analysis has something precise to read and a clear label for anything it writes.

---

## 1. Principles

1. **Architecture is structured data, not pages.** An engagement's architecture is a connected set of typed objects and typed relationships (spec §3). Documents and deliverables are produced from it later (Phase 5), never the other way round.
2. **Four domains stay distinct.** Each object type belongs to exactly one domain, fixed in the type catalog. The domains connect through typed relationships whose allowed pairings are defined by the Method, not invented per engagement (§9).
3. **Not a task system.** Architecture objects have no assignee queue, due-date board, percent-complete or kanban columns. They have an accountable owner, a lifecycle, a maturity and evidence. Implementation tracking stays a separate axis for Phase 5 (spec §13).
4. **Provenance everywhere.** Every element and every material statement records one of the eight ADR-0009 provenance types. It also records who recorded it, when, and its source where one exists. AI analysis cannot reach a client unless a person has reviewed it.
5. **Clients see what was published, not work in progress.** Clients read immutable published versions. Architects keep editing the working copy without the client seeing half-finished changes.
6. **The database is the authority.** As in Phase 2, visibility is enforced by RLS. Lifecycle changes, publication and approvals go only through `SECURITY DEFINER` operations that check permission, validate, write history and re-check invariants.
7. **The Method/IP boundary holds.** A client may see an object that was derived from the Method, but never the Method asset it came from. Method lineage lives in an internal-only table.
8. **Finance never controls architecture.** No architecture table references a finance table, and no finance change alters architecture state (§13).

---

## 2. Scope

### 2.1 Built in Phase 3 (on approval)

- The four domain workspaces: Knowledge, Capability, Strategic Model and Application.
- Architecture objects from a fixed type catalog, with typed attributes.
- Typed relationships between elements, with allowed pairings enforced by the database.
- The foundation records that give architecture its reasoning:
  - evidence sources;
  - assumptions;
  - risks;
  - dependencies;
  - decisions (with options);
  - recommendations.
- Material statements inside elements, each with its own provenance, evidence links and visibility.
- Provenance (ADR-0009) and IP classification (spec §15) on every element.
- The object lifecycle, object maturity, domain maturity assessments, publication, versioning and named baselines.
- Client approvals pinned to a specific version, from the portal or recorded externally with evidence.
- Client decisions on decision records.
- Internal architect workspace and client Architecture area.
- Three new engagement capabilities (§8.1).

### 2.2 Not in Phase 3

- **AI and Architecture Intelligence:** summarizing, gap detection, coherence checks and drafting (spec §18, §19). The `ai_analysis` provenance value and its review gate exist so that AI can later write into the structure safely.
- **Executive review sessions (Phase 5).** These are the agenda, live review mode and review items. Phase 3's approval record is the primitive that reviews will reuse.
- **Deliverables and implementation tracking (Phase 5).**
- **Method Library UI, templates, pattern library and Method versioning (Phase 6).** Phase 3 records only the internal lineage link to an existing `method_assets` row.
- **Graph visualization** (spec §23). Phase 3 uses trees, matrices, grouped lists and a trace view instead.
- **Opportunity register and client actions** (Phase 4).
- **Evidence file uploads.** Evidence is recorded by citation, URL or reference until the shared upload UI exists. That UI is already a Phase 2 pre-production requirement.
- **Financial milestone links to architecture.** They are designed in §13 and built later.

### 2.3 Conflicts with the specification

These are surfaced now, before any expensive change, as `CLAUDE.md` requires.

| Spec                                                                             | This proposal                                                                                                                                                                                                | Why                                                                                                                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §31 puts evidence, assumptions, risks, dependencies and decisions in **Phase 4** | Their **records** are built in Phase 3, at foundation depth. Phase 4 keeps the Project Intelligence **experience**: register triage, filtering, client actions, opportunities and the full decision workflow | Your Phase 3 brief lists them. Architecture objects without their evidence, assumptions and decisions would have to be retro-fitted with reasoning, which ADR-0009 warns against |
| §26 `architecture_objects.client_visible` boolean, read directly                 | Clients read published **version snapshots**. `client_visibility` decides whether a published version reaches clients                                                                                        | Stops clients seeing in-progress edits, and keeps exactly what a client approved                                                                                                 |
| §26 `metadata_json` on objects                                                   | `attributes` jsonb, validated per object type by a versioned schema                                                                                                                                          | Keeps type-specific fields structured without a table per type                                                                                                                   |
| §26 `dependencies` between objects only                                          | Dependencies connect any two elements, such as a risk and a capability                                                                                                                                       | Dependencies often involve decisions and risks                                                                                                                                   |
| §26 `decisions.client_decision` free text                                        | Options, a recommended option, and the client's chosen option, recorded with who, when and how                                                                                                               | Makes client decisions checkable and keeps them distinct from the architect's recommendation                                                                                     |
| §11 review actions (approve, approve with comments, request revision, defer)     | Used as the approval responses in Phase 3, plus `declined`                                                                                                                                                   | The same vocabulary is used now and in Phase 5 reviews                                                                                                                           |

---

## 3. The element model

Everything in the architecture workspace that can be connected, evidenced, versioned, published or approved is an **element**. There are six element kinds:

| Kind             | What it is                                                                            | Domain                   |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------ |
| `object`         | A domain architecture object, such as a capability, knowledge area or operating model | Required, from its type  |
| `assumption`     | Something believed true that the architecture depends on                              | Optional (cross-cutting) |
| `risk`           | Something that could undermine the architecture                                       | Optional                 |
| `dependency`     | One element needs another                                                             | Optional                 |
| `decision`       | A choice that must be made, with options and an outcome                               | Optional                 |
| `recommendation` | TPLCo's recommended course, for the client to respond to                              | Optional                 |

Evidence sources are **not** elements. They are the material that elements cite: documents, interviews, research and data.

### 3.1 Why one spine with subtype tables

All elements share one table (`architecture_elements`), which holds the common columns. Each kind has its own table, keyed by the same id, for the fields that kind needs.

- **Relationships, evidence links, statements, versions and approvals can use real foreign keys.** A risk can constrain a capability and a decision can affect an operating model, without polymorphic "type + id" columns that the database cannot check.
- **Each kind keeps its own fields and status.** A risk keeps probability, impact and mitigation. A decision keeps its options. A register never collapses into a generic "item".
- **One RLS model and one versioning model** cover every kind.

The alternatives were rejected:

- **A table per kind, with no spine.** This would need polymorphic links, or a join table per pair of kinds.
- **One generic table with jsonb for everything.** This is the generic task system the brief warns against.

---

## 4. Domain object types

Types are reference data seeded by migration (`architecture_object_types`). A type's domain is fixed, and the database refuses an object whose type does not belong to its domain.

In Phase 3 the catalog changes only by migration. From Phase 6 the Method Library governs it and records the Method version that introduced each type.

Features the spec lists that are **views** rather than types are marked "view". They are built from relationships and need no type of their own.

### 4.1 Knowledge Architecture

| Type                 | Key attributes                                                    | Spec feature                  |
| -------------------- | ----------------------------------------------------------------- | ----------------------------- |
| `knowledge_area`     | scope, importance                                                 | Knowledge areas               |
| `concept`            | definition                                                        | Concept hierarchy             |
| `research_question`  | question, status (open, answered, parked), answer summary         | Research questions            |
| `knowledge_gap`      | what is unknown, consequence, how to close it                     | Knowledge gaps                |
| `regulatory_factor`  | jurisdiction, instrument, obligation                              | Regulatory context            |
| `competitive_factor` | actor, position, implication                                      | Competitive landscape         |
| `system_boundary`    | inside, outside, interfaces                                       | System boundaries             |
| `stakeholder`        | organization or person, interest, influence (low to high)         | Stakeholder context           |
| view: domain map     | knowledge areas and concepts through `part_of` and `broader_than` | Domain map, concept hierarchy |

### 4.2 Capability Architecture

| Type                 | Key attributes                                                                                                                                               | Spec feature                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `capability`         | level (strategic, core, supporting), leadership capability (yes or no), readiness (absent, emerging, partial, ready), ownership (internal, external, shared) | Capabilities, leadership capability, readiness, internal vs external ownership |
| `skill`              | skill family, proficiency needed                                                                                                                             | Skills                                                                         |
| `role`               | role purpose, internal or external, headcount indication                                                                                                     | Roles for role-to-skill mapping                                                |
| `capability_gap`     | current state, target state, closure approach                                                                                                                | Capability gaps                                                                |
| `talent_stage`       | sequence, trigger to start                                                                                                                                   | Talent sequencing                                                              |
| view: capability map | capabilities through `part_of`                                                                                                                               |                                                                                |
| view: role-to-skill  | a matrix of `role requires skill` relationships, with proficiency                                                                                            | Role-to-skill mapping                                                          |

### 4.3 Strategic Model Architecture

| Type                    | Key attributes                                           | Spec feature           |
| ----------------------- | -------------------------------------------------------- | ---------------------- |
| `strategic_model`       | model name, how it is applied here, applicability limits | Project-applied models |
| `structural_leverage`   | lever, mechanism, magnitude (qualitative)                | Structural leverage    |
| `differentiation_logic` | basis of difference, sustainability                      | Differentiation logic  |
| `strategic_implication` | implication, horizon                                     | Strategic implications |

Each spec feature not in the table is covered another way:

- **Model library:** the internal Method Library. An applied model may link to its `method_assets` row through internal-only lineage (§6.9).
- **Model assumptions:** assumption elements linked with `assumes`.
- **Risk implications:** risk elements linked with `threatens`.
- **Related architecture objects:** relationships.

### 4.4 Application Architecture

| Type                     | Key attributes                                          | Spec feature           |
| ------------------------ | ------------------------------------------------------- | ---------------------- |
| `operating_model`        | model form, core flows                                  | Operating model        |
| `program`                | purpose, participants, cadence                          | Program structure      |
| `product`                | offer, audience, delivery form                          | Product structure      |
| `governance_body`        | mandate, membership, cadence                            | Governance model       |
| `decision_right`         | decision area, holder, input, veto, inform (RACI-style) | Decision rights        |
| `workflow`               | trigger, steps summary, outputs                         | Workflow               |
| `delivery_mechanism`     | channel, format                                         | Delivery mechanism     |
| `metric`                 | definition, unit, direction, target, cadence            | Measurement system     |
| `scaling_stage`          | sequence, entry condition, exit condition               | Scaling sequence       |
| `documentation_protocol` | artifact, owner, update rule                            | Documentation protocol |

Attribute schemas are Zod definitions in `src/domain/architecture/object-types.ts`, versioned with the type. The database checks that `attributes` is a JSON object under a size limit and carries the schema version. The domain layer validates its shape. A type can gain optional attributes without a migration; renaming or removing an attribute needs a migration that rewrites stored rows.

---

## 5. Status models

Four separate axes. None is derived from another, and none is a task status.

| Axis                           | Applies to                                                   | Values                                                                        | Set by                                                           |
| ------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Lifecycle**                  | Every element                                                | `draft`, `in_review`, `proposed`, `approved`, `superseded`, `retired`         | Operations only                                                  |
| **Object maturity**            | Domain objects                                               | `undefined`, `emerging`, `defined`, `structured`, `operationalized` (spec §8) | Architects, as a judgment with a rationale                       |
| **Domain maturity assessment** | Each engagement × domain                                     | The same five states                                                          | Publishing architects, as a dated, append-only judgment          |
| **Register status**            | Assumptions, risks, dependencies, decisions, recommendations | Per kind (§6)                                                                 | Editors, or the client for decision and recommendation responses |

The lifecycle states mean:

- **Draft:** a working copy, internal only.
- **In review:** submitted for internal review. A publishing architect checks it.
- **Proposed:** published to the client (when client-visible) and awaiting their response.
- **Approved:** the client approved this version, through the portal or recorded externally with evidence.
- **Superseded:** replaced by a newer approved version, or by another element, which the record names.
- **Retired:** no longer part of the architecture. It stays in history.

Elements that are only internal use `draft`, then `in_review`, then `proposed`, where proposed means "accepted internally".

Domain maturity is **never computed** (spec §8: "avoid simplistic arbitrary scoring"). The workspace shows the distribution of object maturity in that domain as system-derived supporting information. The domain state itself is an architect's dated judgment with a written rationale, and each assessment is kept as history.

Implementation status (Designed, Accepted, Implementation Started, Operational, Validated) is a fifth axis. It arrives in Phase 5 in its own table and never changes lifecycle or maturity automatically.

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
| `element_kind`               | `object`, `assumption`, `risk`, `dependency`, `decision`, `recommendation`                                                                                 |
| `element_lifecycle`          | `draft`, `in_review`, `proposed`, `approved`, `superseded`, `retired`                                                                                      |
| `maturity_state`             | `undefined`, `emerging`, `defined`, `structured`, `operationalized`                                                                                        |
| `client_visibility`          | `internal`, `client`                                                                                                                                       |
| `statement_kind`             | `finding`, `observation`, `rationale`, `implication`, `definition`, `note`                                                                                 |
| `ai_review_state`            | `not_applicable`, `pending`, `accepted`, `rejected`                                                                                                        |
| `approval_response`          | `approved`, `approved_with_comments`, `revision_requested`, `deferred`, `declined`                                                                         |
| `approval_source`            | Exists (Phase 2): `portal`, `external`                                                                                                                     |
| `evidence_stance`            | `supports`, `contradicts`, `context`                                                                                                                       |
| Per-register statuses        | See §6.5                                                                                                                                                   |

### 6.2 Reference data (migration-managed; readable by signed-in users, writable by no one)

- **`architecture_object_types`:**
  - columns: `key` (pk), `domain`, `label`, `description`, `attribute_schema_version`, `sort_order`, `reference_prefix` (for example `CAP`);
  - unique on `(domain, key)`, so objects can reference `(domain, object_type)` together.
- **`relationship_types`:** `key`, `label`, `inverse_label`, `description`, `client_label`.
- **`relationship_rules`:**
  - columns: `relationship_type`, `source_kind`, `source_object_type` (null = any object), `target_kind`, `target_object_type` (null = any);
  - a relationship is accepted only if a rule matches (§9).

### 6.3 `architecture_elements` (the spine)

| Column                                                               | Notes                                                                                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`, `engagement_id`                                                | `unique (id, engagement_id)` so children can use composite FKs                                                         |
| `kind`                                                               | `element_kind`; `unique (id, kind)` so subtype tables can pin their kind                                               |
| `domain`                                                             | Required for `object` (must equal the type's domain); optional for register kinds                                      |
| `reference_code`                                                     | Engagement-scoped, human-readable, permanent: `CAP-004`, `K-012`, `R-003`, `D-007`. Assigned at creation, never reused |
| `title`, `summary`                                                   | The summary is the element's own statement; its provenance is below                                                    |
| `lifecycle`                                                          | `element_lifecycle`; changed only by operations                                                                        |
| `client_visibility`                                                  | `internal` by default; a published version reaches clients only when `client`                                          |
| `provenance`, `source_reference`                                     | ADR-0009. `source_reference` is free text (document, URL, meeting) when no evidence source record exists               |
| `ip_classification`                                                  | Spec §15; defaults to `project_work_product`                                                                           |
| `owner_user_id`                                                      | The accountable person (internal or client member of the engagement). Not an assignee queue                            |
| `methodology_version`                                                | Copied from the engagement at creation (spec §20)                                                                      |
| `current_version_no`, `published_version_no`, `approved_version_no`  | Pointers into `element_versions`; maintained by operations                                                             |
| `superseded_by_element_id`                                           | Same-engagement FK, set when superseded by another element                                                             |
| `ai_review_state`, `ai_reviewed_by`, `ai_reviewed_at`                | Required to be `accepted` before an `ai_analysis` element can be published                                             |
| `created_by`, `created_at`, `updated_by`, `updated_at`, `retired_at` |                                                                                                                        |

### 6.4 `architecture_objects` (domain objects)

| Column                  | Notes                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `element_id`            | PK; FK `(element_id, kind='object')` to the spine                                       |
| `domain`, `object_type` | FK to `architecture_object_types (domain, key)`; `domain` must equal the spine's domain |
| `maturity`              | `maturity_state`, default `undefined`                                                   |
| `maturity_rationale`    | Required when maturity is above `undefined`                                             |
| `attributes`            | jsonb object, ≤ 32 KB, validated against the type's schema version                      |

### 6.5 Register tables (one per kind, PK `element_id`, FK to the spine with the kind pinned)

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
  - `dependency_type` (`requires`, `sequenced_after`, `informs`, `funds`, `external`);
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
- **`recommendations`:**
  - `rationale`;
  - `priority` (`critical`, `important`, `advisable`);
  - `response_status` (`awaiting`, then an `approval_response` value), set only by the approval operation.

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

Every change to a statement's provenance is written to the activity log with the old and new value. ADR-0009 requires that provenance changes are audited.

### 6.7 `architecture_relationships`

| Column                                          | Notes                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`, `engagement_id`                           |                                                                                                       |
| `source_element_id`, `target_element_id`        | Same-engagement composite FKs; not equal; unique with `relationship_type` while active                |
| `relationship_type`                             | FK to `relationship_types`; must match a `relationship_rules` row                                     |
| `description`, `provenance`, `source_reference` |                                                                                                       |
| `client_visibility`                             | Default `internal`                                                                                    |
| `effective_from`, `retired_at`                  | Relationships are retired, never deleted after publication, so any past baseline can be reconstructed |

### 6.8 Evidence

- **`evidence_sources`:**
  - `id`, `engagement_id`, `title`;
  - `source_type` (`document`, `interview`, `meeting_notes`, `dataset`, `publication`, `regulation`, `web`, `internal_analysis`, `other`);
  - `provenance`, restricted to `client_source`, `public_source`, `architect_observation`, `architect_judgment` or `system_derived`;
  - `source_owner`, `source_date`, `citation`;
  - `url` (HTTPS only), `storage_path` (for the future upload UI), `summary`;
  - `ip_classification`, `client_visibility`, `relevance`.
- **`element_evidence_links`:**
  - `element_id`, `evidence_source_id`, `stance` (`supports`, `contradicts`, `context`), `locator` (page, timestamp, section), `note`;
  - same-engagement FKs.
- **`statement_evidence_links`:** the same, for individual statements.

"Contradicts" is recorded from day one. It is the evidence signal that coherence checks will need later.

### 6.9 `element_method_lineage` (internal only)

- **Columns:** `element_id`, `method_asset_id`, `method_version`, `note`.
- **Clients:** no select policy. A client can see an element with provenance `methodology_derived` and its derived content, but never which Method asset produced it or how.

### 6.10 Versioning

- **`element_versions`** (append-only; no update or delete for anyone):
  - `element_id`, `version_no`;
  - `snapshot` jsonb: the spine, subtype fields, statements with their provenance, and evidence links, as they were at publication;
  - `client_snapshot` jsonb: the same, filtered to client-visible statements and evidence and without internal-only fields;
  - `lifecycle_at_publication`, `change_summary`, `published_by`, `published_at`, `methodology_version`.
- **`architecture_baselines`:**
  - `id`, `engagement_id`, `label` (for example "Architecture Blueprint v1.0"), `description`;
  - `status` (`draft`, `frozen`), `frozen_by`, `frozen_at`.
- **`architecture_baseline_items`:**
  - `baseline_id`, `element_id`, `version_no`;
  - frozen with the baseline.
  - The baseline also records the set of active client-visible relationship ids at freezing.

Baselines are what Phase 5 deliverables and executive reviews will be generated from and approved against.

### 6.11 `architecture_approvals`

| Column                                                                                   | Notes                                                                                         |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`, `engagement_id`                                                                    |                                                                                               |
| `element_id` + `version_no`, or `baseline_id`                                            | Exactly one target. An approval is always for a specific published version or frozen baseline |
| `requested_by`, `requested_at`, `request_note`                                           |                                                                                               |
| `response`, `comments`, `responded_by`, `responded_at`                                   | Written once, by the response operation; immutable afterwards                                 |
| `approval_source` (`portal`, `external`)                                                 |                                                                                               |
| `external_approver_name`, `external_approval_method`, `external_evidence`, `recorded_by` | Required when external; the same rules as Phase 2 change-order approvals                      |

### 6.12 `domain_assessments` (append-only)

- **Columns:** `engagement_id`, `domain`, `maturity`, `rationale` (required), `client_visible`, `assessed_by`, `assessed_at`.
- **Provenance:** always `architect_judgment`.
- **Current state:** the latest row per domain.

### 6.13 `architecture_reference_counters`

One row per `(engagement_id, prefix)`, incremented in the creating transaction under a row lock. It works like the Phase 2 document numbers: sequential, never reused, and gaps are tolerated.

### 6.14 Relationships at a glance

```
engagements ─┬─ architecture_elements ─┬─ architecture_objects ── architecture_object_types
             │   (spine; kind)          ├─ assumptions / risks / dependencies / decisions / recommendations
             │                          ├─ architecture_statements ── statement_evidence_links ─┐
             │                          ├─ element_evidence_links ────────────────────────────┤
             │                          ├─ element_versions ── architecture_baseline_items ── architecture_baselines
             │                          ├─ architecture_approvals
             │                          └─ element_method_lineage ── method_assets (internal)
             ├─ architecture_relationships (element ↔ element; relationship_rules)
             ├─ evidence_sources ──────────────────────────────────────────────────────────────┘
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

### 8.1 New engagement capabilities

These are added to `engagement_capability` in their own migration, as in Phase 2, with role defaults and TPLCo-only per-member overrides (ADR-0008, unchanged).

| Capability             | Side     | Meaning                                                                                                                       | Default holders                                                           |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `publish_architecture` | internal | Move elements through review, publish versions to the client, freeze baselines, record domain assessments, review AI analysis | System Administrator, Principal Architect, Architect                      |
| `view_architecture`    | client   | See **approved** published architecture                                                                                       | Executive Sponsor, Client Project Lead, Client Contributor, Client Viewer |
| `review_architecture`  | client   | Also see **proposed** versions, and comment                                                                                   | Executive Sponsor, Client Project Lead, Client Contributor                |

The existing `approve_architecture` capability (Executive Sponsor and Client Project Lead by default) lets a client:

- respond to approval requests;
- choose an option on a decision.

It requires `review_architecture`.

Client Finance holds none of these by default. They see only the domain maturity summary on the overview, which matches the earlier decision "Finance Contact: limited project summary".

### 8.2 Who can do what

| Action                                                                                                                             | Who                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read the working architecture (live tables)                                                                                        | Internal members who can access the engagement (Phase 1 rule: System Administrators and Principal Architects everywhere, others only when assigned). **Finance Administrators: no access** unless separately assigned |
| Create and edit drafts, statements, relationships, evidence and register records                                                   | Assigned System Administrator, Principal Architect, Architect, Researcher                                                                                                                                             |
| Submit for internal review                                                                                                         | The same                                                                                                                                                                                                              |
| Publish, set client visibility, freeze baselines, request client approval, record domain assessments, accept or reject AI analysis | `publish_architecture`                                                                                                                                                                                                |
| Retire or supersede an element                                                                                                     | `publish_architecture`                                                                                                                                                                                                |
| Record an external client approval or decision                                                                                     | Principal Architect or System Administrator with `publish_architecture`, with evidence                                                                                                                                |
| Project Administrator                                                                                                              | Read only (Phase 1 role: team and logistics)                                                                                                                                                                          |
| Client: read approved published versions                                                                                           | `view_architecture`                                                                                                                                                                                                   |
| Client: read proposed published versions, comment                                                                                  | `review_architecture`                                                                                                                                                                                                 |
| Client: approve, respond, decide                                                                                                   | `approve_architecture` + `review_architecture`                                                                                                                                                                        |
| Client: see Method lineage, internal statements, drafts, unreviewed AI analysis, internal relationships                            | Never                                                                                                                                                                                                                 |

### 8.3 Row-level rules

- **Live tables** (`architecture_elements`, subtypes, statements, relationships, evidence, lineage, counters):
  - internal readers only, and no client select policy at all;
  - clients never read work in progress, even client-visible work.
- **`element_versions`:** clients read only the `client_snapshot` column, through a security-invoker read model, and only for:
  - elements with `client_visibility = 'client'`;
  - versions published as proposed or approved (approved only, without `review_architecture`);
  - not retired.
  - The full `snapshot` column is not granted to clients (column privilege). This is tested.
- **`architecture_relationships` published view:** clients see a relationship only when it is client-visible, active, and both ends are visible to them.
- **`evidence_sources`:** clients see a source only when it is client-visible and linked to a published, client-visible element or statement. Licensed third-party sources stay internal by default.
- **`architecture_approvals`:**
  - clients see requests on versions they can see;
  - they respond only through `respond_to_architecture_approval`;
  - rows are immutable after response.
- **`domain_assessments`:** clients see the latest client-visible assessment per domain on engagements they can access. This is the only architecture record Client Finance sees.
- **Reference tables:** readable by all signed-in users; writable by no one.
- **Everywhere:** anonymous users have no privileges. Suspending a membership removes access immediately, as in Phases 1 and 2.

### 8.4 Operations (`SECURITY DEFINER`)

Each operation follows the Phase 2 pattern:

1. Lock the element (or baseline) row.
2. Check permission with the RLS helpers (42501).
3. Validate the transition (23514), or return P0002 if the record is not visible.
4. Write the change and its activity-log entry.
5. Re-check invariants.

The operations are:

- `submit_element_for_review`, `return_element_to_draft`
- `publish_element_version`: creates the next `element_versions` row and both snapshots, moves the lifecycle to `proposed`, and refuses unreviewed AI content.
- `request_architecture_approval`, `respond_to_architecture_approval` (client), `record_external_architecture_approval`
- `retire_element`, `supersede_element`
- `record_domain_assessment`
- `review_ai_content` (accept or reject a statement or element with `ai_analysis` provenance)
- `set_decision_recommendation`, `decide_decision` (client, or external with evidence), `defer_decision`
- `freeze_baseline`

Direct writes are limited to draft working content, under column-limited grants. Lifecycle, version pointers, reference codes, AI review columns and `client_decision` or `system_derived` provenance are writable only by operations.

---

## 9. How the four domains connect without collapsing into one system

The domains stay distinct by construction:

- **Each type belongs to one domain.** It is fixed in the catalog, and the database checks it.
- **Each domain has its own views, built for its questions:**
  - Knowledge: the domain map and research questions.
  - Capability: the capability map, the role-to-skill matrix and gaps.
  - Strategic Model: applied models with their assumptions and implications.
  - Application: the operating model outline, the decision-rights matrix and the measurement system.
- There is no shared "items" list across domains.
- **Maturity is judged per domain.**

The domains connect through a controlled set of relationship types. The main cross-domain connections follow the Method's flow:

| Relationship               | Typical source → target                                            | Meaning                                  |
| -------------------------- | ------------------------------------------------------------------ | ---------------------------------------- |
| `informs`                  | Knowledge → Strategic Model, Capability, Decision                  | Understanding shapes design              |
| `shapes`                   | Strategic Model → Capability, Application                          | Strategy determines what is built        |
| `requires`                 | Capability → Skill, Role, Knowledge area; Application → Capability | What something cannot exist without      |
| `implemented_through`      | Capability → Application object                                    | How a capability becomes operational     |
| `measured_by`              | Capability, Application object, Strategic implication → Metric     | How success is observed                  |
| `governed_by`              | Application object, Capability → Governance body, Decision right   | Who holds authority                      |
| `part_of` / `broader_than` | Within a domain                                                    | Hierarchies (domain map, capability map) |
| `precedes`                 | Talent stages, scaling stages                                      | Sequencing                               |
| `assumes`                  | Any object → Assumption                                            | What it depends on being true            |
| `threatens`                | Risk → any element                                                 | What could undermine it                  |
| `addresses`                | Recommendation, Capability → Gap, Risk                             | What a response resolves                 |
| `affects`                  | Decision → any element                                             | What a decision changes                  |
| `supersedes`               | Element → element of the same kind                                 | Replacement                              |

For example, the spec §3 chain:

1. Capability "Commercial Acquisition" `requires` Skill "Property Underwriting".
2. Knowledge area "Commercial Real Estate Market" `informs` it.
3. Risk "Capital Availability" `threatens` it.
4. It is `measured_by` Metric "Qualified Acquisitions / Month".
5. It is `implemented_through` Operating model element "Acquisition Team".

The chain is expressed exactly, and the database refuses pairings the Method does not define, such as a Metric that `requires` a Stakeholder.

A **trace view** on every object walks these relationships upstream (why does this exist: evidence, knowledge, strategy) and downstream (what depends on it: capabilities, application, metrics). It shows provenance at each step. This is the structural backbone that coherence analysis will use later, and it needs no graph canvas.

---

## 10. Internal architect experience

The Architecture menu becomes live: Knowledge, Capability, Strategic Models and Application. The Intelligence menu becomes live for the registers.

- **Engagement architecture home:**
  - the four domains, each with its current maturity assessment, rationale and date;
  - the maturity distribution of its objects, labeled "Calculated";
  - counts of drafts awaiting review, proposals awaiting the client, and open decisions.
- **Domain workspace, one per domain, with views built for that domain:**
  - **Knowledge:** an indented domain map (knowledge areas and concepts), research questions by status, and knowledge gaps.
  - **Capability:** a capability map with readiness and ownership columns, a role-to-skill matrix, gaps and the talent sequence.
  - **Strategic Model:** the applied models, each with its linked assumptions, implications, leverage and differentiation logic.
  - **Application:** the operating model outline, a decision-rights matrix (governance bodies × decision areas), a measurement system table (metric → what it measures) and the scaling sequence.
- **Element page:**
  - A header with:
    - reference code, type, domain;
    - lifecycle, maturity, visibility;
    - provenance and IP classification.
  - The summary, then statements grouped by kind, each labeled with its provenance and evidence count.
  - Connected architecture, grouped by relationship type, with cross-domain links marked; assumptions, risks, dependencies and decisions; evidence (supporting, contradicting, context).
  - Method lineage (internal).
  - Versions and approvals; activity.
  - **Preview as client:** shows exactly the `client_snapshot` that publishing would produce.
- **Registers:**
  - assumptions, risks (with a probability × impact grid), dependencies (blocking first), decisions (options, recommendation, outcome) and recommendations;
  - each record links to the elements it concerns.
  - Phase 3 keeps these as plain structured lists. Triage and filtering depth is Phase 4.
- **Evidence library:** sources with type, provenance, date, citation and linked elements.
- **Review queue** (holders of `publish_architecture`):
  - elements in review;
  - AI-provenance content awaiting review (empty until AI exists);
  - approvals awaiting the client.
- **Baselines:** create, add element versions, freeze, request client approval.

The design stays as in Phases 1 and 2: calm, typographic, dense where the work is dense (matrices, registers), with no gamification or progress bars.

---

## 11. Client experience

The client Architecture area answers "Where are we in the architecture?" (spec §7):

- **Overview:** the "Where we are in the architecture" panel shows real domain states and rationale for everyone on the engagement, including Client Finance.
- **Architecture** (`view_architecture`):
  - the four domains, each with its current state and the published objects in the domain's own view (map, matrix, table);
  - each object shows its published summary and client-visible statements, with plain provenance labels (§7) and cited evidence;
  - labels show "Approved", or "Proposed" with `review_architecture`.
- **Awaiting your response** (`approve_architecture`):
  - approval requests for element versions and baselines, answered with approve, approve with comments, request revision, defer or decline;
  - decisions with their options, TPLCo's recommendation marked as a TPLCo assessment, and a choice;
  - every response is recorded with who and when, and is final.
- **History:** previous approved versions stay readable, so the client can see what they approved and what changed since.
- **Never shown:**
  - drafts;
  - internal statements;
  - internal relationships;
  - unreviewed AI analysis;
  - Method lineage, Method assets or templates;
  - other clients' anything.

The client navigation gains Architecture and Decisions. Actions, Reviews, Documents and Implementation stay muted until their phases.

---

## 12. Approvals and decisions in detail

- **What an approval is for.** An approval request targets one published element version or one frozen baseline.
  - The client response applies to that version only.
  - If the architect later publishes version 3, the approval of version 2 remains true of version 2.
  - The element shows "Approved (v2); changes since proposed as v3".
- **Approve with comments** approves the version and records the comments.
- **Request revision** keeps the element `proposed`.
- **Defer** records the deferral with no state change.
- **Decline** returns the element to `draft` internally, and the record keeps the version declined.
- **External approvals and decisions** are recorded by a Principal Architect or System Administrator. They need:
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

Phase 2 deliberately gave milestones only a text `stage_label`. The future link is designed so that finance may **refer to** architecture, while architecture never depends on finance:

- **The link table:** a later link table, `payment_milestone_architecture_links (payment_milestone_id, element_id or baseline_id, note)`, owned by the finance side:
  - written only by financial managers;
  - both ends in the same engagement (composite FKs).
- **Direction:** it is the only connection, and it points from finance to architecture. No architecture table has a column or FK referring to finance, and no architecture operation reads a finance table.
- **Architecture does not change finance automatically.** An approved baseline may be shown to a financial manager as the reason to mark a milestone "ready to invoice". Marking it stays a manual finance action (`set_milestone_status`), never a trigger.
- **Finance never changes architecture.** Payment state, overdue invoices or a voided contract never change an element's lifecycle, maturity, visibility or approvals. Architecture approvals are not withheld for non-payment by the system; that would be a business decision made by people.
- **Visibility of links:**
  - a link is visible only to someone who can see both the milestone (`view_financials`) and the architecture target;
  - a client without `view_financials` sees no link, and a finance-only client sees no architecture detail through it.

Phase 3 enforces the direction now: a pgTAP test asserts that no Phase 3 table has a foreign key into any finance table.

---

## 14. Test strategy

The same layers as Phase 2, with the database carrying most of the weight.

**pgTAP** (new files):

- **`07_architecture_access`:** the role matrix end to end:
  - each internal role, assigned and unassigned;
  - Finance Administrator (no architecture access);
  - Executive Sponsor, Project Lead, Contributor, Viewer (approved only), Client Finance (domain summary only);
  - a multi-organization advisor, and anonymous users;
  - clients never read live tables, the full snapshot, Method lineage, internal statements, internal relationships, drafts or unreviewed AI content;
  - capability overrides work in both directions;
  - suspension removes access.
- **`08_architecture_integrity`:**
  - type and domain agreement;
  - relationship rules (allowed and refused pairings);
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
  - publishing creates immutable snapshots;
  - the client sees the published snapshot, not later working edits;
  - approvals are pinned to versions and immutable;
  - an approved version survives revision;
  - baselines freeze;
  - retired relationships preserved;
  - the client snapshot omits internal statements.
- **`99_architecture_concurrency`:**
  - two sessions publishing the same element get sequential version numbers;
  - two sessions creating objects get distinct reference codes.

**Vitest:**

- every object type has a Zod attribute schema, and the schemas accept seed data;
- the catalog mirrors the database enum and type lists;
- provenance labels are complete;
- relationship rules in the domain layer mirror the database rules;
- the client snapshot builder filters correctly.

**Playwright:**

1. An Architect creates objects in all four domains, links them across domains, cites evidence and submits for review.
2. A Researcher can draft but cannot publish.
3. A Principal publishes and requests approval.
4. The Executive Sponsor sees the proposal and approves with comments.
5. The Viewer sees it only once approved.
6. Client Finance sees only the domain states.
7. The Finance Administrator sees no architecture.
8. The Project Lead records a decision.

**Seed:** a realistic Meridian architecture, created through the operations as in Phase 2:

- about 25 objects across the four domains, reproducing the spec §3 example chain;
- evidence, assumptions, risks, a dependency and a decision with options;
- one approved and one proposed version, and one frozen baseline.

---

## 15. Difficult-to-reverse decisions

| #   | Decision                                                                           | Why it is hard to reverse                                                                                    |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | **Element spine with subtype tables** (§3.1)                                       | Every relationship, version, approval and future AI output keys on element ids                               |
| 2   | **Clients read published snapshots, never live rows** (§8.3)                       | Changes what "the client saw" means; approvals and audit depend on it                                        |
| 3   | **Provenance at element and statement level, closed enum** (ADR-0009)              | Historical records cannot be re-labeled honestly after the fact                                              |
| 4   | **Type catalog with fixed domains; attributes in validated jsonb** (§4)            | Stored attributes and seed or Method content follow the schema; moving to columns later means data migration |
| 5   | **Relationship types and allowed pairings enforced by the database** (§9)          | The vocabulary becomes part of the Method as software; removing a type means rewriting links                 |
| 6   | **Domain maturity is a dated judgment, never a computed score** (§5)               | Clients will read and compare states over time                                                               |
| 7   | **Separate axes: lifecycle, maturity, register status, later implementation** (§5) | Merging them later would lose meaning in stored history                                                      |
| 8   | **Approvals pinned to versions and immutable** (§12)                               | They are client commitments                                                                                  |
| 9   | **Method lineage in an internal-only table** (§6.9)                                | Protects Method/IP structurally rather than by filtering                                                     |
| 10  | **One-way finance → architecture link** (§13)                                      | Prevents billing from controlling architecture                                                               |
| 11  | **New capability enum values** (§8.1)                                              | Postgres enum values cannot be removed                                                                       |
| 12  | **Permanent reference codes** (§6.13)                                              | Clients and documents will cite them                                                                         |

Each will get an ADR (0013 onward) with the build.

---

## 16. Decisions requested

My default is marked for each. If approved as proposed, I build the defaults.

1. **Scope.** Phase 3 builds the evidence, assumption, risk, dependency, decision and recommendation records at foundation depth. Phase 4 keeps the Project Intelligence experience.
   - **Default:** yes.
   - **Alternative:** Phase 3 builds domain objects and relationships only; the registers are designed now and built in Phase 4.
2. **Client visibility levels.**
   - **Default:** Viewer sees approved only; Contributor, Project Lead and Executive Sponsor also see proposed; Client Finance sees domain states only.
   - Per-area assignment for Contributors ("assigned areas") is deferred to Phase 4, with client actions.
3. **Who publishes to the client.**
   - **Default:** System Administrators, Principal Architects and Architects (`publish_architecture`).
   - Researchers draft only.
   - Project Administrators read only.
4. **Client approval authority.**
   - **Default:** `approve_architecture` (Executive Sponsor and Project Lead) approves element versions, baselines and decisions.
   - External approvals and decisions are recorded by Principal Architects and System Administrators with evidence, as in Phase 2.
5. **Baselines in Phase 3.**
   - **Default:** yes, minimal (create, freeze, approve), because versioning and approvals need them and Phase 5 deliverables build on them.
6. **Object type catalog.**
   - **Default:** the types in §4, changed only by migration until the Method Library (Phase 6) governs them.
   - Please correct names or add types now: they become the Method's vocabulary in software.
7. **Evidence files.**
   - **Default:** Phase 3 records evidence by citation, URL or reference.
   - The upload UI is built once and shared with the Phase 2 pre-production upload requirement.
   - Tell me if you would rather schedule that shared upload work before Phase 3.

---

## 17. Build order once approved

1. ADRs 0013 onward for the decisions in §15.
2. Capability migration (the new enum values), then the architecture migration: reference data, tables, guards, RLS, operations and read models.
3. pgTAP tests (07, 08, 09, 99) and seed data.
4. Domain layer: type catalog, Zod schemas, provenance labels, queries, actions.
5. Internal workspace, then the client Architecture area.
6. Playwright run-through, docs (`docs/database/architecture.md`), README and the end-of-phase report.

As before, each step is checked locally and in CI, with the end-of-phase report before the merge.
