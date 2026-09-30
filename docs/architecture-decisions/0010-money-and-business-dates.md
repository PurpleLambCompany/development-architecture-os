# ADR-0010: Money in integer minor units; business dates in America/Chicago

**Status:** Accepted (Phase 2 decisions 3 and 5, approved 2026-09-30)

## Context

Financial figures must reconcile to the cent, and "due", "past due" and "today" must not shift with the server's or the browser's clock. Only USD is used at launch, but the schema should not have to change to add a currency.

## Decision

- Every amount is a `bigint` in minor units (`*_minor`, cents for USD) with a `char(3)` currency. There are no floating-point or `numeric` dollar columns. A contract has exactly one currency, and every child record inherits it through composite foreign keys (`contracts (id, engagement_id, currency)`), so amounts in different currencies can never be combined.
- `public.currencies` lists supported currencies; only USD is `enabled`. Contracts in a disabled currency are refused by a trigger.
- The application converts text to minor units only in `src/domain/finance/money.ts` (string arithmetic, never floats) and formats from minor units exactly.
- Business dates are calendar dates in `BUSINESS_TIME_ZONE` (an IANA name, default `America/Chicago`; never "CST"/"CDT"). The server computes today's business date (`getBusinessToday`) and passes it to the read models as `p_as_of`. The database never infers the business date from its own clock for due-date logic.
- Date columns (`due_date`, `issue_date`, `received_on`, …) are `date`; audit timestamps are `timestamptz`.

## Consequences

- Portfolio totals are computed per currency.
- Tests can evaluate "past due" at any date by passing `as_of`.
- Adding a currency is a data change (`enabled = true`) plus a review of formatting, not a migration.
