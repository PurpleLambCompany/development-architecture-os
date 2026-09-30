-- =============================================================================
-- Phase 4 escalations and signals (pgTAP). Run with: pnpm db:test
--
-- Escalation to the Principal Architect and to the client executive (which
-- sends an executive-attention request), acknowledgement and resolution; the
-- ten signal rules, evaluated as of a date; and dismissals that match on
-- the rule, the subject and its fingerprint, and expire.
--
-- Seed (supabase/seed.sql, "Phase 4"), Meridian e...01: RSK-001 b3...501
-- escalated to the Principal Architect; RSK-002 b3...502 escalated to the
-- client executive (ACT-001 to the Executive Sponsor); DEP-001 b3...505's
-- blocking signal dismissed for 30 days; OPP-001 b6...001 window closes in
-- 21 days; OPP-002 b6...002 window closed; ACT-003 overdue.
-- =============================================================================
begin;

select plan(38);

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

-- The engagement membership of a seeded user (Meridian unless named).
create function pg_temp.member(user_email text, engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language sql
security definer
as $$
  select m.id from public.engagement_members m join auth.users u on u.id = m.user_id
  where m.engagement_id = engagement and u.email = user_email;
$$;

-- Reads a value as the database owner, whatever the current actor.
create function pg_temp.status_of(p_element uuid)
returns text
language sql
security definer
as $$
  select private.intelligence_record_status(p_element);
$$;

create function pg_temp.signals(as_of date default current_date, include_dismissed boolean default false)
returns text
language sql
as $$
  select coalesce(string_agg(rule_key || ':' || reference_code || case when dismissed then '*' else '' end, ','
                             order by rule_key, reference_code), '')
  from public.intelligence_signals('e0000000-0000-4000-8000-000000000001', as_of, include_dismissed);
$$;

create function pg_temp.escalation(p_element uuid, p_level public.escalation_level)
returns uuid
language sql
security definer
as $$
  select id from public.intelligence_escalations where element_id = p_element and level = p_level and resolved_at is null;
$$;

-- -----------------------------------------------------------------------------
-- Escalations
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.intelligence_escalations), 2, 'an Architect sees the open escalations');
select throws_ok($$ select public.escalate_intelligence_record('b3000000-0000-4000-8000-000000000501',
  'principal_architect', 'Again') $$, '23514', null, 'a record is escalated once at each level');
select throws_ok($$ select public.escalate_intelligence_record('b3000000-0000-4000-8000-000000000503',
  'principal_architect', ' ') $$, '23514', null, 'an escalation gives its reason');
select throws_ok($$ select public.escalate_intelligence_record('b6000000-0000-4000-8000-000000000002',
  'client_executive', 'Internal', pg_temp.member('sponsor@meridian.test')) $$,
  '23514', null, 'only a published, client-visible record is escalated to the client');
select throws_ok($$ select public.escalate_intelligence_record('b3000000-0000-4000-8000-000000000503',
  'client_executive', 'No one') $$, '23514', null, 'a client escalation names the executive');
select throws_ok($$ select public.escalate_intelligence_record('b3000000-0000-4000-8000-000000000503',
  'client_executive', 'Contributor', pg_temp.member('contributor@meridian.test')) $$,
  '23514', null, 'who must be able to approve architecture');
select lives_ok($$ select public.escalate_intelligence_record('b3000000-0000-4000-8000-000000000503',
  'client_executive', 'We need the board chair''s support confirmed.', pg_temp.member('lead@meridian.test'),
  current_date + 7) $$, 'an Architect escalates an assumption to the Client Project Lead');
select is((select kind::text from public.client_actions a
           join public.intelligence_escalations x on x.client_action_id = a.id
           where x.element_id = 'b3000000-0000-4000-8000-000000000503'), 'executive_attention',
  'which sends an executive-attention request');
select throws_ok($$ select public.acknowledge_escalation(
  pg_temp.escalation('b3000000-0000-4000-8000-000000000503', 'client_executive')) $$,
  '23514', null, 'the client acknowledges by responding, not TPLCo');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select lives_ok($$ select public.escalate_intelligence_record('b3000000-0000-4000-8000-000000000503',
  'principal_architect', 'The chair may not stay.') $$, 'a Researcher escalates to the Principal Architect');
select throws_ok($$ select public.escalate_intelligence_record('b3000000-0000-4000-8000-000000000504',
  'client_executive', 'Constraint', pg_temp.member('sponsor@meridian.test')) $$,
  '42501', null, 'but not to the client');
select throws_ok($$ select public.acknowledge_escalation(
  pg_temp.escalation('b3000000-0000-4000-8000-000000000501', 'principal_architect')) $$,
  '42501', null, 'nor acknowledge an escalation');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ select public.acknowledge_escalation(
  pg_temp.escalation('b3000000-0000-4000-8000-000000000501', 'principal_architect')) $$,
  'the Principal Architect acknowledges an escalation');
select throws_ok($$ select public.acknowledge_escalation(
  pg_temp.escalation('b3000000-0000-4000-8000-000000000501', 'principal_architect')) $$,
  '23514', null, 'once');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.intelligence_escalations), 0, 'clients never see escalations');
