# Phase 2 end-of-phase report: Commercial Engagement

**Branch:** `phase-2-commercial-engagement` · **Pull request:** #2 (not merged; awaiting the owner's merge instruction) · **Date:** 2026-09-30
**Scope:** the approved Phase 2 proposal (revision 2, §3–§17) with the four approved adjustments (§18). No Phase 3 functionality.

## 1. What was built

### Database (the authority for every rule)

- **Records:** contracts, change orders (with append-only history), payment milestones, invoices and invoice lines, HTTPS payment links, credit notes, payments, payment allocations, refunds, financial events, internal finance notes, currencies, and document-number counters.
- **Price, billing and cash stay separate.** A change order moves the price. A credit note moves what was billed. A payment counts against an invoice only through an explicit allocation. Unapplied cash is shown as credit on account and is never subtracted from what is due.
- **Adjustment 1 (refunds):** refunds are immutable.
  - A refund is limited to the contract's unapplied credit, and, when it names a payment, to that payment's unapplied amount.
  - A completed refund is only ever voided with a reason. It is never edited or deleted.
  - A payment with a completed refund cannot be reversed until the refund is voided.
  - Every calculation accounts for refunds.
- **Adjustment 2 (Net Remaining to Collect):** Net Remaining to Collect = revised contract value − (payments received − refunds). It appears next to invoice balance, currently due, past due and remaining to invoice, never in place of them.
- **Adjustment 3 (anti-double-billing):**
  - The issued lines for a milestone, or for an approved positive change order, can never add up to more than its amount. Partial billing is allowed.
  - A line cannot bill both a milestone and a change order.
  - Composite keys make every line, allocation, credit note and refund share one contract, engagement and currency.
- **Adjustment 4 (concurrency):**
  - Money moves only through 19 database operations. Each one locks the contract row first, checks permission, validates, writes an event and re-checks every invariant.
  - Deferred constraint triggers check the invariants again at commit.
  - Signed-in users have no direct insert, update or delete rights on payments, allocations, refunds or events.
  - Allocations are reversed and re-applied, never edited.
- **Derived states:**
  - Paid, partially paid and overdue invoices, and each milestone's state, are calculated from the records and the business date in America/Chicago. They are never stored.
- **Document numbers:**
  - Invoices are numbered `TPL-YYYY-NNNN` and credit notes `TPL-CN-YYYY-NNNN`.
  - The number is assigned in the same transaction that issues the document.
  - Numbers are sequential, permanent and never reused. A voided document keeps its number.
- **Read models (one definition per figure):**
  - `contract_financial_summary`, `invoice_balances`, `milestone_billing`, `portfolio_financial_summary` and `finance_engagement_directory`.
  - They run as the caller, so a client's figures are built only from records the client may see.
- **New internal capability, `manage_financials`:**
  - Held by default by System Administrators, Principal Architects and Finance Administrators on every engagement.
  - Finance Administrators still get no project access.

### Application

- **Domain layer (`src/domain/finance/`):**
  - Money handling in integer minor units, with text parsing that never uses floating point.
  - Business dates in `BUSINESS_TIME_ZONE`, including across daylight-saving changes.
  - A suggested payment allocation, oldest due first.
  - Zod schemas, queries, and server actions that call the database operations.
- **Internal portfolio** (`/internal/finance`):
  - Totals per currency.
  - One row per engagement with its figures.
  - Filters for past due, awaiting approval and credit on account.
  - A Finance menu, shown only to people with financial visibility.
- **Internal workspace** (`/internal/finance/[slug]`):
  - The contract: draft, edit, execute (executive only), renewal and supersession, status changes.
  - The financial position in four groups.
  - The payment plan.
  - Change orders: draft, submit, record external approval (executive only), withdraw, and history.
  - Invoices: draft lines showing how much of each milestone or change order is still billable, schedule, issue, void, credit notes and payment links.
  - Payments: record with suggested allocation, apply credit on account, reverse an allocation, reverse a payment.
  - Refunds: record and void.
  - The activity log and internal notes.
