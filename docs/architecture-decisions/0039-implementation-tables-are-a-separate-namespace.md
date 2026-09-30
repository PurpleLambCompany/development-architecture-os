# ADR-0039: Implementation's tables are a permanent, separate namespace from Project Intelligence

**Status:** Accepted (Phase 5 proposal §7.3, §21, decisions D2/D14; approved 2026-09-30)

## Context

Implementation needs the same stewardship/triage, append-only history, and escalation pattern Phase 4 established for Project Intelligence records (ADR-0027, ADR-0028, ADR-0032). Round 1 of this proposal recommended widening Phase 4's tables to also cover Implementation Initiatives; Kerrick's round-2 review reversed that bet in favor of Implementation owning its own tables outright, reasoning that Implementation is a distinct layer (realization) from Project Intelligence (judgment), even though the two record kinds share a pattern.

## Decision

- `implementation_stewardship`, `implementation_status_changes` (with its own `guard_implementation_log` trigger, a separate instance of the mechanism guarding `intelligence_status_changes`), and `implementation_escalations` are new tables, structurally identical in shape to their Phase 4 counterparts but physically separate — never rows in `intelligence_stewardship`, `intelligence_status_changes` or `intelligence_escalations`.
- `implementation_categories` is likewise its own migration-managed reference table, not an extension of `intelligence_categories`.
- `implementation_signals()` is its own function, separate from `intelligence_signals()`, and `implementation_initiative` is excluded from `intelligence_register()` — Implementation has its own register (`implementation_register`), not a row type inside Project Intelligence's. `implementation_signal_dismissals` (mirroring `intelligence_signal_dismissals`, ADR-0032) is a further own table this same principle required, dismissing an implementation signal never touching Project Intelligence's dismissal table.
- **Exception, explicitly confirmed by Kerrick:** `client_actions` (ADR-0029) is reused directly for client-executive implementation escalations. It was already kind-agnostic about its subject before Phase 5, so this is not the same kind of sharing D2 ruled out — no duplicate implementation-specific client-action mechanism was built.

## Consequences

- Project Intelligence and Implementation can evolve independently — a Phase 6+ change to one's stewardship or signal shape never risks the other.
- This is the more expensive direction to reverse: if a future phase decides the two should in fact share tables, merging two independently-evolved table sets is a larger migration than the reverse (splitting a shared table) would have been. This was accepted knowingly in exchange for keeping the intelligence and implementation layers conceptually and physically distinct, per Kerrick's stated boundary between them.
