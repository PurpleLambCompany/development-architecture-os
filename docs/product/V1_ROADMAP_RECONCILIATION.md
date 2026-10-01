# V1 Roadmap Reconciliation: Development Systems Architecture OS

**Status:** For Kerrick's review. This is investigation and planning only. No application code, schema, migration, dependency, credential or provider configuration was changed.
**Baseline:** `main` at `162e9cd9f0b2324580c44684983531aabfccf589`, after Phase 7B.2 Step A.
**Date:** 2026-10-01.

## 1. What this document answers

This document gives an evidence-based picture of:

- what has actually been built;
- what remains;
- the shortest governed path from the current system to a usable V1.

A usable V1 means TPLCo can deliver a paid Development Systems Architecture engagement, and the client can take part, without a developer.

The document does not treat Architecture Intelligence Step B as the next task by default. It does not assume the existing phase numbering is right.

### 1.1 How the evidence was gathered

1. **Documents.** I read:
   - `DSA_OS_MASTER_BUILD_SPEC.md`, especially §22 MVP scope, §23 do-not-build, §28 navigation and §33 definition of success;
   - `README.md` and `CLAUDE.md`;
   - all phase proposals and reports;
   - the 73 ADRs;
   - `docs/database/`.
2. **Code.** Four independent read-only surveys traced every area through migrations, domain code, server actions, pages and tests. Each survey checked which UI component calls each server action, rather than assuming a function is reachable.
3. **Hands-on walkthrough.** On a freshly reset local database, I ran the production build (`next build && next start`) with AI off and drove it in a real browser. The walkthrough created a brand-new engagement from nothing through the UI:
   - a new client organization;
   - a client invitation, accepted from the actual email at a phone width;
   - a new engagement and team assignment;
   - an architecture object, created, submitted and published;
   - a deliverable, created, published and given a file;
   - the client portal, checked as the invited client.

   Findings from the walkthrough are marked **[walkthrough]**. Findings from code reading alone are marked **[code]**.

### 1.2 What "complete" means here

Each area is assessed on six layers:

| Layer         | Meaning                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| **Designed**  | Specified in the spec, an ADR or a proposal                                        |
| **Persisted** | Tables, functions and policies exist                                               |
| **Code**      | Domain functions or server actions exist                                           |
| **UI**        | A person can reach it from navigation and use it                                   |
| **Tested**    | Automated tests cover it (pgTAP, Vitest)                                           |
| **E2E**       | A real Principal Architect or client can do it start to finish without a developer |

Schemas, ADRs and tests do not count towards completion on their own.

**Two caveats apply to every area:**

- **No automated browser tests.** The repository has no end-to-end browser test suite. Phases 4 and 5 report that their UI was not clicked through. Only Phase 7B.2 Step A had a browser acceptance pass, and that used the fake provider.
- **Never deployed.** There is no Vercel project, no hosted Supabase project and no domain.

---

## 2. Executive summary

1. **The core is real and strong at the database layer.**
   - It covers 27,500 lines of migrations, 117 tables (all with row-level security), 60 pgTAP files and 47 Vitest files.
   - Tenant isolation, the capability model and the client boundary are credible and heavily tested.
   - Engagement setup, the four-domain architecture, Project Intelligence registers, decisions, finance recording and implementation tracking all work through the UI.
2. **The product cannot yet run a real paid engagement without a developer.** The blockers are workflow gaps and operations, not missing infrastructure:
   - **It has never been deployed.** The first administrator is bootstrapped with SQL.
   - **No production email.** SMTP is not configured, there is no forgot-password flow and there are no workflow notifications.
   - **Client-visibility dead end [walkthrough].** A deliverable created in the UI cannot be made client-visible. Reviews have the same gap [code]. The seed data does it with SQL. Only implementation initiatives have a client-visibility control.
   - **Clients cannot download deliverable files [code].** The file-read policy has no deliverable clause.
   - **Element page error [walkthrough].** The generic element page returns HTTP 500 for a deliverable's id. This was already known for initiative ids. Nothing links there, but it is an unhandled error path.
   - **Nothing generates a client-ready output.** There are no deliverables built from the architecture and no export in any format. Every client document must be written outside the system and uploaded.
   - **No executive review mode** as spec §11 describes it.
3. **Client participation is partial.** Clients can:
   - respond to requests;
   - approve elements and versions;
   - decide client decisions;
   - contribute comments on published elements;
   - approve change orders;
   - see billing.

   They are never told that anything needs them. Documents and Messages are placeholders. They cannot comment on reviews and cannot invite their own colleagues.

4. **There is no intake or discovery workflow, and no bulk entry.** Discovery happens outside the app and is retyped one form at a time. Every element is published individually. This will not hold up at real engagement size.
5. **Infrastructure has outrun product workflow.** The last three phases (Method Library, Development Edge, Architecture Intelligence) account for:
   - 48% of migration lines;
   - 33 of 73 ADRs;
   - about 34 of 60 pgTAP files.

   Two of them sit outside spec §22 MVP. Spec §18 calls AI "POST-MVP". The Method Library goes well beyond the §22 "Method/IP Foundation". Meanwhile, MVP essentials from §12, §22 and §33 remain unbuilt: generated deliverables, notifications, review comments and documents.

