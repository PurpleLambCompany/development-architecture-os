-- =============================================================================
-- DSA OS — Phase 5: enum values for Reviews, Deliverables and Implementation.
--
-- An enum value must be committed before it can be used, so the values are
-- added in their own migration. Everything that uses them is in
-- 20261003000100_reviews_deliverables_implementation.sql. See
-- docs/product/PHASE_5_PROPOSAL.md §10.1, §22 (D1-D16).
-- =============================================================================

alter type public.element_kind add value 'review';
alter type public.element_kind add value 'deliverable';
alter type public.element_kind add value 'implementation_initiative';

-- Reviews (proposal §5).
create type public.review_type as enum ('executive_review', 'architecture_review');
create type public.review_status as enum ('scheduled', 'held', 'cancelled');
create type public.review_participant_role as enum ('organizer', 'reviewer', 'presenter', 'attendee');

-- Deliverables (proposal §6, §4.3).
create type public.deliverable_type as enum (
  'full_architecture_blueprint', 'executive_strategy_deck', 'capability_map',
  'implementation_framework', 'measurement_model', 'executive_summary', 'other'
);

-- Implementation (proposal §7.2). validated and abandoned are terminal;
-- enforced in application logic and resolve_implementation_initiative, not
-- by the enum itself.
create type public.implementation_status as enum (
  'not_started', 'in_progress', 'operational', 'validated', 'stalled', 'abandoned'
);

-- Implementation Checkpoints (proposal §7.6, §4.3).
create type public.implementation_checkpoint_type as enum (
  'design_approved', 'agreement_executed', 'operational_entry', 'scheduled_review', 'other'
);

alter type public.engagement_file_purpose add value 'deliverable';

alter type public.engagement_capability add value 'manage_reviews';
alter type public.engagement_capability add value 'manage_deliverables';
alter type public.engagement_capability add value 'manage_implementation';
