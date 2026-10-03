# DSA OS — Claude Code Project Instructions

## Project Identity
This repository contains **Development Systems Architecture OS (DSA OS)** for The Purple Lamb Company.

DSA OS is the digital operating environment for the Development Architecture Method™ and future Development Systems Architecture engagements.

## Hard Boundary
This project is completely independent from Peephole.

Do not:
- inspect Peephole repositories
- import Peephole code
- connect to Peephole databases
- reuse Peephole environment variables
- modify Peephole infrastructure
- assume shared deployment or authentication

Only cross this boundary if the user gives an explicit future instruction.

## Primary Specification
Treat `DSA_OS_MASTER_BUILD_SPEC.md` as the authoritative product specification.

If code and the specification conflict, surface the conflict before making an expensive architectural change.

## Long-Term Technical Direction
The current CRUD/SaaS presentation is an implementation stage, not the final conceptual form of DSA. The governed architecture foundation is intended to become the substrate of a Development Systems Architecture IDE. This direction does not authorize premature implementation or expansion of the governing V1 roadmap.

**PRESERVE THE DESTINATION. BUILD ONLY THE AUTHORIZED PHASE.**

The direction is recorded in `docs/product/DSA_IDE_TECHNICAL_DIRECTION.md` — direction only, revisable, not an ADR, and not authorization. Read it before making a decision that would be expensive to reverse, in particular anything touching the engagement partition on `architecture_relationships`, stable element identity, provenance separation, `architecture_baselines` or the `impact_trace()` depth bound. It authorizes no work: the governing V1 roadmap, spec §23 and the §6.1 freeze all remain in force.

