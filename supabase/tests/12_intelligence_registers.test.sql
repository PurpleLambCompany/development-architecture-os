-- =============================================================================
-- Phase 4 intelligence registers (pgTAP). Run with: pnpm db:test
--
-- Opportunities, categories, stewardship (triage), the append-only status
-- history, guarded terminal statuses, resolution and reopening, the register
-- read model and the impact trace.
--
-- Seed (supabase/seed.sql, "Phase 4"): Meridian e...01 with RSK-001 b3...501
-- (critical, escalated), RSK-002 b3...502, ASM-001 b3...503, DEP-001 b3...505
-- (review overdue), DEC-001 b3...506, OPP-001 b6...001 (client-visible,
-- published), OPP-002 b6...002 (internal, window closed), RSK-003 b6...003
-- (closed with a rationale).
-- =============================================================================
begin;

select plan(50);

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

-- The engagement membership of a seeded user (Meridian unless named).
create function pg_temp.member(user_email text, engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language sql
security definer
as $$
  select m.id from public.engagement_members m join auth.users u on u.id = m.user_id
  where m.engagement_id = engagement and u.email = user_email;
$$;

-- Reads a value as the database owner, whatever the current actor.
create function pg_temp.status_of(p_element uuid)
returns text
language sql
security definer
as $$
  select private.intelligence_record_status(p_element);
$$;

-- -----------------------------------------------------------------------------
-- The register
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.intelligence_register('e0000000-0000-4000-8000-000000000001')), 10,
  'an assigned Architect reads all ten Project Intelligence records, internal ones included');
select is(
  (select string_agg(kind::text || ':' || n, ',' order by kind::text)
   from (select kind, count(*) n from public.intelligence_register('e0000000-0000-4000-8000-000000000001') group by 1) x),
  'assumption:1,constraint:1,decision:1,dependency:1,opportunity:2,recommendation:1,risk:3',
  'every record kind appears, opportunities included');
select is((select row(status, severity, attention::text, open_escalations::text[])::text
           from public.intelligence_register('e0000000-0000-4000-8000-000000000001') where reference_code = 'RSK-001'),
  row('mitigating', 15::smallint, 'critical', array['principal_architect'])::text,
  'a register row carries status, severity, attention and open escalations');
select is((select open_client_actions from public.intelligence_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'RSK-002'), 1, 'and the open client requests about the record');
select is((select attractiveness from public.intelligence_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'OPP-002'), 16::smallint, 'an opportunity''s attractiveness is value times feasibility');
-- The Architect is in fact assigned to Harbor too (seed); intelligence_register
-- also returns non-object Phase 5 kinds, so this is Harbor's two reviews, one
-- deliverable and three implementation initiatives (Phase 5 seed, plus the
-- Phase 7A seed's scheduled Review) and the Phase 7A seed's decision, not zero.
select is((select count(*)::int from public.intelligence_register('e0000000-0000-4000-8000-000000000003')), 7,
  'the register also carries Harbor''s reviews, deliverables and implementation initiatives');
select pg_temp.reset_actor();

select pg_temp.act_as('finance@tplco.test');
select is((select count(*)::int from public.intelligence_register('e0000000-0000-4000-8000-000000000003')), 0,
  'TPLCo Finance reads no records of an engagement they are not assigned to');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.intelligence_register('e0000000-0000-4000-8000-000000000001')), 0,
  'clients read no working register');
select is((select count(*)::int from public.intelligence_stewardship), 0, 'nor stewardship');
select is((select count(*)::int from public.intelligence_status_changes), 0, 'nor status history');
select is((select count(*)::int from public.opportunities), 0, 'nor live opportunity rows');
select is((select count(*)::int from public.intelligence_history('b3000000-0000-4000-8000-000000000501')), 0,
  'and the history read model returns nothing to them');
select ok(exists (select 1 from public.client_architecture('e0000000-0000-4000-8000-000000000001')
                  where reference_code = 'OPP-001'), 'they see the published, client-visible opportunity');
