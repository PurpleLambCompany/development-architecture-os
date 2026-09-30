-- =============================================================================
-- DSA OS — Phase 4: Project Intelligence
--
-- Builds the Project Intelligence experience on the Phase 3 Architecture
-- Core without redesigning it: Opportunity as a seventh record kind,
-- controlled categories, internal stewardship (triage), append-only status
-- history, resolution and escalation, client actions and contributions,
-- per-area participation for Client Contributors, deterministic
-- intelligence signals and engagement files in private storage.
-- Specification: docs/product/PHASE_4_PROPOSAL.md (approved 2026-09-30).
-- Decisions: ADR-0026 to ADR-0033.
--
-- Rules that hold throughout (in addition to Phase 3's):
--   * No Phase 4 table holds architecture content. Everything attaches to
--     Phase 3 elements, and clients still read only published snapshots.
--   * Every Phase 4 table except opportunities is written only through the
--     operations in section 12 (SECURITY DEFINER, no direct write grants).
--     Errors: 42501 permission, 23514 rule, P0002 not found or not visible.
--   * Permission checks use engagement capabilities, never role names.
--   * No table here references a finance table (ADR-0023).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Capabilities (ADR-0031)
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
      'manage_financials', 'edit_architecture', 'publish_architecture', 'manage_client_requests'
    ) then 'internal'::public.member_side
    else null
  end;
$$;

insert into public.role_capability_defaults (role, capability) values
  ('principal_architect',   'manage_client_requests'),
  ('architect',             'manage_client_requests'),
  ('researcher',            'manage_client_requests'),
  ('project_administrator', 'manage_client_requests'),
  ('executive_sponsor',     'view_full_architecture'),
  ('client_project_lead',   'view_full_architecture'),
  ('client_viewer',         'view_full_architecture'),
  ('executive_sponsor',     'respond_to_client_actions'),
  ('client_project_lead',   'respond_to_client_actions'),
  ('client_contributor',    'respond_to_client_actions'),
  ('executive_sponsor',     'assign_client_actions'),
  ('client_project_lead',   'assign_client_actions'),
  ('executive_sponsor',     'submit_client_input'),
  ('client_project_lead',   'submit_client_input'),
  ('client_contributor',    'submit_client_input');
  -- Client Finance holds none of them; Client Contributors do not hold
  -- view_full_architecture and see only their assigned areas (ADR-0030).

-- -----------------------------------------------------------------------------
-- 2. Enums and the OPP prefix
-- -----------------------------------------------------------------------------
create type public.opportunity_status as enum (
  'identified', 'evaluating', 'pursuing', 'realized', 'declined', 'lapsed'
);
create type public.intelligence_attention as enum ('critical', 'high', 'routine', 'watch');
create type public.triage_state as enum ('untriaged', 'triaged');
create type public.escalation_level as enum ('principal_architect', 'client_executive');
create type public.client_action_kind as enum (
  'question', 'information_request', 'confirmation', 'review_request', 'executive_attention'
);
create type public.client_action_status as enum ('open', 'responded', 'closed', 'withdrawn');
create type public.contribution_status as enum ('received', 'incorporated', 'acknowledged');
create type public.engagement_file_purpose as enum ('client_response', 'client_contribution', 'evidence');

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
  end;
$$;

-- Resolution vocabulary per record kind (ADR-0028). Decisions and
-- recommendations are settled through their Phase 3 operations.
create function public.intelligence_terminal_statuses(p_kind public.element_kind)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_kind
    when 'assumption' then array['validated', 'invalidated']
    when 'risk' then array['closed', 'accepted', 'materialized']
    when 'constraint' then array['relaxed', 'lifted']
    when 'dependency' then array['satisfied', 'broken']
    when 'opportunity' then array['realized', 'declined', 'lapsed']
    else array[]::text[]
  end;
$$;

create function public.intelligence_active_statuses(p_kind public.element_kind)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_kind
    when 'assumption' then array['unvalidated', 'validating']
    when 'risk' then array['open', 'mitigating']
    when 'constraint' then array['in_force']
    when 'dependency' then array['open', 'at_risk']
    when 'opportunity' then array['identified', 'evaluating', 'pursuing']
    else array[]::text[]
  end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Relationship vocabulary: advances and pursues (ADR-0026)
-- -----------------------------------------------------------------------------
insert into public.relationship_types (key, category, label, inverse_label, is_symmetric, is_acyclic, definition, sort_order) values
  ('advances', 'intelligence', 'advances', 'is advanced by', false, false,
   'If the opportunity is realized, the target is materially advanced. The mirror of threatens.', 30),
  ('pursues', 'intelligence', 'pursues', 'is pursued by', false, false,
   'The source acts to realize the opportunity. The mirror of mitigates.', 31);
update public.relationship_types set sort_order = 32 where key = 'supersedes';
update public.relationship_types set sort_order = 33 where key = 'conflicts_with';

-- The Phase 3 pairing rules, regenerated with Opportunity as a record kind
-- (existing rows are kept; on conflict do nothing), plus the new pairings.
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
  from unnest(array['assumption', 'risk', 'constraint', 'dependency', 'decision', 'recommendation', 'opportunity']) k
  where t in ('@record', '@element') or k = t;
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

-- Phase 3 rules whose tokens include every record kind.
select pg_temp.add_rules('informs', array['@knowledge'], array['@strategic_model', '@capability', '@application', '@record']);
select pg_temp.add_rules('subject_to', array['@core', '-regulatory_factor', '@record'], array['regulatory_factor']);
select pg_temp.add_rules('has_stake_in', array['stakeholder'], array['@element', '-stakeholder']);
select pg_temp.add_rules('threatens', array['risk'], array['@element', '-risk']);
select pg_temp.add_rules('affects', array['@record'], array['@element']);
select pg_temp.add_rules('addresses', array['recommendation'], array['@element', '-recommendation']);
select pg_temp.add_rules('conflicts_with', array['@element'], array['@element']);
-- Extended to opportunities.
select pg_temp.add_rules('underpins', array['assumption'], array['opportunity']);
select pg_temp.add_rules('constrains', array['constraint'], array['opportunity']);
-- New.
select pg_temp.add_rules('advances', array['opportunity'], array['@element', '-risk', '-opportunity']);
select pg_temp.add_rules('pursues', array['@capability', '@application', 'decision', 'recommendation'], array['opportunity']);
insert into public.relationship_rules (relationship_type, source_kind, source_object_type, target_kind, target_object_type)
values ('supersedes', 'opportunity', null, 'opportunity', null)
on conflict do nothing;

drop function pg_temp.add_rules(text, text[], text[]);
drop function pg_temp.expand_tokens(text[]);
drop function pg_temp.token_items(text);

-- -----------------------------------------------------------------------------
-- 4. Controlled categories (ADR-0027)
-- -----------------------------------------------------------------------------
create table public.intelligence_categories (
  record_kind  public.element_kind not null check (record_kind in ('assumption', 'risk', 'decision', 'recommendation', 'opportunity')),
  key          text not null check (key ~ '^[a-z][a-z_]*$'),
  label        text not null,
  definition   text not null,
  sort_order   int not null,
  primary key (record_kind, key)
);

insert into public.intelligence_categories (record_kind, key, label, definition, sort_order) values
  ('assumption', 'market', 'Market', 'Demand, pricing, competition or the behavior of the market.', 1),
  ('assumption', 'stakeholder', 'Stakeholder', 'The commitment, support or behavior of a stakeholder.', 2),
  ('assumption', 'financial', 'Financial', 'Capital, funding, costs or revenue.', 3),
  ('assumption', 'capability', 'Capability', 'Whether the organization has, or can build, a capability.', 4),
  ('assumption', 'regulatory', 'Regulatory', 'What law, regulation or policy will allow or require.', 5),
  ('assumption', 'operational', 'Operational', 'How the development will operate day to day.', 6),
  ('assumption', 'timing', 'Timing', 'When something will happen or become available.', 7),
  ('assumption', 'other', 'Other', 'Anything the categories above do not describe.', 99),
  ('risk', 'strategic', 'Strategic', 'The strategy itself proves wrong or is overtaken.', 1),
  ('risk', 'financial', 'Financial', 'Capital, funding, costs or revenue fall short.', 2),
  ('risk', 'capability', 'Capability', 'A required capability, role or skill is missing or lost.', 3),
  ('risk', 'governance', 'Governance', 'Authority, decision rights or oversight fail.', 4),
  ('risk', 'stakeholder', 'Stakeholder', 'A stakeholder withdraws, resists or changes position.', 5),
  ('risk', 'regulatory', 'Regulatory', 'Law, regulation or policy changes or is not met.', 6),
  ('risk', 'delivery', 'Delivery', 'The development cannot be put into operation as designed.', 7),
  ('risk', 'reputational', 'Reputational', 'Standing with the public, partners or funders is damaged.', 8),
  ('risk', 'external', 'External', 'Events outside the development''s influence.', 9),
  ('risk', 'other', 'Other', 'Anything the categories above do not describe.', 99),
  ('decision', 'structural', 'Structural', 'The form or structure of the development.', 1),
  ('decision', 'governance', 'Governance', 'Authority, decision rights or oversight.', 2),
  ('decision', 'investment', 'Investment', 'Where capital or resources are committed.', 3),
  ('decision', 'partnership', 'Partnership', 'Who the development works with, and on what terms.', 4),
  ('decision', 'sequencing', 'Sequencing', 'The order in which things happen.', 5),
  ('decision', 'other', 'Other', 'Anything the categories above do not describe.', 99),
  ('recommendation', 'structural', 'Structural', 'The form or structure of the development.', 1),
  ('recommendation', 'capability', 'Capability', 'Capabilities, roles and skills.', 2),
  ('recommendation', 'governance', 'Governance', 'Authority, decision rights or oversight.', 3),
  ('recommendation', 'strategic', 'Strategic', 'The strategic model and its logic.', 4),
  ('recommendation', 'operational', 'Operational', 'How the development operates.', 5),
  ('recommendation', 'other', 'Other', 'Anything the categories above do not describe.', 99),
  ('opportunity', 'partnership', 'Partnership', 'A partner or alliance that becomes available.', 1),
  ('opportunity', 'funding', 'Funding', 'Capital, grants or financing that becomes available.', 2),
  ('opportunity', 'market', 'Market', 'Demand or a market position that opens up.', 3),
  ('opportunity', 'land_and_asset', 'Land and asset', 'Sites, buildings or other assets that become available.', 4),
  ('opportunity', 'talent', 'Talent', 'People or expertise that become available.', 5),
  ('opportunity', 'policy', 'Policy', 'A change in policy or regulation that opens a path.', 6),
  ('opportunity', 'other', 'Other', 'Anything the categories above do not describe.', 99);

-- Existing free-text categories are mapped to keys (by key or label, case
-- insensitive), everything else to other. Runs as an operation so retired
-- records can be updated too.
select private.begin_architecture_operation();

update public.assumptions a
set category = coalesce((
  select c.key from public.intelligence_categories c
  where c.record_kind = 'assumption'
    and (c.key = lower(btrim(a.category)) or lower(c.label) = lower(btrim(a.category)))
), 'other');

update public.risks r
set category = coalesce((
  select c.key from public.intelligence_categories c
  where c.record_kind = 'risk'
    and (c.key = lower(btrim(r.category)) or lower(c.label) = lower(btrim(r.category)))
), 'other');

select private.end_architecture_operation();

alter table public.assumptions
  alter column category set default 'other',
  add constraint assumptions_category_fk foreign key (kind, category)
    references public.intelligence_categories (record_kind, key);
alter table public.risks
  alter column category set default 'other',
  add constraint risks_category_fk foreign key (kind, category)
    references public.intelligence_categories (record_kind, key);
alter table public.decisions
  add column category text not null default 'other',
  add constraint decisions_category_fk foreign key (kind, category)
    references public.intelligence_categories (record_kind, key);
alter table public.recommendations
  add column category text not null default 'other',
  add constraint recommendations_category_fk foreign key (kind, category)
    references public.intelligence_categories (record_kind, key);

-- -----------------------------------------------------------------------------
-- 5. Tables
-- -----------------------------------------------------------------------------

-- Opportunity: the seventh Project Intelligence record (ADR-0026).
create table public.opportunities (
  element_id          uuid primary key,
  engagement_id       uuid not null,
  kind                public.element_kind not null default 'opportunity' check (kind = 'opportunity'),
  category            text not null default 'other',
  value               smallint not null default 3 check (value between 1 and 5),
  feasibility         smallint not null default 3 check (feasibility between 1 and 5),
  attractiveness      smallint generated always as (value * feasibility) stored,
  window_opens_on     date,
  window_closes_on    date,
  pursuit_approach    text not null default '' check (char_length(pursuit_approach) <= 2000),
  opportunity_status  public.opportunity_status not null default 'identified',
  constraint opportunities_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade,
  constraint opportunities_category_fk foreign key (kind, category)
    references public.intelligence_categories (record_kind, key),
  constraint opportunities_window check (
    window_opens_on is null or window_closes_on is null or window_closes_on >= window_opens_on
  )
);

-- Stewardship: internal, unversioned triage of each record (ADR-0027).
create table public.intelligence_stewardship (
  element_id      uuid primary key,
  engagement_id   uuid not null,
  kind            public.element_kind not null check (kind <> 'object'),
  attention       public.intelligence_attention not null default 'routine',
  triage_state    public.triage_state not null default 'untriaged',
  triaged_by      uuid references public.profiles (id) on delete set null,
  triaged_at      timestamptz,
  triage_note     text not null default '' check (char_length(triage_note) <= 2000),
  next_review_on  date,
  updated_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default clock_timestamp(),
  constraint intelligence_stewardship_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade,
  constraint intelligence_stewardship_triaged check (triage_state = 'untriaged' or triaged_at is not null)
);
create index intelligence_stewardship_engagement_idx on public.intelligence_stewardship (engagement_id);

