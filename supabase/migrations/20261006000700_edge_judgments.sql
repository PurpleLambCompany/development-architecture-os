-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 9 of 11.
-- Edge judgments (ADR-0056, proposal §15).
--
-- Durable, attributable human judgments on Edge items: investigating,
-- not_material, deferred, disagree, promoted. Append-only: the latest
-- judgment for a (rule, subject, fingerprint) is the current one, and a
-- correction is a new judgment. A judged item returns when its fingerprint
-- changes. Judgments are professional record-keeping, attributed by design,
-- and recorded in activity_log like the existing dismissals.
--
-- The 11 existing rules keep their dismissal tables and operations (OD-9):
-- not_material and deferred on them are written through
-- dismiss_intelligence_signal and dismiss_implementation_signal, so the
-- Signals page and the Edge agree. Only kinds with no established mechanism
-- are stored here for those rules.
--
-- Promotion never creates anything: the governed record is created by its
-- own operation first, and only then is `promoted` recorded with a typed
-- reference to it, the governed promotion target. The target vocabulary is
-- closed (risk, decision, review, acceptance_criterion) and every target has
-- a real same-engagement foreign key; there is no free polymorphic link.
-- No read model aggregates judgments by person.
-- =============================================================================

create function private.is_edge_rule_key(p_rule_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_rule_key = 'change_reaches' or exists (select 1 from private.edge_rules() c where c.rule_key = p_rule_key);
$$;

create table public.edge_judgments (
  id                       uuid primary key default gen_random_uuid(),
  engagement_id            uuid not null references public.engagements (id) on delete restrict,
  rule_key                 text not null check (private.is_edge_rule_key(rule_key)),
  subject_type             text not null check (subject_type in ('element', 'client_action', 'method_application',
                                                                   'acceptance_criterion', 'engagement')),
  element_id               uuid,
  client_action_id         uuid,
  method_application_id    uuid,
  acceptance_criterion_id  uuid,
  fingerprint              text not null check (char_length(fingerprint) between 1 and 1000),
  trigger_key              text check (char_length(trigger_key) <= 300),
  judgment_kind            text not null check (judgment_kind in ('investigating', 'not_material', 'deferred',
                                                                   'disagree', 'promoted')),
  reason                   text check (char_length(reason) <= 2000),
  expires_on               date,
  -- The governed promotion target: a closed kind and one typed reference.
  -- A Risk, Decision or Review is an element of exactly that kind (the
  -- generated kind column makes the foreign key check it); an acceptance
  -- criterion is an acceptance_criteria row. Both on this engagement.
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
  judged_by                uuid not null references public.profiles (id) on delete restrict,
  judged_at                timestamptz not null default clock_timestamp(),
  -- Exactly one subject reference, matching the subject type. An
  -- engagement-level item (method_basis_superseded, release_moved) is about
  -- the engagement itself and carries none.
  constraint edge_judgments_subject check (
    case subject_type
      when 'element' then num_nonnulls(element_id, client_action_id, method_application_id, acceptance_criterion_id) = 1
                          and element_id is not null
      when 'client_action' then num_nonnulls(element_id, client_action_id, method_application_id, acceptance_criterion_id) = 1
                                and client_action_id is not null
      when 'method_application' then num_nonnulls(element_id, client_action_id, method_application_id,
                                                  acceptance_criterion_id) = 1 and method_application_id is not null
      when 'acceptance_criterion' then num_nonnulls(element_id, client_action_id, method_application_id,
                                                    acceptance_criterion_id) = 1 and acceptance_criterion_id is not null
      else num_nonnulls(element_id, client_action_id, method_application_id, acceptance_criterion_id) = 0
    end
  ),
  constraint edge_judgments_reason check (
    judgment_kind in ('investigating', 'promoted') or char_length(btrim(coalesce(reason, ''))) >= 1
  ),
  constraint edge_judgments_expiry check ((judgment_kind = 'deferred') = (expires_on is not null)),
  constraint edge_judgments_promoted check ((judgment_kind = 'promoted') = (promotion_target_kind is not null)),
  constraint edge_judgments_promotion_target check (
    case
      when promotion_target_kind is null then num_nonnulls(promotion_target_element_id, promotion_target_criterion_id) = 0
      when promotion_target_kind = 'acceptance_criterion' then promotion_target_criterion_id is not null
                                                              and promotion_target_element_id is null
      else promotion_target_element_id is not null and promotion_target_criterion_id is null
    end
  ),
  constraint edge_judgments_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint edge_judgments_client_action_fk foreign key (client_action_id, engagement_id)
    references public.client_actions (id, engagement_id) on delete restrict,
  constraint edge_judgments_application_fk foreign key (method_application_id, engagement_id)
    references public.method_applications (id, engagement_id) on delete restrict,
  constraint edge_judgments_criterion_fk foreign key (acceptance_criterion_id, engagement_id)
    references public.acceptance_criteria (id, engagement_id) on delete restrict,
  constraint edge_judgments_promotion_element_fk
    foreign key (promotion_target_element_id, engagement_id, promotion_target_element_kind)
    references public.architecture_elements (id, engagement_id, kind) on delete restrict,
  constraint edge_judgments_promotion_criterion_fk foreign key (promotion_target_criterion_id, engagement_id)
    references public.acceptance_criteria (id, engagement_id) on delete restrict
);
create index edge_judgments_lookup_idx
  on public.edge_judgments (engagement_id, rule_key, fingerprint, judged_at desc);
create index edge_judgments_trigger_idx on public.edge_judgments (engagement_id, trigger_key);

comment on table public.edge_judgments is
  'Append-only human judgments on Edge items (ADR-0056). Written only by record_edge_judgment and record_edge_event_judgment.';

create function private.guard_edge_judgment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('dsa.edge_judgment', true), 'off') <> 'on' then
      raise exception 'Edge judgments are recorded only through their operations' using errcode = '42501';
    end if;
    new.judged_by := auth.uid();
    new.judged_at := clock_timestamp();
    return new;
  end if;
  raise exception 'Edge judgments are append-only: record a new judgment instead' using errcode = '23514';
