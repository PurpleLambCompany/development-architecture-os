-- =============================================================================
-- DSA OS — Phase 6: Method Library core.
--
-- A Method Asset is one governed identity (fixed form, a browsing category,
-- recorded origin and rights) with an ordered history of versions. Content
-- lives only in versions; a published version and all of its child rows are
-- immutable (D5, D6). Each of the five forms has its own structure and its
-- own behavior, and the database refuses the wrong one (D1, D2):
--
--   Method      performed through a Method Application (stages, modes,
--               expected outputs, completion criteria, components)
--   Model       instantiated into architecture through lineage (expected
--               object types)
--   Standard    judged against (ordered criteria, settings); never a verdict
--   Instrument  used within a Method Application (evidence types it gathers)
--   Template    produced from (the deliverable type and a section outline)
--
-- All writes go through operations that check practice capabilities
-- (author_methodology to draft, publish_methodology to publish, retire and
-- record rights). Every library table is internal-read only; no client or
-- licensed-practice policy exists (ADR-0022). Pre-Phase 6 assets are
-- converted to legacy assets by the next migration (D28).
--
-- See docs/product/PHASE_6_PROPOSAL.md §7-§9, §14, §16, §24, §25 and §28.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Categories: subject classification only (D4). Never drives behavior.
-- -----------------------------------------------------------------------------
create table public.method_asset_categories (
  key          text primary key check (key ~ '^[a-z][a-z_]*$'),
  label        text not null,
  description  text not null,
  sort_order   int not null,
  active       boolean not null default true
);

insert into public.method_asset_categories (key, label, description, sort_order) values
  ('diagnostic_frameworks', 'Diagnostic frameworks', 'Structured ways of diagnosing the current condition of a development.', 1),
  ('architecture_taxonomies', 'Architecture taxonomies', 'Classifications used to organize architecture.', 2),
  ('question_libraries', 'Question libraries', 'Curated questions for interviews, workshops and surveys.', 3),
  ('templates', 'Templates', 'Structures that deliverables are produced from.', 4),
  ('strategic_models', 'Strategic models', 'Strategic models applied into a development''s architecture.', 5),
  ('decision_frameworks', 'Decision frameworks', 'Structures and processes for reaching and recording decisions.', 6),
  ('research_protocols', 'Research protocols', 'Disciplined ways of gathering and examining evidence.', 7),
  ('capability_taxonomies', 'Capability taxonomies', 'Classifications of the capabilities a development needs.', 8),
  ('measurement_frameworks', 'Measurement frameworks', 'Structures for measuring conditions and progress.', 9),
  ('risk_frameworks', 'Risk frameworks', 'Scales, thresholds and taxonomies for risk.', 10),
  ('blueprint_structures', 'Blueprint structures', 'Structures for architectural blueprints.', 11),
  ('other', 'Other', 'Anything not covered by another category.', 12);

-- -----------------------------------------------------------------------------
-- 2. Method Assets: reshaped identity (§24). The pre-Phase 6 content columns
--    (category, version, methodology_domain, description) are carried over to
--    legacy versions and dropped by the backfill migration.
-- -----------------------------------------------------------------------------
drop policy "method assets: managed by administrators and principals" on public.method_assets;

alter table public.method_assets rename column owner_user_id to steward_user_id;
alter table public.method_assets
  alter column category drop not null,
  add column key               text unique check (key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  add column form              public.method_asset_form,
  add column category_key      text references public.method_asset_categories (key),
  add column origin            public.method_asset_origin not null default 'tplco_developed',
  add column usage_restriction text check (usage_restriction is null or char_length(usage_restriction) between 1 and 1000),
  add column current_version_id uuid,
  add column retired_reason    text check (retired_reason is null or char_length(retired_reason) <= 1000),
  add column retired_at        timestamptz;

-- 'draft' remains only until the backfill converts pre-Phase 6 rows.
alter table public.method_assets drop constraint method_assets_status_check;
alter table public.method_assets add constraint method_assets_status_check
  check (status in ('draft', 'active', 'retired', 'legacy'));

-- -----------------------------------------------------------------------------
-- 3. Versions: the content. Immutable once published (D6).
-- -----------------------------------------------------------------------------
create table public.method_asset_versions (
  id                             uuid primary key default gen_random_uuid(),
  asset_id                       uuid not null references public.method_assets (id) on delete restrict,
  legacy                         boolean not null default false,
  version_no                     int not null check (version_no > 0),
  version_label                  text check (version_label is null or version_label ~ '^[A-Za-z0-9][A-Za-z0-9 .-]{0,39}$'),
  lifecycle                      public.method_asset_version_lifecycle not null default 'draft',
  architectural_question         text not null default '' check (char_length(architectural_question) <= 1000),
  summary                        text not null default '' check (char_length(summary) <= 4000),
  applicability                  text not null default '' check (char_length(applicability) <= 4000),
  exclusions                     text not null default '' check (char_length(exclusions) <= 4000),
  prerequisites                  text not null default '' check (char_length(prerequisites) <= 4000),
  expected_inputs                text not null default '' check (char_length(expected_inputs) <= 4000),
  evidence_expectations          text not null default '' check (char_length(evidence_expectations) <= 4000),
  practitioner_roles             text not null default '' check (char_length(practitioner_roles) <= 4000),
  completion_criteria            text not null default '' check (char_length(completion_criteria) <= 4000),
  completion_standard_version_id uuid references public.method_asset_versions (id) on delete restrict,
  review_implications            text not null default '' check (char_length(review_implications) <= 4000),
  implementation_implications    text not null default '' check (char_length(implementation_implications) <= 4000),
  practitioner_instructions      text not null default '' check (char_length(practitioner_instructions) <= 40000),
  internal_notes                 text not null default '' check (char_length(internal_notes) <= 4000),
  modes                          text[] not null default '{}'
    check (modes <@ array['discover', 'define', 'assess', 'validate', 'govern']),
  identity_disclosure            public.method_identity_disclosure not null default 'internal_only',
  disclosable_name               text check (disclosable_name is null or char_length(disclosable_name) between 1 and 200),
  change_summary                 text not null default '' check (char_length(change_summary) <= 4000),
  derived_from_version_id        uuid references public.method_asset_versions (id) on delete restrict,
  external_basis                 text not null default '' check (char_length(external_basis) <= 1000),
  authored_by                    uuid references public.profiles (id) on delete set null default auth.uid(),
  published_by                   uuid references public.profiles (id) on delete set null,
  published_at                   timestamptz,
  effective_on                   date,
  retired_reason                 text check (retired_reason is null or char_length(retired_reason) <= 1000),
  retired_by                     uuid references public.profiles (id) on delete set null,
  retired_at                     timestamptz,
  created_by                     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),
  constraint method_asset_versions_no_unique unique (asset_id, version_no),
  constraint method_asset_versions_label_unique unique (asset_id, version_label),
  constraint method_asset_versions_labelled check (lifecycle = 'draft' or version_label is not null),
  constraint method_asset_versions_published check (lifecycle = 'draft' or published_at is not null),
  constraint method_asset_versions_retired check ((lifecycle = 'retired') = (retired_at is not null)),
  constraint method_asset_versions_disclosure check (identity_disclosure = 'may_be_named' or disclosable_name is null)
);
create unique index method_asset_versions_one_draft on public.method_asset_versions (asset_id) where lifecycle = 'draft';
create unique index method_asset_versions_one_published on public.method_asset_versions (asset_id) where lifecycle = 'published';
create index method_asset_versions_derived_idx on public.method_asset_versions (derived_from_version_id);

