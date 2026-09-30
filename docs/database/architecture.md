# Architecture Core: schema, rules and access (Phase 3)

Migrations:

- `20261001000000_architecture_capabilities.sql` adds the capability enum values.
- `20261001000100_architecture_core.sql` holds everything else.
- `20261001000200_architecture_element_creation.sql` adds one creation function.
- `20261001000300_architecture_governance.sql` restricts who grants architecture authority and adds the architecture activity read model.

The specification is [`docs/product/PHASE_3_PROPOSAL.md`](../product/PHASE_3_PROPOSAL.md), and the decisions are in ADR-0013 to ADR-0025.

The database is the authority for every rule below. The application offers only the choices the database accepts, and the database checks them again.

## Rules that hold throughout

- **Working copies are internal.** The live tables have no client policy at all. Clients read only published, immutable version snapshots (ADR-0014).
- **Operations change state.** Lifecycle, publication, approvals, decisions, AI review, retirement, supersession, domain assessments and baseline freezing change only through the operations below.
  - Each operation marks the transaction as an architecture operation and locks the row.
  - It then checks capabilities (error 42501), validates the change (23514), or reports a record the caller cannot see (P0002).
- **Permissions come from capabilities, never role names.**
- **Finance and architecture stay apart.** No architecture table references a finance table, and no operation reads one (ADR-0023). A pgTAP assertion checks the foreign keys.
- **Timestamps use `clock_timestamp()`,** so histories written in one transaction still order correctly.

## Capabilities (ADR-0024)

| Capability             | Side     | Default holders                                                                  |
| ---------------------- | -------- | -------------------------------------------------------------------------------- |
| `edit_architecture`    | internal | Principal Architect, Architect, Researcher                                       |
| `publish_architecture` | internal | Principal Architect, Architect                                                   |
| `view_architecture`    | client   | Executive Sponsor, Client Project Lead, Client Contributor, Client Viewer        |
| `approve_architecture` | client   | Executive Sponsor, Client Project Lead (existing; needs `view_architecture` too) |

The following hold no architecture capability by default: System Administrators, Project Administrators, Finance Administrators and Client Finance. TPLCo can grant a capability by per-member override (ADR-0008). Overrides of `edit_architecture` and `publish_architecture` are granted or revoked only by Principal Architects, never for themselves; System Administrators and Project Administrators cannot (`20261001000300_architecture_governance.sql`, decided 2026-09-30).

Helpers in `private`:

| Helper                         | True when                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `can_read_architecture`        | The caller is internal and can access the engagement (Phase 1 access rules)      |
| `can_edit_architecture`        | The caller is internal and holds `edit_architecture`                             |
| `can_publish_architecture`     | The caller is internal and holds `publish_architecture`                          |
| `can_view_client_architecture` | The caller holds `view_architecture`                                             |
| `can_respond_to_architecture`  | The caller holds `view_architecture` and `approve_architecture`                  |
| `is_engagement_client_member`  | The caller is an active client member of the engagement (used for domain states) |

## Tables

### Reference data

Reference tables are managed by migration. Every signed-in user can read them and no one can write them.

- **`architecture_object_types`:** the 27 core types, each with its domain.
- **`relationship_types`:** the 31 relationship types, with category, inverse label, whether each is symmetric or acyclic, and a definition.
- **`relationship_rules`:** the 1,960 allowed pairings of source kind and type with target kind and type.

The TypeScript catalog in `src/domain/architecture/vocabulary.ts` mirrors these tables, and `vocabulary.test.ts` checks it against the migration.

### The element spine and subtypes (ADR-0013)

- **`architecture_elements`:** one row per core object or Project Intelligence record. It holds:
  - the kind, title, summary and reference code;
  - lifecycle, client visibility, provenance, IP classification and AI review state;
  - `engagement_wide`, the owner, and the latest version pointer.
