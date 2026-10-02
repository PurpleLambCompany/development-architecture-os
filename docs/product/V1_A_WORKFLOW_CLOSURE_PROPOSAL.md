# V1-A Workflow Closure: Implementation Plan

**Status:** **Accepted by Kerrick on 2026-10-02 as the V1-A implementation plan,** with decisions D1 to D13 recorded in §9. Implementation proceeds only on Kerrick's instruction, through small sequential PRs (D13), each stopping for his review before merge.
**Progress:** Increment 1, the browser suite foundation (Workstream G, §6), is merged (PR #17). Increment 2, practice administration, bootstrap and authority closure (Workstream A, D1-D7), is merged (PR #18). Increment 3, client-facing records and files (Workstream B, D9), is the currently authorized increment and is implemented on a draft PR, not yet merged or accepted. No later increment has begun. This document changes no application code, schema, migration or dependency.
**Completion:** V1-A is complete only when the full Gate A assessment (§8) holds and Kerrick gives his manual acceptance. Merging individual workstream PRs does not constitute V1-A acceptance.
**Unchanged:** Architecture Intelligence Step B remains on hold, and Architecture Intelligence, Development Edge and Method Library capability expansion remains frozen until V1 (roadmap §6.1).
**Governing scope:** [`V1_ROADMAP_RECONCILIATION.md`](V1_ROADMAP_RECONCILIATION.md) §6 (V1-A and Gate A), accepted 2026-10-02.
**Baseline:** `main` at `35f106b4c1d9f37fd78e021505572c1e3ad0f3aa`.
**Date:** 2026-10-02.

## 1. Purpose

V1-A makes the substantial product that already exists reliably usable end to end, before anything is deployed. It adds no new product area. It removes dead ends, error paths and solo-operator traps from existing workflows, and adds a browser test suite so they cannot silently return.

The test of success is Kerrick's own: take a fresh local installation, establish the practice without SQL, create and staff an engagement, build and publish architecture at realistic scale, publish the client-facing records that already exist, and verify that the intended client can access them, with no dead ends (§8).

### 1.1 How this proposal was prepared

1. **The roadmap.** V1-A scope, Gate A and the frozen areas (§6.1) were taken from the accepted roadmap.
2. **Code investigation.** Three read-only surveys traced the authorization model, the client-visibility and file paths, routes and error handling, publishing, authentication and the test infrastructure, each with file and line evidence.
3. **Hands-on walkthrough.** A fresh install (`supabase db reset --no-seed`: no users, no organizations) was bootstrapped by following `docs/database/bootstrap.md`. A production build (`next build && next start`) was then driven in Chromium through Playwright as a solo first practice user: invite staff and a client, create and staff an engagement, create 20 elements across four domains, cite evidence, publish, and create and publish a deliverable, a review and an implementation initiative, then sign in as the client. The seeded demo was spot-checked afterwards. AI stayed off throughout.

Evidence tags: **[walkthrough]** observed in the browser; **[code]** read in source.

## 2. Summary

- **V1-A is 27 changes in 7 workstreams** (§4), plus the browser suite (§6). Most reuse existing functions, policies and components. **No new tables are needed.** Schema work is limited to one new practice-capability value, a handful of function and trigger redefinitions, and policy rewrites on three Phase 1 tables (§7).
- **The bootstrap trap is narrower, and the authority gap wider, than the roadmap said** (§3):
  - A solo **Principal Architect** already holds every architectural authority capability through role defaults. What they lack is **practice administration**: they cannot invite or manage TPLCo staff.
  - A solo **System Administrator** cannot do architecture work at all, which is correct.
  - But today **any engagement manager can staff any internal colleague, including themselves, as "Principal Architect" on an engagement** and so give them authority defaults. This bypasses the rule that only a Principal Architect grants authority (ADR-0024). It is a governance hole and is closed in V1-A as a correctness fix.
- **Proposed authority model:** practice administration becomes a practice capability (`administer_practice`) instead of a hard-coded System Administrator check. The first practice user is a **Principal Architect**. System Administrator keeps its operational role but gains no architectural authority, and loses the ability to mint it.
- **Three roadmap findings needed correcting** (§5):
  - implementation initiatives also have no client-visibility control;
  - the element-page 500 also affects reviews, and the app itself links there;
  - the trap is about practice administration, not authoring.
- **Ten new dead ends were found** (§5.2), the most serious being that an invitee who misses the one-hour link is permanently stranded, and that a relationship added between already-published elements can never reach the client without a noise republish.
- **Kerrick accepted D1 to D13 on 2026-10-02** (§9).

## 3. The authorization model and the bootstrap solution

### 3.1 What exists today [code]

| Concept                    | How it is held                                                                                                   | Where                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Organization role          | One row per person per organization in `organization_members`; one TPLCo organization exists                     | `20260929230000_phase1_foundation.sql:115-127`, `:113`                      |
| Engagement role            | `engagement_members.role`, set when staffing                                                                     | phase1:152-164                                                              |
| Engagement capabilities    | Defaults by **engagement role** plus per-member overrides                                                        | `20260929233000_engagement_capabilities.sql:121-146`                        |
| Authority capabilities     | `edit_architecture`, `publish_architecture`, `use_architecture_intelligence`, `authorize_external_ai_processing` | `20261001000300_architecture_governance.sql:20-28`; `20261007000100…:39-48` |
| Granting authority         | Only an organization-role Principal Architect, never for themselves                                              | `private.can_manage_capability`, governance:51-56; `catalog.ts:224`         |
| Practice capabilities      | `author_methodology`, `publish_methodology`: defaults by TPLCo role, overrides, never self, last-holder guard    | `20261005000100_practice_capabilities.sql`; ADR-0044                        |
| TPLCo staff administration | Hard-coded to the `system_administrator` role name                                                               | phase1:416, 720-724, 745-749, 765-775; `roles.ts:90`                        |

### 3.2 The four layers Kerrick asked to distinguish

| Layer                                        | Meaning                                                                                                                                     | Today                                                                                        | Proposed                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Practice administration**                  | Running TPLCo as an organization: invite, suspend and change the role of TPLCo staff; edit the practice organization; manage profile status | Welded to the System Administrator role name                                                 | A practice capability, `administer_practice`, held by default by Principal Architect and System Administrator, delegable by override, never self-administered, with a last-holder guard              |
| **System Administrator**                     | Technical and operational stewardship: portfolio visibility, the activity log, portfolio finance, contract execution                        | Also the only practice administrator, and able to invite anyone as Principal Architect       | Unchanged operational powers. Holds `administer_practice` by default. **Holds no architectural authority and cannot create it** (decision D2)                                                        |
| **Principal Architect**                      | Practice-wide architectural authority: the only role that grants authority capabilities to others; Method publication administration        | Cannot invite TPLCo staff                                                                    | Unchanged authority. Also holds `administer_practice` by default, so a solo Principal Architect can establish the practice                                                                           |
| **Engagement-level architectural authority** | The four authority capabilities on one engagement                                                                                           | Engagement-role defaults plus overrides, but the engagement role is unconstrained (the hole) | Unchanged mechanism. The internal engagement role always equals the person's TPLCo role (decision D3). Per-engagement differences go through overrides, which keep the Principal Architect-only rule |

### 3.3 Why not give System Administrator authority, or keep two identities

- **System Administrator with authority** collapses operations into architecture: the person who runs the system could publish client-facing architecture. Kerrick ruled this out (roadmap decision 2).
- **Two accounts for one person** (a System Administrator and a Principal Architect) turns "never for yourself" into theater: each account can grant the other.
- **A second TPLCo membership or an "is administrator" flag** breaks the one-membership invariant (phase1:126) and duplicates the practice-capability model that ADR-0044 already provides.

### 3.4 The proposed model in detail

1. **`administer_practice` practice capability** (change A1). Added to the existing `practice_capability` enum with defaults for `principal_architect` and `system_administrator`. The three System Administrator-only checks (TPLCo memberships, profile status and email, the TPLCo organization) call `has_practice_capability('administer_practice')` instead. The existing practice-settings page (`/internal/settings/practice`) gains the column, so it can be delegated, for example to a Project Administrator, without granting any authority.
2. **Only a Principal Architect creates architectural authority** (A2). Inviting or changing someone to an internal role whose defaults include an authority capability (`principal_architect`, `architect`, `researcher`) requires an organization-role Principal Architect who is not the target. System Administrators and delegated administrators may invite and manage the other internal roles. This makes the role assignment obey the same rule as capability overrides.
3. **Internal engagement role follows the organization role** (A3). For internal-side engagement members, the role is the person's TPLCo role, enforced by the existing `validate_engagement_member` trigger. Changing a TPLCo role updates that person's internal engagement rows in the same transaction. Overrides are kept. The engagement team UI shows the internal role read-only.
4. **Guards** (A4). Nobody changes their own TPLCo role or status. At least one active holder of `administer_practice` and at least one active Principal Architect must remain. These reuse the practice-capability lock and last-holder pattern (`lock_practice_override_target`, `assert_publish_methodology_remains`, practice_capabilities:235-271).
5. **The first practice user is a Principal Architect** (A7). They therefore hold, by role defaults and with no self-grant: all architectural authority on engagements they create (the creator is auto-assigned with their organization role, phase1:521-540), Method authoring and publication, the client directory, and practice administration.

**Why this is safe with only one Principal Architect.** A solo Principal Architect never grants anything to themselves. Their authority comes from role defaults, as it already does for every Principal Architect. The "a different Principal Architect" rule continues to govern exactly what it was meant to govern: overrides on other people and revocations. When a second Principal Architect joins, they can check each other's grants, and the last-holder guard prevents the practice from locking itself out.

### 3.5 What changes for existing data

- Seed data already complies with A3 (internal engagement roles equal TPLCo roles, `seed.sql:174-195`). The migration verifies this and fails loudly if any row does not.
- Existing overrides are unchanged.
- The System Administrator loses one power: inviting or promoting someone into an authority-bearing role (if D2 is accepted). Everything else a System Administrator does today continues.

## 4. Proposed changes

Each change lists: the current failure, the intended workflow, whether schema work is required, authorization and security, UI changes, automated tests, the browser acceptance scenario (§6.3), migration and compatibility, and the acceptance criterion.

### Workstream A: Practice establishment and authority

#### A1. Practice administration as a practice capability

- **Current failure.** A Principal Architect cannot invite, suspend or re-role TPLCo staff or edit the practice organization; only a System Administrator can (`roles.ts:89-92`, phase1:760-783). A solo Principal Architect can never add an Architect [walkthrough].
- **Intended workflow.** The first practice user, a Principal Architect, opens the practice organization page and invites colleagues, suspends and restores them, and changes their roles. They can delegate administration to a Project Administrator on the practice settings page.
- **Schema.** Yes. One new enum value (`administer_practice`, in its own migration because Postgres cannot use a new enum value in the same transaction), defaults rows, and rewrites of the TPLCo membership policy (phase1:762-783), `guard_profile_update` and its policy (phase1:406-422, 716-725), and the TPLCo organization update policy (phase1:741-750). No new tables.
- **Authorization and security.** Narrows nothing a System Administrator needs operationally. Adds no client-side power. The capability is internal-side only. The never-self rule and last-holder guard come from the existing practice-capability functions.
- **UI.** The TypeScript mirror `canManageInternalStaff` becomes a practice-capability check. The TPLCo organization page shows the invite form and member controls to holders. `/internal/settings/practice` gains the capability column.
- **Tests.** pgTAP: extend `01_phase1_rls` (a Principal Architect may now write TPLCo memberships; a Researcher may not), `24_practice_capabilities` (the new capability, delegation, never self, last holder) and a new `60_practice_administration` test. Vitest: `roles.test.ts`, `catalog.test.ts`.
- **Browser scenario.** G-1, G-2.
- **Migration and compatibility.** Existing System Administrators keep administration through defaults. ADR-0003 and ADR-0044 are amended; a new ADR records the four-layer model.
- **Acceptance criterion.** On a fresh install, a Principal Architect who is the only TPLCo member invites an Architect, and the invite is refused for a Researcher who holds no override.

#### A2. Only a Principal Architect creates architectural authority

- **Current failure.** A System Administrator can invite anyone as `principal_architect`, or change an existing person's role to it (RLS permits the update; the UI does not offer it), and so mint authority (phase1:760-783) [code].
- **Intended workflow.** A Principal Architect invites Architects, Researchers and other Principal Architects. A System Administrator or delegated administrator invites Project Administrators, Finance Administrators and other System Administrators.
- **Schema.** Yes: a check in the same membership policy or a `before` trigger on `organization_members` for TPLCo rows. No new tables.
- **Authorization and security.** Closes a route around ADR-0024. Requires decision D2.
- **UI.** The invite and role selectors list only the roles the viewer may assign.
- **Tests.** pgTAP: a System Administrator cannot invite or promote to the three authority-bearing roles; a Principal Architect can, but not for themselves.
- **Browser scenario.** G-2.
- **Migration and compatibility.** No existing data changes. Affects only future invitations and role changes.
- **Acceptance criterion.** pgTAP proves that no non-Principal Architect can create an authority-bearing TPLCo membership, by insert or update.

#### A3. Internal engagement role follows the organization role

- **Current failure.** Any engagement manager (System Administrator, Principal Architect or engagement Project Administrator) can staff any TPLCo person, including in some cases themselves, as `principal_architect` on an engagement, giving them `edit_architecture`, `publish_architecture` and both AI authority capabilities by default. `validate_engagement_member` checks only TPLCo membership, not role (phase1:483-519); the picker offers every internal role (`team-controls.tsx:34-37`). A Researcher can be staffed as "System Administrator" [walkthrough]. No test covers this.
- **Intended workflow.** Adding a colleague to an engagement asks only for the person; their role is their practice role. Per-engagement exceptions are capability overrides, granted under the existing rules.
- **Schema.** Yes: extend `validate_engagement_member` so an internal row's role must equal the person's active TPLCo role, and propagate TPLCo role changes to internal engagement rows. No new tables.
- **Authorization and security.** A correctness and security fix allowed under the freeze (roadmap §6.1). Engagement capability semantics are otherwise unchanged. Client-side rows are unaffected.
- **UI.** The "Add to team" form drops the role selector for internal people and excludes invited and suspended people. The team list shows the role read-only.
- **Tests.** pgTAP: mismatched internal roles are refused on insert and update; a TPLCo role change updates engagement rows and keeps overrides; a Project Administrator cannot raise their own engagement role.
- **Browser scenario.** G-3.
- **Migration and compatibility.** The migration first asserts that every existing internal row already matches (the seed does). If a hosted database ever has mismatches, the migration fails with a clear message rather than silently changing anyone's authority.
- **Acceptance criterion.** No internal engagement member can hold a role different from their TPLCo role, proven by pgTAP.

#### A4. Changing a member's role, with self and last-holder guards

- **Current failure.** There is no UI to change a role. TPLCo and client member rows offer only Suspend and Restore; engagement roles can only be removed and re-added, which loses overrides [walkthrough]. In the database, a System Administrator can change or suspend their own role and the last administrator can be removed (phase1:762-783) [code].
- **Intended workflow.** A practice administrator changes a TPLCo colleague's role from the organization page, with a confirmation that names the capabilities that change. A client-directory manager changes a client member's role the same way. Engagement rows follow (A3).
- **Schema.** Yes: guards in a trigger or in the membership policy (never self for role and status; at least one active `administer_practice` holder and one active Principal Architect remain), with an advisory lock as in `assert_publish_methodology_remains`. Client role change needs no schema; the policy already permits it.
- **Authorization and security.** Prevents self-escalation and lock-out. A2 applies to authority-bearing roles.
- **UI.** A role selector on each member row (`member-status-button.tsx` becomes a member-actions control), a confirmation, and Suspend with a confirmation too (none today).
- **Tests.** pgTAP: self-change refused; demoting or suspending the last Principal Architect or last administrator refused; concurrent demotions serialized. Vitest: action schema.
- **Browser scenario.** G-2.
- **Migration and compatibility.** None for data.
- **Acceptance criterion.** An administrator changes a colleague from Researcher to Architect in the UI and that person's engagement capabilities change accordingly, with no remove-and-re-add.

#### A5. Resending and revoking invitations

- **Current failure.**
  - Invite links expire after one hour (`config.toml` `otp_expiry = 3600`).
  - There is no resend: an invited row has no action, and re-inviting the same email is refused as "already a member" [walkthrough].
  - A sign-in link requested by an invited user is silently not sent (`422 signup_disabled`, swallowed in `src/lib/auth/actions.ts:39-48`) [walkthrough].
  - So **an invitee who misses the hour is stranded without SQL or the dashboard**. The first administrator's own bootstrap invite has the same exposure.
  - Adding an existing but unaccepted person to a second organization creates an invited row with no email at all (`addExistingPerson`, `memberships/actions.ts:164-195`).
  - Invited people are offered in the engagement "Add to team" picker [walkthrough].
- **Intended workflow.** An invited row shows "Resend invitation" and "Revoke". Resend sends a fresh link. Revoke removes the pending membership; if the person has no other membership and never accepted, their account is removed too, so the old link is dead.
- **Schema.** No. Resend uses the service-role admin client already used for invitations (`inviteUserByEmail`, falling back to `generateLink({type: 'invite'})`; to be verified against the local auth server during implementation). Revoke deletes the row under the existing policy.
- **Authorization and security.** Same permission as inviting (A1 for TPLCo, `can_manage_client_directory` for client organizations). Service-role use stays server-only and is limited to auth administration, as today.
- **UI.** Two actions on invited rows, with the invitation date shown. The team picker excludes invited and suspended people.
- **Tests.** Vitest for the actions (permission mirror, error mapping). Browser: resend produces a new email in Mailpit whose link works; a revoked link fails with a clear message.
- **Browser scenario.** G-2.
- **Migration and compatibility.** None.
- **Acceptance criterion.** An invitation older than its expiry can be resent from the UI and accepted, and a revoked invitation cannot be used.

#### A6. Editing the practice organization

- **Current failure.** The TPLCo organization page has no details form; client organizations have one [walkthrough].
- **Intended workflow.** A practice administrator edits the practice's display name and identifier on the same form used for client organizations.
- **Schema.** No beyond A1 (the update policy moves to `administer_practice`).
- **Authorization and security.** Practice administrators only. The organization type stays immutable.
- **UI.** Reuse the client organization details form.
- **Tests.** pgTAP covered by A1. Browser: G-1.
- **Migration and compatibility.** None.
- **Acceptance criterion.** The practice name is changed in the UI by the first user.

#### A7. Establishing the first practice user on a fresh local installation

- **Current failure.** The documented bootstrap needs the Supabase dashboard to invite, then SQL to create the TPLCo organization and a System Administrator membership (`docs/database/bootstrap.md:11-19`) [walkthrough]. The first user has no name ("Unknown" in the activity feed). A mismatch between the configured site URL and the browser origin makes the invite link consume itself and land on the login page silently [walkthrough].
- **Intended workflow.** On a fresh local installation, one documented command, for example `pnpm practice:bootstrap --email … --name …`, creates the practice organization and invites the named first user as a Principal Architect. It refuses to run if a practice organization already exists, and checks that the configured site URL matches the auth server's before sending. Everything after that happens in the UI.
- **Schema.** No. The command runs server-side with the local service-role key and calls existing tables. Per D6, this command is local and pre-production only and must not become the production bootstrap mechanism by default; V1-B makes a separate production-bootstrap decision.
- **Authorization and security.** Local and server-only, never a web route, so no unauthenticated setup surface exists. Idempotent and self-disabling once a practice exists.
- **UI.** None. `bootstrap.md` and the README are rewritten around the command.
- **Tests.** A script test against the local database (refuses a second run; creates exactly one organization and one Principal Architect membership). The browser suite's first spec runs this command on an unseeded database (§6).
- **Migration and compatibility.** None. The SQL route stays documented as a fallback for V1-B to replace.
- **Acceptance criterion.** From `supabase db reset --no-seed`, one command plus the emailed link produces a named Principal Architect who can carry out G-1 to G-8 without SQL.

### Workstream B: Client-facing records

#### B1. Client visibility for deliverables, reviews and implementation initiatives

- **Current failure.** All three are element kinds on the shared spine, and visibility is the spine column `architecture_elements.client_visibility` (default `internal`). The only UI that sets it is the generic element form, which crashes for these kinds (C1). So **none of the three can reach the client through the UI** [walkthrough: DLV-001, REV-001 and IMP-001 each published and stayed internal; the portal showed "No deliverables yet", "No reviews published yet" and "No published initiatives yet"]. The seed sets all three with SQL (`seed.sql:1064`, `:1087`, `:1126`, `:1174`).
- **Intended workflow.** On each record's page, a holder of `publish_architecture` sees "Client visibility: Internal / Client" and can change it. The control explains that clients see the latest published version, and that a change takes effect immediately on what is already published.
- **Schema.** No. The column grant, update policies, the publisher-only trigger and the method-IP check already exist (`architecture_core.sql:1420-1422`, `:524`, `:2238-2240`, `:2341`; `20261003000100…:1173-1183`). pgTAP already flips it as a Principal Architect.
- **Authorization and security.** Governed by `publish_architecture`, not `manage_deliverables` or `manage_reviews`; the database enforces this. Confidential deliverables still need `view_confidential_deliverables`; area limits still apply (`element_client_readable`, 20261003000100:609-633).
- **UI.** One shared `ClientVisibilityControl` and one server action, used on the three detail pages; the current visibility shown in each page's details list.
- **Tests.** pgTAP in `16_reviews`, `17_deliverables`, `18_implementation`: a Researcher or Project Administrator (manage but not publish) is refused; a flip to client exposes the record through `client_deliverables`, `client_reviews` and the initiative read model, and a flip back hides it; the confidential gate holds. Vitest for the action.
- **Browser scenario.** G-6, G-7.
- **Migration and compatibility.** None.
- **Acceptance criterion.** A deliverable, a review and an initiative created entirely in the UI appear in the client portal after the architect sets them to client.

#### B2. Editing review fields

- **Current failure.** The review page has no field edit, although the database grants `review_type`, `scheduled_for`, `baseline_id` and `summary` and has an update policy (20261003000100:1098, :1124) [code].
- **Intended workflow.** "Edit review fields" on the review page, as deliverables and initiatives already have.
- **Schema.** No.
- **Authorization and security.** `manage_reviews`, as the policy already requires.
- **UI.** One form, reusing the existing deliverable and initiative field-form pattern.
- **Tests.** Vitest for the schema; pgTAP covered.
- **Browser scenario.** G-6.
- **Migration and compatibility.** None.
- **Acceptance criterion.** A scheduled review's date and summary are corrected in the UI.

#### B3. Clients can download published deliverable files

- **Current failure.**
  - `private.can_read_engagement_file` has no deliverable clause (project_intelligence.sql:828-850), so a client gets 404 [walkthrough].
  - There is no portal deliverables page; the overview lists the title as plain text [walkthrough].
  - Internally, the attached file is plain text, not a link [walkthrough].
  - Files attach to one version, and the pages show only the latest version's files, so **any republish, even a summary fix, makes the file disappear** (20261003000100:1272-1315; `deliverables/[deliverableId]/page.tsx:54`) [code].
- **Intended workflow.** The client opens the engagement's deliverables, sees each client-visible published deliverable with its version and files, and downloads them. The architect sees the same files as links, grouped by version.
- **Schema.** Yes, one function redefinition. Add a clause to `can_read_engagement_file` that mirrors the existing client read of element versions exactly: purpose `deliverable`, attached to a version, `can_view_client_architecture` on the engagement, and `element_client_readable` on the deliverable. The table policy and the storage policy both call this function, so `/files/[fileId]` needs no change.
- **Authorization and security.** Inherits every existing client gate: live client visibility, published, not retired, the reader's areas, and the confidential gate. A file is never readable before the deliverable is client-visible and published.
- **UI.** A portal Deliverables list (title, type, published version, files) linked from the existing overview panel; it uses the existing `FileList` component. Internal filenames become links. Files are listed across all versions with their version number (decision D9).
- **Tests.** pgTAP in `17_deliverables` and `20_phase5_area_visibility`: a client reads the row and the storage object when the deliverable is client-visible and published; denied when internal, retired, unattached, confidential without the capability, outside an area-limited contributor's areas, or on another engagement.
- **Browser scenario.** G-7.
- **Migration and compatibility.** Function-only. Additive: no existing reader loses access.
- **Acceptance criterion.** A client signed in to the portal downloads the file attached to a client-visible deliverable, and a client of another engagement cannot.

### Workstream C: Routes and error handling

#### C1. Records opened through the generic element route

- **Current failure.** `/architecture/elements/[id]` returns 500 for deliverable, review and initiative ids (`RECORD_KIND_LABELS` lacks the Phase 5 kinds, `elements/[elementId]/page.tsx:684-686`) [walkthrough: all three]. Contrary to the roadmap, **the app links there**: `ElementLink` (`badges.tsx:79-97`), version links in `VersionsPanel` (`versions-panel.tsx:146`, rendered on all three record pages), the relationships panel, the activity list and the review dossier.
- **Intended workflow.** Any link to a record opens that record's own page; version links open the version on that page.
- **Schema.** No.
- **Authorization and security.** None; pages keep their existing checks.
- **UI.** The generic page redirects Phase 5 kinds to their own page using the existing, tested `internalElementHref` (`src/domain/architecture/links.ts`). `ElementLink`, version links and the dossier route through it. The three record pages show a requested version with the existing snapshot view.
- **Tests.** Vitest in `links.test.ts`. Browser: every record kind reached from the generic route, a relationship panel and a version link.
- **Browser scenario.** G-9.
- **Migration and compatibility.** None.
- **Acceptance criterion.** No link anywhere in the app leads to a 500 for a record of any kind.

#### C2. Invalid ids return a not-found page

- **Current failure.** A non-UUID id returns 500 on the deliverable, review, initiative, baseline and Method Application pages and **on the client portal's architecture element page** (`invalid input syntax for type uuid`) [walkthrough]. Method Library pages already validate first and return 404 (the pattern to copy).
- **Intended workflow.** A mistyped or stale link shows a not-found page with a way back.
- **Schema.** No.
- **Authorization and security.** Removes server error detail from client-reachable paths.
- **UI.** A `z.uuid()` check before any query on every dynamic id route, internal and portal.
- **Tests.** Browser: each dynamic route with a malformed id, an unknown id and another engagement's id returns 404.
- **Browser scenario.** G-9.
- **Migration and compatibility.** None.
- **Acceptance criterion.** Every dynamic route returns 404, not 500, for malformed, unknown or foreign ids.

#### C3. Error and not-found boundaries

- **Current failure.** There is no `error.tsx` anywhere; any unexpected error shows the bare framework page. The one `not-found.tsx` is generic and links to `/`. The file route's 404 is a bare browser page [walkthrough]. The review dossier swallows all errors and silently disappears (`layer1-queries.ts:167`) [code].
- **Intended workflow.** An unexpected error shows a calm, branded page in the right shell (internal or portal) with a way back and a reference for support. A not-found page links back to the engagement.
- **Schema.** No.
- **Authorization and security.** Error pages never show error messages or stack details to clients.
- **UI.** `error.tsx` and `not-found.tsx` for the internal area and the client portal. The dossier logs its failure server-side and shows "The dossier could not be prepared" instead of disappearing.
- **Tests.** Browser: a forced error in a test-only route renders the boundary (non-production only), and unknown routes render the right not-found page.
- **Browser scenario.** G-9.
- **Migration and compatibility.** None.
- **Acceptance criterion.** Every internal and portal route sits under an error boundary, and no reachable page shows the framework error page.

### Workstream D: Publishing at realistic scale

#### D1. Bulk submit and bulk publish

- **Current failure.** Each element is published individually: open, Publish, optional note, submit, confirm, page load [walkthrough: 20 elements took 20 round trips]. Clients see architecture only after publication, so a real engagement of 100 to 300 elements is impractical.
- **Intended workflow.** On a domain's element list or the records register, an architect selects elements (or "everything in review") and chooses Submit or Publish. A confirmation states the count, how many will be client-visible, and that each becomes an immutable version. A result list shows each element's outcome and the reason for any refusal.
- **Schema.** Yes, function-only (decision D8): `publish_element_versions(ids, change_summary)` and `submit_elements_for_review(ids)`, each calling the existing per-element function in a stable order with a per-element exception block and returning a per-element report. No table changes.
- **Authorization and security.** Every inner call keeps its own capability check and every refusal rule (retired, AI review pending, no scope, methodology lineage). Versions, publishers and activity are recorded per element exactly as today.
- **UI.** Selection checkboxes and an action bar on the domain list and the records register; the confirmation and result list.
- **Tests.** pgTAP: per-element capability refusal, partial failure (one refused element does not block the rest), every published element gets its own version and activity rows, concurrent bulk publishes do not deadlock. A scale fixture of at least 150 drafts.
- **Browser scenario.** G-5.
- **Migration and compatibility.** Additive.
- **Acceptance criterion.** An architect publishes 150 elements across two domains in one action, each with its own recorded version, and the client sees them.

#### D2. Publishing relationships between already-published elements

- **Current failure.** A relationship is published only when one of its ends is published (`typed_method_lineage.sql:294-304`). A relationship added later between two published elements stays "Draft", is invisible to the client, and can be published only by republishing an end, which creates a meaningless new version. Nothing explains this [code].
- **Intended workflow.** The relationships panel shows draft relationships whose ends are both published, with "Publish relationship". Bulk publish (D1) also publishes them.
- **Schema.** Yes, function-only: a `publish_relationships` operation, requiring `publish_architecture`, that stamps eligible relationships inside the existing architecture-operation guard.
- **Authorization and security.** Same capability and client gates as today; a relationship is client-readable only if both ends are.
- **UI.** A per-relationship action and a "pending publication" label that explains why.
- **Tests.** pgTAP: eligible relationships publish, ineligible ones are refused, no element version is created.
- **Browser scenario.** G-5.
- **Migration and compatibility.** Additive.
- **Acceptance criterion.** A relationship added between two published elements reaches the client without republishing either element.

#### D3. Bulk client visibility

- **Current failure.** Elements are created internal by default, and visibility is changed one element at a time [walkthrough].
- **Intended workflow.** "Set client visibility" on the same selection as D1.
- **Schema.** No. A plain update as the user; the publisher-only trigger and the method-IP check already enforce the rules.
- **Authorization and security.** `publish_architecture`; method-IP can never become client-visible.
- **UI.** One more action on the selection bar.
- **Tests.** pgTAP: refused without publish; refused for method-IP. Browser: G-5.
- **Browser scenario.** G-5.
- **Migration and compatibility.** None.
- **Acceptance criterion.** An architect makes a selection of 50 elements client-visible in one action.

### Workstream E: Account recovery

V1-A covers recovery flows that work locally through the Supabase auth server and the local mail catcher. Production email delivery, MFA, session limits and sign-in auditing remain V1-B.

#### E1. Forgot password

- **Current failure.** No reset link on the login page; nothing calls the reset API. The recovery template, the confirmation route and the set-password page already exist [walkthrough, code].
- **Intended workflow.** "Forgot your password?" on the login page, an email with a link, then choosing a new password.
- **Schema.** No.
- **Authorization and security.** The same non-revealing response as the sign-in link ("If this address has access…").
- **UI.** A forgot-password page and action.
- **Tests.** Browser: the reset email arrives in Mailpit and the new password signs in.
- **Browser scenario.** G-10.
- **Migration and compatibility.** None. Production rate limits (`email_sent = 2` per hour, `config.toml:199`) are a V1-B setting.
- **Acceptance criterion.** A user who forgot their password regains access without help.

#### E2. Changing your password

- **Current failure.** The set-password page has no link from anywhere and greets the user as if for the first time [walkthrough].
- **Intended workflow.** "Change password" in the user menu, for internal users and clients.
- **Schema.** No.
- **Authorization and security.** Requires a signed-in session. Reauthentication stays a V1-B decision (`secure_password_change`).
- **UI.** A menu link; copy that fits both first-time and change.
- **Tests.** Browser: G-10.
- **Browser scenario.** G-10.
- **Migration and compatibility.** None.
- **Acceptance criterion.** A signed-in user changes their password from the menu.

### Workstream F: Other dead ends that stop existing features being used as intended

| Id     | Current failure                                                                                                                                                                         | Proposed change                                                                                                                                           | Schema         | Acceptance criterion                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| **F1** | Evidence sources cannot be deleted [walkthrough]. The database already allows deleting an _unreferenced_ source (every reference is `on delete restrict`) [code]                        | "Delete source" for uncited sources; a cited source explains where it is cited (decision D10)                                                             | No             | An uncited source is deleted in the UI; a cited one cannot be                             |
| **F2** | The relationship target is a flat list of every element; invalid pairs fail only after submit, with raw kind names [walkthrough]                                                        | A searchable target picker that lists only targets valid for the chosen relationship type, using the existing relationship catalog; readable error labels | No             | A target is found by typing part of its code or title, and only valid targets are offered |
| **F3** | Supersede needs an existing successor; there is no "create successor" [code]                                                                                                            | "Create successor" composes the existing create action and `supersede_element` (decision D11)                                                             | No             | A published element is superseded by a new draft in one flow                              |
| **F4** | The review queue names the last editor as the submitter (`reviews/page.tsx:217-218`) [walkthrough]                                                                                      | Read the submitter and time from the element's submit event                                                                                               | No             | The queue names the person who submitted                                                  |
| **F5** | Review schedule and hold date fields are plain text needing `YYYY-MM-DDTHH:mm` [walkthrough]                                                                                            | Native date-time inputs                                                                                                                                   | No             | A review is scheduled with the browser's date-time control                                |
| **F6** | Internal pages overflow at 390 px; the compact nav reaches 5 areas (`internal/layout.tsx:72-87`) [roadmap walkthrough]                                                                  | Responsive padding, a wrapping nav, and a menu listing every destination                                                                                  | No             | Representative internal pages fit 390 px and every area is reachable                      |
| **F7** | Internal identifiers and stale phase text appear in the UI ("needs view_confidential_deliverables", "Phase 3 does not generate AI content", raw kind names in errors) [walkthrough]     | Replace with Method vocabulary                                                                                                                            | No             | No capability key, snake_case kind or phase number appears in UI copy                     |
| **F8** | The seeded flagship engagement (Meridian) shows no client-visible deliverable, review or initiative, and the seed contains no files, so a download cannot be demonstrated [walkthrough] | Extend the seed: client-visible records on Meridian and a seeded deliverable file                                                                         | No (seed only) | The demo shows a client downloading a deliverable on the flagship engagement              |
| **F9** | An engagement's creator is staffed automatically and appears on the client's team list with an email as their name [walkthrough]                                                        | The first-user bootstrap sets a name (A7); the client team list shows names only                                                                          | No             | No email address appears as a person's name in the portal                                 |

### Workstream G: Browser acceptance

See §6.

## 5. Scope changes from the reconciliation

### 5.1 Corrections to the roadmap's findings

| Roadmap said                                                                       | Evidence shows                                                                                                                             | Effect                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Implementation initiatives have a client-visibility control                        | Only their checkpoints do; initiatives are as stuck as deliverables and reviews [walkthrough]                                              | B1 covers all three kinds with one control                     |
| The element-page 500 affects deliverables and initiatives, and nothing links there | Reviews too, and the app links there from five places [walkthrough, code]                                                                  | C1 fixes the links as well as the page                         |
| A lone first user cannot author architecture                                       | True only for a System Administrator. A solo Principal Architect can author; what they lack is practice administration [code, walkthrough] | The bootstrap solution centres on practice administration (§3) |

### 5.2 Added to V1-A

These were found during this investigation. All are dead ends or correctness gaps in existing features, so they fall inside V1-A's objective.

1. **Engagement roles can bypass the authority rule** (A3). A security and correctness fix.
2. **System Administrators can mint Principal Architects** (A2), subject to decision D2.
3. **No self or last-holder guard on TPLCo roles** (A4).
4. **Invitees are stranded after one hour**, and adding an existing person to a second organization sends no email (A5).
5. **The practice organization cannot be edited** (A6).
6. **Malformed ids return 500, including in the client portal** (C2).
7. **Deliverable files vanish from view after a republish, and are not links even internally** (B3).
8. **Review fields cannot be edited** (B2).
9. **Relationships between published elements cannot be published** (D2).
10. **Smaller dead ends:** review queue attribution (F4), date-time fields (F5), internal jargon (F7), demo data (F8), emails shown as names (F9), and the silent dossier failure (C3).

### 5.3 Considered and kept out of V1-A

| Item                                                                          | Why it stays out                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changing an element's type                                                    | Reference codes are permanent and domain-prefixed; retire and create (or F3) covers the need. Not a dead end                                                                     |
| Archiving cited evidence                                                      | Needs a new column; deleting uncited sources is enough to correct mistakes (D10)                                                                                                 |
| Separation of duties on publishing                                            | Would block the solo operator V1-A exists to support; a policy question for later                                                                                                |
| Profile-level status UI, engagement deletion, data export                     | Not needed for any existing workflow to complete; data lifecycle is V1-E or later                                                                                                |
| The "Approve architecture" capability shown for System Administrators         | It only takes effect together with the client-side `view_architecture`, so it grants internal users nothing (`architecture_core.sql:95-106`). Clarifying the label is part of F7 |
| Production bootstrap, SMTP, MFA, session limits, security headers, monitoring | V1-B                                                                                                                                                                             |
| Notifications, comments, documents area, client-initiated requests            | V1-C                                                                                                                                                                             |
| Generated deliverables, exports, executive review mode                        | V1-D                                                                                                                                                                             |
| Intake, import, search, completeness views                                    | V1-E                                                                                                                                                                             |
| Any Architecture Intelligence, Development Edge or Method Library capability  | Frozen until V1 (roadmap §6.1). V1-A touches these areas only to fix defects: the dossier links (C1), the dossier's silent failure (C3) and jargon (F7)                          |

## 6. Browser-testing strategy

### 6.1 Tooling

- **Playwright** (`@playwright/test`) as a single devDependency, pinned to the version that matches the preinstalled Chromium, with a `test:e2e` script and an `e2e/` folder. It has no runtime impact. Adding it needs Kerrick's approval (decision D12).
- Specs drive a **production build** (`next build && next start`) against local Supabase, as the walkthrough did, with Architecture Intelligence off.
- Invitation, sign-in and reset links are read from the local mail catcher's API, so the real email flows are exercised.
- One worker, because specs share database state. Traces and screenshots are kept on failure.

### 6.2 CI

- A new **Browser** job in `.github/workflows/ci.yml`:
  1. start Supabase with the same exclusions as the Database job, keeping auth, storage and the mail catcher;
  2. build the app with the real local keys (public values are inlined at build time, so the App job's placeholder build cannot be reused);
  3. start the app, run the suite, upload traces on failure, and stop Supabase.
- Estimated at 9 to 12 minutes (not yet measured).
- **Making "Browser" a required check is a branch-protection setting only Kerrick can change.** Gate A condition 1 asks for it.

### 6.3 Scenarios

Two runs, in order:

**Run 1: fresh installation (unseeded database).** This is the Gate A proof.

| Id   | Scenario                                                                                                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-1  | Run the bootstrap command; the first user accepts the invite from the mail catcher, sets a password, sees their name, and edits the practice organization                                                                                                                                                                                 |
| G-2  | The first user invites an Architect and a Project Administrator; both accept. The first user changes the Project Administrator's role, resends an expired invitation (by advancing time or using a short expiry in the test configuration), and revokes another. A System Administrator invited later cannot invite a Principal Architect |
| G-3  | Create a client organization, invite a client lead who accepts, create an engagement, staff the Architect (role shown, not chosen) and the client lead                                                                                                                                                                                    |
| G-4  | The Architect creates elements in all four domains, cites an uploaded evidence source, and adds relationships using the searchable picker                                                                                                                                                                                                 |
| G-5  | A scale fixture adds 150 drafts. The Architect sets a selection to client-visible, bulk publishes, and publishes a relationship added afterwards. The client sees the published architecture and the relationship                                                                                                                         |
| G-6  | Create and publish a review, edit its fields, hold it, and make it client-visible                                                                                                                                                                                                                                                         |
| G-7  | Create a deliverable, publish it, attach a file, make it client-visible, republish with a corrected summary. The client sees the deliverable and downloads the file; the file is still listed after the republish                                                                                                                         |
| G-8  | Create an initiative, publish it and make it client-visible; record an invoice and a payment. The client sees the initiative and, with finance access, the invoice                                                                                                                                                                        |
| G-9  | Every record kind is opened through the generic element route and through version links; malformed, unknown and foreign ids return the not-found page, internally and in the portal                                                                                                                                                       |
| G-10 | Forgot password and change password, for an internal user and a client                                                                                                                                                                                                                                                                    |

**Run 2: seeded demo.** Smoke checks that every internal and portal navigation destination loads without an error for each seeded role, that a client of one engagement cannot reach another's records or files, and that internal and portal pages fit at 390 px.

### 6.4 What the suite proves, and what it does not

The browser suite proves that the workflows are usable end to end. **Authorization stays proven in pgTAP**, where every capability and boundary rule above gets its tests. The browser suite adds negative checks only where a user would meet them (another engagement's file, a refused role).

## 7. Schema impact

| Change     | Schema work                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| A1         | One new enum value (separate migration); default rows; rewrites of three Phase 1 policies and `guard_profile_update` |
| A2, A4     | A guard trigger or policy check on TPLCo memberships, with an advisory lock                                          |
| A3         | `validate_engagement_member` extended; a role-propagation trigger; a pre-check migration                             |
| B3         | `can_read_engagement_file` redefined (one added clause)                                                              |
| D1         | Two new function-only wrappers                                                                                       |
| D2         | One new function                                                                                                     |
| All others | None                                                                                                                 |

No new tables, no column changes, no data backfills beyond the A3 pre-check. Each migration is paired with pgTAP and recorded in ADRs: one new ADR for the four-layer authority model (amending ADR-0003, ADR-0024 and ADR-0044), and short ADRs for client file reads and bulk publication.

## 8. Gate A: the V1-A completion gate

V1-B does not start until all of these hold and Kerrick accepts them. They restate the roadmap's Gate A in observable product terms.

**This gate governs V1-A completion.** It is preserved as written. If implementation reveals a contradiction in it, the contradiction is brought back to Kerrick explicitly rather than resolved by changing the gate. Passing or merging individual workstream PRs does not satisfy the gate: V1-A is complete only after the full Gate A assessment below and Kerrick's manual acceptance.

1. **A fresh installation is established without SQL.** From an unseeded local database, the documented bootstrap command and the emailed link produce a named Principal Architect. From then on, no step needs SQL, the Supabase dashboard or a developer.
2. **The practice is administered in the UI.** The first user edits the practice organization, invites colleagues, changes a role, resends and revokes invitations, and delegates administration, while System Administrators cannot create architectural authority (subject to D2).
3. **An engagement is created and staffed.** A client organization, an accepted client lead, an engagement, and an internal team whose roles follow the practice roles.
4. **Architecture is built and published at realistic scale.** At least 150 elements across domains, with cited evidence and relationships, are made client-visible and published in bulk, each as its own recorded version, including relationships added after publication.
5. **Client-facing records reach the client.** A deliverable, a review and an implementation initiative created in the UI are made client-visible and published, and the client sees each in the portal.
6. **The client downloads the deliverable's file,** including after a republish, and a client of another engagement cannot.
7. **No dead ends.** No reachable internal or portal page returns an unhandled error; malformed, unknown and foreign ids show a not-found page; every route sits under an error boundary; forgot and change password work.
8. **The safety net is in place.** The browser suite (§6.3) runs in CI as a required check and is green, alongside App and Database. pgTAP proves the authority model: no non-Principal Architect can create authority by any route; internal engagement roles equal practice roles; self-change and last-holder guards hold; client file reads follow the client boundary.
9. **Kerrick's own manual browser pass** of steps 1 to 7 is accepted.

## 9. Decisions (accepted by Kerrick, 2026-10-02)

Kerrick accepted the V1-A direction and approved D1 to D13 with the recommended choices, with the clarifications recorded below.

| #       | Accepted decision                                                                                                                                                                                                                                                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1**  | Practice administration is the practice capability `administer_practice`                                                                                                                                                                                                                                                                           |
| **D2**  | Only a Principal Architect may create architectural authority-bearing practice roles (Principal Architect, Architect and Researcher), and never for themselves                                                                                                                                                                                     |
| **D3**  | Internal engagement roles must match the person's practice role. Engagement-specific differences in authority belong in governed capability overrides, not alternate engagement roles                                                                                                                                                              |
| **D4**  | Principal Architect and System Administrator hold `administer_practice` by default                                                                                                                                                                                                                                                                 |
| **D5**  | Both safeguards are enforced: no one changes their own role or status, and at least one active practice administrator and one active Principal Architect always remain                                                                                                                                                                             |
| **D6**  | V1-A uses the documented local bootstrap command (A7). **It is explicitly a local and pre-production solution and must not become the production bootstrap mechanism by default. V1-B makes a separate production-bootstrap decision**                                                                                                             |
| **D7**  | The first practice user is a Principal Architect                                                                                                                                                                                                                                                                                                   |
| **D8**  | Bulk publication is a function that wraps the existing per-element publication behavior and preserves per-element version and audit semantics                                                                                                                                                                                                      |
| **D9**  | Deliverable files are shown across versions, clearly labelled by version. Files are not copied forward merely because a deliverable is republished                                                                                                                                                                                                 |
| **D10** | V1-A may delete uncited evidence only. Evidence archiving is not introduced in V1-A                                                                                                                                                                                                                                                                |
| **D11** | "Create successor" composes the existing governed actions; no new atomic database operation                                                                                                                                                                                                                                                        |
| **D12** | Playwright and a Browser CI job are added. The Browser suite is part of Gate A and must be green before V1-A is accepted. Making "Browser" a required check on `main` is a branch-protection setting only Kerrick can change                                                                                                                       |
| **D13** | V1-A is implemented through small sequential PRs in this order, each stopping for Kerrick's review before merge: browser suite foundation with the fresh-install spec; authority and practice administration (A1-A7); client-facing records and files (B); routes and errors (C); publishing at scale (D); recovery and remaining dead ends (E, F) |

## 10. What this document did not do

- It changed no application code, schema, migration, dependency, credential or provider configuration.
- It did not begin V1-A. Kerrick accepted this plan and the decisions in §9 on 2026-10-02; implementation starts only on his instruction.
- It added no capability in the frozen areas (Architecture Intelligence, Development Edge, Method Library). Step B remains on hold.
- The walkthrough ran only against local Supabase with AI off. All test data was disposable, and the database was reset to the seed afterwards.
