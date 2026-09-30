# Phase 7A end-of-phase report: Deterministic Development Edge

Status: implemented on PR #9 (branch `phase-7-conceptual-reconciliation`), verified and browser-accepted by Claude, **awaiting Kerrick's final acceptance. Not merged.** Phase 7B remains on hold.

Kerrick approved [`PHASE_7A_PROPOSAL.md`](PHASE_7A_PROPOSAL.md) Revision 2 and authorized implementation on 2026-09-30, with Q1–Q30 (from [`PHASE_7_CONCEPTUAL_RECONCILIATION.md`](PHASE_7_CONCEPTUAL_RECONCILIATION.md)) and OD-1–OD-10 authoritative. No approved decision was redesigned. Nothing found during implementation was a contradiction, security problem, data-integrity problem or hard-to-reverse architectural requirement, so nothing was escalated; the clarifications made within the approved design are listed in §8.

## 1. What was built

### Database (the authority for every rule)

- **Rule catalog and impact matrix** (ADR-0051, ADR-0055). One catalog row per rule: the 31 new deterministic conditions (32 candidates, with D-26 and D-27 as two variants of `method_basis_superseded`), the 11 existing Phase 4/5 signals consumed with their semantics unchanged, and `change_reaches`. Each row carries its lens, epistemic status, scope, trigger type, fingerprint basis, resolving act and default tier. The governed relationship-impact matrix covers the 39 relationship types and every off-spine link, with direction, propagation mode and assessment. The TypeScript mirrors are drift-tested against the database.
- **Substantive revision** (ADR-0053, Q30). `element_revisions` classifies every published version as first publication, substantive revision or status publication by comparing governed snapshots, excluding an explicit, type-aware list of lifecycle and status paths (maturity excluded, OD-1). `change_summary` is never parsed; it is only shown, verbatim, as the author's words.
- **Review examined-version capture** (ADR-0054, OD-7). `hold_review` writes the exact version of every examined element into `review_examined_versions` using system time. Captures are immutable. After hold, a new `examines` is refused and an existing one cannot be retired; further examination needs a later Review. The seed was re-sequenced so nothing adds `examines` after hold. Captures are not baselines, and Reviews held before 7A are not backfilled (OD-6).
- **Criterion agreement time** (OD-2). `acceptance_criteria.agreed_recorded_at` is the system time of the agreement operation; `agreed_on` stays the business date the user enters. Existing agreements are backfilled from their activity record.
- **Development changes** (ADR-0057). `development_changes` is a curated read model over `activity_log` (revisions, status publications, decisions, holds, validations, agreements, approvals, checkpoints, application closures and more), without exposing the log itself.
- **Impact trace** (ADR-0055, OD-8). `impact_trace(element, mode)` is authoritative: matrix direction only, four recursive walks at depth at most 2, terminal hops, never-traversed links, off-spine joins (criteria, Method Applications, evidence, approvals, client requests, dependencies and more) and hub reporting. No generic bidirectional traversal. `intelligence_impact` and `implementation_impact` remain for backward compatibility, are commented as legacy, and are no longer called by the application.
- **Edge items** (ADR-0051, ADR-0052, ADR-0058). `edge_items` computes every item at read time in one envelope: lens, one epistemic status, subject, basis references with versions where compared, trigger, trigger key, consequence path, fingerprint, resolving act, tier, tier reason and order facts. Nothing is stored except judgments, briefing marks and captures. Tiers are Human-flagged (only a person's open escalation or critical attention), Elevated (governance within the 14-day horizon, OD-4), Attention and Ambient.
- **Judgments** (ADR-0056, OD-9). `edge_judgments` is append-only: investigating, not material, deferred (with a return date), disagree and promoted. A judgment holds while the item's fingerprint holds; a changed fact brings the item back. Whole-event judgment is one transaction. Existing Phase 4/5 signal dismissals keep working and appear as judgments. Judging requires `edit_architecture`.
- **Briefing watermark** (ADR-0057, OD-10). `edge_briefing_marks` holds one private "briefed through" time per user and engagement, set only by the explicit `mark_briefed_through` act, never logged, and readable only by its owner. Without a mark the briefing covers the prior 14 days and says so. Nothing records page views, reading behavior or time on page.
- **Practice counts** (ADR-0059, OD-5). `method_practice_counts` returns stage treatments, co-use and Standards informing agreed criteria as counts with their n. A proportion is returned only from 5 closed applications of a version. No engagement or client name, free text, score or rank.

### Application

- **Development Edge page** (`/internal/engagements/[slug]/edge`): "Since you last reviewed" (changes and new events since the private mark, folded when long, with "Mark reviewed through" the newest change shown); lens and kind-of-claim filters; human-flagged events in their own panel; "To consider", ordered by governed facts with every position explained; a judged view. One triggering change is one event, with its consequences grouped beneath it, hubs collapsed, "Why this is here" and "What would resolve it".
- **Contextual surfaces** (§16): Bearing on this element (open records, then Edge events and the served-outcomes fact); Impact trace on `impact_trace`, grouped by category with weak links labeled; Correspondence on initiatives; "Since this Review was held" and "Before this Review" with the captured version of each examined element; Currency on Deliverables; "Reflected in architecture?" on Decisions; "This evidence bears on" on evidence sources; Practice conditions on Method Applications; "Revised since the latest judgment" on domain pages; "In practice" counts on Method Assets.
- **Engagement overview and landing**: an Edge summary showing only human-flagged and elevated events, and "Engagements with something to consider". The Signals page links to the Edge.
- **Judging and promotion**: per line, or the whole event on the Edge page. Promotion opens the ordinary record form pre-filled, creates nothing until submitted, re-checks that the item is still current, records the `promoted` judgment naming the new record and opens it.

## 2. Files changed

About 80 files across 7 implementation commits on PR #9 (`129911c`…). Eleven migrations, nine ADRs with four amendment notes, thirteen new pgTAP suites, seven Vitest suites under `src/domain/edge/`, a new `src/components/edge/` module, one new internal route, and changes to the element, initiative, Review, Deliverable, evidence, Method Application, Method Asset, domain, engagement, landing, Signals and Project Intelligence pages. The demo seed is extended and re-sequenced in `supabase/seed.sql`.

## 3. Schema changes

Eleven migrations, in order:

- `20261006000000_phase7a_edge_catalog.sql`
- `20261006000100_substantive_revisions.sql`
- `20261006000200_review_examined_versions.sql`
- `20261006000250_criterion_agreement_time.sql`
- `20261006000300_development_changes.sql`
- `20261006000400_impact_trace.sql`
- `20261006000500_edge_rules.sql`
- `20261006000600_edge_items.sql`
- `20261006000700_edge_judgments.sql`
- `20261006000800_edge_briefing_marks.sql`
- `20261006000900_practice_counts.sql`

Detail is in [`docs/database/edge.md`](../database/edge.md).

## 4. Security / RLS changes

- **Nothing new reaches a client.** Every new function checks internal access and returns nothing to a client (tested per function); every new table has internal-only or owner-only policies. No client read model, page or policy changed.
- Engagement isolation holds for every item, trace, change, judgment, capture and mark.
- Judging and promoting check `edit_architecture`; the briefing mark needs only read access and is private to its owner. No role-name checks.
- Captures and judgments are written only by security-definer operations; judgments are append-only; captures are immutable.
- Practice counts are internal-only and name no engagement or client.

## 5. Tests and checks performed

| Check                      | Result                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm db:test` (pgTAP)     | 46 files, 1,586 assertions, all pass (before 7A: 33 files, 1,320). New: 13 suites, 266 |
| `pnpm check` (Vitest)      | 28 files, 220 tests, all pass (41 new in `src/domain/edge/`)                           |
| `pnpm check` (lint, types) | ESLint, `next typegen` + `tsc --noEmit` and Prettier all clean                         |
| `pnpm build`               | Production build succeeds                                                              |
| `pnpm db:types`            | Regenerated types match the migrations                                                 |
| CI on PR #9                | Recorded in the PR; see the final report in the thread                                 |

The new pgTAP suites cover migration integrity, the catalog and its TypeScript mirror, every rule's firing and non-firing cases, the 11 signals unchanged, rule scopes, substantive versus status-only revisions and excluded-path drift, capture at hold, refusal of post-hold `examines`, historical Reviews without capture, impact direction, recursion limits, off-spine impact, the envelope and fingerprints, judgments and existing dismissals, watermark privacy and the 14-day first briefing, development changes, practice thresholds, criterion agreement time, client denial for every new function and table, and concurrency. The Phase 1–6 suites all pass unchanged in behavior; three seed-count assertions were updated for the added seed records.

## 6. Browser acceptance

Performed in Chromium against the seeded local stack, as Principal Architect, Architect, System Admin, Researcher, and two Harbor client users. Every page rendered without console or page errors.

| Scenario | Result                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1       | IMP-001 v2 and IMP-002 v2 classify as status publications; no Change item and no `criteria_predate_revision`                                                               |
| S2       | REV-001 capture uses system time; its only revision item comes from APP-001's real revision; the agenda says IMP-002 has only status publications since                    |
| S3       | One event "APP-001 Regional Expansion Council was revised" with IMP-001, IMP-003, ACR-001, ACR-002, REV-001, DLV-001 and REV-002; closed MUS-001 not reached               |
| S4       | One KNW-001 event carrying "Validated before KNW-001 was revised" on IMP-002                                                                                               |
| S5       | APP-001's and IMP-001's events are Elevated with "REV-002 is scheduled for October 7, 2026"                                                                                |
| S6       | One CAP-004 event; CAP-001 reached through `requires` upward; nothing recursive through `serves`                                                                           |
| S7       | Judging the APP-001 event Not material removed it from the list; the judged view shows the act once; publishing v3 brought every item back                                 |
| S8       | Marking reviewed emptied the Principal's briefing; the Architect's was unaffected; `activity_log` unchanged (851 rows before and after)                                    |
| S9       | Setting ASM-001's attention to critical moved its condition into the human-flagged panel, reason "The team marked it critical"                                             |
| S10      | Harbor lead and sponsor are redirected from every internal Edge route to their portal; no portal page shows Edge content; every new function returns 0 rows to them        |
| S11      | With `edit_architecture` withdrawn, the Researcher reads the Edge and panels with no Judge or Promote controls; the System Admin (not a member) reads without judging      |
| S12      | Capability Readiness Diagnostic 1.1 shows stage counts with "n = 1 closed application" and "Fewer than 5 closed applications (n = 1); no proportion is shown"              |
| S13      | Materializing RSK-001 raised its condition; Promote opened a pre-filled Decision form; submitting created DEC-002, opened it, and the item now reads "Promoted to DEC-002" |
| S14      | CAP-001's Impact trace includes RSK-001 and CAP-005                                                                                                                        |
| S15      | Adding or retiring an `examines` on held REV-001 is refused with the closed-agenda reason; relationships and capture unchanged; REV-002 examined KNW-001 normally          |
| S16      | Agreeing ACR-003 with "applies from" 2026-09-15 stored `agreed_on` 2026-09-15 and `agreed_recorded_at` at the operation's system time                                      |

**Contextual flow.** As the Architect: APP-001 element page, then Project Intelligence, the IMP-001 initiative, Evidence, Reviews, REV-001 and the Development Edge, following in-page links. Each surface uses the same panels, reference codes, tags and navigation as the rest of the workspace; the Edge reads as a tab of the engagement, not a separate dashboard.

## 7. Defects found and fixed

During browser acceptance:

1. Marking the briefing reviewed re-showed the newest change, because the mark lost microseconds in a JavaScript `Date`. The mark is now passed and stored exactly as the database wrote it (unit test added).
2. Contextual panels offered "Judge all" for an event whose other lines they do not show. Whole-event judgment now appears only on the Edge page.
3. The Review panel showed only the Review's own items. It now covers its agenda: escalations, decisions due and approvals on examined elements.
4. The Review agenda showed "now version 2" without saying whether that was a real revision; it now says "revised substantively since" or "with status-only publications since".
5. An event judged in one act repeated the same judgment on every line; it is now shown once. The judged view is one list.
6. Promoted items said "promoted to a governed record"; they now name the record ("Promoted to DEC-002").
7. Consequence lines began in lower case ("is an agreed criterion…"); they are sentence-cased.
8. Off-spine lines repeated their reason after already saying it.
9. A line merging two rules showed an empty "Also on the impact trace:"; it now lists the other rule's words.
10. The first briefing listed every seeded change in full; it now folds after two changes per record and eight records.
11. The Method Application panel description named rules it does not carry; stage treatments are ordered followed, adapted, skipped.

Before browser acceptance, the full suite caught formatting drift in six committed Edge modules (fixed), and building the database tests surfaced fixture and enum mistakes in the tests themselves, not product defects.

## 8. Clarifications within the approved design

1. `method_basis_superseded`'s `release_moved` variant has the engagement as subject: one item listing the affected open applications (§4.3).
2. The criterion agreement-time migration is numbered `…000250` so it runs before the read models that use it.
3. Elevated applies only to non-Ambient items; an Ambient condition stays in context even near governance.
4. A Deliverable without a baseline is compared against its latest approval (DLV-001 in the seed).
5. The 11 existing signal rules have no triggering change, so they use a state trigger key per subject.
6. Seed activity rows share one transaction timestamp, so several seed changes show the same time.
7. `development_changes` dates "Review scheduled" from the Review's insert record.
8. The D-38 served-outcomes fact is shown from one Intended Outcome, as a fact, never a condition.
9. Internal capability overrides have no page in the application today (the matrix manages client members), so S11's withdrawal of `edit_architecture` from the Researcher was set up in the database, as the pgTAP suite does.

## 9. Explicit Phase 7B exclusions

Confirmed absent: LLM or AI provider integrations, provider SDKs, prompt execution, embeddings, vector stores, persisted AI inference, conversational AI, cross-engagement learning or recurrence, Pattern Library functionality, Portfolio Intelligence, client-facing Architecture Intelligence, generic notifications, productivity monitoring and opaque scoring. No dependency was added (`package.json` unchanged). Every Edge item is produced by a rule over governed records, and Phase 7A is fully useful without an LLM.

## 10. Known limitations

- Items are computed on read. On the seed this is fast; very large engagements may later want a materialized cache, which the envelope permits without changing semantics (§20).
- Reviews held before 7A have no capture, so their "since held" comparisons are unavailable (OD-6).
- Internal capability overrides still have no management page (pre-existing).

## 11. Recommended next step

Kerrick's final acceptance pass over S1–S16 on PR #9, then merge on his explicit approval. Phase 7B stays on hold until he reopens it.
