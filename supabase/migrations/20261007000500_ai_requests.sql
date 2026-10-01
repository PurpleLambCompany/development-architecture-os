-- =============================================================================
-- Phase 7B.1: Architecture Intelligence Foundation. Migration 6 of 7.
-- The request audit record and per-engagement budget (B-21; OD-10; proposal
-- §20; ADR-0066).
--
-- One append-only row per invocation, whatever its outcome, written only by
-- record_architecture_intelligence_request (migration 7). Metadata only: the
-- manifest names what was sent by type, id, version, class and digest, and
-- the tool calls by name; no prompt, context content, model output or
-- provider error body is ever stored.
--
-- For security, provenance, reliability, evaluation and cost, never for
-- productivity or performance: readable only by holders of
-- authorize_external_ai_processing on the engagement, and no read model
-- counts, totals, ranks or compares anything per person. The only
-- aggregate is per engagement: month-to-date cost against the budget.
-- Not recorded in activity_log (OD-10).
-- =============================================================================

create function private.ai_inference_kinds()
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select array['explanation', 'tension', 'evidence_bearing', 'review_brief', 'realization_reading'];
$$;

create table public.architecture_intelligence_requests (
  id                          uuid primary key default gen_random_uuid(),
  engagement_id               uuid not null references public.engagements (id) on delete restrict,
  requested_by                uuid not null references public.profiles (id) on delete restrict,
  requested_at                timestamptz not null,
  completed_at                timestamptz not null default clock_timestamp(),
  inference_kind              text not null check (inference_kind = any (private.ai_inference_kinds())),
  mode                        text not null check (mode in ('ephemeral', 'persist')),
  -- What the request was about, when it resolved to a record.
  subject_type                text check (subject_type in ('element', 'element_pair', 'edge_item', 'revision',
                                                           'impact_trace', 'evidence_link')),
  subject_element_id          uuid,
  outcome                     text not null check (outcome in (
                                'persisted', 'returned', 'refused_mode', 'refused_capability',
                                'refused_authorization', 'refused_class', 'refused_budget', 'subject_not_found',
                                'provider_error', 'refusal', 'invalid_output', 'unknown_citation',
                                'model_not_evaluated', 'authorization_withdrawn')),
  authorization_id            uuid,
  prompt_id                   text check (char_length(prompt_id) <= 100),
  prompt_version              text check (char_length(prompt_version) <= 40),
  generation_policy_version   text check (char_length(generation_policy_version) <= 40),
  tool_contract_version       text check (char_length(tool_contract_version) <= 40),
  provider_key                text check (char_length(provider_key) <= 40),
  requested_model             text check (char_length(requested_model) <= 120),
  resolved_model              text check (char_length(resolved_model) <= 120),
  provider_request_id         text check (char_length(provider_request_id) <= 200),
  -- [{record_type, record_id, version_id, anchor_id, variant, data_class, digest, origin, withheld}]
  manifest                    jsonb not null default '[]' check (jsonb_typeof(manifest) = 'array'),
  -- [{name, arguments: {handles and codes only}}], in order; never results.
  tool_calls                  jsonb not null default '[]' check (jsonb_typeof(tool_calls) = 'array'),
  input_tokens                int not null default 0 check (input_tokens >= 0),
  output_tokens               int not null default 0 check (output_tokens >= 0),
  reasoning_tokens            int not null default 0 check (reasoning_tokens >= 0),
  estimated_cost_usd          numeric(12, 6) not null default 0 check (estimated_cost_usd >= 0),
  error_class                 text check (error_class in ('timeout', 'rate_limited', 'provider_unavailable',
                                                          'bad_request', 'auth', 'other')),
  constraint architecture_intelligence_requests_engagement_key unique (id, engagement_id),
  constraint architecture_intelligence_requests_element_fk foreign key (subject_element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint architecture_intelligence_requests_authorization_fk foreign key (authorization_id, engagement_id)
    references public.engagement_ai_authorizations (id, engagement_id) on delete restrict
);
create index architecture_intelligence_requests_month_idx
  on public.architecture_intelligence_requests (engagement_id, requested_at desc);

comment on table public.architecture_intelligence_requests is
  'Metadata-only audit of every Architecture Intelligence invocation (ADR-0066). No content. Never aggregated per person.';

create function private.guard_architecture_intelligence_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('dsa.ai_request', true), 'off') <> 'on' then
      raise exception 'Requests are recorded only through their operation' using errcode = '42501';
    end if;
    new.requested_by := auth.uid();
    new.completed_at := clock_timestamp();
    return new;
  end if;
  raise exception 'The request record is append-only' using errcode = '23514';
