-- =============================================================================
-- Phase 7A: the private "briefed through" watermark (pgTAP). Proposal §14,
-- ADR-0057, and S8. Nothing here records a page view, a visit or time on page.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(15);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

\set H '''e0000000-0000-4000-8000-000000000003'''

select set_eq($$ select column_name::text from information_schema.columns
                 where table_schema = 'public' and table_name = 'edge_briefing_marks' $$,
              array['user_id', 'engagement_id', 'briefed_through', 'updated_at'],
  'the table holds a mark and nothing about reading behavior');
select is((select count(*)::int from pg_trigger where tgrelid = 'public.edge_briefing_marks'::regclass and not tgisinternal
             and tgname like '%log%'), 0, 'the table is not in the activity log');
select is((select count(*)::int from pg_policies where tablename = 'edge_briefing_marks'), 1, 'one policy: own row only');

select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.edge_briefing_marks), 0, 'no mark until the user sets one');
select lives_ok($$ select public.edge_items('e0000000-0000-4000-8000-000000000003') $$, 'reading the Edge');
select is((select count(*)::int from public.edge_briefing_marks), 0, 'never sets a mark');
select throws_ok($$ insert into public.edge_briefing_marks values (auth.uid(), 'e0000000-0000-4000-8000-000000000003', now(), now()) $$,
  '42501', null, 'a mark is not written directly');
select throws_ok(format($$ select public.mark_briefed_through(%L, now() + interval '1 hour') $$, 'e0000000-0000-4000-8000-000000000003'),
  '23514', null, 'a mark cannot be in the future');
select lives_ok(format($$ select public.mark_briefed_through(%L, now() - interval '1 hour') $$, 'e0000000-0000-4000-8000-000000000003'),
  'S8: mark reviewed through a time');
select lives_ok(format($$ select public.mark_briefed_through(%L, now() - interval '3 days') $$, 'e0000000-0000-4000-8000-000000000003'),
  'and move it back to re-read');
select is((select count(*)::int from public.edge_briefing_marks), 1, 'the user reads their own mark');
select is((select count(*)::int from public.activity_log where entity_type = 'edge_briefing_marks'), 0,
  'no activity log row is written');

select pg_temp.act_as('principal@tplco.test');
select is((select count(*)::int from public.edge_briefing_marks), 0, 'a Principal Architect cannot read another user''s mark');
select pg_temp.act_as('sysadmin@tplco.test');
select is((select count(*)::int from public.edge_briefing_marks), 0, 'nor can a System Administrator');
select pg_temp.act_as('lead@harbor.test');
select throws_ok(format($$ select public.mark_briefed_through(%L, now() - interval '1 hour') $$, 'e0000000-0000-4000-8000-000000000003'),
  'P0002', null, 'a client has no briefing');

select * from finish();
rollback;
