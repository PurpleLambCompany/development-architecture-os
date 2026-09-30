-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 4 of 11.
-- The system time of a criterion's agreement (OD-2, amendment note on
-- ADR-0046, proposal §5.2 #16 and §13.2).
--
-- agreed_on stays the business (effective) date the user enters.
-- agreed_recorded_at is the system time of the governed agreement operation,
-- used by Change intelligence. The two are never conflated, and no Edge read
-- derives agreement time from activity_log.
--
-- Numbered before the rule and change migrations that read the column; the
-- proposal lists it eleventh.
-- =============================================================================

alter table public.acceptance_criteria add column agreed_recorded_at timestamptz;

comment on column public.acceptance_criteria.agreed_recorded_at is
  'System time of the agreement operation (OD-2). Set only by the agreement and the one-time backfill; frozen with the other agreement fields. agreed_on is the business date.';

-- The guard sets the agreement time itself, so no caller can supply one, and
-- it is frozen with the other agreement fields once agreed.
create or replace function private.guard_acceptance_criterion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.state <> 'proposed' then
      raise exception 'An agreed acceptance criterion is never deleted; supersede or withdraw it' using errcode = '23514';
    end if;
    -- A proposal goes with its deleted draft element, or through the operation.
    if exists (select 1 from public.architecture_elements where id = old.governed_element_id)
       and not private.in_methodology_operation() then
      raise exception 'Acceptance criteria change only through their operations' using errcode = '42501';
    end if;
    return old;
  end if;
  if not private.in_methodology_operation() then
    raise exception 'Acceptance criteria change only through their operations' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.agreed_recorded_at := null;
  end if;
  if tg_op = 'UPDATE' then
    if new.engagement_id <> old.engagement_id or new.reference_code <> old.reference_code
       or new.governed_element_id <> old.governed_element_id then
      raise exception 'An acceptance criterion''s identity is permanent' using errcode = '23514';
    end if;
    if old.state = 'proposed' then
      new.agreed_recorded_at := case when new.state = 'agreed' then clock_timestamp() end;
    else
      if (to_jsonb(new) - array['state', 'closure_reason', 'closed_at', 'updated_at'])
         is distinct from (to_jsonb(old) - array['state', 'closure_reason', 'closed_at', 'updated_at']) then
        raise exception 'An agreed acceptance criterion is frozen: supersede it instead' using errcode = '23514';
      end if;
      if new.state <> old.state and not (old.state = 'agreed' and new.state in ('superseded', 'withdrawn')) then
        raise exception 'An acceptance criterion cannot go from % to %', old.state, new.state using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.agree_criterion_row(
  target_criterion_id uuid,
  target_agreed_with text,
  target_agreed_on date,
  target_evidence_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.acceptance_criteria;
  e public.architecture_elements;
begin
  select * into c from public.acceptance_criteria where id = target_criterion_id;
  select * into e from public.architecture_elements where id = c.governed_element_id;
  if e.latest_version_id is null or e.lifecycle = 'retired' then
    raise exception 'A criterion is agreed only on a published element' using errcode = '23514';
  end if;
  if not private.nonblank(target_agreed_with) or target_agreed_on is null then
    raise exception 'Record who agreed the criterion and when it applies from' using errcode = '23514';
  end if;
  if target_evidence_source_id is not null and not exists (
    select 1 from public.evidence_sources where id = target_evidence_source_id and engagement_id = c.engagement_id
  ) then
    raise exception 'Evidence source not found on this engagement' using errcode = 'P0002';
  end if;
  -- agreed_recorded_at is the operation's system time; the guard sets it.
  update public.acceptance_criteria
  set state = 'agreed', agreed_with = btrim(target_agreed_with), agreed_on = target_agreed_on,
      agreed_recorded_by = auth.uid(), agreement_evidence_source_id = target_evidence_source_id,
      agreed_recorded_at = clock_timestamp()
  where id = c.id;
end;
$$;

-- One-time backfill from the authoritative agreement row in activity_log: the
-- update that moved the criterion from proposed to agreed. Left null where no
-- such row exists; a criterion with no recorded agreement time produces no
-- criteria_predate_revision item.
create function private.backfill_criterion_agreement_times()
returns int
language plpgsql
set search_path = ''
as $$
declare
  n int;
begin
  update public.acceptance_criteria c
  set agreed_recorded_at = l.created_at
  from (
    select distinct on (a.entity_id) a.entity_id, a.created_at
    from public.activity_log a
    where a.entity_type = 'acceptance_criteria' and a.action_type = 'update'
      and a.metadata_json -> 'before' ->> 'state' = 'proposed'
      and a.metadata_json -> 'after' ->> 'state' = 'agreed'
    order by a.entity_id, a.created_at
  ) l
  where l.entity_id = c.id and c.agreed_recorded_at is null and c.state <> 'proposed';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function private.backfill_criterion_agreement_times() from public, anon, authenticated;

-- The backfill writes frozen rows once, so the guard steps aside for it alone.
alter table public.acceptance_criteria disable trigger acceptance_criteria_guard;
do $$ begin perform private.backfill_criterion_agreement_times(); end; $$;
alter table public.acceptance_criteria enable trigger acceptance_criteria_guard;
