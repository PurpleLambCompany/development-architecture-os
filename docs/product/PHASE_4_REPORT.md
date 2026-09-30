# Phase 4 end-of-phase report: Project Intelligence

**Branch:** `phase-4-project-intelligence` · **Pull request:** #4 (not merged; awaiting the owner's review and merge instruction) · **Date:** 2026-09-30

**Scope:** the approved Phase 4 proposal (`docs/product/PHASE_4_PROPOSAL.md`), with Kerrick's D1–D12 decisions recorded below, built in the proposal's §17 order.

**Not built:** AI/Architecture Intelligence, deliverables, implementation tracking, Executive Review, Method Library, certification or licensing functionality (per `CLAUDE.md`).

## D1–D12 decisions (Kerrick, 2026-09-30, "approved" — recommended option on each)

| #   | Decision                                                                                                              | Outcome                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| D1  | Narrow Client Contributors to assigned areas via a new `view_full_architecture` capability                            | **Yes.** Sponsor, Lead and Viewer hold it by default; Contributor does not                                          |
| D2  | Are engagement-wide records visible to area-scoped Contributors?                                                      | **No**, unless the area is assigned directly on the record                                                          |
| D3  | Opportunity vocabulary and controlled category lists                                                                  | **Approved, with two additions**: `technology` and `capability` added to the Opportunity category list              |
| D4  | Add `materialized` to `risk_status`?                                                                                  | **Yes**                                                                                                             |
| D5  | Permanent `ACT-nnn` reference codes for client actions?                                                               | **Yes**                                                                                                             |
| D6  | Who sends client actions (`manage_client_requests`)?                                                                  | Principal Architect, Architect, Researcher, Project Administrator                                                   |
| D7  | Client capability defaults (Contributors respond/submit input; Sponsor/Lead also reassign; Viewer/Finance do neither) | **Yes**                                                                                                             |
| D8  | Who assigns Contributor areas?                                                                                        | Those who manage the engagement team (Principal Architects, System Administrators, assigned Project Administrators) |
| D9  | Escalation levels: Principal Architect and client executive only?                                                     | **Yes**                                                                                                             |
| D10 | Client domain views: all four domains                                                                                 | **Include all four**                                                                                                |
| D11 | Signal rules and thresholds (severity ≥ 15, 30-day window, 7 days untriaged)                                          | **Approved**                                                                                                        |
| D12 | Build file upload in Phase 4 (private Storage bucket, signed URLs, RLS-tested)?                                       | **Include it**                                                                                                      |

Each is reflected in the migration, capability defaults, seed data and pgTAP suites below.

## 1. What was built

### Database (the authority for every rule)

- **Vocabulary.** One new record kind, `opportunity` (prefix `OPP`), and two relationship types, `advances` and `pursues`, added to Phase 3's 31; the pairing-rule generator and its TypeScript mirror both cover them (2,130 rules total, checked against the migration by `vocabulary.test.ts`).
- **Enums** (`20261002000000_project_intelligence_enums.sql`): `opportunity_status`, `intelligence_attention`, `triage_state`, `escalation_level`, `client_action_kind`/`status`, `contribution_status`, `engagement_file_purpose`, and `materialized` added to `risk_status` (D4).
- **Stewardship, history, escalation** (ADR-0027, ADR-0028): `intelligence_stewardship` (attention, triage, next review), append-only `intelligence_status_changes` guarded against update/delete (`guard_intelligence_log`, split by table to fix an early 42703 on the status-changes table), and `intelligence_escalations` (Principal Architect or named client executive, D9).
- **Resolution, per kind.** `intelligence_terminal_statuses`/`intelligence_active_statuses` are the single source of truth; `resolve_intelligence_record` refuses an out-of-kind status and refuses resolving an already-terminal record (23514, "already %; reopen it first"), and requires `publish_architecture` (not just `edit_architecture`) to accept a risk.
- **Categories** (ADR-0027): a controlled vocabulary per kind (`intelligence_record_domains`), mirrored exactly in `src/domain/intelligence/catalog.ts` and checked by a pgTAP assertion and a TypeScript test.
- **Client actions and contributions** (ADR-0029, D5–D7): permanent `ACT-nnn` codes; `assert_client_action_addressee` refuses an addressee lacking `view_architecture` and the needed capability, and refuses subjects outside an area-limited addressee's areas; `record_response_as_evidence`/`handle_client_contribution` create client-source evidence only when TPLCo deliberately says so.
- **Contributor areas** (ADR-0030, D1–D2, D8): a domain or an element-and-everything-under-it; engagement-wide records are excluded from area matching unless assigned directly.
- **Signals** (ADR-0032, D11): `intelligence_signals()` evaluates ten deterministic rules against the live register on every call; only dismissals are stored, fingerprinted so a signal returns automatically once its facts change.
- **Files** (ADR-0033, D12): `engagement_files` metadata plus a private `engagement-files` Storage bucket; `register_engagement_file` picks the path and checks the uploader, and the browser uploads directly to a signed URL — no file body passes through a server action.
- **Read models:** `intelligence_register` (one or every engagement), `intelligence_history`, `intelligence_impact` (a structural trace, `security invoker`), `intelligence_signals`.
- **Finance stays separate; clients never reach stewardship.** No Phase 4 table references finance, and `intelligence_stewardship`, `intelligence_status_changes` and `intelligence_escalations` have no client RLS policy at all.

Full detail: [`docs/database/intelligence.md`](../database/intelligence.md).

### Application