select lives_ok($$ select public.respond_to_client_action(
  (select a.id from public.client_actions a where a.kind = 'executive_attention' and a.status = 'open'
     and a.addressed_to_user_id = auth.uid()),
  'We will name deputies at the November board meeting.') $$, 'the Executive Sponsor responds to executive attention');
select pg_temp.reset_actor();
select ok((select acknowledged_at is not null from public.intelligence_escalations
           where element_id = 'b3000000-0000-4000-8000-000000000502'), 'which acknowledges the escalation');

select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.resolve_escalation(
  pg_temp.escalation('b3000000-0000-4000-8000-000000000502', 'client_executive'), '') $$,
  '23514', null, 'resolving an escalation says how');
select lives_ok($$ select public.resolve_escalation(
  pg_temp.escalation('b3000000-0000-4000-8000-000000000502', 'client_executive'), 'Deputies to be named in November.') $$,
  'an Architect resolves the escalation');
select is((select a.status::text from public.client_actions a join public.intelligence_escalations x on x.client_action_id = a.id
           where x.element_id = 'b3000000-0000-4000-8000-000000000502'), 'closed', 'which closes its request');
select is((select count(*)::int from public.intelligence_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'RSK-002' and cardinality(open_escalations) = 0), 1,
  'and the register no longer shows it as escalated');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Signals
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.signals(),
  'assumption_unvalidated_underpins_published:ASM-001,client_action_overdue:ACT-003,'
  || 'opportunity_window_closed:OPP-002,opportunity_window_closing:OPP-001,review_overdue:DEP-001',
  'today''s signals, dismissed ones hidden');
select is(pg_temp.signals(current_date, true),
  'assumption_unvalidated_underpins_published:ASM-001,client_action_overdue:ACT-003,'
  || 'dependency_blocking_unsatisfied:DEP-001*,opportunity_window_closed:OPP-002,'
  || 'opportunity_window_closing:OPP-001,review_overdue:DEP-001',
  'and with the dismissed one shown');
select ok(pg_temp.signals(current_date + 31) like '%dependency_blocking_unsatisfied:DEP-001%',
  'a dismissal expires');
select ok(pg_temp.signals(current_date + 22) like '%opportunity_window_closed:OPP-001%',
  'a closing window becomes a closed one');
select ok(pg_temp.signals(current_date + 31) like '%decision_past_needed_by:DEC-001%',
  'a decision past its needed-by date is signalled');
select ok(pg_temp.signals(current_date + 8) like '%record_untriaged:CNS-001%', 'as is a record left untriaged');

select public.create_architecture_element('e0000000-0000-4000-8000-000000000001', 'risk',
  '{"title": "Contractor capacity", "provenance": "architect_judgment"}',
  '{"category": "delivery", "probability": 4, "impact": 4}', '{application}');
select ok(pg_temp.signals() like '%risk_high_without_mitigation:RSK-004%', 'a high risk without mitigation is signalled');
select lives_ok($$ select public.resolve_intelligence_record('b3000000-0000-4000-8000-000000000503', 'invalidated',
  'The universities will sell, not lease.') $$, 'an Architect invalidates the assumption');
select ok(pg_temp.signals() like '%assumption_invalidated_still_underpins:ASM-001%',
  'which is signalled while it still underpins published architecture');

-- Dismissing
select throws_ok($$ select public.dismiss_intelligence_signal('e0000000-0000-4000-8000-000000000001', 'made_up',
  'b3000000-0000-4000-8000-000000000501', null, 'x', 'Reason') $$, '23514', null, 'only known signals are dismissed');
select throws_ok($$ select public.dismiss_intelligence_signal('e0000000-0000-4000-8000-000000000001', 'review_overdue',
  'b3000000-0000-4000-8000-000000000505', null, 'x', '') $$, '23514', null, 'with a reason');
select throws_ok($$ select public.dismiss_intelligence_signal('e0000000-0000-4000-8000-000000000001', 'review_overdue',
  'b3000000-0000-4000-8000-000000000505', null, 'x', 'Reason', current_date) $$,
  '23514', null, 'expiring in the future');
select lives_ok($$ select public.dismiss_intelligence_signal('e0000000-0000-4000-8000-000000000001', f.rule_key,
  f.element_id, f.client_action_id, f.fingerprint, 'Waiting on the November board meeting.')
  from public.intelligence_signals('e0000000-0000-4000-8000-000000000001') f where f.reference_code = 'ACT-003' $$,
  'an Architect dismisses the overdue request signal');
select ok(pg_temp.signals() not like '%ACT-003%', 'which is no longer shown');
select pg_temp.reset_actor();

select pg_temp.act_as('finance@tplco.test');
select throws_ok($$ select public.dismiss_intelligence_signal('e0000000-0000-4000-8000-000000000001', 'review_overdue',
  'b3000000-0000-4000-8000-000000000505', null, 'x', 'Reason') $$, '42501', null, 'TPLCo Finance cannot dismiss signals');
select pg_temp.reset_actor();
select pg_temp.act_as('sponsor@meridian.test');
select is(pg_temp.signals(), '', 'clients receive no signals');
select is((select count(*)::int from public.intelligence_signal_dismissals), 0, 'nor dismissals');
select pg_temp.reset_actor();

select * from finish();
rollback;
