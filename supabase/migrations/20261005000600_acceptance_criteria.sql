-- =============================================================================
-- DSA OS — Phase 6: engagement acceptance criteria.
--
-- An acceptance criterion is a lightweight engagement-governance record
-- (D20), off the element spine like implementation_checkpoints: an ACR-nnn
-- code (D33), one governed element (an Implementation Initiative or a core
-- object), text that is frozen once agreed, and a lifecycle of proposed ->
-- agreed -> superseded or withdrawn. It is not an element, a Method Asset, a
-- task, a checkpoint, a Review or a score: it has no assignee, no progress
-- and no pass or fail. A Standard from the Method Library may have informed
-- it; that reference is internal only.
--
-- record_review_validation now also captures the agreed criteria in force
-- when a Review validates an initiative (D34): those on the initiative and on
-- the core objects it implements. The ADR-0036 gate is unchanged, and a
-- validation with no agreed criteria remains valid.
--
-- See docs/product/PHASE_6_PROPOSAL.md §15, D20, D33 and D34.
-- =============================================================================

create table public.acceptance_criteria (
  id                             uuid primary key default gen_random_uuid(),
  engagement_id                  uuid not null references public.engagements (id) on delete restrict,
  reference_code                 text not null check (reference_code ~ '^ACR-[0-9]{3,}$'),
  governed_element_id            uuid not null,
  governed_kind                  public.element_kind not null check (governed_kind in ('object', 'implementation_initiative')),
  body                           text not null check (char_length(btrim(body)) between 1 and 2000),
  state                          public.acceptance_criterion_state not null default 'proposed',
  agreed_with                    text check (agreed_with is null or char_length(btrim(agreed_with)) between 1 and 300),
  agreed_on                      date,
  agreed_recorded_by             uuid references public.profiles (id) on delete set null,
  agreement_evidence_source_id   uuid,
  supersedes_criterion_id        uuid,
  closure_reason                 text check (closure_reason is null or char_length(btrim(closure_reason)) between 1 and 1000),
  closed_at                      timestamptz,
  informing_standard_version_id  uuid references public.method_asset_versions (id) on delete restrict,
  informing_criterion_key        text,
  client_visible                 boolean not null default true,
  created_by                     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),
  constraint acceptance_criteria_engagement_key unique (id, engagement_id),
  constraint acceptance_criteria_code_unique unique (engagement_id, reference_code),
  -- A proposed criterion can sit on a draft, and goes with it; an agreed one
  -- needs a published element, which is never deleted.
  constraint acceptance_criteria_element_fk foreign key (governed_element_id, engagement_id, governed_kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade,
  constraint acceptance_criteria_evidence_fk foreign key (agreement_evidence_source_id, engagement_id)
    references public.evidence_sources (id, engagement_id) on delete restrict,
  constraint acceptance_criteria_supersedes_fk foreign key (supersedes_criterion_id, engagement_id)
    references public.acceptance_criteria (id, engagement_id) on delete restrict,
  constraint acceptance_criteria_agreed check (
    state = 'proposed' or (agreed_with is not null and agreed_on is not null)
  ),
  constraint acceptance_criteria_closed check (
    (state in ('superseded', 'withdrawn')) = (closure_reason is not null and closed_at is not null)
  ),
  constraint acceptance_criteria_informing check (informing_criterion_key is null or informing_standard_version_id is not null)
);
create index acceptance_criteria_element_idx on public.acceptance_criteria (governed_element_id, state);
create unique index acceptance_criteria_superseded_once on public.acceptance_criteria (supersedes_criterion_id)
  where supersedes_criterion_id is not null;

create table public.validation_criteria (
  validation_relationship_id  uuid not null references public.architecture_relationships (id) on delete restrict,
  criterion_id                uuid not null references public.acceptance_criteria (id) on delete restrict,
  engagement_id               uuid not null references public.engagements (id) on delete restrict,
  note                        text not null default '' check (char_length(note) <= 2000),
  note_updated_by             uuid references public.profiles (id) on delete set null,
  note_updated_at             timestamptz,
  captured_at                 timestamptz not null default now(),
  primary key (validation_relationship_id, criterion_id)
);
create index validation_criteria_criterion_idx on public.validation_criteria (criterion_id);

-- -----------------------------------------------------------------------------
-- Guards
-- -----------------------------------------------------------------------------

-- Operations only. A proposal is working material; agreement freezes the
-- text, the governed element, the informing Standard and the agreement.
-- After that the only change is closure (superseded or withdrawn), once.
create function private.guard_acceptance_criterion()
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
  if tg_op = 'UPDATE' then
    if new.engagement_id <> old.engagement_id or new.reference_code <> old.reference_code
       or new.governed_element_id <> old.governed_element_id then
      raise exception 'An acceptance criterion''s identity is permanent' using errcode = '23514';
    end if;
    if old.state <> 'proposed' then
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

