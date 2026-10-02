# ADR-0044: Capabilities are scoped by membership: the practice scope and `publish_methodology`

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decisions D10 and D11. This record resolves the tension between spec §4 and ADR-0024.

- Spec §4 gives System Administrators "manage methodology/IP library". ADR-0024 deliberately withholds architecture authority from System Administrators, and the Phase 1 `method_assets` write policy ("managed by administrators and principals") checked role names, which predates ADR-0008.
- Authoring and publishing methodology are TPLCo-wide authorities. There is no engagement to hold them on, and every existing capability (`engagement_capability`, ADR-0008) is held through an engagement membership.
- Adding the two values to `engagement_capability` was assessed and rejected. It would need nullable engagement semantics on the override table (or a second table anyway), explicit refusals in `has_engagement_capability`, filtering in `my_engagement_capabilities` and in the application's capability matrix, and permanent non-engagement values in an engagement-named enum.

## Decision

**The rule.** A capability is always held through a membership, and its scope is the scope of that membership. An engagement membership (`engagement_members`) carries engagement capabilities. An active internal membership of the TPLCo organization (`organization_members`) carries practice capabilities. Both scopes have the same three parts: role defaults as migration-only reference data, per-membership overrides with `granted` and a reason, and one private check function.

**The practice scope** (migration `20261005000100_practice_capabilities.sql`):

| Part               | Engagement scope (unchanged)                  | Practice scope                                                                                                |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Capability enum    | `engagement_capability`                       | `practice_capability`: `author_methodology`, `publish_methodology`                                            |
| Role defaults      | `role_capability_defaults`                    | `practice_role_capability_defaults`; a check allows internal roles only                                       |
| Holding membership | `engagement_members`                          | an active internal `organization_members` row in the `tplco` organization                                     |
| Overrides          | `engagement_member_capability_overrides`      | `practice_member_capability_overrides` (`organization_member_id`, `capability`, `granted`, `reason`), audited |
| Check              | `private.has_engagement_capability(eng, cap)` | `private.has_practice_capability(cap)`, `private.require_practice_capability(cap)`                            |
| Caller's list      | `public.my_engagement_capabilities(eng)`      | `public.my_practice_capabilities()`                                                                           |
| Settings view      | engagement capability matrix                  | `public.practice_capability_matrix()`, internal members only                                                  |

- `private.prepare_practice_override` refuses an override on any membership that is not an internal membership of the TPLCo organization, so client and licensed-practice users never qualify.
- `private.has_practice_capability` requires an active profile, an active TPLCo organization and an active internal membership (`private.current_tplco_membership`); an override wins over the role default.

**Defaults (D11).**

| Practice capability   | Principal Architect | Architect | Researcher | System Administrator | Project / Finance Administrator | Client roles |
| --------------------- | :-----------------: | :-------: | :--------: | :------------------: | :-----------------------------: | :----------: |
| `author_methodology`  |          ✓          |     ✓     |     —      |          —           |                —                |    never     |
| `publish_methodology` |          ✓          |     —     |     —      |          —           |                —                |    never     |

Reading the library remains every internal member's right (`private.is_internal()`).

**Administration is capability-based (D11).** `set_practice_capability_override` and `clear_practice_capability_override` require the caller to hold `publish_methodology`, refuse any change to the caller's own membership (`42501`), take one advisory lock so concurrent changes serialize, and refuse (`23514`) any change that would leave no effective `publish_methodology` holder (`private.assert_publish_methodology_remains`). There is no role-name check. The Phase 1 role-name policy on `method_assets` is dropped.

**Which authority each act needs.**

- `author_methodology`: create and edit assets and draft versions, their content, components, contexts, files and learning sources; create and edit draft DAM releases.
- `publish_methodology`: publish and retire versions and assets; adopt legacy assets; set origin and record or supersede rights; publish and retire DAM releases; create, revise and retire Development Contexts; administer practice overrides.
- No new engagement capability is added. Method Applications, typed lineage, engagement Development Contexts and proposing acceptance criteria use `edit_architecture`. Changing an engagement's DAM release, agreeing, superseding and withdrawing acceptance criteria, and writing a validation note use `publish_architecture`. Reading follows `can_read_architecture`.

## Consequences

- Spec §4 is resolved in ADR-0024's favor. A System Administrator holds methodological authority only through an explicit, logged override granted by a `publish_methodology` holder.
- The engagement capability enum, tables, functions, application mirror and suite 03 are unchanged.
- Any later TPLCo-wide authority, such as Pattern Library curation or licensing administration, adds a `practice_capability` value rather than an engagement capability or a third mechanism.
- The role-based portfolio financial exception (`has_portfolio_financial_access`) is left as it is.

**Amended (V1-A Increment 2):** `administer_practice` is added as a practice capability, administered by its own holders rather than by `publish_methodology`. See [ADR-0074](0074-practice-administration-and-architectural-authority.md).
