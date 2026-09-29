# Development Systems Architecture OS

The digital operating environment for the **Development Architecture Method™** — The Purple Lamb Company.

DSA OS is a standalone application. It shares no code, database, environment variables or deployment with any other TPLCo product.

- Product specification: [`DSA_OS_MASTER_BUILD_SPEC.md`](DSA_OS_MASTER_BUILD_SPEC.md)
- Instructions for Claude Code: [`CLAUDE.md`](CLAUDE.md)
- Architecture decisions: [`docs/architecture-decisions/`](docs/architecture-decisions/)
- Database schema and access rules: [`docs/database/`](docs/database/)

**Current phase:** Phase 1 — Foundation (auth, organizations, roles, engagements, access control).

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

| Email                                                                                                             | Organization                   | Role                  |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------- |
| `sysadmin@tplco.test`                                                                                             | TPLCo                          | System Administrator  |
| `principal@tplco.test`                                                                                            | TPLCo                          | Principal Architect   |
| `architect@tplco.test`                                                                                            | TPLCo                          | Architect             |
| `researcher@tplco.test`                                                                                           | TPLCo                          | Researcher            |
| `projectadmin@tplco.test`                                                                                         | TPLCo                          | Project Administrator |
| `finance@tplco.test`                                                                                              | TPLCo                          | Finance Administrator |
| `sponsor@meridian.test`                                                                                           | Meridian Development Authority | Executive Sponsor     |
| `lead@meridian.test`                                                                                              | Meridian Development Authority | Client Project Lead   |
| `finance@meridian.test`                                                                                           | Meridian Development Authority | Client Finance        |
| `contributor@meridian.test`                                                                                       | Meridian Development Authority | Client Contributor    |
| `viewer@meridian.test`                                                                                            | Meridian Development Authority | Client Viewer         |
| `sponsor@harbor.test`, `lead@harbor.test`, `finance@harbor.test`, `contributor@harbor.test`, `viewer@harbor.test` | Harbor Commons Foundation      | client roles as above |

Seeded engagements: _Regional Innovation District_ (Meridian, active, full team), _Workforce Capability Program_ (Meridian, proposed, sponsor only on the client side), _Community Expansion Architecture_ (Harbor, active). `finance@harbor.test` and `contributor@harbor.test` are deliberately unassigned, so they see no engagements.

## Scripts

| Command                                  | What it does                                               |
| ---------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js                                                    |
| `pnpm lint`                              | ESLint                                                     |
| `pnpm typecheck`                         | Route type generation + `tsc --noEmit`                     |
| `pnpm format` / `pnpm format:check`      | Prettier                                                   |
| `pnpm test`                              | Vitest unit tests (`src/**/*.test.ts`)                     |
| `pnpm check`                             | lint + typecheck + format check + unit tests               |
| `pnpm db:start` / `pnpm db:stop`         | Local Supabase                                             |
| `pnpm db:reset`                          | Re-apply all migrations and the seed                       |
| `pnpm db:test`                           | pgTAP tests for RLS and database rules (`supabase/tests/`) |
| `pnpm db:types`                          | Regenerate `src/types/database.ts` from the local schema   |

## Project structure

```text
src/
  app/
    (public)/login/         sign in (password or emailed link)
    auth/confirm/           verifies invitation / sign-in / recovery links server-side
    account/set-password/   first password after accepting an invitation
    (internal)/internal/    TPLCo workspace: dashboard, organizations, engagements, settings
    (client)/portal/        client environment: engagement overview
  components/ui/            design-system primitives
  components/…              feature components (forms, team controls, shell)
  domain/                   business logic, schemas (Zod), queries and server actions — no React
  lib/                      Supabase clients, auth/viewer helpers, env, formatting
  proxy.ts                  session refresh + signed-out redirects (Next.js 16 "Proxy")
supabase/
  migrations/               the only way the schema changes
  seed.sql                  local demo data
  tests/                    pgTAP tests
  templates/                auth email templates
docs/
  product/                  spec companions, Phase 1 proposal
  architecture-decisions/   ADRs
  database/                 schema and RLS reference
```

## Security model (summary)

- Row Level Security is enabled on every table; anonymous callers have no access. Authorization lives in the database, not the UI ([ADR-0003](docs/architecture-decisions/0003-authorization-in-the-database.md)).
- Client users see only engagements they are assigned to within their own organization, and never Method/IP content ([ADR-0002](docs/architecture-decisions/0002-tenancy-and-visibility.md), [rls.md](docs/database/rls.md)).
- Access is invite-only; the service-role key is used only to create invited accounts ([ADR-0005](docs/architecture-decisions/0005-invite-only-authentication.md)).
- Every change to organizations, memberships, engagements and teams is recorded in an append-only activity log.

## Deploying (when ready)

1. Create a **new, dedicated** Supabase project for DSA OS.
2. `pnpm exec supabase link --project-ref <ref>` then `pnpm exec supabase db push` to apply migrations. Do **not** run `seed.sql` against it.
3. In the Supabase dashboard: turn off "Allow new users to sign up", set the Site URL and redirect URLs to the production domain, set minimum password length to 12, and copy the three templates from `supabase/templates/` into Auth → Email Templates. Configure a real SMTP provider.
4. Create the TPLCo organization and the first System Administrator: see [`docs/database/bootstrap.md`](docs/database/bootstrap.md).
5. Create a new Vercel project for this repository and set the four variables from `.env.example`.
