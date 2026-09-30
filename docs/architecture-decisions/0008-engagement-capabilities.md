# ADR-0008: Engagement permissions are evaluated through capabilities

**Status:** Accepted (Kerrick Jordan, PR #1 review, 2026-09-29). Required before any financial data exists.

## Context

Phase 1 decided billing visibility by role name (`executive_sponsor` or `client_finance`). Real engagements need project authority separated from financial authority, and exceptions for individual people (a Project Lead the sponsor authorizes to see billing; a sponsor who delegates payments to their finance team). Hard-coding role names would spread these rules through every future policy.

## Decision

Six engagement capabilities, stored as the enum `public.engagement_capability`:

| Capability                       | Meaning (enforced as the relevant tables arrive)           |
| -------------------------------- | ---------------------------------------------------------- |
| `view_financials`                | see contract, milestones, invoices and balances (Phase 2)  |
| `approve_change_orders`          | approve change orders on the client side (Phase 2)         |
| `pay_invoices`                   | pay invoices on the client side (Phase 2)                  |
| `approve_architecture`           | approve architecture decisions and deliverables (Phase 3+) |
| `manage_client_team`             | manage the client team on the engagement                   |
| `view_confidential_deliverables` | see deliverables marked confidential (Phase 3+)            |

- **Roles supply defaults** in `public.role_capability_defaults`. This is the role definition; it changes only by migration.
- **Overrides** in `public.engagement_member_capability_overrides` grant or revoke one capability for one engagement member. An override never changes the role or any other engagement.
- **Effective capability** = the member's override if present, otherwise the role default, evaluated by `private.has_engagement_capability(engagement, capability)` for the caller's active assignment. The same membership validity rules as project access apply (active profile, membership, organization and assignment; client assignments only in the engagement's own organization).
- **Financial authority is separate from project access.** System Administrators and Finance Administrators hold portfolio-wide `view_financials` without assignment. This passes `private.can_view_engagement_financials()` only; it grants no access to the engagement row, team, or any project content. Project access likewise grants no financial visibility.
- **Who may change capabilities:** financial capabilities (`view_financials`, `approve_change_orders`, `pay_invoices`) only by System Administrators, Principal Architects, or a Finance Administrator assigned to the engagement; other capabilities by anyone who can manage the engagement. Nobody but a System Administrator can change their own capabilities. `pay_invoices` and `approve_change_orders` are client-side only and cannot be granted to internal members.
- Client defaults follow the decision recorded in the Phase 1 review: Executive Sponsor holds all six; Client Finance holds `view_financials` and `pay_invoices`; Client Project Lead holds `approve_architecture`, `manage_client_team` and `view_confidential_deliverables` but no financial visibility; Client Contributor and Client Viewer hold none.

## Consequences

- Phase 2 financial tables use `private.can_view_engagement_financials(engagement_id)` (and `has_engagement_capability` for approvals and payments) in their RLS policies. No policy will test role names for financial access.
- The UI asks the database for the caller's capabilities (`public.my_engagement_capabilities`), so it never decides visibility from role names alone.
- `src/domain/capabilities/catalog.ts` mirrors the defaults for display; a unit test fails if it drifts from the migration.
- `manage_client_team` is recorded now but client users still have no write access in Phase 1; it will govern client-side team management when that feature exists. Internal team management continues to follow `can_manage_engagement`.
- Every override change is written to the activity log with before/after values and a free-text reason.
