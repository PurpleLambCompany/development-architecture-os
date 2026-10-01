# Architecture Intelligence foundation (Phase 7B.1)

Migrations, in order:

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

- **Architecture Intelligence cannot mutate governed DSA state.** The Tool Contract writes nothing; the only AI operation that writes, `record_architecture_intelligence_request`, writes only its three tables. This is proven by tests, not by volatility (see [No-mutation proofs](#no-mutation-proofs)).
- **Internal only.** Every table has internal-only policies; every function refuses a client (`P0002` or `42501`) or returns nothing. No client read model, snapshot or policy changed.
- **One engagement per call.** Nothing reads across engagements; a record of another engagement is not found.
- **Authorised to leave DSA is not automatically included in model context.** Authorisation makes a class eligible; a kind's context plan decides what is sent.
- **Not in `activity_log`** (OD-10). Authorisations, requests and inferences are their own attributed, append-only records.
- **Append-only.** Every new table has a guard: update and delete are refused for every role (`23514`), and inserts without the operation's marker are refused (`42501`). `authenticated` has select only.

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
