# ADR-0003: Authorization enforced in the database via RLS helpers

**Status:** Accepted (Phase 1)

## Context

The spec requires that authorization never depend on hidden UI (§25) and be enforced at the database layer wherever feasible (§27).

## Decision

- **RLS is enabled on every table.** Anything not explicitly granted is denied. The `anon` role has no table privileges at all.
- Policies call a small set of `SECURITY DEFINER` functions in a `private` schema that PostgREST does not expose: `current_internal_role()`, `is_internal()`, `has_internal_role()`, `current_client_organization_id()`, `engagement_role()`, `can_access_engagement()`, `can_manage_engagement()`, `can_manage_client_directory()`, `shares_engagement_with()`. Each has a fixed empty `search_path`.
- **Roles are read from the membership tables on every request**, not from JWT custom claims. Revocation is immediate and there is no token-refresh window.
- Integrity rules that RLS cannot express are **triggers**: role side must match organization type; client engagement members must belong to the engagement's organization; only administrators and principals may archive; only System Administrators may change profile status/email; `created_by` is always the real caller.
- The engagement creator is assigned by an `AFTER INSERT` trigger. The app therefore inserts engagements **without `RETURNING`** and reads them back, because the new row is not yet visible to a Project Administrator at `RETURNING` time.
- Organizations and engagements cannot be deleted through the API (no `DELETE` privilege); they are archived.
- Every change to organizations, memberships, engagements and engagement teams is written to an append-only `activity_log` by trigger.
- `src/domain/roles/roles.ts` mirrors these rules only so the UI offers actions that will succeed. It is covered by unit tests; the database remains the authority and is covered by pgTAP tests.

## Consequences

- Each new table in later phases must enable RLS and reuse the helpers (for example, Phase 2 finance tables will add a `can_view_engagement_financials()` helper).
- Helper functions run per row; if engagement volumes grow large, the helpers may need caching via `(select ...)` wrapping or materialized membership views.

**Amended (V1-A Increment 2):** TPLCo staff, the practice organization and profile status are governed by the practice capability `administer_practice` rather than the System Administrator role, and only a Principal Architect creates architectural authority. See [ADR-0074](0074-practice-administration-and-architectural-authority.md).
