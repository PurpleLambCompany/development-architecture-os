-- =============================================================================
-- V1-A Increment 3, Workstream B (pgTAP). Run with: pnpm db:test
--
-- B1: client visibility of deliverables, reviews and implementation
--     initiatives is governed by publish_architecture alone; a flip exposes
--     and hides each through its client read model.
-- B2: a review's own fields are edited by manage_reviews holders only.
-- B3: a client reads a deliverable's files (row and stored object) exactly
--     when they can read the deliverable: client-visible, published, not
--     retired, inside their areas, confidential only with
--     view_confidential_deliverables, on their own engagement.
-- D9: files stay with the version they were attached to; a republication
--     neither moves nor hides them.
--
-- Meridian (Regional Innovation District, e...01) and Harbor (e...03).
-- =============================================================================
begin;

select plan(67);

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

create table pg_temp.ids (key text primary key, id uuid, path text);
grant all on pg_temp.ids to authenticated;

create function pg_temp.id(k text) returns uuid language sql as $$ select id from pg_temp.ids where key = k $$;

-- What the current actor can read of a file: its row, and its stored object.
create function pg_temp.reads_file(k text)
returns boolean
language sql
as $$
  select exists (select 1 from public.engagement_files where id = pg_temp.id(k))
     and exists (
       select 1 from storage.objects
       where bucket_id = 'engagement-files' and name = (select path from pg_temp.ids where key = k)
     );
$$;
create function pg_temp.sees_file_row(k text)
returns boolean
language sql
as $$ select exists (select 1 from public.engagement_files where id = pg_temp.id(k)) $$;
create function pg_temp.sees_file_object(k text)
returns boolean
language sql
as $$
  select exists (
    select 1 from storage.objects
    where bucket_id = 'engagement-files' and name = (select path from pg_temp.ids where key = k)
  )
