-- =============================================================================
-- Phase 2 financial integrity (pgTAP). Run with: pnpm db:test
--
-- The rules that keep the ledger honest: no double billing, no over-applied or
-- over-refunded cash, permanent document numbers, immutable issued records,
-- corrections by new records, common contract context, no card or bank
-- numbers, HTTPS-only payment links, and change-order approval provenance.
-- =============================================================================
begin;

select plan(62);

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

create function pg_temp.draft_invoice(contract uuid, amount bigint, milestone uuid default null, change_order uuid default null)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into public.invoices (contract_id, memo) values (contract, 'Test') returning id into new_id;
  insert into public.invoice_lines (invoice_id, description, amount_minor, payment_milestone_id, change_order_id)
  values (new_id, 'Line', amount, milestone, change_order);
  return new_id;
end;
$$;

create temporary table t (name text primary key, id uuid);
grant all on t to authenticated;

-- Seed ids
--   meridian contract c...01; milestones d...01 (30,000, fully billed), d...05 (15,000, unbilled)
--   CO-1 c1...01 approved 12,000 (fully billed), CO-2 c1...02 submitted
--   invoices f...01 (paid), f...02 (balance 10,000), f...03 (balance 50,000)
--   harbor contract c...02, milestone d...11

select pg_temp.act_as('principal@tplco.test');

-- -----------------------------------------------------------------------------
-- Anti-double-billing
-- -----------------------------------------------------------------------------
insert into t values ('dup_ms', pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 100, 'd0000000-0000-4000-8000-000000000001'));
select throws_ok(
  format($$ select public.issue_invoice(%L, current_date) $$, (select id from t where name = 'dup_ms')),
  '23514', 'Milestone "Deposit on signing" would be billed beyond its amount',
  'A fully billed milestone cannot be billed again');
select is((select status::text from public.invoices where id = (select id from t where name = 'dup_ms')), 'draft',
  'The rejected invoice stays a draft with no number');

insert into t values ('part1', pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 1000000, 'd0000000-0000-4000-8000-000000000005'));
insert into t values ('part2', pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 500000, 'd0000000-0000-4000-8000-000000000005'));
insert into t values ('part3', pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 1, 'd0000000-0000-4000-8000-000000000005'));
select lives_ok(format($$ select public.issue_invoice(%L, current_date) $$, (select id from t where name = 'part1')),
  'A milestone can be billed partially');
select is((select status::text from public.payment_milestones where id = 'd0000000-0000-4000-8000-000000000005'), 'planned',
  'A partially billed milestone is not yet invoiced');
select lives_ok(format($$ select public.issue_invoice(%L, current_date) $$, (select id from t where name = 'part2')),
  'Partial bills may add up to the milestone amount');
select is((select status::text from public.payment_milestones where id = 'd0000000-0000-4000-8000-000000000005'), 'invoiced',
  'A fully billed milestone becomes invoiced');
select throws_ok(format($$ select public.issue_invoice(%L, current_date) $$, (select id from t where name = 'part3')),
  '23514', null, 'Cumulative partial bills cannot exceed the milestone amount');
select throws_ok(
  $$ select public.set_milestone_status('d0000000-0000-4000-8000-000000000005', 'cancelled') $$,
  '23514', null, 'A billed milestone cannot be cancelled');

insert into t values ('dup_co', pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 100, null, 'c1000000-0000-4000-8000-000000000001'));
select throws_ok(format($$ select public.issue_invoice(%L, current_date) $$, (select id from t where name = 'dup_co')),
  '23514', 'Change order CO-1 would be billed beyond its approved amount',
  'An approved change order cannot be billed beyond its amount');
select throws_ok(
  $$ select pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 100, null, 'c1000000-0000-4000-8000-000000000002') $$,
  '23514', 'Only approved change orders that increase the price can be billed',
  'A submitted change order cannot be billed');
select throws_ok(
  $$ select pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 100,
       'd0000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001') $$,
  '23514', null, 'A line cannot bill a milestone and a change order at once');
select throws_ok(
  $$ select pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 100, 'd0000000-0000-4000-8000-000000000011') $$,
  '23503', null, 'A line cannot bill another contract''s milestone');