- **Engagement page:** a Finances panel for people who hold `view_financials`.
- **Client billing** (`/portal/[slug]/billing`, only with `view_financials`):
  - The summary, including Net Remaining to Collect and Credit on account.
  - Change orders awaiting a decision, with approve or decline for those with `approve_change_orders`.
  - The payment journey, as a separate track from the architecture journey.
  - Invoices (with "Pay online" only for `pay_invoices`), credit notes, payments and refunds, and change-order history.
  - A voided invoice stays listed, tagged Void, with its void reason under the tag.
- **Client invoice** (`/portal/[slug]/billing/invoices/[id]`): the invoice laid out as a document.
- **Client overview:** the financial snapshot now shows real figures.

## 2. Files changed

54 files, about +11,700 / −134 lines against `main`.

- **Migrations:**
  - `supabase/migrations/20260930000000_manage_financials_capability.sql`
  - `supabase/migrations/20260930000100_commercial_engagement.sql`
- **Seed:** `supabase/seed.sql` adds Phase 2 data, created through the same operations the app uses.
- **Tests:**
  - New: `supabase/tests/04_finance_access`, `05_finance_calculations`, `06_finance_integrity`, `99_finance_concurrency`.
  - Updated: `03_engagement_capabilities` now expects Finance Administrators to hold `manage_financials`.
- **Domain:**
  - New: `src/domain/finance/` (money, business dates, allocation, catalog, schemas, queries, actions, with unit tests).
  - Updated: `src/domain/capabilities/catalog.ts` (and its test).
- **UI:**
  - `src/app/(internal)/internal/finance/**`
  - `src/app/(client)/portal/[slug]/billing/**`
  - `src/components/finance/*`
  - `src/components/portal/engagement-nav.tsx`
  - Edits to the internal layout, the internal engagement page and the client overview.
- **Library:**
  - `src/lib/env.server.ts` (`getBusinessTimeZone`)
  - `src/lib/action-result.ts` (more database error codes)
- **Documentation:**
  - ADRs 0010–0012.
  - `docs/database/finance.md`, plus pointers to it from `schema.md` and `rls.md`.
  - README.
  - `CLAUDE.md`: the current phase now reads Phase 2.
  - This report.
  - `PHASE_2_PROPOSAL.md` §18.
- **Configuration:** `.env.example` (`BUSINESS_TIME_ZONE`) and `.github/workflows/ci.yml` (the same App and Database jobs, plus that variable).

## 3. Migration structure

Two migrations, applied in order. Nothing from Phase 1 is dropped or rewritten; no existing column changes.

**`20260930000000_manage_financials_capability.sql`** (one statement): adds `manage_financials` to `engagement_capability`. Postgres needs a new enum value committed before any function or policy can use it, so it is on its own.

**`20260930000100_commercial_engagement.sql`** (3,185 lines, one transaction), in 14 sections:

