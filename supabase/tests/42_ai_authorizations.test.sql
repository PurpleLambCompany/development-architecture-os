-- =============================================================================
-- Phase 7B.1: external processing authorization and data origin (pgTAP).
-- Proposal §5, §6, §8; B-1, B-2, B-4; OD-1, OD-3, OD-4, OD-10; ADR-0060.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(35);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.authorize(eng uuid, classes text[] default array['published_architecture'],
                                  basis text default 'synthetic_evaluation')
returns public.engagement_ai_authorizations language sql as $$
  select public.set_engagement_ai_authorization(eng, 'authorized', classes, 'openai', 'us', basis, 'Seed evaluation',
                                                null, 25);
$$;

\set M '''e0000000-0000-4000-8000-000000000001'''
\set W '''e0000000-0000-4000-8000-000000000002'''
\set H '''e0000000-0000-4000-8000-000000000003'''

select set_eq($$ select engagement_id::text || ':' || basis_kind from public.engagement_ai_authorizations $$,
  array['e0000000-0000-4000-8000-000000000001:synthetic_evaluation', 'e0000000-0000-4000-8000-000000000003:synthetic_evaluation'],
  'the seed authorizes Meridian and Harbor for synthetic evaluation only');
-- Start from no authorization: the seed's synthetic-evaluation
-- authorizations are removed inside this rolled-back transaction.
alter table public.engagement_ai_authorizations disable trigger user;
delete from public.engagement_ai_authorizations;
alter table public.engagement_ai_authorizations enable trigger user;

-- Data origin (OD-4).
select is((select count(*)::int from public.engagements where data_origin = 'synthetic'), 3,
  'every seed engagement holds synthetic data');
select col_default_is('public', 'engagements', 'data_origin', 'real', 'an engagement holds real data by default');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ update public.engagements set data_origin = 'real' where id = 'e0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'the origin of an engagement''s data cannot be changed');
select throws_ok($$ insert into public.engagements (client_organization_id, title, slug, engagement_type, status, data_origin)
  values ('a0000000-0000-4000-8000-000000000002', 'Made up', 'made-up', 'development_architecture_sprint', 'proposed', 'synthetic') $$,
  '42501', null, 'an engagement created in DSA cannot claim synthetic data');
reset role;
select throws_ok($$ update public.engagements set data_origin = 'real' where id = 'e0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'not even by the database owner');

-- Table shape and protection.
select is((select count(*)::int from pg_trigger where tgrelid = 'public.engagement_ai_authorizations'::regclass
             and not tgisinternal and tgname like '%log%'), 0, 'not in the activity log (OD-10)');
select pg_temp.act_as('principal@tplco.test');
select is((select count(*)::int from public.engagement_ai_authorizations), 0, 'S2: no engagement is authorized by default');
select throws_ok(format($$ insert into public.engagement_ai_authorizations (engagement_id, sequence_no, state, effective_from, authorized_by)
  values (%L, 1, 'not_authorized', current_date, auth.uid()) $$, 'e0000000-0000-4000-8000-000000000001'),
  '42501', null, 'never written directly');

-- Authorize.
select is((pg_temp.authorize(:M, array['published_architecture', 'working_architecture', 'project_intelligence',
                                        'evidence_metadata'])).sequence_no, 1, 'S1: a Principal Architect authorizes Meridian');
select is((select authorized_by from public.engagement_ai_authorizations where engagement_id = :M),
  '10000000-0000-4000-8000-000000000002'::uuid, 'attributed to the caller');
reset role;
select ok(private.ai_class_authorized(:M, 'evidence_metadata'), 'the class is authorized');
select ok(not private.ai_class_authorized(:H, 'evidence_metadata'), 'another engagement is not');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ update public.engagement_ai_authorizations set monthly_budget_usd = 1 $$, '42501', null, 'no update privilege');
select throws_ok($$ delete from public.engagement_ai_authorizations $$, '42501', null, 'no delete privilege');

-- Refusals.
select throws_ok(format($$ select pg_temp.authorize(%L, array['method_ip']) $$, 'e0000000-0000-4000-8000-000000000003'),
  '23514', null, 'Method/IP has no class and cannot be authorized (B-19)');