-- -----------------------------------------------------------------------------
-- Document numbers: sequential per year, permanent, never reused
-- -----------------------------------------------------------------------------
insert into t values ('n1', pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 100));
insert into t values ('n2', pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 100));
insert into t values ('n3', pg_temp.draft_invoice('c0000000-0000-4000-8000-000000000001', 100));
select is(public.issue_invoice((select id from t where name = 'n1'), date '2031-03-02'), 'TPL-2031-0001',
  'The first invoice of a year is TPL-YYYY-0001');
select is(public.issue_invoice((select id from t where name = 'n2'), date '2031-03-02'), 'TPL-2031-0002',
  'Numbers are sequential');
select lives_ok(format($$ select public.void_invoice(%L, 'Issued in error') $$, (select id from t where name = 'n2')),
  'An unpaid, uncredited invoice can be voided');
select is((select invoice_number from public.invoices where id = (select id from t where name = 'n2')), 'TPL-2031-0002',
  'A voided invoice keeps its number');
select is(public.issue_invoice((select id from t where name = 'n3'), date '2031-03-02'), 'TPL-2031-0003',
  'A voided number is never reused');
insert into public.credit_notes (invoice_id, amount_minor, reason) select id, 50, 'Test' from t where name = 'n1'
  returning id as cn \gset
select is(public.issue_credit_note(:'cn', date '2031-03-03'), 'TPL-CN-2031-0001',
  'Credit notes have their own series');
select throws_ok(
  format($$ select public.void_invoice(%L, 'Try') $$, (select id from t where name = 'n1')),
  '23514', null, 'An invoice with a credit note cannot be voided');

-- -----------------------------------------------------------------------------
-- Immutability of issued records
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ update public.invoice_lines set amount_minor = 1 where invoice_id = 'f0000000-0000-4000-8000-000000000001' $$,
  '23514', 'Lines of an issued invoice cannot change', 'Lines of an issued invoice cannot change');
select throws_ok(
  $$ select public.void_invoice('f0000000-0000-4000-8000-000000000001', 'Try') $$,
  '23514', null, 'An invoice with payments applied cannot be voided');
select is_empty(
  $$ update public.contracts set original_value_minor = 1 where id = 'c0000000-0000-4000-8000-000000000001' returning id $$,
  'An executed contract is not editable through row-level security');
select throws_ok(
  $$ select public.void_change_order('c1000000-0000-4000-8000-000000000001', 'Try') $$,
  '23514', null, 'An approved change order is final');
select is_empty(
  $$ delete from public.credit_notes where status = 'issued' returning id $$,
  'Issued credit notes cannot be deleted');
select pg_temp.reset_actor();

-- Guards hold even for a privileged session outside a finance operation.
select throws_ok(
  $$ update public.contracts set original_value_minor = 1 where id = 'c0000000-0000-4000-8000-000000000001' $$,
  '23514', 'Executed contract terms cannot change; use a change order', 'Executed contract terms are locked');
select throws_ok(
  $$ update public.refunds set amount_minor = 1 $$,
  '42501', null, 'Completed refunds are never edited directly');
select throws_ok(
  $$ delete from public.refunds $$,
  '23514', null, 'Refunds are never deleted');
select throws_ok(
  $$ delete from public.payments $$,
  '23514', null, 'Payments are never deleted');
select throws_ok(
  $$ update public.payment_allocations set amount_minor = amount_minor + 1 $$,
  '42501', null, 'Allocations are never edited');
select throws_ok(
  $$ update public.financial_events set summary = 'x' $$,
  '23514', null, 'Financial events are append-only');
select throws_ok(
  $$ update public.change_order_events set note = 'x' $$,
  '23514', null, 'Change-order history is append-only');
