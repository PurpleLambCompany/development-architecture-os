-- =============================================================================
-- DSA OS — V1-A Workstream A: the administer_practice practice capability
-- (decision D1).
--
-- An enum value must be committed before it can be used, so it is added in
-- its own migration. Everything that uses it follows in
-- 20261009000100_v1a_practice_administration.sql. See
-- docs/product/V1_A_WORKFLOW_CLOSURE_PROPOSAL.md §3 and §4 (A1-A7) and
-- ADR-0074.
-- =============================================================================

alter type public.practice_capability add value 'administer_practice';