$$;
create function pg_temp.sees_deliverable(k text, engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns boolean
language sql
as $$
  select exists (select 1 from public.client_deliverables(engagement) where element_id = pg_temp.id(k))
$$;

-- Registers a deliverable file as the current actor and stores its object.
create function pg_temp.upload(k text, engagement uuid, filename text, purpose public.engagement_file_purpose default 'deliverable', source uuid default null)
returns void
language plpgsql
as $$
begin
  insert into pg_temp.ids (key, id, path)
  select k, file_id, object_path
  from public.register_engagement_file(engagement, purpose, filename, 'application/pdf', 1024, source);
  insert into storage.objects (bucket_id, name) values ('engagement-files', (select path from pg_temp.ids where key = k));
end;
$$;

-- -----------------------------------------------------------------------------
-- Fixtures, as the Principal Architect: a deliverable documenting CAP-001
-- (inside the Meridian Contributor's Capability area), a confidential one,
-- a review, an initiative; files on each published version.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
insert into pg_temp.ids (key, id)
select 'd1', public.create_deliverable('e0000000-0000-4000-8000-000000000001', 'executive_summary',
  'Increment 3 Summary', null, false, 'What the district has decided.');
insert into public.architecture_relationships
  (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
values ('e0000000-0000-4000-8000-000000000001', pg_temp.id('d1'),
  'b3000000-0000-4000-8000-000000000201', 'documents', 'architect_judgment');
insert into pg_temp.ids (key, id)
select 'd2', public.create_deliverable('e0000000-0000-4000-8000-000000000001', 'full_architecture_blueprint',
  'Increment 3 Confidential Blueprint', null, true, 'Confidential.');
insert into public.architecture_relationships
  (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
values ('e0000000-0000-4000-8000-000000000001', pg_temp.id('d2'),
  'b3000000-0000-4000-8000-000000000201', 'documents', 'architect_judgment');
insert into pg_temp.ids (key, id)
select 'r1', public.create_review('e0000000-0000-4000-8000-000000000001', 'architecture_review',
  'Increment 3 Review', null, null, 'Agenda.');
insert into pg_temp.ids (key, id)
select 'i1', public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Increment 3 Initiative', array['b3000000-0000-4000-8000-000000000401']::uuid[], 'governance', null, null,
  'Stand up the board.');
select public.publish_element_version(pg_temp.id(k), 'First publication.') from unnest(array['d1', 'd2', 'r1', 'i1']) k;
select pg_temp.upload('f1', 'e0000000-0000-4000-8000-000000000001', 'summary-v1.pdf');
select pg_temp.upload('f2', 'e0000000-0000-4000-8000-000000000001', 'not-attached.pdf');
select pg_temp.upload('f3', 'e0000000-0000-4000-8000-000000000001', 'blueprint.pdf');
select pg_temp.upload('ev', 'e0000000-0000-4000-8000-000000000001', 'evidence.pdf', 'evidence',
  'b3000000-0000-4000-8000-000000000701');
select public.attach_deliverable_file(pg_temp.id('d1'), array[pg_temp.id('f1')]);
select public.attach_deliverable_file(pg_temp.id('d2'), array[pg_temp.id('f3')]);
-- Harbor's seeded, client-visible deliverable gets a file too.
insert into pg_temp.ids (key, id)
select 'hd', id from public.architecture_elements
where engagement_id = 'e0000000-0000-4000-8000-000000000003' and kind = 'deliverable';
select pg_temp.upload('hf', 'e0000000-0000-4000-8000-000000000003', 'harbor-deck.pdf');
select public.attach_deliverable_file(pg_temp.id('hd'), array[pg_temp.id('hf')]);
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- B1: only publish_architecture changes client visibility
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ update public.architecture_elements set client_visibility = 'client' where id = pg_temp.id('d1') $$,
  '42501', null, 'a Researcher (manage_deliverables, no publish_architecture) cannot show a deliverable to the client');
select throws_ok($$ update public.architecture_elements set client_visibility = 'client' where id = pg_temp.id('r1') $$,
  '42501', null, 'nor a review');
select throws_ok($$ update public.architecture_elements set client_visibility = 'client' where id = pg_temp.id('i1') $$,
  '42501', null, 'nor an initiative');
select pg_temp.reset_actor();
select pg_temp.act_as('projectadmin@tplco.test');
select throws_ok($$ update public.architecture_elements set client_visibility = 'client' where id = pg_temp.id('d1') $$,
  '42501', null, 'a Project Administrator (manage_deliverables, no publish_architecture) cannot either');
select pg_temp.reset_actor();
select pg_temp.act_as('lead@meridian.test');
update public.architecture_elements set client_visibility = 'client' where id = pg_temp.id('d1');
select pg_temp.reset_actor();
select is((select client_visibility::text from public.architecture_elements where id = pg_temp.id('d1')), 'internal',
  'a client cannot make a record client-visible (row-level security filters the update)');

-- Before visibility: nothing reaches any client.
select pg_temp.act_as('lead@meridian.test');
select ok(not pg_temp.sees_deliverable('d1'), 'before it is client-visible, the Client Lead does not see the published deliverable');
select ok(not pg_temp.sees_file_row('f1'), 'nor its file row');
select ok(not pg_temp.sees_file_object('f1'), 'nor its stored file');
select is((select count(*)::int from public.client_reviews('e0000000-0000-4000-8000-000000000001') where element_id = pg_temp.id('r1')), 0,
  'nor the published review');
select is((select count(*)::int from public.client_implementation('e0000000-0000-4000-8000-000000000001') where element_id = pg_temp.id('i1')), 0,
  'nor the published initiative');
select is((select count(*)::int from public.element_versions where element_id = pg_temp.id('d1')), 0,
  'nor any version of the deliverable');
select pg_temp.reset_actor();

-- The Principal Architect (publish_architecture) shows them.
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.architecture_elements set client_visibility = 'client'
  where id in (pg_temp.id('d1'), pg_temp.id('d2'), pg_temp.id('r1'), pg_temp.id('i1')) $$,
  'the Principal Architect shows the deliverables, the review and the initiative to the client');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- After visibility: who reads what
-- -----------------------------------------------------------------------------
select pg_temp.act_as('lead@meridian.test');
select ok(pg_temp.sees_deliverable('d1'), 'the Client Lead now sees the deliverable');
select ok(pg_temp.reads_file('f1'), 'and reads its file, row and stored object');
select ok(not pg_temp.sees_file_row('f2'), 'but not a deliverable file that was never attached to a version');
select ok(not pg_temp.sees_file_object('f2'), 'nor its stored object');
select ok(not pg_temp.sees_file_row('ev'), 'nor an internal evidence file');
select ok(not pg_temp.sees_file_object('ev'), 'nor its stored object');
select ok(pg_temp.sees_deliverable('d2'), 'a confidential deliverable is shown to the Client Lead (view_confidential_deliverables)');
select ok(pg_temp.reads_file('f3'), 'with its file');
select is((select count(*)::int from public.client_reviews('e0000000-0000-4000-8000-000000000001') where element_id = pg_temp.id('r1')), 1,
  'the review reaches the Client Lead');
select is((select count(*)::int from public.client_implementation('e0000000-0000-4000-8000-000000000001') where element_id = pg_temp.id('i1')), 1,
  'and the initiative');
select ok(not pg_temp.sees_file_row('hf'), 'the Meridian Client Lead does not see Harbor''s deliverable file');
select ok(not pg_temp.sees_file_object('hf'), 'nor its stored object');
select is((select count(*)::int from public.client_deliverables('e0000000-0000-4000-8000-000000000003')), 0,
  'nor Harbor''s deliverables');
select pg_temp.reset_actor();

select pg_temp.act_as('viewer@meridian.test');
select ok(pg_temp.reads_file('f1'), 'the Client Viewer reads the ordinary deliverable''s file');
select ok(not pg_temp.sees_deliverable('d2'), 'but not the confidential deliverable (no view_confidential_deliverables)');
select ok(not pg_temp.sees_file_row('f3'), 'nor its file row');
select ok(not pg_temp.sees_file_object('f3'), 'nor its stored file');
select pg_temp.reset_actor();

select pg_temp.act_as('contributor@meridian.test');
select ok(pg_temp.sees_deliverable('d1'), 'the area-limited Client Contributor sees a deliverable documenting an object in their area');
select ok(pg_temp.reads_file('f1'), 'and reads its file');
select ok(not pg_temp.sees_deliverable('d2'), 'but not the confidential one');
select ok(not pg_temp.sees_file_row('f3'), 'nor its file');
select is((select count(*)::int from public.client_reviews('e0000000-0000-4000-8000-000000000001') where element_id = pg_temp.id('r1')), 0,
  'nor a review that examines nothing in their area');
select is((select count(*)::int from public.client_implementation('e0000000-0000-4000-8000-000000000001') where element_id = pg_temp.id('i1')), 0,
  'nor an initiative that implements nothing in their area');
select pg_temp.reset_actor();

select pg_temp.act_as('advisor@consulting.test');
select ok(not pg_temp.sees_deliverable('d1'), 'a Contributor whose areas do not include the documented object does not see the deliverable');
select ok(not pg_temp.sees_file_row('f1'), 'nor its file row');
select ok(not pg_temp.sees_file_object('f1'), 'nor its stored file');
select ok(pg_temp.reads_file('hf'), 'while, as Harbor''s Client Lead, they read Harbor''s deliverable file');
select pg_temp.reset_actor();

select pg_temp.act_as('finance@meridian.test');
select ok(not pg_temp.sees_file_row('f1'), 'Client Finance (no view_architecture) does not see the deliverable file');
select ok(not pg_temp.sees_file_object('f1'), 'nor its stored file');
select pg_temp.reset_actor();

select pg_temp.act_as('lead@harbor.test');
select ok(pg_temp.reads_file('hf'), 'Harbor''s Client Lead reads Harbor''s deliverable file');
select ok(not pg_temp.sees_file_row('f1'), 'but not Meridian''s');
select ok(not pg_temp.sees_file_object('f1'), 'nor its stored file');
select pg_temp.reset_actor();

-- A client never writes deliverable files or their links.
select pg_temp.act_as('lead@meridian.test');
select throws_ok($$ select public.attach_deliverable_file(pg_temp.id('d1'), array[pg_temp.id('f2')]) $$,
  'P0002', null, 'a client cannot attach a file to a deliverable (it does not exist for them)');
select throws_ok($$ update public.engagement_files set element_version_id = null where id = pg_temp.id('f1') $$,
  '42501', null, 'nor detach one');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- D9: a republication keeps each file with its own version
-- -----------------------------------------------------------------------------
insert into pg_temp.ids (key, id)
select 'v1', latest_version_id from public.architecture_elements where id = pg_temp.id('d1');
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.publish_element_version(pg_temp.id('d1'), 'Corrected summary.') $$,
  'the deliverable is republished');
