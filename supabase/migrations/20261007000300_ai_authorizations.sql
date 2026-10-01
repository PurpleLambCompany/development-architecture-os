-- =============================================================================
-- Phase 7B.1: Architecture Intelligence Foundation. Migration 4 of 7.
-- External processing authorization (B-1, B-2, B-4; OD-1, OD-3; proposal
-- §5, §8; ADR-0060).
--
-- An append-only history per engagement. The latest record is the current
-- one; no record means not authorized. A record states who authorized what,
-- when, on what contractual or governing basis, for which data classes,
-- provider, region and monthly budget. Revocation is a new not_authorized
-- record, never a delete. Revoking stops future processing; it cannot
-- recall data already sent.
--
-- The authorization is a ceiling, never a payload: a data class authorized
-- to leave DSA MAY be used, and is never automatically included in a
-- request (reconciliation §0.1). Method/IP has no data class and cannot be
-- authorized here (B-19).
--
-- Not recorded in activity_log (OD-10): the table is itself the attributed,
-- append-only record.
-- =============================================================================

-- The closed vocabulary of data classes that may ever be authorized (B-2).
create function private.ai_data_classes()
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select array['published_architecture', 'working_architecture', 'project_intelligence', 'evidence_metadata'];
$$;

create function private.is_ai_data_class_set(p_classes text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_classes is not null and p_classes <@ private.ai_data_classes()
     and cardinality(p_classes) = (select count(distinct c) from unnest(p_classes) c);
$$;

create table public.engagement_ai_authorizations (
  id                  uuid primary key default gen_random_uuid(),
  engagement_id       uuid not null references public.engagements (id) on delete restrict,
  sequence_no         int not null check (sequence_no > 0),
  state               text not null check (state in ('authorized', 'not_authorized')),
  data_classes        text[] not null default '{}' check (private.is_ai_data_class_set(data_classes)),
  provider_key        text check (provider_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  processing_region   text check (processing_region ~ '^[a-z][a-z0-9_-]{1,39}$'),
  basis_kind          text check (basis_kind in ('client_agreement', 'data_processing_addendum',
                                                 'written_client_instruction', 'synthetic_evaluation')),
  basis_reference     text check (char_length(btrim(basis_reference)) between 1 and 300),
  basis_note          text check (char_length(basis_note) <= 2000),
  monthly_budget_usd  numeric(12, 2) check (monthly_budget_usd > 0),
  effective_from      date not null,
  authorized_by       uuid not null references public.profiles (id) on delete restrict,
  authorized_at       timestamptz not null default clock_timestamp(),
  constraint engagement_ai_authorizations_sequence unique (engagement_id, sequence_no),
  constraint engagement_ai_authorizations_engagement_key unique (id, engagement_id),
  -- An authorization names everything it covers; a revocation names nothing
  -- but its reason.
  constraint engagement_ai_authorizations_shape check (
    case state
      when 'authorized' then cardinality(data_classes) >= 1 and provider_key is not null
                             and processing_region is not null and basis_kind is not null
                             and basis_reference is not null and monthly_budget_usd is not null
      else cardinality(data_classes) = 0 and provider_key is null and processing_region is null
           and basis_kind is null and basis_reference is null and monthly_budget_usd is null
           and char_length(btrim(coalesce(basis_note, ''))) >= 1
    end
  )
);

comment on table public.engagement_ai_authorizations is
  'Append-only external processing authorizations (ADR-0060). Written only by set_engagement_ai_authorization.';

create function private.guard_engagement_ai_authorization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('dsa.ai_authorization', true), 'off') <> 'on' then
      raise exception 'Authorizations are recorded only through their operation' using errcode = '42501';
    end if;
    new.authorized_by := auth.uid();
    new.authorized_at := clock_timestamp();
    return new;
  end if;
  raise exception 'Authorizations are append-only: record a new one instead' using errcode = '23514';
end;
$$;

create trigger engagement_ai_authorizations_guard before insert or update or delete
  on public.engagement_ai_authorizations
  for each row execute function private.guard_engagement_ai_authorization();

alter table public.engagement_ai_authorizations enable row level security;
revoke all on public.engagement_ai_authorizations from anon, authenticated;
grant select on public.engagement_ai_authorizations to authenticated;
create policy "ai authorizations: internal readers"
  on public.engagement_ai_authorizations for select to authenticated
  using (private.can_read_architecture(engagement_id));

-- The current record (the latest), or none.
create function private.current_ai_authorization(p_engagement_id uuid)
returns public.engagement_ai_authorizations
language sql
stable
security definer
set search_path = ''
as $$
  select a.* from public.engagement_ai_authorizations a
  where a.engagement_id = p_engagement_id
  order by a.sequence_no desc
  limit 1;
$$;

-- Whether a data class may currently leave DSA for this engagement.
create function private.ai_class_authorized(p_engagement_id uuid, p_class text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select a.state = 'authorized' and p_class = any (a.data_classes)
    from private.current_ai_authorization(p_engagement_id) a
    where a.id is not null
  ), false);
