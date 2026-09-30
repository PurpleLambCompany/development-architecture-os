-- =============================================================================
-- Phase 4 client actions, client input and engagement files (pgTAP).
-- Run with: pnpm db:test
--
-- Who sees and answers a request; who may send, reassign, close, return and
-- withdraw one; responses as the client's own words; recording them as
-- evidence; client input on published elements; and uploads through the
-- private engagement-files bucket.
--
-- Seed (supabase/seed.sql, "Phase 4"), Meridian e...01:
--   ACT-001 executive attention to the Executive Sponsor (open)
--   ACT-002 question to the Client Project Lead (open)
--   ACT-003 information request to the Client Contributor (open, overdue)
--   ACT-004 confirmation to the Client Contributor (responded)
--   ACT-005 question to the Executive Sponsor (closed, recorded as evidence)
--   ACT-006 review request to the Client Project Lead (withdrawn)
-- The Client Contributor's area is the Capability domain.
-- =============================================================================
begin;

select plan(74);

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

create function pg_temp.action(code text)
returns uuid
language sql
security definer
as $$
  select id from public.client_actions
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' and reference_code = code;
$$;

create function pg_temp.action_status(code text)
returns text
language sql
security definer
as $$
  select status::text from public.client_actions
  where engagement_id = 'e0000000-0000-4000-8000-000000000001' and reference_code = code;
$$;

create table pg_temp.ids (key text primary key, id uuid, path text);
grant all on pg_temp.ids to authenticated;

-- -----------------------------------------------------------------------------
-- Who sees a request
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.client_actions), 6, 'an assigned Architect sees every request');
select pg_temp.reset_actor();
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.client_actions), 6,
  'the Executive Sponsor, who assigns requests, sees all of them');
select pg_temp.reset_actor();
select pg_temp.act_as('contributor@meridian.test');
select is((select string_agg(reference_code, ',' order by reference_code) from public.client_actions), 'ACT-003,ACT-004',
  'the Client Contributor sees only the requests addressed to them');
select is((select count(*)::int from public.client_action_subjects), 2, 'and only their subjects');
select ok((select count(*) from public.client_action_events) >= 3, 'and their events');
select pg_temp.reset_actor();
select pg_temp.act_as('viewer@meridian.test');
select is((select count(*)::int from public.client_actions), 0, 'the Client Viewer sees no requests');
select pg_temp.reset_actor();
select pg_temp.act_as('finance@meridian.test');
select is((select count(*)::int from public.client_actions), 0, 'nor does Client Finance');
select pg_temp.reset_actor();
select pg_temp.act_as('sponsor@harbor.test');
select is((select count(*)::int from public.client_actions), 0, 'nor another client organization');
select is((select count(*)::int from public.client_action_responses), 0, 'nor its responses');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Sending
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ insert into pg_temp.ids (key, id) select 'q', public.send_client_action(
  'e0000000-0000-4000-8000-000000000001', 'question', 'Who runs underwriting today?', 'Please name the person.',
  pg_temp.member('contributor@meridian.test'), current_date + 5, array['b3000000-0000-4000-8000-000000000201']::uuid[]) $$,
  'an Architect asks the Client Contributor about an element in their area');
select is((select reference_code from public.client_actions where id = (select id from pg_temp.ids where key = 'q')),
  'ACT-007', 'the request takes the next ACT reference code');
select throws_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question', 'Outside',
  'About the strategic model.', pg_temp.member('contributor@meridian.test'), null,
  array['b3000000-0000-4000-8000-000000000302']::uuid[]) $$,
  '23514', null, 'a request about something outside the addressee''s areas is refused');
select throws_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question', 'Viewer',
  'A question.', pg_temp.member('viewer@meridian.test')) $$,
  '23514', null, 'as is a request to someone who cannot respond');
select throws_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question', 'Internal',
  'A question.', pg_temp.member('researcher@tplco.test')) $$,
  '23514', null, 'or to a TPLCo member');
select throws_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question', 'Internal subject',
  'A question.', pg_temp.member('lead@meridian.test'), null, array['b6000000-0000-4000-8000-000000000002']::uuid[]) $$,
  '23514', null, 'only published, client-visible elements are sent to the client');
