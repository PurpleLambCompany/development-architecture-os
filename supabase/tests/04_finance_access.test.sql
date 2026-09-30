-- =============================================================================
-- Phase 2 financial access (pgTAP). Run with: pnpm db:test
--
-- Who can see and change which financial records. Financial access is
-- separate from project access; clients see only their own engagements, only
-- with view_financials, and never drafts or internal notes; nobody writes
-- cash records except through the finance operations.
--
-- Seed (see supabase/seed.sql, "Phase 2"):
--   district  e...01  contract c...01, invoices 1-3 issued, invoice 4 scheduled,
--                     CO-1 approved, CO-2 submitted, payment link on invoice 3
--   workforce e...02  draft contract c...03
--   harbor    e...03  contract c...02, one issued invoice, CO approved externally
-- =============================================================================
begin;

select plan(47);

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

create function pg_temp.visible(table_name text, engagement uuid)
returns int
language plpgsql
as $$
declare
  n int;
begin
  execute format('select count(*)::int from public.%I where engagement_id = $1', table_name) into n using engagement;
  return n;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clients with financial visibility
-- -----------------------------------------------------------------------------
select pg_temp.act_as('sponsor@meridian.test');
select is(pg_temp.visible('contracts', 'e0000000-0000-4000-8000-000000000001'), 1,
  'Sponsor sees their executed contract');
select is(pg_temp.visible('contracts', 'e0000000-0000-4000-8000-000000000002'), 0,
  'Sponsor does not see a draft contract');
select is(pg_temp.visible('invoices', 'e0000000-0000-4000-8000-000000000001'), 3,
  'Sponsor sees issued invoices only, not the scheduled draft');
select is(
  (select count(*)::int from public.invoice_lines where invoice_id = 'f0000000-0000-4000-8000-000000000004'),
  0, 'Sponsor sees no lines of a draft invoice');
select is(pg_temp.visible('change_orders', 'e0000000-0000-4000-8000-000000000001'), 2,
  'Sponsor sees submitted and approved change orders');
select is(pg_temp.visible('payments', 'e0000000-0000-4000-8000-000000000001'), 3, 'Sponsor sees payments');
select is(pg_temp.visible('refunds', 'e0000000-0000-4000-8000-000000000001'), 1, 'Sponsor sees refunds');
select is(pg_temp.visible('payment_allocations', 'e0000000-0000-4000-8000-000000000001'), 3,
  'Sponsor sees active allocations');
select is(pg_temp.visible('finance_notes', 'e0000000-0000-4000-8000-000000000001'), 0,
  'Sponsor never sees internal finance notes');
select is(
  (select count(*)::int from public.financial_events
   where engagement_id = 'e0000000-0000-4000-8000-000000000001' and not client_visible),
  0, 'Sponsor sees only client-facing financial events');
select is(pg_temp.visible('contracts', 'e0000000-0000-4000-8000-000000000003'), 0,
  'Meridian sponsor sees nothing of Harbor''s contract');
select is(pg_temp.visible('invoices', 'e0000000-0000-4000-8000-000000000003'), 0,
  'Meridian sponsor sees nothing of Harbor''s invoices');
select is(pg_temp.visible('invoice_payment_links', 'e0000000-0000-4000-8000-000000000001'), 1,
  'Sponsor (pay_invoices) sees the payment link on an open invoice');
select is(
  (select count(*)::int from public.finance_engagement_directory()), 2,
  'Sponsor''s finance directory lists only their own two engagements');
select throws_ok(
  $$ insert into public.contracts (engagement_id, title, currency, original_value_minor)
     values ('e0000000-0000-4000-8000-000000000001', 'Client-made contract', 'USD', 100) $$,
  '42501', null, 'A client cannot create a contract');
select throws_ok(
  $$ select public.record_payment('c0000000-0000-4000-8000-000000000001', 100, current_date, 'wire') $$,
  '42501', null, 'A client cannot record a payment');
select throws_ok(
  $$ select public.issue_invoice('f0000000-0000-4000-8000-000000000004', current_date) $$,
  '42501', null, 'A client cannot issue an invoice');
select pg_temp.reset_actor();

-- Project Lead with a view_financials override on the district, but no
-- approve_change_orders or pay_invoices.
select pg_temp.act_as('lead@meridian.test');
select is(pg_temp.visible('invoices', 'e0000000-0000-4000-8000-000000000001'), 3,
  'Project Lead with a view_financials override sees issued invoices');
select is(pg_temp.visible('invoice_payment_links', 'e0000000-0000-4000-8000-000000000001'), 0,
  'Project Lead without pay_invoices sees no payment links');