create trigger acceptance_criteria_guard before insert or update or delete on public.acceptance_criteria
  for each row execute function private.guard_acceptance_criterion();
create trigger acceptance_criteria_set_updated_at before update on public.acceptance_criteria
  for each row execute function private.set_updated_at();

-- Captures are written only inside record_review_validation, and only their
-- note changes afterwards.
create function private.guard_validation_criterion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'What a validation was judged against is permanent' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and not private.in_architecture_operation() then
    raise exception 'Criteria are captured only when a Review validates' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if not private.in_methodology_operation() then
      raise exception 'Validation notes change only through set_validation_criterion_note' using errcode = '42501';
    end if;
    if (to_jsonb(new) - array['note', 'note_updated_by', 'note_updated_at'])
       is distinct from (to_jsonb(old) - array['note', 'note_updated_by', 'note_updated_at']) then
      raise exception 'What a validation was judged against is permanent' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger validation_criteria_guard before insert or update or delete on public.validation_criteria
  for each row execute function private.guard_validation_criterion();

create trigger acceptance_criteria_log after insert or update or delete on public.acceptance_criteria
  for each row execute function private.log_activity();
create trigger validation_criteria_log after insert or update or delete on public.validation_criteria
  for each row execute function private.log_activity();

-- -----------------------------------------------------------------------------
-- Privileges and RLS: internal architecture readers. Clients read agreed
-- criteria only through client_acceptance_criteria, which never returns the
-- informing Standard.
-- -----------------------------------------------------------------------------
revoke all on public.acceptance_criteria, public.validation_criteria from public, anon, authenticated;
grant select on public.acceptance_criteria, public.validation_criteria to authenticated;
alter table public.acceptance_criteria enable row level security;
alter table public.validation_criteria enable row level security;
create policy "acceptance criteria: internal architecture readers"
  on public.acceptance_criteria for select to authenticated
  using ((select private.is_internal()) and private.can_read_architecture(engagement_id));
create policy "validation criteria: internal architecture readers"
  on public.validation_criteria for select to authenticated
  using ((select private.is_internal()) and private.can_read_architecture(engagement_id));

-- -----------------------------------------------------------------------------
-- Operations
-- -----------------------------------------------------------------------------
create function private.lock_acceptance_criterion(
  target_criterion_id uuid,
  target_capability public.engagement_capability
)
returns public.acceptance_criteria
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.acceptance_criteria;
begin
  select * into c from public.acceptance_criteria where id = target_criterion_id;
  if not found or not private.is_internal() then
    raise exception 'Acceptance criterion not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(c.engagement_id, target_capability);
  perform private.lock_element(c.governed_element_id);
  select * into c from public.acceptance_criteria where id = target_criterion_id for update;
  return c;
end;
$$;

