# ADR-0024: New architecture capabilities

**Status:** Accepted (Phase 3 proposal §8.1 and §15.12, decisions 16.1.3 and 16.2.1)

## Context

Postgres enum values cannot be removed, and the capability defaults decide who may shape a client's architecture.

## Decision

- Add `edit_architecture` (internal; Principal Architect, Architect, Researcher), `publish_architecture` (internal; Principal Architect, Architect) and `view_architecture` (client; Executive Sponsor, Client Project Lead, Client Contributor, Client Viewer).
- System Administrators hold neither edit nor publish by default; TPLCo can grant either by override on one engagement. Researchers draft but do not publish. Project and Finance Administrators neither edit nor publish.
- Client Finance holds no architecture capability; it sees published domain states only. `approve_architecture` responses also require `view_architecture`.
- Internal reading of the working architecture follows engagement access (`can_access_engagement`). Every write check uses capabilities, never role names.

## Consequences

- The values are permanent. Changing defaults later is a migration on `role_capability_defaults`.
