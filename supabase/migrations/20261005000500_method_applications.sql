-- =============================================================================
-- DSA OS — Phase 6: Method Applications.
--
-- A Method Application is one actual use of one exact published Method
-- version, on one engagement, for a stated reason (§11). It is an internal,
-- off-spine practice record (D14): it links to elements, evidence, components
-- and domains, and never writes architecture relationships. Codes are MUS-nnn
-- (D13). Stages are guidance: a stage note records how a stage was treated,
-- never an assignee, a date or a status (D17). Closure freezes the record;
-- later insight goes in append-only addenda.
--
-- Element links capture the element's code, kind, type and title (D30). If
-- an unpublished linked draft is later deleted under the ordinary Phase 3
-- rule, the link keeps that identity, element_id becomes null and
-- element_removed_at is stamped: the one change a closed application allows.
--
-- Every table is readable only by internal users who can read the
-- engagement's architecture. See docs/product/PHASE_6_PROPOSAL.md §11, §12,
-- §24 and §25.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------
create table public.method_applications (
  id                        uuid primary key default gen_random_uuid(),
  engagement_id             uuid not null references public.engagements (id) on delete restrict,
  reference_code            text not null check (reference_code ~ '^MUS-[0-9]{3,}$'),
  method_asset_version_id   uuid not null references public.method_asset_versions (id) on delete restrict,
  dam_release_id            uuid references public.dam_releases (id) on delete restrict,
  version_in_release        boolean not null,
  outside_release_reason    text check (outside_release_reason is null or char_length(btrim(outside_release_reason)) between 1 and 1000),
  title                     text not null check (char_length(btrim(title)) between 1 and 200),
  selection_reason          text not null check (char_length(btrim(selection_reason)) between 1 and 2000),
  architectural_question    text not null default '' check (char_length(architectural_question) <= 1000),
  engagement_wide           boolean not null default false,
  state                     public.method_application_state not null default 'planned',
  started_on                date,
  closed_on                 date,
  completion_statement      text check (completion_statement is null or char_length(btrim(completion_statement)) between 1 and 4000),
  retrospective             text check (retrospective is null or char_length(retrospective) <= 4000),
  discontinued_reason       text check (discontinued_reason is null or char_length(btrim(discontinued_reason)) between 1 and 2000),
  continues_application_id  uuid,
  created_by                uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint method_applications_engagement_key unique (id, engagement_id),
  constraint method_applications_code_unique unique (engagement_id, reference_code),
  constraint method_applications_continues_fk foreign key (continues_application_id, engagement_id)
    references public.method_applications (id, engagement_id) on delete restrict,
  constraint method_applications_release_reason check (version_in_release or outside_release_reason is not null),
  constraint method_applications_closed check (
    (state in ('completed', 'discontinued')) = (closed_on is not null)
  ),
  constraint method_applications_completed check ((state = 'completed') = (completion_statement is not null)),
  constraint method_applications_discontinued check ((state = 'discontinued') = (discontinued_reason is not null)),
  constraint method_applications_started check (state = 'planned' or started_on is not null or state = 'discontinued')
);
create index method_applications_version_idx on public.method_applications (method_asset_version_id);
create index method_applications_engagement_idx on public.method_applications (engagement_id, state);

create table public.method_application_practitioners (
  application_id        uuid not null,
  engagement_id         uuid not null,
  engagement_member_id  uuid not null,
  role                  text not null check (role in ('lead', 'contributor')),
  primary key (application_id, engagement_member_id),
  foreign key (application_id, engagement_id) references public.method_applications (id, engagement_id) on delete cascade,
  foreign key (engagement_member_id, engagement_id) references public.engagement_members (id, engagement_id) on delete restrict
);
create unique index method_application_practitioners_one_lead
  on public.method_application_practitioners (application_id) where role = 'lead';

create table public.method_application_contexts (
  application_id  uuid not null references public.method_applications (id) on delete cascade,
  context_id      uuid not null references public.development_contexts (id) on delete restrict,
  primary key (application_id, context_id)
);

create table public.method_application_domains (
  application_id  uuid not null references public.method_applications (id) on delete cascade,
  domain          public.architecture_domain not null,
  primary key (application_id, domain)
);

