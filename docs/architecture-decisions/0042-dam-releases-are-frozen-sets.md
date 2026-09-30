# ADR-0042: DAM releases are frozen sets of asset versions; no DAM phases

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decisions D7, D8 and D22.

Spec §20 asks each engagement to record "the methodology version used" and speaks of "DAM 1.0 / 1.1 / 2.0". Before Phase 6 that was free text on `engagements.methodology_version`, pinned to nothing, while each Method Asset carried its own unrelated version text. Asset versions (ADR-0041) and versions of the methodology as a whole are two different levels. Licensing, certification and audit will need to say exactly what "DAM 1.1" contained, and the spec's "impacted engagements" needs a query, not a reading of prose.

Spec §4 and §10 also hint at a phased DAM engagement sequence ("runs diagnostics", "Diagnostic Completion"). Kerrick's Q9 decision was not to formalize one.

## Decision

**A release is a frozen set of exact asset versions (D7).**

- `dam_releases` holds a numeric `version_label` (for example `1.1`, unique), a `title` (_Development Architecture Method™ 1.1_), a status (`draft`, `published`, `superseded`, `retired`), summaries, `effective_on`, `supersedes_release_id` and a `vocabulary_record`.
- `dam_release_members` has primary key (`release_id`, `asset_id`), so a release holds at most one version of each asset, and a composite foreign key ties the version to its asset.
- A member is a proper (non-legacy) version that has been published (`published` or `superseded`) of an `active` asset. A release may therefore pin an older version of an asset.
- There is at most one draft release (`create_dam_release` refuses a second) and at most one published release (`dam_releases_one_published`). A new draft starts with the members of the current published release that are still eligible.
- Membership changes only while the release is a draft, through `set_dam_release_member`, `remove_dam_release_member`, `update_dam_release` and `delete_dam_release` (`author_methodology`).
- `publish_dam_release` (`publish_methodology`) requires a change summary, at least one member, no member that has since been retired, and a label greater than every published or superseded release. It marks the previous published release `superseded` and freezes the new one.
- `private.guard_dam_release` refuses any change to a non-draft release other than `published` → `superseded` or `retired` and `superseded` → `retired`; only drafts are deleted. `private.guard_dam_release_member` refuses any member change on a non-draft release. Both raise `23514`; writes outside an operation raise `42501`.
- `retire_dam_release` (`publish_methodology`, reason required) refuses while any `proposed`, `active` or `paused` engagement is conducted under the release.

**Engagements are conducted under a release.**

- `engagements.dam_release_id` references the release. `engagements.methodology_version` stays, because every element and element version copies it (ADR-0013). The trigger `private.sync_engagement_dam_release` keeps it equal to `'DAM ' || version_label`, refuses direct changes to either column, and starts a new engagement on the release its methodology text names or else on the current published release.
- `set_engagement_dam_release(engagement, release, reason)` moves an engagement to the current published release. It requires `publish_architecture` on the engagement, because it is an engagement governance act and not a methodology-publication act, and logs `dam_release_changed` with the reason. Method Applications keep the release they recorded at start (ADR-0043).

**Backfill.** Migration `20261005000400_dam_releases_contexts.sql` publishes release `1.0` (_Development Architecture Method™ 1.0_) containing every legacy version (ADR-0041), and sets every engagement whose `methodology_version` is `DAM 1.0` to it. Any other engagement is left without a release and reported by a migration notice. Legacy assets described later through `private.insert_legacy_method_asset` join release 1.0 the same way.

**No DAM phases (D8).** A release defines no engagement sequence, phase list or required outputs. `current_phase` stays ungoverned free text. A diagnostic is a Method (ADR-0041), and milestone names such as "Diagnostic Completion" remain commercial labels.

**Vocabulary is documented, never governed.** At publication `private.architecture_vocabulary_record()` writes the domains, element kinds, object types (key, domain, label) and relationship types (key, label) in force into `vocabulary_record`. No Phase 6 operation writes to `architecture_object_types`, `relationship_types` or `relationship_rules` (ADR-0016 amendment).

**The release label is client-visible (D22).** There is no client policy on `dam_releases` or `dam_release_members`. A client reads the label and title of their engagement's release, and nothing else, through `public.client_engagement_methodology(engagement)`. Clients can read `engagements.dam_release_id` through the existing engagement policy, but the id resolves to no row for them.

## Consequences

- A release is reproducible forever: its members are pinned versions and versions are immutable (ADR-0041). Release diffs and the engagements on a release are queries.
- Immutability is hard to relax once relied on. Correcting a release means publishing the next one.
- Engagements stay on their release until someone with `publish_architecture` moves them, with a reason. Nothing migrates engagements automatically.
- Releases do not license or certify anything; that is Phase 9. A phased method can be added later as a Method without undoing anything here.
