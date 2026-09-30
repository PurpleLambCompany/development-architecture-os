-- =============================================================================
-- Phase 2 financial calculations (pgTAP). Run with: pnpm db:test
--
-- Every figure has one definition (contract_financial_summary). These tests
-- check the seeded engagement figure by figure, then walk a fresh contract
-- through partial payments, a split payment, a credit note, a prepayment, an
-- allocation reversal, a bounced payment, a refund and a negative change
-- order, re-checking the identities after every step:
--   remaining contract balance = remaining to invoice + outstanding balance
--   outstanding balance        = currently due + not yet due
--   payments received          = applied + unapplied credit + refunds
--   net remaining to collect   = remaining contract balance - unapplied credit
-- =============================================================================
begin;

select plan(63);

create function pg_temp.act_as(user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
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

create function pg_temp.summary(contract uuid, as_of date default current_date)
returns jsonb
language sql
as $$
  select to_jsonb(s) from public.contract_financial_summary(contract, as_of) s;
$$;

create function pg_temp.fig(contract uuid, figure text, as_of date default current_date)
returns bigint
language sql
as $$
  select (pg_temp.summary(contract, as_of) ->> (figure || '_minor'))::bigint;
$$;

create function pg_temp.identities_hold(contract uuid, as_of date default current_date)
returns boolean
language sql
as $$
  select
    (s->>'remaining_contract_balance_minor')::bigint
      = (s->>'remaining_to_invoice_minor')::bigint + (s->>'outstanding_balance_minor')::bigint
    and (s->>'outstanding_balance_minor')::bigint
      = (s->>'currently_due_minor')::bigint + (s->>'not_yet_due_minor')::bigint
    and (s->>'payments_received_minor')::bigint
      = (s->>'payments_applied_minor')::bigint + (s->>'unapplied_credit_minor')::bigint + (s->>'refunds_minor')::bigint
    and (s->>'net_remaining_to_collect_minor')::bigint
      = (s->>'remaining_contract_balance_minor')::bigint - (s->>'unapplied_credit_minor')::bigint
    and (s->>'net_invoiced_minor')::bigint
      = (s->>'gross_invoiced_minor')::bigint - (s->>'credits_issued_minor')::bigint
    and (s->>'outstanding_balance_minor')::bigint
      = (s->>'net_invoiced_minor')::bigint - (s->>'payments_applied_minor')::bigint
  from pg_temp.summary(contract, as_of) s;
$$;

-- An issued invoice with one free-text line.
create function pg_temp.invoice(contract uuid, amount bigint, issued date, due date)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into public.invoices (contract_id, memo) values (contract, 'Test invoice') returning id into new_id;
  insert into public.invoice_lines (invoice_id, description, amount_minor) values (new_id, 'Services', amount);
  perform public.issue_invoice(new_id, issued, due);
  return new_id;
end;
$$;

create function pg_temp.balance(inv uuid)
returns bigint
language sql
as $$
  select b.balance_minor from public.invoices i, public.invoice_balances(i.engagement_id, current_date) b
  where i.id = inv and b.invoice_id = inv;
$$;

create function pg_temp.state(inv uuid, as_of date default current_date)
returns text
language sql
as $$
  select b.payment_state from public.invoices i, public.invoice_balances(i.engagement_id, as_of) b
  where i.id = inv and b.invoice_id = inv;
$$;

-- -----------------------------------------------------------------------------
-- 1. The seeded Regional Innovation District, figure by figure
-- -----------------------------------------------------------------------------
select pg_temp.act_as('finance@tplco.test');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'original_value'), 15000000::bigint, 'Original contract value');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'approved_changes'), 1200000::bigint, 'Approved change orders');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'pending_changes'), 850000::bigint, 'Submitted change orders are pending, not counted');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'revised_value'), 16200000::bigint, 'Revised contract value');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'gross_invoiced'), 11700000::bigint, 'Gross invoiced (issued only)');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'credits_issued'), 200000::bigint, 'Credits issued');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'net_invoiced'), 11500000::bigint, 'Net invoiced');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'remaining_to_invoice'), 4700000::bigint, 'Remaining to invoice');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'payments_received'), 6000000::bigint, 'Payments received');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'refunds'), 100000::bigint, 'Refunds');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'net_cash_received'), 5900000::bigint, 'Net cash received');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'payments_applied'), 5500000::bigint, 'Payments applied');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'unapplied_credit'), 400000::bigint, 'Unapplied credit (after the refund)');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'outstanding_balance'), 6000000::bigint, 'Outstanding invoice balance');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'currently_due'), 1000000::bigint, 'Currently due');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'past_due'), 1000000::bigint, 'Past due');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'not_yet_due'), 5000000::bigint, 'Issued, not yet due');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'remaining_contract_balance'), 10700000::bigint, 'Remaining contract balance');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'net_remaining_to_collect'), 10300000::bigint, 'Net remaining to collect');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'unscheduled'), 1200000::bigint, 'Unscheduled (approved CO not on the payment plan)');
select is(
  pg_temp.summary('c0000000-0000-4000-8000-000000000001') ->> 'next_payment_label', 'TPL-2026-0002',
  'Next payment is the oldest outstanding invoice');
