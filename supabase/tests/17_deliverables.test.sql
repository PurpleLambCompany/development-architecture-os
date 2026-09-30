-- =============================================================================
-- Phase 5 deliverables (pgTAP). Run with: pnpm db:test
--
-- create_deliverable, the manage_deliverables capability, confidentiality
-- and view_confidential_deliverables, the documents relationship type,
-- attach_deliverable_file (published version only), and deliverables's own
-- reference codes (DLV-n). Meridian, e...01.
-- =============================================================================
begin;

select plan(22);

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

-- -----------------------------------------------------------------------------
-- create_deliverable: capability and validation
-- -----------------------------------------------------------------------------
select pg_temp.act_as('finance@tplco.test');
select throws_ok($$ select public.create_deliverable('e0000000-0000-4000-8000-000000000001',
  'executive_summary', 'Draft Summary') $$, '42501', null,
  'TPLCo Finance holds no manage_deliverables and cannot create a deliverable');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.create_deliverable('e0000000-0000-4000-8000-000000000001',
  'executive_summary', '') $$, '23514', null, 'a deliverable needs a title');
insert into pg_temp.ids (key, id)
select 'summary', public.create_deliverable('e0000000-0000-4000-8000-000000000001', 'executive_summary',
  'Q3 Executive Summary', null, false, 'Progress against the strategy this quarter.');
select is((select reference_code from public.architecture_elements where id = (select id from pg_temp.ids where key = 'summary')),
  'DLV-001', 'it gets the DLV prefix');
insert into pg_temp.ids (key, id)
select 'blueprint', public.create_deliverable('e0000000-0000-4000-8000-000000000001',
  'full_architecture_blueprint', 'Confidential Blueprint v1', null, true, 'The full architecture, confidential.');
select is((select reference_code from public.architecture_elements where id = (select id from pg_temp.ids where key = 'blueprint')),
  'DLV-002', 'sequential reference codes');
select is((select confidential from public.deliverables where element_id = (select id from pg_temp.ids where key = 'blueprint')),
  true, 'the confidential flag is recorded');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Relationship rules: documents
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ insert into public.architecture_relationships
  (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000001', (select id from pg_temp.ids where key = 'summary'),
    'b3000000-0000-4000-8000-000000000201', 'documents', 'architect_judgment') $$,
  'a deliverable documents a core object');
select throws_ok($$ insert into public.architecture_relationships
  (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000201',
    (select id from pg_temp.ids where key = 'summary'), 'documents', 'architect_judgment') $$,
  '23514', null, 'documents only runs deliverable -> element, never the reverse');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- attach_deliverable_file: only a published deliverable
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
insert into pg_temp.ids (key, id, path)
select 'f', file_id, object_path from public.register_engagement_file(
  'e0000000-0000-4000-8000-000000000001', 'deliverable', 'summary.pdf', 'application/pdf', 2048);
select throws_ok($$ select public.attach_deliverable_file((select id from pg_temp.ids where key = 'summary'),
  array[(select id from pg_temp.ids where key = 'f')]) $$, '23514', null,
  'the deliverable must be published before a file is attached');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.architecture_elements set client_visibility = 'client'
  where id = (select id from pg_temp.ids where key = 'summary') $$,
  'the Principal Architect makes the summary client-visible');
select lives_ok($$ select public.publish_element_version((select id from pg_temp.ids where key = 'summary'),
  'First publication.') $$, 'and publishes it');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.attach_deliverable_file((select id from pg_temp.ids where key = 'summary'),
  array[(select id from pg_temp.ids where key = 'f')]) $$, '23514', null,
  'a file is attached only once it has finished uploading');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('engagement-files', (select path from pg_temp.ids where key = 'f')) $$,
  'the uploader stores the registered file');
select lives_ok($$ select public.attach_deliverable_file((select id from pg_temp.ids where key = 'summary'),
  array[(select id from pg_temp.ids where key = 'f')]) $$, 'and the Researcher attaches it');
select is((select element_version_id is not null from public.engagement_files
           where id = (select id from pg_temp.ids where key = 'f')), true,
  'the file is now linked to the published version');
select throws_ok($$ select public.attach_deliverable_file((select id from pg_temp.ids where key = 'summary'),
  array[(select id from pg_temp.ids where key = 'f')]) $$, '23514', null,
  'a file already attached cannot be attached again');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- deliverable_register / client_deliverables and confidentiality
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.deliverable_register('e0000000-0000-4000-8000-000000000001')), 2,
  'the register lists both deliverables');
select is((select latest_version_id is not null from public.deliverable_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'DLV-001'), true, 'DLV-001 shows it is published');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.client_deliverables('e0000000-0000-4000-8000-000000000001')), 1,
  'the client sees the published, non-confidential deliverable');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.architecture_elements set client_visibility = 'client'
  where id = (select id from pg_temp.ids where key = 'blueprint') $$,
  'the Principal Architect makes the blueprint client-visible too');
select lives_ok($$ select public.publish_element_version((select id from pg_temp.ids where key = 'blueprint'),
  'First publication.') $$, 'and publishes the confidential blueprint');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.client_deliverables('e0000000-0000-4000-8000-000000000001')), 2,
  'the Executive Sponsor (view_confidential_deliverables) sees the confidential one too');
select pg_temp.reset_actor();

select pg_temp.act_as('viewer@meridian.test');
select is((select count(*)::int from public.client_deliverables('e0000000-0000-4000-8000-000000000001')), 1,
  'the Client Viewer, without view_confidential_deliverables, sees only the non-confidential one');
select pg_temp.reset_actor();

select * from finish();
rollback;