-- An informing Standard must be a published Standard, and the key one of its criteria.
create function private.check_informing_standard(target_version_id uuid, target_key text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_version_id is null then
    if target_key is not null then
      raise exception 'Name the Standard the criterion key belongs to' using errcode = '23514';
    end if;
    return;
  end if;
  perform private.require_usable_method_version(target_version_id, 'standard');
  if target_key is not null and not exists (
    select 1 from public.standard_version_criteria where version_id = target_version_id and key = target_key
  ) then
    raise exception 'That criterion is not part of the Standard' using errcode = '23514';
  end if;
end;
$$;

create function public.propose_acceptance_criterion(
  p_element_id uuid,
  p_body text,
  p_informing_standard_version_id uuid default null,
  p_informing_criterion_key text default null,
  p_client_visible boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  new_id uuid;
begin
  e := private.lock_element(p_element_id);
  perform private.require_architecture_capability(e.engagement_id, 'edit_architecture');
  if e.kind not in ('object', 'implementation_initiative') then
    raise exception 'Acceptance criteria govern an Implementation Initiative or a core object' using errcode = '23514';
  end if;
  if e.lifecycle = 'retired' then
    raise exception 'A retired element takes no new criteria' using errcode = '23514';
  end if;
  perform private.check_informing_standard(p_informing_standard_version_id, nullif(btrim(coalesce(p_informing_criterion_key, '')), ''));
  perform private.begin_methodology_operation();
  insert into public.acceptance_criteria (
    engagement_id, reference_code, governed_element_id, governed_kind, body,
    informing_standard_version_id, informing_criterion_key, client_visible
  ) values (
    e.engagement_id, private.next_reference_code(e.engagement_id, 'ACR'), e.id, e.kind, btrim(p_body),
    p_informing_standard_version_id, nullif(btrim(coalesce(p_informing_criterion_key, '')), ''), coalesce(p_client_visible, true)
  ) returning id into new_id;
  perform private.end_methodology_operation();
  return new_id;
end;
$$;

create function public.update_acceptance_criterion(
  p_criterion_id uuid,
  p_body text,
  p_informing_standard_version_id uuid default null,
  p_informing_criterion_key text default null,
  p_client_visible boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.acceptance_criteria;
begin
  c := private.lock_acceptance_criterion(p_criterion_id, 'edit_architecture');
  if c.state <> 'proposed' then
    raise exception 'An agreed acceptance criterion is frozen: supersede it instead' using errcode = '23514';
  end if;
  if p_informing_standard_version_id is distinct from c.informing_standard_version_id
     or p_informing_criterion_key is distinct from c.informing_criterion_key then
    perform private.check_informing_standard(p_informing_standard_version_id, nullif(btrim(coalesce(p_informing_criterion_key, '')), ''));
  end if;
  perform private.begin_methodology_operation();
  update public.acceptance_criteria
  set body = btrim(p_body), informing_standard_version_id = p_informing_standard_version_id,
      informing_criterion_key = nullif(btrim(coalesce(p_informing_criterion_key, '')), ''),
      client_visible = coalesce(p_client_visible, true)
  where id = c.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.delete_acceptance_criterion(p_criterion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.acceptance_criteria;
begin
  c := private.lock_acceptance_criterion(p_criterion_id, 'edit_architecture');
  if c.state <> 'proposed' then
    raise exception 'An agreed acceptance criterion is never deleted; supersede or withdraw it' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  delete from public.acceptance_criteria where id = c.id;
  perform private.end_methodology_operation();
end;
$$;

create function private.agree_criterion_row(
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
  update public.acceptance_criteria
  set state = 'agreed', agreed_with = btrim(target_agreed_with), agreed_on = target_agreed_on,
      agreed_recorded_by = auth.uid(), agreement_evidence_source_id = target_evidence_source_id
  where id = c.id;
end;
$$;

create function public.agree_acceptance_criterion(
  p_criterion_id uuid,
  p_agreed_with text,
  p_agreed_on date,
  p_agreement_evidence_source_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.acceptance_criteria;
begin
  c := private.lock_acceptance_criterion(p_criterion_id, 'publish_architecture');
  if c.state <> 'proposed' then
    raise exception 'Only a proposed criterion can be agreed' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  perform private.agree_criterion_row(c.id, p_agreed_with, p_agreed_on, p_agreement_evidence_source_id);
  perform private.end_methodology_operation();
end;
$$;

-- Revision by supersession: the replacement (proposed, or agreed at once)
-- carries the governed element and informing Standard forward.
create function public.supersede_acceptance_criterion(
  p_criterion_id uuid,
  p_new_body text,
  p_reason text,
  p_agreed_with text default null,
  p_agreed_on date default null,
  p_agreement_evidence_source_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.acceptance_criteria;
  new_id uuid;
begin
  c := private.lock_acceptance_criterion(p_criterion_id, 'publish_architecture');
  if c.state <> 'agreed' then
    raise exception 'Only an agreed criterion is superseded; edit a proposal directly' using errcode = '23514';
  end if;
  if not private.nonblank(p_reason) then
    raise exception 'Superseding a criterion needs a reason' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  update public.acceptance_criteria
  set state = 'superseded', closure_reason = btrim(p_reason), closed_at = now()
  where id = c.id;
  insert into public.acceptance_criteria (
    engagement_id, reference_code, governed_element_id, governed_kind, body, supersedes_criterion_id,
    informing_standard_version_id, informing_criterion_key, client_visible
  ) values (
    c.engagement_id, private.next_reference_code(c.engagement_id, 'ACR'), c.governed_element_id, c.governed_kind,
    btrim(p_new_body), c.id, c.informing_standard_version_id, c.informing_criterion_key, c.client_visible
  ) returning id into new_id;
  if p_agreed_with is not null or p_agreed_on is not null then
    perform private.agree_criterion_row(new_id, p_agreed_with, p_agreed_on, p_agreement_evidence_source_id);
  end if;
  perform private.end_methodology_operation();
  return new_id;
end;
$$;

create function public.withdraw_acceptance_criterion(p_criterion_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.acceptance_criteria;
begin
  c := private.lock_acceptance_criterion(p_criterion_id, 'publish_architecture');
  if c.state <> 'agreed' then
    raise exception 'Only an agreed criterion is withdrawn; delete a proposal instead' using errcode = '23514';
  end if;
  if not private.nonblank(p_reason) then
    raise exception 'Withdrawing a criterion needs a reason' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  update public.acceptance_criteria
  set state = 'withdrawn', closure_reason = btrim(p_reason), closed_at = now()
  where id = c.id;
  perform private.end_methodology_operation();
end;
$$;

-- How the evidence addressed one criterion. A note, never a verdict.
create function public.set_validation_criterion_note(
  p_validation_relationship_id uuid,
  p_criterion_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  vc public.validation_criteria;
begin
  select * into vc from public.validation_criteria
  where validation_relationship_id = p_validation_relationship_id and criterion_id = p_criterion_id;
  if not found or not private.is_internal() then
    raise exception 'That criterion was not captured by this validation' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(vc.engagement_id, 'publish_architecture');
  perform private.begin_methodology_operation();
  update public.validation_criteria
  set note = btrim(coalesce(p_note, '')), note_updated_by = auth.uid(), note_updated_at = now()
  where validation_relationship_id = vc.validation_relationship_id and criterion_id = vc.criterion_id;
  perform private.end_methodology_operation();
end;
$$;

-- The agreed criteria in force for an initiative: its own and those on the
-- core objects it implements.
create function public.criteria_in_force(p_initiative_element_id uuid)
returns setof public.acceptance_criteria
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from public.acceptance_criteria c
  join public.architecture_elements i on i.id = p_initiative_element_id and i.kind = 'implementation_initiative'
  where private.is_internal() and private.can_read_architecture(i.engagement_id)
    and c.state = 'agreed'
    and (
      c.governed_element_id = i.id
      or exists (
        select 1 from public.architecture_relationships impl
        where impl.source_element_id = i.id and impl.relationship_type = 'implements' and impl.retired_at is null
          and impl.target_element_id = c.governed_element_id
      )
    )
  order by c.reference_code;
$$;

-- -----------------------------------------------------------------------------
-- record_review_validation: unchanged gate (ADR-0036), plus the capture (D34).
-- -----------------------------------------------------------------------------
create or replace function public.record_review_validation(p_review_element_id uuid, p_initiative_element_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rev public.architecture_elements;
  init public.architecture_elements;
  r public.reviews;
  relationship_id uuid;
begin
  perform private.begin_architecture_operation();
  rev := private.lock_element(p_review_element_id);
  init := private.lock_element(p_initiative_element_id);
  if rev.kind <> 'review' then
    raise exception 'Only a review validates an initiative' using errcode = '23514';
  end if;
  if init.kind <> 'implementation_initiative' then
    raise exception 'Only an implementation initiative is validated' using errcode = '23514';
  end if;
  if rev.engagement_id <> init.engagement_id then
    raise exception 'The review and the initiative must be on the same engagement' using errcode = '23514';
  end if;
  perform private.require_architecture_capability(rev.engagement_id, 'publish_architecture');
  select * into r from public.reviews where element_id = rev.id;
  if r.review_status <> 'held' then
    raise exception 'Only a held review may validate an initiative' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.architecture_relationships x
    where x.source_element_id = rev.id and x.relationship_type = 'examines' and x.retired_at is null
      and (
        x.target_element_id = init.id
        or exists (
          select 1 from public.architecture_relationships impl
          where impl.source_element_id = init.id and impl.relationship_type = 'implements' and impl.retired_at is null
            and impl.target_element_id = x.target_element_id
        )
      )
  ) then
    raise exception 'The review must examine this initiative, or an object it implements, before validating it'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.architecture_relationships x
    where x.source_element_id = rev.id and x.target_element_id = init.id
      and x.relationship_type = 'validates' and x.retired_at is null
  ) then
    raise exception 'This review has already validated this initiative' using errcode = '23514';
  end if;
  insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values (rev.engagement_id, rev.id, init.id, 'validates', 'architect_judgment')
  returning id into relationship_id;

  -- D34: what this validation was judged against, as agreed at this moment.
  insert into public.validation_criteria (validation_relationship_id, criterion_id, engagement_id)
  select relationship_id, c.id, c.engagement_id from public.criteria_in_force(init.id) c;

  perform private.end_architecture_operation();
  return relationship_id;
end;
$$;

revoke all on function private.guard_acceptance_criterion() from public, anon, authenticated;
revoke all on function private.guard_validation_criterion() from public, anon, authenticated;
revoke all on function private.lock_acceptance_criterion(uuid, public.engagement_capability) from public, anon, authenticated;
revoke all on function private.check_informing_standard(uuid, text) from public, anon, authenticated;
revoke all on function private.agree_criterion_row(uuid, text, date, uuid) from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.propose_acceptance_criterion(uuid, text, uuid, text, boolean)',
    'public.update_acceptance_criterion(uuid, text, uuid, text, boolean)',
    'public.delete_acceptance_criterion(uuid)',
    'public.agree_acceptance_criterion(uuid, text, date, uuid)',
    'public.supersede_acceptance_criterion(uuid, text, text, text, date, uuid)',
    'public.withdraw_acceptance_criterion(uuid, text)',
    'public.set_validation_criterion_note(uuid, uuid, text)',
    'public.criteria_in_force(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
