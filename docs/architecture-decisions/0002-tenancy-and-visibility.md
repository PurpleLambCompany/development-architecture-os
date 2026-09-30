# ADR-0002: Tenancy model and engagement visibility

**Status:** Accepted (Phase 1 decisions 2, 3 and 7, approved 2026-09-29). The one-organization-per-person rule is superseded by [ADR-0007](0007-multiple-organization-memberships.md); everything else stands.

## Context

DSA OS holds confidential strategy and financial data for multiple client organizations. The spec requires tenant isolation by organization and engagement (§25, §27) and least privilege.

## Decision

- **Organizations** are either the single `tplco` organization or `client` organizations. `licensed_practice` is reserved for certification (Phase 9) and rejected for now.
- ~~**One organization per person** in Phase 1~~ (superseded by ADR-0007) (`organization_members.user_id` is unique). A person's side (internal or client) follows from their organization.
- **Internal visibility:** System Administrators and Principal Architects see every engagement. Architects, Researchers, Project Administrators and Finance Administrators see only engagements they are assigned to.
- **Client visibility:** every client user, including Executive Sponsors, must be explicitly assigned to an engagement. A client assignment is honored only when the engagement belongs to the user's own organization, so a mistaken assignment can never expose another tenant.
- An engagement cannot move between organizations after creation.
- Suspending a membership, an organization, or a profile removes access immediately.

## Consequences

- Adding a new client stakeholder requires two steps: invite to the organization, then assign to engagements. This is deliberate.
- Supporting consultants who belong to several organizations, or licensed practices, will require relaxing the one-organization constraint in a later migration.
