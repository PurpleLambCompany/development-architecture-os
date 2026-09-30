-- =============================================================================
-- Phase 7A: criterion agreement time (pgTAP). Proposal §5.2 rule 16, OD-2,
-- S16. agreed_recorded_at is system time set by the agree operation;
-- agreed_on stays the business date the user entered. Run with: pnpm db:test
-- =============================================================================
begin;

select plan(9);

create function pg_temp.as_user(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.h(p_code text) returns uuid language sql as $$
  select id from public.architecture_elements
  where engagement_id = 'e0000000-0000-4000-8000-000000000003' and reference_code = p_code;
$$;

select is((select count(*)::int from public.acceptance_criteria where state = 'agreed' and agreed_recorded_at is null),
  0, 'every seeded agreed criterion has an agreement time');

-- The backfill for criteria agreed before 7A reads the logged agreement.
set local session_replication_role = replica;
update public.acceptance_criteria set agreed_recorded_at = null where state = 'agreed';
set local session_replication_role = origin;
alter table public.acceptance_criteria disable trigger acceptance_criteria_guard;
select private.backfill_criterion_agreement_times();
alter table public.acceptance_criteria enable trigger acceptance_criteria_guard;
select ok((select bool_and(agreed_on is not null and agreed_recorded_at = (
             select min(l.created_at) from public.activity_log l
             where l.entity_type = 'acceptance_criteria' and l.entity_id = c.id and l.action_type = 'update'
               and l.metadata_json -> 'after' ->> 'state' = 'agreed'))
           from public.acceptance_criteria c where state = 'agreed'),
  'S16: the backfill sets the logged agreement time and leaves agreed_on alone');

select pg_temp.as_user('architect@tplco.test');
select public.propose_acceptance_criterion(pg_temp.h('IMP-003'), 'Partners hold both seats by the first meeting.');
select is((select agreed_recorded_at from public.acceptance_criteria where body = 'Partners hold both seats by the first meeting.'),
  null, 'a proposed criterion has no agreement time');
create temporary table t0 as select clock_timestamp() as at;
select public.agree_acceptance_criterion(
  (select id from public.acceptance_criteria where body = 'Partners hold both seats by the first meeting.'),
  'Harbor Foundation', current_date - 20);
select ok((select agreed_recorded_at >= (select at from t0) from public.acceptance_criteria
           where body = 'Partners hold both seats by the first meeting.'),
  'S16: agreeing records the operation''s system time');
select is((select agreed_on from public.acceptance_criteria where body = 'Partners hold both seats by the first meeting.'),
  current_date - 20, 'S16: agreed_on is what the user entered');

select private.begin_methodology_operation();
select throws_ok($$ update public.acceptance_criteria set agreed_recorded_at = now() - interval '1 year'
                    where body = 'Partners hold both seats by the first meeting.' $$,
  '23514', null, 'the agreement time is frozen after agreement');
select private.end_methodology_operation();
select throws_ok($$ insert into public.acceptance_criteria (engagement_id, governed_element_id, body, agreed_recorded_at)
                    values ('e0000000-0000-4000-8000-000000000003', pg_temp.h('IMP-003'), 'Forged', now()) $$,
  null, 'an agreement time is never inserted');

-- A criterion whose agreement time was never recorded produces no
-- criteria_predate_revision item.
set local session_replication_role = replica;
update public.acceptance_criteria set agreed_recorded_at = null where reference_code = 'ACR-001'
  and engagement_id = 'e0000000-0000-4000-8000-000000000003';
set local session_replication_role = origin;
update public.architecture_elements set summary = 'Stands up the council with partner seats.' where id = pg_temp.h('IMP-001');
select public.publish_element_version(pg_temp.h('IMP-001'), 'Revised.');
select pg_temp.as_user('principal@tplco.test');
select ok(not exists (select 1 from public.edge_items('e0000000-0000-4000-8000-000000000003', null, null, null, true) i
                      join public.acceptance_criteria c on c.id = i.subject_id
                      where i.rule_key = 'criteria_predate_revision' and c.reference_code = 'ACR-001'),
  'no agreement time, no item (never agreed_on)');
select ok(exists (select 1 from public.edge_items('e0000000-0000-4000-8000-000000000003', null, null, null, true) i
                  join public.acceptance_criteria c on c.id = i.subject_id
                  where i.rule_key = 'criteria_predate_revision' and c.reference_code = 'ACR-002'),
  'while ACR-002, with its time, has one');

select * from finish();
rollback;
