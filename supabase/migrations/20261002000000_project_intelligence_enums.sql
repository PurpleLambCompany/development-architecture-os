-- =============================================================================
-- DSA OS — Phase 4: enum values for Project Intelligence.
--
-- An enum value must be committed before it can be used, so the values are
-- added in their own migration. Everything that uses them is in
-- 20261002000100_project_intelligence.sql. See ADR-0026, ADR-0028, ADR-0031
-- and docs/product/PHASE_4_PROPOSAL.md §6.1.
-- =============================================================================

alter type public.element_kind add value 'opportunity';
alter type public.risk_status add value 'materialized';

alter type public.engagement_capability add value 'manage_client_requests';
alter type public.engagement_capability add value 'view_full_architecture';
alter type public.engagement_capability add value 'respond_to_client_actions';
alter type public.engagement_capability add value 'assign_client_actions';
alter type public.engagement_capability add value 'submit_client_input';