6. **Step B is not on the V1 critical path.** It unlocks internal-only, suggestion-labelled interpretations. It addresses none of the blockers above. It also cannot touch real engagement data until the B-4 contractual prerequisites are met. It belongs after V1's core workflows, as an optional increment.
7. **Proposed path to V1:** five short phases, numbered here as V1-A to V1-E:
   - V1-A Workflow Closure;
   - V1-B Production Foundation;
   - V1-C Participation and Awareness;
   - V1-D Engagement Outputs;
   - V1-E Discovery and Scale.

   Step B and the rest of the deferred scope come after them.

8. **First real use.** Kerrick can begin a real engagement himself at the end of V1-B, as a closely supervised pilot. He would contact the client outside the app, write deliverables outside the app and keep AI off. V1 is reached at the end of V1-E, once one real engagement has been delivered end to end.

---

## 3. The intended product, reconstructed

From the spec and the phase documents, a DSA engagement in DSA OS runs like this:

1. **Set up.** TPLCo creates the client organization, invites the client team, creates the engagement (type, objective, timeline, phase) and assigns the internal team.
2. **Commercial.** A contract, payment plan and milestones are agreed. Invoices are issued, payments are recorded and change orders are handled.
3. **Discovery.** Client context, stakeholders, interviews and existing documents are gathered as evidence. Questions are sent to the client.
4. **Architecture construction.** Across the four domains (Knowledge, Capability, Strategic Model, Application), architects build structured elements and typed relationships with statements cited to evidence. The work moves through draft, review and publication. Publication is the client-visibility boundary.
5. **Project Intelligence.** Assumptions, risks, dependencies, decisions (with options) and opportunities are maintained, triaged and escalated.
6. **Governance.** The Development Edge surfaces what needs attention, and humans judge it. Baselines freeze the architecture at milestones.
7. **Executive reviews.** Structured sessions put findings, gaps, decision points and risks to the client, who approves, comments, requests revision or defers.
8. **Deliverables.** The Full Architecture Blueprint, Executive Strategy Deck, Capability Map, Implementation Framework, Measurement Model and Executive Summary are generated from the structured data (spec §12), published and approved.
9. **Implementation.** Initiatives realize the approved architecture. Realization is tracked and validated through held reviews.
10. **Client portal throughout.** The client can see:
    - where the engagement stands;
    - the four domains;
    - what they need to do;
    - documents and deliverables;
    - billing.
11. **Method and IP protection.** Method assets stay internal. Lineage and classification protect TPLCo's IP.
12. **Architecture Intelligence.** Post-MVP in the spec. It is optional, internal and suggestion-only.

Spec §33 defines MVP success. The client can:

- log in;
- understand where the engagement stands;
- see the four domains;
- respond to decisions and requests;
- review deliverables;
- understand what they owe and have paid;
- see upcoming obligations;
- access approved documentation.

TPLCo can:

- structure the engagement;
- architect the initiative;
- preserve evidence and decisions;
- protect method;
- maintain financial visibility;
- generate consistent deliverables;
- retain reusable knowledge.

---

## 4. Area-by-area status

Key: ● present and adequate · ◐ partial · ○ absent · — not applicable.

| #   | Area                                     | Designed | Persisted | Code | UI  | Tested | E2E | Classification                                                                |
| --- | ---------------------------------------- | -------- | --------- | ---- | --- | ------ | --- | ----------------------------------------------------------------------------- |
| 1   | Engagement creation and setup            | ●        | ●         | ●    | ●   | ●      | ◐   | Substantially implemented                                                     |
| 2   | Internal team and role assignment        | ●        | ●         | ●    | ◐   | ●      | ◐   | Substantially implemented, with a bootstrap trap                              |
| 3   | Client access and participation          | ●        | ●         | ◐    | ◐   | ●      | ◐   | Partially implemented                                                         |
| 4   | Intake and discovery                     | ○        | ◐         | ◐    | ◐   | ◐      | ○   | Not implemented (stand-ins only)                                              |
| 5   | Architecture construction                | ●        | ●         | ●    | ●   | ●      | ◐   | Substantially implemented                                                     |
| 6   | Elements and relationships               | ●        | ●         | ●    | ●   | ●      | ◐   | Substantially implemented                                                     |
| 7   | Evidence and supporting records          | ●        | ●         | ●    | ●   | ◐      | ◐   | Substantially implemented                                                     |
| 8   | Development Edge                         | ●        | ●         | ●    | ●   | ●      | ●   | Substantially implemented (internal only)                                     |
| 9   | Decisions, risks and governed judgments  | ●        | ●         | ●    | ●   | ●      | ●   | Substantially implemented (AI judgments: foundation only)                     |
| 10  | Implementation and realization           | ●        | ●         | ●    | ●   | ●      | ◐   | Substantially implemented                                                     |
| 11  | Reviews and review dossiers              | ●        | ●         | ◐    | ◐   | ●      | ◐   | Partially implemented (records yes; executive review mode no)                 |
| 12  | Architecture Intelligence                | ●        | ●         | ●    | ●   | ●      | ○   | Foundation only for real users (Step B on hold)                               |
| 13  | Reporting, outputs and deliverables      | ●        | ●         | ◐    | ◐   | ◐      | ◐   | Partially implemented (tracks and stores; generates nothing)                  |
| 14  | Navigation and information architecture  | ●        | —         | ●    | ●   | ○      | ◐   | Substantially implemented (desktop)                                           |
| 15  | Search and findability                   | ◐        | ○         | ◐    | ◐   | ○      | ◐   | Foundation only                                                               |
| 16  | Notifications and workflow awareness     | ◐        | ◐         | ◐    | ◐   | ◐      | ○   | Partially implemented in-app; outbound not implemented                        |
| 17  | Administration and configuration         | ●        | ●         | ◐    | ◐   | ●      | ◐   | Partially implemented                                                         |
| 18  | Security, authorization and auditability | ●        | ●         | ●    | ◐   | ●      | ◐   | Substantially implemented at the database layer; operational controls partial |
| 19  | Production deployment and readiness      | ◐        | —         | ◐    | —   | ◐      | ○   | Foundation only (documented, never deployed)                                  |
| 20  | Onboarding and first use                 | ◐        | ●         | ◐    | ◐   | ○      | ○   | Foundation only (bootstrap needs SQL)                                         |
| 21  | Mobile and responsive                    | ◐        | —         | ◐    | ◐   | ○      | ◐   | Partially implemented (portal fits a phone; internal pages do not)            |
| 22a | Commercial and finance                   | ●        | ●         | ●    | ●   | ●      | ◐   | Substantially implemented core; documents, PDFs, payments and emails missing  |
| 22b | Method Library and IP                    | ●        | ●         | ●    | ●   | ●      | ◐   | Substantially implemented; beyond MVP scope                                   |
| 22c | Quality assurance of the UI              | ◐        | —         | —    | —   | ○      | —   | Not implemented (no browser tests)                                            |
| 22d | Data lifecycle and offboarding           | ○        | ○         | ○    | ○   | ○      | ○   | Not implemented                                                               |