create table public.method_application_stage_notes (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.method_applications (id) on delete cascade,
  stage_id        uuid not null references public.method_version_stages (id) on delete restrict,
  treatment       public.method_stage_treatment not null,
  reason          text check (reason is null or char_length(btrim(reason)) between 1 and 2000),
  note            text not null default '' check (char_length(note) <= 8000),
  updated_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at      timestamptz not null default now(),
  constraint method_application_stage_notes_unique unique (application_id, stage_id),
  constraint method_application_stage_notes_reason check (treatment = 'followed' or reason is not null)
);

create table public.method_application_elements (
  id                        uuid primary key default gen_random_uuid(),
  application_id            uuid not null,
  engagement_id             uuid not null,
  element_id                uuid,
  role                      public.method_application_element_role not null,
  observed_version_id       uuid references public.element_versions (id) on delete restrict,
  captured_reference_code   text,
  captured_kind             public.element_kind not null,
  captured_object_type_key  text,
  captured_title            text not null,
  captured_at               timestamptz not null default now(),
  element_removed_at        timestamptz,
  note                      text not null default '' check (char_length(note) <= 2000),
  created_by                uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at                timestamptz not null default now(),
  foreign key (application_id, engagement_id) references public.method_applications (id, engagement_id) on delete cascade,
  constraint method_application_elements_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete set null (element_id),
  constraint method_application_elements_removed check ((element_id is null) = (element_removed_at is not null))
);
create unique index method_application_elements_unique
  on public.method_application_elements (application_id, element_id, role) where element_id is not null;
create index method_application_elements_element_idx on public.method_application_elements (element_id);

create table public.method_application_evidence (
  id                     uuid primary key default gen_random_uuid(),
  application_id         uuid not null,
  engagement_id          uuid not null,
  evidence_source_id     uuid not null,
  role                   public.method_application_evidence_role not null,
  instrument_version_id  uuid references public.method_asset_versions (id) on delete restrict,
  note                   text not null default '' check (char_length(note) <= 2000),
  created_by             uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  foreign key (application_id, engagement_id) references public.method_applications (id, engagement_id) on delete cascade,
  foreign key (evidence_source_id, engagement_id) references public.evidence_sources (id, engagement_id) on delete restrict,
  constraint method_application_evidence_unique unique (application_id, evidence_source_id, role)
);
create index method_application_evidence_source_idx on public.method_application_evidence (evidence_source_id);

create table public.method_application_assets (
  application_id    uuid not null references public.method_applications (id) on delete cascade,
  asset_version_id  uuid not null references public.method_asset_versions (id) on delete restrict,
  deviation_note    text not null default '' check (char_length(deviation_note) <= 2000),
  primary key (application_id, asset_version_id)
);
create index method_application_assets_version_idx on public.method_application_assets (asset_version_id);

create table public.method_application_addenda (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null,
  engagement_id   uuid not null,
  body            text not null check (char_length(btrim(body)) between 1 and 4000),
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  foreign key (application_id, engagement_id) references public.method_applications (id, engagement_id) on delete restrict
);

-- The practice loop's return path (§11.7): a new version cites the closed
-- applications that motivated it. A child of the version; frozen with it.
create table public.method_version_learning_sources (
  version_id      uuid not null references public.method_asset_versions (id) on delete cascade,
  application_id  uuid not null references public.method_applications (id) on delete restrict,
  note            text not null check (char_length(btrim(note)) between 1 and 2000),
  primary key (version_id, application_id)
);

-- -----------------------------------------------------------------------------
-- 2. Guards
-- -----------------------------------------------------------------------------
create function private.method_application_closed(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select state in ('completed', 'discontinued') from public.method_applications
                   where id = target_application_id), false);
$$;

