# Phase 2 — Commercial Engagement System: Proposal

**Status:** Decisions approved by Kerrick Jordan on 2026-09-30 (§15). **The database schema (§3) and balance definitions (§6) are awaiting final review.** No Phase 2 migrations or application code have been written.
**Scope:** Phase 2 only, per `DSA_OS_MASTER_BUILD_SPEC.md` §9, §10, §26 and §31, and the Phase 2 brief from the PR #1 review.
**Builds on:** ADR-0007 (multiple organizations) and ADR-0008 (engagement capabilities). Capability overrides remain a TPLCo-only action; Executive Sponsors do not manage them in Phase 2.

**Revision 2 (2026-09-30)** applies your decisions. It adds credit notes (§3.7), external change-order approvals (§3.2), the invoice-numbering strategy (§3.10), `America/Chicago` as the business time zone, and HTTPS-only payment links. §6 now defines every balance separately.

---

## 1. Principles

1. **Financial records are the source of truth; every figure is derived from them.** Summaries are calculated when they are read and are never stored as editable numbers.
2. **Money is integer minor units plus a currency code.** Floating-point numbers are never used.
3. **History is appended, not overwritten.** The following are never edited: executed contracts, approved change orders, issued invoices, issued credit notes, recorded payments and allocations. A correction is a new record (a credit note, a reversal, a void with a reason, or a new change order) that points at the original.
4. **Price, billing and cash are different things.**
   - Change orders change the **price** (contract value).
   - Invoices and credit notes change what has been **billed**.
   - Payments and allocations record **cash** and where it was applied.
   - No record of one kind silently changes another.
5. **Payment progress is not architecture progress.** A milestone may carry a label for a project stage, but nothing ties payment to architecture completion.
6. **Financial visibility is a capability** (`view_financials`), never a role-name check.
7. **Seeing finances never grants project access.**
8. **Stripe-ready, not Stripe-connected.** DSA OS never handles or stores card or bank credentials.

---

## 2. Money, currency and time

| Decision  | Proposal                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage   | `bigint` columns named `*_minor`, in the currency's smallest unit (cents for USD).                                                                                                                                                          |
| Currency  | `char(3)` referencing `currencies(code, minor_unit_exponent, enabled)`. **Only USD is enabled at launch**; others can be enabled later without a schema change.                                                                             |
| Scope     | **One currency per contract.** Every child record (milestone, change order, invoice, credit note, payment) carries the contract's currency, enforced by trigger. No foreign-exchange conversion. Portfolio totals are grouped by currency.  |
| Sign      | Every amount is positive except `change_orders.amount_minor`, which may be negative. Direction comes from the record type, so there are no negative invoices or payments.                                                                   |
| Input     | Decimal strings are parsed to minor units with string arithmetic in Zod, never with `parseFloat`. More decimal places than the currency allows is an error.                                                                                 |
| Transport | PostgREST returns `bigint` as a JSON number, which is exact up to 2^53 minor units. The server checks `Number.isSafeInteger`.                                                                                                               |
| Time      | Business dates (issue, due, overdue, invoice year) use the IANA zone in `BUSINESS_TIME_ZONE`, set to `America/Chicago`. It is never hard-coded as CST/CDT. The server passes `as_of` and issue dates computed in that zone to the database. |
| Tax       | Out of scope; amounts are agreed totals.                                                                                                                                                                                                    |

---

## 3. Proposed database schema

Conventions for every table below:

- `id uuid primary key default gen_random_uuid()`, plus `created_at`, `updated_at` (trigger-maintained) and `created_by` (forced to `auth.uid()`), as in Phase 1.
- `engagement_id` is on every table. On child tables it is copied from the parent by trigger, so RLS and audit never need joins.
- `currency` on child tables must equal the contract's currency (trigger).
- A `status` column can change only through the transition RPCs in §7. A trigger rejects direct updates to it.
- Every table has RLS enabled and an audit trigger.

### 3.1 `contracts`

| Column                                            | Type                           | Rules                                                                  |
| ------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `engagement_id`                                   | uuid not null → engagements    | immutable                                                              |
| `title`                                           | text not null ≤ 200            |                                                                        |
| `currency`                                        | char(3) not null → currencies  | immutable after execution                                              |
| `original_value_minor`                            | bigint not null ≥ 0            | immutable after execution                                              |
| `status`                                          | `contract_status` not null     | §4                                                                     |
| `payment_structure`                               | `payment_structure` not null   | `milestone`, `installments`, `percentage`, `retainer`, `custom`        |
| `payment_terms_days`                              | int not null 0–180, default 30 | default due date for invoices                                          |
| `deposit_minor`                                   | bigint ≥ 0, null               | informational; the deposit itself is billed through a milestone        |
| `effective_date`, `start_date`, `end_date`        | date                           | `end_date ≥ start_date`                                                |
| `executed_on`                                     | date                           | required to execute                                                    |
| `client_signatory_name`, `client_signatory_title` | text ≤ 200                     | required to execute                                                    |
| `approved_by`, `approved_at`                      | uuid → profiles, timestamptz   | set by `execute_contract`; Principal Architect or System Administrator |
| `document_path`                                   | text, null                     | signed agreement in the private `finance-documents` bucket             |
| `supersedes_contract_id`                          | uuid → contracts, null         | a renewal or replacement                                               |