$$;

-- Record a new authorization or revocation.
create function public.set_engagement_ai_authorization(
  p_engagement_id      uuid,
  p_state              text,
  p_data_classes       text[] default '{}',
  p_provider_key       text default null,
  p_processing_region  text default null,
  p_basis_kind         text default null,
  p_basis_reference    text default null,
  p_basis_note         text default null,
  p_monthly_budget_usd numeric default null,
  p_effective_from     date default null
)
returns public.engagement_ai_authorizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  eng public.engagements;
  next_no int;
  result public.engagement_ai_authorizations;
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not private.can_authorize_external_ai_processing(p_engagement_id) then
    raise exception 'You do not hold authorize_external_ai_processing on this engagement' using errcode = '42501';
  end if;
  select * into eng from public.engagements where id = p_engagement_id;

  if p_state is null or p_state not in ('authorized', 'not_authorized') then
    raise exception 'Authorize or revoke' using errcode = '23514';
  end if;
  if p_effective_from is not null and p_effective_from > private.business_today() then
    raise exception 'An authorization cannot take effect in the future' using errcode = '23514';
  end if;

  if p_state = 'authorized' then
    if eng.status not in ('proposed', 'active') then
      raise exception 'External processing is allowed only for proposed and active engagements' using errcode = '23514';
    end if;
    if coalesce(cardinality(p_data_classes), 0) = 0 or not private.is_ai_data_class_set(p_data_classes) then
      raise exception 'Name at least one approved data class, each once' using errcode = '23514';
    end if;
    if p_basis_kind is null or coalesce(btrim(p_basis_reference), '') = '' then
      raise exception 'State the basis and its reference' using errcode = '23514';
    end if;
    if (p_basis_kind = 'synthetic_evaluation') <> (eng.data_origin = 'synthetic') then
      raise exception 'Synthetic evaluation is the basis for synthetic engagements, and only for them' using errcode = '23514';
    end if;
    if p_provider_key is null or p_processing_region is null then
      raise exception 'Name the provider and the processing region' using errcode = '23514';
    end if;
    if p_monthly_budget_usd is null or p_monthly_budget_usd <= 0 then
      raise exception 'Set a monthly budget' using errcode = '23514';
    end if;
  else
    if coalesce(cardinality(p_data_classes), 0) <> 0 or p_provider_key is not null or p_processing_region is not null
       or p_basis_kind is not null or p_basis_reference is not null or p_monthly_budget_usd is not null then
      raise exception 'A revocation names nothing but its reason' using errcode = '23514';
    end if;
    if coalesce(btrim(p_basis_note), '') = '' then
      raise exception 'Say why' using errcode = '23514';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai_authorization:' || p_engagement_id::text, 0));
  select coalesce(max(sequence_no), 0) + 1 into next_no
  from public.engagement_ai_authorizations where engagement_id = p_engagement_id;

  perform set_config('dsa.ai_authorization', 'on', true);
  insert into public.engagement_ai_authorizations (
    engagement_id, sequence_no, state, data_classes, provider_key, processing_region, basis_kind,
    basis_reference, basis_note, monthly_budget_usd, effective_from, authorized_by
  ) values (
    p_engagement_id, next_no, p_state, coalesce(p_data_classes, '{}'), p_provider_key, p_processing_region,
    p_basis_kind, nullif(btrim(p_basis_reference), ''), nullif(btrim(p_basis_note), ''), p_monthly_budget_usd,
    coalesce(p_effective_from, private.business_today()), auth.uid()
  )
  returning * into result;
  perform set_config('dsa.ai_authorization', 'off', true);
  return result;
end;
$$;

revoke all on function public.set_engagement_ai_authorization(uuid, text, text[], text, text, text, text, text, numeric, date)
  from public, anon;
grant execute on function public.set_engagement_ai_authorization(uuid, text, text[], text, text, text, text, text, numeric, date)
  to authenticated;
revoke all on function private.current_ai_authorization(uuid) from public, anon, authenticated;
revoke all on function private.ai_class_authorized(uuid, text) from public, anon, authenticated;
