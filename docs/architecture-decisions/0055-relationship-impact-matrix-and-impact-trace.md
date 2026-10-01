# ADR-0055: Relationship impact matrix and impact trace

**Status:** Accepted (Phase 7A; approved 2026-09-30)

## Context

Phase 7A proposal (Revision 2) §10 and §29.2 clarification 2; reconciliation §13.4 (the direction matrix) and finding F6; Kerrick's OD-8.

Phases 4 and 5 each built an impact trace, `intelligence_impact` and `implementation_impact`. They follow relationships without a governed view of direction, so the empirical review found consequences they miss (a Capability's `threatens` risk and `gap_in` capability) and hops they should not take. A change to a whole bears on its parts; a change to a part rarely invalidates the whole. Impact for the Development Edge has to follow a governed, explainable, bounded direction matrix, not a free graph traversal.

## Decision

**The governed matrix.** `public.relationship_impact_rules` has one row per link and direction: every one of the 39 relationship types and 17 off-spine link keys (for example `dependency_ends`, `acceptance_criteria_governed`, `client_action_subjects`, `method_application_elements`, `baseline_items`), each in `source_to_target` and `target_to_source`. Columns: `assessment` (`yes`, `weak`, `no`), `propagation` (`direct`, `recursive`, `terminal`, `never`), `max_depth` (0 for never, 1 for direct and terminal, 2 for recursive), `edge_eligible` (generated: `yes` and not `never`), `hub_target`, an optional `condition` and a plain-language `reason`. It is written only by migrations and read by internal users. Migration checks fail if any relationship type lacks a row in either direction, or if any row other than the three listed below recurses. `src/domain/edge/impact-matrix.ts` mirrors it and `impact-matrix.test.ts` asserts that the mirror matches and that every vocabulary relationship type is covered in both directions.

**Four recursive walks, each capped at depth 2.**

| Walk                           | Direction                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `part_of`                      | Downward: whole to parts to sub-parts                                                 |
| `specializes`                  | Downward: general to specializations                                                  |
| `requires`                     | Upward: required to requirers                                                         |
| `underpins` (invalidated only) | Assumption to targets, then the targets' `requires` (upward) and `part_of` (downward) |

Every other Yes link is direct: one hop. The `underpins` walk is recorded as a direct `source_to_target` row with the condition `recurse_when_invalidated`; `impact_trace` continues it only when the starting element is an invalidated Assumption.

**Terminal hops.** At the starting element and each reached element, the trace joins without traversing further: incoming `implements` from live initiatives (categorized as active implementation when `not_started`, `in_progress`, `operational` or `stalled`), incoming `examines` from scheduled Reviews and held Reviews with a capture of the element (ADR-0054), incoming `documents` from live Deliverables, agreed criteria governing the element or an initiative that implements it, open client actions with the element as subject, unhandled client contributions, and open Method Applications that `examined` it. Terminal hops add no depth and never continue.

**Never traversed.** `supersedes`, `raises`, `validates`, baseline items, `validation_criteria`, closed Method Applications, record domains, member areas and every other row with `propagation = 'never'`.

**Depth and cycles.** Maximum architecture depth is 2 in every mode, with no user-selectable depth. Cycles are cut by path. A record reached by more than one path is reported once, with its shortest path (and a Yes link preferred over a Weak one at equal depth).

**One function, two modes.** `public.impact_trace(p_element_id, p_mode)`:

- `on_demand`: "What would be affected if this changed?" Includes Weak links (labeled "may bear on"), plus evidence cited on reached elements, method lineage (practice awareness, never architecture impact) and pending approvals. The element and initiative pages' Impact trace panels read it.
- `edge`: Yes links only. `private.edge_change_reaches` calls it from each live element's latest substantive revision (ADR-0053) and from each invalidated Assumption's latest invalidation, and emits a `change_reaches` consequence for each reached element, criterion or client action. A consequence is resolved when the reached element has its own content version or approval after the trigger, a Review captured the trigger element after it, a criterion was agreed after it, or a client action was sent after it; judgments are applied by the envelope (ADR-0056).

Each result carries its `category`, `depth`, `via_element_id`, `link_key`, `direction`, `assessment`, `propagation`, `reason`, a `path` of steps, and `hub_element_id` when the step came through a hub element (an Intended Outcome, system boundary, regulatory factor, governance body or knowledge area), which the grouping collapses (ADR-0052).

`impact_trace` is `security invoker`: called directly, RLS applies to every row it reads, and it returns nothing to a user who cannot read the engagement's architecture. Inside `edge_items` it runs within that function's engagement check.

**`impact_trace` is authoritative (OD-8).** `intelligence_impact` and `implementation_impact` stay in the database, unchanged, for backward compatibility only. Their SQL comments mark them as legacy internal read paths and "not an alternative definition of impact". **The application no longer calls them:** the guard test `src/domain/edge/legacy-impact.test.ts` fails if any application source file names either function, and asserts that the element and initiative pages read `impact_trace` through `getImpactTrace`. Removing them, or turning them into wrappers, is a later cleanup with its own ADR.

## Consequences

- Impact is bounded, explained in words at every hop, and the same for the Edge and the on-demand trace, differing only in whether Weak links and reference joins are shown.
- The F6 omissions are reached (for example RSK-001 through `threatens` and CAP-005 through `gap_in` from CAP-001).
- The matrix is governed data: changing a direction or a propagation is a migration with its mirror and tests.
- There is no generic graph traversal, no graph visualization and no cross-engagement reach. Nothing is scored.

## Amendment (Phase 7B.2, 2026-10-01): impact_trace runs as its owner

Phase 7B.2 browser acceptance found that `impact_trace` timed out for an Architect. As a security-invoker function it re-ran the RLS policy of each of the twenty tables it reads for every row. On the seed's Meridian engagement, one call took about 4.5 seconds for a Principal Architect and about 9 seconds for an Architect (whose policies resolve an engagement role per row). That is past the 8-second statement timeout for signed-in users, so most Meridian element pages failed for Architects. The same call takes about 20 ms without per-row policies.

Kerrick approved the fix on 2026-10-01. Migration `20261008000700_impact_trace_definer.sql` makes the function `security definer` and changes nothing else: the body, the walk, the modes and the grants are as decided above.

- **Access is unchanged.** The start element is read only when `private.can_read_architecture` holds for its engagement. Every other row the walk reads is joined to that start: its engagement, an element reached from it, or a record on one. For a reader who can read the engagement's architecture, every policy on those tables already reduces to `can_read_architecture` of the row's engagement. The function therefore returns exactly what the invoker version returned to that reader, and nothing to anyone else, clients included.
- **Proven, not argued.** `51_impact_trace_definer` recreates the invoker version from the live body. It compares both versions row for row for all 17 seed users (six internal roles, ten client members, one external advisor), over Meridian and Harbor subjects in both modes, and asserts that clients see nothing and that grants are unchanged. `32_impact_trace` still passes unchanged.
- After the change, the Architect's call takes about 30 ms. Pages that show the trace also share one call per request with the trace drawer.
