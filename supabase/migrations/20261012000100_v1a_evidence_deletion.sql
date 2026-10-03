-- =============================================================================
-- V1-A Increment 6 (Workstream F, decision D10): evidence-source deletion.
--
-- The database already refuses to delete a cited evidence source: every
-- reference to one (statement_evidence_links, element_evidence_links,
-- method_application_evidence, acceptance_criteria.agreement_evidence_source_id,
-- implementation_checkpoints.achieved_evidence_source_id,
-- client_action_responses.evidence_source_id,
-- client_contributions.evidence_source_id, and
-- engagement_files.evidence_source_id for an attached file) is declared
-- `on delete restrict`. A plain `delete from evidence_sources` for a cited
-- source already fails; what is missing is (a) a readable refusal naming
-- what cites it, instead of a raw foreign-key error, and (b) cleanup of an
-- UNCITED source's own attached file, if it has one, so deleting it does
-- not either leave an orphaned storage row or get blocked by that same
-- restrict constraint. public.delete_evidence_source is function-only:
-- no new table, no new column, no change to the existing restrict rule.
--
-- "Cited" means an actual citation: a statement_evidence_links or
-- element_evidence_links row, a method application's use of the source as
-- evidence, an acceptance criterion's agreement evidence, an
-- implementation checkpoint's achieved evidence, a client action response
-- recorded as evidence, or a client contribution recorded as evidence. An
-- attached engagement_files row (the source's own uploaded material, e.g.
-- a client's document recorded as evidence) is not a citation; when the
-- source is otherwise uncited, this function deletes that file's row and
-- returns its object_path so the caller removes the stored object from
-- the bucket, same pattern as public.remove_method_version_file.
-- =============================================================================

create function public.delete_evidence_source(p_source_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  src public.evidence_sources;
  statement_count int;
  element_count int;
  method_count int;
  criterion_count int;
  checkpoint_count int;
  action_response_count int;
  contribution_count int;
  statement_codes text;
  element_codes text;
  method_codes text;
  criterion_codes text;
  checkpoint_codes text;
  citation_parts text[] := '{}';
  file_paths text[];
begin
  select * into src from public.evidence_sources where id = p_source_id for update;
  if not found then
    raise exception 'Evidence source not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(src.engagement_id, 'edit_architecture');

  select count(*), string_agg(distinct e.reference_code, ', ' order by e.reference_code)
    into statement_count, statement_codes
    from public.statement_evidence_links l
    join public.architecture_statements s on s.id = l.statement_id
    join public.architecture_elements e on e.id = s.element_id
    where l.evidence_source_id = p_source_id;

  select count(*), string_agg(distinct e.reference_code, ', ' order by e.reference_code)
    into element_count, element_codes
    from public.element_evidence_links l
    join public.architecture_elements e on e.id = l.element_id
    where l.evidence_source_id = p_source_id;

  select count(*), string_agg(distinct a.reference_code, ', ' order by a.reference_code)
    into method_count, method_codes
    from public.method_application_evidence l
    join public.method_applications a on a.id = l.application_id
    where l.evidence_source_id = p_source_id;

  select count(*), string_agg(distinct reference_code, ', ' order by reference_code)
    into criterion_count, criterion_codes
    from public.acceptance_criteria
    where agreement_evidence_source_id = p_source_id;

  select count(*), string_agg(distinct e.reference_code, ', ' order by e.reference_code)
    into checkpoint_count, checkpoint_codes
    from public.implementation_checkpoints c
    join public.architecture_elements e on e.id = c.implementation_element_id
    where c.achieved_evidence_source_id = p_source_id;

  select count(*) into action_response_count
    from public.client_action_responses
    where evidence_source_id = p_source_id;

  select count(*) into contribution_count
    from public.client_contributions
    where evidence_source_id = p_source_id;

  if statement_count > 0 then
    citation_parts := citation_parts || (statement_count || ' statement(s) on ' || statement_codes);
  end if;
  if element_count > 0 then
    citation_parts := citation_parts || (element_count || ' element(s): ' || element_codes);
  end if;
  if method_count > 0 then
    citation_parts := citation_parts || (method_count || ' method application(s): ' || method_codes);
  end if;
  if criterion_count > 0 then
    citation_parts := citation_parts || (criterion_count || ' acceptance criterion/criteria agreement(s): ' || criterion_codes);
  end if;
  if checkpoint_count > 0 then
    citation_parts := citation_parts || (checkpoint_count || ' implementation checkpoint(s) on ' || checkpoint_codes);
  end if;
  if action_response_count > 0 then
    citation_parts := citation_parts || (action_response_count || ' client action response(s)');
  end if;
  if contribution_count > 0 then
    citation_parts := citation_parts || (contribution_count || ' client contribution(s)');
  end if;

  if array_length(citation_parts, 1) > 0 then
    raise exception 'This source is cited and cannot be deleted (%); remove those citations first',
      array_to_string(citation_parts, '; ')
      using errcode = '23514';
  end if;

  select array_agg(object_path) into file_paths
  from public.engagement_files where evidence_source_id = p_source_id;

  delete from public.engagement_files where evidence_source_id = p_source_id;
  delete from public.evidence_sources where id = p_source_id;

  return coalesce(file_paths, '{}');
end;
$$;

revoke all on function public.delete_evidence_source(uuid) from public, anon;
grant execute on function public.delete_evidence_source(uuid) to authenticated;
