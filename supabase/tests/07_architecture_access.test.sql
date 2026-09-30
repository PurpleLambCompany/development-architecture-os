-- =============================================================================
-- Phase 3 architecture access (pgTAP). Run with: pnpm db:test
--
-- The capability matrix end to end: who reads the working architecture, who
-- drafts, who publishes, what each client role sees (published, client-visible
-- versions only, whether or not approved), who responds, and what nobody on the
-- client side ever reaches (live tables, full snapshots, Method lineage,
-- internal statements and relationships, other tenants).
--
-- Seed: Meridian district e...01 has 33 published client-visible elements,
-- one internal element (KNW-008), one never-published draft, 33 client-visible
-- published relationships (of 35 published), 2 frozen baselines and 3
-- approvals. Harbor e...03 has 2 published core objects, plus (Phase 5 seed)
-- one held review, one approved deliverable and two published implementation
-- initiatives, all client-visible: 6 client-visible elements in all.
-- =============================================================================
begin;

select plan(66);

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

create function pg_temp.visible(table_name text, engagement uuid)
returns int
language plpgsql
as $$
declare
  n int;
begin
  execute format('select count(*)::int from public.%I where engagement_id = $1', table_name) into n using engagement;
  return n;
end;
$$;

create function pg_temp.client_count(engagement uuid)
returns int
language sql
as $$
  select count(*)::int from public.client_architecture(engagement);
$$;

-- -----------------------------------------------------------------------------
-- Internal roles
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.visible('architecture_elements', 'e0000000-0000-4000-8000-000000000001'), 38,
  'an assigned Architect reads the whole working architecture, drafts and internal content included');
select lives_ok($$ select pg_temp.new_object('capability', 'Architect draft') $$, 'an Architect drafts');
select lives_ok($$ select public.publish_element_version('b3000000-0000-4000-8000-000000000207') $$, 'and publishes');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select is(pg_temp.visible('architecture_elements', 'e0000000-0000-4000-8000-000000000001'), 39,
  'an assigned Researcher reads the working architecture');
select is(pg_temp.visible('element_method_lineage', 'e0000000-0000-4000-8000-000000000001'), 3,
  'and its internal Method lineage');
select lives_ok($$ select pg_temp.new_object('knowledge_area', 'Researcher draft') $$, 'a Researcher drafts');
select lives_ok($$ insert into public.architecture_statements (element_id, statement_kind, body, provenance)
                   values ('b3000000-0000-4000-8000-000000000102', 'finding', 'New finding', 'public_source') $$,
  'and adds statements');
select throws_ok($$ select public.publish_element_version('b3000000-0000-4000-8000-000000000102') $$,
  '42501', null, 'but cannot publish');
select throws_ok($$ update public.architecture_elements set client_visibility = 'internal'
                    where id = 'b3000000-0000-4000-8000-000000000102' $$,
  '42501', null, 'nor change client visibility');
select throws_ok($$ select public.record_domain_assessment('e0000000-0000-4000-8000-000000000001', 'knowledge', 'structured', 'Try') $$,
  '42501', null, 'nor assess a domain');
select throws_ok($$ select public.freeze_baseline('b3000000-0000-4000-8000-000000000902') $$,
  '42501', null, 'nor freeze a baseline');