end;
$$;

create trigger edge_judgments_guard before insert or update or delete on public.edge_judgments
  for each row execute function private.guard_edge_judgment();
create trigger edge_judgments_log after insert or update or delete on public.edge_judgments
  for each row execute function private.log_activity();

alter table public.edge_judgments enable row level security;
revoke all on public.edge_judgments from anon, authenticated;
grant select on public.edge_judgments to authenticated;
create policy "edge judgments: internal readers"
  on public.edge_judgments for select to authenticated
  using (private.can_read_architecture(engagement_id));

-- The latest judgment on an item: the existing dismissals for the 11 rules
-- (OD-9), and edge_judgments for every rule.
create or replace function private.edge_judgment_for(
  p_engagement_id uuid,
  p_rule_key text,
  p_subject_type text,
  p_subject_id uuid,
  p_fingerprint text
)
returns table (
  judgment_kind        text,
  judged_by            uuid,
  judged_at            timestamptz,
  judgment_reason      text,
  judgment_expires_on  date,
  judgment_source      text,
  promotion_target_kind text,
  promotion_target_id  uuid
)
language sql
stable
set search_path = ''
as $$
  select * from (
    select case when d.expires_on is null then 'not_material' else 'deferred' end, d.dismissed_by, d.dismissed_at,
           d.reason, d.expires_on, 'signal_dismissal', null::text, null::uuid
    from public.intelligence_signal_dismissals d
    where d.engagement_id = p_engagement_id and d.rule_key = p_rule_key and d.fingerprint = p_fingerprint
      and ((p_subject_type = 'element' and d.element_id = p_subject_id)
           or (p_subject_type = 'client_action' and d.client_action_id = p_subject_id))
    union all
    select case when d.expires_on is null then 'not_material' else 'deferred' end, d.dismissed_by, d.dismissed_at,
           d.reason, d.expires_on, 'implementation_dismissal', null::text, null::uuid
    from public.implementation_signal_dismissals d
    where d.engagement_id = p_engagement_id and d.rule_key = p_rule_key and d.fingerprint = p_fingerprint
      and p_subject_type = 'element' and d.element_id = p_subject_id
    union all
    select j.judgment_kind, j.judged_by, j.judged_at, j.reason, j.expires_on, 'edge_judgment',
           j.promotion_target_kind, coalesce(j.promotion_target_element_id, j.promotion_target_criterion_id)
    from public.edge_judgments j
    where j.engagement_id = p_engagement_id and j.rule_key = p_rule_key and j.fingerprint = p_fingerprint
      and j.subject_type = p_subject_type
      and case p_subject_type
            when 'element' then j.element_id = p_subject_id
            when 'client_action' then j.client_action_id = p_subject_id
            when 'method_application' then j.method_application_id = p_subject_id
            when 'acceptance_criterion' then j.acceptance_criterion_id = p_subject_id
            else p_subject_id = p_engagement_id
          end
  ) x (judgment_kind, judged_by, judged_at, judgment_reason, judgment_expires_on, judgment_source,
       promotion_target_kind, promotion_target_id)
  order by x.judged_at desc
  limit 1;
$$;

