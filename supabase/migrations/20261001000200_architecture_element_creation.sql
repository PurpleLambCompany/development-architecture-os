-- =============================================================================
-- Phase 3 — creating an element in one transaction
--
-- Every element needs its subtype row (and a reference code) by commit: the
-- deferred integrity trigger refuses a bare spine row. An application talking
-- to PostgREST makes one transaction per request, so creation goes through
-- this function, which inserts the spine row, its subtype row and a record's
-- domains together.
--
-- SECURITY INVOKER on purpose: it runs with the caller's own column grants,
-- row-level security and guard triggers, exactly as if the caller had made
-- the inserts directly. It grants no authority of its own.
-- =============================================================================

create function public.create_architecture_element(
  p_engagement_id uuid,
  p_kind public.element_kind,
  p_element jsonb,
  p_details jsonb default '{}'::jsonb,
  p_domains public.architecture_domain[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  e public.architecture_elements;
  d jsonb := coalesce(p_details, '{}'::jsonb) || jsonb_build_object('element_id', new_id);
begin
  e := jsonb_populate_record(null::public.architecture_elements, coalesce(p_element, '{}'::jsonb));

  insert into public.architecture_elements (
    id, engagement_id, kind, title, summary, client_visibility, provenance, source_reference,
    ip_classification, engagement_wide, owner_user_id
  ) values (
    new_id, p_engagement_id, p_kind, e.title, coalesce(e.summary, ''),
    coalesce(e.client_visibility, 'internal'), coalesce(e.provenance, 'architect_judgment'),
    coalesce(e.source_reference, ''), coalesce(e.ip_classification, 'project_work_product'),
    coalesce(e.engagement_wide, false), e.owner_user_id
  );

  case p_kind
    when 'object' then
      insert into public.architecture_objects (element_id, object_type, maturity, maturity_rationale, attributes)
      select r.element_id, r.object_type, coalesce(r.maturity, 'undefined'), coalesce(r.maturity_rationale, ''),
             coalesce(d -> 'attributes', '{"schema_version": 1}'::jsonb)
      from jsonb_populate_record(null::public.architecture_objects, d) r;
    when 'assumption' then
      insert into public.assumptions (element_id, category, confidence, validation_status, impact_if_false, validation_note)
      select r.element_id, coalesce(r.category, ''), coalesce(r.confidence, 'medium'),
             coalesce(r.validation_status, 'unvalidated'), coalesce(r.impact_if_false, ''), coalesce(r.validation_note, '')
      from jsonb_populate_record(null::public.assumptions, d) r;
    when 'risk' then
      insert into public.risks (element_id, category, probability, impact, mitigation, risk_status)
      select r.element_id, coalesce(r.category, ''), coalesce(r.probability, 3), coalesce(r.impact, 3),
             coalesce(r.mitigation, ''), coalesce(r.risk_status, 'open')
      from jsonb_populate_record(null::public.risks, d - 'severity') r;
    when 'constraint' then
      insert into public.constraints (element_id, category, source, negotiable, constraint_status)
      select r.element_id, coalesce(r.category, 'other'), coalesce(r.source, ''), coalesce(r.negotiable, false),
             coalesce(r.constraint_status, 'in_force')
      from jsonb_populate_record(null::public.constraints, d) r;
    when 'dependency' then
      insert into public.dependencies (element_id, from_element_id, to_element_id, dependency_type, blocking, dependency_status)
      select r.element_id, r.from_element_id, r.to_element_id, coalesce(r.dependency_type, 'prerequisite'),
             coalesce(r.blocking, false), coalesce(r.dependency_status, 'open')
      from jsonb_populate_record(null::public.dependencies, d) r;
    when 'decision' then
      insert into public.decisions (element_id, context, decision_owner_user_id, needed_by, downstream_impact)
      select r.element_id, coalesce(r.context, ''), r.decision_owner_user_id, r.needed_by, coalesce(r.downstream_impact, '')
      from jsonb_populate_record(null::public.decisions, d) r;
    when 'recommendation' then
      insert into public.recommendations (element_id, rationale, priority)
      select r.element_id, coalesce(r.rationale, ''), coalesce(r.priority, 'important')
      from jsonb_populate_record(null::public.recommendations, d) r;
  end case;

  if p_kind <> 'object' then
    insert into public.intelligence_record_domains (element_id, domain)
    select new_id, x from (select distinct unnest(coalesce(p_domains, '{}')) as x) s;
  elsif coalesce(array_length(p_domains, 1), 0) > 0 then
    raise exception 'A core object belongs to its type''s domain; domains apply only to Project Intelligence records'
      using errcode = '23514';
  end if;

  return new_id;
end;
$$;

revoke all on function public.create_architecture_element(uuid, public.element_kind, jsonb, jsonb, public.architecture_domain[])
  from public, anon;
grant execute on function public.create_architecture_element(uuid, public.element_kind, jsonb, jsonb, public.architecture_domain[])
  to authenticated;

comment on function public.create_architecture_element(uuid, public.element_kind, jsonb, jsonb, public.architecture_domain[]) is
  'Creates an element, its subtype row and (for records) its domains in one transaction. Security invoker: the caller''s grants, RLS and guards apply.';
