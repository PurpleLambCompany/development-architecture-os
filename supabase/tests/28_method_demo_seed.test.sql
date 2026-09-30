-- =============================================================================
-- Phase 6 demo seed (pgTAP). Run with: pnpm db:test
--
-- supabase/seed.sql builds the §32 demo through the app's operations. This
-- suite checks it is what the demo claims to be, and that it respects the
-- client boundary: clients see only the release line and agreed,
-- client-visible acceptance criteria.
-- =============================================================================
begin;

select plan(18);

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

create function pg_temp.asset(asset_key text) returns uuid language sql as $$
  select id from public.method_assets where key = asset_key;
$$;

-- The library ---------------------------------------------------------------
select is((select string_agg(key || ':' || coalesce(form::text, 'legacy') || ':' || status, ', ' order by key)
           from public.method_assets),
  'anchor-led-cluster-development-model:model:active, capability-map-template:template:active, '
  || 'capability-readiness-diagnostic:method:active, capability-readiness-scale:standard:active, '
  || 'leadership-capability-interview-guide:instrument:active, strategic-model-library-index:legacy:legacy',
  'one asset of each form, the adopted Diagnostic, and the Index left legacy (D28)');
select is((select string_agg(coalesce(version_label, 'draft') || ':' || lifecycle || ':' || legacy, ', ' order by version_no)
           from public.method_asset_versions where asset_id = pg_temp.asset('capability-readiness-diagnostic')),
  'DAM 1.0:superseded:true, 1.0:superseded:false, 1.1:published:false, draft:draft:false',
  'the Diagnostic keeps its legacy version, publishes 1.0 and 1.1, and has a 1.2 draft');
select is((select identity_disclosure::text || ':' || disclosable_name from public.method_asset_versions
           where asset_id = pg_temp.asset('capability-readiness-diagnostic') and version_label = '1.1'),
  'may_be_named:Capability Readiness Diagnostic™', 'the Diagnostic may be named, with its approved name');
select is((select count(*)::int from public.method_version_stages s join public.method_asset_versions v on v.id = s.version_id
           where v.asset_id = pg_temp.asset('capability-readiness-diagnostic') and v.version_label = '1.1'), 4,
  'the Diagnostic has four stages');
select is((select count(*)::int from public.standard_version_criteria c join public.method_asset_versions v on v.id = c.version_id
           where v.asset_id = pg_temp.asset('capability-readiness-scale')), 5, 'the Standard has five criteria');
select is((select count(*)::int from public.method_version_learning_sources), 1,
  'the Diagnostic draft cites the Harbor application it learned from');

-- Releases and contexts -----------------------------------------------------------
select is((select string_agg(version_label || ':' || status, ', ' order by version_label) from public.dam_releases),
  '1.0:superseded, 1.1:published, 1.2:draft', 'DAM 1.0 superseded by 1.1, with 1.2 in draft');
select is((select count(*)::int from public.dam_release_members m join public.dam_releases r on r.id = m.release_id
           where r.version_label = '1.1'), 5, 'DAM 1.1 has the five current assets');
select is((select string_agg(e.slug || ':' || r.version_label, ', ' order by e.slug)
           from public.engagements e join public.dam_releases r on r.id = e.dam_release_id
           where e.slug in ('harbor-community-expansion', 'meridian-innovation-district')),
  'harbor-community-expansion:1.1, meridian-innovation-district:1.0', 'Harbor moved to 1.1; Meridian stays on 1.0');
select is((select count(*)::int from public.development_contexts), 4, 'four Development Contexts');

-- Applications and criteria -----------------------------------------------------
select is((select string_agg(e.slug || ':' || a.reference_code || ':' || a.state || ':' || a.version_in_release, ', ' order by e.slug)
           from public.method_applications a join public.engagements e on e.id = a.engagement_id),
  'harbor-community-expansion:MUS-001:completed:true, meridian-innovation-district:MUS-001:in_progress:false',
  'a completed Harbor application in its release and a Meridian one in progress outside it');
select is((select string_agg(n.treatment::text, ',' order by s.ordinal)
           from public.method_application_stage_notes n join public.method_version_stages s on s.id = n.stage_id),
  'followed,adapted,followed,followed', 'the Harbor application adapted one stage');
select is((select string_agg(reference_code || ':' || state || ':' || (informing_standard_version_id is not null), ', ' order by reference_code)
           from public.acceptance_criteria),
  'ACR-001:agreed:true, ACR-002:agreed:false', 'two agreed criteria on a Harbor initiative, one informed by the Standard');

-- The client boundary -------------------------------------------------------------
select pg_temp.act_as('sponsor@harbor.test');
select is((select count(*)::int from public.method_assets) + (select count(*)::int from public.method_applications)
          + (select count(*)::int from public.development_contexts) + (select count(*)::int from public.dam_releases), 0,
  'a Harbor client reads no library, application, context or release row');
select is((select release_label || ' · ' || release_title
           from public.client_engagement_methodology('e0000000-0000-4000-8000-000000000003')),
  '1.1 · Development Architecture Method™ 1.1', 'and sees only the release line');
select is((select string_agg(reference_code, ',' order by reference_code)
           from public.client_acceptance_criteria('e0000000-0000-4000-8000-000000000003')),
  'ACR-001,ACR-002', 'and the agreed criteria on client-visible architecture');
select is((select count(*)::int from public.client_acceptance_criteria('e0000000-0000-4000-8000-000000000001')), 0,
  'but nothing from another engagement');
select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.client_acceptance_criteria('e0000000-0000-4000-8000-000000000003')), 0,
  'and a Meridian client reads no Harbor criteria');

select * from finish();
rollback;