- **`architecture_objects`:** one row per core object, with its type, maturity and rationale, and validated `attributes` (jsonb, `schema_version` 1). The domain comes from the type, so each object has exactly one domain.
- **Project Intelligence records:** one table per kind, each keyed by the element: `assumptions`, `risks`, `constraints`, `dependencies`, `decisions` (with `decision_options`) and `recommendations`.
- **`intelligence_record_domains`:** the zero or more domains a record spans. A record must be engagement-wide, span a domain, or concern an element; this is checked when it is submitted or published.

A deferred integrity trigger checks at commit that every element has its subtype row and a reference code. Because of that, the client creates an element through `create_architecture_element(engagement, kind, element, details, domains)`. This SECURITY INVOKER function writes the spine row, the subtype row and the record domains in one transaction, so RLS and the guards still apply as to a direct insert.

### Statements and evidence (ADR-0015)

- **`architecture_statements`:** material statements (findings, rationale, implications and similar). Each has its own provenance and a `client_visible` flag.
- **`evidence_sources`:** the evidence library, a source system separate from the architecture. Sources are references (URLs must be HTTPS); file upload comes later.
- **Links to evidence:**
  - `statement_evidence_links` link statements to sources, each with a stance, locator and internal note.
  - `element_evidence_links` link a whole element to a source.
- **`element_method_lineage`:** which Method assets an element derives from. It is internal only and never appears in a client snapshot (ADR-0022).

### Relationships (ADR-0018)

**`architecture_relationships`:** typed links between elements of one engagement, enforced by composite foreign keys.

- The rules table decides which pairings are allowed.
- Acyclic types (`part_of`, `specializes`, `precedes`, `supersedes`) refuse cycles.
- `conflicts_with` is stored once per pair, in canonical order.
- Publication:
  - A relationship publishes automatically once both ends are published.
  - A published relationship is never edited; it is retired with a reason.

### Versions, baselines, approvals and assessments (ADR-0021)

- **`element_versions`:** one immutable row per publication, with two snapshots:
  - `snapshot`, the full snapshot, which is never granted to any signed-in role. Internal readers use `element_version_snapshot()`.
  - `client_snapshot`, the only snapshot clients read. It carries no internal statements, no internal evidence notes, no Method lineage and no unreviewed AI content.
- **Baselines:**
  - `architecture_baselines` records a baseline as a draft, then frozen.
  - `architecture_baseline_items` pins exact element versions.
  - When a baseline freezes, it captures `architecture_baseline_relationships` and `architecture_baseline_assessments`.
- **`architecture_approvals`:** one request per element version or frozen baseline.
  - The response is `approved` or `changes_requested`, and a comment is required for changes requested.
  - The source is `client_portal` or `external_recorded_by_tplco`.
  - An external approval records the approver, their title, the date, the method (`architecture_approval_method`), the evidence reference, the recording user and the recorded time.
  - A row is immutable once responded to.
- **`domain_assessments`:** an append-only, dated judgment of domain maturity by an architect, with a required rationale (ADR-0019). It is never computed.
- **`architecture_reference_counters`:** per-engagement, per-prefix counters. Reference codes (`KNW-001`, `RSK-002` and so on) are sequential, permanent and never reused (ADR-0025).

## Operations

| Operation                                                                | Capability                                   |
| ------------------------------------------------------------------------ | -------------------------------------------- |
| `submit_element_for_review`                                              | `edit_architecture`                          |
| `return_element_to_draft`                                                | `publish_architecture`                       |
| `publish_element_version`                                                | `publish_architecture`                       |
| `retire_element`, `supersede_element`, `retire_relationship`             | `publish_architecture`                       |
| `review_ai_content`                                                      | `publish_architecture`                       |
| `record_domain_assessment`                                               | `publish_architecture`                       |
| `request_architecture_approval`, `record_external_architecture_approval` | `publish_architecture`                       |
| `respond_to_architecture_approval`                                       | `view_architecture` + `approve_architecture` |
| `set_decision_recommendation`                                            | `edit_architecture`                          |
| `decide_decision`                                                        | `view_architecture` + `approve_architecture` |
| `record_external_decision`, `defer_decision`                             | `publish_architecture`                       |
| `freeze_baseline`                                                        | `publish_architecture`                       |

