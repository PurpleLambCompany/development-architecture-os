# Row Level Security, roles and capabilities (Phase 1)

> Phase 2 financial access rules are documented in [finance.md](finance.md), Phase 3 architecture access rules in [architecture.md](architecture.md), and Phase 4 Project Intelligence, client actions and contributor areas in [intelligence.md](intelligence.md).

Every table has RLS enabled. Policies call `SECURITY DEFINER` helpers in the unexposed `private` schema (ADR-0003). `anon` has no privileges on any table. Tests (`pnpm db:test`, also run in CI): `01_phase1_rls.test.sql`, `02_multi_organization.test.sql`, `03_engagement_capabilities.test.sql` in `supabase/tests/`.

## Who can see what

| Table                                    | System Admin / Principal Architect | Other internal roles    | Client users                                                        |
| ---------------------------------------- | ---------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| `organizations`                          | all                                | all                     | organizations they are an active member of                          |
| `organization_members`                   | all                                | all                     | members of organizations they belong to                             |
| `profiles`                               | all                                | all                     | self + people on a shared engagement                                |
| `engagements`                            | all                                | assigned only           | assigned **and** an active member of that engagement's organization |
| `role_capability_defaults`               | all                                | all                     | all (reference data)                                                |
| `engagement_member_capability_overrides` | for visible engagements            | for visible engagements | their own only                                                      |
| `engagement_members`                     | for visible engagements            | for visible engagements | for visible engagements                                             |
| `method_assets`                          | yes                                | yes                     | **never**                                                           |
| `activity_log`                           | yes                                | no                      | no                                                                  |

"Active" means the profile, the organization membership and the organization are all `active`. Invited or suspended members see nothing.

A person may belong to several organizations (ADR-0007). Every check is made per organization: an assignment to a client engagement counts only while the person has an active membership in that engagement's organization, and suspending one membership affects that organization only.

Finance Administrators see only engagements they are assigned to, as above, even though they hold portfolio-wide financial visibility (below).

## Engagement capabilities (ADR-0008)

Permissions on an engagement are evaluated through capabilities. A member's effective capability is their override for that engagement if one exists, otherwise their role default.

| Role                  | view_financials | approve_change_orders | pay_invoices | approve_architecture | manage_client_team | view_confidential_deliverables |
| --------------------- | :-------------: | :-------------------: | :----------: | :------------------: | :----------------: | :----------------------------: |
| System Administrator  |  ✓ (portfolio)  |          n/a          |     n/a      |          ✓           |         ✓          |               ✓                |
| Principal Architect   |        ✓        |          n/a          |     n/a      |          ✓           |         ✓          |               ✓                |
| Architect             |                 |          n/a          |     n/a      |                      |                    |               ✓                |
| Researcher            |                 |          n/a          |     n/a      |                      |                    |               ✓                |
| Project Administrator |                 |          n/a          |     n/a      |                      |         ✓          |               ✓                |
| Finance Administrator |  ✓ (portfolio)  |          n/a          |     n/a      |                      |                    |                                |
| Executive Sponsor     |        ✓        |           ✓           |      ✓       |          ✓           |         ✓          |               ✓                |
| Client Project Lead   |                 |                       |              |          ✓           |         ✓          |               ✓                |
| Client Finance        |        ✓        |                       |      ✓       |                      |                    |                                |
| Client Contributor    |                 |                       |              |                      |                    |                                |
| Client Viewer         |                 |                       |              |                      |                    |                                |

"n/a": client-side only; cannot be granted to internal members. "Portfolio": System and Finance Administrators hold `view_financials` on every engagement **without assignment**. That passes the financial check (`private.can_view_engagement_financials`) only; it does not make the engagement, its team or any project content visible. Everyone else holds a capability only through an active assignment.

| Helper                                             | Purpose                                         |
| -------------------------------------------------- | ----------------------------------------------- |
| `private.has_engagement_capability(engagement, c)` | caller holds capability `c` on the engagement   |
| `private.can_view_engagement_financials(e)`        | the check Phase 2 financial tables will use     |
| `private.can_manage_capability(e, member, c)`      | caller may grant or revoke `c` for that member  |
| `public.my_engagement_capabilities(e)`             | the caller's effective capabilities, for the UI |

Changing capabilities (insert/update/delete of overrides):

| Capability                                                                     | Who may grant or revoke                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `view_financials`, `approve_change_orders`, `pay_invoices`                     | System Admin, Principal Architect, Finance Administrator **assigned** to the engagement |
| `approve_architecture`, `manage_client_team`, `view_confidential_deliverables` | whoever can manage the engagement (see below)                                           |
| `view_architecture` (Phase 3)                                                  | whoever can manage the engagement (see below)                                           |
| `edit_architecture`, `publish_architecture` (Phase 3)                          | Principal Architects only, never for themselves (not System or Project Administrators)  |

Nobody except a System Administrator can change their own capabilities, and nobody at all can change their own architecture authority. Role defaults cannot be changed through the API.

## Who can change what

| Action                                            | Allowed                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Create / edit client organization                 | System Admin, Principal Architect, Project Administrator                            |
| Edit TPLCo organization                           | System Admin                                                                        |
| Add / change / remove client organization members | System Admin, Principal Architect, Project Administrator                            |
| Add / change / remove TPLCo staff                 | System Admin only                                                                   |
| Create engagement                                 | System Admin, Principal Architect, Project Administrator (creator is auto-assigned) |
| Edit engagement, manage its team                  | System Admin, Principal Architect, Project Administrator **assigned** to it         |
| Archive engagement                                | System Admin, Principal Architect                                                   |
| Delete organization or engagement                 | nobody (archive instead)                                                            |
| Edit own first/last name                          | everyone                                                                            |
| Change profile status or email                    | System Admin                                                                        |
| Manage method assets                              | System Admin, Principal Architect                                                   |
| Grant / revoke engagement capabilities            | see the capability table above                                                      |
| Write activity log                                | nobody (triggers only)                                                              |

Architects, Researchers and Finance Administrators have read access to assigned engagements in Phase 1. Their write permissions arrive with the tables they own (finance in Phase 2; architecture and intelligence in Phases 3–4; reviews, deliverables and implementation in Phase 5). Client users have no write access in Phase 1 except their own name.

## Spec §30 acceptance checks and where they are proven

| Check                                          | pgTAP                              | Browser (manual/e2e)                 |
| ---------------------------------------------- | ---------------------------------- | ------------------------------------ |
| Internal user can create a client organization | ✓                                  | ✓                                    |
| Internal user can create an engagement         | ✓                                  | ✓                                    |
| Users can be assigned to an engagement         | ✓                                  | ✓                                    |
| A client user only sees their own engagement   | ✓                                  | ✓                                    |
| A client user cannot access Method/IP          | ✓ (`method_assets` returns 0 rows) | ✓ (`/internal/*` redirects)          |
| Repository isolated from Peephole              | n/a                                | separate repo, env, Supabase project |