alter table public.method_assets
  add constraint method_assets_current_version_fk foreign key (current_version_id)
    references public.method_asset_versions (id) on delete restrict;

-- Child rows: all belong to one version and freeze with it.
create table public.method_version_domains (
  version_id  uuid not null references public.method_asset_versions (id) on delete cascade,
  domain      public.architecture_domain not null,
  primary key (version_id, domain)
);

create table public.method_version_stages (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.method_asset_versions (id) on delete cascade,
  ordinal     int not null check (ordinal > 0),
  key         text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  purpose     text not null default '' check (char_length(purpose) <= 2000),
  guidance    text not null default '' check (char_length(guidance) <= 20000),
  constraint method_version_stages_ordinal unique (version_id, ordinal),
  constraint method_version_stages_key unique (version_id, key)
);

create table public.method_version_outputs (
  id               uuid primary key default gen_random_uuid(),
  version_id       uuid not null references public.method_asset_versions (id) on delete cascade,
  ordinal          int not null check (ordinal > 0),
  output_kind      public.element_kind not null,
  object_type_key  text references public.architecture_object_types (key),
  deliverable_type public.deliverable_type,
  note             text not null default '' check (char_length(note) <= 1000),
  constraint method_version_outputs_ordinal unique (version_id, ordinal),
  constraint method_version_outputs_object check ((output_kind = 'object') = (object_type_key is not null)),
  constraint method_version_outputs_deliverable check ((output_kind = 'deliverable') = (deliverable_type is not null))
);

create table public.method_version_components (
  version_id            uuid not null references public.method_asset_versions (id) on delete cascade,
  component_version_id  uuid not null references public.method_asset_versions (id) on delete restrict,
  note                  text not null default '' check (char_length(note) <= 1000),
  primary key (version_id, component_version_id),
  constraint method_version_components_not_self check (version_id <> component_version_id)
);
create index method_version_components_component_idx on public.method_version_components (component_version_id);

create table public.standard_version_criteria (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.method_asset_versions (id) on delete cascade,
  ordinal     int not null check (ordinal > 0),
  key         text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  statement   text not null check (char_length(btrim(statement)) between 1 and 2000),
  guidance    text not null default '' check (char_length(guidance) <= 4000),
  scale       text not null default '' check (char_length(scale) <= 4000),
  constraint standard_version_criteria_ordinal unique (version_id, ordinal),
  constraint standard_version_criteria_key unique (version_id, key)
);

create table public.standard_version_judged_in (
  version_id  uuid not null references public.method_asset_versions (id) on delete cascade,
  setting     text not null check (setting in ('review', 'completion', 'assessment')),
  primary key (version_id, setting)
);

create table public.instrument_version_evidence_types (
  version_id            uuid not null references public.method_asset_versions (id) on delete cascade,
  evidence_source_type  public.evidence_source_type not null,
  primary key (version_id, evidence_source_type)
);

create table public.template_version_specs (
  version_id        uuid primary key references public.method_asset_versions (id) on delete cascade,
  deliverable_type  public.deliverable_type not null
);

create table public.template_version_sections (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.method_asset_versions (id) on delete cascade,
  ordinal     int not null check (ordinal > 0),
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  guidance    text not null default '' check (char_length(guidance) <= 4000),
  constraint template_version_sections_ordinal unique (version_id, ordinal)
);

-- Protected files for Templates and Instruments, in the private
-- method-library bucket at {version_id}/{file_id}/{file_name}.
create table public.method_version_files (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.method_asset_versions (id) on delete cascade,
  object_path   text not null unique,
  file_name     text not null check (char_length(btrim(file_name)) between 1 and 255 and file_name !~ '[/\\]'),
  content_type  text not null check (content_type in (
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )),
  size_bytes    bigint not null check (size_bytes between 1 and 26214400),
  uploaded_by   uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  created_at    timestamptz not null default now(),
  constraint method_version_files_path check (object_path = version_id::text || '/' || id::text || '/' || file_name)
);
create index method_version_files_version_idx on public.method_version_files (version_id);

-- Rights are recorded, never decided (D23). Append-only: a correction is a
-- new row, and the prior row is marked superseded.
create table public.method_asset_rights_holders (
  id                     uuid primary key default gen_random_uuid(),
  asset_id               uuid not null references public.method_assets (id) on delete restrict,
  organization_id        uuid references public.organizations (id) on delete restrict,
  external_holder_name   text check (external_holder_name is null or char_length(btrim(external_holder_name)) between 1 and 200),
  holder_role            public.method_rights_role not null,
  agreement_reference    text not null default '' check (char_length(agreement_reference) <= 200),
  effective_on           date,
  note                   text not null default '' check (char_length(note) <= 2000),
  recorded_by            uuid references public.profiles (id) on delete set null default auth.uid(),
  recorded_at            timestamptz not null default now(),
  superseded_by_id       uuid references public.method_asset_rights_holders (id) on delete restrict,
  superseded_reason      text check (superseded_reason is null or char_length(superseded_reason) between 1 and 1000),
  superseded_at          timestamptz,
  constraint method_asset_rights_holders_one_holder check ((organization_id is null) <> (external_holder_name is null)),
  constraint method_asset_rights_holders_superseded check ((superseded_at is null) = (superseded_reason is null))
);
create index method_asset_rights_holders_asset_idx on public.method_asset_rights_holders (asset_id);

-- -----------------------------------------------------------------------------
-- 4. Operation marker and guards
-- -----------------------------------------------------------------------------
create function private.begin_methodology_operation()
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.methodology_operation', 'on', true);
$$;

create function private.end_methodology_operation()
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.methodology_operation', 'off', true);
$$;

create function private.in_methodology_operation()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('dsa.methodology_operation', true), 'off') = 'on';
$$;

-- Asset identity: the key never changes; the form never changes once any
-- proper version has been published.
create function private.guard_method_asset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Method Assets are retired, never deleted' using errcode = '23514';
  end if;
  if not private.in_methodology_operation() then
    raise exception 'Method Assets change only through methodology operations' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.key is distinct from old.key and old.key is not null then
      raise exception 'A Method Asset key is permanent' using errcode = '23514';
    end if;
    if new.form is distinct from old.form and old.form is not null and exists (
      select 1 from public.method_asset_versions v
      where v.asset_id = old.id and not v.legacy and v.lifecycle <> 'draft'
    ) then
      raise exception 'A Method Asset''s form is fixed once a version is published' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger method_assets_guard before insert or update or delete on public.method_assets
  for each row execute function private.guard_method_asset();

-- Versions: drafts change through operations; a non-draft version only
-- moves along its lifecycle (published -> superseded or retired), and is
-- never deleted.
create function private.guard_method_asset_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  frozen_old jsonb;
  frozen_new jsonb;
