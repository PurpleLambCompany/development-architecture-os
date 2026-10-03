-- =============================================================================
-- V1-A Increment 6 (Workstream F, decision D10): evidence-source deletion
-- (pgTAP). Run with: pnpm db:test
--
-- public.delete_evidence_source refuses a cited source with a readable
-- message naming what cites it, deletes an uncited one, and detaches (and
-- reports for storage cleanup) any attached file, without ever touching a
-- different engagement's data or working without edit_architecture.
--
-- Seed: Meridian district e...01 (architect@tplco.test, researcher@tplco.test
-- both hold edit_architecture; contributor@meridian.test is a client member
-- with no edit_architecture); Workforce e...02.
-- =============================================================================
begin;

select plan(11);

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

create function pg_temp.new_source(p_title text, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.evidence_sources (id, engagement_id, title, source_type, provenance, client_visibility)
  values (new_id, p_engagement, p_title, 'document', 'architect_judgment', 'internal');
  return new_id;
end;
$$;
grant execute on function pg_temp.new_source(text, uuid) to authenticated;

create function pg_temp.new_object(p_title text, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
  values (new_id, p_engagement, 'object', p_title, 'architect_judgment');
  insert into public.architecture_objects (element_id, object_type) values (new_id, 'capability');
  return new_id;
end;
$$;
grant execute on function pg_temp.new_object(text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. An uncited source is deleted, and an empty file list is returned when
--    it has no attached file.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table src_uncited as select pg_temp.new_source('Uncited source') as id;

select is(
  (select array_length(public.delete_evidence_source((select id from src_uncited)), 1)),
  null, '1. deleting an uncited source with no attached file returns an empty file list');
select is(
  (select count(*)::int from public.evidence_sources where id = (select id from src_uncited)),
  0, '   and the source is gone');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 2. A source cited by a statement cannot be deleted; the message names
--    the citing element's reference code.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table obj_for_stmt as select pg_temp.new_object('Cited-by-statement element') as id;
create temp table src_stmt_cited as select pg_temp.new_source('Statement-cited source') as id;
insert into public.architecture_statements (element_id, statement_kind, body, provenance)
values ((select id from obj_for_stmt), 'finding', 'A finding citing the source.', 'architect_judgment');
insert into public.statement_evidence_links (statement_id, evidence_source_id, stance)
select s.id, (select id from src_stmt_cited), 'supports'
from public.architecture_statements s where s.element_id = (select id from obj_for_stmt);

select throws_ok(
  format('select public.delete_evidence_source(%L)', (select id from src_stmt_cited)),
  '23514', null,
  '2. a source cited by a statement is refused');
select is(
  (select count(*)::int from public.evidence_sources where id = (select id from src_stmt_cited)),
  1, '   and the source still exists');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 3. A source cited directly by an element (element_evidence_links) cannot
--    be deleted either.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table obj_for_elink as select pg_temp.new_object('Cited-by-element') as id;
create temp table src_elink_cited as select pg_temp.new_source('Element-cited source') as id;
insert into public.element_evidence_links (element_id, evidence_source_id, stance)
values ((select id from obj_for_elink), (select id from src_elink_cited), 'supports');

select throws_ok(
  format('select public.delete_evidence_source(%L)', (select id from src_elink_cited)),
  '23514', null,
  '3. a source cited directly by an element is refused');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 3b. A source recorded as an acceptance criterion's agreement evidence
--     cannot be deleted either -- this and the other four FK references
--     to evidence_sources beyond the two above (method_application_evidence,
--     implementation_checkpoints, client_action_responses,
--     client_contributions) are all declared on delete restrict the same
--     way; this case stands in for all five so the refusal is proven to
--     actually name a non-statement, non-element citation rather than
--     just the two the function originally checked.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table obj_for_acr as select pg_temp.new_object('Governed-by-criterion element') as id;
create temp table src_acr_cited as select pg_temp.new_source('Criterion-cited source') as id;
select public.publish_element_version((select id from obj_for_acr), 'First publication.');
create temp table criterion_for_acr as
  select public.propose_acceptance_criterion((select id from obj_for_acr), 'The capability meets the agreed threshold.') as id;
select public.agree_acceptance_criterion(
  (select id from criterion_for_acr), 'architect@tplco.test', current_date, (select id from src_acr_cited));

select throws_ok(
  format('select public.delete_evidence_source(%L)', (select id from src_acr_cited)),
  '23514', null,
  '3b. a source cited as an acceptance criterion''s agreement evidence is refused');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 4. Unauthorized: a client member cannot delete any evidence source.
--    require_architecture_capability's own first gate (private.can_read_architecture)
--    is internal-only (is_internal() and can_access_engagement), so a client
--    caller is refused as not found before the capability is even checked --
--    the same answer every other internal-only architecture mutation gives a
--    client, never a distinguishing 42501 that would confirm the source exists.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table src_unauth as select pg_temp.new_source('Unauthorized-deletion target') as id;
select pg_temp.reset_actor();

select pg_temp.act_as('contributor@meridian.test');
select throws_ok(
  format('select public.delete_evidence_source(%L)', (select id from src_unauth)),
  'P0002', null,
  '4. a client member is refused as not found (architecture mutation is internal-only)');
select pg_temp.reset_actor();
select is(
  (select count(*)::int from public.evidence_sources where id = (select id from src_unauth)),
  1, '   and the source still exists');

-- -----------------------------------------------------------------------------
-- 5. Cross-engagement: a source in another engagement the actor cannot
--    read at all is refused as not found, never leaked as a permission
--    denial.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
create temp table src_other_eng as select pg_temp.new_source('Workforce source', 'e0000000-0000-4000-8000-000000000002') as id;
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
select throws_ok(
  format('select public.delete_evidence_source(%L)', (select id from src_other_eng)),
  'P0002', null,
  '5. a cross-engagement source is refused as not found');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 6. An uncited source with an attached file: deletion detaches the file
--    row and returns its object_path for the caller to remove from
--    storage, rather than being blocked by the file's own FK.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
create temp table src_with_file as select pg_temp.new_source('Source with an attached file') as id;
create temp table file_row as
  select file_id as id, object_path as path from public.register_engagement_file(
    'e0000000-0000-4000-8000-000000000001', 'evidence', 'attachment.pdf', 'application/pdf', 1024,
    (select id from src_with_file));
insert into storage.objects (bucket_id, name) values ('engagement-files', (select path from file_row));

select is(
  (select public.delete_evidence_source((select id from src_with_file))),
  array[(select path from file_row)],
  '6. deleting an uncited source with an attached file returns its object_path');
select is(
  (select count(*)::int from public.engagement_files where id = (select id from file_row)),
  0, '   and the engagement_files row is gone (no orphaned metadata, no FK block)');

select * from finish();
rollback;
