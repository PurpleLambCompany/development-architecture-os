# Phase 1 — Foundation: End-of-Phase Report

**Date:** 2026-09-29 · **Branch:** `phase-1-foundation` · **Proposal:** [PHASE_1_PROPOSAL.md](PHASE_1_PROPOSAL.md) (approved with all defaults) · **Revised:** 2026-09-29 after the PR #1 review (see [Pre-merge revision](#pre-merge-revision))

## What was built

- Next.js 16 + TypeScript strict + Tailwind v4 application with a restrained institutional design system (warm paper canvas, serif headings, hairline rules, one accent).
- Supabase integration with cookie-based sessions (`@supabase/ssr`) and a Next.js 16 Proxy that refreshes sessions and redirects signed-out visitors.
- Invite-only authentication: email + password, magic link, server-verified invitation links, set-password flow, sign-out.
- User profiles (auto-created from auth), organizations, organization membership, and the 11-role model (6 internal, 5 client).
- Engagement CRUD (create, view, edit, archive by status) and engagement team management (assign, remove).
- Internal dashboard shell with spec §28 navigation (later-phase areas shown muted), organizations directory with invitations and suspension, engagement lists by Active / Upcoming / Completed, settings.
- Client dashboard shell answering the spec §7 questions in placeholder form: snapshot, four-domain architecture progress, decisions/actions, deliverables, financial snapshot (shown only with the `view_financials` capability), team.
- Initial RLS on every table, integrity triggers, append-only activity log, `method_assets` stub.
- Seed/demo data, `.env.example`, README, ADRs 0001–0009, database reference docs.
- Multiple organization memberships per person, an engagement capability system, GitHub Actions CI, and a temporary DSA icon (pre-merge revision, below).

## Schema changes

Two migrations: `20260929230000_phase1_foundation.sql` and `20260929233000_engagement_capabilities.sql`. Tables: `profiles`, `organizations`, `organization_members`, `engagements`, `engagement_members`, `role_capability_defaults`, `engagement_member_capability_overrides`, `method_assets`, `activity_log`. Nine enums. Details: [docs/database/schema.md](../database/schema.md).

Deviations from spec §26, each recorded in an ADR: profile id is the auth id (ADR-0004); no contract values on `engagements` (ADR-0006); `permissions_override_json` replaced by a typed capability override table (ADR-0008).

## Security / RLS

- RLS on all tables; `anon` has no table privileges; no deletes of organizations or engagements.
- SECURITY DEFINER helpers in an unexposed `private` schema; roles read from tables on every request, so suspension is immediate.
- Client users: organizations they actively belong to, assigned engagements in those organizations only, never `method_assets` or `activity_log`.
- Engagement permissions through capabilities; financial visibility separate from project access (ADR-0008).
- Only System Administrators manage TPLCo staff (no self-escalation); only admins/principals archive.
- Service-role key used solely to create invited auth accounts; memberships are written under the inviter's session so RLS decides.
- Full matrix: [docs/database/rls.md](../database/rls.md).

## Tests and checks performed

| Check                                                                     | Result                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| pgTAP (`pnpm db:test`)                                                    | 101/101 pass (RLS 48, multi-organization 19, capabilities 34) |
| Vitest unit tests (`pnpm test`)                                           | 21/21 pass                                                    |
| ESLint, `tsc --noEmit` (strict), Prettier                                 | clean                                                         |
| `pnpm build`                                                              | succeeds                                                      |
| Generated types match the schema                                          | yes                                                           |
| End-to-end browser run against local Supabase (Playwright, not committed) | 41/41 pass                                                    |
| GitHub Actions CI                                                         | see the pull request checks                                   |

The browser run covered: sign-in and wrong password; principal creates a client organization, invites a client user, creates an engagement (auto-assigned), assigns the invited user; the invited user accepts the emailed link, sets a password, sees nothing until assigned, then sees only their engagement; client users are refused `/internal` and other tenants' engagements (404); a contributor cannot open an unassigned engagement in their own organization; billing area shown only to sponsor/finance; a researcher sees only assigned engagements and cannot create; a project administrator is not offered Archive. Added in the revision: an existing account is added to a second organization instead of re-invited; a person in two organizations sees one engagement in each, labelled by organization, and nothing else; a Project Lead sees the financial area only with an override; revoking a sponsor's `view_financials` on one engagement hides it there but not on their other engagement; a Finance Administrator cannot open an unassigned engagement; a Project Administrator is offered project capability changes but not financial ones; the new icon is served.

Spec §30 confirmations: an internal user can create a client organization ✓, create an engagement ✓, assign users ✓; a client user only sees their own engagement ✓; a client user cannot access Method/IP ✓; the repository is isolated from Peephole ✓ (separate repo, dependencies, env and Supabase project; nothing referenced).

## Known limitations

- CI runs on every pull request, but merging is only blocked once App and Database are made required checks in branch protection (a repository setting).
- Adding an existing account to another organization sends no notification email.
- `manage_client_team`, `approve_architecture`, `approve_change_orders`, `pay_invoices` and `view_confidential_deliverables` are recorded and enforced by helper functions, but the features they govern arrive in later phases.
- The client portal has no organization switcher; a person in several organizations sees all their engagements in one list, each labelled with its organization.
- Invitations can't be resent or revoked from the UI yet (suspend works); removing a person's auth account requires the dashboard.
- Mobile navigation in the internal workspace is a compact link row, not a full menu.
- Engagement `current_phase` is free text until Phase 3 introduces structured architecture status.
- Activity log is visible on the dashboard only (no dedicated audit view).
- Hosted Supabase and Vercel projects are not yet created.
- Local e2e used Supabase without Studio/analytics containers; no effect on the app.

## Unresolved questions

