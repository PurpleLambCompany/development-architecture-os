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

## 9. Acceptance-review corrective work (2026-09-30)

A manual browser UX acceptance review found four real defects the automated suite (pgTAP/vitest/build) had not caught, because every one of them was invisible to a purely internal-role, static-fixture test run. All four are now fixed, on the same branch and PR, still in draft, not merged.

### Defect 1 — Implementation Initiative detail page 500s (blocker)

`getEscalations` in `src/domain/implementation/queries.ts` was copy-pasted from Phase 4's `intelligence` equivalent and embedded `architecture_elements!implementation_escalations_element_fk(...)` in its PostgREST select. Phase 4's matching FK genuinely points at `architecture_elements`; Phase 5's `implementation_escalations_element_fk` deliberately points at `implementation_initiatives` instead (escalations only ever concern initiatives — this is correct schema, not a bug), so the embed hint named a relationship that does not exist, and PostgREST refused every call with `PGRST200`. Every Implementation Initiative detail page 500'd, on every initiative, in every engagement — schema-level, not data-dependent, exactly as the review reported.

The one caller (`.../implementation/[initiativeId]/page.tsx`) never reads `.architecture_elements` off an escalation row — it already has the initiative element in hand — so the smaller, correct fix was to drop the unused embed rather than write the two-hop traversal nobody would consume. The still-used `client_actions!implementation_escalations_action_fk(...)` embed is untouched. The schema/migration was not changed; the FK was correct, the query was wrong.

Verified: all three seeded initiatives (IMP-001, IMP-002, IMP-003, `harbor-community-expansion`) now render `200` (confirmed with Playwright against a running `pnpm dev`, not inferred from the fix alone).

### Defect 2 — client Implementation status was stale and self-contradicting (blocker)

`update_implementation_status` and `resolve_implementation_initiative` updated the live `implementation_initiatives` row but never touched `element_versions`/`latest_version_id`, so `client_implementation()` (which reads the frozen `client_snapshot` of the latest **published** version) never reflected a status change made after publication. The seeded IMP-001 (operational, two achieved checkpoints) and IMP-002 (walked through the full validation gate to `validated`) both still read `not_started` on the client portal — directly contradicting their own displayed checkpoint notes.

Fix, following Phase 4's `resolve_intelligence_record(..., p_publish default false, ...)` pattern exactly (new migration `20261004000000_implementation_status_publish.sql`):

- Both functions gained `p_publish boolean default false` and `p_change_summary text default null`, and now return the new version id (`uuid`) instead of `void`.
- When `p_publish = true`, the status-changing update is followed, in the same transaction, by a call to the existing `publish_element_version(...)` — no parallel snapshot mechanism was built. `update_implementation_status` additionally requires `publish_architecture` only when `p_publish = true` (its base capability stays `manage_implementation`); `resolve_implementation_initiative` already required `publish_architecture` unconditionally.
- Publication stays an explicit, opt-in, caller's choice: `p_publish` defaults to `false`, and a plain status change never mutates an already-published `element_versions` row in place — a new version is always created, never rewritten.
- `src/domain/implementation/{schemas,actions}.ts` gained the `publish`/`changeSummary` fields, mirroring the Intelligence domain's `resolveSchema`/`resolveRecord` shape (including the same `yesNo` transform).
- The initiative-detail page's "Update status" and "Resolve" forms gained a `publish` select and `changeSummary` field, factored into a shared `publishFields(...)` helper matching the Intelligence resolve-with-publish UI pattern (`resolveFields` in `src/components/intelligence/fields.ts`) for consistency. Checkpoint display was not touched by this change and still shows plain achieved/not-achieved facts — no percentage, progress bar or health score was introduced anywhere near it.
- `supabase/seed.sql`: IMP-001's `update_implementation_status(..., 'operational', ..., true, ...)` and IMP-002's `resolve_implementation_initiative(..., 'validated', ..., true, ...)` now publish immediately, so their client-facing snapshot matches their live status straight out of `supabase db reset`.

Verified empirically, not just by reading the SQL: after `supabase db reset`, a direct query of `element_versions.client_snapshot` for both initiatives showed `operational`/`validated` matching their live rows, and the client portal (`sponsor@harbor.test`, `/portal/harbor-community-expansion/implementation`) shows IMP-001 **OPERATIONAL** with its achieved "Agreement executed" checkpoint, and IMP-002 **VALIDATED** — no contradiction on either card.

### Defect 3 — Review participant names always showed "TPLCo"

`.../reviews/[reviewId]/page.tsx` called `nameOf(p.engagement_member_id)`, but `nameOf` (from `memberNames(engagement)`) is keyed by `user_id`, not by the `engagement_members` row's own id — every lookup missed and fell back to `memberNames`'s generic `"TPLCo"` default. The "add participant" dropdown on the same page already resolved this correctly (`nameOf(m.user_id)` from `availableMembers`). Fixed by resolving each participant's `engagement_member_id` to its `user_id` via `engagement.engagement_members` — the same list the dropdown already uses — before the `nameOf(...)` call. `memberNames`'s fallback behavior itself (including the `"TPLCo"` text) was left exactly as it was; only the call site's input was wrong.

Verified: REV-001 ("Expansion Readiness Review") now shows its four seeded participants by real name (Adrienne Cole, Julian Reyes, Richard Amsel, Nadia Farouk) — confirmed with Playwright, zero occurrences of "TPLCo" on the page.

### Defect 4 — Client Contributor Phase 5 visibility