## Current Build Phase
**The accepted V1 roadmap governs: `docs/product/V1_ROADMAP_RECONCILIATION.md` (accepted by Kerrick 2026-10-02, PR #14).** The remaining path to V1 is V1-A Workflow Closure, V1-B Production Foundation, V1-C Participation and Awareness, V1-D Engagement Outputs and V1-E Discovery and Scale, one phase at a time, each started only on Kerrick's explicit instruction and closed by its gate. Phases 1-7 are historical and their numbering is not continued.

**V1-A Workflow Closure: implementation plan accepted by Kerrick 2026-10-02 (decisions D1-D13).** The plan is `docs/product/V1_A_WORKFLOW_CLOSURE_PROPOSAL.md`. **All six planned increments are merged to `main`:** Increment 1 (Workstream G: the Browser / Playwright foundation, PR #17), Increment 2 (Workstream A: practice administration, bootstrap and authority closure, D1-D7, PR #18), Increment 3 (Workstream B: client-facing records and files, D9, PR #19), Increment 4 (Workstream C: routes and error closure, PR #20), Increment 5 (Workstream D: publishing at scale, D8, PR #21), Increment 6 (Workstreams D2, E and F: account recovery and the remaining dead ends, PR #22, squash `1d0282e`). PR #22 records Increment 6 as the final planned V1-A increment before Gate A, so the accepted plan has no further increment. **What is authorized next is not established by the repository.** Nothing beyond the merged increments is authorized: do not begin any further increment, workstream or phase until Kerrick instructs it. **Gate A is not recorded as passed or accepted at HEAD** — no Gate A assessment document is committed to `main`, and the draft PR #23 is neither merged nor accepted. V1-A is complete only after the full Gate A assessment and Kerrick's manual acceptance, which includes his own manual browser pass of the golden path (roadmap §6, Gate A criterion 6); merged increment PRs alone do not complete it. V1-B does not start until Gate A is accepted. The local bootstrap command (D6) is local/pre-production only; V1-B owns the production bootstrap decision.

**Frozen until V1 (roadmap §6.1):** no new Architecture Intelligence, Development Edge or Method Library capability without Kerrick's explicit authorization. Existing functionality remains; security, correctness and blocking-defect fixes are allowed. **Architecture Intelligence Step B remains on hold.**

**Where status lives.** This file is the single authoritative statement of current execution status and authorization constraints. `README.md` carries a concise human-facing summary and points here. `docs/product/V1_ROADMAP_RECONCILIATION.md` is the authoritative roadmap and gate reconciliation, not an increment-status ledger. Accepted proposals and phase reports are historical decision records: they should not carry live execution status, and when their status language goes stale the fix is to point here, not to restate status in them. ADR `Status` lines are the exception and stay maintained as they always have been, recording acceptance and any later amendment. When an increment or phase lands, update this file first.

The historical phase record follows.

Phase 7B.2 Step A — Architecture Intelligence Experience: accepted by Kerrick 2026-10-01 (PR #13). See `docs/product/PHASE_7B_2_PROPOSAL.md` and `docs/product/PHASE_7B_2_REPORT.md`. Step B (per-kind activation) has not started and is on hold until Kerrick authorizes it separately.

Phase 7B.1 — Architecture Intelligence foundation: complete and merged (PR #11, squash `26a3e04`), accepted by Kerrick 2026-10-01. See `docs/product/PHASE_7B_CONCEPTUAL_RECONCILIATION.md`, `docs/product/PHASE_7B_1_PROPOSAL.md` and `docs/product/PHASE_7B_1_REPORT.md`.

Phases 1-7B.1 are complete and merged (Phase 7A: PR #9, squash `85ecf13`); Phase 7B.2 Step A is accepted (PR #13). Real-provider evaluation has not been done: no model is evaluated, so real models stay fail-closed (`model_not_evaluated`) and no real engagement data may be processed until a seed/synthetic-only real-provider evaluation, manual grading, a committed evaluation report and a reviewed manifest change are completed. Do not add a credential, run a real-provider evaluation, enable real engagement processing or change the evaluated-model manifest without Kerrick's explicit instruction. Phase 7B.1 adds only the foundation: authorisation, capabilities, the read-only Tool Contract, the Gateway and adapter, the inference and basis model, the request audit, prompts and evaluation. Architecture Intelligence must never mutate governed DSA state. Phase 7B.2 Step A adds the intelligence drawer (deterministic facts first, then a person-requested ephemeral interpretation for holders), Keep through a server-only recording path, inference judgments and human promotion, reuse and Suggested interpretations; interpretations are exercised only with the deterministic fake provider outside production, and real models remain fail-closed. **Step B (seed/synthetic-only real-model evaluation of the v2 prompts per kind, manual grading, a committed report and a reviewed manifest change) has not started and remains on hold until Kerrick's separate explicit authorization.** Still excluded without Kerrick's explicit instruction: generic chat, proactive or background inference, client-facing AI, Method-aware AI or recommendation, cross-engagement learning, Pattern Library, web search, file or image processing, embeddings, Development Environment Intelligence, MCP, provider-hosted agent state, autonomous promotion, AI ranking or scoring, notifications, new inference kinds and new Tool Contract functions.

Only build the currently approved phase unless explicitly instructed otherwise.

## Approved Initial Stack
- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui or similarly restrained component primitives
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Row Level Security
- Vercel
- Zod
- React Hook Form

## Engineering Rules
- TypeScript strict mode.
- Small, testable increments.
- Use migrations for database changes.
- Prefer explicit domain naming.
- Keep business logic out of UI components where practical.
- Do not add dependencies without a clear reason.
- Keep README current.
- Record significant technical decisions in `/docs/architecture-decisions/`.
- Maintain demo/seed data for development.
- Explain broad schema or security changes before implementing them.

## Security Rules
This system will contain confidential client strategy, financial data, and proprietary methodology.

- Enforce tenant isolation.
- Use database-level authorization/RLS where feasible.
- Never rely only on hidden UI elements for permissions.
- Client users must only access their own organization/engagement data.
- Client users must never access Method/IP content.
- Do not store raw payment card data.
- Follow least-privilege principles.

## Product Design Direction
The product should feel:
- institutional
- architectural
- premium
- calm
- structured
- executive-level

Avoid:
- gamification
- playful SaaS visual language
- generic kanban-first UX
- excessive gradients
- visual clutter

## End-of-Phase Reporting
At the end of each phase report:
- what was built
- files changed
- schema changes
- security/RLS changes
- tests/checks performed
- known limitations
- unresolved questions
- recommended next step
