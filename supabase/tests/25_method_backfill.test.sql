-- =============================================================================
-- Phase 6 legacy backfill and adoption (pgTAP). Run with: pnpm db:test
--
-- Pre-Phase 6 assets become legacy assets with no inferred form, keep their
-- names and meaning, and carry their old content on one frozen legacy
-- version (D28, §34). Seed data is written through the same conversion the
-- migration runs, so these results are the migration's results.
-- =============================================================================
begin;

select plan(27);

create function pg_temp.act_as(user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  execute 'reset role';
  select id into uid from auth.users where email = user_email;
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

create function pg_temp.asset(target_title text) returns uuid language sql security definer as $$
  select id from public.method_assets where title = target_title
$$;

-- -----------------------------------------------------------------------------
-- Seed results
-- -----------------------------------------------------------------------------
select is((select string_agg(key || ':' || status || ':' || coalesce(form::text, '-') || ':' || category_key, ', ' order by key)
  from public.method_assets where status = 'legacy'),
  'capability-readiness-diagnostic:legacy:-:diagnostic_frameworks, strategic-model-library-index:legacy:-:strategic_models',
  'both pre-Phase 6 assets are legacy, with no inferred form and governed categories');
select is((select title from public.method_assets where key = 'strategic-model-library-index'),
  'Strategic Model Library Index', 'the Strategic Model Library Index keeps its name');
select is((select string_agg(v.version_label || ':' || v.lifecycle || ':' || v.legacy, ', ')
  from public.method_asset_versions v join public.method_assets a on a.id = v.asset_id
  where a.key = 'strategic-model-library-index'),
  'DAM 1.0:published:true', 'and has one frozen legacy version labelled with its original version text');
select is((select v.summary from public.method_asset_versions v where v.asset_id = pg_temp.asset('Strategic Model Library Index')),
  'Index of strategic models with applicability conditions and known failure modes.',
  'which carries its original description');
select is((select array_agg(d.domain::text) from public.method_version_domains d
  join public.method_asset_versions v on v.id = d.version_id where v.asset_id = pg_temp.asset('Capability Readiness Diagnostic')),
  array['capability'], 'and its original domain');
select ok((select bool_and(a.current_version_id = v.id) from public.method_assets a
  join public.method_asset_versions v on v.asset_id = a.id), 'each legacy version is its asset''s current version');
select is((select count(*)::int from public.method_asset_versions v where v.legacy and (
  exists (select 1 from public.method_version_stages where version_id = v.id)
  or exists (select 1 from public.method_version_outputs where version_id = v.id))), 0,
  'no form-specific structure is invented');
select is((select count(*)::int from information_schema.columns where table_schema = 'public'
  and table_name = 'method_assets' and column_name in ('category', 'version', 'methodology_domain', 'description', 'owner_user_id')),
  0, 'the pre-Phase 6 content columns are gone');
select is((select count(*)::int from public.element_method_lineage where lineage_role = 'legacy_derived_from'), 2,
  'element lineage is carried over as legacy lineage');

-- Edge cases of the same conversion.
select private.insert_legacy_method_asset('Old Protocol', 'Research Protocol', null, 'v0.9 (beta)', 'retired',
  'Superseded long ago', null);
select is((select a.status || ':' || v.lifecycle || ':' || v.version_label || ':' || a.category_key
  from public.method_assets a join public.method_asset_versions v on v.asset_id = a.id where a.title = 'Old Protocol'),
  'retired:retired:v0.9 beta:research_protocols', 'a retired asset stays retired; its label is kept, made safe');
select is((select current_version_id from public.method_assets where title = 'Old Protocol'), null,
  'a retired asset has no current version');
select private.insert_legacy_method_asset('Old Protocol', 'Unheard-of category', null, '', 'active', '', null);
select is((select string_agg(key || ':' || category_key, ', ' order by key) from public.method_assets where title = 'Old Protocol'),
  'old-protocol:research_protocols, old-protocol-2:other', 'keys stay unique and unknown categories become other');
select is((select version_label from public.method_asset_versions where asset_id = (
  select id from public.method_assets where key = 'old-protocol-2')), '1.0', 'a missing version label becomes 1.0');

-- -----------------------------------------------------------------------------
-- A legacy version is never used
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.create_method_asset_version(pg_temp.asset('Strategic Model Library Index')) $$,
  '23514', null, 'a legacy asset takes no new version until adopted');
