-- =============================================================================
-- Phase 7B.1: Architecture Intelligence capabilities (pgTAP). Proposal §5.3,
-- §7, OD-1, OD-2, B-10, ADR-0061. Editing Architecture and invoking external
-- AI are separate authorities.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(26);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

\set M '''e0000000-0000-4000-8000-000000000001'''

-- Defaults (exact).
select set_eq($$ select role::text from public.role_capability_defaults where capability = 'use_architecture_intelligence' $$,
  array['principal_architect', 'architect'], 'use_architecture_intelligence: Principal Architect and Architect only');
select set_eq($$ select role::text from public.role_capability_defaults where capability = 'authorize_external_ai_processing' $$,
  array['principal_architect'], 'authorize_external_ai_processing: Principal Architect only');
select is(public.capability_side('use_architecture_intelligence'), 'internal'::public.member_side, 'use is internal-only');
select is(public.capability_side('authorize_external_ai_processing'), 'internal'::public.member_side, 'authorize is internal-only');
select ok(public.is_architecture_authority_capability('use_architecture_intelligence'), 'use is architecture authority');
select ok(public.is_architecture_authority_capability('authorize_external_ai_processing'), 'authorize is architecture authority');

-- Effective capabilities on Meridian.
select pg_temp.act_as('principal@tplco.test');
select ok(private.can_use_architecture_intelligence(:M) and private.can_authorize_external_ai_processing(:M),
  'Principal Architect holds both');
select pg_temp.act_as('architect@tplco.test');
select ok(private.can_use_architecture_intelligence(:M), 'Architect may use');
select ok(not private.can_authorize_external_ai_processing(:M), 'Architect may not authorize');
select pg_temp.act_as('researcher@tplco.test');
select ok(private.can_edit_architecture(:M), 'Researcher edits Architecture');
select ok(not private.can_use_architecture_intelligence(:M), '... but editing never implies AI use (OD-2)');
select pg_temp.act_as('projectadmin@tplco.test');
select ok(private.can_read_architecture(:M) and not private.can_use_architecture_intelligence(:M),
  'reading Architecture never implies AI use');
select pg_temp.act_as('finance@tplco.test');
select ok(not private.can_use_architecture_intelligence(:M) and not private.can_authorize_external_ai_processing(:M),
  'Finance Administrator holds neither');
select pg_temp.act_as('sysadmin@tplco.test');
select ok(not private.can_use_architecture_intelligence(:M) and not private.can_authorize_external_ai_processing(:M),
  'System Administrator holds neither');
select pg_temp.act_as('sponsor@meridian.test');
select ok(not private.can_use_architecture_intelligence(:M) and not private.can_authorize_external_ai_processing(:M),
  'a client holds neither');

-- Use never implies edit: revoke edit from the Architect, use remains; grant
-- use to the Researcher, edit unchanged.
select pg_temp.act_as('principal@tplco.test');
select lives_ok(format($$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
  select id, 'edit_architecture', false from public.engagement_members
  where engagement_id = %L and user_id = '10000000-0000-4000-8000-000000000003' $$, 'e0000000-0000-4000-8000-000000000001'),
  'a Principal Architect revokes the Architect''s edit');
select pg_temp.act_as('architect@tplco.test');
select ok(not private.can_edit_architecture(:M) and private.can_use_architecture_intelligence(:M),
  'use without edit');
select pg_temp.act_as('principal@tplco.test');
select lives_ok(format($$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
  select id, 'use_architecture_intelligence', true from public.engagement_members
  where engagement_id = %L and user_id = '10000000-0000-4000-8000-000000000004' $$, 'e0000000-0000-4000-8000-000000000001'),
  'S5: a Principal Architect grants the Researcher use by override');
select pg_temp.act_as('researcher@tplco.test');
select ok(private.can_use_architecture_intelligence(:M), 'the Researcher may now use');
select ok(not private.can_authorize_external_ai_processing(:M), '... and still may not authorize');

-- Override authority.
select pg_temp.act_as('principal@tplco.test');
select throws_ok(format($$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
  select id, 'use_architecture_intelligence', false from public.engagement_members
  where engagement_id = %L and user_id = '10000000-0000-4000-8000-000000000002' $$, 'e0000000-0000-4000-8000-000000000001'),
  '42501', null, 'S5: a Principal Architect cannot override their own use');
select pg_temp.act_as('projectadmin@tplco.test');
select throws_ok(format($$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
  select id, 'use_architecture_intelligence', true from public.engagement_members
  where engagement_id = %L and user_id = '10000000-0000-4000-8000-000000000005' $$, 'e0000000-0000-4000-8000-000000000001'),
  '42501', null, 'a Project Administrator cannot grant use');
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok(format($$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
  select id, 'authorize_external_ai_processing', true from public.engagement_members
  where engagement_id = %L and user_id = '10000000-0000-4000-8000-000000000003' $$, 'e0000000-0000-4000-8000-000000000001'),
  '42501', null, 'a System Administrator cannot grant authorize');
select pg_temp.act_as('principal@tplco.test');
select throws_ok(format($$ insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted)
  select id, 'use_architecture_intelligence', true from public.engagement_members
  where engagement_id = %L and user_id = '20000000-0000-4000-8000-000000000002' $$, 'e0000000-0000-4000-8000-000000000001'),
  null, null, 'a client member cannot be granted use (internal-only)');

-- Even a client override row written around every check confers nothing.
reset role;
alter table public.engagement_member_capability_overrides disable trigger user;
insert into public.engagement_member_capability_overrides (engagement_member_id, engagement_id, capability, granted)
select id, engagement_id, 'use_architecture_intelligence', true from public.engagement_members
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and user_id = '20000000-0000-4000-8000-000000000002';
alter table public.engagement_member_capability_overrides enable trigger user;
select pg_temp.act_as('lead@meridian.test');
select ok(not private.can_use_architecture_intelligence(:M), 'a forced client override still confers nothing');
select pg_temp.act_as('principal@tplco.test');
select ok(private.can_use_architecture_intelligence('e0000000-0000-4000-8000-000000000002'),
  'a Principal Architect on the Workforce engagement may use it there');

select * from finish();
rollback;
