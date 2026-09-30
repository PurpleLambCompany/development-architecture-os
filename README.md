# Development Systems Architecture OS

The digital operating environment for the **Development Architecture Method™** — The Purple Lamb Company.

DSA OS is a standalone application. It shares no code, database, environment variables or deployment with any other TPLCo product.

- Product specification: [`DSA_OS_MASTER_BUILD_SPEC.md`](DSA_OS_MASTER_BUILD_SPEC.md)
- Instructions for Claude Code: [`CLAUDE.md`](CLAUDE.md)
- Architecture decisions: [`docs/architecture-decisions/`](docs/architecture-decisions/)
- Database schema and access rules: [`docs/database/`](docs/database/)

**Current phase:** Phase 3 — Architecture Core (built; awaiting review before merge). Phase 1 (foundation: auth, organizations, roles, engagements, access control) and Phase 2 (commercial engagement: contracts, change orders, payment plan, invoices, credit notes, payments, allocations, refunds) are merged. Phase 3 adds the four architecture domains, Project Intelligence records, evidence, typed relationships, published versions, client approvals, decisions and baselines, from the approved proposal in [`docs/product/PHASE_3_PROPOSAL.md`](docs/product/PHASE_3_PROPOSAL.md). See the [Phase 3 report](docs/product/PHASE_3_REPORT.md).

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui-style primitives · Supabase (Postgres, Auth, Row Level Security) · Zod · React Hook Form · Vitest · pgTAP. See [ADR-0001](docs/architecture-decisions/0001-application-stack.md).

## Local setup

Prerequisites: Node 22+, pnpm 10+, Docker (for the local Supabase stack).

```bash
pnpm install
pnpm db:start          # starts local Supabase, applies migrations, loads seed data
```

`pnpm db:start` prints the local API URL and keys. Create `.env.local` from the example and paste in the **Publishable key** and **Secret key**:

```bash
cp .env.example .env.local
```

Then:

```bash
pnpm dev               # http://127.0.0.1:3000
```

Use `127.0.0.1` rather than `localhost` locally so session cookies match the URL used in emails.

Emails (invitations, sign-in links) are captured locally by Mailpit at http://127.0.0.1:54324.

### Demo accounts

All demo accounts use the password **`dsa-demo-password`** (local only; the seed refuses to run against a database with real users).

| Email                                                                                                             | Organization                   | Role                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| `sysadmin@tplco.test`                                                                                             | TPLCo                          | System Administrator                                          |
| `principal@tplco.test`                                                                                            | TPLCo                          | Principal Architect                                           |
| `architect@tplco.test`                                                                                            | TPLCo                          | Architect                                                     |
| `researcher@tplco.test`                                                                                           | TPLCo                          | Researcher                                                    |
| `projectadmin@tplco.test`                                                                                         | TPLCo                          | Project Administrator                                         |
| `finance@tplco.test`                                                                                              | TPLCo                          | Finance Administrator                                         |
| `sponsor@meridian.test`                                                                                           | Meridian Development Authority | Executive Sponsor                                             |
| `lead@meridian.test`                                                                                              | Meridian Development Authority | Client Project Lead                                           |
| `finance@meridian.test`                                                                                           | Meridian Development Authority | Client Finance                                                |
| `contributor@meridian.test`                                                                                       | Meridian Development Authority | Client Contributor                                            |
| `viewer@meridian.test`                                                                                            | Meridian Development Authority | Client Viewer                                                 |
| `sponsor@harbor.test`, `lead@harbor.test`, `finance@harbor.test`, `contributor@harbor.test`, `viewer@harbor.test` | Harbor Commons Foundation      | client roles as above                                         |
| `advisor@consulting.test`                                                                                         | Meridian **and** Harbor        | Client Contributor at Meridian, Client Project Lead at Harbor |

Seeded engagements: _Regional Innovation District_ (Meridian, active, full team), _Workforce Capability Program_ (Meridian, proposed, sponsor only on the client side), _Community Expansion Architecture_ (Harbor, active). `finance@harbor.test` and `contributor@harbor.test` are deliberately unassigned, so they see no engagements. `advisor@consulting.test` belongs to two client organizations and is assigned to one engagement in each. `lead@meridian.test` has a `view_financials` override on the Regional Innovation District, so they see its financial area although Project Leads do not by default.

Seeded finances (dates relative to the day the seed is loaded): the Regional Innovation District has an active USD 150,000 contract, an approved change order (CO-1, +12,000, approved in the portal) and one awaiting the sponsor (CO-2, +8,500), five milestones, three issued invoices (one paid, one with a credit note and 10,000 past due, one partly paid with a payment link), a draft invoice scheduled for later, a wire split across two invoices, and a check held as credit on account with part refunded. Harbor has an executed contract with an unpaid installment and a change order approved outside the portal. The Workforce Capability Program has a draft contract (visible only internally).

Seeded architecture: the Regional Innovation District carries a worked architecture across the four domains (28 core objects, from the commercial real estate market through the acquisition capability to the acquisition team and its metric) and seven Project Intelligence records (an assumption, two risks, one spanning two domains and one engagement-wide, a constraint, a dependency, a decision with three options and a recommended option, and a recommendation record). Statements cite four evidence sources. `KNW-008` is published but internal only. `CAP-001` has an approved v2, `STR-001` v1 awaits the sponsor's response, `CAP-007` is an unpublished draft, and two frozen baselines (v1 approved outside the portal) can be compared. Harbor has two objects.

