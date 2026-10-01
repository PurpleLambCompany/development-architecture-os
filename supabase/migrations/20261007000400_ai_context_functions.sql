-- =============================================================================
-- Phase 7B.1: Architecture Intelligence Foundation. Migration 5 of 7.
-- The read-only Tool Contract's database layer (B-2, B-19, B-20; OD-5, OD-6,
-- OD-13; proposal §8, §9, §12, §15, §22; ADR-0063).
--
-- Every record Architecture Intelligence may ever place in a model's context
-- is produced here, by one projection per record type, so that:
--
--   * only allowlisted fields of approved data classes are ever produced
--     (never person names or user ids, notes, locators, files, finance,
--     activity logs, client-authored text, Method/IP, lineage, `approach`
--     statements, Development Contexts or Method standards);
--   * records classified tplco_method_ip or licensed_third_party_source are
--     withheld by their governed ip_classification (OD-6);
--   * a class the engagement's current authorization does not include is
--     withheld, not sent, and the row says so;
--   * each produced record carries its identity (type, id, version) and a
--     SHA-256 digest of the canonical JSON of exactly the content produced
--     (digest version 1: sha256 over jsonb::text, OD-13);
--   * the same projection recomputes digests for staleness (migration 7).
--
-- The ai_context_* functions are the only database functions the Tool
-- Contract may call. Each requires the use capability, a current
-- authorization and a proposed or active engagement, every time it is
-- called, so revoking either stops the next read. They are STABLE as defense
-- in depth (PostgreSQL then refuses data modification inside them); the
-- read-only guarantee does not rest on that alone: they contain no data
-- modification, call no operation, and the tests in
-- supabase/tests/47_ai_no_mutation.test.sql prove no governed state changes.
-- =============================================================================

create type public.ai_context_row as (
  record_type      text,
  record_id        uuid,
  version_id       uuid,
  anchor_id        uuid,
  variant          text,
  data_class       text,
  withheld         boolean,
  withheld_reason  text,
  digest           text,
  content          jsonb
);

-- Digest version 1: SHA-256 over the canonical text form of the jsonb
-- content (jsonb normalizes key order and whitespace).
create function private.ai_digest(p_content jsonb)
returns text
language sql
stable
parallel safe
set search_path = ''
as $$
  select case when p_content is null then null
              else encode(sha256(convert_to(p_content::text, 'UTF8')), 'hex') end;
$$;

create function private.ai_is_intelligence_kind(p_kind public.element_kind)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_kind in ('assumption', 'risk', 'constraint', 'dependency', 'decision', 'recommendation', 'opportunity');
$$;

-- The class of an element's projection: Project Intelligence whatever its
-- state; otherwise published or working Architecture.
create function private.ai_element_class(p_kind public.element_kind, p_published boolean)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when private.ai_is_intelligence_kind(p_kind) then 'project_intelligence'
    when p_published then 'published_architecture'
    else 'working_architecture'
  end;
$$;

-- Governed IP exclusion (OD-6): TPLCo Method/IP and licensed third-party IP.
create function private.ai_ip_excluded(p_ip public.ip_classification)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_ip in ('tplco_method_ip', 'licensed_third_party_source');
$$;

-- Remove person-identifying keys anywhere in a json value: user and member
-- ids, "…_by" attributions and names of people.
create function private.ai_strip_people(p_value jsonb)
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case jsonb_typeof(p_value)
    when 'object' then coalesce((
      select jsonb_object_agg(k, private.ai_strip_people(v))
      from jsonb_each(p_value) as e (k, v)
      where k !~ '(_by|_by_name|_name|user_id|member_id|_user|recorded_by|owner)$' and k not in ('name', 'agreed_with')
    ), '{}'::jsonb)
    when 'array' then coalesce((
      select jsonb_agg(private.ai_strip_people(v) order by o)
      from jsonb_array_elements(p_value) with ordinality as a (v, o)
    ), '[]'::jsonb)
    else p_value
  end;
$$;

