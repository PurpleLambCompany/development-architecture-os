-- =============================================================================
-- Phase 7B.2: Architecture Intelligence Experience. Migration 1 of 9.
-- The request audit's vocabulary for 7B.2 (IX-15, PD-20; proposal §17, §27;
-- ADR-0066 amendment, ADR-0071).
--
-- `nothing_to_add` is a new outcome in the closed set: the model answered,
-- validly, that DSA's records do not support an interpretation. It carries
-- tokens and cost like any model call, and never an inference.
--
-- `interpret_again` records that a person deliberately asked again where a
-- kept interpretation was reused or suppressed (IX-13, IX-14). It is a flag
-- on the request, not an outcome. The recording operation's allowlist is
-- extended in migration 2, which replaces the operation once.
-- =============================================================================

alter table public.architecture_intelligence_requests
  drop constraint architecture_intelligence_requests_outcome_check;
alter table public.architecture_intelligence_requests
  add constraint architecture_intelligence_requests_outcome_check check (outcome in (
    'persisted', 'returned', 'nothing_to_add', 'refused_mode', 'refused_capability', 'refused_authorization',
    'refused_class', 'refused_budget', 'subject_not_found', 'provider_error', 'refusal', 'invalid_output',
    'unknown_citation', 'model_not_evaluated', 'authorization_withdrawn'));

alter table public.architecture_intelligence_requests
  add column interpret_again boolean not null default false;

comment on column public.architecture_intelligence_requests.interpret_again is
  'True when a person deliberately asked again where a kept interpretation was shown or suppressed (ADR-0070).';
