# ADR-0015: Provenance on elements and statements; statement → evidence chain

**Status:** Accepted (implements ADR-0009; Phase 3 proposal §6.6, §6.8, §7 and §15.3)

## Context

ADR-0009 requires every architecture object and every material statement to carry one of eight provenance types. Later analysis must be able to cite, contest and review individual claims.

## Decision

- `provenance_type` is a closed enum with the eight ADR-0009 values. It is on every element, statement and relationship.
- Material statements are rows in `architecture_statements` (finding, observation, rationale, implication, definition, note), each with provenance, source reference, client visibility and AI review state.
- Evidence is a separate source system: `evidence_sources` (reference now; files later through `evidence_source_files`, built with the upload system). Statements cite sources through `statement_evidence_links` (supports, contradicts or context, with a locator); whole elements through `element_evidence_links`.
- `client_decision` and `system_derived` are refused on direct writes; only operations write them.
- `ai_analysis` content starts `pending` review and cannot be published until a `publish_architecture` holder accepts it.
- Every provenance change on a statement is audited with its old and new value.

## Consequences

- History cannot be relabeled honestly after the fact, so the enum and chain are permanent. A new provenance type needs a new ADR.