There can be **at most one current contract per engagement**: a partial unique index on `engagement_id` where `status in ('executed','active')`. Every calculation uses the current contract.

### 3.2 `change_orders`

| Column                                              | Type                           | Rules                                                                                |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `engagement_id`, `contract_id`                      | uuid not null                  | the contract must be current when the change order is submitted                      |
| `number`                                            | int, null until submitted      | per contract: CO-1, CO-2 …; unique (`contract_id`, `number`)                         |
| `title`                                             | text not null ≤ 200            |                                                                                      |
| `description`, `scope_impact`, `schedule_impact`    | text                           |                                                                                      |
| `currency`                                          | char(3) not null               | = the contract's currency                                                            |
| `amount_minor`                                      | bigint not null, ≠ 0           | the change to contract **price**; may be negative                                    |
| `status`                                            | `change_order_status` not null | `draft`, `submitted`, `approved`, `rejected`, `void`                                 |
| `submitted_at`, `submitted_by`                      | timestamptz, uuid              |                                                                                      |
| `decided_at`                                        | timestamptz                    | when the decision was recorded                                                       |
| `decision_note`                                     | text ≤ 1000                    | required for rejections and voids                                                    |
| **Approval provenance**                             |                                |                                                                                      |
| `approval_source`                                   | `approval_source`, null        | `client_portal` or `external_recorded_by_tplco`                                      |
| `approved_by_user_id`                               | uuid → profiles, null          | portal only: the client user who approved                                            |
| `external_approver_name`, `external_approver_title` | text ≤ 200                     | external only; name required                                                         |
| `external_approved_on`                              | date                           | external only; the date the client approved                                          |
| `external_approval_method`                          | `external_approval_method`     | external only: `signed_document`, `email`, `letter`, `other`                         |
| `evidence_path`, `evidence_reference`               | text                           | external only; at least one required (an attachment or a reference)                  |
| `recorded_by`, `recorded_at`                        | uuid, timestamptz              | external only: the TPLCo System Administrator or Principal Architect who recorded it |

A check constraint makes the two approval sources mutually exclusive:

- A `client_portal` approval requires `approved_by_user_id` and has every external field null.
- An `external_recorded_by_tplco` approval requires the external approver name, the date, the method, `recorded_by` and evidence, and has a null `approved_by_user_id`.

The UI and the audit trail show "Approved in portal by Eleanor Vance" and "Approval by Eleanor Vance (signed document, 12 Oct) recorded by Adrienne Cole" differently.

### 3.3 `change_order_events` (append-only)

This is the auditable approval history:

- `change_order_id`, `engagement_id`
- `from_status`, `to_status`
- `actor_id`, `actor_side`
- `approval_source`, `note`
- `contract_value_before_minor`, `contract_value_after_minor` (set on approval)
- `occurred_at`

Rows are inserted only by the transition RPCs. There is no update or delete for any role.

### 3.4 `payment_milestones`

| Column                         | Type                         | Rules                                                                              |
| ------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------- |
| `engagement_id`, `contract_id` | uuid not null                |                                                                                    |
| `sequence`                     | int not null                 | order in the payment journey; unique per contract                                  |
| `title`                        | text not null ≤ 200          | e.g. "Diagnostic completion"                                                       |
| `description`                  | text                         |                                                                                    |
| `currency`                     | char(3) not null             |                                                                                    |
| `amount_minor`                 | bigint not null > 0          | the planned amount                                                                 |
| `due_date`                     | date, null                   | null for event-triggered milestones until scheduled                                |
| `trigger_type`                 | `milestone_trigger` not null | `on_signing`, `on_date`, `on_event`, `manual`                                      |
| `stage_label`                  | text ≤ 200, null             | **free-text label only**; no foreign key into architecture data                    |
| `status`                       | `milestone_status` not null  | `planned`, `ready_to_invoice`, `invoiced`, `cancelled` (the scheduling state only) |

A milestone's payment state is **derived** from the invoice lines that reference it. Phase 3 may add a separate link table from milestones to architecture objects without changing this table.

### 3.5 `invoices`

