# Row Level Security and role matrix (Phase 1)

Every table has RLS enabled. Policies call `SECURITY DEFINER` helpers in the unexposed `private` schema (ADR-0003). `anon` has no privileges on any table. Tests: `supabase/tests/01_phase1_rls.test.sql` (`pnpm db:test`).

## Who can see what

| Table                  | System Admin / Principal Architect | Other internal roles    | Client users                         |
| ---------------------- | ---------------------------------- | ----------------------- | ------------------------------------ |
| `organizations`        | all                                | all                     | own organization                     |
| `organization_members` | all                                | all                     | own organization                     |
| `profiles`             | all                                | all                     | self + people on a shared engagement |
| `engagements`          | all                                | assigned only           | assigned **and** in own organization |
| `engagement_members`   | for visible engagements            | for visible engagements | for visible engagements              |
| `method_assets`        | yes                                | yes                     | **never**                            |
| `activity_log`         | yes                                | no                      | no                                   |

"Active" means the profile, the organization membership and the organization are all `active`. Invited or suspended members see nothing.

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
| Write activity log                                | nobody (triggers only)                                                              |

Architects, Researchers and Finance Administrators have read access to assigned engagements in Phase 1. Their write permissions arrive with the tables they own (finance in Phase 2; architecture and intelligence in Phases 3–4). Client users have no write access in Phase 1 except their own name.

## Spec §30 acceptance checks and where they are proven

| Check                                          | pgTAP                              | Browser (manual/e2e)                 |
| ---------------------------------------------- | ---------------------------------- | ------------------------------------ |
| Internal user can create a client organization | ✓                                  | ✓                                    |
| Internal user can create an engagement         | ✓                                  | ✓                                    |
| Users can be assigned to an engagement         | ✓                                  | ✓                                    |
| A client user only sees their own engagement   | ✓                                  | ✓                                    |
| A client user cannot access Method/IP          | ✓ (`method_assets` returns 0 rows) | ✓ (`/internal/*` redirects)          |
| Repository isolated from Peephole              | n/a                                | separate repo, env, Supabase project |
