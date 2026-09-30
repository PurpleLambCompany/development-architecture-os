-- =============================================================================
-- DSA OS — Phase 3: Architecture Core
--
-- The four architecture domains and their objects, the Project Intelligence
-- records that qualify them, typed relationships, material statements with
-- provenance, the evidence system, published versions, baselines, approvals
-- and dated domain maturity assessments.
-- Specification: docs/product/PHASE_3_PROPOSAL.md (approved 2026-09-30).
-- Decisions: ADR-0013 to ADR-0025.
--
-- Rules that hold throughout:
--   * Working copies (live tables) are internal. Clients read only published,
--     immutable version snapshots (ADR-0014).
--   * Lifecycle, publication, approvals, decisions, AI review, retirement and
--     supersession change only through the operations in section 12, which
--     mark the transaction, lock rows, check capabilities (42501), validate
--     (23514) or report a missing record (P0002).
--   * Every permission check uses engagement capabilities, never role names.
--   * No table here references a finance table (ADR-0023).
--   * Timestamps use clock_timestamp(), so histories written in one
--     transaction (a seed, a freeze after a publication) still order correctly.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Capabilities (ADR-0024)
-- -----------------------------------------------------------------------------
create or replace function public.capability_side(capability public.engagement_capability)
returns public.member_side
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when capability in ('pay_invoices', 'approve_change_orders', 'view_architecture') then 'client'::public.member_side
    when capability in ('manage_financials', 'edit_architecture', 'publish_architecture') then 'internal'::public.member_side
    else null
  end;
$$;

insert into public.role_capability_defaults (role, capability) values
  ('principal_architect',  'edit_architecture'),
  ('principal_architect',  'publish_architecture'),
  ('architect',            'edit_architecture'),
  ('architect',            'publish_architecture'),
  ('researcher',           'edit_architecture'),
  ('executive_sponsor',    'view_architecture'),
  ('client_project_lead',  'view_architecture'),
  ('client_contributor',   'view_architecture'),
  ('client_viewer',        'view_architecture');
  -- System, Project and Finance Administrators and Client Finance hold none.