-- Records one judgment on one current item. Not material and Deferred on the
-- 11 existing rules go through their existing dismissal operations.
create function private.record_edge_judgment_row(
  p_engagement_id uuid,
  p_rule_key text,
  p_subject_type text,
  p_subject_id uuid,
  p_fingerprint text,
  p_trigger_key text,
  p_kind text,
  p_reason text,
  p_expires_on date,
  p_promotion_target_kind text,
  p_promotion_target_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
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
      -- The criterion was proposed through the ordinary operation; promotion
      -- never agrees it, so it is recorded only while it is still a proposal.
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

  select * into c from private.edge_rules() r where r.rule_key = p_rule_key;
  if c.origin = 'existing' and p_kind in ('not_material', 'deferred') then
    if p_rule_key = 'implementation_past_target' then
      return public.dismiss_implementation_signal(p_engagement_id, p_subject_id, p_fingerprint, p_reason,
                                                  p_expires_on);
    end if;
    return public.dismiss_intelligence_signal(
      p_engagement_id, p_rule_key,
      case when p_subject_type = 'element' then p_subject_id end,
      case when p_subject_type = 'client_action' then p_subject_id end,
      p_fingerprint, p_reason, p_expires_on);
  end if;

  perform set_config('dsa.edge_judgment', 'on', true);
  insert into public.edge_judgments (
    engagement_id, rule_key, subject_type, element_id, client_action_id, method_application_id,
    acceptance_criterion_id, fingerprint, trigger_key, judgment_kind, reason, expires_on,
    promotion_target_kind, promotion_target_element_id, promotion_target_criterion_id, judged_by
  ) values (
    p_engagement_id, p_rule_key, p_subject_type,
    case when p_subject_type = 'element' then p_subject_id end,
    case when p_subject_type = 'client_action' then p_subject_id end,
    case when p_subject_type = 'method_application' then p_subject_id end,
    case when p_subject_type = 'acceptance_criterion' then p_subject_id end,
    p_fingerprint, p_trigger_key, p_kind, nullif(btrim(p_reason), ''), p_expires_on,
    p_promotion_target_kind,
    case when p_promotion_target_kind in ('risk', 'decision', 'review') then p_promotion_target_id end,
    case when p_promotion_target_kind = 'acceptance_criterion' then p_promotion_target_id end,
    auth.uid()
  )
  returning id into judgment_id;
  perform set_config('dsa.edge_judgment', 'off', true);
  return judgment_id;
end;
$$;

-- Judge one item. The item is re-evaluated first: a fingerprint that no
-- longer matches the current facts is refused, so a stale screen cannot judge
-- a changed item.
create function public.record_edge_judgment(
  p_engagement_id uuid,
  p_rule_key text,
  p_subject_type text,
  p_subject_id uuid,
  p_fingerprint text,
  p_kind text,
  p_reason text default null,
  p_expires_on date default null,
  p_promotion_target_kind text default null,
  p_promotion_target_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
begin
  perform private.require_architecture_capability(p_engagement_id, 'edit_architecture');
  perform pg_advisory_xact_lock(hashtextextended('edge_judgment:' || p_engagement_id::text, 0));
  select i.* into item
  from public.edge_items(p_engagement_id, null, null, null, true) i
  where i.rule_key = p_rule_key and i.subject_type = p_subject_type and i.subject_id = p_subject_id
    and i.fingerprint = p_fingerprint
  limit 1;
  if not found then
    raise exception 'This item has changed since it was shown. Reload it and judge it again.' using errcode = '23514';
  end if;
  return private.record_edge_judgment_row(p_engagement_id, p_rule_key, p_subject_type, p_subject_id,
                                          p_fingerprint, item.trigger_key, p_kind, p_reason, p_expires_on,
                                          p_promotion_target_kind, p_promotion_target_id);
end;
$$;

-- Judge a whole event: one judgment per item currently listed in it, in one
-- transaction. Promotion is per item, because it names one governed target.
create function public.record_edge_event_judgment(
  p_engagement_id uuid,
  p_trigger_key text,
  p_kind text,
  p_reason text default null,
  p_expires_on date default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  n int := 0;
begin
  perform private.require_architecture_capability(p_engagement_id, 'edit_architecture');
  if p_kind = 'promoted' then
    raise exception 'Promote one item at a time' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('edge_judgment:' || p_engagement_id::text, 0));
  for item in
    select i.* from public.edge_items(p_engagement_id, null, null, null, false) i
    where i.trigger_key = p_trigger_key
  loop
    perform private.record_edge_judgment_row(p_engagement_id, item.rule_key, item.subject_type, item.subject_id,
                                             item.fingerprint, item.trigger_key, p_kind, p_reason, p_expires_on,
                                             null, null);
    n := n + 1;
  end loop;
  if n = 0 then
    raise exception 'This event has changed since it was shown. Reload it and judge it again.' using errcode = '23514';
  end if;
  return n;
end;
$$;

revoke all on function private.is_edge_rule_key(text) from public, anon, authenticated;
revoke all on function private.guard_edge_judgment() from public, anon, authenticated;
revoke all on function private.record_edge_judgment_row(uuid, text, text, uuid, text, text, text, text, date, text, uuid)
  from public, anon, authenticated;
revoke all on function public.record_edge_judgment(uuid, text, text, uuid, text, text, text, date, text, uuid)
  from public, anon;
revoke all on function public.record_edge_event_judgment(uuid, text, text, text, date) from public, anon;
grant execute on function public.record_edge_judgment(uuid, text, text, uuid, text, text, text, date, text, uuid)
  to authenticated;
grant execute on function public.record_edge_event_judgment(uuid, text, text, text, date) to authenticated;
