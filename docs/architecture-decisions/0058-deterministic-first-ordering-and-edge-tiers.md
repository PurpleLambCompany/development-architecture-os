# ADR-0058: Deterministic-first ordering and Edge tiers

**Status:** Accepted (Phase 7A; approved 2026-09-30)

## Context

Phase 7A proposal (Revision 2) §8, §9 and §16; reconciliation decisions Q9, Q21, Q22 and Q24; Kerrick's OD-4.

The Edge must put first what most needs a person's attention, without a score. Q9 decided prioritization is deterministic-first: no weighted sum, no numeric importance, no stored rank, and every position explained. Q22 decided the top tier is exactly the human-set states and must be named so it does not read as a rule or AI output. The proposal merged two candidates into ordering: D-35 (a critical premise unsupported) into the tier, and D-34 (a constraint reaching several paths) into reach.

## Decision

**Tiers.** `edge_items` computes one tier per item from governed facts, with a reason code:

| Tier            | Label shown                                | Placed here by                                                                                                                                                | `tier_reason`                                 |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `human_flagged` | "Escalated or marked critical by the team" | **Only** human-set states on the subject or trigger subject: stewardship attention `critical`, or an open escalation (Project Intelligence or Implementation) | `attention_critical`, `open_escalation`       |
| `elevated`      | "Governance approaching"                   | Stewardship attention `high` on the subject or trigger subject (D-35), or a governance date within the horizon                                                | `attention_high`, `governance_within_horizon` |
| `attention`     | "To consider"                              | The item's rule tier is `attention`                                                                                                                           | `rule_default`                                |
| `ambient`       | "In context"                               | The item's rule tier is `ambient`                                                                                                                             | `ambient_rule`                                |

- No rule can produce `human_flagged` by itself. An `escalation_before_review` item is human-flagged because its open escalation is a human act, not because the rule says so. The word "critical" appears only where it quotes the human-set attention value.
- **The horizon is 14 days** (OD-4): `private.edge_horizon_days()`, a governed constant, not user-configurable. A governance date counts when it is on or after the business date and no later than the business date plus 14 days.
- Governance dates, taken on the subject or trigger subject, are anticipation facts in business dates: a scheduled Review that examines it (or the Review itself), a decision `needed_by` while open or recommended, an unachieved checkpoint target, and an open client action's due date.
- **Clarification recorded during implementation:** the Elevated tier applies **only to non-ambient items**. An Ambient item stays Ambient whatever its governance dates or attention, so it never leaves the contextual panels on those grounds. The same holds for the human-flagged tier: Ambient is checked first, so an Ambient item on a record a person has flagged stays in context (§16: Ambient items appear in contextual panels and nowhere else). The one exception is the `release_moved` variant of `method_basis_superseded`, which the proposal lists at Attention.

**Where each tier appears.** The Engagement Edge lists events at Attention and above, with human-flagged events set apart at the top by position and a rule line, not by color. The engagement overview's Development Edge section shows only human-flagged and Elevated events. Ambient items appear only in contextual panels (element, initiative, Review, Deliverable, decision, evidence and Method Application pages), which show everything bearing on the record and group it with `groupEdgeItems` (ADR-0052).

**Order within a tier** is lexicographic over facts returned in `order_facts`:

1. **Governance proximity:** nearest recorded governance date first.
2. **Reach class:** 1 active implementation reached, 2 published architecture reached, 3 an Intended Outcome reached, 4 other. When the subject is an in-force constraint that constrains initiatives (directly or through what they implement), the count is returned as `constrained_initiatives` and the item takes reach class 1 (D-34).
3. **Responsibility:** items bearing on records the reader holds come first. Responsibility is structural only: element owner, decision owner, initiative owner, Review participant, Method Application practitioner or client action addressee.
4. **Recency:** later `trigger_at` first.
5. **Reference code,** then a stable final key (`rule_key` in SQL, `item_key` in the application).

`edge_items` sorts by these keys, and `src/domain/edge/ordering.ts` implements the same comparison once (`orderKeyOf`, `compareOrderKeys`, `strongestOrderKey` for events) for every surface, tested in `ordering.test.ts`. `describeOrderFacts` renders the facts as the "Why this is here" line ("REV-002 is scheduled for ...", "Reaches active implementation", "Constrains 2 initiatives", "You hold responsibility here").

**Nothing is scored.** There is no weighted sum, numeric importance, health or quality value, or stored rank. The same inputs always give the same order.

**What never affects order:** AI (none exists), anyone's judgment history, how often a rule fires, time since a record was last touched (Phase 5 D16, Q21), and anything about another engagement.

## Consequences

- Every position on the Edge can be stated in words from governed facts, and the top of the list is always a human's call.
- The internal landing lists engagements alphabetically, never by how much they have, with no totals across engagements.
- Changing the horizon or the order is a migration and a code change with tests, not a setting.
- Phase 7A has no AI, no scoring of people, developments or architecture, no notification, badge or unread count, and no cross-engagement comparison.
