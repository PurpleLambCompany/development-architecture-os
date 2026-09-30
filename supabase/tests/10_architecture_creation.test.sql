-- =============================================================================
-- Phase 3 element creation (pgTAP). Run with: pnpm db:test
--
-- public.create_architecture_element creates the spine row, its subtype row
-- and a record's domains in one transaction. It is SECURITY INVOKER, so the
-- caller's own grants, RLS and guards decide; these tests show it gives no
-- one more authority than direct inserts would.
-- =============================================================================
begin;

select plan(16);

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

grant execute on function pg_temp.act_as(text) to authenticated;
grant execute on function pg_temp.reset_actor() to authenticated;

-- Meridian (e...01): architect edits and publishes; researcher edits only.
select pg_temp.act_as('architect@tplco.test');

create temporary table created (label text primary key, id uuid) on commit drop;
grant all on created to authenticated;

insert into created
select 'object', public.create_architecture_element(
  'e0000000-0000-4000-8000-000000000001', 'object',
  '{"title": "Tenant Mix", "summary": "The intended balance of tenants.", "provenance": "architect_judgment", "client_visibility": "client"}',
  '{"object_type": "concept", "maturity": "emerging", "maturity_rationale": "Early working definition.", "attributes": {"schema_version": 1, "definition": "The planned balance of tenant types"}}'
);

select is(
  (select row(e.kind, e.lifecycle, o.domain, o.object_type, o.maturity, e.client_visibility)::text
     from public.architecture_elements e join public.architecture_objects o on o.element_id = e.id
    where e.id = (select id from created where label = 'object')),
  row('object'::public.element_kind, 'draft'::public.element_lifecycle, 'knowledge'::public.architecture_domain,
      'concept', 'emerging'::public.maturity_state, 'client'::public.client_visibility)::text,
  'creates a draft object with its subtype row; the domain comes from the type'
);
select matches(
  (select reference_code from public.architecture_elements where id = (select id from created where label = 'object')),
  '^KNW-\d{3}$',
  'the object gets a permanent knowledge reference code'
);

insert into created
select 'risk', public.create_architecture_element(
  'e0000000-0000-4000-8000-000000000001', 'risk',
  '{"title": "Anchor withdraws", "provenance": "architect_judgment"}',
  '{"probability": 2, "impact": 5, "category": "partner", "risk_status": "open", "severity": 99}',
  array['capability', 'strategic_model', 'capability']::public.architecture_domain[]
);

select is(
  (select array_agg(domain order by domain)::text from public.intelligence_record_domains
    where element_id = (select id from created where label = 'risk')),
  '{capability,strategic_model}',
  'a record gets each distinct domain it spans'
);
select is(
  (select severity from public.risks where element_id = (select id from created where label = 'risk')),
  10::smallint,
  'severity is calculated, never taken from input'
);
select matches(
  (select reference_code from public.architecture_elements where id = (select id from created where label = 'risk')),
  '^RSK-\d{3}$',
  'the record gets a risk reference code'
);

insert into created
select 'decision', public.create_architecture_element(
  'e0000000-0000-4000-8000-000000000001', 'decision',
  '{"title": "Phase one site", "engagement_wide": true}',
  '{"context": "Choose the first site.", "needed_by": "2026-12-01"}'
);
select is(
  (select row(d.decision_status, d.needed_by, e.engagement_wide)::text from public.decisions d
     join public.architecture_elements e on e.id = d.element_id
    where d.element_id = (select id from created where label = 'decision')),
  row('open'::public.decision_status, '2026-12-01'::date, true)::text,
  'a decision starts open; engagement-wide scope is kept'
);

select throws_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'object',
       '{"title": "Scoped object"}', '{"object_type": "concept"}', array['capability']::public.architecture_domain[]) $$,
  '23514', null,
  'a core object cannot be given record domains'
);
select throws_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'object',
       '{"title": "Unknown"}', '{"object_type": "initiative_plan"}') $$,
  '23503', null,
  'an unknown object type is refused'
);
select throws_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'dependency',
       '{"title": "Cross-tenant"}',
       '{"from_element_id": "b3000000-0000-4000-8000-000000000401", "to_element_id": "b3000000-0000-4000-8000-000000000a01"}') $$,
  '23503', null,
  'a dependency cannot reach another engagement''s element'
);
select throws_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'recommendation',
       '{"title": "Typed decision", "provenance": "client_decision"}', '{}') $$,
  '42501', null,
  'client_decision provenance cannot be typed in'
);
select pg_temp.reset_actor();

-- Researcher: may draft internal content, not choose client visibility.
select pg_temp.act_as('researcher@tplco.test');
select lives_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'assumption',
       '{"title": "Spinouts stay local"}', '{"confidence": "low"}', array['knowledge']::public.architecture_domain[]) $$,
  'a researcher drafts an internal record'
);
select throws_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'object',
       '{"title": "Visible", "client_visibility": "client"}', '{"object_type": "concept"}') $$,
  '42501', null,
  'a researcher cannot make content client-visible'
);
-- Unassigned on Harbor (e...03): reads nothing there, drafts nothing.
select throws_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000003', 'object',
       '{"title": "Elsewhere"}', '{"object_type": "concept"}') $$,
  '42501', null,
  'nobody drafts on an engagement they are not assigned to'
);
select pg_temp.reset_actor();

-- System Administrator: reads, but holds no drafting authority by default.
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'object',
       '{"title": "Admin draft"}', '{"object_type": "concept"}') $$,
  '42501', null,
  'a System Administrator cannot draft architecture by default'
);
select pg_temp.reset_actor();

-- Finance Administrator assigned to Meridian: reads, cannot draft.
select pg_temp.act_as('finance@tplco.test');
select throws_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'risk',
       '{"title": "Finance risk"}', '{}') $$,
  '42501', null,
  'finance never drafts architecture'
);
select pg_temp.reset_actor();

-- Client: never drafts.
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok(
  $$ select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'object',
       '{"title": "Client draft"}', '{"object_type": "concept"}') $$,
  '42501', null,
  'a client cannot draft architecture'
);
select pg_temp.reset_actor();

select * from finish();
rollback;