select throws_ok(
  $$ update public.contracts set status = 'completed' where id = 'c0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'Contract status changes only through operations, even after an operation ran in this transaction');

-- Common context is enforced by composite keys, even inside an operation.
select private.begin_finance_operation();
select throws_ok(
  $$ insert into public.payment_allocations (payment_id, invoice_id, contract_id, engagement_id, amount_minor)
     select p.id, 'f0000000-0000-4000-8000-000000000011', p.contract_id, p.engagement_id, 1
     from public.payments p where p.contract_id = 'c0000000-0000-4000-8000-000000000001' limit 1 $$,
  '23503', null, 'An allocation cannot join a payment and an invoice from different contracts');
select set_config('dsa.finance_operation', '', true);

-- -----------------------------------------------------------------------------
-- Allocations
-- -----------------------------------------------------------------------------
select pg_temp.act_as('finance@tplco.test');
insert into t select 'check', id from public.payments where reference = 'Check 10442';
select throws_ok(
  format($$ select public.allocate_payment(%L, 'f0000000-0000-4000-8000-000000000002', 400001) $$, (select id from t where name = 'check')),
  '23514', 'The allocation exceeds the payment''s unapplied amount', 'Cannot apply more than a payment''s unapplied amount');
select throws_ok(
  format($$ select public.allocate_payment(%L, 'f0000000-0000-4000-8000-000000000001', 100) $$, (select id from t where name = 'check')),
  '23514', null, 'Cannot apply more than an invoice''s balance');
select throws_ok(
  format($$ select public.allocate_payment(%L, 'f0000000-0000-4000-8000-000000000011', 100) $$, (select id from t where name = 'check')),
  '23514', 'The invoice must belong to the same contract as the payment', 'Cannot apply to another contract''s invoice');
select throws_ok(
  format($$ select public.allocate_payment(%L, 'f0000000-0000-4000-8000-000000000004', 100) $$, (select id from t where name = 'check')),
  '23514', 'Payments can be applied only to issued invoices', 'Cannot apply to a draft invoice');
select throws_ok(
  format($$ select public.allocate_payment(%L, 'f0000000-0000-4000-8000-000000000002', 0) $$, (select id from t where name = 'check')),
  '23514', null, 'An allocation must be positive');
insert into t values ('alloc', public.allocate_payment((select id from t where name = 'check'), 'f0000000-0000-4000-8000-000000000002', 400000));
select lives_ok(format($$ select public.reverse_allocation(%L, 'Wrong invoice') $$, (select id from t where name = 'alloc')),
  'An allocation can be reversed');
select throws_ok(format($$ select public.reverse_allocation(%L, 'Again') $$, (select id from t where name = 'alloc')),
  '23514', 'This allocation has already been reversed', 'An allocation is reversed only once');
select throws_ok(format($$ select public.reverse_allocation(%L, '') $$, (select id from t where name = 'alloc')),
  '23514', null, 'A reversal needs a reason');

-- -----------------------------------------------------------------------------
-- Credit notes
-- -----------------------------------------------------------------------------
insert into public.credit_notes (invoice_id, amount_minor, reason)
  values ('f0000000-0000-4000-8000-000000000001', 100000, 'Goodwill') returning id as cn_paid \gset
select throws_ok(format($$ select public.issue_credit_note(%L, current_date) $$, :'cn_paid'),
  '23514', null, 'A fully paid invoice cannot be credited until payment is taken back');
select public.reverse_allocation(
  (select id from public.payment_allocations where invoice_id = 'f0000000-0000-4000-8000-000000000001' and reversed_at is null),
  'Making room for a credit note');
select lives_ok(format($$ select public.issue_credit_note(%L, current_date) $$, :'cn_paid'),
  'After the allocation is reversed, the credit note can be issued');

-- -----------------------------------------------------------------------------
-- Refunds
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ select public.record_refund('c0000000-0000-4000-8000-000000000002', 100, current_date, 'ach', 'No credit') $$,
  '23514', 'The refund exceeds the unapplied credit on this contract', 'A refund needs sufficient credit on account');
select throws_ok(
  $$ select public.record_refund('c0000000-0000-4000-8000-000000000001', 100, current_date, 'ach', '') $$,
  '23514', null, 'A refund needs a reason');
select throws_ok(
  format($$ select public.reverse_payment(%L, 'Bounced') $$, (select id from t where name = 'check')),
  '23514', 'Refunds were made from this payment; void them before reversing it',
  'A payment with a completed refund cannot be reversed');
select lives_ok(
  $$ select public.void_refund((select id from public.refunds where reference = 'ACH-R-5510'), 'Refund was not sent') $$,
  'A refund can be voided with a reason');
