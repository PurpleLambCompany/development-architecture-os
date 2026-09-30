# Architecture Decision Records

One decision per file, numbered in order. A record is never rewritten after it is accepted; a later record supersedes it instead.

| #                                                          | Decision                                                        | Status                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------- |
| [0001](0001-application-stack.md)                          | Application stack and tooling                                   | Accepted                                  |
| [0002](0002-tenancy-and-visibility.md)                     | Tenancy model and engagement visibility                         | Accepted; one-org rule superseded by 0007 |
| [0003](0003-authorization-in-the-database.md)              | Authorization enforced in the database via RLS helpers          | Accepted                                  |
| [0004](0004-profile-identity.md)                           | Profile primary key is the auth user id                         | Accepted                                  |
| [0005](0005-invite-only-authentication.md)                 | Invite-only authentication and limited service-role use         | Accepted                                  |
| [0006](0006-contract-value-deferred.md)                    | Contract value lives with contracts (Phase 2), not engagements  | Accepted                                  |
| [0007](0007-multiple-organization-memberships.md)          | A person may belong to several organizations                    | Accepted                                  |
| [0008](0008-engagement-capabilities.md)                    | Engagement permissions are evaluated through capabilities       | Accepted                                  |
| [0009](0009-provenance-of-architecture-objects.md)         | Future architecture objects must record their provenance        | Accepted (requirement for Phase 3)        |
| [0010](0010-money-and-business-dates.md)                   | Money in integer minor units; business dates in America/Chicago | Accepted                                  |
| [0011](0011-allocations-credit-notes-refunds.md)           | Price, billing and cash separate; allocations, credits, refunds | Accepted                                  |
| [0012](0012-finance-operations-and-integrity.md)           | Money moves only through locked operations; document numbers    | Accepted                                  |
| [0013](0013-architecture-element-spine.md)                 | Architecture elements share one spine with subtype tables       | Accepted                                  |
| [0014](0014-publication-is-the-client-boundary.md)         | Publication is the client boundary; clients read snapshots      | Accepted                                  |
| [0015](0015-statement-provenance-and-evidence.md)          | Provenance on elements and statements; evidence chain           | Accepted                                  |
| [0016](0016-object-type-vocabulary.md)                     | Object type vocabulary; one domain per core type                | Accepted                                  |
| [0017](0017-project-intelligence-scope.md)                 | Project Intelligence records may span domains                   | Accepted                                  |
| [0018](0018-relationship-vocabulary.md)                    | Typed relationships; pairings enforced by the database          | Accepted                                  |
| [0019](0019-domain-maturity-is-judgment.md)                | Domain maturity is a dated judgment, never a score              | Accepted                                  |
| [0020](0020-separate-status-axes.md)                       | Lifecycle, approval, maturity and record status separate        | Accepted                                  |
| [0021](0021-approvals-and-baselines-reference-versions.md) | Approvals and baselines reference immutable versions            | Accepted                                  |
| [0022](0022-method-lineage-internal-only.md)               | Method lineage lives in an internal-only table                  | Accepted                                  |
| [0023](0023-finance-to-architecture-one-way.md)            | Finance may refer to architecture, never the reverse            | Accepted                                  |
| [0024](0024-architecture-capabilities.md)                  | New architecture capabilities                                   | Accepted                                  |
| [0025](0025-reference-codes.md)                            | Permanent reference codes and prefixes                          | Accepted                                  |
| [0026](0026-opportunity-record-kind.md)                    | Opportunity is a Project Intelligence record kind               | Accepted                                  |
| [0027](0027-stewardship-and-categories.md)                 | Internal stewardship and controlled categories                  | Accepted                                  |
| [0028](0028-history-resolution-escalation.md)              | Status history, resolution and escalation                       | Accepted                                  |
| [0029](0029-client-actions-and-contributions.md)           | Client actions and client contributions                         | Accepted                                  |
| [0030](0030-contributor-areas.md)                          | Client Contributors see assigned areas                          | Accepted                                  |
| [0031](0031-phase-4-capabilities.md)                       | Phase 4 capabilities                                            | Accepted                                  |
| [0032](0032-intelligence-signals.md)                       | Intelligence signals are computed; dismissals are stored        | Accepted                                  |
| [0033](0033-engagement-files.md)                           | Engagement files in private storage                             | Accepted                                  |

Template: Context, Decision, Consequences.