## Scripts

| Command                                  | What it does                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js                                                                        |
| `pnpm lint`                              | ESLint                                                                         |
| `pnpm typecheck`                         | Route type generation + `tsc --noEmit`                                         |
| `pnpm format` / `pnpm format:check`      | Prettier                                                                       |
| `pnpm test`                              | Vitest unit tests (`src/**/*.test.ts`)                                         |
| `pnpm check`                             | lint + typecheck + format check + unit tests                                   |
| `pnpm db:start` / `pnpm db:stop`         | Local Supabase                                                                 |
| `pnpm db:reset`                          | Re-apply all migrations and the seed                                           |
| `pnpm db:test`                           | pgTAP tests for RLS, finance, architecture and concurrency (`supabase/tests/`) |
| `pnpm db:types`                          | Regenerate `src/types/database.ts` from the local schema                       |

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

- **App**: `pnpm check` (lint, typecheck, format, unit tests), `pnpm test`, `pnpm build`.
- **Database**: starts Supabase in the runner, applies all migrations and the seed, runs `pnpm db:test`, and fails if `src/types/database.ts` is out of date.

A failing job marks the pull request as failing. To also block merging, add **App** and **Database** as required status checks in the branch protection rule for `main` (repository Settings → Branches).

## Project structure

```text
src/
  app/
    (public)/login/         sign in (password or emailed link)
    auth/confirm/           verifies invitation / sign-in / recovery links server-side
    account/set-password/   first password after accepting an invitation
    (internal)/internal/    TPLCo workspace: dashboard, organizations, engagements (architecture domains,
                            intelligence, evidence, reviews, baselines), finance, settings
    (client)/portal/        client environment: overview, architecture, decisions, billing, invoices
  components/ui/            design-system primitives
  components/…              feature components (architecture, finance, portal, shell)
  domain/                   business logic, schemas (Zod), queries and server actions — no React
  lib/                      Supabase clients, auth/viewer helpers, env, formatting
  proxy.ts                  session refresh + signed-out redirects (Next.js 16 "Proxy")
supabase/
  migrations/               the only way the schema changes
  seed.sql                  local demo data
  tests/                    pgTAP tests
  templates/                auth email templates
docs/
  product/                  spec companions, phase proposals and reports
  architecture-decisions/   ADRs
  database/                 schema and RLS reference
```

## Security model (summary)

- Row Level Security is enabled on every table; anonymous callers have no access. Authorization lives in the database, not the UI ([ADR-0003](docs/architecture-decisions/0003-authorization-in-the-database.md)).
- Client users see only engagements they are assigned to, in organizations they are an active member of, and never Method/IP content. A person may belong to several organizations; each is checked separately ([ADR-0002](docs/architecture-decisions/0002-tenancy-and-visibility.md), [ADR-0007](docs/architecture-decisions/0007-multiple-organization-memberships.md), [rls.md](docs/database/rls.md)).
- Engagement permissions are evaluated through capabilities (role defaults plus per-member overrides), and financial visibility is separate from project access ([ADR-0008](docs/architecture-decisions/0008-engagement-capabilities.md)).
- Access is invite-only; the service-role key is used only to create invited accounts ([ADR-0005](docs/architecture-decisions/0005-invite-only-authentication.md)).
- Every change to organizations, memberships, engagements and teams is recorded in an append-only activity log.
- Finances: money is stored in integer minor units with its currency, and business dates use `BUSINESS_TIME_ZONE` (America/Chicago) ([ADR-0010](docs/architecture-decisions/0010-money-and-business-dates.md)). Price, billing and cash are separate records; payments count against an invoice only through explicit allocations ([ADR-0011](docs/architecture-decisions/0011-allocations-credit-notes-refunds.md)). Money moves only through database operations that lock the contract and re-check every invariant; nobody writes cash records directly ([ADR-0012](docs/architecture-decisions/0012-finance-operations-and-integrity.md), [finance.md](docs/database/finance.md)). DSA OS stores no card or bank credentials; payment links are HTTPS references to an external provider.
- Architecture: working copies are internal; clients read only published, immutable snapshots of client-visible elements, and approval never gates visibility ([ADR-0014](docs/architecture-decisions/0014-publication-is-the-client-boundary.md)). Drafting, publishing, viewing and approving are separate capabilities; System Administrators hold none of them by default ([ADR-0024](docs/architecture-decisions/0024-architecture-capabilities.md)). Method lineage is internal only, and no architecture table references finance ([architecture.md](docs/database/architecture.md)).

## Deploying (when ready)

1. Create a **new, dedicated** Supabase project for DSA OS.
2. `pnpm exec supabase link --project-ref <ref>` then `pnpm exec supabase db push` to apply migrations. Do **not** run `seed.sql` against it.
3. In the Supabase dashboard: turn off "Allow new users to sign up", set the Site URL to the production domain and add `<site-url>/auth/confirm` to the redirect URLs, set minimum password length to 12, and copy the three templates from `supabase/templates/` into Auth → Email Templates. Configure SMTP with the `SUPABASE_AUTH_SMTP_*` values described in `.env.example`. The domain and sender are configuration only; nothing in the code names them.
4. Create the TPLCo organization and the first System Administrator: see [`docs/database/bootstrap.md`](docs/database/bootstrap.md).
5. Create a new Vercel project for this repository and set the application variables from `.env.example` (including `BUSINESS_TIME_ZONE`), with `NEXT_PUBLIC_SITE_URL` set to the production domain.
