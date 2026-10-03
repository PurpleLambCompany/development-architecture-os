# Gate A Assessment: V1-A Workflow Closure

**Status: Gate A machine assessment passed — awaiting Kerrick manual acceptance.**

**Baseline:** `main` at `1d0282eaafd3bcc5ca6e81d5f6b605686e5d78d9` (all six planned V1-A implementation increments merged: PR #17–#22).
**Authorized by:** Kerrick, 2026-10-03 — assessment, evidence collection and closeout preparation only. No V1-B work, no Architecture Intelligence Step B, no implementation fixes performed under this authorization.
**Environment:** local Supabase (Docker), a real production build (`next build && next start`), Chromium via Playwright, Architecture Intelligence off throughout. All test data disposable; the database was reset between runs.

This document does not declare V1-A complete and does not update the roadmap to V1-B current. Completion requires this machine assessment plus Kerrick's own manual acceptance pass (§5 below), per `V1_A_WORKFLOW_CLOSURE_PROPOSAL.md` §8 condition 9.

## 1. Governing documents re-read

- `docs/product/V1_A_WORKFLOW_CLOSURE_PROPOSAL.md` — the accepted implementation plan, §8 (Gate A, 9 conditions) and §9 (decisions D1–D13).
- `docs/product/V1_ROADMAP_RECONCILIATION.md` §6 (V1-A) and §6.1 (frozen areas).
- ADR-0074 through ADR-0077 (the V1-A increment ADRs: practice administration/authority, client records/files, route resolution/error boundaries, bulk publication).
- Current `README.md` and `CLAUDE.md` status text (found stale — corrected in this PR to reflect Increments 4–6 merged and this assessment's status).

**One observation, not a Gate A criterion:** Increment 6 (D2 relationship publication, E1/E2 recovery, F1–F9) added no new ADR, unlike Increments 2–5. The implementation plan's §7 schema-impact table lists D2 as schema work but its surrounding prose promises only "short ADRs for client file reads and bulk publication" — it does not clearly commit to a third ADR for D2. This is an ambiguity in the plan itself, not a violation, and no §8 condition depends on ADR completeness. Noted for Kerrick's awareness only.

## 2. Gate A checklist — classification and evidence

Per `V1_A_WORKFLOW_CLOSURE_PROPOSAL.md` §8, each numbered condition below is that document's own wording.

| #   | Condition                                                                                                                                                | Classification                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A fresh installation is established without SQL.                                                                                                         | **PASS**                                           | `e2e/fresh-install.spec.ts` ("the database starts as a fresh installation", G-1): `supabase db reset --no-seed` → documented bootstrap command → emailed invite link → named Principal Architect, no SQL from then on. Re-run fresh this session, passing. Independently re-verified in this assessment by continuing the same fresh install through evidence citation and relationship publication entirely through the UI (see #4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2   | The practice is administered in the UI.                                                                                                                  | **PASS**                                           | G-1 (edit practice org), G-2 (invite colleagues, change a role, resend an expired invitation, revoke another, a later-invited System Administrator cannot invite a Principal Architect) — all passing. pgTAP `60_practice_administration.test.sql`. Adversarial review: self-escalation, authority-bearing-role creation, engagement-role laundering, and last-holder safeguards all independently reviewed SAFE (items 6–9, §4 below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3   | An engagement is created and staffed.                                                                                                                    | **PASS**                                           | G-3: client organization, an accepted client lead, an engagement, and an internal team whose roles follow practice roles — passing. pgTAP A3 tests (internal role must equal practice role).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 4   | Architecture is built and published at realistic scale (150+ elements, cited evidence, relationships, including relationships added after publication).  | **PASS**                                           | `e2e/bulk-publication.spec.ts` ("150+ elements are selected and published together (Gate A scale)") — passing, re-run fresh this session. pgTAP `63_bulk_publication.test.sql` (150+-element fixture), `64_publish_relationships.test.sql`. **Gap found and closed during this assessment:** the existing browser suite's own header comments documented evidence citation and relationship-addition as test-coverage gaps in the continuous golden path (stale comments predating Increments 5–6). A dedicated verification pass drove a real fresh install through: uploading an evidence source, citing it on a statement, publishing, and confirming the client portal shows the citation; then creating a second element, adding a relationship through the UI, publishing that relationship, and confirming it is `published_at is not null` in the database and visible to the client. Both workflows passed end-to-end with no defect found.                  |
| 5   | Client-facing records reach the client (a deliverable, a review, an implementation initiative).                                                          | **PASS**                                           | G-6 (review), G-7 (deliverable), G-8 part (initiative) — all passing. pgTAP `16_reviews`, `17_deliverables`, `18_implementation`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6   | The client downloads the deliverable's file, including after a republish; a client of another engagement cannot.                                         | **PASS**                                           | G-7 full scenario ("a deliverable is published with a file and reaches the client only once shown, keeping its version 1 file after republication") — passing. pgTAP `17_deliverables`, `20_phase5_area_visibility`. Adversarial review item 5 (direct storage access) SAFE: the storage policy calls the same gate as the table policy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7   | No dead ends: no unhandled error, malformed/unknown/foreign ids show not-found, every route has an error boundary, forgot/change password work.          | **PASS**                                           | G-9 (every record kind via the generic route and version links; malformed/unknown/foreign ids → 404, internal and portal); C3 forced-error-boundary test. `e2e/v1a-recovery-and-dead-ends.spec.ts` (E1 forgot password, E2 change password, F1 evidence deletion, F3 create successor + retire-when-superseded, F6 responsive nav, relationship publication) — all passing. F2 (searchable picker), F4 (attribution), F5 (native inputs), F7 (jargon), F8 (seed fixture) implemented in Increment 6; F9 confirmed already satisfied, no change needed. Adversarial review items 11 (invitation replay) and 12 (recovery/account enumeration) SAFE.                                                                                                                                                                                                                                                                                                                    |
| 8   | The safety net is in place: the browser suite runs in CI as a required check and is green, alongside App and Database; pgTAP proves the authority model. | **PASS, with one item for Kerrick to confirm**     | All three CI checks (App, Database, Browser) are `success` on `main`'s head commit `1d0282eaafd3bcc5ca6e81d5f6b605686e5d78d9` (confirmed via the GitHub API). pgTAP full suite re-run fresh this session: **2233/2233 passing** (65 files), proving the authority model (no non-Principal-Architect can create authority by any route; internal engagement roles equal practice roles; self-change and last-holder guards hold; client file reads follow the client boundary). **What I could not verify:** whether "Browser" is configured as a _required_ status check in `main`'s branch protection, alongside App and Database — this session's GitHub access returned 403 ("Resource not accessible by integration") on the branch-protection API. Per D12, making Browser a required check is "a branch-protection setting only Kerrick can change." **Please confirm or set this directly** — it is the one sub-item of condition 8 I cannot attest to myself. |
| 9   | Kerrick's own manual browser pass of steps 1–7 is accepted.                                                                                              | **BLOCKED (pending — this is Kerrick's own step)** | Not yet performed. §5 below is the manual acceptance package.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**No condition is FAIL.** Condition 8 carries one sub-item (required-check branch protection) that is outside this session's visibility and is explicitly Kerrick's own setting to confirm or change, not a product defect.

## 3. Automated validation — exact totals (fresh run on `main` @ `1d0282e`, this session)

| Check                                                                  | Result                                                                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| pgTAP (`pnpm db:test`)                                                 | **2233 / 2233 passing** (65 files)                                                      |
| Lint (`eslint`)                                                        | clean                                                                                   |
| Typecheck (`tsc --noEmit`)                                             | clean                                                                                   |
| Format (`prettier --check`)                                            | clean                                                                                   |
| Vitest (`pnpm test`)                                                   | **367 passed, 16 skipped** (383 total, 47 files passed, 1 skipped)                      |
| Production build (`pnpm build`)                                        | clean                                                                                   |
| Database type drift (`pnpm db:types`)                                  | **no drift** — generated output byte-identical to the committed `src/types/database.ts` |
| Playwright (`npx playwright test`, full suite, fresh production build) | **40 / 40 passing**                                                                     |
| CI on `main`'s head commit (App / Database / Browser)                  | all three `success`                                                                     |

## 4. Security / adversarial review

A separate, read-only adversarial review was performed against the merged product on `main` (no code changed, no SQL executed), against the specific threat list below.

| #   | Threat                                                       | Verdict |
| --- | ------------------------------------------------------------ | ------- |
| 1   | Cross-tenant access                                          | SAFE    |
| 2   | Cross-engagement access                                      | SAFE    |
| 3   | Client-area leakage                                          | SAFE    |
| 4   | Confidential deliverable leakage                             | SAFE    |
| 5   | Direct file/storage access                                   | SAFE    |
| 6   | Self-escalation                                              | SAFE    |
| 7   | Architectural-authority creation by non-Principal-Architects | SAFE    |
| 8   | Engagement-role laundering                                   | SAFE    |
| 9   | Last-holder safeguards                                       | SAFE    |
| 10  | Bulk-publication authorization                               | SAFE    |
| 11  | Invitation replay                                            | SAFE    |
| 12  | Recovery / account enumeration                               | SAFE    |
| 13  | Cited-evidence deletion (all 7 FK references)                | SAFE    |
| 14  | Relationship-publication authorization                       | SAFE    |
| 15  | Successor / supersession misuse                              | SAFE    |

**No CONCERN-level finding** (data exposure or authority escalation) was identified against any of the 15 threats.

Two items were raised as test-coverage notes, not vulnerabilities, and both are resolved or explained here:

- **Invitation replay (#11):** the review could not immediately confirm that `fresh-install.spec.ts` proves a reused/expired invite link actually fails. I independently re-read that spec directly: its G-2 test proves both a stale (superseded-by-resend) link and a revoked link each fail with `/login?error=link`, after their respective replacement/revocation succeeds. **Resolved — fully proven, not just asserted.**
- **Cited-evidence deletion (#13):** `delete_evidence_source` was verified, by direct reading of the current migration, to correctly check all 7 foreign-key references into `evidence_sources` (the 2 original plus the 5 added during this session's own independent review of Increment 6, before that PR was opened). The one remaining gap is in pgTAP test _coverage_, not the code: `65_evidence_deletion.test.sql` individually exercises only 3 of the 7 citation paths (statement, element, acceptance-criterion); the other 4 (`method_application_evidence`, `implementation_checkpoints`, `client_action_responses`, `client_contributions`) are correct by code symmetry but not each independently proven by their own pgTAP case. **This is a minor test-rigor gap, not a security defect** — worth closing at Kerrick's discretion, not blocking Gate A.

One secondary, non-security housekeeping note: `revokeInvitation`'s cleanup of an orphaned Supabase Auth account relies on `last_sign_in_at`; if an invitee sets a password before their membership is accepted, the account could be left behind instead of cleaned up. This has no access-control consequence (no membership ⇒ no capability), so it is not a Gate A finding.

## 5. Manual acceptance package for Kerrick

This is what to do yourself — no database internals, just the product.

**1. Start the application.**

```
pnpm install
pnpm db:start      # starts local Supabase, applies migrations, loads seed data
pnpm build && pnpm start
```

Open **http://127.0.0.1:3000**.

**2. Accounts.** Use the seeded demo accounts (all password `dsa-demo-password`), or go through the real fresh-install bootstrap yourself on an unseeded database (`supabase db reset --no-seed`, then `pnpm practice:bootstrap --email you@example.com --name "Your Name"`, then the emailed link from Mailpit at http://127.0.0.1:54324) if you want the full G-1 experience, not just the seeded demo.

**3. What to do, and what to expect:**

- Sign in as `principal@tplco.test`. Open the TPLCo organization page: confirm you can invite a colleague, change someone's role, resend/revoke an invitation.
- Open an engagement (e.g. Meridian). Confirm the team's internal roles show read-only, matching their practice role.
- Open an architecture element. Confirm you can cite evidence, add and publish a relationship to another published element, and — on a published element — create a successor and then retire the now-superseded original.
- Open the evidence register. Confirm an uncited source offers "Delete source" and a cited one does not.
- Sign out, go to `/login`, click "Forgot your password?" and confirm the recovery flow works (check Mailpit for the email). Sign back in, then use "Change password" from the account menu.
- Resize your browser to a phone width (or use dev tools' device toolbar at ~390px). Confirm every internal nav destination is reachable through the "Menu" disclosure.
- Sign in as a client (e.g. `lead@meridian.test`). Confirm you see only this engagement's published, client-visible records — no Method/IP content, no other engagement's data. Download a deliverable file.
- Try a nonsense URL under `/internal` or `/portal` (e.g. append `/not-a-real-id` to an engagement URL). Confirm you get a calm "not found" page, never a raw error screen.

**4. What would constitute a rejection:** any step above that fails, requires you to ask a developer or run SQL, shows a raw framework error page, lets a client see another engagement's or another client's data, or lets a non-Principal-Architect grant themselves or anyone else architectural authority.

**5. One setting only you can confirm:** whether "Browser" is a required status check on `main`'s branch protection, alongside "App" and "Database" (GitHub repository settings → Branches → main). This assessment could not read that setting from here.

## 6. Final status

**Gate A machine assessment passed — awaiting Kerrick manual acceptance.**

V1-A is **not** yet declared complete. The roadmap has **not** been updated to show V1-B as current. Gate A closeout has not started as an irreversible action — this document and the accompanying status-text corrections are the only artifacts of this assessment, delivered as a draft PR pending Kerrick's review and explicit instruction.
