# Phase 7B.2 Step A report: Architecture Intelligence Experience

**Status:** Step A was implemented, verified against the fake provider and **accepted by Kerrick on 2026-10-01** (PR #13). **Step B activation has not occurred** and requires Kerrick's separate explicit authorization.

- No credential was added.
- No real provider was called.
- No model is in the evaluated-model manifest.
- No real engagement content was processed through a model.
- The status docs record Step A as accepted and Step B as on hold.

Kerrick approved Step A on 2026-10-01 with decisions PD-1 to PD-22. See [`PHASE_7B_2_PROPOSAL.md`](PHASE_7B_2_PROPOSAL.md) and [`PHASE_7B_2_INTELLIGENCE_EXPERIENCE_RECONCILIATION.md`](PHASE_7B_2_INTELLIGENCE_EXPERIENCE_RECONCILIATION.md).

**Step A review (2026-10-01).** Kerrick withheld merge on two issues, both now resolved: the recording trust boundary is closed by a server-only recording path (§4a), and `TOOL_CONTRACT_VERSION` is now `2` (§4b).

Three invariants govern this step:

1. The exact text shown is the text persisted.
2. Reuse never crosses resolved-model identity.
3. Suggested interpretations stay secondary. They are never counted, ranked or severity-styled. They never appear in tiers, the overview or the briefing. They are never presented as established.

## 1. What was built

### The intelligence drawer (ADR-0067)

One drawer, addressed by URL (`?drawer=…`), opens from seven deterministic surfaces:

| Drawer        | Opened from                                             | Action                                     | Kind                |
| ------------- | ------------------------------------------------------- | ------------------------------------------ | ------------------- |
| Edge item     | "Why am I seeing this?" on an Edge consequence or event | Explain significance                       | explanation         |
| Revision      | "What changed" on substantive versions                  | Explain significance                       | explanation         |
| Impact trace  | "What this reaches" on the Impact panel                 | Explain significance                       | explanation         |
| Element pair  | "Side by side" on a relationship                        | Examine tension                            | tension             |
| Evidence link | "This link" in Supports and exposures                   | Examine bearing                            | evidence_bearing    |
| Review        | "Prepare" on the Review dossier                         | Prepare (kept with "Keep for this Review") | review_brief        |
| Initiative    | "Realization facts" on an initiative                    | Compare with intent                        | realization_reading |

The drawer has three layers:

1. **What DSA knows.** Deterministic facts, complete on their own.
2. **Interpretation · Suggested.** Rendered only for holders of `use_architecture_intelligence`. It is absent, with no heading, for everyone else and whenever the mode is `off`.
3. **Judgment.** Judgments on the item and on the interpretation are kept separate.

It renders as a right panel on desktop and a full sheet on phones. Escape closes it and the page behind it does not scroll.

### Deterministic surfaces (PD-9, PD-22; ADR-0072)

- **Review dossier.** On scheduled and held Reviews it lists:
  - what was examined, with captured and latest versions;
  - changes since the comparison point;
  - evidence since then;
  - Edge conditions;
  - acceptance criteria;
  - implementation movements;
  - unresolved matters.
- **Supports and exposures.** Shown on every element.

Both are exact lists of records with versions. They are never summarised, scored or ordered by importance. They are free, and they are the same for every internal reader whatever that reader's AI standing. Clients cannot reach them (P0002).

### Availability rules (PD-10 to PD-12, PD-17; ADR-0068)

`composeGate` decides the drawer's layer-2 state. It applies these checks in order, and the first that applies gives the state:

1. Mode `off`, no standing, or no capability: absent.
2. A real engagement under `synthetic_only`: not available.
3. Engagement status or authorisation: not authorised.
4. A required data class missing: not authorised for that class.
5. No model configured: not configured.
6. The configured model is not evaluated: **"Not yet available: no model has been evaluated…"**.
7. Provider settings incomplete: not configured.
8. Provider or region mismatch: not authorised.
9. The budget or the per-request ceiling would be exceeded.
10. The deterministic §9 rule does not hold here: not offered.
11. Otherwise: offered, with the rule's reason.

The §9 rules are the closed set, and the tension-pair rule is unchanged. Evidence bearing is offered only when a summary is recorded. An estimate above 50% of the per-request ceiling asks for confirmation first.

### Keeping (PD-3 to PD-5, PD-21; ADR-0069)

No new secret was introduced. An ephemeral request's validated output is held server-side in `pending_architecture_inferences`, keyed by the request id:

- No role has any grant on the table.
- A row expires after 30 minutes.
- Expired rows are purged.
- Every hold on an engagement is discarded when a new authorisation version is recorded.

`keep_architecture_inference(engagement, request_id)` takes the text from that row, never from the browser. It enforces:

- **Requester binding.** Only the requester may keep.
- **Subject and kind binding.**
- **Basis binding.** The basis is re-verified, and a changed basis is refused with "Interpret again".
- **Single use.** The row is consumed, which also gives replay resistance.

Keeping with a judgment is one call in one transaction.

### Judgments (PD-6, PD-14, PD-15, PD-18; ADR-0070)

`architecture_inference_judgments` is append-only:

- Judging needs `use_architecture_intelligence` and `edit_architecture`.
- Only a current, kept interpretation can be judged. Stale, superseded and never-kept rows are refused.
- `not_material` and `disagree` suppress the interpretation engagement-wide until its basis changes.
- `investigating` stays visible.
- An expired deferral returns.
- Judgments are not written to `activity_log`.

**Promotion** uses the ordinary governed forms: Risk, Decision, Review, or an acceptance criterion on an object or initiative. The architect fills the form. "Bring interpretation text" adds the exact kept text as an `observation` statement with these properties:

- provenance `ai_analysis`;
- AI review `pending`;
- not client-visible.

### Reuse (PD-13a; ADR-0068)

A kept interpretation is shown as reusable ("still current") only when all of these match exactly:

- kind and subject;
- the full basis;
- the prompt version;
- the configured provider and requested model;
- the resolved model, which must be evaluated and equal to the latest model the engagement has seen.

Once a different resolved model is seen, the label changes to "produced with an earlier prompt or model" and the action becomes Interpret again. Reuse writes no audit row. `interpret_again` is a flag on the request (PD-20).

### Version 2 outputs (PD-8, PD-13b, PD-19; ADR-0071)

- Each kind returns either an interpretation or `nothing_to_add` with a reason of 300 characters or fewer.
- The reason is shown labelled and is never persisted.
- `nothing_to_add` is a new audited outcome.
- The v1 prompts and generation policy are retired.
- The `review_brief` plan adds `get_evidence` and `get_implementation_state`. No Tool Contract function was added.

### Suggested interpretations and the register (PD-7, PD-16; ADR-0068)

- **On the Edge page**, a separate "Suggested interpretations" section lists kept interpretations, described as "Suggested, not established by DSA's rules". It shows no count, rank or severity. It appears outside the tiers, the overview and the briefing. It renders only for holders.
- **On the Architecture Intelligence page**, a "Kept interpretations" register can be filtered by kind and state. It has no ranking and no per-person framing.
- **A kept Review brief** is visible to every holder. The newest supersedes earlier ones, and history is retained.

### The fake provider (PD-1, PD-2; ADR-0073)

The fake provider runs only when all three hold:

- the provider is `fake`;
- the mode is `synthetic_only`;
- `NODE_ENV` is not `production`.

It is deterministic and needs no credential. Its scenarios are:

- an interpretation;
- `nothing_to_add`;
- invalid output;
- a refusal;
- a provider error.

A test-only overlay counts `dsa-fake-model-1` and `-2` as evaluated, for the current prompts only. The committed manifest is unchanged and empty.

## 2. Files changed

There are 110 files against `main`:

- **Migrations:** 9 (§3).
- **pgTAP:** 4 new suites:
  - `48_ai_keep_and_judge` (45 tests)
  - `49_ai_read_models` (38)
  - `50_ai_experience_no_mutation` (14)
  - `51_impact_trace_definer` (22)
  - `52_ai_trusted_recording` (35)

  Existing suites were updated for the v2 vocabulary.

- **Domain code:**
  - `src/domain/architecture-intelligence/experience/` (subjects, gate, words, queries, layer-1 queries, actions, view, promotion);
  - Gateway v2;
  - the fake adapter and responder;
  - the v2 prompts, schemas and test overlay.
- **Components:** `src/components/architecture-intelligence/` (drawer, layers, dossier, supports, Suggested, register).
- **Pages:** small additions to the Edge, element, Review, initiative, Intelligence, Reviews and Architecture Intelligence pages.
- **Shared components:** small additions to the Edge, impact, relationships, versions and criteria panels.
- **Docs:**
  - ADR-0067 to ADR-0073;
  - amendments to ADR-0051, 0055, 0056, 0062, 0063, 0064, 0065 and 0066;
  - `docs/database/architecture-intelligence.md`, `schema.md` and `rls.md`;
  - README and `.env.example`.

## 3. Schema changes

| Migration                                         | Change                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20261008000000_ai_request_outcomes_v2`           | `nothing_to_add` outcome; `interpret_again` flag                                                                                                                                                                                                 |
| `20261008000100_inference_keeping`                | `architecture_inferences.kept_at`; `pending_architecture_inferences` with its guard and purges; basis verification; the recording operation replaced                                                                                             |
| `20261008000200_architecture_inference_judgments` | The judgment table, its guard and RLS; `record_architecture_inference_judgment`                                                                                                                                                                  |
| `20261008000300_keep_architecture_inference`      | `keep_architecture_inference`, with an optional atomic judgment                                                                                                                                                                                  |
| `20261008000400_ai_read_models`                   | Availability, reuse, inference detail, Suggested interpretations, the kept register                                                                                                                                                              |
| `20261008000500_deterministic_dossiers`           | `review_dossier`, `element_supports_and_exposures`                                                                                                                                                                                               |
| `20261008000600_ai_edge_item_identity`            | Defect fix: exact Edge-item identity in the Tool Contract (ADR-0063 amendment)                                                                                                                                                                   |
| `20261008000700_impact_trace_definer`             | Defect fix, approved by Kerrick: `impact_trace` runs as its owner, with access unchanged (ADR-0055 amendment)                                                                                                                                    |
| `20261008000800_trusted_recording`                | Step A review: the server-only recording path `record_architecture_intelligence_request_for`; the base operation executable by no API role; `service_role` stripped of every AI table privilege and every other AI function (ADR-0069 amendment) |

## 4. Security and RLS

- **Writes.** The only writes are `record_architecture_intelligence_request` (reached only through the server-only path, §4a), `keep_architecture_inference` and `record_architecture_inference_judgment`. Each is proven to write only its own tables (`50_ai_experience_no_mutation`). The new read models and dossiers are proven read-only, and the governed-state fingerprint is unchanged after every read by a holder, a non-holder and a client.
- **Pending table.** `pending_architecture_inferences` has no grants and is reached only through the two security-definer operations.
- **Kept inferences.** Kept inferences and their judgments are readable only by holders.
  - For non-holders the read models return an empty set, so no heading or count renders.
  - Clients receive P0002.
- **`impact_trace`** is now security definer. It still reads only when `can_read_architecture` holds for the start element's engagement. Every row it reads is bound to that engagement. `51_impact_trace_definer` compares it row for row with the invoker version for all 17 seed users.

## 4a. The server-only recording boundary (Step A review)

The flow is now: a person's request, the Intelligence Gateway, the validated model output, a trusted server recording path, a pending interpretation, the browser receiving the output with only a request id, and Keep or a judgment consuming that server-recorded output.

**Mechanism.** One narrow, server-only database function, `record_architecture_intelligence_request_for(requested_by, engagement, request, inference)`, executable only by `service_role`. It refuses an unknown requester, sets the requester's identity for the length of the call (restoring the caller's afterwards, on success or failure) and calls the existing recording operation, so every check runs unchanged as that person: capability, engagement access, the authorisation version under the shared lock, data classes, basis digests re-emitted through the Tool Contract, the metadata-only audit allowlist, the thirty-minute expiry and single-use keeping. `server.ts` takes the requester from `supabase.auth.getUser()` (verified by the Auth server) and creates the service-role client only to make this one call, after the Gateway validated the output. No new secret: it uses the existing server-only `SUPABASE_SECRET_KEY`. Neither it nor the provider credential reaches the browser.

**Privilege changes.**

- `record_architecture_intelligence_request`: revoked from `public`, `anon`, `authenticated` and `service_role`. No browser session can call it.
- `record_architecture_intelligence_request_for`: `service_role` only.
- `service_role`: every privilege on the six AI tables revoked (including `TRUNCATE`), and execute revoked on every other public AI function (the Tool Contract, keeping, judging, authorising, the read models). Its only Architecture Intelligence authority is the one recording call.
- Keep and judgment are unchanged: they run as the person and take only the request id (and an allowlisted judgment), never text.

**Proofs that direct manufacturing is closed.**

- `52_ai_trusted_recording` (35 pgTAP tests): the grants above; a holder (Architect, and Principal Architect in persist mode) calling the base operation, the server-only path, or inserting a pending row is refused (`42501`) and nothing is written; a forged audit row is refused; the server key cannot insert or truncate directly; through the server path an unknown person, a client, a person without the capability, a person without access to the engagement and a cross-engagement basis are all refused with nothing written; the legitimate path holds the output for the verified requester only; another holder's Keep is refused; the requester's Keep persists exactly the recorded text, once; keep-with-judgment persists that same text, and a judgment carrying text is refused; the caller's identity is unchanged after both a refused and a successful recording.
- Suites 44 to 50 and 99 now record only through the server path; revocation racing a recording still serialises and refuses (`99_ai_concurrency`).
- Vitest source scans: the admin client is created only in `server.ts`, only for the trusted recorder after `getUser()`; no module calls the base operation; the experience actions send no output; the trusted recorder calls only the server-only path, and a store without it refuses to record.
- Browser session, direct calls with a signed-in Architect's and Principal Architect's own tokens: the base operation, the server-only path on their engagement and across engagements, a direct pending insert and a direct inference insert were all refused `42501`, and Keep of a request id with no held output was refused; request, pending and inference counts were unchanged.

## 4b. Tool Contract version 2

`TOOL_CONTRACT_VERSION` is `2` because the Edge-item variant now carries the fingerprint digest (ADR-0063 amendment). The definition hash pinned by `registry.test.ts` is unchanged, since tool names and argument schemas did not change. Every request and inference records `tool_contract_version = '2'`. Reuse (`current_architecture_inference`) now also requires the same Tool Contract version, proven in `49_ai_read_models`. The fake-provider evaluation report ([`2026-10-01-step-a-fake-adapter.md`](../evaluation/architecture-intelligence/2026-10-01-step-a-fake-adapter.md)) records version 2 and the current (v2) prompt version and hash for each kind; the Gateway, pgTAP fixtures and tests were updated.

## 5. Tests and checks

| Check                                               | Result                                |
| --------------------------------------------------- | ------------------------------------- |
| Full pgTAP, on a freshly reset database             | **59 files, 2,009 tests, PASS**       |
| Vitest                                              | **363 passed, 16 skipped** (47 files) |
| Seed-only evaluation (`pnpm ai:eval`, fake adapter) | **16/16**                             |
| Lint, typecheck, format check                       | Clean                                 |
| `pnpm build`                                        | Clean                                 |
| `pnpm db:types`                                     | No drift                              |

The new Vitest coverage:

- every gate state, including the unevaluated model with no credential and the 50% confirmation;
- drawer subjects round-tripping through URLs and kept rows;
- fake provider and overlay refusal under `NODE_ENV=production` and every other mode;
- the committed manifest staying empty, with v1 retired;
- the v2 silence schema;
- module boundaries: the experience layer reaches the Gateway only through `server.ts`, no application module uses `persist`, and client components import only server actions and pure helpers.

## 6. Browser acceptance (fake provider, non-production only)

The production build was used for the AI-off pass and for the refusal checks. `next dev` was used wherever the fake provider was needed, because the fake provider cannot run in production.

### Pass 1: AI off

- 17 pages and 88 drawers were crawled.
- Layer 1 was identical, line for line, to the same 88 drawers with AI on.
- With AI on, the only page differences were the Suggested section and the Prepare link, both shown to holders only.

### Pass 2: a real provider configured, with no credential

All 89 drawers showed "Not yet available: no model has been evaluated…".

### Pass 3: the fake provider

- **All five kinds.** Each interpreted, rendered and was kept. The shown assertion equalled the persisted text.
- **Large-request confirmation.** The large-request confirmation appeared for the Review brief.
- **Judge to keep.** Judging an ephemeral interpretation ("Judging keeps this interpretation.") kept it with the judgment.
- **Suppression.**
  - The interpretation was then suppressed for other holders too.
  - Interpret again worked and recorded `interpret_again`.
- **Silence and failures.** `nothing_to_add` showed its labelled reason. Invalid output, refusal and provider error each showed their copy. None of them recorded an inference.
- **Promotion to a Risk with brought text.**
  - RSK-004 was created.
  - The exact text became a pending, not client-visible `ai_analysis` observation.
  - The interpretation was marked promoted.

### Pass 4: changes between interpreting and keeping

- **Basis change.** Renaming a reached element refused Keep with "This interpretation's basis has changed. Interpret again." Nothing was kept.
- **Re-authorisation.** The hold was purged, and Keep was refused with "This interpretation can no longer be kept."
- **Revocation.** The gate showed "not authorised".
- **Capability loss.** Keep was refused with "You do not have permission to do that." Layer 2 then disappeared.
- **A change of resolved model** to `dsa-fake-model-2`:
  - The kept interpretation became "produced with an earlier prompt or model".
  - A newly kept one was "still current".
- **An unevaluated resolution** (`-3`) was refused as `model_not_evaluated`.

### Pass 5: after the Step A review fixes

Rerun on a freshly reset database with the fake provider, after the server-only recording path and Tool Contract version 2:

- **Interpret, then Keep** (revision, impact trace, Review brief, tension, evidence bearing, realization reading): every shown assertion equalled the persisted text; every kept row records Tool Contract version 2 and prompt v2.
- **Interpret, then judge:** judging kept the interpretation with a `not_material` judgment by the Architect, then suppressed it; Interpret again worked and recorded `interpret_again`.
- **Direct-call manufacturing** from a signed-in session: refused, nothing written (§4a).
- **Basis change:** "This interpretation's basis has changed. Interpret again."; nothing kept.
- **Re-authorisation:** the hold was purged; "This interpretation can no longer be kept."; nothing kept. **Revocation:** the gate showed "not authorised".
- **Capability loss:** Keep was refused and nothing was kept; layer 2 then disappeared.
- **Resolved model changed** to `dsa-fake-model-2`: the kept model-1 interpretation became "produced with an earlier prompt or model" (not reused); a newly kept model-2 one was "still current".
- **Non-holders** (Researcher, Project Administrator): clean on the register and four drawers. **Clients** (all ten client users and the advisor): redirected from internal URLs; no AI wording on any portal page.

### Roles

- **Principal Architect and Architect** saw every surface.
- **Researcher, Project Administrator, Finance and System Administrator** saw layer 1 only. No Suggested section, register or layer-2 text appeared, and nothing leaked across 5 Meridian drawer and page views each.
- **Clients** (lead@meridian, sponsor@harbor, viewer@meridian, advisor@consulting) were redirected from internal URLs to the portal. A crawl of 30 portal pages found no AI wording.

### Mobile and production refusal

- **Mobile.** At 390 px the drawer is a full 390×844 sheet. Body scroll is locked and Escape closes it.
- **Production refusal.** A production server configured for the fake provider showed "Not yet available" and sent nothing (zero fake requests).

## 7. Defects found and fixed

1. **Edge items sharing a rule and a subject** could not be addressed exactly, so "Explain significance" failed on the second item. Fixed in migration `…0600`.
2. **`impact_trace` timed out for an Architect** on Meridian (about 9 s against an 8 s statement timeout). The cause was per-row RLS across 20 tables. With Kerrick's approval it now runs as its owner (about 30 ms), with equivalence proven. A page and its trace drawer also now share one call.
3. **Never-kept rows could be judged or promoted.** An evaluation-harness row could have been judged by a direct call, or opened for promotion, which would create a record before the judgment was refused. Only kept interpretations are now judged or opened.
4. **The kept register showed with AI off.** It is now absent in mode `off`, like the drawer's layer 2 and the Suggested section.
5. **The suppression line** said "You judged…" to a holder who had not judged. It now names the judgment, not the viewer.
6. **Numeric risk severity** crashed Supports and exposures. Severity is no longer displayed.
7. **The Keep button** showed "Interpreting…" during a Keep.
8. **The fake responder** printed internal handles (R1, R2) instead of reference codes for nested records.

## 8. Known limitations

- **Pre-existing, not 7B.2:**
  - An internal page at phone width overflows horizontally (scroll width 606 px at 390 px), because of page-header actions and tables. The drawer sheet itself fits.
  - The element page returns 500 when opened with an initiative's id: `recordFields` has no statuses for `implementation_initiative`. Nothing links there; initiatives have their own page.
- **Fake-provider text** is placeholder text. The acceptance shows states and integrity, not interpretation quality.
- **Recorded Tool Contract versions are not constrained in the database.** Only the server can record now, and it always records `2`; older test fixtures still record `1`.
- **`ai_analysis` statements from promotion** are still created on the user's session (pre-existing, Phase 4 review gate applies). It is not an inference or a pending interpretation and is outside this change.
- **Real-provider evaluation has not been done.** With any real provider configured, every drawer says "Not yet available".

## 9. Independent diff inspection

An independent read-only inspection of the full diff found no blocking issues. It found these areas clean:

- excluded capabilities;
- persistence and capabilities (PD-2, PD-3, PD-5, PD-6, PD-18);
- security, including the `impact_trace` definer change, where every row read stays bound to the start element's engagement;
- the three invariants on the application path.

Its findings:

1. The recording trust boundary. Closed at Step A review (§4a).
2. Promotion of a never-kept row. Fixed, as defect 3.
3. The register with AI off. Fixed, as defect 8.
4. Reuse follows the last resolved model DSA has observed. This matches PD-13a.
5. Migration header numbering. Fixed.
6. The Tool Contract variant without a version bump. Version 2 at Step A review (§4b).

A second independent inspection of the Step A review fixes found no blocking issues. Acted on: the server key's execute on other AI functions (revoked), the requester identity lasting past the call (restored), the admin client created eagerly (now created only to record), and stale comments and docs (corrected). Noted, not changed: the unconstrained recorded version string and the pre-existing `ai_analysis` statement path (§8).

## 10. CI state

See the PR checks for the head commit.

## 11. Explicit confirmation

**Step B has NOT occurred.**

- No credential was added.
- No real provider was called.
- No model was added to the evaluated-model manifest.
- No real engagement content was processed.
- `CLAUDE.md` and the README record Step A as accepted and Step B as on hold.
- PR #13 contains only the accepted Step A scope and its closeout status updates.

## 12. Recommended next step

Merge PR #13 on Kerrick's instruction. After that, a separate decision on Step B: a governed seed/synthetic-only real-provider evaluation, manual grading, a committed evaluation report and a reviewed manifest change.
