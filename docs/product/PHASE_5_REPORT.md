# Phase 5 end-of-phase report: Reviews, Deliverables and Implementation

**Branch:** `phase-5-reviews-deliverables-implementation` · **Pull request:** #5 (not merged; awaiting the owner's final review and merge instruction) · **Date:** 2026-09-30

**Scope:** the approved Phase 5 proposal (`docs/product/PHASE_5_PROPOSAL.md`), with Kerrick's D1–D16 decisions recorded below, built in the proposal's §23 order.

**Not built:** anything outside Reviews, Deliverables and Implementation — no AI/Architecture Intelligence, Executive Review beyond what Reviews already covers, Method Library, portfolio analytics, certification or licensing functionality (per `CLAUDE.md`), and no generic project-management, kanban, percentage-complete, arbitrary-subtask or duplicate risk/decision functionality (per Kerrick's explicit boundary).

## D1–D16 decisions (Kerrick, 2026-09-30, final approval on the revised proposal)

| #   | Decision                                                                                          | Outcome                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Three new element kinds on the spine (review/REV, deliverable/DLV, implementation_initiative/IMP) | **Yes**, as proposed                                                                                                                          |
| D2  | Implementation's stewardship/history/escalation/categories                                        | **Own tables**, physically separate from Phase 4's, never shared (reversal of round 1's original recommendation)                              |
| D3  | Implementation excluded from `intelligence_register`                                              | **Yes**, as proposed — Implementation has its own register                                                                                    |
| D4  | Reference prefixes REV/DLV/IMP                                                                    | **Yes**, as proposed                                                                                                                          |
| D5  | Review → Implementation relationship name                                                         | **`validates`** (not `verifies`), written only by `record_review_validation`                                                                  |
| D6  | Three new capabilities as proposed                                                                | **Yes**, as proposed                                                                                                                          |
| D7  | Deliverable status fully derived                                                                  | **Yes**, as proposed                                                                                                                          |
| D8  | Implementation status definitions and the `validated` gate                                        | **Yes**, precise definitions in the proposal §7.2; `validated` unreachable without a prior qualifying `validates` relationship                |
| D9  | Milestones/checkpoints                                                                            | Sub-initiatives (`part_of`) for separable efforts; a new subordinate-record **Implementation Checkpoint** for in-initiative conditions/events |
| D10 | `view_confidential_deliverables` defaults                                                         | **As-is**, no change                                                                                                                          |
| D11 | Signal rules                                                                                      | **Yes** — one signal at launch (`implementation_past_target`); no inference of "stalled" from elapsed time alone                              |
| D12 | Phase 5 framing per Kerrick's brief                                                               | **Yes**, as proposed                                                                                                                          |
| D13 | `validates` written only by `record_review_validation`, never a free-form insert                  | **Yes**                                                                                                                                       |
| D14 | Implementation's tables are a permanent, separate namespace from Phase 4's                        | **Yes**, per D2                                                                                                                               |
| D15 | Implementation Checkpoints are subordinate records, not a fourth element kind                     | **Yes**                                                                                                                                       |
| D16 | `implementation_past_target` is the only implementation signal built now                          | **Yes**, per D11                                                                                                                              |

One further explicit instruction: the existing generic `client_actions` system (Phase 4, ADR-0029) is reused directly for client-executive implementation escalations — no duplicate implementation-specific client-action mechanism was built.

Each is reflected in the migration, capability defaults, seed data and pgTAP suites below, and in ADR-0034 through ADR-0039 for the decisions Kerrick identified as difficult to reverse.

## 1. What was built

### Database (the authority for every rule)

- **Vocabulary.** Three new element kinds (`review`/REV, `deliverable`/DLV, `implementation_initiative`/IMP) on the existing spine (ADR-0013), and six new relationship types (33 → 39): `examines`, `raises`, `documents`, `implements`, `initiates`, and the restricted-write `validates`. See ADR-0034.
- **Enums** (`20261003000000_phase5_enums.sql`): the three `element_kind` values, `review_type`, `review_status`, `review_participant_role`, `deliverable_type`, `implementation_status`, `implementation_checkpoint_type`, a `deliverable` `engagement_file_purpose`, and three new `engagement_capability` values.
- **Reviews** (`reviews`, `review_participants`): scheduled/held sessions with an agenda (`examines`), findings as statements, and outcomes recorded via `raises` (a new judgment record) or `validates` (a formal conformance finding about an initiative already on the agenda).
- **Deliverables** (`deliverables`): status fully derived from the existing lifecycle and approval axes — no stored status field (D7) — reusing Phase 4's `engagement_files` infrastructure with a new `deliverable` purpose.
- **Implementation** (`implementation_initiatives`, plus its own `implementation_stewardship`, `implementation_status_changes`, `implementation_escalations`, `implementation_signal_dismissals`, `implementation_categories`, `implementation_checkpoints`): six precisely-defined status values (`not_started`, `in_progress`, `operational`, `validated`, `stalled`, `abandoned`); non-terminal transitions through `update_implementation_status` (`manage_implementation`); terminal transitions only through `resolve_implementation_initiative` (`publish_architecture`), which refuses `validated` (23514) unless a qualifying `validates` relationship already exists. See ADR-0036, ADR-0039.
- **`record_review_validation(review, initiative)`** (ADR-0035): the only path that may write a `validates` relationship. Requires `publish_architecture`, refuses an unheld review, refuses a review that has not `examine`d the initiative (or a core object it `implements`), and refuses a duplicate. Verified by direct code reading against the approved design, not only by the pgTAP suite that exercises it.
- **Implementation Checkpoints** (ADR-0037): a lightweight subordinate table, not a fourth element kind — no spine row, no reference code, no lifecycle beyond "not yet achieved / achieved," editable under the same `manage_implementation` capability as the parent initiative.
- **Signals**: `implementation_signals()`, its own function, evaluates one rule at launch — `implementation_past_target` (D16) — separately from `intelligence_signals()`.
- **Read models:** `review_register`, `deliverable_register`, `implementation_register`, `implementation_signals`, `implementation_impact` (a structural trace, `security invoker`), and `client_reviews`/`client_deliverables`/`client_implementation` for the published, client-visible rows of each.
- **Finance stays separate; clients never reach Implementation's stewardship.** No Phase 5 table references a finance table (ADR-0023 unchanged), and `implementation_stewardship`, `implementation_status_changes` and `implementation_escalations` carry no client RLS policy at all.

Full detail: [`docs/database/reviews-deliverables-implementation.md`](../database/reviews-deliverables-implementation.md).

### Application

- **Domain layer** (`src/domain/reviews/`, `src/domain/deliverables/`, `src/domain/implementation/`): catalogs mirroring the migration's controlled vocabularies, pure register filtering/ordering, Zod schemas, cached queries, and server actions wired to every database operation above. `src/domain/architecture/{catalog,vocabulary,rules}.ts` and `src/domain/capabilities/catalog.ts` extended for the three new element kinds, six relationship types and three capabilities, with `vocabulary.test.ts` checking the TypeScript mirror stays exact against the migration.
- **Internal workspace:** Reviews, Deliverables and Implementation pages per engagement (register, filters, detail pages), a cross-engagement Implementation register (`/internal/implementation`) alongside the existing cross-engagement Reviews view, new element-page panels (Implementation/Reviewed in/Documented in) showing how a core object relates to the new kinds, and deliverable file upload reusing the existing signed-upload pattern.
- **Client portal:** Reviews and Implementation pages surfacing published, client-visible rows, and Deliverables surfaced on the existing client Overview/Documents page.

## 2. Files changed

53 files changed versus the Phase 4 merge (`b046ae7`) through the build itself (2 new migrations, `seed.sql` extended, 5 new pgTAP suites plus 3 pre-existing suites updated for shifted Harbor counts, the full `src/domain/{reviews,deliverables,implementation}/` domain layer, updates to `src/domain/architecture/` and `src/domain/capabilities/` for the new vocabulary, and the new/rewritten internal and client pages listed above), plus this phase's 6 new ADRs, one new database doc, and small updates to `README.md` and `docs/database/rls.md`.

## 3. Schema changes

- 2 new migrations (enums, then the main Reviews/Deliverables/Implementation migration: tables, functions, RLS policies).
- 10 new tables: `reviews`, `review_participants`, `deliverables`, `implementation_initiatives`, `implementation_stewardship`, `implementation_status_changes`, `implementation_escalations`, `implementation_signal_dismissals`, `implementation_checkpoints`, `implementation_categories` (see `docs/database/reviews-deliverables-implementation.md` for what each holds).
- 3 new element kinds (`review`, `deliverable`, `implementation_initiative`), 6 new relationship types (`examines`, `raises`, `documents`, `implements`, `initiates`, `validates`).
- 1 new `engagement_file_purpose` value (`deliverable`), reusing the existing private `engagement-files` bucket — no new Storage bucket.

## 4. Security / RLS changes

- 3 new capabilities: `manage_reviews`, `manage_deliverables` (Principal Architect, Architect, Researcher, Project Administrator), `manage_implementation` (Principal Architect, Architect, Project Administrator — not Researcher) — none granted to System Administrators by default.
- `validates` is the one relationship type in the vocabulary with its own restricted-write authorization rule, beyond the ordinary capability + tenant checks every other relationship type gets (ADR-0035).
- `validated` implementation status is database-gated and structurally unreachable through the direct-edit status path (`update_implementation_status` accepts only the four non-terminal values) — confirmed both by reading `resolve_implementation_initiative`'s gate directly and by the pgTAP suite that specifically tests the refusal cases (`19_implementation_validation.test.sql`).
- Implementation's stewardship, status history and escalations carry no client RLS policy at all — the same "internal only, no client policy" shape as Phase 4's equivalent tables, in physically separate tables (ADR-0039).
- `client_actions` (Phase 4) is reused as-is for client-executive implementation escalations — confirmed to be the one deliberate exception to the separate-namespace rule, per Kerrick's explicit instruction, not a gap in it.
- Every new operation checks capabilities (42501), business rules (23514), or visibility (P0002), through `SECURITY DEFINER` helpers, exactly as Phases 3–4.
- No Phase 5 table references a finance table (ADR-0023 unchanged).

## 5. Tests and checks performed

All verification below was run twice independently — once after the database/domain/test build (Stage 1) and again after the UI/seed-data build (Stage 2) — rather than accepting either building agent's self-report.

- `npx supabase db reset`: all 14 migrations and the extended `seed.sql` apply cleanly.
- `npx supabase test db`: **23 files, 875 assertions, all passing** — 18 files/743 assertions carried over from Phase 4, plus 5 new Phase 5 suites (`16_reviews`, `17_deliverables`, `18_implementation`, `19_implementation_validation`, `99_implementation_concurrency`, the last via `dblink`). `19_implementation_validation.test.sql` specifically exercises all three `record_review_validation` refusal cases and `resolve_implementation_initiative`'s `validated`-gate refusal.
- `pnpm check` (lint, `next typegen` + `tsc --noEmit`, `format:check`, `vitest run`): **green** — 132 unit tests across 15 files (up from Phase 4's 111/13, no regressions).
- `pnpm build`: **green** — all routes compile and prerender/generate correctly, including every new Phase 5 page (`/internal/engagements/[slug]/{reviews,deliverables,implementation}` and their detail pages, the cross-engagement `/internal/implementation`, and the client `/portal/[slug]/{reviews,implementation}`).
- `pnpm db:types`: no drift between the regenerated types and the committed `src/types/database.ts`.
- The three pre-existing pgTAP files whose Harbor-engagement counts shifted because of the new seed data (`07_architecture_access.test.sql`, `12_intelligence_registers.test.sql`, `14_contributor_areas.test.sql`) were read directly, not just trusted: the count changes reflect the five new client-visible Phase 5 elements added to that engagement, no assertion was added or removed, and no tenant-isolation or cross-organization visibility check was weakened — the affected assertions all concern the same actor legitimately seeing more of an engagement they were already authorized to see, not a new actor gaining access.
- The seed-data path that exercises the full `validates` gate end to end (`record_review_validation` followed by `resolve_implementation_initiative(..., 'validated', ...)`, both against the same review/initiative pair) was located and confirmed present in `seed.sql`.

## 6. Known limitations

- **No Playwright end-to-end suite exists in this repository** (consistent with every prior phase). Verification relies on the pgTAP suites (which exercise every RLS and business rule directly against Postgres) and the production build succeeding for every route; the new UI was not clicked through in a browser.
- **Phase 5 seed fixtures live on the Community Expansion Architecture engagement (`harbor-community-expansion`, `e...03`), not Meridian.** Meridian's existing pgTAP suites assert exact reference codes and register counts that new elements would have broken; Harbor had no such suite. Reviewing the new Reviews/Deliverables/Implementation UI with realistic demo data means opening Harbor, not Meridian — this is a genuine, user-facing consequence of the engineering tradeoff, not just an internal detail.
- Adding that seed data required updating three pre-existing, unrelated pgTAP test files' hardcoded counts for the Harbor engagement; each change was independently read and confirmed correct (see §5), but it is still churn outside the phase's own new files that a reviewer may want to look at directly.
- Email notifications for reviews/escalations remain pending the Phase 2 email-provider decision, unchanged from Phase 4's same limitation.

## 7. Unresolved questions

None outstanding from D1–D16; all were settled by Kerrick's final approval of the revised proposal, including the explicit `client_actions`-reuse instruction.

## 8. Recommended next step

CI has been green on PR #5 throughout the build (the handful of mid-build reds were confirmed, via job logs, to be expected transient states — a not-yet-updated capability mirror, pending Prettier formatting — not real defects, and were not re-flagged after the first explanatory comment). This report, the six new ADRs (0034–0039) and the new database doc are the last pieces of Kerrick's explicit approval instruction before his own review. Per that instruction, this PR is **not** being merged — it is ready and waiting for Kerrick's final review and explicit merge instruction.