| §   | Lines     | Section                    | What it does                                                                                                                                                                                                                                  |
| --- | --------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 29–150    | Capabilities               | `manage_financials` is internal-only; role defaults for System Admin, Principal Architect and Finance Admin; portfolio-wide financial access for those three; `can_view_…`, `can_manage_…`, `has_client_financial_capability`, `is_executive` |
| 2   | 151–170   | Enums                      | Statuses for contracts, change orders, milestones, invoices, credit notes, payments, refunds; structure, approval source and method, trigger, payment method                                                                                  |
| 3   | 171–297   | Reference data and helpers | `currencies` (USD enabled), document-number counters, the card/account-number detector, business-date helpers                                                                                                                                 |
| 4   | 298–685   | Tables                     | The 15 tables, their checks, composite foreign keys (shared contract, engagement and currency), unique and partial indexes (one current contract per engagement)                                                                              |
| 5   | 686–818   | Balance helpers            | Definer helpers used only by operations and integrity checks: credited, applied, refunded and billed amounts per invoice, payment, milestone and change order                                                                                 |
| 6   | 819–931   | Integrity                  | `assert_contract_integrity`: every money invariant for a contract, raised as SQLSTATE 23514                                                                                                                                                   |
| 7   | 932–1257  | Guards                     | Triggers that fill inherited columns and refuse changes outside operations: frozen issued documents, append-only history, cash records only through operations                                                                                |
| 8   | 1258–1314 | Audit                      | `log_activity` generalised so every financial table is written to the activity log                                                                                                                                                            |
| 9   | 1315–1437 | Triggers                   | Wiring for §7 and §8, plus the deferred constraint triggers that re-run §6 at commit                                                                                                                                                          |
| 10  | 1438–1483 | Visibility helpers         | `contract_is_client_visible` (not draft or void), `invoice_is_client_visible` (issued at some point, so void stays visible), storage-path visibility                                                                                          |
| 11  | 1484–1543 | Privileges                 | Column-limited insert and update on draft tables; no insert, update or delete on payments, allocations, refunds or events; nothing for `anon`                                                                                                 |
| 12  | 1544–1761 | Row Level Security         | 38 policies, including two on `storage.objects` for the `finance-documents` bucket (matrix in §5 below)                                                                                                                                       |
| 13  | 1762–2823 | Operations                 | The 19 definer functions through which every status change and every cash movement happens                                                                                                                                                    |
| 14  | 2824–3185 | Read models                | The invoker functions that compute every figure (definitions in §6 below)                                                                                                                                                                     |

Each of the 19 operations follows the same steps: mark the transaction as a finance operation; lock the contract row `FOR UPDATE`; check permission (42501); validate the transition (23514, or P0002 when the record is not visible); write the change and its event; run `assert_contract_integrity`; clear the operation mark before returning.

The seed (`supabase/seed.sql`) builds its Phase 2 data by calling these same operations as the seeded Principal Architect, Executive Sponsor and Finance Administrator, so the seed cannot contain a state the application could not produce.

## 4. Schema changes

- **New enums:** contract, change-order, milestone, invoice, credit-note, payment and refund status; payment structure; approval source; external approval method; milestone trigger; payment method.
- **New tables (15):** `currencies`, `document_number_counters`, `contracts`, `change_orders`, `change_order_events`, `payment_milestones`, `invoices`, `invoice_lines`, `invoice_payment_links`, `credit_notes`, `payments`, `payment_allocations`, `refunds`, `financial_events`, `finance_notes`. Described in `docs/database/finance.md`.
- **Enum value:** `engagement_capability` gains `manage_financials`.
- **Existing tables:** no columns changed. `log_activity` was generalised so financial records are audited too.
- **Storage:** a private bucket, `finance-documents`, with folders keyed by engagement.
- **Money:** every amount is `bigint` minor units (cents) with a `char(3)` currency. No floating point anywhere, in the database or the app.

## 5. Security and RLS

### Who holds what by default

| Role                                 | view_financials      | manage_financials    | approve_change_orders | pay_invoices   |
| ------------------------------------ | -------------------- | -------------------- | --------------------- | -------------- |
| System Administrator                 | Yes, all engagements | Yes, all engagements | Not applicable        | Not applicable |
| Principal Architect                  | Yes, all engagements | Yes, all engagements | Not applicable        | Not applicable |
| Finance Administrator                | Yes, all engagements | Yes, all engagements | Not applicable        | Not applicable |
| Architect, Researcher, Project Admin | No                   | No                   | Not applicable        | Not applicable |
| Executive Sponsor                    | Yes                  | Not applicable       | Yes                   | Yes            |
| Client Finance                       | Yes                  | Not applicable       | No                    | Yes            |
| Client Project Lead                  | No                   | Not applicable       | No                    | No             |
| Client Contributor, Client Viewer    | No                   | Not applicable       | No                    | No             |

TPLCo can grant or revoke any of these per member per engagement (Phase 1 overrides; unchanged). `manage_financials` can never be held by a client. A client capability only counts while the person's membership and organization membership are active.

Executive-only, on top of `manage_financials`: executing a contract, terminating it, and recording an external change-order approval. "Executive" means System Administrator or Principal Architect. **Finance Administrators cannot execute contracts** (confirmed 2026-09-30; tested).

