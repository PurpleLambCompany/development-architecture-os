# Database schema (Phase 1)

> Phase 2 financial tables, functions and rules are documented in [finance.md](finance.md), Phase 3 architecture tables, operations and read models in [architecture.md](architecture.md), the Phase 6 Method Library in [method-library.md](method-library.md), and the Phase 7A Deterministic Development Edge in [edge.md](edge.md).

Migrations: `20260929230000_phase1_foundation.sql`, `20260929233000_engagement_capabilities.sql`.

Source of truth: `supabase/migrations/`. Generated TypeScript types: `src/types/database.ts` (`pnpm db:types`).

## Enums

| Enum                    | Values                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization_type`     | `tplco`, `client`, `licensed_practice` (reserved)                                                                                                                                                                                                 |
| `record_status`         | `active`, `invited`, `suspended`, `archived`                                                                                                                                                                                                      |
| `member_side`           | `internal`, `client`                                                                                                                                                                                                                              |
| `app_role`              | internal: `system_administrator`, `principal_architect`, `architect`, `researcher`, `project_administrator`, `finance_administrator`; client: `executive_sponsor`, `client_project_lead`, `client_finance`, `client_contributor`, `client_viewer` |
| `engagement_type`       | `development_architecture_sprint`, `development_architecture_intensive`, `embedded_development_partner`, `cohort`, `custom`                                                                                                                       |
| `engagement_status`     | `proposed`, `active`, `paused`, `completed`, `archived`                                                                                                                                                                                           |
| `architecture_domain`   | `knowledge`, `capability`, `strategic_model`, `application`                                                                                                                                                                                       |
| `engagement_capability` | `view_financials`, `approve_change_orders`, `pay_invoices`, `approve_architecture`, `manage_client_team`, `view_confidential_deliverables` (ADR-0008)                                                                                             |
| `ip_classification`     | `tplco_method_ip`, `client_confidential`, `client_owned_source_material`, `project_work_product`, `public_source`, `licensed_third_party_source`, `generated_analysis`                                                                            |

## Tables

All tables have `created_at`/`updated_at` (maintained by trigger) and, where meaningful, `created_by` (forced to the caller).

### `profiles`

| Column                    | Type          | Notes                                                            |
| ------------------------- | ------------- | ---------------------------------------------------------------- |
| `id`                      | uuid PK       | = `auth.users.id` (ADR-0004)                                     |
| `first_name`, `last_name` | text          | editable by the user                                             |
| `email`                   | text          | unique (case-insensitive); only System Administrators may change |
| `status`                  | record_status | only System Administrators may change                            |

### `organizations`

`id`, `name`, `slug` (unique), `type`, `status`, `created_by`. At most one `tplco` row (partial unique index).

### `organization_members`

`id`, `organization_id`, `user_id`, `role`, `status`, `created_by`; unique (`organization_id`, `user_id`). A person may belong to several organizations with a role in each (ADR-0007). Trigger: role side must match organization type.

### `engagements`

| Column                          | Type              | Notes                                      |
| ------------------------------- | ----------------- | ------------------------------------------ |
| `client_organization_id`        | uuid FK           | must be a `client` organization; immutable |
| `title`, `slug`                 | text              | slug unique                                |
| `engagement_type`               | engagement_type   |                                            |
| `objective`, `description`      | text              |                                            |
| `methodology_version`           | text              | default `DAM 1.0` (spec §20)               |
| `status`                        | engagement_status | only admins/principals may set `archived`  |
| `current_phase`                 | text              | free text in Phase 1                       |
| `start_date`, `target_end_date` | date              | end ≥ start                                |

No financial columns (ADR-0006).

### `engagement_members`

`id`, `engagement_id`, `user_id`, `side`, `role`, `status`, `created_by`; unique (`engagement_id`, `user_id`). Check: `role_side(role) = side`. Trigger: client members must belong to the engagement's organization; internal members to TPLCo.

### `role_capability_defaults`

`role`, `capability`; primary key (`role`, `capability`). The capabilities each role holds by default: the role definition (ADR-0008). Reference data seeded by migration; nobody can change it through the API. Check: client-only capabilities (`pay_invoices`, `approve_change_orders`) only on client roles.

### `engagement_member_capability_overrides`

| Column                 | Type                  | Notes                                           |
| ---------------------- | --------------------- | ----------------------------------------------- |
| `engagement_member_id` | uuid FK               | cascade on member removal; immutable            |
| `engagement_id`        | uuid FK               | copied from the member by trigger               |
| `capability`           | engagement_capability | immutable; unique per member                    |
| `granted`              | boolean               | `true` grants, `false` revokes the role default |
| `reason`               | text ≤ 500            | why the exception exists                        |
| `created_by`           | uuid                  | forced to the caller                            |

Trigger: client-only capabilities cannot be granted to internal members. Audited in `activity_log`.

### `method_assets` (stub)

`id`, `title`, `category`, `methodology_domain`, `version`, `status` (`draft`/`active`/`retired`), `description`, `ip_classification` (default `tplco_method_ip`), `owner_user_id`. Internal only; no UI until Phase 6.

Reshaped in Phase 6: the content columns moved to immutable versions, `owner_user_id` became `steward_user_id`, and existing rows became legacy assets. See [method-library.md](method-library.md) and ADR-0041.

### `activity_log`

Append-only audit trail written by triggers on `organizations`, `organization_members`, `engagements`, `engagement_members`, `engagement_member_capability_overrides`. Stores the actor, action (`insert`/`update`/`delete`), entity, and before/after snapshots in `metadata_json`.

## Phase 7A tables

Documented in full in [edge.md](edge.md). Only what a person did or a governed operation fixed is stored; every Edge item, tier, order and impact path is computed on read.

| Table                                    | Holds                                                                                              | Written by                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `relationship_impact_rules`              | The governed relationship-impact direction matrix: link, direction, assessment, propagation, depth | migrations only                                           |
| `review_examined_versions`               | The exact version of each element a Review examined, captured at the hold; not a baseline          | `hold_review` only; immutable                             |
| `edge_judgments`                         | Append-only human judgments on Edge items: kind, reason, expiry, promoted record, who and when     | `record_edge_judgment`, `record_edge_event_judgment`      |
| `edge_briefing_marks`                    | One user's private "briefed through" time per engagement                                           | `mark_briefed_through` only; own row only; not logged     |
| `acceptance_criteria.agreed_recorded_at` | New column: the system time of the agreement operation (`agreed_on` stays the business date)       | the criterion guard on agreement, and a one-time backfill |

## Functions

| Function                                                                           | Exposed             | Purpose                                              |
| ---------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------- |
| `public.role_side(app_role)`                                                       | yes                 | internal or client                                   |
| `public.accept_invitation()`                                                       | yes (authenticated) | activates the caller's own invited memberships       |
| `public.my_engagement_capabilities(engagement)`                                    | yes (authenticated) | the caller's effective capabilities on an engagement |
| `public.capability_side(capability)`, `public.is_financial_capability(capability)` | yes                 | capability metadata                                  |
| `private.*` helpers                                                                | no                  | used by RLS policies; see [rls.md](rls.md)           |

## Phase 7B.1 tables

Documented in full in [architecture-intelligence.md](architecture-intelligence.md). Nothing is in `activity_log`; every table is append-only and internal.

| Table                                | Holds                                                                      | Written by                                 |
| ------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------ |
| `engagements.data_origin`            | New column: `real` or `synthetic`, immutable                               | migrations and the seed only               |
| `engagement_ai_authorizations`       | Versioned per-engagement external-processing authorisation                 | `set_engagement_ai_authorization`          |
| `architecture_intelligence_requests` | Metadata-only audit of every invocation                                    | `record_architecture_intelligence_request` |
| `architecture_inferences`            | Persisted structured inferences (`suggested`, `model`)                     | `record_architecture_intelligence_request` |
| `architecture_inference_basis`       | The pinned basis of each inference: identities, versions, classes, digests | `record_architecture_intelligence_request` |

## Phase 7B.2 Step A tables and columns

Documented in full in [architecture-intelligence.md](architecture-intelligence.md#phase-7b2-step-a-the-experience). Nothing is in `activity_log`; everything is internal. No change to `edge_items`, `edge_judgments`, the rule catalog, client policies or snapshots.

| Table or column                                      | Holds                                                                                                                   | Written by                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `architecture_intelligence_requests.interpret_again` | New column: a person deliberately asked again where a kept interpretation was reused or suppressed                      | `record_architecture_intelligence_request`                                                |
| `architecture_intelligence_requests.outcome`         | Check extended with `nothing_to_add`                                                                                    | `record_architecture_intelligence_request`                                                |
| `architecture_inferences.kept_at`                    | New column: when a person kept the inference (null for evaluation-harness rows)                                         | `keep_architecture_inference`                                                             |
| `pending_architecture_inferences`                    | A returned interpretation held for thirty minutes so its requester can keep exactly what was shown; no role can read it | `record_architecture_intelligence_request`; deleted on keep, expiry and reauthorisation   |
| `architecture_inference_judgments`                   | Append-only judgments on kept inferences, sibling of `edge_judgments`                                                   | `record_architecture_inference_judgment`, `keep_architecture_inference` (with a judgment) |

New public functions, all `authenticated` only: `keep_architecture_inference`, `record_architecture_inference_judgment`, `architecture_intelligence_availability`, `current_architecture_inference`, `architecture_inference_detail`, `suggested_interpretations`, `kept_architecture_inferences`, `review_dossier` and `element_supports_and_exposures`. Replaced: `record_architecture_intelligence_request`, `architecture_inference_state`, `ai_context_edge_item` and `private.ai_resolve`.
