# ADR-0041: Method Assets: five forms, identity, immutable versions and legacy assets

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decisions D1–D6, D28 and D29.

The Phase 1 `method_assets` table was a stub: one flat row per asset with free-text `category`, `version`, `methodology_domain` and `description`, and a write policy that checked role names. Spec §26 sketched the same flat shape. It cannot hold immutable published content, form-specific structure or version-pinned use, and it gave the two seeded assets the release label `DAM 1.0` as their asset version.

Methodology must behave like the architecture it acts on: what has been used is never edited in place (ADR-0014, ADR-0021). The library also has to say what kind of thing each asset is, because the system does something different with each kind.

## Decision

**Identity and content are split (D5).**

- `method_assets` is the identity: a permanent `key` slug, `title`, `form`, `category_key`, `origin` (ADR-0048), `usage_restriction`, `ip_classification` (default `tplco_method_ip`), `status` (`active`, `retired`, `legacy`), `current_version_id` and `steward_user_id` (renamed from `owner_user_id` to avoid confusion with IP ownership).
- `method_asset_versions` holds the content. Each version has a monotonic `version_no`, a `version_label` chosen at publication and unique per asset, a lifecycle, the common fields (architectural question, summary, applicability, exclusions, practitioner instructions, change summary, provenance fields) and the Method-only fields (prerequisites, roles, completion criteria, an optional cited Standard version, review and implementation implications, modes).
- The key never changes. The form never changes once a proper version has been published (`private.guard_method_asset`). Assets are retired, never deleted.

**Five forms, each with enforced behavior (D1, D2).** `method_asset_form` has exactly five permanent values:

| Form         | Verb           | Form-specific structure                                                        | What only this form can do                                                 |
| ------------ | -------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `method`     | performed      | `method_version_stages`, modes, `method_version_outputs`, components, criteria | Be the subject of a Method Application (ADR-0043)                          |
| `model`      | applied        | `method_version_outputs`, restricted to object types                           | Be instantiated into a core object (`instantiates` lineage, ADR-0047)      |
| `standard`   | judged against | `standard_version_criteria`, `standard_version_judged_in`                      | Be judged against, cited by a Method, or inform an acceptance criterion    |
| `instrument` | used within    | `instrument_version_evidence_types`, protected file                            | Be named as the Instrument that gathered evidence in a Method Application  |
| `template`   | produced from  | `template_version_specs` (deliverable type), `template_version_sections`, file | Be what a Deliverable is produced from (`produced_from` lineage, ADR-0047) |

- `private.method_child_forms` and the `private.guard_method_version_child` trigger refuse child rows that do not belong to the asset's form. Domains, Development Contexts (ADR-0045) and learning sources belong to every form.
- `private.method_version_publish_gaps` (exposed read-only as `public.method_version_publish_gaps`) states what a draft still needs. Every form needs an architectural question, applicability and a change summary. A Method needs at least one stage, one mode, one expected output and completion criteria. A Model needs at least one object type it is applied into. A Standard needs at least one criterion and a setting where it is judged. An Instrument needs the evidence types it gathers and usage guidance. A Template needs its deliverable type and a section outline. Components and a cited Standard must still be current.
- A Method may declare components (`method_version_components`): exact published versions of other forms that it normally uses, pinned at publication. A Method is never a component.

**Categories are description, never behavior (D4).** `method_asset_categories` is migration-managed reference data with twelve keys taken from spec §14, less the two pattern categories and AI prompts (ADR-0050). A category is independent of form.

**Domains (D3).** A version declares zero or more architecture domains in `method_version_domains`. Zero means domain-neutral. The singular `methodology_domain` column is dropped.

**Lifecycle and immutability (D6).**

- A version is `draft`, `published`, `superseded` or `retired`. Partial unique indexes allow at most one draft and at most one published version per asset.
- `publish_method_asset_version` (`publish_methodology`) checks the publish gaps and label uniqueness, marks the previous published version `superseded`, and sets `current_version_id`. Publication is irreversible; a correction, even a typographic one, is a new version.
- `retire_method_asset_version` and `retire_method_asset` (`publish_methodology`) require a reason. An asset with an open draft cannot be retired.
- `private.guard_method_asset_version` refuses any change to a non-draft version other than its lifecycle transition and retirement fields, and refuses deleting one. `private.guard_method_version_child` refuses any change to a child row of a non-draft version. Both raise `23514`.
- Every write goes through a `security definer` operation that sets the methodology operation marker (`private.begin_methodology_operation`). `authenticated` has no write grant on any library table, and the guard triggers refuse any write made outside an operation with `42501`.
- Drafts are working material. `create_method_asset_version` (`author_methodology`) copies the published version (or else the latest retired proper version) with its children, sets `derived_from_version_id`, carries forward only components that are still published and does not copy files. `delete_method_asset_version` removes a draft.

**Standards (D29).** A Standard version holds ordered criteria (`key`, `statement`, optional `guidance` and `scale`) and the settings where it is judged (`review`, `completion`, `assessment`). It never computes a verdict (ADR-0036). It is used by citation (`completion_standard_version_id` on a Method), as a component, through `judged_against` lineage (ADR-0047) and as the internal informing source of an engagement acceptance criterion (ADR-0046). No Standard is created by a migration; `supabase/seed.sql` holds one demonstration Standard.

**Legacy assets (D28).** Migration `20261005000300_method_library_legacy.sql` converts every pre-Phase 6 asset without inferring a form or renaming it:

- the asset becomes `legacy` (a `retired` asset stays `retired`), with a key derived from its title and a category mapped from its old text, or `other`;
- it gains one legacy version (`legacy = true`), frozen as `published`, labelled with the original version text, carrying the original description as its summary and its original domain;
- the old content columns are dropped, and `method_assets_form_required` allows a null form only for a `legacy` or `retired` asset.

A legacy version is refused by `private.require_usable_method_version`: it cannot be applied, instantiated, used as a component, cited or added to a new release. It is valid only as the target of `legacy_derived_from` lineage (ADR-0047) and as a member of the backfilled DAM 1.0 release (ADR-0042). `adopt_legacy_method_asset(asset, form, category)` (`publish_methodology`) gives a legacy asset its form, makes it `active`, and opens its first proper draft derived from the legacy version. The legacy version stays published until that draft is published and supersedes it. An asset that is never adopted, such as the Strategic Model Library Index, stays legacy with its name and meaning intact. There is no `index` form.

## Consequences

- The five form values are permanent. A sixth form would need a new enum value and new behavior rules.
- Every use of methodology pins a version id, and the content behind the pin cannot move. Change summaries, `derived_from_version_id` and learning sources explain why content changed between versions.
- Even a typographic fix is a new version. This is deliberate.
- TPLCo authors its real Standards and adopts or retires the legacy assets after build. Nothing methodological is invented by migration.
- The library is not document management: every required field either drives behavior or is compared with recorded use, protected content is long-form text plus an optional file for Templates and Instruments, and there is no rich-document body, per-stage assignment, scoring logic or automated gating on prerequisites.