The acceptance review's own initial framing guessed the symptom was over-inclusion ("Contributors get blanket access to everything"). Static reading suggested the opposite, and this was **confirmed empirically before any fix was written**: a throwaway Client Contributor was added to Harbor with the Application area assigned, and queried directly against `client_implementation`/`client_reviews`/`client_deliverables` — all three returned **zero rows**, despite IMP-001 implementing, REV-001 examining, and DLV-001 documenting an Application-domain object directly. **The actual bug was under-inclusion, not over-inclusion**: an area-limited Contributor saw none of Phase 5, in any area, ever. Kerrick's original report was corrected on this point, not merely trusted either way.

Root cause: every client Phase 5 read model already gated on `private.element_client_readable`, the same helper every Phase 3/4 client policy goes through (ADR-0030), which for a plain Contributor collapses to `private.element_in_member_areas`. That function's `concerned` CTE only recognized the Phase 3/4 relationship vocabulary (`underpins`/`threatens`/`constrains`/`mitigates`/`affects`/`addresses`/`advances`/`pursues`) — not Phase 5's `implements`/`documents`/`examines` — so a Phase 5 record's `concerned` set was always empty and no area ever matched.

Fix (new migration `20261004000100_phase5_area_visibility.sql`, ADR-0040), entirely in the database — `element_client_readable` and the three `client_*` functions were not touched, and no React/TypeScript code participates in this authorization decision:

- `implements`, `documents` and `examines` were added to the `concerned` CTE's relationship-type list, resolving Initiative→object, Deliverable→object and Review→object directly through the same existing walk used for Phase 3/4.
- A Review examining an Implementation Initiative (rather than an object) needed a second path: two small additional CTEs resolve the examined initiative's own area membership (what it implements, and its `part_of` ancestry), mirroring the existing recursive `ancestry` CTE's style, and OR that into the Review's own visibility — a Review is visible when it examines an object in-area, or an Initiative that is itself visible.
- This does not weaken Phase 3/4 behavior: the added relationship types are Phase 5's own vocabulary, which no Phase 3/4 record uses. pgTAP suites 12–15 were re-run after the change and are unaffected (all still passing).

New pgTAP suite `20_phase5_area_visibility.test.sql` (18 assertions) covers: a full-architecture client user seeing all client-visible Phase 5 records; an area-limited Contributor seeing exactly the records structurally connected to their assigned area (direct `implements`/`documents`/`examines`, and the Review→Initiative path specifically, isolated from the direct-object path by reassigning the Contributor to an area with no direct link); the same Contributor seeing nothing once reassigned to an unrelated area; and cross-engagement isolation (a Meridian client, with or without an area, sees none of Harbor's Phase 5 records). The fixture (a Harbor Contributor + area assignments) is self-contained to the suite and rolled back with it, per this repo's established pattern (`14_contributor_areas.test.sql`), not added to the persistent seed.

Verified empirically both before and after the fix, against the running database, not only via pgTAP.

### Tests added

- `18_implementation.test.sql`: +10 assertions (43 → 53) covering `update_implementation_status`'s `p_publish` — false leaves the client snapshot and version id untouched, true publishes a new version whose snapshot reflects the new status, and the prior version row is read back unchanged (immutability).
- `19_implementation_validation.test.sql`: +8 assertions (26 → 34) covering the same `p_publish` behavior on `resolve_implementation_initiative`.
- `20_phase5_area_visibility.test.sql`: new file, 18 assertions, described above.
- `src/domain/implementation/schemas.test.ts`: new file, 7 unit tests — `publish` defaults to `false` and only becomes `true` on an explicit `"yes"`, and `resolveInitiativeSchema` still requires a non-empty rationale regardless of `publish`.

### Second verification pass (after the corrective work)

1. `npx supabase db reset` — clean, all 16 migrations and the (further-updated) seed apply.
2. `npx supabase test db` — **24 files, 911 assertions, all passing** (23 files/875 assertions before this pass; +1 new file, +36 assertions, nothing removed or weakened).
3. `pnpm check` — **green**: lint, typecheck, `format:check`, and **139 vitest tests across 16 files** (132/15 before this pass).
4. `pnpm build` — **green**, all 44 routes compile, including every Implementation Initiative detail route.
5. `pnpm db:types` — drift found and regenerated/committed, exactly as expected from the two functions' new parameters and `uuid` return type; no other drift.
6. Manual browser pass (Playwright against `pnpm dev`, demo credentials): all three Implementation Initiative detail pages 200; REV-001 shows real participant names with zero "TPLCo" occurrences; the client portal shows IMP-001 OPERATIONAL and IMP-002 VALIDATED with no checkpoint/status contradiction; DLV-001's internal detail page, the internal architecture and intelligence registers, and the client portal's architecture, actions and overview pages all still render 200 with no regression.

### New ADR

ADR-0040, "Area-limited client visibility extends to Phase 5 records" — the Defect 4 fix is a permanent authorization rule about how area-scoping interacts with Phase 5's element kinds, in the same family as ADR-0030, and difficult to reverse once client demo access depends on it.

### Unresolved questions

None. All four defects were fully specified by Kerrick's acceptance-review instructions, including the explicit correction path for Defect 4's actual direction, and no structural conflict with the existing contributor-area model was found — the fix extends `element_in_member_areas` along the grain it was already built on.

### Recommended next step

Unchanged from §8: this PR remains in draft, not merged, waiting for Kerrick's review and explicit merge instruction. CI should be checked on the final pushed commit before that review; see the accompanying report for its state at push time.
