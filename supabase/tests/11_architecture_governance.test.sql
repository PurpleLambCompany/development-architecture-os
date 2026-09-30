-- =============================================================================
-- Phase 3 architecture governance (pgTAP). Run with: pnpm db:test
--
-- 1. Only Principal Architects grant or revoke edit_architecture and
--    publish_architecture overrides; System Administrators (for themselves or
--    others) and Project Administrators cannot. Granted overrides work.
-- 2. architecture_activity(): Architects and Researchers assigned to an
--    engagement read its architecture events, and nothing else from the
--    activity log.
--
-- Seed: Meridian district e...01 (principal, architect, researcher,
-- projectadmin and finance@tplco assigned); Workforce e...02 (architect not
-- assigned); Harbor e...03 (researcher not assigned). CAP-007 (b...207) is an
-- unpublished draft; CAP-001 (b...201) has v2 approved in the portal.
-- =============================================================================
begin;

select plan(48);

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

-- The Meridian district membership of a seeded user.
create function pg_temp.member(user_email text)
returns uuid
language sql
security definer
as $$
  select em.id from public.engagement_members em join auth.users u on u.id = em.user_id
  where em.engagement_id = 'e0000000-0000-4000-8000-000000000001' and u.email = user_email;
$$;
grant execute on function pg_temp.member(text) to authenticated;

-- Grants (or revokes, with granted = false) a capability for a Meridian member as the current actor.
create function pg_temp.set_override(user_email text, cap public.engagement_capability, is_granted boolean)
returns void
language sql
as $$
  insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted, reason)
  values (pg_temp.member(user_email), cap, is_granted, 'Governance test');
$$;

create function pg_temp.override_count(user_email text, cap public.engagement_capability)
returns integer
language sql
security definer
as $$
  select count(*)::int from public.engagement_member_capability_overrides
  where engagement_member_id = pg_temp.member(user_email) and capability = cap;
$$;
grant execute on function pg_temp.override_count(text, public.engagement_capability) to authenticated;

-- A System Administrator assigned to the engagement, so self-grants can be tried.
insert into public.engagement_members (engagement_id, user_id, side, role)
values ('e0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'internal', 'system_administrator');

-- -----------------------------------------------------------------------------
-- 1. Granting architecture authority
-- -----------------------------------------------------------------------------

-- Principal Architect: grant and revoke edit_architecture.
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select pg_temp.set_override('projectadmin@tplco.test', 'edit_architecture', true) $$,
  'a Principal Architect can grant edit_architecture');
select pg_temp.reset_actor();
select pg_temp.act_as('projectadmin@tplco.test');
select ok(private.can_edit_architecture('e0000000-0000-4000-8000-000000000001'),
  'the granted edit_architecture override takes effect');
select lives_ok($$
  insert into public.architecture_elements (engagement_id, kind, title, provenance)
  values ('e0000000-0000-4000-8000-000000000001', 'object', 'Drafted under an override', 'architect_judgment')
  returning 1 $$ ,
  'and the member can draft');
select pg_temp.reset_actor();
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$
  delete from public.engagement_member_capability_overrides
  where engagement_member_id = pg_temp.member('projectadmin@tplco.test') and capability = 'edit_architecture' $$,
  'a Principal Architect can remove an edit_architecture override');
select lives_ok($$ select pg_temp.set_override('researcher@tplco.test', 'edit_architecture', false) $$,
  'a Principal Architect can revoke edit_architecture from a default holder');
select pg_temp.reset_actor();
select pg_temp.act_as('researcher@tplco.test');
select ok(not private.can_edit_architecture('e0000000-0000-4000-8000-000000000001'),
  'the revocation takes effect');
select pg_temp.reset_actor();
select pg_temp.act_as('principal@tplco.test');
delete from public.engagement_member_capability_overrides
where engagement_member_id = pg_temp.member('researcher@tplco.test') and capability = 'edit_architecture';
select pg_temp.reset_actor();

-- Principal Architect: grant and revoke publish_architecture.
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select pg_temp.set_override('researcher@tplco.test', 'publish_architecture', true) $$,
  'a Principal Architect can grant publish_architecture');
select pg_temp.reset_actor();
select pg_temp.act_as('researcher@tplco.test');
select ok(private.can_publish_architecture('e0000000-0000-4000-8000-000000000001'),
  'the granted publish_architecture override takes effect');
select lives_ok($$ select public.publish_element_version('b3000000-0000-4000-8000-000000000207', 'Published under an override') $$,
  'and the Researcher can publish under it');
