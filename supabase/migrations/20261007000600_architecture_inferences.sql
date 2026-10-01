-- =============================================================================
-- Phase 7B.1: Architecture Intelligence Foundation. Migration 7 of 7.
-- The inference envelope, its pinned basis, the one recording operation and
-- computed staleness (B-7, B-11, B-12, B-15, B-31; OD-11, OD-13; proposal
-- §13 to §16, §20, §23; ADR-0064).
--
-- An inference is a model-produced, structured, cited interpretation
-- grounded in governed DSA state. It is never an element, statement,
-- Evidence, Project Intelligence, a Review or an acceptance criterion, and
-- nothing here can create or change any of them. Epistemic status is always
-- `suggested`, producer always `model` (the vocabulary ADR-0051 reserved).
--
-- Basis rows pin exactly what was placed in the model's context: record
-- identity (type, id, version) kept separately from a SHA-256 digest of the
-- exact content sent (digest version 1). The recording operation recomputes
-- every digest through the Tool Contract's own projection, so a basis can
-- never be fabricated, and refuses if the authorization in force changed
-- since the invocation began.
--
-- Staleness is computed on read, never stored, and never refreshes an
-- inference (B-25). Readable only by current holders of
-- use_architecture_intelligence (OD-11). No client access. Not in
-- activity_log (OD-10).
-- =============================================================================

