# Phase 3 end-of-phase report: Architecture Core

**Branch:** `phase-3-architecture-core` · **Pull request:** #3 (not merged; awaiting the owner's review and merge instruction) · **Date:** 2026-09-30

**Scope:** the approved Phase 3 proposal (revision 3, with the §4 and §9 vocabulary approved), built in the §17 order.

**Not built:** Architecture Intelligence or AI, Phase 4 experience features, Phase 5 implementation or deliverables, and Phase 6 Method Library functionality.

## 1. What was built

### Database (the authority for every rule)

- **Capabilities** (ADR-0024). The new capabilities are `edit_architecture`, `publish_architecture` and `view_architecture`; the existing `approve_architecture` now requires `view_architecture` as well.
  - Defaults are exactly as proposed in §8.1.
  - System, Project and Finance Administrators and Client Finance hold none of them by default.
  - Every check goes through capability helpers, never role names.
- **The element spine** (ADR-0013). One `architecture_elements` row per core object or Project Intelligence record, with a subtype table per kind.
  - Core objects: 27 types in four domains. Each object belongs to exactly one domain, fixed by its type. Its attributes are held in validated jsonb.
  - Records: assumptions, risks, constraints, dependencies, decisions (with options) and recommendations. A record spans zero or more domains, concerns specific elements, or is engagement-wide.
- **Relationships** (ADR-0018). 31 types and 1,960 allowed pairings, all enforced by the database.
  - Acyclic types refuse cycles, including through longer chains.
  - `conflicts_with` is stored once per pair.
  - Links across engagements are refused by composite foreign keys.
  - A published relationship is retired, never edited.
- **Statements and evidence** (ADR-0015). Material statements carry their own provenance and client visibility. Evidence is a separate source system, linked through statement and element evidence links, and holds references only (file upload comes later).
- **Provenance.** There are eight provenance types.
  - `client_decision` and `system_derived` are written only by operations.
  - Provenance changes are audited.
  - AI provenance is blocked from publication until a person reviews it.
- **Publication** (ADR-0014).
  - `publish_element_version` writes an immutable version with a full snapshot and a client snapshot.
  - Clients read only the client snapshot of client-visible, non-retired elements, whether or not the version is approved.
  - The full snapshot column is granted to no one.
- **Approvals and decisions** (ADR-0021).
  - An approval targets one exact version or one frozen baseline. Responses are `approved` or `changes_requested`, with a comment required for changes requested.
  - Approvals are immutable once answered, and an approval of v2 still stands after v3 is published.
  - External approvals and decisions record the approver, method, date, evidence, the recording user and the recorded time.
  - A decided decision is frozen.
- **Baselines.** A draft pins exact versions. Freezing captures the relationships among them and the latest domain assessments. `compare_baselines` reports what was added, removed and changed, against another baseline or the current published architecture.
- **Domain maturity** (ADR-0019). An append-only, dated architect judgment with a required rationale. The object maturity distribution is shown beside it, labeled "Calculated", and never replaces it.
- **Reference codes** (ADR-0025). Prefixes are `KNW`, `CAP`, `STR`, `APP`, `ASM`, `RSK`, `CNS`, `DEP`, `DEC` and `REC`. Codes are sequential per engagement and prefix, and are never reused.
- **Finance stays separate** (ADR-0023). No architecture table references finance; a pgTAP assertion checks the foreign keys.

### Application

- **Domain layer** (`src/domain/architecture/`):
  - the vocabulary, generated from the same source as the migration and checked against it by tests;
  - the catalogs, labels and client provenance labels;
  - pairing rules, attribute schemas for all 27 types, and Zod schemas for every form;
  - graph helpers (trees and traces);
  - cached queries, and server actions that call the database operations.
