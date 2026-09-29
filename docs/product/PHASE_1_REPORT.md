# Phase 1 — Foundation: End-of-Phase Report

**Date:** 2026-09-29 · **Branch:** `phase-1-foundation` · **Proposal:** [PHASE_1_PROPOSAL.md](PHASE_1_PROPOSAL.md) (approved with all defaults)

## What was built

- Next.js 16 + TypeScript strict + Tailwind v4 application with a restrained institutional design system (warm paper canvas, serif headings, hairline rules, one accent).
- Supabase integration with cookie-based sessions (`@supabase/ssr`) and a Next.js 16 Proxy that refreshes sessions and redirects signed-out visitors.
- Invite-only authentication: email + password, magic link, server-verified invitation links, set-password flow, sign-out.
- User profiles (auto-created from auth), organizations, organization membership, and the 11-role model (6 internal, 5 client).
- Engagement CRUD (create, view, edit, archive by status) and engagement team management (assign, remove).
- Internal dashboard shell with spec §28 navigation (later-phase areas shown muted), organizations directory with invitations and suspension, engagement lists by Active / Upcoming / Completed, settings.
- Client dashboard shell answering the spec §7 questions in placeholder form: snapshot, four-domain architecture progress, decisions/actions, deliverables, financial snapshot (Executive Sponsor and Client Finance only), team.
- Initial RLS on every table, integrity triggers, append-only activity log, `method_assets` stub.
- Seed/demo data, `.env.example`, README, six ADRs, database reference docs.

## Schema changes

One migration: `supabase/migrations/20260929230000_phase1_foundation.sql`. Tables: `profiles`, `organizations`, `organization_members`, `engagements`, `engagement_members`, `method_assets`, `activity_log`. Eight enums. Details: [docs/database/schema.md](../database/schema.md).

Deviations from spec §26, each recorded in an ADR: profile id is the auth id (ADR-0004); no contract values on `engagements` (ADR-0006); `permissions_override_json` deferred; one organization per person (ADR-0002).

## Security / RLS

- RLS on all tables; `anon` has no table privileges; no deletes of organizations or engagements.
- SECURITY DEFINER helpers in an unexposed `private` schema; roles read from tables on every request, so suspension is immediate.
- Client users: own organization only, assigned engagements only, never `method_assets` or `activity_log`.
- Only System Administrators manage TPLCo staff (no self-escalation); only admins/principals archive.
- Service-role key used solely to create invited auth accounts; memberships are written under the inviter's session so RLS decides.
- Full matrix: [docs/database/rls.md](../database/rls.md).

## Tests and checks performed

| Check                                                                     | Result     |
| ------------------------------------------------------------------------- | ---------- |
| pgTAP RLS suite (`pnpm db:test`)                                          | 48/48 pass |
| Vitest unit tests (`pnpm test`)                                           | 12/12 pass |
| ESLint, `tsc --noEmit` (strict), Prettier                                 | clean      |
| `pnpm build`                                                              | succeeds   |
| End-to-end browser run against local Supabase (Playwright, not committed) | 25/25 pass |

The browser run covered: sign-in and wrong password; principal creates a client organization, invites a client user, creates an engagement (auto-assigned), assigns the invited user; the invited user accepts the emailed link, sets a password, sees nothing until assigned, then sees only their engagement; client users are refused `/internal` and other tenants' engagements (404); a contributor cannot open an unassigned engagement in their own organization; billing area shown only to sponsor/finance; a researcher sees only assigned engagements and cannot create; a project administrator is not offered Archive.

Spec §30 confirmations: an internal user can create a client organization ✓, create an engagement ✓, assign users ✓; a client user only sees their own engagement ✓; a client user cannot access Method/IP ✓; the repository is isolated from Peephole ✓ (separate repo, dependencies, env and Supabase project; nothing referenced).

## Known limitations

- No CI workflow yet; checks were run locally.
- Invitations can't be resent or revoked from the UI yet (suspend works); removing a person's auth account requires the dashboard.
- Mobile navigation in the internal workspace is a compact link row, not a full menu.
- Engagement `current_phase` is free text until Phase 3 introduces structured architecture status.
- Activity log is visible on the dashboard only (no dedicated audit view).
- Hosted Supabase and Vercel projects are not yet created.
- Local e2e used Supabase without Studio/analytics containers; no effect on the app.

## Unresolved questions

1. Should Finance Administrators see all engagements' financials in Phase 2 without being assigned (portfolio finance view), or stay assigned-only?
2. Which client roles see billing by default in Phase 2: Executive Sponsor and Client Finance only (current placeholder), or also Client Project Lead?
3. Domain and email sender for production (for Supabase SMTP and the site URL).

## Recommended next step

Phase 2 — Commercial Engagement System: `contracts`, `payment_milestones`, `invoices`, `payments`, `change_orders` with a `can_view_engagement_financials()` RLS helper; server-side financial calculations (revised contract value, invoiced, paid, due, overdue, remaining); internal Finance screens and the client Billing view with the milestone journey from spec §10; Stripe-ready columns without card data. Before that, add a GitHub Actions workflow running `pnpm check`, `pnpm build` and `pnpm db:test`.