select ok(not exists (select 1 from public.client_architecture('e0000000-0000-4000-8000-000000000001')
                      where reference_code = 'OPP-002'), 'but never the internal one');
select ok(not exists (select 1 from public.client_architecture('e0000000-0000-4000-8000-000000000001') c
                      where c.client_snapshot ? 'attention' or c.client_snapshot ? 'triage_note'),
  'stewardship never reaches the client snapshot');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Opportunities and categories
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'opportunity',
  '{"title": "Federal lab relocation", "provenance": "architect_judgment"}',
  '{"category": "market", "value": 3, "feasibility": 2}', '{capability}') $$,
  'an Architect records an opportunity');
select is((select reference_code from public.architecture_elements where title = 'Federal lab relocation'),
  'OPP-003', 'which takes the next OPP reference code');
select is((select triage_state::text from public.intelligence_stewardship s
           join public.architecture_elements e on e.id = s.element_id where e.title = 'Federal lab relocation'),
  'untriaged', 'and arrives untriaged');
select throws_ok($$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'opportunity',
  '{"title": "Bad window", "provenance": "architect_judgment"}',
  '{"window_opens_on": "2026-12-01", "window_closes_on": "2026-11-01"}', '{capability}') $$,
  '23514', null, 'a window cannot close before it opens');
select throws_ok($$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'opportunity',
  '{"title": "Too valuable", "provenance": "architect_judgment"}', '{"value": 6}', '{capability}') $$,
  '23514', null, 'value is scored 1 to 5');
select throws_ok($$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'opportunity',
  '{"title": "Already realized", "provenance": "architect_judgment"}', '{"opportunity_status": "realized"}', '{capability}') $$,
  '23514', null, 'a record cannot be created already resolved');
select throws_ok($$ update public.risks set category = 'weather' where element_id = 'b3000000-0000-4000-8000-000000000502' $$,
  '23503', null, 'categories come from the approved list for the record kind');
select throws_ok($$ update public.risks set category = 'partnership' where element_id = 'b3000000-0000-4000-8000-000000000502' $$,
  '23503', null, 'and an opportunity category is not a risk category');
select lives_ok($$ update public.decisions set category = 'governance' where element_id = 'b3000000-0000-4000-8000-000000000506' $$,
  'decisions carry a category');

-- -----------------------------------------------------------------------------
-- Terminal statuses are reached only by resolution
-- -----------------------------------------------------------------------------
select throws_ok($$ update public.risks set risk_status = 'closed' where element_id = 'b3000000-0000-4000-8000-000000000502' $$,
  '42501', null, 'a risk cannot be closed by editing its status');
select lives_ok($$ update public.risks set risk_status = 'mitigating' where element_id = 'b3000000-0000-4000-8000-000000000502' $$,
  'but can move between active statuses');
select throws_ok($$ update public.intelligence_stewardship set attention = 'watch' $$,
  '42501', null, 'stewardship is written only through triage');
select throws_ok($$ select public.triage_intelligence_record('b3000000-0000-4000-8000-000000000502', 'critical') $$,
  '23514', null, 'critical attention needs a note');
select lives_ok($$ select public.triage_intelligence_record('b3000000-0000-4000-8000-000000000502', 'critical', current_date + 3,
  'Both founders are near retirement.') $$, 'an Architect triages a record');
select throws_ok($$ select public.resolve_intelligence_record('b3000000-0000-4000-8000-000000000502', 'closed', ' ') $$,
  '23514', null, 'resolution needs a rationale');
select throws_ok($$ select public.resolve_intelligence_record('b3000000-0000-4000-8000-000000000502', 'mitigating', 'Not terminal') $$,
  '23514', null, 'and a terminal status');
select throws_ok($$ select public.resolve_intelligence_record('b3000000-0000-4000-8000-000000000506', 'decided', 'Decided') $$,
  '23514', null, 'decisions are decided through the decision workflow, not resolved');