| Column                                  | Type                           | Rules                                                                                                      |
| --------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `engagement_id`, `contract_id`          | uuid not null                  |                                                                                                            |
| `invoice_number`                        | text, null until issued        | `TPL-YYYY-NNNN`; unique; assigned at issue (§3.10); never changes or is reused                             |
| `status`                                | `invoice_status` not null      | `draft`, `scheduled`, `issued`, `void`                                                                     |
| `scheduled_issue_date`                  | date, null                     | for `scheduled` only                                                                                       |
| `issue_date`, `due_date`                | date                           | set at issue; due date defaults to issue + payment terms; `due_date ≥ issue_date`                          |
| `currency`                              | char(3) not null               |                                                                                                            |
| `total_minor`                           | bigint, null until issued, > 0 | the sum of the lines, **frozen at issue**                                                                  |
| `memo`                                  | text ≤ 2000                    | client-facing: why this invoice exists                                                                     |
| `document_path`                         | text, null                     | PDF in `finance-documents`                                                                                 |
| `payment_url`                           | text, null                     | **must start with `https://`**; set only when issued; exposed to clients only as described in §5.3         |
| `payment_provider`, `payment_reference` | text ≤ 100, null               | e.g. `stripe` and a hosted-invoice id. These are references only, never payment data.                      |
| `issued_at`, `issued_by`                | timestamptz, uuid              |                                                                                                            |
| `voided_at`, `voided_by`, `void_reason` | timestamptz, uuid, text        | void only through the RPC, and only while the invoice has no active allocations and no issued credit notes |

### 3.6 `invoice_lines`

| Column                        | Type                      | Rules                                       |
| ----------------------------- | ------------------------- | ------------------------------------------- |
| `invoice_id`, `engagement_id` | uuid not null             |                                             |
| `position`                    | int not null              | display order                               |
| `description`                 | text not null ≤ 500       |                                             |
| `amount_minor`                | bigint not null > 0       |                                             |
| `payment_milestone_id`        | uuid → payment_milestones | optional; same contract                     |
| `change_order_id`             | uuid → change_orders      | optional; must be `approved`; same contract |

Lines can be inserted, updated or deleted only while the invoice is a `draft` or `scheduled`.

### 3.7 `credit_notes` (new)

A credit note **reduces what was billed on one issued invoice**. It does not change contract value, which only change orders do (§6.4).

| Column                                  | Type                     | Rules                                                    |
| --------------------------------------- | ------------------------ | -------------------------------------------------------- |
| `engagement_id`, `contract_id`          | uuid not null            |                                                          |
| `invoice_id`                            | uuid not null → invoices | the invoice must be `issued`; same contract and currency |
| `credit_note_number`                    | text, null until issued  | `TPL-CN-YYYY-NNNN`; unique; its own series; permanent    |
| `status`                                | `credit_note_status`     | `draft`, `issued`, `void`                                |
| `currency`                              | char(3) not null         |                                                          |
| `amount_minor`                          | bigint not null > 0      | the credit                                               |
| `reason`                                | text not null ≤ 1000     | client-facing reason                                     |
| `issue_date`                            | date                     | set at issue                                             |
| `issued_at`, `issued_by`                | timestamptz, uuid        |                                                          |
| `voided_at`, `voided_by`, `void_reason` | timestamptz, uuid, text  |                                                          |
| `document_path`                         | text, null               | PDF                                                      |

Rules, enforced in `issue_credit_note` with a row lock on the invoice:

- **Credit limit:** `amount ≤ invoice balance`, where the invoice balance is net invoice minus applied payments (§6.1). A credit note never creates a negative balance.
- **Credit on a paid invoice:** if the invoice is already paid, TPLCo first **reverses** the excess allocation, and the money becomes unapplied credit, visible and available to apply elsewhere. Then the credit note is issued. The history then shows both steps rather than a hidden overpayment.
- **Worked example.** Your case produces these records:

  | Record              | Amount  |
  | ------------------- | ------- |
  | Invoice             | $10,000 |
  | Payment allocations | $6,000  |
  | Credit note, issued | −$2,000 |
  | **Net invoice**     | $8,000  |
  | **Invoice balance** | $2,000  |

- **Void:** an issued credit note can be voided (with a reason) only if the invoice balance would stay valid afterwards. It always does, because voiding a credit raises the net invoice. Voiding keeps the number and the row.
- **Scope:** only issued, non-void invoices can be credited. An invoice with issued credit notes cannot be voided; it is corrected with further credit notes instead.
- **Price reductions:** a credit note is not a price change. If the client and TPLCo agree a lower price, that is a **negative change order**, and a credit note if the amount was already invoiced. The UI offers both together, so contract value and billing stay consistent.

### 3.8 `payments`

| Column                                          | Type                      | Rules                                                                                                                                        |
| ----------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `engagement_id`, `contract_id`                  | uuid not null             |                                                                                                                                              |
| `currency`                                      | char(3) not null          |                                                                                                                                              |
| `amount_minor`                                  | bigint not null > 0       | cash received                                                                                                                                |
| `received_on`                                   | date not null             |                                                                                                                                              |
| `method`                                        | `payment_method` not null | `ach`, `wire`, `check`, `card_via_processor`, `other`                                                                                        |
| `reference`                                     | text ≤ 120                | e.g. a check number or wire confirmation. **Rejected if it looks like a card or account number** (a digit run of 12 or more, or Luhn-valid). |
| `payer_name`                                    | text ≤ 200                |                                                                                                                                              |
| `receipt_path`                                  | text, null                | receipt or remittance advice                                                                                                                 |
| `processor`, `external_payment_id`              | text, null                | unique together when present (idempotency for future webhooks)                                                                               |
| `status`                                        | `payment_status` not null | `recorded`, `reversed`                                                                                                                       |
| `reversed_at`, `reversed_by`, `reversal_reason` | timestamptz, uuid, text   | set only by `reverse_payment`, which also reverses the payment's active allocations                                                          |