-- The allowlisted projection of an element snapshot (internal or live).
create function private.ai_project_snapshot(p_snapshot jsonb, p_state text, p_version_no int)
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  with d as (select coalesce(p_snapshot -> 'details', '{}'::jsonb) as details),
  allow as (
    select case p_snapshot ->> 'kind'
      when 'object' then array['domain', 'object_type', 'maturity', 'maturity_rationale', 'attributes']
      when 'assumption' then array['category', 'confidence', 'validation_status', 'impact_if_false', 'validation_note']
      when 'risk' then array['category', 'probability', 'impact', 'severity', 'mitigation', 'risk_status']
      when 'constraint' then array['category', 'source', 'negotiable', 'constraint_status']
      when 'dependency' then array['dependency_type', 'blocking', 'dependency_status', 'from_reference_code',
                                   'to_reference_code']
      when 'decision' then array['category', 'context', 'decision_status', 'needed_by', 'downstream_impact',
                                 'recommendation_rationale', 'decision_note', 'deferred_reason',
                                 'outcome_provenance', 'decision_source']
      when 'recommendation' then array['rationale', 'priority', 'category']
      when 'opportunity' then array['category', 'value', 'feasibility', 'attractiveness', 'window_opens_on',
                                    'window_closes_on', 'pursuit_approach', 'opportunity_status']
      when 'review' then array['review_type', 'scheduled_for', 'held_at', 'review_status', 'summary']
      when 'deliverable' then array['deliverable_type']
      when 'implementation_initiative' then array['category', 'implementation_status', 'target_operational_on',
                                                  'actual_operational_on']
      else array[]::text[]
    end as keys
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'reference_code', p_snapshot ->> 'reference_code',
    'kind', p_snapshot ->> 'kind',
    'title', p_snapshot ->> 'title',
    'summary', p_snapshot ->> 'summary',
    'provenance', p_snapshot ->> 'provenance',
    'state', p_state,
    'version_no', p_version_no,
    'domains', p_snapshot -> 'domains',
    'details', private.ai_strip_people(coalesce((
      select jsonb_object_agg(k, v) from jsonb_each(d.details) as e (k, v), allow where k = any (allow.keys)
    ), '{}'::jsonb)),
    'options', case when p_snapshot ->> 'kind' = 'decision' then (
      select jsonb_agg(jsonb_build_object('title', o ->> 'title', 'description', o ->> 'description',
                                          'tradeoffs', o ->> 'tradeoffs',
                                          'chosen', (o ->> 'id') = (d.details ->> 'chosen_option_id'),
                                          'recommended', (o ->> 'id') = (d.details ->> 'recommended_option_id'))
                       order by ord)
      from jsonb_array_elements(d.details -> 'options') with ordinality as x (o, ord)
    ) end,
    -- Statements: never `approach` (it may name TPLCo methods, ADR-0049),
    -- never AI-drafted text that has not been accepted.
    'statements', coalesce((
      select jsonb_agg(jsonb_build_object('statement_id', st ->> 'id', 'statement_kind', st ->> 'statement_kind',
                                          'body', st ->> 'body', 'provenance', st ->> 'provenance')
                       order by ord)
      from jsonb_array_elements(p_snapshot -> 'statements') with ordinality as x (st, ord)
      where st ->> 'statement_kind' <> 'approach'
        and coalesce(st ->> 'ai_review_state', 'not_applicable') in ('not_applicable', 'accepted')
    ), '[]'::jsonb)
  ))
  from d, allow;
$$;

