# ADR-0063: Read-only Tool Contract and minimum-sufficient context

**Status:** Accepted (Phase 7B.1; approved 2026-10-01)

## Context

Phase 7B.1 proposal §9 and §12; reconciliation decision B-20; Kerrick's OD-5, OD-6, OD-13 and his additional requirement: **Architecture Intelligence cannot mutate governed DSA state**, proven by the Tool Contract, privileges, RLS and function design, and adversarial tests. `STABLE` volatility is defence in depth only, not the security model.

## Decision

**Ten database functions are the whole contract.** `public.ai_context_element`, `_relationships`, `_impact`, `_revision`, `_edge_item`, `_evidence`, `_intelligence`, `_criteria`, `_review` and `_implementation`, each `security definer`, `search_path = ''`, executable by `authenticated` only. Each first calls `private.require_ai_context`: the engagement must be readable (else P0002), the caller must hold `use_architecture_intelligence` (42501), the engagement must be `proposed` or `active` (42501) and currently authorised (42501). A record of another engagement is not found.

**One projection.** All ten return `public.ai_context_row` through `private.ai_emit`, which resolves the record with `private.ai_resolve` and withholds it (no content, no digest, `withheld_reason`) when it is excluded or its class is not authorised now. Projections are allowlists: element snapshots without `methodology_version`, lineage, practice context, `approach` statements or unaccepted AI drafting; evidence as metadata only (never notes, URL, reference, locator, publisher or author, or any file), with the architect's summary only for `evidence_bearing` and `tension` (OD-5); people stripped recursively from details; Edge items in the practice lens excluded as Method/IP; anything with `ip_classification` `tplco_method_ip` or `licensed_third_party_source` excluded (OD-6).

**Digest (OD-13).** `digest = sha256(content::text)` over the canonical jsonb text of exactly what is sent, with `digest_version = 1`. Record identity (type, id, version, anchor, variant) is kept separately.

**Cannot mutate governed state.** Proven, not declared (pgTAP 47 and 99_ai_concurrency):

1. The contract functions and every private helper they use contain no DML, dynamic SQL, guard switch, sequence or lock (static check over `pg_proc`).
2. Every contract call succeeds inside a `READ ONLY` transaction, where the engine refuses any write; the recording operation, which does write, is refused there.
3. A fingerprint of every public table is unchanged after adversarial calls by a holder (hostile strings, wrong kinds, unknown and cross-engagement ids), after authorisation revocation, after use-capability revocation, through an unauthorised class, and by clients, Researchers and Finance; the fingerprint is shown to detect a real change.
4. The recording operation writes only its three tables.
5. Only five pure IMMUTABLE private constants are executable by `authenticated`; the resolver, emitter and gates are not; no other public function reaches content through the resolver; no role has a write privilege on any AI table.
6. On the application side, the registry is the only dispatch table, a test proves model-requested write-like or unlisted names call nothing, and a source scan proves the module performs no table write and calls no other database function.

**Registry and versioning.** `src/domain/architecture-intelligence/tools/registry.ts` maps ten tool names to the ten functions with strict Zod argument schemas (emitted as JSON Schema) that never carry an engagement. `TOOL_CONTRACT_VERSION` is pinned by a hash of the definitions in a test.

**Minimum-sufficient context.** Each kind has a context plan (`kinds/plans.ts`): required classes, deterministic anchors, permitted tools, caps on tool calls, context tokens and output tokens. Every record placed in context goes into the invocation's manifest by identity, class, digest and origin (`anchor` or `tool_call`), never by content.

## Consequences

A new tool is a migration, a registry entry, a contract version and tests. The contract never reads activity logs, finance, Method Library, Method Applications, lineage, DAM releases, Development Contexts, storage or client read models.
