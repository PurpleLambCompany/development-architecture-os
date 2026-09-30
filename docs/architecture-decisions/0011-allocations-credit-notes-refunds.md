# ADR-0011: Price, billing and cash are separate; allocations, credit notes and refunds

**Status:** Accepted (Phase 2 proposal §3–§6 and approved adjustments, 2026-09-30)

## Context

A contract balance, an invoice balance, unapplied credit and the remaining contract value are different questions. Combining them hides errors: a prepayment silently reduces "due", a credit note looks like a price change, a refund disappears.

## Decision

Three groups of records, none of which silently changes another:

- **Price:** `contracts`, `change_orders`. Only approved change orders change the revised contract value.
- **Billing:** `payment_milestones` (the plan), `invoices` and `invoice_lines` (bills), `credit_notes` (reductions of one issued invoice, never beyond its balance).
- **Cash:** `payments` (cash received), `payment_allocations` (which invoice each part paid), `refunds` (cash returned from unapplied credit).

Rules:

- A payment is applied only by an explicit allocation. Unapplied cash is "credit on account" and is never subtracted from amounts due.
- Allocations are never edited; they are reversed (with a reason) and re-applied. A bounced payment is reversed with all its allocations.
- A refund is allowed only up to the contract's unapplied credit, and, when it names a payment, up to that payment's unapplied amount. A payment with a completed refund cannot be reversed until the refund is voided. Completed refunds are voided with a reason, never edited or deleted.
- Anti-double-billing: the issued lines billing a milestone, or an approved positive change order, may never total more than its amount. Partial billing is allowed. A line bills a milestone, a change order, or neither, never both. Checked on issue and by a deferred integrity trigger.
- Figures are defined once, in `public.contract_financial_summary`, including **Net Remaining to Collect** = revised contract value − (payments received − refunds). It is shown beside, never instead of, invoice balance, currently due, past due and remaining to invoice.

## Consequences

- Correcting a mistake always leaves a visible trail.
- Identities are testable and tested (`05_finance_calculations.test.sql`): remaining contract balance = remaining to invoice + outstanding balance; outstanding = currently due + not yet due; received = applied + unapplied + refunds; net remaining to collect = remaining contract balance − unapplied credit.
