# ADR-0043: Method Applications are off-spine practice records with explicit linkage

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decisions D2, D9, D12–D14, D17, D24 and D30–D32.

Spec §15, §17, §20 and §21 ("method asset used", "frequently applied models", "impacted engagements", "usage tracking") all presuppose a record of each actual use of a method. Static lineage says what an element derives from; it does not say that a method was performed, why, under what conditions, with what adaptations and with what result. That record cannot be reconstructed after the fact.

The element spine (ADR-0013) was considered and rejected for this record. A spine row would carry client visibility, versions, statements and lifecycle axes that do not apply to an act of work, and would expose every architecture register, domain view and client snapshot to a record that is not architecture. The one real cost of staying off the spine is that typed relationships (`architecture_relationships`) cannot reach a non-spine record, so the linkage is designed explicitly.

## Decision

**Name and identity (D12, D13).** The record is a _Method Application_, always the two-word compound. Each carries an engagement-scoped internal reference code `MUS-nnn` from `private.next_reference_code(engagement, 'MUS')` (ADR-0025). Codes never appear in a client read model. Method Assets and releases are TPLCo-wide and identified by key, title and version label, not by a code.

**What it records.** `method_applications` pins one exact Method version on one engagement: `method_asset_version_id`, the engagement's `dam_release_id` at start, `version_in_release`, `outside_release_reason`, `title`, `selection_reason`, `architectural_question`, `engagement_wide`, `state`, `started_on`, `closed_on`, `completion_statement`, `retrospective`, `discontinued_reason` and `continues_application_id`.

**Only published Methods are applied (D2, D9).** `start_method_application` (`edit_architecture` on the engagement):

- accepts only the current published, non-legacy version of an active Method-form asset (`private.require_usable_method_version(…, 'method')`). Models are instantiated, and Standards, Instruments and Templates are used within applications;
- requires a selection reason;
- allows a version outside the engagement's release only with an `outside_release_reason`, and records `version_in_release`;
- sets the lead practitioner to the caller or to a named active internal member of the engagement;
- copies the engagement's Development Contexts into `method_application_contexts` (ADR-0045).

**Explicit, off-spine linkage (D14).** Phase 6 writes nothing to `architecture_relationships` and adds no relationship type or rule (ADR-0018). An application links to what it touched through its own tables, each with composite (`id`, `engagement_id`) keys so no link can cross engagements:

| Table                         | Links to                                                    | Roles and rules                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `method_application_elements` | any element on the engagement                               | `examined`, `produced`, `revised`, `informed`; one row per application, element and role; kind rules below                                            |
| `method_application_evidence` | evidence sources                                            | `drew_on`, `gathered`; only gathered evidence may name an `instrument_version_id`, and only an Instrument the application used or its Method declares |
| `method_application_assets`   | published Model, Standard, Instrument and Template versions | components actually used, with a `deviation_note`; a Method is never a component                                                                      |
| `method_application_domains`  | architecture domains                                        | domain-level scope without naming elements                                                                                                            |

`private.method_element_role_allows`, called by `link_method_application_element`, enforces the role and kind rules:

| Role       | Allowed element kinds                                                                      |
| ---------- | ------------------------------------------------------------------------------------------ |
| `examined` | any                                                                                        |
| `produced` | `object`, the seven Project Intelligence kinds, `deliverable`                              |
| `revised`  | `object`, the seven Project Intelligence kinds, `deliverable`, `implementation_initiative` |
| `informed` | `decision`, `recommendation`, `review`, `implementation_initiative`                        |

Reviews are convened, never produced by method work. Implementation Initiatives are initiated by Decisions and Recommendations (ADR-0034), never produced by method work. These links are not relationships, carry no evidence stance and never appear in trace views as architecture.

**Lifecycle (D17).**