select is((select status::text from public.refunds where reference = 'ACH-R-5510'), 'void', 'The voided refund is kept');
select throws_ok(
  $$ select public.void_refund((select id from public.refunds where reference = 'ACH-R-5510'), 'Again') $$,
  '23514', null, 'A refund is voided only once');

-- -----------------------------------------------------------------------------
-- No card or bank numbers; HTTPS payment links only
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ select public.record_payment('c0000000-0000-4000-8000-000000000001', 100, current_date, 'card_via_processor', '4111 1111 1111 1111') $$,
  '23514', null, 'A card number is rejected as a payment reference');
select throws_ok(
  $$ select public.record_payment('c0000000-0000-4000-8000-000000000001', 100, current_date, 'ach', 'ACCT 000123456789') $$,
  '23514', null, 'A bank account number is rejected as a payment reference');
select throws_ok(
  $$ insert into public.invoice_payment_links (invoice_id, url) values ('f0000000-0000-4000-8000-000000000002', 'http://pay.example.com/x') $$,
  '23514', null, 'A payment link must be HTTPS');

-- -----------------------------------------------------------------------------
-- Contracts
-- -----------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.contracts (engagement_id, title, currency, original_value_minor)
     values ('e0000000-0000-4000-8000-000000000001', 'Canadian', 'CAD', 100) $$,
  '23514', 'Currency CAD is not enabled', 'Only enabled currencies can be used');
select pg_temp.reset_actor();

select pg_temp.act_as('principal@tplco.test');
insert into public.contracts (engagement_id, title, currency, original_value_minor)
  values ('e0000000-0000-4000-8000-000000000001', 'Second contract', 'USD', 100) returning id as second_contract \gset
select throws_ok(format($$ select public.execute_contract(%L, current_date, 'Eleanor Vance') $$, :'second_contract'),
  '23505', null, 'An engagement has at most one current contract');
update public.contracts set supersedes_contract_id = 'c0000000-0000-4000-8000-000000000001' where id = :'second_contract';
select lives_ok(format($$ select public.execute_contract(%L, current_date, 'Eleanor Vance') $$, :'second_contract'),
  'A renewal supersedes the current contract');
select is((select status::text from public.contracts where id = 'c0000000-0000-4000-8000-000000000001'), 'superseded',
  'The old contract is kept as superseded');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Change-order approval provenance
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select throws_ok(
  $$ select public.record_external_change_order_approval('c1000000-0000-4000-8000-000000000002',
       'Eleanor Vance', null, current_date, 'email', null, null) $$,
  '23514', null, 'An external approval needs evidence');
select pg_temp.reset_actor();
select pg_temp.act_as('sponsor@meridian.test');
select throws_ok(
  $$ select public.approve_change_order('c1000000-0000-4000-8000-000000000002') $$,
  '23514', 'Change orders can be approved only against a current contract',
  'A change order on a superseded contract cannot be approved');
select pg_temp.reset_actor();
select is(
  (select approval_source::text || ':' || (approved_by_user_id is not null)::text
   from public.change_orders where id = 'c1000000-0000-4000-8000-000000000001'),
  'client_portal:true', 'A portal approval records the approving user');
select is(
  (select approval_source::text || ':' || external_approver_name || ':' || external_approval_method::text || ':' || (recorded_by is not null)::text
   from public.change_orders where id = 'c1000000-0000-4000-8000-000000000011'),
  'external_recorded_by_tplco:Richard Amsel:signed_document:true',
  'An external approval records the client approver, method and TPLCo recorder');
select is(
  (select contract_value_before_minor::text || '->' || contract_value_after_minor::text
   from public.change_order_events where change_order_id = 'c1000000-0000-4000-8000-000000000001' and to_status = 'approved'),
  '15000000->16200000', 'The approval history records the contract value before and after');

-- -----------------------------------------------------------------------------
-- A suspended client loses financial visibility at once
-- -----------------------------------------------------------------------------
update public.organization_members set status = 'suspended'
where user_id = (select id from auth.users where email = 'finance@meridian.test');
select pg_temp.act_as('finance@meridian.test');
select is((select count(*)::int from public.invoices), 0, 'A suspended client user sees no invoices');
select pg_temp.reset_actor();

select * from finish();
rollback;
