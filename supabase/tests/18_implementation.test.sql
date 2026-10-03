-- =============================================================================
-- Phase 5 implementation (pgTAP). Run with: pnpm db:test
--
-- create_implementation_initiative, update_implementation_status (the
-- non-terminal, directly-edited statuses), Implementation's own
-- stewardship/history/escalation/signal apparatus (D2, physically separate
-- from Phase 4's), checkpoints, and the implements/initiates relationship
-- types. Meridian, e...01.
-- =============================================================================
begin;

select plan(53);

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

create function pg_temp.member(user_email text, engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language sql
security definer
as $$
  select m.id from public.engagement_members m join auth.users u on u.id = m.user_id
  where m.engagement_id = engagement and u.email = user_email;
$$;

create table pg_temp.ids (key text primary key, id uuid);
grant all on pg_temp.ids to authenticated;

-- -----------------------------------------------------------------------------
-- create_implementation_initiative: capability and validation
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Acquisition rollout', array['b3000000-0000-4000-8000-000000000201'::uuid]) $$, '42501', null,
  'a Researcher holds no manage_implementation and cannot create an initiative');
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  '', array['b3000000-0000-4000-8000-000000000201'::uuid]) $$, '23514', null, 'an initiative needs a title');
select throws_ok($$ select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'No target', '{}'::uuid[]) $$, '23514', null, 'and at least one thing it implements');
select throws_ok($$ select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Not a core object', array['b3000000-0000-4000-8000-000000000501'::uuid]) $$, '23514', null,
  'it implements only core architecture objects, not Project Intelligence records');
insert into pg_temp.ids (key, id)
select 'init', public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Acquisition rollout', array['b3000000-0000-4000-8000-000000000201'::uuid], 'process',
  current_date + 60, pg_temp.member('architect@tplco.test'), 'Standing up the acquisition process.');
select is((select reference_code from public.architecture_elements where id = (select id from pg_temp.ids where key = 'init')),
  'IMP-002', 'it gets the IMP prefix');
select is((select implementation_status::text from public.implementation_initiatives
           where element_id = (select id from pg_temp.ids where key = 'init')), 'not_started',
  'a new initiative starts not_started');
select is((select count(*)::int from public.architecture_relationships
           where source_element_id = (select id from pg_temp.ids where key = 'init')
             and relationship_type = 'implements' and retired_at is null), 1,
  'an implements relationship is recorded to the target object');

-- initiates: a decision or recommendation may initiate an initiative
select lives_ok($$ insert into public.architecture_relationships
  (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000506',
    (select id from pg_temp.ids where key = 'init'), 'initiates', 'architect_judgment') $$,
  'a decision initiates the initiative');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- update_implementation_status: direct edits, non-terminal only
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.update_implementation_status(
  (select id from pg_temp.ids where key = 'init'), 'in_progress') $$, '42501', null,
  'a Researcher holds no manage_implementation and cannot change status');
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ select public.update_implementation_status(
  (select id from pg_temp.ids where key = 'init'), 'in_progress') $$,
  'an Architect moves the initiative to in_progress');
select throws_ok($$ select public.update_implementation_status(
  (select id from pg_temp.ids where key = 'init'), 'stalled') $$, '23514', null,
  'stalling requires a rationale');
select lives_ok($$ select public.update_implementation_status(
  (select id from pg_temp.ids where key = 'init'), 'stalled', 'Vendor negotiations paused.') $$,
  'stalling with a rationale succeeds');
select lives_ok($$ select public.update_implementation_status(
  (select id from pg_temp.ids where key = 'init'), 'in_progress') $$, 'and it resumes');
select throws_ok($$ select public.update_implementation_status(
  (select id from pg_temp.ids where key = 'init'), 'validated') $$, '23514', null,
  'validated is reached only through resolve_implementation_initiative, never a direct edit');
select is((select count(*)::int from public.implementation_status_changes
           where element_id = (select id from pg_temp.ids where key = 'init')), 9,
  'each tracked field change (creation''s 4 initiative fields, the 2 stewardship '
  || 'fields it is created with, then the 3 status changes) is written to implementation''s own '
  || 'append-only history');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Stewardship, escalation and signals (Implementation's own tables, D2)
-- -----------------------------------------------------------------------------
select pg_temp.act_as('finance@tplco.test');
select throws_ok($$ select public.triage_implementation(
  (select id from pg_temp.ids where key = 'init'), 'high') $$, '42501', null,
  'TPLCo Finance cannot triage an initiative');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.triage_implementation(
  (select id from pg_temp.ids where key = 'init'), 'critical', null, '') $$, '23514', null,
  'critical attention needs a note');