select pg_temp.reset_actor();
select is((select count(*)::int from public.element_versions where element_id = 'b3000000-0000-4000-8000-000000000207'), 1,
  'the publication created version 1');
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select pg_temp.set_override('architect@tplco.test', 'publish_architecture', false) $$,
  'a Principal Architect can revoke publish_architecture from a default holder');
select pg_temp.reset_actor();
select pg_temp.act_as('architect@tplco.test');
select ok(not private.can_publish_architecture('e0000000-0000-4000-8000-000000000001'),
  'the revocation takes effect');
select throws_ok($$ select public.publish_element_version('b3000000-0000-4000-8000-000000000202') $$,
  '42501', null, 'and the Architect can no longer publish on that engagement');
select pg_temp.reset_actor();
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$
  delete from public.engagement_member_capability_overrides
  where engagement_member_id = pg_temp.member('architect@tplco.test') and capability = 'publish_architecture' $$,
  'a Principal Architect can remove the revocation');
select pg_temp.reset_actor();
select pg_temp.act_as('architect@tplco.test');
select ok(private.can_publish_architecture('e0000000-0000-4000-8000-000000000001'),
  'the Architect is back to the role default');
select pg_temp.reset_actor();

-- A Principal Architect cannot change their own architecture authority.
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select pg_temp.set_override('principal@tplco.test', 'publish_architecture', false) $$,
  '42501', null, 'a Principal Architect cannot change their own architecture authority');
select pg_temp.reset_actor();

-- System Administrator: neither capability, for themself or anyone else.
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ select pg_temp.set_override('sysadmin@tplco.test', 'edit_architecture', true) $$,
  '42501', null, 'a System Administrator cannot grant themself edit_architecture');
select throws_ok($$ select pg_temp.set_override('sysadmin@tplco.test', 'publish_architecture', true) $$,
  '42501', null, 'a System Administrator cannot grant themself publish_architecture');
select throws_ok($$ select pg_temp.set_override('projectadmin@tplco.test', 'edit_architecture', true) $$,
  '42501', null, 'a System Administrator cannot grant edit_architecture to another member');
select throws_ok($$ select pg_temp.set_override('projectadmin@tplco.test', 'publish_architecture', true) $$,
  '42501', null, 'a System Administrator cannot grant publish_architecture to another member');
select throws_ok($$ select pg_temp.set_override('architect@tplco.test', 'publish_architecture', false) $$,
  '42501', null, 'a System Administrator cannot revoke publish_architecture');
select lives_ok($$
  delete from public.engagement_member_capability_overrides
  where engagement_member_id = pg_temp.member('researcher@tplco.test') and capability = 'publish_architecture' $$,
  'a System Administrator''s attempt to remove a Researcher''s publish override runs');
select is(pg_temp.override_count('researcher@tplco.test', 'publish_architecture'), 1,
  'but removes nothing');
select lives_ok($$ select pg_temp.set_override('lead@meridian.test', 'manage_client_team', false) $$,
  'System Administrators still manage other capabilities');
select pg_temp.reset_actor();

-- Project Administrator: neither capability.
select pg_temp.act_as('projectadmin@tplco.test');
select throws_ok($$ select pg_temp.set_override('researcher@tplco.test', 'edit_architecture', false) $$,
  '42501', null, 'a Project Administrator cannot revoke edit_architecture');
select throws_ok($$ select pg_temp.set_override('finance@tplco.test', 'edit_architecture', true) $$,
  '42501', null, 'a Project Administrator cannot grant edit_architecture');
select throws_ok($$ select pg_temp.set_override('architect@tplco.test', 'publish_architecture', false) $$,
  '42501', null, 'a Project Administrator cannot revoke publish_architecture');
select lives_ok($$
  update public.engagement_member_capability_overrides set granted = false
  where engagement_member_id = pg_temp.member('researcher@tplco.test') and capability = 'publish_architecture' $$,
  'a Project Administrator''s attempt to change a publish override runs');
select pg_temp.reset_actor();
select pg_temp.act_as('researcher@tplco.test');
select ok(private.can_publish_architecture('e0000000-0000-4000-8000-000000000001'),
  'but changes nothing: the granted override still works');
select pg_temp.reset_actor();
select pg_temp.act_as('projectadmin@tplco.test');
select lives_ok($$ select pg_temp.set_override('finance@meridian.test', 'view_architecture', true) $$,
  'Project Administrators still grant view_architecture to client members');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 2. Architecture activity
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select lives_ok($$ select public.submit_element_for_review('b3000000-0000-4000-8000-000000000201') $$,
  'a Researcher submits CAP-001 for review');
