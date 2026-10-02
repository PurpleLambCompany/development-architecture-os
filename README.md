# Development Systems Architecture OS

The digital operating environment for the **Development Architecture Method™** — The Purple Lamb Company.

DSA OS is a standalone application. It shares no code, database, environment variables or deployment with any other TPLCo product.

- Product specification: [`DSA_OS_MASTER_BUILD_SPEC.md`](DSA_OS_MASTER_BUILD_SPEC.md)
- Instructions for Claude Code: [`CLAUDE.md`](CLAUDE.md)
- Architecture decisions: [`docs/architecture-decisions/`](docs/architecture-decisions/)
- Database schema and access rules: [`docs/database/`](docs/database/)

**Current phase:** the accepted [V1 roadmap](docs/product/V1_ROADMAP_RECONCILIATION.md) governs the remaining path to V1 (V1-A Workflow Closure, V1-B Production Foundation, V1-C Participation and Awareness, V1-D Engagement Outputs, V1-E Discovery and Scale). **V1-A Workflow Closure:** the [implementation plan](docs/product/V1_A_WORKFLOW_CLOSURE_PROPOSAL.md) is accepted. Increment 1 (the browser test foundation) is merged. Increment 2 (practice administration, bootstrap and authority closure) is merged. Increment 3 (client-facing records and files, Workstream B) is the currently authorized increment and is implemented on a draft PR, not yet merged or accepted; later increments have not begun. V1-A is complete only after its Gate A assessment and the owner's manual acceptance. New Architecture Intelligence, Development Edge and Method Library capability is frozen until V1, and Architecture Intelligence Step B remains on hold.

