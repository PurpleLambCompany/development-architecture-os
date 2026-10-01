-- =============================================================================
-- Phase 7B.2: Architecture Intelligence Experience. Migration 3 of 6.
-- Judgments on kept inferences (IX-19, PD-6, PD-14, PD-15, PD-18; proposal
-- §18; ADR-0070, ADR-0056 amendment).
--
-- The sibling of edge_judgments, with the same closed vocabulary and the
-- same semantics, producer-neutral: investigating, not_material, deferred,
-- disagree ("the producer is wrong for this case") and promoted (naming the
-- governed record a person created). Append-only; the latest judgment on an
-- inference is current. A judgment on an inference never judges an Edge
-- item, and the reverse.
--
-- Recording needs use_architecture_intelligence (to see the inference at
-- all, OD-11) and edit_architecture (as Edge judgments do, PD-6). Reading is
-- for current holders of use_architecture_intelligence only. Suppression is
-- engagement-wide (PD-14) and computed, never stored: a current inference
-- whose latest judgment is not_material or disagree suppresses re-offering
-- the same kind on the same subject until its basis changes.
--
-- Not in activity_log (OD-10 extends, PD-18). `disagree` and `not_material`
-- reasons are evaluation data about prompts and models, read by kind, prompt
-- version and resolved model; no read model aggregates judgments per person.
-- =============================================================================

create table public.architecture_inference_judgments (
  id                            uuid primary key default gen_random_uuid(),
  engagement_id                 uuid not null references public.engagements (id) on delete restrict,
  inference_id                  uuid not null,
  judgment_kind                 text not null check (judgment_kind in ('investigating', 'not_material', 'deferred',
                                                                         'disagree', 'promoted')),
  reason                        text check (char_length(reason) <= 2000),
  expires_on                    date,
  promotion_target_kind         text check (promotion_target_kind in ('risk', 'decision', 'review',
                                                                      'acceptance_criterion')),
  promotion_target_element_id   uuid,
  promotion_target_criterion_id uuid,
  promotion_target_element_kind public.element_kind generated always as (
    case promotion_target_kind
      when 'risk' then 'risk'::public.element_kind
      when 'decision' then 'decision'::public.element_kind
      when 'review' then 'review'::public.element_kind
    end
  ) stored,
  judged_by                     uuid not null references public.profiles (id) on delete restrict,
  judged_at                     timestamptz not null default clock_timestamp(),
  constraint architecture_inference_judgments_reason check (
    judgment_kind in ('investigating', 'promoted') or char_length(btrim(coalesce(reason, ''))) >= 1
  ),
  constraint architecture_inference_judgments_expiry check ((judgment_kind = 'deferred') = (expires_on is not null)),
  constraint architecture_inference_judgments_promoted check (
    (judgment_kind = 'promoted') = (promotion_target_kind is not null)
  ),
  constraint architecture_inference_judgments_promotion_target check (
    case
      when promotion_target_kind is null then num_nonnulls(promotion_target_element_id, promotion_target_criterion_id) = 0
      when promotion_target_kind = 'acceptance_criterion' then promotion_target_criterion_id is not null
                                                              and promotion_target_element_id is null
      else promotion_target_element_id is not null and promotion_target_criterion_id is null
    end
  ),
  constraint architecture_inference_judgments_inference_fk foreign key (inference_id, engagement_id)
    references public.architecture_inferences (id, engagement_id) on delete restrict,
  constraint architecture_inference_judgments_promotion_element_fk
    foreign key (promotion_target_element_id, engagement_id, promotion_target_element_kind)
    references public.architecture_elements (id, engagement_id, kind) on delete restrict,
  constraint architecture_inference_judgments_promotion_criterion_fk
    foreign key (promotion_target_criterion_id, engagement_id)
    references public.acceptance_criteria (id, engagement_id) on delete restrict
);
create index architecture_inference_judgments_lookup_idx
  on public.architecture_inference_judgments (inference_id, judged_at desc);
create index architecture_inference_judgments_engagement_idx
  on public.architecture_inference_judgments (engagement_id);

comment on table public.architecture_inference_judgments is
  'Append-only human judgments on kept Architecture Intelligence inferences (ADR-0070). Sibling of edge_judgments.';

create function private.guard_architecture_inference_judgment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('dsa.ai_inference_judgment', true), 'off') <> 'on' then
      raise exception 'Inference judgments are recorded only through their operations' using errcode = '42501';
    end if;
    new.judged_by := auth.uid();
    new.judged_at := clock_timestamp();
    return new;
  end if;
  raise exception 'Inference judgments are append-only: record a new judgment instead' using errcode = '23514';
end;
$$;

create trigger architecture_inference_judgments_guard before insert or update or delete
  on public.architecture_inference_judgments
  for each row execute function private.guard_architecture_inference_judgment();

alter table public.architecture_inference_judgments enable row level security;
revoke all on public.architecture_inference_judgments from public, anon, authenticated;
grant select on public.architecture_inference_judgments to authenticated;
create policy "inference judgments: current use-capability holders"
  on public.architecture_inference_judgments for select to authenticated
  using (private.can_use_architecture_intelligence(engagement_id));

-- The latest judgment on an inference.
create function private.inference_latest_judgment(p_inference_id uuid)
returns public.architecture_inference_judgments
language sql
stable
security definer
set search_path = ''
as $$
  select j.* from public.architecture_inference_judgments j
  where j.inference_id = p_inference_id
  order by j.judged_at desc, j.id desc
  limit 1;
$$;

