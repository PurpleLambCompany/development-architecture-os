# ADR-0014: Publication is the client visibility boundary; clients read immutable snapshots

**Status:** Accepted (Phase 3 proposal §8.3 and §15.2, decision 16.1.2, approved 2026-09-30)

## Context

Architects keep editing after a version has been shown to a client. The client record of "what we saw" and "what we approved" must never move under them, and approval must not decide visibility.

## Decision

- Live architecture tables (elements, subtypes, statements, relationships, evidence, lineage) have **no client select policy**. Clients never read a working copy, even of a client-visible element.
- `publish_element_version` writes an append-only `element_versions` row with two snapshots: `snapshot` (full, internal) and `client_snapshot` (client-visible statements and evidence only, without internal fields).
- Clients read `client_snapshot` through security-invoker read models, and only when the element is `client_visibility = 'client'`, not retired, and the caller holds `view_architecture`. The `snapshot` column is not granted to `authenticated` at all; internal readers use a definer read model.
- Approval plays no part in visibility. A published version is visible whether or not it is approved.
- Published relationships are client-visible only when published, client-visible, active, and both ends are visible.

## Consequences

- The client portal can show "Published v3 · v2 approved" truthfully, because v2's snapshot never changes.
- Hiding content from clients is a database property, not a UI filter.
