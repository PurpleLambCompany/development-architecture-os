-- =============================================================================
-- Phase 7B.2: Architecture Intelligence Experience. Migration 5 of 6.
-- Read models for availability, reuse, Suggested interpretations, the
-- kept-interpretations register and an inference's detail (principle 23,
-- IX-13, IX-14, IX-17, IX-18; PD-10 to PD-16; proposal §9, §16, §20, §26;
-- ADR-0068, ADR-0070, ADR-0051 amendment).
--
-- Every function here is a read: security definer, search_path '', no DML,
-- and proven read-only by 47_ai_no_mutation. Each checks
-- can_read_architecture (P0002 otherwise). Those that return anything about
-- an inference also need use_architecture_intelligence: availability,
-- reuse and detail refuse (42501); Suggested interpretations and the
-- register return an empty set, so a page can call them for any internal
-- reader and show nothing, not even a heading, to a non-holder (IX-18).
--
-- The parts of the activation gate the database cannot see (processing
-- mode, the evaluated-model manifest, the provider configuration) are
-- combined with these results by the application (ADR-0073).
--
-- A subject is passed as jsonb with the keys of the 7B.1 subject union:
-- type, element_id, second_element_id, version_id, rule_key, fingerprint,
-- link_id, link_type.
-- =============================================================================

