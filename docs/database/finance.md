# Commercial engagement: financial schema, rules and access (Phase 2)

Migrations: `20260930000000_manage_financials_capability.sql`, `20260930000100_commercial_engagement.sql`.
Decisions: [ADR-0010](../architecture-decisions/0010-money-and-business-dates.md), [ADR-0011](../architecture-decisions/0011-allocations-credit-notes-refunds.md), [ADR-0012](../architecture-decisions/0012-finance-operations-and-integrity.md). Plain-English walkthrough: `docs/product/PHASE_2_PROPOSAL.md` §3.

All amounts are `bigint` minor units (`*_minor`) with a `char(3)` currency. Business dates are passed in as `as_of` in America/Chicago.

## Tables

| Table                       | Holds                                                                                                                                            | Changes after creation                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `currencies`                | Supported currencies; USD enabled                                                                                                                | Reference data                                                                                                            |
| `document_number_counters`  | Last number per series (`invoice`, `credit_note`) and year                                                                                       | Only by issuing operations                                                                                                |
| `contracts`                 | Signed agreement: original value, currency, structure, terms, dates, signatory, approver, supersedes                                             | Draft: editable. Executed: terms locked; status only via operations. At most one current (executed/active) per engagement |
| `change_orders`             | Numbered price changes (±), scope and schedule impact, approval provenance (portal user, or external approver, method, evidence, TPLCo recorder) | Draft: editable. Submitted: only decisions. Approved, rejected, void: final                                               |
| `change_order_events`       | Every status change, with contract value before and after an approval                                                                            | Append-only                                                                                                               |
| `payment_milestones`        | The payment plan; `stage_label` is text only                                                                                                     | Editable until billed; status via `set_milestone_status` or issuing                                                       |
| `invoices`, `invoice_lines` | Bills; each line bills a milestone, an approved positive change order, or neither (never both)                                                   | Draft/scheduled: editable. Issued: frozen; only voided (nothing applied or credited)                                      |
| `invoice_payment_links`     | Optional HTTPS payment URL per invoice (reference only)                                                                                          | Editable by financial managers                                                                                            |
| `credit_notes`              | Reductions of one issued invoice, up to its balance                                                                                              | Draft editable; issued: only voided                                                                                       |
| `payments`                  | Cash received; no card or account numbers (checked)                                                                                              | Only reversed, via `reverse_payment`                                                                                      |
| `payment_allocations`       | How much of a payment went to which invoice                                                                                                      | Only reversed (once), via `reverse_allocation` or `reverse_payment`                                                       |
| `refunds`                   | Cash returned from unapplied credit; optional originating payment; processor reference; processed by/at                                          | Only voided, via `void_refund`                                                                                            |
| `financial_events`          | Client-facing and internal event log (`client_visible`)                                                                                          | Append-only                                                                                                               |
| `finance_notes`             | Internal notes; never visible to clients                                                                                                         | Append-only                                                                                                               |

Composite foreign keys keep context common: `(contract_id, engagement_id, currency)` to `contracts`; `(invoice_id, contract_id)`, `(payment_milestone_id, contract_id)`, `(change_order_id, contract_id)`, `(payment_id, contract_id)` for children. Child rows inherit `engagement_id` and `currency` from their parent by trigger.

## Operations (the only way money moves)

Each is `SECURITY DEFINER`, locks the contract row first, checks permission (SQLSTATE 42501), validates (23514), writes events, and re-checks integrity.

| Function                                                                                                  | Who                                                                    |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `execute_contract`                                                                                        | Financial manager who is a Principal Architect or System Administrator |
| `set_contract_status` (active, completed; terminated: executive)                                          | Financial managers                                                     |
| `submit_change_order`, `void_change_order`                                                                | Financial managers                                                     |
| `approve_change_order`, `reject_change_order`                                                             | Client with `approve_change_orders` and `view_financials`              |
| `record_external_change_order_approval`                                                                   | Principal Architect or System Administrator with financial management  |
| `set_milestone_status`, `schedule_invoice`, `issue_invoice`, `void_invoice`                               | Financial managers                                                     |
| `issue_credit_note`, `void_credit_note`                                                                   | Financial managers                                                     |
| `record_payment` (with optional allocations), `allocate_payment`, `reverse_allocation`, `reverse_payment` | Financial managers                                                     |
| `record_refund`, `void_refund`                                                                            | Financial managers                                                     |

