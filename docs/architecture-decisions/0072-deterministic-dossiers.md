# ADR-0072: Deterministic dossiers: the Review dossier and supports and exposures

**Status:** Accepted (Phase 7B.2 Step A; decisions approved by Kerrick 2026-10-01)

## Context

Phase 7B.2 proposal §7 and §8; reconciliation decisions IX-4, IX-5, IX-9 and IX-10, and principles 16 and 22; Kerrick's PD-9 and PD-22.

IX-4 made Prepare the flagship of 7B.2 and its reference pattern: deterministic context assembly, then bounded interpretation. The assembly must be complete and useful with AI unavailable (principle 22), and it is what the `review_brief` interpretation cites. IX-5 and IX-9 declined a Challenge mode and kind; the grounded part of that idea, which records support or expose an element, is a deterministic view (PD-9). IX-10 placed a deterministic Development Brief before any whole-development reading; PD-22 keeps it out of 7B.2.

## Decision

**Two read models, both deterministic.** `public.review_dossier(engagement, review)` and `public.element_supports_and_exposures(engagement, element)` (migration `20261008000500`). Each is `security definer`, `search_path = ''`, read-only (no DML; proven in `50_ai_experience_no_mutation`), executable by `authenticated` only, and requires `private.can_read_architecture` (`P0002` otherwise, so a client receives nothing). Neither reads, returns or depends on any inference, model output, authorisation or Architecture Intelligence capability: every internal reader receives the same rows whatever their AI standing and whatever the engagement's authorisation. They make no external call, write no audit row and spend no budget. Every line names records with reference codes and versions; nothing is summarised, scored or ordered by importance.

**The Review dossier.** A **Dossier** section on the Review page, between Session and Agenda, for scheduled and held Reviews; the Agenda keeps its role. It returns, as one jsonb document:

| Section                     | Content                                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `review`                    | Reference, title, status, scheduled and held times, and the Review's date (held, else scheduled)                                                                                                                                                                   |
| `examined`                  | Each unretired `examines` target in the order recorded: for a held Review, its captured version; for a scheduled Review, its current published version. Each carries its comparison basis (below) and latest version                                               |
| `changes`                   | Per examined element, versions published after the comparison version: substantive revisions with changed paths and the author's change summary, and status publications listed as their own change type                                                           |
| `evidence`                  | Statement and element evidence links on examined elements created after the comparison point, with stance, Evidence title and source type                                                                                                                          |
| `edge`, `edge_judged_count` | Current unjudged Edge items whose subject or trigger subject is an examined element, in tier order (ADR-0058), then governance date; judged items are counted                                                                                                      |
| `criteria`                  | For initiatives that implement an examined element, or are examined themselves: criteria in force (`agreed`), and criteria proposed, agreed or closed since the comparison point                                                                                   |
| `implementation`            | For those initiatives: implementation status transitions, checkpoints achieved, and checkpoints missed (target passed, not achieved), since the comparison point                                                                                                   |
| `unresolved`                | Open Decisions needed on or before the Review's date that are examined or related to an examined element; open intelligence and implementation escalations on examined elements or their initiatives; deferred Edge items whose date falls on or before the Review |

**Comparison points.** Each examined element has one, stated as `compare_basis`:

- `captured_at_hold`: a held Review compares with its own examined-version capture (ADR-0054).
- `prior_review`: a scheduled Review compares with the capture made by the most recent earlier held Review that examined the same element, and names that Review.
- `first_review`: a scheduled Review of an element no held Review has examined; every recorded fact counts as since, and no version changes are listed.
- `no_capture`: a Review held before captures existed (no backfill, OD-6 of Phase 7A) has no comparison point and says so; every recorded fact counts as since.

**Stable enough to cite.** The `review_brief` anchor (`get_review_context`) supplies the examined set, revisions since, open Edge items, criteria in force and decisions due. With the version 2 plan the brief may also request evidence and implementation state (ADR-0071, PD-13b), so it can cite what the dossier shows; it can cite only what the reader can already see in layer 1.

**Supports and exposures (PD-9).** A **Supports and exposures** panel on the element page, also the layer-1 basis for Examine bearing. It returns:

| Section       | Content                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evidence`    | Every element and statement evidence link on the element, with stance, Evidence title, source type and date, whether a summary is recorded, and when linked; supporting first, then contradicting, then the rest |
| `assumptions` | Live Assumptions that `underpin` the element, with their validation status and whether each has any supporting evidence                                                                                          |
| `risks`       | Live Risks related to the element by any unretired typed relationship whose status is `open` or `mitigating`, with severity as recorded                                                                          |
| `edge`        | Current Edge items whose subject is the element, in tier order                                                                                                                                                   |

Stances, statuses and severity are the recorded values. Nothing is weighed, netted or scored; "exposure" means only that a record is there to be examined.

**Out of scope (PD-22).** The deterministic Development Brief is separate later work. No whole-development reading, Challenge mode or kind is built.

## Consequences

- A Review can be prepared from exact records with AI off, unauthorised, unevaluated or failing; the interpretation, when available, sits beside the dossier and never replaces it.
- A Researcher, Project Administrator or Finance Administrator sees the same dossier and panel as a Principal Architect. Clients continue to see only their published Review snapshot; no client surface, policy or snapshot changes.
- The dossier is always current; a kept brief that has gone stale is shown dimmed in the Review drawer's layer 2 with its stale reasons in plain words (proposal §21 placed the label above the dossier on the page; the implementation keeps every interpretation, stale or not, inside the drawer).
- Implementation notes: the dossier lists status publications and first publications under `changes` with their change type, and lists evidence, criteria and implementation facts in full when there is no comparison point (`first_review`, `no_capture`); supports and exposures counts a Risk as related through any unretired relationship, not only Risk-specific ones.
