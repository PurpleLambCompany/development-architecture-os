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

## Amendment (2026-09-30): who manages architecture authority

Overrides of `edit_architecture` and `publish_architecture` are granted or revoked only by Principal Architects, and never for themselves. System Administrators cannot grant either to themselves or to anyone else through their administration authority, and Project Administrators cannot grant or revoke either. Role defaults, the override model and the rules for every other capability are unchanged. Enforced by `private.can_manage_capability` (migration `20261001000300_architecture_governance.sql`) and tested in `11_architecture_governance`.

Architects and Researchers read architecture activity through `public.architecture_activity()`, a curated read model limited to architecture events for holders of `edit_architecture` on the engagement. The Phase 1 `activity_log` policy is unchanged.