select throws_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'confirmation', 'Nothing',
  'Confirm.', pg_temp.member('lead@meridian.test')) $$,
  '23514', null, 'a confirmation names what to confirm');
select throws_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question', 'Late',
  'A question.', pg_temp.member('lead@meridian.test'), current_date - 1) $$,
  '23514', null, 'a due date cannot be in the past');
select throws_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'executive_attention',
  'Exec', 'Attention.', pg_temp.member('sponsor@meridian.test'), null, array['b3000000-0000-4000-8000-000000000502']::uuid[]) $$,
  '23514', null, 'executive attention is raised only by escalation');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select lives_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'information_request',
  'Board calendar', 'Please share the 2027 board calendar.', pg_temp.member('lead@meridian.test')) $$,
  'a Researcher sends requests too');
select pg_temp.reset_actor();
select pg_temp.act_as('finance@tplco.test');
select throws_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question', 'Finance',
  'A question.', pg_temp.member('lead@meridian.test')) $$,
  '42501', null, 'TPLCo Finance cannot send requests');
select pg_temp.reset_actor();
select pg_temp.act_as('lead@meridian.test');
select throws_ok($$ select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question', 'Client',
  'A question.', pg_temp.member('contributor@meridian.test')) $$,
  'P0002', null, 'nor can a client');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Responding
-- -----------------------------------------------------------------------------
select pg_temp.act_as('contributor@meridian.test');
select lives_ok($$ select public.respond_to_client_action(pg_temp.action('ACT-003'),
  'Two acquisitions: 2018 (Elm St) and 2022 (Harbor Rd). Summaries attached later.') $$,
  'the Client Contributor answers a request addressed to them');
select is(pg_temp.action_status('ACT-003'), 'responded', 'which is now responded');
select throws_ok($$ select public.respond_to_client_action(pg_temp.action('ACT-002'), 'Not mine') $$,
  'P0002', null, 'a request addressed to someone else does not exist for them');
select throws_ok($$ select public.respond_to_client_action(pg_temp.action('ACT-004'), '  ') $$,
  '23514', null, 'a response has words');
select pg_temp.reset_actor();
select pg_temp.act_as('viewer@meridian.test');
select throws_ok($$ select public.respond_to_client_action(pg_temp.action('ACT-002'), 'Viewer') $$,
  'P0002', null, 'the Client Viewer cannot respond');
select pg_temp.reset_actor();
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.respond_to_client_action(pg_temp.action('ACT-002'), 'On their behalf') $$,
  '42501', null, 'TPLCo never answers on the client''s behalf');
select pg_temp.reset_actor();
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok($$ select public.respond_to_client_action(pg_temp.action('ACT-005'), 'More') $$,
  '23514', null, 'a closed request takes no more responses');
select lives_ok($$ select public.respond_to_client_action(pg_temp.action('ACT-002'),
  'The Executive Director signs up to $2M; above that the board.') $$,
  'the Executive Sponsor, who assigns requests, may answer any of them');
select pg_temp.reset_actor();

-- Responses are the client's words: not even the owner rewrites them.
select throws_ok($$ update public.client_action_responses set body = 'Rewritten' $$,
  '23514', null, 'a response cannot be rewritten');

-- -----------------------------------------------------------------------------
-- Reassigning, closing, returning, withdrawing
-- -----------------------------------------------------------------------------
select pg_temp.act_as('lead@meridian.test');
select throws_ok($$ select public.reassign_client_action(pg_temp.action('ACT-001'), pg_temp.member('contributor@meridian.test')) $$,
  '23514', null, 'executive attention goes only to someone who approves architecture');
select pg_temp.reset_actor();
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.reassign_client_action((select id from pg_temp.ids where key = 'q'),
  pg_temp.member('viewer@meridian.test')) $$, '23514', null, 'a request is reassigned only to someone who can answer it');
select lives_ok($$ select public.reassign_client_action((select id from pg_temp.ids where key = 'q'),
  pg_temp.member('lead@meridian.test'), 'The lead owns underwriting questions.') $$, 'an Architect reassigns a request');
