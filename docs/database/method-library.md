# Method Library (Phase 6)

Migrations, in order:

| Migration                                  | Holds                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `20261005000000_phase6_enums.sql`          | The Phase 6 enums and the `approach` statement kind                                                                |
| `20261005000100_practice_capabilities.sql` | The practice capability scope: defaults, overrides, checks and administration                                      |
| `20261005000200_method_library_core.sql`   | Categories, the reshaped `method_assets`, versions and their children, rights, guards, the `method-library` bucket |
| `20261005000300_method_library_legacy.sql` | The legacy backfill of pre-Phase 6 assets and `adopt_legacy_method_asset`                                          |
| `20261005000400_dam_releases_contexts.sql` | DAM releases, release 1.0, `engagements.dam_release_id`, Development Contexts                                      |
| `20261005000500_method_applications.sql`   | Method Applications, their link tables, closure, addenda and learning sources                                      |
| `20261005000600_acceptance_criteria.sql`   | Acceptance criteria, `validation_criteria` and the capture inside `record_review_validation`                       |
| `20261005000700_typed_method_lineage.sql`  | Typed, version-pinned `element_method_lineage` and the `methodology_derived` publish check                         |
| `20261005000800_method_read_models.sql`    | Internal read models and the two client read models                                                                |

The specification is [`docs/product/PHASE_6_PROPOSAL.md`](../product/PHASE_6_PROPOSAL.md) (Revision 2). Decisions D1–D34 are recorded there, and the difficult-to-reverse ones are ADR-0041 to ADR-0050, with amendment notes on ADR-0009, ADR-0016 and ADR-0036.

The database is the authority for every rule below. The application offers only the choices the database accepts, and the database checks them again.

## Rules that hold throughout