select lives_ok($$ select public.triage_implementation(
  (select id from pg_temp.ids where key = 'init'), 'high', current_date + 14, 'Watch vendor capacity.') $$,
  'a Researcher (edit_architecture) triages the initiative');
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ select public.escalate_implementation(
  (select id from pg_temp.ids where key = 'init'), 'principal_architect', 'Vendor risk needs sign-off.') $$,
  'an Architect escalates to the Principal Architect');
select throws_ok($$ select public.escalate_implementation(
  (select id from pg_temp.ids where key = 'init'), 'principal_architect', 'Again') $$, '23514', null,
  'an initiative is escalated once at each level');
select throws_ok($$ select public.escalate_implementation(
  (select id from pg_temp.ids where key = 'init'), 'client_executive', 'Needs sign-off',
  pg_temp.member('sponsor@meridian.test')) $$, '23514', null,
  'client escalation requires a published, client-visible initiative');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.acknowledge_implementation_escalation(
  (select id from public.implementation_escalations
   where element_id = (select id from pg_temp.ids where key = 'init') and level = 'principal_architect')) $$,
  '42501', null, 'only publish_architecture holders acknowledge');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.acknowledge_implementation_escalation(
  (select id from public.implementation_escalations
   where element_id = (select id from pg_temp.ids where key = 'init') and level = 'principal_architect')) $$,
  'the Principal Architect acknowledges the escalation');
select throws_ok($$ select public.resolve_implementation_escalation(
  (select id from public.implementation_escalations
   where element_id = (select id from pg_temp.ids where key = 'init') and level = 'principal_architect'), '') $$,
  '23514', null, 'resolving says how');
select lives_ok($$ select public.resolve_implementation_escalation(
  (select id from public.implementation_escalations
   where element_id = (select id from pg_temp.ids where key = 'init') and level = 'principal_architect'),
  'A second vendor was qualified.') $$, 'and the Principal Architect resolves it');
