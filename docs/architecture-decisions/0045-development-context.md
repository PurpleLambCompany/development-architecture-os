# ADR-0045: Development Context

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decisions D15 and D16.

Spec §14 asks for "applicable sectors" and §17 for "engagements by sector", but engagements carry no such field, and `engagement_type` is a commercial format. The kind of development environment in which work happens (a college building an institutional capability, a region growing an industry cluster, a district being planned, a community extending a service) is the condition that most determines whether a method fits, and the variable later learning most needs. TPLCo has not yet established a taxonomy of such contexts, so none can be invented in a migration.

## Decision

**A governed table, not an enum (D15).**

- `development_contexts` holds a permanent `key`, a `label`, a `definition` and a status (`active`, `retired`). Contexts are never deleted.
- `create_development_context`, `revise_development_context` and `retire_development_context` require `publish_methodology` (ADR-0044). A redefinition keeps the key and requires a reason; retirement requires a reason. Both append a row to `development_context_revisions` (prior label, prior definition, reason, who, when).
- `private.guard_development_context` refuses key changes, deletion, any change to a retired context and any update to a revision row.
- The migration creates the table empty. The four contexts in `supabase/seed.sql` are demonstration data; TPLCo's first real contexts are created in production by a `publish_methodology` holder.

**Placement and multiplicity (D16).**

- **Engagements.** `engagement_development_contexts` holds an engagement's contexts. `set_engagement_development_contexts(engagement, contexts, primary)` requires `edit_architecture` on the engagement and replaces the set. When the set is not empty, exactly one context is primary (partial unique index). A newly added context must be active; a retired context already on the engagement may stay.
- **Method Applications.** `start_method_application` copies the engagement's contexts into `method_application_contexts`. `set_method_application_contexts` adjusts the snapshot until closure, after which it is frozen with the application (ADR-0043). A later change to the engagement's contexts does not rewrite what applied at the time.
- **Asset versions.** `method_version_contexts` declares where a version applies; no rows means any context. `set_method_version_contexts` accepts only active contexts on a draft, the rows freeze with the version (ADR-0041), and a new draft carries forward the contexts that are still active.

**Internal only.** Every context table is readable only by internal members (`private.is_internal()`); engagement contexts additionally require `private.can_read_architecture`. No client read model returns a context. A Development Context is not an architecture element and is not related to elements; what the development is remains the architecture's job.

## Consequences

- Declared applicability, the engagement's contexts and each application's snapshot are three separate facts that later learning can compare.
- Keys are permanent once referenced. Labels and definitions can be revised, with history.
- TPLCo must define its first contexts before applications in production carry any.
- Contexts classify; they drive no behavior. Nothing filters, ranks or recommends methods by context in Phase 6.
