# ADR-0027: Internal stewardship and controlled categories

**Status:** Accepted (Phase 4 proposal §5.1, §6.2 and §15.6–15.7; approved 2026-09-30)

## Context

Registers need triage (how much attention a record needs now, when to look at it again) without that judgment reaching clients or changing a published version. Portfolio learning later (spec §17) needs categories that compare across engagements; Phase 3 stored assumption and risk categories as free text.

## Decision

- `intelligence_stewardship` holds one row per Project Intelligence record: attention (`critical`, `high`, `routine`, `watch`), triage state, who triaged it and when, and the next review date. It is created with the record, written only by the triage operation, readable by internal readers only, and never part of a snapshot.
- `intelligence_categories` is migration-managed reference data keyed by record kind and key. Assumptions, risks, decisions, recommendations and opportunities reference it through a foreign key on `(kind, category)`. Constraints and dependencies keep their Phase 3 enums as their category. Existing free-text values were mapped to keys, and `other` exists for every kind.
- Category is descriptive and is published with the record; attention is judgment and is not.

## Consequences

- Attention, triage and review dates never reach clients.
- Category keys must stay stable; a label can change, a key cannot.
