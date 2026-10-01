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

## Current Build Phase
**Phase 7B.2 Step A — Architecture Intelligence Experience: accepted by Kerrick 2026-10-01 (PR #13).** See `docs/product/PHASE_7B_2_PROPOSAL.md` and `docs/product/PHASE_7B_2_REPORT.md`. **Step B (per-kind activation) has not started and is on hold until Kerrick authorizes it separately.**

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
