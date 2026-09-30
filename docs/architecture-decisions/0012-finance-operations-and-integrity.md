# ADR-0012: Money moves only through locked database operations; derived states; document numbers

**Status:** Accepted (Phase 2 decisions 4 and 6, adjustment 4, approved 2026-09-30)

## Context

Two people can apply the same credit at once, issue invoices at the same moment, or refund credit that is being applied elsewhere. Application checks alone cannot prevent this.

## Decision

- **Operations.** Every state change that moves money (execute, submit/approve/reject/void change orders, issue/void invoices and credit notes, record/allocate/reverse payments, record/void refunds) is a `SECURITY DEFINER` function in `public` that: marks the transaction as a finance operation; locks the contract row `FOR UPDATE` first, which serializes all money operations on one contract; checks permission with the same helpers RLS uses; validates the transition; writes the change and an append-only event; and calls `private.assert_contract_integrity`.
- **No direct cash writes.** `authenticated` has no insert, update or delete on `payments`, `payment_allocations`, `refunds`, `financial_events` or `change_order_events`. Guard triggers also refuse edits outside an operation (for the service role), and the operation mark is cleared when each operation ends.
- **Deferred integrity.** Constraint triggers (deferrable, initially deferred) re-run `assert_contract_integrity` at commit for every contract a transaction touched: no over-applied or over-refunded payment, no invoice paid or credited beyond its total, issued totals equal their lines, and no milestone or change order billed beyond its amount.
- **Composite keys** enforce common context: a line, allocation, credit note or refund cannot join records from different contracts, engagements or currencies.
- **Derived states.** Invoice payment state (open, partially paid, overdue, paid) and milestone state are computed from records and `as_of`; they are never stored.
- **Immutability.** Executed contract terms, issued invoices and lines, issued credit notes and approved or rejected change orders are never edited. Corrections are new records (change orders, credit notes, reversals, voids with reasons).
- **Document numbers.** `TPL-YYYY-NNNN` and `TPL-CN-YYYY-NNNN` come from `document_number_counters`, incremented in the issuing transaction (row lock). Numbers are unique, sequential and never reused; a voided document keeps its number. Because the counter increments inside the transaction, a failed issue does not consume a number; strict gap-freedom is nevertheless not guaranteed or required (decision 4). The year is the issue date's year.

## Consequences

- `99_finance_concurrency.test.sql` proves with two real sessions that a second allocation or a racing refund waits for the first and is then refused, and that simultaneous issues get distinct, sequential numbers.
- New money operations must follow the same pattern (lock, check, write, assert).