-- -----------------------------------------------------------------------------
-- One dispatcher: the current class, exclusion and projected content of a
-- record, given its identity. Used by every tool and by staleness and
-- persistence checks, so a digest is always recomputed exactly as produced.
-- Returns no row when the record no longer exists in the engagement.
-- -----------------------------------------------------------------------------
create function private.ai_resolve(
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
    where i.rule_key = p_variant and i.subject_type = 'element' and i.subject_id = p_record_id
    order by i.fingerprint limit 1;
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

-- Wrap a resolved record as a Tool Contract row: withheld unless its class is
-- authorized now and it is not excluded; digest over exactly the content.
create function private.ai_emit(
  p_engagement_id uuid,
  p_record_type   text,
  p_record_id     uuid,
  p_version_id    uuid,
  p_anchor_id     uuid,
  p_variant       text
)
returns setof public.ai_context_row
language sql
stable
security definer
set search_path = ''
as $$
  select p_record_type, p_record_id, p_version_id, p_anchor_id, p_variant, x.data_class,
         w.withheld, w.reason,
         case when w.withheld then null else private.ai_digest(x.content) end,
         case when w.withheld then null else x.content end
  from private.ai_resolve(p_engagement_id, p_record_type, p_record_id, p_version_id, p_anchor_id, p_variant) x
  cross join lateral (
    select coalesce(x.excluded_reason,
                    case when not private.ai_class_authorized(p_engagement_id, x.data_class)
                         then 'class_not_authorized' end) as reason
  ) r
  cross join lateral (select r.reason is not null as withheld, r.reason) w;
$$;

-- Every Tool Contract read starts here: the engagement is readable, the
-- caller holds use_architecture_intelligence, the engagement is proposed or
-- active, and its current authorization is `authorized`. Checked on every
-- call, so a revocation stops the next read.
create function private.require_ai_context(p_engagement_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.engagement_ai_authorizations;
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not private.can_use_architecture_intelligence(p_engagement_id) then
    raise exception 'You do not hold use_architecture_intelligence on this engagement' using errcode = '42501';
  end if;
  if not exists (select 1 from public.engagements where id = p_engagement_id and status in ('proposed', 'active')) then
    raise exception 'External processing is allowed only for proposed and active engagements' using errcode = '42501';
  end if;
  a := private.current_ai_authorization(p_engagement_id);
  if a.id is null or a.state <> 'authorized' then
    raise exception 'This engagement is not authorized for external processing' using errcode = '42501';
  end if;
end;
$$;

-- Resolve an element in the engagement, or raise P0002.
create function private.ai_element_in(p_engagement_id uuid, p_element_id uuid)
returns public.architecture_elements
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
begin
  select * into e from public.architecture_elements where id = p_element_id and engagement_id = p_engagement_id;
  if e.id is null then
    raise exception 'Element not found' using errcode = 'P0002';
  end if;
  return e;
end;
$$;

-- =============================================================================
-- The Tool Contract: ten read functions (proposal §12.2).
-- =============================================================================

-- get_element: one element, published (latest version) or working.
create function public.ai_context_element(p_engagement_id uuid, p_element_id uuid, p_state text default 'published')
returns setof public.ai_context_row
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
begin
  perform private.require_ai_context(p_engagement_id);
  e := private.ai_element_in(p_engagement_id, p_element_id);
  if p_state = 'published' then
    if e.latest_version_id is null then
      raise exception 'Element not published' using errcode = 'P0002';
    end if;
    return query select * from private.ai_emit(p_engagement_id, 'element_version', e.id, e.latest_version_id, null, null);
  elsif p_state = 'working' then
    return query select * from private.ai_emit(p_engagement_id, 'element_working', e.id, null, null, null);
  else
    raise exception 'State is published or working' using errcode = '23514';
  end if;
end;
$$;

-- get_relationships: the typed relationships of one element.
create function public.ai_context_relationships(p_engagement_id uuid, p_element_id uuid)
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
    select x.* from public.architecture_relationships r
    cross join lateral private.ai_emit(p_engagement_id, 'relationship', r.id, null, p_element_id, null) x
    where r.engagement_id = p_engagement_id and r.retired_at is null
      and p_element_id in (r.source_element_id, r.target_element_id)
    order by r.relationship_type, r.id
    limit 40;
end;
$$;

-- trace_impact: governed reach of one element (ADR-0055), one row per element reached.
create function public.ai_context_impact(p_engagement_id uuid, p_element_id uuid)
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
    select x.* from (
      select distinct on (t.reached_id) t.reached_id, t.depth
      from public.impact_trace(p_element_id, 'on_demand') t
      where t.reached_type = 'element'
      order by t.reached_id, t.depth
    ) reach
    cross join lateral private.ai_emit(p_engagement_id, 'impact_reach', reach.reached_id, null, p_element_id, null) x
    order by reach.depth, reach.reached_id
    limit 40;
end;
$$;

-- get_revision: one published revision of an element (the latest when no
-- version is named): its changed paths and quoted change summary.
create function public.ai_context_revision(p_engagement_id uuid, p_element_id uuid, p_version_id uuid default null)
returns setof public.ai_context_row
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
begin
  perform private.require_ai_context(p_engagement_id);
  e := private.ai_element_in(p_engagement_id, p_element_id);
  return query select * from private.ai_emit(p_engagement_id, 'revision', e.id,
                                             coalesce(p_version_id, e.latest_version_id), null, null);
end;
$$;

-- get_edge_item: one current deterministic Edge item on an element. A
-- fingerprint that no longer matches returns nothing.
create function public.ai_context_edge_item(p_engagement_id uuid, p_rule_key text, p_element_id uuid,
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
    select x.* from private.ai_emit(p_engagement_id, 'edge_item', p_element_id, null, null, p_rule_key) x
    where x.withheld or x.content ->> 'fingerprint' = p_fingerprint;
end;
$$;

-- get_evidence: the evidence linked to an element and to its statements,
-- metadata only. The summary is included only when the Gateway's context
-- plan for the inference kind permits it (OD-5); the model cannot ask for it.
create function public.ai_context_evidence(p_engagement_id uuid, p_element_id uuid,
                                           p_include_summary boolean default false)
returns setof public.ai_context_row
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  suffix text := case when p_include_summary then '_summary' else '' end;
begin
  perform private.require_ai_context(p_engagement_id);
  perform private.ai_element_in(p_engagement_id, p_element_id);
  return query
    select x.* from (
      select l.id, 'element_link' as v, l.created_at from public.element_evidence_links l
      where l.engagement_id = p_engagement_id and l.element_id = p_element_id
      union all
      select l.id, 'statement_link', l.created_at from public.statement_evidence_links l
      join public.architecture_statements s on s.id = l.statement_id
      where l.engagement_id = p_engagement_id and s.element_id = p_element_id and s.statement_kind <> 'approach'
    ) links
    cross join lateral private.ai_emit(p_engagement_id, 'evidence_link', links.id, null, p_element_id,
                                       links.v || suffix) x
    order by links.created_at, links.id
    limit 40;
end;
$$;

-- get_project_intelligence: Project Intelligence records related to an
-- element by a typed relationship or a dependency, as working projections.
create function public.ai_context_intelligence(p_engagement_id uuid, p_element_id uuid)
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
    select x.* from (
      select distinct pi.id, pi.reference_code
      from public.architecture_elements pi
      where pi.engagement_id = p_engagement_id and private.ai_is_intelligence_kind(pi.kind)
        and pi.id <> p_element_id and pi.lifecycle <> 'retired'
        and (exists (select 1 from public.architecture_relationships r
                     where r.engagement_id = p_engagement_id and r.retired_at is null
                       and ((r.source_element_id = pi.id and r.target_element_id = p_element_id)
                            or (r.target_element_id = pi.id and r.source_element_id = p_element_id)))
             or exists (select 1 from public.dependencies d
                        where d.element_id = pi.id and p_element_id in (d.from_element_id, d.to_element_id)))
    ) related
    cross join lateral private.ai_emit(p_engagement_id, 'element_working', related.id, null, null, null) x
    order by related.reference_code
    limit 20;
end;
$$;

-- get_acceptance_criteria: criteria governing an element (never Method
-- standards or who agreed them).
create function public.ai_context_criteria(p_engagement_id uuid, p_element_id uuid)
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
    select x.* from public.acceptance_criteria c
    cross join lateral private.ai_emit(p_engagement_id, 'acceptance_criterion', c.id, null, null, null) x
    where c.engagement_id = p_engagement_id and c.governed_element_id = p_element_id
      and c.state in ('proposed', 'agreed')
    order by c.reference_code
    limit 20;
end;
$$;

-- get_review_context: what a Review examined, at which versions, and
-- whether each has been revised since.
create function public.ai_context_review(p_engagement_id uuid, p_review_element_id uuid)
returns setof public.ai_context_row
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
begin
  perform private.require_ai_context(p_engagement_id);
  e := private.ai_element_in(p_engagement_id, p_review_element_id);
  if e.kind <> 'review' then
    raise exception 'Not a Review' using errcode = '23514';
  end if;
  return query select * from private.ai_emit(p_engagement_id, 'review_capture', e.id, null, null, null);
end;
$$;

-- get_implementation_state: an initiative's checkpoints and what it implements.
create function public.ai_context_implementation(p_engagement_id uuid, p_initiative_element_id uuid)
returns setof public.ai_context_row
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
begin
  perform private.require_ai_context(p_engagement_id);
  e := private.ai_element_in(p_engagement_id, p_initiative_element_id);
  if e.kind <> 'implementation_initiative' then
    raise exception 'Not an Implementation Initiative' using errcode = '23514';
  end if;
  return query
    select x.* from (
      select ck.id, 'checkpoint' as t, null::uuid as anchor, coalesce(ck.target_on, ck.achieved_on) as o
      from public.implementation_checkpoints ck
      where ck.engagement_id = p_engagement_id and ck.implementation_element_id = e.id
      union all
      select r.id, 'relationship', e.id, null::date from public.architecture_relationships r
      where r.engagement_id = p_engagement_id and r.retired_at is null and r.source_element_id = e.id
        and r.relationship_type = 'implements'
    ) parts
    cross join lateral private.ai_emit(p_engagement_id, parts.t, parts.id, null, parts.anchor, null) x
    order by parts.t, parts.o nulls last, parts.id
    limit 40;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants: the ten Tool Contract functions to authenticated only; every
-- private helper to nobody but its owner.
-- -----------------------------------------------------------------------------
revoke all on function public.ai_context_element(uuid, uuid, text) from public, anon;
revoke all on function public.ai_context_relationships(uuid, uuid) from public, anon;
revoke all on function public.ai_context_impact(uuid, uuid) from public, anon;
revoke all on function public.ai_context_revision(uuid, uuid, uuid) from public, anon;
revoke all on function public.ai_context_edge_item(uuid, text, uuid, text) from public, anon;
revoke all on function public.ai_context_evidence(uuid, uuid, boolean) from public, anon;
revoke all on function public.ai_context_intelligence(uuid, uuid) from public, anon;
revoke all on function public.ai_context_criteria(uuid, uuid) from public, anon;
revoke all on function public.ai_context_review(uuid, uuid) from public, anon;
revoke all on function public.ai_context_implementation(uuid, uuid) from public, anon;
grant execute on function public.ai_context_element(uuid, uuid, text) to authenticated;
grant execute on function public.ai_context_relationships(uuid, uuid) to authenticated;
grant execute on function public.ai_context_impact(uuid, uuid) to authenticated;
grant execute on function public.ai_context_revision(uuid, uuid, uuid) to authenticated;
grant execute on function public.ai_context_edge_item(uuid, text, uuid, text) to authenticated;
grant execute on function public.ai_context_evidence(uuid, uuid, boolean) to authenticated;
grant execute on function public.ai_context_intelligence(uuid, uuid) to authenticated;
grant execute on function public.ai_context_criteria(uuid, uuid) to authenticated;
grant execute on function public.ai_context_review(uuid, uuid) to authenticated;
grant execute on function public.ai_context_implementation(uuid, uuid) to authenticated;

revoke all on function private.ai_digest(jsonb) from public, anon, authenticated;
revoke all on function private.ai_resolve(uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.ai_emit(uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.require_ai_context(uuid) from public, anon, authenticated;
revoke all on function private.ai_element_in(uuid, uuid) from public, anon, authenticated;
revoke all on function private.ai_project_snapshot(jsonb, text, int) from public, anon, authenticated;
revoke all on function private.ai_strip_people(jsonb) from public, anon, authenticated;