select is((select addressed_to_user_id from public.client_actions where id = (select id from pg_temp.ids where key = 'q')),
  '20000000-0000-4000-8000-000000000002'::uuid, 'which is now addressed to the Client Project Lead');
select throws_ok($$ select public.reassign_client_action(pg_temp.action('ACT-003'), pg_temp.member('lead@meridian.test')) $$,
  '23514', null, 'only an open request is reassigned');
select pg_temp.reset_actor();
select pg_temp.act_as('contributor@meridian.test');
select is((select count(*)::int from public.client_actions where id = (select id from pg_temp.ids where key = 'q')), 0,
  'the previous addressee no longer sees it');
select throws_ok($$ select public.reassign_client_action(pg_temp.action('ACT-003'), pg_temp.member('lead@meridian.test')) $$,
  '42501', null, 'a Client Contributor cannot reassign');
select throws_ok($$ select public.close_client_action(pg_temp.action('ACT-003')) $$,
  'P0002', null, 'nor close a request');
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.close_client_action((select id from pg_temp.ids where key = 'q')) $$,
  '23514', null, 'a request without a response is withdrawn, not closed');
select throws_ok($$ select public.return_client_action(pg_temp.action('ACT-003'), ' ') $$,
  '23514', null, 'returning a request says what more is needed');
select lives_ok($$ select public.return_client_action(pg_temp.action('ACT-003'), 'Please attach the closing summaries.') $$,
  'an Architect returns a response for more');
select is(pg_temp.action_status('ACT-003'), 'open', 'which reopens the request');
select lives_ok($$ select public.close_client_action(pg_temp.action('ACT-004'), 'Confirmed.') $$,
  'and closes an answered one');
select throws_ok($$ select public.close_client_action(pg_temp.action('ACT-001')) $$,
  '23514', null, 'executive attention closes with its escalation');
select throws_ok($$ select public.withdraw_client_action(pg_temp.action('ACT-001'), 'No longer needed') $$,
  '23514', null, 'and is not withdrawn');
select throws_ok($$ select public.withdraw_client_action(pg_temp.action('ACT-002'), '') $$,
  '23514', null, 'a withdrawal gives a reason');
select throws_ok($$ select public.withdraw_client_action(pg_temp.action('ACT-006'), 'Again') $$,
  '23514', null, 'a withdrawn request stays withdrawn');

-- Recording the client's words as evidence
select throws_ok($$ select public.record_response_as_evidence(
  (select r.id from public.client_action_responses r where r.action_id = pg_temp.action('ACT-005'))) $$,
  '23514', null, 'a response is recorded as evidence once');
select lives_ok($$ insert into pg_temp.ids (key, id) select 'ev', public.record_response_as_evidence(
  (select r.id from public.client_action_responses r where r.action_id = pg_temp.action('ACT-004'))) $$,
  'an Architect records a response as evidence');
select is((select row(provenance::text, client_visibility::text)::text from public.evidence_sources
           where id = (select id from pg_temp.ids where key = 'ev')),
  row('client_source', 'internal')::text, 'with client-source provenance, internal to TPLCo');
select pg_temp.reset_actor();
select pg_temp.act_as('researcher@tplco.test');
select lives_ok($$ select public.close_client_action(pg_temp.action('ACT-002')) $$, 'a Researcher closes a request');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Client input
-- -----------------------------------------------------------------------------
select pg_temp.act_as('contributor@meridian.test');
select is((select count(*)::int from public.client_contributions), 2, 'the Client Contributor sees their own input');
select lives_ok($$ insert into pg_temp.ids (key, id) select 'c', public.submit_client_contribution(
  'b3000000-0000-4000-8000-000000000203', 'Underwriting is done by the CFO today.') $$,
  'and adds input on a published element in their area');
select throws_ok($$ select public.submit_client_contribution('b3000000-0000-4000-8000-000000000301', 'Outside') $$,
  'P0002', null, 'but not on one outside it');
select throws_ok($$ select public.submit_client_contribution('b3000000-0000-4000-8000-000000000207', 'Draft') $$,
  'P0002', null, 'nor on an unpublished draft');