begin
  if not private.in_methodology_operation() then
    raise exception 'Method Asset versions change only through methodology operations' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    if old.lifecycle <> 'draft' then
      raise exception 'A published Method Asset version is permanent' using errcode = '23514';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.asset_id <> old.asset_id or new.version_no <> old.version_no or new.legacy <> old.legacy then
      raise exception 'A version''s identity is permanent' using errcode = '23514';
    end if;
    if old.lifecycle <> 'draft' then
      frozen_old := to_jsonb(old) - array['lifecycle', 'retired_reason', 'retired_by', 'retired_at', 'updated_at'];
      frozen_new := to_jsonb(new) - array['lifecycle', 'retired_reason', 'retired_by', 'retired_at', 'updated_at'];
      if frozen_old is distinct from frozen_new then
        raise exception 'Published methodology is immutable: publish a new version instead' using errcode = '23514';
      end if;
      if not (
        (old.lifecycle = 'published' and new.lifecycle in ('published', 'superseded', 'retired'))
        or (old.lifecycle = new.lifecycle and to_jsonb(old) - 'updated_at' = to_jsonb(new) - 'updated_at')
      ) then
        raise exception 'A % version cannot become %', old.lifecycle, new.lifecycle using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger method_asset_versions_guard before insert or update or delete on public.method_asset_versions
  for each row execute function private.guard_method_asset_version();

-- Which forms each child table belongs to.
create function private.method_child_forms(child_table text)
returns public.method_asset_form[]
language sql
immutable
set search_path = ''
as $$
  select case child_table
    when 'method_version_domains' then array['method', 'model', 'standard', 'instrument', 'template']
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

-- Child rows change only while their version is a draft, only through
-- operations, and only on the forms they belong to. A legacy version keeps
-- only its domains.
create function private.guard_method_version_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version uuid;
  v public.method_asset_versions;
  asset_form public.method_asset_form;