end;
$$;

create trigger architecture_intelligence_requests_guard before insert or update or delete
  on public.architecture_intelligence_requests
  for each row execute function private.guard_architecture_intelligence_request();

alter table public.architecture_intelligence_requests enable row level security;
revoke all on public.architecture_intelligence_requests from anon, authenticated;
grant select on public.architecture_intelligence_requests to authenticated;
create policy "ai requests: authorizers"
  on public.architecture_intelligence_requests for select to authenticated
  using (private.can_authorize_external_ai_processing(engagement_id));

-- The engagement's budget position for the current calendar month (UTC):
-- the only aggregate over requests, and it is per engagement. Readable by
-- anyone who may use or authorize Architecture Intelligence on it, because
-- the Gateway enforces the budget as the requesting user.
create function public.architecture_intelligence_budget(p_engagement_id uuid)
returns table (
  monthly_budget_usd  numeric,
  month_to_date_usd   numeric,
  month_requests      int,
  month_started_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.engagement_ai_authorizations;
  month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not (private.can_use_architecture_intelligence(p_engagement_id)
          or private.can_authorize_external_ai_processing(p_engagement_id)) then
    raise exception 'You do not hold Architecture Intelligence authority on this engagement' using errcode = '42501';
  end if;
  a := private.current_ai_authorization(p_engagement_id);
  return query
    select case when a.state = 'authorized' then a.monthly_budget_usd end,
           coalesce(sum(r.estimated_cost_usd), 0)::numeric,
           count(r.id)::int,
           month_start
    from public.architecture_intelligence_requests r
    where r.engagement_id = p_engagement_id and r.requested_at >= month_start;
end;
$$;

revoke all on function public.architecture_intelligence_budget(uuid) from public, anon;
grant execute on function public.architecture_intelligence_budget(uuid) to authenticated;

-- The requesting person's standing on the engagement, for the Gateway's
-- checks before any data is read (proposal §10.2 steps 1 to 3) and for the
-- engagement page: whether they may use or authorize, the engagement's data
-- origin and status, and the authorization in force. Internal readers only,
-- like the authorization record itself; it reads no architecture.
create function public.architecture_intelligence_standing(p_engagement_id uuid)
returns table (
  can_use               boolean,
  can_authorize         boolean,
  data_origin           text,
  engagement_status     text,
  authorization_id      uuid,
  authorization_state   text,
  data_classes          text[],
  provider_key          text,
  processing_region     text,
  monthly_budget_usd    numeric
)
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
  a := private.current_ai_authorization(p_engagement_id);
  return query
    select private.can_use_architecture_intelligence(p_engagement_id),
           private.can_authorize_external_ai_processing(p_engagement_id),
           e.data_origin, e.status::text, a.id, coalesce(a.state, 'not_authorized'),
           case when a.state = 'authorized' then a.data_classes else '{}'::text[] end,
           a.provider_key, a.processing_region,
           case when a.state = 'authorized' then a.monthly_budget_usd end
    from public.engagements e
    where e.id = p_engagement_id;
end;
$$;

revoke all on function public.architecture_intelligence_standing(uuid) from public, anon;
grant execute on function public.architecture_intelligence_standing(uuid) to authenticated;
