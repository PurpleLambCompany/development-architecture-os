-- =============================================================================
-- DSA OS — Phase 6: enum values for the Method Library.
--
-- An enum value must be committed before it can be used, so the values are
-- added in their own migration. Everything that uses them follows in the
-- 20261005* migrations. See docs/product/PHASE_6_PROPOSAL.md §23 and §36
-- (approved 2026-09-30, Revision 2, D1-D34).
-- =============================================================================

-- Method Assets (D1, D6): five forms, each with enforced behavior.
create type public.method_asset_form as enum ('method', 'model', 'standard', 'instrument', 'template');
create type public.method_asset_version_lifecycle as enum ('draft', 'published', 'superseded', 'retired');
create type public.method_identity_disclosure as enum ('internal_only', 'may_be_named');

-- Rights and origin are recorded, never decided (D23).
create type public.method_asset_origin as enum (
  'tplco_developed', 'co_developed', 'client_owned', 'licensed_in', 'third_party'
);
create type public.method_rights_role as enum ('owner', 'co_owner', 'licensor', 'contributor');

-- DAM releases (D7).
create type public.dam_release_status as enum ('draft', 'published', 'superseded', 'retired');

-- Method Applications (D14, D17).
create type public.method_application_state as enum ('planned', 'in_progress', 'completed', 'discontinued');
create type public.method_application_element_role as enum ('examined', 'produced', 'revised', 'informed');
create type public.method_application_evidence_role as enum ('drew_on', 'gathered');
create type public.method_stage_treatment as enum ('followed', 'adapted', 'skipped');

-- Typed, version-pinned element lineage (D18).
create type public.method_lineage_role as enum (
  'instantiates', 'produced_from', 'judged_against', 'legacy_derived_from'
);

-- Practice capabilities: held through TPLCo organization membership (D10, D11).
create type public.practice_capability as enum ('author_methodology', 'publish_methodology');

-- Engagement acceptance criteria (D20).
create type public.acceptance_criterion_state as enum ('proposed', 'agreed', 'superseded', 'withdrawn');

-- Authored, client-visible description of how work was approached (D21).
alter type public.statement_kind add value 'approach';
