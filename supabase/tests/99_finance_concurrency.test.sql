-- =============================================================================
-- Phase 2 concurrency (pgTAP). Run with: pnpm db:test. Runs last.
--
-- Two real database sessions (dblink) race for the same money. Every finance
-- operation locks its contract row first, so the second operation waits for
-- the first to commit and then re-checks the balances it depends on.
--
-- Unlike the other test files, the racing sessions COMMIT, so this file
-- removes what they wrote at the end (with triggers disabled for the cleanup
-- only). It uses the seeded Meridian contract, whose check 10442 has 4,000.00
-- of credit on account.
-- =============================================================================
begin;

create extension if not exists dblink with schema extensions;

select plan(12);

create function pg_temp.connect(name text, user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = user_email;
  -- dblink requires password authentication for non-superusers, so connect
  -- to the address this test session reached (a password-checked network
  -- address), not to the trusted loopback.
  perform extensions.dblink_connect(name, format(
    'dbname=%s host=%s port=%s user=postgres password=postgres',
    current_database(), host(inet_server_addr()), inet_server_port()));
  perform extensions.dblink_exec(name, format(
    'set request.jwt.claims to %L',
    json_build_object('sub', uid, 'role', 'authenticated')::text));
  perform extensions.dblink_exec(name, 'set role authenticated');
end;
$$;

-- Starts a statement without waiting; returns true while it is still running
-- (blocked) after a short pause.
create function pg_temp.start_and_check_blocked(name text, sql text)
returns boolean
language plpgsql
as $$
begin
  perform extensions.dblink_send_query(name, sql);
  perform pg_sleep(0.5);
  return extensions.dblink_is_busy(name) = 1;
end;
$$;

-- Waits for a sent statement; returns its error message, or null on success.
create function pg_temp.finish_query(name text)
returns text
language plpgsql
as $$
declare
  msg text;
begin
  begin
    perform * from extensions.dblink_get_result(name) as r(result text);
  exception when others then
    msg := sqlerrm;
  end;
  -- Drain the end-of-results marker.
  begin
    perform * from extensions.dblink_get_result(name, false) as r(result text);
  exception when others then
    null;
  end;
  return msg;
end;
$$;

create temporary table cleanup (kind text, id uuid);

select pg_temp.connect('a', 'finance@tplco.test');
select pg_temp.connect('b', 'finance@tplco.test');

-- -----------------------------------------------------------------------------
-- 1. Two people apply the same credit on account to two invoices at once
-- -----------------------------------------------------------------------------
select extensions.dblink_exec('a', 'begin');
select ok(
  (select r.id is not null from extensions.dblink('a', $$
     select public.allocate_payment((select id from public.payments where reference = 'Check 10442'),
       'f0000000-0000-4000-8000-000000000002', 400000) $$) as r(id uuid)),
  'Session A applies the 4,000 credit to invoice 2 (not yet committed)');
select ok(
  pg_temp.start_and_check_blocked('b', $$
    select public.allocate_payment((select id from public.payments where reference = 'Check 10442'),
      'f0000000-0000-4000-8000-000000000003', 400000) $$),
  'Session B, applying the same credit to invoice 3, waits for session A');
select extensions.dblink_exec('a', 'commit');
select is(
  pg_temp.finish_query('b'),
  'The allocation exceeds the payment''s unapplied amount',
  'After A commits, B re-checks and is refused: the credit is applied once');
select is(
  (select count(*)::int from public.payment_allocations
   where payment_id = (select id from public.payments where reference = 'Check 10442') and reversed_at is null),
  1, 'Exactly one allocation exists for the credit');
insert into cleanup select 'allocation', id from public.payment_allocations
  where payment_id = (select id from public.payments where reference = 'Check 10442');

-- -----------------------------------------------------------------------------
-- 2. A refund races an allocation for the same credit
-- -----------------------------------------------------------------------------
-- Put the credit back on account first (committed through session A).
select extensions.dblink_exec('a', format(
  'do $do$ begin perform public.reverse_allocation(%L, %L); end $do$',
  (select id from cleanup where kind = 'allocation'), 'Concurrency test'));

select extensions.dblink_exec('a', 'begin');
select ok(
  (select r.id is not null from extensions.dblink('a', $$
     select public.record_refund('c0000000-0000-4000-8000-000000000001', 400000, current_date, 'ach',
       'Concurrency test refund') $$) as r(id uuid)),
  'Session A refunds the 4,000 credit (not yet committed)');
select ok(
  pg_temp.start_and_check_blocked('b', $$
    select public.allocate_payment((select id from public.payments where reference = 'Check 10442'),
      'f0000000-0000-4000-8000-000000000003', 400000) $$),
  'Session B, applying the same credit, waits for session A');
select extensions.dblink_exec('a', 'commit');
select is(
  pg_temp.finish_query('b'),
  'The allocation exceeds the unapplied credit on this contract',
  'After the refund commits, the allocation is refused');
insert into cleanup select 'refund', id from public.refunds where reason = 'Concurrency test refund';

-- -----------------------------------------------------------------------------
-- 3. Two invoices on different contracts are issued at the same moment
-- -----------------------------------------------------------------------------
select extensions.dblink_exec('a', 'reset role');
select extensions.dblink_exec('a', $$
  insert into public.invoices (id, contract_id, memo) values
    ('f9000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Concurrency A'),
    ('f9000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Concurrency B');
  insert into public.invoice_lines (invoice_id, description, amount_minor) values
    ('f9000000-0000-4000-8000-000000000001', 'Line', 100),
    ('f9000000-0000-4000-8000-000000000002', 'Line', 100) $$);
select extensions.dblink_exec('a', 'set role authenticated');

select extensions.dblink_exec('a', 'begin');
select is(
  (select r.n from extensions.dblink('a', $$
     select public.issue_invoice('f9000000-0000-4000-8000-000000000001', date '2032-01-05') $$) as r(n text)),
  'TPL-2032-0001', 'Session A issues TPL-2032-0001 (not yet committed)');
select ok(
  pg_temp.start_and_check_blocked('b', $$
    select public.issue_invoice('f9000000-0000-4000-8000-000000000002', date '2032-01-05') $$),
  'Session B, issuing on another contract, waits for the number counter');
select extensions.dblink_exec('a', 'commit');
select is(pg_temp.finish_query('b'), null, 'Session B then succeeds');
select is(
  (select array_agg(invoice_number order by invoice_number) from public.invoices where invoice_number like 'TPL-2032-%'),
  array['TPL-2032-0001', 'TPL-2032-0002'], 'The two invoices get distinct, sequential numbers');

-- -----------------------------------------------------------------------------
-- Integrity after the races
-- -----------------------------------------------------------------------------
select lives_ok(
  $$ select private.assert_contract_integrity('c0000000-0000-4000-8000-000000000001') $$,
  'Every invariant still holds on the contract');

select * from finish();

-- -----------------------------------------------------------------------------
-- Cleanup of committed test data
-- -----------------------------------------------------------------------------
select extensions.dblink_disconnect('a');
select extensions.dblink_disconnect('b');
rollback;

begin;
set local session_replication_role = replica;
delete from public.financial_events
  where entity_id in (select id from public.payment_allocations
                      where payment_id = (select id from public.payments where reference = 'Check 10442'))
     or entity_id in (select id from public.refunds where reason = 'Concurrency test refund')
     or entity_id in ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-000000000002');
delete from public.activity_log
  where entity_id in (select id from public.payment_allocations
                      where payment_id = (select id from public.payments where reference = 'Check 10442'))
     or entity_id in (select id from public.refunds where reason = 'Concurrency test refund')
     or entity_id in ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-000000000002');
delete from public.activity_log
  where entity_id in (select id from public.invoice_lines
                      where invoice_id in ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-000000000002'));
delete from public.payment_allocations
  where payment_id = (select id from public.payments where reference = 'Check 10442');
delete from public.refunds where reason = 'Concurrency test refund';
delete from public.invoice_lines
  where invoice_id in ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-000000000002');
delete from public.invoices
  where id in ('f9000000-0000-4000-8000-000000000001', 'f9000000-0000-4000-8000-000000000002');
delete from public.document_number_counters where year = 2032;
commit;