### Row-level matrix

"Viewer" = holds `view_financials` on the engagement. "Manager" = holds `manage_financials` (internal only). "Client" = a client user who is a viewer. Anyone else sees and changes nothing. Anonymous users have no privileges on any financial table.

| Table                        | Internal viewer reads | Client reads                                                             | Manager writes directly                                           | Everything else                           |
| ---------------------------- | --------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------- |
| `contracts`                  | All                   | Not draft, not void                                                      | Insert, edit, delete drafts                                       | Execute, status: operations               |
| `change_orders`              | All                   | Submitted and later                                                      | Insert, edit, delete drafts                                       | Submit, approve, reject, void: operations |
| `change_order_events`        | All                   | Events after submission                                                  | None                                                              | Written by operations; append-only        |
| `payment_milestones`         | All                   | Milestones of client-visible contracts                                   | Create planned; edit unless cancelled; delete if unbilled (guard) | Status: operation or issuing              |
| `invoices`                   | All                   | Issued at some point: issued and **void**                                | Insert drafts; edit draft or scheduled; delete drafts             | Schedule, issue, void: operations         |
| `invoice_lines`              | All                   | As their invoice                                                         | Write while the invoice is a draft (guard)                        | Frozen once issued                        |
| `invoice_payment_links`      | All                   | Only with `pay_invoices`, on an issued invoice with a balance above zero | Insert on issued invoices; edit; remove                           | HTTPS only (constraint)                   |
| `credit_notes`               | All                   | Issued and void                                                          | Insert, edit, delete drafts                                       | Issue, void: operations                   |
| `payments`                   | All                   | All                                                                      | None                                                              | Record, reverse: operations               |
| `payment_allocations`        | All                   | Active (not reversed) only                                               | None                                                              | Allocate, reverse: operations             |
| `refunds`                    | All                   | All                                                                      | None                                                              | Record, void: operations                  |
| `financial_events`           | All                   | `client_visible` only                                                    | None                                                              | Written by operations; append-only        |
| `finance_notes`              | Internal viewers      | Never                                                                    | Insert (internal managers)                                        | Append-only                               |
| `currencies`                 | All signed-in users   | All signed-in users                                                      | None                                                              | Reference data                            |
| `storage: finance-documents` | All in the engagement | Only files attached to client-visible records                            | Internal managers upload                                          | No update or delete policy                |

Client operations: approve or reject a submitted change order needs `approve_change_orders` **and** `view_financials` on that engagement, so a Project Lead sees no change orders unless TPLCo grants both.

Other protections:

- Direct writes are also column-limited: `id`, `engagement_id`, `currency` and every status, number and audit column are not writable by users. Inherited values come from the parent by trigger.
- Once issued, an invoice, its lines and a credit note are frozen, even in columns that were editable as a draft (tested).
- Payment references and payer names that look like card or bank account numbers are refused by the form and by a database constraint. No card or bank credentials are stored.
- The read models run as the caller, so a client's figures are computed only from rows that client can see.
- Suspending a membership removes financial visibility immediately (tested).

## 6. Financial calculation definitions

All figures come from the database read models; the app displays them and never recalculates. `as_of` is today's business date in America/Chicago. Only issued invoices, issued credit notes, recorded (not reversed) payments, active (not reversed) allocations and completed (not voided) refunds count. Voided and draft records never count.

### Contract summary (`contract_financial_summary`)