### 4.1 Engagement creation and setup: substantially implemented

- **Works [walkthrough].** The following all worked through the UI, with sensible empty states:
  - creating a client organization;
  - creating an engagement (5 types, 5 statuses, dates, objective, description);
  - editing it;
  - completing or archiving it by status.
- **Gaps:**
  - "Current phase" is free text. There is no phase or timeline model, no milestones on the engagement itself and no "next executive review" plan.
  - There is no client contact list. The "Contacts" navigation item is a placeholder.
  - Engagements cannot be deleted or exported.
- **Evidence:**
  - `src/domain/engagements/actions.ts`;
  - `supabase/migrations/20260929230000_phase1_foundation.sql:130`;
  - `src/app/(internal)/internal/layout.tsx:40`.

### 4.2 Internal team and role assignment: substantially implemented, with a bootstrap trap

- **Works [walkthrough].** Adding a member and a role on the engagement page, the per-engagement capability matrix and removal all work.
- **Role change has no UI.** Changing someone's role means removing and re-adding them. `updateOrganizationMember` accepts a role, but the UI only offers suspend and restore.
- **Solo-operator trap [code]:**
  - Bootstrap makes the first user a System Administrator. The System Administrator defaults lack `edit_architecture`, `publish_architecture`, `manage_reviews`, `manage_deliverables` and `manage_implementation` (`src/domain/capabilities/catalog.ts:115`).
  - Authority capabilities can only be granted by a _different_ Principal Architect (`catalog.ts:224`).
  - So a lone first user cannot author architecture on their own engagement until they remove and re-add themselves as Principal Architect, which is undiscoverable.
  - Bootstrapping as Principal Architect instead loses the ability to invite internal staff (`roles.ts:90`).
- **No management page for capability overrides** across the practice, beyond the Method practice settings.

### 4.3 Client access and participation: partially implemented

- **Works [walkthrough]:**
  - the invitation email arrives in the local mail catcher;
  - its link leads to the set-password page;
  - the client lands in the portal;
  - at 390 px the portal fits exactly (scroll width 390).
  - Once published, a client-visible architecture object appears in the client's Architecture view.
- **What a client can do [code]:**
  - respond to requests, with files, and reassign them;
  - approve or request changes on approvals;
  - decide client decisions;
  - contribute on published elements;
  - approve or reject change orders;
  - view architecture, decisions, reviews, implementation, billing and invoices.
- **Gaps:**
  - **Deliverables cannot reach the client through the UI [walkthrough].** A deliverable created in the UI is stored as `internal`. Neither the deliverable page's "Edit deliverable fields" nor any other surface offers client visibility. Even when published with a file attached, the client portal showed "No deliverables yet". The seed makes its demo deliverable visible with SQL (`supabase/seed.sql:1087`).
  - **Reviews have the same gap [code].** No review surface has a visibility control, and the seed sets it with SQL (`seed.sql:1065`). Implementation initiatives do have the control.
  - **Clients cannot download deliverable files [code].** `private.can_read_engagement_file` has no deliverable clause.
  - **Placeholders and missing comments.** Documents and Messages are placeholders (`src/components/portal/engagement-nav.tsx:11`). There are no comments on reviews; spec §22 lists "comments" under Reviews.
  - **Clients cannot start things.** A client cannot raise a request or question. A client lead cannot invite colleagues: `manage_client_team` is never used in app code.
  - **No notifications.** Nothing tells a client that something is waiting.
  - **Payments happen outside the app.** The payment link is a pasted URL, and there are no receipts.

### 4.4 Intake and discovery: not implemented

- **What exists.** Only stand-ins:
  - evidence source types `interview` and `meeting_notes`;
  - a `stakeholder` object type;
  - one-at-a-time client requests, whose answers can be turned into evidence;
  - client contributions on published elements.
- **No method content can be used here.** The Method Library has a "Question libraries" category, but it cannot be applied to an engagement.
- **Missing:**
  - questionnaires;
  - interview capture;
  - a stakeholder or interview register;
  - a discovery checklist;
  - a way to send a set of questions together;
  - import of the client's existing documents.