- `planned` → `in_progress` (`begin_method_application`, which sets `started_on`) → `completed` or `discontinued`. There is no approval state, percent complete, per-stage status, assignee or due date.
- `complete_method_application` requires an in-progress application, a completion statement and at least one element or evidence link. `discontinue_method_application` requires a reason. Both refresh each element link's captured identity and, for `produced` and `revised` links, record `observed_version_id` as the element's latest published version at closure (null for a draft).
- The pin never changes: `private.guard_method_application` refuses changes to the version, engagement, code, release or `version_in_release`. Moving work to a newer version means discontinuing the application and starting a new one whose `continues_application_id` names the discontinued one on the same engagement.
- Closure freezes the record. `private.guard_method_application` and `private.guard_method_application_child` refuse any change to a closed application and its children. Later insight is added through `add_method_application_addendum`, which is append-only and accepted only after closure. Applications are never deleted.
- Stage notes (`set_method_application_stage_note`) point at a stage of the pinned version and record a treatment (`followed`, `adapted`, `skipped`), with a reason required for the last two, and a working note.

**Removed drafts stay readable (D30).** Each element link captures `captured_reference_code`, `captured_kind`, `captured_object_type_key`, `captured_title` and `captured_at` when linked, refreshed at closure. The element foreign key is `on delete set null (element_id)`. When an unpublished linked draft is deleted under the ordinary Phase 3 rule, the child guard permits exactly that one change, even on a closed application, and stamps `element_removed_at`. Published elements are never deleted, so `observed_version_id` remains their authoritative reference. Phase 3 deletion rules are unchanged.

**Project Intelligence (D31).** Risks, Assumptions, Decisions, Recommendations and the other Phase 4 records produced by method work are ordinary Phase 4 records created through Phase 4 operations and then linked. Nothing is created automatically, there is no method-specific finding or recommendation type, and `methodology_derived` is not their provenance (ADR-0047).

**Reviews (D24).** A Review does not examine a Method Application. An application may be linked to a Review as `informed`, a Review may carry `judged_against` lineage to a Standard (ADR-0047), and Reviews continue to examine elements and validate initiatives as in Phase 5.

**Visibility (D32).** Select policies on `method_applications` require `private.is_internal()` and `private.can_read_architecture(engagement_id)`; the child tables use `private.can_read_method_application`. Every write needs `edit_architecture`. Method Applications are internal TPLCo practice and provenance records and are never client-readable, by any client role. Client Contributor area filtering (ADR-0030, ADR-0040) therefore does not apply directly to them: a Contributor reads no application, link, stage note or addendum, and applications are not exposed to clients to make an area clause operational. Area restrictions continue to govern the client-facing Architecture and other client-visible engagement records under their existing rules. Clients learn about methodology only through the DAM release identity, published approach statements and agreed client-visible Acceptance Criteria (ADR-0042, ADR-0046, ADR-0049).

_Clarification (2026-09-30, Kerrick, at final acceptance):_ Revision 2 of the proposal worded D32 as visibility to "anyone who can read the engagement's architecture" with area-filtered links for Contributors. That wording is withdrawn. This is a clarification of D32, not a change to the security model built here.

**The practice loop's return path.** `add_method_version_learning_source` (`author_methodology`) lets a draft asset version cite a closed application with a note in `method_version_learning_sources`. The row freezes with the version.

**Read models.** `method_application_register(engagement)` lists an engagement's applications with method, version, lead, dates and link counts. `element_practice_context(element)` lists the applications linked to an element and its typed lineage. `method_usage(asset)` gives per-version counts across engagements and lists applications only on engagements the caller can read. The first two are `security invoker`, so RLS decides what they return.

## Consequences

- Architecture never depends on an application. Removing Phase 6 would leave every element valid.
- The name, the `MUS` prefix and the role values are permanent. Moving applications onto the spine later would be a data migration into `architecture_elements` with new kinds.
- A mistaken closure is corrected by an addendum, not an edit.
- Phase 6 builds no task management, no Review type for method adherence, no automated attribution of outcomes to methods and no AI summarization of applications.