What some operations do:

- **`publish_element_version`** writes the next version and both snapshots, then sets the lifecycle to published. It refuses unreviewed AI content and records that are out of scope.
- **`return_element_to_draft`** goes back to `published` when a version already exists.
- **`decide_decision`** and **`record_external_decision`** freeze the decision and record its outcome with `client_decision` provenance. No one can write that provenance, or `system_derived`, directly.

Editors write working content directly, but only the columns granted in section 10 of the migration. Guards refuse changes to anything an operation owns.

## Read models

These run as the caller, so RLS decides their inputs.

- **Client:**
  - `client_architecture` gives the latest published client-visible version of each element, with its approval state and latest approved version.
  - `client_element_versions` gives an element's history.
  - `client_architecture_relationships` gives published, client-visible, active relationships whose ends the client can see.
  - `client_decisions` gives decisions with their options, recommendation and outcome.
- **Shared:**
  - `architecture_domain_states` gives the latest assessment per domain, for internal readers and every client member.
  - `object_maturity_distribution` gives the "Calculated" counts shown beside the judgment.
  - `compare_baselines(a, b or null)` lists elements, relationships and domain states added, removed and changed, between two frozen baselines or against the current published architecture.
- **Internal:**
  - `element_version_snapshot` returns the full snapshot.
  - `preview_client_snapshot` returns what publishing the working copy now would give a client.
  - `architecture_activity(engagement, element?, limit)` returns curated architecture events (created, edited, submitted, returned, published, relationships, statements, provenance, evidence, approvals, decisions, assessments, baselines) to holders of `edit_architecture` on the engagement and to System Administrators and Principal Architects. It reads `activity_log` as definer but returns no other event and no raw row; the `activity_log` policy is unchanged.

## Who can see what

| Record                                                      | Internal readers | Client with `view_architecture`                       | Client Finance (default) |
| ----------------------------------------------------------- | ---------------- | ----------------------------------------------------- | ------------------------ |
| Live tables (working copies, statements, evidence, lineage) | Yes              | Never                                                 | Never                    |
| `element_versions.client_snapshot`                          | Yes              | Client-visible, non-retired elements, approved or not | No                       |
| `element_versions.snapshot` (full)                          | Via function     | Never (column not granted)                            | Never                    |
| Approvals                                                   | Yes              | On versions and frozen baselines they can see         | No                       |
| Baselines                                                   | Yes              | Frozen only, with items they can see                  | No                       |
| Domain assessments                                          | Yes              | Latest client-visible per domain                      | Latest client-visible    |

Evidence reaches clients only as citations inside a client snapshot. There is no client policy on `evidence_sources`.

Anonymous callers have no privileges. Suspending a membership removes access at once.

## Tests

| File                          | Assertions | Covers                                                                                                                                                                                      |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `07_architecture_access`      | 65         | The capability matrix role by role, overrides, suspension, anonymous, and what clients never read                                                                                           |
| `08_architecture_integrity`   | 73         | Domains, record scope, relationship rules, cycles, canonical pairs, composite keys, codes, provenance, guards, no finance FKs                                                               |
| `09_architecture_versions`    | 44         | Immutable versions and snapshots, approvals pinned to versions, baselines, `compare_baselines`                                                                                              |
| `10_architecture_creation`    | 16         | `create_architecture_element`: codes, record domains, severity, refusals and permissions                                                                                                    |
| `11_architecture_governance`  | 48         | Only Principal Architects grant or revoke architecture authority; granted and revoked overrides work; architecture activity for Architects and Researchers only, with no other audit events |
| `99_architecture_concurrency` | 10         | Two sessions publishing one element, and two sessions creating elements (distinct codes)                                                                                                    |
