-- =============================================================================
-- Phase 3 versions, approvals and baselines (pgTAP). Run with: pnpm db:test
--
-- Publishing writes immutable versions and snapshots; clients read the
-- published snapshot, never later working edits; approvals name exact
-- versions and are final; an approval of v2 survives v3; baselines reference
-- versions and freeze; compare_baselines reports what changed.
--
-- Seed: CAP-001 b3...201 has v1 (in baseline 1) and v2 (in baseline 2,
-- approved in the portal); STR-001 b3...301 v1 awaits a response; baseline 1
-- b3...901 was approved externally; baseline 2 b3...902.
-- =============================================================================
begin;

select plan(44);

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

-- Creates a core object as the current actor and returns its id.
create function pg_temp.new_object(
  p_type text, p_title text, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001',
  p_provenance public.provenance_type default 'architect_judgment'
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
  values (new_id, p_engagement, 'object', p_title, p_provenance);
  insert into public.architecture_objects (element_id, object_type) values (new_id, p_type);
  return new_id;
end;
$$;

-- Creates a Project Intelligence record (with its subtype row) as the current actor.
create function pg_temp.new_record(
  p_kind public.element_kind, p_title text, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001'
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.architecture_elements (id, engagement_id, kind, title, provenance)
  values (new_id, p_engagement, p_kind, p_title, 'architect_judgment');
  execute format('insert into public.%I (element_id) values ($1)',
    case p_kind when 'assumption' then 'assumptions' when 'risk' then 'risks' when 'constraint' then 'constraints'
                when 'decision' then 'decisions' when 'recommendation' then 'recommendations' end)
  using new_id;
  return new_id;
end;
$$;

create function pg_temp.link(p_source uuid, p_type text, p_target uuid, p_proficiency public.skill_proficiency default null)
returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.architecture_relationships (id, engagement_id, source_element_id, target_element_id,
                                                 relationship_type, required_proficiency, provenance)
  select new_id, e.engagement_id, p_source, p_target, p_type, p_proficiency, 'architect_judgment'
  from public.architecture_elements e where e.id = p_source;
  return new_id;
end;
$$;

create function pg_temp.client_view(element uuid)
returns table (title text, version_no int, approval_state text, latest_approved_version_no int)
language sql
as $$
  select title, version_no, approval_state, latest_approved_version_no
  from public.client_architecture('e0000000-0000-4000-8000-000000000001') where element_id = element;
$$;

-- -----------------------------------------------------------------------------
-- Versions and snapshots
-- -----------------------------------------------------------------------------
select is((select count(*)::int from public.element_versions where element_id = 'b3000000-0000-4000-8000-000000000201'), 2,
  'Commercial Acquisition has two published versions');
select ok(
  (select snapshot -> 'details' ->> 'maturity' = 'emerging' from public.element_versions
   where element_id = 'b3000000-0000-4000-8000-000000000201' and version_no = 1)
  and (select snapshot -> 'details' ->> 'maturity' = 'defined' from public.element_versions
       where element_id = 'b3000000-0000-4000-8000-000000000201' and version_no = 2),
  'each version keeps the element as it was published');
select ok(
  exists (select 1 from public.element_versions v, jsonb_array_elements(v.snapshot -> 'statements') s
          where v.element_id = 'b3000000-0000-4000-8000-000000000201' and v.version_no = 2
            and s ->> 'id' = 'b3000000-0000-4000-8000-000000000803')
  and not exists (select 1 from public.element_versions v, jsonb_array_elements(v.client_snapshot -> 'statements') s
                  where v.element_id = 'b3000000-0000-4000-8000-000000000201' and v.version_no = 2
                    and s ->> 'id' = 'b3000000-0000-4000-8000-000000000803'),
  'the full snapshot keeps the internal note; the client snapshot omits it');
select ok(
  (select snapshot ? 'source_reference' and not client_snapshot ? 'source_reference'
          and not client_snapshot ? 'ip_classification' and not client_snapshot ? 'owner_user_id'
   from public.element_versions where element_id = 'b3000000-0000-4000-8000-000000000201' and version_no = 2),
  'the client snapshot drops internal fields');
select is(
  (select s -> 'evidence' -> 0 -> 'source' ->> 'title' from public.element_versions v,
          jsonb_array_elements(v.client_snapshot -> 'statements') s
   where v.element_id = 'b3000000-0000-4000-8000-000000000101' and s ->> 'id' = 'b3000000-0000-4000-8000-000000000804'),
  'Regional Commercial Real Estate Outlook 2026', 'client-visible evidence is cited in the client snapshot');
select is(
  (select string_agg(e -> 'stance' #>> '{}', ',' order by e -> 'stance' #>> '{}') from public.element_versions v,
          jsonb_array_elements(v.snapshot -> 'statements') s, jsonb_array_elements(s -> 'evidence') e
   where v.element_id = 'b3000000-0000-4000-8000-000000000101' and s ->> 'id' = 'b3000000-0000-4000-8000-000000000804'),
  'contradicts,supports', 'a statement can cite supporting and contradicting evidence');

select throws_ok($$ update public.element_versions set change_summary = 'Rewritten' $$,
  '42501', null, 'versions cannot be edited');
select throws_ok($$ delete from public.element_versions where element_id = 'b3000000-0000-4000-8000-000000000201' $$,
  '23514', null, 'nor deleted');
select throws_ok($$ select private.begin_architecture_operation();
                    update public.element_versions set change_summary = 'Rewritten' $$,
  '23514', null, 'not even inside an operation: versions are append-only');
select private.end_architecture_operation();
select throws_ok($$ update public.domain_assessments set maturity = 'operationalized' $$,
  '42501', null, 'domain assessments are append-only');

-- -----------------------------------------------------------------------------
-- The client sees the published version, not the working copy
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
update public.architecture_elements set title = 'Commercial Property Acquisition'
where id = 'b3000000-0000-4000-8000-000000000201';
select is(public.preview_client_snapshot('b3000000-0000-4000-8000-000000000201') ->> 'title',
  'Commercial Property Acquisition', 'Preview as client shows the working copy as it would be published');
select pg_temp.reset_actor();
select pg_temp.act_as('viewer@meridian.test');
select is((select title from pg_temp.client_view('b3000000-0000-4000-8000-000000000201')), 'Commercial Acquisition',
  'the client keeps seeing the published title while the working copy changes');
select is((select approval_state from pg_temp.client_view('b3000000-0000-4000-8000-000000000201')), 'approved',
  'v2 shows as approved');
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
select public.submit_element_for_review('b3000000-0000-4000-8000-000000000201');
select is((select lifecycle::text from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000201'),
  'in_review', 'the revised working copy is submitted for review');
select pg_temp.reset_actor();
select pg_temp.act_as('principal@tplco.test');
select public.return_element_to_draft('b3000000-0000-4000-8000-000000000201', 'Tighten the summary first');
select is((select lifecycle::text from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000201'),
  'published', 'returning it keeps it published, because v2 is still the published version');
select is(
  (select public.publish_element_version('b3000000-0000-4000-8000-000000000201', 'Renamed') is not null),
  true, 'the Principal publishes v3');
select is(
  (select client_snapshot from public.element_versions where element_id = 'b3000000-0000-4000-8000-000000000201' and version_no = 3),
  public.preview_client_snapshot('b3000000-0000-4000-8000-000000000201'),
  'the published client snapshot is exactly what the preview showed');
select pg_temp.reset_actor();

select pg_temp.act_as('viewer@meridian.test');
select is((select title from pg_temp.client_view('b3000000-0000-4000-8000-000000000201')), 'Commercial Property Acquisition',
  'the client now sees v3');
select is((select approval_state from pg_temp.client_view('b3000000-0000-4000-8000-000000000201')), 'not_requested',
  'v3 has not been sent for approval');
select is((select latest_approved_version_no from pg_temp.client_view('b3000000-0000-4000-8000-000000000201')), 2,
  'and the element still shows v2 as approved');
select is(
  (select string_agg(version_no || ':' || approval_state, ',' order by version_no)
   from public.client_element_versions('b3000000-0000-4000-8000-000000000201')),
  '1:not_requested,2:approved,3:not_requested', 'history keeps every version with its own approval state');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Approvals
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.request_architecture_approval(
                      (select id from public.element_versions where element_id = 'b3000000-0000-4000-8000-000000000201' and version_no = 1),
                      null) $$,
  '23514', null, 'approval is requested only for the latest version');
select throws_ok($$ select public.request_architecture_approval(
                      (select latest_version_id from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000301'),
                      null) $$,
  '23514', null, 'and only once per version');
select throws_ok($$ select public.request_architecture_approval(
                      (select latest_version_id from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000108'),
                      null) $$,
  '23514', null, 'never for an internal element');
select lives_ok($$ select public.request_architecture_approval(
                     (select latest_version_id from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000201'),
                     null, 'Please confirm the renamed capability.') $$,
  'an Architect requests approval of v3');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select throws_ok($$ select public.respond_to_architecture_approval(
                      (select a.id from public.architecture_approvals a
                       join public.element_versions v on v.id = a.element_version_id
                       where v.element_id = 'b3000000-0000-4000-8000-000000000201' and v.version_no = 3),
                      'changes_requested', '') $$,
  '23514', null, 'requesting changes needs a comment');
select public.respond_to_architecture_approval(
  (select a.id from public.architecture_approvals a join public.element_versions v on v.id = a.element_version_id
   where v.element_id = 'b3000000-0000-4000-8000-000000000201' and v.version_no = 3),
  'changes_requested', 'Keep the original name.');
select throws_ok($$ select public.respond_to_architecture_approval(
                      (select a.id from public.architecture_approvals a
                       join public.element_versions v on v.id = a.element_version_id
                       where v.element_id = 'b3000000-0000-4000-8000-000000000201' and v.version_no = 3),
                      'approved') $$,
  '23514', null, 'a response is final');
select is((select approval_state from pg_temp.client_view('b3000000-0000-4000-8000-000000000201')), 'changes_requested',
  'v3 shows changes requested');
select is((select latest_approved_version_no from pg_temp.client_view('b3000000-0000-4000-8000-000000000201')), 2,
  'while the approval of v2 stands');
select is((select title from pg_temp.client_view('b3000000-0000-4000-8000-000000000201')), 'Commercial Property Acquisition',
  'and v3 stays visible: approval never decides visibility');
select pg_temp.reset_actor();

select is(
  (select a.responded_by from public.architecture_approvals a join public.element_versions v on v.id = a.element_version_id
   where v.element_id = 'b3000000-0000-4000-8000-000000000201' and v.version_no = 2),
  '20000000-0000-4000-8000-000000000001'::uuid, 'the portal approval records who approved the exact version');
select throws_ok($$ update public.architecture_approvals set comment = 'Edited' where response is not null $$,
  '42501', null, 'approvals cannot be edited');
select ok(
  (select approval_source = 'external_recorded_by_tplco' and external_approver_name = 'Eleanor Vance'
          and external_approval_method = 'signed_document' and external_evidence is not null and recorded_by is not null
   from public.architecture_approvals where baseline_id = 'b3000000-0000-4000-8000-000000000901'),
  'an external approval keeps the approver, method, evidence and recorder, distinct from portal approvals');

-- -----------------------------------------------------------------------------
-- Baselines
-- -----------------------------------------------------------------------------
select is(
  (select v.version_no from public.architecture_baseline_items i join public.element_versions v on v.id = i.element_version_id
   where i.baseline_id = 'b3000000-0000-4000-8000-000000000901' and i.element_id = 'b3000000-0000-4000-8000-000000000201'),
  1, 'baseline 1 references v1 of Commercial Acquisition');
select is(
  (select v.version_no from public.architecture_baseline_items i join public.element_versions v on v.id = i.element_version_id
   where i.baseline_id = 'b3000000-0000-4000-8000-000000000902' and i.element_id = 'b3000000-0000-4000-8000-000000000201'),
  2, 'baseline 2 references v2');
select is((select count(*)::int from public.architecture_baseline_relationships where baseline_id = 'b3000000-0000-4000-8000-000000000901'),
  34, 'baseline 1 captured the published relationships between its elements');
select is(
  (select subject || ':' || change || ':' || coalesce(reference_code, relationship_type, domain::text)
   from public.compare_baselines('b3000000-0000-4000-8000-000000000901', 'b3000000-0000-4000-8000-000000000902')
   order by subject, change, coalesce(reference_code, relationship_type, domain::text) limit 1),
  'domain:changed:capability', 'compare_baselines reports the domain state that moved');
select is(
  (select string_agg(subject || ':' || change || ':' || coalesce(reference_code, relationship_type, domain::text), ', '
                     order by subject, change, coalesce(reference_code, relationship_type, domain::text))
   from public.compare_baselines('b3000000-0000-4000-8000-000000000901', 'b3000000-0000-4000-8000-000000000902')),
  'domain:changed:capability, element:added:APP-006, element:changed:CAP-001, relationship:added:implemented_through, '
  || 'relationship:added:part_of, relationship:removed:exploits',
  'and the elements and relationships added, changed and removed');
select is(
  (select to_version_no from public.compare_baselines('b3000000-0000-4000-8000-000000000902')
   where reference_code = 'CAP-001'),
  3, 'comparing with the current published architecture shows v3 since baseline 2');
select ok(
  exists (select 1 from public.architecture_relationships r
          join public.architecture_baseline_relationships b on b.relationship_id = r.id
          where b.baseline_id = 'b3000000-0000-4000-8000-000000000901' and r.retired_at is not null),
  'a retired relationship is preserved and still cited by the baseline that included it');

select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ insert into public.architecture_baseline_items (baseline_id, element_id, element_version_id)
                    select 'b3000000-0000-4000-8000-000000000902', id, latest_version_id
                    from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000406' $$,
  '23514', null, 'a frozen baseline cannot change');
select throws_ok($$ select public.freeze_baseline('b3000000-0000-4000-8000-000000000902') $$,
  '23514', null, 'nor be frozen twice');
insert into public.architecture_baselines (id, engagement_id, label)
values ('b4000000-0000-4000-8000-000000000903', 'e0000000-0000-4000-8000-000000000001', 'Empty draft');
select throws_ok($$ select public.freeze_baseline('b4000000-0000-4000-8000-000000000903') $$,
  '23514', null, 'an empty baseline cannot be frozen');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Retirement and supersession
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select public.retire_element('b3000000-0000-4000-8000-000000000304', 'Folded into the operating model');
select pg_temp.reset_actor();
select pg_temp.act_as('viewer@meridian.test');
select is((select count(*)::int from public.client_architecture('e0000000-0000-4000-8000-000000000001')), 33,
  'a retired element leaves the client view');
select pg_temp.reset_actor();

select * from finish();
rollback;
