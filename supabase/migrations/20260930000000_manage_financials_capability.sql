-- =============================================================================
-- DSA OS — Phase 2: add the internal manage_financials capability.
--
-- An enum value must be committed before it can be used, so it is added in
-- its own migration. Defaults, helpers and policies that use it are in
-- 20260930000100_commercial_engagement.sql. See docs/product/PHASE_2_PROPOSAL.md.
-- =============================================================================

alter type public.engagement_capability add value 'manage_financials';
