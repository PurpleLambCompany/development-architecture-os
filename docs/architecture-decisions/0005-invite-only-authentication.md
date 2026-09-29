# ADR-0005: Invite-only authentication and limited service-role use

**Status:** Accepted (Phase 1 decision 5, approved 2026-09-29)

## Context

DSA OS is not a self-serve product. Every account belongs to TPLCo or a client organization TPLCo serves.

## Decision

- **Public sign-up is disabled** (`[auth] enable_signup = false` locally; "Allow new users to sign up" off in the hosted project). The email provider stays enabled so password and magic-link sign-in work.
- Sign-in is **email + password**, with a **magic link** alternative that never creates accounts (`shouldCreateUser: false`) and responds identically whether or not the address exists.
- Invitation, magic-link and recovery emails link to **`/auth/confirm?token_hash=…`**, which verifies the token on the server (`verifyOtp`) so sessions live in HTTP cookies and no tokens appear in URL fragments. Templates are in `supabase/templates/` and must be copied to the hosted project.
- An invited membership has status `invited` and grants **no access** until the person follows their link; `/auth/confirm` then calls `public.accept_invitation()`, which can only activate the caller's own invited membership.
- The **service-role key is used for exactly one purpose**: creating (and on failure deleting) the auth account and sending the invitation email. The membership row is written with the inviter's own session, so RLS decides whether the invitation is allowed. The key lives only in `SUPABASE_SECRET_KEY`, is read through a `server-only` module, and is never exposed to the browser.
- Passwords must be at least 12 characters.

## Consequences

- SSO (for example Google Workspace or Microsoft Entra for larger clients) can be added later without changing the membership model.
- Hosted Supabase needs the same email templates, site URL and redirect allow-list as `supabase/config.toml`.
