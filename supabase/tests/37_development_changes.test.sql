-- =============================================================================
-- Phase 7A: the curated development-change read model (pgTAP). Proposal §13.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(14);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select pg_temp.act_as('principal@tplco.test');
create temporary table ch as select * from public.development_changes('e0000000-0000-4000-8000-000000000003', null, null, null, 1000);

select ok(exists (select 1 from ch where change_type = 'substantive_revision' and reference_code = 'APP-001' and version_no = 2),
  'a substantive revision is a development change');
select ok(exists (select 1 from ch where change_type = 'status_publication' and reference_code = 'IMP-001'),
  'a status publication is listed as such');
select ok(exists (select 1 from ch where change_type = 'first_publication' and reference_code = 'KNW-001'),
  'a first publication');
select ok(exists (select 1 from ch where change_type = 'decision_decided' and reference_code = 'DEC-001'), 'a decision decided');
select ok(exists (select 1 from ch where change_type = 'review_scheduled' and reference_code = 'REV-002'), 'a Review scheduled');
select ok((select occurred_at from ch where change_type = 'review_held' and reference_code = 'REV-001')
          > (select held_at from public.reviews r join public.architecture_elements e on e.id = r.element_id
             where e.reference_code = 'REV-001' and e.engagement_id = 'e0000000-0000-4000-8000-000000000003'),
  'a hold is dated in system time, never the backdated held_at');
select ok(exists (select 1 from ch where change_type = 'criterion_agreed' and reference_code = 'ACR-001'), 'a criterion agreed');
select ok(exists (select 1 from ch where change_type = 'application_closed' and reference_code = 'MUS-001'),
  'a Method Application closed');
select is((select count(*)::int from ch where change_type = 'record_status_changed'), 0,
  'record creation and non-status fields are not status changes');
select is((select count(*)::int from ch where change_type not in (
  'first_publication', 'substantive_revision', 'status_publication', 'element_retired', 'element_superseded',
  'relationship_added', 'relationship_retired', 'evidence_linked', 'approval_requested', 'approval_recorded',
  'baseline_frozen', 'record_status_changed', 'decision_deferred', 'decision_decided', 'escalation_opened',
  'escalation_resolved', 'client_action_answered', 'contribution_received', 'review_scheduled', 'review_held',
  'review_cancelled', 'validation_recorded', 'implementation_status_changed', 'checkpoint_achieved',
  'criterion_proposed', 'criterion_agreed', 'criterion_superseded', 'criterion_withdrawn', 'application_started',
  'application_closed', 'application_addendum')), 0, 'nothing commercial and nothing outside the curated set');
select is((select count(*)::int from information_schema.routines r
           join information_schema.parameters p on p.specific_name = r.specific_name
           where r.routine_name = 'development_changes' and p.parameter_name like '%metadata%'),
  0, 'no activity log metadata is returned');
select is((select count(*)::int from public.development_changes('e0000000-0000-4000-8000-000000000003', now() + interval '1 day')),
  0, 'the window is honored');
select cmp_ok((select count(*)::int from public.development_changes('e0000000-0000-4000-8000-000000000003', null, null,
                 'b3000000-0000-4000-8000-000000000a01', 1000)), '<', (select count(*)::int from ch),
  'and can be filtered to one element');

select pg_temp.act_as('lead@harbor.test');
select is((select count(*)::int from public.development_changes('e0000000-0000-4000-8000-000000000003')), 0,
  'a client reads no development changes');

select * from finish();
rollback;
