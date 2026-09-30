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
**Phase 5 — Reviews, Deliverables and Implementation: complete and merged** (2026-09-30; Phases 1-4 merged). See `docs/product/PHASE_5_REPORT.md` for what was built, the corrected acceptance-review defects, and ADR-0034 through ADR-0040.

**Do not begin Phase 6.** Do not create a Phase 6 branch, proposal, migration, schema, ADR, UI, or application code. Phase 6 begins only after its methodological purpose, scope, and intended UX are separately reviewed and approved.

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