| Figure                            | Definition                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Original contract value           | `contracts.original_value_minor`                                                                                |
| Approved changes                  | Sum of approved change orders (negative ones reduce it)                                                         |
| **Revised contract value**        | Original + approved changes                                                                                     |
| Pending changes                   | Sum of submitted change orders awaiting a decision (not in any other figure)                                    |
| Gross invoiced                    | Sum of issued invoice totals                                                                                    |
| Credits issued                    | Sum of issued credit notes                                                                                      |
| **Net invoiced**                  | Gross invoiced − credits issued                                                                                 |
| **Remaining to invoice**          | Revised contract value − net invoiced                                                                           |
| **Payments received**             | Sum of recorded payments                                                                                        |
| Refunds                           | Sum of completed refunds                                                                                        |
| Net cash received                 | Payments received − refunds                                                                                     |
| Payments applied                  | Sum of active allocations                                                                                       |
| **Credit on account** (unapplied) | Payments received − payments applied − refunds                                                                  |
| Invoice balance (per invoice)     | Invoice total − its issued credits − its active allocations                                                     |
| **Outstanding balance**           | Sum of issued invoice balances                                                                                  |
| **Currently due**                 | Balances of invoices due on or before `as_of`                                                                   |
| **Past due**                      | Balances of invoices due before `as_of`                                                                         |
| Not yet due                       | Balances of invoices due after `as_of`                                                                          |
| **Remaining contract balance**    | Revised contract value − payments applied                                                                       |
| **Net Remaining to Collect**      | Revised contract value − (payments received − refunds)                                                          |
| Scheduled in payment plan         | Sum of milestones not cancelled                                                                                 |
| Not yet scheduled                 | max(revised contract value − scheduled, 0)                                                                      |
| Next payment                      | The open invoice with the earliest due date; if none, the first milestone (by sequence) with an unbilled amount |

Currently due includes past due. Credit on account is never subtracted from what an invoice owes; it counts against an invoice only when allocated.

### Identities (checked after every step in `05_finance_calculations`)

- Remaining contract balance = remaining to invoice + outstanding balance
- Outstanding balance = currently due + not yet due
- Payments received = payments applied + credit on account + refunds
- Net Remaining to Collect = remaining contract balance − credit on account

### Derived states (calculated, never stored)

**Invoice payment state** (`invoice_balances`), for issued invoices, first match wins:

1. Balance = 0 → Paid
2. Due date before `as_of` → Overdue (with days overdue)
3. Some payment applied → Partially paid
4. Otherwise → Open

Draft, scheduled and void invoices show their status. A voided invoice shows "Void" with its reason, to TPLCo and to clients (confirmed 2026-09-30).

**Milestone state** (`milestone_billing`), first match wins:

1. Cancelled → Cancelled
2. Nothing billed → Ready to invoice (if marked ready) or Upcoming
3. Any billing invoice overdue → Overdue
4. Any billing invoice has a balance → Invoiced
5. Billed less than the milestone amount → Partially billed
6. Otherwise → Paid

**Billing limits (adjustment 3):** billed for a milestone = sum of its lines on issued invoices, never above the milestone amount. The same limit applies to an approved positive change order. Void invoices release what they billed.

**Refund limits (adjustment 1):** a refund ≤ credit on account; when it names a payment, also ≤ that payment's unapplied amount.

## 7. Tests and checks performed

| Check                                                   | Result                                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pgTAP (`pnpm db:test`)                                  | 287 assertions in 7 files, all passing. Phase 2 adds 186                                                                                                                          |
| Unit tests (`pnpm test`)                                | 49 passing, 27 of them new                                                                                                                                                        |
| `pnpm check` (lint, typecheck, format) and `pnpm build` | Clean                                                                                                                                                                             |
| Browser run-through (Playwright)                        | Phase 1 suite 41/41. Finance suite 33/33, covering Finance Admin, Principal, Architect, Meridian Sponsor, Project Lead (with override), Viewer, Client Finance and Harbor Sponsor |
| CI on PR #2                                             | Required checks App and Database; final result reported with this report                                                                                                          |

**pgTAP files**