select pg_temp.reset_actor();

create function pg_temp.events(user_email text, engagement uuid default 'e0000000-0000-4000-8000-000000000001',
                               element uuid default null)
returns setof text
language plpgsql
as $$
begin
  perform pg_temp.act_as(user_email);
  return query select a.event from public.architecture_activity(engagement, element, 500) a;
  perform pg_temp.reset_actor();
end;
$$;

select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.activity_log), 0,
  'an Architect still cannot read the activity log itself');
select pg_temp.reset_actor();

select ok((select count(*) from pg_temp.events('architect@tplco.test')) > 0,
  'an assigned Architect reads the engagement''s architecture activity');
select ok((select count(*) from pg_temp.events('researcher@tplco.test')) > 0,
  'an assigned Researcher reads it too');
select ok(
  (select array_agg(distinct e) from pg_temp.events('architect@tplco.test') e)
    @> array['element_created', 'version_published', 'relationship_added', 'relationship_retired',
             'statement_added', 'evidence_cited', 'approval_requested', 'approval_responded',
             'domain_assessed', 'baseline_frozen', 'submitted_for_review', 'decision_recommended'],
  'the events cover creation, review, publication, relationships, statements, evidence, approvals, decisions, assessments and baselines');

select pg_temp.act_as('architect@tplco.test');
select is(
  (select count(*)::int from public.architecture_activity('e0000000-0000-4000-8000-000000000001', null, 500) a
   where a.entity_type not in (
     'architecture_elements', 'architecture_objects', 'assumptions', 'risks', 'constraints', 'dependencies',
     'decisions', 'decision_options', 'recommendations', 'architecture_statements', 'statement_evidence_links',
     'element_evidence_links', 'element_method_lineage', 'evidence_sources', 'architecture_relationships',
     'element_versions', 'architecture_approvals', 'domain_assessments', 'architecture_baselines')),
  0, 'no financial, membership, capability or administrative event is ever returned');
select is(
  (select count(*)::int from public.architecture_activity('e0000000-0000-4000-8000-000000000001', null, 500) a
   where a.details ?| array['record', 'before', 'after', 'snapshot', 'body']),
  0, 'events carry curated details, never raw audit rows');
select ok(
  (select bool_and(a.element_id = 'b3000000-0000-4000-8000-000000000201'
                   or a.related_element_id = 'b3000000-0000-4000-8000-000000000201')
   from public.architecture_activity('e0000000-0000-4000-8000-000000000001',
                                     'b3000000-0000-4000-8000-000000000201', 500) a),
  'the element filter returns only events on that element and its relationships');
select is(
  (select a.details ->> 'response' from public.architecture_activity('e0000000-0000-4000-8000-000000000001',
     'b3000000-0000-4000-8000-000000000201', 500) a where a.event = 'approval_responded' limit 1),
  'approved', 'the client''s approval of CAP-001 appears on its activity');
select pg_temp.reset_actor();

-- Everyone else sees nothing.
select is((select count(*)::int from pg_temp.events('architect@tplco.test', 'e0000000-0000-4000-8000-000000000002')), 0,
  'an Architect sees nothing on an engagement they are not assigned to');
select is((select count(*)::int from pg_temp.events('researcher@tplco.test', 'e0000000-0000-4000-8000-000000000003')), 0,
  'nor does a Researcher');
select is((select count(*)::int from pg_temp.events('finance@tplco.test')), 0,
  'an assigned Finance Administrator sees no architecture activity');
select is((select count(*)::int from pg_temp.events('sponsor@meridian.test')), 0,
  'a client Executive Sponsor sees none');
select is((select count(*)::int from pg_temp.events('finance@meridian.test')), 0,
  'Client Finance sees none');
select ok((select count(*) from pg_temp.events('principal@tplco.test')) > 0,
  'a Principal Architect reads it');
select ok((select count(*) from pg_temp.events('sysadmin@tplco.test')) > 0,
  'a System Administrator, who already reads the full log, reads it');

-- Suspension removes access at once.
update public.engagement_members set status = 'suspended' where id = pg_temp.member('researcher@tplco.test');
select is((select count(*)::int from pg_temp.events('researcher@tplco.test')), 0,
  'a suspended Researcher sees none');
update public.engagement_members set status = 'active' where id = pg_temp.member('researcher@tplco.test');

set local role anon;
select throws_ok($$ select * from public.architecture_activity('e0000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'anonymous callers cannot call it');
reset role;

select * from finish();
rollback;