-- Whether an inference is about exactly this kind and subject.
create function private.inference_matches(i public.architecture_inferences, p_kind text, s jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select i.inference_kind = p_kind and i.subject_type = (s ->> 'type')
     and i.subject_element_id = (s ->> 'element_id')::uuid
     and i.subject_second_element_id is not distinct from (s ->> 'second_element_id')::uuid
     and i.subject_version_id is not distinct from (s ->> 'version_id')::uuid
     and i.subject_rule_key is not distinct from (s ->> 'rule_key')
     and i.subject_fingerprint is not distinct from (s ->> 'fingerprint')
     and i.subject_link_id is not distinct from (s ->> 'link_id')::uuid
     and i.subject_link_type is not distinct from (s ->> 'link_type');
$$;

-- The latest kept inference of this kind on this subject, if any.
create function private.latest_kept_inference(p_engagement_id uuid, p_kind text, p_subject jsonb)
returns public.architecture_inferences
language sql
stable
security definer
set search_path = ''
as $$
  select i.* from public.architecture_inferences i
  where i.engagement_id = p_engagement_id and i.kept_at is not null
    and private.inference_matches(i, p_kind, p_subject)
  order by i.created_at desc, i.id desc
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- The deterministic availability rules (proposal §9, PD-10 to PD-12). One
-- rule per action, each with the reason shown to the person. A rule that
-- does not hold returns false and no reason. Nothing here reads a model's
-- output or calls one.
-- -----------------------------------------------------------------------------
create function private.ai_availability_rule(p_engagement_id uuid, p_kind text, p_subject jsonb)
returns table (holds boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  st text := p_subject ->> 'type';
  e public.architecture_elements;
  b public.architecture_elements;
  item record;
  rev record;
  n int;
  m int;
  words text;
  status text;
  when_on date;
  a_rev timestamptz;
  a_content timestamptz;
  b_rev timestamptz;
  b_content timestamptz;
  ev record;
begin
  select * into e from public.architecture_elements
  where id = (p_subject ->> 'element_id')::uuid and engagement_id = p_engagement_id;
  if e.id is null then
    return query select false, null::text;
    return;
  end if;

  if p_kind = 'explanation' and st = 'edge_item' then
    -- Not Ambient; about an element; triggered by a substantive revision or
    -- carrying a consequence path: a condition to connect to statements.
    select i.* into item from public.edge_items(p_engagement_id, null, 'element', e.id, true) i
    where i.rule_key = p_subject ->> 'rule_key' and i.subject_type = 'element' and i.subject_id = e.id
      and i.fingerprint = p_subject ->> 'fingerprint'
    limit 1;
    if not found or item.tier = 'ambient' then
      return query select false, null::text;
    elsif item.trigger_type = 'substantive_revision' then
      return query select true, format('%s changed substantively (v%s), and this condition follows from that change',
                                       coalesce(item.trigger_reference_code, e.reference_code), item.trigger_version_no);
    elsif jsonb_array_length(coalesce(item.consequence_path, '[]'::jsonb)) > 0 then
      return query select true, format('This condition follows a governed impact path from %s',
                                       coalesce(item.trigger_reference_code, e.reference_code));
    else
      return query select false, null::text;
    end if;

  elsif p_kind = 'explanation' and st = 'revision' then
    -- Substantive (ADR-0053), and it changed the element's statements or summary.
    select r.* into rev from private.element_revision_rows(p_engagement_id, e.id) r
    where r.version_id = (p_subject ->> 'version_id')::uuid;
    if not found or rev.change_type <> 'substantive_revision'
       or not (rev.changed_paths && array['statements', 'summary']) then
      return query select false, null::text;
    else
      words := case
        when rev.changed_paths @> array['statements', 'summary'] then 'its statements and summary'
        when rev.changed_paths @> array['statements'] then 'its statements'
        else 'its summary'
      end;
      return query select true, format('v%s of %s changed %s', rev.version_no, e.reference_code, words);
    end if;

  elsif p_kind = 'explanation' and st = 'impact_trace' then
    -- The trace reaches at least one other element through a propagating link.
    select count(distinct t.reached_id)::int, string_agg(distinct t.link_key, ', ' order by t.link_key)
      into n, words
    from public.impact_trace(e.id, 'on_demand') t
    where t.reached_type = 'element' and t.propagation <> 'never' and t.reached_id <> e.id;
    if coalesce(n, 0) = 0 then
      return query select false, null::text;
    else
      return query select true, format('Changing %s reaches %s %s through %s', e.reference_code, n,
                                       case when n = 1 then 'element' else 'elements' end, replace(words, '_', ' '));
    end if;

  elsif p_kind = 'tension' and st = 'element_pair' then
    select * into b from public.architecture_elements
    where id = (p_subject ->> 'second_element_id')::uuid and engagement_id = p_engagement_id;
    if b.id is null or b.id = e.id then
      return query select false, null::text;
      return;
    end if;
    -- Connected by a typed relationship, or within the governed impact path.
    if not exists (select 1 from public.architecture_relationships r
                   where r.engagement_id = p_engagement_id and r.retired_at is null
                     and ((r.source_element_id = e.id and r.target_element_id = b.id)
                          or (r.source_element_id = b.id and r.target_element_id = e.id)))
       and not exists (select 1 from public.impact_trace(e.id, 'on_demand') t
                       where t.reached_type = 'element' and t.reached_id = b.id) then
      return query select false, null::text;
      return;
    end if;
    -- Both have published statements.
    if not exists (select 1 from public.element_versions v where v.id = e.latest_version_id
                     and jsonb_array_length(coalesce(v.snapshot -> 'statements', '[]'::jsonb)) > 0)
       or not exists (select 1 from public.element_versions v where v.id = b.latest_version_id
                        and jsonb_array_length(coalesce(v.snapshot -> 'statements', '[]'::jsonb)) > 0) then
      return query select false, null::text;
      return;
    end if;
    -- An Edge condition rests on both (PD-11) ...
    if exists (select 1 from public.edge_items(p_engagement_id) i
               where (i.subject_id::text || coalesce(i.trigger_subject_id::text, '') || coalesce(i.basis::text, '')
                      || coalesce(i.consequence_path::text, '')) like '%' || e.id::text || '%'
                 and (i.subject_id::text || coalesce(i.trigger_subject_id::text, '') || coalesce(i.basis::text, '')
                      || coalesce(i.consequence_path::text, '')) like '%' || b.id::text || '%') then
      return query select true, format('A Development Edge condition rests on both %s and %s',
                                       e.reference_code, b.reference_code);
      return;
    end if;
    -- ... or one side was substantively revised after the other was last published.
    select max(r.published_at) filter (where r.change_type = 'substantive_revision'),
           max(r.published_at) filter (where r.change_type in ('first_publication', 'substantive_revision'))
      into a_rev, a_content
    from private.element_revision_rows(p_engagement_id, e.id) r;
    select max(r.published_at) filter (where r.change_type = 'substantive_revision'),
           max(r.published_at) filter (where r.change_type in ('first_publication', 'substantive_revision'))
      into b_rev, b_content
    from private.element_revision_rows(p_engagement_id, b.id) r;
    if a_rev is not null and a_rev > b_content then
      return query select true, format('%s was revised on %s, after %s was last published', e.reference_code,
                                       to_char(a_rev at time zone 'utc', 'FMDD Mon YYYY'), b.reference_code);
    elsif b_rev is not null and b_rev > a_content then
      return query select true, format('%s was revised on %s, after %s was last published', b.reference_code,
                                       to_char(b_rev at time zone 'utc', 'FMDD Mon YYYY'), e.reference_code);
    else
      return query select false, null::text;
    end if;

  elsif p_kind = 'evidence_bearing' and st = 'evidence_link' then
    -- The link exists, its element is live, and the source has a recorded
    -- summary: metadata alone cannot support a reading (PD-12).
    if p_subject ->> 'link_type' = 'statement_link' then
      select l.created_at, l.stance::text as stance, s.title, s.summary into ev
      from public.statement_evidence_links l
      join public.evidence_sources s on s.id = l.evidence_source_id
      join public.architecture_statements st on st.id = l.statement_id
      where l.id = (p_subject ->> 'link_id')::uuid and l.engagement_id = p_engagement_id and st.element_id = e.id;
    elsif p_subject ->> 'link_type' = 'element_link' then
      select l.created_at, l.stance::text as stance, s.title, s.summary into ev
      from public.element_evidence_links l
      join public.evidence_sources s on s.id = l.evidence_source_id
      where l.id = (p_subject ->> 'link_id')::uuid and l.engagement_id = p_engagement_id and l.element_id = e.id;
    end if;
    if ev is null or e.lifecycle in ('retired', 'superseded') or btrim(coalesce(ev.summary, '')) = '' then
      return query select false, null::text;
    else
      return query select true, format('Evidence linked %s with stance %s; summary recorded',
                                       to_char(ev.created_at at time zone 'utc', 'FMDD Mon YYYY'), ev.stance);
    end if;

  elsif p_kind = 'realization_reading' and st = 'element' then
    -- Implements at least one published element, and has a checkpoint or a
    -- status beyond its initial one.
    if e.kind <> 'implementation_initiative' then
      return query select false, null::text;
      return;
    end if;
    select count(*)::int into n from public.architecture_relationships r
    join public.architecture_elements t on t.id = r.target_element_id
    where r.engagement_id = p_engagement_id and r.source_element_id = e.id and r.retired_at is null
      and r.relationship_type = 'implements' and t.latest_version_id is not null
      and t.lifecycle not in ('retired', 'superseded');
    select count(*)::int into m from public.implementation_checkpoints c where c.implementation_element_id = e.id;
    select ii.implementation_status::text into status from public.implementation_initiatives ii where ii.element_id = e.id;
    if n = 0 or (m = 0 and coalesce(status, 'not_started') = 'not_started') then
      return query select false, null::text;
    else
      return query select true, format('Implements %s published %s; %s', n,
                                       case when n = 1 then 'element' else 'elements' end,
                                       case when m > 0 then format('%s %s recorded', m,
                                                                   case when m = 1 then 'checkpoint' else 'checkpoints' end)
                                            else format('status %s', replace(status, '_', ' ')) end);
    end if;

  elsif p_kind = 'review_brief' and st = 'element' then
    -- Scheduled or held, and examines at least one element.
    if e.kind <> 'review' then
      return query select false, null::text;
      return;
    end if;
    select rv.review_status::text, coalesce(rv.held_at, rv.scheduled_for)::date into status, when_on
    from public.reviews rv where rv.element_id = e.id;
    select count(*)::int into n from public.architecture_relationships r
    where r.engagement_id = p_engagement_id and r.source_element_id = e.id and r.retired_at is null
      and r.relationship_type = 'examines';
    if status not in ('scheduled', 'held') or n = 0 then
      return query select false, null::text;
    elsif status = 'held' then
      select count(*)::int into m from public.review_examined_versions c
      join public.architecture_elements x on x.id = c.element_id
      where c.review_element_id = e.id and x.latest_version_id is distinct from c.element_version_id;
      return query select true, format('Examined %s %s at the hold; %s changed since', n,
                                       case when n = 1 then 'element' else 'elements' end, m);
    else
      return query select true, format('Examines %s %s; scheduled for %s', n,
                                       case when n = 1 then 'element' else 'elements' end,
                                       to_char(when_on, 'FMDD Mon YYYY'));
    end if;

  else
    return query select false, null::text;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Availability for one action on one subject: its rule and reason, and the
-- latest kept interpretation with its state and latest judgment, which
-- decide reuse and suppression (PD-14: engagement-wide, until the basis
-- changes). Holders of use only.
-- -----------------------------------------------------------------------------
create function public.architecture_intelligence_availability(
  p_engagement_id uuid,
  p_kind          text,
  p_subject       jsonb
)
returns table (
  rule_holds              boolean,
  reason                  text,
  latest_inference_id     uuid,
  latest_state            text,
  latest_judgment_kind    text,
  latest_judged_at        timestamptz,
  suppressed              boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rule record;
  k public.architecture_inferences;
  j public.architecture_inference_judgments;
  state text;
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not private.can_use_architecture_intelligence(p_engagement_id) then
    raise exception 'You do not hold use_architecture_intelligence on this engagement' using errcode = '42501';
  end if;
  if p_kind <> all (private.ai_inference_kinds()) or jsonb_typeof(p_subject) is distinct from 'object' then
    raise exception 'Unknown kind or subject' using errcode = '23514';
  end if;
  select * into rule from private.ai_availability_rule(p_engagement_id, p_kind, p_subject);
  k := private.latest_kept_inference(p_engagement_id, p_kind, p_subject);
  if k.id is not null then
    select s.state into state from public.architecture_inference_state(p_engagement_id, k.id) s;
    j := private.inference_latest_judgment(k.id);
  end if;
  return query select coalesce(rule.holds, false), rule.reason, k.id, state, j.judgment_kind, j.judged_at,
                      coalesce(state = 'current' and j.judgment_kind in ('not_material', 'disagree'), false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Reuse (IX-13, PD-13a): the kept interpretation to show instead of calling
-- the provider, when all hold:
--   - same kind and full subject;
--   - current (every basis digest re-emits identically, nothing removed, no
--     class withdrawn) and not superseded;
--   - the kind's current prompt version;
--   - the configured provider and requested model;
--   - its resolved model is the one the requested model most recently
--     resolved to on this engagement: a resolved-model change ends reuse even
--     when provider, alias and prompt are unchanged.
-- The application also requires the resolved model to be evaluated for the
-- prompt version. Reuse calls no provider and writes no audit row.
-- -----------------------------------------------------------------------------
create function public.current_architecture_inference(
  p_engagement_id    uuid,
  p_kind             text,
  p_subject          jsonb,
  p_prompt_version   text,
  p_provider_key     text,
  p_requested_model  text
)
returns table (inference_id uuid, resolved_model text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k public.architecture_inferences;
  observed text;
  state text;
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not private.can_use_architecture_intelligence(p_engagement_id) then
    raise exception 'You do not hold use_architecture_intelligence on this engagement' using errcode = '42501';
  end if;
  k := private.latest_kept_inference(p_engagement_id, p_kind, p_subject);
  if k.id is null or k.prompt_version is distinct from p_prompt_version or k.provider_key is distinct from p_provider_key
     or k.requested_model is distinct from p_requested_model then
    return;
  end if;
  select s.state into state from public.architecture_inference_state(p_engagement_id, k.id) s;
  if state is distinct from 'current' then
    return;
  end if;
  select r.resolved_model into observed from public.architecture_intelligence_requests r
  where r.engagement_id = p_engagement_id and r.provider_key = p_provider_key
    and r.requested_model = p_requested_model and r.resolved_model is not null
  order by r.completed_at desc, r.id desc
  limit 1;
  if observed is distinct from k.resolved_model then
    return;
  end if;
  return query select k.id, k.resolved_model;
end;
$$;

-- A citation label for one basis row, from its identity: reference codes
-- and versions, never content beyond an Evidence title.
create function private.ai_basis_label(b public.architecture_inference_basis)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case b.record_type
    when 'element_version' then
      (select e.reference_code || ' v' || v.version_no from public.architecture_elements e
       join public.element_versions v on v.id = b.version_id where e.id = b.record_id)
    when 'element_working' then
      (select e.reference_code || ' (working)' from public.architecture_elements e where e.id = b.record_id)
    when 'revision' then
      (select e.reference_code || ' v' || v.version_no || ' revision' from public.architecture_elements e
       join public.element_versions v on v.id = b.version_id where e.id = b.record_id)
    when 'relationship' then
      (select s.reference_code || ' ' || replace(r.relationship_type::text, '_', ' ') || ' ' || t.reference_code
       from public.architecture_relationships r
       join public.architecture_elements s on s.id = r.source_element_id
       join public.architecture_elements t on t.id = r.target_element_id
       where r.id = b.record_id)
    when 'impact_reach' then
      (select e.reference_code || ' (reached from ' || a.reference_code || ')' from public.architecture_elements e
       join public.architecture_elements a on a.id = b.anchor_id where e.id = b.record_id)
    when 'edge_item' then
      (select 'Edge item on ' || e.reference_code from public.architecture_elements e where e.id = b.record_id)
    when 'evidence_link' then
      coalesce((select 'Evidence: ' || s.title from public.statement_evidence_links l
                join public.evidence_sources s on s.id = l.evidence_source_id where l.id = b.record_id),
               (select 'Evidence: ' || s.title from public.element_evidence_links l
                join public.evidence_sources s on s.id = l.evidence_source_id where l.id = b.record_id))
    when 'acceptance_criterion' then
      (select c.reference_code from public.acceptance_criteria c where c.id = b.record_id)
    when 'review_capture' then
      (select e.reference_code || ' examined set' from public.architecture_elements e where e.id = b.record_id)
    when 'checkpoint' then
      (select 'Checkpoint: ' || c.title from public.implementation_checkpoints c where c.id = b.record_id)
  end;
$$;

-- A display name for a person, for provenance only.
create function private.ai_person_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
  from public.profiles p where p.id = p_user_id;
$$;

-- -----------------------------------------------------------------------------
-- One kept inference, for its drawer: the interpretation, its subject, its
-- generation provenance (the requester is provenance, shown in "How this was
-- produced"), its computed state, citation labels for its handles, and its
-- judgments, newest first. Holders of use only.
-- -----------------------------------------------------------------------------
create function public.architecture_inference_detail(p_engagement_id uuid, p_inference_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  i public.architecture_inferences;
  s record;
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not private.can_use_architecture_intelligence(p_engagement_id) then
    raise exception 'You do not hold use_architecture_intelligence on this engagement' using errcode = '42501';
  end if;
  select * into i from public.architecture_inferences where id = p_inference_id and engagement_id = p_engagement_id;
  if i.id is null then
    raise exception 'Interpretation not found' using errcode = 'P0002';
  end if;
  select * into s from public.architecture_inference_state(p_engagement_id, i.id);
  return jsonb_build_object(
    'id', i.id, 'inference_kind', i.inference_kind, 'output_schema_version', i.output_schema_version,
    'subject', jsonb_strip_nulls(jsonb_build_object(
      'type', i.subject_type, 'element_id', i.subject_element_id, 'second_element_id', i.subject_second_element_id,
      'version_id', i.subject_version_id, 'rule_key', i.subject_rule_key, 'fingerprint', i.subject_fingerprint,
      'link_id', i.subject_link_id, 'link_type', i.subject_link_type)),
    'epistemic_status', i.epistemic_status, 'producer', i.producer,
    'assertion', i.assertion, 'claims', i.claims, 'uncertainty', i.uncertainty, 'examination', i.examination,
    'payload', i.payload,
    'provenance', jsonb_build_object(
      'provider_key', i.provider_key, 'requested_model', i.requested_model, 'resolved_model', i.resolved_model,
      'prompt_version', i.prompt_version, 'generation_policy_version', i.generation_policy_version,
      'tool_contract_version', i.tool_contract_version, 'requested_at', i.requested_at, 'kept_at', i.kept_at,
      'requested_by_name', private.ai_person_name(i.requested_by)),
    'state', s.state, 'stale_reasons', coalesce(to_jsonb(s.stale_reasons), '[]'::jsonb),
    'citations', coalesce((select jsonb_object_agg(b.handle, jsonb_build_object(
                                     'label', coalesce(private.ai_basis_label(b), b.record_type),
                                     'element_id', b.element_id, 'record_type', b.record_type))
                           from public.architecture_inference_basis b where b.inference_id = i.id), '{}'::jsonb),
    'judgments', coalesce((select jsonb_agg(jsonb_build_object(
                                     'kind', j.judgment_kind, 'reason', j.reason, 'expires_on', j.expires_on,
                                     'judged_by_name', private.ai_person_name(j.judged_by), 'judged_at', j.judged_at,
                                     'promotion_target_kind', j.promotion_target_kind,
                                     'promotion_target_code', coalesce(
                                       (select x.reference_code from public.architecture_elements x
                                        where x.id = j.promotion_target_element_id),
                                       (select c.reference_code from public.acceptance_criteria c
                                        where c.id = j.promotion_target_criterion_id)))
                                   order by j.judged_at desc, j.id desc)
                           from public.architecture_inference_judgments j where j.inference_id = i.id), '[]'::jsonb)
  );
end;
$$;

-- The nearest governance date bearing on an element, on or after today: the
-- next scheduled Review examining it, an open Decision's needed-by date, an
-- unachieved checkpoint's target. Used only to order Suggested
-- interpretations, never to rank them.
create function private.ai_element_governance_date(p_engagement_id uuid, p_element_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select least(
    (select min(rv.scheduled_for::date) from public.reviews rv
     join public.architecture_relationships x on x.source_element_id = rv.element_id
     where rv.engagement_id = p_engagement_id and rv.review_status = 'scheduled'
       and rv.scheduled_for::date >= private.business_today()
       and x.relationship_type = 'examines' and x.retired_at is null and x.target_element_id = p_element_id),
    (select d.needed_by from public.decisions d
     where d.element_id = p_element_id and d.decision_status = 'open' and d.needed_by >= private.business_today()),
    (select min(c.target_on) from public.implementation_checkpoints c
     where c.implementation_element_id = p_element_id and c.achieved_on is null
       and c.target_on >= private.business_today())
  );
$$;

-- -----------------------------------------------------------------------------
-- Suggested interpretations (IX-17, PD-15): kept tension, evidence_bearing
-- and realization_reading inferences that are current and whose latest
-- judgment is none, investigating, or a deferral whose date has come.
-- Outside the Edge's tiers: never mixed into edge_items, never counted,
-- ordered only by the subject's nearest governance date and then keep time.
-- An empty set for anyone without use_architecture_intelligence.
-- -----------------------------------------------------------------------------
create function public.suggested_interpretations(p_engagement_id uuid)
returns table (
  inference_id            uuid,
  inference_kind          text,
  subject_type            text,
  subject_element_id      uuid,
  subject_reference_code  text,
  subject_title           text,
  subject_kind            text,
  second_element_id       uuid,
  second_reference_code   text,
  second_title            text,
  link_id                 uuid,
  link_type               text,
  assertion               text,
  requested_at            timestamptz,
  kept_at                 timestamptz,
  judgment_kind           text,
  judged_at               timestamptz,
  governance_date         date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not private.can_use_architecture_intelligence(p_engagement_id) then
    return;
  end if;
  return query
    select k.id, k.inference_kind, k.subject_type, k.subject_element_id, a.reference_code, a.title, a.kind::text,
           k.subject_second_element_id, b.reference_code, b.title, k.subject_link_id, k.subject_link_type,
           k.assertion, k.requested_at, k.kept_at, lj.judgment_kind, lj.judged_at,
           least(private.ai_element_governance_date(p_engagement_id, k.subject_element_id),
                 case when k.subject_second_element_id is not null
                      then private.ai_element_governance_date(p_engagement_id, k.subject_second_element_id) end)
    from public.architecture_inferences k
    join public.architecture_inference_state(p_engagement_id) s on s.inference_id = k.id
    join public.architecture_elements a on a.id = k.subject_element_id
    left join public.architecture_elements b on b.id = k.subject_second_element_id
    left join lateral (select * from private.inference_latest_judgment(k.id)) lj on true
    where k.engagement_id = p_engagement_id and k.kept_at is not null
      and k.inference_kind in ('tension', 'evidence_bearing', 'realization_reading')
      and s.state = 'current'
      and (lj.id is null or lj.judgment_kind = 'investigating'
           or (lj.judgment_kind = 'deferred' and lj.expires_on <= private.business_today()))
    order by 18 asc nulls last, k.kept_at desc, k.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- The kept-interpretations register (PD-16): every kept inference on the
-- engagement with its state and latest judgment, newest kept first,
-- optionally filtered by kind and state. A governance and archive surface:
-- no requester in the list, no counts per person, no ranking or scoring.
-- An empty set for anyone without use_architecture_intelligence.
-- -----------------------------------------------------------------------------
create function public.kept_architecture_inferences(
  p_engagement_id uuid,
  p_kind          text default null,
  p_state         text default null
)
returns table (
  inference_id            uuid,
  inference_kind          text,
  subject_type            text,
  subject_element_id      uuid,
  subject_reference_code  text,
  subject_title           text,
  subject_kind            text,
  second_element_id       uuid,
  second_reference_code   text,
  subject_version_id      uuid,
  subject_rule_key        text,
  subject_fingerprint     text,
  link_id                 uuid,
  link_type               text,
  assertion               text,
  state                   text,
  stale_reasons           text[],
  judgment_kind           text,
  judged_at               timestamptz,
  requested_at            timestamptz,
  kept_at                 timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not private.can_use_architecture_intelligence(p_engagement_id) then
    return;
  end if;
  return query
    select k.id, k.inference_kind, k.subject_type, k.subject_element_id, a.reference_code, a.title, a.kind::text,
           k.subject_second_element_id, b.reference_code, k.subject_version_id, k.subject_rule_key,
           k.subject_fingerprint, k.subject_link_id, k.subject_link_type, k.assertion, s.state, s.stale_reasons,
           lj.judgment_kind, lj.judged_at, k.requested_at, k.kept_at
    from public.architecture_inferences k
    join public.architecture_inference_state(p_engagement_id) s on s.inference_id = k.id
    join public.architecture_elements a on a.id = k.subject_element_id
    left join public.architecture_elements b on b.id = k.subject_second_element_id
    left join lateral (select * from private.inference_latest_judgment(k.id)) lj on true
    where k.engagement_id = p_engagement_id and k.kept_at is not null
      and (p_kind is null or k.inference_kind = p_kind)
      and (p_state is null or s.state = p_state)
    order by k.kept_at desc, k.id;
end;
$$;

revoke all on function private.inference_matches(public.architecture_inferences, text, jsonb) from public, anon, authenticated;
revoke all on function private.latest_kept_inference(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.ai_availability_rule(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.ai_basis_label(public.architecture_inference_basis) from public, anon, authenticated;
revoke all on function private.ai_person_name(uuid) from public, anon, authenticated;
revoke all on function private.ai_element_governance_date(uuid, uuid) from public, anon, authenticated;

revoke all on function public.architecture_intelligence_availability(uuid, text, jsonb) from public, anon;
revoke all on function public.current_architecture_inference(uuid, text, jsonb, text, text, text) from public, anon;
revoke all on function public.architecture_inference_detail(uuid, uuid) from public, anon;
revoke all on function public.suggested_interpretations(uuid) from public, anon;
revoke all on function public.kept_architecture_inferences(uuid, text, text) from public, anon;
grant execute on function public.architecture_intelligence_availability(uuid, text, jsonb) to authenticated;
grant execute on function public.current_architecture_inference(uuid, text, jsonb, text, text, text) to authenticated;
grant execute on function public.architecture_inference_detail(uuid, uuid) to authenticated;
grant execute on function public.suggested_interpretations(uuid) to authenticated;
grant execute on function public.kept_architecture_inferences(uuid, text, text) to authenticated;