-- Whether an inference is current: not stale and not superseded. Computed
-- by the 7B.1 staleness function (as replaced in migration 2).
create function private.inference_is_current(p_engagement_id uuid, p_inference_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.state from public.architecture_inference_state(p_engagement_id, p_inference_id) s;
$$;

-- -----------------------------------------------------------------------------
-- Record one judgment row. The caller holds the engagement lock and has
-- checked the inference. Mirrors private.record_edge_judgment_row's rules.
-- -----------------------------------------------------------------------------
create function private.record_inference_judgment_row(
  p_engagement_id         uuid,
  p_inference_id          uuid,
  p_kind                  text,
  p_reason                text,
  p_expires_on            date,
  p_promotion_target_kind text,
  p_promotion_target_id   uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  judgment_id uuid;
begin
  if p_kind is null or p_kind not in ('investigating', 'not_material', 'deferred', 'disagree', 'promoted') then
    raise exception 'Unknown judgment' using errcode = '23514';
  end if;
  if p_kind in ('not_material', 'deferred', 'disagree') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say why' using errcode = '23514';
  end if;
  if p_kind = 'deferred' and (p_expires_on is null or p_expires_on <= private.business_today()) then
    raise exception 'A deferral needs a future date' using errcode = '23514';
  end if;
  if p_kind <> 'deferred' and p_expires_on is not null then
    raise exception 'Only a deferral has a date' using errcode = '23514';
  end if;
  if p_kind = 'promoted' then
    if p_promotion_target_kind is null
       or p_promotion_target_kind not in ('risk', 'decision', 'review', 'acceptance_criterion') then
      raise exception 'Promote only to a Risk, a Decision, a Review or an acceptance criterion' using errcode = '23514';
    end if;
    if p_promotion_target_kind = 'acceptance_criterion' then
      if p_promotion_target_id is null or not exists (
        select 1 from public.acceptance_criteria
        where id = p_promotion_target_id and engagement_id = p_engagement_id and state = 'proposed') then
        raise exception 'Promote only to a proposed criterion created on this engagement' using errcode = '23514';
      end if;
    elsif p_promotion_target_id is null or not exists (
      select 1 from public.architecture_elements
      where id = p_promotion_target_id and engagement_id = p_engagement_id
        and kind = p_promotion_target_kind::public.element_kind) then
      raise exception 'Promote only to a governed record of that kind created on this engagement' using errcode = '23514';
    end if;
  elsif p_promotion_target_kind is not null or p_promotion_target_id is not null then
    raise exception 'Only a promotion names a governed target' using errcode = '23514';
  end if;

  perform set_config('dsa.ai_inference_judgment', 'on', true);
  insert into public.architecture_inference_judgments (
    engagement_id, inference_id, judgment_kind, reason, expires_on, promotion_target_kind,
    promotion_target_element_id, promotion_target_criterion_id, judged_by
  ) values (
    p_engagement_id, p_inference_id, p_kind, nullif(btrim(p_reason), ''), p_expires_on, p_promotion_target_kind,
    case when p_promotion_target_kind in ('risk', 'decision', 'review') then p_promotion_target_id end,
    case when p_promotion_target_kind = 'acceptance_criterion' then p_promotion_target_id end,
    auth.uid()
  )
  returning id into judgment_id;
  perform set_config('dsa.ai_inference_judgment', 'off', true);
  return judgment_id;
end;
$$;

-- Check that the caller may judge inferences on this engagement.
create function private.require_inference_judgment_capability(p_engagement_id uuid)
returns void
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
  perform private.require_architecture_capability(p_engagement_id, 'edit_architecture');
end;
$$;

-- -----------------------------------------------------------------------------
-- Judge a kept inference. Refused unless it is current: a stale inference's
-- basis has changed, and a superseded one has a newer kept interpretation.
-- -----------------------------------------------------------------------------
create function public.record_architecture_inference_judgment(
  p_engagement_id         uuid,
  p_inference_id          uuid,
  p_kind                  text,
  p_reason                text default null,
  p_expires_on            date default null,
  p_promotion_target_kind text default null,
  p_promotion_target_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  state text;
begin
  perform private.require_inference_judgment_capability(p_engagement_id);
  perform pg_advisory_xact_lock(hashtextextended('ai_inference_judgment:' || p_engagement_id::text, 0));
  if not exists (select 1 from public.architecture_inferences
                 where id = p_inference_id and engagement_id = p_engagement_id) then
    raise exception 'Interpretation not found' using errcode = 'P0002';
  end if;
  state := private.inference_is_current(p_engagement_id, p_inference_id);
  if state = 'stale' then
    raise exception 'This interpretation is stale: its basis has changed. Interpret again.' using errcode = '23514';
  end if;
  if state = 'superseded' then
    raise exception 'A newer interpretation of this has been kept. Judge that one.' using errcode = '23514';
  end if;
  return private.record_inference_judgment_row(p_engagement_id, p_inference_id, p_kind, p_reason, p_expires_on,
                                               p_promotion_target_kind, p_promotion_target_id);
end;
$$;

revoke all on function private.guard_architecture_inference_judgment() from public, anon, authenticated;
revoke all on function private.inference_latest_judgment(uuid) from public, anon, authenticated;
revoke all on function private.inference_is_current(uuid, uuid) from public, anon, authenticated;
revoke all on function private.record_inference_judgment_row(uuid, uuid, text, text, date, text, uuid)
  from public, anon, authenticated;
revoke all on function private.require_inference_judgment_capability(uuid) from public, anon, authenticated;
revoke all on function public.record_architecture_inference_judgment(uuid, uuid, text, text, date, text, uuid)
  from public, anon;
grant execute on function public.record_architecture_inference_judgment(uuid, uuid, text, text, date, text, uuid)
  to authenticated;
