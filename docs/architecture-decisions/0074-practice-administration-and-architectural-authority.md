# ADR-0074: Practice administration and architectural authority

**Status:** Accepted for implementation (V1-A Increment 2, Workstream A; plan decisions D1-D7 accepted by Kerrick 2026-10-02). Not yet merged or accepted as built.

## Context

V1-A plan §4 (Workstream A) and decisions D1-D7. Before this change:

- Only a System Administrator could invite or change TPLCo staff, edit the practice organization or change a profile's status, by role name. A solo Principal Architect could not run the practice without SQL, and a System Administrator could make anyone, themselves included, a Principal Architect or Architect, and so hold architectural authority (ADR-0024 says a System Administrator holds none by default).
- A person's engagement role was chosen per engagement, so an Architect could be staffed as a Principal Architect, and a Project Administrator could raise their own engagement role.
- Nothing preserved a last Principal Architect or a last administrator.
- The hosted bootstrap started an installation with a System Administrator, which then had no route to architectural authority from the app.

## Decision

**Four layers, kept separate.**

| Layer                      | What it governs                                                                                                 | Who holds it                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Practice administration    | Edit the practice organization; invite, re-role, suspend and restore TPLCo staff; resend and revoke invitations | The practice capability `administer_practice`: Principal Architect and System Administrator by default; delegable (D1, D4) |
| Architectural authority    | Creating a Principal Architect, Architect or Researcher                                                         | An active Principal Architect, for someone else (D2)                                                                       |
| Method administration      | `author_methodology`, `publish_methodology` and their overrides                                                 | Unchanged (ADR-0044)                                                                                                       |
| Engagement-level authority | Capabilities on one engagement                                                                                  | The practice role's engagement defaults, plus per-engagement overrides (D3; ADR-0008, ADR-0024)                            |

**D1. `administer_practice` is a practice capability** (ADR-0044's mechanism, a new `practice_capability` value; no new table). Every check is a capability check (`private.has_practice_capability`). Its overrides are set and cleared by its holders, never on their own membership, and it can never be revoked from a Principal Architect (a revocation is also cleared when someone becomes one), so no other administrator can take away a Principal Architect's power to create architectural authority. The Method capabilities are still administered by `publish_methodology` holders. A System Administrator is not a Principal Architect: they administer the practice but hold no architectural or Method authority by default.

**D2. Only a Principal Architect creates architectural authority.** `public.is_architecture_authority_role` names the authority-bearing roles: Principal Architect, Architect and Researcher, the roles whose engagement defaults include architecture capabilities (proven equal in pgTAP). A membership change _creates authority_ when the resulting row is an authority role that is active or invited, and it is an insert, a role change into that role, or a restore from suspended or removed. Only an active Principal Architect who is not the target may make such a change. Removing authority (suspension, a role change out of it) needs only `administer_practice`. Restoring a suspended profile whose membership is an authority role also needs a Principal Architect.

**D5. Safeguards.** Nobody changes their own role or status (accepting one's own invitation, invited to active with the role unchanged, is the one exception). After any change that affects a holder, at least one active Principal Architect, one active practice administrator and one `publish_methodology` holder remain. Only a pending invitation can be revoked (deleted); an accepted member is suspended, keeping their history. A membership cannot be moved to another person or organization. The practice organization's type cannot change, and its status cannot change from the app.

**Where it is enforced.** In the database, below every route: row-level security limits TPLCo memberships, the practice organization and profile status to `administer_practice` holders; `BEFORE` triggers on `organization_members` and `profiles` apply D2 and the self rules; `AFTER` triggers apply the last-holder rules. Every trigger takes the same transaction advisory lock as the override functions (`dsa.practice_capabilities`) and re-reads the caller's authority after taking it, so concurrent changes serialize and cannot each pass on a stale view (proven with two sessions in `99_practice_concurrency`). Writes with no signed-in user (migrations, the seed, the bootstrap command) are trusted. The app mirrors the rules only to choose which controls to offer and to explain a refusal in plain words.

**D3. An internal person's engagement role is their practice role.** `private.validate_engagement_member` refuses an internal engagement row whose role differs from the person's TPLCo role, and a TPLCo role change propagates to every engagement they are on, keeping each engagement's capability overrides. Engagement-specific differences are capability overrides. The migration refuses to apply if existing data disagrees.

**D6, D7. Bootstrap.** `pnpm practice:bootstrap` creates the practice organization and invites its first user as a Principal Architect, who accepts through the normal email and password flow. It runs only against the local stack and only on an installation without a practice. It is local and pre-production only; V1-B makes the production bootstrap decision ([bootstrap.md](../database/bootstrap.md)).

## Consequences

- Amends ADR-0003: TPLCo staff, the practice organization and profile status are governed by `administer_practice`, not the System Administrator role.
- Amends ADR-0024: a System Administrator cannot acquire architectural authority, by role or status change, for themselves or anyone else; only a Principal Architect creates it, and engagement roles cannot launder it.
- Amends ADR-0044: `administer_practice` is a second kind of practice capability, administered by its own holders.
- No new table. Two migrations: the enum value, then defaults, functions, triggers and policies.
- A practice that loses its last Principal Architect outside the app (by SQL) is not blocked from administration, but cannot create architectural authority until one is restored by the same means.