select throws_ok($$ select public.update_method_asset_version(
  (select id from public.method_asset_versions where asset_id = pg_temp.asset('Strategic Model Library Index')),
  '{"summary": "x"}') $$, '23514', null, 'a legacy version cannot be edited');
select public.create_method_asset('host-method', 'Host Method', 'method', 'other');
select throws_ok($$ select public.set_method_version_components(
  (select id from public.method_asset_versions where asset_id = pg_temp.asset('Host Method')),
  jsonb_build_array(jsonb_build_object('component_version_id',
    (select id from public.method_asset_versions where asset_id = pg_temp.asset('Strategic Model Library Index'))))) $$,
  '23514', 'A legacy version cannot be used, cited or instantiated; adopt the asset first',
  'a legacy version cannot be used as a component');

-- -----------------------------------------------------------------------------
-- Adoption
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.adopt_legacy_method_asset(pg_temp.asset('Capability Readiness Diagnostic'), 'method') $$,
  '42501', null, 'adoption needs publish_methodology');
select pg_temp.act_as('sysadmin@tplco.test');
select throws_ok($$ select public.adopt_legacy_method_asset(pg_temp.asset('Capability Readiness Diagnostic'), 'method') $$,
  '42501', null, 'a System Administrator cannot adopt');
select pg_temp.act_as('principal@tplco.test');
select throws_ok($$ select public.adopt_legacy_method_asset(pg_temp.asset('Host Method'), 'method') $$,
  '23514', null, 'only a legacy asset can be adopted');
select lives_ok($$ select public.adopt_legacy_method_asset(pg_temp.asset('Capability Readiness Diagnostic'), 'method') $$,
  'a methodology authority adopts the Diagnostic as a Method');
select is((select status || ':' || form from public.method_assets where id = pg_temp.asset('Capability Readiness Diagnostic')),
  'active:method', 'which now has its form');
select is((select string_agg(version_no || ':' || lifecycle || ':' || legacy, ', ' order by version_no)
  from public.method_asset_versions where asset_id = pg_temp.asset('Capability Readiness Diagnostic')),
  '1:published:true, 2:draft:false', 'and a first proper draft beside the still-published legacy version');
select is((select derived_from_version_id from public.method_asset_versions
  where asset_id = pg_temp.asset('Capability Readiness Diagnostic') and version_no = 2),
  (select id from public.method_asset_versions where asset_id = pg_temp.asset('Capability Readiness Diagnostic') and legacy),
  'derived from the legacy version');

-- Complete and publish: the proper version supersedes the legacy one.
select pg_temp.act_as('architect@tplco.test');
select public.update_method_asset_version(v.id, '{"architectural_question": "How ready is each capability?",
  "applicability": "Capabilities under development", "change_summary": "Adopted as a Method",
  "modes": ["assess"], "completion_criteria": "Every capability assessed"}')
from public.method_asset_versions v where v.asset_id = pg_temp.asset('Capability Readiness Diagnostic') and v.lifecycle = 'draft';
select public.set_method_version_stages(v.id, '[{"key": "assess", "title": "Assess"}]')
from public.method_asset_versions v where v.asset_id = pg_temp.asset('Capability Readiness Diagnostic') and v.lifecycle = 'draft';
select public.set_method_version_outputs(v.id, '[{"output_kind": "object", "object_type_key": "capability_gap"}]')
from public.method_asset_versions v where v.asset_id = pg_temp.asset('Capability Readiness Diagnostic') and v.lifecycle = 'draft';
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.publish_method_asset_version(v.id, '1.1')
  from public.method_asset_versions v where v.asset_id = pg_temp.asset('Capability Readiness Diagnostic') and v.lifecycle = 'draft' $$,
  'the adopted Method publishes');
select is((select string_agg(version_label || ':' || lifecycle, ', ' order by version_no)
  from public.method_asset_versions where asset_id = pg_temp.asset('Capability Readiness Diagnostic')),
  'DAM 1.0:superseded, 1.1:published', 'superseding the legacy version, which stays readable');
select throws_ok($$ select public.adopt_legacy_method_asset(pg_temp.asset('Capability Readiness Diagnostic'), 'model') $$,
  '23514', null, 'adoption happens once');

-- The Index stays exactly what it was.
select is((select status from public.method_assets where id = pg_temp.asset('Strategic Model Library Index')), 'legacy',
  'the Strategic Model Library Index remains a legacy asset');
select pg_temp.reset_actor();

select * from finish();
rollback;