1. The production domain and email sender are still to be chosen. They are configuration only (`NEXT_PUBLIC_SITE_URL`, `SUPABASE_AUTH_SMTP_*`); nothing in code needs to change.
2. Should an Executive Sponsor be able to grant or revoke client capabilities themselves (for example authorize their Project Lead to see billing), or should that remain a TPLCo action? Currently only TPLCo can.

Questions 1 and 2 from the first report were answered in the review: Finance Administrators have portfolio-wide financial visibility without project access, and only Executive Sponsor and Client Finance see billing by default.

## Recommended next step

Phase 2 — Commercial Engagement System: `contracts`, `payment_milestones`, `invoices`, `payments`, `change_orders` using the existing `private.can_view_engagement_financials()` and `has_engagement_capability()` helpers; server-side financial calculations (revised contract value, invoiced, paid, due, overdue, remaining); internal Finance screens and the client Billing view with the milestone journey from spec §10; Stripe-ready columns without card data.

## Pre-merge revision

Requested in the PR #1 review on 2026-09-29.

### What changed

1. **Multiple organizations per person** (ADR-0007, supersedes that part of ADR-0002). `organization_members` is unique on (organization, person) instead of person. `private.current_client_organization_id()` was replaced by `private.is_active_org_member(organization)`, so every check is per organization. Inviting someone who already has an account adds the membership instead of failing. The app reads all memberships; client users see their role and organization per engagement.
2. **Engagement capabilities** (ADR-0008). Six capabilities, role defaults in `role_capability_defaults`, per-member grant/revoke overrides that never change the role, database helpers for RLS, a capability matrix on the internal engagement page, and the client financial area now driven by `view_financials` rather than role names. System and Finance Administrators have portfolio-wide `view_financials` without project access.
3. **CI** in `.github/workflows/ci.yml`: App job (`pnpm check`, `pnpm test`, `pnpm build`) and Database job (Supabase in the runner, `pnpm db:test`, generated-types drift check).
4. **Icon**: `src/app/icon.svg`, a temporary neutral four-square mark in the accent colour; the default Next.js favicon is removed.
5. **Domain and email as configuration**: SMTP host, user, password, sender email and sender name documented as `SUPABASE_AUTH_SMTP_*` in `.env.example` and referenced with `env()` in `supabase/config.toml`; the site URL stays `NEXT_PUBLIC_SITE_URL`. Local redirect allow-list corrected to `/auth/confirm`.
6. **Provenance ADR** (ADR-0009): the eight provenance types future architecture objects must carry. Nothing built.

### Files changed

| Area           | Files                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database       | `supabase/migrations/20260929230000_phase1_foundation.sql` (amended; never applied outside local), `supabase/migrations/20260929233000_engagement_capabilities.sql` (new), `supabase/seed.sql`, `supabase/config.toml`, `src/types/database.ts` (regenerated)                                                                                                  |
| Database tests | `supabase/tests/02_multi_organization.test.sql`, `supabase/tests/03_engagement_capabilities.test.sql` (new)                                                                                                                                                                                                                                                    |
| Domain         | `src/domain/capabilities/{catalog,catalog.test,schemas,queries,actions}.ts` (new), `src/domain/memberships/{actions,queries}.ts`                                                                                                                                                                                                                               |
| App            | `src/lib/auth/viewer.ts`, `src/app/(client)/portal/{layout,page,[slug]/page}.tsx`, `src/app/(internal)/internal/engagements/[slug]/page.tsx`, `src/components/engagements/capability-matrix.tsx` (new), `src/components/organizations/invite-member-form.tsx`, `src/components/shell/user-menu.tsx`, `src/app/icon.svg` (new), `src/app/favicon.ico` (removed) |
| CI and config  | `.github/workflows/ci.yml` (new), `.env.example`                                                                                                                                                                                                                                                                                                               |
| Docs           | ADR-0007, ADR-0008, ADR-0009 (new), ADR-0002 and ADR index, `docs/database/schema.md`, `docs/database/rls.md`, `README.md`, this report                                                                                                                                                                                                                        |

### Schema changes

- `organization_members`: unique (`user_id`) → unique (`organization_id`, `user_id`); index on `user_id`.
- New enum `engagement_capability`.
- New tables `role_capability_defaults` (reference data) and `engagement_member_capability_overrides` (audited).
- New functions: `private.is_active_org_member`, `private.member_has_capability`, `private.has_portfolio_financial_access`, `private.has_engagement_capability`, `private.can_view_engagement_financials`, `private.can_manage_capability`, `public.my_engagement_capabilities`, `public.capability_side`, `public.is_financial_capability`. Removed: `private.current_client_organization_id`.
- Seed: `advisor@consulting.test` in Meridian and Harbor; a `view_financials` override for `lead@meridian.test` on the Regional Innovation District.

### New and updated tests

- `02_multi_organization.test.sql` (19): one person in two client organizations sees each organization and engagement only through that organization's membership and assignment, with a different role in each; no TPLCo or Method/IP leakage; members of one organization cannot see the other; a duplicate membership is rejected; membership without assignment shows nothing; suspending one membership removes that organization only.
- `03_engagement_capabilities.test.sql` (34): defaults for every client role; overrides grant and revoke for one member on one engagement only and never change the role; Finance Administrator has financial visibility on an unassigned engagement but cannot read the engagement or its team; Researcher has no financial visibility; a Project Administrator cannot grant financial capabilities; nobody changes their own capabilities; client-only capabilities are refused for internal members; clients cannot write overrides or role defaults; members see only their own overrides; suspension removes capabilities.
- `catalog.test.ts` (9 Vitest): TypeScript defaults match the migration, client financial defaults, override behaviour, and who may change capabilities.
- `01_phase1_rls.test.sql` (48) unchanged and passing against the new schema.