select is((select count(*)::int from public.implementation_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-002' and cardinality(open_escalations) = 0), 1,
  'the register no longer shows the initiative as escalated');
select pg_temp.reset_actor();

-- Signals: implementation_past_target
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids (key, id)
select 'overdue', public.create_implementation_initiative('e0000000-0000-4000-8000-000000000001',
  'Past-target initiative', array['b3000000-0000-4000-8000-000000000202'::uuid], 'other', current_date - 5);
select ok((select rule_key from public.implementation_signals('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-003') = 'implementation_past_target',
  'an initiative past its target operational date is signalled');
select throws_ok($$ select public.dismiss_implementation_signal('e0000000-0000-4000-8000-000000000001',
  (select id from pg_temp.ids where key = 'overdue'), '', 'Reason') $$, '23514', null,
  'dismissal needs a fingerprint');
select lives_ok($$ select public.dismiss_implementation_signal('e0000000-0000-4000-8000-000000000001',
  (select id from pg_temp.ids where key = 'overdue'), f.fingerprint, 'Vendor delay accepted by the sponsor.')
  from public.implementation_signals('e0000000-0000-4000-8000-000000000001') f where f.reference_code = 'IMP-003' $$,
  'an Architect dismisses the signal');
select is((select count(*)::int from public.implementation_signals('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-003'), 0, 'which is then hidden');
select is((select count(*)::int from public.implementation_signals('e0000000-0000-4000-8000-000000000001',
           null, true) where reference_code = 'IMP-003'), 1, 'but shown with dismissed ones included');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Checkpoints (§7.6): direct edits, achieving one goes through an operation
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.add_implementation_checkpoint(
  (select id from pg_temp.ids where key = 'init'), 'design_approved', 'Design approved') $$, '42501', null,
  'a Researcher holds no manage_implementation and cannot add a checkpoint');
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.add_implementation_checkpoint(
  (select id from pg_temp.ids where key = 'init'), 'design_approved', '') $$, '23514', null,
  'a checkpoint needs a title');
insert into pg_temp.ids (key, id)
select 'cp', public.add_implementation_checkpoint((select id from pg_temp.ids where key = 'init'),
  'design_approved', 'Acquisition process design approved', current_date - 3, null, null, true);
select is((select achieved_on from public.implementation_checkpoints
           where id = (select id from pg_temp.ids where key = 'cp')), null, 'a new checkpoint is not yet achieved');
select lives_ok($$ select public.record_checkpoint_achieved(
  (select id from pg_temp.ids where key = 'cp'), current_date - 2) $$, 'the Architect records it achieved');
select is((select achieved_on from public.implementation_checkpoints
           where id = (select id from pg_temp.ids where key = 'cp')), current_date - 2,
  'its achieved date is recorded');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- implementation_register and client_implementation
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is((select checkpoint_count from public.implementation_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-002'), 1, 'IMP-002 shows its one checkpoint');
select is((select achieved_checkpoint_count from public.implementation_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-002'), 1, 'which is achieved');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.client_implementation('e0000000-0000-4000-8000-000000000001')), 1,
  'a client sees no initiative before it is published');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.architecture_elements set client_visibility = 'client'
  where id = (select id from pg_temp.ids where key = 'init') $$,
  'the Principal Architect makes the initiative client-visible');
select lives_ok($$ select public.publish_element_version(
  (select id from pg_temp.ids where key = 'init'), 'First publication.') $$,
  'and publishes it');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.client_implementation('e0000000-0000-4000-8000-000000000001')), 2,
  'the client now sees the published initiative');
select is((select jsonb_array_length(checkpoints) from public.client_implementation('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-002'), 1, 'with its one client-visible checkpoint');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Defect 2 fix: update_implementation_status's optional p_publish. A status
-- change with p_publish = false must not touch what a client sees (still
-- the old snapshot); p_publish = true must publish a new version and update
-- it; and an already-published version row is never mutated in place --
-- only a new one is ever created.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
insert into pg_temp.ids (key, id)
select 'v_before', version_id from public.client_implementation('e0000000-0000-4000-8000-000000000001')
where reference_code = 'IMP-002';
select is((select implementation_status::text from public.client_implementation('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-002'), 'in_progress', 'the client currently sees in_progress');

select lives_ok($$ select public.update_implementation_status(
  (select id from pg_temp.ids where key = 'init'), 'stalled', 'Publish=false check.', false) $$,
  'the status is changed to stalled with p_publish = false');
select is((select implementation_status::text from public.implementation_initiatives
           where element_id = (select id from pg_temp.ids where key = 'init')), 'stalled',
  'the live working row is stalled');
select is((select implementation_status::text from public.client_implementation('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-002'), 'in_progress',
  'but the client-facing snapshot is unchanged: p_publish = false never touches it');
select is((select version_id from public.client_implementation('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-002'), (select id from pg_temp.ids where key = 'v_before'),
  'the client still reads the very same published version');

select lives_ok($$ select public.update_implementation_status(
  (select id from pg_temp.ids where key = 'init'), 'stalled', 'Publish=true check.', true,
  'Stalled, published for visibility.') $$,
  'the same status is re-saved with p_publish = true');
select is((select implementation_status::text from public.client_implementation('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'IMP-002'), 'stalled',
  'the client-facing snapshot now reflects stalled: an explicit, opt-in publish updates it');
select isnt((select version_id from public.client_implementation('e0000000-0000-4000-8000-000000000001')
             where reference_code = 'IMP-002'), (select id from pg_temp.ids where key = 'v_before'),
  'a new version was published rather than the old one being reused');
select is((select v.client_snapshot -> 'details' ->> 'implementation_status' from public.element_versions v
           where v.id = (select id from pg_temp.ids where key = 'v_before')), 'in_progress',
  'and the earlier, already-published version row is untouched -- immutability holds, nothing was mutated in place');
select lives_ok($$ select public.update_implementation_status(
  (select id from pg_temp.ids where key = 'init'), 'in_progress', null, false) $$,
  'the initiative is returned to in_progress (working copy only) for cleanliness');
select pg_temp.reset_actor();

select * from finish();
rollback;
