# ADR-0052: One triggering change, one primary Edge event

**Status:** Accepted (Phase 7A; approved 2026-09-30)

## Context

Phase 7A proposal (Revision 2) §7 and §29.2 clarification 4; reconciliation finding F3.

The empirical review of the seeded engagements showed that one change produces many conditions. A substantive revision of APP-001 bears on the initiatives that implement it, the criteria in force on them, the Review that examined it and the Deliverable that documents it. Listed rule by rule, that is five alerts about one fact. Kerrick added a principle with the Q29 and Q30 decisions: **one triggering change produces one primary Edge event**, with its consequences grouped beneath it.

## Decision

**Every item carries a trigger key.** Each rule function and `edge_items` compute a deterministic `trigger_key`:

| Trigger type           | Trigger key                                                                    | Event heading                           |
| ---------------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| `substantive_revision` | `rev:` element id `:` the element's latest substantive (or content) version id | "X was revised"                         |
| `status_change`        | `status:` subject id `:` status history row id                                 | "X changed status"                      |
| `evidence_link`        | `evidence:` element id `:` evidence source id                                  | "New evidence on X"                     |
| `decision`             | `decision:` decision id `:` decision version id                                | "X was decided"                         |
| `date`                 | `date:` subject id `:` rule key                                                | The rule's label and the subject        |
| `state`                | `state:` subject id                                                            | "Conditions on X" (or the rule's label) |

Status history rows come from `intelligence_status_changes` and `implementation_status_changes`.

**Grouping is presentation.** One pure function, `groupEdgeItems(items)` in `src/domain/edge/grouping.ts`, turns envelope items into events. Every surface uses it, it is tested directly in `grouping.test.ts`, and no event is stored. Its rules:

1. **Every item belongs to exactly one event:** the event keyed by its `trigger_key`. No item is dropped.
2. **Revisions coalesce per element.** Revision items are keyed on the element's latest substantive version, so several revisions since a consequence's reference point form one event, and a newer revision replaces the event rather than adding another. This holds by construction in the database.
3. **Standing conditions group by subject.** `state` items on one subject share `state:` plus the subject id, so a subject with several standing conditions is one event.
4. **Rule items and matrix consequences merge.** When a rule item and a `change_reaches` consequence fall on the same record under the same trigger, they form one consequence line: the rule's item is shown, with the matrix path from `change_reaches` added (`matrixPaths`).
5. **Different triggers stay separate.** Two revisions that both reach one record are two events; the record's contextual panel shows both.
6. **Hubs collapse.** When two or more `change_reaches` lines pass through the same hub element (an Intended Outcome, system boundary, regulatory factor, governance body or knowledge area, other than the trigger itself), they are shown as one hub group with a count.
7. **An event's tier is the highest tier among its items,** and its order facts are the strongest among its items, each fact taken at its strongest (`strongestOrderKey`, ADR-0058).

**The author's words are quoted, not read.** When the trigger is a revision, the event shows the version's `change_summary` verbatim, labeled as the author's words (ADR-0053).

**Judgment works at both levels.** A person may judge one consequence or the whole event (ADR-0056).

**Clarification recorded during implementation.** The eleven existing Phase 4 and Phase 5 signal rules do not produce trigger keys of their own. `edge_items` assigns one: `status:` plus the latest status history row when the rule's catalog trigger is `status_change` and a status row on `validation_status` or `dependency_status` exists; `date:` when the catalog trigger is `date`; otherwise they **fall back to a state trigger key** (`state:` plus the subject id). New rules do the same where a status history row may be missing (for example `operational_not_validated`, `dependencies_converge` and `materialized_risk_still_threatens` use `state:` when no status row is recorded).

## Consequences

- The Edge lists events, never rules. The user sees the shared trigger first, and each consequence keeps its own basis.
- Because grouping is a pure function over the envelope, changing how events are presented never touches stored data, and every surface groups identically.
- A standing condition cannot appear as a cluster of separate lines on one subject.
- Grouping adds no score, no count to chase and no notification.
