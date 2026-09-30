-- =============================================================================
-- Phase 6 practice capabilities (pgTAP). Run with: pnpm db:test
--
-- One capability model, two membership scopes (D10, ADR-0044):
-- author_methodology and publish_methodology are held through TPLCo
-- organization membership, administered only by publish_methodology
-- holders (never on themselves), with a last-holder guard (D11).
-- =============================================================================
begin;

select plan(27);

create function pg_temp.act_as(user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  execute 'reset role';
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

create function pg_temp.tplco_membership(user_email text)
returns uuid
language sql
security definer
as $$
  select m.id from public.organization_members m
  join public.organizations o on o.id = m.organization_id and o.type = 'tplco'
  join auth.users u on u.id = m.user_id
  where u.email = user_email;
$$;

create function pg_temp.any_membership(user_email text, org_type public.organization_type)
returns uuid
language sql
security definer
as $$
  select m.id from public.organization_members m
  join public.organizations o on o.id = m.organization_id and o.type = org_type
  join auth.users u on u.id = m.user_id
  where u.email = user_email limit 1;
$$;

create function pg_temp.caps()
returns text
language sql
as $$
  select coalesce(string_agg(c::text, ',' order by c), '') from public.my_practice_capabilities() c;
$$;

-- -----------------------------------------------------------------------------
-- Role defaults
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select is(pg_temp.caps(), 'author_methodology,publish_methodology',
  'a Principal Architect authors and publishes methodology by default');
select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.caps(), 'author_methodology', 'an Architect authors but does not publish by default');
select pg_temp.act_as('sysadmin@tplco.test');
select is(pg_temp.caps(), '', 'a System Administrator holds no methodological authority by default');
select pg_temp.act_as('researcher@tplco.test');
select is(pg_temp.caps(), '', 'a Researcher holds none by default');
select pg_temp.act_as('projectadmin@tplco.test');
select is(pg_temp.caps(), '', 'a Project Administrator holds none');
select pg_temp.act_as('finance@tplco.test');
select is(pg_temp.caps(), '', 'a Finance Administrator holds none');
select pg_temp.act_as('sponsor@meridian.test');
select is(pg_temp.caps(), '', 'a client Executive Sponsor holds none');
select is((select count(*)::int from public.practice_role_capability_defaults), 0,
  'clients cannot read practice capability defaults');
select is((select count(*)::int from public.practice_capability_matrix()), 0,
  'clients see no practice capability matrix');
select pg_temp.act_as('advisor@consulting.test');
select is(pg_temp.caps(), '', 'a member of two client organizations holds none');
select pg_temp.reset_actor();

-- Defaults are reference data: nobody writes them through the API.
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ insert into public.practice_role_capability_defaults values ('researcher', 'author_methodology') $$,
  '42501', null, 'role defaults change only by migration');
select throws_ok($$ insert into public.practice_member_capability_overrides (organization_member_id, capability, granted, reason)
  values (pg_temp.tplco_membership('researcher@tplco.test'), 'author_methodology', true, 'x') $$,
  '42501', null, 'overrides are written only through the operation');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Administration
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ select public.set_practice_capability_override(pg_temp.tplco_membership('sysadmin@tplco.test'),
  'publish_methodology', true, 'I administer the platform') $$, '42501', null,
  'a System Administrator cannot grant themselves methodological authority');
select throws_ok($$ select public.set_practice_capability_override(pg_temp.tplco_membership('researcher@tplco.test'),
  'author_methodology', true, 'Helping') $$, '42501', null,
  'nor grant it to anyone else');
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.set_practice_capability_override(pg_temp.tplco_membership('researcher@tplco.test'),
  'author_methodology', true, 'Helping') $$, '42501', null,
  'an author without publish_methodology cannot administer practice capabilities');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.set_practice_capability_override(pg_temp.tplco_membership('principal@tplco.test'),
  'author_methodology', false, 'Stepping back') $$, '42501', null,
  'a methodology authority never changes their own capabilities');
select throws_ok($$ select public.set_practice_capability_override(pg_temp.tplco_membership('researcher@tplco.test'),
  'author_methodology', true, '  ') $$, '23514', null, 'an override needs a reason');
select throws_ok($$ select public.set_practice_capability_override(
  pg_temp.any_membership('sponsor@meridian.test', 'client'), 'author_methodology', true, 'Co-author') $$,
  'P0002', null, 'a client membership can never carry a practice capability');
select lives_ok($$ select public.set_practice_capability_override(pg_temp.tplco_membership('researcher@tplco.test'),
  'author_methodology', true, 'Drafting the research protocol') $$,
  'a publish_methodology holder grants author_methodology to a Researcher');
select lives_ok($$ select public.set_practice_capability_override(pg_temp.tplco_membership('sysadmin@tplco.test'),
  'publish_methodology', true, 'Covering during leave') $$,
  'and may explicitly grant a System Administrator publish_methodology');
select pg_temp.act_as('researcher@tplco.test');
select is(pg_temp.caps(), 'author_methodology', 'the Researcher now authors');
select pg_temp.act_as('sysadmin@tplco.test');
select is(pg_temp.caps(), 'publish_methodology', 'the granted System Administrator holds exactly what was granted');
select pg_temp.reset_actor();
select is((select count(*)::int from public.activity_log where entity_type = 'practice_member_capability_overrides'), 2,
  'every override is logged');

select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.clear_practice_capability_override(pg_temp.tplco_membership('sysadmin@tplco.test'),
  'publish_methodology') $$, 'an override can be cleared back to the role default');
select pg_temp.act_as('sysadmin@tplco.test');
select is(pg_temp.caps(), '', 'the System Administrator is back to no authority');

-- Authority can move, but a holder only ever acts on others, so at least one
-- holder always remains (the last-holder guard backs this up).
select pg_temp.act_as('principal@tplco.test');
select public.set_practice_capability_override(pg_temp.tplco_membership('architect@tplco.test'),
  'publish_methodology', true, 'Second authority');
select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ select public.set_practice_capability_override(pg_temp.tplco_membership('principal@tplco.test'),
  'publish_methodology', false, 'Sabbatical') $$, 'a second authority may revoke the first');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.set_practice_capability_override(pg_temp.tplco_membership('architect@tplco.test'),
  'publish_methodology', false, 'Taking it back') $$, '42501', null,
  'a revoked authority can no longer administer practice capabilities');
select pg_temp.reset_actor();

select * from finish();
rollback;
