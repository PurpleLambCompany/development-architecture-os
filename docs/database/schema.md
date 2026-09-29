# Database schema (Phase 1)

Source of truth: `supabase/migrations/`. Generated TypeScript types: `src/types/database.ts` (`pnpm db:types`).

## Enums

| Enum                  | Values                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization_type`   | `tplco`, `client`, `licensed_practice` (reserved)                                                                                                                                                                                                 |
| `record_status`       | `active`, `invited`, `suspended`, `archived`                                                                                                                                                                                                      |
| `member_side`         | `internal`, `client`                                                                                                                                                                                                                              |
| `app_role`            | internal: `system_administrator`, `principal_architect`, `architect`, `researcher`, `project_administrator`, `finance_administrator`; client: `executive_sponsor`, `client_project_lead`, `client_finance`, `client_contributor`, `client_viewer` |
| `engagement_type`     | `development_architecture_sprint`, `development_architecture_intensive`, `embedded_development_partner`, `cohort`, `custom`                                                                                                                       |
| `engagement_status`   | `proposed`, `active`, `paused`, `completed`, `archived`                                                                                                                                                                                           |
| `architecture_domain` | `knowledge`, `capability`, `strategic_model`, `application`                                                                                                                                                                                       |
| `ip_classification`   | `tplco_method_ip`, `client_confidential`, `client_owned_source_material`, `project_work_product`, `public_source`, `licensed_third_party_source`, `generated_analysis`                                                                            |

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

`id`, `organization_id`, `user_id` (**unique**: one organization per person, ADR-0002), `role`, `status`, `created_by`. Trigger: role side must match organization type.

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

### `method_assets` (stub)

`id`, `title`, `category`, `methodology_domain`, `version`, `status` (`draft`/`active`/`retired`), `description`, `ip_classification` (default `tplco_method_ip`), `owner_user_id`. Internal only; no UI until Phase 6.

### `activity_log`

Append-only audit trail written by triggers on `organizations`, `organization_members`, `engagements`, `engagement_members`. Stores the actor, action (`insert`/`update`/`delete`), entity, and before/after snapshots in `metadata_json`.

## Functions

| Function                     | Exposed             | Purpose                                       |
| ---------------------------- | ------------------- | --------------------------------------------- |
| `public.role_side(app_role)` | yes                 | internal or client                            |
| `public.accept_invitation()` | yes (authenticated) | activates the caller's own invited membership |
| `private.*` helpers          | no                  | used by RLS policies; see [rls.md](rls.md)    |