create table public.architecture_inferences (
  id                          uuid primary key default gen_random_uuid(),
  engagement_id               uuid not null references public.engagements (id) on delete restrict,
  request_id                  uuid not null,
  authorization_id            uuid not null,
  inference_kind              text not null check (inference_kind = any (private.ai_inference_kinds())),
  output_schema_version       text not null check (char_length(output_schema_version) between 1 and 40),
  subject_type                text not null check (subject_type in ('element', 'element_pair', 'edge_item', 'revision',
                                                                    'impact_trace', 'evidence_link')),
  subject_element_id          uuid not null,
  subject_second_element_id   uuid,
  subject_version_id          uuid,
  subject_rule_key            text check (char_length(subject_rule_key) <= 100),
  subject_fingerprint         text check (char_length(subject_fingerprint) <= 1000),
  subject_link_id             uuid,
  subject_link_type           text check (subject_link_type in ('statement_link', 'element_link')),
  epistemic_status            text not null default 'suggested' check (epistemic_status = 'suggested'),
  producer                    text not null default 'model' check (producer = 'model'),
  assertion                   text not null check (char_length(btrim(assertion)) between 1 and 600),
  claims                      jsonb not null check (jsonb_typeof(claims) = 'array' and jsonb_array_length(claims) >= 1),
  uncertainty                 text not null default '' check (char_length(uncertainty) <= 600),
  examination                 jsonb not null default '[]' check (jsonb_typeof(examination) = 'array'),
  payload                     jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  -- Generation provenance (B-11): text, never enums.
  provider_key                text not null check (char_length(provider_key) between 1 and 40),
  requested_model             text not null check (char_length(requested_model) between 1 and 120),
  resolved_model              text not null check (char_length(resolved_model) between 1 and 120),
  reasoning_effort            text check (char_length(reasoning_effort) <= 20),
  prompt_id                   text not null check (char_length(prompt_id) between 1 and 100),
  prompt_version              text not null check (char_length(prompt_version) between 1 and 40),
  prompt_content_hash         text not null check (prompt_content_hash ~ '^[0-9a-f]{64}$'),
  generation_policy_version   text not null check (char_length(generation_policy_version) between 1 and 40),
  tool_contract_version       text not null check (char_length(tool_contract_version) between 1 and 40),
  provider_request_id         text check (char_length(provider_request_id) <= 200),
  input_tokens                int not null default 0 check (input_tokens >= 0),
  output_tokens               int not null default 0 check (output_tokens >= 0),
  reasoning_tokens            int not null default 0 check (reasoning_tokens >= 0),
  requested_by                uuid not null references public.profiles (id) on delete restrict,
  requested_at                timestamptz not null,
  created_at                  timestamptz not null default clock_timestamp(),
  constraint architecture_inferences_engagement_key unique (id, engagement_id),
  constraint architecture_inferences_request_unique unique (request_id),
  constraint architecture_inferences_subject check (
    case subject_type
      when 'element' then num_nonnulls(subject_second_element_id, subject_version_id, subject_rule_key,
                                       subject_fingerprint, subject_link_id, subject_link_type) = 0
      when 'impact_trace' then num_nonnulls(subject_second_element_id, subject_version_id, subject_rule_key,
                                            subject_fingerprint, subject_link_id, subject_link_type) = 0
      when 'element_pair' then subject_second_element_id is not null and subject_second_element_id <> subject_element_id
                               and num_nonnulls(subject_version_id, subject_rule_key, subject_fingerprint,
                                                subject_link_id, subject_link_type) = 0
      when 'edge_item' then subject_rule_key is not null and subject_fingerprint is not null
                            and num_nonnulls(subject_second_element_id, subject_version_id, subject_link_id,
                                             subject_link_type) = 0
      when 'revision' then subject_version_id is not null
                           and num_nonnulls(subject_second_element_id, subject_rule_key, subject_fingerprint,
                                            subject_link_id, subject_link_type) = 0
      when 'evidence_link' then subject_link_id is not null and subject_link_type is not null
                                and num_nonnulls(subject_second_element_id, subject_version_id, subject_rule_key,
                                                 subject_fingerprint) = 0
    end
  ),
  constraint architecture_inferences_request_fk foreign key (request_id, engagement_id)
    references public.architecture_intelligence_requests (id, engagement_id) on delete restrict,
  constraint architecture_inferences_authorization_fk foreign key (authorization_id, engagement_id)
    references public.engagement_ai_authorizations (id, engagement_id) on delete restrict,
  constraint architecture_inferences_subject_fk foreign key (subject_element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint architecture_inferences_second_fk foreign key (subject_second_element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict
);
create index architecture_inferences_subject_idx
  on public.architecture_inferences (engagement_id, inference_kind, subject_element_id, created_at desc);

comment on table public.architecture_inferences is
  'Persisted Architecture Intelligence inferences (ADR-0064): suggested, model-produced, cited, never governed state.';

create table public.architecture_inference_basis (
  id                  uuid primary key default gen_random_uuid(),
  inference_id        uuid not null,
  engagement_id       uuid not null,
  handle              text not null check (handle ~ '^R[0-9]{1,3}$'),
  record_type         text not null check (record_type in ('element_version', 'element_working', 'relationship',
                                                           'impact_reach', 'revision', 'edge_item', 'evidence_link',
                                                           'acceptance_criterion', 'review_capture', 'checkpoint')),
  record_id           uuid not null,
  version_id          uuid,
  anchor_id           uuid,
  variant             text check (char_length(variant) <= 100),
  -- Typed identity for the records most bases rest on (same engagement).
  element_id          uuid,
  element_version_id  uuid,
  data_class          text not null check (data_class = any (private.ai_data_classes())),
  digest              text not null check (digest ~ '^[0-9a-f]{64}$'),
  digest_version      int not null default 1 check (digest_version = 1),
  origin              text not null check (origin in ('anchor', 'tool_call')),
  cited               boolean not null,
  constraint architecture_inference_basis_handle unique (inference_id, handle),
  constraint architecture_inference_basis_inference_fk foreign key (inference_id, engagement_id)
    references public.architecture_inferences (id, engagement_id) on delete restrict,
  constraint architecture_inference_basis_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint architecture_inference_basis_version_fk foreign key (element_version_id)
    references public.element_versions (id) on delete restrict,
  constraint architecture_inference_basis_typed check (
    (record_type in ('element_version', 'element_working', 'revision', 'edge_item')) = (element_id is not null)
    and (record_type in ('element_version', 'revision')) = (element_version_id is not null)
  )
);
create index architecture_inference_basis_inference_idx on public.architecture_inference_basis (inference_id);

create function private.guard_architecture_inference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('dsa.ai_inference', true), 'off') <> 'on' then
      raise exception 'Inferences are recorded only through their operation' using errcode = '42501';
    end if;
    return new;
  end if;
  raise exception 'Inferences are append-only' using errcode = '23514';
end;
$$;

create trigger architecture_inferences_guard before insert or update or delete on public.architecture_inferences
  for each row execute function private.guard_architecture_inference();
create trigger architecture_inference_basis_guard before insert or update or delete on public.architecture_inference_basis
  for each row execute function private.guard_architecture_inference();

alter table public.architecture_inferences enable row level security;
alter table public.architecture_inference_basis enable row level security;
revoke all on public.architecture_inferences from anon, authenticated;
revoke all on public.architecture_inference_basis from anon, authenticated;
grant select on public.architecture_inferences to authenticated;
grant select on public.architecture_inference_basis to authenticated;
create policy "inferences: current use-capability holders"
  on public.architecture_inferences for select to authenticated
  using (private.can_use_architecture_intelligence(engagement_id));
create policy "inference basis: current use-capability holders"
  on public.architecture_inference_basis for select to authenticated
  using (private.can_use_architecture_intelligence(engagement_id));

-- -----------------------------------------------------------------------------
-- The one recording operation: one request row for every invocation, and,
-- for a valid persisted inference, the inference and its basis, atomically.
-- -----------------------------------------------------------------------------
create function public.record_architecture_intelligence_request(
  p_engagement_id uuid,
  p_request       jsonb,
  p_inference     jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  inference_id uuid;
  current_auth public.engagement_ai_authorizations;
  b jsonb;
  now_row public.ai_context_row;
  handles text[] := '{}';
  claim jsonb;
  cite jsonb;
  cited_handles text[] := '{}';
  outcome text := p_request ->> 'outcome';
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_request) <> 'object' then
    raise exception 'A request record is required' using errcode = '23514';
  end if;
  -- Exactly the fields this operation records, so nothing else (a prompt, a
  -- response, a person) can be smuggled into the audit through it.
  if exists (select 1 from jsonb_object_keys(p_request) k where k <> all (array[
       'outcome', 'mode', 'inference_kind', 'subject_type', 'subject_element_id', 'authorization_id', 'requested_at',
       'prompt_id', 'prompt_version', 'generation_policy_version', 'tool_contract_version', 'provider_key',
       'requested_model', 'resolved_model', 'provider_request_id', 'manifest', 'tool_calls', 'input_tokens',
       'output_tokens', 'reasoning_tokens', 'estimated_cost_usd', 'error_class']))
     or (p_inference is not null and jsonb_typeof(p_inference) = 'object'
         and exists (select 1 from jsonb_object_keys(p_inference) k where k <> all (array[
       'output_schema_version', 'assertion', 'claims', 'uncertainty', 'examination', 'payload', 'basis',
       'prompt_content_hash', 'reasoning_effort', 'subject_second_element_id', 'subject_version_id',
       'subject_rule_key', 'subject_fingerprint', 'subject_link_id', 'subject_link_type']))) then
    raise exception 'Unknown field in the request record' using errcode = '23514';
  end if;
  -- The manifest names records; the tool-call log names calls. Neither
  -- carries content.
  if exists (select 1 from jsonb_array_elements(coalesce(p_request -> 'manifest', '[]')) m,
                    jsonb_object_keys(m) k
             where k <> all (array['handle', 'record_type', 'record_id', 'version_id', 'anchor_id', 'variant',
                                   'data_class', 'digest', 'origin', 'withheld']))
     or exists (select 1 from jsonb_array_elements(coalesce(p_request -> 'tool_calls', '[]')) c,
                       jsonb_object_keys(c) k
                where k <> all (array['name', 'arguments', 'result_count', 'refused']))
     or octet_length(coalesce(p_request -> 'manifest', '[]')::text) > 65536
     or octet_length(coalesce(p_request -> 'tool_calls', '[]')::text) > 16384 then
    raise exception 'The manifest and tool-call log carry identities only' using errcode = '23514';
  end if;
  if (p_inference is not null) <> (outcome = 'persisted') then
    raise exception 'Only a persisted outcome carries an inference, and it always does' using errcode = '23514';
  end if;
  if outcome = 'persisted' and p_request ->> 'mode' is distinct from 'persist' then
    raise exception 'Only a persist request records an inference' using errcode = '23514';
  end if;
  -- A refusal (or a withdrawal that stopped the request) is recorded for
  -- anyone who can read the engagement, so every attempt is audited. Any
  -- outcome that means a model was called needs the use capability now.
  if outcome not in ('refused_mode', 'refused_capability', 'refused_authorization', 'refused_class',
                     'refused_budget', 'subject_not_found', 'authorization_withdrawn')
     and not private.can_use_architecture_intelligence(p_engagement_id) then
    raise exception 'You do not hold use_architecture_intelligence on this engagement' using errcode = '42501';
  end if;
  -- A refusal before any model call costs nothing, and a request is recorded
  -- as it completes: its start cannot be backdated out of the budget month
  -- or placed in the future.
  if outcome in ('refused_mode', 'refused_capability', 'refused_authorization', 'refused_class', 'refused_budget',
                 'subject_not_found')
     and (coalesce((p_request ->> 'estimated_cost_usd')::numeric, 0) <> 0
          or coalesce((p_request ->> 'input_tokens')::int, 0) <> 0
          or coalesce((p_request ->> 'output_tokens')::int, 0) <> 0) then
    raise exception 'A refusal before any model call carries no tokens or cost' using errcode = '23514';
  end if;
  if (p_request ->> 'requested_at') is not null
     and (p_request ->> 'requested_at')::timestamptz not between clock_timestamp() - interval '15 minutes'
                                                            and clock_timestamp() then
    raise exception 'A request is recorded as it completes' using errcode = '23514';
  end if;

  if p_inference is not null then
    -- Re-check everything the invocation relied on, now. The shared lock
    -- serializes with set_engagement_ai_authorization's exclusive one: a
    -- revocation either committed before this check (and is seen) or waits
    -- until this inference is recorded under the authorization it was made
    -- under.
    perform pg_advisory_xact_lock_shared(hashtextextended('ai_authorization:' || p_engagement_id::text, 0));
    perform private.require_ai_context(p_engagement_id);
    current_auth := private.current_ai_authorization(p_engagement_id);
    if current_auth.id is distinct from (p_request ->> 'authorization_id')::uuid then
      raise exception 'The authorization changed during the request' using errcode = '42501';
    end if;
    if jsonb_typeof(p_inference -> 'basis') <> 'array' or jsonb_array_length(p_inference -> 'basis') = 0 then
      raise exception 'An inference rests on a basis' using errcode = '23514';
    end if;
    -- Every basis row must be exactly what the Tool Contract produces now:
    -- same class, not withheld, same digest. A fabricated or altered basis
    -- cannot be recorded.
    for b in select * from jsonb_array_elements(p_inference -> 'basis') loop
      select * into now_row from private.ai_emit(
        p_engagement_id, b ->> 'record_type', (b ->> 'record_id')::uuid, (b ->> 'version_id')::uuid,
        (b ->> 'anchor_id')::uuid, b ->> 'variant');
      if not found or now_row.withheld or now_row.digest is distinct from b ->> 'digest'
         or now_row.data_class is distinct from b ->> 'data_class' then
        raise exception 'The basis does not match what DSA provided' using errcode = '23514';
      end if;
      handles := handles || (b ->> 'handle');
    end loop;
    -- Every claim cites, and cites only handles in the basis.
    for claim in select * from jsonb_array_elements(p_inference -> 'claims') loop
      if jsonb_typeof(claim -> 'cites') <> 'array' or jsonb_array_length(claim -> 'cites') = 0 then
        raise exception 'Every claim cites its basis' using errcode = '23514';
      end if;
      for cite in select * from jsonb_array_elements(claim -> 'cites') loop
        if split_part(cite #>> '{}', '.', 1) <> all (handles) then
          raise exception 'A claim cites something DSA did not provide' using errcode = '23514';
        end if;
        cited_handles := cited_handles || split_part(cite #>> '{}', '.', 1);
      end loop;
    end loop;
  end if;

  perform set_config('dsa.ai_request', 'on', true);
  insert into public.architecture_intelligence_requests (
    engagement_id, requested_by, requested_at, inference_kind, mode, subject_type, subject_element_id, outcome,
    authorization_id, prompt_id, prompt_version, generation_policy_version, tool_contract_version, provider_key,
    requested_model, resolved_model, provider_request_id, manifest, tool_calls, input_tokens, output_tokens,
    reasoning_tokens, estimated_cost_usd, error_class
  ) values (
    p_engagement_id, auth.uid(), coalesce((p_request ->> 'requested_at')::timestamptz, clock_timestamp()),
    p_request ->> 'inference_kind', p_request ->> 'mode', p_request ->> 'subject_type',
    (p_request ->> 'subject_element_id')::uuid, outcome, (p_request ->> 'authorization_id')::uuid,
    p_request ->> 'prompt_id', p_request ->> 'prompt_version', p_request ->> 'generation_policy_version',
    p_request ->> 'tool_contract_version', p_request ->> 'provider_key', p_request ->> 'requested_model',
    p_request ->> 'resolved_model', p_request ->> 'provider_request_id',
    coalesce(p_request -> 'manifest', '[]'::jsonb), coalesce(p_request -> 'tool_calls', '[]'::jsonb),
    coalesce((p_request ->> 'input_tokens')::int, 0), coalesce((p_request ->> 'output_tokens')::int, 0),
    coalesce((p_request ->> 'reasoning_tokens')::int, 0), coalesce((p_request ->> 'estimated_cost_usd')::numeric, 0),
    p_request ->> 'error_class'
  )
  returning id into request_id;
  perform set_config('dsa.ai_request', 'off', true);

  if p_inference is not null then
    perform set_config('dsa.ai_inference', 'on', true);
    insert into public.architecture_inferences (
      engagement_id, request_id, authorization_id, inference_kind, output_schema_version, subject_type,
      subject_element_id, subject_second_element_id, subject_version_id, subject_rule_key, subject_fingerprint,
      subject_link_id, subject_link_type, assertion, claims, uncertainty, examination, payload, provider_key,
      requested_model, resolved_model, reasoning_effort, prompt_id, prompt_version, prompt_content_hash,
      generation_policy_version, tool_contract_version, provider_request_id, input_tokens, output_tokens,
      reasoning_tokens, requested_by, requested_at
    ) values (
      p_engagement_id, request_id, current_auth.id, p_request ->> 'inference_kind',
      p_inference ->> 'output_schema_version', p_request ->> 'subject_type', (p_request ->> 'subject_element_id')::uuid,
      (p_inference ->> 'subject_second_element_id')::uuid, (p_inference ->> 'subject_version_id')::uuid,
      p_inference ->> 'subject_rule_key', p_inference ->> 'subject_fingerprint',
      (p_inference ->> 'subject_link_id')::uuid, p_inference ->> 'subject_link_type',
      p_inference ->> 'assertion', p_inference -> 'claims', coalesce(p_inference ->> 'uncertainty', ''),
      coalesce(p_inference -> 'examination', '[]'::jsonb), coalesce(p_inference -> 'payload', '{}'::jsonb),
      p_request ->> 'provider_key', p_request ->> 'requested_model', p_request ->> 'resolved_model',
      p_inference ->> 'reasoning_effort', p_request ->> 'prompt_id', p_request ->> 'prompt_version',
      p_inference ->> 'prompt_content_hash', p_request ->> 'generation_policy_version',
      p_request ->> 'tool_contract_version', p_request ->> 'provider_request_id',
      coalesce((p_request ->> 'input_tokens')::int, 0), coalesce((p_request ->> 'output_tokens')::int, 0),
      coalesce((p_request ->> 'reasoning_tokens')::int, 0), auth.uid(),
      coalesce((p_request ->> 'requested_at')::timestamptz, clock_timestamp())
    )
    returning id into inference_id;

    insert into public.architecture_inference_basis (
      inference_id, engagement_id, handle, record_type, record_id, version_id, anchor_id, variant, element_id,
      element_version_id, data_class, digest, digest_version, origin, cited
    )
    select inference_id, p_engagement_id, x ->> 'handle', x ->> 'record_type', (x ->> 'record_id')::uuid,
           (x ->> 'version_id')::uuid, (x ->> 'anchor_id')::uuid, x ->> 'variant',
           case when x ->> 'record_type' in ('element_version', 'element_working', 'revision', 'edge_item')
                then (x ->> 'record_id')::uuid end,
           case when x ->> 'record_type' in ('element_version', 'revision') then (x ->> 'version_id')::uuid end,
           x ->> 'data_class', x ->> 'digest', 1, coalesce(x ->> 'origin', 'anchor'),
           (x ->> 'handle') = any (cited_handles)
    from jsonb_array_elements(p_inference -> 'basis') x;
    perform set_config('dsa.ai_inference', 'off', true);
  end if;

  return request_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Staleness, computed on read (proposal §16). An inference is current when
-- every basis record still resolves to the same digest under a class still
-- authorized, and every pinned published version is still the latest.
-- -----------------------------------------------------------------------------
create function public.architecture_inference_state(p_engagement_id uuid, p_inference_id uuid default null)
returns table (inference_id uuid, inference_kind text, state text, stale_reasons text[])
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
    raise exception 'You do not hold use_architecture_intelligence on this engagement' using errcode = '42501';
  end if;
  return query
    with reasons as (
      select i.id, i.inference_kind, i.subject_element_id, i.created_at,
             array_remove(array_agg(distinct case
               when cur.content is null then 'basis_removed'
               when b.record_type = 'edge_item' then
                 case when private.ai_digest(cur.content) <> b.digest then 'edge_item_changed' end
               when b.record_type = 'element_version'
                    and el.latest_version_id is distinct from b.version_id then 'newer_version_published'
               when private.ai_digest(cur.content) <> b.digest then 'basis_changed'
             end) || array_agg(distinct case
               when not private.ai_class_authorized(p_engagement_id, b.data_class) then 'class_no_longer_authorised'
             end), null) as why
      from public.architecture_inferences i
      join public.architecture_inference_basis b on b.inference_id = i.id
      left join public.architecture_elements el on el.id = b.element_id
      left join lateral private.ai_resolve(p_engagement_id, b.record_type, b.record_id, b.version_id, b.anchor_id,
                                           b.variant) cur on true
      where i.engagement_id = p_engagement_id and (p_inference_id is null or i.id = p_inference_id)
      group by i.id
    )
    select r.id, r.inference_kind,
           case
             when cardinality(r.why) > 0 then 'stale'
             when exists (select 1 from public.architecture_inferences later
                          where later.engagement_id = p_engagement_id and later.inference_kind = r.inference_kind
                            and later.subject_element_id = r.subject_element_id and later.created_at > r.created_at)
               then 'superseded'
             else 'current'
           end,
           r.why
    from reasons r
    order by r.created_at;
end;
$$;

revoke all on function public.record_architecture_intelligence_request(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.record_architecture_intelligence_request(uuid, jsonb, jsonb) to authenticated;
revoke all on function public.architecture_inference_state(uuid, uuid) from public, anon;
grant execute on function public.architecture_inference_state(uuid, uuid) to authenticated;