- **Domain layer** (`src/domain/intelligence/`): the catalog (mirroring the migration's controlled vocabularies), pure register filtering/ordering (`register.ts`, unit-tested), Zod schemas for every action, cached queries, and server actions that call the database operations (triage, resolve, reopen, escalate, acknowledge/resolve escalation, dismiss signal, send/respond/reassign/close/return/withdraw client action, record as evidence, submit/handle contribution, assign/remove member area, prepare/finish file upload).
- **Internal workspace:**
  - Engagement register (`/internal/engagements/[slug]/intelligence`): count grid, kind tabs, a full filter form (status, attention, triage, domain, review, category, visibility, lifecycle, provenance, owner, element, escalated/open-requests/signalled/engagement-wide, text search), inline triage, and risk/opportunity grids.
  - Client requests, client input and signals pages, each with the same navigation and counts.
  - Cross-engagement register (`/internal/intelligence`) with a per-engagement summary table.
  - Element page: a Stewardship panel (triage, resolve, reopen, escalate, acknowledge/resolve escalations) for records, a "Bearing on this element" panel for objects; record history; an impact trace; client requests and input naming the element.
  - Contributor areas on the engagement team page; escalations and signal counts on both Reviews pages; evidence file upload on the evidence page.
- **Client portal:**
  - Overview: "What is required from us" now counts open requests addressed to the viewer alongside approvals and decisions.
  - Actions tab (goes live): the viewer's queue with response (link and file upload), and for Sponsor/Lead the whole engagement's requests with reassignment.
  - Architecture tab: domain views (knowledge map, capability map and skill matrix, strategic model, application structure) built from published snapshots only, reusing the internal `DomainViews` component with client-safe wiring; published Project Intelligence records by kind with their published status, and a risk grid for `view_full_architecture` holders.
  - Element page: "Add input" (for `submit_client_input` holders) and past contributions with TPLCo's handling notes.

## 2. Files changed

81 files changed versus the Phase 3 merge (`76b091f`): 2 new migrations, `seed.sql` extended, 4 new pgTAP suites plus 6 updated, the full `src/domain/intelligence/` domain layer, `src/components/intelligence/` and `src/components/portal/client-intelligence.tsx`/`client-model.ts`, updates to `src/domain/architecture/` (catalog, vocabulary, rules, schemas, queries, actions, context) for the opportunity kind and the new capabilities, `src/components/architecture/domain-views.tsx` generalized to a `linkBase` so client and internal pages share it, a new `/files/[fileId]` download route, and the new/rewritten pages listed above.

## 3. Schema changes

- 2 new migrations (enums, then the main Project Intelligence migration: tables, functions, RLS policies, storage policies).
- 12 new tables: `opportunities`, `intelligence_stewardship`, `intelligence_status_changes`, `intelligence_escalations`, `intelligence_signal_dismissals`, `client_actions`, `client_action_subjects`, `client_action_responses`, `client_action_events`, `client_contributions`, `engagement_member_areas`, `engagement_files` (see `docs/database/intelligence.md` for what each holds).
- 1 new element kind (`opportunity`), 2 new relationship types (`advances`, `pursues`), 1 new value on `risk_status` (`materialized`).
- 1 new private Storage bucket (`engagement-files`).
- `private.build_element_snapshot` extended for opportunity fields.

## 4. Security / RLS changes

- 5 new capabilities: `manage_client_requests` (internal), `submit_client_input`, `respond_to_client_actions`, `assign_client_actions`, `view_full_architecture` (client) — none granted to System Administrators by default.
- Every new operation checks capabilities (42501), business rules (23514), or visibility (P0002), through `SECURITY DEFINER` helpers, exactly as Phase 3.
- Stewardship, status history and escalations carry no client RLS policy at all — a client reads a record's state only through a published snapshot or a client action.
- Contributor areas gate visibility, not authority: an area-limited client member still needs the matching capability to act.
- Storage policies on `engagement-files` restrict read to people who can already see the parent response/contribution/evidence source, and restrict upload to the registering uploader's own signed path.
- No Phase 4 table references a finance table (ADR-0023 unchanged).

## 5. Tests and checks performed

- `pnpm check` (lint, `next typegen` + `tsc --noEmit`, `format:check`, `vitest run`): **green** — 111 unit tests passing across 13 files.
- `pnpm build`: **green** — all 41 routes, including every new Phase 4 page, compile and prerender/generate correctly.
- `npx supabase db reset`: all 12 migrations and `seed.sql` apply cleanly.
- `npx supabase test db`: **18 suites, 743 assertions, all passing**, including the 4 new Phase 4 suites (`12_intelligence_registers`, `13_client_actions`, `14_contributor_areas`, `15_escalations_and_signals`) and a new concurrency suite (`99_intelligence_concurrency`, via `dblink`).
- `pnpm db:types`: no drift between the regenerated types and the committed `src/types/database.ts`.

## 6. Known limitations

- **No Playwright end-to-end suite exists in this repository** (Phases 1–3 did not set one up either, despite being named in earlier proposals as future scope). Verification here relies on the pgTAP suites (which exercise every RLS and business rule directly against Postgres) and the production build succeeding for every route; it does not click through the UI in a browser.
- **Email notifications** are still pending the Phase 2 email-provider decision; requests and escalations are visible only inside the app.
- **Invoice PDFs** and other pre-production items noted after Phase 2 remain outstanding.
- The domain-views client adapter (`client-model.ts`) reconstructs a `LoadedArchitecture`-shaped object from published snapshots for reuse with the internal `DomainViews` component; it is a read-only projection with no working-copy fields, but it is new surface area worth a second look in review.

## 7. Unresolved questions

None outstanding from D1–D12; all twelve were settled by Kerrick's approval on the recommended option in each case.

## 8. Recommended next step

Push this branch, open CI on PR #4, and address any findings. Once green, this is ready for Kerrick's review; do not merge without his explicit instruction, per standing project rules.
