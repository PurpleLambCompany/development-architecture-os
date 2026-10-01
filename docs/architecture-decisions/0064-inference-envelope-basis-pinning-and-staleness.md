# ADR-0064: Inference envelope, basis pinning and staleness

**Status:** Accepted (Phase 7B.1; approved 2026-10-01)

## Context

Phase 7B.1 proposal §13 to §17; reconciliation decisions B-7, B-11, B-12, B-13, B-15 and B-31; Kerrick's OD-10, OD-11, OD-13 and OD-17.

## Decision

**What an inference is.** A model-produced, structured, cited interpretation grounded in governed DSA state (B-31). Never an element, statement, Evidence, Project Intelligence, Review, acceptance criterion or anything a client reads. `epistemic_status` is always `suggested` and `producer` always `model` (the vocabulary ADR-0051 reserved), enforced by check constraints.

**Five kinds (closed).** `explanation`, `tension`, `evidence_bearing`, `review_brief`, `realization_reading`, each with a strict output schema (`kinds/schemas.ts`): an assertion, cited claims (every claim cites at least one handle), qualitative uncertainty, references for examination, and a kind payload. No field for significance, severity, priority, rank, score or confidence can exist. A forbidden-vocabulary check rejects outputs asserting governed acts or authority, importance, ranking, numeric confidence or method recommendation.

**Storage.** `public.architecture_inferences` (subject columns with a per-subject-type shape check and same-engagement foreign keys, provenance: provider, requested and resolved model, reasoning effort, prompt id, version and content hash, generation policy and tool contract versions, tokens, requester, authorisation) and `public.architecture_inference_basis` (one row per non-withheld record placed in context: handle, identity, typed element and version references, class, digest, `digest_version`, origin, cited). Both append-only, written only by `public.record_architecture_intelligence_request`, readable only by current holders of `use_architecture_intelligence` (OD-11), never by clients, not in `activity_log` (OD-10).

**Recording verifies, it does not trust.** With an inference, the operation takes a shared lock against authorisation changes, re-checks the full context gate, requires that the authorisation in force is the one the invocation started under, re-emits every basis row through the Tool Contract and refuses unless class and digest match and nothing is withheld, and refuses any claim citing a handle not in the basis. A basis cannot be fabricated. Unknown request or inference fields, and manifests or tool logs carrying anything but identities, are refused.

**Staleness is computed, never stored.** `public.architecture_inference_state(eng, inference)` reports `current`, `stale` (with reasons `basis_removed`, `edge_item_changed`, `newer_version_published`, `basis_changed`, `class_no_longer_authorised`) or `superseded` (a later inference of the same kind on the same subject). Nothing is refreshed or rewritten.

**`contest` (B-13, OD-17).** No new judgment kind: `disagree` is reused when inference judgments arrive in 7B.2.

## Consequences

Inference judgments, promotion and any user-facing display are 7B.2. A real-provider output can be persisted only once its resolved model is evaluated (ADR-0062).

## Amendment (Phase 7B.2, 2026-10-01): persistence intent, `kept_at`, supersession and reuse

Phase 7B.2 Step A (IX-12, IX-13, IX-19; PD-3, PD-7, PD-13a, PD-21; ADR-0068 to ADR-0070) changes when an inference is stored, not what one is. The envelope, kinds, basis rows, checks and computed staleness reasons are unchanged.

- **Persistence intent.** On the application path an inference is stored only when its requester keeps it, or judges it, which keeps it (ADR-0069). The stored row is exactly the output that was validated and shown, supplied by the database from a pending interpretation; it is never regenerated and never text a browser sent. It is written by `keep_architecture_inference` through the same verification as the recording operation. Rows written by the recording operation in `persist` mode now come only from the evaluation harness.
- **`kept_at`.** `architecture_inferences.kept_at` records when a person kept it; generation time stays `requested_at`, so provenance shows both. It is null for harness rows. Every read model for people (availability, reuse, Suggested interpretations, the register) considers kept rows only.
- **Supersession compares the full subject.** `architecture_inference_state` is replaced so that an inference is superseded only by a later inference of the same kind on the same full subject (`private.same_inference_subject`: every subject column, including a pair's second element, a revision's version, an Edge item's rule and fingerprint, and an evidence link). The 7B.1 comparison matched only the first element. The newest kept interpretation stays current; earlier ones remain as history and are never overwritten or deleted (PD-7).
- **Reuse.** A kept, current inference is shown in place of a new request when kind, full subject, prompt version, provider, requested model and resolved model all match, and never across a change of resolved model (ADR-0068).
- **Judgments.** The judgment lifecycle deferred above now exists in `architecture_inference_judgments` (ADR-0070), with `disagree` reused for contest (OD-17). A stale or superseded inference cannot be judged.
- **Display.** Inference text is now shown, only in layer 2 of the intelligence drawer and in the Suggested and register lists, to holders of `use_architecture_intelligence` (ADR-0067). Stale reasons are shown in plain words, one phrase per reason.