### 3.9 `payment_allocations` (retained)

| Column                                          | Type                     | Rules                                            |
| ----------------------------------------------- | ------------------------ | ------------------------------------------------ |
| `payment_id`                                    | uuid not null → payments |                                                  |
| `invoice_id`                                    | uuid not null → invoices | same engagement, contract and currency; `issued` |
| `engagement_id`                                 | uuid not null            |                                                  |
| `amount_minor`                                  | bigint not null > 0      |                                                  |
| `reversed_at`, `reversed_by`, `reversal_reason` | timestamptz, uuid, text  | null while the allocation is active              |

Invariants, checked in the RPCs under row locks and re-checked by a constraint trigger:

1. For each payment, the sum of its active allocations is at most the payment amount. The remainder is the payment's **unapplied amount**.
2. For each invoice, the sum of its active allocations is at most the **net invoice** (total minus issued credit notes).
3. An allocation is never updated except to reverse it once. A correction is a reversal plus a new allocation.
4. The system never allocates silently. The payment form pre-fills oldest-due-first, and a person confirms. Future Stripe payments are the single exception: they allocate to the one invoice they paid.

With your $10,000 example across three invoices, the database holds one payment and three allocations ($4,000, $5,000 and $1,000).

### 3.10 Document numbering: `document_number_counters`

The table has columns `series` (`invoice` or `credit_note`), `year` and `last_value`, with the primary key (`series`, `year`).

**Issuance strategy.**

- `issue_invoice` and `issue_credit_note` run in one transaction. Each one:
  1. locks the counter row for the series and business-time-zone year of the issue date;
  2. increments it;
  3. formats the number (`TPL-2026-0001`, `TPL-CN-2026-0001`);
  4. writes it to the document along with `status = 'issued'`.
- Because the counter update is part of the issuing transaction, a failed or aborted issuance rolls the counter back as well. In normal operation numbers are therefore consecutive, with no extra machinery. Postgres sequences are deliberately _not_ used, because they are non-transactional and leave gaps on every rollback.
- Numbers are sequential in issuance order and unique (a unique index). They are permanent once issued: a voided document keeps its number, and a number is never reassigned.
- Absolute gap-freedom is **not** a system guarantee. If a gap ever arises (for example, from a manual database repair), it is tolerated and visible in the audit log, and it is never filled.
- Drafts have no number. A "draft" label is shown instead.
- Change orders are numbered per contract (CO-1, CO-2 …) on submission, using the same lock-and-increment pattern on the contract row.

### 3.11 Supporting tables

- `currencies`: reference data (USD enabled).
- `financial_events` (append-only): one row per financial state change. It holds `engagement_id`, `entity_type`, `entity_id`, `event_type`, `amount_minor`, `actor_id`, `occurred_at` and `metadata`. It covers contract execution, invoice issue and void, credit note issue and void, payment record and reversal, allocation and allocation reversal, and milestone status changes. It is the history shown to finance users and permitted clients.
- `finance_notes`: internal-only notes on any financial record, kept out of client-visible rows.

### 3.12 Relationships

```text
engagements 1─* contracts
contracts   1─* payment_milestones
contracts   1─* change_orders 1─* change_order_events
contracts   1─* invoices 1─* invoice_lines ─0..1→ payment_milestones | change_orders (approved)
invoices    1─* credit_notes
contracts   1─* payments 1─* payment_allocations *─1 invoices
engagements 1─* financial_events, finance_notes
```

### 3.13 Enums

| Enum                        | Values                                                                         |
| --------------------------- | ------------------------------------------------------------------------------ |
| `contract_status`           | `draft`, `executed`, `active`, `completed`, `terminated`, `superseded`, `void` |
| `payment_structure`         | `milestone`, `installments`, `percentage`, `retainer`, `custom`                |
| `change_order_status`       | `draft`, `submitted`, `approved`, `rejected`, `void`                           |
| `approval_source`           | `client_portal`, `external_recorded_by_tplco`                                  |
| `external_approval_method`  | `signed_document`, `email`, `letter`, `other`                                  |
| `milestone_trigger`         | `on_signing`, `on_date`, `on_event`, `manual`                                  |
| `milestone_status`          | `planned`, `ready_to_invoice`, `invoiced`, `cancelled`                         |
| `invoice_status`            | `draft`, `scheduled`, `issued`, `void`                                         |
| `credit_note_status`        | `draft`, `issued`, `void`                                                      |
| `payment_method`            | `ach`, `wire`, `check`, `card_via_processor`, `other`                          |
| `payment_status`            | `recorded`, `reversed`                                                         |
| `engagement_capability` (+) | adds `manage_financials` (internal-only)                                       |

---

## 4. Status models