select throws_ok($$ select public.record_external_architecture_approval(
                      (select latest_version_id from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000302'),
                      null, 'approved', 'Someone', null, current_date, 'email', 'Email') $$,
  '42501', null, 'nor record an external approval');
select is(pg_temp.visible('architecture_elements', 'e0000000-0000-4000-8000-000000000003'), 0,
  'a Researcher reads nothing on an engagement they are not assigned to');
select pg_temp.reset_actor();

select pg_temp.act_as('projectadmin@tplco.test');
select is(pg_temp.visible('architecture_elements', 'e0000000-0000-4000-8000-000000000001'), 40,
  'an assigned Project Administrator reads the working architecture');
select throws_ok($$ select pg_temp.new_object('capability', 'Admin draft') $$,
  '42501', null, 'but neither edits');
select throws_ok($$ select public.submit_element_for_review('b3000000-0000-4000-8000-000000000202') $$,
  '42501', null, 'nor submits for review');
select pg_temp.reset_actor();

select pg_temp.act_as('finance@tplco.test');
select is(pg_temp.visible('architecture_elements', 'e0000000-0000-4000-8000-000000000003'), 0,
  'a Finance Administrator reads no architecture where they are not assigned (financial authority grants none)');
select is(pg_temp.visible('element_versions', 'e0000000-0000-4000-8000-000000000003'), 0,
  'not even published versions');
select throws_ok($$ select pg_temp.new_object('capability', 'Finance draft') $$,
  '42501', null, 'and never edits architecture, even where assigned');
select throws_ok($$ select public.publish_element_version('b3000000-0000-4000-8000-000000000202') $$,
  '42501', null, 'nor publishes it');
select pg_temp.reset_actor();

select pg_temp.act_as('sysadmin@tplco.test');
select is(pg_temp.visible('architecture_elements', 'e0000000-0000-4000-8000-000000000001'), 40,
  'a System Administrator reads every engagement''s architecture');
select throws_ok($$ select pg_temp.new_object('capability', 'Sysadmin draft') $$,
  '42501', null, 'but has no drafting authority by default');
select throws_ok($$ select public.publish_element_version('b3000000-0000-4000-8000-000000000202') $$,
  '42501', null, 'and no publishing authority by default');
select pg_temp.reset_actor();
insert into public.engagement_members (engagement_id, user_id, side, role)
values ('e0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'internal', 'system_administrator');
select pg_temp.act_as('principal@tplco.test');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted, reason)
select id, c, true, 'Covering publication this week'
from public.engagement_members, unnest(array['edit_architecture', 'publish_architecture']::public.engagement_capability[]) c
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000001';
select pg_temp.reset_actor();
select pg_temp.act_as('sysadmin@tplco.test');
select lives_ok($$ select public.publish_element_version('b3000000-0000-4000-8000-000000000202', 'Override') $$,
  'with a TPLCo override on this engagement, a System Administrator can publish');
select throws_ok($$ select public.publish_element_version('b3000000-0000-4000-8000-000000000a01') $$,
  '42501', null, 'the override applies to that engagement only');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select throws_ok($$
  insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
  select id, 'publish_architecture', true from public.engagement_members
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' and user_id = '20000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'publishing authority can never be granted to a client member');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Client roles: publication, not approval, is the boundary
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sponsor@meridian.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 34, 'the Executive Sponsor sees all 34 published elements');
select pg_temp.reset_actor();
select pg_temp.act_as('lead@meridian.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 34, 'the Client Project Lead sees them');
select pg_temp.reset_actor();
select pg_temp.act_as('contributor@meridian.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 10, 'the Client Contributor sees only their area (the Capability domain and its records)');
select pg_temp.reset_actor();
select pg_temp.act_as('viewer@meridian.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 34, 'the Client Viewer sees them all');
select is(
  (select string_agg(approval_state, ',' order by approval_state)
   from (select distinct approval_state from public.client_architecture('e0000000-0000-4000-8000-000000000001')) x),
  'approved,awaiting_response,not_requested',
  'whether approved, awaiting a response, or never sent for approval');
select ok(not exists (select 1 from public.client_architecture('e0000000-0000-4000-8000-000000000001')
                      where reference_code in ('KNW-008', 'CAP-007')),
  'internal elements and unpublished drafts are never shown');

-- Live tables and internal content
select is(pg_temp.visible('architecture_elements', 'e0000000-0000-4000-8000-000000000001'), 0, 'clients read no working copies');
select is(pg_temp.visible('architecture_statements', 'e0000000-0000-4000-8000-000000000001'), 0, 'nor live statements');
select is(pg_temp.visible('architecture_relationships', 'e0000000-0000-4000-8000-000000000001'), 0, 'nor live relationships');
select is(pg_temp.visible('evidence_sources', 'e0000000-0000-4000-8000-000000000001'), 0, 'nor the evidence library');
select is(pg_temp.visible('element_method_lineage', 'e0000000-0000-4000-8000-000000000001'), 0, 'nor Method lineage');
select is((select count(*)::int from public.method_assets), 0, 'nor Method assets');
select is(pg_temp.visible('decisions', 'e0000000-0000-4000-8000-000000000001'), 0, 'nor live decision records');
select throws_ok($$ select snapshot from public.element_versions limit 1 $$,
  '42501', null, 'the full snapshot column is not granted to clients');
select is(public.element_version_snapshot((select id from public.element_versions limit 1)), null,
  'and the internal snapshot read model returns nothing to a client');
select is(public.preview_client_snapshot('b3000000-0000-4000-8000-000000000201'), null,
  'nor does the preview of a working copy');
select is(
  (select count(*)::int from public.client_architecture('e0000000-0000-4000-8000-000000000001') c,
          jsonb_array_elements(c.client_snapshot -> 'statements') s
   where s ->> 'id' = 'b3000000-0000-4000-8000-000000000803'),
  0, 'internal statements are not in the client snapshot');
select is(
  (select count(*)::int from public.client_architecture('e0000000-0000-4000-8000-000000000001') c,
          jsonb_array_elements(c.client_snapshot -> 'evidence_source_ids') s
   where s #>> '{}' in ('b3000000-0000-4000-8000-000000000703', 'b3000000-0000-4000-8000-000000000704')),
  0, 'internal evidence sources are not cited to clients');
select is((select count(*)::int from public.client_architecture_relationships('e0000000-0000-4000-8000-000000000001')), 36,
  'clients see published, client-visible relationships between visible elements');
select ok(not exists (select 1 from public.client_architecture_relationships('e0000000-0000-4000-8000-000000000001')
                      where relationship_type in ('conflicts_with', 'positioned_against')),
  'internal relationships, and relationships to internal elements, are not shown');
select is((select count(*)::int from public.architecture_approvals), 3, 'clients see the approvals on what they can see');
select is((select count(*)::int from public.architecture_baselines), 2, 'and the frozen baselines');
select is((select count(*)::int from public.domain_assessments), 4, 'and only the latest client-visible state per domain');
select is((select maturity::text from public.architecture_domain_states('e0000000-0000-4000-8000-000000000001') where domain = 'capability'),
  'defined', 'which is the current Capability state');

-- Responding
select throws_ok($$ select public.respond_to_architecture_approval(
                      (select id from public.architecture_approvals where response is null), 'approved') $$,
  '42501', null, 'a Client Viewer cannot respond to an approval request');
select throws_ok($$ select public.decide_decision('b3000000-0000-4000-8000-000000000506', 'b3000000-0000-4000-8000-000000000602') $$,
  '42501', null, 'nor decide a decision');
select pg_temp.reset_actor();
select pg_temp.act_as('contributor@meridian.test');
select throws_ok($$ select public.respond_to_architecture_approval(
                      (select id from public.architecture_approvals where response is null), 'approved') $$,
  'P0002', null, 'nor can a Client Contributor, to whom a request outside their areas does not exist');
select pg_temp.reset_actor();
select pg_temp.act_as('lead@meridian.test');
select lives_ok($$ select public.respond_to_architecture_approval(
                     (select id from public.architecture_approvals where response is null),
                     'changes_requested', 'Name the beneficiary more precisely.') $$,
  'the Client Project Lead responds');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Client Finance, other tenants, suspension, anonymous
-- -----------------------------------------------------------------------------
select pg_temp.act_as('finance@meridian.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 0, 'Client Finance sees no architecture detail');
select is((select count(*)::int from public.architecture_domain_states('e0000000-0000-4000-8000-000000000001')), 4,
  'only the four published domain states');
select is((select count(*)::int from public.client_architecture_relationships('e0000000-0000-4000-8000-000000000001')), 0,
  'and no relationships');
select pg_temp.reset_actor();
select pg_temp.act_as('principal@tplco.test');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted, reason)
select id, 'view_architecture', true, 'Finance lead joins the architecture review'
from public.engagement_members
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and user_id = '20000000-0000-4000-8000-000000000003';
select pg_temp.reset_actor();
select pg_temp.act_as('finance@meridian.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 0,
  'with a view_architecture override alone, Client Finance sees only what is in their areas (none)');
select pg_temp.reset_actor();
select pg_temp.act_as('principal@tplco.test');
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted, reason)
select id, 'view_full_architecture', true, 'Finance lead reviews the whole architecture'
from public.engagement_members
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and user_id = '20000000-0000-4000-8000-000000000003';
select pg_temp.reset_actor();
select pg_temp.act_as('finance@meridian.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 34,
  'with view_full_architecture as well, Client Finance sees all of it');
select pg_temp.reset_actor();

select pg_temp.act_as('advisor@consulting.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000003'), 6, 'the multi-organization advisor sees Harbor''s architecture');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 5, 'and, separately, the Meridian district operating model that is their area');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@harbor.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 0, 'Harbor''s sponsor sees nothing of Meridian');
select is((select count(*)::int from public.element_versions where engagement_id = 'e0000000-0000-4000-8000-000000000001'), 0,
  'not even version rows');
select pg_temp.reset_actor();

update public.engagement_members set status = 'suspended'
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and user_id = '20000000-0000-4000-8000-000000000005';
select pg_temp.act_as('viewer@meridian.test');
select is(pg_temp.client_count('e0000000-0000-4000-8000-000000000001'), 0, 'suspending a membership removes architecture access at once');
select pg_temp.reset_actor();

set local role anon;
select throws_ok($$ select count(*) from public.architecture_elements $$, '42501', null, 'anonymous users have no table access');
select throws_ok($$ select * from public.client_architecture('e0000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'nor any architecture read model');
reset role;

select * from finish();
rollback;
