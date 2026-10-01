-- =============================================================================
-- Phase 7B.1: Architecture Intelligence Foundation. Migration 1 of 7.
-- Two permanent engagement capabilities (OD-1, OD-2; B-10).
--
-- An enum value must be committed before it can be used, so the values are
-- added in their own migration. Defaults, sides and override authority are
-- in 20261007000100_architecture_intelligence_capabilities.sql.
--
--   use_architecture_intelligence      may invoke Architecture Intelligence
--                                      on this engagement. Never implied by
--                                      reading or editing Architecture.
--   authorize_external_ai_processing   may record the engagement's external
--                                      processing authorization (B-1).
--
-- See docs/product/PHASE_7B_1_PROPOSAL.md §5, §7 and ADR-0061.
-- =============================================================================

alter type public.engagement_capability add value 'use_architecture_intelligence';
alter type public.engagement_capability add value 'authorize_external_ai_processing';
