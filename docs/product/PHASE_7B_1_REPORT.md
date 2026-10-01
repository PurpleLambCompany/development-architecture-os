# Phase 7B.1 end-of-phase report: Architecture Intelligence foundation

**Status:** implemented on PR #11 (draft, unmerged), awaiting Kerrick's final acceptance. Approved 2026-10-01 with OD-1 to OD-17. Specification: [`PHASE_7B_1_PROPOSAL.md`](PHASE_7B_1_PROPOSAL.md) and [`PHASE_7B_CONCEPTUAL_RECONCILIATION.md`](PHASE_7B_CONCEPTUAL_RECONCILIATION.md) (Revision 2). **Phase 7B.2 has not started.**

The governing invariant, as Kerrick set it: **Architecture Intelligence cannot mutate governed DSA state.** It is enforced by the Tool Contract's design, database privileges and capabilities, RLS and function design, and proven by adversarial tests (§5). `STABLE` remains on the contract functions as defence in depth only.

## 1. What was built

### Database (the authority for every rule)

- **Two capabilities** (OD-1, OD-2): `use_architecture_intelligence` and `authorize_external_ai_processing`, internal-only and architecture authority.
- **`engagements.data_origin`** (OD-4): `real` / `synthetic`, immutable; the three seed engagements are synthetic.
- **Versioned per-engagement authorisation** (default No): classes, provider, region, basis, monthly budget, effective date, who and when; revocation with a reason; only for `proposed` and `active` engagements (OD-3).
- **The Tool Contract**: ten read-only functions behind one gate and one projection, with per-field classification, Method/IP and licensed-source exclusion (OD-6), the evidence summary only for `evidence_bearing` and `tension` (OD-5), people removed, and SHA-256 digests with `digest_version` (OD-13).
- **Inference and basis tables**, written only by a recording operation that re-verifies everything and cannot be given a fabricated basis; readable only by current holders of use (OD-11); staleness computed on read.
- **A metadata-only request audit** with an engagement-level budget read and the caller's standing.
- Nothing in `activity_log` (OD-10).

### Application

- **`src/domain/architecture-intelligence/`**: the Gateway, the `fetch`-based OpenAI adapter (OD-15) and a fake adapter, the tool registry, five kind schemas and context plans, output validation, versioned prompts with pinned hashes, and the evaluation harness (CI cases and `pnpm ai:eval`).
- **`server.ts`** (`server-only`) wires the Gateway as the requesting user. **No route, page or action calls it** (OD-12).
- **Internal page** `/internal/engagements/[slug]/architecture-intelligence` (tab "Architecture Intelligence"): synthetic-data label, the viewer's standing, the authorisation in force and its history; for authorizers, the record and revoke forms and a request list for the month (outcome, kind, model, tokens, cost, no inference text, no per-person totals).
- **Capability overrides**: both capabilities appear on the engagement's capability screen, offered only to Principal Architects and never on their own row.

## 2. Files changed

- **Migrations:** 7 (§3).
- **pgTAP:** 8 new files (`41`–`47`, `99_ai_concurrency`); `supabase/seed.sql` (evaluation records, seed authorisations).
- **Application:** `src/domain/architecture-intelligence/**` (Gateway, adapters, tools, kinds, prompts, evaluation, store, server, page actions, queries and schemas, with tests); `src/domain/capabilities/catalog.ts` and its test; the new page; `src/components/architecture/architecture-nav.tsx`; `src/types/database.ts` (regenerated); `package.json` (`ai:eval` script; **no new dependency**).
- **Docs:** ADR-0060 to ADR-0066; amendments to ADR-0005, ADR-0024, ADR-0051; `docs/database/architecture-intelligence.md`, `rls.md`, `schema.md`; `docs/evaluation/architecture-intelligence/2026-10-01-pipeline-fake-adapter.md`; README, `.env.example`, CLAUDE.md; this report.

## 3. Schema changes