-- Internal members who can access the engagement read the working architecture.
create function private.can_read_architecture(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_internal() and private.can_access_engagement(target_engagement_id);
$$;

create function private.can_edit_architecture(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_internal() and private.has_engagement_capability(target_engagement_id, 'edit_architecture');
$$;

create function private.can_publish_architecture(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_internal() and private.has_engagement_capability(target_engagement_id, 'publish_architecture');
$$;

-- Published, client-visible architecture (client side).
create function private.can_view_client_architecture(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_engagement_capability(target_engagement_id, 'view_architecture');
$$;

-- Respond to approval requests and decide decisions: approve_architecture
-- together with view_architecture (a client-side capability).
create function private.can_respond_to_architecture(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_engagement_capability(target_engagement_id, 'view_architecture')
     and private.has_engagement_capability(target_engagement_id, 'approve_architecture');
$$;

-- Any active client member of the engagement (for the published domain states).
create function private.is_engagement_client_member(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.role_side(private.engagement_role(target_engagement_id)) = 'client', false);
$$;

revoke all on function private.can_read_architecture(uuid) from public, anon;
revoke all on function private.can_edit_architecture(uuid) from public, anon;
revoke all on function private.can_publish_architecture(uuid) from public, anon;
revoke all on function private.can_view_client_architecture(uuid) from public, anon;
revoke all on function private.can_respond_to_architecture(uuid) from public, anon;
revoke all on function private.is_engagement_client_member(uuid) from public, anon;
grant execute on function private.can_read_architecture(uuid) to authenticated;
grant execute on function private.can_edit_architecture(uuid) to authenticated;
grant execute on function private.can_publish_architecture(uuid) to authenticated;
grant execute on function private.can_view_client_architecture(uuid) to authenticated;
grant execute on function private.can_respond_to_architecture(uuid) to authenticated;
grant execute on function private.is_engagement_client_member(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------
create type public.provenance_type as enum (
  'client_source',
  'public_source',
  'architect_observation',
  'architect_judgment',
  'client_decision',
  'ai_analysis',
  'methodology_derived',
  'system_derived'
);
create type public.element_kind as enum (
  'object', 'assumption', 'risk', 'constraint', 'dependency', 'decision', 'recommendation'
);
create type public.element_lifecycle as enum ('draft', 'in_review', 'published', 'superseded', 'retired');
create type public.maturity_state as enum ('undefined', 'emerging', 'defined', 'structured', 'operationalized');
create type public.client_visibility as enum ('internal', 'client');
create type public.statement_kind as enum ('finding', 'observation', 'rationale', 'implication', 'definition', 'note');
create type public.ai_review_state as enum ('not_applicable', 'pending', 'accepted', 'rejected');
create type public.approval_response as enum ('approved', 'changes_requested');
create type public.architecture_approval_method as enum ('meeting', 'email', 'signed_document', 'other');
create type public.evidence_stance as enum ('supports', 'contradicts', 'context');
create type public.evidence_source_type as enum (
  'document', 'interview', 'meeting_notes', 'dataset', 'publication', 'regulation', 'web', 'internal_analysis', 'other'
);
create type public.confidence_level as enum ('low', 'medium', 'high');
create type public.validation_status as enum ('unvalidated', 'validating', 'validated', 'invalidated');
create type public.risk_status as enum ('open', 'mitigating', 'accepted', 'closed');
create type public.constraint_category as enum (
  'regulatory', 'financial', 'physical', 'contractual', 'political', 'temporal', 'other'
);
create type public.constraint_status as enum ('in_force', 'relaxed', 'lifted');
create type public.dependency_type as enum ('prerequisite', 'sequence', 'input', 'funding', 'external');
create type public.dependency_status as enum ('open', 'satisfied', 'at_risk', 'broken');
create type public.decision_status as enum ('open', 'recommended', 'decided', 'deferred', 'superseded');
create type public.recommendation_priority as enum ('critical', 'important', 'advisable');
create type public.skill_proficiency as enum ('foundational', 'proficient', 'expert');
create type public.baseline_status as enum ('draft', 'frozen');

-- The reference-code prefix of an element (ADR-0025).
create function public.element_reference_prefix(
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
  end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Reference data: object types, relationship types, allowed pairings.
--    Migration-managed; readable by signed-in users; writable by no one.
-- -----------------------------------------------------------------------------
create table public.architecture_object_types (
  key                       text primary key check (key ~ '^[a-z][a-z_]*$'),
  domain                    public.architecture_domain not null,
  label                     text not null,
  definition                text not null,
  attribute_schema_version  int not null default 1 check (attribute_schema_version > 0),
  sort_order                int not null,
  constraint architecture_object_types_domain_key unique (domain, key)
);

create table public.relationship_types (
  key            text primary key check (key ~ '^[a-z][a-z_]*$'),
  category       text not null check (category in ('structure', 'design_flow', 'intelligence', 'lineage')),
  label          text not null,
  inverse_label  text not null,
  is_symmetric   boolean not null default false,
  is_acyclic     boolean not null default false,
  definition     text not null,
  sort_order     int not null
);

-- A relationship is accepted only when a rule matches its source and target.
-- Object types are listed explicitly; records carry no object type.
create table public.relationship_rules (
  id                  bigint generated always as identity primary key,
  relationship_type   text not null references public.relationship_types (key),
  source_kind         public.element_kind not null,
  source_object_type  text references public.architecture_object_types (key),
  target_kind         public.element_kind not null,
  target_object_type  text references public.architecture_object_types (key),
  constraint relationship_rules_shape check (
    (source_kind = 'object') = (source_object_type is not null)
    and (target_kind = 'object') = (target_object_type is not null)
  ),
  constraint relationship_rules_unique unique nulls not distinct
    (relationship_type, source_kind, source_object_type, target_kind, target_object_type)
);

insert into public.architecture_object_types (key, domain, label, definition, attribute_schema_version, sort_order) values
  ('knowledge_area', 'knowledge', 'Knowledge Area',
   'A defined field of understanding that the development depends on, such as a market, a discipline or a policy field. Not a document or a source.', 1, 1),
  ('concept', 'knowledge', 'Concept',
   'A term or idea within a knowledge area that the architecture relies on, with an agreed meaning and boundary.', 1, 2),
  ('research_question', 'knowledge', 'Research Question',
   'A question whose answer the architecture needs, stated precisely enough to be answered. Not a research task.', 1, 3),
  ('knowledge_gap', 'knowledge', 'Knowledge Gap',
   'Something the architecture needs to know but does not yet, with the consequence of not knowing it.', 1, 4),
  ('regulatory_factor', 'knowledge', 'Regulatory Factor',
   'A law, regulation, licence condition or policy obligation that is part of the development''s context. The limits it imposes are recorded as Constraints.', 1, 5),
  ('competitive_factor', 'knowledge', 'Competitive Factor',
   'An actor, alternative or market force the development must be positioned against.', 1, 6),
  ('system_boundary', 'knowledge', 'System Boundary',
   'The defined edge of the development system: what is inside, what is outside, and the interfaces between them.', 1, 7),
  ('stakeholder', 'knowledge', 'Stakeholder',
   'A person, group or institution whose interests, authority or influence shape the development. Not a user account.', 1, 8),
  ('capability', 'capability', 'Capability',
   'A durable ability the organization must have to achieve its development objective, independent of who performs it or how. Not a team, a role or a project.', 1, 9),
  ('skill', 'capability', 'Skill',
   'A specific proficiency that people must hold for a capability to function.', 1, 10),
  ('role', 'capability', 'Role',
   'A defined position of responsibility that brings skills together to deliver capabilities. Describes the position, never a named person.', 1, 11),
  ('capability_gap', 'capability', 'Capability Gap',
   'The difference between the capability the organization has and the capability it requires, stated so that it can be closed.', 1, 12),
  ('talent_stage', 'capability', 'Talent Sequence Stage',
   'A stage in the order in which people and capabilities are brought into the development, with the condition that triggers it.', 1, 13),
  ('intended_outcome', 'strategic_model', 'Intended Outcome',
   'The desired condition or result that the architecture is intended to produce. Not a KPI, measurement, deliverable, activity or task. How it is measured belongs to Application Architecture (Metric).', 1, 14),
  ('strategic_model', 'strategic_model', 'Applied Strategic Model',
   'A strategic model applied to this engagement: how it applies here and where it stops applying. The model itself belongs to the internal Method Library; this is its application.', 1, 15),
  ('structural_leverage', 'strategic_model', 'Structural Leverage',
   'A feature of the system''s structure that, when used, produces a disproportionate effect.', 1, 16),
  ('differentiation_logic', 'strategic_model', 'Differentiation Logic',
   'The reasoning for why this development will be distinct and defensible against the alternatives.', 1, 17),
  ('strategic_implication', 'strategic_model', 'Strategic Implication',
   'A consequence of the chosen strategy that the rest of the architecture must accommodate.', 1, 18),
  ('operating_model', 'application', 'Operating Model',
   'How the development runs as a whole: its core flows, structures and the relationships among them.', 1, 19),
  ('application_format', 'application', 'Application Format',
   'A concrete organizational form through which capabilities are put to work. Covers program structure and product structure.', 1, 20),
  ('governance_body', 'application', 'Governance Body',
   'A body that holds authority over part of the development, such as a board, committee, council or steering group.', 1, 21),
  ('decision_right', 'application', 'Decision Right',
   'The allocation of authority over a class of decisions: who decides, who is consulted, who may veto, who is informed. Not a single decision.', 1, 22),
  ('workflow', 'application', 'Workflow',
   'A repeatable sequence by which work moves through the development, from trigger to output. Not a task list.', 1, 23),
  ('delivery_mechanism', 'application', 'Delivery Mechanism',
   'The channel or means through which the development''s value reaches its beneficiaries.', 1, 24),
  ('metric', 'application', 'Metric',
   'A defined measure of whether an intended outcome, capability or operation is performing as designed. The measure, not the outcome itself.', 1, 25),
  ('scaling_stage', 'application', 'Scaling Stage',
   'A stage in the planned growth of the development, with the conditions to enter and leave it.', 1, 26),
  ('documentation_protocol', 'application', 'Documentation Protocol',
   'The rule for how a body of architectural or operating knowledge is recorded, owned and kept current.', 1, 27);

insert into public.relationship_types (key, category, label, inverse_label, is_symmetric, is_acyclic, definition, sort_order) values
  ('part_of', 'structure', 'is part of', 'includes', false, true,
   'Composition: the source is a component of the target. Builds the domain map and capability map.', 1),
  ('specializes', 'structure', 'is a kind of', 'has kinds', false, true,
   'Classification: the source is a more specific form of the target. Builds the concept hierarchy.', 2),
  ('precedes', 'structure', 'precedes', 'follows', false, true,
   'Planned order: the source comes before the target.', 3),
  ('gap_in', 'structure', 'is a gap in', 'has gap', false, false,
   'The source describes a shortfall in the target.', 4),
  ('investigates', 'structure', 'investigates', 'is investigated by', false, false,
   'A Research Question seeks evidence or clarification about the target. When the target is a Knowledge Gap, answering it may help close the gap; when the target is an Assumption, answering it tests the assumption.', 5),
  ('informs', 'design_flow', 'informs', 'is informed by', false, false,
   'Supplies knowledge or input to the target: understanding, context or facts that the target''s design or justification draws on. Informing does not by itself determine the target''s form (that is shapes).', 6),
  ('serves', 'design_flow', 'serves', 'is served by', false, false,
   'The source exists to bring about the target outcome.', 7),
  ('shapes', 'design_flow', 'shapes', 'is shaped by', false, false,
   'Materially influences the design or form of the target: the strategic logic in the source determines how the target is built. Stronger than informs.', 8),
  ('implies', 'design_flow', 'implies', 'follows from', false, false,
   'The target is a consequence of the source.', 9),
  ('exploits', 'design_flow', 'exploits', 'is exploited by', false, false,
   'The source deliberately uses the lever.', 10),
  ('positioned_against', 'design_flow', 'is positioned against', 'is the reference for', false, false,
   'The source is designed to be distinct from the target.', 11),
  ('requires', 'design_flow', 'requires', 'is required by', false, false,
   'Architectural necessity: the source cannot exist or function as designed without the target. A structural fact about the design, distinct from a Dependency record, which tracks a condition with its own status, blocking flag and owner.', 12),
  ('implemented_through', 'design_flow', 'is implemented through', 'implements', false, false,
   'The target is how the capability is put into operation.', 13),
  ('delivered_through', 'design_flow', 'is delivered through', 'delivers', false, false,
   'The target is the channel through which the source''s value reaches beneficiaries.', 14),
  ('measured_by', 'design_flow', 'is measured by', 'measures', false, false,
   'The metric is how performance of the source is observed. Keeps outcome and measure separate.', 15),
  ('governed_by', 'design_flow', 'is governed by', 'governs', false, false,
   'The target holds or allocates authority over the source.', 16),
  ('holds', 'design_flow', 'holds', 'is held by', false, false,
   'The source is the holder named by the decision right.', 17),
  ('accountable_for', 'design_flow', 'is accountable for', 'is the accountability of', false, false,
   'The source answers for the target''s design and performance. Not a task assignment.', 18),
  ('introduces', 'design_flow', 'introduces', 'is introduced at', false, false,
   'The target enters the development at the source stage.', 19),
  ('bounded_by', 'design_flow', 'operates within', 'bounds', false, false,
   'The source sits inside the defined edge of the system.', 20),
  ('subject_to', 'design_flow', 'is subject to', 'applies to', false, false,
   'The regulatory factor applies to the source.', 21),
  ('documented_by', 'design_flow', 'is documented by', 'documents', false, false,
   'The protocol governs how knowledge about the source is recorded and kept current.', 22),
  ('has_stake_in', 'design_flow', 'has a stake in', 'has as stakeholder', false, false,
   'The stakeholder''s interests, authority or influence bear on the target.', 23),
  ('underpins', 'intelligence', 'underpins', 'rests on', false, false,
   'The target holds only if the assumption is true.', 24),
  ('threatens', 'intelligence', 'threatens', 'is threatened by', false, false,
   'If the risk occurs, the target is undermined.', 25),
  ('constrains', 'intelligence', 'constrains', 'is constrained by', false, false,
   'The target must be designed within the constraint.', 26),
  ('mitigates', 'intelligence', 'mitigates', 'is mitigated by', false, false,
   'The source reduces the probability or impact of the risk.', 27),
  ('affects', 'intelligence', 'affects', 'is affected by', false, false,
   'Broader Project Intelligence impact: the record has a material bearing on the target that a more specific relationship (underpins, threatens, constrains, mitigates, addresses) does not capture. The standard link from a Decision to what its outcome changes.', 28),
  ('addresses', 'intelligence', 'addresses', 'is addressed by', false, false,
   'The recommendation proposes a course of action in response to, or intended to change, the target.', 29),
  ('supersedes', 'lineage', 'supersedes', 'is superseded by', false, true,
   'Conceptual replacement: one distinct architecture element replaces another distinct element, which moves to superseded. Not version lineage. Written only by the supersede operation.', 30),
  ('conflicts_with', 'lineage', 'conflicts with', 'conflicts with', true, false,
   'An architect has recognized a tension between the two. Recorded explicitly so it is resolved deliberately, and later available to coherence analysis.', 31);

-- Pairing rules from proposal §9, expanded to concrete kinds and types.
-- Tokens: an object type, a record kind, @knowledge, @capability,
-- @strategic_model, @application (all core types of a domain), @core,
-- @record, @element; a leading '-' excludes.
create function pg_temp.expand_tokens(tokens text[])
returns table (kind public.element_kind, object_type text)
language plpgsql
as $$
declare
  t text;
  neg boolean;
  records text[] := array['assumption', 'risk', 'constraint', 'dependency', 'decision', 'recommendation'];
begin
  create temp table if not exists pg_temp.tok_inc (kind public.element_kind, object_type text, ord serial);
  create temp table if not exists pg_temp.tok_exc (kind public.element_kind, object_type text);
  truncate pg_temp.tok_inc, pg_temp.tok_exc;
  foreach t in array tokens loop
    neg := left(t, 1) = '-';
    t := ltrim(t, '-');
    if neg then
      insert into pg_temp.tok_exc
      select x.kind, x.object_type from pg_temp.token_items(t) x;
    else
      insert into pg_temp.tok_inc (kind, object_type)
      select x.kind, x.object_type from pg_temp.token_items(t) x;
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
  from unnest(array['assumption', 'risk', 'constraint', 'dependency', 'decision', 'recommendation']) k
  where t in ('@record', '@element') or k = t;
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

select pg_temp.add_rules('part_of', array['knowledge_area'], array['knowledge_area']);
select pg_temp.add_rules('part_of', array['concept'], array['concept', 'knowledge_area']);
select pg_temp.add_rules('part_of', array['capability'], array['capability']);
select pg_temp.add_rules('part_of', array['application_format'], array['application_format', 'operating_model']);
select pg_temp.add_rules('part_of', array['workflow'], array['operating_model', 'application_format']);
select pg_temp.add_rules('part_of', array['governance_body'], array['governance_body']);
select pg_temp.add_rules('specializes', array['concept'], array['concept']);
select pg_temp.add_rules('precedes', array['talent_stage'], array['talent_stage']);
select pg_temp.add_rules('precedes', array['scaling_stage'], array['scaling_stage']);
select pg_temp.add_rules('gap_in', array['capability_gap'], array['capability']);
select pg_temp.add_rules('gap_in', array['knowledge_gap'], array['knowledge_area', 'concept']);
select pg_temp.add_rules('investigates', array['research_question'], array['knowledge_gap', 'knowledge_area', 'concept', 'assumption']);
select pg_temp.add_rules('informs', array['@knowledge'], array['@strategic_model', '@capability', '@application', '@record']);
select pg_temp.add_rules('serves', array['@strategic_model', '-intended_outcome', '@capability', '@application'], array['intended_outcome']);
select pg_temp.add_rules('shapes', array['strategic_model', 'structural_leverage', 'differentiation_logic', 'strategic_implication'], array['@capability', '@application']);
select pg_temp.add_rules('implies', array['strategic_model', 'differentiation_logic', 'structural_leverage'], array['strategic_implication']);
select pg_temp.add_rules('exploits', array['strategic_model', 'differentiation_logic', '@application'], array['structural_leverage']);
select pg_temp.add_rules('positioned_against', array['differentiation_logic', 'strategic_model', 'application_format', 'delivery_mechanism'], array['competitive_factor']);
select pg_temp.add_rules('requires', array['capability'], array['capability', 'skill', 'role', 'knowledge_area']);
select pg_temp.add_rules('requires', array['role'], array['skill']);
select pg_temp.add_rules('requires', array['@application'], array['capability', 'role']);
select pg_temp.add_rules('implemented_through', array['capability'], array['operating_model', 'application_format', 'workflow', 'delivery_mechanism']);
select pg_temp.add_rules('delivered_through', array['operating_model', 'application_format'], array['delivery_mechanism']);
select pg_temp.add_rules('measured_by', array['intended_outcome', 'capability', '@application', '-metric'], array['metric']);
select pg_temp.add_rules('governed_by', array['capability', '@application', '-governance_body', '-decision_right'], array['governance_body', 'decision_right']);
select pg_temp.add_rules('holds', array['governance_body', 'role'], array['decision_right']);
select pg_temp.add_rules('accountable_for', array['role', 'governance_body'], array['capability', 'application_format', 'workflow', 'documentation_protocol', 'metric', 'scaling_stage']);
select pg_temp.add_rules('introduces', array['talent_stage'], array['role', 'capability']);
select pg_temp.add_rules('introduces', array['scaling_stage'], array['role', 'capability', 'application_format', 'delivery_mechanism']);
select pg_temp.add_rules('bounded_by', array['@core', '-system_boundary'], array['system_boundary']);
select pg_temp.add_rules('subject_to', array['@core', '-regulatory_factor', '@record'], array['regulatory_factor']);
select pg_temp.add_rules('documented_by', array['@core', '-documentation_protocol'], array['documentation_protocol']);
select pg_temp.add_rules('has_stake_in', array['stakeholder'], array['@element', '-stakeholder']);
select pg_temp.add_rules('underpins', array['assumption'], array['@core', 'decision', 'recommendation']);
select pg_temp.add_rules('threatens', array['risk'], array['@element', '-risk']);
select pg_temp.add_rules('constrains', array['constraint'], array['@core', 'decision', 'recommendation']);
select pg_temp.add_rules('mitigates', array['@capability', '@application', 'decision', 'recommendation'], array['risk']);
select pg_temp.add_rules('affects', array['@record'], array['@element']);
select pg_temp.add_rules('addresses', array['recommendation'], array['@element', '-recommendation']);
select pg_temp.add_rules('conflicts_with', array['@element'], array['@element']);

-- supersedes: an element of the same kind and, for core objects, the same type.
insert into public.relationship_rules (relationship_type, source_kind, source_object_type, target_kind, target_object_type)
select 'supersedes', 'object', key, 'object', key from public.architecture_object_types
union all
select 'supersedes', k::public.element_kind, null, k::public.element_kind, null
from unnest(array['assumption', 'risk', 'constraint', 'dependency', 'decision', 'recommendation']) k;

drop function pg_temp.add_rules(text, text[], text[]);
drop function pg_temp.expand_tokens(text[]);
drop function pg_temp.token_items(text);

-- -----------------------------------------------------------------------------
-- 4. Tables
-- -----------------------------------------------------------------------------

-- The element spine (ADR-0013). Domain is not here: core objects carry
-- exactly one (architecture_objects); records carry zero or more
-- (intelligence_record_domains).
create table public.architecture_elements (
  id                   uuid primary key default gen_random_uuid(),
  engagement_id        uuid not null references public.engagements (id) on delete restrict,
  kind                 public.element_kind not null,
  reference_code       text check (reference_code ~ '^[A-Z]{3}-[0-9]{3,}$'),
  title                text not null check (char_length(btrim(title)) between 1 and 200),
  summary              text not null default '' check (char_length(summary) <= 4000),
  lifecycle            public.element_lifecycle not null default 'draft',
  client_visibility    public.client_visibility not null default 'internal',
  provenance           public.provenance_type not null,
  source_reference     text not null default '' check (char_length(source_reference) <= 1000),
  ip_classification    public.ip_classification not null default 'project_work_product',
  engagement_wide      boolean not null default false,
  owner_user_id        uuid references public.profiles (id) on delete set null,
  methodology_version  text not null default '' check (char_length(methodology_version) <= 40),
  latest_version_id    uuid,
  ai_review_state      public.ai_review_state not null default 'not_applicable',
  ai_reviewed_by       uuid references public.profiles (id) on delete set null,
  ai_reviewed_at       timestamptz,
  retired_at           timestamptz,
  retirement_reason    text check (char_length(retirement_reason) <= 1000),
  created_by           uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at           timestamptz not null default clock_timestamp(),
  updated_by           uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at           timestamptz not null default clock_timestamp(),
  constraint architecture_elements_engagement_key unique (id, engagement_id),
  constraint architecture_elements_kind_key unique (id, engagement_id, kind),
  constraint architecture_elements_code_unique unique (engagement_id, reference_code),
  constraint architecture_elements_scope_records_only check (kind <> 'object' or not engagement_wide),
  constraint architecture_elements_ai_review check (
    (provenance = 'ai_analysis') = (ai_review_state <> 'not_applicable')
  ),
  constraint architecture_elements_recommendation_provenance check (
    kind <> 'recommendation' or provenance = 'architect_judgment'
  ),
  constraint architecture_elements_method_ip_internal check (
    client_visibility = 'internal' or ip_classification <> 'tplco_method_ip'
  ),
  constraint architecture_elements_retired check ((lifecycle = 'retired') = (retired_at is not null))
);
create index architecture_elements_engagement_idx on public.architecture_elements (engagement_id, kind);

-- Core architecture objects: one domain, fixed by the type.
create table public.architecture_objects (
  element_id          uuid primary key,
  engagement_id       uuid not null,
  kind                public.element_kind not null default 'object' check (kind = 'object'),
  domain              public.architecture_domain not null,
  object_type         text not null,
  maturity            public.maturity_state not null default 'undefined',
  maturity_rationale  text not null default '' check (char_length(maturity_rationale) <= 2000),
  attributes          jsonb not null default '{"schema_version": 1}'::jsonb,
  constraint architecture_objects_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade,
  constraint architecture_objects_type_fk foreign key (domain, object_type)
    references public.architecture_object_types (domain, key),
  constraint architecture_objects_maturity_rationale check (
    maturity = 'undefined' or char_length(btrim(maturity_rationale)) > 0
  ),
  constraint architecture_objects_attributes check (
    jsonb_typeof(attributes) = 'object'
    and jsonb_typeof(attributes -> 'schema_version') = 'number'
    and pg_column_size(attributes) <= 32768
  )
);
create index architecture_objects_engagement_idx on public.architecture_objects (engagement_id, domain, object_type);

-- Project Intelligence records: zero or more domains (ADR-0017).
create table public.intelligence_record_domains (
  element_id     uuid not null,
  engagement_id  uuid not null,
  kind           public.element_kind not null check (kind <> 'object'),
  domain         public.architecture_domain not null,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default clock_timestamp(),
  primary key (element_id, domain),
  constraint intelligence_record_domains_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade
);
create index intelligence_record_domains_engagement_idx on public.intelligence_record_domains (engagement_id, domain);

create table public.assumptions (
  element_id         uuid primary key,
  engagement_id      uuid not null,
  kind               public.element_kind not null default 'assumption' check (kind = 'assumption'),
  category           text not null default '' check (char_length(category) <= 100),
  confidence         public.confidence_level not null default 'medium',
  validation_status  public.validation_status not null default 'unvalidated',
  impact_if_false    text not null default '' check (char_length(impact_if_false) <= 2000),
  validation_note    text not null default '' check (char_length(validation_note) <= 2000),
  constraint assumptions_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade
);

create table public.risks (
  element_id     uuid primary key,
  engagement_id  uuid not null,
  kind           public.element_kind not null default 'risk' check (kind = 'risk'),
  category       text not null default '' check (char_length(category) <= 100),
  probability    smallint not null default 3 check (probability between 1 and 5),
  impact         smallint not null default 3 check (impact between 1 and 5),
  severity       smallint generated always as (probability * impact) stored,
  mitigation     text not null default '' check (char_length(mitigation) <= 2000),
  risk_status    public.risk_status not null default 'open',
  constraint risks_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade
);

create table public.constraints (
  element_id         uuid primary key,
  engagement_id      uuid not null,
  kind               public.element_kind not null default 'constraint' check (kind = 'constraint'),
  category           public.constraint_category not null default 'other',
  source             text not null default '' check (char_length(source) <= 1000),
  negotiable         boolean not null default false,
  constraint_status  public.constraint_status not null default 'in_force',
  constraint constraints_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade
);

create table public.dependencies (
  element_id         uuid primary key,
  engagement_id      uuid not null,
  kind               public.element_kind not null default 'dependency' check (kind = 'dependency'),
  from_element_id    uuid not null,
  to_element_id      uuid not null,
  dependency_type    public.dependency_type not null default 'prerequisite',
  blocking           boolean not null default false,
  dependency_status  public.dependency_status not null default 'open',
  constraint dependencies_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade,
  constraint dependencies_from_fk foreign key (from_element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint dependencies_to_fk foreign key (to_element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint dependencies_endpoints check (
    from_element_id <> to_element_id and from_element_id <> element_id and to_element_id <> element_id
  )
);
create index dependencies_from_idx on public.dependencies (from_element_id);
create index dependencies_to_idx on public.dependencies (to_element_id);

create table public.decisions (
  element_id                uuid primary key,
  engagement_id             uuid not null,
  kind                      public.element_kind not null default 'decision' check (kind = 'decision'),
  context                   text not null default '' check (char_length(context) <= 4000),
  decision_status           public.decision_status not null default 'open',
  decision_owner_user_id    uuid references public.profiles (id) on delete set null,
  needed_by                 date,
  downstream_impact         text not null default '' check (char_length(downstream_impact) <= 4000),
  recommended_option_id     uuid,
  recommendation_rationale  text check (char_length(recommendation_rationale) <= 2000),
  recommended_by            uuid references public.profiles (id) on delete set null,
  recommended_at            timestamptz,
  chosen_option_id          uuid,
  decision_note             text check (char_length(decision_note) <= 2000),
  outcome_provenance        public.provenance_type,
  decision_source           public.approval_source,
  decided_by                uuid references public.profiles (id) on delete set null,
  decided_at                timestamptz,
  external_decider_name     text check (char_length(external_decider_name) <= 200),
  external_decided_on       date,
  external_decision_method  public.architecture_approval_method,
  external_evidence         text check (char_length(external_evidence) <= 1000),
  recorded_by               uuid references public.profiles (id) on delete set null,
  recorded_at               timestamptz,
  deferred_reason           text check (char_length(deferred_reason) <= 2000),
  constraint decisions_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade,
  constraint decisions_engagement_key unique (element_id, engagement_id),
  constraint decisions_recommendation_shape check (
    (recommended_option_id is null) = (recommended_at is null)
  ),
  constraint decisions_outcome_shape check (
    (decision_status <> 'decided' and chosen_option_id is null and decision_source is null and outcome_provenance is null)
    or (
      decision_status = 'decided' and chosen_option_id is not null and decided_at is not null
      and outcome_provenance = 'client_decision'
      and (
        (decision_source = 'client_portal' and decided_by is not null and external_decider_name is null
         and recorded_by is null)
        or (
          decision_source = 'external_recorded_by_tplco' and decided_by is null
          and external_decider_name is not null and external_decided_on is not null
          and external_decision_method is not null and external_evidence is not null
          and recorded_by is not null and recorded_at is not null
        )
      )
    )
  ),
  constraint decisions_deferred_reason check (decision_status <> 'deferred' or deferred_reason is not null)
);

create table public.decision_options (
  id                   uuid primary key default gen_random_uuid(),
  engagement_id        uuid not null,
  decision_element_id  uuid not null,
  title                text not null check (char_length(btrim(title)) between 1 and 200),
  description          text not null default '' check (char_length(description) <= 4000),
  tradeoffs            text not null default '' check (char_length(tradeoffs) <= 4000),
  sort_order           int not null default 0,
  created_by           uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at           timestamptz not null default clock_timestamp(),
  updated_at           timestamptz not null default clock_timestamp(),
  constraint decision_options_decision_fk foreign key (decision_element_id, engagement_id)
    references public.decisions (element_id, engagement_id) on delete cascade,
  constraint decision_options_decision_key unique (id, decision_element_id)
);
create index decision_options_decision_idx on public.decision_options (decision_element_id);

alter table public.decisions
  add constraint decisions_recommended_option_fk foreign key (recommended_option_id, element_id)
    references public.decision_options (id, decision_element_id) deferrable initially deferred,
  add constraint decisions_chosen_option_fk foreign key (chosen_option_id, element_id)
    references public.decision_options (id, decision_element_id) deferrable initially deferred;

create table public.recommendations (
  element_id     uuid primary key,
  engagement_id  uuid not null,
  kind           public.element_kind not null default 'recommendation' check (kind = 'recommendation'),
  rationale      text not null default '' check (char_length(rationale) <= 4000),
  priority       public.recommendation_priority not null default 'important',
  constraint recommendations_element_fk foreign key (element_id, engagement_id, kind)
    references public.architecture_elements (id, engagement_id, kind) on delete cascade
);

-- Material statements (ADR-0015).
create table public.architecture_statements (
  id                uuid primary key default gen_random_uuid(),
  engagement_id     uuid not null,
  element_id        uuid not null,
  statement_kind    public.statement_kind not null,
  body              text not null check (char_length(btrim(body)) between 1 and 4000),
  provenance        public.provenance_type not null,
  source_reference  text not null default '' check (char_length(source_reference) <= 1000),
  client_visible    boolean not null default false,
  ai_review_state   public.ai_review_state not null default 'not_applicable',
  ai_reviewed_by    uuid references public.profiles (id) on delete set null,
  ai_reviewed_at    timestamptz,
  sort_order        int not null default 0,
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default clock_timestamp(),
  updated_at        timestamptz not null default clock_timestamp(),
  constraint architecture_statements_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete cascade,
  constraint architecture_statements_engagement_key unique (id, engagement_id),
  constraint architecture_statements_ai_review check (
    (provenance = 'ai_analysis') = (ai_review_state <> 'not_applicable')
  )
);
create index architecture_statements_element_idx on public.architecture_statements (element_id, sort_order);

-- Evidence: a source system, not architecture elements.
create table public.evidence_sources (
  id                  uuid primary key default gen_random_uuid(),
  engagement_id       uuid not null references public.engagements (id) on delete restrict,
  title               text not null check (char_length(btrim(title)) between 1 and 300),
  source_type         public.evidence_source_type not null,
  provenance          public.provenance_type not null check (
    provenance in ('client_source', 'public_source', 'architect_observation', 'architect_judgment', 'system_derived')
  ),
  reference           text not null default '' check (char_length(reference) <= 1000),
  url                 text check (url ~ '^https://[^\s]+$' and char_length(url) <= 2000),
  publisher_author    text not null default '' check (char_length(publisher_author) <= 300),
  source_date         date,
  accessed_date       date,
  external_reference  text not null default '' check (char_length(external_reference) <= 500),
  notes               text not null default '' check (char_length(notes) <= 4000),
  summary             text not null default '' check (char_length(summary) <= 4000),
  ip_classification   public.ip_classification not null default 'project_work_product',
  client_visibility   public.client_visibility not null default 'internal',
  created_by          uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default clock_timestamp(),
  updated_at          timestamptz not null default clock_timestamp(),
  constraint evidence_sources_engagement_key unique (id, engagement_id),
  constraint evidence_sources_method_ip_internal check (
    client_visibility = 'internal' or ip_classification <> 'tplco_method_ip'
  )
);
create index evidence_sources_engagement_idx on public.evidence_sources (engagement_id);

create table public.statement_evidence_links (
  id                  uuid primary key default gen_random_uuid(),
  engagement_id       uuid not null,
  statement_id        uuid not null,
  evidence_source_id  uuid not null,
  stance              public.evidence_stance not null default 'supports',
  locator             text not null default '' check (char_length(locator) <= 300),
  note                text not null default '' check (char_length(note) <= 1000),
  created_by          uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default clock_timestamp(),
  constraint statement_evidence_links_statement_fk foreign key (statement_id, engagement_id)
    references public.architecture_statements (id, engagement_id) on delete cascade,
  constraint statement_evidence_links_source_fk foreign key (evidence_source_id, engagement_id)
    references public.evidence_sources (id, engagement_id) on delete restrict,
  constraint statement_evidence_links_unique unique (statement_id, evidence_source_id)
);
create index statement_evidence_links_source_idx on public.statement_evidence_links (evidence_source_id);

create table public.element_evidence_links (
  id                  uuid primary key default gen_random_uuid(),
  engagement_id       uuid not null,
  element_id          uuid not null,
  evidence_source_id  uuid not null,
  stance              public.evidence_stance not null default 'supports',
  locator             text not null default '' check (char_length(locator) <= 300),
  note                text not null default '' check (char_length(note) <= 1000),
  created_by          uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default clock_timestamp(),
  constraint element_evidence_links_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete cascade,
  constraint element_evidence_links_source_fk foreign key (evidence_source_id, engagement_id)
    references public.evidence_sources (id, engagement_id) on delete restrict,
  constraint element_evidence_links_unique unique (element_id, evidence_source_id)
);
create index element_evidence_links_source_idx on public.element_evidence_links (evidence_source_id);

-- Method lineage: internal only (ADR-0022).
create table public.element_method_lineage (
  id               uuid primary key default gen_random_uuid(),
  engagement_id    uuid not null,
  element_id       uuid not null,
  method_asset_id  uuid not null references public.method_assets (id) on delete restrict,
  method_version   text not null default '' check (char_length(method_version) <= 40),
  note             text not null default '' check (char_length(note) <= 1000),
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default clock_timestamp(),
  constraint element_method_lineage_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete cascade,
  constraint element_method_lineage_unique unique (element_id, method_asset_id)
);

-- Typed relationships (ADR-0018).
create table public.architecture_relationships (
  id                    uuid primary key default gen_random_uuid(),
  engagement_id         uuid not null references public.engagements (id) on delete restrict,
  source_element_id     uuid not null,
  target_element_id     uuid not null,
  relationship_type     text not null references public.relationship_types (key),
  required_proficiency  public.skill_proficiency,
  description           text not null default '' check (char_length(description) <= 2000),
  provenance            public.provenance_type not null,
  source_reference      text not null default '' check (char_length(source_reference) <= 1000),
  client_visibility     public.client_visibility not null default 'internal',
  published_at          timestamptz,
  published_by          uuid references public.profiles (id) on delete set null,
  retired_at            timestamptz,
  retired_by            uuid references public.profiles (id) on delete set null,
  retirement_reason     text check (char_length(retirement_reason) <= 1000),
  created_by            uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at            timestamptz not null default clock_timestamp(),
  updated_at            timestamptz not null default clock_timestamp(),
  constraint architecture_relationships_source_fk foreign key (source_element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete cascade,
  constraint architecture_relationships_target_fk foreign key (target_element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete cascade,
  constraint architecture_relationships_engagement_key unique (id, engagement_id),
  constraint architecture_relationships_not_self check (source_element_id <> target_element_id),
  -- conflicts_with is stored once per pair, in canonical order.
  constraint architecture_relationships_canonical_symmetric check (
    relationship_type <> 'conflicts_with' or source_element_id < target_element_id
  ),
  constraint architecture_relationships_retired check (
    retired_at is null or (published_at is not null and retirement_reason is not null)
  )
);
create unique index architecture_relationships_active_unique
  on public.architecture_relationships (source_element_id, target_element_id, relationship_type)
  where retired_at is null;
create unique index architecture_relationships_conflict_pair
  on public.architecture_relationships (least(source_element_id, target_element_id), greatest(source_element_id, target_element_id))
  where relationship_type = 'conflicts_with' and retired_at is null;
create index architecture_relationships_target_idx on public.architecture_relationships (target_element_id);
create index architecture_relationships_engagement_idx on public.architecture_relationships (engagement_id, relationship_type);

-- Published versions: append-only (ADR-0014, ADR-0021).
create table public.element_versions (
  id                             uuid primary key default gen_random_uuid(),
  engagement_id                  uuid not null,
  element_id                     uuid not null,
  version_no                     int not null check (version_no > 0),
  snapshot                       jsonb not null,
  client_snapshot                jsonb not null,
  client_visible_at_publication  boolean not null,
  change_summary                 text not null default '' check (char_length(change_summary) <= 2000),
  published_by                   uuid references public.profiles (id) on delete set null,
  published_at                   timestamptz not null default clock_timestamp(),
  methodology_version            text not null default '',
  constraint element_versions_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint element_versions_number_unique unique (element_id, version_no),
  constraint element_versions_engagement_key unique (id, engagement_id),
  constraint element_versions_element_key unique (id, element_id)
);

alter table public.architecture_elements
  add constraint architecture_elements_latest_version_fk foreign key (latest_version_id, id)
    references public.element_versions (id, element_id) deferrable initially deferred;

-- Domain maturity: dated architect judgment, append-only (ADR-0019).
create table public.domain_assessments (
  id              uuid primary key default gen_random_uuid(),
  engagement_id   uuid not null references public.engagements (id) on delete restrict,
  domain          public.architecture_domain not null,
  maturity        public.maturity_state not null,
  rationale       text not null check (char_length(btrim(rationale)) between 1 and 4000),
  provenance      public.provenance_type not null default 'architect_judgment' check (provenance = 'architect_judgment'),
  client_visible  boolean not null default true,
  assessed_by     uuid references public.profiles (id) on delete set null,
  assessed_at     timestamptz not null default clock_timestamp(),
  constraint domain_assessments_engagement_key unique (id, engagement_id)
);
create index domain_assessments_latest_idx on public.domain_assessments (engagement_id, domain, assessed_at desc);

-- Baselines: minimal, referencing immutable ids (ADR-0021).
create table public.architecture_baselines (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements (id) on delete restrict,
  label          text not null check (char_length(btrim(label)) between 1 and 200),
  description    text not null default '' check (char_length(description) <= 2000),
  status         public.baseline_status not null default 'draft',
  frozen_by      uuid references public.profiles (id) on delete set null,
  frozen_at      timestamptz,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default clock_timestamp(),
  updated_at     timestamptz not null default clock_timestamp(),
  constraint architecture_baselines_engagement_key unique (id, engagement_id),
  constraint architecture_baselines_frozen check ((status = 'frozen') = (frozen_at is not null))
);

create table public.architecture_baseline_items (
  baseline_id         uuid not null,
  engagement_id       uuid not null,
  element_id          uuid not null,
  element_version_id  uuid not null,
  primary key (baseline_id, element_id),
  constraint architecture_baseline_items_baseline_fk foreign key (baseline_id, engagement_id)
    references public.architecture_baselines (id, engagement_id) on delete cascade,
  constraint architecture_baseline_items_version_fk foreign key (element_version_id, element_id)
    references public.element_versions (id, element_id) on delete restrict,
  constraint architecture_baseline_items_version_engagement_fk foreign key (element_version_id, engagement_id)
    references public.element_versions (id, engagement_id) on delete restrict
);

create table public.architecture_baseline_relationships (
  baseline_id      uuid not null,
  engagement_id    uuid not null,
  relationship_id  uuid not null,
  primary key (baseline_id, relationship_id),
  constraint architecture_baseline_relationships_baseline_fk foreign key (baseline_id, engagement_id)
    references public.architecture_baselines (id, engagement_id) on delete cascade,
  constraint architecture_baseline_relationships_relationship_fk foreign key (relationship_id, engagement_id)
    references public.architecture_relationships (id, engagement_id) on delete restrict
);

create table public.architecture_baseline_assessments (
  baseline_id           uuid not null,
  engagement_id         uuid not null,
  domain_assessment_id  uuid not null,
  primary key (baseline_id, domain_assessment_id),
  constraint architecture_baseline_assessments_baseline_fk foreign key (baseline_id, engagement_id)
    references public.architecture_baselines (id, engagement_id) on delete cascade,
  constraint architecture_baseline_assessments_assessment_fk foreign key (domain_assessment_id, engagement_id)
    references public.domain_assessments (id, engagement_id) on delete restrict
);

-- Client approvals of an exact published version or frozen baseline.
create table public.architecture_approvals (
  id                        uuid primary key default gen_random_uuid(),
  engagement_id             uuid not null references public.engagements (id) on delete restrict,
  element_version_id        uuid,
  baseline_id               uuid,
  requested_by              uuid references public.profiles (id) on delete set null,
  requested_at              timestamptz not null default clock_timestamp(),
  request_note              text not null default '' check (char_length(request_note) <= 2000),
  response                  public.approval_response,
  comment                   text check (char_length(comment) <= 2000),
  responded_by              uuid references public.profiles (id) on delete set null,
  responded_at              timestamptz,
  approval_source           public.approval_source,
  external_approver_name    text check (char_length(external_approver_name) <= 200),
  external_approver_title   text check (char_length(external_approver_title) <= 200),
  external_approved_on      date,
  external_approval_method  public.architecture_approval_method,
  external_evidence         text check (char_length(external_evidence) <= 1000),
  recorded_by               uuid references public.profiles (id) on delete set null,
  recorded_at               timestamptz,
  constraint architecture_approvals_version_fk foreign key (element_version_id, engagement_id)
    references public.element_versions (id, engagement_id) on delete restrict,
  constraint architecture_approvals_baseline_fk foreign key (baseline_id, engagement_id)
    references public.architecture_baselines (id, engagement_id) on delete restrict,
  constraint architecture_approvals_one_target check (num_nonnulls(element_version_id, baseline_id) = 1),
  constraint architecture_approvals_response_shape check (
    (response is null and approval_source is null and responded_at is null and responded_by is null
     and recorded_by is null and external_approver_name is null)
    or (
      response is not null and approval_source = 'client_portal' and responded_by is not null
      and responded_at is not null and external_approver_name is null and recorded_by is null
    )
    or (
      response is not null and approval_source = 'external_recorded_by_tplco' and responded_by is null
      and responded_at is not null and external_approver_name is not null and external_approved_on is not null
      and external_approval_method is not null and external_evidence is not null
      and recorded_by is not null and recorded_at is not null
    )
  ),
  constraint architecture_approvals_changes_comment check (
    response is distinct from 'changes_requested' or char_length(btrim(coalesce(comment, ''))) > 0
  )
);
create unique index architecture_approvals_one_per_version on public.architecture_approvals (element_version_id)
  where element_version_id is not null;
create unique index architecture_approvals_one_per_baseline on public.architecture_approvals (baseline_id)
  where baseline_id is not null;
create index architecture_approvals_engagement_idx on public.architecture_approvals (engagement_id);

-- Reference-code counters (ADR-0025).
create table public.architecture_reference_counters (
  engagement_id  uuid not null references public.engagements (id) on delete cascade,
  prefix         text not null check (prefix ~ '^[A-Z]{3}$'),
  last_value     int not null check (last_value > 0),
  primary key (engagement_id, prefix)
);

-- -----------------------------------------------------------------------------
-- 5. Operation marker, counters and visibility helpers
-- -----------------------------------------------------------------------------

-- Transaction-local marker: guard triggers let lifecycle, publication,
-- approval and review columns change only while an operation is running.
create function private.begin_architecture_operation()
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.architecture_operation', 'on', true);
$$;

create function private.end_architecture_operation()
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.architecture_operation', 'off', true);
$$;

create function private.in_architecture_operation()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('dsa.architecture_operation', true), 'off') = 'on';
$$;

-- Next permanent reference code for an engagement and prefix (row lock).
create function private.next_reference_code(p_engagement_id uuid, p_prefix text)
returns text
language sql
security definer
set search_path = ''
as $$
  insert into public.architecture_reference_counters as c (engagement_id, prefix, last_value)
  values (p_engagement_id, p_prefix, 1)
  on conflict (engagement_id, prefix) do update set last_value = c.last_value + 1
  returning p_prefix || '-' || lpad(last_value::text, 3, '0');
$$;

-- A published version of this element may be shown to clients.
create function private.element_client_readable(target_element_id uuid)
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

create function private.relationship_client_readable(target_relationship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.architecture_relationships r
    where r.id = target_relationship_id
      and r.published_at is not null
      and r.retired_at is null
      and r.client_visibility = 'client'
      and private.element_client_readable(r.source_element_id)
      and private.element_client_readable(r.target_element_id)
  );
$$;

create function private.approval_client_readable(target_version_id uuid, target_baseline_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_version_id is not null then exists (
      select 1 from public.element_versions v
      where v.id = target_version_id and private.element_client_readable(v.element_id)
    )
    else exists (
      select 1 from public.architecture_baselines b where b.id = target_baseline_id and b.status = 'frozen'
    )
  end;
$$;

-- Clients see only the latest client-visible assessment per domain.
create function private.is_latest_client_assessment(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.domain_assessments a
    where a.id = target_assessment_id
      and a.client_visible
      and not exists (
        select 1 from public.domain_assessments later
        where later.engagement_id = a.engagement_id
          and later.domain = a.domain
          and later.client_visible
          and (later.assessed_at, later.id) > (a.assessed_at, a.id)
      )
  );
$$;

revoke all on function private.begin_architecture_operation() from public, anon, authenticated;
revoke all on function private.end_architecture_operation() from public, anon, authenticated;
revoke all on function private.next_reference_code(uuid, text) from public, anon, authenticated;
revoke all on function private.in_architecture_operation() from public, anon;
revoke all on function private.element_client_readable(uuid) from public, anon;
revoke all on function private.relationship_client_readable(uuid) from public, anon;
revoke all on function private.approval_client_readable(uuid, uuid) from public, anon;
revoke all on function private.is_latest_client_assessment(uuid) from public, anon;
grant execute on function private.in_architecture_operation() to authenticated;
grant execute on function private.element_client_readable(uuid) to authenticated;
grant execute on function private.relationship_client_readable(uuid) to authenticated;
grant execute on function private.approval_client_readable(uuid, uuid) to authenticated;
grant execute on function private.is_latest_client_assessment(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Snapshots. The full snapshot is the element as published; the client
--    snapshot keeps only client-visible statements and evidence and drops
--    internal fields (source references, IP classification, owners, AI review,
--    evidence notes). Rejected or pending AI statements are never included.
-- -----------------------------------------------------------------------------
create function private.build_element_snapshot(p_element_id uuid, p_for_client boolean)
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

create function private.evidence_citation(
  p_source_id uuid,
  p_stance public.evidence_stance,
  p_locator text,
  p_note text,
  p_for_client boolean
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'stance', p_stance,
    'locator', p_locator,
    'source', jsonb_build_object(
      'id', s.id, 'title', s.title, 'source_type', s.source_type, 'provenance', s.provenance,
      'reference', s.reference, 'url', s.url, 'publisher_author', s.publisher_author,
      'source_date', s.source_date
    ) || case when p_for_client then '{}'::jsonb else jsonb_build_object(
      'accessed_date', s.accessed_date, 'external_reference', s.external_reference,
      'ip_classification', s.ip_classification, 'client_visibility', s.client_visibility) end
  ) || case when p_for_client then '{}'::jsonb else jsonb_build_object('note', p_note) end
  from public.evidence_sources s where s.id = p_source_id;
$$;

revoke all on function private.build_element_snapshot(uuid, boolean) from public, anon, authenticated;
revoke all on function private.evidence_citation(uuid, public.evidence_stance, text, text, boolean) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Row preparation and guards
-- -----------------------------------------------------------------------------

-- Engagement owners must be members of the engagement.
create function private.assert_engagement_member(p_engagement_id uuid, p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is not null and not exists (
    select 1 from public.engagement_members
    where engagement_id = p_engagement_id and user_id = p_user_id and status = 'active'
  ) then
    raise exception 'The owner must be an active member of the engagement' using errcode = '23514';
  end if;
end;
$$;

create function private.prepare_architecture_element()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  in_op boolean := private.in_architecture_operation();
begin
  if tg_op = 'DELETE' then
    if old.latest_version_id is not null then
      raise exception 'A published element is retired, never deleted' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    select e.methodology_version into new.methodology_version
    from public.engagements e where e.id = new.engagement_id;
    if not in_op then
      if new.provenance in ('client_decision', 'system_derived') then
        raise exception 'Provenance % is recorded only by DSA OS operations', new.provenance using errcode = '42501';
      end if;
      if new.client_visibility = 'client' and not private.can_publish_architecture(new.engagement_id) then
        raise exception 'Only architecture publishers set client visibility' using errcode = '42501';
      end if;
      new.lifecycle := 'draft';
      new.latest_version_id := null;
      new.retired_at := null;
      new.retirement_reason := null;
    end if;
    new.ai_review_state := case when new.provenance = 'ai_analysis' then 'pending' else 'not_applicable' end;
    new.ai_reviewed_by := null;
    new.ai_reviewed_at := null;
    -- Objects receive their code with their type (architecture_objects).
    new.reference_code := case
      when new.kind = 'object' then null
      else private.next_reference_code(new.engagement_id, public.element_reference_prefix(new.kind, null))
    end;
    if auth.uid() is not null then
      new.created_by := auth.uid();
      new.updated_by := auth.uid();
    end if;
    perform private.assert_engagement_member(new.engagement_id, new.owner_user_id);
    return new;
  end if;

  -- UPDATE
  if new.id <> old.id or new.engagement_id <> old.engagement_id or new.kind <> old.kind
     or new.created_by is distinct from old.created_by or new.created_at <> old.created_at
     or new.methodology_version <> old.methodology_version then
    raise exception 'An element''s identity, engagement and kind never change' using errcode = '23514';
  end if;
  if new.reference_code is distinct from old.reference_code
     and not (old.reference_code is null and current_setting('dsa.assigning_reference', true) = 'on') then
    raise exception 'Reference codes are permanent' using errcode = '23514';
  end if;

  if not in_op then
    if new.lifecycle <> old.lifecycle
       or new.latest_version_id is distinct from old.latest_version_id
       or new.ai_review_state <> old.ai_review_state
       or new.ai_reviewed_by is distinct from old.ai_reviewed_by
       or new.ai_reviewed_at is distinct from old.ai_reviewed_at
       or new.retired_at is distinct from old.retired_at
       or new.retirement_reason is distinct from old.retirement_reason then
      raise exception 'Lifecycle, publication and review change only through architecture operations'
        using errcode = '42501';
    end if;
    if old.lifecycle in ('retired', 'superseded') then
      raise exception 'A retired or superseded element cannot be edited' using errcode = '23514';
    end if;
    if new.client_visibility <> old.client_visibility and not private.can_publish_architecture(new.engagement_id) then
      raise exception 'Only architecture publishers change client visibility' using errcode = '42501';
    end if;
    if new.provenance <> old.provenance then
      if new.provenance in ('client_decision', 'system_derived') then
        raise exception 'Provenance % is recorded only by DSA OS operations', new.provenance using errcode = '42501';
      end if;
      new.ai_review_state := case when new.provenance = 'ai_analysis' then 'pending' else 'not_applicable' end;
      new.ai_reviewed_by := null;
      new.ai_reviewed_at := null;
    end if;
    if new.owner_user_id is distinct from old.owner_user_id then
      perform private.assert_engagement_member(new.engagement_id, new.owner_user_id);
    end if;
    if auth.uid() is not null then
      new.updated_by := auth.uid();
    end if;
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

-- Core objects: the type fixes the domain; the code is assigned here.
create function private.prepare_architecture_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent public.architecture_elements;
  type_version int;
begin
  select * into parent from public.architecture_elements where id = new.element_id;
  if not found then
    raise exception 'Element not found' using errcode = '23503';
  end if;
  new.engagement_id := parent.engagement_id;

  if tg_op = 'UPDATE' then
    if new.element_id <> old.element_id or new.object_type <> old.object_type or new.domain <> old.domain then
      raise exception 'An object''s type and domain never change; supersede it with a new object instead'
        using errcode = '23514';
    end if;
    if parent.lifecycle in ('retired', 'superseded') and not private.in_architecture_operation() then
      raise exception 'A retired or superseded element cannot be edited' using errcode = '23514';
    end if;
  else
    select t.domain, t.attribute_schema_version into new.domain, type_version
    from public.architecture_object_types t where t.key = new.object_type;
    if not found then
      raise exception 'Unknown object type %', new.object_type using errcode = '23503';
    end if;
    if parent.reference_code is null then
      perform set_config('dsa.assigning_reference', 'on', true);
      update public.architecture_elements
      set reference_code = private.next_reference_code(parent.engagement_id,
                                                       public.element_reference_prefix('object', new.domain))
      where id = parent.id;
      perform set_config('dsa.assigning_reference', 'off', true);
    end if;
  end if;

  select t.attribute_schema_version into type_version
  from public.architecture_object_types t where t.key = new.object_type;
  if (new.attributes ->> 'schema_version')::int <> type_version then
    raise exception 'Attributes must use schema version % of %', type_version, new.object_type
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Children of an element: inherit the engagement; frozen once the element
-- is retired or superseded.
create function private.prepare_element_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  parent_id uuid := coalesce(rec ->> 'element_id', rec ->> 'decision_element_id')::uuid;
  parent public.architecture_elements;
begin
  select * into parent from public.architecture_elements where id = parent_id;
  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'Element not found' using errcode = '23503';
  end if;
  if parent.lifecycle in ('retired', 'superseded') and not private.in_architecture_operation() then
    raise exception 'A retired or superseded element cannot be edited' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_table_name = 'intelligence_record_domains' then
    new := jsonb_populate_record(new, jsonb_build_object('engagement_id', parent.engagement_id, 'kind', parent.kind));
  else
    new := jsonb_populate_record(new, jsonb_build_object('engagement_id', parent.engagement_id));
  end if;
  if tg_table_name = 'intelligence_record_domains' and parent.kind = 'object' then
    raise exception 'Core objects take their single domain from their type' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Statement evidence links inherit the engagement of their statement.
create function private.prepare_statement_evidence_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent public.architecture_elements;
begin
  select e.* into parent
  from public.architecture_statements s
  join public.architecture_elements e on e.id = s.element_id
  where s.id = coalesce(new.statement_id, old.statement_id);
  if found and parent.lifecycle in ('retired', 'superseded') and not private.in_architecture_operation() then
    raise exception 'A retired or superseded element cannot be edited' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if not found then
    raise exception 'Statement not found' using errcode = '23503';
  end if;
  new.engagement_id := parent.engagement_id;
  return new;
end;
$$;

-- Statements: provenance rules, the AI review gate and publisher-only visibility.
create function private.guard_architecture_statement()
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
    if new.provenance in ('client_decision', 'system_derived') then
      raise exception 'Provenance % is recorded only by DSA OS operations', new.provenance using errcode = '42501';
    end if;
    if new.client_visible and not private.can_publish_architecture(new.engagement_id) then
      raise exception 'Only architecture publishers make statements client-visible' using errcode = '42501';
    end if;
    new.ai_review_state := case when new.provenance = 'ai_analysis' then 'pending' else 'not_applicable' end;
    new.ai_reviewed_by := null;
    new.ai_reviewed_at := null;
    return new;
  end if;

  if new.element_id <> old.element_id or new.engagement_id <> old.engagement_id then
    raise exception 'A statement stays with its element' using errcode = '23514';
  end if;
  if new.ai_review_state <> old.ai_review_state or new.ai_reviewed_by is distinct from old.ai_reviewed_by
     or new.ai_reviewed_at is distinct from old.ai_reviewed_at then
    raise exception 'AI review is recorded only through review_ai_content' using errcode = '42501';
  end if;
  if new.client_visible <> old.client_visible and not private.can_publish_architecture(new.engagement_id) then
    raise exception 'Only architecture publishers change statement visibility' using errcode = '42501';
  end if;
  if new.provenance <> old.provenance then
    if new.provenance in ('client_decision', 'system_derived') then
      raise exception 'Provenance % is recorded only by DSA OS operations', new.provenance using errcode = '42501';
    end if;
    new.ai_review_state := case when new.provenance = 'ai_analysis' then 'pending' else 'not_applicable' end;
    new.ai_reviewed_by := null;
    new.ai_reviewed_at := null;
  end if;
  -- Editing reviewed AI text sends it back for review.
  if new.provenance = 'ai_analysis' and new.body <> old.body then
    new.ai_review_state := 'pending';
    new.ai_reviewed_by := null;
    new.ai_reviewed_at := null;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function private.guard_evidence_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.client_visibility = 'client' and not private.can_publish_architecture(new.engagement_id) then
      raise exception 'Only architecture publishers make evidence client-visible' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.engagement_id <> old.engagement_id then
    raise exception 'Evidence stays with its engagement' using errcode = '23514';
  end if;
  if new.client_visibility <> old.client_visibility and not private.can_publish_architecture(new.engagement_id) then
    raise exception 'Only architecture publishers change evidence visibility' using errcode = '42501';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- Decisions: outcome, recommendation and status only through operations;
-- a decided or superseded decision is frozen.
create function private.guard_decision()
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
  if (to_jsonb(new) - array['context', 'decision_owner_user_id', 'needed_by', 'downstream_impact'])
     is distinct from (to_jsonb(old) - array['context', 'decision_owner_user_id', 'needed_by', 'downstream_impact']) then
    raise exception 'Recommendations, outcomes and decision status change only through decision operations'
      using errcode = '42501';
  end if;
  if new.decision_owner_user_id is distinct from old.decision_owner_user_id then
    perform private.assert_engagement_member(new.engagement_id, new.decision_owner_user_id);
  end if;
  return new;
end;
$$;

-- Options are editable only while the decision is open.
create function private.guard_decision_option()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.decisions;
begin
  select * into d from public.decisions where element_id = coalesce(new.decision_element_id, old.decision_element_id);
  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'Decision not found' using errcode = '23503';
  end if;
  if d.decision_status <> 'open' and not private.in_architecture_operation() then
    raise exception 'Options can be changed only while the decision is open' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    if old.id in (d.recommended_option_id, d.chosen_option_id) then
      raise exception 'The recommended or chosen option cannot be removed' using errcode = '23514';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.decision_element_id <> old.decision_element_id then
    raise exception 'An option stays with its decision' using errcode = '23514';
  end if;
  new.engagement_id := d.engagement_id;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- Relationships: allowed pairings, canonical symmetric storage, acyclic
-- types, and immutability once published (ADR-0018).
create function private.guard_architecture_relationship()
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
    -- INSERT: symmetric pairs are stored once, in canonical order.
    if new.relationship_type = 'conflicts_with' and new.source_element_id > new.target_element_id then
      swap := new.source_element_id;
      new.source_element_id := new.target_element_id;
      new.target_element_id := swap;
    end if;
    if not in_op then
      if new.relationship_type = 'supersedes' then
        raise exception 'Supersession is recorded only by supersede_element' using errcode = '42501';
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
    -- Serialize structural inserts per engagement, then look for a path back.
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

-- Element versions, approvals, assessments and frozen baselines are written
-- only by operations.
create function private.guard_architecture_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception '% records are never deleted', tg_table_name using errcode = '23514';
  end if;
  if not private.in_architecture_operation() then
    raise exception '% are written only through architecture operations', tg_table_name using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if tg_table_name = 'architecture_approvals' and old.response is not null then
      raise exception 'An approval response is final' using errcode = '23514';
    end if;
    if tg_table_name in ('element_versions', 'domain_assessments') then
      raise exception '% is append-only', tg_table_name using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function private.guard_architecture_baseline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not private.in_architecture_operation() then
      new.status := 'draft';
      new.frozen_by := null;
      new.frozen_at := null;
    end if;
    return new;
  end if;
  if old.status = 'frozen' then
    raise exception 'A frozen baseline cannot change' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.engagement_id <> old.engagement_id then
    raise exception 'A baseline stays with its engagement' using errcode = '23514';
  end if;
  if (new.status <> old.status or new.frozen_at is distinct from old.frozen_at) and not private.in_architecture_operation() then
    raise exception 'Baselines are frozen only through freeze_baseline' using errcode = '42501';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- Baseline contents: items change only while the baseline is a draft;
-- relationships and assessments are captured by freeze_baseline.
create function private.guard_baseline_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.architecture_baselines;
begin
  select * into b from public.architecture_baselines where id = coalesce(new.baseline_id, old.baseline_id);
  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'Baseline not found' using errcode = '23503';
  end if;
  if b.status = 'frozen' then
    raise exception 'A frozen baseline cannot change' using errcode = '23514';
  end if;
  if tg_table_name <> 'architecture_baseline_items' and not private.in_architecture_operation() then
    raise exception '% are captured only by freeze_baseline', tg_table_name using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'Remove the item and add the version you want instead' using errcode = '23514';
  end if;
  new.engagement_id := b.engagement_id;
  return new;
end;
$$;

-- At commit: every element has its subtype row and its reference code.
create function private.check_element_integrity_trigger()
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

-- -----------------------------------------------------------------------------
-- 8. Audit: every table carrying engagement_id is logged (extended to ids
--    named element_id and baseline_id), and provenance changes get their
--    own entry with the old and new value (ADR-0009).
-- -----------------------------------------------------------------------------
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb;
  org_id uuid;
  eng_id uuid;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  case tg_table_name
    when 'organizations' then
      org_id := (rec ->> 'id')::uuid;
    when 'organization_members' then
      org_id := (rec ->> 'organization_id')::uuid;
    when 'engagements' then
      org_id := (rec ->> 'client_organization_id')::uuid;
      eng_id := (rec ->> 'id')::uuid;
    else
      if rec ? 'engagement_id' then
        eng_id := (rec ->> 'engagement_id')::uuid;
        select client_organization_id into org_id from public.engagements where id = eng_id;
      end if;
  end case;

  if org_id is not null and not exists (select 1 from public.organizations where id = org_id) then
    org_id := null;
  end if;
  if eng_id is not null and not exists (select 1 from public.engagements where id = eng_id) then
    eng_id := null;
  end if;

  insert into public.activity_log (
    organization_id, engagement_id, actor_user_id, action_type, entity_type, entity_id, metadata_json
  ) values (
    org_id,
    eng_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce((rec ->> 'id')::uuid, (rec ->> 'element_id')::uuid, (rec ->> 'invoice_id')::uuid,
             (rec ->> 'baseline_id')::uuid),
    case
      when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      else jsonb_build_object('record', rec)
    end
  );

  return null;
end;
$$;

create function private.log_provenance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provenance is distinct from old.provenance then
    insert into public.activity_log (
      organization_id, engagement_id, actor_user_id, action_type, entity_type, entity_id, metadata_json
    )
    select e.client_organization_id, e.id, auth.uid(), 'provenance_changed', tg_table_name, new.id,
           jsonb_build_object('from', old.provenance, 'to', new.provenance)
    from public.engagements e where e.id = new.engagement_id;
  end if;
  return null;
end;
$$;

-- Notes that operations attach to the audit trail.
create function private.log_architecture_event(
  p_engagement_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_metadata jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_log (
    organization_id, engagement_id, actor_user_id, action_type, entity_type, entity_id, metadata_json
  )
  select e.client_organization_id, e.id, auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata
  from public.engagements e where e.id = p_engagement_id;
$$;

revoke all on function private.assert_engagement_member(uuid, uuid) from public, anon, authenticated;
revoke all on function private.log_architecture_event(uuid, text, uuid, text, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. Triggers
-- -----------------------------------------------------------------------------
create trigger architecture_elements_prepare before insert or update or delete on public.architecture_elements
  for each row execute function private.prepare_architecture_element();
create trigger architecture_elements_log after insert or update or delete on public.architecture_elements
  for each row execute function private.log_activity();
create trigger architecture_elements_provenance after update of provenance on public.architecture_elements
  for each row execute function private.log_provenance_change();
create constraint trigger architecture_elements_integrity after insert on public.architecture_elements
  deferrable initially deferred for each row execute function private.check_element_integrity_trigger();

create trigger architecture_objects_prepare before insert or update on public.architecture_objects
  for each row execute function private.prepare_architecture_object();
create trigger architecture_objects_log after insert or update or delete on public.architecture_objects
  for each row execute function private.log_activity();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'intelligence_record_domains', 'assumptions', 'risks', 'constraints', 'dependencies', 'recommendations',
    'architecture_statements', 'element_evidence_links', 'element_method_lineage'
  ] loop
    execute format('create trigger %1$s_prepare before insert or update or delete on public.%1$s
                      for each row execute function private.prepare_element_child()', tbl);
    execute format('create trigger %1$s_log after insert or update or delete on public.%1$s
                      for each row execute function private.log_activity()', tbl);
  end loop;
end;
$$;

create trigger decisions_prepare before insert or update or delete on public.decisions
  for each row execute function private.prepare_element_child();
create trigger decisions_validate before insert or update on public.decisions
  for each row execute function private.guard_decision();
create trigger decisions_log after insert or update or delete on public.decisions
  for each row execute function private.log_activity();

create trigger decision_options_guard before insert or update or delete on public.decision_options
  for each row execute function private.guard_decision_option();
create trigger decision_options_set_created_by before insert on public.decision_options
  for each row execute function private.set_created_by();
create trigger decision_options_log after insert or update or delete on public.decision_options
  for each row execute function private.log_activity();

create trigger architecture_statements_validate before insert or update on public.architecture_statements
  for each row execute function private.guard_architecture_statement();
create trigger architecture_statements_set_created_by before insert on public.architecture_statements
  for each row execute function private.set_created_by();
create trigger architecture_statements_provenance after update of provenance on public.architecture_statements
  for each row execute function private.log_provenance_change();

create trigger evidence_sources_guard before insert or update on public.evidence_sources
  for each row execute function private.guard_evidence_source();
create trigger evidence_sources_set_created_by before insert on public.evidence_sources
  for each row execute function private.set_created_by();
create trigger evidence_sources_log after insert or update or delete on public.evidence_sources
  for each row execute function private.log_activity();

create trigger statement_evidence_links_prepare before insert or update or delete on public.statement_evidence_links
  for each row execute function private.prepare_statement_evidence_link();
create trigger statement_evidence_links_set_created_by before insert on public.statement_evidence_links
  for each row execute function private.set_created_by();
create trigger statement_evidence_links_log after insert or update or delete on public.statement_evidence_links
  for each row execute function private.log_activity();

create trigger element_evidence_links_set_created_by before insert on public.element_evidence_links
  for each row execute function private.set_created_by();
create trigger element_method_lineage_set_created_by before insert on public.element_method_lineage
  for each row execute function private.set_created_by();
create trigger intelligence_record_domains_set_created_by before insert on public.intelligence_record_domains
  for each row execute function private.set_created_by();

create trigger architecture_relationships_guard before insert or update or delete on public.architecture_relationships
  for each row execute function private.guard_architecture_relationship();
create trigger architecture_relationships_set_created_by before insert on public.architecture_relationships
  for each row execute function private.set_created_by();
create trigger architecture_relationships_log after insert or update or delete on public.architecture_relationships
  for each row execute function private.log_activity();
create trigger architecture_relationships_provenance after update of provenance on public.architecture_relationships
  for each row execute function private.log_provenance_change();

create trigger element_versions_guard before insert or update or delete on public.element_versions
  for each row execute function private.guard_architecture_record();
create trigger element_versions_log after insert on public.element_versions
  for each row execute function private.log_activity();

create trigger domain_assessments_guard before insert or update or delete on public.domain_assessments
  for each row execute function private.guard_architecture_record();
create trigger domain_assessments_log after insert on public.domain_assessments
  for each row execute function private.log_activity();

create trigger architecture_approvals_guard before insert or update or delete on public.architecture_approvals
  for each row execute function private.guard_architecture_record();
create trigger architecture_approvals_log after insert or update on public.architecture_approvals
  for each row execute function private.log_activity();

create trigger architecture_baselines_guard before insert or update or delete on public.architecture_baselines
  for each row execute function private.guard_architecture_baseline();
create trigger architecture_baselines_set_created_by before insert on public.architecture_baselines
  for each row execute function private.set_created_by();
create trigger architecture_baselines_log after insert or update or delete on public.architecture_baselines
  for each row execute function private.log_activity();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'architecture_baseline_items', 'architecture_baseline_relationships', 'architecture_baseline_assessments'
  ] loop
    execute format('create trigger %1$s_guard before insert or update or delete on public.%1$s
                      for each row execute function private.guard_baseline_content()', tbl);
    execute format('create trigger %1$s_log after insert or delete on public.%1$s
                      for each row execute function private.log_activity()', tbl);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Privileges. Editors write working content directly (column-limited;
--     ids may be supplied so a client can create a record and its children);
--     lifecycle, publication, approvals, decisions, assessments, baselines'
--     frozen state and AI review go only through the operations in section 12.
-- -----------------------------------------------------------------------------
revoke all on
  public.architecture_object_types, public.relationship_types, public.relationship_rules,
  public.architecture_elements, public.architecture_objects, public.intelligence_record_domains,
  public.assumptions, public.risks, public.constraints, public.dependencies, public.decisions,
  public.decision_options, public.recommendations, public.architecture_statements, public.evidence_sources,
  public.statement_evidence_links, public.element_evidence_links, public.element_method_lineage,
  public.architecture_relationships, public.element_versions, public.domain_assessments,
  public.architecture_baselines, public.architecture_baseline_items, public.architecture_baseline_relationships,
  public.architecture_baseline_assessments, public.architecture_approvals, public.architecture_reference_counters
from anon, authenticated;

grant select on
  public.architecture_object_types, public.relationship_types, public.relationship_rules,
  public.architecture_elements, public.architecture_objects, public.intelligence_record_domains,
  public.assumptions, public.risks, public.constraints, public.dependencies, public.decisions,
  public.decision_options, public.recommendations, public.architecture_statements, public.evidence_sources,
  public.statement_evidence_links, public.element_evidence_links, public.element_method_lineage,
  public.architecture_relationships, public.domain_assessments,
  public.architecture_baselines, public.architecture_baseline_items, public.architecture_baseline_relationships,
  public.architecture_baseline_assessments, public.architecture_approvals
to authenticated;

-- The full snapshot is never granted: internal readers use element_version_snapshot().
grant select (id, engagement_id, element_id, version_no, client_snapshot, client_visible_at_publication,
              change_summary, published_by, published_at, methodology_version)
  on public.element_versions to authenticated;

grant insert (id, engagement_id, kind, title, summary, client_visibility, provenance, source_reference,
              ip_classification, engagement_wide, owner_user_id),
      update (title, summary, client_visibility, provenance, source_reference, ip_classification,
              engagement_wide, owner_user_id),
      delete
  on public.architecture_elements to authenticated;
grant insert (element_id, object_type, maturity, maturity_rationale, attributes),
      update (maturity, maturity_rationale, attributes)
  on public.architecture_objects to authenticated;
grant insert (element_id, domain), delete on public.intelligence_record_domains to authenticated;
grant insert (element_id, category, confidence, validation_status, impact_if_false, validation_note),
      update (category, confidence, validation_status, impact_if_false, validation_note)
  on public.assumptions to authenticated;
grant insert (element_id, category, probability, impact, mitigation, risk_status),
      update (category, probability, impact, mitigation, risk_status)
  on public.risks to authenticated;
grant insert (element_id, category, source, negotiable, constraint_status),
      update (category, source, negotiable, constraint_status)
  on public.constraints to authenticated;
grant insert (element_id, from_element_id, to_element_id, dependency_type, blocking, dependency_status),
      update (from_element_id, to_element_id, dependency_type, blocking, dependency_status)
  on public.dependencies to authenticated;
grant insert (element_id, context, decision_owner_user_id, needed_by, downstream_impact),
      update (context, decision_owner_user_id, needed_by, downstream_impact)
  on public.decisions to authenticated;
grant insert (id, decision_element_id, title, description, tradeoffs, sort_order),
      update (title, description, tradeoffs, sort_order),
      delete
  on public.decision_options to authenticated;
grant insert (element_id, rationale, priority), update (rationale, priority) on public.recommendations to authenticated;
grant insert (id, element_id, statement_kind, body, provenance, source_reference, client_visible, sort_order),
      update (statement_kind, body, provenance, source_reference, client_visible, sort_order),
      delete
  on public.architecture_statements to authenticated;
grant insert (id, engagement_id, title, source_type, provenance, reference, url, publisher_author, source_date,
              accessed_date, external_reference, notes, summary, ip_classification, client_visibility),
      update (title, source_type, provenance, reference, url, publisher_author, source_date, accessed_date,
              external_reference, notes, summary, ip_classification, client_visibility),
      delete
  on public.evidence_sources to authenticated;
grant insert (statement_id, evidence_source_id, stance, locator, note),
      update (stance, locator, note),
      delete
  on public.statement_evidence_links to authenticated;
grant insert (element_id, evidence_source_id, stance, locator, note),
      update (stance, locator, note),
      delete
  on public.element_evidence_links to authenticated;
grant insert (element_id, method_asset_id, method_version, note),
      update (method_version, note),
      delete
  on public.element_method_lineage to authenticated;
grant insert (id, engagement_id, source_element_id, target_element_id, relationship_type, required_proficiency,
              description, provenance, source_reference, client_visibility),
      update (required_proficiency, description, provenance, source_reference, client_visibility),
      delete
  on public.architecture_relationships to authenticated;
grant insert (id, engagement_id, label, description), update (label, description), delete
  on public.architecture_baselines to authenticated;
grant insert (baseline_id, element_id, element_version_id), delete on public.architecture_baseline_items to authenticated;

-- -----------------------------------------------------------------------------
-- 11. Row Level Security
--     Live tables: internal readers only (no client policy at all).
--     Clients: published versions of client-visible elements, approvals on
--     them, frozen baselines, and the latest client-visible domain states.
-- -----------------------------------------------------------------------------
alter table public.architecture_object_types enable row level security;
alter table public.relationship_types enable row level security;
alter table public.relationship_rules enable row level security;
alter table public.architecture_reference_counters enable row level security;
alter table public.element_versions enable row level security;
alter table public.domain_assessments enable row level security;
alter table public.architecture_baselines enable row level security;
alter table public.architecture_baseline_items enable row level security;
alter table public.architecture_baseline_relationships enable row level security;
alter table public.architecture_baseline_assessments enable row level security;
alter table public.architecture_approvals enable row level security;

create policy "object types: readable reference data"
  on public.architecture_object_types for select to authenticated using (true);
create policy "relationship types: readable reference data"
  on public.relationship_types for select to authenticated using (true);
create policy "relationship rules: readable reference data"
  on public.relationship_rules for select to authenticated using (true);

-- Live working tables: read by internal members with engagement access;
-- written by edit_architecture holders. Guards decide what may change.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'architecture_elements', 'architecture_objects', 'intelligence_record_domains', 'assumptions', 'risks',
    'constraints', 'dependencies', 'decisions', 'decision_options', 'recommendations', 'architecture_statements',
    'evidence_sources', 'statement_evidence_links', 'element_evidence_links', 'element_method_lineage',
    'architecture_relationships'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('create policy "%s: internal readers" on public.%I for select to authenticated
                      using (private.can_read_architecture(engagement_id))', tbl, tbl);
    execute format('create policy "%s: editors add" on public.%I for insert to authenticated
                      with check (private.can_edit_architecture(engagement_id))', tbl, tbl);
    execute format('create policy "%s: editors change" on public.%I for update to authenticated
                      using (private.can_edit_architecture(engagement_id))
                      with check (private.can_edit_architecture(engagement_id))', tbl, tbl);
  end loop;
end;
$$;

-- Subtype rows are removed with their element, never on their own.
create policy "architecture_elements: editors remove unpublished"
  on public.architecture_elements for delete to authenticated
  using (private.can_edit_architecture(engagement_id) and latest_version_id is null);
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'intelligence_record_domains', 'decision_options', 'architecture_statements', 'evidence_sources',
    'statement_evidence_links', 'element_evidence_links', 'element_method_lineage'
  ] loop
    execute format('create policy "%s: editors remove" on public.%I for delete to authenticated
                      using (private.can_edit_architecture(engagement_id))', tbl, tbl);
  end loop;
end;
$$;
create policy "architecture_relationships: editors remove unpublished"
  on public.architecture_relationships for delete to authenticated
  using (private.can_edit_architecture(engagement_id) and published_at is null);

-- Evidence sources and child tables inherit engagement_id by trigger; the
-- insert check above runs after BEFORE triggers, so it sees the inherited value.

-- Published versions --------------------------------------------------------------
create policy "element versions: internal readers and client viewers"
  on public.element_versions for select to authenticated
  using (
    private.can_read_architecture(engagement_id)
    or (private.can_view_client_architecture(engagement_id) and private.element_client_readable(element_id))
  );

-- Domain assessments ----------------------------------------------------------------
create policy "domain assessments: internal readers; client members see latest"
  on public.domain_assessments for select to authenticated
  using (
    private.can_read_architecture(engagement_id)
    or (private.is_engagement_client_member(engagement_id) and private.is_latest_client_assessment(id))
  );

-- Approvals ---------------------------------------------------------------------------
create policy "approvals: internal readers and client viewers"
  on public.architecture_approvals for select to authenticated
  using (
    private.can_read_architecture(engagement_id)
    or (
      private.can_view_client_architecture(engagement_id)
      and private.approval_client_readable(element_version_id, baseline_id)
    )
  );

-- Baselines ---------------------------------------------------------------------------
create policy "baselines: internal readers; clients see frozen baselines"
  on public.architecture_baselines for select to authenticated
  using (
    private.can_read_architecture(engagement_id)
    or (private.can_view_client_architecture(engagement_id) and status = 'frozen')
  );
create policy "baselines: editors create drafts"
  on public.architecture_baselines for insert to authenticated
  with check (private.can_edit_architecture(engagement_id) and status = 'draft');
create policy "baselines: editors change drafts"
  on public.architecture_baselines for update to authenticated
  using (private.can_edit_architecture(engagement_id) and status = 'draft')
  with check (private.can_edit_architecture(engagement_id));
create policy "baselines: editors remove drafts"
  on public.architecture_baselines for delete to authenticated
  using (private.can_edit_architecture(engagement_id) and status = 'draft');

create policy "baseline items: internal readers and client viewers"
  on public.architecture_baseline_items for select to authenticated
  using (
    private.can_read_architecture(engagement_id)
    or (
      private.can_view_client_architecture(engagement_id)
      and private.element_client_readable(element_id)
      and exists (select 1 from public.architecture_baselines b where b.id = baseline_id and b.status = 'frozen')
    )
  );
create policy "baseline items: editors choose versions for drafts"
  on public.architecture_baseline_items for insert to authenticated
  with check (private.can_edit_architecture(engagement_id));
create policy "baseline items: editors remove from drafts"
  on public.architecture_baseline_items for delete to authenticated
  using (private.can_edit_architecture(engagement_id));

create policy "baseline relationships: internal readers and client viewers"
  on public.architecture_baseline_relationships for select to authenticated
  using (
    private.can_read_architecture(engagement_id)
    or (private.can_view_client_architecture(engagement_id) and private.relationship_client_readable(relationship_id))
  );

create policy "baseline assessments: internal readers and client viewers"
  on public.architecture_baseline_assessments for select to authenticated
  using (
    private.can_read_architecture(engagement_id)
    or (
      private.can_view_client_architecture(engagement_id)
      and exists (select 1 from public.domain_assessments a where a.id = domain_assessment_id and a.client_visible)
    )
  );

-- Counters: no policies; written only by the definer code generator.

-- -----------------------------------------------------------------------------
-- 12. Operations. Each marks the transaction as an architecture operation,
--     locks the element (or baseline, or approval) row, checks capabilities,
--     validates, writes, and clears the mark before returning.
--     Errors: 42501 permission, 23514 rule, P0002 not found or not visible.
-- -----------------------------------------------------------------------------
create function private.lock_element(target_element_id uuid)
returns public.architecture_elements
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
begin
  select * into e from public.architecture_elements where id = target_element_id for update;
  if not found then
    raise exception 'Element not found' using errcode = 'P0002';
  end if;
  return e;
end;
$$;

-- Internal callers: the element must be visible (P0002), then the capability (42501).
create function private.require_architecture_capability(
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
    raise exception 'Element not found' using errcode = 'P0002';
  end if;
  if (target_capability = 'edit_architecture' and not private.can_edit_architecture(target_engagement_id))
     or (target_capability = 'publish_architecture' and not private.can_publish_architecture(target_engagement_id)) then
    raise exception 'You do not hold % on this engagement', target_capability using errcode = '42501';
  end if;
end;
$$;

-- A Project Intelligence record must be scoped by domain, element or engagement.
create function private.assert_record_scope(e public.architecture_elements)
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
         and r.relationship_type in ('underpins', 'threatens', 'constrains', 'mitigates', 'affects', 'addresses')
         and (r.source_element_id = e.id or r.target_element_id = e.id)
     ) then
    return;
  end if;
  raise exception '% needs a scope: one or more domains, a related element, or engagement-wide',
    e.reference_code using errcode = '23514';
end;
$$;

revoke all on function private.lock_element(uuid) from public, anon, authenticated;
revoke all on function private.require_architecture_capability(uuid, public.engagement_capability) from public, anon, authenticated;
revoke all on function private.assert_record_scope(public.architecture_elements) from public, anon, authenticated;

-- Lifecycle -----------------------------------------------------------------------
create function public.submit_element_for_review(p_element_id uuid)
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
  perform private.require_architecture_capability(e.engagement_id, 'edit_architecture');
  if e.lifecycle not in ('draft', 'published') then
    raise exception 'Only a draft or a published working copy can be submitted for review' using errcode = '23514';
  end if;
  perform private.assert_record_scope(e);
  update public.architecture_elements set lifecycle = 'in_review' where id = e.id;
  perform private.end_architecture_operation();
end;
$$;

-- Returns a working copy from review: to draft, or to published when an
-- earlier version is already published.
create function public.return_element_to_draft(p_element_id uuid, p_note text)
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
  perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
  if e.lifecycle <> 'in_review' then
    raise exception 'Only an element in review can be returned' using errcode = '23514';
  end if;
  update public.architecture_elements
  set lifecycle = case when latest_version_id is null then 'draft'::public.element_lifecycle else 'published' end
  where id = e.id;
  perform private.log_architecture_event(e.engagement_id, 'architecture_elements', e.id, 'returned_from_review',
    jsonb_build_object('note', coalesce(p_note, '')));
  perform private.end_architecture_operation();
end;
$$;

create function public.publish_element_version(p_element_id uuid, p_change_summary text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  next_no int;
  version_id uuid;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
  if e.lifecycle not in ('draft', 'in_review', 'published') then
    raise exception 'A retired or superseded element cannot be published' using errcode = '23514';
  end if;
  if e.ai_review_state in ('pending', 'rejected') then
    raise exception 'AI analysis must be reviewed and accepted before it is published' using errcode = '23514';
  end if;
  if exists (select 1 from public.architecture_statements where element_id = e.id and ai_review_state = 'pending') then
    raise exception 'Review the AI-analysis statements before publishing' using errcode = '23514';
  end if;
  perform private.assert_record_scope(e);

  select coalesce(max(version_no), 0) + 1 into next_no from public.element_versions where element_id = e.id;
  insert into public.element_versions (
    engagement_id, element_id, version_no, snapshot, client_snapshot, client_visible_at_publication,
    change_summary, published_by, methodology_version
  ) values (
    e.engagement_id, e.id, next_no,
    private.build_element_snapshot(e.id, false),
    private.build_element_snapshot(e.id, true),
    e.client_visibility = 'client',
    coalesce(btrim(p_change_summary), ''),
    auth.uid(),
    e.methodology_version
  )
  returning id into version_id;

  update public.architecture_elements set lifecycle = 'published', latest_version_id = version_id where id = e.id;

  -- Relationships are published once both ends have a published version.
  update public.architecture_relationships r
  set published_at = clock_timestamp(), published_by = auth.uid()
  where r.published_at is null
    and r.retired_at is null
    and (r.source_element_id = e.id or r.target_element_id = e.id)
    and exists (
      select 1 from public.architecture_elements other
      where other.id = case when r.source_element_id = e.id then r.target_element_id else r.source_element_id end
        and other.latest_version_id is not null
    );

  perform private.end_architecture_operation();
  return version_id;
end;
$$;

create function public.retire_element(p_element_id uuid, p_reason text)
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
  perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
  if e.lifecycle = 'retired' then
    raise exception 'The element is already retired' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  update public.architecture_elements
  set lifecycle = 'retired', retired_at = clock_timestamp(), retirement_reason = btrim(p_reason)
  where id = e.id;
  perform private.end_architecture_operation();
end;
$$;

-- p_new_element_id replaces p_old_element_id (same kind and, for objects,
-- the same type: the relationship rules enforce it).
create function public.supersede_element(p_old_element_id uuid, p_new_element_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_e public.architecture_elements;
  new_e public.architecture_elements;
  rel_id uuid;
begin
  perform private.begin_architecture_operation();
  if p_old_element_id = p_new_element_id then
    raise exception 'An element cannot supersede itself' using errcode = '23514';
  end if;
  -- Lock in a stable order so two supersessions cannot deadlock.
  if p_old_element_id < p_new_element_id then
    old_e := private.lock_element(p_old_element_id);
    new_e := private.lock_element(p_new_element_id);
  else
    new_e := private.lock_element(p_new_element_id);
    old_e := private.lock_element(p_old_element_id);
  end if;
  if old_e.engagement_id <> new_e.engagement_id then
    raise exception 'Element not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(old_e.engagement_id, 'publish_architecture');
  if old_e.lifecycle in ('retired', 'superseded') or new_e.lifecycle in ('retired', 'superseded') then
    raise exception 'Retired or superseded elements cannot take part in a supersession' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  insert into public.architecture_relationships (
    engagement_id, source_element_id, target_element_id, relationship_type, description, provenance,
    client_visibility, published_at, published_by
  ) values (
    old_e.engagement_id, new_e.id, old_e.id, 'supersedes', btrim(p_reason), 'architect_judgment',
    case when old_e.client_visibility = 'client' and new_e.client_visibility = 'client'
         then 'client'::public.client_visibility else 'internal' end,
    case when old_e.latest_version_id is not null and new_e.latest_version_id is not null then clock_timestamp() end,
    case when old_e.latest_version_id is not null and new_e.latest_version_id is not null then auth.uid() end
  )
  returning id into rel_id;

  update public.architecture_elements set lifecycle = 'superseded' where id = old_e.id;
  if old_e.kind = 'decision' then
    update public.decisions set decision_status = 'superseded' where element_id = old_e.id;
  end if;
  perform private.end_architecture_operation();
  return rel_id;
end;
$$;

create function public.retire_relationship(p_relationship_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.architecture_relationships;
begin
  perform private.begin_architecture_operation();
  select * into r from public.architecture_relationships where id = p_relationship_id for update;
  if not found then
    raise exception 'Relationship not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(r.engagement_id, 'publish_architecture');
  if r.published_at is null then
    raise exception 'An unpublished relationship is removed, not retired' using errcode = '23514';
  end if;
  if r.retired_at is not null then
    raise exception 'The relationship is already retired' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  update public.architecture_relationships
  set retired_at = clock_timestamp(), retired_by = auth.uid(), retirement_reason = btrim(p_reason)
  where id = r.id;
  perform private.end_architecture_operation();
end;
$$;

-- AI review ---------------------------------------------------------------------------
create function public.review_ai_content(p_element_id uuid, p_statement_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  s public.architecture_statements;
begin
  perform private.begin_architecture_operation();
  if num_nonnulls(p_element_id, p_statement_id) <> 1 or p_accept is null then
    raise exception 'Review exactly one element or statement, accepting or rejecting it' using errcode = '23514';
  end if;
  if p_statement_id is not null then
    select * into s from public.architecture_statements where id = p_statement_id for update;
    if not found then
      raise exception 'Statement not found' using errcode = 'P0002';
    end if;
    perform private.require_architecture_capability(s.engagement_id, 'publish_architecture');
    if s.ai_review_state <> 'pending' then
      raise exception 'Only AI analysis awaiting review can be reviewed' using errcode = '23514';
    end if;
    update public.architecture_statements
    set ai_review_state = case when p_accept then 'accepted'::public.ai_review_state else 'rejected' end,
        ai_reviewed_by = auth.uid(), ai_reviewed_at = clock_timestamp()
    where id = s.id;
  else
    e := private.lock_element(p_element_id);
    perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
    if e.ai_review_state <> 'pending' then
      raise exception 'Only AI analysis awaiting review can be reviewed' using errcode = '23514';
    end if;
    update public.architecture_elements
    set ai_review_state = case when p_accept then 'accepted'::public.ai_review_state else 'rejected' end,
        ai_reviewed_by = auth.uid(), ai_reviewed_at = clock_timestamp()
    where id = e.id;
  end if;
  perform private.end_architecture_operation();
end;
$$;

-- Domain maturity ------------------------------------------------------------------------
create function public.record_domain_assessment(
  p_engagement_id uuid,
  p_domain public.architecture_domain,
  p_maturity public.maturity_state,
  p_rationale text,
  p_client_visible boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  assessment_id uuid;
begin
  perform private.begin_architecture_operation();
  perform private.require_architecture_capability(p_engagement_id, 'publish_architecture');
  if p_domain is null or p_maturity is null or coalesce(btrim(p_rationale), '') = '' then
    raise exception 'A domain, a maturity state and a rationale are required' using errcode = '23514';
  end if;
  insert into public.domain_assessments (engagement_id, domain, maturity, rationale, client_visible, assessed_by)
  values (p_engagement_id, p_domain, p_maturity, btrim(p_rationale), coalesce(p_client_visible, true), auth.uid())
  returning id into assessment_id;
  perform private.end_architecture_operation();
  return assessment_id;
end;
$$;

-- Approvals ---------------------------------------------------------------------------------
-- Validates the target of an approval and returns its engagement.
create function private.lock_approval_target(p_element_version_id uuid, p_baseline_id uuid, p_latest_only boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.element_versions;
  e public.architecture_elements;
  b public.architecture_baselines;
begin
  if num_nonnulls(p_element_version_id, p_baseline_id) <> 1 then
    raise exception 'An approval concerns exactly one published version or frozen baseline' using errcode = '23514';
  end if;
  if p_element_version_id is not null then
    select * into v from public.element_versions where id = p_element_version_id;
    if not found then
      raise exception 'Version not found' using errcode = 'P0002';
    end if;
    e := private.lock_element(v.element_id);
    perform private.require_architecture_capability(e.engagement_id, 'publish_architecture');
    if e.lifecycle = 'retired' then
      raise exception 'A retired element cannot be sent for approval' using errcode = '23514';
    end if;
    if p_latest_only then
      if e.latest_version_id <> v.id then
        raise exception 'Approval is requested for the latest published version' using errcode = '23514';
      end if;
      if e.client_visibility <> 'client' then
        raise exception 'Only a client-visible element can be sent to the client for approval' using errcode = '23514';
      end if;
    end if;
    return e.engagement_id;
  end if;
  select * into b from public.architecture_baselines where id = p_baseline_id for update;
  if not found then
    raise exception 'Baseline not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(b.engagement_id, 'publish_architecture');
  if b.status <> 'frozen' then
    raise exception 'Only a frozen baseline can be approved' using errcode = '23514';
  end if;
  return b.engagement_id;
end;
$$;
revoke all on function private.lock_approval_target(uuid, uuid, boolean) from public, anon, authenticated;

create function public.request_architecture_approval(
  p_element_version_id uuid,
  p_baseline_id uuid,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eng uuid;
  approval_id uuid;
begin
  perform private.begin_architecture_operation();
  eng := private.lock_approval_target(p_element_version_id, p_baseline_id, true);
  if exists (
    select 1 from public.architecture_approvals
    where element_version_id = p_element_version_id or baseline_id = p_baseline_id
  ) then
    raise exception 'An approval has already been requested for this version' using errcode = '23514';
  end if;
  insert into public.architecture_approvals (engagement_id, element_version_id, baseline_id, requested_by, request_note)
  values (eng, p_element_version_id, p_baseline_id, auth.uid(), coalesce(btrim(p_note), ''))
  returning id into approval_id;
  perform private.end_architecture_operation();
  return approval_id;
end;
$$;

-- A client approver responds in the portal. Final once recorded.
create function public.respond_to_architecture_approval(
  p_approval_id uuid,
  p_response public.approval_response,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.architecture_approvals;
begin
  perform private.begin_architecture_operation();
  select * into a from public.architecture_approvals where id = p_approval_id for update;
  if not found
     or not private.can_view_client_architecture(a.engagement_id)
     or not private.approval_client_readable(a.element_version_id, a.baseline_id) then
    raise exception 'Approval request not found' using errcode = 'P0002';
  end if;
  if not private.can_respond_to_architecture(a.engagement_id) then
    raise exception 'You do not have permission to respond to architecture approvals' using errcode = '42501';
  end if;
  if a.response is not null then
    raise exception 'A response has already been recorded; it is final' using errcode = '23514';
  end if;
  if p_response is null then
    raise exception 'Choose Approve or Request changes' using errcode = '23514';
  end if;
  if p_response = 'changes_requested' and coalesce(btrim(p_comment), '') = '' then
    raise exception 'Say what should change' using errcode = '23514';
  end if;
  update public.architecture_approvals
  set response = p_response,
      comment = nullif(btrim(coalesce(p_comment, '')), ''),
      responded_by = auth.uid(),
      responded_at = clock_timestamp(),
      approval_source = 'client_portal'
  where id = a.id;
  perform private.end_architecture_operation();
end;
$$;

-- TPLCo records an approval given outside the portal, with its evidence.
create function public.record_external_architecture_approval(
  p_element_version_id uuid,
  p_baseline_id uuid,
  p_response public.approval_response,
  p_approver_name text,
  p_approver_title text,
  p_approved_on date,
  p_method public.architecture_approval_method,
  p_evidence text,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eng uuid;
  a public.architecture_approvals;
begin
  perform private.begin_architecture_operation();
  eng := private.lock_approval_target(p_element_version_id, p_baseline_id, false);
  if p_response is null or coalesce(btrim(p_approver_name), '') = '' or p_approved_on is null
     or p_method is null or coalesce(btrim(p_evidence), '') = '' then
    raise exception 'The response, approver, approval date, method and evidence are required' using errcode = '23514';
  end if;
  if p_response = 'changes_requested' and coalesce(btrim(p_comment), '') = '' then
    raise exception 'Record what the client asked to change' using errcode = '23514';
  end if;
  select * into a from public.architecture_approvals
  where element_version_id = p_element_version_id or baseline_id = p_baseline_id
  for update;
  if found and a.response is not null then
    raise exception 'A response has already been recorded; it is final' using errcode = '23514';
  end if;
  if not found then
    insert into public.architecture_approvals (engagement_id, element_version_id, baseline_id, requested_by, request_note)
    values (eng, p_element_version_id, p_baseline_id, auth.uid(), '')
    returning * into a;
  end if;
  update public.architecture_approvals
  set response = p_response,
      comment = nullif(btrim(coalesce(p_comment, '')), ''),
      responded_at = clock_timestamp(),
      approval_source = 'external_recorded_by_tplco',
      external_approver_name = btrim(p_approver_name),
      external_approver_title = nullif(btrim(coalesce(p_approver_title, '')), ''),
      external_approved_on = p_approved_on,
      external_approval_method = p_method,
      external_evidence = btrim(p_evidence),
      recorded_by = auth.uid(),
      recorded_at = clock_timestamp()
  where id = a.id;
  perform private.end_architecture_operation();
  return a.id;
end;
$$;

-- Decisions ---------------------------------------------------------------------------------
create function private.lock_decision(p_decision_id uuid)
returns public.decisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.decisions;
begin
  perform private.lock_element(p_decision_id);
  select * into d from public.decisions where element_id = p_decision_id for update;
  if not found then
    raise exception 'Decision not found' using errcode = 'P0002';
  end if;
  return d;
end;
$$;
revoke all on function private.lock_decision(uuid) from public, anon, authenticated;

create function public.set_decision_recommendation(p_decision_id uuid, p_option_id uuid, p_rationale text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.decisions;
begin
  perform private.begin_architecture_operation();
  d := private.lock_decision(p_decision_id);
  perform private.require_architecture_capability(d.engagement_id, 'edit_architecture');
  if d.decision_status not in ('open', 'recommended', 'deferred') then
    raise exception 'Only an undecided decision takes a recommendation' using errcode = '23514';
  end if;
  if not exists (select 1 from public.decision_options where id = p_option_id and decision_element_id = d.element_id) then
    raise exception 'Choose one of this decision''s options' using errcode = '23514';
  end if;
  update public.decisions
  set recommended_option_id = p_option_id,
      recommendation_rationale = nullif(btrim(coalesce(p_rationale, '')), ''),
      recommended_by = auth.uid(),
      recommended_at = clock_timestamp(),
      decision_status = 'recommended',
      deferred_reason = null
  where element_id = d.element_id;
  perform private.end_architecture_operation();
end;
$$;

-- The client's approver chooses one of the published options.
create function public.decide_decision(p_decision_id uuid, p_option_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.decisions;
  e public.architecture_elements;
  published_options jsonb;
begin
  perform private.begin_architecture_operation();
  select * into e from public.architecture_elements where id = p_decision_id;
  if not found or e.kind <> 'decision'
     or not private.can_view_client_architecture(e.engagement_id)
     or not private.element_client_readable(e.id) then
    raise exception 'Decision not found' using errcode = 'P0002';
  end if;
  d := private.lock_decision(p_decision_id);
  if not private.can_respond_to_architecture(d.engagement_id) then
    raise exception 'You do not have permission to decide on this engagement' using errcode = '42501';
  end if;
  if d.decision_status not in ('open', 'recommended', 'deferred') then
    raise exception 'This decision has already been made' using errcode = '23514';
  end if;
  select v.client_snapshot -> 'details' -> 'options' into published_options
  from public.element_versions v join public.architecture_elements el on el.latest_version_id = v.id
  where el.id = d.element_id;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(published_options, '[]'::jsonb)) o
    where o ->> 'id' = p_option_id::text
  ) or not exists (select 1 from public.decision_options where id = p_option_id and decision_element_id = d.element_id) then
    raise exception 'Choose one of the published options' using errcode = '23514';
  end if;
  update public.decisions
  set decision_status = 'decided',
      chosen_option_id = p_option_id,
      decision_note = nullif(btrim(coalesce(p_note, '')), ''),
      outcome_provenance = 'client_decision',
      decision_source = 'client_portal',
      decided_by = auth.uid(),
      decided_at = clock_timestamp(),
      deferred_reason = null
  where element_id = d.element_id;
  perform private.end_architecture_operation();
end;
$$;

create function public.record_external_decision(
  p_decision_id uuid,
  p_option_id uuid,
  p_decider_name text,
  p_decided_on date,
  p_method public.architecture_approval_method,
  p_evidence text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.decisions;
begin
  perform private.begin_architecture_operation();
  d := private.lock_decision(p_decision_id);
  perform private.require_architecture_capability(d.engagement_id, 'publish_architecture');
  if d.decision_status not in ('open', 'recommended', 'deferred') then
    raise exception 'This decision has already been made' using errcode = '23514';
  end if;
  if not exists (select 1 from public.decision_options where id = p_option_id and decision_element_id = d.element_id) then
    raise exception 'Choose one of this decision''s options' using errcode = '23514';
  end if;
  if coalesce(btrim(p_decider_name), '') = '' or p_decided_on is null or p_method is null
     or coalesce(btrim(p_evidence), '') = '' then
    raise exception 'The decider, date, method and evidence are required' using errcode = '23514';
  end if;
  update public.decisions
  set decision_status = 'decided',
      chosen_option_id = p_option_id,
      decision_note = nullif(btrim(coalesce(p_note, '')), ''),
      outcome_provenance = 'client_decision',
      decision_source = 'external_recorded_by_tplco',
      decided_at = clock_timestamp(),
      external_decider_name = btrim(p_decider_name),
      external_decided_on = p_decided_on,
      external_decision_method = p_method,
      external_evidence = btrim(p_evidence),
      recorded_by = auth.uid(),
      recorded_at = clock_timestamp(),
      deferred_reason = null
  where element_id = d.element_id;
  perform private.end_architecture_operation();
end;
$$;

create function public.defer_decision(p_decision_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.decisions;
begin
  perform private.begin_architecture_operation();
  d := private.lock_decision(p_decision_id);
  perform private.require_architecture_capability(d.engagement_id, 'publish_architecture');
  if d.decision_status not in ('open', 'recommended') then
    raise exception 'Only an open decision can be deferred' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  update public.decisions set decision_status = 'deferred', deferred_reason = btrim(p_reason)
  where element_id = d.element_id;
  perform private.end_architecture_operation();
end;
$$;

-- Baselines ------------------------------------------------------------------------------------
-- Freezing captures the published relationships active between the
-- baseline's elements and the current domain assessments.
create function public.freeze_baseline(p_baseline_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.architecture_baselines;
begin
  perform private.begin_architecture_operation();
  select * into b from public.architecture_baselines where id = p_baseline_id for update;
  if not found then
    raise exception 'Baseline not found' using errcode = 'P0002';
  end if;
  perform private.require_architecture_capability(b.engagement_id, 'publish_architecture');
  if b.status <> 'draft' then
    raise exception 'The baseline is already frozen' using errcode = '23514';
  end if;
  if not exists (select 1 from public.architecture_baseline_items where baseline_id = b.id) then
    raise exception 'Choose at least one published version before freezing' using errcode = '23514';
  end if;

  insert into public.architecture_baseline_relationships (baseline_id, engagement_id, relationship_id)
  select b.id, b.engagement_id, r.id
  from public.architecture_relationships r
  where r.engagement_id = b.engagement_id
    and r.published_at is not null
    and r.retired_at is null
    and exists (select 1 from public.architecture_baseline_items i where i.baseline_id = b.id and i.element_id = r.source_element_id)
    and exists (select 1 from public.architecture_baseline_items i where i.baseline_id = b.id and i.element_id = r.target_element_id);

  insert into public.architecture_baseline_assessments (baseline_id, engagement_id, domain_assessment_id)
  select distinct on (a.domain) b.id, b.engagement_id, a.id
  from public.domain_assessments a
  where a.engagement_id = b.engagement_id
  order by a.domain, a.assessed_at desc, a.id desc;

  update public.architecture_baselines set status = 'frozen', frozen_by = auth.uid(), frozen_at = clock_timestamp()
  where id = b.id;
  perform private.end_architecture_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Read models
-- -----------------------------------------------------------------------------

-- Derived approval state of a version or baseline.
create function private.approval_state(p_response public.approval_response, p_exists boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when not p_exists then 'not_requested'
    when p_response is null then 'awaiting_response'
    else p_response::text
  end;
$$;
grant execute on function private.approval_state(public.approval_response, boolean) to authenticated;

-- Internal: the full snapshot of a published version.
create function public.element_version_snapshot(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select v.snapshot from public.element_versions v
  where v.id = p_version_id and private.can_read_architecture(v.engagement_id);
$$;

-- Internal: exactly what publishing the working copy now would show a client.
create function public.preview_client_snapshot(p_element_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.build_element_snapshot(e.id, true) from public.architecture_elements e
  where e.id = p_element_id and private.can_read_architecture(e.engagement_id);
$$;

-- Client: the latest published version of every element the caller may see,
-- with its approval state. SECURITY INVOKER: row-level security decides.
create function public.client_architecture(p_engagement_id uuid)
returns table (
  element_id                  uuid,
  kind                        public.element_kind,
  domain                      public.architecture_domain,
  object_type                 text,
  reference_code              text,
  title                       text,
  version_id                  uuid,
  version_no                  int,
  published_at                timestamptz,
  change_summary              text,
  client_snapshot             jsonb,
  approval_id                 uuid,
  approval_state              text,
  latest_approved_version_no  int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest as (
    select distinct on (v.element_id) v.id, v.element_id, v.version_no, v.published_at, v.change_summary,
           v.client_snapshot
    from public.element_versions v
    where v.engagement_id = p_engagement_id
    order by v.element_id, v.version_no desc
  )
  select l.element_id,
         (l.client_snapshot ->> 'kind')::public.element_kind,
         (l.client_snapshot -> 'details' ->> 'domain')::public.architecture_domain,
         l.client_snapshot -> 'details' ->> 'object_type',
         l.client_snapshot ->> 'reference_code',
         l.client_snapshot ->> 'title',
         l.id, l.version_no, l.published_at, l.change_summary, l.client_snapshot,
         a.id,
         private.approval_state(a.response, a.id is not null),
         (select max(v2.version_no) from public.element_versions v2
          join public.architecture_approvals a2 on a2.element_version_id = v2.id and a2.response = 'approved'
          where v2.element_id = l.element_id)
  from latest l
  left join public.architecture_approvals a on a.element_version_id = l.id
  order by l.client_snapshot ->> 'reference_code';
$$;

-- Client: every published version of one element (history).
create function public.client_element_versions(p_element_id uuid)
returns table (
  version_id       uuid,
  version_no       int,
  published_at     timestamptz,
  change_summary   text,
  client_snapshot  jsonb,
  approval_id      uuid,
  approval_state   text,
  response_comment text,
  responded_at     timestamptz,
  approval_source  public.approval_source
)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.version_no, v.published_at, v.change_summary, v.client_snapshot,
         a.id, private.approval_state(a.response, a.id is not null), a.comment, a.responded_at, a.approval_source
  from public.element_versions v
  left join public.architecture_approvals a on a.element_version_id = v.id
  where v.element_id = p_element_id
  order by v.version_no desc;
$$;

-- Client: published, client-visible, active relationships between visible
-- elements. Definer (clients have no policy on the live table), with the
-- visibility rule applied explicitly.
create function public.client_architecture_relationships(p_engagement_id uuid)
returns table (
  id                    uuid,
  source_element_id     uuid,
  target_element_id     uuid,
  relationship_type     text,
  required_proficiency  public.skill_proficiency,
  description           text,
  provenance            public.provenance_type,
  published_at          timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.source_element_id, r.target_element_id, r.relationship_type, r.required_proficiency,
         r.description, r.provenance, r.published_at
  from public.architecture_relationships r
  where r.engagement_id = p_engagement_id
    and (private.can_view_client_architecture(p_engagement_id) or private.can_read_architecture(p_engagement_id))
    and private.relationship_client_readable(r.id)
  order by r.relationship_type, r.published_at;
$$;

-- Client: decisions the caller may see, with the published options and
-- recommendation and the current outcome.
create function public.client_decisions(p_engagement_id uuid)
returns table (
  element_id             uuid,
  reference_code         text,
  title                  text,
  version_id             uuid,
  context                text,
  needed_by              date,
  options                jsonb,
  recommended_option_id  uuid,
  recommendation_rationale text,
  decision_status        public.decision_status,
  chosen_option_id       uuid,
  decision_note          text,
  decision_source        public.approval_source,
  decided_by_name        text,
  decided_at             timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.reference_code, v.client_snapshot ->> 'title', v.id,
         v.client_snapshot -> 'details' ->> 'context',
         (v.client_snapshot -> 'details' ->> 'needed_by')::date,
         coalesce(v.client_snapshot -> 'details' -> 'options', '[]'::jsonb),
         (v.client_snapshot -> 'details' ->> 'recommended_option_id')::uuid,
         v.client_snapshot -> 'details' ->> 'recommendation_rationale',
         d.decision_status, d.chosen_option_id, d.decision_note, d.decision_source,
         case when d.decision_source = 'client_portal'
              then nullif(btrim(p.first_name || ' ' || p.last_name), '')
              else d.external_decider_name end,
         d.decided_at
  from public.architecture_elements e
  join public.decisions d on d.element_id = e.id
  join public.element_versions v on v.id = e.latest_version_id
  left join public.profiles p on p.id = d.decided_by
  where e.engagement_id = p_engagement_id
    and (private.can_view_client_architecture(p_engagement_id) or private.can_read_architecture(p_engagement_id))
    and private.element_client_readable(e.id)
  order by e.reference_code;
$$;

-- Current domain states the caller may see (the latest per domain).
create function public.architecture_domain_states(p_engagement_id uuid)
returns table (
  assessment_id   uuid,
  domain          public.architecture_domain,
  maturity        public.maturity_state,
  rationale       text,
  client_visible  boolean,
  assessed_at     timestamptz,
  assessed_by     uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (a.domain) a.id, a.domain, a.maturity, a.rationale, a.client_visible, a.assessed_at, a.assessed_by
  from public.domain_assessments a
  where a.engagement_id = p_engagement_id
  order by a.domain, a.assessed_at desc, a.id desc;
$$;

-- Internal: object maturity distribution per domain ("Calculated"; never the
-- domain state itself).
create function public.object_maturity_distribution(p_engagement_id uuid)
returns table (domain public.architecture_domain, maturity public.maturity_state, object_count int)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.domain, o.maturity, count(*)::int
  from public.architecture_objects o
  join public.architecture_elements e on e.id = o.element_id
  where o.engagement_id = p_engagement_id and e.lifecycle not in ('retired', 'superseded')
  group by o.domain, o.maturity
  order by o.domain, o.maturity;
$$;

-- What changed between two baselines, or between a baseline and the current
-- published architecture (p_to_baseline_id null). Set arithmetic over ids.
create function public.compare_baselines(p_from_baseline_id uuid, p_to_baseline_id uuid default null)
returns table (
  subject          text,
  change           text,
  element_id       uuid,
  reference_code   text,
  title            text,
  from_version_id  uuid,
  to_version_id    uuid,
  from_version_no  int,
  to_version_no    int,
  relationship_id  uuid,
  relationship_type text,
  domain           public.architecture_domain,
  from_maturity    public.maturity_state,
  to_maturity      public.maturity_state
)
language sql
stable
security invoker
set search_path = ''
as $$
  with eng as (
    select engagement_id from public.architecture_baselines where id = p_from_baseline_id
  ),
  a_items as (
    select i.element_id, i.element_version_id from public.architecture_baseline_items i
    where i.baseline_id = p_from_baseline_id
  ),
  b_items as (
    select i.element_id, i.element_version_id from public.architecture_baseline_items i
    where i.baseline_id = p_to_baseline_id
    union all
    select e.id, e.latest_version_id from public.architecture_elements e join eng on e.engagement_id = eng.engagement_id
    where p_to_baseline_id is null and e.latest_version_id is not null and e.lifecycle <> 'retired'
  ),
  a_rel as (
    select r.relationship_id from public.architecture_baseline_relationships r where r.baseline_id = p_from_baseline_id
  ),
  b_rel as (
    select r.relationship_id from public.architecture_baseline_relationships r where r.baseline_id = p_to_baseline_id
    union all
    select r.id from public.architecture_relationships r join eng on r.engagement_id = eng.engagement_id
    where p_to_baseline_id is null and r.published_at is not null and r.retired_at is null
  ),
  a_as as (
    select da.id, da.domain, da.maturity
    from public.architecture_baseline_assessments ba
    join public.domain_assessments da on da.id = ba.domain_assessment_id
    where ba.baseline_id = p_from_baseline_id
  ),
  b_as as (
    select da.id, da.domain, da.maturity
    from public.architecture_baseline_assessments ba
    join public.domain_assessments da on da.id = ba.domain_assessment_id
    where ba.baseline_id = p_to_baseline_id
    union all
    select * from (
      select distinct on (da.domain) da.id, da.domain, da.maturity
      from public.domain_assessments da join eng on da.engagement_id = eng.engagement_id
      where p_to_baseline_id is null
      order by da.domain, da.assessed_at desc, da.id desc
    ) latest
  )
  select 'element',
         case when a.element_id is null then 'added' when b.element_id is null then 'removed' else 'changed' end,
         coalesce(a.element_id, b.element_id), e.reference_code, e.title,
         a.element_version_id, b.element_version_id, va.version_no, vb.version_no,
         null::uuid, null::text, null::public.architecture_domain, null::public.maturity_state, null::public.maturity_state
  from a_items a
  full join b_items b on b.element_id = a.element_id
  left join public.architecture_elements e on e.id = coalesce(a.element_id, b.element_id)
  left join public.element_versions va on va.id = a.element_version_id
  left join public.element_versions vb on vb.id = b.element_version_id
  where a.element_id is null or b.element_id is null or a.element_version_id <> b.element_version_id
  union all
  select 'relationship',
         case when a.relationship_id is null then 'added' else 'removed' end,
         null, null, null, null, null, null, null,
         coalesce(a.relationship_id, b.relationship_id), r.relationship_type, null, null, null
  from a_rel a
  full join b_rel b on b.relationship_id = a.relationship_id
  left join public.architecture_relationships r on r.id = coalesce(a.relationship_id, b.relationship_id)
  where a.relationship_id is null or b.relationship_id is null
  union all
  select 'domain',
         case when a.id is null then 'added' when b.id is null then 'removed' else 'changed' end,
         null, null, null, null, null, null, null, null, null,
         coalesce(a.domain, b.domain), a.maturity, b.maturity
  from a_as a
  full join b_as b on b.domain = a.domain
  where a.id is distinct from b.id;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.submit_element_for_review(uuid)',
    'public.return_element_to_draft(uuid, text)',
    'public.publish_element_version(uuid, text)',
    'public.retire_element(uuid, text)',
    'public.supersede_element(uuid, uuid, text)',
    'public.retire_relationship(uuid, text)',
    'public.review_ai_content(uuid, uuid, boolean)',
    'public.record_domain_assessment(uuid, public.architecture_domain, public.maturity_state, text, boolean)',
    'public.request_architecture_approval(uuid, uuid, text)',
    'public.respond_to_architecture_approval(uuid, public.approval_response, text)',
    'public.record_external_architecture_approval(uuid, uuid, public.approval_response, text, text, date, public.architecture_approval_method, text, text)',
    'public.set_decision_recommendation(uuid, uuid, text)',
    'public.decide_decision(uuid, uuid, text)',
    'public.record_external_decision(uuid, uuid, text, date, public.architecture_approval_method, text, text)',
    'public.defer_decision(uuid, text)',
    'public.freeze_baseline(uuid)',
    'public.element_version_snapshot(uuid)',
    'public.preview_client_snapshot(uuid)',
    'public.client_architecture(uuid)',
    'public.client_element_versions(uuid)',
    'public.client_architecture_relationships(uuid)',
    'public.client_decisions(uuid)',
    'public.architecture_domain_states(uuid)',
    'public.object_maturity_distribution(uuid)',
    'public.compare_baselines(uuid, uuid)',
    'public.element_reference_prefix(public.element_kind, public.architecture_domain)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
