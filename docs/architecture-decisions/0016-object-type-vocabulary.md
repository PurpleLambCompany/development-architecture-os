# ADR-0016: Object type vocabulary; one domain per core type; validated jsonb attributes

**Status:** Accepted (Phase 3 proposal §4 and §15.4, vocabulary approved 2026-09-30)

## Context

Object type keys become database keys, reference prefixes and the software vocabulary of the Development Architecture Method.

## Decision

- 27 core object types in `architecture_object_types` (Knowledge 8, Capability 5, Strategic Model 5, Application 9), each fixed to exactly one domain. `architecture_objects` references `(domain, object_type)` together, so an object's domain always matches its type.
- Object types and relationship types are migration-managed reference tables, not enums, so the Method Library can govern them later.
- Type-specific attributes are a jsonb object (≤ 32 KB) carrying `schema_version`. The database checks shape and size; the domain layer validates fields with the Zod schema for that type and version (`src/domain/architecture/object-types.ts`).
- Maturity (how well the architecture of an object is defined) is separate from capability readiness (whether the client has the capability), which is only a Capability attribute.

## Consequences

- Labels can be reworded without a migration; keys cannot. Renaming or removing an attribute needs a migration that rewrites stored rows.