| Entity       | Allowed transitions                                                                                                                                                                                                 | Visible to clients                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Contract     | `draft → executed → active → completed`; `executed` or `active → terminated`; `executed` or `active → superseded` (when a replacement is executed); `draft → void`                                                  | executed and later                  |
| Change order | `draft → submitted`; `submitted → approved` (portal or external) or `rejected`; `draft` or `submitted → void`. **Approved and rejected are final.** A mistaken approval is corrected with a reversing change order. | submitted and later                 |
| Milestone    | `planned → ready_to_invoice → invoiced`; `planned` or `ready_to_invoice → cancelled`; `invoiced → ready_to_invoice` only if its invoice is voided                                                                   | all except cancelled drafts         |
| Invoice      | `draft → scheduled → issued`; `draft → issued`; `scheduled → draft`; `issued → void` (only with no active allocations and no issued credit notes). Its payment state is **derived** (§6.1).                         | issued and void                     |
| Credit note  | `draft → issued → void`                                                                                                                                                                                             | issued and void                     |
| Payment      | `recorded → reversed`                                                                                                                                                                                               | recorded and reversed               |
| Allocation   | `active → reversed`                                                                                                                                                                                                 | active only (as "payments applied") |

---

## 5. Access control and RLS

### 5.1 Reading financial records

Every Phase 2 table has a select policy of `private.can_view_engagement_financials(engagement_id)`. Clients additionally see only the client-visible states in §4, and never `finance_notes`.

| Reader                                       | Sees                                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Executive Sponsor, Client Finance (default)  | client-visible financial records of their assigned engagements, in organizations where they are an active member                                                                                                        |
| Client Project Lead, Contributor, Viewer     | **nothing financial, change orders included**, unless TPLCo grants `view_financials` on that engagement                                                                                                                 |
| Finance Administrator, System Administrator  | all financial records on every engagement, without assignment. This gives **no** access to engagement content, architecture, research, strategy, deliverables or the project team, unless they are separately assigned. |
| Principal Architect                          | all                                                                                                                                                                                                                     |
| Architect, Researcher, Project Administrator | nothing financial unless granted `view_financials`                                                                                                                                                                      |

`public.finance_engagement_directory()` (security definer) lets finance users identify an engagement without reading `engagements`. It returns only `id`, `title`, `slug`, `status`, the dates and the client organization's name, and only where the caller can view financials.

### 5.2 Writing financial records

A new internal-only capability, **`manage_financials`**, controls writes:

- It is held **portfolio-wide without assignment** by Finance Administrators and System Administrators (approved decision 1), and by Principal Architects.
- It can be granted by override to an assigned internal member, but never to client members.
- Its overrides are managed by TPLCo only, with the rules built in PR #1. It counts as a financial capability, so only System Administrators, Principal Architects or an assigned Finance Administrator can grant it.

| Action                                                                                                                                                      | Requires                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Create or edit drafts; issue or void invoices and credit notes; manage milestones; record or reverse payments and allocations; submit or void change orders | `manage_financials`                                                                                                         |
| Execute, terminate or supersede a contract                                                                                                                  | Principal Architect or System Administrator                                                                                 |
| Record an external client approval of a change order                                                                                                        | Principal Architect or System Administrator (approved decision 2)                                                           |
| Approve or reject a submitted change order in the portal                                                                                                    | client member with `approve_change_orders` **and** `view_financials`                                                        |
| Delete                                                                                                                                                      | draft contracts, change orders, invoices and credit notes only, by `manage_financials`. Everything else has delete revoked. |

### 5.3 Payment URLs

A client sees an invoice's `payment_url` only when **all** of these are true:

- the invoice is `issued` and not void;
- its invoice balance is greater than zero;
- the viewer has `view_financials` and `pay_invoices`.

The URL is returned by a server query that applies these rules; it is not selected directly by the page. The database check requires `https://`. Only the link, the provider and the reference are stored.

### 5.4 Other safeguards

- Suspending a membership, organization or profile removes all financial visibility and approval rights immediately, through the same helpers.
- `anon` has no privileges.
- The `finance-documents` storage bucket is private, with paths `{engagement_id}/{kind}/{uuid}.pdf`. Storage RLS applies the same helper and the client-visible-state rule of the owning record. Downloads use short-lived signed URLs.

---

## 6. Balances and calculations

Each concept below is a separate, named figure. None is collapsed into another, and each has one definition implemented once in SQL (`private.invoice_balances`, `private.engagement_financial_summary(engagement_id, as_of)`) with pgTAP tests.

### 6.1 Per invoice

| Figure              | Definition                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoice total       | `total_minor`, frozen at issue                                                                                                                                                        |
| Credits             | sum of issued credit notes on the invoice                                                                                                                                             |
| **Net invoice**     | invoice total − credits                                                                                                                                                               |
| Payments applied    | sum of active allocations to the invoice                                                                                                                                              |
| **Invoice balance** | net invoice − payments applied (never negative, by the invariants)                                                                                                                    |
| Payment state       | `paid` if the balance is 0; `partially_paid` if some payment is applied and the balance is over 0; `unpaid` otherwise; also `overdue` if the balance is over 0 and `due_date < as_of` |

### 6.2 Per payment

