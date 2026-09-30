-- =============================================================================
-- Phase 3 architecture integrity (pgTAP). Run with: pnpm db:test
--
-- The structural rules of the Architecture Core: one domain per core object,
-- scoped Project Intelligence records, allowed relationship pairings,
-- acyclic structural types, canonical conflicts, same-engagement links,
-- permanent reference codes, operation-only provenance and lifecycle, the AI
-- review gate, frozen decisions, and no dependency on finance.
--
-- Seed (supabase/seed.sql, "Phase 3"): Meridian district e...01 with
-- CAP-001 Commercial Acquisition b3...201, KNW-001 b3...101, STR-001 b3...301,
-- APP-003 District Development Board b3...403, DEC-001 b3...506, Harbor e...03.
-- =============================================================================
begin;

select plan(73);

create function pg_temp.act_as(user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = user_email;
  if uid is null then
    raise exception 'No seeded user %', user_email;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.reset_actor()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Creates a core object as the current actor and returns its id.
create function pg_temp.new_object(
  p_type text, p_title text, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001',
  p_provenance public.provenance_type default 'architect_judgment'
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
  values (new_id, p_engagement, 'object', p_title, p_provenance);
  insert into public.architecture_objects (element_id, object_type) values (new_id, p_type);
  return new_id;
end;
$$;

-- Creates a Project Intelligence record (with its subtype row) as the current actor.
create function pg_temp.new_record(
  p_kind public.element_kind, p_title text, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001'
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
  values (new_id, p_engagement, p_kind, p_title, 'architect_judgment');
  execute format('insert into public.%I (element_id) values ($1)',
    case p_kind when 'assumption' then 'assumptions' when 'risk' then 'risks' when 'constraint' then 'constraints'
                when 'decision' then 'decisions' when 'recommendation' then 'recommendations' end)
  using new_id;
  return new_id;
end;
$$;

create function pg_temp.link(p_source uuid, p_type text, p_target uuid, p_proficiency public.skill_proficiency default null)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.architecture_relationships (id, engagement_id, source_element_id, target_element_id,
                                                 relationship_type, required_proficiency, provenance)
  select new_id, e.engagement_id, p_source, p_target, p_type, p_proficiency, 'architect_judgment'
  from public.architecture_elements e where e.id = p_source;
  return new_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vocabulary
-- -----------------------------------------------------------------------------
select is((select count(*)::int from public.architecture_object_types), 27, '27 core object types');
select is(
  (select string_agg(domain::text || ':' || n, ',' order by domain)
   from (select domain, count(*) n from public.architecture_object_types group by domain) x),
  'knowledge:8,capability:5,strategic_model:5,application:9',
  'Knowledge 8, Capability 5, Strategic Model 5, Application 9'
);
select is((select count(*)::int from public.relationship_types), 33, '33 relationship types');
select is(
  (select string_agg(key, ',' order by key) from public.relationship_types where is_acyclic),
  'part_of,precedes,specializes,supersedes', 'part_of, specializes, precedes and supersedes are acyclic');
select is((select string_agg(key, ',') from public.relationship_types where is_symmetric), 'conflicts_with',
  'conflicts_with is the only symmetric type');
select is((select count(*)::int from public.relationship_rules), 2130, '2,130 expanded pairing rules');
select is(
  (select string_agg(relationship_type || ':' || n, ',' order by relationship_type)
   from (select relationship_type, count(*) n from public.relationship_rules group by 1) x),
  'accountable_for:12,addresses:33,advances:32,affects:238,bounded_by:26,conflicts_with:1156,constrains:30,'
  || 'delivered_through:2,documented_by:26,exploits:11,gap_in:3,governed_by:16,has_stake_in:33,holds:2,'
  || 'implemented_through:4,implies:3,informs:208,introduces:6,investigates:4,measured_by:10,mitigates:16,part_of:9,'
  || 'positioned_against:4,precedes:2,pursues:16,requires:23,serves:18,shapes:56,specializes:1,subject_to:33,'
  || 'supersedes:34,threatens:33,underpins:30',
  'pairing rules per type match the approved vocabulary (mirrored in src/domain/architecture)'
);

-- -----------------------------------------------------------------------------
-- Domains and scope
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.architecture_objects o
   join public.architecture_object_types t on t.key = o.object_type where o.domain <> t.domain),
  0, 'every core object''s domain is its type''s domain');

select pg_temp.act_as('architect@tplco.test');
select lives_ok($$
  insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
  values ('b4000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'object', 'Talent pipeline', 'architect_judgment');
  insert into public.architecture_objects (element_id, object_type) values ('b4000000-0000-4000-8000-000000000001', 'capability');
$$, 'an editor creates a core object');
select is((select domain::text from public.architecture_objects where element_id = 'b4000000-0000-4000-8000-000000000001'),
  'capability', 'the domain comes from the type');
select is((select reference_code from public.architecture_elements where id = 'b4000000-0000-4000-8000-000000000001'),
  'CAP-008', 'the next Capability code is assigned (CAP-001 to CAP-007 exist)');
select throws_ok($$ update public.architecture_objects set object_type = 'skill'
                    where element_id = 'b4000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'the type cannot be changed through the API');
select pg_temp.reset_actor();
select throws_ok($$ update public.architecture_objects set object_type = 'skill'
                    where element_id = 'b4000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'nor by anyone else: a core object keeps its type and domain');
select throws_ok($$ update public.architecture_elements set reference_code = 'CAP-099'
                    where id = 'b4000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'reference codes are permanent');
select pg_temp.act_as('architect@tplco.test');

select throws_ok($$ insert into public.intelligence_record_domains (element_id, domain)
                    values ('b3000000-0000-4000-8000-000000000201', 'application') $$,
  '23514', null, 'a core object cannot take additional domains');
select is((select count(*)::int from public.intelligence_record_domains
           where element_id = 'b3000000-0000-4000-8000-000000000502'), 2,
  'a risk can span two domains');
select is((select engagement_wide from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000504'),
  true, 'a constraint can be engagement-wide');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
insert into ids values ('unscoped', pg_temp.new_record('assumption', 'Unscoped assumption'));
select throws_ok($$ select public.submit_element_for_review((select id from ids where name = 'unscoped')) $$,
  '23514', null, 'a record with no domain, element or engagement-wide scope cannot leave draft');
insert into public.intelligence_record_domains (element_id, domain) select id, 'knowledge' from ids where name = 'unscoped';
select lives_ok($$ select public.submit_element_for_review((select id from ids where name = 'unscoped')) $$,
  'one domain is enough scope');
insert into ids values ('related', pg_temp.new_record('risk', 'Risk scoped by an element'));
select pg_temp.link((select id from ids where name = 'related'), 'threatens', 'b3000000-0000-4000-8000-000000000201');
select lives_ok($$ select public.submit_element_for_review((select id from ids where name = 'related')) $$,
  'a relationship to an element is enough scope');

-- -----------------------------------------------------------------------------
-- Relationship rules
-- -----------------------------------------------------------------------------
insert into ids values
  ('metric', pg_temp.new_object('metric', 'Test metric')),
  ('stakeholder', pg_temp.new_object('stakeholder', 'Test stakeholder')),
  ('outcome_a', pg_temp.new_object('intended_outcome', 'Outcome A')),
  ('outcome_b', pg_temp.new_object('intended_outcome', 'Outcome B')),
  ('capability', pg_temp.new_object('capability', 'Test capability')),
  ('skill', pg_temp.new_object('skill', 'Test skill')),
  ('role', pg_temp.new_object('role', 'Test role')),
  ('harbor_area', pg_temp.new_object('knowledge_area', 'Harbor area', 'e0000000-0000-4000-8000-000000000003'));

select throws_ok($$ select pg_temp.link((select id from ids where name = 'metric'), 'requires', (select id from ids where name = 'stakeholder')) $$,
  '23514', null, 'a Metric cannot require a Stakeholder');
select throws_ok($$ select pg_temp.link((select id from ids where name = 'outcome_a'), 'measured_by', (select id from ids where name = 'outcome_b')) $$,
  '23514', null, 'an Intended Outcome cannot be measured by another Intended Outcome');
select throws_ok($$ select pg_temp.link('b3000000-0000-4000-8000-000000000501', 'informs', (select id from ids where name = 'capability')) $$,
  '23514', null, 'a Risk cannot inform a Capability');
select throws_ok($$ select pg_temp.link('b3000000-0000-4000-8000-000000000301', 'serves', (select id from ids where name = 'outcome_b')) $$,
  '23514', null, 'an Intended Outcome does not serve another Intended Outcome');
select throws_ok($$ select pg_temp.link('b3000000-0000-4000-8000-000000000503', 'underpins', 'b3000000-0000-4000-8000-000000000504') $$,
  '23514', null, 'an Assumption does not underpin a Constraint');
select lives_ok($$ select pg_temp.link((select id from ids where name = 'capability'), 'requires', (select id from ids where name = 'skill')) $$,
  'a Capability requires a Skill');
select throws_ok($$ select pg_temp.link((select id from ids where name = 'role'), 'requires', (select id from ids where name = 'skill')) $$,
  '23514', null, 'a Role requiring a Skill must state the proficiency');
select lives_ok($$ select pg_temp.link((select id from ids where name = 'role'), 'requires', (select id from ids where name = 'skill'), 'expert') $$,
  'with the proficiency it is accepted');
select throws_ok($$ select pg_temp.link((select id from ids where name = 'capability'), 'requires', (select id from ids where name = 'role'), 'expert') $$,
  '23514', null, 'no other relationship carries a proficiency');
select throws_ok($$ select pg_temp.link((select id from ids where name = 'capability'), 'part_of', (select id from ids where name = 'capability')) $$,
  '23514', null, 'an element cannot relate to itself');
select throws_ok($$ select pg_temp.link((select id from ids where name = 'capability'), 'requires', (select id from ids where name = 'skill')) $$,
  '23505', null, 'the same active relationship cannot be recorded twice');
select throws_ok($$
  insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000101',
          (select id from ids where name = 'harbor_area'), 'part_of', 'architect_judgment') $$,
  '23503', null, 'a relationship cannot cross engagements');
select throws_ok($$ select pg_temp.link('b3000000-0000-4000-8000-000000000201', 'supersedes', (select id from ids where name = 'capability')) $$,
  '42501', null, 'supersedes is written only by supersede_element');

-- -----------------------------------------------------------------------------
-- Acyclic types
-- -----------------------------------------------------------------------------
insert into ids values
  ('area_a', pg_temp.new_object('knowledge_area', 'Area A')),
  ('area_b', pg_temp.new_object('knowledge_area', 'Area B')),
  ('area_c', pg_temp.new_object('knowledge_area', 'Area C')),
  ('concept_a', pg_temp.new_object('concept', 'Concept A')),
  ('concept_b', pg_temp.new_object('concept', 'Concept B')),
  ('stage_a', pg_temp.new_object('scaling_stage', 'Stage A')),
  ('stage_b', pg_temp.new_object('scaling_stage', 'Stage B'));
select pg_temp.link((select id from ids where name = 'area_a'), 'part_of', (select id from ids where name = 'area_b'));
select throws_ok($$ select pg_temp.link((select id from ids where name = 'area_b'), 'part_of', (select id from ids where name = 'area_a')) $$,
  '23514', null, 'part_of refuses a direct cycle');
select pg_temp.link((select id from ids where name = 'area_b'), 'part_of', (select id from ids where name = 'area_c'));
select throws_ok($$ select pg_temp.link((select id from ids where name = 'area_c'), 'part_of', (select id from ids where name = 'area_a')) $$,
  '23514', null, 'part_of refuses a cycle through a longer chain');
select pg_temp.link((select id from ids where name = 'concept_a'), 'specializes', (select id from ids where name = 'concept_b'));
select throws_ok($$ select pg_temp.link((select id from ids where name = 'concept_b'), 'specializes', (select id from ids where name = 'concept_a')) $$,
  '23514', null, 'specializes refuses a cycle');
select pg_temp.link((select id from ids where name = 'stage_a'), 'precedes', (select id from ids where name = 'stage_b'));
select throws_ok($$ select pg_temp.link((select id from ids where name = 'stage_b'), 'precedes', (select id from ids where name = 'stage_a')) $$,
  '23514', null, 'precedes refuses a cycle');
select lives_ok($$ select pg_temp.link((select id from ids where name = 'concept_a'), 'part_of', (select id from ids where name = 'area_a')) $$,
  'a different type may run alongside without forming a cycle');
select pg_temp.reset_actor();
-- supersedes: exercised at trigger level inside an operation.
select pg_temp.act_as('architect@tplco.test');
insert into ids values ('old_metric', pg_temp.new_object('metric', 'Old metric'));
select pg_temp.reset_actor();
select private.begin_architecture_operation();
insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
select 'e0000000-0000-4000-8000-000000000001', (select id from ids where name = 'metric'),
       (select id from ids where name = 'old_metric'), 'supersedes', 'architect_judgment';
select throws_ok($$
  insert into public.architecture_relationships (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  select 'e0000000-0000-4000-8000-000000000001', (select id from ids where name = 'old_metric'),
         (select id from ids where name = 'metric'), 'supersedes', 'architect_judgment' $$,
  '23514', null, 'supersedes refuses a cycle');
select private.end_architecture_operation();
select pg_temp.act_as('architect@tplco.test');

-- -----------------------------------------------------------------------------
-- Canonical conflicts
-- -----------------------------------------------------------------------------
select pg_temp.link(greatest(a.id, b.id), 'conflicts_with', least(a.id, b.id))
from ids a, ids b where a.name = 'outcome_a' and b.name = 'outcome_b';
select is(
  (select count(*)::int from public.architecture_relationships r, ids a, ids b
   where a.name = 'outcome_a' and b.name = 'outcome_b' and r.relationship_type = 'conflicts_with'
     and r.source_element_id = least(a.id, b.id) and r.target_element_id = greatest(a.id, b.id)),
  1, 'a conflict recorded in either order is stored once, in canonical order');
select throws_ok($$ select pg_temp.link(least(a.id, b.id), 'conflicts_with', greatest(a.id, b.id))
                    from ids a, ids b where a.name = 'outcome_a' and b.name = 'outcome_b' $$,
  '23505', null, 'the reversed pair is refused as a duplicate');

-- -----------------------------------------------------------------------------
-- Dependencies
-- -----------------------------------------------------------------------------
insert into ids values ('dep', gen_random_uuid());
insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
select id, 'e0000000-0000-4000-8000-000000000001', 'dependency', 'Test dependency', 'architect_judgment' from ids where name = 'dep';
select throws_ok($$ insert into public.dependencies (element_id, from_element_id, to_element_id)
                    select id, 'b3000000-0000-4000-8000-000000000201', 'b3000000-0000-4000-8000-000000000201' from ids where name = 'dep' $$,
  '23514', null, 'a dependency needs two different elements');
select throws_ok($$ insert into public.dependencies (element_id, from_element_id, to_element_id)
                    select id, id, 'b3000000-0000-4000-8000-000000000201' from ids where name = 'dep' $$,
  '23514', null, 'a dependency cannot depend on itself');
select throws_ok($$ insert into public.dependencies (element_id, from_element_id, to_element_id)
                    select d.id, 'b3000000-0000-4000-8000-000000000201', h.id from ids d, ids h
                    where d.name = 'dep' and h.name = 'harbor_area' $$,
  '23503', null, 'dependency endpoints stay in the engagement');
select lives_ok($$ insert into public.dependencies (element_id, from_element_id, to_element_id)
                   select id, 'b3000000-0000-4000-8000-000000000401', 'b3000000-0000-4000-8000-000000000201' from ids where name = 'dep' $$,
  'a dependency between two elements of the engagement is accepted');

-- -----------------------------------------------------------------------------
-- Provenance, lifecycle and the AI review gate
-- -----------------------------------------------------------------------------
select throws_ok($$ select pg_temp.new_object('metric', 'Typed-in client decision', 'e0000000-0000-4000-8000-000000000001', 'client_decision') $$,
  '42501', null, 'client_decision provenance is refused on direct writes');
select throws_ok($$ insert into public.architecture_statements (element_id, statement_kind, body, provenance)
                    values ('b3000000-0000-4000-8000-000000000201', 'note', 'Computed', 'system_derived') $$,
  '42501', null, 'system_derived provenance is refused on statements');
select throws_ok($$ update public.architecture_statements set provenance = 'client_decision'
                    where id = 'b3000000-0000-4000-8000-000000000802' $$,
  '42501', null, 'and cannot be introduced by an update');
select throws_ok($$ update public.architecture_elements set lifecycle = 'published'
                    where id = 'b4000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'the lifecycle column is not writable through the API');
select pg_temp.reset_actor();
select throws_ok($$ update public.architecture_elements set lifecycle = 'published'
                    where id = 'b4000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'outside an operation even the service role cannot change a lifecycle');
select pg_temp.act_as('architect@tplco.test');

update public.architecture_statements set provenance = 'architect_observation'
where id = 'b3000000-0000-4000-8000-000000000802';
select pg_temp.reset_actor();
select is(
  (select metadata_json from public.activity_log
   where action_type = 'provenance_changed' and entity_id = 'b3000000-0000-4000-8000-000000000802'),
  '{"from": "architect_judgment", "to": "architect_observation"}'::jsonb,
  'a provenance change is audited with the old and new value');
select pg_temp.act_as('architect@tplco.test');

insert into ids values ('ai_object', pg_temp.new_object('metric', 'AI-drafted metric', 'e0000000-0000-4000-8000-000000000001', 'ai_analysis'));
select is((select ai_review_state::text from public.architecture_elements where id = (select id from ids where name = 'ai_object')),
  'pending', 'AI analysis starts pending review');
select throws_ok($$ select public.publish_element_version((select id from ids where name = 'ai_object')) $$,
  '23514', null, 'unreviewed AI analysis cannot be published');
select public.review_ai_content((select id from ids where name = 'ai_object'), null, true);
select lives_ok($$ select public.publish_element_version((select id from ids where name = 'ai_object')) $$,
  'once a publisher accepts it, it can be published');
insert into public.architecture_statements (id, element_id, statement_kind, body, provenance, client_visible)
values ('b4000000-0000-4000-8000-000000000801', 'b3000000-0000-4000-8000-000000000402', 'finding', 'AI draft finding', 'ai_analysis', false);
select throws_ok($$ select public.publish_element_version('b3000000-0000-4000-8000-000000000402') $$,
  '23514', null, 'an element with a pending AI statement cannot be published');
select public.review_ai_content(null, 'b4000000-0000-4000-8000-000000000801', false);
select public.publish_element_version('b3000000-0000-4000-8000-000000000402');
select pg_temp.reset_actor();
select is(
  (select count(*)::int from public.element_versions v, jsonb_array_elements(v.snapshot -> 'statements') s
   where v.element_id = 'b3000000-0000-4000-8000-000000000402' and s ->> 'id' = 'b4000000-0000-4000-8000-000000000801'),
  0, 'a rejected AI statement is never published');
select pg_temp.act_as('architect@tplco.test');

select throws_ok($$ update public.architecture_objects set maturity = 'structured', maturity_rationale = ''
                    where element_id = 'b3000000-0000-4000-8000-000000000202' $$,
  '23514', null, 'maturity above Undefined needs a rationale');
select throws_ok($$ update public.architecture_objects set attributes = '{"schema_version": 2}'
                    where element_id = 'b3000000-0000-4000-8000-000000000202' $$,
  '23514', null, 'attributes must carry the type''s schema version');
select throws_ok($$ update public.architecture_objects set attributes = '["not", "an", "object"]'
                    where element_id = 'b3000000-0000-4000-8000-000000000202' $$,
  '23514', null, 'attributes must be a JSON object');
select throws_ok($$ insert into public.architecture_elements (engagement_id, kind, title, provenance)
                    values ('e0000000-0000-4000-8000-000000000001', 'recommendation', 'Observed', 'architect_observation') $$,
  '23514', null, 'a recommendation is always an architect judgment');
select throws_ok($$ update public.architecture_elements set ip_classification = 'tplco_method_ip'
                    where id = 'b3000000-0000-4000-8000-000000000302' $$,
  '23514', null, 'Method IP can never be client-visible');
select throws_ok($$ insert into public.evidence_sources (engagement_id, title, source_type, provenance, url)
                    values ('e0000000-0000-4000-8000-000000000001', 'Plain link', 'web', 'public_source', 'http://example.org') $$,
  '23514', null, 'evidence links are HTTPS only');
select throws_ok($$ insert into public.evidence_sources (engagement_id, title, source_type, provenance)
                    values ('e0000000-0000-4000-8000-000000000001', 'AI summary', 'other', 'ai_analysis') $$,
  '23514', null, 'evidence sources take only source provenance types');

-- -----------------------------------------------------------------------------
-- Published, retired and decided records
-- -----------------------------------------------------------------------------
delete from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000201';
select is((select count(*)::int from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000201'),
  1, 'an editor cannot delete a published element');
select pg_temp.reset_actor();
select throws_ok($$ delete from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000201' $$,
  '23514', null, 'nor can anyone else: a published element is retired, never deleted');
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ update public.architecture_relationships set description = 'Edited'
                    where source_element_id = 'b3000000-0000-4000-8000-000000000201' and relationship_type = 'measured_by' $$,
  '23514', null, 'a published relationship is immutable');
select public.retire_element('b3000000-0000-4000-8000-000000000108', 'No longer relevant');
select throws_ok($$ update public.architecture_elements set title = 'Renamed' where id = 'b3000000-0000-4000-8000-000000000108' $$,
  '23514', null, 'a retired element cannot be edited');
select throws_ok($$ select public.supersede_element('b3000000-0000-4000-8000-000000000201', (select id from ids where name = 'metric'), 'Replaced') $$,
  '23514', null, 'supersession needs the same kind and type');
select throws_ok($$ insert into public.decision_options (decision_element_id, title)
                    values ('b3000000-0000-4000-8000-000000000506', 'Late option') $$,
  '23514', null, 'options are fixed once a recommendation is made');
select pg_temp.reset_actor();
select pg_temp.act_as('lead@meridian.test');
select public.decide_decision('b3000000-0000-4000-8000-000000000506', 'b3000000-0000-4000-8000-000000000601', 'Board agreed');
select pg_temp.reset_actor();
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ update public.decisions set context = 'Rewritten' where element_id = 'b3000000-0000-4000-8000-000000000506' $$,
  '23514', null, 'a decided decision is frozen');
select pg_temp.reset_actor();
select is((select outcome_provenance::text from public.decisions where element_id = 'b3000000-0000-4000-8000-000000000506'),
  'client_decision', 'the outcome carries client_decision provenance');

-- -----------------------------------------------------------------------------
-- Every element has its subtype row (checked at commit)
-- -----------------------------------------------------------------------------
select throws_ok($$
  insert into public.architecture_elements (engagement_id, kind, title, provenance)
  values ('e0000000-0000-4000-8000-000000000001', 'risk', 'Spine only', 'architect_judgment');
  set constraints architecture_elements_integrity immediate $$,
  '23514', null, 'an element without its subtype row is refused at commit');

-- -----------------------------------------------------------------------------
-- Finance never controls architecture
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_constraint c
   join pg_class src on src.oid = c.conrelid
   join pg_class tgt on tgt.oid = c.confrelid
   where c.contype = 'f'
     and src.relname in ('architecture_elements', 'architecture_objects', 'intelligence_record_domains', 'assumptions',
       'risks', 'constraints', 'dependencies', 'decisions', 'decision_options', 'recommendations',
       'architecture_statements', 'evidence_sources', 'statement_evidence_links', 'element_evidence_links',
       'element_method_lineage', 'architecture_relationships', 'element_versions', 'domain_assessments',
       'architecture_baselines', 'architecture_baseline_items', 'architecture_baseline_relationships',
       'architecture_baseline_assessments', 'architecture_approvals', 'architecture_reference_counters',
       'architecture_object_types', 'relationship_types', 'relationship_rules')
     and tgt.relname in ('contracts', 'change_orders', 'change_order_events', 'payment_milestones', 'invoices',
       'invoice_lines', 'invoice_payment_links', 'credit_notes', 'payments', 'payment_allocations', 'refunds',
       'financial_events', 'finance_notes', 'document_number_counters', 'currencies')),
  0, 'no architecture table has a foreign key into a finance table');

select * from finish();
rollback;
