# Phase 2 end-of-phase report: Commercial Engagement

**Branch:** `phase-2-commercial-engagement` · **Pull request:** #2 (draft, not merged) · **Date:** 2026-09-30
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
- **Client invoice** (`/portal/[slug]/billing/invoices/[id]`): the invoice laid out as a document.
- **Client overview:** the financial snapshot now shows real figures.

## 2. Files changed

53 files, +11,537 / −134 lines against `main`.

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

## 3. Schema changes

- **New enums:** contract, change-order, milestone, invoice, credit-note, payment and refund status; payment structure; approval source; external approval method; milestone trigger; payment method.
- **New tables:** 14, listed in `docs/database/finance.md`.
- **Enum value:** `engagement_capability` gains `manage_financials`.
- **Existing tables:** no columns changed. `log_activity` was generalised so financial records are audited too.
- **Storage:** a private bucket, `finance-documents`.

## 4. Security and RLS changes

- **RLS on every new table.**
  - Clients never see draft contracts, draft change orders, draft or scheduled invoices, draft credit notes, internal events or finance notes.
  - A client sees a payment link only with `pay_invoices`, on an issued invoice that still has a balance.
- **Portfolio financial access:** System Administrators, Principal Architects and Finance Administrators (decision 1). Other internal members need an override. Client users need `view_financials` on that engagement.
- **Executive-only actions:** executing a contract, terminating it, and recording an external change-order approval (decision 2). External approvals record the approver, date, method, evidence, recorder and time, and stay distinguishable from portal approvals.
- **Change-order decisions:** approve or decline needs `approve_change_orders` and `view_financials`. So Project Leads without `view_financials` see no change orders (decision 8).
- **No card or bank credentials:**
  - Payment references and payer names that look like card or account numbers are rejected, both in the form and by a database constraint.
  - Payment links must be HTTPS.
- **Capability overrides:** granting and revoking stay controlled by TPLCo, unchanged from Phase 1.

## 5. Tests and checks performed

| Check                                                   | Result                                                                                                                                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pgTAP (`pnpm db:test`)                                  | 285 assertions in 7 files, all passing. Phase 2 adds 184: access 47, calculations 63, integrity 62, concurrency 12                                                                                               |
| Concurrency test                                        | Two real database sessions race over the same credit (allocation against allocation, and refund against allocation) and over invoice numbers. The second session waits, then is refused, or gets the next number |
| Unit tests (`pnpm test`)                                | 49 passing, 27 of them new: money, business dates, allocation, schemas                                                                                                                                           |
| `pnpm check` (lint, typecheck, format) and `pnpm build` | Clean                                                                                                                                                                                                            |
| Browser run-through (Playwright)                        | Phase 1 suite 41/41. New finance suite 33/33, covering Finance Admin, Principal, Architect, Meridian Sponsor, Project Lead (override), Viewer, Client Finance and Harbor Sponsor                                 |
| CI on PR #2                                             | App and Database green on the database commit (c7c009e). The latest commit is running                                                                                                                            |

The calculation tests re-check the reconciliation identities after every step, through partial payments, a split payment, a credit note, a prepayment, an allocation reversal, a bounced payment, a refund and a negative change order:

- remaining contract balance = remaining to invoice + outstanding balance
- outstanding balance = currently due + not yet due
- payments received = applied + unapplied + refunds
- net remaining to collect = remaining contract balance − unapplied credit

## 6. Known limitations

1. **File uploads are not wired into the UI yet.** Receipts, signed contract PDFs and approval evidence are affected.
   - The `finance-documents` bucket and its policies exist, and records have path columns.
   - External approval evidence is recorded as a text reference for now.
   - The storage policies are not yet covered by pgTAP.
2. **No invoice PDF and no email notifications.** Invoices are not generated as PDFs, and no email goes out when an invoice is issued or a change order is submitted. The client invoice page is a printable document.
3. **Renewal drafts:** a renewal draft can be edited and executed, but its milestones and change orders can be added only after it becomes the current contract.
4. **Client change orders have no separate detail page.** They are shown in full on the billing page instead.
5. **Mixed invoices:** when one invoice bills several milestones, a milestone's "open balance" is the whole invoice's open balance.
6. **Operation marker:** the flag that marks a finance operation is a transaction setting.
   - Signed-in users cannot set it, because they cannot run raw SQL.
   - In any case they have no write rights on the cash tables.
   - The service role could set it, so the service role must stay limited to account creation (ADR-0005).
7. **Credit note issuing:** issuing a credit note from the workspace takes two requests (create, then issue). If issuing fails, the draft is deleted.
8. **Seed dates:** they are relative to the database's UTC date, so for a few hours around midnight they can differ by a day from the Chicago business date.
9. **No Stripe integration.** The schema holds processor and external-id fields ready for it.

## 7. Unresolved questions

1. Should clients see voided invoices, listed as "Void" with the reason? The current answer is yes, for transparency.
2. Should a Finance Administrator be able to execute contracts? The current answer is no: only Principal Architects and System Administrators.
3. Is the change to `CLAUDE.md` (current phase: Phase 2) acceptable?

## 8. Recommended next step

1. Review PR #2 and this report. On your approval, merge PR #2 once App and Database are green.
2. Then choose between:
   - a short Phase 2.1 for document uploads (receipts, signed contracts, evidence), invoice PDFs and notifications; or
   - the Phase 3 proposal (Development Architecture), with no code until you approve it.