| Figure               | Definition                              |
| -------------------- | --------------------------------------- |
| Amount received      | `amount_minor` (0 if reversed)          |
| Applied              | sum of the payment's active allocations |
| **Unapplied amount** | amount received − applied               |

### 6.3 Per engagement (current contract)

| Figure                               | Definition                                                                                                          | Meaning                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Original contract value**          | the contract's `original_value_minor`                                                                               | price as signed                                                        |
| **Approved change orders**           | sum of approved change-order amounts (may be negative)                                                              | agreed price changes                                                   |
| **Revised contract value**           | original + approved change orders                                                                                   | current agreed price                                                   |
| Gross invoiced                       | sum of the totals of issued, non-void invoices                                                                      |                                                                        |
| Credits issued                       | sum of issued, non-void credit notes                                                                                |                                                                        |
| **Net invoiced**                     | gross invoiced − credits issued                                                                                     | what has actually been billed                                          |
| **Remaining to invoice**             | revised contract value − net invoiced                                                                               | price not yet billed                                                   |
| Payments received                    | sum of recorded (not reversed) payments                                                                             | cash in                                                                |
| **Payments applied** ("Amount paid") | sum of active allocations                                                                                           | cash applied to invoices                                               |
| **Unapplied credit**                 | payments received − payments applied                                                                                | cash held on account, **not** a reduction of any balance until applied |
| **Outstanding invoice balance**      | sum of invoice balances = net invoiced − payments applied                                                           | billed and unpaid                                                      |
| **Currently due**                    | invoice balances where `due_date ≤ as_of` (includes past due)                                                       | payable now                                                            |
| **Past due**                         | invoice balances where `due_date < as_of`                                                                           | late                                                                   |
| Issued, not yet due                  | invoice balances where `due_date > as_of`                                                                           | billed, due later                                                      |
| **Remaining contract balance**       | revised contract value − payments applied                                                                           | what the client still owes over the life of the contract               |
| Unscheduled                          | revised contract value − sum of non-cancelled milestones, when positive                                             | price not yet on the payment schedule                                  |
| **Next scheduled payment**           | the earliest outstanding issued invoice by due date; otherwise the next milestone that is not invoiced or cancelled | amount, date and label                                                 |

**Identities** (asserted in pgTAP for every scenario):

- remaining contract balance = remaining to invoice + outstanding invoice balance
- outstanding invoice balance = currently due + issued, not yet due
- payments received = payments applied + unapplied credit

The client view shows unapplied credit as its own line ("Credit on account"). It is **never** silently subtracted from amounts due. It reduces a balance only when a person allocates it.

### 6.4 How each record moves the figures

| Record                                   | Revised value | Net invoiced | Payments applied | Unapplied credit | Remaining contract balance |
| ---------------------------------------- | :-----------: | :----------: | :--------------: | :--------------: | :------------------------: |
| Change order approved (+$5,000)          |    +5,000     |              |                  |                  |           +5,000           |
| Invoice issued ($10,000)                 |               |   +10,000    |                  |                  |                            |
| Credit note issued ($2,000)              |               |    −2,000    |                  |                  |                            |
| Payment recorded, not allocated ($6,000) |               |              |                  |      +6,000      |                            |
| Payment allocated ($6,000)               |               |              |      +6,000      |      −6,000      |           −6,000           |
| Allocation reversed ($1,000)             |               |              |      −1,000      |      +1,000      |           +1,000           |
| Payment reversed (bounced)               |               |              |     −applied     |    −unapplied    |          +applied          |

"Currently due" and "Past due" also depend on `as_of`, which is today in `America/Chicago`. The UI never shows a percentage comparing payment with architecture progress.

---

## 7. Server-action and RPC architecture

```text
src/domain/finance/
  money.ts (+ tests)       parse and format minor units; currency exponent
  catalog.ts               labels; allowed transitions (display mirror of the SQL)
  contracts/ change-orders/ milestones/ invoices/ credit-notes/ payments/
                           schemas.ts, queries.ts, actions.ts each
  summary.ts               engagement summary, invoice balances, portfolio
```

- **Drafts:** ordinary inserts and updates under the user's session; RLS decides.
- **Transitions:** Postgres RPCs, each `security definer` with `search_path = ''`, one transaction, row locks where money or numbers move. Each checks permissions with the RLS helpers and writes `financial_events` or `change_order_events`:
  - `execute_contract`, `terminate_contract`
  - `submit_change_order`, `approve_change_order` (portal), `record_external_change_order_approval`, `reject_change_order`, `void_change_order`
  - `set_milestone_status`
  - `issue_invoice`, `void_invoice`
  - `issue_credit_note`, `void_credit_note`
  - `record_payment(payment, allocations jsonb)`, `allocate_payment`, `reverse_allocation`, `reverse_payment`
- **Server actions:** Zod validation, then the RPC call, then translation of error codes to plain language, then path revalidation.
- **Service role:** not used by any Phase 2 action.
- **Business time zone:** a server helper computes today and the business year in `BUSINESS_TIME_ZONE` and passes them into the RPCs.

---

## 8. Screens