- **Internal workspace** (`/internal/engagements/[slug]/…`):
  - **Architecture home:** each domain's state, rationale and date, the "Calculated" distribution, counts of items awaiting review, awaiting the client and open decisions, and a form to record an assessment.
  - **Four domain workspaces,** each with its own views:
    - Knowledge: domain map, research questions, gaps and system boundary.
    - Capability: capability map with tier, readiness and owner, a role × skill matrix, gaps and the talent sequence.
    - Strategic Model: outcomes and applied models with their logic.
    - Application: operating model outline, decision-rights matrix, measurement system and scaling sequence.
  - **Element page:**
    - the working copy with an edit form;
    - statements with provenance and cited evidence;
    - connected architecture, with cross-domain links marked;
    - the decision panel;
    - versions and approvals, internal Method lineage and activity;
    - the operations each viewer's capabilities allow;
    - Preview as client.
  - **Intelligence:** registers for each record kind, with a probability × impact grid for risks.
  - **Evidence library, review queue and baselines,** the last with freeze, approval request and compare.
  - **Cross-engagement pages:** Architecture, Intelligence and Reviews in the internal menu.
- **Client portal** (`/portal/[slug]/…`):
  - **Navigation:** Architecture and Decisions tabs appear with `view_architecture`, and Billing with `view_financials`.
  - **Overview:** domain states for every client member, and pending counts for those who can respond.
  - **Architecture:** grouped by domain, then Project Intelligence. Items show a Published or approval tag for information only.
  - **Element page:** the snapshot, the response form, published connections and version history.
  - **Decisions:** approval requests, open decisions with TPLCo's recommendation, decided and deferred decisions, and frozen baselines.
- **Design:**
  - Maturity is shown as a word, never a bar or a score.
  - There is no kanban and no gamification.
  - The shared action form moved from finance components to UI components.

## 2. Files changed

83 files against `main`; `git diff --stat origin/main` gives the full list.

| Area           | Files                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations     | `20261001000000_architecture_capabilities.sql`, `20261001000100_architecture_core.sql`, `20261001000200_architecture_element_creation.sql`                                               |
| Seed and types | `supabase/seed.sql`, `src/types/database.ts`                                                                                                                                             |
| pgTAP          | New: `07_architecture_access`, `08_architecture_integrity`, `09_architecture_versions`, `10_architecture_creation`, `99_architecture_concurrency`. Updated: `03_engagement_capabilities` |
| Domain layer   | `src/domain/architecture/*` (13 files, three of them tests), `src/domain/capabilities/catalog.ts` and its test                                                                           |
| Components     | `src/components/architecture/*` (12), `src/components/portal/engagement-nav.tsx`, `src/components/ui/action-form.tsx` (moved), finance panels (import path only)                         |
| Routes         | 11 internal and 3 client pages added; the engagement page, internal layout, finance workspace and client overview and billing pages updated                                              |
| Docs           | ADR-0013 to ADR-0025, `PHASE_3_PROPOSAL.md`, this report, `docs/database/architecture.md`, links from `rls.md` and `schema.md`, `README.md`, `CLAUDE.md`                                 |

## 3. Schema changes

All schema changes are additive; nothing from Phases 1 or 2 changes shape.

- **Enum values** added to `engagement_capability`: `edit_architecture`, `publish_architecture` and `view_architecture`.
- **Enums:** 22 new enums, among them `provenance_type`, `element_lifecycle`, `maturity_state`, `approval_response` and `architecture_approval_method`.
- **Tables:** 27 new tables.
  - Three reference tables.
  - The spine, objects and record domains.
  - Six record tables and decision options.
  - Statements, evidence sources and two evidence-link tables.
  - Method lineage and relationships.
  - Element versions and domain assessments.
  - Baselines and three baseline tables.
  - Approvals and reference counters.
- **Functions:**
  - 16 public operations;
  - 9 read models, and `element_reference_prefix`;
  - `create_architecture_element`;
  - private guards, snapshot builders and capability helpers.

`docs/database/architecture.md` is the reference.

## 4. Security and RLS

- **Live tables** (working copies, statements, relationships, evidence, lineage):
  - internal readers only, meaning internal members who can access the engagement;
  - no client policy at all;
  - writes need `edit_architecture`, and only on the granted columns.
