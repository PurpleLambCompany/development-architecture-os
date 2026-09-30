# ADR-0004: Profile primary key is the auth user id

**Status:** Accepted (Phase 1)

## Context

Spec §26 lists `profiles.id` and a separate `auth_user_id`.

## Decision

`profiles.id` **is** `auth.users.id` (primary key and foreign key, `on delete cascade`). A trigger on `auth.users` creates the profile, copying `first_name`/`last_name` from invitation metadata.

## Consequences

- Every policy compares directly with `auth.uid()`; no extra join.
- If DSA OS ever needs people without login accounts (for example client contacts who never sign in), they belong in a separate `contacts` table rather than in `profiles`.
