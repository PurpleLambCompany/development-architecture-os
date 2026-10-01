-- =============================================================================
-- Phase 7B.2: Architecture Intelligence Experience. Migration 2 of 8.
-- Persistence intent: what makes keeping possible without a new secret
-- (IX-12, PD-3, PD-4, PD-5, PD-21; proposal §14, §15; ADR-0069).
--
-- The application path generates interpretations ephemerally. An
-- interpretation becomes a stored inference only when its requester keeps
-- it, or judges it (which keeps it), and what is stored must be exactly
-- what the person was shown: never regenerated, never text the browser sent.
--
-- Mechanism (PD-4: no new long-lived secret). When the Gateway returns a
-- valid interpretation, the recording operation verifies its basis exactly
-- as it does for a persisted inference and holds the validated output in
-- `pending_architecture_inferences`, keyed by the request that produced it,
-- for thirty minutes. Keeping (migration 4) names only the request: the
-- database supplies the content. That gives:
--   - exact-output integrity: the only copy is the one the Gateway validated
--     and returned in the same call; Keep sends no content (see ADR-0069 on
--     the recording operation's trust boundary, inherited from 7B.1);
--   - requester binding: the row records the requester, and only they can
--     keep it;
--   - subject and kind binding: the request row fixes kind and subject;
--   - basis binding: the basis digests are verified at generation and again
--     at keep;
--   - expiry: thirty minutes, enforced on every read;
--   - replay resistance: one row per request, removed when kept, and a
--     request can produce at most one inference.
-- The table is short-lived working state, not history. No role can read it
-- (no select grant, no policy); only the recording and keep operations touch
-- it. Expired rows are removed by every recording or keep operation in the
-- deployment, and every row of an engagement is removed when its
-- external-processing authorization changes. Not in activity_log (OD-10).
--
-- Also here: `architecture_inferences.kept_at`, the recording operation
-- replaced once for 7B.2 (the `interpret_again` flag, `nothing_to_add`, and
-- the pending output), and computed staleness corrected so that
-- "superseded" compares the full subject, not only its first element.
-- =============================================================================

alter table public.architecture_inferences add column kept_at timestamptz;

comment on column public.architecture_inferences.kept_at is
  'When a person kept this interpretation (ADR-0069). Null for evaluation-harness rows recorded in persist mode.';

create table public.pending_architecture_inferences (
  request_id     uuid primary key,
  engagement_id  uuid not null references public.engagements (id) on delete restrict,
  requested_by   uuid not null references public.profiles (id) on delete restrict,
  -- The validated output, its subject columns and its verified basis, in the
  -- recording operation's inference shape. Never readable by any role.
  inference      jsonb not null check (jsonb_typeof(inference) = 'object'),
  created_at     timestamptz not null default clock_timestamp(),
  expires_at     timestamptz not null,
  constraint pending_architecture_inferences_request_fk foreign key (request_id, engagement_id)
    references public.architecture_intelligence_requests (id, engagement_id) on delete restrict,
  constraint pending_architecture_inferences_expiry check (expires_at > created_at
                                                           and expires_at <= created_at + interval '30 minutes')
);
create index pending_architecture_inferences_expiry_idx on public.pending_architecture_inferences (expires_at);
create index pending_architecture_inferences_engagement_idx on public.pending_architecture_inferences (engagement_id);

comment on table public.pending_architecture_inferences is
  'Short-lived holding of a returned interpretation so its requester can keep exactly what was shown (ADR-0069). No read access for any role.';

create function private.guard_pending_architecture_inference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'A pending interpretation is never changed' using errcode = '23514';
  end if;
  if coalesce(current_setting('dsa.ai_pending', true), 'off') <> 'on' then
    raise exception 'Pending interpretations are written only through their operations' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.requested_by := auth.uid();
    new.created_at := clock_timestamp();
    new.expires_at := new.created_at + interval '30 minutes';
    return new;
  end if;
  return old;
end;
$$;

create trigger pending_architecture_inferences_guard before insert or update or delete
  on public.pending_architecture_inferences
  for each row execute function private.guard_pending_architecture_inference();

alter table public.pending_architecture_inferences enable row level security;
revoke all on public.pending_architecture_inferences from public, anon, authenticated;

-- Remove expired pending interpretations, everywhere. Called by every
-- recording and keep operation.
create function private.purge_expired_pending_inferences()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('dsa.ai_pending', 'on', true);
  delete from public.pending_architecture_inferences where expires_at <= clock_timestamp();
  perform set_config('dsa.ai_pending', 'off', true);
end;
$$;

-- A new authorization version (a revocation, a change of classes or
-- provider, or a renewal) ends keeping for everything generated under the
-- earlier one: keeping requires the same authorization in force anyway.
create function private.purge_pending_inferences_on_authorization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('dsa.ai_pending', 'on', true);
  delete from public.pending_architecture_inferences where engagement_id = new.engagement_id;
  perform set_config('dsa.ai_pending', 'off', true);
  return null;
end;
$$;

create trigger engagement_ai_authorizations_purge_pending after insert on public.engagement_ai_authorizations
  for each row execute function private.purge_pending_inferences_on_authorization();

-- -----------------------------------------------------------------------------
-- Verify an inference record against the Tool Contract now: every basis row
-- re-emits identically (same class, not withheld, same digest) and every
-- claim cites only basis handles. Returns the handles cited. Shared by the
-- recording operation (persisted and returned outcomes) and keeping.
-- -----------------------------------------------------------------------------
create function private.verify_inference_basis(p_engagement_id uuid, p_inference jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b jsonb;
  now_row public.ai_context_row;
  handles text[] := '{}';
  claim jsonb;
  cite jsonb;
  cited_handles text[] := '{}';
begin
  if jsonb_typeof(p_inference -> 'basis') is distinct from 'array'
     or jsonb_array_length(p_inference -> 'basis') = 0 then
    raise exception 'An inference rests on a basis' using errcode = '23514';
  end if;
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
  if jsonb_typeof(p_inference -> 'claims') is distinct from 'array' then
    raise exception 'Every claim cites its basis' using errcode = '23514';
  end if;
  for claim in select * from jsonb_array_elements(p_inference -> 'claims') loop
    if jsonb_typeof(claim -> 'cites') is distinct from 'array' or jsonb_array_length(claim -> 'cites') = 0 then
      raise exception 'Every claim cites its basis' using errcode = '23514';
    end if;
    for cite in select * from jsonb_array_elements(claim -> 'cites') loop
      if split_part(cite #>> '{}', '.', 1) <> all (handles) then
        raise exception 'A claim cites something DSA did not provide' using errcode = '23514';
      end if;
      cited_handles := cited_handles || split_part(cite #>> '{}', '.', 1);
    end loop;
  end loop;
  return cited_handles;
end;
$$;

-- Insert an inference and its basis. Callers have verified it; the marker
-- is the guard's proof that one of the two operations is writing.
create function private.insert_architecture_inference(
  p_engagement_id   uuid,
  p_request         public.architecture_intelligence_requests,
  p_inference       jsonb,
  p_cited_handles   text[],
  p_kept_at         timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inference_id uuid;
begin
  perform set_config('dsa.ai_inference', 'on', true);
  insert into public.architecture_inferences (
    engagement_id, request_id, authorization_id, inference_kind, output_schema_version, subject_type,
    subject_element_id, subject_second_element_id, subject_version_id, subject_rule_key, subject_fingerprint,
    subject_link_id, subject_link_type, assertion, claims, uncertainty, examination, payload, provider_key,
    requested_model, resolved_model, reasoning_effort, prompt_id, prompt_version, prompt_content_hash,
    generation_policy_version, tool_contract_version, provider_request_id, input_tokens, output_tokens,
    reasoning_tokens, requested_by, requested_at, kept_at
  ) values (
    p_engagement_id, p_request.id, p_request.authorization_id, p_request.inference_kind,
    p_inference ->> 'output_schema_version', p_request.subject_type, p_request.subject_element_id,
    (p_inference ->> 'subject_second_element_id')::uuid, (p_inference ->> 'subject_version_id')::uuid,
    p_inference ->> 'subject_rule_key', p_inference ->> 'subject_fingerprint',
    (p_inference ->> 'subject_link_id')::uuid, p_inference ->> 'subject_link_type',
    p_inference ->> 'assertion', p_inference -> 'claims', coalesce(p_inference ->> 'uncertainty', ''),
    coalesce(p_inference -> 'examination', '[]'::jsonb), coalesce(p_inference -> 'payload', '{}'::jsonb),
    p_request.provider_key, p_request.requested_model, p_request.resolved_model,
    p_inference ->> 'reasoning_effort', p_request.prompt_id, p_request.prompt_version,
    p_inference ->> 'prompt_content_hash', p_request.generation_policy_version, p_request.tool_contract_version,
    p_request.provider_request_id, p_request.input_tokens, p_request.output_tokens, p_request.reasoning_tokens,
    p_request.requested_by, p_request.requested_at, p_kept_at
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
         (x ->> 'handle') = any (p_cited_handles)
  from jsonb_array_elements(p_inference -> 'basis') x;
  perform set_config('dsa.ai_inference', 'off', true);
  return inference_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- The recording operation, replaced for 7B.2. Unchanged from 7B.1 except:
--   - the request may carry `interpret_again`;
--   - `nothing_to_add` is a model outcome that carries no inference;
--   - a `returned` request may carry its validated output, which is verified
--     like a persisted inference and held as a pending interpretation for
--     its requester to keep (ADR-0069);
--   - every call removes expired pending interpretations.
-- -----------------------------------------------------------------------------
create or replace function public.record_architecture_intelligence_request(
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
  req public.architecture_intelligence_requests;
  current_auth public.engagement_ai_authorizations;
  cited_handles text[] := '{}';
  outcome text := p_request ->> 'outcome';
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_request) is distinct from 'object' then
    raise exception 'A request record is required' using errcode = '23514';
  end if;
  -- Exactly the fields this operation records, so nothing else (a prompt, a
  -- response, a person) can be smuggled into the audit through it.
  if exists (select 1 from jsonb_object_keys(p_request) k where k <> all (array[
       'outcome', 'mode', 'inference_kind', 'subject_type', 'subject_element_id', 'authorization_id', 'requested_at',
       'prompt_id', 'prompt_version', 'generation_policy_version', 'tool_contract_version', 'provider_key',
       'requested_model', 'resolved_model', 'provider_request_id', 'manifest', 'tool_calls', 'input_tokens',
       'output_tokens', 'reasoning_tokens', 'estimated_cost_usd', 'error_class', 'interpret_again']))
     or (p_inference is not null and jsonb_typeof(p_inference) = 'object'
         and exists (select 1 from jsonb_object_keys(p_inference) k where k <> all (array[
       'output_schema_version', 'assertion', 'claims', 'uncertainty', 'examination', 'payload', 'basis',
       'prompt_content_hash', 'reasoning_effort', 'subject_second_element_id', 'subject_version_id',
       'subject_rule_key', 'subject_fingerprint', 'subject_link_id', 'subject_link_type']))) then
    raise exception 'Unknown field in the request record' using errcode = '23514';
  end if;
  if p_request ? 'interpret_again' and jsonb_typeof(p_request -> 'interpret_again') <> 'boolean' then
    raise exception 'interpret_again is true or false' using errcode = '23514';
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
  -- A persisted outcome always carries its inference. A returned outcome may
  -- carry its validated output, to be held for keeping. No other outcome
  -- carries one: nothing_to_add and every refusal leave no content.
  if outcome = 'persisted' and p_inference is null then
    raise exception 'Only a persisted outcome carries an inference, and it always does' using errcode = '23514';
  end if;
  if p_inference is not null and outcome is distinct from 'persisted' and outcome is distinct from 'returned' then
    raise exception 'Only a persisted outcome carries an inference, and it always does' using errcode = '23514';
  end if;
  if outcome = 'persisted' and p_request ->> 'mode' is distinct from 'persist' then
    raise exception 'Only a persist request records an inference' using errcode = '23514';
  end if;
  if outcome = 'returned' and p_inference is not null and p_request ->> 'mode' is distinct from 'ephemeral' then
    raise exception 'Only an ephemeral request holds an interpretation for keeping' using errcode = '23514';
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

  perform private.purge_expired_pending_inferences();

  if p_inference is not null then
    -- Re-check everything the invocation relied on, now. The shared lock
    -- serializes with set_engagement_ai_authorization's exclusive one: a
    -- revocation either committed before this check (and is seen) or waits
    -- until this record is written under the authorization it was made
    -- under (and then removes any pending interpretation).
    perform pg_advisory_xact_lock_shared(hashtextextended('ai_authorization:' || p_engagement_id::text, 0));
    perform private.require_ai_context(p_engagement_id);
    current_auth := private.current_ai_authorization(p_engagement_id);
    if current_auth.id is distinct from (p_request ->> 'authorization_id')::uuid then
      raise exception 'The authorization changed during the request' using errcode = '42501';
    end if;
    -- A fabricated or altered basis cannot be recorded or held.
    cited_handles := private.verify_inference_basis(p_engagement_id, p_inference);
  end if;

  perform set_config('dsa.ai_request', 'on', true);
  insert into public.architecture_intelligence_requests (
    engagement_id, requested_by, requested_at, inference_kind, mode, subject_type, subject_element_id, outcome,
    authorization_id, prompt_id, prompt_version, generation_policy_version, tool_contract_version, provider_key,
    requested_model, resolved_model, provider_request_id, manifest, tool_calls, input_tokens, output_tokens,
    reasoning_tokens, estimated_cost_usd, error_class, interpret_again
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
    p_request ->> 'error_class', coalesce((p_request ->> 'interpret_again')::boolean, false)
  )
  returning * into req;
  request_id := req.id;
  perform set_config('dsa.ai_request', 'off', true);

  if p_inference is not null and outcome = 'persisted' then
    perform private.insert_architecture_inference(p_engagement_id, req, p_inference, cited_handles, null);
  elsif p_inference is not null then
    perform set_config('dsa.ai_pending', 'on', true);
    insert into public.pending_architecture_inferences (request_id, engagement_id, requested_by, inference, expires_at)
    values (request_id, p_engagement_id, auth.uid(), p_inference, clock_timestamp() + interval '30 minutes');
    perform set_config('dsa.ai_pending', 'off', true);
  end if;

  return request_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Two inferences are about the same subject when kind and every subject
-- column match (the Edge item's fingerprint, the revision's version, the
-- pair's second element, the evidence link). Used for supersession, reuse
-- and suppression.
-- -----------------------------------------------------------------------------
create function private.same_inference_subject(a public.architecture_inferences, b public.architecture_inferences)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select a.engagement_id = b.engagement_id and a.inference_kind = b.inference_kind
     and a.subject_type = b.subject_type and a.subject_element_id = b.subject_element_id
     and a.subject_second_element_id is not distinct from b.subject_second_element_id
     and a.subject_version_id is not distinct from b.subject_version_id
     and a.subject_rule_key is not distinct from b.subject_rule_key
     and a.subject_fingerprint is not distinct from b.subject_fingerprint
     and a.subject_link_id is not distinct from b.subject_link_id
     and a.subject_link_type is not distinct from b.subject_link_type;
$$;

-- -----------------------------------------------------------------------------
-- Staleness, computed on read (ADR-0064), replaced: identical, except that an
-- inference is superseded only by a later inference of the same kind on the
-- same full subject. The newest stays current; earlier ones stay as history
-- (PD-7: never overwritten or deleted).
-- -----------------------------------------------------------------------------
create or replace function public.architecture_inference_state(p_engagement_id uuid, p_inference_id uuid default null)
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
      select i.id, i.inference_kind, i.created_at,
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
             when exists (select 1 from public.architecture_inferences me
                          join public.architecture_inferences later
                            on later.engagement_id = me.engagement_id and later.created_at > me.created_at
                          where me.id = r.id and private.same_inference_subject(later, me))
               then 'superseded'
             else 'current'
           end,
           r.why
    from reasons r
    order by r.created_at;
end;
$$;

revoke all on function private.guard_pending_architecture_inference() from public, anon, authenticated;
revoke all on function private.purge_expired_pending_inferences() from public, anon, authenticated;
revoke all on function private.purge_pending_inferences_on_authorization() from public, anon, authenticated;
revoke all on function private.verify_inference_basis(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.insert_architecture_inference(uuid, public.architecture_intelligence_requests, jsonb,
                                                             text[], timestamptz) from public, anon, authenticated;
revoke all on function private.same_inference_subject(public.architecture_inferences, public.architecture_inferences)
  from public, anon, authenticated;