begin
  target_version := case when tg_op = 'DELETE' then old.version_id else new.version_id end;
  select * into v from public.method_asset_versions where id = target_version;
  if not found then
    -- Cascading from a draft version's deletion (the version guard allowed it).
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if not private.in_methodology_operation() then
    raise exception 'Method content changes only through methodology operations' using errcode = '42501';
  end if;
  if v.lifecycle <> 'draft' then
    raise exception 'Published methodology is immutable: publish a new version instead' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.version_id <> old.version_id then
    raise exception 'Method content cannot move between versions' using errcode = '23514';
  end if;
  if tg_op <> 'DELETE' then
    select a.form into asset_form from public.method_assets a where a.id = v.asset_id;
    if v.legacy then
      if tg_table_name <> 'method_version_domains' then
        raise exception 'A legacy version holds no form-specific content' using errcode = '23514';
      end if;
    elsif asset_form is null or not asset_form = any (private.method_child_forms(tg_table_name)) then
      raise exception '% content does not belong to a %', tg_table_name, coalesce(asset_form::text, 'legacy asset')
        using errcode = '23514';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'method_version_domains', 'method_version_stages', 'method_version_outputs', 'method_version_components',
    'standard_version_criteria', 'standard_version_judged_in', 'instrument_version_evidence_types',
    'template_version_specs', 'template_version_sections', 'method_version_files'
  ] loop
    execute format('create trigger %1$s_guard before insert or update or delete on public.%1$I
                      for each row execute function private.guard_method_version_child()', tbl);
  end loop;
end;
$$;

-- Rights: append-only. The only change is marking a row superseded, once.
create function private.guard_method_rights_holder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.in_methodology_operation() then
    raise exception 'Rights are recorded only through methodology operations' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Rights records are append-only' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if old.superseded_at is not null
       or (to_jsonb(new) - array['superseded_by_id', 'superseded_reason', 'superseded_at'])
          is distinct from (to_jsonb(old) - array['superseded_by_id', 'superseded_reason', 'superseded_at']) then
      raise exception 'Rights records are append-only: record a correction instead' using errcode = '23514';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger method_asset_rights_holders_guard before insert or update or delete on public.method_asset_rights_holders
  for each row execute function private.guard_method_rights_holder();

create trigger method_asset_versions_set_updated_at before update on public.method_asset_versions
  for each row execute function private.set_updated_at();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'method_asset_versions', 'method_version_domains', 'method_version_stages', 'method_version_outputs',
    'method_version_components', 'standard_version_criteria', 'standard_version_judged_in',
    'instrument_version_evidence_types', 'template_version_specs', 'template_version_sections',
    'method_version_files', 'method_asset_rights_holders'
  ] loop
    execute format('create trigger %1$s_log after insert or update or delete on public.%1$I
                      for each row execute function private.log_activity()', tbl);
  end loop;
end;
$$;

create trigger method_assets_log after insert or update on public.method_assets
  for each row execute function private.log_activity();

-- A methodology event with a reason the row itself does not hold.
create function private.log_methodology_event(
  target_entity_type text,
  target_entity_id uuid,
  target_action text,
  target_metadata jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_log (actor_user_id, action_type, entity_type, entity_id, metadata_json)
  values (auth.uid(), target_action, target_entity_type, target_entity_id, coalesce(target_metadata, '{}'::jsonb));
$$;

-- -----------------------------------------------------------------------------
-- 5. Privileges and RLS: internal read only; writes only through operations.
-- -----------------------------------------------------------------------------
revoke all on
  public.method_asset_categories, public.method_asset_versions, public.method_version_domains,
  public.method_version_stages, public.method_version_outputs, public.method_version_components,
  public.standard_version_criteria, public.standard_version_judged_in, public.instrument_version_evidence_types,
  public.template_version_specs, public.template_version_sections, public.method_version_files,
  public.method_asset_rights_holders
from public, anon, authenticated;
revoke insert, update, delete, truncate on public.method_assets from authenticated;
grant select on
  public.method_asset_categories, public.method_asset_versions, public.method_version_domains,
  public.method_version_stages, public.method_version_outputs, public.method_version_components,
  public.standard_version_criteria, public.standard_version_judged_in, public.instrument_version_evidence_types,
  public.template_version_specs, public.template_version_sections, public.method_version_files,
  public.method_asset_rights_holders
to authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'method_asset_categories', 'method_asset_versions', 'method_version_domains', 'method_version_stages',
    'method_version_outputs', 'method_version_components', 'standard_version_criteria',
    'standard_version_judged_in', 'instrument_version_evidence_types', 'template_version_specs',
    'template_version_sections', 'method_version_files', 'method_asset_rights_holders'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    -- There is intentionally no policy a client or licensed-practice user can satisfy.
    execute format('create policy "%s: internal only" on public.%I for select to authenticated
                      using ((select private.is_internal()))', tbl, tbl);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Storage: a private bucket that never shares policies with client files.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'method-library', 'method-library', false, 26214400,
  array[
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;

create function private.can_read_method_file(target_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_internal()
    and exists (select 1 from public.method_version_files f where f.object_path = target_object_path);
$$;

-- Only the author who registered the file, while the version is a draft.
create function private.can_upload_method_file(target_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_practice_capability('author_methodology')
    and exists (
      select 1 from public.method_version_files f
      join public.method_asset_versions v on v.id = f.version_id
      where f.object_path = target_object_path and f.uploaded_by = auth.uid() and v.lifecycle = 'draft'
    );
$$;

-- An object whose registration was removed from a draft may be cleaned up.
create function private.can_remove_method_file(target_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_practice_capability('author_methodology')
    and not exists (select 1 from public.method_version_files f where f.object_path = target_object_path)
    and exists (
      select 1 from public.method_asset_versions v
      where v.id = private.try_uuid(split_part(target_object_path, '/', 1)) and v.lifecycle = 'draft'
    );
$$;

revoke all on function private.can_read_method_file(text) from public, anon;
revoke all on function private.can_upload_method_file(text) from public, anon;
revoke all on function private.can_remove_method_file(text) from public, anon;
grant execute on function private.can_read_method_file(text) to authenticated;
grant execute on function private.can_upload_method_file(text) to authenticated;
grant execute on function private.can_remove_method_file(text) to authenticated;

create policy "method library files: internal readers"
  on storage.objects for select to authenticated
  using (bucket_id = 'method-library' and private.can_read_method_file(name));
create policy "method library files: registered uploads by their author"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'method-library' and private.can_upload_method_file(name));
create policy "method library files: authors clean up unregistered draft files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'method-library' and private.can_remove_method_file(name));

-- -----------------------------------------------------------------------------
-- 7. Operation helpers
-- -----------------------------------------------------------------------------
create function private.lock_method_asset(target_asset_id uuid)
returns public.method_assets
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_assets;
begin
  if not private.is_internal() then
    raise exception 'Method Asset not found' using errcode = 'P0002';
  end if;
  select * into a from public.method_assets where id = target_asset_id for update;
  if not found then
    raise exception 'Method Asset not found' using errcode = 'P0002';
  end if;
  return a;
end;
$$;

-- A draft version, with its asset locked first (one lock order everywhere).
create function private.lock_draft_method_version(target_version_id uuid)
returns public.method_asset_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
begin
  perform private.require_practice_capability('author_methodology');
  select * into v from public.method_asset_versions where id = target_version_id;
  if not found then
    raise exception 'Method Asset version not found' using errcode = 'P0002';
  end if;
  perform private.lock_method_asset(v.asset_id);
  select * into v from public.method_asset_versions where id = target_version_id for update;
  if v.lifecycle <> 'draft' then
    raise exception 'Only a draft version can be edited' using errcode = '23514';
  end if;
  if v.legacy then
    raise exception 'A legacy version cannot be edited; adopt the asset instead' using errcode = '23514';
  end if;
  return v;
end;
$$;

create function private.method_version_form(target_version_id uuid)
returns public.method_asset_form
language sql
stable
security definer
set search_path = ''
as $$
  select a.form from public.method_asset_versions v join public.method_assets a on a.id = v.asset_id
  where v.id = target_version_id and not v.legacy;
$$;

-- A published, proper (not legacy) version of an active asset, optionally of one form.
create function private.require_usable_method_version(
  target_version_id uuid,
  target_form public.method_asset_form
)
returns public.method_asset_versions
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
  a public.method_assets;
begin
  select * into v from public.method_asset_versions where id = target_version_id;
  if not found or not private.is_internal() then
    raise exception 'Method Asset version not found' using errcode = 'P0002';
  end if;
  select * into a from public.method_assets where id = v.asset_id;
  if v.legacy then
    raise exception 'A legacy version cannot be used, cited or instantiated; adopt the asset first'
      using errcode = '23514';
  end if;
  if v.lifecycle <> 'published' or a.status <> 'active' then
    raise exception 'Only the current published version of an active asset can be used' using errcode = '23514';
  end if;
  if target_form is not null and a.form <> target_form then
    raise exception 'This needs a %, not a %', target_form, a.form using errcode = '23514';
  end if;
  return v;
end;
$$;

create function private.nonblank(target_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(btrim(coalesce(target_text, ''))) > 0;
$$;

-- -----------------------------------------------------------------------------
-- 8. Operations: assets and drafts (author_methodology)
-- -----------------------------------------------------------------------------
create function public.create_method_asset(
  p_key text,
  p_title text,
  p_form public.method_asset_form,
  p_category_key text,
  p_origin public.method_asset_origin default 'tplco_developed',
  p_steward_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_asset uuid;
begin
  perform private.require_practice_capability('author_methodology');
  if p_form is null then
    raise exception 'A Method Asset needs a form' using errcode = '23514';
  end if;
  if not private.nonblank(p_title) then
    raise exception 'A Method Asset needs a title' using errcode = '23514';
  end if;
  if not exists (select 1 from public.method_asset_categories where key = p_category_key and active) then
    raise exception 'Choose an active category' using errcode = '23514';
  end if;
  if p_steward_user_id is not null and not exists (
    select 1 from public.organization_members m join public.organizations o on o.id = m.organization_id
    where m.user_id = p_steward_user_id and o.type = 'tplco' and m.status = 'active'
      and public.role_side(m.role) = 'internal'
  ) then
    raise exception 'The steward must be an active TPLCo member' using errcode = '23514';
  end if;

  perform private.begin_methodology_operation();
  insert into public.method_assets (key, title, form, category_key, origin, status, steward_user_id)
  values (lower(btrim(p_key)), btrim(p_title), p_form, p_category_key, coalesce(p_origin, 'tplco_developed'),
          'active', coalesce(p_steward_user_id, auth.uid()))
  returning id into new_asset;
  insert into public.method_asset_versions (asset_id, version_no) values (new_asset, 1);
  perform private.end_methodology_operation();
  return new_asset;
end;
$$;

create function public.update_method_asset(
  p_asset_id uuid,
  p_title text,
  p_category_key text,
  p_steward_user_id uuid,
  p_usage_restriction text,
  p_form public.method_asset_form default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_assets;
begin
  perform private.require_practice_capability('author_methodology');
  a := private.lock_method_asset(p_asset_id);
  if a.status <> 'active' then
    raise exception 'Only an active asset can be edited' using errcode = '23514';
  end if;
  if not private.nonblank(p_title) then
    raise exception 'A Method Asset needs a title' using errcode = '23514';
  end if;
  if not exists (select 1 from public.method_asset_categories where key = p_category_key and active) then
    raise exception 'Choose an active category' using errcode = '23514';
  end if;
  if p_steward_user_id is not null and not exists (
    select 1 from public.organization_members m join public.organizations o on o.id = m.organization_id
    where m.user_id = p_steward_user_id and o.type = 'tplco' and m.status = 'active'
      and public.role_side(m.role) = 'internal'
  ) then
    raise exception 'The steward must be an active TPLCo member' using errcode = '23514';
  end if;
  if p_form is not null and p_form <> a.form and exists (
    select 1 from public.method_asset_versions v
    join lateral (
      select 1 from public.method_version_stages where version_id = v.id
      union all select 1 from public.method_version_outputs where version_id = v.id
      union all select 1 from public.method_version_components where version_id = v.id
      union all select 1 from public.standard_version_criteria where version_id = v.id
      union all select 1 from public.standard_version_judged_in where version_id = v.id
      union all select 1 from public.instrument_version_evidence_types where version_id = v.id
      union all select 1 from public.template_version_specs where version_id = v.id
      union all select 1 from public.template_version_sections where version_id = v.id
      union all select 1 from public.method_version_files where version_id = v.id
    ) c on true
    where v.asset_id = a.id
  ) then
    raise exception 'Remove the draft''s form-specific content before changing its form' using errcode = '23514';
  end if;

  perform private.begin_methodology_operation();
  update public.method_assets
  set title = btrim(p_title),
      category_key = p_category_key,
      steward_user_id = p_steward_user_id,
      usage_restriction = nullif(btrim(coalesce(p_usage_restriction, '')), ''),
      form = coalesce(p_form, form)
  where id = a.id;
  perform private.end_methodology_operation();
end;
$$;

-- A new draft, copied from the current published version (or empty).
create function public.create_method_asset_version(p_asset_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_assets;
  src uuid;
  new_version uuid;
begin
  perform private.require_practice_capability('author_methodology');
  a := private.lock_method_asset(p_asset_id);
  if a.status <> 'active' then
    raise exception 'New versions can be drafted only for an active asset' using errcode = '23514';
  end if;
  if exists (select 1 from public.method_asset_versions where asset_id = a.id and lifecycle = 'draft') then
    raise exception 'This asset already has a draft version' using errcode = '23514';
  end if;
  -- The published version, or else the latest proper version (retired).
  select id into src from public.method_asset_versions
  where asset_id = a.id and lifecycle <> 'draft' and not legacy
  order by (lifecycle = 'published') desc, version_no desc
  limit 1;

  perform private.begin_methodology_operation();
  insert into public.method_asset_versions (
    asset_id, version_no, architectural_question, summary, applicability, exclusions, prerequisites,
    expected_inputs, evidence_expectations, practitioner_roles, completion_criteria,
    completion_standard_version_id, review_implications, implementation_implications,
    practitioner_instructions, internal_notes, modes, identity_disclosure, disclosable_name,
    derived_from_version_id, external_basis
  )
  select a.id, (select coalesce(max(version_no), 0) + 1 from public.method_asset_versions where asset_id = a.id),
         s.architectural_question, s.summary, s.applicability, s.exclusions, s.prerequisites,
         s.expected_inputs, s.evidence_expectations, s.practitioner_roles, s.completion_criteria,
         s.completion_standard_version_id, s.review_implications, s.implementation_implications,
         s.practitioner_instructions, s.internal_notes, s.modes, s.identity_disclosure, s.disclosable_name,
         s.id, s.external_basis
  from public.method_asset_versions s
  where s.id = src
  returning id into new_version;
  if new_version is null then
    insert into public.method_asset_versions (asset_id, version_no)
    values (a.id, (select coalesce(max(version_no), 0) + 1 from public.method_asset_versions where asset_id = a.id))
    returning id into new_version;
  end if;

  if src is not null then
    insert into public.method_version_domains (version_id, domain)
      select new_version, domain from public.method_version_domains where version_id = src;
    insert into public.method_version_stages (version_id, ordinal, key, title, purpose, guidance)
      select new_version, ordinal, key, title, purpose, guidance from public.method_version_stages where version_id = src;
    insert into public.method_version_outputs (version_id, ordinal, output_kind, object_type_key, deliverable_type, note)
      select new_version, ordinal, output_kind, object_type_key, deliverable_type, note
      from public.method_version_outputs where version_id = src;
    -- Only components still current carry forward; the author re-pins the rest.
    insert into public.method_version_components (version_id, component_version_id, note)
      select new_version, c.component_version_id, c.note
      from public.method_version_components c
      join public.method_asset_versions cv on cv.id = c.component_version_id
      where c.version_id = src and cv.lifecycle = 'published';
    insert into public.standard_version_criteria (version_id, ordinal, key, statement, guidance, scale)
      select new_version, ordinal, key, statement, guidance, scale from public.standard_version_criteria where version_id = src;
    insert into public.standard_version_judged_in (version_id, setting)
      select new_version, setting from public.standard_version_judged_in where version_id = src;
    insert into public.instrument_version_evidence_types (version_id, evidence_source_type)
      select new_version, evidence_source_type from public.instrument_version_evidence_types where version_id = src;
    insert into public.template_version_specs (version_id, deliverable_type)
      select new_version, deliverable_type from public.template_version_specs where version_id = src;
    insert into public.template_version_sections (version_id, ordinal, title, guidance)
      select new_version, ordinal, title, guidance from public.template_version_sections where version_id = src;
    -- Files are not copied: the stored objects belong to their version's path.
  end if;
  perform private.end_methodology_operation();
  return new_version;
end;
$$;

-- Content fields of a draft. Keys not listed are refused, so a typo never
-- silently drops content. Method-only fields are refused on other forms.
create function public.update_method_asset_version(p_version_id uuid, p_content jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
  f public.method_asset_form;
  k text;
  allowed text[] := array[
    'architectural_question', 'summary', 'applicability', 'exclusions', 'prerequisites', 'expected_inputs',
    'evidence_expectations', 'practitioner_roles', 'completion_criteria', 'completion_standard_version_id',
    'review_implications', 'implementation_implications', 'practitioner_instructions', 'internal_notes',
    'modes', 'identity_disclosure', 'disclosable_name', 'change_summary', 'external_basis', 'derived_from_version_id'
  ];
  method_only text[] := array[
    'prerequisites', 'practitioner_roles', 'completion_criteria', 'completion_standard_version_id',
    'review_implications', 'implementation_implications', 'modes'
  ];
  merged public.method_asset_versions;
begin
  v := private.lock_draft_method_version(p_version_id);
  f := private.method_version_form(v.id);
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'Content must be an object' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(p_content) loop
    if not k = any (allowed) then
      raise exception 'Unknown content field %', k using errcode = '22023';
    end if;
    if f <> 'method' and k = any (method_only) and p_content -> k is not null
       and p_content -> k not in ('null'::jsonb, '""'::jsonb, '[]'::jsonb) then
      raise exception '% belongs only to a Method', k using errcode = '23514';
    end if;
  end loop;

  merged := jsonb_populate_record(v, p_content);
  if merged.completion_standard_version_id is not null
     and merged.completion_standard_version_id is distinct from v.completion_standard_version_id then
    perform private.require_usable_method_version(merged.completion_standard_version_id, 'standard');
  end if;
  if merged.derived_from_version_id is not null
     and merged.derived_from_version_id is distinct from v.derived_from_version_id
     and not exists (select 1 from public.method_asset_versions
                     where id = merged.derived_from_version_id and lifecycle <> 'draft') then
    raise exception 'A version can derive only from a published version' using errcode = '23514';
  end if;
  if merged.identity_disclosure = 'internal_only' then
    merged.disclosable_name := null;
  end if;

  perform private.begin_methodology_operation();
  update public.method_asset_versions set
    architectural_question = coalesce(merged.architectural_question, ''),
    summary = coalesce(merged.summary, ''),
    applicability = coalesce(merged.applicability, ''),
    exclusions = coalesce(merged.exclusions, ''),
    prerequisites = coalesce(merged.prerequisites, ''),
    expected_inputs = coalesce(merged.expected_inputs, ''),
    evidence_expectations = coalesce(merged.evidence_expectations, ''),
    practitioner_roles = coalesce(merged.practitioner_roles, ''),
    completion_criteria = coalesce(merged.completion_criteria, ''),
    completion_standard_version_id = merged.completion_standard_version_id,
    review_implications = coalesce(merged.review_implications, ''),
    implementation_implications = coalesce(merged.implementation_implications, ''),
    practitioner_instructions = coalesce(merged.practitioner_instructions, ''),
    internal_notes = coalesce(merged.internal_notes, ''),
    modes = coalesce(merged.modes, '{}'),
    identity_disclosure = coalesce(merged.identity_disclosure, 'internal_only'),
    disclosable_name = nullif(btrim(coalesce(merged.disclosable_name, '')), ''),
    change_summary = coalesce(merged.change_summary, ''),
    external_basis = coalesce(merged.external_basis, ''),
    derived_from_version_id = merged.derived_from_version_id
  where id = v.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.set_method_version_domains(p_version_id uuid, p_domains public.architecture_domain[])
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
  delete from public.method_version_domains where version_id = v.id;
  insert into public.method_version_domains (version_id, domain)
    select distinct v.id, d from unnest(coalesce(p_domains, '{}')) d;
  perform private.end_methodology_operation();
end;
$$;

-- Stages: [{key, title, purpose?, guidance?}] in order.
create function public.set_method_version_stages(p_version_id uuid, p_stages jsonb)
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
  delete from public.method_version_stages where version_id = v.id;
  insert into public.method_version_stages (version_id, ordinal, key, title, purpose, guidance)
    select v.id, s.ord, s.item ->> 'key', btrim(s.item ->> 'title'),
           coalesce(s.item ->> 'purpose', ''), coalesce(s.item ->> 'guidance', '')
    from jsonb_array_elements(coalesce(p_stages, '[]'::jsonb)) with ordinality as s(item, ord);
  perform private.end_methodology_operation();
end;
$$;

-- Expected outputs: [{output_kind, object_type_key?, deliverable_type?, note?}].
create function public.set_method_version_outputs(p_version_id uuid, p_outputs jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
begin
  v := private.lock_draft_method_version(p_version_id);
  if private.method_version_form(v.id) = 'model' and exists (
    select 1 from jsonb_array_elements(coalesce(p_outputs, '[]'::jsonb)) o where o ->> 'output_kind' <> 'object'
  ) then
    raise exception 'A Model is applied into architecture objects only' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  delete from public.method_version_outputs where version_id = v.id;
  insert into public.method_version_outputs (version_id, ordinal, output_kind, object_type_key, deliverable_type, note)
    select v.id, o.ord, (o.item ->> 'output_kind')::public.element_kind, o.item ->> 'object_type_key',
           (o.item ->> 'deliverable_type')::public.deliverable_type, coalesce(o.item ->> 'note', '')
    from jsonb_array_elements(coalesce(p_outputs, '[]'::jsonb)) with ordinality as o(item, ord);
  perform private.end_methodology_operation();
end;
$$;

-- Components a Method normally uses: [{component_version_id, note?}]. Each
-- must be the current published version of a Model, Standard, Instrument or
-- Template (§8.2). Guidance, pinned at publication.
create function public.set_method_version_components(p_version_id uuid, p_components jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
  c jsonb;
  cv public.method_asset_versions;
begin
  v := private.lock_draft_method_version(p_version_id);
  for c in select * from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) loop
    cv := private.require_usable_method_version((c ->> 'component_version_id')::uuid, null);
    if private.method_version_form(cv.id) = 'method' then
      raise exception 'A Method is not a component of another Method' using errcode = '23514';
    end if;
    if cv.asset_id = v.asset_id then
      raise exception 'A version cannot use its own asset' using errcode = '23514';
    end if;
  end loop;
  perform private.begin_methodology_operation();
  delete from public.method_version_components where version_id = v.id;
  insert into public.method_version_components (version_id, component_version_id, note)
    select v.id, (item ->> 'component_version_id')::uuid, coalesce(item ->> 'note', '')
    from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) as items(item);
  perform private.end_methodology_operation();
end;
$$;

-- Standard criteria: [{key, statement, guidance?, scale?}] in order.
create function public.set_standard_version_criteria(p_version_id uuid, p_criteria jsonb)
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
  delete from public.standard_version_criteria where version_id = v.id;
  insert into public.standard_version_criteria (version_id, ordinal, key, statement, guidance, scale)
    select v.id, s.ord, s.item ->> 'key', btrim(s.item ->> 'statement'),
           coalesce(s.item ->> 'guidance', ''), coalesce(s.item ->> 'scale', '')
    from jsonb_array_elements(coalesce(p_criteria, '[]'::jsonb)) with ordinality as s(item, ord);
  perform private.end_methodology_operation();
end;
$$;

create function public.set_standard_version_judged_in(p_version_id uuid, p_settings text[])
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
  delete from public.standard_version_judged_in where version_id = v.id;
  insert into public.standard_version_judged_in (version_id, setting)
    select distinct v.id, s from unnest(coalesce(p_settings, '{}')) s;
  perform private.end_methodology_operation();
end;
$$;

create function public.set_instrument_version_evidence_types(
  p_version_id uuid,
  p_types public.evidence_source_type[]
)
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
  delete from public.instrument_version_evidence_types where version_id = v.id;
  insert into public.instrument_version_evidence_types (version_id, evidence_source_type)
    select distinct v.id, t from unnest(coalesce(p_types, '{}')) t;
  perform private.end_methodology_operation();
end;
$$;

-- Template: the deliverable type it produces and its section outline
-- [{title, guidance?}] in order.
create function public.set_template_version_spec(
  p_version_id uuid,
  p_deliverable_type public.deliverable_type,
  p_sections jsonb
)
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
  delete from public.template_version_specs where version_id = v.id;
  delete from public.template_version_sections where version_id = v.id;
  if p_deliverable_type is not null then
    insert into public.template_version_specs (version_id, deliverable_type) values (v.id, p_deliverable_type);
  end if;
  insert into public.template_version_sections (version_id, ordinal, title, guidance)
    select v.id, s.ord, btrim(s.item ->> 'title'), coalesce(s.item ->> 'guidance', '')
    from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) with ordinality as s(item, ord);
  perform private.end_methodology_operation();
end;
$$;

-- Registers a protected file; the caller then uploads to the returned path.
create function public.attach_method_version_file(
  p_version_id uuid,
  p_file_name text,
  p_content_type text,
  p_size_bytes bigint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
  new_id uuid := gen_random_uuid();
  path text;
begin
  v := private.lock_draft_method_version(p_version_id);
  path := v.id::text || '/' || new_id::text || '/' || btrim(p_file_name);
  perform private.begin_methodology_operation();
  insert into public.method_version_files (id, version_id, object_path, file_name, content_type, size_bytes)
  values (new_id, v.id, path, btrim(p_file_name), p_content_type, p_size_bytes);
  perform private.end_methodology_operation();
  return path;
end;
$$;

create function public.remove_method_version_file(p_file_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.method_version_files;
begin
  select * into f from public.method_version_files where id = p_file_id;
  if not found then
    raise exception 'File not found' using errcode = 'P0002';
  end if;
  perform private.lock_draft_method_version(f.version_id);
  perform private.begin_methodology_operation();
  delete from public.method_version_files where id = f.id;
  perform private.end_methodology_operation();
  return f.object_path;
end;
$$;

-- A draft is disposable. Its registered files go with it; the stored objects
-- remain removable by authors (their version path no longer exists as a
-- draft, so the caller removes them first).
create function public.delete_method_asset_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
begin
  v := private.lock_draft_method_version(p_version_id);
  if exists (select 1 from public.method_version_files where version_id = v.id) then
    raise exception 'Remove the draft''s files first' using errcode = '23514';
  end if;
  perform private.begin_methodology_operation();
  delete from public.method_asset_versions where id = v.id;
  perform private.end_methodology_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Operations: publication and retirement (publish_methodology)
-- -----------------------------------------------------------------------------

-- What a version of each form must hold before it can be published (§7.2, §8.1).
create function private.method_version_publish_gaps(target_version_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
  f public.method_asset_form;
  gaps text[] := '{}';
begin
  select * into v from public.method_asset_versions where id = target_version_id;
  f := private.method_version_form(v.id);
  if not private.nonblank(v.architectural_question) then gaps := array_append(gaps, 'the architectural question'); end if;
  if not private.nonblank(v.applicability) then gaps := array_append(gaps, 'applicability'); end if;
  if not private.nonblank(v.change_summary) then gaps := array_append(gaps, 'a change summary'); end if;
  case f
    when 'method' then
      if not exists (select 1 from public.method_version_stages where version_id = v.id) then
        gaps := array_append(gaps, 'at least one stage');
      end if;
      if cardinality(v.modes) = 0 then gaps := array_append(gaps, 'at least one mode'); end if;
      if not exists (select 1 from public.method_version_outputs where version_id = v.id) then
        gaps := array_append(gaps, 'at least one expected output');
      end if;
      if not private.nonblank(v.completion_criteria) then gaps := array_append(gaps, 'completion criteria'); end if;
    when 'model' then
      if not exists (select 1 from public.method_version_outputs where version_id = v.id and output_kind = 'object') then
        gaps := array_append(gaps, 'at least one object type it is applied into');
      end if;
    when 'standard' then
      if not exists (select 1 from public.standard_version_criteria where version_id = v.id) then
        gaps := array_append(gaps, 'at least one criterion');
      end if;
      if not exists (select 1 from public.standard_version_judged_in where version_id = v.id) then
        gaps := array_append(gaps, 'where it is judged');
      end if;
    when 'instrument' then
      if not exists (select 1 from public.instrument_version_evidence_types where version_id = v.id) then
        gaps := array_append(gaps, 'the evidence types it gathers');
      end if;
      if not private.nonblank(v.practitioner_instructions) then gaps := array_append(gaps, 'usage guidance'); end if;
    when 'template' then
      if not exists (select 1 from public.template_version_specs where version_id = v.id) then
        gaps := array_append(gaps, 'the deliverable type it produces');
      end if;
      if not exists (select 1 from public.template_version_sections where version_id = v.id) then
        gaps := array_append(gaps, 'a section outline');
      end if;
    else
      gaps := array_append(gaps, 'a form');
  end case;
  if exists (
    select 1 from public.method_version_components c
    join public.method_asset_versions cv on cv.id = c.component_version_id
    join public.method_assets ca on ca.id = cv.asset_id
    where c.version_id = v.id and (cv.lifecycle <> 'published' or ca.status <> 'active')
  ) then
    gaps := array_append(gaps, 'components that are still current');
  end if;
  if v.completion_standard_version_id is not null and not exists (
    select 1 from public.method_asset_versions where id = v.completion_standard_version_id and lifecycle = 'published'
  ) then
    gaps := array_append(gaps, 'a cited Standard that is still current');
  end if;
  return gaps;
end;
$$;

create function public.method_version_publish_gaps(p_version_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_internal() or not exists (select 1 from public.method_asset_versions where id = p_version_id) then
    raise exception 'Method Asset version not found' using errcode = 'P0002';
  end if;
  return private.method_version_publish_gaps(p_version_id);
end;
$$;

create function public.publish_method_asset_version(
  p_version_id uuid,
  p_version_label text,
  p_change_summary text default null,
  p_effective_on date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
  a public.method_assets;
  gaps text[];
  label text := btrim(coalesce(p_version_label, ''));
begin
  perform private.require_practice_capability('publish_methodology');
  select * into v from public.method_asset_versions where id = p_version_id;
  if not found then
    raise exception 'Method Asset version not found' using errcode = 'P0002';
  end if;
  a := private.lock_method_asset(v.asset_id);
  select * into v from public.method_asset_versions where id = p_version_id for update;
  if v.lifecycle <> 'draft' or v.legacy then
    raise exception 'Only a draft version can be published' using errcode = '23514';
  end if;
  if a.status <> 'active' then
    raise exception 'A retired asset cannot publish new versions' using errcode = '23514';
  end if;
  if label = '' then
    raise exception 'A published version needs a label' using errcode = '23514';
  end if;
  if exists (select 1 from public.method_asset_versions where asset_id = a.id and version_label = label) then
    raise exception 'Version % already exists for this asset', label using errcode = '23514';
  end if;

  perform private.begin_methodology_operation();
  if p_change_summary is not null then
    update public.method_asset_versions set change_summary = btrim(p_change_summary) where id = v.id;
  end if;
  gaps := private.method_version_publish_gaps(v.id);
  if cardinality(gaps) > 0 then
    raise exception 'This % cannot be published yet. It needs %', a.form, array_to_string(gaps, ', ')
      using errcode = '23514';
  end if;

  update public.method_asset_versions set lifecycle = 'superseded'
  where asset_id = a.id and lifecycle = 'published';
  update public.method_asset_versions
  set lifecycle = 'published', version_label = label, published_by = auth.uid(), published_at = now(),
      effective_on = coalesce(p_effective_on, private.business_today())
  where id = v.id;
  update public.method_assets set current_version_id = v.id where id = a.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.retire_method_asset_version(p_version_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.method_asset_versions;
begin
  perform private.require_practice_capability('publish_methodology');
  if not private.nonblank(p_reason) then
    raise exception 'Retiring a version needs a reason' using errcode = '23514';
  end if;
  select * into v from public.method_asset_versions where id = p_version_id;
  if not found then
    raise exception 'Method Asset version not found' using errcode = 'P0002';
  end if;
  perform private.lock_method_asset(v.asset_id);
  select * into v from public.method_asset_versions where id = p_version_id for update;
  if v.lifecycle <> 'published' then
    raise exception 'Only the published version can be retired' using errcode = '23514';
  end if;

  perform private.begin_methodology_operation();
  update public.method_asset_versions
  set lifecycle = 'retired', retired_reason = btrim(p_reason), retired_by = auth.uid(), retired_at = now()
  where id = v.id;
  update public.method_assets set current_version_id = null where id = v.asset_id and current_version_id = v.id;
  perform private.end_methodology_operation();
end;
$$;

create function public.retire_method_asset(p_asset_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_assets;
begin
  perform private.require_practice_capability('publish_methodology');
  if not private.nonblank(p_reason) then
    raise exception 'Retiring an asset needs a reason' using errcode = '23514';
  end if;
  a := private.lock_method_asset(p_asset_id);
  if a.status = 'retired' then
    raise exception 'This asset is already retired' using errcode = '23514';
  end if;
  if exists (select 1 from public.method_asset_versions where asset_id = a.id and lifecycle = 'draft') then
    raise exception 'Delete the draft version before retiring the asset' using errcode = '23514';
  end if;

  perform private.begin_methodology_operation();
  update public.method_asset_versions
  set lifecycle = 'retired', retired_reason = btrim(p_reason), retired_by = auth.uid(), retired_at = now()
  where asset_id = a.id and lifecycle = 'published' and not legacy;
  update public.method_assets
  set status = 'retired', current_version_id = null, retired_reason = btrim(p_reason), retired_at = now()
  where id = a.id;
  perform private.end_methodology_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Operations: origin and rights (publish_methodology). Recorded, never
--     decided or enforced (D23).
-- -----------------------------------------------------------------------------
create function public.set_method_asset_origin(
  p_asset_id uuid,
  p_origin public.method_asset_origin,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_assets;
begin
  perform private.require_practice_capability('publish_methodology');
  if not private.nonblank(p_reason) then
    raise exception 'Changing an asset''s origin needs a reason' using errcode = '23514';
  end if;
  a := private.lock_method_asset(p_asset_id);
  if p_origin is null or p_origin = a.origin then
    return;
  end if;
  perform private.begin_methodology_operation();
  update public.method_assets set origin = p_origin where id = a.id;
  perform private.log_methodology_event('method_assets', a.id, 'origin_changed',
    jsonb_build_object('from', a.origin, 'to', p_origin, 'reason', btrim(p_reason)));
  perform private.end_methodology_operation();
end;
$$;

create function public.record_method_rights_holder(
  p_asset_id uuid,
  p_organization_id uuid,
  p_external_holder_name text,
  p_holder_role public.method_rights_role,
  p_agreement_reference text default '',
  p_effective_on date default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.method_assets;
  new_id uuid;
begin
  perform private.require_practice_capability('publish_methodology');
  a := private.lock_method_asset(p_asset_id);
  perform private.begin_methodology_operation();
  insert into public.method_asset_rights_holders (
    asset_id, organization_id, external_holder_name, holder_role, agreement_reference, effective_on, note
  ) values (
    a.id, p_organization_id, nullif(btrim(coalesce(p_external_holder_name, '')), ''), p_holder_role,
    btrim(coalesce(p_agreement_reference, '')), p_effective_on, btrim(coalesce(p_note, ''))
  ) returning id into new_id;
  perform private.end_methodology_operation();
  return new_id;
end;
$$;

-- Marks a rights record superseded, optionally by a corrected record.
create function public.supersede_method_rights_holder(
  p_rights_holder_id uuid,
  p_reason text,
  p_replacement_organization_id uuid default null,
  p_replacement_external_holder_name text default null,
  p_replacement_holder_role public.method_rights_role default null,
  p_replacement_agreement_reference text default '',
  p_replacement_effective_on date default null,
  p_replacement_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.method_asset_rights_holders;
  replacement uuid;
begin
  perform private.require_practice_capability('publish_methodology');
  if not private.nonblank(p_reason) then
    raise exception 'A correction needs a reason' using errcode = '23514';
  end if;
  select * into r from public.method_asset_rights_holders where id = p_rights_holder_id;
  if not found then
    raise exception 'Rights record not found' using errcode = 'P0002';
  end if;
  perform private.lock_method_asset(r.asset_id);
  select * into r from public.method_asset_rights_holders where id = p_rights_holder_id for update;
  if r.superseded_at is not null then
    raise exception 'This rights record was already superseded' using errcode = '23514';
  end if;
  if p_replacement_holder_role is not null then
    replacement := public.record_method_rights_holder(
      r.asset_id, p_replacement_organization_id, p_replacement_external_holder_name, p_replacement_holder_role,
      p_replacement_agreement_reference, p_replacement_effective_on, p_replacement_note);
  end if;
  perform private.begin_methodology_operation();
  update public.method_asset_rights_holders
  set superseded_by_id = replacement, superseded_reason = btrim(p_reason), superseded_at = now()
  where id = r.id;
  perform private.end_methodology_operation();
  return replacement;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Function privileges
-- -----------------------------------------------------------------------------
revoke all on function private.begin_methodology_operation() from public, anon, authenticated;
revoke all on function private.end_methodology_operation() from public, anon, authenticated;
revoke all on function private.guard_method_asset() from public, anon, authenticated;
revoke all on function private.guard_method_asset_version() from public, anon, authenticated;
revoke all on function private.guard_method_version_child() from public, anon, authenticated;
revoke all on function private.guard_method_rights_holder() from public, anon, authenticated;
revoke all on function private.log_methodology_event(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.lock_method_asset(uuid) from public, anon, authenticated;
revoke all on function private.lock_draft_method_version(uuid) from public, anon, authenticated;
revoke all on function private.method_version_form(uuid) from public, anon, authenticated;
revoke all on function private.require_usable_method_version(uuid, public.method_asset_form) from public, anon, authenticated;
revoke all on function private.method_version_publish_gaps(uuid) from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_method_asset(text, text, public.method_asset_form, text, public.method_asset_origin, uuid)',
    'public.update_method_asset(uuid, text, text, uuid, text, public.method_asset_form)',
    'public.create_method_asset_version(uuid)',
    'public.update_method_asset_version(uuid, jsonb)',
    'public.set_method_version_domains(uuid, public.architecture_domain[])',
    'public.set_method_version_stages(uuid, jsonb)',
    'public.set_method_version_outputs(uuid, jsonb)',
    'public.set_method_version_components(uuid, jsonb)',
    'public.set_standard_version_criteria(uuid, jsonb)',
    'public.set_standard_version_judged_in(uuid, text[])',
    'public.set_instrument_version_evidence_types(uuid, public.evidence_source_type[])',
    'public.set_template_version_spec(uuid, public.deliverable_type, jsonb)',
    'public.attach_method_version_file(uuid, text, text, bigint)',
    'public.remove_method_version_file(uuid)',
    'public.delete_method_asset_version(uuid)',
    'public.method_version_publish_gaps(uuid)',
    'public.publish_method_asset_version(uuid, text, text, date)',
    'public.retire_method_asset_version(uuid, text)',
    'public.retire_method_asset(uuid, text)',
    'public.set_method_asset_origin(uuid, public.method_asset_origin, text)',
    'public.record_method_rights_holder(uuid, uuid, text, public.method_rights_role, text, date, text)',
    'public.supersede_method_rights_holder(uuid, text, uuid, text, public.method_rights_role, text, date, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