select throws_ok(
  $$ select public.approve_change_order('c1000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'Project Lead without approve_change_orders cannot approve a change order');
select throws_ok(
  $$ select public.reject_change_order('c1000000-0000-4000-8000-000000000002', 'No') $$,
  '42501', null, 'Project Lead without approve_change_orders cannot reject a change order');
select pg_temp.reset_actor();

-- Harbor's Project Lead has no financial visibility at all.
select pg_temp.act_as('lead@harbor.test');
select is(pg_temp.visible('contracts', 'e0000000-0000-4000-8000-000000000003'), 0,
  'Project Lead without view_financials sees no contract');
select is(pg_temp.visible('change_orders', 'e0000000-0000-4000-8000-000000000003'), 0,
  'Project Lead without view_financials sees no change orders');
select is(
  (select count(*)::int from public.contract_financial_summary('c0000000-0000-4000-8000-000000000002', current_date)),
  0, 'The summary of an invisible contract is empty');
select pg_temp.reset_actor();

-- Clients without financial capabilities
select pg_temp.act_as('viewer@meridian.test');
select is(pg_temp.visible('contracts', 'e0000000-0000-4000-8000-000000000001'), 0, 'Client Viewer sees no contract');
select is(pg_temp.visible('invoices', 'e0000000-0000-4000-8000-000000000001'), 0, 'Client Viewer sees no invoices');
select is(pg_temp.visible('payments', 'e0000000-0000-4000-8000-000000000001'), 0, 'Client Viewer sees no payments');
select is(pg_temp.visible('financial_events', 'e0000000-0000-4000-8000-000000000001'), 0,
  'Client Viewer sees no financial events');
select pg_temp.reset_actor();

select pg_temp.act_as('advisor@consulting.test');
select is(
  (select count(*)::int from public.contracts), 0,
  'A multi-organization advisor without view_financials sees no contract in either organization');
select pg_temp.reset_actor();

-- Client Finance: may pay; the link disappears once the invoice is paid.
select pg_temp.act_as('finance@tplco.test');
insert into public.invoice_payment_links (invoice_id, url) values
  ('f0000000-0000-4000-8000-000000000001', 'https://pay.example.com/i/paid');
select pg_temp.reset_actor();
select pg_temp.act_as('finance@meridian.test');
select is(
  (select array_agg(invoice_id) from public.invoice_payment_links),
  array['f0000000-0000-4000-8000-000000000003'::uuid],
  'Client Finance sees payment links only for invoices that still have a balance');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Internal roles
-- -----------------------------------------------------------------------------
select pg_temp.act_as('finance@tplco.test');
select is(
  (select count(*)::int from public.contracts), 3,
  'Finance Administrator sees every contract, including drafts');
select is(
  (select count(*)::int from public.finance_engagement_directory()), 3,
  'Finance Administrator''s directory lists every engagement');
select is(
  (select count(*)::int from public.engagements where id = 'e0000000-0000-4000-8000-000000000003'),
  0, 'Finance Administrator has no project access to an engagement they are not assigned to');
select is(pg_temp.visible('finance_notes', 'e0000000-0000-4000-8000-000000000001'), 1,
  'Finance Administrator sees internal finance notes');
select throws_ok(
  $$ insert into public.payments (contract_id, amount_minor, received_on, method)
     values ('c0000000-0000-4000-8000-000000000001', 100, current_date, 'wire') $$,
  '42501', null, 'Nobody inserts payments directly, even a Finance Administrator');
select throws_ok(
  $$ update public.payment_allocations set amount_minor = 1 $$,
  '42501', null, 'Nobody edits allocations directly');
select throws_ok(
  $$ delete from public.financial_events $$,
  '42501', null, 'Nobody deletes financial events');
select throws_ok(
  $$ update public.invoices set total_minor = 1 where id = 'f0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'An issued invoice''s total cannot be changed directly');
select is_empty(
  $$ update public.invoices set memo = 'Edited' where id = 'f0000000-0000-4000-8000-000000000001' returning id $$,
  'An issued invoice cannot be edited, even in its editable columns');
select throws_ok(
  $$ select public.execute_contract('c0000000-0000-4000-8000-000000000003', current_date, 'Someone') $$,
  '42501', null, 'A Finance Administrator cannot execute a contract');
select throws_ok(
  $$ select public.record_external_change_order_approval('c1000000-0000-4000-8000-000000000002',
       'Eleanor Vance', null, current_date, 'email', null, 'Email') $$,
  '42501', null, 'A Finance Administrator cannot record an external change-order approval');
select pg_temp.reset_actor();

select pg_temp.act_as('architect@tplco.test');
select is(pg_temp.visible('contracts', 'e0000000-0000-4000-8000-000000000001'), 0,
  'An assigned Architect without view_financials sees no contract');
select is((select count(*)::int from public.finance_engagement_directory()), 0,
  'An Architect''s finance directory is empty');
select throws_ok(
  $$ select public.record_payment('c0000000-0000-4000-8000-000000000001', 100, current_date, 'wire') $$,
  '42501', null, 'An Architect cannot record a payment');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
select is((select count(*)::int from public.contracts), 3, 'A Principal Architect sees every contract');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Anonymous
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select count(*) from public.contracts $$, '42501', null, 'Anonymous users cannot read contracts');
select throws_ok($$ select count(*) from public.payments $$, '42501', null, 'Anonymous users cannot read payments');
reset role;

select * from finish();
rollback;