select lives_ok($$ select public.resolve_intelligence_record('b3000000-0000-4000-8000-000000000503', 'validated',
  'The board chair confirmed support in writing.') $$, 'an Architect validates an assumption');
select is(pg_temp.status_of('b3000000-0000-4000-8000-000000000503'), 'validated', 'which is now validated');
select is((select row(from_value, to_value, operation, rationale)::text
           from public.intelligence_history('b3000000-0000-4000-8000-000000000503') where field = 'validation_status'
           order by changed_at desc, id desc limit 1),
  row('validating', 'validated', 'resolved', 'The board chair confirmed support in writing.')::text,
  'the history records the change, the operation and the rationale');
select throws_ok($$ update public.assumptions set validation_status = 'validating'
                   where element_id = 'b3000000-0000-4000-8000-000000000503' $$,
  '42501', null, 'a resolved record is not reopened by editing');
select lives_ok($$ select public.reopen_intelligence_record('b3000000-0000-4000-8000-000000000503', 'validating',
  'The chair has since left the board.') $$, 'but is reopened with a rationale');
select is((select triage_state::text from public.intelligence_stewardship
           where element_id = 'b3000000-0000-4000-8000-000000000503'), 'untriaged', 'and returns to untriaged');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.resolve_intelligence_record('b3000000-0000-4000-8000-000000000502', 'accepted',
  'Accept the succession risk.') $$, '42501', null, 'accepting a risk needs publishing authority');
select throws_ok($$ select public.resolve_intelligence_record('b6000000-0000-4000-8000-000000000002', 'lapsed',
  'The round closed.', true) $$, '42501', null, 'as does publishing a resolution');
select lives_ok($$ select public.resolve_intelligence_record('b6000000-0000-4000-8000-000000000002', 'lapsed',
  'The round closed before an application was ready.') $$, 'a Researcher records that an opportunity lapsed');
select pg_temp.reset_actor();

select pg_temp.act_as('finance@tplco.test');
select throws_ok($$ select public.triage_intelligence_record('b3000000-0000-4000-8000-000000000502', 'watch') $$,
  '42501', null, 'TPLCo Finance cannot triage');
select pg_temp.reset_actor();
select pg_temp.act_as('lead@meridian.test');
select throws_ok($$ select public.triage_intelligence_record('b3000000-0000-4000-8000-000000000502', 'watch') $$,
  'P0002', null, 'nor can a client, to whom the working record does not exist');
select throws_ok($$ select public.resolve_intelligence_record('b3000000-0000-4000-8000-000000000502', 'closed', 'Done') $$,
  'P0002', null, 'nor resolve one');
select pg_temp.reset_actor();

-- History is append-only: signed-in users hold no write grant, and even the
-- database owner cannot rewrite or delete it while its record exists.
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ update public.intelligence_status_changes set rationale = 'Rewritten' $$,
  '42501', null, 'status history cannot be written by users');
select pg_temp.reset_actor();
select throws_ok($$ update public.intelligence_status_changes set rationale = 'Rewritten' $$,
  '23514', null, 'nor rewritten by the owner');
select throws_ok($$ delete from public.intelligence_status_changes $$,
  '23514', null, 'nor deleted');

-- -----------------------------------------------------------------------------
-- Impact
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is(
  (select string_agg(reference_code || '@' || depth, ',' order by depth, reference_code)
   from public.intelligence_impact('b3000000-0000-4000-8000-000000000505', 5)),
  'APP-001@1,APP-003@1,APP-005@2',
  'a dependency''s impact reaches both ends, then what they are part of');
select is((select max(depth) from public.intelligence_impact('b3000000-0000-4000-8000-000000000501', 1)), 1,
  'the trace stops at the requested depth');
select pg_temp.reset_actor();
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.intelligence_impact('b3000000-0000-4000-8000-000000000501', 3)), 0,
  'clients cannot trace impact');
select pg_temp.reset_actor();

select * from finish();
rollback;