select ok(pg_temp.identities_hold('c0000000-0000-4000-8000-000000000001'), 'Identities hold for the seed');
select pg_temp.reset_actor();

-- The client sees exactly the same figures: nothing it may not see feeds them.
select pg_temp.act_as('sponsor@meridian.test');
select ok(
  pg_temp.summary('c0000000-0000-4000-8000-000000000001') - 'next_payment_id'
    = (select pg_temp.summary('c0000000-0000-4000-8000-000000000001') - 'next_payment_id'),
  'Summary is stable for the client');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'net_remaining_to_collect'), 10300000::bigint,
  'Client sees the same Net Remaining to Collect');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000001', 'unapplied_credit'), 400000::bigint,
  'Client sees the same credit on account');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- 2. A fresh contract: the Workforce draft, USD 42,000
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select public.execute_contract('c0000000-0000-4000-8000-000000000003', current_date - 60, 'Eleanor Vance');
create temporary table t (name text primary key, id uuid) on commit drop;
insert into t values
  ('inv1', pg_temp.invoice('c0000000-0000-4000-8000-000000000003', 400000, current_date - 50, current_date - 20)),
  ('inv2', pg_temp.invoice('c0000000-0000-4000-8000-000000000003', 500000, current_date - 40, current_date - 10)),
  ('inv3', pg_temp.invoice('c0000000-0000-4000-8000-000000000003', 600000, current_date - 5,  current_date + 25));

select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'outstanding_balance'), 1500000::bigint,
  'Three invoices outstanding: 4,000 + 5,000 + 6,000');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'past_due'), 900000::bigint,
  'Two of them are past due');

-- Your example: one $10,000 payment across three invoices.
select lives_ok(
  format($$ select public.record_payment('c0000000-0000-4000-8000-000000000003', 1000000, current_date, 'wire',
      'WIRE-1', 'Meridian', null, null, null,
      jsonb_build_array(
        jsonb_build_object('invoice_id', %L, 'amount_minor', 400000),
        jsonb_build_object('invoice_id', %L, 'amount_minor', 500000),
        jsonb_build_object('invoice_id', %L, 'amount_minor', 100000))) $$,
    (select id from t where name = 'inv1'), (select id from t where name = 'inv2'), (select id from t where name = 'inv3')),
  'A $10,000 payment is split across three invoices');
select is(pg_temp.state((select id from t where name = 'inv1')), 'paid', 'Invoice 1 is paid');
select is(pg_temp.state((select id from t where name = 'inv2')), 'paid', 'Invoice 2 is paid');
select is(pg_temp.state((select id from t where name = 'inv3')), 'partially_paid', 'Invoice 3 is partially paid');
select is(pg_temp.balance((select id from t where name = 'inv3')), 500000::bigint, 'Invoice 3 still has $5,000 due');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'unapplied_credit'), 0::bigint, 'Nothing unapplied');
select ok(pg_temp.identities_hold('c0000000-0000-4000-8000-000000000003'), 'Identities hold after the split payment');

-- Due-date boundaries use the business date passed in.
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'currently_due', current_date + 25), 500000::bigint,
  'On its due date the invoice is currently due');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'past_due', current_date + 25), 0::bigint,
  '... but not yet past due');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'past_due', current_date + 26), 500000::bigint,
  'The day after, it is past due');
select is(pg_temp.state((select id from t where name = 'inv3'), current_date + 26), 'overdue', 'and shows as overdue');

-- Your credit-note example: invoice 10,000, credit 2,000, 6,000 applied, 2,000 due.
insert into t values ('inv4', pg_temp.invoice('c0000000-0000-4000-8000-000000000003', 1000000, current_date, current_date + 30));
insert into public.credit_notes (invoice_id, amount_minor, reason)
  select id, 200000, 'Scope adjustment' from t where name = 'inv4';
select public.issue_credit_note((select cn.id from public.credit_notes cn join t on t.id = cn.invoice_id where t.name = 'inv4'), current_date);
select public.record_payment('c0000000-0000-4000-8000-000000000003', 600000, current_date, 'ach', 'ACH-2', 'Meridian',
  null, null, null, jsonb_build_array(jsonb_build_object('invoice_id', (select id from t where name = 'inv4'), 'amount_minor', 600000)));