-- Status history: append-only, written by triggers (ADR-0028).
create table public.intelligence_status_changes (
  id             bigint generated always as identity primary key,
  engagement_id  uuid not null,
  element_id     uuid not null,
  kind           public.element_kind not null,
  field          text not null,
  from_value     text,
  to_value       text,
  operation      text not null default 'edit',
  rationale      text check (char_length(rationale) <= 2000),
  changed_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  changed_at     timestamptz not null default clock_timestamp(),
  constraint intelligence_status_changes_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete cascade
);
create index intelligence_status_changes_element_idx on public.intelligence_status_changes (element_id, changed_at);
create index intelligence_status_changes_engagement_idx on public.intelligence_status_changes (engagement_id, changed_at);

-- Client actions are addressed to engagement members of the same engagement.
alter table public.engagement_members
  add constraint engagement_members_engagement_key unique (id, engagement_id);

-- Client actions (ADR-0029). The addressee's user id is kept for the record
-- if the membership is later removed.
create table public.client_actions (
  id                      uuid primary key default gen_random_uuid(),
  engagement_id           uuid not null references public.engagements (id) on delete restrict,
  reference_code          text not null check (reference_code ~ '^ACT-[0-9]{3,}$'),
  kind                    public.client_action_kind not null,
  title                   text not null check (char_length(btrim(title)) between 1 and 200),
  request                 text not null check (char_length(btrim(request)) between 1 and 4000),
  addressed_to_member_id  uuid,
  addressed_to_user_id    uuid not null references public.profiles (id) on delete restrict,
  due_on                  date,
  status                  public.client_action_status not null default 'open',
  sent_by                 uuid references public.profiles (id) on delete set null,
  sent_at                 timestamptz not null default clock_timestamp(),
  closed_by               uuid references public.profiles (id) on delete set null,
  closed_at               timestamptz,
  close_note              text check (char_length(close_note) <= 2000),
  updated_at              timestamptz not null default clock_timestamp(),
  constraint client_actions_engagement_key unique (id, engagement_id),
  constraint client_actions_code_unique unique (engagement_id, reference_code),
  constraint client_actions_member_fk foreign key (addressed_to_member_id, engagement_id)
    references public.engagement_members (id, engagement_id) on delete set null (addressed_to_member_id),
  constraint client_actions_closed check ((status in ('closed', 'withdrawn')) = (closed_at is not null))
);
create index client_actions_engagement_idx on public.client_actions (engagement_id, status);
create index client_actions_member_idx on public.client_actions (addressed_to_member_id);

create table public.client_action_subjects (
  action_id      uuid not null,
  engagement_id  uuid not null,
  element_id     uuid not null,
  primary key (action_id, element_id),
  constraint client_action_subjects_action_fk foreign key (action_id, engagement_id)
    references public.client_actions (id, engagement_id) on delete cascade,
  constraint client_action_subjects_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict
);
create index client_action_subjects_element_idx on public.client_action_subjects (element_id);

create table public.client_action_responses (
  id                        uuid primary key default gen_random_uuid(),
  engagement_id             uuid not null,
  action_id                 uuid not null,
  responded_by              uuid not null references public.profiles (id) on delete restrict,
  body                      text not null check (char_length(btrim(body)) between 1 and 4000),
  link_url                  text check (link_url ~ '^https://[^\s]+$' and char_length(link_url) <= 2000),
  responded_at              timestamptz not null default clock_timestamp(),
  evidence_source_id        uuid,
  recorded_as_evidence_by   uuid references public.profiles (id) on delete set null,
  recorded_as_evidence_at   timestamptz,
  constraint client_action_responses_engagement_key unique (id, engagement_id),
  constraint client_action_responses_action_fk foreign key (action_id, engagement_id)
    references public.client_actions (id, engagement_id) on delete cascade,
  constraint client_action_responses_evidence_fk foreign key (evidence_source_id, engagement_id)
    references public.evidence_sources (id, engagement_id) on delete restrict,
  constraint client_action_responses_recorded check ((evidence_source_id is null) = (recorded_as_evidence_at is null))
);
create index client_action_responses_action_idx on public.client_action_responses (action_id, responded_at);

create table public.client_action_events (
  id              bigint generated always as identity primary key,
  engagement_id   uuid not null,
  action_id       uuid not null,
  event           text not null check (event in ('sent', 'responded', 'returned', 'closed', 'withdrawn', 'reassigned')),
  note            text check (char_length(note) <= 2000),
  actor_user_id   uuid references public.profiles (id) on delete set null default auth.uid(),
  from_user_id    uuid references public.profiles (id) on delete set null,
  to_user_id      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default clock_timestamp(),
  constraint client_action_events_action_fk foreign key (action_id, engagement_id)
    references public.client_actions (id, engagement_id) on delete cascade
);
create index client_action_events_action_idx on public.client_action_events (action_id, created_at);

-- Escalations (ADR-0028). One open escalation per record and level.
create table public.intelligence_escalations (
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
  constraint intelligence_escalations_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete cascade,
  constraint intelligence_escalations_action_fk foreign key (client_action_id, engagement_id)
    references public.client_actions (id, engagement_id) on delete restrict,
  constraint intelligence_escalations_client_action check ((level = 'client_executive') = (client_action_id is not null)),
  constraint intelligence_escalations_resolved check ((resolved_at is null) = (resolution_note is null))
);
create unique index intelligence_escalations_one_open on public.intelligence_escalations (element_id, level)
  where resolved_at is null;
create index intelligence_escalations_engagement_idx on public.intelligence_escalations (engagement_id);

-- Client contributions (ADR-0029).
create table public.client_contributions (
  id                  uuid primary key default gen_random_uuid(),
  engagement_id       uuid not null,
  element_id          uuid not null,
  element_version_id  uuid not null,
  submitted_by        uuid not null references public.profiles (id) on delete restrict,
  body                text not null check (char_length(btrim(body)) between 1 and 4000),
  link_url            text check (link_url ~ '^https://[^\s]+$' and char_length(link_url) <= 2000),
  submitted_at        timestamptz not null default clock_timestamp(),
  status              public.contribution_status not null default 'received',
  handled_by          uuid references public.profiles (id) on delete set null,
  handled_at          timestamptz,
  handling_note       text check (char_length(handling_note) <= 2000),
  evidence_source_id  uuid,
  constraint client_contributions_engagement_key unique (id, engagement_id),
  constraint client_contributions_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint client_contributions_version_fk foreign key (element_version_id, element_id)
    references public.element_versions (id, element_id) on delete restrict,
  constraint client_contributions_evidence_fk foreign key (evidence_source_id, engagement_id)
    references public.evidence_sources (id, engagement_id) on delete restrict,
  constraint client_contributions_handled check ((status = 'received') = (handled_at is null))
);
create index client_contributions_engagement_idx on public.client_contributions (engagement_id, status);
create index client_contributions_element_idx on public.client_contributions (element_id);

-- Contributor areas (ADR-0030): a domain, or an element and its part_of
-- descendants.
create table public.engagement_member_areas (
  id                    uuid primary key default gen_random_uuid(),
  engagement_id         uuid not null,
  engagement_member_id  uuid not null,
  domain                public.architecture_domain,
  element_id            uuid,
  assigned_by           uuid references public.profiles (id) on delete set null,
  assigned_at           timestamptz not null default clock_timestamp(),
  constraint engagement_member_areas_member_fk foreign key (engagement_member_id, engagement_id)
    references public.engagement_members (id, engagement_id) on delete cascade,
  constraint engagement_member_areas_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete cascade,
  constraint engagement_member_areas_one check (num_nonnulls(domain, element_id) = 1),
  constraint engagement_member_areas_unique unique nulls not distinct (engagement_member_id, domain, element_id)
);
create index engagement_member_areas_member_idx on public.engagement_member_areas (engagement_member_id);

-- Signal dismissals (ADR-0032). The fingerprint is the state of the facts
-- that fired the signal; a changed fingerprint brings the signal back.
create table public.intelligence_signal_dismissals (
  id                uuid primary key default gen_random_uuid(),
  engagement_id     uuid not null references public.engagements (id) on delete restrict,
  rule_key          text not null check (rule_key ~ '^[a-z][a-z_]*$'),
  element_id        uuid,
  client_action_id  uuid,
  fingerprint       text not null check (char_length(fingerprint) <= 1000),
  reason            text not null check (char_length(btrim(reason)) between 1 and 1000),
  expires_on        date,
  dismissed_by      uuid references public.profiles (id) on delete set null,
  dismissed_at      timestamptz not null default clock_timestamp(),
  constraint intelligence_signal_dismissals_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete cascade,
  constraint intelligence_signal_dismissals_action_fk foreign key (client_action_id, engagement_id)
    references public.client_actions (id, engagement_id) on delete cascade,
  constraint intelligence_signal_dismissals_subject check (num_nonnulls(element_id, client_action_id) = 1)
);
create index intelligence_signal_dismissals_engagement_idx on public.intelligence_signal_dismissals (engagement_id, rule_key);

