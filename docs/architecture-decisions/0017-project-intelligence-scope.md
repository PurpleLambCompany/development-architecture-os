# ADR-0017: Project Intelligence records may span domains

**Status:** Accepted (Phase 3 proposal §3.2 and §15.5, decision 16.1.7, approved 2026-09-30)

## Context

A risk such as "Leadership succession failure" concerns Capability and Application; a constraint may concern the whole engagement. Forcing a record into one domain loses meaning.

## Decision

- Core objects belong to exactly one domain (their type's). Records never have a single domain column.
- A record states its scope by any combination of: rows in `intelligence_record_domains` (zero or more domains); Project Intelligence relationships to specific elements (`underpins`, `threatens`, `constrains`, `mitigates`, `affects`, `addresses`); `engagement_wide = true`.
- Before a record leaves draft (submit or publish), it must have at least one of the three. `intelligence_record_domains` refuses core objects.

## Consequences

- Register views filter by domain through the join table, not a column; a record appears under every domain it names.
