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
**Phase 6 — Method Library: implemented on PR #7, awaiting Kerrick's final acceptance** (2026-09-30). See `docs/product/PHASE_6_REPORT.md`. Kerrick approved `docs/product/PHASE_6_PROPOSAL.md` Revision 2 (decisions D1-D34) and authorized implementation in the staged §38 build order on PR #7. Do not reinterpret approved decisions; surface any genuine contradiction with the repository before a difficult-to-reverse change. Do not merge until Kerrick explicitly approves final acceptance. Phase 7 (Architecture Intelligence) is out of scope.

Phases 1-5 are complete and merged. See `docs/product/PHASE_5_REPORT.md` for the most recent completed phase.

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
