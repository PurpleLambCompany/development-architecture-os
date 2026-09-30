-- =============================================================================
-- DSA OS — Phase 3: add the architecture capabilities.
--
-- An enum value must be committed before it can be used, so the values are
-- added in their own migration. Sides, role defaults, helpers and policies
-- that use them are in 20261001000100_architecture_core.sql. See ADR-0024 and
-- docs/product/PHASE_3_PROPOSAL.md §8.1.
-- =============================================================================

alter type public.engagement_capability add value 'edit_architecture';
alter type public.engagement_capability add value 'publish_architecture';
alter type public.engagement_capability add value 'view_architecture';