Discovery would happen outside the app and be retyped.

### 4.5 Architecture construction: substantially implemented

- **Works [walkthrough].** A capability was created, submitted for review and published (v1, with a "what changed" note). It then appeared in the client portal.
- **Also present [code]:**
  - approvals, including external approvals;
  - baselines with freeze and compare;
  - domain maturity assessments;
  - retire and supersede.
- **Gaps:**
  - Submission and publication happen one element at a time, with no bulk publish of a domain or a selection.
  - There is no completeness view ("what is still undefined in Capability Architecture").
  - Nothing has been exercised at real engagement scale. The seed has 28 objects on Meridian and 2 on Harbor.

### 4.6 Elements and relationships: substantially implemented

- **Works [code].** Creating, editing, retiring, superseding and deleting drafts all work. Statements can be cited to evidence. Typed relationships across 39 types can be added, retired and deleted.
- **Gaps:**
  - An element's type cannot be changed (a trigger blocks it at `20261001000100_architecture_core.sql:1461`).
  - There is no "create successor" shortcut.
  - The relationship target is a flat dropdown of every eligible element, with no search.
  - There is no bulk entry or import.
  - The generic element page returns 500 for deliverable [walkthrough] and initiative ids.

### 4.7 Evidence and supporting records: substantially implemented

- **Works [code].** Sources (9 types), file upload to private storage (25 MB, signed URLs), downloads, and citation on statements.
- **Gaps:**
  - Evidence sources cannot be deleted or archived.
  - There is no multi-file upload or import.
  - There is no search beyond the page list.
  - Documents cannot be viewed in the app.
  - The upload path is not seeded or tested (`storage.objects` is 0 in the seed).

### 4.8 Development Edge: substantially implemented (internal only)

The rules, items, briefing, judgments and promotion to Risk, Decision, Review or Criterion are all usable (12 pgTAP files).

Its value depends on rich structured data. The practice counts stay empty until five Method Applications are closed. Clients see nothing, by design. There are no notifications.

### 4.9 Decisions, risks and governed judgments: substantially implemented

- **Usable end to end [code]:**
  - all 7 register kinds;
  - triage, escalation and resolution;
  - decision options and recommendations;
  - client decisions in the portal;
  - Edge judgments and promotion.
- **AI judgments** work only with the fake provider.
- **Gaps:**
  - no register export;
  - no risk heat map;
  - a promoted draft cannot be deleted while its judgment exists.

### 4.10 Implementation and realization: substantially implemented

The register, detail page, checkpoints, cross-engagement view and client view (read-only) are all present. Validation comes only through a held review.

Clients cannot update adoption, record evidence or note blockers on their own initiatives. The status set differs from spec §13 (a deliberate design choice, ADR-0036).

### 4.11 Reviews and review dossiers: partially implemented

- **Works.** Scheduling, participants, holding, cancelling, the examined-version capture and validation all work. The deterministic Review dossier (7B.2) is useful pre-read material.
- **Gaps against spec §11:**
  - There is no presentation or executive review mode.
  - The agenda is not structured as the spec describes it (objective, findings, gaps, models, dependencies, decision points, risks, sequence).
  - The client can only approve or request changes. Defer and "assign decision owner" are missing.
  - There is no client comment thread.
  - The dossier cannot be shared with the client or exported.
  - New reviews cannot be made client-visible in the UI (§4.3).

### 4.12 Architecture Intelligence: foundation only for real users

The foundation is large: 16 migrations, about 4,700 lines of domain code, 13 pgTAP files and 17 Vitest files.

What a person gets today depends on configuration:

| Configuration                       | What a person gets                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| AI off                              | The deterministic layer: drawer facts, the Review dossier, Supports and exposures. This is real value and independent of AI             |
| Real provider, no evaluated model   | "Not yet available": the evaluated-model manifest is empty                                                                              |
| Fake provider                       | Placeholder text, development only. It is refused in production                                                                         |
| After Step B, synthetic engagements | Internal, suggestion-labelled interpretations of five kinds (explanation, tension, evidence bearing, review brief, realization reading) |
| After Step B, real engagements      | The same, and only after the B-4 contractual prerequisites and mode `enabled`                                                           |

Even after Step B, Architecture Intelligence does not:

- draft deliverables;
- produce client-facing content;
- address any V1 blocker.

### 4.13 Reporting, outputs and client deliverables: partially implemented

- **What exists.** A register of the six spec deliverable types, versioned and published, with an attached file (uploaded after publication) [walkthrough].
- **What is missing:**
  - **Generation.** There is no generator, renderer or export anywhere: no PDF or DOCX library, no print stylesheet and no download route other than stored files.
  - **Exports.** There is no export of registers, architecture, baselines or review packs.
- **Spec gap.** Spec §12 ("generated from structured project data") and §33 ("generate consistent deliverables") are unmet. Every client document is written outside the system.

### 4.14 Navigation and information architecture: substantially implemented (desktop)

- **Routes.** There are 55 routes, with a global sidebar and a 16-tab engagement row.
- **Differences from spec §28:**
  - There is no global Deliverables entry.
  - The finance sub-items are folded into one page.
  - Contacts, Portfolio, Documents and Messages are placeholders.
- **Missing pieces:**
  - There is no `error.tsx` or `loading.tsx` anywhere, so unhandled errors fall to the framework page. The deliverable 500 above is an example.
  - The mobile compact nav exposes 5 links, with no menu for the rest.