-- Engagement files (ADR-0033): one row per object in the engagement-files
-- bucket, registered before upload and attached by an operation.
create table public.engagement_files (
  id                         uuid primary key default gen_random_uuid(),
  engagement_id              uuid not null references public.engagements (id) on delete restrict,
  object_path                text not null unique,
  filename                   text not null check (char_length(btrim(filename)) between 1 and 255),
  content_type               text not null check (content_type in (
    'application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )),
  size_bytes                 bigint not null check (size_bytes between 1 and 26214400),
  purpose                    public.engagement_file_purpose not null,
  uploaded_by                uuid not null references public.profiles (id) on delete restrict,
  created_at                 timestamptz not null default clock_timestamp(),
  client_action_response_id  uuid,
  client_contribution_id     uuid,
  evidence_source_id         uuid,
  constraint engagement_files_engagement_key unique (id, engagement_id),
  constraint engagement_files_response_fk foreign key (client_action_response_id, engagement_id)
    references public.client_action_responses (id, engagement_id) on delete restrict,
  constraint engagement_files_contribution_fk foreign key (client_contribution_id, engagement_id)
    references public.client_contributions (id, engagement_id) on delete restrict,
  constraint engagement_files_evidence_fk foreign key (evidence_source_id, engagement_id)
    references public.evidence_sources (id, engagement_id) on delete restrict,
  constraint engagement_files_path check (object_path = engagement_id::text || '/' || id::text || '/' || filename),
  constraint engagement_files_response_purpose check (client_action_response_id is null or purpose = 'client_response'),
  constraint engagement_files_contribution_purpose check (client_contribution_id is null or purpose = 'client_contribution')
);
create index engagement_files_engagement_idx on public.engagement_files (engagement_id);
create index engagement_files_response_idx on public.engagement_files (client_action_response_id);
create index engagement_files_contribution_idx on public.engagement_files (client_contribution_id);
create index engagement_files_evidence_idx on public.engagement_files (evidence_source_id);

-- -----------------------------------------------------------------------------
-- 6. Visibility helpers
-- -----------------------------------------------------------------------------

-- Published and client-visible, whoever is asking (for operations that
-- validate what may be sent to a client).
create function private.element_published_for_client(target_element_id uuid)
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
  );
$$;

-- An engagement member who is an active client: an active membership, an
-- active profile and an active membership of the engagement's own client
-- organization.
create function private.member_is_active_client(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.engagement_members em
    join public.engagements e on e.id = em.engagement_id
    join public.organization_members om on om.organization_id = e.client_organization_id and om.user_id = em.user_id
    join public.organizations o on o.id = om.organization_id
    join public.profiles p on p.id = em.user_id
    where em.id = target_member_id
      and em.side = 'client'
      and em.status = 'active'
      and om.status = 'active'
      and o.status = 'active'
      and p.status = 'active'
  );
$$;

-- Is the element inside the member's assigned areas? (ADR-0030)
--   * An object: its domain is assigned, or it or an ancestor (following
--     published, active part_of relationships) is assigned.
--   * A record: it is assigned directly; or, unless it is engagement-wide,
--     one of its domains is assigned, or an object it concerns (through a
--     Project Intelligence relationship or a dependency's ends) is inside.
create function private.element_in_member_areas(target_member_id uuid, target_element_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive
  target as (
    select e.id, e.kind, e.engagement_wide
    from public.architecture_elements e
    where e.id = target_element_id
  ),
  areas as (
    select a.domain, a.element_id
    from public.engagement_member_areas a
    where a.engagement_member_id = target_member_id
  ),
  concerned as (
    select t.id as element_id from target t where t.kind = 'object'
    union
    select case when r.source_element_id = t.id then r.target_element_id else r.source_element_id end
    from target t
    join public.architecture_relationships r on r.source_element_id = t.id or r.target_element_id = t.id
    where t.kind <> 'object' and not t.engagement_wide
      and r.retired_at is null and r.published_at is not null
      and r.relationship_type in ('underpins', 'threatens', 'constrains', 'mitigates', 'affects', 'addresses',
                                  'advances', 'pursues')
    union
    select v.x
    from target t
    join public.dependencies d on d.element_id = t.id
    cross join lateral (values (d.from_element_id), (d.to_element_id)) v(x)
    where not t.engagement_wide
  ),
  concerned_objects as (
    select c.element_id, o.domain
    from concerned c
    join public.architecture_objects o on o.element_id = c.element_id
  ),
  ancestry (element_id) as (
    select element_id from concerned_objects
    union
    select r.target_element_id
    from ancestry an
    join public.architecture_relationships r on r.source_element_id = an.element_id
    where r.relationship_type = 'part_of' and r.retired_at is null and r.published_at is not null
  )
  select exists (select 1 from areas a join target t on a.element_id = t.id)
      or exists (select 1 from areas a join concerned_objects c on a.domain = c.domain)
      or exists (select 1 from areas a join ancestry an on a.element_id = an.element_id)
      or exists (
        select 1 from target t
        join public.intelligence_record_domains d on d.element_id = t.id
        join areas a on a.domain = d.domain
        where not t.engagement_wide
      );
$$;

-- The caller's own client membership of the element's engagement has it in
-- its areas.
create function private.element_in_my_areas(target_element_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.architecture_elements e
    join public.engagement_members em on em.engagement_id = e.engagement_id
    where e.id = target_element_id
      and em.user_id = auth.uid()
      and em.side = 'client'
      and em.status = 'active'
      and private.element_in_member_areas(em.id, e.id)
  );
$$;

-- A published version of this element may be shown to the caller as a
-- client: published, client-visible and not retired, and either the caller
-- is an internal reader, holds view_full_architecture, or has the element
-- in their areas. Every client policy and client read model goes through
-- this helper (Phase 3), so area scoping applies everywhere at once.
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
  );
$$;

-- Is the caller the addressee of the action (through their own membership)?
create function private.is_my_membership(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.engagement_members em
    where em.id = target_member_id and em.user_id = auth.uid() and em.status = 'active'
  );
$$;

-- Who sees a client action: internal readers of the engagement; clients
-- holding assign_client_actions; and the addressee while they hold the
-- capability their request needs.
create function private.can_see_client_action(target_action_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.client_actions a
    where a.id = target_action_id
      and (
        private.can_read_architecture(a.engagement_id)
        or private.has_engagement_capability(a.engagement_id, 'assign_client_actions')
        or (
          private.is_my_membership(a.addressed_to_member_id)
          and private.has_engagement_capability(
            a.engagement_id,
            case when a.kind = 'executive_attention' then 'approve_architecture'::public.engagement_capability
                 else 'respond_to_client_actions' end
          )
        )
      )
  );
$$;

-- Who sees a contribution: internal readers; the member who submitted it
-- (while a client member of the engagement); clients holding
-- assign_client_actions.
create function private.can_see_client_contribution(target_contribution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.client_contributions c
    where c.id = target_contribution_id
      and (
        private.can_read_architecture(c.engagement_id)
        or private.has_engagement_capability(c.engagement_id, 'assign_client_actions')
        or (c.submitted_by = auth.uid() and private.is_engagement_client_member(c.engagement_id))
      )
  );
$$;

-- Engagement files: internal readers; the uploader; clients who can see the
-- response or contribution a file is attached to. Evidence files are
-- internal (clients see evidence only in published snapshots).
create function private.can_read_engagement_file(target_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.engagement_files f
    where f.object_path = target_object_path
      and (
        private.can_read_architecture(f.engagement_id)
        or (f.uploaded_by = auth.uid() and private.is_engagement_client_member(f.engagement_id))
        or (
          f.client_action_response_id is not null
          and private.can_see_client_action(
            (select r.action_id from public.client_action_responses r where r.id = f.client_action_response_id)
          )
        )
        or (f.client_contribution_id is not null and private.can_see_client_contribution(f.client_contribution_id))
      )
  );
$$;

create function private.can_upload_engagement_file(target_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.engagement_files f
    where f.object_path = target_object_path
      and f.uploaded_by = auth.uid()
      and f.client_action_response_id is null
      and f.client_contribution_id is null
  );
$$;

revoke all on function private.element_published_for_client(uuid) from public, anon, authenticated;
revoke all on function private.member_is_active_client(uuid) from public, anon, authenticated;
revoke all on function private.element_in_member_areas(uuid, uuid) from public, anon, authenticated;
revoke all on function private.element_in_my_areas(uuid) from public, anon, authenticated;
revoke all on function private.is_my_membership(uuid) from public, anon;
revoke all on function private.can_see_client_action(uuid) from public, anon;
revoke all on function private.can_see_client_contribution(uuid) from public, anon;
revoke all on function private.can_read_engagement_file(text) from public, anon;
revoke all on function private.can_upload_engagement_file(text) from public, anon;
grant execute on function private.is_my_membership(uuid) to authenticated;
grant execute on function private.can_see_client_action(uuid) to authenticated;
grant execute on function private.can_see_client_contribution(uuid) to authenticated;
grant execute on function private.can_read_engagement_file(text) to authenticated;
grant execute on function private.can_upload_engagement_file(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Phase 3 functions that learn the Opportunity kind and categories
-- -----------------------------------------------------------------------------
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

create or replace function private.assert_record_scope(e public.architecture_elements)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if e.kind = 'object' or e.engagement_wide or e.kind = 'dependency' then
    return;
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

-- Decisions: category joins the fields editors may change directly.
create or replace function private.guard_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.in_architecture_operation() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.decision_status := 'open';
    new.recommended_option_id := null;
    new.recommendation_rationale := null;
    new.recommended_by := null;
    new.recommended_at := null;
    new.chosen_option_id := null;
    new.decision_note := null;
    new.outcome_provenance := null;
    new.decision_source := null;
    new.decided_by := null;
    new.decided_at := null;
    new.external_decider_name := null;
    new.external_decided_on := null;
    new.external_decision_method := null;
    new.external_evidence := null;
    new.recorded_by := null;
    new.recorded_at := null;
    new.deferred_reason := null;
    perform private.assert_engagement_member(new.engagement_id, new.decision_owner_user_id);
    return new;
  end if;
  if old.decision_status in ('decided', 'superseded') then
    raise exception 'A decided decision is frozen; record a new decision that supersedes it' using errcode = '23514';
  end if;
  if (to_jsonb(new) - array['context', 'decision_owner_user_id', 'needed_by', 'downstream_impact', 'category'])
     is distinct from (to_jsonb(old) - array['context', 'decision_owner_user_id', 'needed_by', 'downstream_impact', 'category']) then
    raise exception 'Recommendations, outcomes and decision status change only through decision operations'
      using errcode = '42501';
  end if;
  if new.decision_owner_user_id is distinct from old.decision_owner_user_id then
    perform private.assert_engagement_member(new.engagement_id, new.decision_owner_user_id);
  end if;
  return new;
end;
$$;

-- Creation in one transaction learns opportunities and the new categories.
create or replace function public.create_architecture_element(
  p_engagement_id uuid,
  p_kind public.element_kind,
  p_element jsonb,
  p_details jsonb default '{}'::jsonb,
  p_domains public.architecture_domain[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  e public.architecture_elements;
  d jsonb := coalesce(p_details, '{}'::jsonb) || jsonb_build_object('element_id', new_id);
begin
  e := jsonb_populate_record(null::public.architecture_elements, coalesce(p_element, '{}'::jsonb));

  insert into public.architecture_elements (
    id, engagement_id, kind, title, summary, client_visibility, provenance, source_reference,
    ip_classification, engagement_wide, owner_user_id
  ) values (
    new_id, p_engagement_id, p_kind, e.title, coalesce(e.summary, ''),
    coalesce(e.client_visibility, 'internal'), coalesce(e.provenance, 'architect_judgment'),
    coalesce(e.source_reference, ''), coalesce(e.ip_classification, 'project_work_product'),
    coalesce(e.engagement_wide, false), e.owner_user_id
  );

  case p_kind
    when 'object' then
      insert into public.architecture_objects (element_id, object_type, maturity, maturity_rationale, attributes)
      select r.element_id, r.object_type, coalesce(r.maturity, 'undefined'), coalesce(r.maturity_rationale, ''),
             coalesce(d -> 'attributes', '{"schema_version": 1}'::jsonb)
      from jsonb_populate_record(null::public.architecture_objects, d) r;
    when 'assumption' then
      insert into public.assumptions (element_id, category, confidence, validation_status, impact_if_false, validation_note)
      select r.element_id, coalesce(nullif(r.category, ''), 'other'), coalesce(r.confidence, 'medium'),
             coalesce(r.validation_status, 'unvalidated'), coalesce(r.impact_if_false, ''), coalesce(r.validation_note, '')
      from jsonb_populate_record(null::public.assumptions, d) r;
    when 'risk' then
      insert into public.risks (element_id, category, probability, impact, mitigation, risk_status)
      select r.element_id, coalesce(nullif(r.category, ''), 'other'), coalesce(r.probability, 3), coalesce(r.impact, 3),
             coalesce(r.mitigation, ''), coalesce(r.risk_status, 'open')
      from jsonb_populate_record(null::public.risks, d - 'severity') r;
    when 'constraint' then
      insert into public.constraints (element_id, category, source, negotiable, constraint_status)
      select r.element_id, coalesce(r.category, 'other'), coalesce(r.source, ''), coalesce(r.negotiable, false),
             coalesce(r.constraint_status, 'in_force')
      from jsonb_populate_record(null::public.constraints, d) r;
    when 'dependency' then
      insert into public.dependencies (element_id, from_element_id, to_element_id, dependency_type, blocking, dependency_status)
      select r.element_id, r.from_element_id, r.to_element_id, coalesce(r.dependency_type, 'prerequisite'),
             coalesce(r.blocking, false), coalesce(r.dependency_status, 'open')
      from jsonb_populate_record(null::public.dependencies, d) r;
    when 'decision' then
      insert into public.decisions (element_id, category, context, decision_owner_user_id, needed_by, downstream_impact)
      select r.element_id, coalesce(nullif(r.category, ''), 'other'), coalesce(r.context, ''), r.decision_owner_user_id,
             r.needed_by, coalesce(r.downstream_impact, '')
      from jsonb_populate_record(null::public.decisions, d) r;
    when 'recommendation' then
      insert into public.recommendations (element_id, category, rationale, priority)
      select r.element_id, coalesce(nullif(r.category, ''), 'other'), coalesce(r.rationale, ''), coalesce(r.priority, 'important')
      from jsonb_populate_record(null::public.recommendations, d) r;
    when 'opportunity' then
      insert into public.opportunities (element_id, category, value, feasibility, window_opens_on, window_closes_on,
                                        pursuit_approach, opportunity_status)
      select r.element_id, coalesce(nullif(r.category, ''), 'other'), coalesce(r.value, 3), coalesce(r.feasibility, 3),
             r.window_opens_on, r.window_closes_on, coalesce(r.pursuit_approach, ''),
             coalesce(r.opportunity_status, 'identified')
      from jsonb_populate_record(null::public.opportunities, d - 'attractiveness') r;
  end case;

  if p_kind <> 'object' then
    insert into public.intelligence_record_domains (element_id, domain)
    select new_id, x from (select distinct unnest(coalesce(p_domains, '{}')) as x) s;
  elsif coalesce(array_length(p_domains, 1), 0) > 0 then
    raise exception 'A core object belongs to its type''s domain; domains apply only to Project Intelligence records'
      using errcode = '23514';
  end if;

  return new_id;
end;
$$;

-- The current status of a record, as text, for any kind.
create function private.intelligence_record_status(target_element_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select validation_status::text from public.assumptions where element_id = target_element_id),
    (select risk_status::text from public.risks where element_id = target_element_id),
    (select constraint_status::text from public.constraints where element_id = target_element_id),
    (select dependency_status::text from public.dependencies where element_id = target_element_id),
    (select decision_status::text from public.decisions where element_id = target_element_id),
    (select priority::text from public.recommendations where element_id = target_element_id),
    (select opportunity_status::text from public.opportunities where element_id = target_element_id)
  );
$$;
revoke all on function private.intelligence_record_status(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Triggers
-- -----------------------------------------------------------------------------

-- Every record gets its stewardship row when it is created.
create function private.create_intelligence_stewardship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind <> 'object' then
    insert into public.intelligence_stewardship (element_id, engagement_id, kind, updated_by)
    values (new.id, new.engagement_id, new.kind, auth.uid());
  end if;
  return null;
end;
$$;

-- Existing records (created before Phase 4) start untriaged. History begins
-- with Phase 4, so this backfill runs before the history triggers exist.
insert into public.intelligence_stewardship (element_id, engagement_id, kind)
select e.id, e.engagement_id, e.kind from public.architecture_elements e where e.kind <> 'object';

create trigger architecture_elements_stewardship after insert on public.architecture_elements
  for each row execute function private.create_intelligence_stewardship();

-- Operations name themselves and give their rationale to the history
-- triggers through transaction-local settings, cleared when they finish.
create function private.set_intelligence_context(p_operation text, p_rationale text)
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.intelligence_operation', coalesce(p_operation, ''), true),
         set_config('dsa.intelligence_rationale', coalesce(btrim(p_rationale), ''), true);
$$;

create function private.clear_intelligence_context()
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.intelligence_operation', '', true),
         set_config('dsa.intelligence_rationale', '', true);
$$;

revoke all on function private.set_intelligence_context(text, text) from public, anon, authenticated;
revoke all on function private.clear_intelligence_context() from public, anon, authenticated;

-- Status history: one row per change to each tracked field (trigger
-- arguments). Creation records the initial non-empty values.
create function private.record_intelligence_changes()
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
    nullif(current_setting('dsa.intelligence_operation', true), ''),
    case when tg_op = 'INSERT' then 'created'
         when private.in_architecture_operation() then 'operation'
         else 'edit' end
  );
  why text := nullif(current_setting('dsa.intelligence_rationale', true), '');
begin
  foreach f in array tg_argv loop
    before_value := o ->> f;
    after_value := n ->> f;
    if before_value is distinct from after_value and not (tg_op = 'INSERT' and after_value is null) then
      insert into public.intelligence_status_changes (
        engagement_id, element_id, kind, field, from_value, to_value, operation, rationale, changed_by
      ) values (
        (n ->> 'engagement_id')::uuid, (n ->> 'element_id')::uuid, (n ->> 'kind')::public.element_kind,
        f, before_value, after_value, op, why, auth.uid()
      );
    end if;
  end loop;
  return null;
end;
$$;

-- Terminal statuses are reached and left only through resolve and reopen
-- (ADR-0028). The status column is the trigger argument.
create function private.guard_intelligence_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  col text := tg_argv[0];
  new_status text := to_jsonb(new) ->> col;
  old_status text;
  terminal text[] := public.intelligence_terminal_statuses(new.kind);
begin
  if private.in_architecture_operation() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new_status = any (terminal) then
      raise exception 'A new record starts in an active status; resolve it with a rationale once it is created'
        using errcode = '23514';
    end if;
    return new;
  end if;
  old_status := to_jsonb(old) ->> col;
  if new_status is distinct from old_status and (new_status = any (terminal) or old_status = any (terminal)) then
    raise exception 'Use Resolve or Reopen, with a rationale, to move a record to or from %',
      case when new_status = any (terminal) then new_status else old_status end
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Append-only logs: never updated; deleted only with their parent (a draft
-- element removed before publication).
create function private.guard_intelligence_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception '% is append-only', tg_table_name using errcode = '23514';
  end if;
  if (tg_table_name = 'intelligence_status_changes'
      and exists (select 1 from public.architecture_elements where id = old.element_id))
     or (tg_table_name = 'client_action_events'
      and exists (select 1 from public.client_actions where id = old.action_id)) then
    raise exception '% is append-only', tg_table_name using errcode = '23514';
  end if;
  return old;
end;
$$;

-- Responses are the client's own words: only the evidence columns change,
-- and only through record_response_as_evidence.
create function private.guard_client_action_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.client_actions where id = old.action_id) then
      raise exception 'A client''s response is never deleted' using errcode = '23514';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - array['evidence_source_id', 'recorded_as_evidence_by', 'recorded_as_evidence_at'])
     is distinct from (to_jsonb(old) - array['evidence_source_id', 'recorded_as_evidence_by', 'recorded_as_evidence_at'])
     or old.evidence_source_id is not null then
    raise exception 'A client''s response is never changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger opportunities_prepare before insert or update or delete on public.opportunities
  for each row execute function private.prepare_element_child();
create trigger opportunities_log after insert or update or delete on public.opportunities
  for each row execute function private.log_activity();

create trigger assumptions_status_guard before insert or update on public.assumptions
  for each row execute function private.guard_intelligence_status('validation_status');
create trigger risks_status_guard before insert or update on public.risks
  for each row execute function private.guard_intelligence_status('risk_status');
create trigger constraints_status_guard before insert or update on public.constraints
  for each row execute function private.guard_intelligence_status('constraint_status');
create trigger dependencies_status_guard before insert or update on public.dependencies
  for each row execute function private.guard_intelligence_status('dependency_status');
create trigger opportunities_status_guard before insert or update on public.opportunities
  for each row execute function private.guard_intelligence_status('opportunity_status');

create trigger assumptions_history after insert or update on public.assumptions
  for each row execute function private.record_intelligence_changes('category', 'confidence', 'validation_status');
create trigger risks_history after insert or update on public.risks
  for each row execute function private.record_intelligence_changes('category', 'probability', 'impact', 'risk_status');
create trigger constraints_history after insert or update on public.constraints
  for each row execute function private.record_intelligence_changes('category', 'negotiable', 'constraint_status');
create trigger dependencies_history after insert or update on public.dependencies
  for each row execute function private.record_intelligence_changes('dependency_type', 'blocking', 'dependency_status');
create trigger decisions_history after insert or update on public.decisions
  for each row execute function private.record_intelligence_changes('category', 'decision_status');
create trigger recommendations_history after insert or update on public.recommendations
  for each row execute function private.record_intelligence_changes('category', 'priority');
create trigger opportunities_history after insert or update on public.opportunities
  for each row execute function private.record_intelligence_changes('category', 'value', 'feasibility', 'opportunity_status');
create trigger intelligence_stewardship_history after insert or update on public.intelligence_stewardship
  for each row execute function private.record_intelligence_changes('attention', 'triage_state', 'next_review_on');
create trigger intelligence_stewardship_log after update on public.intelligence_stewardship
  for each row execute function private.log_activity();

create trigger intelligence_status_changes_guard before update or delete on public.intelligence_status_changes
  for each row execute function private.guard_intelligence_log();
create trigger client_action_events_guard before update or delete on public.client_action_events
  for each row execute function private.guard_intelligence_log();
create trigger client_action_responses_guard before update or delete on public.client_action_responses
  for each row execute function private.guard_client_action_response();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'intelligence_escalations', 'client_actions', 'client_action_responses', 'client_contributions',
    'engagement_member_areas', 'intelligence_signal_dismissals', 'engagement_files'
  ] loop
    execute format('create trigger %1$s_log after insert or update or delete on public.%1$s
                      for each row execute function private.log_activity()', tbl);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Privileges. Opportunities are edited like the other subtype tables;
--    every other Phase 4 table is read-only to signed-in users and written
--    only by the operations in section 12.
-- -----------------------------------------------------------------------------
revoke all on
  public.intelligence_categories, public.opportunities, public.intelligence_stewardship,
  public.intelligence_status_changes, public.client_actions, public.client_action_subjects,
  public.client_action_responses, public.client_action_events, public.intelligence_escalations,
  public.client_contributions, public.engagement_member_areas, public.intelligence_signal_dismissals,
  public.engagement_files
from anon, authenticated;

grant select on
  public.intelligence_categories, public.opportunities, public.intelligence_stewardship,
  public.intelligence_status_changes, public.client_actions, public.client_action_subjects,
  public.client_action_responses, public.client_action_events, public.intelligence_escalations,
  public.client_contributions, public.engagement_member_areas, public.intelligence_signal_dismissals,
  public.engagement_files
to authenticated;

grant insert (element_id, category, value, feasibility, window_opens_on, window_closes_on, pursuit_approach,
              opportunity_status),
      update (category, value, feasibility, window_opens_on, window_closes_on, pursuit_approach, opportunity_status)
  on public.opportunities to authenticated;
grant insert (category), update (category) on public.decisions to authenticated;
grant insert (category), update (category) on public.recommendations to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.intelligence_categories enable row level security;
alter table public.opportunities enable row level security;
alter table public.intelligence_stewardship enable row level security;
alter table public.intelligence_status_changes enable row level security;
alter table public.client_actions enable row level security;
alter table public.client_action_subjects enable row level security;
alter table public.client_action_responses enable row level security;
alter table public.client_action_events enable row level security;
alter table public.intelligence_escalations enable row level security;
alter table public.client_contributions enable row level security;
alter table public.engagement_member_areas enable row level security;
alter table public.intelligence_signal_dismissals enable row level security;
alter table public.engagement_files enable row level security;

create policy "intelligence categories: readable reference data"
  on public.intelligence_categories for select to authenticated using (true);

-- Opportunities: a live working table like the other subtypes (internal only).
create policy "opportunities: internal readers" on public.opportunities for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "opportunities: editors add" on public.opportunities for insert to authenticated
  with check (private.can_edit_architecture(engagement_id));
create policy "opportunities: editors change" on public.opportunities for update to authenticated
  using (private.can_edit_architecture(engagement_id))
  with check (private.can_edit_architecture(engagement_id));

-- Internal working metadata: internal readers only.
create policy "stewardship: internal readers" on public.intelligence_stewardship for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "status history: internal readers" on public.intelligence_status_changes for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "escalations: internal readers" on public.intelligence_escalations for select to authenticated
  using (private.can_read_architecture(engagement_id));
create policy "signal dismissals: internal readers" on public.intelligence_signal_dismissals for select to authenticated
  using (private.can_read_architecture(engagement_id));

-- Client actions.
create policy "client actions: internal readers, client assigners and the addressee"
  on public.client_actions for select to authenticated
  using (private.can_see_client_action(id));
create policy "client action subjects: with their action"
  on public.client_action_subjects for select to authenticated
  using (private.can_see_client_action(action_id));
create policy "client action responses: with their action"
  on public.client_action_responses for select to authenticated
  using (private.can_see_client_action(action_id));
create policy "client action events: with their action"
  on public.client_action_events for select to authenticated
  using (private.can_see_client_action(action_id));

create policy "client contributions: internal readers, client assigners and the contributor"
  on public.client_contributions for select to authenticated
  using (private.can_see_client_contribution(id));

create policy "member areas: internal readers and the member"
  on public.engagement_member_areas for select to authenticated
  using (private.can_read_architecture(engagement_id) or private.is_my_membership(engagement_member_id));

create policy "engagement files: readers of what they are attached to"
  on public.engagement_files for select to authenticated
  using (private.can_read_engagement_file(object_path));

-- Storage: private bucket, paths {engagement_id}/{file_id}/{file name}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'engagement-files', 'engagement-files', false, 26214400,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do nothing;

create policy "engagement files: readers of what they are attached to"
  on storage.objects for select to authenticated
  using (bucket_id = 'engagement-files' and private.can_read_engagement_file(name));
create policy "engagement files: registered uploads by their uploader"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'engagement-files' and private.can_upload_engagement_file(name));

-- -----------------------------------------------------------------------------
-- 11. Operation helpers
-- -----------------------------------------------------------------------------

-- The business date (America/Chicago, ADR-0010).
create function private.business_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Chicago')::date;
$$;

-- A Project Intelligence record, locked, that the caller may work on.
create function private.lock_intelligence_record(
  target_element_id uuid,
  target_capability public.engagement_capability
)
returns public.architecture_elements
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
begin
  e := private.lock_element(target_element_id);
  perform private.require_architecture_capability(e.engagement_id, target_capability);
  if e.kind = 'object' then
    raise exception 'Only Project Intelligence records are triaged, resolved or escalated' using errcode = '23514';
  end if;
  if e.lifecycle in ('retired', 'superseded') then
    raise exception 'A retired or superseded record cannot change' using errcode = '23514';
  end if;
  return e;
end;
$$;

-- Internal callers who manage client requests on the engagement.
create function private.require_client_request_manager(target_engagement_id uuid)
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
  if not private.has_engagement_capability(target_engagement_id, 'manage_client_requests') then
    raise exception 'You do not hold manage_client_requests on this engagement' using errcode = '42501';
  end if;
end;
$$;

-- The display name of a person, for messages and evidence.
create function private.person_name(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.first_name || ' ' || p.last_name), ''), p.email)
  from public.profiles p where p.id = target_user_id;
