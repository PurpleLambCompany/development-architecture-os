# ADR-0019: Domain maturity is a dated architect judgment, never a computed score

**Status:** Accepted (Phase 3 proposal §5 and §15.7)

## Context

The specification (§8) warns against simplistic arbitrary scoring. Clients will read and compare domain states over time.

## Decision

- `domain_assessments` is append-only: engagement, domain, maturity, a required rationale, client visibility, assessor and time. Provenance is always `architect_judgment`. The current state is the latest row per domain.
- Only `record_domain_assessment` (a `publish_architecture` holder) writes it.
- The workspace shows the distribution of object maturity as system-derived supporting information, labeled "Calculated". It never sets the domain state.

## Consequences

- A domain state is always attributable to a person, a date and a reason.