### 4.15 Search and findability: foundation only

Some pages have a "Title or code" filter. There is no global search, no command palette, no cross-engagement lookup and no portal search. No full-text indexes exist.

### 4.16 Notifications and workflow awareness: in-app partial, outbound none

- **In-app awareness that exists:**
  - the internal dashboard ("Engagements with something to consider", recent activity);
  - the Edge's "Since you last reviewed" briefing, one engagement at a time;
  - the client overview ("N items awaiting your response").
- **Missing:**
  - no transactional email beyond Supabase Auth's invite and magic-link emails;
  - no notification centre;
  - no internal "my work" queue;
  - no reminders.

The finance emails listed as pre-production requirements in `PHASE_2_REPORT.md` §9 are still open. Every report since Phase 2 defers them pending "the email-provider decision".

### 4.17 Administration and configuration: partially implemented

- **What exists:**
  - profile name;
  - Method practice capabilities;
  - client organizations (create, edit, invite, suspend);
  - the per-engagement AI authorisation.
- **Missing:**
  - a user directory;
  - resending or revoking invitations;
  - changing organization roles;
  - editing the TPLCo organization;
  - an audit log viewer;
  - platform, email and template settings.

### 4.18 Security, authorization and auditability: substantially implemented at the database layer

- **Strong:**
  - RLS on all 117 tables (202 policies);
  - capability-based permissions;
  - private storage;
  - trigger-written `activity_log` on about 88 tables;
  - extensive tests.
- **Operational gaps:**
  - MFA is off (`supabase/config.toml:319`), with no UI to enable it.
  - Session timebox and inactivity limits are not set.
  - There are no security headers (`next.config.ts` is empty).
  - There is no application rate limiting.
  - Sign-ins are not audited.
  - The activity log is visible only as the last 8 rows on the dashboard. There is no audit view or export.
  - There is no backup or point-in-time-recovery policy.
  - There is no data retention, deletion or client offboarding.

### 4.19 Production deployment and readiness: foundation only

- **Never deployed.** There is no `vercel.json`, no hosted project reference and no URL. The README section still reads "Deploying (when ready)".
- **Manual operations:**
  - Migrations are pushed by hand.
  - Not running the seed in production is a manual instruction only.
  - The first administrator needs dashboard work plus SQL (`docs/database/bootstrap.md`).
- **Email:** SMTP is not configured, and the templates must be copied to the hosted dashboard by hand.
- **Monitoring:** there is no error monitoring or logging.
- **CI:** "App" and "Database" build and test, with no deploy job and no browser tests.

### 4.20 Onboarding and first use: foundation only

- **Bootstrap.** It needs SQL, followed by the role trap in §4.2.
- **Passwords.** There is no forgot-password flow, though a recovery template exists. The set-password page has no link in the user menu.
- **Empty states.** These are good [walkthrough].
- **Guidance.** There is no guided first engagement and no sample-engagement option.

### 4.21 Mobile and responsive: partially implemented

The client portal fits at 390 px [walkthrough]. Internal pages overflow (606 px at 390 px), and the internal mobile nav reaches only 5 areas. Spec §29 does not require mobile internal authoring, so the internal overflow matters less than the portal.

### 4.22 Other capabilities a paid engagement needs

| Capability                     | State                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commercial and finance         | Substantially implemented. Contracts, renewals, milestones (5 structures), invoices, credit notes, payments, allocations, refunds, change orders and a printable client invoice page are all wired. Missing: finance documents (the bucket exists but is unused), invoice PDFs, finance emails, Stripe (deferred by design) and receipts. Money is collected outside the app |
| Method Library and IP          | Substantially implemented and well beyond §22. Assets, versions, DAM releases, contexts, Method Applications, lineage and acceptance criteria are all present. Its value depends on Kerrick authoring method content. Acceptance criteria are the part that clearly feeds delivery                                                                                           |
| UI quality assurance           | Not implemented. There are no browser tests. Defects in client visibility, the element-page 500s and mobile overflow were all found by hand                                                                                                                                                                                                                                  |
| Data lifecycle and offboarding | Not implemented. A finished client cannot be exported, archived to cold storage or deleted                                                                                                                                                                                                                                                                                   |
| Support and recovery           | Not implemented. There is no way for an administrator to unlock a user, resend an invite or correct a mistaken publication short of a retire-and-recreate                                                                                                                                                                                                                    |

---

## 5. Answers to the questions

### 5.1 What remains before a Principal Architect can run a real engagement end to end?

Required:

1. **Deployment.** A hosted environment, production email, secured secrets, backups and monitoring.
2. **A first-administrator bootstrap without SQL,** and a role model that lets a solo Principal Architect administer and author.
3. **Closing the visibility dead ends.** Deliverables and reviews need a UI visibility control, and clients need to be able to download deliverable files. The element-page 500s and error boundaries need fixing.
4. **Recovery paths.** Forgot-password, resend and revoke invitation, change role, and delete or archive evidence sources.
5. **Delivery-scale ergonomics.** Bulk publish and a searchable relationship target.

With only items 1 to 4, a supervised real engagement is possible. Deliverables would be written outside the app and uploaded, and the client would be told by email from Kerrick's own mailbox when something needs them.

### 5.2 What remains before a client can meaningfully participate?

Required:

1. Notifications by email when a request, approval, decision, review, deliverable or invoice needs them.
2. Deliverables and reviews that actually reach them, with downloadable files.
3. A Documents area for approved project documentation (spec §33).
4. Comments on reviews and deliverables, with a defer option. This is the spec's "Messages" in its smallest form: threaded comments on items, not chat.
5. A client lead able to invite their own team.

