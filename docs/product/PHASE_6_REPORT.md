# Phase 6 end-of-phase report: Method Library

Status: implemented on PR #7, awaiting Kerrick's final acceptance. Not merged.

Kerrick approved [`PHASE_6_PROPOSAL.md`](PHASE_6_PROPOSAL.md) Revision 2 (decisions D1–D34) on 2026-09-30 and authorized implementation in the §38 staged order. Each step landed with database and application tests and green CI before the next. No approved decision was reinterpreted; the one tension found between a decision and the rest of the approved design is recorded in §7.

## 1. What was built

### Database (the authority for every rule)

- **Practice capability scope** (ADR-0044). `author_methodology`, `publish_methodology` and `administer_practice` are TPLCo-wide, separate from engagement capabilities. Principal Architects hold all three by default; Architects author; System Admins and Researchers hold none. Grants and revocations are per-member overrides with a reason, administered only by a holder of `administer_practice`, never on oneself, and the last `publish_methodology` holder cannot be removed (race-safe).
- **Method Library core** (ADR-0041, 0048). One `method_assets` register with five distinct forms: Method, Model, Instrument, Standard and Template. Each form has its own required content (a Method needs stages and modes, an Instrument needs usage guidance, a Standard needs criteria, a Template needs a deliverable type). Versions are drafted, published once and then frozen; a new version copies the last one. Components must be current published versions. Origin and rights (including which name may be used with clients) are recorded on the version. Files live in a private `method-library` bucket readable only by internal staff.
- **Legacy backfill**. Every pre-Phase 6 method asset became a legacy version with no inferred form. It stays readable and linkable as `legacy_derived_from` only, until a holder of `publish_methodology` adopts it into a real form.
- **DAM releases** (ADR-0042). A release is a frozen set of published asset versions, with one draft and one published release at a time, members copied forward, a diff against the previous release and a required change summary to publish. Release 1.0 exists; every engagement points at a release. There are no DAM phases.
- **Development Context** (ADR-0045). Contexts are versioned library records with revision history; engagements carry the contexts that apply and methods declare the contexts they suit. Context fit ranks, it never selects.
- **Method Applications** (ADR-0043). An engagement-scoped practice record of one method version applied: practitioners, contexts, domains, stages with treatment (skipping requires a reason), inputs examined, evidence gathered with the instrument used, components used and declared-but-unused, and outputs compared against the method's expected outputs. Applications run planned, in progress, then completed or discontinued, are frozen at closure, accept addenda afterwards, and can be cited as learning sources by a later draft version. An application outside the engagement's release is allowed and flagged. D30: when a draft element linked to an application is deleted, the application keeps its identity as captured.
- **Acceptance Criteria** (ADR-0046). Criteria on a core object or initiative are proposed and edited by authors, agreed only by a publisher on a published element (who, from when, optional evidence), and after that only superseded or withdrawn with a reason. `record_review_validation` captures the agreed criteria in force at that moment in `validation_criteria`, with per-criterion notes. The ADR-0036 validation gate is unchanged: validating with no criteria is allowed and recorded as such.
- **Typed lineage** (ADR-0047). `element_method_lineage` records instantiates, judged_against, produced_from and legacy_derived_from against exact versions, each role limited to one form and to fitting element kinds (a Deliverable's Template must match its deliverable type). An element whose content is `methodology_derived` cannot be published until it records the Model it instantiates (D19).
- **Read models and client boundary** (ADR-0049, ADR-0022 note). Internal read models serve the library, applications and practice context. Clients get exactly two: the engagement's release label and title, and agreed client-visible criteria. Approach statements reach clients only as published statements through the existing snapshot path. No client role can select from any Method Library, application or lineage table.

### Application

- `/internal/method-library`: browse by form and status, asset detail with versions, components, rights and files, authoring and publishing gated by capability, legacy adoption, releases (compose, diff, publish) and contexts (define, revise).
- `/internal/engagements/[slug]/method`: the engagement's release (change it, publish-gated), its contexts, the application register, "Apply a method" ranked in-release first then by context fit, and the methods available.
- Application detail: begin, complete or discontinue; stages, inputs, components, outputs with expected-versus-actual; the D30 captured identity for deleted drafts; addenda after closure.
- Practice panel on element, initiative, review and deliverable pages; Acceptance criteria panel on core objects and initiatives (with criteria inherited from implemented objects); review candidates show the criteria they would be validated against and warn when none are in force; validated records list the captured criteria with notes.
- Approach statements: a helper that inserts only approved client-usable names and warns live when text names an internal-only method.
- `/internal/settings/practice`: the practice capability matrix with grant, revoke and return-to-default.
- Client portal: "Method: Conducted under the {release title}" on the overview, and an Acceptance criteria list on element and implementation pages.

## 2. Files changed

98 files, about 20,700 lines, across 13 implementation commits (`9ecf2e8`…`48d92cf`). Nine migrations, ten ADRs with three amendment notes, nine new pgTAP suites plus one shared include, new `src/domain/methodology/` and `src/components/methodology/` modules, eleven new internal routes, and changes to the element, initiative, review, deliverable, engagement, settings and client portal pages. The demo seed is extended in `supabase/seed.sql`.

## 3. Schema changes

Migrations, in order:

- `20261005000000_phase6_enums.sql`
- `20261005000100_practice_capabilities.sql`
- `20261005000200_method_library_core.sql`
- `20261005000300_method_library_legacy.sql`
- `20261005000400_dam_releases_contexts.sql`
- `20261005000500_method_applications.sql`
- `20261005000600_acceptance_criteria.sql`
- `20261005000700_typed_method_lineage.sql`
- `20261005000800_method_read_models.sql`

Table-by-table detail is in [`docs/database/method-library.md`](../database/method-library.md).

## 4. Security / RLS changes

- Every Method Library, release, context, application, criterion and lineage table has RLS. Library tables are readable by internal staff only; writes go through security-definer functions that check the practice capability, never a role name.
- Applications, criteria and lineage are engagement-scoped: readable by internal members of that engagement, isolated by organization and engagement.
- Clients read only the two client read models, which return label and title, and agreed client-visible criteria text. Client roles have no grant on any underlying table; this is tested per table, not only through hidden UI.
- The storage bucket admits internal staff only.
- Area-limited Client Contributors see criteria only on elements inside their areas.

## 5. Tests and checks performed

- pgTAP: 33 files, 1,320 assertions, PASS (Phase 6 adds suites 21–28 and `99_method_concurrency`, 408 assertions).
- Vitest: 21 files, 179 tests, PASS. Typecheck, lint and format clean.
- `pnpm build`: compiled successfully. `pnpm db:types`: no drift.
- CI "App" and "Database": green on every step commit through step 13; the final head is reported on PR #7.
- Required security coverage: org and engagement isolation, practice capability authority, author versus publish, a System Admin without methodology authority, Principal Architect defaults, an Architect who authors but cannot publish, client denial for the library, applications and lineage, client-safe release label, criteria and approach statements, and Contributor area restrictions.

### Browser acceptance (role by role)

Run against the seeded demo as Principal Architect, Architect, System Admin, Researcher, Meridian sponsor, contributor and viewer, and the Harbor sponsor.

- The Architect authored a Standard with no publish control; the Principal Architect published it. The System Admin had no create, draft, retire, context or release controls; the Researcher was read-only.
- Release 1.2 was composed, the diff showed the added member, publishing without a change summary was refused, and it published. A context revision showed in its history.
- A legacy asset showed as legacy; Adopt appeared for the Principal Architect only.
- The Architect moved Meridian to 1.2, created a draft element and linked it as produced, linked another as revised, was refused skipping a stage without a reason, completed the application, then deleted the draft. The application showed the captured D30 identity, was frozen, and offered an addendum.
- An approach statement used the inserted approved name; a criterion was proposed and agreed; a Review recorded `judged_against` the new Standard; validation captured the agreed criteria with a note.
- A client at Meridian and Harbor saw the release line, the published approach statement and their agreed criteria, and none of the internal-only strings. Internal routes redirected them to the portal; another engagement returned 404.

Defects found and fixed during the pass:

1. A Deliverable's Practice panel offered Templates of any type; the database refused the mismatch but the form invited it. It now offers only Templates of the Deliverable's type, with a clear empty message.
2. The refusal message for a disallowed element role in method work was unclear; it now reads "Method work cannot record this {kind} as {role}".
3. The embed from applications to versions was ambiguous (two foreign keys) and failed; it now names the key.

Each was re-verified in the browser after the fix.

## 6. Known limitations

- D32 area filtering for applications has no population to act on (see §7).
- Files in the library are served through an authenticated internal route under the bucket policy, not through signed URLs.
- There is no evidence upload for criterion agreement beyond choosing an existing Evidence Source.
- Not built, as instructed: AI, automated method selection or scoring, Pattern extraction, certification or licensing, document management, LMS, DAM phases and a dynamic ontology.

Differences from the proposal's wording, all within the approved decisions and recorded in the ADRs: some read models were renamed or added; a release publish also requires a change summary; release composition copies members from the previous release; the D19 check accepts a superseded Model version still recorded as instantiated; the activity action list gained the Phase 6 actions.

## 7. Unresolved questions

- **D32 and the client boundary.** D32 says an application is visible to anyone who can read the engagement's architecture, with Contributor area filtering. The standing rule that clients never see Method/IP means applications are internal-only, and internal members carry no area limits, so the area filter has nothing to act on. It was built internal-only; this is reversible if a different reading is intended.

## 8. Recommended next step

Kerrick's final acceptance review of PR #7. After approval and merge, update the status docs to "merged". Phase 7 (Architecture Intelligence) has not begun.
