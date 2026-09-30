# Architecture Decision Records

One decision per file, numbered in order. A record is never rewritten after it is accepted; a later record supersedes it instead.

| #                                                  | Decision                                                       | Status                                    |
| -------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| [0001](0001-application-stack.md)                  | Application stack and tooling                                  | Accepted                                  |
| [0002](0002-tenancy-and-visibility.md)             | Tenancy model and engagement visibility                        | Accepted; one-org rule superseded by 0007 |
| [0003](0003-authorization-in-the-database.md)      | Authorization enforced in the database via RLS helpers         | Accepted                                  |
| [0004](0004-profile-identity.md)                   | Profile primary key is the auth user id                        | Accepted                                  |
| [0005](0005-invite-only-authentication.md)         | Invite-only authentication and limited service-role use        | Accepted                                  |
| [0006](0006-contract-value-deferred.md)            | Contract value lives with contracts (Phase 2), not engagements | Accepted                                  |
| [0007](0007-multiple-organization-memberships.md)  | A person may belong to several organizations                   | Accepted                                  |
| [0008](0008-engagement-capabilities.md)            | Engagement permissions are evaluated through capabilities      | Accepted                                  |
| [0009](0009-provenance-of-architecture-objects.md) | Future architecture objects must record their provenance       | Accepted (requirement for Phase 3)        |

Template: Context, Decision, Consequences.