- **Writes go through operations only.** `authenticated` has no insert, update or delete grant on any Phase 6 table. Every operation is `security definer`, checks a capability, validates, and sets an operation marker (`private.begin_methodology_operation`, or `private.begin_architecture_operation` for the validation capture). Guard triggers refuse any write made without the marker with `42501`.
- **Error codes.** `42501` permission, `23514` rule, `P0002` not found (also returned when the caller may not see the row), `22023` malformed content.
- **Published methodology is immutable.** A non-draft Method Asset version and every child row are frozen; the only change is the lifecycle move to `superseded` or `retired`. A published DAM release is frozen. Corrections are new versions or new releases (ADR-0041, ADR-0042).
- **Form decides behavior.** Only a Method is applied; only a Model is instantiated; only a Standard is judged against; only an Instrument gathers evidence within an application; only a Template is produced from. The database refuses the wrong form (ADR-0041, ADR-0047).
- **Legacy versions are history only.** They cannot be applied, instantiated, used, cited or added to a new release (`private.require_usable_method_version`).
- **Closure freezes a Method Application.** The only later change is the database clearing `element_id` when a linked unpublished draft is deleted (ADR-0043, D30).
- **Agreement freezes an acceptance criterion.** Afterwards it can only be superseded or withdrawn, once, and is never deleted (ADR-0046).
- **Nothing is deleted that history relies on.** Assets, contexts, applications, published versions, published releases, agreed criteria, rights records, revisions and validation captures are never deleted. Drafts are.
- **The vocabulary is documented, never governed.** No Phase 6 operation writes to `architecture_object_types`, `relationship_types`, `relationship_rules` or `architecture_relationships` (ADR-0016 amendment, ADR-0043).
- **No client policy exists on any Phase 6 table** (ADR-0022). Clients reach methodology only through the two client read models and approach statements (see [Client boundary](#client-boundary)).
- **Every change is audited.** Every Phase 6 table written by operations has a `private.log_activity` trigger. Facts the row does not hold (an origin change with its reason, an adoption, an engagement's release change with its reason) are logged as named events.

## Vocabulary

| Enum                               | Values                                                                          | ADR  |
| ---------------------------------- | ------------------------------------------------------------------------------- | ---- |
| `method_asset_form`                | `method`, `model`, `standard`, `instrument`, `template`                         | 0041 |
| `method_asset_version_lifecycle`   | `draft`, `published`, `superseded`, `retired`                                   | 0041 |
| `method_identity_disclosure`       | `internal_only`, `may_be_named`                                                 | 0049 |
| `method_asset_origin`              | `tplco_developed`, `co_developed`, `client_owned`, `licensed_in`, `third_party` | 0048 |
| `method_rights_role`               | `owner`, `co_owner`, `licensor`, `contributor`                                  | 0048 |
| `dam_release_status`               | `draft`, `published`, `superseded`, `retired`                                   | 0042 |
| `method_application_state`         | `planned`, `in_progress`, `completed`, `discontinued`                           | 0043 |
| `method_application_element_role`  | `examined`, `produced`, `revised`, `informed`                                   | 0043 |
| `method_application_evidence_role` | `drew_on`, `gathered`                                                           | 0043 |
| `method_stage_treatment`           | `followed`, `adapted`, `skipped`                                                | 0043 |
| `method_lineage_role`              | `instantiates`, `produced_from`, `judged_against`, `legacy_derived_from`        | 0047 |
| `practice_capability`              | `author_methodology`, `publish_methodology`                                     | 0044 |
| `acceptance_criterion_state`       | `proposed`, `agreed`, `superseded`, `withdrawn`                                 | 0046 |

`statement_kind` gains `approach` (ADR-0049). Check-constraint values, not enums: `method_assets.status` (`active`, `retired`, `legacy`), `development_contexts.status` (`active`, `retired`), `standard_version_judged_in.setting` (`review`, `completion`, `assessment`), `method_asset_versions.modes` (subset of `discover`, `define`, `assess`, `validate`, `govern`), practitioner role (`lead`, `contributor`).

New reference codes (ADR-0025 counters): `MUS` for Method Applications and `ACR` for acceptance criteria, both engagement-scoped.

## Tables

### Library core (TPLCo-wide)

| Table                               | Holds                                                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `method_asset_categories`           | Twelve subject categories; migration-managed; never drive behavior                                                                                                  |
| `method_assets` (reshaped)          | Identity: `key`, `title`, `form`, `category_key`, `origin`, `usage_restriction`, `ip_classification`, `status`, `current_version_id`, `steward_user_id`, retirement |
| `method_asset_versions`             | Content: `version_no`, `version_label`, `lifecycle`, `legacy`, the common and Method-only fields, disclosure fields, provenance, publication and retirement         |
| `method_version_domains`            | Architecture domains a version applies to (all forms; none means domain-neutral)                                                                                    |
| `method_version_stages`             | Ordered stages of a Method (`key`, `title`, `purpose`, `guidance`)                                                                                                  |
| `method_version_outputs`            | Expected outputs of a Method or Model (`output_kind`, `object_type_key`, `deliverable_type`); a Model's are objects only                                            |
| `method_version_components`         | Published non-Method versions a Method normally uses                                                                                                                |
| `standard_version_criteria`         | Ordered criteria of a Standard (`key`, `statement`, `guidance`, `scale`)                                                                                            |
| `standard_version_judged_in`        | Where a Standard is judged: `review`, `completion`, `assessment`                                                                                                    |
| `instrument_version_evidence_types` | The `evidence_source_type` values an Instrument gathers                                                                                                             |
| `template_version_specs`            | The `deliverable_type` a Template produces                                                                                                                          |
| `template_version_sections`         | A Template's ordered section outline                                                                                                                                |
| `method_version_files`              | Protected files of Templates and Instruments in the `method-library` bucket                                                                                         |
| `method_asset_rights_holders`       | Append-only rights records: organization or external holder, role, agreement reference, supersession                                                                |

At most one draft and one published version per asset (partial unique indexes); `version_label` unique per asset and required once published.

### Legacy

No new table. Migration `…0300` converts every pre-Phase 6 asset into a `legacy` asset (a `retired` one stays `retired`) with one legacy version (`legacy = true`) frozen as `published`, labelled with the original version text, carrying the original description and domain. The columns `category`, `version`, `methodology_domain` and `description` are dropped, and `method_assets_form_required` allows a null form only while `legacy` or `retired`. Seed and test data describe pre-Phase 6 assets and lineage through the same conversion (`private.insert_legacy_method_asset`, `private.insert_legacy_method_lineage`).

### Releases and contexts

| Table                              | Holds                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dam_releases`                     | `version_label` (numeric, unique), `title`, `status`, summaries, `effective_on`, `supersedes_release_id`, `vocabulary_record`, publication, retirement |
| `dam_release_members`              | One pinned version per asset per release; primary key (`release_id`, `asset_id`)                                                                       |
| `engagements.dam_release_id` (new) | The release an engagement is conducted under; `methodology_version` is kept equal to `'DAM ' \|\| version_label` by trigger                            |
| `development_contexts`             | Governed contexts: permanent `key`, `label`, `definition`, `status`; empty in migration                                                                |
| `development_context_revisions`    | Append-only: prior label and definition, reason, who, when                                                                                             |
| `engagement_development_contexts`  | An engagement's contexts; one primary (partial unique index)                                                                                           |
| `method_version_contexts`          | Where a version applies (none means any context); frozen with the version                                                                              |

At most one draft release and one published release at a time. Migration `…0400` publishes release `1.0` containing every legacy version and assigns it to every engagement whose `methodology_version` was `DAM 1.0`; any other engagement is reported by a migration notice.

### Applications (engagement-scoped)

| Table                              | Holds                                                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `method_applications`              | `MUS` code, pinned Method version, release at start, `version_in_release`, `outside_release_reason`, reason, question, scope, state, dates, closure, continuation |
| `method_application_practitioners` | Active internal engagement members; exactly one `lead`                                                                                                            |
| `method_application_contexts`      | The Development Context snapshot, adjustable until closure                                                                                                        |
| `method_application_domains`       | Domain-level scope                                                                                                                                                |
| `method_application_stage_notes`   | One note per stage of the pinned version: treatment, reason (required unless `followed`), note                                                                    |
| `method_application_elements`      | Element links by role, with captured identity (`captured_*`), `observed_version_id` and `element_removed_at`; element FK `on delete set null (element_id)`        |
| `method_application_evidence`      | Evidence links (`drew_on`, `gathered`), optional Instrument version for gathered evidence                                                                         |
| `method_application_assets`        | Components actually used, with a deviation note                                                                                                                   |
| `method_application_addenda`       | Append-only notes added after closure                                                                                                                             |
| `method_version_learning_sources`  | A draft version citing a closed application that motivated it; frozen with the version                                                                            |

Element link rules (`private.method_element_role_allows`): `examined` any kind; `produced` core objects, the seven Project Intelligence kinds and Deliverables; `revised` the same plus Implementation Initiatives; `informed` Decisions, Recommendations, Reviews and Implementation Initiatives.

### Acceptance criteria (engagement-scoped)

| Table                 | Holds                                                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acceptance_criteria` | `ACR` code, governed element and kind (core object or Implementation Initiative), `body`, `state`, agreement (party, date, recorder, evidence), supersession, closure, internal informing Standard, `client_visible` |
| `validation_criteria` | One row per agreed criterion in force when a Review validated an initiative: `validation_relationship_id`, `criterion_id`, `note`, `captured_at`; no verdict                                                         |

### Lineage

`element_method_lineage` (Phase 3, ADR-0022) gains `method_asset_version_id` and `lineage_role`, both required; the unique key becomes (`element_id`, `method_asset_version_id`, `lineage_role`). `method_version` text is kept and set from the version label. Existing rows are backfilled to their asset's legacy version as `legacy_derived_from`. Direct grants and editor policies are revoked.

| Role                  | Form     | Element kinds                                    |
| --------------------- | -------- | ------------------------------------------------ |
| `instantiates`        | Model    | core object                                      |
| `produced_from`       | Template | Deliverable of the Template's `deliverable_type` |
| `judged_against`      | Standard | Review, core object, Implementation Initiative   |
| `legacy_derived_from` | legacy   | backfill only                                    |

### Practice capabilities

`practice_role_capability_defaults` (migration-only; internal roles only) and `practice_member_capability_overrides` (on a TPLCo `organization_members` row). See [Practice capabilities](#practice-capabilities-adr-0044).

## Practice capabilities (ADR-0044)

| Practice capability   | Default holders                | Needed for                                                                                                                                                         |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `author_methodology`  | Principal Architect, Architect | Creating and editing assets and draft versions and their content, components, contexts, files and learning sources; creating and editing draft releases            |
| `publish_methodology` | Principal Architect            | Publishing and retiring versions and assets; adopting legacy assets; origin and rights; publishing and retiring releases; Development Contexts; practice overrides |

System Administrators, Researchers and Project and Finance Administrators hold neither by default. Every internal member reads the library.

| Helper                                                                          | Purpose                                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `private.has_practice_capability(c)`                                            | Caller holds `c` through an active internal TPLCo membership; override wins over role default           |
| `private.require_practice_capability(c)`                                        | The same, raising `42501`                                                                               |
| `private.member_has_practice_capability(membership, c)`                         | Effective capability of one membership                                                                  |
| `public.my_practice_capabilities()`                                             | The caller's effective practice capabilities, for the UI                                                |
| `public.practice_capability_matrix()`                                           | Every TPLCo membership's effective, default and overridden practice capabilities; internal members only |
| `public.set_practice_capability_override`, `clear_practice_capability_override` | `publish_methodology` holders only, never on their own membership, serialized, last-holder guard        |

The engagement capability enum, tables and functions are unchanged. Engagement-side Phase 6 acts use existing capabilities: `edit_architecture` for applications, lineage, engagement contexts and proposing criteria; `publish_architecture` for changing an engagement's release, agreeing, superseding and withdrawing criteria and validation notes.

## Operations

| Function                                                                                                                                                                                                                                    | Gate                                | Notes                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `create_method_asset`, `update_method_asset`                                                                                                                                                                                                | `author_methodology`                | Creates the asset and draft v1; form changes only while the draft holds no form-specific content             |
| `create_method_asset_version`, `update_method_asset_version`, `delete_method_asset_version`                                                                                                                                                 | `author_methodology`                | One draft per asset; a new draft copies the published version and its children                               |
| `set_method_version_domains`, `_contexts`, `_stages`, `_outputs`, `_components`, `set_standard_version_criteria`, `set_standard_version_judged_in`, `set_instrument_version_evidence_types`, `set_template_version_spec`                    | `author_methodology`                | Draft only; form-checked                                                                                     |
| `attach_method_version_file`, `remove_method_version_file`                                                                                                                                                                                  | `author_methodology`                | Draft Template or Instrument; returns the object path                                                        |
| `method_version_publish_gaps`                                                                                                                                                                                                               | internal                            | What a draft still needs before publication                                                                  |
| `publish_method_asset_version`, `retire_method_asset_version`, `retire_method_asset`                                                                                                                                                        | `publish_methodology`               | Publication supersedes the prior version; retirement needs a reason                                          |
| `adopt_legacy_method_asset`                                                                                                                                                                                                                 | `publish_methodology`               | Gives a legacy asset its form and opens its first proper draft                                               |
| `set_method_asset_origin`, `record_method_rights_holder`, `supersede_method_rights_holder`                                                                                                                                                  | `publish_methodology`               | Origin change needs a reason; rights are append-only                                                         |
| `create_dam_release`, `update_dam_release`, `set_dam_release_member`, `remove_dam_release_member`, `delete_dam_release`                                                                                                                     | `author_methodology`                | Draft release only                                                                                           |
| `publish_dam_release`, `retire_dam_release`                                                                                                                                                                                                 | `publish_methodology`               | Publication freezes and writes the vocabulary record; retirement refused while engagements are on it         |
| `set_engagement_dam_release`                                                                                                                                                                                                                | `publish_architecture` (engagement) | To the published release only; reason logged                                                                 |
| `create_development_context`, `revise_development_context`, `retire_development_context`                                                                                                                                                    | `publish_methodology`               | Revisions append-only                                                                                        |
| `set_engagement_development_contexts`                                                                                                                                                                                                       | `edit_architecture` (engagement)    | One primary; newly added contexts must be active                                                             |
| `start_method_application`                                                                                                                                                                                                                  | `edit_architecture`                 | Current published Method version; reason; outside-release reason when needed; snapshots release and contexts |
| `update_method_application`, `set_method_application_practitioners`, `_contexts`, `_domains`, `set_method_application_stage_note`, `clear_method_application_stage_note`, `set_method_application_asset`, `remove_method_application_asset` | `edit_architecture`                 | Open applications only                                                                                       |
| `link_method_application_element`, `unlink_…`, `link_method_application_evidence`, `unlink_…`                                                                                                                                               | `edit_architecture`                 | Role and kind rules; same engagement                                                                         |
| `begin_method_application`, `complete_method_application`, `discontinue_method_application`                                                                                                                                                 | `edit_architecture`                 | Completion needs a statement and at least one link; closure captures links and freezes                       |
| `add_method_application_addendum`                                                                                                                                                                                                           | `edit_architecture`                 | Closed applications only                                                                                     |
| `add_method_version_learning_source`, `remove_method_version_learning_source`                                                                                                                                                               | `author_methodology`                | Draft version; closed application                                                                            |
| `propose_acceptance_criterion`, `update_acceptance_criterion`, `delete_acceptance_criterion`                                                                                                                                                | `edit_architecture`                 | Proposed only                                                                                                |
| `agree_acceptance_criterion`, `supersede_acceptance_criterion`, `withdraw_acceptance_criterion`                                                                                                                                             | `publish_architecture`              | Agreement needs a published governed element; supersession and withdrawal need a reason                      |
| `set_validation_criterion_note`                                                                                                                                                                                                             | `publish_architecture`              | Note only; no verdict                                                                                        |
| `record_review_validation` (Phase 5, extended)                                                                                                                                                                                              | `publish_architecture`              | Gate unchanged; also captures `criteria_in_force` into `validation_criteria`                                 |
| `record_method_lineage`, `remove_method_lineage`                                                                                                                                                                                            | `edit_architecture`                 | Current published version; form, role and kind checked; legacy rows not removable                            |
| `publish_element_version` (Phase 3, extended)                                                                                                                                                                                               | `publish_architecture`              | Refuses `methodology_derived` content without `instantiates` lineage to a Model version                      |

## Guard triggers

| Trigger function                               | On                                                                                      | Enforces                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `private.guard_method_asset`                   | `method_assets`                                                                         | Operations only; never deleted; permanent key; form fixed after the first proper publication          |
| `private.guard_method_asset_version`           | `method_asset_versions`                                                                 | Operations only; identity permanent; non-draft content frozen; only published → superseded or retired |
| `private.guard_method_version_child`           | every version child table, `method_version_contexts`, `method_version_learning_sources` | Operations only; draft versions only; content matches the form; a legacy version keeps only domains   |
| `private.guard_method_rights_holder`           | `method_asset_rights_holders`                                                           | Append-only; one supersession per row                                                                 |
| `private.guard_dam_release`                    | `dam_releases`                                                                          | Published releases frozen; allowed status moves only; only drafts deleted                             |
| `private.guard_dam_release_member`             | `dam_release_members`                                                                   | Members change only while the release is a draft                                                      |
| `private.sync_engagement_dam_release`          | `engagements`                                                                           | `methodology_version` follows the release; release changes only through `set_engagement_dam_release`  |
| `private.guard_development_context`            | `development_contexts`, `development_context_revisions`                                 | Operations only; never deleted; permanent key; retired contexts unchanged; revisions append-only      |
| `private.guard_engagement_development_context` | `engagement_development_contexts`                                                       | Operations only                                                                                       |
| `private.guard_method_application`             | `method_applications`                                                                   | Operations only; never deleted; pin permanent; closed applications frozen                             |
| `private.guard_method_application_child`       | every application child table                                                           | Open applications only; addenda append-only after closure; permits the D30 `element_id` clearing      |
| `private.guard_acceptance_criterion`           | `acceptance_criteria`                                                                   | Identity permanent; frozen once agreed; one closure; never deleted once agreed                        |
| `private.guard_validation_criterion`           | `validation_criteria`                                                                   | Inserted only by `record_review_validation`; never deleted; only the note changes                     |
| `private.guard_method_lineage`                 | `element_method_lineage`                                                                | Operations only; form, role and kind; pinned rows; `legacy_derived_from` backfill only                |

## Read models

| Function                                    | Returns                                                                                                                                                 | Access                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `method_library()`                          | Every asset with its current version, form, category, domains, contexts, release labels, draft flag and use counts                                      | internal                                                                   |
| `method_usage(asset)`                       | Per version: application and lineage counts across engagements and release labels; application and lineage rows only on engagements the caller can read | internal                                                                   |
| `method_application_register(engagement)`   | Applications with method, version, in-release flag, lead, dates and link counts                                                                         | internal (`security invoker`; RLS applies)                                 |
| `element_practice_context(element)`         | Applications linked to an element (role, code, state, method and version) and its typed lineage                                                         | internal (`security invoker`; RLS applies)                                 |
| `criteria_in_force(initiative)`             | Agreed criteria on the initiative and on the core objects it implements                                                                                 | internal architecture readers                                              |
| `method_version_publish_gaps(version)`      | What a draft version still needs before it can be published                                                                                             | internal                                                                   |
| `client_engagement_methodology(engagement)` | The engagement's release label and title                                                                                                                | anyone with access to the engagement                                       |
| `client_acceptance_criteria(engagement)`    | Agreed, client-visible criteria on elements the caller may read in client form, and the readable validations that captured them                         | client (`element_client_readable`, area limits apply) and internal readers |

## Client boundary

- No client, licensed-practice or anonymous session can select a row from any Method Library, release, context, application, criterion or lineage table, or any object in the `method-library` bucket. There is no client policy on any of them.
- The internal read models return nothing to a client.
- What a client can read about methodology is exactly:
  - the engagement's release label and title, through `client_engagement_methodology`;
  - agreed, client-visible acceptance criteria through `client_acceptance_criteria`: code, body, state, agreement date, the governed element's code and client-snapshot title, and the validations the client can already see that captured each criterion. Proposed criteria, the informing Standard, the agreement party and validation notes are never returned. Superseded or withdrawn criteria appear only when a readable validation captured them;
  - architect-authored `approach` statements, through the existing, unchanged client snapshot under ordinary statement visibility (ADR-0049).
- Nothing else. Clients can read `engagements.dam_release_id` through the existing engagement policy, but it resolves to no row. Client snapshots keep their pre-Phase 6 key sets and never contain lineage or any library field (ADR-0022).

## Storage: `method-library`

A private bucket for Template and Instrument files, separate from `engagement-files` so that method IP never shares a bucket whose policies grant client reads.

- Limit 25 MB per object; PDF, plain text, CSV, Word, Excel and PowerPoint (`.pptx`) types only.
- Object path `{version_id}/{file_id}/{file_name}`. `attach_method_version_file` registers the file in `method_version_files` on a draft Template or Instrument version and returns the path.
- **Read:** internal members, for registered objects only (`private.can_read_method_file`).
- **Upload:** the author who registered the path, holding `author_methodology`, while the version is a draft (`private.can_upload_method_file`).
- **Delete:** an `author_methodology` holder may remove an object whose registration has been removed from a draft version (`private.can_remove_method_file`). Registered objects of a published version cannot be removed.
- Files are not copied into a new draft; a draft with registered files cannot be deleted until they are removed.

## Tests

| Suite                                | Covers                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `21_method_library.test.sql`         | Forms and publish requirements, version immutability, supersession and disposable drafts, retirement, origin and append-only rights, protected files, DAM releases and the vocabulary record, engagement release moves, Development Contexts and declared applicability, client denial                                                                 |
| `22_method_applications.test.sql`    | Start rules (Method only, published only, reason outside the release), release and context snapshots, role and kind rules, cross-engagement refusal, closure and `observed_version_id`, freeze and addenda, `MUS` codes, captured identity after draft deletion (open and closed), continuation, learning sources, client and Contributor denial       |
| `23_method_client_boundary.test.sql` | No client or anonymous row or object from any Phase 6 table; internal read models empty for clients; release label and title only; criteria through the client read model, including Contributor area limits; approach statements under statement rules; snapshot key sets unchanged                                                                   |
| `24_practice_capabilities.test.sql`  | Defaults per role, no System Administrator authority by default, client and multi-organization client users never qualify, defaults and overrides writable only through migrations and operations, administration by `publish_methodology` holders only, no self-override, reasons and logging, clearing an override, authority moving between holders |
| `25_method_backfill.test.sql`        | The legacy conversion and adoption; the Strategic Model Library Index unchanged                                                                                                                                                                                                                                                                        |
| `26_acceptance_criteria.test.sql`    | Lifecycle and immutability after agreement, agreement on published elements only, supersession history, capture in `record_review_validation` with the ADR-0036 gate unchanged, captures surviving supersession, visibility                                                                                                                            |
| `27_method_lineage.test.sql`         | Form, role and kind; current published proper versions only; legacy rows as history; writes through operations only; client denial; the `methodology_derived` publish check                                                                                                                                                                            |
| `28_method_demo_seed.test.sql`       | The seed's Phase 6 demo is what it claims, and clients see only the release line and agreed criteria                                                                                                                                                                                                                                                   |
| `99_method_concurrency.test.sql`     | Two real sessions: concurrent publication of one draft, release publication during a member edit, concurrent `MUS` allocation, concurrent agree and supersede of one criterion                                                                                                                                                                         |

`supabase/tests/support/phase6_pristine.psql` is not a test. Suites 21, 22, 23, 25 and 26 include it (`\ir`) right after `begin`, so they run against the library as the migrations and the pre-demo seed leave it: DAM 1.0 from the backfill, both pre-Phase 6 assets legacy, the anchor-led Model 1.0 with its lineage, and no contexts, applications or criteria. It removes the seed's Phase 6 demo inside the suite's own rolled-back transaction. Suite 28 tests the demo itself.

Vitest: `src/domain/methodology/catalog.test.ts` checks the TypeScript mirrors of the Phase 6 enums against the migrations, and `approach.test.ts` covers the approach-statement authoring guidance.

## Seed data note

The Phase 6 demo in `supabase/seed.sql` is clearly fictional and is built through the same operations the application uses, as the people who would perform them. It adds four Development Contexts; adopts the legacy _Capability Readiness Diagnostic_ as a Method (1.0 and 1.1 published, a 1.2 draft citing the Harbor application as a learning source); an Instrument, a Standard and a Template; DAM 1.1 published and a DAM 1.2 draft; a completed Diagnostic application on Harbor and an in-progress one on Meridian, outside Meridian's DAM 1.0 release; and two agreed acceptance criteria on a Harbor initiative, one informed by the demo Standard. The anchor-led cluster development Model 1.0 and its `instantiates` lineage are created earlier, with the Meridian architecture. No new elements are created, so earlier suites' counts are unaffected.
