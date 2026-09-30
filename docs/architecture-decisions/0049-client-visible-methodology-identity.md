# ADR-0049: Client-visible methodology identity through approach statements

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decision D21. ADR-0022 is unchanged and cross-referenced.

ADR-0022 makes the Method/IP boundary structural: method lineage is internal only, snapshots never include it, and `methodology_derived` is shown to clients without naming the asset. Kerrick's Q12 decision allows TPLCo to tell a client, intentionally, that a branded method was used, provided naming is explicit and never automatic.

A `client_visible_name` field projected into client snapshots was considered and rejected. It would create a data path from the library into client snapshots, name methods on elements the architect never chose to annotate, and let a library edit silently change client-visible text.

## Decision

- `statement_kind` gains one permanent value, **`approach`**: authored, publishable text on the element concerned describing how the work behind it was approached. For example: "Assessed using TPLCo's Capability Readiness Diagnostic™, through leadership interviews and a document review."
- Approach statements follow the existing statement rules unchanged. They carry provenance, reach a client only when the element and the statement are published and client-visible, and are versioned in the existing `client_snapshot`. The snapshot builder is unchanged, and client snapshot key sets are unchanged.
- Each Method Asset version carries two internal guidance fields: `identity_disclosure` (`internal_only` by default, or `may_be_named`) and `disclosable_name`, which a check constraint allows only when the version may be named. No client read model or snapshot reads either field.
- The application's statement editor offers the approved names of `may_be_named` assets linked to the element, and warns, without blocking, when the title of an `internal_only` asset appears in client-visible text (`src/domain/methodology/approach.ts`).
- The only client read path into Method Library data is `client_engagement_methodology(engagement)`, which returns the engagement's DAM release label and title (ADR-0042). No client policy exists on any Method Library or practice table.

## Consequences

- Naming a method to a client is always an explicit, authored, published and approvable act by an architect.
- ADR-0022 holds as written: lineage stays internal, and `methodology_derived` content is still labelled without naming the asset.
- One more permanent `statement_kind` value exists; the application's statement-kind mirror (`src/domain/architecture/catalog.ts`) includes it.