### 8.1 Internal

| Route                                                                                     | Content                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/internal/finance`                                                                       | Portfolio: one row per engagement with revised value, net invoiced, paid, unapplied credit, currently due, past due and next payment; totals by currency; filters for past due, awaiting approval and unapplied credit. |
| `/internal/finance/[slug]`                                                                | Engagement finance workspace: the §6.3 summary, contract, change orders, payment journey, invoices with their credit notes, payments with allocations, and history. No project content.                                 |
| `…/invoices/[number]`, `…/credit-notes/[number]`, `…/change-orders/[n]`, `…/payments/new` | Forms and transitions. The payment form pre-fills allocations. The change-order page has "Record external approval" for System Administrators and Principal Architects.                                                 |
| `/internal/finance/invoices`, `/payments`                                                 | Cross-engagement lists for collections and reconciliation.                                                                                                                                                              |

### 8.2 Client (only with `view_financials`; the server enforces it, not just the navigation)

| Route                                      | Content                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/portal/[slug]`                           | The financial snapshot shows real figures.                                                                                                                                                                                                                                             |
| `/portal/[slug]/billing`                   | The summary (contract value, approved changes, revised value, paid, currently due, past due, remaining balance, credit on account, next payment). The payment journey, as its own track beside the architecture journey. Invoices, credit notes, payments and receipts, change orders. |
| `/portal/[slug]/billing/invoices/[number]` | Why the invoice exists, its lines, credits, payments applied, balance, PDF, and the "Pay" link (§5.3).                                                                                                                                                                                 |
| `/portal/[slug]/billing/change-orders/[n]` | Impacts, value before and after, history including the approval source; Approve or Reject for `approve_change_orders` holders.                                                                                                                                                         |

---

## 9. Audit

1. `activity_log` (admin-only) gets a trigger on every Phase 2 table, recording full before and after snapshots.
2. `financial_events` and `change_order_events` are append-only business history, written by the RPCs.
3. Immutability triggers protect executed contract values, issued invoice totals and lines, issued credit notes, decided change orders and allocations. `update` and `delete` are revoked on the event tables.
4. Every correction is a new record with a reason that points to the original.

---

## 10. Test plan

**pgTAP (run in CI):**

| File                      | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `04_finance_isolation`    | No cross-client financial rows on any table, storage object or RPC. The multi-organization person sees each engagement only through the right assignment. Project Leads, Contributors and Viewers see nothing by default, including change orders. `anon` sees nothing.                                                                                                                                                                                                              |
| `05_finance_capabilities` | `view_financials` grants and revokes apply per engagement. `pay_invoices` and `approve_change_orders` do nothing without `view_financials`. `manage_financials` is refused for client members, and a grant works for an internal member. Nobody changes their own capabilities. Payment URLs are hidden in every case in §5.3.                                                                                                                                                       |
| `06_finance_portfolio`    | A Finance Administrator manages records on an unassigned engagement, while engagement, team and project tables return zero rows. The directory RPC returns only its columns. Researchers and Architects have no portfolio access.                                                                                                                                                                                                                                                    |
| `07_finance_calculations` | Every §6 figure and all three identities across scenarios: no contract; positive and negative change orders; unapproved and rejected change orders excluded; the three-invoice $10,000 payment; two partial payments on one invoice; overpayment producing unapplied credit; the credit-note example; a credit note after full payment (reverse allocation, then credit); a voided credit note; a reversed payment; overdue boundaries in `America/Chicago`; next scheduled payment. |
| `08_finance_transitions`  | Allowed and refused transitions. Frozen totals and lines. A credit note cannot exceed the invoice balance. An invoice with allocations or credit notes cannot be voided. Allocation invariants hold under concurrent inserts. Currency mismatches are refused. Card-like references are refused. Non-HTTPS payment URLs are refused. The two approval sources are mutually exclusive, and only System Administrators and Principal Architects can record external approvals.         |
| `09_finance_numbering`    | Numbers are sequential and unique per series and year. A rolled-back issuance does not consume a number. A voided document keeps its number. Drafts have none. The year follows `America/Chicago` around midnight on 31 December.                                                                                                                                                                                                                                                    |
| `10_finance_suspension`   | Suspension removes visibility and approval rights at once; suspending one of two memberships affects only that organization.                                                                                                                                                                                                                                                                                                                                                         |

**Vitest:** money parsing and formatting, the transition mirror, allocation pre-fill order, and business-date helpers.
**Browser run:** billing visibility by capability; client portal approval versus external approval shown differently; recording the split payment; issuing a credit note after a partial payment; a Finance Administrator gets a 404 on the project page.
**Seed:** covers each of these cases on the Meridian and Harbor engagements.

---

## 11. Stripe readiness (not built)

- Invoices carry `payment_url`, `payment_provider` and `payment_reference`. Payments carry `processor` and `external_payment_id`, unique together for idempotent webhooks.
- The future flow: an issued invoice gets a Stripe-hosted invoice → the client pays on Stripe → a signed webhook calls `record_payment` with one allocation → refund and dispute webhooks call `reverse_payment` (a refund model is needed first; see §16).
- DSA OS never receives card or bank credentials.