-- Applications change only through operations. A closed application is
-- frozen: nothing about it changes again.
create function private.guard_method_application()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.in_methodology_operation() then
    raise exception 'Method Applications change only through their operations' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Method Applications are discontinued, never deleted' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if old.state in ('completed', 'discontinued') then
      raise exception 'A closed Method Application is frozen; add an addendum instead' using errcode = '23514';
    end if;
    if new.method_asset_version_id <> old.method_asset_version_id or new.engagement_id <> old.engagement_id
       or new.reference_code <> old.reference_code or new.dam_release_id is distinct from old.dam_release_id
       or new.version_in_release <> old.version_in_release then
      raise exception 'A Method Application''s pin never changes: discontinue it and start another' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger method_applications_guard before insert or update or delete on public.method_applications
  for each row execute function private.guard_method_application();
create trigger method_applications_set_updated_at before update on public.method_applications
  for each row execute function private.set_updated_at();

-- Child rows follow their application: operations only, open applications
-- only. The single exception (D30): the database clearing element_id when a
-- linked unpublished draft is deleted, which stamps element_removed_at.
create function private.guard_method_application_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_application uuid;
begin
  if tg_table_name = 'method_application_elements' and tg_op = 'UPDATE' then
    if (to_jsonb(old) ->> 'element_id') is not null and (to_jsonb(new) ->> 'element_id') is null
       and not exists (select 1 from public.architecture_elements where id = (to_jsonb(old) ->> 'element_id')::uuid)
       and (to_jsonb(new) - array['element_id', 'element_removed_at'])
           = (to_jsonb(old) - array['element_id', 'element_removed_at']) then
      new := jsonb_populate_record(new, jsonb_build_object('element_removed_at', now()));
      return new;
    end if;
  end if;

  target_application := case when tg_op = 'DELETE' then old.application_id else new.application_id end;
  if not exists (select 1 from public.method_applications where id = target_application) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if not private.in_methodology_operation() then
    raise exception 'Method Applications change only through their operations' using errcode = '42501';
  end if;
  if tg_table_name = 'method_application_addenda' then
    if tg_op <> 'INSERT' then
      raise exception 'Addenda are append-only' using errcode = '23514';
    end if;
    if not private.method_application_closed(target_application) then
      raise exception 'Addenda are added after closure; record notes on the open application instead'
        using errcode = '23514';
    end if;
  elsif private.method_application_closed(target_application) then
    raise exception 'A closed Method Application is frozen; add an addendum instead' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'method_application_practitioners', 'method_application_contexts', 'method_application_domains',
    'method_application_stage_notes', 'method_application_elements', 'method_application_evidence',
    'method_application_assets', 'method_application_addenda'
  ] loop
    execute format('create trigger %1$s_guard before insert or update or delete on public.%1$I
                      for each row execute function private.guard_method_application_child()', tbl);
  end loop;
end;
$$;

create trigger method_version_learning_sources_guard before insert or update or delete on public.method_version_learning_sources
  for each row execute function private.guard_method_version_child();

create or replace function private.method_child_forms(child_table text)
returns public.method_asset_form[]
language sql
immutable
set search_path = ''
as $$
  select case child_table
    when 'method_version_domains' then array['method', 'model', 'standard', 'instrument', 'template']
    when 'method_version_contexts' then array['method', 'model', 'standard', 'instrument', 'template']
    when 'method_version_learning_sources' then array['method', 'model', 'standard', 'instrument', 'template']
    when 'method_version_stages' then array['method']
    when 'method_version_outputs' then array['method', 'model']
    when 'method_version_components' then array['method']
    when 'standard_version_criteria' then array['standard']
    when 'standard_version_judged_in' then array['standard']
    when 'instrument_version_evidence_types' then array['instrument']
    when 'template_version_specs' then array['template']
    when 'template_version_sections' then array['template']
    when 'method_version_files' then array['template', 'instrument']
  end::public.method_asset_form[];
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'method_applications', 'method_application_practitioners', 'method_application_contexts',
    'method_application_domains', 'method_application_stage_notes', 'method_application_elements',
    'method_application_evidence', 'method_application_assets', 'method_application_addenda',
    'method_version_learning_sources'
  ] loop
    execute format('create trigger %1$s_log after insert or update or delete on public.%1$I
                      for each row execute function private.log_activity()', tbl);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Privileges and RLS: internal architecture readers only
-- -----------------------------------------------------------------------------
revoke all on
  public.method_applications, public.method_application_practitioners, public.method_application_contexts,
  public.method_application_domains, public.method_application_stage_notes, public.method_application_elements,
  public.method_application_evidence, public.method_application_assets, public.method_application_addenda,
  public.method_version_learning_sources
from public, anon, authenticated;
grant select on
  public.method_applications, public.method_application_practitioners, public.method_application_contexts,
  public.method_application_domains, public.method_application_stage_notes, public.method_application_elements,
  public.method_application_evidence, public.method_application_assets, public.method_application_addenda,
  public.method_version_learning_sources
to authenticated;

create function private.can_read_method_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_internal() and exists (
    select 1 from public.method_applications a
    where a.id = target_application_id and private.can_read_architecture(a.engagement_id)
  );
$$;
revoke all on function private.can_read_method_application(uuid) from public, anon;
grant execute on function private.can_read_method_application(uuid) to authenticated;

alter table public.method_applications enable row level security;
create policy "method applications: internal architecture readers"
  on public.method_applications for select to authenticated
  using ((select private.is_internal()) and private.can_read_architecture(engagement_id));

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'method_application_practitioners', 'method_application_contexts', 'method_application_domains',
    'method_application_stage_notes', 'method_application_elements', 'method_application_evidence',
    'method_application_assets', 'method_application_addenda'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    -- There is intentionally no policy a client or licensed-practice user can satisfy.
    execute format('create policy "%s: internal architecture readers" on public.%I for select to authenticated
                      using (private.can_read_method_application(application_id))', tbl, tbl);
  end loop;
end;
$$;

alter table public.method_version_learning_sources enable row level security;
create policy "method_version_learning_sources: internal only"
  on public.method_version_learning_sources for select to authenticated
  using ((select private.is_internal()));

-- -----------------------------------------------------------------------------
-- 4. Operation helpers
-- -----------------------------------------------------------------------------

-- An application the caller may work on (edit_architecture), locked.
create function private.lock_method_application(target_application_id uuid, require_open boolean)
returns public.method_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  select * into a from public.method_applications where id = target_application_id;
  if not found or not private.is_internal() then
    raise exception 'Method Application not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(a.engagement_id, 'edit_architecture');
  select * into a from public.method_applications where id = target_application_id for update;
  if require_open and a.state in ('completed', 'discontinued') then
    raise exception 'A closed Method Application is frozen; add an addendum instead' using errcode = '23514';
  end if;
  return a;
end;
$$;

-- The caller's (or a named) internal engagement membership.
create function private.internal_engagement_member(target_engagement_id uuid, target_member_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m uuid;
begin
  select em.id into m from public.engagement_members em
  where em.engagement_id = target_engagement_id
    and em.side = 'internal' and em.status = 'active'
    and (em.id = target_member_id or (target_member_id is null and em.user_id = auth.uid()));
  if m is null then
    raise exception 'A practitioner must be an active TPLCo member of the engagement' using errcode = '23514';
  end if;
  return m;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Operations: starting and describing (edit_architecture)
-- -----------------------------------------------------------------------------
create function public.start_method_application(
  p_engagement_id uuid,
  p_method_version_id uuid,
  p_title text,
  p_selection_reason text,
  p_architectural_question text default '',
  p_outside_release_reason text default null,
  p_lead_member_id uuid default null,
  p_continues_application_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eng public.engagements;
  v public.method_asset_versions;
  in_release boolean;
  lead uuid;
  new_id uuid;
begin
  perform private.require_architecture_capability(p_engagement_id, 'edit_architecture');
  select * into eng from public.engagements where id = p_engagement_id for update;
  -- Only Methods are performed (D2); only published versions (D9).
  v := private.require_usable_method_version(p_method_version_id, 'method');
  if not private.nonblank(p_selection_reason) then
    raise exception 'Say why this method was selected' using errcode = '23514';
  end if;
  in_release := exists (
    select 1 from public.dam_release_members
    where release_id = eng.dam_release_id and asset_version_id = v.id
  );
  if not in_release and not private.nonblank(p_outside_release_reason) then
    raise exception 'This version is not in the engagement''s DAM release; say why it is used' using errcode = '23514';
  end if;
  if p_continues_application_id is not null and not exists (
    select 1 from public.method_applications
    where id = p_continues_application_id and engagement_id = eng.id and state = 'discontinued'
  ) then
    raise exception 'An application continues only a discontinued application on the same engagement'
      using errcode = '23514';
  end if;
  lead := private.internal_engagement_member(eng.id, p_lead_member_id);

  perform private.begin_methodology_operation();
  insert into public.method_applications (
    engagement_id, reference_code, method_asset_version_id, dam_release_id, version_in_release,
    outside_release_reason, title, selection_reason, architectural_question, continues_application_id
  ) values (
    eng.id, private.next_reference_code(eng.id, 'MUS'), v.id, eng.dam_release_id, in_release,
    case when in_release then null else btrim(p_outside_release_reason) end,
    btrim(p_title), btrim(p_selection_reason), btrim(coalesce(p_architectural_question, '')), p_continues_application_id
  ) returning id into new_id;
  insert into public.method_application_practitioners (application_id, engagement_id, engagement_member_id, role)
  values (new_id, eng.id, lead, 'lead');
  -- The engagement's contexts at the time, adjustable until closure.
  insert into public.method_application_contexts (application_id, context_id)
    select new_id, context_id from public.engagement_development_contexts where engagement_id = eng.id;
  perform private.end_methodology_operation();
  return new_id;
end;
$$;

create function public.update_method_application(
  p_application_id uuid,
  p_title text,
  p_selection_reason text,
  p_architectural_question text,
  p_engagement_wide boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  a := private.lock_method_application(p_application_id, true);
  if not private.nonblank(p_selection_reason) then
    raise exception 'Say why this method was selected' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  update public.method_applications
  set title = btrim(p_title), selection_reason = btrim(p_selection_reason),
      architectural_question = btrim(coalesce(p_architectural_question, '')),
      engagement_wide = coalesce(p_engagement_wide, false)
  where id = a.id;
  perform private.end_methodology_operation();
end;
$$;

-- Practitioners: [{engagement_member_id, role}], exactly one lead.
create function public.set_method_application_practitioners(p_application_id uuid, p_practitioners jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
  item jsonb;
begin
  a := private.lock_method_application(p_application_id, true);
  if (select count(*) from jsonb_array_elements(coalesce(p_practitioners, '[]'::jsonb)) p where p ->> 'role' = 'lead') <> 1 then
    raise exception 'A Method Application has exactly one lead' using errcode = '23514';
  end if;
  for item in select * from jsonb_array_elements(p_practitioners) loop
    perform private.internal_engagement_member(a.engagement_id, (item ->> 'engagement_member_id')::uuid);
  end loop;
  perform private.begin_methodology_operation();
  delete from public.method_application_practitioners where application_id = a.id;
  insert into public.method_application_practitioners (application_id, engagement_id, engagement_member_id, role)
    select a.id, a.engagement_id, (p ->> 'engagement_member_id')::uuid, p ->> 'role'
    from jsonb_array_elements(p_practitioners) p;
  perform private.end_methodology_operation();
end;
$$;

create function public.set_method_application_contexts(p_application_id uuid, p_context_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  a := private.lock_method_application(p_application_id, true);
  if exists (select 1 from unnest(coalesce(p_context_ids, '{}')) i
             where not exists (select 1 from public.development_contexts c where c.id = i)) then
    raise exception 'Development Context not found' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  delete from public.method_application_contexts where application_id = a.id;
  insert into public.method_application_contexts (application_id, context_id)
    select distinct a.id, i from unnest(coalesce(p_context_ids, '{}')) i;
  perform private.end_methodology_operation();
end;
$$;

create function public.set_method_application_domains(p_application_id uuid, p_domains public.architecture_domain[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  a := private.lock_method_application(p_application_id, true);
  perform private.begin_methodology_operation();
  delete from public.method_application_domains where application_id = a.id;
  insert into public.method_application_domains (application_id, domain)
    select distinct a.id, d from unnest(coalesce(p_domains, '{}')) d;
  perform private.end_methodology_operation();
end;
$$;

-- How a stage of the pinned version was treated. Guidance, never status.
create function public.set_method_application_stage_note(
  p_application_id uuid,
  p_stage_id uuid,
  p_treatment public.method_stage_treatment,
  p_reason text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  a := private.lock_method_application(p_application_id, true);
  if not exists (select 1 from public.method_version_stages where id = p_stage_id and version_id = a.method_asset_version_id) then
    raise exception 'That stage is not part of the pinned method version' using errcode = '23514';
  end if;
  if p_treatment <> 'followed' and not private.nonblank(p_reason) then
    raise exception 'Say why the stage was %', p_treatment using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  insert into public.method_application_stage_notes (application_id, stage_id, treatment, reason, note)
  values (a.id, p_stage_id, p_treatment, nullif(btrim(coalesce(p_reason, '')), ''), btrim(coalesce(p_note, '')))
  on conflict (application_id, stage_id) do update
    set treatment = excluded.treatment, reason = excluded.reason, note = excluded.note,
        updated_by = auth.uid(), updated_at = now();
  perform private.end_methodology_operation();
end;
$$;

create function public.clear_method_application_stage_note(p_application_id uuid, p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  a := private.lock_method_application(p_application_id, true);
  perform private.begin_methodology_operation();
  delete from public.method_application_stage_notes where application_id = a.id and stage_id = p_stage_id;
  perform private.end_methodology_operation();
end;
$$;

-- Components actually used: an exact published Model, Standard, Instrument
-- or Template version, with a note when it differs from the declared ones.
create function public.set_method_application_asset(
  p_application_id uuid,
  p_asset_version_id uuid,
  p_deviation_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
  v public.method_asset_versions;
begin
  a := private.lock_method_application(p_application_id, true);
  if not exists (select 1 from public.method_application_assets where application_id = a.id and asset_version_id = p_asset_version_id) then
    v := private.require_usable_method_version(p_asset_version_id, null);
    if private.method_version_form(v.id) = 'method' then
      raise exception 'A Method is applied, not used as a component' using errcode = '23514';
    end if;
  end if;
  perform private.begin_methodology_operation();
  insert into public.method_application_assets (application_id, asset_version_id, deviation_note)
  values (a.id, p_asset_version_id, btrim(coalesce(p_deviation_note, '')))
  on conflict (application_id, asset_version_id) do update set deviation_note = excluded.deviation_note;
  perform private.end_methodology_operation();
end;
$$;

create function public.remove_method_application_asset(p_application_id uuid, p_asset_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  a := private.lock_method_application(p_application_id, true);
  if exists (select 1 from public.method_application_evidence
             where application_id = a.id and instrument_version_id = p_asset_version_id) then
    raise exception 'Evidence names this Instrument as its source; update that first' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  delete from public.method_application_assets where application_id = a.id and asset_version_id = p_asset_version_id;
  perform private.end_methodology_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Operations: links (edit_architecture). Never architecture relationships.
-- -----------------------------------------------------------------------------
create function private.method_element_role_allows(
  target_role public.method_application_element_role,
  target_kind public.element_kind
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case target_role
    when 'examined' then true
    when 'produced' then target_kind in ('object', 'assumption', 'risk', 'constraint', 'dependency', 'decision',
                                         'recommendation', 'opportunity', 'deliverable')
    when 'revised' then target_kind in ('object', 'assumption', 'risk', 'constraint', 'dependency', 'decision',
                                        'recommendation', 'opportunity', 'deliverable', 'implementation_initiative')
    when 'informed' then target_kind in ('decision', 'recommendation', 'review', 'implementation_initiative')
  end;
$$;

create function public.link_method_application_element(
  p_application_id uuid,
  p_element_id uuid,
  p_role public.method_application_element_role,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
  e public.architecture_elements;
  new_id uuid;
begin
  a := private.lock_method_application(p_application_id, true);
  select * into e from public.architecture_elements where id = p_element_id and engagement_id = a.engagement_id;
  if not found then
    raise exception 'Element not found on this engagement' using errcode = 'P0002';
  end if;
  if not private.method_element_role_allows(p_role, e.kind) then
    raise exception 'Method work cannot record this % as %', replace(e.kind::text, '_', ' '), p_role using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  insert into public.method_application_elements (
    application_id, engagement_id, element_id, role, captured_reference_code, captured_kind,
    captured_object_type_key, captured_title, note
  ) values (
    a.id, a.engagement_id, e.id, p_role, e.reference_code, e.kind,
    (select o.object_type from public.architecture_objects o where o.element_id = e.id),
    e.title, btrim(coalesce(p_note, ''))
  ) returning id into new_id;
  perform private.end_methodology_operation();
  return new_id;
end;
$$;

create function public.unlink_method_application_element(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.method_application_elements;
begin
  select * into l from public.method_application_elements where id = p_link_id;
  if not found then
    raise exception 'Link not found' using errcode = 'P0002';
  end if;
  perform private.lock_method_application(l.application_id, true);
  perform private.begin_methodology_operation();
  delete from public.method_application_elements where id = l.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.link_method_application_evidence(
  p_application_id uuid,
  p_evidence_source_id uuid,
  p_role public.method_application_evidence_role,
  p_instrument_version_id uuid default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
  new_id uuid;
begin
  a := private.lock_method_application(p_application_id, true);
  if not exists (select 1 from public.evidence_sources where id = p_evidence_source_id and engagement_id = a.engagement_id) then
    raise exception 'Evidence source not found on this engagement' using errcode = 'P0002';
  end if;
  if p_instrument_version_id is not null then
    if p_role <> 'gathered' then
      raise exception 'Only gathered evidence names the Instrument that gathered it' using errcode = '23514';
    end if;
    if private.method_version_form(p_instrument_version_id) is distinct from 'instrument' or not (
      exists (select 1 from public.method_application_assets where application_id = a.id and asset_version_id = p_instrument_version_id)
      or exists (select 1 from public.method_version_components where version_id = a.method_asset_version_id
                 and component_version_id = p_instrument_version_id)
    ) then
      raise exception 'Name an Instrument this application used or its Method declares' using errcode = '23514';
    end if;
  end if;
  perform private.begin_methodology_operation();
  insert into public.method_application_evidence (application_id, engagement_id, evidence_source_id, role, instrument_version_id, note)
  values (a.id, a.engagement_id, p_evidence_source_id, p_role, p_instrument_version_id, btrim(coalesce(p_note, '')))
  returning id into new_id;
  perform private.end_methodology_operation();
  return new_id;
end;
$$;

create function public.unlink_method_application_evidence(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.method_application_evidence;
begin
  select * into l from public.method_application_evidence where id = p_link_id;
  if not found then
    raise exception 'Link not found' using errcode = 'P0002';
  end if;
  perform private.lock_method_application(l.application_id, true);
  perform private.begin_methodology_operation();
  delete from public.method_application_evidence where id = l.id;
  perform private.end_methodology_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Operations: lifecycle (edit_architecture)
-- -----------------------------------------------------------------------------
create function public.begin_method_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  a := private.lock_method_application(p_application_id, true);
  if a.state <> 'planned' then
    raise exception 'Only a planned Method Application can begin' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  update public.method_applications set state = 'in_progress', started_on = private.business_today() where id = a.id;
  perform private.end_methodology_operation();
end;
$$;

-- Refreshes each element link's captured identity and, for produced and
-- revised elements, the version observed at closure (null for a draft).
create function private.capture_method_application_links(target_application_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.method_application_elements l
  set captured_reference_code = e.reference_code,
      captured_title = e.title,
      captured_object_type_key = (select o.object_type from public.architecture_objects o where o.element_id = e.id),
      captured_at = now(),
      observed_version_id = case when l.role in ('produced', 'revised') then e.latest_version_id end
  from public.architecture_elements e
  where l.application_id = target_application_id and e.id = l.element_id;
$$;

create function public.complete_method_application(
  p_application_id uuid,
  p_completion_statement text,
  p_retrospective text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  a := private.lock_method_application(p_application_id, true);
  if a.state <> 'in_progress' then
    raise exception 'Only a Method Application in progress can be completed' using errcode = '23514';
  end if;
  if not private.nonblank(p_completion_statement) then
    raise exception 'Say how the completion criteria were met' using errcode = '23514';
  end if;
  if not exists (select 1 from public.method_application_elements where application_id = a.id)
     and not exists (select 1 from public.method_application_evidence where application_id = a.id) then
    raise exception 'A completed Method Application acted on something: link at least one element or evidence source'
      using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  perform private.capture_method_application_links(a.id);
  update public.method_applications
  set state = 'completed', closed_on = private.business_today(), completion_statement = btrim(p_completion_statement),
      retrospective = nullif(btrim(coalesce(p_retrospective, '')), '')
  where id = a.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.discontinue_method_application(p_application_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
begin
  a := private.lock_method_application(p_application_id, true);
  if not private.nonblank(p_reason) then
    raise exception 'Say why the Method Application was discontinued' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  perform private.capture_method_application_links(a.id);
  update public.method_applications
  set state = 'discontinued', closed_on = private.business_today(), discontinued_reason = btrim(p_reason)
  where id = a.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.add_method_application_addendum(p_application_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_applications;
  new_id uuid;
begin
  a := private.lock_method_application(p_application_id, false);
  perform private.begin_methodology_operation();
  insert into public.method_application_addenda (application_id, engagement_id, body)
  values (a.id, a.engagement_id, btrim(p_body))
  returning id into new_id;
  perform private.end_methodology_operation();
  return new_id;
end;
$$;

-- The practice loop's return path: a draft version cites a closed application.
create function public.add_method_version_learning_source(p_version_id uuid, p_application_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
begin
  v := private.lock_draft_method_version(p_version_id);
  if not private.can_read_method_application(p_application_id) then
    raise exception 'Method Application not found' using errcode = 'P0002';
  end if;
  if not private.method_application_closed(p_application_id) then
    raise exception 'Learning comes from closed Method Applications' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  insert into public.method_version_learning_sources (version_id, application_id, note)
  values (v.id, p_application_id, btrim(p_note))
  on conflict (version_id, application_id) do update set note = excluded.note;
  perform private.end_methodology_operation();
end;
$$;

create function public.remove_method_version_learning_source(p_version_id uuid, p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
begin
  v := private.lock_draft_method_version(p_version_id);
  perform private.begin_methodology_operation();
  delete from public.method_version_learning_sources where version_id = v.id and application_id = p_application_id;
  perform private.end_methodology_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Function privileges
-- -----------------------------------------------------------------------------
revoke all on function private.method_application_closed(uuid) from public, anon, authenticated;
revoke all on function private.guard_method_application() from public, anon, authenticated;
revoke all on function private.guard_method_application_child() from public, anon, authenticated;
revoke all on function private.lock_method_application(uuid, boolean) from public, anon, authenticated;
revoke all on function private.internal_engagement_member(uuid, uuid) from public, anon, authenticated;
revoke all on function private.method_element_role_allows(public.method_application_element_role, public.element_kind)
  from public, anon, authenticated;
revoke all on function private.capture_method_application_links(uuid) from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.start_method_application(uuid, uuid, text, text, text, text, uuid, uuid)',
    'public.update_method_application(uuid, text, text, text, boolean)',
    'public.set_method_application_practitioners(uuid, jsonb)',
    'public.set_method_application_contexts(uuid, uuid[])',
    'public.set_method_application_domains(uuid, public.architecture_domain[])',
    'public.set_method_application_stage_note(uuid, uuid, public.method_stage_treatment, text, text)',
    'public.clear_method_application_stage_note(uuid, uuid)',
    'public.set_method_application_asset(uuid, uuid, text)',
    'public.remove_method_application_asset(uuid, uuid)',
    'public.link_method_application_element(uuid, uuid, public.method_application_element_role, text)',
    'public.unlink_method_application_element(uuid)',
    'public.link_method_application_evidence(uuid, uuid, public.method_application_evidence_role, uuid, text)',
    'public.unlink_method_application_evidence(uuid)',
    'public.begin_method_application(uuid)',
    'public.complete_method_application(uuid, text, text)',
    'public.discontinue_method_application(uuid, text)',
    'public.add_method_application_addendum(uuid, text)',
    'public.add_method_version_learning_source(uuid, uuid, text)',
    'public.remove_method_version_learning_source(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