### 5.3 What remains before the product is a usable V1?

Everything in §5.1 and §5.2, plus:

- generated deliverables and exports (§12, §33);
- an executive review mode (§11);
- a minimal discovery workflow (batch questions, a stakeholder and interview capture, document import);
- global search;
- finance documents and invoice PDFs;
- an audit view and export;
- MFA for internal users;
- a browser test suite for the golden path;
- one real engagement delivered end to end as the acceptance gate.

### 5.4 V1 versus post-V1

| V1 (required)                                                         | Post-V1 (appropriate later)                                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Deployment, email, bootstrap, backups, monitoring, MFA for staff      | Stripe and in-app payment, receipts by processor                                               |
| Visibility dead ends, recovery paths, error boundaries                | Real-time messaging or chat                                                                    |
| Notifications (email and an in-app attention list)                    | Notification preferences, digests, SMS                                                         |
| Client Documents area, item comments, client team invitations         | Client-initiated initiatives, client self-reporting on adoption                                |
| Generated deliverables (print-quality HTML to PDF) and CSV exports    | Branded DOCX/PPTX generation, deck builders                                                    |
| Executive review mode                                                 | Graph visualization (spec §23)                                                                 |
| Batch questions, a stakeholder and interview capture, document import | Full questionnaire builder, Method-driven discovery templates                                  |
| Bulk publish, searchable pickers, global search                       | Command palette, cross-engagement analytics                                                    |
| Golden-path browser tests in CI                                       | Visual regression testing                                                                      |
| Audit view and export; engagement export at close                     | Automated retention schedules                                                                  |
|                                                                       | **Architecture Intelligence Step B** and any 7B.3 scope                                        |
|                                                                       | Pattern Library, Portfolio Intelligence, certification and licensing (spec §16, §17, §21, §23) |
|                                                                       | Internal authoring on phones                                                                   |

### 5.5 Where Step B belongs

Step B is a governed evaluation (seed and synthetic data only, manual grading, a committed report, a reviewed manifest change). It turns on five internal interpretation kinds. It belongs **after V1**, as the first post-V1 increment, or in parallel once V1-B is live if Kerrick wants it.

1. **It removes no V1 blocker.** None of the blockers in §5.1 to §5.3 depends on it.
2. **It would not reach real engagements anyway.** It can only reach real engagements after the B-4 contractual prerequisites, and those depend on real clients, which V1-B enables.
3. **It needs a credential and an evaluation budget.** Its value cannot be judged until the product has real engagement data to interpret. Evaluating against the two seed engagements says little about usefulness on a real one.

The deterministic layer that 7B.2 Step A shipped (the drawer facts, the Review dossier, Supports and exposures) is already useful with AI off. It should be kept and used in V1-D's executive review mode.

### 5.6 Phases or capabilities the current structure missed

The spec's phase sequence (§31) runs Foundation, Commercial, Architecture Core, Project Intelligence, Client Experience, Method/IP, Architecture Intelligence, Portfolio, Certification. It has no phase for:

1. **Production deployment and operations.** This is not anywhere in the sequence, and every report defers email.
2. **Workflow awareness and notifications.** Spec §7 implies it; no phase owns it.
3. **Deliverable generation.** Spec §12 requires it; Phase 5 built the register only.
4. **Discovery and intake.** It is not in the spec at all, yet it is the first weeks of every engagement.
5. **UI quality assurance.** No phase introduced browser tests. Each phase's manual browser pass found real defects.
6. **Onboarding, bootstrap and administration.** These were left to SQL and the Supabase dashboard.
7. **Data lifecycle.** Export, offboarding and retention are missing.

Phase 5 ("Client Experience") was delivered as Reviews, Deliverables and Implementation. The client experience promised in spec §7 and §8 (Documents, Messages, notifications) was never fully built.

### 5.7 Are we overbuilding infrastructure?

Yes, in three places, relative to unfinished workflows.

1. **Architecture Intelligence:**
   - It took 16 migrations and about 8,000 lines of planning documents, and it produces no real-user value before Step B.
   - The authorisation, client boundary and no-mutation proofs are justified for confidential data.
   - The keep, reuse, suppression, staleness and judgment machinery for a feature with no evaluated model was built well ahead of value.
2. **Method Library:**
   - It is the largest phase (9 migrations, 5,478 lines, about 60 server actions).
   - Spec §22 asked for "internal-only method assets, IP classification, method version field".
   - Its value waits on method content that does not exist yet.
3. **Process overhead per change:**
   - Each phase carries a reconciliation, a proposal, a report, several ADRs and exhaustive pgTAP proofs.
   - That rigour has paid off on security, but it is applied uniformly, including to UI-level changes where a browser test would prove more.

Meanwhile, the smallest substantive phase was the client-facing one (Phase 5, 2,642 migration lines), and it is the one with the most open gaps.

**Recommendation:** freeze new infrastructure (no new AI kinds, Edge rules, Method structures or Tool Contract functions) until V1 is reached. Scale ADRs and proofs to the risk of each change. Make a golden-path browser test part of every phase's gate.

---

## 6. Proposed remaining phase sequence

The existing numbering (7B.2 Step B, then 8 Portfolio, then 9 Certification) follows the spec's capability list, not the path to a usable product. Below is a reorganized sequence focused on delivery. It uses neutral labels so Kerrick can choose how to number them.