select pg_temp.reset_actor();
select pg_temp.act_as('viewer@meridian.test');
select is((select count(*)::int from public.client_contributions), 0, 'the Client Viewer sees no input');
select throws_ok($$ select public.submit_client_contribution('b3000000-0000-4000-8000-000000000301', 'Viewer') $$,
  '42501', null, 'and cannot add any');
select pg_temp.reset_actor();
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.submit_client_contribution('b3000000-0000-4000-8000-000000000301', 'Internal') $$,
  'P0002', null, 'input comes only from clients');
select throws_ok($$ select public.handle_client_contribution((select id from pg_temp.ids where key = 'c'), 'acknowledged',
  'Thanks', true) $$, '23514', null, 'only incorporated input is recorded as evidence');
select lives_ok($$ select public.handle_client_contribution((select id from pg_temp.ids where key = 'c'), 'incorporated',
  'Reflected in the underwriting skill.', true) $$, 'an Architect incorporates input and records it as evidence');
select throws_ok($$ select public.handle_client_contribution((select id from pg_temp.ids where key = 'c'), 'acknowledged',
  'Again') $$, '23514', null, 'input is handled once');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Files
-- -----------------------------------------------------------------------------
select pg_temp.act_as('contributor@meridian.test');
insert into pg_temp.ids (key, id, path)
select 'f', file_id, object_path from public.register_engagement_file(
  'e0000000-0000-4000-8000-000000000001', 'client_response', '../closing summary?.pdf', 'application/pdf', 1024);
select is((select filename from public.engagement_files where id = (select id from pg_temp.ids where key = 'f')),
  '.._closing summary_.pdf', 'a registered file name is made safe');
select throws_ok($$ select public.respond_to_client_action(pg_temp.action('ACT-003'), 'See file',
  null, array[(select id from pg_temp.ids where key = 'f')]) $$,
  '23514', null, 'a file is attached only once it is in storage');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('engagement-files', (select path from pg_temp.ids where key = 'f')) $$,
  'the uploader stores the registered file');
select throws_ok($$ insert into storage.objects (bucket_id, name)
                   values ('engagement-files', 'e0000000-0000-4000-8000-000000000001/unregistered/x.pdf') $$,
  '42501', null, 'but nothing unregistered');
select lives_ok($$ select public.respond_to_client_action(pg_temp.action('ACT-003'), 'Summaries attached.',
  null, array[(select id from pg_temp.ids where key = 'f')]) $$, 'and attaches it to their response');
select throws_ok($$ select public.register_engagement_file('e0000000-0000-4000-8000-000000000001', 'client_response',
  'huge.pdf', 'application/pdf', 30000000) $$, '23514', null, 'files are at most 25 MB');
select throws_ok($$ select public.register_engagement_file('e0000000-0000-4000-8000-000000000001', 'client_response',
  'run.exe', 'application/x-msdownload', 10) $$, '23514', null, 'and of an accepted type');
select pg_temp.reset_actor();

select pg_temp.act_as('lead@meridian.test');
select is((select count(*)::int from storage.objects where bucket_id = 'engagement-files'), 1,
  'the Client Project Lead, who sees the request, can download the file');
select pg_temp.reset_actor();
select pg_temp.act_as('viewer@meridian.test');
select is((select count(*)::int from storage.objects where bucket_id = 'engagement-files'), 0, 'the Client Viewer cannot');
select throws_ok($$ select public.register_engagement_file('e0000000-0000-4000-8000-000000000001', 'client_response',
  'a.pdf', 'application/pdf', 10) $$, '42501', null, 'nor upload a response file');
select pg_temp.reset_actor();
select pg_temp.act_as('sponsor@harbor.test');
select is((select count(*)::int from storage.objects where bucket_id = 'engagement-files'), 0,
  'nor can another client organization');
select pg_temp.reset_actor();
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from storage.objects where bucket_id = 'engagement-files'), 1, 'TPLCo readers can');
select throws_ok($$ select public.register_engagement_file('e0000000-0000-4000-8000-000000000001', 'client_response',
  'a.pdf', 'application/pdf', 10) $$, 'P0002', null, 'but client files come only from clients');
select pg_temp.reset_actor();

select * from finish();
rollback;