select pg_temp.upload('f4', 'e0000000-0000-4000-8000-000000000001', 'summary-v2.pdf');
select lives_ok($$ select public.attach_deliverable_file(pg_temp.id('d1'), array[pg_temp.id('f4')]) $$,
  'and a file attached to version 2');
select pg_temp.reset_actor();
select is((select element_version_id from public.engagement_files where id = pg_temp.id('f1')), pg_temp.id('v1'),
  'the version 1 file still belongs to version 1');
select is((select v.version_no from public.engagement_files f join public.element_versions v on v.id = f.element_version_id
           where f.id = pg_temp.id('f4')), 2, 'the new file belongs to version 2');
select is((select count(*)::int from public.engagement_files f join public.element_versions v on v.id = f.element_version_id
           where v.element_id = pg_temp.id('d1')), 2, 'nothing was copied forward: two files, one per version');
select pg_temp.act_as('lead@meridian.test');
select ok(pg_temp.reads_file('f1'), 'the Client Lead still reads the version 1 file after the republication');
select ok(pg_temp.reads_file('f4'), 'and reads the version 2 file');
select is((select array_agg(v.version_no order by v.version_no) from public.engagement_files f
           join public.element_versions v on v.id = f.element_version_id where v.element_id = pg_temp.id('d1')),
  array[1, 2], 'and sees which version each belongs to');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- B2: review fields