Each phase is deliberately small, ends in a browser-verified acceptance gate, and adds no new AI, Edge or Method infrastructure.

```
V1-A Workflow Closure ─► V1-B Production Foundation ─► ★ first real use (supervised pilot)
        │                          │
        └──────────────┬───────────┘
                       ▼
          V1-C Participation and Awareness ─► V1-D Engagement Outputs ─► V1-E Discovery and Scale ─► ★ V1
                                                                                                       │
                                                       post-V1: Step B · Stripe · Portfolio · Pattern Library …
```

V1-A and V1-B can run in either order or overlap. Both are needed before the pilot.

### V1-A: Workflow Closure

- **Objective:** remove every dead end, error path and solo-operator trap from the workflows that already exist, and add the safety net that would have caught them.
- **User-visible outcome:** everything the app already offers can be done by a person, with no SQL. Deliverables and reviews reach the client, files download, nothing returns a raw 500, and mistakes can be corrected.
- **Major capabilities:**
  - A client-visibility control for deliverables and reviews, matching objects, records and initiatives. Deliverable files readable by the client under the existing publication boundary.
  - Fixing the element-page 500 for deliverable and initiative ids (redirect to their own page). `error.tsx` and `not-found` boundaries for internal and portal pages.
  - A role model that lets a solo Principal Architect also administer. For example, the bootstrap user is a Principal Architect who also holds system administration, or System Administrators may invite internal staff while keeping Principal Architect authority. This needs a decision (§7).
  - Changing a member's role. Resending and revoking invitations. Forgot-password and a link to set a password.
  - Deleting or archiving evidence sources. A searchable picker for relationship targets. A "create successor" shortcut for superseding.
  - Bulk submit and publish for a selection or a domain, each version still individually recorded.
  - A Playwright golden-path suite in CI covering: create an organization, invite, accept, create an engagement, publish an element, publish a deliverable with a file, client approves and downloads, record an invoice and payment.
  - The two pre-existing defects: internal mobile overflow and the initiative 500.
- **Dependencies:** none.
- **Acceptance gate:**
  - The golden-path suite is green in CI.
  - Kerrick's manual browser pass of the same path is accepted.
  - No step in the path needs SQL.
- **Excluded:** new features, notifications, generation, AI, Edge or Method changes.
- **Required for V1:** yes.

### V1-B: Production Foundation

- **Objective:** a real, secure, operated environment that TPLCo can put a client into.
- **User-visible outcome:** DSA OS at a TPLCo domain. Invitations and password resets arrive by email. The first administrator signs in without anyone running SQL.
- **Major capabilities:**
  - A hosted Supabase project and a Vercel project, plus a staging environment.
  - Migration deployment from CI on merge to `main`, with a manual approval for production. The seed is excluded in production and the exclusion is enforced, not just instructed.
  - SMTP through a transactional email provider (the long-deferred decision), with the auth templates deployed.
  - A first-administrator bootstrap through a one-time, server-only setup path or a scripted command, documented and tested. No dashboard SQL.
  - Security headers, MFA for internal users, session limits, auditing of sign-in events.
  - Error monitoring and structured server logging. Backups and point-in-time recovery confirmed and a restore rehearsed.
  - A production runbook covering: deploy, roll back, restore, rotate secrets, revoke access.
- **Dependencies:** Kerrick's decisions on hosting region, domain and email provider. Kerrick provisions the accounts and secrets; Claude never holds them.
- **Acceptance gate:**
  - Staging and production deployed from `main`.
  - A fresh production-like environment bootstrapped by following the runbook.
  - A test client invited by real email completes the golden path on staging.
  - Restore rehearsed.
  - Kerrick accepts.
- **Excluded:** workflow emails (V1-C), Stripe, AI providers or credentials, any real engagement data before acceptance.
- **Required for V1:** yes.

### ★ First real-world use: after V1-A and V1-B

At this point Kerrick can run a real engagement as a **supervised pilot**:

- set up the engagement and team;
- invite the client;
- build and publish the architecture with evidence;
- run decisions and approvals;
- track implementation;
- record finance;
- let the client follow and respond in the portal.

Known pilot workarounds:

- Kerrick tells the client by his own email when something needs them.
- Deliverables are written outside the app and uploaded.
- Reviews are run with the internal dossier on screen.
- Architecture Intelligence stays off. This is required anyway for real data until Step B and B-4.

Everything found during the pilot feeds V1-C to V1-E.

### V1-C: Participation and Awareness

- **Objective:** clients and staff know what needs them, and clients can take part beyond approving.
- **User-visible outcome:** a client gets an email when a request, approval, decision, review, deliverable, invoice or change order needs them. They can read approved documents in one place, comment on reviews and deliverables, and invite their own colleagues. Staff have one "needs my attention" list across engagements.
- **Major capabilities:**
  - Transactional workflow email, using the V1-B provider. It has a fixed set of events, links straight to the item, has no content that crosses the client boundary, and records what was sent.
  - In-app attention lists for internal users across engagements and for clients per engagement. These are deterministic and reuse existing signals.
  - A client Documents area: published deliverables, approved versions and shared evidence.
  - Item comments on reviews, deliverables and decisions, visible to the item's audience. This replaces the "Messages" placeholder with threaded comments, not chat.
  - Client review responses extended with defer and assign decision owner (spec §11).
  - Client lead team invitations through `manage_client_team`.
  - Finance documents: signed contracts and approval evidence attached to records.
  - The finance notification emails from `PHASE_2_REPORT.md` §9.