| File                         | Assertions | Covers                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01_phase1_rls`              | Phase 1    | Unchanged Phase 1 isolation, still passing                                                                                                                                                                                                                                                                                                                                    |
| `02_multi_organization`      | Phase 1    | Unchanged                                                                                                                                                                                                                                                                                                                                                                     |
| `03_engagement_capabilities` | Phase 1    | Updated: Finance Administrators now hold `manage_financials`                                                                                                                                                                                                                                                                                                                  |
| `04_finance_access`          | 47         | Who sees and changes what, role by role: Sponsor, Project Lead with and without overrides, Client Viewer, Client Finance, a multi-organization advisor, Finance Admin (no project access, cannot execute or record external approvals), Architect, Principal, anonymous; no direct cash writes by anyone; issued invoices frozen                                              |
| `05_finance_calculations`    | 63         | Every summary figure and the four identities through: partial payments, a split payment, a credit note, a prepayment, an allocation reversal, a bounced payment, a refund and a negative change order; invoice and milestone states; the refund limits                                                                                                                        |
| `06_finance_integrity`       | 64         | Double billing refused (milestones and change orders); numbering sequential and never reused; immutability of issued documents and cash records; guards; composite keys; allocation limits; credit notes; refunds; card-number rejection; HTTPS links; one current contract; approval provenance; suspension; a client still sees a voided invoice with its status and reason |
| `99_finance_concurrency`     | 12         | Two real database sessions: allocation against allocation and refund against allocation over the same credit (the second waits, then is refused), and two invoices issued at once (distinct sequential numbers)                                                                                                                                                               |

**Unit tests (`src/domain/finance/`):** money parsing and formatting without floating point; business dates in America/Chicago including daylight-saving changes; suggested allocation (oldest due first) and its problem checks; form schemas, including card-number rejection.

## 8. Decisions confirmed 2026-09-30

1. **Voided invoices stay visible to clients**, clearly marked Void with the void reason. The database already exposed them (visibility is "issued at some point"); the client invoice list now shows the reason under the Void tag, as the invoice page already did. A pgTAP assertion covers it.
2. **Finance Administrators do not execute contracts.** Execution stays with Principal Architects and System Administrators, enforced in `execute_contract` and tested.
3. **`CLAUDE.md` at Phase 2 is correct.** After PR #2 merges, the project status becomes "Phase 2 complete — Phase 3 planning".

## 9. Pre-production operational requirements

These do not block the Phase 2 merge. They must be in place before real client money or documents go through the system.

1. **Document upload UI.** Receipts, signed contract PDFs and change-order approval evidence. The `finance-documents` bucket, its engagement-keyed policies and the path columns exist; the upload screens do not, and external approval evidence is a text reference for now. The storage policies need pgTAP (or equivalent) coverage when the UI is built.
2. **Invoice PDFs.** Generated from the issued invoice, stored in `finance-documents`, and immutable like the invoice. The client invoice page is a printable document in the meantime.
3. **Notification emails.** At least: invoice issued, invoice overdue, change order submitted for approval, and change order decided. Needs an email provider decision.

## 10. Known limitations

1. The three pre-production requirements above.
2. **Renewal drafts:** a renewal draft can be edited and executed, but its milestones and change orders can be added only after it becomes the current contract.
3. **Client change orders have no separate detail page.** They are shown in full on the billing page.
4. **Mixed invoices:** when one invoice bills several milestones, a milestone's "open balance" is the whole invoice's open balance.
5. **Operation marker:** the flag that marks a finance operation is a transaction setting. Signed-in users cannot set it (no raw SQL) and have no write rights on the cash tables anyway. The service role could set it, so the service role must stay limited to account creation (ADR-0005).
6. **Credit note issuing** from the workspace takes two requests (create, then issue). If issuing fails, the draft is deleted.
7. **Seed dates** are relative to the database's UTC date, so for a few hours around midnight they can differ by a day from the Chicago business date. Development data only.
8. **No Stripe integration.** Processor and external-id fields are ready for it.
9. **USD only.** The schema is multi-currency ready; no conversion or mixed-currency totals exist.

## 11. Unresolved questions

None. The three questions from the first version of this report were answered (§8).

## 12. Recommended next step

1. Review this report. On your "merge PR #2" instruction, merge it (App and Database are green, reported with this report).
2. After the merge, update the project status to "Phase 2 complete — Phase 3 planning" in `CLAUDE.md` and the README.
3. Then choose between a short Phase 2.1 for the pre-production requirements (§9), or the Phase 3 proposal (Development Architecture), with no code until you approve it.