-- -----------------------------------------------------------------------------
select pg_temp.act_as('finance@tplco.test');
update public.reviews set summary = 'Changed by finance' where element_id = pg_temp.id('r1');
select pg_temp.reset_actor();
select is((select summary from public.reviews where element_id = pg_temp.id('r1')), 'Agenda.',
  'a Finance Administrator (no manage_reviews) cannot edit a review''s fields');
select pg_temp.act_as('lead@meridian.test');
update public.reviews set summary = 'Changed by the client' where element_id = pg_temp.id('r1');
select pg_temp.reset_actor();
select is((select summary from public.reviews where element_id = pg_temp.id('r1')), 'Agenda.',
  'nor can a client');
select pg_temp.act_as('projectadmin@tplco.test');
select lives_ok($$ update public.reviews set scheduled_for = '2026-11-02T15:00:00Z', summary = 'Corrected agenda.'
  where element_id = pg_temp.id('r1') $$, 'a Project Administrator (manage_reviews) corrects the date and summary');
select pg_temp.reset_actor();
select is((select summary from public.reviews where element_id = pg_temp.id('r1')), 'Corrected agenda.',
  'and the correction is recorded');

-- -----------------------------------------------------------------------------
-- Hiding again, and retirement
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.architecture_elements set client_visibility = 'internal' where id = pg_temp.id('d1') $$,
  'the Principal Architect makes the deliverable internal again');
select pg_temp.reset_actor();
select pg_temp.act_as('lead@meridian.test');
select ok(not pg_temp.sees_deliverable('d1'), 'the Client Lead no longer sees it');
select ok(not pg_temp.sees_file_row('f1'), 'nor its version 1 file');
select ok(not pg_temp.sees_file_object('f4'), 'nor its version 2 stored file');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.retire_element(pg_temp.id('d2'), 'Withdrawn.') $$, 'the confidential deliverable is retired');
select pg_temp.reset_actor();
select pg_temp.act_as('lead@meridian.test');
select ok(not pg_temp.sees_deliverable('d2'), 'a retired deliverable is no longer shown to the client');
select ok(not pg_temp.sees_file_row('f3'), 'nor its file row');
select ok(not pg_temp.sees_file_object('f3'), 'nor its stored file');
select pg_temp.reset_actor();

-- Internal readers keep every file.
select pg_temp.act_as('researcher@tplco.test');
select ok(pg_temp.reads_file('f1') and pg_temp.reads_file('f3') and pg_temp.reads_file('f4') and pg_temp.reads_file('ev'),
  'internal readers still read every file of the engagement');
select pg_temp.reset_actor();

select * from finish();
rollback;