select is(pg_temp.balance((select id from t where name = 'inv4')), 200000::bigint,
  'Invoice 10,000 - credit 2,000 - paid 6,000 = 2,000 still due');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'net_invoiced'), 2300000::bigint,
  'Net invoiced reflects the credit note');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'revised_value'), 4200000::bigint,
  'A credit note does not change the contract value');
select ok(pg_temp.identities_hold('c0000000-0000-4000-8000-000000000003'), 'Identities hold after the credit note');

-- Prepayment: cash before any bill is credit on account, never silently
-- subtracted from what is due.
select public.record_payment('c0000000-0000-4000-8000-000000000003', 300000, current_date, 'check', 'Check 77', 'Meridian');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'unapplied_credit'), 300000::bigint, 'A prepayment is credit on account');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'outstanding_balance'), 700000::bigint,
  'Credit on account does not reduce the outstanding balance');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'remaining_contract_balance'), 2600000::bigint,
  'Remaining contract balance counts applied cash only');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'net_remaining_to_collect'), 2300000::bigint,
  'Net Remaining to Collect counts all net cash, including credit on account');
select ok(pg_temp.identities_hold('c0000000-0000-4000-8000-000000000003'), 'Identities hold after a prepayment');

-- Applying the prepayment later.
select public.allocate_payment((select id from public.payments where reference = 'Check 77'),
  (select id from t where name = 'inv4'), 200000);
select is(pg_temp.state((select id from t where name = 'inv4')), 'paid', 'Credit applied later pays the invoice');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'unapplied_credit'), 100000::bigint, 'The rest stays on account');

-- Allocation reversal and re-application: history is kept.
select public.reverse_allocation(
  (select a.id from public.payment_allocations a join t on t.id = a.invoice_id where t.name = 'inv3'),
  'Applied to the wrong invoice');
select is(pg_temp.balance((select id from t where name = 'inv3')), 600000::bigint, 'Reversing an allocation restores the invoice balance');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'unapplied_credit'), 200000::bigint, 'and returns the cash to credit on account');
select is(
  (select count(*)::int from public.payment_allocations a join t on t.id = a.invoice_id where t.name = 'inv3' and a.reversed_at is not null),
  1, 'The reversed allocation is kept, not deleted');
select ok(pg_temp.identities_hold('c0000000-0000-4000-8000-000000000003'), 'Identities hold after a reversal');

-- Refund: reduces credit on account and net cash; the contract balance is unchanged.
select throws_ok(
  $$ select public.record_refund('c0000000-0000-4000-8000-000000000003', 150000, current_date, 'ach', 'Too much',
       (select id from public.payments where reference = 'WIRE-1')) $$,
  '23514', 'The refund exceeds the unapplied amount of that payment',
  'A refund from a payment is limited to that payment''s unapplied amount');
select public.record_refund('c0000000-0000-4000-8000-000000000003', 100000, current_date, 'ach', 'Returned at client request',
  (select id from public.payments where reference = 'WIRE-1'));
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'unapplied_credit'), 100000::bigint, 'A refund reduces credit on account');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'remaining_contract_balance'), 2500000::bigint,
  'A refund does not change the remaining contract balance');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'net_remaining_to_collect'), 2400000::bigint,
  'A refund increases Net Remaining to Collect');
select ok(pg_temp.identities_hold('c0000000-0000-4000-8000-000000000003'), 'Identities hold after a refund');

-- A bounced payment: reversed with all its allocations.
select public.reverse_payment((select id from public.payments where reference = 'ACH-2'), 'Returned by the bank (R01)');
select is(pg_temp.balance((select id from t where name = 'inv4')), 600000::bigint,
  'Reversing a payment reopens the invoice it paid');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'payments_received'), 1300000::bigint,
  'A reversed payment is no longer received cash');
select ok(pg_temp.identities_hold('c0000000-0000-4000-8000-000000000003'), 'Identities hold after a payment reversal');

-- A negative change order lowers the price.
with co as (
  insert into public.change_orders (contract_id, title, amount_minor)
  values ('c0000000-0000-4000-8000-000000000003', 'Reduced scope', -300000)
  returning id
)
insert into t select 'co', id from co;
select public.submit_change_order((select id from t where name = 'co'));
select public.record_external_change_order_approval((select id from t where name = 'co'),
  'Eleanor Vance', 'Executive Director', current_date, 'email', null, 'Email of today');
select is(pg_temp.fig('c0000000-0000-4000-8000-000000000003', 'revised_value'), 3900000::bigint,
  'An approved negative change order lowers the revised value');
select ok(pg_temp.identities_hold('c0000000-0000-4000-8000-000000000003'), 'Identities hold after a negative change order');
select pg_temp.reset_actor();

select * from finish();
rollback;
