# Architecture Intelligence (Phase 7B.1 foundation; Phase 7B.2 Step A experience)

Phase 7B.1 built the foundation, documented first below. Phase 7B.2 Step A adds the experience on top of it, documented in [Phase 7B.2 Step A](#phase-7b2-step-a-the-experience). Real-provider evaluation has not been done: no model is in the evaluated manifest, and Step B activation has not occurred.

Phase 7B.1 migrations, in order:

| Migration                                                   | Holds                                                                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261007000000_phase7b1_capabilities_enum.sql`             | The two new `engagement_capability` values (enum values must commit before use)                                                                                |
| `20261007000100_architecture_intelligence_capabilities.sql` | Role defaults, internal side, architecture authority, `private.can_use_architecture_intelligence`, `private.can_authorize_external_ai_processing`              |
| `20261007000200_engagement_data_origin.sql`                 | `engagements.data_origin` (`real` / `synthetic`) and its immutability guard                                                                                    |
| `20261007000300_ai_authorizations.sql`                      | `engagement_ai_authorizations`, its guard and RLS, the data-class set, `private.current_ai_authorization`, `public.set_engagement_ai_authorization`            |
| `20261007000400_ai_context_functions.sql`                   | The Tool Contract: `public.ai_context_row`, the gate, the resolver and emitter, projections, IP exclusion, digest, and the ten `public.ai_context_*` functions |
| `20261007000500_ai_requests.sql`                            | `architecture_intelligence_requests`, `architecture_intelligence_budget`, `architecture_intelligence_standing`                                                 |
| `20261007000600_architecture_inferences.sql`                | `architecture_inferences`, `architecture_inference_basis`, `record_architecture_intelligence_request`, `architecture_inference_state`                          |

The specification is [`docs/product/PHASE_7B_1_PROPOSAL.md`](../product/PHASE_7B_1_PROPOSAL.md). The decisions are ADR-0060 to ADR-0066, with amendments to ADR-0005, ADR-0024 and ADR-0051. Kerrick's open-decision answers are cited as OD-1 to OD-17.

## Rules that hold throughout

- **Architecture Intelligence cannot mutate governed DSA state.** The Tool Contract writes nothing. In 7B.1 the only AI operation that writes, `record_architecture_intelligence_request`, writes only its three tables; 7B.2 adds two writing operations, each proven to write only Architecture Intelligence tables (see [7B.2 no-mutation proofs](#7b2-no-mutation-proofs)). This is proven by tests, not by volatility (see [No-mutation proofs](#no-mutation-proofs)).
- **Internal only.** Every table has internal-only policies; every function refuses a client (`P0002` or `42501`) or returns nothing. No client read model, snapshot or policy changed.
- **One engagement per call.** Nothing reads across engagements; a record of another engagement is not found.
- **Authorised to leave DSA is not automatically included in model context.** Authorisation makes a class eligible; a kind's context plan decides what is sent.
- **Not in `activity_log`** (OD-10). Authorisations, requests and inferences are their own attributed, append-only records.
- **Append-only.** Every new table has a guard: update and delete are refused for every role (`23514`), and inserts without the operation's marker are refused (`42501`). `authenticated` has select only. The one exception, added in 7B.2, is `pending_architecture_inferences`: short-lived working state that no role can read and that its operations delete on keep, expiry and reauthorisation.

## Tables

| Table                                | Holds                                                                                                           | Written by                                 | Read by                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `engagements.data_origin`            | `real` (default) or `synthetic`; immutable                                                                      | migrations and the seed only               | as `engagements`                                           |
| `engagement_ai_authorizations`       | Versioned authorisation: state, classes, provider, region, basis, budget, effective date, who and when, reason  | `set_engagement_ai_authorization`          | internal readers of the engagement's architecture          |
| `architecture_intelligence_requests` | One metadata-only row per invocation: outcome, versions, models, manifest of identities, tool log, tokens, cost | `record_architecture_intelligence_request` | holders of `authorize_external_ai_processing`              |
| `architecture_inferences`            | A persisted inference: kind, subject, structured output, provenance; `suggested`, `model`                       | `record_architecture_intelligence_request` | current holders of `use_architecture_intelligence` (OD-11) |
| `architecture_inference_basis`       | Each record placed in context: handle, identity, version, class, digest, `digest_version`, origin, cited        | `record_architecture_intelligence_request` | current holders of `use_architecture_intelligence`         |

No prompt, context content, output text outside the structured inference, or provider body is stored anywhere.

## Functions

| Function                                   | Check                                                                                         | A client gets |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------- |
| `set_engagement_ai_authorization`          | `authorize_external_ai_processing`; `proposed`/`active`; basis matches data origin            | `P0002`       |
| `ai_context_*` (10)                        | `private.require_ai_context`: readable, `use_architecture_intelligence`, eligible, authorised | `P0002`       |
| `architecture_intelligence_standing`       | `can_read_architecture`; reads no architecture                                                | `P0002`       |
| `architecture_intelligence_budget`         | use or authorise on the engagement; per engagement only                                       | `P0002`       |
| `record_architecture_intelligence_request` | use; with an inference, the full context gate again, the same authorisation, re-emitted basis | `P0002`       |
| `architecture_inference_state`             | use; computed `current` / `stale` (with reasons) / `superseded`                               | `P0002`       |

## The Tool Contract

The ten functions (`ai_context_element`, `_relationships`, `_impact`, `_revision`, `_edge_item`, `_evidence`, `_intelligence`, `_criteria`, `_review`, `_implementation`) all return `public.ai_context_row` (`handle`, `record_type`, `record_id`, `version_id`, `anchor_id`, `variant`, `data_class`, `content`, `digest`, `digest_version`, `withheld_reason`) through `private.ai_emit`, which withholds a record whose class is not authorised now or which is excluded:

- Method/IP: `approach` statements, Method lineage, practice context, `methodology_version`, practice-lens Edge items.
- Evidence or records with `ip_classification` `tplco_method_ip` or `licensed_third_party_source` (OD-6).
- Evidence content: only metadata leaves; the architect's summary only for `evidence_bearing` and `tension` (OD-5). Never notes, URLs, locators, publishers, authors or files.
- People: removed recursively from every details object.

`digest = sha256(content::text)` over exactly what is sent, `digest_version = 1` (OD-13).

## Recording and staleness

`record_architecture_intelligence_request(eng, request, inference?)` accepts only allowlisted keys, identities-only manifests (64 KB) and tool logs (16 KB), a start time within the last fifteen minutes, and zero tokens and cost for refusals before any model call. With an inference it takes `pg_advisory_xact_lock_shared` on the engagement's authorisation key (`set_engagement_ai_authorization` takes it exclusively), re-runs the gate, requires the authorisation id the invocation started under, re-emits every basis row and compares class and digest, and refuses a claim citing an unknown handle. Staleness is computed by `architecture_inference_state`, never stored.

## No-mutation proofs

| Proof                                                                                                                            | Test                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| No DML, dynamic SQL, guard switch, sequence or lock in the contract or its helpers                                               | `47_ai_no_mutation`             |
| Every contract function runs inside a `READ ONLY` transaction; the recording operation is refused there                          | `47_ai_no_mutation`             |
| Whole-database fingerprint unchanged after hostile calls, direct DML, revocations, unauthorised classes, other roles and clients | `47_ai_no_mutation`             |
| The recording operation changes only its three tables                                                                            | `47_ai_no_mutation`             |
| Only five IMMUTABLE private constants are executable; nothing else reaches the resolver; no write grants                         | `47_ai_no_mutation`             |
| Authorisation revocation serialises with recording and wins                                                                      | `99_ai_concurrency`             |
| Model-requested write-like or unlisted tools call nothing; the module writes no table                                            | `gateway.write-attempt.test.ts` |

`STABLE` remains on the contract functions as defence in depth only.

## Tests

`41_ai_capabilities`, `42_ai_authorizations`, `43_ai_context`, `44_architecture_inferences`, `45_ai_requests`, `46_ai_client_boundary`, `47_ai_no_mutation`, `99_ai_concurrency` (uses `dblink`, cleans up its committed rows).

## Phase 7B.2 Step A: the experience

The specification is [`docs/product/PHASE_7B_2_PROPOSAL.md`](../product/PHASE_7B_2_PROPOSAL.md), governed by [`PHASE_7B_2_INTELLIGENCE_EXPERIENCE_RECONCILIATION.md`](../product/PHASE_7B_2_INTELLIGENCE_EXPERIENCE_RECONCILIATION.md) (IX-1 to IX-26). The decisions are ADR-0067 to ADR-0073, with amendments to ADR-0051, ADR-0056, ADR-0062, ADR-0063, ADR-0064, ADR-0065 and ADR-0066. Kerrick's answers are cited as PD-1 to PD-22. Every migration is additive; `edge_items`, `edge_judgments`, the rule catalog, client policies and snapshots are unchanged, and no Tool Contract function is added.

| Migration                                             | Holds                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261008000000_ai_request_outcomes_v2.sql`           | `nothing_to_add` in the request outcome check; `architecture_intelligence_requests.interpret_again`                                                                                                                                                                                |
| `20261008000100_inference_keeping.sql`                | `architecture_inferences.kept_at`; `pending_architecture_inferences`, its guard and purges; `private.verify_inference_basis`, `private.insert_architecture_inference`; the recording operation replaced; `private.same_inference_subject`; `architecture_inference_state` replaced |
| `20261008000200_architecture_inference_judgments.sql` | `architecture_inference_judgments`, its guard and RLS; `private.inference_latest_judgment`, `private.inference_is_current`, `private.record_inference_judgment_row`, `private.require_inference_judgment_capability`; `record_architecture_inference_judgment`                     |
| `20261008000300_keep_architecture_inference.sql`      | `keep_architecture_inference`, with an optional judgment in the same transaction                                                                                                                                                                                                   |
| `20261008000400_ai_read_models.sql`                   | Availability rules, reuse lookup, inference detail, Suggested interpretations, the kept register, and their private helpers                                                                                                                                                        |
| `20261008000500_deterministic_dossiers.sql`           | `review_dossier`, `element_supports_and_exposures`                                                                                                                                                                                                                                 |
| `20261008000600_ai_edge_item_identity.sql`            | Defect fix: `private.ai_resolve` and `ai_context_edge_item` address an Edge item exactly by `rule_key#md5(fingerprint)` (ADR-0063 amendment)                                                                                                                                       |
| `20261008000700_impact_trace_definer.sql`             | Defect fix approved by Kerrick: `public.impact_trace` runs as its owner (performance only; access unchanged, proven by `51_impact_trace_definer`; ADR-0055 amendment)                                                                                                              |

The seventh and eighth migrations were added during implementation and acceptance for two defects.

### Rules that hold in 7B.2

- **Nothing persists on generation.** The application calls the Gateway only in `ephemeral` mode, on a person's action. An inference is stored only when its requester keeps it, or judges it, which keeps it (ADR-0069).
- **Exact shown text is persisted text.** Keeping names only the request; the database supplies the output it verified and held. No content a client sends becomes an inference.
- **Reuse never crosses resolved model identity** (ADR-0068).
- **Suggested interpretations stay secondary.** They are never counted, ranked, severity-styled or tiered, never in the overview or "Since you were away", and never presented as established (ADR-0051 amendment, ADR-0068).
- **Non-holders learn nothing.** Every read model that returns anything about an inference refuses (`42501`) or returns an empty set to anyone without `use_architecture_intelligence`. The dossiers return the same rows to every internal reader whatever their AI standing.
- **Not in `activity_log`** (OD-10, PD-18), including inference judgments.

### Tables and columns

| Table or column                                      | Holds                                                                                                                                                                     | Written by                                                                                            | Read by                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `architecture_intelligence_requests.interpret_again` | Whether a person deliberately asked again where a kept interpretation was reused or suppressed; default false                                                             | `record_architecture_intelligence_request`                                                            | as the table                                               |
| `architecture_intelligence_requests.outcome`         | Now fifteen values, adding `nothing_to_add` (tokens and cost recorded; never an inference)                                                                                | `record_architecture_intelligence_request`                                                            | as the table                                               |
| `architecture_inferences.kept_at`                    | When a person kept the inference; null for evaluation-harness rows                                                                                                        | `keep_architecture_inference`                                                                         | as the table                                               |
| `pending_architecture_inferences`                    | A returned interpretation held for its requester for thirty minutes: request id (primary key), engagement, requester, verified output and basis, created and expiry times | `record_architecture_intelligence_request` (insert); keep, expiry and reauthorisation purges (delete) | **no role**: no grant, no policy                           |
| `architecture_inference_judgments`                   | Append-only judgments on kept inferences: kind, reason, expiry, governed promotion target (typed same-engagement keys), who and when                                      | `record_architecture_inference_judgment`, `keep_architecture_inference` (with a judgment)             | current holders of `use_architecture_intelligence` (OD-11) |

`pending_architecture_inferences` has RLS enabled and every privilege revoked from `public`, `anon` and `authenticated`. Its guard refuses update (`23514`), sets the requester and both times on insert (expiry is creation plus thirty minutes, also a check constraint), and refuses insert or delete outside the `dsa.ai_pending` marker (`42501`). `private.purge_expired_pending_inferences` runs in every recording and keep operation; the trigger `engagement_ai_authorizations_purge_pending` removes an engagement's pending rows whenever a new authorisation version is recorded.

`architecture_inference_judgments` has a guard that refuses insert outside the `dsa.ai_inference_judgment` marker (`42501`), sets `judged_by` and `judged_at` from the session and clock, and refuses update and delete for every role (`23514`). `authenticated` has select only, through the policy "inference judgments: current use-capability holders".

### Operations

| Function                                   | Check                                                                                                                                                                                                                                                                                                                                                          | A client gets |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `record_architecture_intelligence_request` | As in 7B.1, plus: `interpret_again` (boolean) in the allowlist; `nothing_to_add` needs the use capability and carries no inference; a `returned` `ephemeral` request may carry its validated output, verified like a persisted inference (shared authorisation lock, full gate, same authorisation, re-emitted basis, cited handles) and held as a pending row | `P0002`       |
| `keep_architecture_inference`              | Use; the caller's own unexpired pending row and `returned` `ephemeral` request; the full gate under the same authorisation version; every basis row re-emitted with the same class and digest. With a judgment: also `edit_architecture`, recorded in the same transaction. Inserts the inference with `kept_at` and deletes the pending row                   | `P0002`       |
| `record_architecture_inference_judgment`   | Use and `edit_architecture`; engagement-scoped advisory lock; the inference must be `current` (stale and superseded refused, `23514`); kind, reason, deferral date and promotion target checked as for Edge judgments                                                                                                                                          | `P0002`       |

Refusal messages that a person may see are written in governance language: "This interpretation can no longer be kept. Interpret again.", "This interpretation's basis has changed. Interpret again.", "This interpretation is stale: its basis has changed. Interpret again.", "A newer interpretation of this has been kept. Judge that one."

### Read models

All are `security definer`, `search_path = ''`, read-only, executable by `authenticated` only (revoked from `public` and `anon`), and refuse an engagement the caller cannot read (`P0002`). A subject is passed as jsonb with the 7B.1 subject keys: `type`, `element_id`, `second_element_id`, `version_id`, `rule_key`, `fingerprint`, `link_id`, `link_type`.

| Function                                                                                            | Returns                                                                                                                                                                | Non-holder of use |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `architecture_intelligence_availability(eng, kind, subject)`                                        | Whether the kind's availability rule holds and its reason; the latest kept inference on that subject, its state and latest judgment; whether re-offering is suppressed | `42501`           |
| `current_architecture_inference(eng, kind, subject, prompt_version, provider_key, requested_model)` | The reusable kept inference and its resolved model, or nothing                                                                                                         | `42501`           |
| `architecture_inference_detail(eng, inference)`                                                     | One inference: output, subject, provenance (including the requester's display name), state and stale reasons, citation labels, judgments                               | `42501`           |
| `suggested_interpretations(eng)`                                                                    | Current kept `tension`, `evidence_bearing`, `realization_reading` with no judgment, `investigating` or an expired deferral, ordered by governance date then keep time  | empty set         |
| `kept_architecture_inferences(eng, kind?, state?)`                                                  | Every kept inference with state, stale reasons and latest judgment, newest kept first; no requester                                                                    | empty set         |
| `review_dossier(eng, review)`                                                                       | The deterministic Review dossier (ADR-0072)                                                                                                                            | same rows         |
| `element_supports_and_exposures(eng, element)`                                                      | Evidence with stance, underpinning Assumptions and their support, related open Risks, current Edge items (ADR-0072)                                                    | same rows         |

`architecture_inference_state` is replaced: identical, except that supersession compares the full subject through `private.same_inference_subject` (ADR-0064 amendment).

Private helpers, none executable by `authenticated`: `private.inference_matches`, `private.latest_kept_inference`, `private.ai_availability_rule` (the seven rules of ADR-0068), `private.ai_basis_label` (citation labels from identities only), `private.ai_person_name` (provenance only), `private.ai_element_governance_date` (ordering only, never ranking), and those of migrations `20261008000100` to `20261008000300` above.

The processing mode, the evaluated-model manifest and the provider configuration are not visible to the database; the application combines them with these results (`composeGate`, ADR-0068, ADR-0073).

### 7B.2 no-mutation proofs

| Proof                                                                                                                                                               | Test                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| The new read models and dossiers contain no DML and succeed for a holder; a client's reads all refuse; every public table is unchanged after every read             | `50_ai_experience_no_mutation` |
| Keeping and judging change only `architecture_inferences`, `architecture_inference_basis`, `architecture_inference_judgments` and `pending_architecture_inferences` | `50_ai_experience_no_mutation` |
| Judging changes only `architecture_inference_judgments`; a refused keep changes nothing                                                                             | `50_ai_experience_no_mutation` |
| Neither new table is registered with `activity_log`                                                                                                                 | `50_ai_experience_no_mutation` |
| The 7B.1 proofs, updated for the replaced recording operation                                                                                                       | `47_ai_no_mutation`            |
| No application module requests `persist`                                                                                                                            | `imports.test.ts`              |

### 7B.2 tests

`48_ai_keep_and_judge` (keep only by the requester, within thirty minutes, once, under the same authorisation and basis; keep and judge atomically; judgment kinds, required fields, promotion targets, append-only, stale refusal, capability, reads), `49_ai_read_models` (every availability rule true and false, suppression and its end on staleness, reuse and its end on a resolved-model change, Suggested interpretations and the register, the dossiers), `50_ai_experience_no_mutation`, and `45_ai_requests` (the request audit is touched only by the budget, the recording operation, keeping, which reads its own request, and the reuse lookup, which reads the latest resolved model; never an aggregate). Vitest: `gate.test.ts`, `subjects.test.ts`, `test-overlay.test.ts`, `schemas.test.ts` (version 2 outputs) and the extended Gateway and import tests.
