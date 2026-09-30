# ADR-0047: Methodology provenance: typed lineage and the narrow `methodology_derived`

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decisions D18 and D19. This record clarifies ADR-0009.

Before Phase 6, `element_method_lineage` (ADR-0022) linked an element to a Method Asset with a free-text `method_version`. It was pinned to nothing immutable and did not say how the asset was used. Spec §15 asks lineage to record the "method asset used".

ADR-0009 defined `methodology_derived` as "produced by applying the Development Architecture Method". Read broadly, that covers almost everything an architect does once methods are applied routinely, and it would blur two kinds of provenance that Kerrick's Q15 decision keeps apart: whose authority a claim rests on (architecture provenance, ADR-0009 and ADR-0015) and how the work was performed (practice provenance, Method Applications and lineage).

## Decision

**Lineage is typed and pinned (D18).** Migration `20261005000700_typed_method_lineage.sql` adds `method_asset_version_id` and `lineage_role` (both required) to `element_method_lineage`; the unique key becomes (`element_id`, `method_asset_version_id`, `lineage_role`). The form decides which verbs are possible, and `private.guard_method_lineage` enforces form, role and element kind:

| `lineage_role`        | Form     | Element kinds                                          |
| --------------------- | -------- | ------------------------------------------------------ |
| `instantiates`        | Model    | core object                                            |
| `produced_from`       | Template | Deliverable whose `deliverable_type` is the Template's |
| `judged_against`      | Standard | Review, core object, Implementation Initiative         |
| `legacy_derived_from` | legacy   | pre-Phase 6 rows only; never written again             |

- A Method is never element lineage: its use is recorded by a Method Application (ADR-0043). An Instrument is used within an application and is never lineage either.
- `record_method_lineage(element, version, role, note)` and `remove_method_lineage(lineage)` are the only writes. Both require `edit_architecture` on the element's engagement. A new row must pin the current published, non-legacy version of an active asset. The guard sets `method_asset_id` and the historical `method_version` text from the version, and refuses any change to a row's pin.
- Direct grants and the editor policies on the table are revoked. Reading requires `private.is_internal()` and `private.can_read_architecture`. Lineage never enters a snapshot (ADR-0022).
- Backfill: every existing row is pinned to its asset's legacy version with role `legacy_derived_from` (ADR-0041). Legacy rows cannot be removed; they go only with a deleted draft element.

**`methodology_derived` is narrow (D19).** It means the content was literally taken from TPLCo's Method, for example a strategic model instantiated as an Applied Strategic Model, or a capability taxonomy instantiated into Capabilities. It does not mean "discovered while using a method", which is ordinary observation or judgment, nor "structured by a template", which is `produced_from` lineage. Project Intelligence records produced by method work are not `methodology_derived`; the Method Application link is their practice provenance.

- `publish_element_version` now calls `private.assert_methodology_derived_instantiates`. Publishing refuses (`23514`) an element whose own provenance, or any of whose statements, is `methodology_derived` unless it has `instantiates` lineage to a non-legacy Model version that is published or since superseded. The rest of the operation is unchanged.
- Already-published element versions are immutable and are not re-validated. The migration reports, by notice, each published element with `methodology_derived` provenance and no `instantiates` lineage.
- The `provenance_type` enum is unchanged.

**Seed check.** The Meridian Applied Strategic Model _Anchor-led cluster development_ keeps its `legacy_derived_from` row to the Strategic Model Library Index, which stays a legacy asset, and gains `instantiates` lineage to the seeded Model _Anchor-led cluster development model 1.0_, so its next publication passes the check.

## Consequences

- Every use of a Model, Template or Standard on an element names the exact version and the verb. "Frequently applied models" and "impacted templates" become queries.
- Architects must record the Model when they claim `methodology_derived` provenance. The check is easy to relax later if needed.
- The role values are permanent.
- ADR-0009's list of provenance types is unchanged; its definition of `methodology_derived` is read narrowly, as stated here.