---

## 12. Out of scope for Phase 2

Live payment processing, taxes, refunds as money movements (see §16), multi-currency conversion, automatic invoice and reminder emails, recurring retainer auto-invoicing, delegated client administration of capabilities, a non-financial scope-change view for Project Leads, and accounting export.

---

## 13. Difficult-to-reverse decisions

1. Integer minor units, and one currency per contract.
2. `payment_allocations`, with no `payments.invoice_id`.
3. Credit notes attached to a single invoice, capped at the invoice balance.
4. Payment, overdue and balance states derived rather than stored.
5. Immutability of executed contracts, decided change orders, issued invoices and credit notes, and allocations.
6. The `TPL-YYYY-NNNN` and `TPL-CN-YYYY-NNNN` formats and the transactional counter.
7. Invoice lines.
8. Portfolio-wide `manage_financials` for Finance and System Administrators.
9. At most one current contract per engagement.
10. Milestones carry only a text stage label; any architecture link is a separate table later.

---

## 14. Recommended changes to the Master Build Specification

| Spec                                                 | Change                                                                                                                | Why                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `payments.invoice_id`                                | `payment_allocations`                                                                                                 | partial payments and one payment covering several invoices |
| Invoice statuses `paid`, `partially paid`, `overdue` | stored lifecycle `draft`, `scheduled`, `issued`, `void`; payment state derived                                        | one source of truth                                        |
| Change order `sent`, `declined`, `withdrawn`         | `submitted`, `rejected`, `void`, plus the approval source                                                             | clearer; external approvals are distinguishable            |
| Stored `revised_contract_value` on change orders     | calculated; snapshot kept in the approval event                                                                       | a stored value goes stale                                  |
| `related_phase` on milestones                        | `stage_label` text; a Phase 3 link table later                                                                        | payment stays independent of architecture                  |
| Free-text `payment_method`                           | enum plus a validated reference                                                                                       | keeps credentials out                                      |
| Public document URLs                                 | private bucket plus signed URLs                                                                                       | confidentiality                                            |
| (not in spec)                                        | `credit_notes`, `invoice_lines`, event tables, `finance_notes`, `currencies`, numbering counters, `manage_financials` | billing corrections, auditability, capability-based writes |

These are recorded as ADR-0010 (money and time), ADR-0011 (allocations and credit notes) and ADR-0012 (derived states, immutability and numbering) when the migration is written.

---

## 15. Decisions (approved 2026-09-30)

1. **Finance Administrators:** portfolio-wide financial management without assignment. This gives no architecture, research, strategy, deliverable, project-team or other project-content access unless they are separately assigned.
2. **External change-order approvals:** a System Administrator or Principal Architect may record an approval received outside the platform. It is stored distinctly from a portal approval, with the external approver, approval date, method, evidence, recording user and timestamp (§3.2).
3. **Currency:** only USD is enabled at launch; the schema is ready for more. One contract has one currency.
4. **Invoice numbering:** `TPL-YYYY-NNNN`, unique across TPLCo per calendar year, sequential, permanent after issuance and never reused. Gap-freedom is not an absolute requirement. The issuance strategy is documented in §3.10.
5. **Business time zone:** `BUSINESS_TIME_ZONE=America/Chicago` (IANA). CST/CDT is never hard-coded.
6. **Credit notes:** included in Phase 2 as a minimal, immutable model (§3.7). Void-and-reissue remains only for invoices with no payments or credits.
7. **External payment URLs:** HTTPS only, stored as link, provider and reference. They are exposed to a client only for an issued invoice with a balance, and only to viewers with `pay_invoices` (§5.3).
8. **Client Project Leads:** they see no change orders in Phase 2 without `view_financials`. A non-financial scope-change view may come later.

Capability overrides remain TPLCo-controlled, and `payment_allocations` is retained as proposed.

---

## 16. Open points for the schema review

1. **Refunds.** When unapplied credit has to be returned to a client, Phase 2 has no record of money going out. I recommend adding a minimal `refunds` table (payment, amount ≤ unapplied amount, date, method, reference, reason; immutable) in Phase 2 so that unapplied credit can be cleared auditably. The alternative is to defer it and track such refunds outside DSA OS until Stripe.
2. **Engagement-level credit notes.** Credit notes here always attach to one invoice. A goodwill credit not tied to any invoice would be modelled as a negative change order (price) instead. I recommend keeping it that way.
3. **Retainers.** Monthly retainer contracts are supported, but each month's invoice is created by hand. Automatic generation would be a later feature.

---

## 17. Build order once the schema is approved

1. Migration (enums, tables, triggers, helpers, `manage_financials`, RPCs, RLS, storage policies), then pgTAP suites 04–10, the seed and the types.
2. Domain modules and money and time utilities, with Vitest.
3. Internal finance screens.
4. Client billing screens and the live financial snapshot.
5. ADR-0010 to ADR-0012, the schema and RLS docs, the full suite, the browser run, and the Phase 2 report.
