# ADR-0048: Method origin and rights are recorded, not decided

**Status:** Accepted (Phase 6; approved 2026-09-30)

## Context

Phase 6 proposal (Revision 2), decision D23.

TPLCo owns its methodology by default, but some methodology will be co-developed with clients, owned by a client, licensed in, or drawn from third parties. Licensing and certification (Phase 9) and any later learning across engagements need to know which is which, and origin is hard to reconstruct after the fact. The existing `ip_classification` answers a different question: how content must be handled, not who owns it and on what terms.

## Decision

**Origin.** `method_assets.origin` (`method_asset_origin`: `tplco_developed`, `co_developed`, `client_owned`, `licensed_in`, `third_party`) defaults to `tplco_developed` and is set when an asset is created. It changes only through `set_method_asset_origin(asset, origin, reason)` (`publish_methodology`), which logs the change and the reason as `origin_changed`.

**Rights holders, append-only.** `method_asset_rights_holders` records each holder of an asset:

- exactly one of `organization_id` (an organization in DSA OS, including a licensed-practice organization) or `external_holder_name`;
- `holder_role` (`method_rights_role`: `owner`, `co_owner`, `licensor`, `contributor`), `agreement_reference`, `effective_on`, `note`, `recorded_by`, `recorded_at`.

`record_method_rights_holder` and `supersede_method_rights_holder` require `publish_methodology`. A correction marks the prior row superseded, once, with a reason, and optionally records the replacement row in the same call. `private.guard_method_rights_holder` refuses every other update and every deletion.

**Usage restriction.** `method_assets.usage_restriction` is optional text, for example "May be used only in engagements with the co-developing client". It is advisory and is not enforced by the database.

**Handling classification.** `method_assets.ip_classification` keeps the existing enum, default `tplco_method_ip`. No value is added. A co-developed method is still handled as protected method IP.

**Version provenance.** Each version records `authored_by`, `derived_from_version_id`, `external_basis`, `change_summary`, `published_by`, `published_at` and its learning sources (ADR-0043).

**Access.** Origin and rights are internal only, like every library table. A client that co-owns an asset gains no access to it or to its rights records.

## Consequences

- The origin values and rights roles are permanent enum values; the rights history can only grow.
- Phase 9 licensing can build on recorded rights, and later learning can exclude or segregate client-owned and licensed-in methodology.
- The system records rights and never decides them. Phase 6 builds no licensing, royalty, entitlement, licensee-account, certification or contract-management logic, and nothing checks a usage restriction.