- **Operations own the protected state:** lifecycle, versions, approvals, decisions, AI review, assessments and baseline freezing. Each locks its row and checks capabilities in the database.
- **Clients** (with `view_architecture`) read:
  - client snapshots of client-visible, non-retired elements;
  - published, client-visible, active relationships whose ends they can see;
  - approvals on what they can see;
  - frozen baselines.

  They never read working copies, internal statements, internal relationships, unreviewed AI content or Method lineage. A client refused a record by RLS gets "not found" (404).

- **Responses:** responding to an approval or deciding a decision needs `view_architecture` and `approve_architecture` together.
- **Client Finance** sees only the latest client-visible domain state per domain. An override of `view_architecture` shows more, and this is tested.
- **Finance Administrators** read the working architecture only on engagements they are assigned to, and never edit or publish it.
- **Client visibility** can be set only by holders of `publish_architecture`. A Researcher can draft, but can make nothing client-visible.
- **Anonymous callers** have nothing, and suspending a membership removes access immediately.

## 5. Tests and checks performed

| Check                                                   | Result                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| pgTAP (`pnpm db:test`)                                  | **495 assertions in 12 files, all passing.** Phase 3 adds 208 (07: 65, 08: 73, 09: 44, 10: 16, 99: 10) |
| Unit tests (`pnpm test`)                                | **81 passing** in 11 files (49 at the end of Phase 2)                                                  |
| `pnpm check` (lint, typecheck, format) and `pnpm build` | Clean                                                                                                  |
| Browser workflow, Phase 3 (Playwright, not committed)   | **67/67**, against a freshly reset database and the production build                                   |
| Phase 1 and Phase 2 browser suites, re-run              | **41/41** and **33/33**                                                                                |
| CI on PR #3                                             | Required checks App and Database; the result on the final commit is reported with this report          |

**The Phase 3 browser workflow** follows proposal §14:

1. The Architect creates a concept, a capability, an intended outcome and a metric, one in each domain. They link them across domains (informs, serves, measured by). A pairing outside the rules is refused by the database, and the offered types follow the rules. They add a client-visible and an internal statement, cite interview evidence, and submit for review.
2. The Researcher's form offers no client visibility; they create a draft and have no publish control. The System Administrator reads the architecture but is offered no drafting, publishing or submitting.
3. The Principal publishes all four elements and requests approval of v1. The Architect then edits the working copy.
4. The Viewer and the Contributor see the new capability at once: version 1, its client-visible statement and its cross-domain connections. They never see the internal statement or the working-copy edit, and they cannot respond.
5. The Sponsor requests changes on v1, and the internal review queue shows the comment. The Principal publishes v2 and requests approval; the Project Lead approves v2. History keeps v1's change request beside v2's approval.
6. Client Finance sees domain states on the overview, has no Architecture or Decisions tab, gets 404 on both, and still reaches Billing.
7. The Finance Administrator gets 404 on an unassigned engagement's architecture, and has no drafting, editing or publishing controls where assigned.
8. The Project Lead decides DEC-001, and the Viewer cannot decide.

The run also checks the following:

- A signed-out visitor is redirected to sign in.
- An internal-only element (`KNW-008`) returns 404 to a client, even by direct link.
- Preview as client omits the internal statement.
- A baseline is created, filled with every published version, frozen and compared with a seed baseline.

## 6. Deviations from the approved proposal and clarifications

None of these changes a principle. Each is how a rule was made precise in the build.

