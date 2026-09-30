-- =============================================================================
-- DSA OS — Phase 5: Reviews, Deliverables and Implementation
--
-- Three new element kinds on the spine (review, deliverable,
-- implementation_initiative), six new relationship types (examines, raises,
-- documents, implements, initiates, validates), Implementation's own
-- stewardship/history/escalation/categories/signals apparatus (D2, physically
-- separate from Phase 4's tables), Implementation Checkpoints as a
-- lightweight subordinate record (D9), and the validates-gated path to a
-- genuinely judged `validated` status (D5, D8).
-- Specification: docs/product/PHASE_5_PROPOSAL.md (approved 2026-09-30, §22).
--
-- Rules that hold throughout (in addition to Phase 3/4's):
--   * validates is written only by record_review_validation; every other
--     relationship type is an ordinary edit_architecture insert (D13).
--   * implementation_stewardship, implementation_status_changes and
--     implementation_escalations are Implementation's own tables, never
--     Phase 4's (D2/D14). No Phase 4 table is touched by this migration.
--   * Errors: 42501 permission, 23514 rule, P0002 not found or not visible.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Capabilities
-- -----------------------------------------------------------------------------
create or replace function public.capability_side(capability public.engagement_capability)
returns public.member_side
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when capability in (
      'pay_invoices', 'approve_change_orders', 'view_architecture', 'view_full_architecture',
      'respond_to_client_actions', 'assign_client_actions', 'submit_client_input'
    ) then 'client'::public.member_side
    when capability in (
      'manage_financials', 'edit_architecture', 'publish_architecture', 'manage_client_requests',
      'manage_reviews', 'manage_deliverables', 'manage_implementation'
    ) then 'internal'::public.member_side
    else null
  end;
$$;

insert into public.role_capability_defaults (role, capability) values
  ('principal_architect',   'manage_reviews'),
  ('architect',             'manage_reviews'),
  ('researcher',            'manage_reviews'),
  ('project_administrator', 'manage_reviews'),
  ('principal_architect',   'manage_deliverables'),
  ('architect',             'manage_deliverables'),
  ('researcher',            'manage_deliverables'),
  ('project_administrator', 'manage_deliverables'),
  ('principal_architect',   'manage_implementation'),
  ('architect',             'manage_implementation'),
  ('project_administrator', 'manage_implementation');
  -- Researcher does not hold manage_implementation (§12.1).

create function private.can_manage_reviews(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_internal() and private.has_engagement_capability(target_engagement_id, 'manage_reviews');
$$;

create function private.can_manage_deliverables(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_internal() and private.has_engagement_capability(target_engagement_id, 'manage_deliverables');
$$;

create function private.can_manage_implementation(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_internal() and private.has_engagement_capability(target_engagement_id, 'manage_implementation');
$$;

-- Generic capability check for operations (Project Intelligence's
-- require_architecture_capability only knows edit/publish_architecture).
create function private.require_engagement_capability(
  target_engagement_id uuid,
  target_capability public.engagement_capability
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_read_architecture(target_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not private.has_engagement_capability(target_engagement_id, target_capability) then
    raise exception 'You do not hold % on this engagement', target_capability using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.can_manage_reviews(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_deliverables(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_implementation(uuid) from public, anon, authenticated;
revoke all on function private.require_engagement_capability(uuid, public.engagement_capability) from public, anon, authenticated;
grant execute on function private.can_manage_reviews(uuid) to authenticated;
grant execute on function private.can_manage_deliverables(uuid) to authenticated;
grant execute on function private.can_manage_implementation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Reference prefixes (REV/DLV/IMP, ADR-0025)
-- -----------------------------------------------------------------------------
create or replace function public.element_reference_prefix(
  p_kind public.element_kind,
  p_domain public.architecture_domain
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_kind
    when 'object' then case p_domain
      when 'knowledge' then 'KNW'
      when 'capability' then 'CAP'
      when 'strategic_model' then 'STR'
      when 'application' then 'APP'
    end
    when 'assumption' then 'ASM'
    when 'risk' then 'RSK'
    when 'constraint' then 'CNS'
    when 'dependency' then 'DEP'
    when 'decision' then 'DEC'
    when 'recommendation' then 'REC'
    when 'opportunity' then 'OPP'
    when 'review' then 'REV'
    when 'deliverable' then 'DLV'
    when 'implementation_initiative' then 'IMP'
  end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Relationship vocabulary: 6 new types and their pairings (§4.2)
-- -----------------------------------------------------------------------------
alter table public.relationship_types drop constraint relationship_types_category_check;
alter table public.relationship_types add constraint relationship_types_category_check
  check (category in ('structure', 'design_flow', 'intelligence', 'lineage', 'implementation'));

insert into public.relationship_types (key, category, label, inverse_label, is_symmetric, is_acyclic, definition, sort_order) values
  ('examines', 'implementation', 'examines', 'examined in', false, false,
   'The review''s agenda: an element or Project Intelligence record the review looks at.', 34),
  ('raises', 'implementation', 'raises', 'raised in', false, false,
   'A new judgment record, or implementation initiative, produced by the review.', 35),
  ('documents', 'implementation', 'documents', 'documented in', false, false,
   'What the deliverable presents or summarizes.', 36),
  ('implements', 'implementation', 'implements', 'implemented by', false, false,
   'The architecture the initiative is realizing.', 37),
  ('initiates', 'implementation', 'initiates', 'initiated by', false, false,
   'Why the initiative exists: the decision or recommendation that started it.', 38),
  ('validates', 'implementation', 'validates', 'validated by', false, false,
   'Formal judgment that operating reality sufficiently conforms to architectural intent. Written only by record_review_validation.', 39);

create function pg_temp.token_items(t text)
returns table (kind public.element_kind, object_type text)
language sql
as $$
  select 'object'::public.element_kind, ot.key
  from public.architecture_object_types ot
  where t in ('@core', '@element')
     or (left(t, 1) = '@' and ot.domain::text = substr(t, 2))
     or ot.key = t
  union all
  select k::public.element_kind, null
  from unnest(array[
    'assumption', 'risk', 'constraint', 'dependency', 'decision', 'recommendation', 'opportunity'
  ]) k
  where t in ('@record', '@element') or k = t
  union all
  select k::public.element_kind, null
  from unnest(array['review', 'deliverable', 'implementation_initiative']) k
  where k = t;
$$;

create function pg_temp.expand_tokens(tokens text[])
returns table (kind public.element_kind, object_type text)
language plpgsql
as $$
declare
  t text;
  neg boolean;
begin
  create temp table if not exists pg_temp.tok_inc (kind public.element_kind, object_type text, ord serial);
  create temp table if not exists pg_temp.tok_exc (kind public.element_kind, object_type text);
  truncate pg_temp.tok_inc, pg_temp.tok_exc;
  foreach t in array tokens loop
    neg := left(t, 1) = '-';
    t := ltrim(t, '-');
    if neg then
      insert into pg_temp.tok_exc select x.kind, x.object_type from pg_temp.token_items(t) x;
    else
      insert into pg_temp.tok_inc (kind, object_type) select x.kind, x.object_type from pg_temp.token_items(t) x;
    end if;
  end loop;
  return query
    select distinct on (i.kind, i.object_type) i.kind, i.object_type
    from pg_temp.tok_inc i
    where not exists (
      select 1 from pg_temp.tok_exc e
      where e.kind = i.kind and e.object_type is not distinct from i.object_type
    );
end;
$$;

create function pg_temp.add_rules(rel text, sources text[], targets text[])
returns void
language plpgsql
as $$
begin
  create temp table if not exists pg_temp.src_items (kind public.element_kind, object_type text);
  truncate pg_temp.src_items;
  insert into pg_temp.src_items select * from pg_temp.expand_tokens(sources);
  insert into public.relationship_rules (relationship_type, source_kind, source_object_type, target_kind, target_object_type)
  select rel, s.kind, s.object_type, t.kind, t.object_type
  from pg_temp.src_items s cross join pg_temp.expand_tokens(targets) t
  on conflict do nothing;
end;
$$;

-- Existing pairings extended to the three new kinds (§4.2).
select pg_temp.add_rules('part_of', array['implementation_initiative'], array['implementation_initiative']);
select pg_temp.add_rules('precedes', array['implementation_initiative'], array['implementation_initiative']);
select pg_temp.add_rules('threatens', array['risk'], array['review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('mitigates', array['implementation_initiative'], array['risk']);
select pg_temp.add_rules('underpins', array['assumption'], array['review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('constrains', array['constraint'], array['review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('affects', array['review', 'deliverable', 'implementation_initiative'], array['review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('affects', array['@record'], array['review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('affects', array['review', 'deliverable', 'implementation_initiative'], array['@element']);
select pg_temp.add_rules('addresses', array['recommendation'], array['review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('has_stake_in', array['stakeholder'], array['review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('subject_to', array['review', 'deliverable', 'implementation_initiative'], array['regulatory_factor']);
select pg_temp.add_rules('conflicts_with', array['review', 'deliverable', 'implementation_initiative'], array['@element']);
select pg_temp.add_rules('conflicts_with', array['@element'], array['review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('conflicts_with', array['review', 'deliverable', 'implementation_initiative'], array['review', 'deliverable', 'implementation_initiative']);
-- New relationship types.
select pg_temp.add_rules('examines', array['review'], array['@element', 'review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('raises', array['review'], array['assumption', 'risk', 'constraint', 'dependency', 'decision', 'recommendation', 'opportunity', 'implementation_initiative']);
select pg_temp.add_rules('documents', array['deliverable'], array['@element', 'review', 'deliverable', 'implementation_initiative']);
select pg_temp.add_rules('implements', array['implementation_initiative'], array['@core']);
select pg_temp.add_rules('initiates', array['decision', 'recommendation'], array['implementation_initiative']);
select pg_temp.add_rules('validates', array['review'], array['implementation_initiative']);

drop function pg_temp.add_rules(text, text[], text[]);
drop function pg_temp.expand_tokens(text[]);
drop function pg_temp.token_items(text);

-- validates is a restricted-write relationship (D13): recorded only by
-- record_review_validation, never a free-form insert.
create or replace function private.guard_architecture_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  in_op boolean := private.in_architecture_operation();
  s record;
  t record;
  rel public.relationship_types;
  swap uuid;
begin
  if tg_op = 'DELETE' then
    if old.published_at is not null then
      raise exception 'A published relationship is retired, never deleted' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.published_at is not null then
      if not (in_op and old.retired_at is null and new.retired_at is not null
              and (to_jsonb(new) - array['retired_at', 'retired_by', 'retirement_reason', 'updated_at'])
                  = (to_jsonb(old) - array['retired_at', 'retired_by', 'retirement_reason', 'updated_at'])) then
        raise exception 'A published relationship is immutable; retire it and record a new one'
          using errcode = '23514';
      end if;
      new.updated_at := clock_timestamp();
      return new;
    end if;
    if new.source_element_id <> old.source_element_id or new.target_element_id <> old.target_element_id
       or new.relationship_type <> old.relationship_type or new.engagement_id <> old.engagement_id then
      raise exception 'Record a new relationship instead of changing its ends or type' using errcode = '23514';
    end if;
    if not in_op then
      if new.published_at is distinct from old.published_at or new.retired_at is distinct from old.retired_at then
        raise exception 'Relationships are published and retired only through architecture operations'
          using errcode = '42501';
      end if;
      if new.client_visibility <> old.client_visibility and not private.can_publish_architecture(new.engagement_id) then
        raise exception 'Only architecture publishers change relationship visibility' using errcode = '42501';
      end if;
      if new.provenance <> old.provenance and new.provenance in ('client_decision', 'system_derived') then
        raise exception 'Provenance % is recorded only by DSA OS operations', new.provenance using errcode = '42501';
      end if;
    end if;
  else
    if new.relationship_type = 'conflicts_with' and new.source_element_id > new.target_element_id then
      swap := new.source_element_id;
      new.source_element_id := new.target_element_id;
      new.target_element_id := swap;
    end if;
    if not in_op then
      if new.relationship_type = 'supersedes' then
        raise exception 'Supersession is recorded only by supersede_element' using errcode = '42501';
      end if;
      if new.relationship_type = 'validates' then
        raise exception 'validates is recorded only by record_review_validation' using errcode = '42501';
      end if;
      if new.provenance in ('client_decision', 'system_derived') then
        raise exception 'Provenance % is recorded only by DSA OS operations', new.provenance using errcode = '42501';
      end if;
      if new.client_visibility = 'client' and not private.can_publish_architecture(new.engagement_id) then
        raise exception 'Only architecture publishers set client visibility' using errcode = '42501';
      end if;
      new.published_at := null;
      new.published_by := null;
      new.retired_at := null;
      new.retired_by := null;
      new.retirement_reason := null;
    end if;
  end if;

  select e.kind, e.lifecycle, e.engagement_id, o.object_type into s
  from public.architecture_elements e left join public.architecture_objects o on o.element_id = e.id
  where e.id = new.source_element_id;
  select e.kind, e.lifecycle, e.engagement_id, o.object_type into t
  from public.architecture_elements e left join public.architecture_objects o on o.element_id = e.id
  where e.id = new.target_element_id;
  if s.kind is null or t.kind is null then
    raise exception 'Both ends must be elements of this engagement' using errcode = '23503';
  end if;
  if not in_op and (s.lifecycle in ('retired', 'superseded') or t.lifecycle in ('retired', 'superseded')) then
    raise exception 'Retired or superseded elements take no new relationships' using errcode = '23514';
  end if;

  select * into rel from public.relationship_types where key = new.relationship_type;
  if not exists (
    select 1 from public.relationship_rules r
    where r.relationship_type = new.relationship_type
      and r.source_kind = s.kind and r.source_object_type is not distinct from s.object_type
      and r.target_kind = t.kind and r.target_object_type is not distinct from t.object_type
  ) then
    raise exception 'The Development Architecture Method does not define "%" from % to %', rel.label,
      coalesce(s.object_type, s.kind::text), coalesce(t.object_type, t.kind::text)
      using errcode = '23514';
  end if;

  if new.relationship_type = 'requires' and s.object_type = 'role' and t.object_type = 'skill' then
    if new.required_proficiency is null then
      raise exception 'A role''s required skill needs a proficiency' using errcode = '23514';
    end if;
  elsif new.required_proficiency is not null then
    raise exception 'Only a role requiring a skill carries a proficiency' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and rel.is_acyclic then
    perform pg_advisory_xact_lock(hashtextextended('architecture_relationships:' || new.engagement_id::text, 0));
    if exists (
      with recursive reach(element_id) as (
        select new.target_element_id
        union
        select r.target_element_id
        from public.architecture_relationships r
        join reach on r.source_element_id = reach.element_id
        where r.relationship_type = new.relationship_type and r.retired_at is null
      )
      select 1 from reach where element_id = new.source_element_id
    ) then
      raise exception '"%" relationships cannot form a cycle', rel.label using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Implementation categories (§4.3, D2/D14 - own table, not intelligence_categories)
-- -----------------------------------------------------------------------------
create table public.implementation_categories (
  key         text primary key check (key ~ '^[a-z][a-z_]*$'),
  label       text not null,
  definition  text not null,
  sort_order  int not null
);

insert into public.implementation_categories (key, label, definition, sort_order) values
  ('program', 'Program', 'A coordinated program of initiatives realizing part of the architecture.', 1),
  ('process', 'Process', 'A repeatable operating process being put into practice.', 2),
  ('system', 'System', 'A software system, platform or tool being built or deployed.', 3),
  ('partnership', 'Partnership', 'An external partnership or agreement being formed.', 4),
  ('team_or_talent', 'Team or talent', 'A team, role or capability being built or hired.', 5),
  ('governance', 'Governance', 'A governance body, decision right or oversight mechanism being put in place.', 6),
  ('other', 'Other', 'Anything the categories above do not describe.', 99);

-- -----------------------------------------------------------------------------
-- 5. Tables
-- -----------------------------------------------------------------------------

-- Reviews (§5): a convened session.
create table public.reviews (
  element_id     uuid primary key,
  engagement_id  uuid not null,
  kind           public.element_kind not null default 'review' check (kind = 'review'),
  review_type    public.review_type not null,
  scheduled_for  timestamptz,
  held_at        timestamptz,
  review_status  public.review_status not null default 'scheduled',
  baseline_id    uuid,
  summary        text not null default '' check (char_length(summary) <= 4000),
  constraint reviews_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade,
  constraint reviews_baseline_fk foreign key (baseline_id, engagement_id)
    references public.architecture_baselines (id, engagement_id) on delete restrict,
  constraint reviews_engagement_key unique (element_id, engagement_id),
  constraint reviews_held check (review_status <> 'held' or held_at is not null)
);

create table public.review_participants (
  id                     uuid primary key default gen_random_uuid(),
  element_id             uuid not null,
  engagement_id          uuid not null,
  engagement_member_id   uuid not null,
  role                   public.review_participant_role not null default 'attendee',
  attended               boolean not null default false,
  added_by               uuid references public.profiles (id) on delete set null default auth.uid(),
  added_at               timestamptz not null default clock_timestamp(),
  constraint review_participants_element_fk foreign key (element_id, engagement_id)
    references public.reviews (element_id, engagement_id) on delete cascade,
  constraint review_participants_member_fk foreign key (engagement_member_id, engagement_id)
    references public.engagement_members (id, engagement_id) on delete cascade,
  constraint review_participants_unique unique (element_id, engagement_member_id)
);
create index review_participants_element_idx on public.review_participants (element_id);

-- Deliverables (§6): a formal TPLCo output.
create table public.deliverables (
  element_id        uuid primary key,
  engagement_id     uuid not null,
  kind              public.element_kind not null default 'deliverable' check (kind = 'deliverable'),
  deliverable_type  public.deliverable_type not null default 'other',
  baseline_id       uuid,
  confidential      boolean not null default false,
  constraint deliverables_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade,
  constraint deliverables_baseline_fk foreign key (baseline_id, engagement_id)
    references public.architecture_baselines (id, engagement_id) on delete restrict,
  constraint deliverables_engagement_key unique (element_id, engagement_id)
);

-- Implementation Initiatives (§7): the organized effort to realize approved
-- architecture in operating reality.
create table public.implementation_initiatives (
  element_id             uuid primary key,
  engagement_id          uuid not null,
  kind                   public.element_kind not null default 'implementation_initiative' check (kind = 'implementation_initiative'),
  category               text not null default 'other' references public.implementation_categories (key),
  implementation_status  public.implementation_status not null default 'not_started',
  target_operational_on  date,
  actual_operational_on  date,
  owner_member_id        uuid,
  constraint implementation_initiatives_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade,
  constraint implementation_initiatives_engagement_key unique (element_id, engagement_id),
  constraint implementation_initiatives_owner_fk foreign key (owner_member_id, engagement_id)
    references public.engagement_members (id, engagement_id) on delete set null (owner_member_id),
  constraint implementation_initiatives_actual check (
    actual_operational_on is null or implementation_status in ('operational', 'validated')
  )
);

-- Implementation's own stewardship (§7.3, D2): identical shape to
-- intelligence_stewardship, physically separate table.
create table public.implementation_stewardship (
  element_id      uuid primary key,
  engagement_id   uuid not null,
  attention       public.intelligence_attention not null default 'routine',
  triage_state    public.triage_state not null default 'untriaged',
  triaged_by      uuid references public.profiles (id) on delete set null,
  triaged_at      timestamptz,
  triage_note     text not null default '' check (char_length(triage_note) <= 2000),
  next_review_on  date,
  updated_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default clock_timestamp(),
  constraint implementation_stewardship_element_fk foreign key (element_id, engagement_id)
    references public.implementation_initiatives (element_id, engagement_id) on delete cascade,
  constraint implementation_stewardship_triaged check (triage_state = 'untriaged' or triaged_at is not null)
);
create index implementation_stewardship_engagement_idx on public.implementation_stewardship (engagement_id);

-- Implementation's own append-only field history (§7.3, D2).
create table public.implementation_status_changes (
  id             bigint generated always as identity primary key,
  engagement_id  uuid not null,
  element_id     uuid not null,
  field          text not null,
  from_value     text,
  to_value       text,
  operation      text not null default 'edit',
  rationale      text check (char_length(rationale) <= 2000),
  changed_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  changed_at     timestamptz not null default clock_timestamp(),
  constraint implementation_status_changes_element_fk foreign key (element_id, engagement_id)
    references public.implementation_initiatives (element_id, engagement_id) on delete cascade
);
create index implementation_status_changes_element_idx on public.implementation_status_changes (element_id, changed_at);
create index implementation_status_changes_engagement_idx on public.implementation_status_changes (engagement_id, changed_at);

-- Implementation's own escalations (§7.3, D2). A client-executive escalation
-- still delivers through the existing, unmodified client_actions table.
create table public.implementation_escalations (
  id                uuid primary key default gen_random_uuid(),
  engagement_id     uuid not null,
  element_id        uuid not null,
  level             public.escalation_level not null,
  reason            text not null check (char_length(btrim(reason)) between 1 and 2000),
  raised_by         uuid references public.profiles (id) on delete set null,
  raised_at         timestamptz not null default clock_timestamp(),
  acknowledged_by   uuid references public.profiles (id) on delete set null,
  acknowledged_at   timestamptz,
  resolved_by       uuid references public.profiles (id) on delete set null,
  resolved_at       timestamptz,
  resolution_note   text check (char_length(resolution_note) <= 2000),
  client_action_id  uuid,
  constraint implementation_escalations_element_fk foreign key (element_id, engagement_id)
    references public.implementation_initiatives (element_id, engagement_id) on delete cascade,
  constraint implementation_escalations_action_fk foreign key (client_action_id, engagement_id)
    references public.client_actions (id, engagement_id) on delete restrict,
  constraint implementation_escalations_client_action check ((level = 'client_executive') = (client_action_id is not null)),
  constraint implementation_escalations_resolved check ((resolved_at is null) = (resolution_note is null))
);
create unique index implementation_escalations_one_open on public.implementation_escalations (element_id, level)
  where resolved_at is null;
create index implementation_escalations_engagement_idx on public.implementation_escalations (engagement_id);

-- Implementation's own signal dismissals (mirrors intelligence_signal_dismissals;
-- not listed in §10.2's table but required by §11's dismiss-signal operation and
-- D2's "own tables, never Phase 4's" principle). One rule: implementation_past_target.
create table public.implementation_signal_dismissals (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements (id) on delete restrict,
  rule_key       text not null default 'implementation_past_target' check (rule_key = 'implementation_past_target'),
  element_id     uuid not null,
  fingerprint    text not null check (char_length(fingerprint) <= 1000),
  reason         text not null check (char_length(btrim(reason)) between 1 and 1000),
  expires_on     date,
  dismissed_by   uuid references public.profiles (id) on delete set null,
  dismissed_at   timestamptz not null default clock_timestamp(),
  constraint implementation_signal_dismissals_element_fk foreign key (element_id, engagement_id)
    references public.implementation_initiatives (element_id, engagement_id) on delete cascade
);
create index implementation_signal_dismissals_engagement_idx on public.implementation_signal_dismissals (engagement_id, rule_key);

-- Implementation Checkpoints (§7.6, D9/D15): a small, dated fact about one
-- initiative's progress. No spine row, no reference code, no lifecycle.
create table public.implementation_checkpoints (
  id                            uuid primary key default gen_random_uuid(),
  engagement_id                 uuid not null,
  implementation_element_id     uuid not null,
  checkpoint_type               public.implementation_checkpoint_type not null,
  title                         text not null check (char_length(btrim(title)) between 1 and 200),
  target_on                     date,
  achieved_on                   date,
  achieved_evidence_source_id   uuid,
  related_review_id             uuid,
  related_approval_id           uuid,
  client_visible                boolean not null default false,
  created_by                    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at                    timestamptz not null default clock_timestamp(),
  updated_at                    timestamptz not null default clock_timestamp(),
  constraint implementation_checkpoints_initiative_fk foreign key (implementation_element_id, engagement_id)
    references public.implementation_initiatives (element_id, engagement_id) on delete cascade,
  constraint implementation_checkpoints_evidence_fk foreign key (achieved_evidence_source_id, engagement_id)
    references public.evidence_sources (id, engagement_id) on delete restrict,
  constraint implementation_checkpoints_review_fk foreign key (related_review_id, engagement_id)
    references public.reviews (element_id, engagement_id) on delete restrict,
  constraint implementation_checkpoints_approval_fk foreign key (related_approval_id)
    references public.architecture_approvals (id) on delete restrict
);
create index implementation_checkpoints_initiative_idx on public.implementation_checkpoints (implementation_element_id);

-- -----------------------------------------------------------------------------
-- 6. Visibility: confidential deliverables need view_confidential_deliverables
--    on top of the ordinary client-readable rule (§2.3 item 5, D10).
-- -----------------------------------------------------------------------------
create or replace function private.element_client_readable(target_element_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.architecture_elements e
    where e.id = target_element_id
      and e.client_visibility = 'client'
      and e.lifecycle <> 'retired'
      and e.latest_version_id is not null
      and (
        private.can_read_architecture(e.engagement_id)
        or private.has_engagement_capability(e.engagement_id, 'view_full_architecture')
        or private.element_in_my_areas(e.id)
      )
      and (
        e.kind <> 'deliverable'
        or not coalesce((select d.confidential from public.deliverables d where d.element_id = e.id), false)
        or private.has_engagement_capability(e.engagement_id, 'view_confidential_deliverables')
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- 7. Phase 3 functions that learn the three new kinds
-- -----------------------------------------------------------------------------
create or replace function private.check_element_integrity_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  has_subtype boolean;
begin
  select * into e from public.architecture_elements where id = new.id;
  if not found then
    return null;
  end if;
  has_subtype := case e.kind
    when 'object' then exists (select 1 from public.architecture_objects where element_id = e.id)
    when 'assumption' then exists (select 1 from public.assumptions where element_id = e.id)
    when 'risk' then exists (select 1 from public.risks where element_id = e.id)
    when 'constraint' then exists (select 1 from public.constraints where element_id = e.id)
    when 'dependency' then exists (select 1 from public.dependencies where element_id = e.id)
    when 'decision' then exists (select 1 from public.decisions where element_id = e.id)
    when 'recommendation' then exists (select 1 from public.recommendations where element_id = e.id)
    when 'opportunity' then exists (select 1 from public.opportunities where element_id = e.id)
    when 'review' then exists (select 1 from public.reviews where element_id = e.id)
    when 'deliverable' then exists (select 1 from public.deliverables where element_id = e.id)
    when 'implementation_initiative' then exists (select 1 from public.implementation_initiatives where element_id = e.id)
  end;
  if not has_subtype then
    raise exception 'Element % has no % record', coalesce(e.reference_code, e.id::text), e.kind using errcode = '23514';
  end if;
  if e.reference_code is null then
    raise exception 'Element % has no reference code', e.id using errcode = '23514';
  end if;
  return null;
end;
$$;

-- Records still need a scope; reviews and deliverables need none; an
-- initiative's scope is the core object(s) it implements (mirrors ADR-0017).
create or replace function private.assert_record_scope(e public.architecture_elements)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if e.kind = 'object' or e.engagement_wide or e.kind = 'dependency' or e.kind in ('review', 'deliverable') then
    return;
  end if;
  if e.kind = 'implementation_initiative' then
    if exists (
      select 1 from public.architecture_relationships r
      where r.source_element_id = e.id and r.relationship_type = 'implements' and r.retired_at is null
    ) then
      return;
    end if;
    raise exception '% must implement at least one architecture object', e.reference_code using errcode = '23514';
  end if;
  if exists (select 1 from public.intelligence_record_domains where element_id = e.id)
     or exists (
       select 1 from public.architecture_relationships r
       where r.retired_at is null
         and r.relationship_type in ('underpins', 'threatens', 'constrains', 'mitigates', 'affects', 'addresses',
                                     'advances', 'pursues')
         and (r.source_element_id = e.id or r.target_element_id = e.id)
     ) then
    return;
  end if;
  raise exception '% needs a scope: one or more domains, a related element, or engagement-wide',
    e.reference_code using errcode = '23514';
end;
$$;

create or replace function private.build_element_snapshot(p_element_id uuid, p_for_client boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  result jsonb;
  details jsonb := '{}'::jsonb;
  domains jsonb := '[]'::jsonb;
  statements jsonb;
  element_evidence jsonb;
  source_ids jsonb;
begin
  select * into e from public.architecture_elements where id = p_element_id;
  if not found then
    return null;
  end if;

  result := jsonb_build_object(
    'element_id', e.id,
    'kind', e.kind,
    'reference_code', e.reference_code,
    'title', e.title,
    'summary', e.summary,
    'provenance', e.provenance,
    'engagement_wide', e.engagement_wide
  );
  if not p_for_client then
    result := result || jsonb_build_object(
      'source_reference', e.source_reference,
      'ip_classification', e.ip_classification,
      'client_visibility', e.client_visibility,
      'owner_user_id', e.owner_user_id,
      'methodology_version', e.methodology_version,
      'ai_review_state', e.ai_review_state,
      'ai_reviewed_by', e.ai_reviewed_by,
      'ai_reviewed_at', e.ai_reviewed_at
    );
  end if;

  case e.kind
    when 'object' then
      select jsonb_build_object('domain', o.domain, 'object_type', o.object_type, 'maturity', o.maturity,
                                'maturity_rationale', o.maturity_rationale, 'attributes', o.attributes)
      into details from public.architecture_objects o where o.element_id = e.id;
    when 'assumption' then
      select to_jsonb(a) - 'element_id' - 'engagement_id' - 'kind' into details
      from public.assumptions a where a.element_id = e.id;
    when 'risk' then
      select to_jsonb(r) - 'element_id' - 'engagement_id' - 'kind' into details
      from public.risks r where r.element_id = e.id;
    when 'constraint' then
      select to_jsonb(c) - 'element_id' - 'engagement_id' - 'kind' into details
      from public.constraints c where c.element_id = e.id;
    when 'dependency' then
      select jsonb_build_object('from_element_id', d.from_element_id, 'to_element_id', d.to_element_id,
                                'dependency_type', d.dependency_type, 'blocking', d.blocking,
                                'dependency_status', d.dependency_status)
             || case when p_for_client then '{}'::jsonb else jsonb_build_object(
                  'from_reference_code', f.reference_code, 'from_title', f.title,
                  'to_reference_code', t.reference_code, 'to_title', t.title) end
      into details
      from public.dependencies d
      join public.architecture_elements f on f.id = d.from_element_id
      join public.architecture_elements t on t.id = d.to_element_id
      where d.element_id = e.id;
    when 'decision' then
      select jsonb_build_object(
               'category', d.category,
               'context', d.context, 'decision_status', d.decision_status, 'needed_by', d.needed_by,
               'downstream_impact', d.downstream_impact,
               'recommended_option_id', d.recommended_option_id,
               'recommendation_rationale', d.recommendation_rationale,
               'chosen_option_id', d.chosen_option_id, 'decision_note', d.decision_note,
               'outcome_provenance', d.outcome_provenance, 'decision_source', d.decision_source,
               'decided_at', d.decided_at, 'external_decider_name', d.external_decider_name,
               'external_decided_on', d.external_decided_on, 'external_decision_method', d.external_decision_method,
               'deferred_reason', d.deferred_reason,
               'options', coalesce((
                 select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description,
                                                     'tradeoffs', o.tradeoffs) order by o.sort_order, o.created_at)
                 from public.decision_options o where o.decision_element_id = d.element_id
               ), '[]'::jsonb))
             || case when p_for_client then '{}'::jsonb else jsonb_build_object(
                  'decision_owner_user_id', d.decision_owner_user_id, 'decided_by', d.decided_by,
                  'external_evidence', d.external_evidence, 'recorded_by', d.recorded_by) end
      into details
      from public.decisions d where d.element_id = e.id;
    when 'recommendation' then
      select to_jsonb(r) - 'element_id' - 'engagement_id' - 'kind' into details
      from public.recommendations r where r.element_id = e.id;
    when 'opportunity' then
      select to_jsonb(o) - 'element_id' - 'engagement_id' - 'kind' into details
      from public.opportunities o where o.element_id = e.id;
    when 'review' then
      select to_jsonb(r) - 'element_id' - 'engagement_id' - 'kind' into details
      from public.reviews r where r.element_id = e.id;
    when 'deliverable' then
      select to_jsonb(d) - 'element_id' - 'engagement_id' - 'kind' into details
      from public.deliverables d where d.element_id = e.id;
    when 'implementation_initiative' then
      select to_jsonb(i) - 'element_id' - 'engagement_id' - 'kind' into details
      from public.implementation_initiatives i where i.element_id = e.id;
  end case;

  if e.kind <> 'object' then
    select coalesce(jsonb_agg(d.domain order by d.domain), '[]'::jsonb) into domains
    from public.intelligence_record_domains d where d.element_id = e.id;
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object('id', s.id, 'statement_kind', s.statement_kind, 'body', s.body,
                              'provenance', s.provenance)
           || case when p_for_client then '{}'::jsonb else jsonb_build_object(
                'source_reference', s.source_reference, 'client_visible', s.client_visible,
                'ai_review_state', s.ai_review_state, 'ai_reviewed_by', s.ai_reviewed_by) end
           || jsonb_build_object('evidence', coalesce((
                select jsonb_agg(private.evidence_citation(l.evidence_source_id, l.stance, l.locator, l.note, p_for_client)
                                 order by l.created_at)
                from public.statement_evidence_links l
                join public.evidence_sources src on src.id = l.evidence_source_id
                where l.statement_id = s.id and (not p_for_client or src.client_visibility = 'client')
              ), '[]'::jsonb))
           order by s.sort_order, s.created_at), '[]'::jsonb)
  into statements
  from public.architecture_statements s
  where s.element_id = e.id
    and s.ai_review_state in ('not_applicable', 'accepted')
    and (not p_for_client or s.client_visible);

  select coalesce(jsonb_agg(private.evidence_citation(l.evidence_source_id, l.stance, l.locator, l.note, p_for_client)
                            order by l.created_at), '[]'::jsonb)
  into element_evidence
  from public.element_evidence_links l
  join public.evidence_sources src on src.id = l.evidence_source_id
  where l.element_id = e.id and (not p_for_client or src.client_visibility = 'client');

  select coalesce(jsonb_agg(distinct x.value -> 'source' -> 'id'), '[]'::jsonb) into source_ids
  from (
    select jsonb_array_elements(st -> 'evidence') as value from jsonb_array_elements(statements) st
    union all
    select jsonb_array_elements(element_evidence)
  ) x;

  return result || jsonb_build_object(
    'details', coalesce(details, '{}'::jsonb),
    'domains', domains,
    'statements', statements,
    'evidence', element_evidence,
    'evidence_source_ids', source_ids
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Triggers
-- -----------------------------------------------------------------------------

-- Context markers, mirroring set/clear_intelligence_context in Implementation's
-- own transaction-local settings (D2).
create function private.set_implementation_context(p_operation text, p_rationale text)
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.implementation_operation', coalesce(p_operation, ''), true),
         set_config('dsa.implementation_rationale', coalesce(btrim(p_rationale), ''), true);
$$;

create function private.clear_implementation_context()
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.implementation_operation', '', true),
         set_config('dsa.implementation_rationale', '', true);
$$;

revoke all on function private.set_implementation_context(text, text) from public, anon, authenticated;
revoke all on function private.clear_implementation_context() from public, anon, authenticated;

-- Every initiative gets its stewardship row when it is created.
create function private.create_implementation_stewardship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.implementation_stewardship (element_id, engagement_id, updated_by)
  values (new.element_id, new.engagement_id, auth.uid());
  return null;
end;
$$;

create trigger implementation_initiatives_stewardship after insert on public.implementation_initiatives
  for each row execute function private.create_implementation_stewardship();

-- Field history: one row per changed tracked field (trigger arguments).
create function private.record_implementation_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f text;
  before_value text;
  after_value text;
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  op text := coalesce(
    nullif(current_setting('dsa.implementation_operation', true), ''),
    case when tg_op = 'INSERT' then 'created'
         when private.in_architecture_operation() then 'operation'
         else 'edit' end
  );
  why text := nullif(current_setting('dsa.implementation_rationale', true), '');
begin
  foreach f in array tg_argv loop
    before_value := o ->> f;
    after_value := n ->> f;
    if before_value is distinct from after_value and not (tg_op = 'INSERT' and after_value is null) then
      insert into public.implementation_status_changes (
        engagement_id, element_id, field, from_value, to_value, operation, rationale, changed_by
      ) values (
        (n ->> 'engagement_id')::uuid, (n ->> 'element_id')::uuid, f, before_value, after_value, op, why, auth.uid()
      );
    end if;
  end loop;
  return null;
end;
$$;

-- validated/abandoned are reached and left only through resolve and reopen.
create function private.guard_implementation_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  terminal text[] := array['validated', 'abandoned'];
begin
  if private.in_architecture_operation() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.implementation_status::text = any (terminal) then
      raise exception 'A new initiative starts in an active status' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.implementation_status is distinct from old.implementation_status
     and (new.implementation_status::text = any (terminal) or old.implementation_status::text = any (terminal)) then
    raise exception 'Use Resolve or Reopen, with a rationale, to move an initiative to or from %',
      case when new.implementation_status::text = any (terminal) then new.implementation_status else old.implementation_status end
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Append-only: implementation_status_changes is never updated, and deleted
-- only with its parent (a draft initiative removed before publication).
create function private.guard_implementation_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception '% is append-only', tg_table_name using errcode = '23514';
  end if;
  if exists (select 1 from public.implementation_initiatives where element_id = old.element_id) then
    raise exception '% is append-only', tg_table_name using errcode = '23514';
  end if;
  return old;
end;
$$;

-- Checkpoints inherit their engagement from the parent initiative and are
-- frozen once it is retired or superseded, like any other element child.
create function private.prepare_implementation_checkpoint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent public.architecture_elements;
  parent_id uuid := coalesce(new.implementation_element_id, old.implementation_element_id);
begin
  select e.* into parent from public.architecture_elements e
  where e.id = parent_id;
  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'Initiative not found' using errcode = '23503';
  end if;
  if parent.lifecycle in ('retired', 'superseded') and not private.in_architecture_operation() then
    raise exception 'A retired or superseded element cannot be edited' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.engagement_id := parent.engagement_id;
  if tg_op = 'UPDATE' then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create trigger reviews_prepare before insert or update or delete on public.reviews
  for each row execute function private.prepare_element_child();
create trigger reviews_log after insert or update or delete on public.reviews
  for each row execute function private.log_activity();
create trigger review_participants_prepare before insert or update or delete on public.review_participants
  for each row execute function private.prepare_element_child();
create trigger review_participants_log after insert or update or delete on public.review_participants
  for each row execute function private.log_activity();

create trigger deliverables_prepare before insert or update or delete on public.deliverables
  for each row execute function private.prepare_element_child();
create trigger deliverables_log after insert or update or delete on public.deliverables
  for each row execute function private.log_activity();

create trigger implementation_initiatives_prepare before insert or update or delete on public.implementation_initiatives
  for each row execute function private.prepare_element_child();
create trigger implementation_initiatives_status_guard before insert or update on public.implementation_initiatives
  for each row execute function private.guard_implementation_status();
create trigger implementation_initiatives_history after insert or update on public.implementation_initiatives
  for each row execute function private.record_implementation_changes(
    'category', 'implementation_status', 'target_operational_on', 'owner_member_id'
  );
create trigger implementation_initiatives_log after insert or update or delete on public.implementation_initiatives
  for each row execute function private.log_activity();

create trigger implementation_stewardship_history after insert or update on public.implementation_stewardship
  for each row execute function private.record_implementation_changes('attention', 'triage_state', 'next_review_on');
create trigger implementation_stewardship_log after update on public.implementation_stewardship
  for each row execute function private.log_activity();

create trigger implementation_status_changes_guard before update or delete on public.implementation_status_changes
  for each row execute function private.guard_implementation_log();

create trigger implementation_checkpoints_prepare before insert or update or delete on public.implementation_checkpoints
  for each row execute function private.prepare_implementation_checkpoint();
create trigger implementation_checkpoints_log after insert or update or delete on public.implementation_checkpoints
  for each row execute function private.log_activity();

do $$
declare
  tbl text;
begin
  foreach tbl in array array['implementation_escalations', 'implementation_signal_dismissals'] loop
    execute format('create trigger %1$s_log after insert or update or delete on public.%1$s
                      for each row execute function private.log_activity()', tbl);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Privileges. Creation (elements + subtype rows) goes only through the
--    operations in section 12; working fields not gated by a rationale are
--    editable directly by the matching capability's holders, exactly as
--    opportunities are in Phase 4.
-- -----------------------------------------------------------------------------
revoke all on
  public.implementation_categories, public.reviews, public.review_participants, public.deliverables,
  public.implementation_initiatives, public.implementation_stewardship, public.implementation_status_changes,
  public.implementation_escalations, public.implementation_signal_dismissals, public.implementation_checkpoints
from anon, authenticated;

grant select on
  public.implementation_categories, public.reviews, public.review_participants, public.deliverables,
  public.implementation_initiatives, public.implementation_stewardship, public.implementation_status_changes,
  public.implementation_escalations, public.implementation_signal_dismissals, public.implementation_checkpoints
to authenticated;

grant update (review_type, scheduled_for, baseline_id, summary) on public.reviews to authenticated;
grant update (role, attended) on public.review_participants to authenticated;
grant update (deliverable_type, confidential, baseline_id) on public.deliverables to authenticated;
grant update (category, target_operational_on, owner_member_id) on public.implementation_initiatives to authenticated;
grant update (checkpoint_type, title, target_on, client_visible, related_review_id, related_approval_id)
  on public.implementation_checkpoints to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.implementation_categories enable row level security;
alter table public.reviews enable row level security;
alter table public.review_participants enable row level security;
alter table public.deliverables enable row level security;
alter table public.implementation_initiatives enable row level security;
alter table public.implementation_stewardship enable row level security;
alter table public.implementation_status_changes enable row level security;
alter table public.implementation_escalations enable row level security;
alter table public.implementation_signal_dismissals enable row level security;
alter table public.implementation_checkpoints enable row level security;

create policy "implementation categories: readable reference data"
  on public.implementation_categories for select to authenticated using (true);

create policy "reviews: internal readers" on public.reviews for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "reviews: managers change" on public.reviews for update to authenticated
  using (private.can_manage_reviews(engagement_id)) with check (private.can_manage_reviews(engagement_id));

create policy "review participants: internal readers" on public.review_participants for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "review participants: managers change" on public.review_participants for update to authenticated
  using (private.can_manage_reviews(engagement_id)) with check (private.can_manage_reviews(engagement_id));
create policy "review participants: managers remove" on public.review_participants for delete to authenticated
  using (private.can_manage_reviews(engagement_id));

create policy "deliverables: internal readers" on public.deliverables for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "deliverables: managers change" on public.deliverables for update to authenticated
  using (private.can_manage_deliverables(engagement_id)) with check (private.can_manage_deliverables(engagement_id));

create policy "implementation initiatives: internal readers" on public.implementation_initiatives for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "implementation initiatives: managers change" on public.implementation_initiatives for update to authenticated
  using (private.can_manage_implementation(engagement_id)) with check (private.can_manage_implementation(engagement_id));

create policy "implementation stewardship: internal readers" on public.implementation_stewardship for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "implementation status history: internal readers" on public.implementation_status_changes for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "implementation escalations: internal readers" on public.implementation_escalations for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "implementation signal dismissals: internal readers" on public.implementation_signal_dismissals for select to authenticated
  using (private.can_read_architecture(engagement_id));

-- Checkpoints: internal readers of the engagement; clients who can read the
-- parent initiative's published snapshot and whom the checkpoint is marked
-- visible to.
create policy "implementation checkpoints: internal readers" on public.implementation_checkpoints for select to authenticated
  using (
    private.can_read_architecture(engagement_id)
    or (
      client_visible
      and (private.can_view_client_architecture(engagement_id) or private.can_read_architecture(engagement_id))
      and private.element_client_readable(implementation_element_id)
    )
  );
create policy "implementation checkpoints: managers change" on public.implementation_checkpoints for update to authenticated
  using (private.can_manage_implementation(engagement_id)) with check (private.can_manage_implementation(engagement_id));
create policy "implementation checkpoints: managers remove" on public.implementation_checkpoints for delete to authenticated
  using (private.can_manage_implementation(engagement_id));

-- architecture_elements: managers of reviews/deliverables/implementation may
-- change and remove their kind's elements without holding edit_architecture
-- (§2.1: a scoped role, never extended edit_architecture or publish_architecture).
create policy "architecture_elements: phase 5 managers change their kind" on public.architecture_elements
  for update to authenticated
  using (
    (kind = 'review' and private.can_manage_reviews(engagement_id))
    or (kind = 'deliverable' and private.can_manage_deliverables(engagement_id))
    or (kind = 'implementation_initiative' and private.can_manage_implementation(engagement_id))
  )
  with check (
    (kind = 'review' and private.can_manage_reviews(engagement_id))
    or (kind = 'deliverable' and private.can_manage_deliverables(engagement_id))
    or (kind = 'implementation_initiative' and private.can_manage_implementation(engagement_id))
  );
create policy "architecture_elements: phase 5 managers remove unpublished their kind" on public.architecture_elements
  for delete to authenticated
  using (
    latest_version_id is null
    and (
      (kind = 'review' and private.can_manage_reviews(engagement_id))
      or (kind = 'deliverable' and private.can_manage_deliverables(engagement_id))
      or (kind = 'implementation_initiative' and private.can_manage_implementation(engagement_id))
    )
  );

-- -----------------------------------------------------------------------------
-- 11. engagement_files: the deliverable purpose and its version link (§10.1).
--     A deliverable's file is attached to the specific published version it
--     documents, so a later version keeps its own file untouched.
-- -----------------------------------------------------------------------------
alter table public.engagement_files add column element_version_id uuid;
alter table public.engagement_files
  add constraint engagement_files_version_fk foreign key (element_version_id)
    references public.element_versions (id) on delete restrict,
  add constraint engagement_files_deliverable_purpose check (
    element_version_id is null or purpose = 'deliverable'
  );
create index engagement_files_version_idx on public.engagement_files (element_version_id);

create or replace function public.register_engagement_file(
  p_engagement_id uuid,
  p_purpose public.engagement_file_purpose,
  p_filename text,
  p_content_type text,
  p_size_bytes bigint,
  p_evidence_source_id uuid default null
)
returns table (file_id uuid, object_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  safe_name text;
begin
  if p_purpose = 'evidence' then
    perform private.require_architecture_capability(p_engagement_id, 'edit_architecture');
    if p_evidence_source_id is null or not exists (
      select 1 from public.evidence_sources where id = p_evidence_source_id and engagement_id = p_engagement_id
    ) then
      raise exception 'Evidence source not found' using errcode = 'P0002';
    end if;
  elsif p_purpose = 'deliverable' then
    perform private.require_engagement_capability(p_engagement_id, 'manage_deliverables');
    if p_evidence_source_id is not null then
      raise exception 'A deliverable file is attached to a version, not an evidence source' using errcode = '23514';
    end if;
  else
    if private.is_internal() or not private.is_engagement_client_member(p_engagement_id) then
      raise exception 'Engagement not found' using errcode = 'P0002';
    end if;
    if p_evidence_source_id is not null then
      raise exception 'Client files are attached to a response or input' using errcode = '23514';
    end if;
    if (p_purpose = 'client_response'
        and not private.has_engagement_capability(p_engagement_id, 'respond_to_client_actions')
        and not private.has_engagement_capability(p_engagement_id, 'assign_client_actions')
        and not private.has_engagement_capability(p_engagement_id, 'approve_architecture'))
       or (p_purpose = 'client_contribution'
        and not private.has_engagement_capability(p_engagement_id, 'submit_client_input')) then
      raise exception 'You cannot add files on this engagement' using errcode = '42501';
    end if;
  end if;
  safe_name := left(btrim(regexp_replace(coalesce(p_filename, ''), '[^A-Za-z0-9._ -]+', '_', 'g')), 120);
  if safe_name in ('', '.', '..') then
    raise exception 'The file needs a name' using errcode = '23514';
  end if;
  insert into public.engagement_files (
    id, engagement_id, object_path, filename, content_type, size_bytes, purpose, uploaded_by, evidence_source_id
  ) values (
    new_id, p_engagement_id, p_engagement_id::text || '/' || new_id::text || '/' || safe_name, safe_name,
    p_content_type, p_size_bytes, p_purpose, auth.uid(), p_evidence_source_id
  );
  return query select new_id, p_engagement_id::text || '/' || new_id::text || '/' || safe_name;
end;
$$;

-- Attaches a registered, uploaded file to the deliverable's currently
-- published version (attach_deliverable_file, §11). The deliverable must
-- already be published: the file documents a specific, immutable version.
create function public.attach_deliverable_file(p_element_id uuid, p_file_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  wanted uuid[] := array(select distinct x from unnest(coalesce(p_file_ids, '{}')) x where x is not null);
  attached int;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'deliverable' then
    raise exception 'Only a deliverable takes deliverable files' using errcode = '23514';
  end if;
  perform private.require_engagement_capability(e.engagement_id, 'manage_deliverables');
  if e.latest_version_id is null then
    raise exception 'Publish the deliverable before attaching its file' using errcode = '23514';
  end if;
  if cardinality(wanted) > 0 then
    if exists (
      select 1 from public.engagement_files f
      where f.id = any (wanted)
        and not exists (select 1 from storage.objects o where o.bucket_id = 'engagement-files' and o.name = f.object_path)
    ) then
      raise exception 'A file has not finished uploading' using errcode = '23514';
    end if;
    update public.engagement_files f
    set element_version_id = e.latest_version_id
    where f.id = any (wanted)
      and f.engagement_id = e.engagement_id
      and f.uploaded_by = auth.uid()
      and f.purpose = 'deliverable'
      and f.element_version_id is null;
    get diagnostics attached = row_count;
    if attached <> cardinality(wanted) then
      raise exception 'A file is not yours to attach, or is already attached' using errcode = '23514';
    end if;
  end if;
  perform private.end_architecture_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Operations
-- -----------------------------------------------------------------------------

-- Reviews ---------------------------------------------------------------------------
create function public.create_review(
  p_engagement_id uuid,
  p_review_type public.review_type,
  p_title text,
  p_scheduled_for timestamptz default null,
  p_baseline_id uuid default null,
  p_summary text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  perform private.begin_architecture_operation();
  perform private.require_engagement_capability(p_engagement_id, 'manage_reviews');
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'A review needs a title' using errcode = '23514';
  end if;
  if p_review_type is null then
    raise exception 'Choose the kind of review' using errcode = '23514';
  end if;
  if p_baseline_id is not null and not exists (
    select 1 from public.architecture_baselines where id = p_baseline_id and engagement_id = p_engagement_id
  ) then
    raise exception 'Baseline not found' using errcode = 'P0002';
  end if;

  insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
  values (new_id, p_engagement_id, 'review', btrim(p_title), 'architect_judgment');

  insert into public.reviews (element_id, engagement_id, review_type, scheduled_for, baseline_id, summary)
  values (new_id, p_engagement_id, p_review_type, p_scheduled_for, p_baseline_id, coalesce(btrim(p_summary), ''));

  perform private.end_architecture_operation();
  return new_id;
end;
$$;

create function public.add_review_participant(
  p_review_element_id uuid,
  p_engagement_member_id uuid,
  p_role public.review_participant_role default 'attendee'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  participant_id uuid;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_review_element_id);
  if e.kind <> 'review' then
    raise exception 'Only a review takes participants' using errcode = '23514';
  end if;
  perform private.require_engagement_capability(e.engagement_id, 'manage_reviews');
  if not exists (
    select 1 from public.engagement_members where id = p_engagement_member_id and engagement_id = e.engagement_id
  ) then
    raise exception 'Choose a member of this engagement' using errcode = '23514';
  end if;
  insert into public.review_participants (element_id, engagement_id, engagement_member_id, role)
  values (e.id, e.engagement_id, p_engagement_member_id, coalesce(p_role, 'attendee'))
  on conflict (element_id, engagement_member_id) do update set role = excluded.role
  returning id into participant_id;
  perform private.end_architecture_operation();
  return participant_id;
end;
$$;

create function public.hold_review(p_element_id uuid, p_held_at timestamptz default null, p_summary text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  r public.reviews;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'review' then
    raise exception 'Only a review is held' using errcode = '23514';
  end if;
  perform private.require_engagement_capability(e.engagement_id, 'manage_reviews');
  select * into r from public.reviews where element_id = e.id;
  if r.review_status <> 'scheduled' then
    raise exception 'Only a scheduled review can be held' using errcode = '23514';
  end if;
  update public.reviews
  set review_status = 'held',
      held_at = coalesce(p_held_at, clock_timestamp()),
      summary = coalesce(nullif(btrim(p_summary), ''), summary)
  where element_id = e.id;
  perform private.end_architecture_operation();
end;
$$;

create function public.cancel_review(p_element_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  r public.reviews;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'review' then
    raise exception 'Only a review is cancelled' using errcode = '23514';
  end if;
  perform private.require_engagement_capability(e.engagement_id, 'manage_reviews');
  select * into r from public.reviews where element_id = e.id;
  if r.review_status <> 'scheduled' then
    raise exception 'Only a scheduled review can be cancelled' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say why the review is cancelled' using errcode = '23514';
  end if;
  update public.reviews set review_status = 'cancelled' where element_id = e.id;
  perform private.log_architecture_event(e.engagement_id, 'reviews', e.id, 'review_cancelled',
    jsonb_build_object('reason', btrim(p_reason)));
  perform private.end_architecture_operation();
end;
$$;

-- record_review_validation: the only way a validates relationship is written
-- (D5/D13, §7.5's three-check gate).
create function public.record_review_validation(p_review_element_id uuid, p_initiative_element_id uuid)
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
  perform private.end_architecture_operation();
  return relationship_id;
end;
$$;

-- Deliverables ------------------------------------------------------------------------
create function public.create_deliverable(
  p_engagement_id uuid,
  p_deliverable_type public.deliverable_type,
  p_title text,
  p_baseline_id uuid default null,
  p_confidential boolean default false,
  p_summary text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  perform private.begin_architecture_operation();
  perform private.require_engagement_capability(p_engagement_id, 'manage_deliverables');
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'A deliverable needs a title' using errcode = '23514';
  end if;
  if p_baseline_id is not null and not exists (
    select 1 from public.architecture_baselines where id = p_baseline_id and engagement_id = p_engagement_id
  ) then
    raise exception 'Baseline not found' using errcode = 'P0002';
  end if;
  insert into public.architecture_elements (id, engagement_id, kind, title, summary, provenance)
  values (new_id, p_engagement_id, 'deliverable', btrim(p_title), coalesce(btrim(p_summary), ''), 'architect_judgment');
  insert into public.deliverables (element_id, engagement_id, deliverable_type, baseline_id, confidential)
  values (new_id, p_engagement_id, coalesce(p_deliverable_type, 'other'), p_baseline_id, coalesce(p_confidential, false));
  perform private.end_architecture_operation();
  return new_id;
end;
$$;

-- Implementation ----------------------------------------------------------------------
create function public.create_implementation_initiative(
  p_engagement_id uuid,
  p_title text,
  p_implements_element_ids uuid[],
  p_category text default 'other',
  p_target_operational_on date default null,
  p_owner_member_id uuid default null,
  p_summary text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  targets uuid[] := array(select distinct x from unnest(coalesce(p_implements_element_ids, '{}')) x where x is not null);
begin
  perform private.begin_architecture_operation();
  perform private.require_engagement_capability(p_engagement_id, 'manage_implementation');
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'An initiative needs a title' using errcode = '23514';
  end if;
  if cardinality(targets) = 0 then
    raise exception 'Choose at least one architecture object the initiative implements' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(targets) t(id)
    left join public.architecture_elements e on e.id = t.id and e.engagement_id = p_engagement_id and e.kind = 'object'
    where e.id is null
  ) then
    raise exception 'Choose architecture objects to implement' using errcode = '23514';
  end if;
  if p_owner_member_id is not null and not exists (
    select 1 from public.engagement_members where id = p_owner_member_id and engagement_id = p_engagement_id
  ) then
    raise exception 'Choose a member of this engagement' using errcode = '23514';
  end if;

  insert into public.architecture_elements (id, engagement_id, kind, title, summary, provenance)
  values (new_id, p_engagement_id, 'implementation_initiative', btrim(p_title), coalesce(btrim(p_summary), ''), 'architect_judgment');

  insert into public.implementation_initiatives (element_id, engagement_id, category, target_operational_on, owner_member_id)
  values (new_id, p_engagement_id, coalesce(nullif(p_category, ''), 'other'), p_target_operational_on, p_owner_member_id);

  insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  select p_engagement_id, new_id, t, 'implements', 'architect_judgment' from unnest(targets) t;

  perform private.end_architecture_operation();
  return new_id;
end;
$$;

-- Direct-edit column grants cover category/target/owner; implementation_status
-- always goes through an operation so a stalled transition can require its
-- rationale and validated/abandoned stay database-enforced (§7.2).
create function public.update_implementation_status(
  p_element_id uuid,
  p_status public.implementation_status,
  p_rationale text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  current_status public.implementation_status;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'implementation_initiative' then
    raise exception 'Only an initiative has an implementation status' using errcode = '23514';
  end if;
  perform private.require_engagement_capability(e.engagement_id, 'manage_implementation');
  if p_status not in ('not_started', 'in_progress', 'operational', 'stalled') then
    raise exception 'Use resolve or reopen for validated or abandoned' using errcode = '23514';
  end if;
  select implementation_status into current_status from public.implementation_initiatives where element_id = e.id;
  if current_status in ('validated', 'abandoned') then
    raise exception 'Reopen the initiative before changing its status' using errcode = '23514';
  end if;
  if p_status = 'stalled' and coalesce(btrim(p_rationale), '') = '' then
    raise exception 'Say why the initiative has stalled' using errcode = '23514';
  end if;
  perform private.set_implementation_context('edit', p_rationale);
  update public.implementation_initiatives
  set implementation_status = p_status,
      actual_operational_on = case when p_status = 'operational'
        then coalesce(actual_operational_on, private.business_today())
        else actual_operational_on end
  where element_id = e.id;
  perform private.clear_implementation_context();
  perform private.end_architecture_operation();
end;
$$;

-- One operation for both terminal transitions (§7.2, §11): validated
-- additionally requires a pre-existing qualifying validates relationship.
create function public.resolve_implementation_initiative(
  p_element_id uuid,
  p_status public.implementation_status,
  p_rationale text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  current_status public.implementation_status;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'implementation_initiative' then
    raise exception 'Only an initiative is resolved' using errcode = '23514';
  end if;
  perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
  if p_status not in ('validated', 'abandoned') then
    raise exception '"%" does not resolve an initiative', p_status using errcode = '23514';
  end if;
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'A rationale is required' using errcode = '23514';
  end if;
  select implementation_status into current_status from public.implementation_initiatives where element_id = e.id;
  if current_status in ('validated', 'abandoned') then
    raise exception 'The initiative is already resolved; reopen it first' using errcode = '23514';
  end if;
  if p_status = 'validated' and not exists (
    select 1 from public.architecture_relationships r
    join public.architecture_elements rev on rev.id = r.source_element_id
    where r.target_element_id = e.id and r.relationship_type = 'validates' and r.retired_at is null
      and rev.kind = 'review'
  ) then
    raise exception 'A held review must validate this initiative before it can be marked validated' using errcode = '23514';
  end if;
  perform private.set_implementation_context('resolved', p_rationale);
  update public.implementation_initiatives
  set implementation_status = p_status,
      actual_operational_on = case when p_status = 'validated'
        then coalesce(actual_operational_on, private.business_today())
        else actual_operational_on end
  where element_id = e.id;
  perform private.clear_implementation_context();
  perform private.end_architecture_operation();
end;
$$;

create function public.reopen_implementation_initiative(p_element_id uuid, p_rationale text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  current_status public.implementation_status;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'implementation_initiative' then
    raise exception 'Only an initiative is reopened' using errcode = '23514';
  end if;
  perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'A rationale is required' using errcode = '23514';
  end if;
  select implementation_status into current_status from public.implementation_initiatives where element_id = e.id;
  if current_status not in ('validated', 'abandoned') then
    raise exception 'Only a resolved initiative can be reopened' using errcode = '23514';
  end if;
  perform private.set_implementation_context('reopened', p_rationale);
  update public.implementation_initiatives set implementation_status = 'in_progress' where element_id = e.id;
  perform private.clear_implementation_context();
  perform private.end_architecture_operation();
end;
$$;

-- Triage / escalate / acknowledge / dismiss-signal, mirroring Phase 4's
-- operations but writing to Implementation's own tables (§7.3, D2).
create function public.triage_implementation(
  p_element_id uuid,
  p_attention public.intelligence_attention,
  p_next_review_on date default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'implementation_initiative' then
    raise exception 'Only an initiative is triaged' using errcode = '23514';
  end if;
  perform private.require_architecture_capability(e.engagement_id, 'edit_architecture');
  if p_attention is null then
    raise exception 'Choose the attention it needs' using errcode = '23514';
  end if;
  if p_attention = 'critical' and coalesce(btrim(p_note), '') = '' then
    raise exception 'Say why this initiative needs critical attention' using errcode = '23514';
  end if;
  perform private.set_implementation_context('triaged', p_note);
  update public.implementation_stewardship
  set attention = p_attention,
      next_review_on = p_next_review_on,
      triage_state = 'triaged',
      triaged_by = auth.uid(),
      triaged_at = clock_timestamp(),
      triage_note = coalesce(btrim(p_note), ''),
      updated_by = auth.uid(),
      updated_at = clock_timestamp()
  where element_id = e.id;
  perform private.clear_implementation_context();
  perform private.end_architecture_operation();
end;
$$;

create function public.escalate_implementation(
  p_element_id uuid,
  p_level public.escalation_level,
  p_reason text,
  p_addressee_member_id uuid default null,
  p_due_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  action_id uuid;
  escalation_id uuid;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'implementation_initiative' then
    raise exception 'Only an initiative is escalated' using errcode = '23514';
  end if;
  perform private.require_architecture_capability(
    e.engagement_id,
    case when p_level = 'client_executive' then 'publish_architecture'::public.engagement_capability else 'edit_architecture' end
  );
  if p_level is null or coalesce(btrim(p_reason), '') = '' then
    raise exception 'Choose a level and give the reason' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.implementation_escalations where element_id = e.id and level = p_level and resolved_at is null
  ) then
    raise exception '% is already escalated at this level', e.reference_code using errcode = '23514';
  end if;
  if p_level = 'client_executive' then
    if not private.element_published_for_client(e.id) then
      raise exception 'Only a published, client-visible initiative can be escalated to the client' using errcode = '23514';
    end if;
    if p_addressee_member_id is null then
      raise exception 'Choose the client executive' using errcode = '23514';
    end if;
    action_id := private.insert_client_action(
      e.engagement_id, 'executive_attention', left('Executive attention: ' || e.reference_code || ' ' || e.title, 200),
      btrim(p_reason), p_addressee_member_id, p_due_on, array[e.id]
    );
  end if;
  insert into public.implementation_escalations (engagement_id, element_id, level, reason, raised_by, client_action_id)
  values (e.engagement_id, e.id, p_level, btrim(p_reason), auth.uid(), action_id)
  returning id into escalation_id;
  perform private.end_architecture_operation();
  return escalation_id;
end;
$$;

create function public.acknowledge_implementation_escalation(p_escalation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x public.implementation_escalations;
begin
  select * into x from public.implementation_escalations where id = p_escalation_id for update;
  if not found then
    raise exception 'Escalation not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(x.engagement_id, 'publish_architecture');
  if x.level <> 'principal_architect' then
    raise exception 'The client executive acknowledges by responding to the request' using errcode = '23514';
  end if;
  if x.acknowledged_at is not null or x.resolved_at is not null then
    raise exception 'The escalation has already been acknowledged' using errcode = '23514';
  end if;
  update public.implementation_escalations
  set acknowledged_by = auth.uid(), acknowledged_at = clock_timestamp()
  where id = x.id;
end;
$$;

create function public.resolve_implementation_escalation(p_escalation_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x public.implementation_escalations;
  a public.client_actions;
begin
  select * into x from public.implementation_escalations where id = p_escalation_id for update;
  if not found then
    raise exception 'Escalation not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(x.engagement_id, 'publish_architecture');
  if x.resolved_at is not null then
    raise exception 'The escalation is already resolved' using errcode = '23514';
  end if;
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'Say how the escalation was resolved' using errcode = '23514';
  end if;
  if x.client_action_id is not null then
    select * into a from public.client_actions where id = x.client_action_id for update;
    if a.status in ('open', 'responded') then
      update public.client_actions
      set status = 'closed', closed_by = auth.uid(), closed_at = clock_timestamp(), close_note = btrim(p_note),
          updated_at = clock_timestamp()
      where id = a.id;
      insert into public.client_action_events (engagement_id, action_id, event, note)
      values (a.engagement_id, a.id, 'closed', btrim(p_note));
    end if;
  end if;
  update public.implementation_escalations
  set resolved_by = auth.uid(), resolved_at = clock_timestamp(), resolution_note = btrim(p_note),
      acknowledged_by = coalesce(acknowledged_by, auth.uid()),
      acknowledged_at = coalesce(acknowledged_at, clock_timestamp())
  where id = x.id;
end;
$$;

create function public.dismiss_implementation_signal(
  p_engagement_id uuid,
  p_element_id uuid,
  p_fingerprint text,
  p_reason text,
  p_expires_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  dismissal_id uuid;
begin
  perform private.require_architecture_capability(p_engagement_id, 'edit_architecture');
  if coalesce(p_fingerprint, '') = '' then
    raise exception 'Dismiss one signal at a time' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say why the signal does not need action' using errcode = '23514';
  end if;
  if p_expires_on is not null and p_expires_on <= private.business_today() then
    raise exception 'A dismissal expires in the future' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.architecture_elements where id = p_element_id and engagement_id = p_engagement_id
  ) then
    raise exception 'Signal not found' using errcode = 'P0002';
  end if;
  insert into public.implementation_signal_dismissals (engagement_id, element_id, fingerprint, reason, expires_on, dismissed_by)
  values (p_engagement_id, p_element_id, p_fingerprint, btrim(p_reason), p_expires_on, auth.uid())
  returning id into dismissal_id;
  return dismissal_id;
end;
$$;

-- Checkpoints (§7.6): direct edits for everything but achieving one.
create function public.add_implementation_checkpoint(
  p_element_id uuid,
  p_checkpoint_type public.implementation_checkpoint_type,
  p_title text,
  p_target_on date default null,
  p_related_review_id uuid default null,
  p_related_approval_id uuid default null,
  p_client_visible boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  checkpoint_id uuid;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'implementation_initiative' then
    raise exception 'Only an initiative has checkpoints' using errcode = '23514';
  end if;
  perform private.require_engagement_capability(e.engagement_id, 'manage_implementation');
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'A checkpoint needs a title' using errcode = '23514';
  end if;
  if p_related_review_id is not null and not exists (
    select 1 from public.reviews where element_id = p_related_review_id and engagement_id = e.engagement_id
  ) then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if p_related_approval_id is not null and not exists (
    select 1 from public.architecture_approvals where id = p_related_approval_id and engagement_id = e.engagement_id
  ) then
    raise exception 'Approval not found' using errcode = 'P0002';
  end if;
  insert into public.implementation_checkpoints (
    engagement_id, implementation_element_id, checkpoint_type, title, target_on,
    related_review_id, related_approval_id, client_visible
  ) values (
    e.engagement_id, e.id, p_checkpoint_type, btrim(p_title), p_target_on,
    p_related_review_id, p_related_approval_id, coalesce(p_client_visible, false)
  )
  returning id into checkpoint_id;
  perform private.end_architecture_operation();
  return checkpoint_id;
end;
$$;

create function public.record_checkpoint_achieved(
  p_checkpoint_id uuid,
  p_achieved_on date default null,
  p_achieved_evidence_source_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.implementation_checkpoints;
  e public.architecture_elements;
begin
  select * into c from public.implementation_checkpoints where id = p_checkpoint_id for update;
  if not found then
    raise exception 'Checkpoint not found' using errcode = 'P0002';
  end if;
  e := private.lock_element(c.implementation_element_id);
  perform private.require_engagement_capability(e.engagement_id, 'manage_implementation');
  if p_achieved_evidence_source_id is not null and not exists (
    select 1 from public.evidence_sources where id = p_achieved_evidence_source_id and engagement_id = e.engagement_id
  ) then
    raise exception 'Evidence source not found' using errcode = 'P0002';
  end if;
  update public.implementation_checkpoints
  set achieved_on = coalesce(p_achieved_on, private.business_today()),
      achieved_evidence_source_id = p_achieved_evidence_source_id,
      updated_at = clock_timestamp()
  where id = c.id;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_review(uuid, public.review_type, text, timestamptz, uuid, text)',
    'public.add_review_participant(uuid, uuid, public.review_participant_role)',
    'public.hold_review(uuid, timestamptz, text)',
    'public.cancel_review(uuid, text)',
    'public.record_review_validation(uuid, uuid)',
    'public.create_deliverable(uuid, public.deliverable_type, text, uuid, boolean, text)',
    'public.attach_deliverable_file(uuid, uuid[])',
    'public.create_implementation_initiative(uuid, text, uuid[], text, date, uuid, text)',
    'public.update_implementation_status(uuid, public.implementation_status, text)',
    'public.resolve_implementation_initiative(uuid, public.implementation_status, text)',
    'public.reopen_implementation_initiative(uuid, text)',
    'public.triage_implementation(uuid, public.intelligence_attention, date, text)',
    'public.escalate_implementation(uuid, public.escalation_level, text, uuid, date)',
    'public.acknowledge_implementation_escalation(uuid)',
    'public.resolve_implementation_escalation(uuid, text)',
    'public.dismiss_implementation_signal(uuid, uuid, text, text, date)',
    'public.add_implementation_checkpoint(uuid, public.implementation_checkpoint_type, text, date, uuid, uuid, boolean)',
    'public.record_checkpoint_achieved(uuid, date, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Read models
-- -----------------------------------------------------------------------------

create function public.review_register(p_engagement_id uuid default null)
returns table (
  element_id uuid, engagement_id uuid, reference_code text, title text, summary text,
  lifecycle public.element_lifecycle, client_visibility public.client_visibility,
  review_type public.review_type, scheduled_for timestamptz, held_at timestamptz,
  review_status public.review_status, baseline_id uuid, participant_count int, agenda_count int,
  created_at timestamptz, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.engagement_id, e.reference_code, e.title, e.summary, e.lifecycle, e.client_visibility,
    r.review_type, r.scheduled_for, r.held_at, r.review_status, r.baseline_id,
    (select count(*)::int from public.review_participants p where p.element_id = e.id),
    (select count(*)::int from public.architecture_relationships x
     where x.source_element_id = e.id and x.relationship_type = 'examines' and x.retired_at is null),
    e.created_at, e.updated_at
  from public.architecture_elements e
  join public.reviews r on r.element_id = e.id
  where e.kind = 'review' and (p_engagement_id is null or e.engagement_id = p_engagement_id)
  order by e.engagement_id, e.reference_code;
$$;

create function public.deliverable_register(p_engagement_id uuid default null)
returns table (
  element_id uuid, engagement_id uuid, reference_code text, title text, summary text,
  lifecycle public.element_lifecycle, client_visibility public.client_visibility,
  deliverable_type public.deliverable_type, baseline_id uuid, confidential boolean,
  latest_version_id uuid, approval_state text, created_at timestamptz, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.engagement_id, e.reference_code, e.title, e.summary, e.lifecycle, e.client_visibility,
    d.deliverable_type, d.baseline_id, d.confidential, e.latest_version_id,
    case when e.latest_version_id is null then null else private.approval_state(ap.response, ap.id is not null) end,
    e.created_at, e.updated_at
  from public.architecture_elements e
  join public.deliverables d on d.element_id = e.id
  left join public.architecture_approvals ap on ap.element_version_id = e.latest_version_id
  where e.kind = 'deliverable' and (p_engagement_id is null or e.engagement_id = p_engagement_id)
  order by e.engagement_id, e.reference_code;
$$;

-- Joined with Implementation's own stewardship/escalation tables and
-- checkpoint counts (§13).
create function public.implementation_register(p_engagement_id uuid default null)
returns table (
  element_id uuid, engagement_id uuid, reference_code text, title text, summary text,
  lifecycle public.element_lifecycle, client_visibility public.client_visibility,
  category text, implementation_status public.implementation_status,
  target_operational_on date, actual_operational_on date, owner_member_id uuid,
  attention public.intelligence_attention, triage_state public.triage_state, triaged_at timestamptz,
  next_review_on date, open_escalations public.escalation_level[],
  checkpoint_count int, achieved_checkpoint_count int, created_at timestamptz, updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.engagement_id, e.reference_code, e.title, e.summary, e.lifecycle, e.client_visibility,
    i.category, i.implementation_status, i.target_operational_on, i.actual_operational_on, i.owner_member_id,
    s.attention, s.triage_state, s.triaged_at, s.next_review_on,
    coalesce((select array_agg(x.level order by x.level) from public.implementation_escalations x
              where x.element_id = e.id and x.resolved_at is null), '{}'),
    (select count(*)::int from public.implementation_checkpoints c where c.implementation_element_id = e.id),
    (select count(*)::int from public.implementation_checkpoints c
     where c.implementation_element_id = e.id and c.achieved_on is not null),
    e.created_at, e.updated_at
  from public.architecture_elements e
  join public.implementation_initiatives i on i.element_id = e.id
  left join public.implementation_stewardship s on s.element_id = e.id
  where e.kind = 'implementation_initiative' and (p_engagement_id is null or e.engagement_id = p_engagement_id)
  order by e.engagement_id, e.reference_code;
$$;

-- Implementation's own signal function (D16): implementation_past_target
-- only, separate from intelligence_signals().
create function public.implementation_signals(
  p_engagement_id uuid,
  p_as_of date default null,
  p_include_dismissed boolean default false
)
returns table (
  rule_key text, element_id uuid, reference_code text, title text, fingerprint text, details jsonb,
  dismissed boolean, dismissal_reason text, dismissed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select coalesce(p_as_of, private.business_today()) as as_of
  ),
  live as (
    select e.id, e.reference_code, e.title, i.implementation_status, i.target_operational_on
    from public.architecture_elements e
    join public.implementation_initiatives i on i.element_id = e.id
    where e.engagement_id = p_engagement_id and e.lifecycle not in ('retired', 'superseded')
      and private.can_read_architecture(p_engagement_id)
  ),
  raw as (
    select 'implementation_past_target'::text as rule_key, l.id as element_id, l.reference_code, l.title,
      l.target_operational_on::text as fingerprint,
      jsonb_build_object('target_operational_on', l.target_operational_on, 'implementation_status', l.implementation_status) as details
    from live l cross join params p
    where l.implementation_status in ('not_started', 'in_progress', 'operational')
      and l.target_operational_on is not null and l.target_operational_on < p.as_of
  )
  select raw.rule_key, raw.element_id, raw.reference_code, raw.title, raw.fingerprint, raw.details,
    dm.id is not null, dm.reason, dm.dismissed_at
  from raw
  left join lateral (
    select d.id, d.reason, d.dismissed_at
    from public.implementation_signal_dismissals d
    cross join params p
    where d.engagement_id = p_engagement_id and d.rule_key = raw.rule_key and d.element_id = raw.element_id
      and d.fingerprint = raw.fingerprint and (d.expires_on is null or d.expires_on > p.as_of)
    order by d.dismissed_at desc limit 1
  ) dm on true
  where coalesce(p_include_dismissed, false) or dm.id is null
  order by raw.reference_code;
$$;

-- Client: published, client-visible rows of each kind (§13, view_architecture).
create function public.client_reviews(p_engagement_id uuid)
returns table (
  element_id uuid, reference_code text, title text, version_id uuid, review_type public.review_type,
  scheduled_for timestamptz, held_at timestamptz, review_status public.review_status, summary text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.reference_code, v.client_snapshot ->> 'title', v.id,
    (v.client_snapshot -> 'details' ->> 'review_type')::public.review_type,
    (v.client_snapshot -> 'details' ->> 'scheduled_for')::timestamptz,
    (v.client_snapshot -> 'details' ->> 'held_at')::timestamptz,
    (v.client_snapshot -> 'details' ->> 'review_status')::public.review_status,
    v.client_snapshot -> 'details' ->> 'summary',
    v.published_at
  from public.architecture_elements e
  join public.element_versions v on v.id = e.latest_version_id
  where e.engagement_id = p_engagement_id and e.kind = 'review'
    and (private.can_view_client_architecture(p_engagement_id) or private.can_read_architecture(p_engagement_id))
    and private.element_client_readable(e.id)
  order by e.reference_code;
$$;

-- view_confidential_deliverables gates a confidential row through
-- element_client_readable (§2.3 item 5); this function returns only what
-- the caller may already see.
create function public.client_deliverables(p_engagement_id uuid)
returns table (
  element_id uuid, reference_code text, title text, summary text, version_id uuid,
  deliverable_type public.deliverable_type, confidential boolean, published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.reference_code, v.client_snapshot ->> 'title', v.client_snapshot ->> 'summary', v.id,
    (v.client_snapshot -> 'details' ->> 'deliverable_type')::public.deliverable_type,
    (v.client_snapshot -> 'details' ->> 'confidential')::boolean,
    v.published_at
  from public.architecture_elements e
  join public.element_versions v on v.id = e.latest_version_id
  where e.engagement_id = p_engagement_id and e.kind = 'deliverable'
    and (private.can_view_client_architecture(p_engagement_id) or private.can_read_architecture(p_engagement_id))
    and private.element_client_readable(e.id)
  order by e.reference_code;
$$;

create function public.client_implementation(p_engagement_id uuid)
returns table (
  element_id uuid, reference_code text, title text, summary text, version_id uuid, category text,
  implementation_status public.implementation_status, target_operational_on date, actual_operational_on date,
  published_at timestamptz, checkpoints jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.reference_code, v.client_snapshot ->> 'title', v.client_snapshot ->> 'summary', v.id,
    v.client_snapshot -> 'details' ->> 'category',
    (v.client_snapshot -> 'details' ->> 'implementation_status')::public.implementation_status,
    (v.client_snapshot -> 'details' ->> 'target_operational_on')::date,
    (v.client_snapshot -> 'details' ->> 'actual_operational_on')::date,
    v.published_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'checkpoint_type', c.checkpoint_type, 'title', c.title,
               'target_on', c.target_on, 'achieved_on', c.achieved_on
             ) order by coalesce(c.achieved_on, c.target_on, current_date))
      from public.implementation_checkpoints c
      where c.implementation_element_id = e.id and c.client_visible
    ), '[]'::jsonb)
  from public.architecture_elements e
  join public.element_versions v on v.id = e.latest_version_id
  where e.engagement_id = p_engagement_id and e.kind = 'implementation_initiative'
    and (private.can_view_client_architecture(p_engagement_id) or private.can_read_architecture(p_engagement_id))
    and private.element_client_readable(e.id)
  order by e.reference_code;
$$;

-- What implements a given architecture element, and what that implementation,
-- in turn, touches (§13). depth 0 is p_element_id itself; depth 1 follows
-- implements incoming; later depths follow any non-lineage relationship.
create function public.implementation_impact(p_element_id uuid, p_depth int default 3)
returns table (
  element_id uuid, kind public.element_kind, reference_code text, title text, depth int,
  via_element_id uuid, relationship_type text, direction text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive walk (element_id, depth, via_element_id, relationship_type, direction, path) as (
    select p_element_id, 0, null::uuid, null::text, null::text, array[p_element_id]
    union all
    select nxt.element_id, w.depth + 1, w.element_id, nxt.relationship_type, nxt.direction, w.path || nxt.element_id
    from walk w
    cross join lateral (
      select r.source_element_id as element_id, r.relationship_type, 'incoming'::text as direction
      from public.architecture_relationships r
      where r.target_element_id = w.element_id and r.retired_at is null and r.relationship_type = 'implements'
        and w.depth = 0
      union all
      select r.target_element_id, r.relationship_type, 'outgoing'
      from public.architecture_relationships r
      join public.relationship_types t on t.key = r.relationship_type
      where r.source_element_id = w.element_id and r.retired_at is null and t.category <> 'lineage'
        and w.depth > 0
      union all
      select r.source_element_id, r.relationship_type, 'incoming'
      from public.architecture_relationships r
      join public.relationship_types t on t.key = r.relationship_type
      where r.target_element_id = w.element_id and r.retired_at is null and t.category <> 'lineage'
        and w.depth > 0
    ) nxt
    where w.depth < least(greatest(coalesce(p_depth, 3), 1), 5)
      and not nxt.element_id = any (w.path)
  )
  select distinct on (w.element_id) w.element_id, e.kind, e.reference_code, e.title, w.depth, w.via_element_id,
    w.relationship_type, w.direction
  from walk w
  join public.architecture_elements e on e.id = w.element_id
  where w.depth > 0 and e.lifecycle not in ('retired', 'superseded')
  order by w.element_id, w.depth;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.review_register(uuid)',
    'public.deliverable_register(uuid)',
    'public.implementation_register(uuid)',
    'public.implementation_signals(uuid, date, boolean)',
    'public.client_reviews(uuid)',
    'public.client_deliverables(uuid)',
    'public.client_implementation(uuid)',
    'public.implementation_impact(uuid, int)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
