# ADR-0007: A person may belong to several organizations

**Status:** Accepted (Kerrick Jordan, PR #1 review, 2026-09-29). Supersedes the one-organization rule in [ADR-0002](0002-tenancy-and-visibility.md).

## Context

Phase 1 limited each person to one organization (`organization_members.user_id` unique). That blocks real cases the platform must support: licensed Development Architects and consultants who work across several client organizations, advisors engaged by more than one client, and later licensed practices (spec Phase 9).

## Decision

- `organization_members` is unique on `(organization_id, user_id)`. A person may hold one membership per organization, each with its own organization-level role and status.
- Every access check is evaluated **per organization**: `private.is_active_org_member(organization_id)` replaces the former "current client organization" helper. A client-side engagement assignment is honored only when the person has an active membership in **that engagement's** organization.
- A person's side in the app is internal if they hold an active TPLCo membership, otherwise client. A client user's role is shown per engagement, not globally.
- Adding someone who already has an account to another organization creates the membership directly instead of sending a second invitation. It is active at once if they have already accepted an invitation elsewhere; otherwise it activates with their other memberships when they accept.
- Suspending one membership removes access to that organization's engagements only; other memberships are unaffected.

## Consequences

- Cross-tenant isolation no longer depends on a person having one organization. It is proven in `supabase/tests/02_multi_organization.test.sql`: a person in two client organizations sees each organization's data only through the membership and assignment for that organization, other members of either organization cannot see the other organization, and a suspension in one organization does not leak or remove the other.
- Assigning someone who belongs to two client organizations to an engagement still requires their membership in that engagement's organization (trigger `validate_engagement_member`).
- A TPLCo staff member who also holds a client membership is treated as internal in the app. Internal roles already see more than client roles, so this cannot widen access; the combination is not expected in practice.
- Organization-scoped context switching in the client UI (choosing "which organization am I working in") is not needed yet: the portal lists engagements across organizations with the organization named on each.