**Historical phases:** Phase 7B.2 Step A — Architecture Intelligence Experience, accepted (PR #13). Real-provider evaluation has not been done, so real models remain fail-closed. Step B (per-kind activation after a governed real-model evaluation) has not started and is on hold until separately authorized. Phases 1 (foundation), 2 (commercial engagement), 3 (Architecture Core: the four architecture domains, Project Intelligence records, evidence, typed relationships, published versions, client approvals, decisions and baselines; see the [Phase 3 report](docs/product/PHASE_3_REPORT.md)), 4 (record stewardship, client requests and contributions, contributor areas and deterministic intelligence signals; see the [Phase 4 report](docs/product/PHASE_4_REPORT.md) and [`docs/database/intelligence.md`](docs/database/intelligence.md)) 5 and 6 are merged. Phase 5 adds Reviews, Deliverables and Implementation Initiatives — governing how approved architecture is realized into operating reality, verified through a formal Review `validates` relationship, with area-limited Client Contributor visibility extended to these records (ADR-0040) — following [`docs/product/PHASE_5_PROPOSAL.md`](docs/product/PHASE_5_PROPOSAL.md); see the [Phase 5 report](docs/product/PHASE_5_REPORT.md) and [`docs/database/reviews-deliverables-implementation.md`](docs/database/reviews-deliverables-implementation.md). Phase 6 adds the Method Library (the five method forms, DAM releases, Development Context, internal-only Method Applications, Acceptance Criteria and typed method lineage); see the [Phase 6 report](docs/product/PHASE_6_REPORT.md) and [`docs/database/method-library.md`](docs/database/method-library.md). Phase 7A (the Deterministic Development Edge: a rule catalog over governed records, one event per triggering change, the governed impact trace, Review examined-version capture, a private "Since you last reviewed" briefing, human judgments and narrow practice counts, with no AI) is complete and merged (PR #9); see [`docs/product/PHASE_7A_PROPOSAL.md`](docs/product/PHASE_7A_PROPOSAL.md), the [Phase 7A report](docs/product/PHASE_7A_REPORT.md) and [`docs/database/edge.md`](docs/database/edge.md). Phase 7B.1 (the Architecture Intelligence foundation: per-engagement external-processing authorisation, two capabilities, a read-only Tool Contract, a provider-neutral Gateway with a `fetch`-based OpenAI adapter, a structured inference and basis model, a metadata-only request audit, versioned prompts and an evaluation harness, with no inference text shown anywhere) is complete and merged (PR #11); real models remain fail-closed until a governed real-provider evaluation is completed; see [`docs/product/PHASE_7B_1_PROPOSAL.md`](docs/product/PHASE_7B_1_PROPOSAL.md), the [Phase 7B.1 report](docs/product/PHASE_7B_1_REPORT.md) and [`docs/database/architecture-intelligence.md`](docs/database/architecture-intelligence.md). Phase 7B.2 Step A (the Architecture Intelligence experience) is accepted (PR #13); see the [Phase 7B.2 proposal](docs/product/PHASE_7B_2_PROPOSAL.md) and [Step A report](docs/product/PHASE_7B_2_REPORT.md). Step B has not started and remains on hold.

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

Seeded Project Intelligence (Regional Innovation District): two opportunities (a published partnership whose window closes within 30 days, and an internal one whose window has already closed), triage on most records (one critical, one past its review date), a risk re-scored and an assumption's confidence raised, a new risk resolved as closed with a rationale, a Principal-level escalation and a client-executive escalation (which sends an executive-attention request to the Executive Sponsor), client requests in every state (open, open and overdue, responded, closed and recorded as evidence, withdrawn), client input both received and acknowledged, contributor areas (the Client Contributor has the Capability domain; the multi-organization advisor has the district operating model and everything under it), and one dismissed signal.

## Scripts

| Command                                  | What it does                                                                                                                                                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js                                                                                                                                                                                                                                         |
| `pnpm lint`                              | ESLint                                                                                                                                                                                                                                          |
| `pnpm typecheck`                         | Route type generation + `tsc --noEmit`                                                                                                                                                                                                          |
| `pnpm format` / `pnpm format:check`      | Prettier                                                                                                                                                                                                                                        |
| `pnpm test`                              | Vitest unit tests (`src/**/*.test.ts`)                                                                                                                                                                                                          |
| `pnpm check`                             | lint + typecheck + format check + unit tests                                                                                                                                                                                                    |
| `pnpm db:start` / `pnpm db:stop`         | Local Supabase                                                                                                                                                                                                                                  |
| `pnpm db:reset`                          | Re-apply all migrations and the seed                                                                                                                                                                                                            |
| `pnpm db:test`                           | pgTAP tests for RLS, finance, architecture and concurrency (`supabase/tests/`)                                                                                                                                                                  |
| `pnpm db:types`                          | Regenerate `src/types/database.ts` from the local schema                                                                                                                                                                                        |
| `pnpm practice:bootstrap`                | Establish the practice on a fresh **local** installation and invite its first Principal Architect (`--email`, `--first-name`, `--last-name`). Local and pre-production only; see [bootstrap.md](docs/database/bootstrap.md)                     |
| `pnpm test:e2e`                          | Browser acceptance suite (Playwright, `e2e/`): builds and starts the production app against local Supabase. **Resets the local database**; see [Browser tests](#browser-tests)                                                                  |
| `pnpm ai:eval`                           | Seed-only Architecture Intelligence evaluation against the local database (requires `ARCHITECTURE_INTELLIGENCE_MODE=synthetic_only`; `AI_EVAL_PROVIDER=openai` adds real-provider calls; `AI_EVAL_REPORT=<path>` writes a metadata-only report) |

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

- **App**: `pnpm check` (lint, typecheck, format, unit tests), `pnpm test`, `pnpm build`.
- **Database**: starts Supabase in the runner, applies all migrations and the seed, runs `pnpm db:test`, and fails if `src/types/database.ts` is out of date.
- **Browser**: starts Supabase in the runner and runs `pnpm test:e2e` against the production build. On failure, the Playwright report, screenshots and traces are kept as the `playwright-report` artifact.

A failing job marks the pull request as failing. To also block merging, add **App**, **Database** and **Browser** as required status checks in the branch protection rule for `main` (repository Settings → Branches).

## Browser tests

The Playwright suite in `e2e/` drives the production build (`next build`, then `next start` on `http://127.0.0.1:3000`) against local Supabase: real sign-in, row-level security and invitation emails, read from the local mail catcher. Nothing in the product is mocked, and Architecture Intelligence is off.

```bash
pnpm db:start                                  # local Supabase must be running; psql must be on PATH
pnpm exec playwright install chromium          # once per machine
pnpm test:e2e                                  # build, start and run every spec
pnpm test:e2e e2e/seeded-demo.spec.ts          # one spec
pnpm exec playwright show-trace test-results/<test>/trace.zip   # inspect a failure
```

- **It resets the local database.** Each spec resets it before it runs: `fresh-install.spec.ts` without the seed (a fresh installation, with no users or organizations), `seeded-demo.spec.ts` with it. Run `pnpm db:reset` afterwards to return to the demo data.
- The app's configuration comes from `supabase status`, not from `.env.local`, and the site URL is always `http://127.0.0.1:3000` (the auth server's site URL), so invitation links return to the test server. Stop any dev server on port 3000 first. To iterate against an already running production server, set `E2E_REUSE_SERVER=1`.
- `fresh-install.spec.ts` follows the product from an empty installation as far as it goes today: `pnpm practice:bootstrap`, the first Principal Architect accepting their invitation, practice administration and staffing without SQL, and the authority rules of [ADR-0074](docs/architecture-decisions/0074-practice-administration-and-architectural-authority.md). Where it reaches a known V1-A dead end, it asserts that boundary and names the workstream that closes it ([V1-A plan](docs/product/V1_A_WORKFLOW_CLOSURE_PROPOSAL.md) §4). Those assertions change when the workstream lands.
- `seeded-demo.spec.ts` opens every navigation destination offered to each seeded role, internal and client, and checks that a client stays inside their own engagement.

## Project structure

```text
src/
  app/
    (public)/login/         sign in (password or emailed link)
    auth/confirm/           verifies invitation / sign-in / recovery links server-side
    account/set-password/   first password after accepting an invitation
    (internal)/internal/    TPLCo workspace: dashboard, organizations, engagements (architecture domains,
                            intelligence: registers, client requests, client input, signals; evidence,
                            reviews, baselines), finance, settings; cross-engagement intelligence register
    (client)/portal/        client environment: overview, actions (what is required from us), architecture
                            (with Project Intelligence and the risk grid), decisions, billing, invoices
    files/[fileId]/         signed-URL download for an engagement file the caller may read
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
- Access is invite-only; the service-role key is used only to create invited accounts and, server-side, to record an Architecture Intelligence request for the signed-in person ([ADR-0005](docs/architecture-decisions/0005-invite-only-authentication.md), [ADR-0069](docs/architecture-decisions/0069-keeping-an-interpretation-without-a-new-secret.md)).
- Every change to organizations, memberships, engagements and teams is recorded in an append-only activity log.
- Practice administration (`administer_practice`: edit the practice, invite and manage TPLCo staff) is separate from architectural authority. Principal Architects and System Administrators hold it by default and may delegate it; only a Principal Architect may give anyone the Principal Architect, Architect or Researcher role, nobody changes their own role or status, and at least one active Principal Architect and one practice administrator always remain. An internal person's engagement role is their practice role; differences go through capability overrides. All of this is enforced in the database ([ADR-0074](docs/architecture-decisions/0074-practice-administration-and-architectural-authority.md)).
- Finances: money is stored in integer minor units with its currency, and business dates use `BUSINESS_TIME_ZONE` (America/Chicago) ([ADR-0010](docs/architecture-decisions/0010-money-and-business-dates.md)). Price, billing and cash are separate records; payments count against an invoice only through explicit allocations ([ADR-0011](docs/architecture-decisions/0011-allocations-credit-notes-refunds.md)). Money moves only through database operations that lock the contract and re-check every invariant; nobody writes cash records directly ([ADR-0012](docs/architecture-decisions/0012-finance-operations-and-integrity.md), [finance.md](docs/database/finance.md)). DSA OS stores no card or bank credentials; payment links are HTTPS references to an external provider.
- Architecture: working copies are internal; clients read only published, immutable snapshots of client-visible elements, and approval never gates visibility ([ADR-0014](docs/architecture-decisions/0014-publication-is-the-client-boundary.md)). Drafting, publishing, viewing and approving are separate capabilities; System Administrators hold none of them by default ([ADR-0024](docs/architecture-decisions/0024-architecture-capabilities.md)). Method lineage is internal only, and no architecture table references finance ([architecture.md](docs/database/architecture.md)). Deliverables, reviews and implementation initiatives reach a client only when a publisher makes them client-visible, and a client opens a deliverable's files exactly when they can read the deliverable, on every published version, each file labelled by its version ([ADR-0075](docs/architecture-decisions/0075-client-records-and-deliverable-files.md)).
- Project Intelligence: stewardship, status history and escalations are internal only; a client sees a record's status only inside a published snapshot or a client action. A client action reaches only a named, eligible addressee, and its subjects must already be published and client-visible; a client's words become evidence only when TPLCo deliberately records them as such. Contributor areas gate what an area-limited client sees, never what they may do. Signals are computed deterministically from the register on every read, never AI-generated, and a dismissal is a stored judgment with a reason, not a suppression of the underlying fact ([ADR-0026](docs/architecture-decisions/0026-opportunity-record-kind.md)–[ADR-0033](docs/architecture-decisions/0033-engagement-files.md), [intelligence.md](docs/database/intelligence.md)).

- Architecture Intelligence (Phase 7B.1) is off unless `ARCHITECTURE_INTELLIGENCE_MODE` says otherwise, and runs only for engagements a Principal Architect has authorised for external processing, by people holding `use_architecture_intelligence`. It reads only through a read-only Tool Contract that withholds Method/IP, licensed sources, evidence content and people, and it cannot mutate governed state (proven by `47_ai_no_mutation`). Outputs of models not evaluated for a prompt version are refused. Clients see nothing of it ([ADR-0060](docs/architecture-decisions/0060-external-ai-processing-authorization-and-data-classes.md)–[ADR-0066](docs/architecture-decisions/0066-architecture-intelligence-request-audit-and-cost.md), [architecture-intelligence.md](docs/database/architecture-intelligence.md)).
- Phase 7B.2 Step A (accepted 2026-10-01; Step B activation has not occurred) adds the intelligence drawer: deterministic facts first on Edge items, revisions, impact traces, element pairs, evidence links, Review preparation and initiative comparison, with a person-requested interpretation below them for holders only. Nothing a model returns is recorded unless the requester keeps it or judges it, and what is kept is exactly what was shown. Kept interpretations appear as Suggested interpretations on the Edge (never counted, ranked or tiered) and in a register on the Architecture Intelligence page. No model is evaluated, so with a real provider configured every drawer says "Not yet available". The deterministic fake provider (`ARCHITECTURE_INTELLIGENCE_PROVIDER=fake`, non-production only) exists for acceptance ([ADR-0067](docs/architecture-decisions/0067-intelligence-drawer-and-drawer-subjects.md)–[ADR-0073](docs/architecture-decisions/0073-deterministic-fake-provider-and-test-manifest-overlay.md)).

## Deploying (when ready)

1. Create a **new, dedicated** Supabase project for DSA OS.
2. `pnpm exec supabase link --project-ref <ref>` then `pnpm exec supabase db push` to apply migrations. Do **not** run `seed.sql` against it.
3. In the Supabase dashboard: turn off "Allow new users to sign up", set the Site URL to the production domain and add `<site-url>/auth/confirm` to the redirect URLs, set minimum password length to 12, and copy the three templates from `supabase/templates/` into Auth → Email Templates. Configure SMTP with the `SUPABASE_AUTH_SMTP_*` values described in `.env.example`. The domain and sender are configuration only; nothing in the code names them.
4. Create the practice organization and its first Principal Architect: see [`docs/database/bootstrap.md`](docs/database/bootstrap.md). The `pnpm practice:bootstrap` command is local and pre-production only; the production bootstrap is a V1-B decision.
5. Create a new Vercel project for this repository and set the application variables from `.env.example` (including `BUSINESS_TIME_ZONE`), with `NEXT_PUBLIC_SITE_URL` set to the production domain.
