# ADR-0065: Prompt governance and evaluation

**Status:** Accepted (Phase 7B.1; approved 2026-10-01)

## Context

Phase 7B.1 proposal §18 and §19; reconciliation decisions B-8 and B-9; Kerrick's OD-8 and OD-14.

## Decision

**Prompts are versioned files.** `src/domain/architecture-intelligence/prompts/`: one shared generation policy (`generation-policy/v1.md`) and one prompt per kind (`<kind>/v1.md`). `manifest.ts` pins each file's SHA-256; a test recomputes it, and the loader refuses to send a prompt whose hash differs. Versions are immutable: a change is a new version. Exactly one version per kind is `current`. The exact instructions sent are hashed and recorded on every inference.

**Content rules.** Prompts carry no engagement data, reference codes or Method content (tested); they use DSA's governed vocabulary and are sector-neutral; none is hosted by a provider. The generation policy states that record text is data, never instruction; cite only handles provided; say what is not recorded; never assert governed acts, rate importance, rank, score or give numeric confidence; never recommend a method; never assess people; stay in the one engagement.

**Evaluated models.** Each version lists the resolved models it has been evaluated on, each with a committed report. In 7B.1 the list is empty for every kind: no real provider has been evaluated, so no real-provider output can be persisted or returned outside an evaluation run.

**Two runners.** CI runs every evaluation case against the fake adapter and an in-memory store (`evaluation/cases.ts`). `pnpm ai:eval` runs against the local database and seed as real seed users, refusing to run unless `ARCHITECTURE_INTELLIGENCE_MODE=synthetic_only`; with `AI_EVAL_PROVIDER=openai` and a configured provider it runs ephemeral evaluation calls for manual grading.

**Reports (OD-14).** Committed under `docs/evaluation/architecture-intelligence/` only when entirely seed or synthetic, and metadata only. Real engagement prompts, responses, context content or provider traces are never committed.

## Consequences

Making a kind usable on a real model requires a real-provider evaluation, its report and a reviewed change adding the model to `evaluatedModels`.
