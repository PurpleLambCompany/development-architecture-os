-- =============================================================================
-- Phase 7B.2: Architecture Intelligence Experience. Migration 8 of 8. Defect fix found in
-- browser acceptance, approved by Kerrick on 2026-10-01: impact_trace timed
-- out for an Architect.
--
-- impact_trace (7A, ADR-0055) was security invoker, so every row of the
-- twenty tables it reads re-ran that table's RLS policy. On the seed's
-- Meridian engagement one call took about 4.5 seconds for a Principal
-- Architect and about 9 seconds for an Architect (whose policies resolve an
-- engagement role per row), past the 8-second statement timeout for
-- signed-in users, so the element page failed for Architects. The same call
-- takes about 20 ms without per-row policies.
--
-- The function now runs as its owner. Access is unchanged: the start
-- element is read only when private.can_read_architecture holds for its
-- engagement, and every other row the walk reads is joined to that start
-- (its engagement, an element reached from it, or a record on one). For a
-- reader who can read the engagement's architecture, every policy on those
-- tables already reduces to can_read_architecture of the row's engagement,
-- so the function returns exactly what the invoker version returned to that
-- reader, and nothing to anyone else, clients included. The body, the
-- semantics and the grants are unchanged; 32_impact_trace and
-- 51_impact_trace_definer prove it.
-- =============================================================================

alter function public.impact_trace(uuid, text) security definer;

comment on function public.impact_trace(uuid, text) is
  'Authoritative impact semantics (OD-8, ADR-0055): the governed matrix, four depth-2 walks, terminal hops. Modes on_demand and edge. Security definer since 7B.2 (performance only, ADR-0055 amendment): reads only when can_read_architecture holds for the start element''s engagement.';