$$;

-- Can this member be sent a request of this kind about these elements?
-- Returns nothing; raises 23514 with a reason when not.
create function private.assert_client_action_addressee(
  target_engagement_id uuid,
  target_member_id uuid,
  target_kind public.client_action_kind,
  target_subject_ids uuid[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  em public.engagement_members;
  needed public.engagement_capability :=
    case when target_kind = 'executive_attention' then 'approve_architecture'::public.engagement_capability
         else 'respond_to_client_actions' end;
  outside text;
begin
  select * into em from public.engagement_members where id = target_member_id and engagement_id = target_engagement_id;
  if not found or not private.member_is_active_client(em.id) then
    raise exception 'Choose an active client member of this engagement' using errcode = '23514';
  end if;
  if not private.member_has_capability(em.id, 'view_architecture') or not private.member_has_capability(em.id, needed) then
    raise exception '% cannot receive this request on this engagement', private.person_name(em.user_id)
      using errcode = '23514';
  end if;
  if not private.member_has_capability(em.id, 'view_full_architecture') then
    select string_agg(e.reference_code, ', ' order by e.reference_code) into outside
    from unnest(target_subject_ids) s(id)
    join public.architecture_elements e on e.id = s.id
    where not private.element_in_member_areas(em.id, e.id);
    if outside is not null then
      raise exception '% is outside the areas % can see', outside, private.person_name(em.user_id)
        using errcode = '23514';
    end if;
  end if;
end;
$$;

-- Creates a client action with its subjects and its first event.
create function private.insert_client_action(
  p_engagement_id uuid,
  p_kind public.client_action_kind,
  p_title text,
  p_request text,
  p_member_id uuid,
  p_due_on date,
  p_subject_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  subjects uuid[] := array(select distinct x from unnest(coalesce(p_subject_ids, '{}')) x where x is not null);
  bad text;
  action_id uuid;
  addressee uuid;
begin
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_request), '') = '' then
    raise exception 'A title and the request itself are required' using errcode = '23514';
  end if;
  if p_kind in ('confirmation', 'review_request', 'executive_attention') and cardinality(subjects) = 0 then
    raise exception 'Choose what the client should confirm or review' using errcode = '23514';
  end if;
  if p_due_on is not null and p_due_on < private.business_today() then
    raise exception 'The due date cannot be in the past' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(subjects) s(id)
    where not exists (select 1 from public.architecture_elements e where e.id = s.id and e.engagement_id = p_engagement_id)
  ) then
    raise exception 'Element not found' using errcode = 'P0002';
  end if;
  select string_agg(e.reference_code, ', ' order by e.reference_code) into bad
  from unnest(subjects) s(id)
  join public.architecture_elements e on e.id = s.id
  where not private.element_published_for_client(e.id);
  if bad is not null then
    raise exception 'Only published, client-visible elements can be sent to the client (%)', bad using errcode = '23514';
  end if;
  perform private.assert_client_action_addressee(p_engagement_id, p_member_id, p_kind, subjects);
  select user_id into addressee from public.engagement_members where id = p_member_id;

  insert into public.client_actions (
    engagement_id, reference_code, kind, title, request, addressed_to_member_id, addressed_to_user_id, due_on,
    sent_by
  ) values (
    p_engagement_id, private.next_reference_code(p_engagement_id, 'ACT'), p_kind, btrim(p_title), btrim(p_request),
    p_member_id, addressee, p_due_on, auth.uid()
  )
  returning id into action_id;

  insert into public.client_action_subjects (action_id, engagement_id, element_id)
  select action_id, p_engagement_id, s from unnest(subjects) s;
  insert into public.client_action_events (engagement_id, action_id, event, to_user_id)
  values (p_engagement_id, action_id, 'sent', addressee);
  return action_id;
