# ADR-0022: Method lineage lives in an internal-only table

**Status:** Accepted (Phase 3 proposal §6.9 and §15.10)

## Context

Clients may see an object derived from the Development Architecture Method, but must never see the Method asset it came from (CLAUDE.md security rules).

## Decision

- `element_method_lineage` (element, method asset, method version, note) has a select policy for internal engagement readers only and no client policy.
- Snapshots never include lineage; the client snapshot also omits internal-only fields.
- Provenance `methodology_derived` is shown to clients as "From the Development Architecture Method" without naming the asset.

## Consequences

- The Method/IP boundary is structural (no row is reachable) rather than a filter that could be forgotten.

Note (Phase 6, 2026-09-30): this decision is unchanged. Lineage is now typed and version-pinned (ADR-0047), and a method's identity reaches clients only through authored approach statements (ADR-0049).