select throws_ok(format($$ select pg_temp.authorize(%L, array['file_contents']) $$, 'e0000000-0000-4000-8000-000000000003'),
  '23514', null, 'unknown classes refused');
select throws_ok(format($$ select pg_temp.authorize(%L, array['published_architecture', 'published_architecture']) $$,
  'e0000000-0000-4000-8000-000000000003'), '23514', null, 'a class named twice is refused');
select throws_ok(format($$ select pg_temp.authorize(%L, array[]::text[]) $$, 'e0000000-0000-4000-8000-000000000003'),
  '23514', null, 'an authorization names at least one class');
select throws_ok(format($$ select pg_temp.authorize(%L, array['published_architecture'], 'client_agreement') $$,
  'e0000000-0000-4000-8000-000000000003'), '23514', null, 'a synthetic engagement is authorized only for synthetic evaluation');
select throws_ok(format($$ select public.set_engagement_ai_authorization(%L, 'authorized', array['published_architecture'],
  'openai', 'us', 'synthetic_evaluation', 'x', null, 0) $$, 'e0000000-0000-4000-8000-000000000003'),
  '23514', null, 'a budget is required');
select throws_ok(format($$ select public.set_engagement_ai_authorization(%L, 'authorized', array['published_architecture'],
  'openai', 'us', 'synthetic_evaluation', 'x', null, 5, current_date + 3) $$, 'e0000000-0000-4000-8000-000000000003'),
  '23514', null, 'no future-dated authorization');
select throws_ok(format($$ select public.set_engagement_ai_authorization(%L, 'not_authorized', array[]::text[],
  null, null, null, null, null, null) $$, 'e0000000-0000-4000-8000-000000000001'),
  '23514', null, 'a revocation says why');

-- OD-3: only proposed and active engagements.
reset role;
update public.engagements set status = 'paused' where id = :H;
select pg_temp.act_as('principal@tplco.test');
select throws_ok(format($$ select pg_temp.authorize(%L) $$, 'e0000000-0000-4000-8000-000000000003'),
  '23514', null, 'a paused engagement cannot be authorized');
reset role;
update public.engagements set status = 'active' where id = :H;
select pg_temp.act_as('principal@tplco.test');
select is((pg_temp.authorize(:W)).sequence_no, 1, 'a proposed engagement can be authorized');

-- Who.
select pg_temp.act_as('architect@tplco.test');
select throws_ok(format($$ select pg_temp.authorize(%L) $$, 'e0000000-0000-4000-8000-000000000003'),
  '42501', null, 'an Architect cannot authorize');
select is((select count(*)::int from public.engagement_ai_authorizations where engagement_id = :M), 1,
  'an Architect reads the authorization');
select pg_temp.act_as('researcher@tplco.test');
select throws_ok(format($$ select pg_temp.authorize(%L) $$, 'e0000000-0000-4000-8000-000000000001'),
  '42501', null, 'a Researcher cannot authorize');
select pg_temp.act_as('lead@meridian.test');
select throws_ok(format($$ select pg_temp.authorize(%L) $$, 'e0000000-0000-4000-8000-000000000001'),
  'P0002', null, 'a client cannot see the engagement''s authorization operation');
select is((select count(*)::int from public.engagement_ai_authorizations), 0, 'nor read any authorization');

-- Revoke, then authorize again: the history is kept.
select pg_temp.act_as('principal@tplco.test');
select is((public.set_engagement_ai_authorization(:M, 'not_authorized', array[]::text[], null, null, null, null,
  'Evaluation paused')).sequence_no, 2, 'S9: revocation is a new record');
reset role;
select ok(not private.ai_class_authorized(:M, 'published_architecture'), 'nothing is authorized after revocation');
select pg_temp.act_as('principal@tplco.test');
select is((pg_temp.authorize(:M)).sequence_no, 3, 'authorizing again is a third record');
select is((select count(*)::int from public.engagement_ai_authorizations where engagement_id = :M), 3, 'history kept');
reset role;
select ok(not private.ai_class_authorized(:M, 'working_architecture'), 'only the classes now named are authorized');

select * from finish();
rollback;
