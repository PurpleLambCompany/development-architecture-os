# ADR-0006: Contract value lives with contracts (Phase 2), not engagements

**Status:** Accepted (Phase 1 decision 4, approved 2026-09-29)

## Context

Spec §26 places `original_contract_value` and `revised_contract_value` on `engagements`. Postgres RLS is row-level: anyone who can read an engagement row can read every column. Client Viewers and Client Contributors must be able to read their engagement but need not see fees (§27: financial visibility is separate).

## Decision

Phase 1 `engagements` carries no financial columns. Contract values arrive in Phase 2 on `contracts`, `payment_milestones`, `invoices`, `payments` and `change_orders`, each with its own RLS keyed to financial visibility (internal Principal/Finance roles; client Executive Sponsor and Client Finance). The revised contract value will be **calculated** from approved change orders on the server, not stored as an editable field.

## Consequences

- Engagement setup in Phase 1 does not capture a fee. Phase 2 adds it with the contract.
- This resolves a conflict between the spec's initial data model (§26) and its permissions model (§27) in favor of the permissions model.