- **Dependencies:** V1-B (email), V1-A (visibility).
- **Acceptance gate:**
  - Each notification event is proven to reach the right recipients and no one else (pgTAP).
  - The browser suite is extended.
  - The pilot client uses it.
  - Kerrick accepts.
- **Excluded:** chat, digests and preferences, SMS, Stripe, AI.
- **Required for V1:** yes.

### V1-D: Engagement Outputs

- **Objective:** the system produces the client-ready outputs the method promises, from the structured architecture (spec §12, §33).
- **User-visible outcome:** an architect can generate a Full Architecture Blueprint, a Capability Map and an Executive Summary from published architecture (or a frozen baseline). They can review the output, publish it as a deliverable version and share it in the portal. Executive reviews can be run on screen in a presentation mode, and registers can be exported.
- **Major capabilities:**
  - Print-quality HTML templates rendered to PDF for the three highest-value deliverables, pinned to a baseline or the published versions, with the document attached to the deliverable version it documents. The remaining types (Strategy Deck, Implementation Framework, Measurement Model) follow the same mechanism.
  - Executive review mode: a structured, full-screen presentation of the review agenda in the spec §11 order, built from the existing deterministic dossier. It records client responses in the session.
  - CSV exports of registers, the architecture (per domain) and baselines. A printable review pack.
  - Invoice PDFs, using the same rendering.
- **Dependencies:** V1-A (deliverables reach clients), V1-C (comments on deliverables are useful but not blocking).
- **Acceptance gate:**
  - Generated documents show only published, client-visible content when generated for the client (pgTAP and snapshot tests).
  - A generated Blueprint for the pilot engagement is reviewed by Kerrick for quality.
  - The browser suite is extended.
- **Excluded:** AI drafting, DOCX and PPTX generation, deck design tools, graph visualization.
- **Required for V1:** yes.

### V1-E: Discovery and Scale

- **Objective:** make the first weeks of an engagement, and engagements of real size, workable in the app.
- **User-visible outcome:** an architect can:
  - send a set of discovery questions to the client in one go;
  - capture interviews and stakeholders as structured evidence;
  - import the client's existing documents;
  - import a list of elements from a spreadsheet;
  - find anything by name across an engagement or the practice;
  - see the engagement's phase plan.
- **Major capabilities:**
  - Batch requests (several questions in one request set), optionally drawn from a Method question library. This is the first delivery-facing use of Phase 6 content.
  - Interview capture: a structured evidence form plus a stakeholder register built on the existing `stakeholder` object type.
  - Multi-file evidence import.
  - CSV import of elements and relationships into drafts, validated against the vocabulary, never auto-published.
  - Global search: Postgres full-text search, honouring row-level security, internal and portal.
  - An engagement phase and timeline model replacing free-text "current phase", shown to the client.
  - An audit log view and export per engagement. An engagement export at close.
- **Dependencies:** V1-A. It can run in parallel with V1-D.
- **Acceptance gate:**
  - The pilot's next engagement starts its discovery in the app.
  - An import of at least 100 elements succeeds.
  - Search returns only what the reader may see (pgTAP).
  - Kerrick accepts.
- **Excluded:** questionnaire builders, Method-driven automation, cross-engagement analytics, AI.
- **Required for V1:** yes.

### ★ V1

V1 is reached when one real paid engagement has run end to end in DSA OS:

- set up;
- discovery;
- architecture;
- reviews;
- generated deliverables;
- implementation tracking;
- finance recorded.

The client must have taken part through the portal, with no developer intervention and no SQL. Kerrick confirms it against spec §33.

### Post-V1 (in an order Kerrick chooses)

1. **Architecture Intelligence Step B:**
   - a governed seed and synthetic evaluation of the v2 prompts per kind;
   - manual grading;
   - a report;
   - a manifest change;
   - real engagements only after B-4.
2. **Stripe payments and receipts** (spec §10), already designed for in the finance schema.
3. **Pattern Library and Portfolio Intelligence** (spec §16, §17). These depend on several completed engagements.
4. **Branded DOCX and PPTX outputs, and graph visualization.**
5. **Certification and licensing** (spec §21).

---

## 7. Decisions needed from Kerrick

1. **The roadmap shape.** Accept the reorganized sequence (V1-A to V1-E, then post-V1), or keep the existing numbering with these phases inserted.
2. **The first-user role model:**
   - **Recommended:** the bootstrap user is a Principal Architect, and Principal Architects may invite internal staff.
   - **Alternative:** a System Administrator who can also hold Principal Architect authority on engagements they create.
3. **Hosting and email:**
   - the hosting region;
   - the domain;
   - the transactional email provider (open since Phase 2).
4. **Output format for V1-D.** PDF from print-quality HTML is recommended over DOCX and PPTX for V1.
5. **The pilot.** Which real engagement, and whether its client is told it is a pilot.
6. **The infrastructure freeze.** Whether to freeze new AI, Edge and Method infrastructure until V1, as recommended.

## 8. What this document did not do

- It changed no code, schema, migration, dependency, credential, provider configuration or status marker. The walkthrough ran against a local, freshly reset database.
- It did not test a production deployment, because none exists.
- It did not evaluate Architecture Intelligence quality. Only the fake provider exists.
- It did not judge the Development Architecture Method content itself.
- Claims marked [code] come from reading the source and were not exercised in the browser. They are each a specific, checkable reference.
