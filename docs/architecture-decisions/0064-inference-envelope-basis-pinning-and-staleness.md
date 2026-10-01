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