end;
$$;

-- Attaches files the caller uploaded (and that are in storage) to a
-- response or contribution.
create function private.attach_engagement_files(
  p_engagement_id uuid,
  p_file_ids uuid[],
  p_purpose public.engagement_file_purpose,
  p_response_id uuid,
  p_contribution_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted uuid[] := array(select distinct x from unnest(coalesce(p_file_ids, '{}')) x where x is not null);
  attached int;
begin
  if cardinality(wanted) = 0 then
    return;
  end if;
  if exists (
    select 1 from public.engagement_files f
    where f.id = any (wanted)
      and not exists (select 1 from storage.objects o where o.bucket_id = 'engagement-files' and o.name = f.object_path)
  ) then
    raise exception 'A file has not finished uploading' using errcode = '23514';
  end if;
  update public.engagement_files f
  set client_action_response_id = p_response_id,
      client_contribution_id = p_contribution_id
  where f.id = any (wanted)
    and f.engagement_id = p_engagement_id
    and f.uploaded_by = auth.uid()
    and f.purpose = p_purpose
    and f.client_action_response_id is null
    and f.client_contribution_id is null;
  get diagnostics attached = row_count;
  if attached <> cardinality(wanted) then
    raise exception 'A file is not yours to attach, or is already attached' using errcode = '23514';
  end if;
end;
$$;

-- Creates an evidence source (client_source, internal) from a client's
-- words, moves its files to the source, and optionally cites it.
create function private.record_client_words_as_evidence(
  p_engagement_id uuid,
  p_title text,
  p_reference text,
  p_author_id uuid,
  p_said_at timestamptz,
  p_body text,
  p_link_url text,
  p_response_id uuid,
  p_contribution_id uuid,
  p_statement_id uuid,
  p_stance public.evidence_stance
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_files boolean := exists (
    select 1 from public.engagement_files f
    where (p_response_id is not null and f.client_action_response_id = p_response_id)
       or (p_contribution_id is not null and f.client_contribution_id = p_contribution_id)
  );
  source_id uuid;
  st public.architecture_statements;
begin
  if p_statement_id is not null then
    select * into st from public.architecture_statements where id = p_statement_id and engagement_id = p_engagement_id;
    if not found then
      raise exception 'Statement not found' using errcode = 'P0002';
    end if;
  end if;
  insert into public.evidence_sources (
    engagement_id, title, source_type, provenance, reference, url, publisher_author, source_date, summary, notes,
    client_visibility
  ) values (
    p_engagement_id, left(btrim(p_title), 300), case when has_files then 'document'::public.evidence_source_type else 'other' end,
    'client_source', p_reference, p_link_url, coalesce(private.person_name(p_author_id), ''),
    (p_said_at at time zone 'America/Chicago')::date, left(p_body, 4000),
    'Recorded from the client''s own words in DSA OS (' || p_reference || ').', 'internal'
  )
  returning id into source_id;
  update public.engagement_files set evidence_source_id = source_id
  where (p_response_id is not null and client_action_response_id = p_response_id)
     or (p_contribution_id is not null and client_contribution_id = p_contribution_id);
  if p_statement_id is not null then
    insert into public.statement_evidence_links (statement_id, evidence_source_id, stance, locator)
    values (p_statement_id, source_id, coalesce(p_stance, 'supports'), p_reference);
  end if;
  return source_id;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'private.business_today()',
    'private.lock_intelligence_record(uuid, public.engagement_capability)',
    'private.require_client_request_manager(uuid)',
    'private.person_name(uuid)',
    'private.assert_client_action_addressee(uuid, uuid, public.client_action_kind, uuid[])',
    'private.insert_client_action(uuid, public.client_action_kind, text, text, uuid, date, uuid[])',
    'private.attach_engagement_files(uuid, uuid[], public.engagement_file_purpose, uuid, uuid)',
    'private.record_client_words_as_evidence(uuid, text, text, uuid, timestamptz, text, text, uuid, uuid, uuid, public.evidence_stance)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Operations
-- -----------------------------------------------------------------------------

-- Triage ------------------------------------------------------------------------
create function public.triage_intelligence_record(
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
  e := private.lock_intelligence_record(p_element_id, 'edit_architecture');
  if p_attention is null then
    raise exception 'Choose the attention this record needs' using errcode = '23514';
  end if;
  if p_attention = 'critical' and coalesce(btrim(p_note), '') = '' then
    raise exception 'Say why this record needs critical attention' using errcode = '23514';
  end if;
  perform private.set_intelligence_context('triaged', p_note);
  update public.intelligence_stewardship
  set attention = p_attention,
      next_review_on = p_next_review_on,
      triage_state = 'triaged',
      triaged_by = auth.uid(),
      triaged_at = clock_timestamp(),
      triage_note = coalesce(btrim(p_note), ''),
      updated_by = auth.uid(),
      updated_at = clock_timestamp()
  where element_id = e.id;
  perform private.clear_intelligence_context();
  perform private.end_architecture_operation();
end;
$$;

-- Resolution ----------------------------------------------------------------------
-- Moves a record to a terminal status for its kind with a rationale, and
-- publishes the new version in the same transaction when asked (publishers).
create function public.resolve_intelligence_record(
  p_element_id uuid,
  p_status text,
  p_rationale text,
  p_publish boolean default false,
  p_change_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  current_status text;
  version_id uuid;
begin
  perform private.begin_architecture_operation();
  e := private.lock_intelligence_record(p_element_id, 'edit_architecture');
  if e.kind in ('decision', 'recommendation') then
    raise exception 'Decisions and recommendations are settled through their own operations' using errcode = '23514';
  end if;
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'A rationale is required' using errcode = '23514';
  end if;
  if not (p_status = any (public.intelligence_terminal_statuses(e.kind))) then
    raise exception '"%" does not resolve a %', p_status, e.kind using errcode = '23514';
  end if;
  current_status := private.intelligence_record_status(e.id);
  if current_status = p_status then
    raise exception 'The record is already %', p_status using errcode = '23514';
  end if;
  if (e.kind = 'risk' and p_status = 'accepted') or coalesce(p_publish, false) then
    perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
  end if;

  perform private.set_intelligence_context('resolved', p_rationale);
  case e.kind
    when 'assumption' then
      update public.assumptions set validation_status = p_status::public.validation_status where element_id = e.id;
    when 'risk' then
      update public.risks set risk_status = p_status::public.risk_status where element_id = e.id;
    when 'constraint' then
      update public.constraints set constraint_status = p_status::public.constraint_status where element_id = e.id;
    when 'dependency' then
      update public.dependencies set dependency_status = p_status::public.dependency_status where element_id = e.id;
    when 'opportunity' then
      update public.opportunities set opportunity_status = p_status::public.opportunity_status where element_id = e.id;
  end case;
  perform private.log_architecture_event(e.engagement_id, 'architecture_elements', e.id, 'record_resolved',
    jsonb_build_object('from', current_status, 'to', p_status, 'rationale', btrim(p_rationale)));
  perform private.clear_intelligence_context();
  perform private.end_architecture_operation();

  if coalesce(p_publish, false) then
    version_id := public.publish_element_version(
      e.id,
      coalesce(nullif(btrim(p_change_summary), ''), 'Resolved: ' || replace(p_status, '_', ' ') || '. ' || btrim(p_rationale))
    );
  end if;
  return version_id;
end;
$$;

create function public.reopen_intelligence_record(p_element_id uuid, p_status text, p_rationale text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  current_status text;
begin
  perform private.begin_architecture_operation();
  e := private.lock_intelligence_record(p_element_id, 'edit_architecture');
  if e.kind in ('decision', 'recommendation') then
    raise exception 'Decisions and recommendations are settled through their own operations' using errcode = '23514';
  end if;
  if coalesce(btrim(p_rationale), '') = '' then
    raise exception 'A rationale is required' using errcode = '23514';
  end if;
  current_status := private.intelligence_record_status(e.id);
  if not (current_status = any (public.intelligence_terminal_statuses(e.kind))) then
    raise exception 'Only a resolved record can be reopened' using errcode = '23514';
  end if;
  if not (p_status = any (public.intelligence_active_statuses(e.kind))) then
    raise exception '"%" is not an active status for a %', p_status, e.kind using errcode = '23514';
  end if;

  perform private.set_intelligence_context('reopened', p_rationale);
  case e.kind
    when 'assumption' then
      update public.assumptions set validation_status = p_status::public.validation_status where element_id = e.id;
    when 'risk' then
      update public.risks set risk_status = p_status::public.risk_status where element_id = e.id;
    when 'constraint' then
      update public.constraints set constraint_status = p_status::public.constraint_status where element_id = e.id;
    when 'dependency' then
      update public.dependencies set dependency_status = p_status::public.dependency_status where element_id = e.id;
    when 'opportunity' then
      update public.opportunities set opportunity_status = p_status::public.opportunity_status where element_id = e.id;
  end case;
  update public.intelligence_stewardship
  set triage_state = 'untriaged', updated_by = auth.uid(), updated_at = clock_timestamp()
  where element_id = e.id;
  perform private.log_architecture_event(e.engagement_id, 'architecture_elements', e.id, 'record_reopened',
    jsonb_build_object('from', current_status, 'to', p_status, 'rationale', btrim(p_rationale)));
  perform private.clear_intelligence_context();
  perform private.end_architecture_operation();
end;
$$;

-- Escalation ------------------------------------------------------------------------
create function public.escalate_intelligence_record(
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
  e := private.lock_intelligence_record(
    p_element_id,
    case when p_level = 'client_executive' then 'publish_architecture'::public.engagement_capability
         else 'edit_architecture' end
  );
  if p_level is null or coalesce(btrim(p_reason), '') = '' then
    raise exception 'Choose a level and give the reason' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.intelligence_escalations
    where element_id = e.id and level = p_level and resolved_at is null
  ) then
    raise exception '% is already escalated at this level', e.reference_code using errcode = '23514';
  end if;
  if p_level = 'client_executive' then
    if not private.element_published_for_client(e.id) then
      raise exception 'Only a published, client-visible record can be escalated to the client' using errcode = '23514';
    end if;
    if p_addressee_member_id is null then
      raise exception 'Choose the client executive' using errcode = '23514';
    end if;
    action_id := private.insert_client_action(
      e.engagement_id, 'executive_attention', left('Executive attention: ' || e.reference_code || ' ' || e.title, 200),
      btrim(p_reason), p_addressee_member_id, p_due_on, array[e.id]
    );
  end if;
  insert into public.intelligence_escalations (engagement_id, element_id, level, reason, raised_by, client_action_id)
  values (e.engagement_id, e.id, p_level, btrim(p_reason), auth.uid(), action_id)
  returning id into escalation_id;
  perform private.end_architecture_operation();
  return escalation_id;
end;
$$;

create function public.acknowledge_escalation(p_escalation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x public.intelligence_escalations;
begin
  select * into x from public.intelligence_escalations where id = p_escalation_id for update;
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
  update public.intelligence_escalations
  set acknowledged_by = auth.uid(), acknowledged_at = clock_timestamp()
  where id = x.id;
end;
$$;

create function public.resolve_escalation(p_escalation_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x public.intelligence_escalations;
  a public.client_actions;
begin
  select * into x from public.intelligence_escalations where id = p_escalation_id for update;
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
  update public.intelligence_escalations
  set resolved_by = auth.uid(), resolved_at = clock_timestamp(), resolution_note = btrim(p_note),
      acknowledged_by = coalesce(acknowledged_by, auth.uid()),
      acknowledged_at = coalesce(acknowledged_at, clock_timestamp())
  where id = x.id;
end;
$$;

-- Client actions ----------------------------------------------------------------------
create function public.send_client_action(
  p_engagement_id uuid,
  p_kind public.client_action_kind,
  p_title text,
  p_request text,
  p_addressee_member_id uuid,
  p_due_on date default null,
  p_subject_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_client_request_manager(p_engagement_id);
  if p_kind is null or p_kind = 'executive_attention' then
    raise exception 'Escalate the record to the client executive instead' using errcode = '23514';
  end if;
  return private.insert_client_action(p_engagement_id, p_kind, p_title, p_request, p_addressee_member_id, p_due_on,
                                      p_subject_ids);
end;
$$;

-- A client action, locked, that the caller can see.
create function private.lock_client_action(target_action_id uuid)
returns public.client_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.client_actions;
begin
  select * into a from public.client_actions where id = target_action_id for update;
  if not found or not private.can_see_client_action(a.id) then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  return a;
end;
$$;
revoke all on function private.lock_client_action(uuid) from public, anon, authenticated;

create function public.respond_to_client_action(
  p_action_id uuid,
  p_body text,
  p_link_url text default null,
  p_file_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.client_actions;
  response_id uuid;
begin
  a := private.lock_client_action(p_action_id);
  if private.is_internal() then
    raise exception 'Requests are answered by the client; record what the client said as evidence instead'
      using errcode = '42501';
  end if;
  if not (
    private.has_engagement_capability(a.engagement_id, 'assign_client_actions')
    or (
      private.is_my_membership(a.addressed_to_member_id)
      and private.has_engagement_capability(
        a.engagement_id,
        case when a.kind = 'executive_attention' then 'approve_architecture'::public.engagement_capability
             else 'respond_to_client_actions' end
      )
    )
  ) then
    raise exception 'You cannot respond to this request' using errcode = '42501';
  end if;
  if a.status not in ('open', 'responded') then
    raise exception 'This request is %', a.status using errcode = '23514';
  end if;
  if coalesce(btrim(p_body), '') = '' then
    raise exception 'Write your response' using errcode = '23514';
  end if;
  insert into public.client_action_responses (engagement_id, action_id, responded_by, body, link_url)
  values (a.engagement_id, a.id, auth.uid(), btrim(p_body), nullif(btrim(coalesce(p_link_url, '')), ''))
  returning id into response_id;
  perform private.attach_engagement_files(a.engagement_id, p_file_ids, 'client_response', response_id, null);
  update public.client_actions set status = 'responded', updated_at = clock_timestamp() where id = a.id;
  insert into public.client_action_events (engagement_id, action_id, event) values (a.engagement_id, a.id, 'responded');
  if a.kind = 'executive_attention' then
    update public.intelligence_escalations
    set acknowledged_by = coalesce(acknowledged_by, auth.uid()),
        acknowledged_at = coalesce(acknowledged_at, clock_timestamp())
    where client_action_id = a.id;
  end if;
  return response_id;
end;
$$;

create function public.reassign_client_action(p_action_id uuid, p_member_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.client_actions;
  subjects uuid[];
  new_user uuid;
begin
  a := private.lock_client_action(p_action_id);
  if not (
    (private.is_internal() and private.has_engagement_capability(a.engagement_id, 'manage_client_requests'))
    or (not private.is_internal() and private.has_engagement_capability(a.engagement_id, 'assign_client_actions'))
  ) then
    raise exception 'You cannot reassign this request' using errcode = '42501';
  end if;
  if a.status <> 'open' then
    raise exception 'Only an open request can be reassigned' using errcode = '23514';
  end if;
  if p_member_id is not distinct from a.addressed_to_member_id then
    raise exception 'The request is already addressed to this person' using errcode = '23514';
  end if;
  select array_agg(element_id) into subjects from public.client_action_subjects where action_id = a.id;
  perform private.assert_client_action_addressee(a.engagement_id, p_member_id, a.kind, coalesce(subjects, '{}'));
  select user_id into new_user from public.engagement_members where id = p_member_id;
  update public.client_actions
  set addressed_to_member_id = p_member_id, addressed_to_user_id = new_user, updated_at = clock_timestamp()
  where id = a.id;
  insert into public.client_action_events (engagement_id, action_id, event, note, from_user_id, to_user_id)
  values (a.engagement_id, a.id, 'reassigned', nullif(btrim(coalesce(p_note, '')), ''), a.addressed_to_user_id, new_user);
end;
$$;

-- Close (accept the response), return (ask for more) or withdraw.
create function public.close_client_action(p_action_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.client_actions;
begin
  a := private.lock_client_action(p_action_id);
  perform private.require_client_request_manager(a.engagement_id);
  if a.kind = 'executive_attention' then
    raise exception 'Resolve the escalation instead' using errcode = '23514';
  end if;
  if a.status <> 'responded' then
    raise exception 'Only a request with a response can be closed; withdraw it instead' using errcode = '23514';
  end if;
  update public.client_actions
  set status = 'closed', closed_by = auth.uid(), closed_at = clock_timestamp(),
      close_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = clock_timestamp()
  where id = a.id;
  insert into public.client_action_events (engagement_id, action_id, event, note)
  values (a.engagement_id, a.id, 'closed', nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;

create function public.return_client_action(p_action_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.client_actions;
begin
  a := private.lock_client_action(p_action_id);
  perform private.require_client_request_manager(a.engagement_id);
  if a.status <> 'responded' then
    raise exception 'Only a request with a response can be returned' using errcode = '23514';
  end if;
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'Say what more is needed' using errcode = '23514';
  end if;
  update public.client_actions set status = 'open', updated_at = clock_timestamp() where id = a.id;
  insert into public.client_action_events (engagement_id, action_id, event, note)
  values (a.engagement_id, a.id, 'returned', btrim(p_note));
end;
$$;

create function public.withdraw_client_action(p_action_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.client_actions;
begin
  a := private.lock_client_action(p_action_id);
  perform private.require_client_request_manager(a.engagement_id);
  if a.kind = 'executive_attention' then
    raise exception 'Resolve the escalation instead' using errcode = '23514';
  end if;
  if a.status not in ('open', 'responded') then
    raise exception 'This request is already %', a.status using errcode = '23514';
  end if;
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'Say why the request is withdrawn' using errcode = '23514';
  end if;
  update public.client_actions
  set status = 'withdrawn', closed_by = auth.uid(), closed_at = clock_timestamp(), close_note = btrim(p_note),
      updated_at = clock_timestamp()
  where id = a.id;
  insert into public.client_action_events (engagement_id, action_id, event, note)
  values (a.engagement_id, a.id, 'withdrawn', btrim(p_note));
end;
$$;

create function public.record_response_as_evidence(
  p_response_id uuid,
  p_title text default null,
  p_statement_id uuid default null,
  p_stance public.evidence_stance default 'supports'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.client_action_responses;
  a public.client_actions;
  source_id uuid;
begin
  select * into r from public.client_action_responses where id = p_response_id for update;
  if not found or not private.can_read_architecture(r.engagement_id) then
    raise exception 'Response not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(r.engagement_id, 'edit_architecture');
  if r.evidence_source_id is not null then
    raise exception 'This response is already recorded as evidence' using errcode = '23514';
  end if;
  select * into a from public.client_actions where id = r.action_id;
  source_id := private.record_client_words_as_evidence(
    r.engagement_id,
    coalesce(nullif(btrim(p_title), ''), a.reference_code || ': ' || a.title),
    a.reference_code, r.responded_by, r.responded_at, r.body, r.link_url, r.id, null, p_statement_id, p_stance
  );
  update public.client_action_responses
  set evidence_source_id = source_id, recorded_as_evidence_by = auth.uid(), recorded_as_evidence_at = clock_timestamp()
  where id = r.id;
  return source_id;
end;
$$;

-- Client contributions --------------------------------------------------------------------
create function public.submit_client_contribution(
  p_element_id uuid,
  p_body text,
  p_link_url text default null,
  p_file_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  contribution_id uuid;
begin
  select * into e from public.architecture_elements where id = p_element_id;
  if not found or private.is_internal()
     or not private.can_view_client_architecture(e.engagement_id)
     or not private.element_client_readable(e.id) then
    raise exception 'Element not found' using errcode = 'P0002';
  end if;
  if not private.has_engagement_capability(e.engagement_id, 'submit_client_input') then
    raise exception 'You cannot add input on this engagement' using errcode = '42501';
  end if;
  if coalesce(btrim(p_body), '') = '' then
    raise exception 'Write your input' using errcode = '23514';
  end if;
  insert into public.client_contributions (engagement_id, element_id, element_version_id, submitted_by, body, link_url)
  values (e.engagement_id, e.id, e.latest_version_id, auth.uid(), btrim(p_body),
          nullif(btrim(coalesce(p_link_url, '')), ''))
  returning id into contribution_id;
  perform private.attach_engagement_files(e.engagement_id, p_file_ids, 'client_contribution', null, contribution_id);
  return contribution_id;
end;
$$;

create function public.handle_client_contribution(
  p_contribution_id uuid,
  p_status public.contribution_status,
  p_note text,
  p_record_as_evidence boolean default false,
  p_statement_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.client_contributions;
  e public.architecture_elements;
  source_id uuid;
begin
  select * into c from public.client_contributions where id = p_contribution_id for update;
  if not found or not private.can_read_architecture(c.engagement_id) then
    raise exception 'Contribution not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(c.engagement_id, 'edit_architecture');
  if c.status <> 'received' then
    raise exception 'This input has already been handled' using errcode = '23514';
  end if;
  if p_status is null or p_status = 'received' then
    raise exception 'Mark the input incorporated or acknowledged' using errcode = '23514';
  end if;
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'Write a note for the contributor' using errcode = '23514';
  end if;
  if coalesce(p_record_as_evidence, false) then
    if p_status <> 'incorporated' then
      raise exception 'Only incorporated input is recorded as evidence' using errcode = '23514';
    end if;
    select * into e from public.architecture_elements where id = c.element_id;
    source_id := private.record_client_words_as_evidence(
      c.engagement_id, 'Client input on ' || e.reference_code || ': ' || e.title, e.reference_code,
      c.submitted_by, c.submitted_at, c.body, c.link_url, null, c.id, p_statement_id, 'supports'
    );
  end if;
  update public.client_contributions
  set status = p_status, handled_by = auth.uid(), handled_at = clock_timestamp(), handling_note = btrim(p_note),
      evidence_source_id = source_id
  where id = c.id;
  return source_id;
end;
$$;

-- Contributor areas ---------------------------------------------------------------------------
create function public.assign_member_area(
  p_member_id uuid,
  p_domain public.architecture_domain default null,
  p_element_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  em public.engagement_members;
  area_id uuid;
begin
  select * into em from public.engagement_members where id = p_member_id;
  if not found or not private.can_access_engagement(em.engagement_id) or not private.is_internal() then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_engagement(em.engagement_id) then
    raise exception 'Only those who manage the engagement assign areas' using errcode = '42501';
  end if;
  if em.side <> 'client' then
    raise exception 'Areas are assigned to client members' using errcode = '23514';
  end if;
  if num_nonnulls(p_domain, p_element_id) <> 1 then
    raise exception 'Choose a domain or an element' using errcode = '23514';
  end if;
  if p_element_id is not null and not exists (
    select 1 from public.architecture_elements
    where id = p_element_id and engagement_id = em.engagement_id and lifecycle not in ('retired', 'superseded')
  ) then
    raise exception 'Element not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.engagement_member_areas
    where engagement_member_id = em.id and domain is not distinct from p_domain and element_id is not distinct from p_element_id
  ) then
    raise exception 'This area is already assigned' using errcode = '23514';
  end if;
  insert into public.engagement_member_areas (engagement_id, engagement_member_id, domain, element_id, assigned_by)
  values (em.engagement_id, em.id, p_domain, p_element_id, auth.uid())
  returning id into area_id;
  return area_id;
end;
$$;

create function public.remove_member_area(p_area_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.engagement_member_areas;
begin
  select * into a from public.engagement_member_areas where id = p_area_id;
  if not found or not private.can_access_engagement(a.engagement_id) or not private.is_internal() then
    raise exception 'Area not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_engagement(a.engagement_id) then
    raise exception 'Only those who manage the engagement remove areas' using errcode = '42501';
  end if;
  delete from public.engagement_member_areas where id = a.id;
end;
$$;

-- Signals ------------------------------------------------------------------------------------------
create function public.dismiss_intelligence_signal(
  p_engagement_id uuid,
  p_rule_key text,
  p_element_id uuid,
  p_client_action_id uuid,
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
  if p_rule_key is null or p_rule_key not in (
    'assumption_unvalidated_underpins_published', 'assumption_invalidated_still_underpins',
    'risk_high_without_mitigation', 'dependency_blocking_unsatisfied', 'decision_past_needed_by',
    'opportunity_window_closing', 'opportunity_window_closed', 'review_overdue', 'client_action_overdue',
    'record_untriaged'
  ) then
    raise exception 'Unknown signal' using errcode = '23514';
  end if;
  if num_nonnulls(p_element_id, p_client_action_id) <> 1 or coalesce(p_fingerprint, '') = '' then
    raise exception 'Dismiss one signal at a time' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Say why the signal does not need action' using errcode = '23514';
  end if;
  if p_expires_on is not null and p_expires_on <= private.business_today() then
    raise exception 'A dismissal expires in the future' using errcode = '23514';
  end if;
  if (p_element_id is not null and not exists (
        select 1 from public.architecture_elements where id = p_element_id and engagement_id = p_engagement_id))
     or (p_client_action_id is not null and not exists (
        select 1 from public.client_actions where id = p_client_action_id and engagement_id = p_engagement_id)) then
    raise exception 'Signal not found' using errcode = 'P0002';
  end if;
  insert into public.intelligence_signal_dismissals (
    engagement_id, rule_key, element_id, client_action_id, fingerprint, reason, expires_on, dismissed_by
  ) values (
    p_engagement_id, p_rule_key, p_element_id, p_client_action_id, p_fingerprint, btrim(p_reason), p_expires_on, auth.uid()
  )
  returning id into dismissal_id;
  return dismissal_id;
end;
$$;

-- Files ------------------------------------------------------------------------------------------------
-- Registers a file before upload and returns the path to upload it to.
create function public.register_engagement_file(
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

-- -----------------------------------------------------------------------------
-- 13. Read models
-- -----------------------------------------------------------------------------

-- Internal: every Project Intelligence record the caller can read (one
-- engagement, or all of them), with its subtype facts, stewardship,
-- escalations and open client requests. Security invoker: RLS decides.
-- Filtering and ordering happen in the application (src/domain/intelligence).
create function public.intelligence_register(p_engagement_id uuid default null)
returns table (
  element_id           uuid,
  engagement_id        uuid,
  kind                 public.element_kind,
  reference_code       text,
  title                text,
  summary              text,
  lifecycle            public.element_lifecycle,
  client_visibility    public.client_visibility,
  provenance           public.provenance_type,
  engagement_wide      boolean,
  owner_user_id        uuid,
  latest_version_id    uuid,
  created_at           timestamptz,
  updated_at           timestamptz,
  domains              public.architecture_domain[],
  status               text,
  category             text,
  probability          smallint,
  impact               smallint,
  severity             smallint,
  value                smallint,
  feasibility          smallint,
  attractiveness       smallint,
  confidence           public.confidence_level,
  blocking             boolean,
  negotiable           boolean,
  needed_by            date,
  window_opens_on      date,
  window_closes_on     date,
  priority             public.recommendation_priority,
  approval_state       text,
  attention            public.intelligence_attention,
  triage_state         public.triage_state,
  triaged_at           timestamptz,
  next_review_on       date,
  open_escalations     public.escalation_level[],
  open_client_actions  int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.id, e.engagement_id, e.kind, e.reference_code, e.title, e.summary, e.lifecycle, e.client_visibility,
    e.provenance, e.engagement_wide, e.owner_user_id, e.latest_version_id, e.created_at, e.updated_at,
    coalesce((select array_agg(d.domain order by d.domain) from public.intelligence_record_domains d
              where d.element_id = e.id), '{}'),
    coalesce(a.validation_status::text, r.risk_status::text, c.constraint_status::text, dp.dependency_status::text,
             dc.decision_status::text, o.opportunity_status::text),
    coalesce(a.category, r.category, c.category::text, dp.dependency_type::text, dc.category, rc.category, o.category),
    r.probability, r.impact, r.severity, o.value, o.feasibility, o.attractiveness, a.confidence, dp.blocking,
    c.negotiable, dc.needed_by, o.window_opens_on, o.window_closes_on, rc.priority,
    case when e.latest_version_id is null then null
         else private.approval_state(ap.response, ap.id is not null) end,
    s.attention, s.triage_state, s.triaged_at, s.next_review_on,
    coalesce((select array_agg(x.level order by x.level) from public.intelligence_escalations x
              where x.element_id = e.id and x.resolved_at is null), '{}'),
    (select count(*)::int from public.client_action_subjects cs
     join public.client_actions ca on ca.id = cs.action_id
     where cs.element_id = e.id and ca.status in ('open', 'responded'))
  from public.architecture_elements e
  left join public.assumptions a on a.element_id = e.id
  left join public.risks r on r.element_id = e.id
  left join public.constraints c on c.element_id = e.id
  left join public.dependencies dp on dp.element_id = e.id
  left join public.decisions dc on dc.element_id = e.id
  left join public.recommendations rc on rc.element_id = e.id
  left join public.opportunities o on o.element_id = e.id
  left join public.intelligence_stewardship s on s.element_id = e.id
  left join public.architecture_approvals ap on ap.element_version_id = e.latest_version_id
  where e.kind <> 'object'
    and (p_engagement_id is null or e.engagement_id = p_engagement_id)
  order by e.engagement_id, e.reference_code;
$$;

-- Internal: how a record changed over time.
create function public.intelligence_history(p_element_id uuid)
returns table (
  id          bigint,
  changed_at  timestamptz,
  field       text,
  from_value  text,
  to_value    text,
  operation   text,
  rationale   text,
  actor_name  text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, h.changed_at, h.field, h.from_value, h.to_value, h.operation, h.rationale,
         nullif(btrim(p.first_name || ' ' || p.last_name), '')
  from public.intelligence_status_changes h
  left join public.profiles p on p.id = h.changed_by
  where h.element_id = p_element_id
  order by h.changed_at, h.id;
$$;

-- Internal: what a record touches. The first step follows the record's own
-- outgoing relationships (and a dependency's two ends); later steps follow
-- how an effect travels through the design: to the whole a part belongs to
-- (part_of), to what an element serves, shapes, informs, implies, is
-- implemented or delivered through, or is measured by, and back to what
-- requires it. Lineage relationships are never followed.
create function public.intelligence_impact(p_element_id uuid, p_depth int default 3)
returns table (
  element_id         uuid,
  kind               public.element_kind,
  reference_code     text,
  title              text,
  depth              int,
  via_element_id     uuid,
  relationship_type  text,
  direction          text
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
      select r.target_element_id as element_id, r.relationship_type, 'outgoing'::text as direction
      from public.architecture_relationships r
      join public.relationship_types t on t.key = r.relationship_type
      where r.source_element_id = w.element_id and r.retired_at is null and t.category <> 'lineage'
        and (w.depth = 0 or r.relationship_type in (
          'part_of', 'serves', 'shapes', 'informs', 'implies', 'implemented_through', 'delivered_through', 'measured_by'))
      union all
      select r.source_element_id, r.relationship_type, 'incoming'
      from public.architecture_relationships r
      where r.target_element_id = w.element_id and r.retired_at is null and r.relationship_type = 'requires'
        and w.depth > 0
      union all
      select v.x, 'dependency', 'dependency'
      from public.dependencies d
      cross join lateral (values (d.from_element_id), (d.to_element_id)) v(x)
      where d.element_id = w.element_id and w.depth = 0
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

-- Internal: deterministic intelligence signals (ADR-0032). Thresholds:
-- severity 15 or more; an opportunity window closing within 30 days; a
-- record untriaged for more than 7 days. as_of is the business date.
create function public.intelligence_signals(
  p_engagement_id uuid,
  p_as_of date default null,
  p_include_dismissed boolean default false
)
returns table (
  rule_key          text,
  element_id        uuid,
  client_action_id  uuid,
  reference_code    text,
  title             text,
  kind              public.element_kind,
  fingerprint       text,
  details           jsonb,
  dismissed         boolean,
  dismissal_reason  text,
  dismissed_at      timestamptz
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
    select e.*
    from public.architecture_elements e
    where e.engagement_id = p_engagement_id
      and e.lifecycle not in ('retired', 'superseded')
      and private.can_read_architecture(p_engagement_id)
  ),
  underpinned as (
    select e.id, a.validation_status, a.confidence, t.id as target_id, t.reference_code as target_code,
           t.title as target_title, t.latest_version_id
    from live e
    join public.assumptions a on a.element_id = e.id
    join public.architecture_relationships rel
      on rel.source_element_id = e.id and rel.relationship_type = 'underpins' and rel.retired_at is null
    join live t on t.id = rel.target_element_id
  ),
  raw as (
    select 'assumption_unvalidated_underpins_published'::text as rule_key, u.id as element_id,
           null::uuid as client_action_id,
           u.validation_status::text || '|' || string_agg(u.target_code, ',' order by u.target_code) as fingerprint,
           jsonb_build_object(
             'validation_status', u.validation_status, 'confidence', u.confidence,
             'targets', jsonb_agg(jsonb_build_object('element_id', u.target_id, 'reference_code', u.target_code,
                                                     'title', u.target_title) order by u.target_code)
           ) as details
    from underpinned u
    where u.validation_status in ('unvalidated', 'validating') and u.latest_version_id is not null
    group by u.id, u.validation_status, u.confidence
    union all
    select 'assumption_invalidated_still_underpins', u.id, null,
           string_agg(u.target_code, ',' order by u.target_code),
           jsonb_build_object(
             'targets', jsonb_agg(jsonb_build_object('element_id', u.target_id, 'reference_code', u.target_code,
                                                     'title', u.target_title) order by u.target_code)
           )
    from underpinned u
    where u.validation_status = 'invalidated'
    group by u.id
    union all
    select 'risk_high_without_mitigation', e.id, null, r.probability || 'x' || r.impact,
           jsonb_build_object('probability', r.probability, 'impact', r.impact, 'severity', r.severity,
                              'risk_status', r.risk_status)
    from live e
    join public.risks r on r.element_id = e.id
    where r.severity >= 15
      and r.risk_status in ('open', 'mitigating')
      and not exists (
        select 1 from public.architecture_relationships m
        join live src on src.id = m.source_element_id
        where m.target_element_id = e.id and m.relationship_type = 'mitigates' and m.retired_at is null
      )
    union all
    select 'dependency_blocking_unsatisfied', e.id, null, d.dependency_status::text,
           jsonb_build_object(
             'dependency_status', d.dependency_status,
             'from', jsonb_build_object('element_id', f.id, 'reference_code', f.reference_code, 'title', f.title),
             'to', jsonb_build_object('element_id', t.id, 'reference_code', t.reference_code, 'title', t.title)
           )
    from live e
    join public.dependencies d on d.element_id = e.id
    join public.architecture_elements f on f.id = d.from_element_id
    join public.architecture_elements t on t.id = d.to_element_id
    where d.blocking and d.dependency_status in ('open', 'at_risk', 'broken') and f.latest_version_id is not null
    union all
    select 'decision_past_needed_by', e.id, null, d.needed_by::text,
           jsonb_build_object('needed_by', d.needed_by, 'decision_status', d.decision_status)
    from live e
    join public.decisions d on d.element_id = e.id
    cross join params p
    where d.decision_status in ('open', 'recommended') and d.needed_by < p.as_of
    union all
    select 'opportunity_window_closing', e.id, null, o.window_closes_on::text,
           jsonb_build_object('window_closes_on', o.window_closes_on, 'opportunity_status', o.opportunity_status)
    from live e
    join public.opportunities o on o.element_id = e.id
    cross join params p
    where o.opportunity_status in ('identified', 'evaluating')
      and o.window_closes_on between p.as_of and p.as_of + 30
    union all
    select 'opportunity_window_closed', e.id, null, o.window_closes_on::text,
           jsonb_build_object('window_closes_on', o.window_closes_on, 'opportunity_status', o.opportunity_status)
    from live e
    join public.opportunities o on o.element_id = e.id
    cross join params p
    where o.opportunity_status in ('identified', 'evaluating', 'pursuing') and o.window_closes_on < p.as_of
    union all
    select 'review_overdue', e.id, null, s.next_review_on::text,
           jsonb_build_object('next_review_on', s.next_review_on)
    from live e
    join public.intelligence_stewardship s on s.element_id = e.id
    cross join params p
    where s.next_review_on < p.as_of
      and not coalesce(private.intelligence_record_status(e.id) = any (public.intelligence_terminal_statuses(e.kind)), false)
      and coalesce(private.intelligence_record_status(e.id), '') not in ('decided', 'superseded')
    union all
    select 'record_untriaged', e.id, null, s.updated_at::text,
           jsonb_build_object('since', (s.updated_at at time zone 'America/Chicago')::date)
    from live e
    join public.intelligence_stewardship s on s.element_id = e.id
    cross join params p
    where s.triage_state = 'untriaged' and (s.updated_at at time zone 'America/Chicago')::date < p.as_of - 7
    union all
    select 'client_action_overdue', null, a.id, a.due_on::text,
           jsonb_build_object('due_on', a.due_on, 'addressee', private.person_name(a.addressed_to_user_id))
    from public.client_actions a
    cross join params p
    where a.engagement_id = p_engagement_id
      and private.can_read_architecture(p_engagement_id)
      and a.status = 'open'
      and a.due_on < p.as_of
  )
  select raw.rule_key, raw.element_id, raw.client_action_id, coalesce(e.reference_code, a.reference_code),
         coalesce(e.title, a.title), e.kind, raw.fingerprint, raw.details, dm.id is not null, dm.reason, dm.dismissed_at
  from raw
  left join public.architecture_elements e on e.id = raw.element_id
  left join public.client_actions a on a.id = raw.client_action_id
  left join lateral (
    select d.id, d.reason, d.dismissed_at
    from public.intelligence_signal_dismissals d
    cross join params p
    where d.engagement_id = p_engagement_id
      and d.rule_key = raw.rule_key
      and d.element_id is not distinct from raw.element_id
      and d.client_action_id is not distinct from raw.client_action_id
      and d.fingerprint = raw.fingerprint
      and (d.expires_on is null or d.expires_on > p.as_of)
    order by d.dismissed_at desc
    limit 1
  ) dm on true
  where coalesce(p_include_dismissed, false) or dm.id is null
  order by raw.rule_key, coalesce(e.reference_code, a.reference_code);
$$;

-- Architecture activity learns the Phase 4 events. Still curated: no raw
-- rows, and client-authored text (responses, contributions) never appears.
create or replace function public.architecture_activity(
  p_engagement_id uuid,
  p_element_id uuid default null,
  p_limit integer default 100
)
returns table (
  id bigint,
  created_at timestamptz,
  actor_user_id uuid,
  actor_name text,
  event text,
  entity_type text,
  entity_id uuid,
  element_id uuid,
  related_element_id uuid,
  details jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with raw as (
    select
      l.*,
      coalesce(l.metadata_json -> 'after', l.metadata_json -> 'record') as r,
      l.metadata_json -> 'before' as b
    from public.activity_log l
    where l.engagement_id = p_engagement_id
      and private.can_read_architecture_activity(p_engagement_id)
      and l.entity_type in (
        'architecture_elements', 'architecture_objects', 'assumptions', 'risks', 'constraints',
        'dependencies', 'decisions', 'decision_options', 'recommendations', 'architecture_statements',
        'statement_evidence_links', 'element_evidence_links', 'element_method_lineage', 'evidence_sources',
        'architecture_relationships', 'element_versions', 'architecture_approvals', 'domain_assessments',
        'architecture_baselines', 'opportunities', 'intelligence_stewardship', 'intelligence_escalations',
        'client_actions', 'client_action_responses', 'client_contributions', 'engagement_member_areas',
        'intelligence_signal_dismissals'
      )
  ),
  classified as (
    select
      raw.*,
      case
        when action_type = 'provenance_changed' then 'provenance_changed'
        when action_type = 'returned_from_review' then 'returned_from_review'
        when action_type in ('record_resolved', 'record_reopened') then action_type
        when entity_type = 'architecture_elements' then
          case action_type
            when 'insert' then 'element_created'
            when 'delete' then 'draft_deleted'
            else case
              when (b ->> 'lifecycle') is distinct from (r ->> 'lifecycle') then
                case r ->> 'lifecycle'
                  when 'in_review' then 'submitted_for_review'
                  when 'retired' then 'element_retired'
                  when 'superseded' then 'element_superseded'
                end
              when (b ->> 'ai_review_state') is distinct from (r ->> 'ai_review_state')
                   and r ->> 'ai_review_state' in ('accepted', 'rejected') then 'ai_content_reviewed'
              when (b -> 'title', b -> 'summary', b -> 'client_visibility', b -> 'source_reference',
                    b -> 'ip_classification', b -> 'engagement_wide', b -> 'owner_user_id')
                   is distinct from
                   (r -> 'title', r -> 'summary', r -> 'client_visibility', r -> 'source_reference',
                    r -> 'ip_classification', r -> 'engagement_wide', r -> 'owner_user_id')
                then 'element_edited'
            end
          end
        when entity_type = 'decisions' and action_type = 'update' then
          case
            when (b ->> 'decision_status') is distinct from (r ->> 'decision_status') then
              case r ->> 'decision_status'
                when 'recommended' then 'decision_recommended'
                when 'decided' then 'decision_recorded'
                when 'deferred' then 'decision_deferred'
                else 'element_edited'
              end
            when (b ->> 'recommended_option_id') is distinct from (r ->> 'recommended_option_id')
              then 'decision_recommended'
            else 'element_edited'
          end
        when entity_type in ('architecture_objects', 'assumptions', 'risks', 'constraints', 'dependencies',
                             'recommendations', 'opportunities') and action_type = 'update' then 'element_edited'
        when entity_type = 'intelligence_stewardship' then
          case when action_type = 'update' and r ->> 'triage_state' = 'triaged'
                    and (b -> 'attention', b -> 'next_review_on', b -> 'triaged_at')
                        is distinct from (r -> 'attention', r -> 'next_review_on', r -> 'triaged_at')
               then 'record_triaged' end
        when entity_type = 'intelligence_escalations' then
          case
            when action_type = 'insert' then 'escalation_raised'
            when action_type = 'update' and b ->> 'resolved_at' is null and r ->> 'resolved_at' is not null
              then 'escalation_resolved'
            when action_type = 'update' and b ->> 'acknowledged_at' is null and r ->> 'acknowledged_at' is not null
              then 'escalation_acknowledged'
          end
        when entity_type = 'client_actions' then
          case
            when action_type = 'insert' then 'client_action_sent'
            when action_type = 'update' and (b ->> 'status') is distinct from (r ->> 'status') then
              case r ->> 'status'
                when 'closed' then 'client_action_closed'
                when 'withdrawn' then 'client_action_withdrawn'
                when 'open' then 'client_action_returned'
              end
            when action_type = 'update' and (b ->> 'addressed_to_user_id') is distinct from (r ->> 'addressed_to_user_id')
              then 'client_action_reassigned'
          end
        when entity_type = 'client_action_responses' then
          case
            when action_type = 'insert' then 'client_action_responded'
            when action_type = 'update' and b ->> 'evidence_source_id' is null and r ->> 'evidence_source_id' is not null
              then 'response_recorded_as_evidence'
          end
        when entity_type = 'client_contributions' then
          case
            when action_type = 'insert' then 'contribution_received'
            when action_type = 'update' and b ->> 'status' = 'received' and r ->> 'status' <> 'received'
              then 'contribution_handled'
          end
        when entity_type = 'engagement_member_areas' then
          case action_type when 'insert' then 'area_assigned' when 'delete' then 'area_removed' end
        when entity_type = 'intelligence_signal_dismissals' and action_type = 'insert' then 'signal_dismissed'
        when entity_type = 'decision_options' then
          case action_type when 'insert' then 'decision_option_added'
                           when 'update' then 'decision_option_edited'
                           else 'decision_option_removed' end
        when entity_type = 'architecture_statements' then
          case action_type
            when 'insert' then 'statement_added'
            when 'delete' then 'statement_removed'
            else case
              when (b ->> 'ai_review_state') is distinct from (r ->> 'ai_review_state')
                   and r ->> 'ai_review_state' in ('accepted', 'rejected') then 'ai_content_reviewed'
              else 'statement_edited'
            end
          end
        when entity_type in ('statement_evidence_links', 'element_evidence_links') then
          case action_type when 'insert' then 'evidence_cited'
                           when 'delete' then 'citation_removed'
                           else 'citation_edited' end
        when entity_type = 'element_method_lineage' then
          case action_type when 'delete' then 'lineage_removed' else 'lineage_recorded' end
        when entity_type = 'evidence_sources' then
          case action_type when 'insert' then 'evidence_source_added'
                           when 'delete' then 'evidence_source_removed'
                           else 'evidence_source_edited' end
        when entity_type = 'architecture_relationships' then
          case action_type
            when 'insert' then 'relationship_added'
            when 'delete' then 'relationship_removed'
            else case
              when b ->> 'retired_at' is null and r ->> 'retired_at' is not null then 'relationship_retired'
              when b ->> 'published_at' is null and r ->> 'published_at' is not null then 'relationship_published'
              else 'relationship_edited'
            end
          end
        when entity_type = 'element_versions' and action_type = 'insert' then 'version_published'
        when entity_type = 'architecture_approvals' then
          case
            when action_type = 'insert' and r ->> 'response' is null then 'approval_requested'
            when action_type = 'insert' then 'approval_recorded'
            when action_type = 'update' and b ->> 'response' is null and r ->> 'response' is not null
              then 'approval_responded'
          end
        when entity_type = 'domain_assessments' and action_type = 'insert' then 'domain_assessed'
        when entity_type = 'architecture_baselines' then
          case
            when action_type = 'insert' then 'baseline_created'
            when action_type = 'update' and b ->> 'status' = 'draft' and r ->> 'status' = 'frozen'
              then 'baseline_frozen'
            when action_type = 'delete' then 'baseline_deleted'
          end
      end as event
    from raw
  ),
  located as (
    select
      c.*,
      case
        when c.entity_type = 'architecture_elements' then c.entity_id
        when c.entity_type = 'decision_options' then (c.r ->> 'decision_element_id')::uuid
        when c.entity_type = 'architecture_relationships' then
          coalesce((c.r ->> 'source_element_id')::uuid,
                   (select rel.source_element_id from public.architecture_relationships rel where rel.id = c.entity_id))
        when c.entity_type = 'architecture_statements' then
          coalesce((c.r ->> 'element_id')::uuid,
                   (select s.element_id from public.architecture_statements s where s.id = c.entity_id))
        when c.entity_type = 'statement_evidence_links' then
          (select s.element_id from public.architecture_statements s where s.id = (c.r ->> 'statement_id')::uuid)
        when c.entity_type = 'architecture_approvals' then
          (select v.element_id from public.element_versions v where v.id = (c.r ->> 'element_version_id')::uuid)
        when c.entity_type = 'client_actions' then
          (select s.element_id from public.client_action_subjects s where s.action_id = c.entity_id
           order by s.element_id limit 1)
        when c.entity_type = 'client_action_responses' then
          (select s.element_id from public.client_action_subjects s where s.action_id = (c.r ->> 'action_id')::uuid
           order by s.element_id limit 1)
        when c.entity_type in ('evidence_sources', 'domain_assessments', 'architecture_baselines') then null
        else (c.r ->> 'element_id')::uuid
      end as element_ref,
      case
        when c.entity_type = 'architecture_relationships' then
          coalesce((c.r ->> 'target_element_id')::uuid,
                   (select rel.target_element_id from public.architecture_relationships rel where rel.id = c.entity_id))
      end as related_ref
    from classified c
    where c.event is not null
  )
  select
    x.id,
    x.created_at,
    x.actor_user_id,
    nullif(trim(p.first_name || ' ' || p.last_name), '') as actor_name,
    x.event,
    x.entity_type,
    x.entity_id,
    x.element_ref,
    x.related_ref,
    jsonb_strip_nulls(jsonb_build_object(
      'title', case when x.entity_type in ('architecture_elements', 'decision_options', 'evidence_sources',
                                           'client_actions')
                    then x.r ->> 'title' end,
      'reference_code', case when x.entity_type = 'client_actions' then x.r ->> 'reference_code'
                             when x.entity_type = 'client_action_responses' then
                               (select a.reference_code from public.client_actions a where a.id = (x.r ->> 'action_id')::uuid)
                        end,
      'action_kind', case when x.entity_type = 'client_actions' then x.r ->> 'kind' end,
      'level', case when x.entity_type = 'intelligence_escalations' then x.r ->> 'level' end,
      'attention', case when x.event = 'record_triaged' then x.r ->> 'attention' end,
      'rule_key', case when x.entity_type = 'intelligence_signal_dismissals' then x.r ->> 'rule_key' end,
      'status', case when x.event = 'contribution_handled' then x.r ->> 'status' end,
      'rationale', case when x.event in ('record_resolved', 'record_reopened') then x.metadata_json ->> 'rationale' end,
      'label', case when x.entity_type = 'architecture_baselines' then x.r ->> 'label' end,
      'from', case when x.event in ('provenance_changed', 'record_resolved', 'record_reopened')
                     then x.metadata_json ->> 'from'
                   when x.entity_type = 'architecture_elements' and x.event in ('element_retired', 'element_superseded')
                     then x.b ->> 'lifecycle' end,
      'to', case when x.event in ('provenance_changed', 'record_resolved', 'record_reopened')
                   then x.metadata_json ->> 'to' end,
      'note', case when x.event = 'returned_from_review' then nullif(x.metadata_json ->> 'note', '') end,
      'version_no', case when x.entity_type = 'element_versions' then (x.r ->> 'version_no')::integer
                         when x.entity_type = 'architecture_approvals' then
                           (select v.version_no from public.element_versions v
                            where v.id = (x.r ->> 'element_version_id')::uuid) end,
      'change_summary', case when x.entity_type = 'element_versions' then nullif(x.r ->> 'change_summary', '') end,
      'baseline_id', case when x.entity_type = 'architecture_approvals' then x.r ->> 'baseline_id' end,
      'response', case when x.entity_type = 'architecture_approvals' then x.r ->> 'response' end,
      'approval_source', case when x.entity_type = 'architecture_approvals' and x.r ->> 'response' is not null
                              then x.r ->> 'approval_source' end,
      'relationship_type', case when x.entity_type = 'architecture_relationships' then x.r ->> 'relationship_type' end,
      'statement_kind', case when x.entity_type = 'architecture_statements' then x.r ->> 'statement_kind' end,
      'domain', case when x.entity_type in ('domain_assessments', 'engagement_member_areas') then x.r ->> 'domain' end,
      'maturity', case when x.entity_type = 'domain_assessments' then x.r ->> 'maturity' end,
      'decision_source', case when x.event = 'decision_recorded' then x.r ->> 'decision_source' end,
      'ai_review_state', case when x.event = 'ai_content_reviewed' then x.r ->> 'ai_review_state' end
    )) as details
  from located x
  left join public.profiles p on p.id = x.actor_user_id
  where p_element_id is null or x.element_ref = p_element_id or x.related_ref = p_element_id
  order by x.created_at desc, x.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;


-- -----------------------------------------------------------------------------
-- 14. Function privileges
-- -----------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.intelligence_terminal_statuses(public.element_kind)',
    'public.intelligence_active_statuses(public.element_kind)',
    'public.triage_intelligence_record(uuid, public.intelligence_attention, date, text)',
    'public.resolve_intelligence_record(uuid, text, text, boolean, text)',
    'public.reopen_intelligence_record(uuid, text, text)',
    'public.escalate_intelligence_record(uuid, public.escalation_level, text, uuid, date)',
    'public.acknowledge_escalation(uuid)',
    'public.resolve_escalation(uuid, text)',
    'public.send_client_action(uuid, public.client_action_kind, text, text, uuid, date, uuid[])',
    'public.respond_to_client_action(uuid, text, text, uuid[])',
    'public.reassign_client_action(uuid, uuid, text)',
    'public.close_client_action(uuid, text)',
    'public.return_client_action(uuid, text)',
    'public.withdraw_client_action(uuid, text)',
    'public.record_response_as_evidence(uuid, text, uuid, public.evidence_stance)',
    'public.submit_client_contribution(uuid, text, text, uuid[])',
    'public.handle_client_contribution(uuid, public.contribution_status, text, boolean, uuid)',
    'public.assign_member_area(uuid, public.architecture_domain, uuid)',
    'public.remove_member_area(uuid)',
    'public.dismiss_intelligence_signal(uuid, text, uuid, uuid, text, text, date)',
    'public.register_engagement_file(uuid, public.engagement_file_purpose, text, text, bigint, uuid)',
    'public.intelligence_register(uuid)',
    'public.intelligence_history(uuid)',
    'public.intelligence_impact(uuid, integer)',
    'public.intelligence_signals(uuid, date, boolean)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;

-- Trigger functions are never called directly.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'private.create_intelligence_stewardship()',
    'private.record_intelligence_changes()',
    'private.guard_intelligence_status()',
    'private.guard_intelligence_log()',
    'private.guard_client_action_response()'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end;
$$;
