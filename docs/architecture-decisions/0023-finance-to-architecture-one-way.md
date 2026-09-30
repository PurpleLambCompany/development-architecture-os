# ADR-0023: Finance may refer to architecture; architecture never depends on finance

**Status:** Accepted (Phase 3 proposal §13 and §15.11)

## Context

Payment state must never control architecture state, and architecture approvals must never move money automatically.

## Decision

- No architecture table has a column or foreign key referring to a finance table, and no architecture operation reads one. A pgTAP test asserts this.
- A later link table `payment_milestone_architecture_links`, owned by the finance side, will point from milestones to element versions or baselines. It is not built in Phase 3.
- Marking a milestone ready to invoice stays a manual finance action.

## Consequences

- Finance and architecture can evolve independently; billing cannot alter what a client sees in the architecture.