"Financial managers" hold `manage_financials` on the engagement: System Administrators, Principal Architects and Finance Administrators portfolio-wide, or an internal member granted it by override. It is internal-only.

`private.assert_contract_integrity(contract)` (also run at commit by deferred constraint triggers) checks: payments not over-applied or over-refunded; reversed payments carry nothing; contract refunds + allocations ≤ payments; invoice credits + payments ≤ total; non-issued invoices carry no allocations or credits; issued totals equal their lines; milestone and change-order billing within the authorized amount, and change-order billing only when approved.

## Read models (security invoker: RLS decides the inputs)

- `contract_financial_summary(contract, as_of)`: every figure in proposal §6.3 plus refunds, net cash received and **net remaining to collect**.
- `invoice_balances(engagement, as_of)`: per-invoice credited, applied, balance, derived payment state, days overdue.
- `milestone_billing(contract, as_of)`: per-milestone billed amount and derived state.
- `portfolio_financial_summary(as_of)`, `finance_engagement_directory()`, `engagement_primary_contract_id(engagement)`.

## Who can see what

| Record                         | Internal financial viewers | Client with `view_financials`                         | Anyone else |
| ------------------------------ | -------------------------- | ----------------------------------------------------- | ----------- |
| Contracts                      | All                        | Not draft or void                                     | Nothing     |
| Change orders and history      | All                        | Submitted and later                                   | Nothing     |
| Milestones                     | All                        | Of visible contracts                                  | Nothing     |
| Invoices, lines, credit notes  | All                        | Issued, and void (with reason)                        | Nothing     |
| Payment links                  | All                        | Only with `pay_invoices`, issued invoice, balance > 0 | Nothing     |
| Payments, allocations, refunds | All                        | Payments and refunds; active allocations              | Nothing     |
| Financial events               | All                        | `client_visible` only                                 | Nothing     |
| Finance notes                  | Internal only              | Never                                                 | Nothing     |
| `finance-documents` storage    | All in the engagement      | Only files attached to client-visible records         | Nothing     |

Internal financial viewers: System Administrators, Principal Architects and Finance Administrators on every engagement; other internal members only with a `view_financials` override. Finance Administrators get no project access from this. Suspending a membership removes financial visibility immediately. Anonymous callers have no privileges on any financial table.

## Tests

`supabase/tests/04_finance_access.test.sql` (who sees and changes what), `05_finance_calculations.test.sql` (every figure and the identities through partial payments, split payment, credit note, prepayment, reversal, bounced payment, refund, negative change order), `06_finance_integrity.test.sql` (double billing, numbering, immutability, guards, composite keys, allocations, credit notes, refunds, card numbers, HTTPS links, current-contract rule, approval provenance, suspension), `99_finance_concurrency.test.sql` (two real sessions racing for the same credit and for invoice numbers).

## Confirmed decisions (2026-09-30)

- Clients keep seeing an invoice after it is voided, marked Void with the void reason (`invoice_is_client_visible` is "issued at some point").
- Finance Administrators manage financials portfolio-wide but never execute contracts; execution and external change-order approvals are for Principal Architects and System Administrators.

## Pre-production operational requirements

Not required for the Phase 2 merge; required before real client money or documents go through the system:

1. Upload UI for receipts, signed contracts and change-order approval evidence (bucket, policies and path columns exist; storage policies need test coverage).
2. Invoice PDFs, generated at issue and immutable.
3. Notification emails: invoice issued, invoice overdue, change order submitted, change order decided.
