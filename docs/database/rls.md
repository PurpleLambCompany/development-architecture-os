# Row Level Security, roles and capabilities (Phase 1)

> Phase 2 financial access rules are documented in [finance.md](finance.md), Phase 3 architecture access rules in [architecture.md](architecture.md), Phase 4 Project Intelligence, client actions and contributor areas in [intelligence.md](intelligence.md), Phase 6 Method Library access, practice capabilities and the client boundary in [method-library.md](method-library.md), and Phase 7A Development Edge access in [edge.md](edge.md) (summarized [below](#phase-7a-the-development-edge)).

Every table has RLS enabled. Policies call `SECURITY DEFINER` helpers in the unexposed `private` schema (ADR-0003). `anon` has no privileges on any table. Tests (`pnpm db:test`, also run in CI): `01_phase1_rls.test.sql`, `02_multi_organization.test.sql`, `03_engagement_capabilities.test.sql` in `supabase/tests/`.

## Who can see what

| Table                                    | System Admin / Principal Architect | Other internal roles    | Client users                                                        |
| ---------------------------------------- | ---------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| `organizations`                          | all                                | all                     | organizations they are an active member of                          |
| `organization_members`                   | all                                | all                     | members of organizations they belong to                             |
| `profiles`                               | all                                | all                     | self + people on a shared engagement                                |
| `engagements`                            | all                                | assigned only           | assigned **and** an active member of that engagement's organization |
| `role_capability_defaults`               | all                                | all                     | all (reference data)                                                |
| `engagement_member_capability_overrides` | for visible engagements            | for visible engagements | their own only                                                      |
| `engagement_members`                     | for visible engagements            | for visible engagements | for visible engagements                                             |
| `method_assets`                          | yes                                | yes                     | **never**                                                           |
| `activity_log`                           | yes                                | no                      | no                                                                  |

"Active" means the profile, the organization membership and the organization are all `active`. Invited or suspended members see nothing.

A person may belong to several organizations (ADR-0007). Every check is made per organization: an assignment to a client engagement counts only while the person has an active membership in that engagement's organization, and suspending one membership affects that organization only.

Finance Administrators see only engagements they are assigned to, as above, even though they hold portfolio-wide financial visibility (below).

## Engagement capabilities (ADR-0008)

Permissions on an engagement are evaluated through capabilities. A member's effective capability is their override for that engagement if one exists, otherwise their role default.

| Role                  | view_financials | approve_change_orders | pay_invoices | approve_architecture | manage_client_team | view_confidential_deliverables |
| --------------------- | :-------------: | :-------------------: | :----------: | :------------------: | :----------------: | :----------------------------: |
| System Administrator  |  ✓ (portfolio)  |          n/a          |     n/a      |          ✓           |         ✓          |               ✓                |
| Principal Architect   |        ✓        |          n/a          |     n/a      |          ✓           |         ✓          |               ✓                |
| Architect             |                 |          n/a          |     n/a      |                      |                    |               ✓                |
| Researcher            |                 |          n/a          |     n/a      |                      |                    |               ✓                |
| Project Administrator |                 |          n/a          |     n/a      |                      |         ✓          |               ✓                |
| Finance Administrator |  ✓ (portfolio)  |          n/a          |     n/a      |                      |                    |                                |
| Executive Sponsor     |        ✓        |           ✓           |      ✓       |          ✓           |         ✓          |               ✓                |
| Client Project Lead   |                 |                       |              |          ✓           |         ✓          |               ✓                |
| Client Finance        |        ✓        |                       |      ✓       |                      |                    |                                |
| Client Contributor    |                 |                       |              |                      |                    |                                |
| Client Viewer         |                 |                       |              |                      |                    |                                |

"n/a": client-side only; cannot be granted to internal members. "Portfolio": System and Finance Administrators hold `view_financials` on every engagement **without assignment**. That passes the financial check (`private.can_view_engagement_financials`) only; it does not make the engagement, its team or any project content visible. Everyone else holds a capability only through an active assignment.

| Helper                                             | Purpose                                         |
| -------------------------------------------------- | ----------------------------------------------- |
| `private.has_engagement_capability(engagement, c)` | caller holds capability `c` on the engagement   |
| `private.can_view_engagement_financials(e)`        | the check Phase 2 financial tables will use     |
| `private.can_manage_capability(e, member, c)`      | caller may grant or revoke `c` for that member  |
| `public.my_engagement_capabilities(e)`             | the caller's effective capabilities, for the UI |

Changing capabilities (insert/update/delete of overrides):

| Capability                                                                     | Who may grant or revoke                                                                 |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `view_financials`, `approve_change_orders`, `pay_invoices`                     | System Admin, Principal Architect, Finance Administrator **assigned** to the engagement |
| `approve_architecture`, `manage_client_team`, `view_confidential_deliverables` | whoever can manage the engagement (see below)                                           |
| `view_architecture` (Phase 3)                                                  | whoever can manage the engagement (see below)                                           |
| `edit_architecture`, `publish_architecture` (Phase 3)                          | Principal Architects only, never for themselves (not System or Project Administrators)  |

Nobody except a System Administrator can change their own capabilities, and nobody at all can change their own architecture authority. Role defaults cannot be changed through the API.

## Who can change what

| Action                                            | Allowed                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Create / edit client organization                 | System Admin, Principal Architect, Project Administrator                            |
| Edit TPLCo organization                           | System Admin                                                                        |
| Add / change / remove client organization members | System Admin, Principal Architect, Project Administrator                            |
| Add / change / remove TPLCo staff                 | System Admin only                                                                   |
| Create engagement                                 | System Admin, Principal Architect, Project Administrator (creator is auto-assigned) |
| Edit engagement, manage its team                  | System Admin, Principal Architect, Project Administrator **assigned** to it         |
| Archive engagement                                | System Admin, Principal Architect                                                   |
| Delete organization or engagement                 | nobody (archive instead)                                                            |
| Edit own first/last name                          | everyone                                                                            |
| Change profile status or email                    | System Admin                                                                        |
| Manage method assets                              | System Admin, Principal Architect                                                   |
| Grant / revoke engagement capabilities            | see the capability table above                                                      |
| Write activity log                                | nobody (triggers only)                                                              |

Architects, Researchers and Finance Administrators have read access to assigned engagements in Phase 1. Their write permissions arrive with the tables they own (finance in Phase 2; architecture and intelligence in Phases 3–4; reviews, deliverables and implementation in Phase 5). Client users have no write access in Phase 1 except their own name.

## Spec §30 acceptance checks and where they are proven

| Check                                          | pgTAP                              | Browser (manual/e2e)                 |
| ---------------------------------------------- | ---------------------------------- | ------------------------------------ |
| Internal user can create a client organization | ✓                                  | ✓                                    |
| Internal user can create an engagement         | ✓                                  | ✓                                    |
| Users can be assigned to an engagement         | ✓                                  | ✓                                    |
| A client user only sees their own engagement   | ✓                                  | ✓                                    |
| A client user cannot access Method/IP          | ✓ (`method_assets` returns 0 rows) | ✓ (`/internal/*` redirects)          |
| Repository isolated from Peephole              | n/a                                | separate repo, env, Supabase project |

## Phase 6: the Method Library

The Phase 1 rows above for `method_assets` ("Manage method assets: System Admin, Principal Architect") are superseded. Since Phase 6, every Method Library table is readable by internal members only and written only through operations gated by the practice capabilities `author_methodology` and `publish_methodology`, held through TPLCo organization membership (ADR-0044). System Administrators hold neither by default. Client users still read no Method Library row. See [method-library.md](method-library.md).

## Phase 7A: the Development Edge

Everything in Phase 7A is internal. No client policy, client read model or client-callable function is added or changed, and client snapshots are unchanged. `authenticated` has select only on the new tables; every write goes through a `security definer` operation, and guard triggers refuse writes made without the operation's marker (`42501`). See [edge.md](edge.md).

| Table                       | System Admin / Principal Architect       | Other internal roles                     | Client users |
| --------------------------- | ---------------------------------------- | ---------------------------------------- | ------------ |
| `relationship_impact_rules` | yes (read only; migrations write)        | yes (read only)                          | **never**    |
| `review_examined_versions`  | engagements whose architecture they read | engagements whose architecture they read | **never**    |
| `edge_judgments`            | engagements whose architecture they read | engagements whose architecture they read | **never**    |
| `edge_briefing_marks`       | **their own row only**                   | **their own row only**                   | **never**    |

"Engagements whose architecture they read" is `private.can_read_architecture(engagement)`: internal membership and access to the engagement. There is no policy through which anyone, System Administrators and Principal Architects included, reads another user's briefing mark.

| Function                     | Check                                                                     | A client gets |
| ---------------------------- | ------------------------------------------------------------------------- | ------------- |
| `edge_items`                 | `can_read_architecture`                                                   | empty         |
| `element_revisions`          | `can_read_architecture`                                                   | empty         |
| `development_changes`        | `can_read_architecture`                                                   | empty         |
| `impact_trace`               | `security invoker`; `can_read_architecture` on the start, RLS on each row | empty         |
| `edge_rule_catalog`          | `is_internal`                                                             | empty         |
| `method_practice_counts`     | `is_internal` (Method Library readers)                                    | empty         |
| `record_edge_judgment`       | `edit_architecture` on the engagement                                     | `P0002`       |
| `record_edge_event_judgment` | `edit_architecture` on the engagement                                     | `P0002`       |
| `mark_briefed_through`       | `can_read_architecture`; writes the caller's own row only                 | `P0002`       |

Who can change what:

| Action                                                 | Allowed                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Record an Edge judgment (single item or whole event)   | Internal members holding `edit_architecture` on the engagement (`42501` otherwise)             |
| Change or delete an Edge judgment                      | nobody (append-only; a correction is a new judgment)                                           |
| Set a briefing mark                                    | the user, for themselves, on an engagement whose architecture they read; never logged          |
| Capture what a Review examined                         | `hold_review` only (`manage_reviews`); nobody may change or delete a capture                   |
| Add, retire or delete an `examines` from a held Review | nobody (`23514`, OD-7)                                                                         |
| Set `acceptance_criteria.agreed_recorded_at`           | nobody directly; the criterion guard sets it on agreement, and it is frozen with the agreement |
| Change the impact matrix                               | migrations only                                                                                |

Not material and Deferred judgments on the 11 Phase 4 and Phase 5 signal rules are written through `dismiss_intelligence_signal` and `dismiss_implementation_signal`, which require `edit_architecture`, so the Signals page and the Edge agree (OD-9). Judgments are recorded in `activity_log`; briefing marks are not, so no role can learn from the log who read what. Tests: `35_edge_judgments.test.sql`, `36_edge_briefing_marks.test.sql`, `38_edge_client_boundary.test.sql`, `39_practice_counts.test.sql`.

## Phase 7B.1: Architecture Intelligence

Everything in Phase 7B.1 is internal. No client policy, client read model or client-callable function is added or changed. See [architecture-intelligence.md](architecture-intelligence.md).

| Capability                         | System Admin | Principal Architect | Architect | Researcher | Project Admin | Finance | Client roles |
| ---------------------------------- | :----------: | :-----------------: | :-------: | :--------: | :-----------: | :-----: | :----------: |
| `use_architecture_intelligence`    |              |          ✓          |     ✓     |            |               |         |     n/a      |
| `authorize_external_ai_processing` |              |          ✓          |           |            |               |         |     n/a      |

Both are architecture authority: overrides only by Principal Architects on the engagement, never for themselves.

| Table                                | Readers                                                         | Client users |
| ------------------------------------ | --------------------------------------------------------------- | ------------ |
| `engagement_ai_authorizations`       | internal readers of the engagement's architecture               | **never**    |
| `architecture_intelligence_requests` | holders of `authorize_external_ai_processing` on the engagement | **never**    |
| `architecture_inferences`            | current holders of `use_architecture_intelligence` (OD-11)      | **never**    |
| `architecture_inference_basis`       | current holders of `use_architecture_intelligence`              | **never**    |

All four are append-only (`23514` on update or delete for every role) and written only by their operations. Tests: `41`–`47`, `99_ai_concurrency`.
