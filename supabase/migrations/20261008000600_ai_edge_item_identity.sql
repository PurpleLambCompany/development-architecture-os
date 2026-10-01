-- =============================================================================
-- Phase 7B.2: Architecture Intelligence Experience. Migration 7 of 9.
-- Defect fix found in 7B.2 implementation: an Edge item could not be
-- addressed exactly through the Tool Contract when two items share a rule
-- and a subject (for example two `change_reaches` items on one element,
-- reached from different revisions). private.ai_resolve took the rule key as
-- the variant and returned the item with the lowest fingerprint, so
-- get_edge_item with the other item's fingerprint returned nothing and
-- "Explain significance" on that item ended as subject_not_found.
--
-- The variant for an Edge item may now carry the item's fingerprint digest:
-- `rule_key#md5(fingerprint)`. ai_resolve returns that exact item when it
-- still holds, and otherwise the rule's first item on the subject (so a
-- changed item still reads as `edge_item_changed`, not removed). A bare
-- rule key resolves exactly as in 7B.1, so existing bases are unaffected.
-- get_edge_item emits the exact variant. No Tool Contract function is added,
-- no projection or class changes, and both functions stay read-only.
-- =============================================================================

create or replace function private.ai_resolve(
  p_engagement_id uuid,
  p_record_type   text,
  p_record_id     uuid,
  p_version_id    uuid,
  p_anchor_id     uuid,
  p_variant       text
)
returns table (data_class text, excluded_reason text, content jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  v public.element_versions;
  r public.architecture_relationships;
  other public.architecture_elements;
  src public.evidence_sources;
  stance text;
  on_ref text;
  c public.acceptance_criteria;
  ck public.implementation_checkpoints;
  item record;
  t record;
begin
  case p_record_type
  when 'element_version' then
    select * into e from public.architecture_elements where id = p_record_id and engagement_id = p_engagement_id;
    select * into v from public.element_versions
    where id = p_version_id and element_id = p_record_id and engagement_id = p_engagement_id;
    if e.id is null or v.id is null then return; end if;
    return query select private.ai_element_class(e.kind, true),
      case when private.ai_ip_excluded(e.ip_classification) then 'ip_excluded' end,
      private.ai_project_snapshot(v.snapshot, 'published', v.version_no);

  when 'element_working' then
    select * into e from public.architecture_elements where id = p_record_id and engagement_id = p_engagement_id;
    if e.id is null then return; end if;
    return query select private.ai_element_class(e.kind, false),
      case when private.ai_ip_excluded(e.ip_classification) then 'ip_excluded' end,
      private.ai_project_snapshot(private.build_element_snapshot(e.id, false), 'working', null);

  when 'relationship' then
    select * into r from public.architecture_relationships
    where id = p_record_id and engagement_id = p_engagement_id and retired_at is null;
    if r.id is null or p_anchor_id is null or p_anchor_id not in (r.source_element_id, r.target_element_id) then
      return;
    end if;
    select * into other from public.architecture_elements
    where id = case when r.source_element_id = p_anchor_id then r.target_element_id else r.source_element_id end;
    select * into e from public.architecture_elements where id = p_anchor_id;
    return query select
      case when r.published_at is not null then 'published_architecture' else 'working_architecture' end,
      case when private.ai_ip_excluded(other.ip_classification) or private.ai_ip_excluded(e.ip_classification)
           then 'ip_excluded' end,
      jsonb_strip_nulls(jsonb_build_object(
        'relationship_type', r.relationship_type,
        'direction', case when r.source_element_id = p_anchor_id then 'outgoing' else 'incoming' end,
        'from', e.reference_code,
        'other_reference_code', other.reference_code, 'other_kind', other.kind, 'other_title', other.title,
        'description', nullif(r.description, ''),
        'published', r.published_at is not null));

  when 'impact_reach' then
    select * into e from public.architecture_elements where id = p_anchor_id and engagement_id = p_engagement_id;
    select * into other from public.architecture_elements where id = p_record_id and engagement_id = p_engagement_id;
    if e.id is null or other.id is null then return; end if;
    select * into t from public.impact_trace(p_anchor_id, 'on_demand') x
    where x.reached_type = 'element' and x.reached_id = p_record_id
    order by x.depth, x.link_key, x.direction limit 1;
    if not found then return; end if;
    return query select private.ai_element_class(other.kind, false),
      case when private.ai_ip_excluded(other.ip_classification) then 'ip_excluded' end,
      jsonb_strip_nulls(jsonb_build_object(
        'from', e.reference_code,
        'reached_reference_code', other.reference_code, 'reached_kind', other.kind, 'reached_title', other.title,
        'category', t.category, 'depth', t.depth, 'link_key', t.link_key, 'direction', t.direction,
        'assessment', t.assessment, 'propagation', t.propagation, 'reason', t.reason));

  when 'revision' then
    select * into e from public.architecture_elements where id = p_record_id and engagement_id = p_engagement_id;
    if e.id is null then return; end if;
    select * into t from public.element_revisions(p_engagement_id, p_record_id) x where x.version_id = p_version_id;
    if not found then return; end if;
    return query select private.ai_element_class(e.kind, true),
      case when private.ai_ip_excluded(e.ip_classification) then 'ip_excluded' end,
      jsonb_build_object(
        'reference_code', e.reference_code, 'version_no', t.version_no,
        'previous_version_no', (select pv.version_no from public.element_versions pv where pv.id = t.previous_version_id),
        'change_type', t.change_type,
        'changed_paths', coalesce((select jsonb_agg(p order by p) from unnest(t.changed_paths) p
                                   where p !~* '(methodology|lineage|practice|_by$|owner|source_reference)'),
                                  '[]'::jsonb),
        -- Quoted author text, never parsed (ADR-0053).
        'change_summary_quoted', t.change_summary);

  when 'edge_item' then
    select * into e from public.architecture_elements where id = p_record_id and engagement_id = p_engagement_id;
    if e.id is null then return; end if;
    select i.* into item
    from public.edge_items(p_engagement_id, null, 'element', p_record_id, true) i
    where i.rule_key = split_part(p_variant, '#', 1) and i.subject_type = 'element' and i.subject_id = p_record_id
    order by (md5(i.fingerprint) = nullif(split_part(p_variant, '#', 2), '')) desc nulls last, i.fingerprint
    limit 1;
    if not found then return; end if;
    return query select private.ai_element_class(e.kind, false),
      case
        when item.home = 'practice' or item.rule_key = 'methodology_derived_without_model' then 'method_ip'
        when private.ai_ip_excluded(e.ip_classification) then 'ip_excluded'
      end,
      jsonb_strip_nulls(jsonb_build_object(
        'rule_key', item.rule_key, 'lens', item.lens, 'home', item.home,
        'epistemic_status', item.epistemic_status, 'producer', item.producer,
        'subject_reference_code', item.subject_reference_code, 'subject_kind', item.subject_kind,
        'subject_title', item.subject_title, 'variant', item.variant,
        'details', private.ai_strip_people(item.details),
        'trigger_type', item.trigger_type, 'trigger_reference_code', item.trigger_reference_code,
        'trigger_version_no', item.trigger_version_no,
        'tier', item.tier, 'resolving_act', item.resolving_act,
        'fingerprint', item.fingerprint));

  when 'evidence_link' then
    if p_variant like 'statement_link%' then
      select s.*, l.stance::text as link_stance, st.element_id as on_element, l.statement_id as on_statement
        into t
      from public.statement_evidence_links l
      join public.evidence_sources s on s.id = l.evidence_source_id
      join public.architecture_statements st on st.id = l.statement_id
      where l.id = p_record_id and l.engagement_id = p_engagement_id
        and st.statement_kind <> 'approach';
    else
      select s.*, l.stance::text as link_stance, l.element_id as on_element, null::uuid as on_statement into t
      from public.element_evidence_links l
      join public.evidence_sources s on s.id = l.evidence_source_id
      where l.id = p_record_id and l.engagement_id = p_engagement_id;
    end if;
    if not found then return; end if;
    select reference_code into on_ref from public.architecture_elements where id = t.on_element;
    return query select 'evidence_metadata'::text,
      case when private.ai_ip_excluded(t.ip_classification) then 'ip_excluded' end,
      -- Metadata only (B-2, OD-5): never notes, url, reference, locator,
      -- external reference, publisher or author, or any file. The
      -- architect-authored summary only when the inference kind permits it.
      jsonb_strip_nulls(jsonb_build_object(
        'evidence_title', t.title, 'source_type', t.source_type, 'evidence_provenance', t.provenance,
        'source_date', t.source_date, 'stance', t.link_stance,
        'on_reference_code', on_ref, 'on_statement_id', t.on_statement,
        'summary', case when p_variant like '%_summary' then nullif(t.summary, '') end));

  when 'acceptance_criterion' then
    select * into c from public.acceptance_criteria where id = p_record_id and engagement_id = p_engagement_id;
    if c.id is null then return; end if;
    select * into e from public.architecture_elements where id = c.governed_element_id;
    return query select
      case when c.state = 'proposed' then 'working_architecture' else 'published_architecture' end,
      case when private.ai_ip_excluded(e.ip_classification) then 'ip_excluded' end,
      jsonb_strip_nulls(jsonb_build_object(
        'reference_code', c.reference_code, 'governs', e.reference_code, 'body', c.body, 'state', c.state,
        'agreed_on', c.agreed_on, 'closure_reason', c.closure_reason));

  when 'review_capture' then
    select * into e from public.architecture_elements
    where id = p_record_id and engagement_id = p_engagement_id and kind = 'review';
    if e.id is null then return; end if;
    return query select 'published_architecture'::text, null::text,
      jsonb_build_object(
        'review', e.reference_code,
        'examined', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'reference_code', x.reference_code, 'kind', x.kind, 'title', x.title,
                   'examined_version_no', ev.version_no,
                   'latest_version_no', lv.version_no,
                   'revised_since', ev.id <> x.latest_version_id)
                 order by x.reference_code)
          from public.review_examined_versions rv
          join public.architecture_elements x on x.id = rv.element_id
          join public.element_versions ev on ev.id = rv.element_version_id
          left join public.element_versions lv on lv.id = x.latest_version_id
          where rv.review_element_id = e.id and not private.ai_ip_excluded(x.ip_classification)
        ), '[]'::jsonb));

  when 'checkpoint' then
    select * into ck from public.implementation_checkpoints where id = p_record_id and engagement_id = p_engagement_id;
    if ck.id is null then return; end if;
    select * into e from public.architecture_elements where id = ck.implementation_element_id;
    return query select 'working_architecture'::text, null::text,
      jsonb_strip_nulls(jsonb_build_object(
        'initiative', e.reference_code, 'checkpoint_type', ck.checkpoint_type, 'title', ck.title,
        'target_on', ck.target_on, 'achieved_on', ck.achieved_on));

  else
    return;
  end case;
end;
$$;

-- get_edge_item: one current deterministic Edge item on an element, named
-- exactly by its fingerprint. A fingerprint that no longer matches returns
-- nothing.
create or replace function public.ai_context_edge_item(p_engagement_id uuid, p_rule_key text, p_element_id uuid,
                                                       p_fingerprint text)
returns setof public.ai_context_row
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_ai_context(p_engagement_id);
  perform private.ai_element_in(p_engagement_id, p_element_id);
  return query
    select x.* from private.ai_emit(p_engagement_id, 'edge_item', p_element_id, null, null,
                                    p_rule_key || '#' || md5(p_fingerprint)) x
    where x.withheld or x.content ->> 'fingerprint' = p_fingerprint;
end;
$$;