| Migration                                                   | Change                                                                                                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261007000000_phase7b1_capabilities_enum.sql`             | Two `engagement_capability` values                                                                                                                                          |
| `20261007000100_architecture_intelligence_capabilities.sql` | Defaults; `capability_side` (internal); `is_architecture_authority_capability`; `private.can_use_architecture_intelligence`, `private.can_authorize_external_ai_processing` |
| `20261007000200_engagement_data_origin.sql`                 | `engagements.data_origin` and `engagements_data_origin_guard`                                                                                                               |
| `20261007000300_ai_authorizations.sql`                      | `engagement_ai_authorizations` (append-only), `set_engagement_ai_authorization`, `private.current_ai_authorization`, the class set                                          |
| `20261007000400_ai_context_functions.sql`                   | `ai_context_row` type; `private.require_ai_context`, `ai_resolve`, `ai_emit`, projections, IP exclusion, digest; ten `public.ai_context_*`                                  |
| `20261007000500_ai_requests.sql`                            | `architecture_intelligence_requests` (append-only), `architecture_intelligence_budget`, `architecture_intelligence_standing`                                                |
| `20261007000600_architecture_inferences.sql`                | `architecture_inferences`, `architecture_inference_basis` (append-only), `record_architecture_intelligence_request`, `architecture_inference_state`                         |

## 4. Security / RLS changes

### Exact capability defaults

| Capability                         | System Admin | Principal Architect | Architect | Researcher | Project Admin | Finance |   Client roles   |
| ---------------------------------- | :----------: | :-----------------: | :-------: | :--------: | :-----------: | :-----: | :--------------: |
| `use_architecture_intelligence`    |      —       |          ✓          |     ✓     |     —      |       —       |    —    | never (internal) |
| `authorize_external_ai_processing` |      —       |          ✓          |     —     |     —      |       —       |    —    | never (internal) |

Overrides: Principal Architects on the engagement only, never for themselves. System Administrators and Project Administrators cannot grant either.

### Reads

| Record                    | Who reads it                                               | Clients |
| ------------------------- | ---------------------------------------------------------- | ------- |
| Authorisation and history | internal readers of the engagement's architecture          | never   |
| Request audit             | holders of `authorize_external_ai_processing`              | never   |
| Inferences and basis      | current holders of `use_architecture_intelligence` (OD-11) | never   |

No client policy, client read model, snapshot or client-callable function changed. The service role is not used (ADR-0005 amendment).

## 5. The Tool Contract

| Tool                       | Function                    | Returns                                                                    |
| -------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| `get_element`              | `ai_context_element`        | Published or working snapshot (no Method lineage, approach or methodology) |
| `get_relationships`        | `ai_context_relationships`  | Typed relationships of an element, with the other end's identity           |
| `trace_impact`             | `ai_context_impact`         | The governed impact trace from an element                                  |
| `get_revision`             | `ai_context_revision`       | A substantive revision (what changed, by path)                             |
| `get_edge_item`            | `ai_context_edge_item`      | One Edge item (practice lens excluded)                                     |
| `get_evidence`             | `ai_context_evidence`       | Evidence metadata; summary only for `evidence_bearing` and `tension`       |
| `get_project_intelligence` | `ai_context_intelligence`   | Project Intelligence records connected to an element                       |
| `get_acceptance_criteria`  | `ai_context_criteria`       | Acceptance criteria for an element                                         |
| `get_review_context`       | `ai_context_review`         | A Review, its examined versions and findings                               |
| `get_implementation_state` | `ai_context_implementation` | Implementation Initiative state and criteria                               |

Each requires readable engagement (`P0002`), use (`42501`), a `proposed`/`active` engagement and a current authorisation, and withholds what is excluded or not authorised. Tool arguments carry reference codes only, never an engagement. `TOOL_CONTRACT_VERSION = 1`, pinned by a definition hash.

**Proven not to mutate** (`47_ai_no_mutation`, 40 tests; `99_ai_concurrency`, 6; `gateway.write-attempt.test.ts`):

- directly: `authenticated` has no write privilege on any AI or governed table through these paths; direct DML leaves the fingerprint unchanged;
- through exposed contract functions: static check (no DML, dynamic SQL, guard switch, sequence or lock); every function runs inside a `READ ONLY` transaction; whole-database fingerprint unchanged after hostile calls;
- across engagements: cross-engagement ids are not found and change nothing;
- after authorisation revocation and after use-capability revocation: refused, fingerprint unchanged; a recording racing a revocation waits and refuses;
- through an unauthorised data class: withheld, fingerprint unchanged;
- through a function or route outside the contract: only five IMMUTABLE private constants are executable, only the twelve expected public functions reach the resolver, model-requested `update_element`, `publish_element_version`, `record_architecture_intelligence_request` and `__proto__` call nothing, and the module writes no table;
- the recording operation itself changes only its three tables, and the fingerprint is shown to detect a real governed change.

## 6. The provider adapter

`fetch` against the OpenAI Responses API, no SDK (OD-15). `store: false` always; no `previous_response_id`, `conversation`, `background`, hosted prompts, `include` or metadata; function tools only (strict), `parallel_tool_calls: false`; strict JSON-schema output; reasoning items discarded; resolved model read from the response; data delivered as quoted records, never instructions; no body logged. Up to two retries for timeouts, rate limits and unavailability before any output; none for authentication or bad requests; no fallback provider or model. Configuration is server environment only (`.env.example`).

## 7. The inference and basis model

- Five kinds (`explanation`, `tension`, `evidence_bearing`, `review_brief`, `realization_reading`), each a strict envelope: assertion, 1–8 claims each citing handles, uncertainty, examination, kind payload. No score, rank, severity or confidence field can exist; a forbidden-vocabulary check refuses governed-act, importance, ranking, numeric-confidence and method-recommendation language.
- `epistemic_status = 'suggested'`, `producer = 'model'`, fixed by constraints.
- Basis: one row per record placed in context (identity, version, class, digest, origin, cited). The recording operation re-emits and compares every row, and refuses any claim citing an unknown handle.
- Context: anchors plus at most six model-requested calls (OD-7, an evaluation and safety bound), per-kind token caps, no repair retry (OD-9).
- Staleness, computed: `current`, `stale` (`basis_removed`, `edge_item_changed`, `newer_version_published`, `basis_changed`, `class_no_longer_authorised`) or `superseded`.
- `contest` reuses `disagree` (OD-17); no judgment kind is built in 7B.1.

## 8. Evaluation results

- **Pipeline evaluation (fake adapter, CI):** 13 cases in `evaluation/cases.ts`, all pass, including injection, hallucinated citation, write-like tool request, withheld class and an unevaluated model. Report committed: [`2026-10-01-pipeline-fake-adapter.md`](../evaluation/architecture-intelligence/2026-10-01-pipeline-fake-adapter.md), seed only and metadata only (OD-14).
- **Seed-only live evaluation** (`pnpm ai:eval`, local database, real seed users, `synthetic_only`): **16 of 16 pass**: seven kind cases (S6), Researcher refused and audited for authorizers only (S4), override grant then revocation mid-invocation (S5), unauthorised engagement (S7), mode off (S8), model change refused before evaluation (OD-8), budget enforcement, authorisation revoked mid-invocation with existing inferences kept (S9), a new published version making an inference stale (S10), and the leak matrix across every role.
- **Real-provider evaluation: not run.** This environment has no provider credential. `evaluatedModels` is therefore empty for every prompt, and any real-provider output is refused as `model_not_evaluated` (fail-closed). Making a kind usable on a real model needs a credential, a seed-only real-provider run with manual grading, its committed report and a reviewed change to the manifest.

## 9. Tests and checks performed

| Check                                    | Result                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Full pgTAP (`pnpm db:test`, fresh reset) | **54 files, 1853 tests, PASS**; 7B.1 files: 249 tests (26+35+48+45+34+15+40+6)       |
| Vitest (`pnpm check`)                    | **331 passed, 16 skipped** (the skipped file is the live evaluation, run separately) |
| Lint, typecheck, format (`pnpm check`)   | clean                                                                                |
| Build (`pnpm build`)                     | clean                                                                                |
| DB types (`pnpm db:types`)               | regenerated, no drift                                                                |
| Seed-only evaluation (`pnpm ai:eval`)    | 16/16                                                                                |

## 10. Browser acceptance

Production build, `ARCHITECTURE_INTELLIGENCE_MODE=synthetic_only`, Playwright as each seed user.

- **Every internal role:** Principal Architect sees the authorisation form, revoke and the request list. Architect, Researcher, Project Administrator, Finance Administrator and System Administrator see the authorisation state but neither the form nor the requests. Non-members get a 404.
- **Authorise and revoke (Workforce, unauthorised by default):** a `client_agreement` basis on synthetic data shows the database's refusal; `synthetic_evaluation` records the authorisation; revoking with a reason records "Revoked" in the history.
- **Capabilities:** the Principal has no select on their own row; granting the Researcher use shows "You hold Architecture Intelligence use"; reset afterwards. The Project Administrator has no AI selects.
- **No inference leak:** 12 pages (the new page, overview, Edge, intelligence, evidence, architecture, two element pages, reviews, implementation, dashboard) for six internal roles after inferences were recorded: no inference text anywhere; request rows only for the Principal.
- **Client denial:** five client users (sponsor, lead, viewer at Meridian, lead at Harbor, the external advisor) have no nav entry, are redirected to `/portal` from the route, and see no inference text.

## 11. Defects found and fixed

1. **Revocation could not be submitted** (browser acceptance): the form required an effective date that revocation does not ask for. Optional text fields now default to null; test added.
2. **Concurrency test**: `dblink_exec` cannot return rows; switched to `dblink(...)`.
3. **Staleness test**: a published relationship cannot be updated directly; the test now uses `retire_relationship`.
4. **No-mutation test**: a filter for valid calls and a tautological fingerprint check were replaced with explicit markings and a real-change sanity test.
5. **Earlier suites 42 and 43** broke once the seed authorised Meridian and Harbor; they now clear the seeded authorisations inside their rolled-back transactions.
6. **Write-attempt scan** matched `crypto.update(`; the pattern now targets table writes only.

## 12. Known limitations

- No real-provider evaluation (§8); real-provider outputs are refused until one is done.
- Revocation cannot recall data already sent to a provider; the page says so.
- `data_origin` can only be set by migration or seed.
- The tool-call bound of six is an evaluation and safety bound (OD-7), to be revisited with evidence.
- `99_ai_concurrency` commits rows and deletes them afterwards (as the other concurrency suites do).

## 13. Explicit Phase 7B.2 exclusions

Not built: user-facing inference text, Explain, Edge projection, AI judgments or promotions, web search, file or image processing, embeddings or vector stores, background AI, notifications, client-facing AI, Method recommendation, cross-engagement learning, Pattern Library, Development Environment Intelligence, MCP, provider-hosted agent state. The diff was independently inspected for each (§14).

## 14. Independent diff inspection

A separate reviewer, with no part in writing the code, read `git diff main...HEAD` against each of the sixteen exclusions above. None is present.

- The app imports only the page's action, queries, schemas and types from the AI module. Its queries read authorisations, request metadata, the budget and standing. Nothing in the app reads `architecture_inferences` or `architecture_inference_basis`, and nothing calls the Gateway.
- The adapter sends function tools only, with `store: false`. A test asserts that hosted tools are absent.
- The only new triggers are append-only guards. There is no new dependency and no use of the service role.

The reviewer made one observation worth recording. RLS already lets current holders of use read inferences, as OD-11 decided. Keeping inference text out of the interface (OD-12) is therefore enforced in application code and by the leak tests, not by a policy.

## 15. CI state

Both required checks, **App** and **Database**, passed on `d850955`, the code-complete head ([run 36877566544](https://github.com/PurpleLambCompany/development-architecture-os/actions/runs/36877566544)). The only later change is this section of the report. PR #11 stays a draft and unmerged.

## 16. Recommended next step

Kerrick's final acceptance of 7B.1. Then, separately: a seed-only real-provider evaluation (needs a credential) and its manifest change, and the 7B.2 proposal, each on his instruction.
