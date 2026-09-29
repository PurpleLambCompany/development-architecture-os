# ADR-0001: Application stack and tooling

**Status:** Accepted (Phase 1, approved 2026-09-29)

## Context

The master specification (§24) recommends Next.js, TypeScript, Tailwind, shadcn/ui, Supabase, Vercel, Zod and React Hook Form. DSA OS must be fully independent of Peephole: its own repository, dependencies, database and deployment.

## Decision

- **Next.js 16 (App Router)**, React 19, TypeScript in strict mode. Server Components and Server Actions by default; client components only for interactive forms.
- **Tailwind CSS v4** with a small token set in `src/app/globals.css`. UI primitives in `src/components/ui/` follow the shadcn/ui pattern (copied-in source using `class-variance-authority`, `clsx`, `tailwind-merge`) rather than a runtime component library.
- **Supabase** (Postgres, Auth, RLS; Storage later) via `@supabase/ssr` for cookie-based sessions.
- **Zod v4** for validation on both client and server; **React Hook Form** for forms.
- **pnpm**, Node 22.
- **Vitest** for domain logic; **pgTAP** (`supabase test db`) for RLS and database rules.
- Next.js 16 renamed Middleware to **Proxy** (`src/proxy.ts`).

## Consequences

- Business rules live in `src/domain/*`, not in components. UI never queries the database directly.
- The only runtime dependencies beyond the approved stack are `class-variance-authority`, `clsx`, `tailwind-merge` (shadcn/ui's own helpers) and `server-only` (build-time guard that keeps secrets out of client bundles).