1. **New enum `architecture_approval_method`** holds the method of an external approval or decision (meeting, email, signed document, other). The proposal named the field but not the type.
2. **Evidence reaches clients only inside snapshots.** §8.3 proposed a client policy on `evidence_sources` (client-visible and cited in a visible version). Instead, clients have no access to the live evidence table. Citations to client-visible sources are copied into the client snapshot at publication. This is stricter, and it keeps evidence as immutable as the version.
3. **Changing client visibility needs `publish_architecture`,** on elements, relationships and evidence sources. §8.2 lists "set visibility" under publishing; the build enforces it in the guards, so a Researcher can draft but cannot make anything client-visible.
4. **Project Intelligence scope is checked on submit and publish,** not on every save. This lets a record be drafted before its domains or elements are chosen.
5. **`return_element_to_draft`** returns an element to `published` when it already has a version, so a published element is never shown as a draft.
6. **Additions:**
   - `record_external_decision` is separate from `decide_decision`.
   - `retire_relationship` was added, because published relationships are retired rather than deleted.
7. **Relationships publish automatically** when both ends have a published version. Client visibility is still set per relationship.
8. **Decision permissions:**
   - Deferring a decision needs `publish_architecture`.
   - Recording a recommendation needs `edit_architecture`, and its provenance is always Architect judgment.
9. **One approval request per version or baseline.** After "changes requested", TPLCo publishes a new version and asks again. It never re-asks on the same version.
10. **The snapshot builder is in SQL,** in `private.build_element_snapshot`. The TypeScript side only reads snapshots, so the client snapshot cannot drift from the database's rules.
11. **New function `create_architecture_element`,** in its own migration. A deferred integrity trigger requires the subtype row and reference code at commit, and each API request is one transaction. The function inserts the spine, subtype and record domains together as the caller, so RLS and the guards still apply.
12. **Timestamps use `clock_timestamp()`,** so histories written in one transaction still order correctly.
13. **The client Architecture area shows tables grouped by domain,** not the internal map and matrix views. §11 describes the client seeing "the domain's own view (map, matrix, table)". The client area lists published items in a table per domain; the richer views are internal only for now.
14. **Maturity is shown as a word, not a bar,** to keep to "no progress bars".
15. **`ActionForm` moved to `components/ui`,** because architecture and finance now share it.

## 7. Known limitations

1. **Evidence is references only.** There is no file upload yet, and it shares the pre-production upload requirement from Phase 2.
2. **Activity is empty for Architects and Researchers.** Phase 1's `activity_log` policy lets only administrators and Principal Architects read the log. Architecture events are recorded, but an Architect sees "No recorded activity" on the element page.
3. **The client domain views are tables** (deviation 13).
4. **Project Intelligence lists are plain.** Triage, filtering and deeper registers are Phase 4, as agreed.
5. **The AI review queue is always empty.** The gate is built and tested in the database, but nothing generates AI content in Phase 3.
6. **Notifications:** there are no emails for approval requests, responses or decisions. This shares the Phase 2 email-provider requirement.
7. **Supersession needs an existing replacement element** of the same kind. There is no "create successor" shortcut.
8. **Harbor's seed has only two objects.** The full worked example is Meridian's.
9. **The browser suites are not committed.** They live outside the repository, as in Phases 1 and 2; CI runs pgTAP and unit tests.

## 8. Unresolved questions

1. **Who may grant architecture capabilities by override?** Phase 1's rule applies: whoever can manage the engagement. That means System Administrators, Principal Architects and assigned Project Administrators, and a System Administrator can grant capabilities to themself.
   - As a result, an assigned Project Administrator could give a Researcher `publish_architecture`, and a System Administrator could give themself publishing authority.
   - Should `edit_architecture` and `publish_architecture` overrides be limited to Principal Architects, as financial capabilities are limited? This is a small change: one migration and tests.
2. **Should Architects and Researchers read the architecture activity** on engagements they are assigned to (limitation 2)?
3. **Should the client Architecture area get the map and matrix views** (deviation 13), now or in Phase 4?

## 9. Recommended next step

1. Review this report and the deviations in §6.
2. Answer the three questions in §8. Question 1 is the only one touching authority, and I recommend limiting architecture overrides to Principal Architects before real client data enters.
3. On your "merge PR #3" instruction, merge it. Then update the status in `CLAUDE.md` and the README to "Phase 3 complete — Phase 4 planning".
