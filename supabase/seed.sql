-- =============================================================================
-- DSA OS — local demo data
--
-- LOCAL DEVELOPMENT ONLY. Every demo account uses the password below.
-- Loaded automatically by `supabase db reset`.
--
--   Password for all demo users:  dsa-demo-password
--
-- Fictional organizations and people. All emails use the reserved `.test`
-- domain so they can never reach a real inbox.
-- =============================================================================

-- Refuse to run against a database that already holds real accounts.
do $$
begin
  if exists (select 1 from auth.users where email not like '%.test') then
    raise exception 'Refusing to seed: this database contains non-demo users';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Demo users (auth.users + auth.identities); profiles are created by trigger.
-- -----------------------------------------------------------------------------
create temporary table demo_users (
  id uuid primary key,
  email text not null,
  first_name text not null,
  last_name text not null
);

insert into demo_users (id, email, first_name, last_name) values
  -- TPLCo
  ('10000000-0000-4000-8000-000000000001', 'sysadmin@tplco.test',      'Morgan',  'Hale'),
  ('10000000-0000-4000-8000-000000000002', 'principal@tplco.test',     'Adrienne','Cole'),
  ('10000000-0000-4000-8000-000000000003', 'architect@tplco.test',     'Julian',  'Reyes'),
  ('10000000-0000-4000-8000-000000000004', 'researcher@tplco.test',    'Priya',   'Nair'),
  ('10000000-0000-4000-8000-000000000005', 'projectadmin@tplco.test',  'Dana',    'Whitfield'),
  ('10000000-0000-4000-8000-000000000006', 'finance@tplco.test',       'Marcus',  'Bell'),
  -- Meridian Development Authority
  ('20000000-0000-4000-8000-000000000001', 'sponsor@meridian.test',     'Eleanor', 'Vance'),
  ('20000000-0000-4000-8000-000000000002', 'lead@meridian.test',        'Tomas',   'Okafor'),
  ('20000000-0000-4000-8000-000000000003', 'finance@meridian.test',     'Grace',   'Lindqvist'),
  ('20000000-0000-4000-8000-000000000004', 'contributor@meridian.test', 'Samuel',  'Ortiz'),
  ('20000000-0000-4000-8000-000000000005', 'viewer@meridian.test',      'Hannah',  'Brooks'),
  -- Harbor Commons Foundation
  ('30000000-0000-4000-8000-000000000001', 'sponsor@harbor.test',       'Richard', 'Amsel'),
  ('30000000-0000-4000-8000-000000000002', 'lead@harbor.test',          'Nadia',   'Farouk'),
  ('30000000-0000-4000-8000-000000000003', 'finance@harbor.test',       'Owen',    'Pratt'),
  ('30000000-0000-4000-8000-000000000004', 'contributor@harbor.test',   'Lucia',   'Moreno'),
  ('30000000-0000-4000-8000-000000000005', 'viewer@harbor.test',        'Theo',    'Garner'),
  -- Independent advisor who works with both client organizations
  ('40000000-0000-4000-8000-000000000001', 'advisor@consulting.test',   'Claire',  'Donovan');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('dsa-demo-password', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name),
  now(),
  now(),
  '', '', '', ''
from demo_users u;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from demo_users u;

drop table demo_users;

-- -----------------------------------------------------------------------------
-- Organizations
-- -----------------------------------------------------------------------------
insert into public.organizations (id, name, slug, type) values
  ('a0000000-0000-4000-8000-000000000001', 'The Purple Lamb Company',       'tplco',                         'tplco'),
  ('a0000000-0000-4000-8000-000000000002', 'Meridian Development Authority', 'meridian-development-authority', 'client'),
  ('a0000000-0000-4000-8000-000000000003', 'Harbor Commons Foundation',      'harbor-commons-foundation',      'client');

insert into public.organization_members (organization_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'system_administrator'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'principal_architect'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'architect'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'researcher'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'project_administrator'),
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'finance_administrator'),
  ('a0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'executive_sponsor'),
  ('a0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'client_project_lead'),
  ('a0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'client_finance'),
  ('a0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 'client_contributor'),
  ('a0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 'client_viewer'),
  ('a0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'executive_sponsor'),
  ('a0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'client_project_lead'),
  ('a0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'client_finance'),
  ('a0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004', 'client_contributor'),
  ('a0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000005', 'client_viewer'),
  -- One person, two organizations, a different role in each.
  ('a0000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'client_contributor'),
  ('a0000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 'client_project_lead');

-- -----------------------------------------------------------------------------
-- Engagements. All seed data is made up: every seed engagement's data_origin
-- is synthetic (ADR-0060), which only seed and migrations can set.
-- -----------------------------------------------------------------------------
insert into public.engagements (
  id, client_organization_id, title, slug, engagement_type, objective, description,
  status, current_phase, start_date, target_end_date, created_by, data_origin
) values
  (
    'e0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    'Regional Innovation District',
    'meridian-innovation-district',
    'development_architecture_intensive',
    'Architect the knowledge, capability, strategic and application structure required to launch a regional innovation district within 36 months.',
    'Full four-domain architecture for a multi-stakeholder innovation district anchored by the Authority, two universities and a regional health system.',
    'active',
    'Capability Architecture',
    date '2026-08-03',
    date '2026-12-18',
    '10000000-0000-4000-8000-000000000002',
    'synthetic'
  ),
  (
    'e0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    'Workforce Capability Program',
    'meridian-workforce-capability',
    'development_architecture_sprint',
    'Define the capability architecture for a regional workforce development program.',
    'Scoping sprint to establish the capability map and talent sequencing for the program.',
    'proposed',
    'Scoping',
    date '2027-01-11',
    date '2027-02-19',
    '10000000-0000-4000-8000-000000000002',
    'synthetic'
  ),
  (
    'e0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000003',
    'Community Expansion Architecture',
    'harbor-community-expansion',
    'embedded_development_partner',
    'Structure the Foundation''s expansion into three new service regions without diluting program quality.',
    'Embedded partnership covering governance, operating model and measurement system design.',
    'active',
    'Knowledge Architecture',
    date '2026-06-01',
    date '2027-05-28',
    '10000000-0000-4000-8000-000000000002',
    'synthetic'
  );

-- Seeding runs without an auth.uid(), so the creator trigger does not fire;
-- all assignments are explicit here.
insert into public.engagement_members (engagement_id, user_id, side, role) values
  -- Regional Innovation District: full internal and client team
  ('e0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'internal', 'principal_architect'),
  ('e0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'internal', 'architect'),
  ('e0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'internal', 'researcher'),
  ('e0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'internal', 'project_administrator'),
  ('e0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'internal', 'finance_administrator'),
  ('e0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'client',   'executive_sponsor'),
  ('e0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'client',   'client_project_lead'),
  ('e0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'client',   'client_finance'),
  ('e0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'client',   'client_contributor'),
  ('e0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 'client',   'client_viewer'),
  -- Workforce Capability Program: small team, sponsor only on the client side
  ('e0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'internal', 'principal_architect'),
  ('e0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', 'internal', 'project_administrator'),
  ('e0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'client',   'executive_sponsor'),
  -- Community Expansion Architecture
  ('e0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'internal', 'principal_architect'),
  ('e0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'internal', 'architect'),
  ('e0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'client',   'executive_sponsor'),
  ('e0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'client',   'client_project_lead'),
  ('e0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000005', 'client',   'client_viewer'),
  -- The multi-organization advisor, on one engagement in each organization
  ('e0000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'client',   'client_contributor'),
  ('e0000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 'client',   'client_project_lead');

-- A capability override: Meridian's Project Lead has no financial visibility
-- by default; the sponsor authorized it for the Innovation District only.
insert into public.engagement_member_capability_overrides (engagement_member_id, capability, granted, reason)
select em.id, 'view_financials', true, 'Authorized by the Executive Sponsor'
from public.engagement_members em
where em.engagement_id = 'e0000000-0000-4000-8000-000000000001'
  and em.user_id = '20000000-0000-4000-8000-000000000002';

-- -----------------------------------------------------------------------------
-- Method/IP (internal only; exists to prove client isolation)
-- -----------------------------------------------------------------------------
-- Described as they existed before Phase 6, through the same conversion the
-- Phase 6 backfill uses: legacy assets, no inferred form, the original
-- version text kept as the legacy version's label (D28).
select private.insert_legacy_method_asset(
  'Capability Readiness Diagnostic', 'diagnostic_framework', 'capability', 'DAM 1.0', 'active',
  'Structured diagnostic for assessing capability readiness across leadership, talent and operating infrastructure.',
  '10000000-0000-4000-8000-000000000002'
);
select private.insert_legacy_method_asset(
  'Strategic Model Library Index', 'strategic_model', 'strategic_model', 'DAM 1.0', 'draft',
  'Index of strategic models with applicability conditions and known failure modes.',
  '10000000-0000-4000-8000-000000000002'
);

-- -----------------------------------------------------------------------------
-- Phase 2: commercial engagement
--
-- Money moves only through the finance operations, exactly as in the app, so
-- the seed exercises the same rules. Each operation runs as the person who
-- would perform it. Dates are relative to today so that "past due" and
-- "not yet due" stay meaningful whenever the seed is loaded.
--
-- Meridian, Regional Innovation District (USD):
--   contract 150,000 + CO-1 12,000 (approved in the portal) = 162,000
--   CO-2 8,500 submitted, awaiting the sponsor
--   invoice 1  30,000  deposit            paid in full
--   invoice 2  30,000  diagnostic          credit note 2,000; 18,000 applied; 10,000 past due
--   invoice 3  57,000  capability + CO-1   7,000 applied; 50,000 not yet due; payment link
--   payment 3  5,000 received unapplied; 1,000 refunded; 4,000 credit on account
--   a draft invoice for the strategic model milestone (internal only)
-- Harbor: executed contract with an externally approved change order.
-- Meridian Workforce: a draft contract (internal only).
-- -----------------------------------------------------------------------------
create function pg_temp.act_as(user_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, false);
$$;

-- Meridian, Regional Innovation District -------------------------------------
insert into public.contracts (
  id, engagement_id, title, currency, original_value_minor, payment_structure, payment_terms_days,
  deposit_minor, effective_date, start_date, end_date, notes, created_by
) values (
  'c0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'Development Architecture Intensive: Regional Innovation District',
  'USD', 15000000, 'milestone', 30, 3000000,
  current_date - 120, current_date - 118, current_date + 120,
  'Signed by the Authority''s Executive Director.',
  '10000000-0000-4000-8000-000000000002'
);

insert into public.payment_milestones (
  id, contract_id, sequence, title, description, amount_minor, due_date, trigger_type, stage_label, status
) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 1,
   'Deposit on signing', 'Due on execution of the agreement.', 3000000, current_date - 80, 'on_signing',
   null, 'ready_to_invoice'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 2,
   'Diagnostic completion', 'Knowledge and capability diagnostic delivered.', 3000000, current_date - 30, 'on_event',
   'Knowledge Architecture', 'ready_to_invoice'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 3,
   'Capability architecture', 'Capability architecture presented to the steering group.', 4500000, current_date + 20, 'on_event',
   'Capability Architecture', 'ready_to_invoice'),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 4,
   'Strategic model', 'Strategic model architecture accepted.', 3000000, current_date + 60, 'on_date',
   'Strategic Model Architecture', 'planned'),
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 5,
   'Final architecture', 'Application architecture and handover.', 1500000, current_date + 110, 'on_date',
   'Application Architecture', 'planned');

insert into public.change_orders (id, contract_id, title, description, scope_impact, schedule_impact, amount_minor) values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Health system stakeholder track',
   'Adds a dedicated stakeholder track for the regional health system.',
   'Four additional working sessions and a health-system capability annex.',
   'No change to the final delivery date.', 1200000),
  ('c1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'Governance charter drafting',
   'Drafting of the district governance charter for board adoption.',
   'Adds charter drafting and two board review cycles.',
   'Extends Strategic Model Architecture by two weeks.', 850000);

insert into public.invoices (id, contract_id, memo) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Deposit due on signing.'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Diagnostic completion milestone.'),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'Capability architecture milestone and change order CO-1.'),
  ('f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Strategic model milestone.');

insert into public.invoice_lines (invoice_id, position, description, amount_minor, payment_milestone_id) values
  ('f0000000-0000-4000-8000-000000000001', 1, 'Deposit on signing', 3000000, 'd0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002', 1, 'Diagnostic completion', 3000000, 'd0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000003', 1, 'Capability architecture', 4500000, 'd0000000-0000-4000-8000-000000000003'),
  ('f0000000-0000-4000-8000-000000000004', 1, 'Strategic model', 3000000, 'd0000000-0000-4000-8000-000000000004');

select pg_temp.act_as('10000000-0000-4000-8000-000000000002');  -- Principal Architect
select public.execute_contract('c0000000-0000-4000-8000-000000000001', current_date - 120, 'Eleanor Vance', 'Executive Director');
select public.set_contract_status('c0000000-0000-4000-8000-000000000001', 'active');
select public.issue_invoice('f0000000-0000-4000-8000-000000000001', current_date - 110, current_date - 80);
select public.submit_change_order('c1000000-0000-4000-8000-000000000001');
select public.issue_invoice('f0000000-0000-4000-8000-000000000002', current_date - 60, current_date - 30);

select pg_temp.act_as('20000000-0000-4000-8000-000000000001');  -- Meridian Executive Sponsor
select public.approve_change_order('c1000000-0000-4000-8000-000000000001');

select pg_temp.act_as('10000000-0000-4000-8000-000000000006');  -- Finance Administrator
insert into public.invoice_lines (invoice_id, position, description, amount_minor, change_order_id) values
  ('f0000000-0000-4000-8000-000000000003', 2, 'CO-1 Health system stakeholder track', 1200000,
   'c1000000-0000-4000-8000-000000000001');
select public.issue_invoice('f0000000-0000-4000-8000-000000000003', current_date - 10);
insert into public.invoice_payment_links (invoice_id, url, provider, provider_reference) values
  ('f0000000-0000-4000-8000-000000000003', 'https://pay.example.com/i/tpl-demo-0003', 'Example Pay', 'demo-0003');

select public.record_payment(
  'c0000000-0000-4000-8000-000000000001', 3000000, current_date - 95, 'wire', 'WIRE-20417',
  'Meridian Regional Development Authority', null, null, null,
  jsonb_build_array(jsonb_build_object('invoice_id', 'f0000000-0000-4000-8000-000000000001', 'amount_minor', 3000000))
);

insert into public.credit_notes (id, invoice_id, amount_minor, reason) values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002', 200000,
   'Two diagnostic interviews were not held; credited by agreement.');
select public.issue_credit_note('f1000000-0000-4000-8000-000000000001', current_date - 40);

-- One wire split across two invoices.
select public.record_payment(
  'c0000000-0000-4000-8000-000000000001', 2500000, current_date - 20, 'ach', 'ACH-88213',
  'Meridian Regional Development Authority', null, null, null,
  jsonb_build_array(
    jsonb_build_object('invoice_id', 'f0000000-0000-4000-8000-000000000002', 'amount_minor', 1800000),
    jsonb_build_object('invoice_id', 'f0000000-0000-4000-8000-000000000003', 'amount_minor', 700000)
  )
);

-- Received before it was needed: held as credit on account, part refunded.
select public.record_payment(
  'c0000000-0000-4000-8000-000000000001', 500000, current_date - 5, 'check', 'Check 10442',
  'Meridian Regional Development Authority'
);
select public.record_refund(
  'c0000000-0000-4000-8000-000000000001', 100000, current_date - 2, 'ach',
  'Duplicate portion of check 10442 returned at the client''s request.',
  (select id from public.payments where reference = 'Check 10442'), 'ACH-R-5510'
);

select public.submit_change_order('c1000000-0000-4000-8000-000000000002');
select public.schedule_invoice('f0000000-0000-4000-8000-000000000004', current_date + 30);

insert into public.finance_notes (engagement_id, entity_type, entity_id, body) values
  ('e0000000-0000-4000-8000-000000000001', 'invoice', 'f0000000-0000-4000-8000-000000000002',
   'Controller confirmed the remaining diagnostic balance goes out with the next ACH run.');

-- Harbor, Community Expansion Architecture -----------------------------------------
insert into public.contracts (
  id, engagement_id, title, currency, original_value_minor, payment_structure, payment_terms_days,
  effective_date, start_date, end_date, created_by
) values (
  'c0000000-0000-4000-8000-000000000002',
  'e0000000-0000-4000-8000-000000000003',
  'Embedded Development Partner: Community Expansion',
  'USD', 8000000, 'installments', 15,
  current_date - 150, current_date - 150, current_date + 240,
  '10000000-0000-4000-8000-000000000002'
);
insert into public.payment_milestones (id, contract_id, sequence, title, amount_minor, due_date, trigger_type, status) values
  ('d0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002', 1,
   'Quarter 1 installment', 2000000, current_date - 20, 'on_date', 'ready_to_invoice'),
  ('d0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002', 2,
   'Quarter 2 installment', 2000000, current_date + 70, 'on_date', 'planned'),
  ('d0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000002', 3,
   'Quarter 3 installment', 2000000, current_date + 160, 'on_date', 'planned'),
  ('d0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000002', 4,
   'Quarter 4 installment', 2000000, current_date + 240, 'on_date', 'planned');
insert into public.change_orders (id, contract_id, title, description, amount_minor) values
  ('c1000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002',
   'Measurement system pilot', 'Adds a pilot of the measurement system in the first new region.', 650000);
insert into public.invoices (id, contract_id, memo) values
  ('f0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002', 'First quarterly installment.');
insert into public.invoice_lines (invoice_id, description, amount_minor, payment_milestone_id) values
  ('f0000000-0000-4000-8000-000000000011', 'Quarter 1 installment', 2000000, 'd0000000-0000-4000-8000-000000000011');

select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
select public.execute_contract('c0000000-0000-4000-8000-000000000002', current_date - 150, 'Richard Amsel', 'President');
select public.issue_invoice('f0000000-0000-4000-8000-000000000011', current_date - 35);
select public.submit_change_order('c1000000-0000-4000-8000-000000000011');
select public.record_external_change_order_approval(
  'c1000000-0000-4000-8000-000000000011', 'Richard Amsel', 'President', current_date - 12,
  'signed_document', null, 'Countersigned change order, email of ' || to_char(current_date - 12, 'YYYY-MM-DD')
);

-- Meridian, Workforce Capability Program: still being drafted ----------------------
insert into public.contracts (
  id, engagement_id, title, currency, original_value_minor, payment_structure, created_by
) values (
  'c0000000-0000-4000-8000-000000000003',
  'e0000000-0000-4000-8000-000000000002',
  'Development Architecture Sprint: Workforce Capability',
  'USD', 4200000, 'milestone',
  '10000000-0000-4000-8000-000000000002'
);


-- -----------------------------------------------------------------------------
-- Phase 3: architecture (Meridian, Regional Innovation District)
--
-- Built through the same writes and operations as the app, as the people who
-- would perform them. 27 core objects across the four domains, reproducing
-- the specification's example chain (Commercial Acquisition requires Property
-- Underwriting, is informed by the Commercial Real Estate Market, is
-- threatened by Capital Availability, is measured by Qualified Acquisitions /
-- Month, is implemented through the Acquisition Team), with:
--   * statements with provenance and evidence (one contradicting source);
--   * assumptions, risks (one spanning two domains), an engagement-wide
--     constraint, a blocking dependency, a decision with options and a
--     recommendation, and a recommendation record;
--   * internal-only content (a competitive factor, a note, a conflict,
--     Method lineage) and a draft that was never published;
--   * baseline 1 (approved externally), later changes, baseline 2;
--   * Commercial Acquisition v2 approved in the portal; the Intended Outcome
--     awaiting the client's response; the decision open for the client.
-- Harbor gets two published elements to prove tenant isolation.
-- -----------------------------------------------------------------------------
create function pg_temp.el(
  p_id uuid, p_kind public.element_kind, p_title text, p_summary text, p_provenance public.provenance_type,
  p_visibility public.client_visibility default 'client',
  p_engagement uuid default 'e0000000-0000-4000-8000-000000000001'
)
returns void
language sql
as $$
  insert into public.architecture_elements (id, engagement_id, kind, title, summary, provenance, client_visibility, owner_user_id)
  values (p_id, p_engagement, p_kind, p_title, p_summary, p_provenance, p_visibility, '10000000-0000-4000-8000-000000000003');
$$;

create function pg_temp.obj(
  p_id uuid, p_type text, p_title text, p_summary text, p_provenance public.provenance_type, p_attributes jsonb,
  p_maturity public.maturity_state default 'undefined', p_rationale text default '',
  p_visibility public.client_visibility default 'client',
  p_engagement uuid default 'e0000000-0000-4000-8000-000000000001'
)
returns void
language sql
as $$
  select pg_temp.el(p_id, 'object', p_title, p_summary, p_provenance, p_visibility, p_engagement);
  insert into public.architecture_objects (element_id, object_type, maturity, maturity_rationale, attributes)
  values (p_id, p_type, p_maturity, p_rationale, '{"schema_version": 1}'::jsonb || p_attributes);
$$;

create function pg_temp.rel(
  p_source uuid, p_type text, p_target uuid, p_visibility public.client_visibility default 'client',
  p_proficiency public.skill_proficiency default null, p_description text default ''
)
returns uuid
language sql
as $$
  insert into public.architecture_relationships (
    engagement_id, source_element_id, target_element_id, relationship_type, required_proficiency,
    description, provenance, client_visibility
  )
  select e.engagement_id, p_source, p_target, p_type, p_proficiency, p_description, 'architect_judgment', p_visibility
  from public.architecture_elements e where e.id = p_source
  returning id;
$$;

create function pg_temp.stmt(
  p_id uuid, p_element uuid, p_kind public.statement_kind, p_body text, p_provenance public.provenance_type,
  p_client_visible boolean default true, p_sort int default 0
)
returns void
language sql
as $$
  insert into public.architecture_statements (id, element_id, statement_kind, body, provenance, client_visible, sort_order)
  values (p_id, p_element, p_kind, p_body, p_provenance, p_client_visible, p_sort);
$$;

create function pg_temp.cite(p_statement uuid, p_source uuid, p_stance public.evidence_stance, p_locator text)
returns void
language sql
as $$
  insert into public.statement_evidence_links (statement_id, evidence_source_id, stance, locator)
  values (p_statement, p_source, p_stance, p_locator);
$$;

select pg_temp.act_as('10000000-0000-4000-8000-000000000003');  -- Architect

-- Evidence sources -------------------------------------------------------------
insert into public.evidence_sources (
  id, engagement_id, title, source_type, provenance, reference, url, publisher_author, source_date,
  accessed_date, summary, ip_classification, client_visibility
) values
  ('b3000000-0000-4000-8000-000000000701', 'e0000000-0000-4000-8000-000000000001',
   'Regional Commercial Real Estate Outlook 2026', 'publication', 'public_source',
   'Regional Commercial Real Estate Outlook 2026, Metro Economic Council, pp. 10-14',
   'https://example.org/metro-cre-outlook-2026', 'Metro Economic Council', date '2026-03-02', date '2026-08-10',
   'Vacancy, absorption and pricing for office and lab space in the region.', 'public_source', 'client'),
  ('b3000000-0000-4000-8000-000000000702', 'e0000000-0000-4000-8000-000000000001',
   'Interview: Authority Chief Financial Officer', 'interview', 'client_source',
   'Interview with the Authority CFO, 14 August 2026', null, 'Meridian Development Authority', date '2026-08-14', null,
   'Capital position, acquisition appetite and board expectations.', 'client_confidential', 'client'),
  ('b3000000-0000-4000-8000-000000000703', 'e0000000-0000-4000-8000-000000000001',
   'University land inventory', 'dataset', 'client_source',
   'Data room: /land/university-parcels-2026.xlsx', null, 'Meridian Development Authority', date '2026-07-30', null,
   'Parcel-level holdings of both universities within the proposed footprint.', 'client_owned_source_material', 'internal'),
  ('b3000000-0000-4000-8000-000000000704', 'e0000000-0000-4000-8000-000000000001',
   'TPLCo site visit notes', 'meeting_notes', 'architect_observation',
   'Site visit, 21 August 2026', null, 'TPLCo', date '2026-08-21', null,
   'Observations from the district walk and the board working session.', 'project_work_product', 'internal');

-- Knowledge Architecture ----------------------------------------------------------
select pg_temp.obj('b3000000-0000-4000-8000-000000000101', 'knowledge_area', 'Commercial Real Estate Market',
  'Supply, demand, pricing and financing conditions for office, lab and flex space in the region.', 'public_source',
  '{"scope_statement": "Office, lab and flex space within 20 miles of the district", "criticality": "foundational"}',
  'defined', 'Market data is current and reconciled with the client''s own view.');
select pg_temp.obj('b3000000-0000-4000-8000-000000000102', 'knowledge_area', 'Regional Innovation Economy',
  'The research, startup and anchor-institution activity the district depends on.', 'architect_judgment',
  '{"scope_statement": "Research output, spinouts and anchor demand in the region", "criticality": "foundational"}',
  'emerging', 'Spinout demand is not yet quantified.');
select pg_temp.obj('b3000000-0000-4000-8000-000000000103', 'concept', 'Anchor Institution',
  'An institution whose presence draws tenants, talent and investment to the district.', 'architect_judgment',
  '{"definition": "A long-lived institution that commits space, programs or demand to the district", "excludes": "Ordinary tenants without a program commitment"}',
  'defined', 'Agreed with the board in the August working session.');
select pg_temp.obj('b3000000-0000-4000-8000-000000000104', 'concept', 'University Anchor',
  'A university acting as an anchor institution through land, research programs or spinouts.', 'architect_judgment',
  '{"definition": "An anchor institution that is a research university", "excludes": "Community colleges and training providers"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000105', 'research_question', 'How much space will university spinouts absorb in five years?',
  'The share of district floor space that spinouts can realistically take up by year five.', 'architect_judgment',
  '{"question": "What floor area will university spinouts absorb in the district within five years?", "why_it_matters": "It sets the scale of the first acquisition phase", "status": "open"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000106', 'knowledge_gap', 'Spinout space demand',
  'Demand for space from university spinouts is not yet known.', 'architect_observation',
  '{"unknown": "Annual spinout formation and space needs", "consequence_if_unresolved": "The first phase may be over- or under-sized", "closure_approach": "Technology transfer office data and founder survey"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000107', 'regulatory_factor', 'Opportunity Zone designation',
  'Part of the district sits in a designated Opportunity Zone, with investment holding-period rules.', 'public_source',
  '{"jurisdiction": "Federal and state", "instrument": "Opportunity Zone program", "obligation": "Qualifying investment and holding periods", "binding": "conditional"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000108', 'competitive_factor', 'Northgate Research Park',
  'An established research park competing for the same lab tenants.', 'architect_observation',
  '{"actor_or_force": "Northgate Research Park", "current_position": "Mature, 85% leased", "implication": "Competes on price for lab space"}',
  'undefined', '', 'internal');
select pg_temp.obj('b3000000-0000-4000-8000-000000000109', 'system_boundary', 'Phase 1 district footprint',
  'What the first phase of the district includes and excludes.', 'architect_judgment',
  '{"inside": "The 42-acre core around the transit station", "outside": "University campuses and the health system main campus", "interfaces": "Shared programs, transit, utilities"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000110', 'stakeholder', 'Regional Health System',
  'The regional health system, a prospective anchor and clinical research partner.', 'client_source',
  '{"stakeholder_kind": "institution", "interest": "Clinical research space near the universities", "influence": "high", "stance": "supportive"}');

-- Capability Architecture -----------------------------------------------------------
select pg_temp.obj('b3000000-0000-4000-8000-000000000201', 'capability', 'Commercial Acquisition',
  'The ability to identify, underwrite, negotiate and close acquisitions of commercial property for the district.',
  'architect_judgment',
  '{"tier": "core", "leadership_capability": false, "current_readiness": "absent", "ownership_model": "internal"}',
  'emerging', 'Defined and agreed; the operating form is still being designed.');
select pg_temp.obj('b3000000-0000-4000-8000-000000000202', 'capability', 'Tenant Partnership Development',
  'The ability to secure anchor and program commitments from institutions and companies.', 'architect_judgment',
  '{"tier": "strategic", "leadership_capability": true, "current_readiness": "partial", "ownership_model": "shared"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000203', 'skill', 'Property Underwriting',
  'Assessing the value, risk and return of a commercial property acquisition.', 'architect_judgment',
  '{"skill_family": "Real estate finance", "baseline_proficiency": "proficient"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000204', 'role', 'Acquisition Director',
  'The position accountable for the district''s acquisition pipeline and closings.', 'architect_judgment',
  '{"purpose": "Lead acquisitions for the district", "sourcing": "external", "leadership_role": true, "indicative_capacity": "1 FTE"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000205', 'capability_gap', 'No in-house acquisition function',
  'The Authority has no team able to acquire commercial property today.', 'architect_observation',
  '{"current_state": "Acquisitions handled ad hoc by the board", "required_state": "A standing acquisition function", "closure_approach": "hire"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000206', 'talent_stage', 'Stage 1: Founding team',
  'The first people brought in: acquisition and partnership leadership.', 'architect_judgment',
  '{"sequence": 1, "trigger_condition": "Board approval of the district charter"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000207', 'talent_stage', 'Stage 2: Operating team',
  'Property management and programs, once the first acquisitions close.', 'architect_judgment',
  '{"sequence": 2, "trigger_condition": "First two acquisitions closed"}',
  'undefined', '', 'internal');

-- Strategic Model Architecture --------------------------------------------------------
select pg_temp.obj('b3000000-0000-4000-8000-000000000301', 'intended_outcome', 'A self-sustaining commercial property portfolio',
  'A district property portfolio whose income funds its programs without annual appropriations.', 'client_source',
  '{"desired_condition": "Portfolio income covers district operations and programs", "horizon": "long", "beneficiary": "The region''s research and startup community"}',
  'defined', 'Confirmed by the Executive Sponsor.');
select pg_temp.obj('b3000000-0000-4000-8000-000000000302', 'strategic_model', 'Anchor-led cluster development',
  'Growth led by anchor institutions whose commitments draw tenants and investment.', 'methodology_derived',
  '{"model_name": "Anchor-led cluster development", "application": "Universities and the health system as anchors", "applicability_limits": "Depends on anchors committing land or space"}',
  'defined', 'Applied and tested against the region''s anchors.');
select pg_temp.obj('b3000000-0000-4000-8000-000000000303', 'structural_leverage', 'University land holdings',
  'Both universities hold land inside the footprint that could be committed on long ground leases.', 'client_source',
  '{"lever": "University-owned parcels", "mechanism": "Long-term ground leases instead of purchase", "expected_effect": "Lower capital need for the first phase"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000304', 'differentiation_logic', 'Clinical-research adjacency',
  'The only district where lab space sits next to both universities and the health system.', 'architect_judgment',
  '{"basis_of_difference": "Adjacency of clinical and academic research", "defensibility": "Hard to replicate location", "conditions_relied_on": "Health system participation"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000305', 'strategic_implication', 'Acquisition must precede tenant recruitment',
  'Anchors will commit only once the district controls the first sites.', 'architect_judgment',
  '{"implication": "Secure sites before the tenant campaign", "horizon": "near"}');

-- Application Architecture --------------------------------------------------------------
select pg_temp.obj('b3000000-0000-4000-8000-000000000401', 'application_format', 'Acquisition Team',
  'A standing team that runs the district''s acquisition pipeline.', 'architect_judgment',
  '{"format_kind": "team", "purpose": "Source, underwrite and close acquisitions", "participants": "Acquisition Director, analyst, counsel", "cadence": "Standing"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000402', 'metric', 'Qualified Acquisitions / Month',
  'Acquisition opportunities that pass underwriting each month.', 'architect_judgment',
  '{"definition": "Opportunities approved by underwriting in the month", "unit": "count", "direction": "increase", "target": "2 per month by month 12", "cadence": "Monthly", "data_source": "Acquisition pipeline"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000403', 'governance_body', 'District Development Board',
  'The board that holds authority over the district''s portfolio and strategy.', 'client_source',
  '{"mandate": "Portfolio, strategy and anchor agreements", "membership": "Authority, universities, health system, city", "cadence": "Monthly", "escalation_route": "Authority board"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000404', 'decision_right', 'Property acquisition approval',
  'Authority over acquisitions above the delegated limit.', 'architect_judgment',
  '{"decision_class": "Acquisitions above $5M", "decides": "District Development Board", "consulted": "Acquisition Director", "veto": "Authority board", "informed": "City"}');
select pg_temp.obj('b3000000-0000-4000-8000-000000000405', 'operating_model', 'District operating model',
  'How the district runs: acquisition, partnerships, property operations and programs.', 'architect_judgment',
  '{"model_form": "Authority-owned district company", "core_flows": "Acquire, lease, program, reinvest", "key_interfaces": "Universities, health system, city"}');

-- Project Intelligence records ---------------------------------------------------------------
select pg_temp.el('b3000000-0000-4000-8000-000000000501', 'risk', 'Capital availability',
  'Acquisition capital may not be available on acceptable terms in the first 18 months.', 'client_source');
insert into public.risks (element_id, category, probability, impact, mitigation, risk_status) values
  ('b3000000-0000-4000-8000-000000000501', 'financial', 4, 5,
   'Ground leases on university land; tenant partnerships that bring capital.', 'mitigating');
insert into public.intelligence_record_domains (element_id, domain) values
  ('b3000000-0000-4000-8000-000000000501', 'capability'),
  ('b3000000-0000-4000-8000-000000000501', 'strategic_model');

select pg_temp.el('b3000000-0000-4000-8000-000000000502', 'risk', 'Leadership succession failure',
  'The district depends on a small founding team; losing one leader would stall acquisitions and partnerships.',
  'architect_judgment');
insert into public.risks (element_id, category, probability, impact, mitigation) values
  ('b3000000-0000-4000-8000-000000000502', 'capability', 2, 4, 'Deputy roles in stage 2; documented pipeline.');
insert into public.intelligence_record_domains (element_id, domain) values
  ('b3000000-0000-4000-8000-000000000502', 'capability'),
  ('b3000000-0000-4000-8000-000000000502', 'application');

select pg_temp.el('b3000000-0000-4000-8000-000000000503', 'assumption', 'Universities will commit land on long ground leases',
  'Both universities will lease parcels to the district for at least 50 years.', 'client_source');
insert into public.assumptions (element_id, category, confidence, validation_status, impact_if_false) values
  ('b3000000-0000-4000-8000-000000000503', 'stakeholder', 'medium', 'validating',
   'The first phase would need purchase capital the Authority does not have.');
insert into public.intelligence_record_domains (element_id, domain) values
  ('b3000000-0000-4000-8000-000000000503', 'strategic_model');

select pg_temp.el('b3000000-0000-4000-8000-000000000504', 'constraint', '36-month launch window',
  'The district must open its first building within 36 months of the charter.', 'client_source');
insert into public.constraints (element_id, category, source, negotiable) values
  ('b3000000-0000-4000-8000-000000000504', 'temporal', 'State economic development grant terms', false);
update public.architecture_elements set engagement_wide = true where id = 'b3000000-0000-4000-8000-000000000504';

select pg_temp.el('b3000000-0000-4000-8000-000000000505', 'dependency', 'Board charter before acquisitions',
  'The Acquisition Team cannot close without the District Development Board''s delegated authority.', 'architect_judgment');
insert into public.dependencies (element_id, from_element_id, to_element_id, dependency_type, blocking) values
  ('b3000000-0000-4000-8000-000000000505', 'b3000000-0000-4000-8000-000000000401',
   'b3000000-0000-4000-8000-000000000403', 'prerequisite', true);

select pg_temp.el('b3000000-0000-4000-8000-000000000506', 'decision', 'Acquisition vehicle',
  'Which entity holds and finances the district''s acquisitions.', 'architect_judgment');
insert into public.decisions (element_id, context, needed_by, downstream_impact, decision_owner_user_id) values
  ('b3000000-0000-4000-8000-000000000506',
   'The vehicle decides who can borrow, who bears risk and how fast the team can close.',
   current_date + 30, 'Sets the Acquisition Team''s authority and the board''s delegation.',
   '20000000-0000-4000-8000-000000000002');
insert into public.decision_options (id, decision_element_id, title, description, tradeoffs, sort_order) values
  ('b3000000-0000-4000-8000-000000000601', 'b3000000-0000-4000-8000-000000000506', 'District-owned LLC',
   'A limited liability company owned by the Authority.', 'Fast to close and ring-fenced; needs its own capital.', 1),
  ('b3000000-0000-4000-8000-000000000602', 'b3000000-0000-4000-8000-000000000506', 'Authority balance sheet',
   'The Authority acquires directly.', 'Cheapest capital; slowest approvals.', 2),
  ('b3000000-0000-4000-8000-000000000603', 'b3000000-0000-4000-8000-000000000506', 'Joint venture with a university',
   'A venture with one university contributing land.', 'Lowest capital; shared control.', 3);
insert into public.intelligence_record_domains (element_id, domain) values
  ('b3000000-0000-4000-8000-000000000506', 'application');
select public.set_decision_recommendation('b3000000-0000-4000-8000-000000000506',
  'b3000000-0000-4000-8000-000000000601', 'Closes fastest while keeping the Authority''s balance sheet separate.');

select pg_temp.el('b3000000-0000-4000-8000-000000000507', 'recommendation', 'Establish the acquisition function first',
  'Hire the Acquisition Director and stand up the team before the tenant campaign.', 'architect_judgment');
insert into public.recommendations (element_id, rationale, priority) values
  ('b3000000-0000-4000-8000-000000000507', 'Anchors will commit only once the district controls sites.', 'critical');
insert into public.intelligence_record_domains (element_id, domain) values
  ('b3000000-0000-4000-8000-000000000507', 'capability');

-- Statements and evidence ---------------------------------------------------------------------
select pg_temp.stmt('b3000000-0000-4000-8000-000000000801', 'b3000000-0000-4000-8000-000000000201', 'finding',
  'The Authority has closed two property acquisitions in ten years, both through outside brokers.', 'client_source', true, 1);
select pg_temp.cite('b3000000-0000-4000-8000-000000000801', 'b3000000-0000-4000-8000-000000000702', 'supports', '00:14:30');
select pg_temp.stmt('b3000000-0000-4000-8000-000000000802', 'b3000000-0000-4000-8000-000000000201', 'rationale',
  'Without a standing acquisition capability the district cannot secure sites ahead of anchor commitments.',
  'architect_judgment', true, 2);
select pg_temp.stmt('b3000000-0000-4000-8000-000000000803', 'b3000000-0000-4000-8000-000000000201', 'note',
  'Two board members prefer to keep acquisitions with the Authority; raise privately before the next session.',
  'architect_observation', false, 3);
select pg_temp.cite('b3000000-0000-4000-8000-000000000803', 'b3000000-0000-4000-8000-000000000704', 'context', 'p. 2');
select pg_temp.stmt('b3000000-0000-4000-8000-000000000804', 'b3000000-0000-4000-8000-000000000101', 'finding',
  'Lab vacancy in the region is under 5%, while office vacancy is 18%.', 'public_source', true, 1);
select pg_temp.cite('b3000000-0000-4000-8000-000000000804', 'b3000000-0000-4000-8000-000000000701', 'supports', 'p. 12, table 3');
select pg_temp.cite('b3000000-0000-4000-8000-000000000804', 'b3000000-0000-4000-8000-000000000702', 'contradicts', '00:31:10');
select pg_temp.stmt('b3000000-0000-4000-8000-000000000805', 'b3000000-0000-4000-8000-000000000303', 'finding',
  'The universities hold 19 of the 42 acres in the Phase 1 footprint.', 'client_source', true, 1);
select pg_temp.cite('b3000000-0000-4000-8000-000000000805', 'b3000000-0000-4000-8000-000000000703', 'supports', 'Sheet "Parcels", rows 2-40');
select pg_temp.stmt('b3000000-0000-4000-8000-000000000806', 'b3000000-0000-4000-8000-000000000301', 'definition',
  'Self-sustaining means portfolio net operating income covers district operations and programs.', 'client_source', true, 1);
select pg_temp.stmt('b3000000-0000-4000-8000-000000000807', 'b3000000-0000-4000-8000-000000000501', 'finding',
  'Lenders quoted acquisition debt at 300 basis points above the Authority''s last issue.', 'client_source', true, 1);
select pg_temp.cite('b3000000-0000-4000-8000-000000000807', 'b3000000-0000-4000-8000-000000000702', 'supports', '00:22:05');
insert into public.element_evidence_links (element_id, evidence_source_id, stance, locator) values
  ('b3000000-0000-4000-8000-000000000101', 'b3000000-0000-4000-8000-000000000701', 'supports', 'Whole report');

-- Method lineage (internal only) ---------------------------------------------------------------
-- Recorded before Phase 6, so it stays legacy_derived_from lineage (D28).
select private.insert_legacy_method_lineage('b3000000-0000-4000-8000-000000000302', id, 'DAM 1.0',
  'Applied from the strategic model library')
from public.method_assets where title = 'Strategic Model Library Index';
select private.insert_legacy_method_lineage('b3000000-0000-4000-8000-000000000201', id, 'DAM 1.0',
  'Readiness assessed with the diagnostic')
from public.method_assets where title = 'Capability Readiness Diagnostic';

-- Relationships ----------------------------------------------------------------------------------
select pg_temp.rel('b3000000-0000-4000-8000-000000000201', 'requires', 'b3000000-0000-4000-8000-000000000203');
select pg_temp.rel('b3000000-0000-4000-8000-000000000101', 'informs', 'b3000000-0000-4000-8000-000000000201');
select pg_temp.rel('b3000000-0000-4000-8000-000000000501', 'threatens', 'b3000000-0000-4000-8000-000000000201');
select pg_temp.rel('b3000000-0000-4000-8000-000000000201', 'measured_by', 'b3000000-0000-4000-8000-000000000402');
select pg_temp.rel('b3000000-0000-4000-8000-000000000201', 'implemented_through', 'b3000000-0000-4000-8000-000000000401');
select pg_temp.rel('b3000000-0000-4000-8000-000000000201', 'serves', 'b3000000-0000-4000-8000-000000000301');
select pg_temp.rel('b3000000-0000-4000-8000-000000000204', 'requires', 'b3000000-0000-4000-8000-000000000203', 'client', 'expert');
select pg_temp.rel('b3000000-0000-4000-8000-000000000201', 'requires', 'b3000000-0000-4000-8000-000000000204');
select pg_temp.rel('b3000000-0000-4000-8000-000000000103', 'part_of', 'b3000000-0000-4000-8000-000000000102');
select pg_temp.rel('b3000000-0000-4000-8000-000000000104', 'specializes', 'b3000000-0000-4000-8000-000000000103');
select pg_temp.rel('b3000000-0000-4000-8000-000000000105', 'investigates', 'b3000000-0000-4000-8000-000000000106');
select pg_temp.rel('b3000000-0000-4000-8000-000000000105', 'investigates', 'b3000000-0000-4000-8000-000000000503');
select pg_temp.rel('b3000000-0000-4000-8000-000000000106', 'gap_in', 'b3000000-0000-4000-8000-000000000102');
select pg_temp.rel('b3000000-0000-4000-8000-000000000205', 'gap_in', 'b3000000-0000-4000-8000-000000000201');
select pg_temp.rel('b3000000-0000-4000-8000-000000000206', 'precedes', 'b3000000-0000-4000-8000-000000000207', 'internal');
select pg_temp.rel('b3000000-0000-4000-8000-000000000206', 'introduces', 'b3000000-0000-4000-8000-000000000204');
select pg_temp.rel('b3000000-0000-4000-8000-000000000302', 'shapes', 'b3000000-0000-4000-8000-000000000201');
select pg_temp.rel('b3000000-0000-4000-8000-000000000302', 'implies', 'b3000000-0000-4000-8000-000000000305');
select pg_temp.rel('b3000000-0000-4000-8000-000000000302', 'exploits', 'b3000000-0000-4000-8000-000000000303');
select pg_temp.rel('b3000000-0000-4000-8000-000000000304', 'positioned_against', 'b3000000-0000-4000-8000-000000000108', 'internal');
select pg_temp.rel('b3000000-0000-4000-8000-000000000304', 'exploits', 'b3000000-0000-4000-8000-000000000303');
select pg_temp.rel('b3000000-0000-4000-8000-000000000401', 'governed_by', 'b3000000-0000-4000-8000-000000000403');
select pg_temp.rel('b3000000-0000-4000-8000-000000000403', 'holds', 'b3000000-0000-4000-8000-000000000404');
select pg_temp.rel('b3000000-0000-4000-8000-000000000401', 'part_of', 'b3000000-0000-4000-8000-000000000405');
select pg_temp.rel('b3000000-0000-4000-8000-000000000204', 'accountable_for', 'b3000000-0000-4000-8000-000000000401');
select pg_temp.rel('b3000000-0000-4000-8000-000000000405', 'subject_to', 'b3000000-0000-4000-8000-000000000107');
select pg_temp.rel('b3000000-0000-4000-8000-000000000405', 'bounded_by', 'b3000000-0000-4000-8000-000000000109');
select pg_temp.rel('b3000000-0000-4000-8000-000000000110', 'has_stake_in', 'b3000000-0000-4000-8000-000000000301');
select pg_temp.rel('b3000000-0000-4000-8000-000000000502', 'threatens', 'b3000000-0000-4000-8000-000000000204');
select pg_temp.rel('b3000000-0000-4000-8000-000000000503', 'underpins', 'b3000000-0000-4000-8000-000000000302');
select pg_temp.rel('b3000000-0000-4000-8000-000000000504', 'constrains', 'b3000000-0000-4000-8000-000000000506');
select pg_temp.rel('b3000000-0000-4000-8000-000000000506', 'affects', 'b3000000-0000-4000-8000-000000000401');
select pg_temp.rel('b3000000-0000-4000-8000-000000000507', 'addresses', 'b3000000-0000-4000-8000-000000000205');
select pg_temp.rel('b3000000-0000-4000-8000-000000000202', 'mitigates', 'b3000000-0000-4000-8000-000000000501');
select pg_temp.rel('b3000000-0000-4000-8000-000000000404', 'conflicts_with', 'b3000000-0000-4000-8000-000000000403', 'internal',
  null, 'The $5M delegation limit contradicts the board''s mandate to approve every acquisition.');

-- The anchor-led model as a Method Library Model (Phase 6, D19) ------------------------------------
-- Methodology-derived content must record the Model it instantiates before it is
-- published. The Architect authors the Model; the Principal Architect publishes it.
create temporary table seed_model (asset_id uuid, version_id uuid) on commit drop;
insert into seed_model (asset_id)
select public.create_method_asset('anchor-led-cluster-development-model', 'Anchor-led cluster development model',
  'model', 'strategic_models');
update seed_model set version_id = (select id from public.method_asset_versions v where v.asset_id = seed_model.asset_id);
select public.update_method_asset_version(version_id, jsonb_build_object(
  'architectural_question', 'How can anchor institutions organize the growth of a development district?',
  'summary', 'Growth led by anchor institutions whose commitments of land, space and demand draw tenants and investment.',
  'applicability', 'Districts with one or more institutions able to commit land, space or procurement over a long horizon.',
  'exclusions', 'Districts without an anchor willing to make binding commitments.',
  'identity_disclosure', 'may_be_named',
  'disclosable_name', 'Anchor-led cluster development',
  'change_summary', 'First published version.'))
from seed_model;
select public.set_method_version_domains(version_id, array['strategic_model']::public.architecture_domain[]) from seed_model;
select public.set_method_version_outputs(version_id,
  '[{"output_kind": "object", "object_type_key": "strategic_model", "note": "The applied model"}]'::jsonb)
from seed_model;
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');  -- Principal Architect (publish_methodology)
select public.publish_method_asset_version(version_id, '1.0') from seed_model;
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');  -- Architect
select public.record_method_lineage('b3000000-0000-4000-8000-000000000302', version_id, 'instantiates',
  'Applied from the anchor-led cluster development model.')
from seed_model;

-- Publish everything except the stage 2 draft --------------------------------------------------
select public.publish_element_version(id, 'First published version')
from public.architecture_elements
where engagement_id = 'e0000000-0000-4000-8000-000000000001'
  and id <> 'b3000000-0000-4000-8000-000000000207'
order by reference_code;

-- Domain states (Principal Architect) -------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
select public.record_domain_assessment('e0000000-0000-4000-8000-000000000001', 'knowledge', 'defined',
  'Market and regulatory knowledge is documented and evidenced; spinout demand remains a known gap.');
select public.record_domain_assessment('e0000000-0000-4000-8000-000000000001', 'capability', 'emerging',
  'Core capabilities are named and the acquisition gap is clear; roles and sequencing are still being designed.');
select public.record_domain_assessment('e0000000-0000-4000-8000-000000000001', 'strategic_model', 'defined',
  'The anchor-led model is applied and its assumptions are stated.');
select public.record_domain_assessment('e0000000-0000-4000-8000-000000000001', 'application', 'emerging',
  'The acquisition team and board are defined; the operating model is an outline.');

-- Baseline 1, approved outside the portal ----------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');
insert into public.architecture_baselines (id, engagement_id, label, description) values
  ('b3000000-0000-4000-8000-000000000901', 'e0000000-0000-4000-8000-000000000001',
   'Executive Architecture v1', 'The architecture presented at the September board session.');
insert into public.architecture_baseline_items (baseline_id, element_id, element_version_id)
select 'b3000000-0000-4000-8000-000000000901', id, latest_version_id
from public.architecture_elements
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and latest_version_id is not null;
select public.freeze_baseline('b3000000-0000-4000-8000-000000000901');
select public.record_external_architecture_approval(
  null, 'b3000000-0000-4000-8000-000000000901', 'approved', 'Eleanor Vance', 'Executive Director',
  current_date - 10, 'signed_document', 'Signed board resolution 2026-14');

-- Changes after baseline 1 -----------------------------------------------------------------------------
update public.architecture_objects
set maturity = 'defined', maturity_rationale = 'Operating form, role and metric are now defined and linked.'
where element_id = 'b3000000-0000-4000-8000-000000000201';
select pg_temp.stmt('b3000000-0000-4000-8000-000000000808', 'b3000000-0000-4000-8000-000000000201', 'implication',
  'The Acquisition Director must be in post before the first site option expires.', 'architect_judgment', true, 4);
select public.publish_element_version('b3000000-0000-4000-8000-000000000201',
  'Maturity raised to Defined; implication on the Acquisition Director''s start date added.');
select pg_temp.obj('b3000000-0000-4000-8000-000000000406', 'workflow', 'Site acquisition workflow',
  'From site identification to closing.', 'architect_judgment',
  '{"trigger": "A qualifying site is identified", "stages_summary": "Screen, underwrite, board approval, close", "outputs": "Closed acquisition"}');
select pg_temp.rel('b3000000-0000-4000-8000-000000000406', 'part_of', 'b3000000-0000-4000-8000-000000000405');
select pg_temp.rel('b3000000-0000-4000-8000-000000000201', 'implemented_through', 'b3000000-0000-4000-8000-000000000406');
select public.publish_element_version('b3000000-0000-4000-8000-000000000406', 'First published version');
select public.retire_relationship(r.id, 'Differentiation rests on adjacency, not land holdings.')
from public.architecture_relationships r
where r.source_element_id = 'b3000000-0000-4000-8000-000000000304' and r.relationship_type = 'exploits';

select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
select public.record_domain_assessment('e0000000-0000-4000-8000-000000000001', 'capability', 'defined',
  'The acquisition capability, its role, skill, metric and operating form are defined and linked.');

-- Approvals: v2 of Commercial Acquisition approved in the portal; the
-- Intended Outcome awaiting the client.
select public.request_architecture_approval(latest_version_id, null, 'Please confirm the acquisition capability.')
from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000201';
select public.request_architecture_approval(latest_version_id, null, 'Please confirm the intended outcome.')
from public.architecture_elements where id = 'b3000000-0000-4000-8000-000000000301';
select pg_temp.act_as('20000000-0000-4000-8000-000000000001');  -- Meridian Executive Sponsor
select public.respond_to_architecture_approval(a.id, 'approved', 'Agreed at the board session.')
from public.architecture_approvals a
join public.architecture_elements e on e.latest_version_id = a.element_version_id
where e.id = 'b3000000-0000-4000-8000-000000000201';

-- Baseline 2 ---------------------------------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');
insert into public.architecture_baselines (id, engagement_id, label, description) values
  ('b3000000-0000-4000-8000-000000000902', 'e0000000-0000-4000-8000-000000000001',
   'Executive Architecture v2', 'After the acquisition capability was defined.');
insert into public.architecture_baseline_items (baseline_id, element_id, element_version_id)
select 'b3000000-0000-4000-8000-000000000902', id, latest_version_id
from public.architecture_elements
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and latest_version_id is not null;
select public.freeze_baseline('b3000000-0000-4000-8000-000000000902');

-- Harbor: two published elements (tenant isolation) --------------------------------------------------
select pg_temp.obj('b3000000-0000-4000-8000-000000000a01', 'governance_body', 'Regional Expansion Council',
  'The council that approves entry into each new service region.', 'client_source',
  '{"mandate": "Approve new regions", "membership": "Foundation trustees and regional partners", "cadence": "Quarterly"}',
  'undefined', '', 'client', 'e0000000-0000-4000-8000-000000000003');
select pg_temp.obj('b3000000-0000-4000-8000-000000000a02', 'knowledge_area', 'Regional service demand',
  'Demand for the Foundation''s programs in the three candidate regions.', 'client_source',
  '{"criticality": "foundational"}', 'undefined', '', 'client', 'e0000000-0000-4000-8000-000000000003');
select public.publish_element_version('b3000000-0000-4000-8000-000000000a01', 'First published version');
select public.publish_element_version('b3000000-0000-4000-8000-000000000a02', 'First published version');

-- -----------------------------------------------------------------------------
-- Phase 4: Project Intelligence (Meridian, Regional Innovation District)
--
-- Through the same operations as the app, as the people who would perform
-- them:
--   * two opportunities (one client-visible and published, with its window
--     closing within 30 days; one internal whose window has closed);
--   * triage on most records (one critical, one past its review date);
--   * status history: a risk re-scored, an assumption's confidence raised,
--     and a new risk resolved as closed with a rationale;
--   * a Principal-level escalation and a client-executive escalation (which
--     sends an executive-attention request to the Executive Sponsor);
--   * client requests in each state: open, open and overdue, responded,
--     closed (recorded as evidence) and withdrawn;
--   * client input: one received, one acknowledged;
--   * areas: the Client Contributor has the Capability domain; the
--     multi-organization advisor (a Contributor at Meridian) has the
--     district operating model and everything under it;
--   * a dismissed signal.
-- -----------------------------------------------------------------------------
create function pg_temp.member(p_user uuid, p_engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language sql
as $$
  select id from public.engagement_members where engagement_id = p_engagement and user_id = p_user;
$$;

-- Areas (Principal Architect) -------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
select public.assign_member_area(pg_temp.member('20000000-0000-4000-8000-000000000004'), 'capability', null);
select public.assign_member_area(pg_temp.member('40000000-0000-4000-8000-000000000001'), null,
  'b3000000-0000-4000-8000-000000000405');

-- Opportunities, triage and history (Architect) ------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');

select pg_temp.el('b6000000-0000-4000-8000-000000000001', 'opportunity', 'University research park partnership',
  'The state university is choosing a development partner for its research park; the district could be that partner.',
  'client_source');
insert into public.opportunities (element_id, category, value, feasibility, window_opens_on, window_closes_on,
                                  pursuit_approach, opportunity_status) values
  ('b6000000-0000-4000-8000-000000000001', 'partnership', 5, 3, current_date - 20, current_date + 21,
   'Submit a joint proposal with the university''s real estate office before its partner selection closes.',
   'evaluating');
insert into public.intelligence_record_domains (element_id, domain) values
  ('b6000000-0000-4000-8000-000000000001', 'strategic_model');
select pg_temp.rel('b6000000-0000-4000-8000-000000000001', 'advances', 'b3000000-0000-4000-8000-000000000301');
select pg_temp.rel('b3000000-0000-4000-8000-000000000201', 'pursues', 'b6000000-0000-4000-8000-000000000001');
select pg_temp.rel('b3000000-0000-4000-8000-000000000503', 'underpins', 'b6000000-0000-4000-8000-000000000001');

select pg_temp.el('b6000000-0000-4000-8000-000000000002', 'opportunity', 'State innovation grant round',
  'A state grant for innovation districts that could have funded the first acquisition.', 'public_source', 'internal');
insert into public.opportunities (element_id, category, value, feasibility, window_opens_on, window_closes_on,
                                  pursuit_approach, opportunity_status) values
  ('b6000000-0000-4000-8000-000000000002', 'funding', 4, 4, current_date - 60, current_date - 5,
   'Apply with the Authority as lead applicant.', 'identified');
insert into public.intelligence_record_domains (element_id, domain) values
  ('b6000000-0000-4000-8000-000000000002', 'capability');

select public.publish_element_version('b6000000-0000-4000-8000-000000000001', 'First published version');

-- History: a risk re-scored and an assumption's confidence raised.
update public.risks set probability = 3 where element_id = 'b3000000-0000-4000-8000-000000000501';
update public.assumptions set confidence = 'high' where element_id = 'b3000000-0000-4000-8000-000000000503';

-- A risk identified and later closed.
select pg_temp.el('b6000000-0000-4000-8000-000000000003', 'risk', 'Tenant demand softens',
  'Lab demand could fall if federal research funding is cut.', 'architect_judgment');
insert into public.risks (element_id, category, probability, impact, mitigation) values
  ('b6000000-0000-4000-8000-000000000003', 'external', 2, 3, 'Diversify toward clinical and health-system tenants.');
insert into public.intelligence_record_domains (element_id, domain) values
  ('b6000000-0000-4000-8000-000000000003', 'strategic_model');
select public.resolve_intelligence_record('b6000000-0000-4000-8000-000000000003', 'closed',
  'Both universities renewed their five-year federal research awards.');

select public.triage_intelligence_record('b3000000-0000-4000-8000-000000000501', 'critical', current_date + 14,
  'Capital terms decide whether the first acquisition closes this year.');
select public.triage_intelligence_record('b3000000-0000-4000-8000-000000000502', 'high', current_date + 10);
select public.triage_intelligence_record('b3000000-0000-4000-8000-000000000503', 'high', current_date + 7);
select public.triage_intelligence_record('b3000000-0000-4000-8000-000000000506', 'routine', current_date + 20);
select public.triage_intelligence_record('b6000000-0000-4000-8000-000000000001', 'high', current_date + 7);
select public.triage_intelligence_record('b6000000-0000-4000-8000-000000000003', 'watch', null);
-- The dependency's review date has passed (the seed writes the date directly).
select public.triage_intelligence_record('b3000000-0000-4000-8000-000000000505', 'high', current_date);
update public.intelligence_stewardship set next_review_on = current_date - 3
where element_id = 'b3000000-0000-4000-8000-000000000505';

-- Escalations --------------------------------------------------------------------------------------
select public.escalate_intelligence_record('b3000000-0000-4000-8000-000000000501', 'principal_architect',
  'Capital terms may not close before the first site option expires; needs a Principal decision on bridge financing.');

select pg_temp.act_as('10000000-0000-4000-8000-000000000002');  -- Principal Architect
select public.escalate_intelligence_record('b3000000-0000-4000-8000-000000000502', 'client_executive',
  'The district depends on two founding leaders. We ask the Executive Director to confirm a deputy for each before stage 2.',
  pg_temp.member('20000000-0000-4000-8000-000000000001'), current_date + 14);

-- Client requests (Architect) ------------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');
-- Open, to the Client Project Lead.
select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question',
  'Who signs acquisition agreements today?',
  'Please tell us who has authority to sign a purchase agreement for the Authority today, and under what limit.',
  pg_temp.member('20000000-0000-4000-8000-000000000002'), current_date + 10,
  array['b3000000-0000-4000-8000-000000000404']::uuid[]);
-- Open and overdue, to the Client Contributor (the due date is moved into the past directly).
select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'information_request',
  'Acquisition history since 2016',
  'Please share the closing documents, or a summary, for the Authority''s two acquisitions since 2016.',
  pg_temp.member('20000000-0000-4000-8000-000000000004'), current_date + 1,
  array['b3000000-0000-4000-8000-000000000201']::uuid[]);
update public.client_actions set due_on = current_date - 2
where engagement_id = 'e0000000-0000-4000-8000-000000000001' and title = 'Acquisition history since 2016';
-- Responded, from the Client Contributor.
select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'confirmation',
  'Confirm the underwriting skill level',
  'We describe Property Underwriting as an expert-level skill for the Acquisition Director. Is that right for your market?',
  pg_temp.member('20000000-0000-4000-8000-000000000004'), current_date + 14,
  array['b3000000-0000-4000-8000-000000000203']::uuid[]);
-- Closed and recorded as evidence, from the Executive Sponsor.
select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'question',
  'Board appetite for a district LLC',
  'Would the board support holding acquisitions in a district-owned LLC?',
  pg_temp.member('20000000-0000-4000-8000-000000000001'), current_date + 5,
  array['b3000000-0000-4000-8000-000000000506']::uuid[]);
-- Withdrawn.
select public.send_client_action('e0000000-0000-4000-8000-000000000001', 'review_request',
  'Review the capability map',
  'Please review the published capability map before the September session.',
  pg_temp.member('20000000-0000-4000-8000-000000000002'), current_date + 7,
  array['b3000000-0000-4000-8000-000000000201', 'b3000000-0000-4000-8000-000000000202']::uuid[]);
select public.withdraw_client_action(id, 'Covered in the board session instead.')
from public.client_actions where engagement_id = 'e0000000-0000-4000-8000-000000000001' and title = 'Review the capability map';

select pg_temp.act_as('20000000-0000-4000-8000-000000000004');  -- Client Contributor
select public.respond_to_client_action(id,
  'Yes. Both of our past acquisitions needed outside underwriters; the Director must be able to do this in-house.')
from public.client_actions where engagement_id = 'e0000000-0000-4000-8000-000000000001'
  and title = 'Confirm the underwriting skill level';
select public.submit_client_contribution('b3000000-0000-4000-8000-000000000202',
  'The health system has told us it would co-invest in a clinical research building if it can choose the site.');
select public.submit_client_contribution('b3000000-0000-4000-8000-000000000201',
  'We have a third acquisition in negotiation that may close before the Director is hired.');

select pg_temp.act_as('20000000-0000-4000-8000-000000000001');  -- Executive Sponsor
select public.respond_to_client_action(id,
  'Yes, provided the Authority keeps a majority of the LLC''s board seats.',
  'https://meridian.example/board/minutes/2026-08')
from public.client_actions where engagement_id = 'e0000000-0000-4000-8000-000000000001'
  and title = 'Board appetite for a district LLC';

select pg_temp.act_as('10000000-0000-4000-8000-000000000003');  -- Architect
select public.record_response_as_evidence(r.id, null, null)
from public.client_action_responses r
join public.client_actions a on a.id = r.action_id
where a.title = 'Board appetite for a district LLC';
select public.close_client_action(id, 'Recorded as evidence for the acquisition vehicle decision.')
from public.client_actions where engagement_id = 'e0000000-0000-4000-8000-000000000001'
  and title = 'Board appetite for a district LLC';
select public.handle_client_contribution(id, 'acknowledged',
  'Thank you. We will reflect this in the next revision of the acquisition capability.')
from public.client_contributions where element_id = 'b3000000-0000-4000-8000-000000000201';

-- A signal the Architect has dismissed: the blocking dependency on the
-- board charter is tracked through the governance design.
select public.dismiss_intelligence_signal('e0000000-0000-4000-8000-000000000001', 'dependency_blocking_unsatisfied',
  'b3000000-0000-4000-8000-000000000505', null, 'open',
  'The charter vote is scheduled; the governance design tracks it.', current_date + 30);

-- Phase 5: Reviews, Deliverables and Implementation (proposal §19) ------------------------------
-- Seeded on Community Expansion Architecture (e...003), not the Regional
-- Innovation District (e...001): the pgTAP suite (16_reviews, 17_deliverables,
-- 18_implementation, 19_implementation_validation, 99_implementation_concurrency)
-- asserts exact per-engagement reference codes (REV-001, DLV-001, IMP-001...)
-- and exact register counts against e...001, so any Phase 5 fixture placed
-- there breaks that suite. e...003 already has two published core objects
-- and its own internal/client team, and no pgTAP test touches it.
--
-- create_review / create_deliverable / create_implementation_initiative
-- generate their own ids, so new elements are looked up afterward by title
-- within the engagement, matching the pattern already used above for
-- client_actions.

-- Review 1: a held, published Executive Review that examines the Regional
-- Expansion Council directly and the "validated" initiative below, with
-- participants and a client-visible finding.
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');  -- Principal Architect (manage_reviews)
select public.create_review('e0000000-0000-4000-8000-000000000003', 'executive_review',
  'Expansion Readiness Review', current_timestamp - interval '9 days', null,
  'Board-level review of the Foundation''s readiness to enter new service regions.');

update public.architecture_elements set client_visibility = 'client'
where engagement_id = 'e0000000-0000-4000-8000-000000000003' and kind = 'review' and title = 'Expansion Readiness Review';

select public.add_review_participant(e.id, pg_temp.member('10000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003'), 'organizer')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'review' and e.title = 'Expansion Readiness Review';
select public.add_review_participant(e.id, pg_temp.member('10000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003'), 'presenter')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'review' and e.title = 'Expansion Readiness Review';
select public.add_review_participant(e.id, pg_temp.member('30000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003'), 'reviewer')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'review' and e.title = 'Expansion Readiness Review';
select public.add_review_participant(e.id, pg_temp.member('30000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003'), 'attendee')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'review' and e.title = 'Expansion Readiness Review';

-- Deliverable 1: an approved Executive Strategy Deck documenting the
-- council and the demand research.
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');  -- Principal Architect (manage_deliverables)
select public.create_deliverable('e0000000-0000-4000-8000-000000000003', 'executive_strategy_deck',
  'Community Expansion: Executive Strategy Deck', null, false,
  'The board-facing summary of the expansion architecture and its implementation path.');

update public.architecture_elements set client_visibility = 'client'
where engagement_id = 'e0000000-0000-4000-8000-000000000003' and kind = 'deliverable'
  and title = 'Community Expansion: Executive Strategy Deck';

select pg_temp.rel(e.id, 'documents', 'b3000000-0000-4000-8000-000000000a01')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'deliverable'
  and e.title = 'Community Expansion: Executive Strategy Deck';
select pg_temp.rel(e.id, 'documents', 'b3000000-0000-4000-8000-000000000a02')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'deliverable'
  and e.title = 'Community Expansion: Executive Strategy Deck';

select pg_temp.act_as('10000000-0000-4000-8000-000000000003');  -- Architect
select public.publish_element_version(e.id, 'First published version')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'deliverable'
  and e.title = 'Community Expansion: Executive Strategy Deck';

select public.request_architecture_approval(e.latest_version_id, null, 'Please approve the executive strategy deck.')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'deliverable'
  and e.title = 'Community Expansion: Executive Strategy Deck';
select pg_temp.act_as('30000000-0000-4000-8000-000000000001');  -- Community Expansion Executive Sponsor
select public.respond_to_architecture_approval(a.id, 'approved', 'Approved for circulation to the full board.')
from public.architecture_approvals a
join public.architecture_elements e on e.latest_version_id = a.element_version_id
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'deliverable'
  and e.title = 'Community Expansion: Executive Strategy Deck';

-- Initiative 1: "operational", implementing the Regional Expansion Council,
-- with a design_approved and an agreement_executed checkpoint, both
-- achieved (the second client-visible).
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');  -- Architect (manage_implementation)
select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000003',
  'Expansion Council stand-up', array['b3000000-0000-4000-8000-000000000a01']::uuid[],
  'governance', current_date + 20, pg_temp.member('10000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003'),
  'Standing up the Regional Expansion Council: charter approved and the first region agreement executed.');

update public.architecture_elements set client_visibility = 'client'
where engagement_id = 'e0000000-0000-4000-8000-000000000003' and kind = 'implementation_initiative'
  and title = 'Expansion Council stand-up';

select public.publish_element_version(e.id, 'First published version')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Expansion Council stand-up';

-- Published immediately: the client-facing snapshot must show "operational",
-- not the pre-publication "not_started" the first published version froze.
select public.update_implementation_status(e.id, 'operational', null, true,
  'Operational: the Regional Expansion Council has stood up.')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Expansion Council stand-up';

select public.add_implementation_checkpoint(e.id, 'design_approved', 'Council charter approved',
  current_date - 30, null, null, false)
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Expansion Council stand-up';
select public.record_checkpoint_achieved(c.id, current_date - 28, null)
from public.implementation_checkpoints c
join public.architecture_elements e on e.id = c.implementation_element_id
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Expansion Council stand-up' and c.checkpoint_type = 'design_approved';

select public.add_implementation_checkpoint(e.id, 'agreement_executed', 'First region entry agreement executed',
  current_date - 5, null, null, true)
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Expansion Council stand-up';
select public.record_checkpoint_achieved(c.id, current_date - 5, null)
from public.implementation_checkpoints c
join public.architecture_elements e on e.id = c.implementation_element_id
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Expansion Council stand-up' and c.checkpoint_type = 'agreement_executed';

-- Initiative 2: "validated", implementing the regional service demand
-- research, examined directly by Review 1 and validated through
-- record_review_validation, exercising the full gate (examines -> held ->
-- validates -> resolve) end to end.
select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000003',
  'Regional demand study rollout', array['b3000000-0000-4000-8000-000000000a02']::uuid[],
  'other', current_date - 15, pg_temp.member('10000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003'),
  'Commissioning and completing the regional service demand study for the candidate regions.');

update public.architecture_elements set client_visibility = 'client'
where engagement_id = 'e0000000-0000-4000-8000-000000000003' and kind = 'implementation_initiative'
  and title = 'Regional demand study rollout';

select public.publish_element_version(e.id, 'First published version')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Regional demand study rollout';

-- Review 1's agenda is recorded before it is held: from Phase 7A a held
-- Review's examined set is closed (OD-7), and hold_review captures the exact
-- version of each examined element (Q29). The held_at is backdated as the
-- team recorded it; the capture uses system time.
select pg_temp.rel(e.id, 'examines', 'b3000000-0000-4000-8000-000000000a01')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'review' and e.title = 'Expansion Readiness Review';

select pg_temp.rel(rev.id, 'examines', init.id)
from public.architecture_elements rev, public.architecture_elements init
where rev.engagement_id = 'e0000000-0000-4000-8000-000000000003' and rev.kind = 'review' and rev.title = 'Expansion Readiness Review'
  and init.engagement_id = 'e0000000-0000-4000-8000-000000000003' and init.kind = 'implementation_initiative'
  and init.title = 'Regional demand study rollout';

select pg_temp.act_as('10000000-0000-4000-8000-000000000002');  -- Principal Architect (manage_reviews)
select public.hold_review(e.id, current_timestamp - interval '9 days',
  'The board affirmed the governance council and the region team''s readiness to proceed.')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'review' and e.title = 'Expansion Readiness Review';

select pg_temp.stmt(gen_random_uuid(), e.id, 'finding',
  'The Regional Expansion Council and its supporting demand research are both ready for the first new region.',
  'architect_judgment', true, 0)
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'review' and e.title = 'Expansion Readiness Review';

select pg_temp.act_as('10000000-0000-4000-8000-000000000003');  -- Architect (edit_architecture, publish_architecture)
select public.publish_element_version(e.id, 'First published version')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'review' and e.title = 'Expansion Readiness Review';

select public.record_review_validation(rev.id, init.id)
from public.architecture_elements rev, public.architecture_elements init
where rev.engagement_id = 'e0000000-0000-4000-8000-000000000003' and rev.kind = 'review' and rev.title = 'Expansion Readiness Review'
  and init.engagement_id = 'e0000000-0000-4000-8000-000000000003' and init.kind = 'implementation_initiative'
  and init.title = 'Regional demand study rollout';

-- Published immediately: the client-facing snapshot must show "validated",
-- not the pre-publication "not_started" the first published version froze.
select public.resolve_implementation_initiative(e.id, 'validated',
  'Validated at the Expansion Readiness Review: the study is complete and its findings are in use.',
  true, 'Validated: the regional demand study is complete and in use.')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Regional demand study rollout';

-- Initiative 3: escalated and stalled, implementing the Regional Expansion
-- Council.
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');  -- Architect (manage_implementation, edit_architecture)
select public.create_implementation_initiative('e0000000-0000-4000-8000-000000000003',
  'Third-region governance ratification', array['b3000000-0000-4000-8000-000000000a01']::uuid[],
  'governance', current_date + 45, pg_temp.member('10000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003'),
  'Ratifying the council''s authority to approve the third candidate region.');

select public.publish_element_version(e.id, 'First published version')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Third-region governance ratification';

select public.update_implementation_status(e.id, 'stalled',
  'The ratification vote has been postponed twice; the council has not scheduled a new date.')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Third-region governance ratification';

select public.triage_implementation(e.id, 'critical', current_date + 7,
  'No new hearing date; the third region''s timeline depends on this ratification.')
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Third-region governance ratification';

select public.escalate_implementation(e.id, 'principal_architect',
  'The ratification vote has stalled twice; recommend raising it directly with the council chair.',
  null, current_date + 10)
from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Third-region governance ratification';


-- -----------------------------------------------------------------------------
-- Phase 6: Method Library demo (clearly fictional content, seed only; §32)
--
-- Through the same operations as the app, as the people who would perform
-- them: four Development Contexts; the legacy Capability Readiness Diagnostic
-- adopted as a Method (1.0 and 1.1 published, 1.2 drafted from what Harbor
-- learned); an Instrument, a Standard and a Template; DAM 1.1 published and a
-- DAM 1.2 draft; a completed Diagnostic application on Harbor and one in
-- progress on Meridian; two agreed acceptance criteria on a Harbor
-- initiative, one informed by the Standard. No new elements are created.
-- -----------------------------------------------------------------------------
create temporary table demo (key text primary key, id uuid) on commit drop;
create function pg_temp.d(p_key text) returns uuid language sql as $$ select id from demo where key = p_key; $$;

-- Contexts (Principal Architect: publish_methodology) ----------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
insert into demo values
  ('ctx_college', public.create_development_context('institutional_capability', 'Institutional capability development (college)',
    'Building a durable organizational capability inside an institution such as a college.')),
  ('ctx_cluster', public.create_development_context('regional_industry_cluster', 'Regional industry cluster development',
    'Growing a regional concentration of related firms, institutions and talent around shared advantages.')),
  ('ctx_district', public.create_development_context('real_estate_district', 'Real-estate district development',
    'Planning and delivering a mixed-use district through land, capital and phased development.')),
  ('ctx_community', public.create_development_context('community_service', 'Community service development',
    'Extending a community organization''s services into new places or populations.'));

-- The Diagnostic: adopt the legacy asset as a Method --------------------------------------------------
insert into demo values ('diag', (select id from public.method_assets where key = 'capability-readiness-diagnostic'));
insert into demo values ('diag_v1', public.adopt_legacy_method_asset(pg_temp.d('diag'), 'method', 'diagnostic_frameworks'));

-- The Architect authors (author_methodology) --------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');
select public.update_method_asset_version(pg_temp.d('diag_v1'), jsonb_build_object(
  'architectural_question', 'Which capabilities are ready to carry the strategy, and which are not?',
  'summary', 'A structured diagnosis of capability readiness across people, process, resources and governance.',
  'applicability', 'Engagements where a strategy depends on organizational capabilities whose readiness is unknown.',
  'exclusions', 'Pure market or land studies with no organizational capability in question.',
  'expected_inputs', 'The capability set in scope, leadership access and existing self-assessments.',
  'evidence_expectations', 'Leadership interviews and a document review for each capability in scope.',
  'practitioner_roles', 'Lead architect; one interviewer per three capabilities.',
  'completion_criteria', 'Every in-scope capability has a dated readiness judgement with cited evidence.',
  'practitioner_instructions', 'Work capability by capability. Record adaptations; never score a capability without evidence.',
  'modes', jsonb_build_array('discover', 'assess'),
  'identity_disclosure', 'may_be_named',
  'disclosable_name', 'Capability Readiness Diagnostic™',
  'change_summary', 'Adopted from the pre-Phase 6 library as a Method.'));
select public.set_method_version_domains(pg_temp.d('diag_v1'), array['capability']::public.architecture_domain[]);
select public.set_method_version_contexts(pg_temp.d('diag_v1'), array[pg_temp.d('ctx_college'), pg_temp.d('ctx_community')]);
select public.set_method_version_stages(pg_temp.d('diag_v1'), '[
  {"key": "frame", "title": "Frame the capabilities", "purpose": "Agree which capabilities are in scope and why.", "guidance": "One working session with the sponsor."},
  {"key": "interview", "title": "Interview leadership", "purpose": "Hear how each capability actually works today.", "guidance": "Individual interviews using the interview guide."},
  {"key": "review", "title": "Review the record", "purpose": "Test what was heard against documents and data.", "guidance": "Cite every document relied on."},
  {"key": "judge", "title": "Judge readiness", "purpose": "Reach a dated readiness judgement per capability.", "guidance": "Use the readiness scale; state the evidence."}
]'::jsonb);
select public.set_method_version_outputs(pg_temp.d('diag_v1'),
  '[{"output_kind": "object", "object_type_key": "capability_gap"}, {"output_kind": "recommendation"}, {"output_kind": "risk"}]'::jsonb);

-- Instrument, Standard and Template (Architect) ------------------------------------------------------
insert into demo values ('guide', public.create_method_asset('leadership-capability-interview-guide',
  'Leadership Capability Interview Guide', 'instrument', 'question_libraries'));
insert into demo select 'guide_v1', id from public.method_asset_versions where asset_id = pg_temp.d('guide');
select public.update_method_asset_version(pg_temp.d('guide_v1'), jsonb_build_object(
  'architectural_question', 'How does this capability work today, in the words of those who lead it?',
  'summary', 'Twelve questions for a leader responsible for one capability.',
  'applicability', 'Leadership interviews within a capability readiness diagnosis.',
  'exclusions', 'Frontline staff surveys.',
  'practitioner_instructions', 'Ask every question; record answers verbatim where possible; cite the interview as evidence.',
  'change_summary', 'First published version.'));
select public.set_method_version_domains(pg_temp.d('guide_v1'), array['capability']::public.architecture_domain[]);
select public.set_instrument_version_evidence_types(pg_temp.d('guide_v1'), array['interview']::public.evidence_source_type[]);

insert into demo values ('scale', public.create_method_asset('capability-readiness-scale',
  'Capability Readiness Scale', 'standard', 'measurement_frameworks'));
insert into demo select 'scale_v1', id from public.method_asset_versions where asset_id = pg_temp.d('scale');
select public.update_method_asset_version(pg_temp.d('scale_v1'), jsonb_build_object(
  'architectural_question', 'Is this capability ready to carry what the strategy asks of it?',
  'summary', 'Five criteria a capability is judged against. The Standard is never itself a verdict.',
  'applicability', 'Readiness judgements, reviews and implementation acceptance.',
  'exclusions', 'Individual performance appraisal.',
  'change_summary', 'First published version.'));
select public.set_method_version_domains(pg_temp.d('scale_v1'), array['capability']::public.architecture_domain[]);
select public.set_standard_version_criteria(pg_temp.d('scale_v1'), '[
  {"key": "accountable_owner", "statement": "The capability has a named, accountable owner.", "guidance": "", "scale": ""},
  {"key": "documented_process", "statement": "Its core process is documented and followed.", "guidance": "", "scale": ""},
  {"key": "resourced", "statement": "It is resourced for the demand the strategy places on it.", "guidance": "", "scale": ""},
  {"key": "governed", "statement": "Decisions about it are made in a governed forum.", "guidance": "", "scale": ""},
  {"key": "measured", "statement": "Its performance is measured and reviewed.", "guidance": "", "scale": ""}
]'::jsonb);
select public.set_standard_version_judged_in(pg_temp.d('scale_v1'), array['review', 'completion', 'assessment']);

insert into demo values ('map', public.create_method_asset('capability-map-template',
  'Capability Map', 'template', 'templates'));
insert into demo select 'map_v1', id from public.method_asset_versions where asset_id = pg_temp.d('map');
select public.update_method_asset_version(pg_temp.d('map_v1'), jsonb_build_object(
  'architectural_question', 'What capabilities does the organization have, and how ready is each?',
  'summary', 'A one-page capability map with a readiness band per capability.',
  'applicability', 'Capability map deliverables.',
  'exclusions', 'Detailed process maps.',
  'change_summary', 'First published version.'));
select public.set_method_version_domains(pg_temp.d('map_v1'), array['capability']::public.architecture_domain[]);
select public.set_template_version_spec(pg_temp.d('map_v1'), 'capability_map', '[
  {"key": "map", "title": "Capability map", "guidance": "Capabilities grouped by value stream."},
  {"key": "readiness", "title": "Readiness bands", "guidance": "One band per capability, with the date judged."}
]'::jsonb);

-- Publication (Principal Architect) -----------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
select public.publish_method_asset_version(pg_temp.d('guide_v1'), '1.0');
select public.publish_method_asset_version(pg_temp.d('scale_v1'), '1.0');
select public.publish_method_asset_version(pg_temp.d('map_v1'), '1.0');
-- The Diagnostic uses the published guide and scale (Architect).
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');
select public.set_method_version_components(pg_temp.d('diag_v1'), jsonb_build_array(
  jsonb_build_object('component_version_id', pg_temp.d('guide_v1'), 'note', 'For stage 2 interviews'),
  jsonb_build_object('component_version_id', pg_temp.d('scale_v1'), 'note', 'For stage 4 judgements')));
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
select public.publish_method_asset_version(pg_temp.d('diag_v1'), '1.0');

-- Diagnostic 1.1 (Architect drafts; Principal publishes) ------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');
insert into demo values ('diag_v2', public.create_method_asset_version(pg_temp.d('diag')));
select public.update_method_asset_version(pg_temp.d('diag_v2'), jsonb_build_object(
  'change_summary', 'Stage 3 now requires a document review for every capability, not a sample.'));
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
select public.publish_method_asset_version(pg_temp.d('diag_v2'), '1.1');

-- DAM 1.1 (published) -----------------------------------------------------------------------------------
insert into demo values ('dam11', public.create_dam_release('1.1', 'Development Architecture Method™ 1.1',
  'Adds the Capability Readiness Diagnostic as a Method, its interview guide and readiness scale, the capability map template and the anchor-led cluster model.'));
select public.set_dam_release_member(pg_temp.d('dam11'), v) from (values
  (pg_temp.d('diag_v2')), (pg_temp.d('guide_v1')), (pg_temp.d('scale_v1')), (pg_temp.d('map_v1')),
  ((select current_version_id from public.method_assets where key = 'anchor-led-cluster-development-model'))) as m(v);
select public.publish_dam_release(pg_temp.d('dam11'), 'The first release with governed forms.', current_date);

-- Engagements: release and contexts --------------------------------------------------------------------
select public.set_engagement_dam_release('e0000000-0000-4000-8000-000000000003', pg_temp.d('dam11'),
  'Harbor adopts DAM 1.1 for the readiness diagnosis.');
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');
select public.set_engagement_development_contexts('e0000000-0000-4000-8000-000000000001',
  array[pg_temp.d('ctx_district'), pg_temp.d('ctx_cluster')], pg_temp.d('ctx_district'));
select public.set_engagement_development_contexts('e0000000-0000-4000-8000-000000000003',
  array[pg_temp.d('ctx_community')], pg_temp.d('ctx_community'));

-- Harbor: a completed Diagnostic application (Architect) --------------------------------------------------
insert into demo values ('mus_harbor', public.start_method_application('e0000000-0000-4000-8000-000000000003',
  pg_temp.d('diag_v2'), 'Readiness of the regional expansion capabilities',
  'The board asked whether the council and the demand research can carry a third region.',
  'Can the expansion council and the demand research carry a third region?'));
select public.set_method_application_domains(pg_temp.d('mus_harbor'), array['capability', 'knowledge']::public.architecture_domain[]);
select public.begin_method_application(pg_temp.d('mus_harbor'));
select public.set_method_application_asset(pg_temp.d('mus_harbor'), pg_temp.d('guide_v1'));
select public.set_method_application_asset(pg_temp.d('mus_harbor'), pg_temp.d('scale_v1'));
select public.set_method_application_stage_note(pg_temp.d('mus_harbor'), s.id,
  case when s.key = 'interview' then 'adapted' else 'followed' end::public.method_stage_treatment,
  case when s.key = 'interview' then 'Council members were interviewed together; individual sessions could not be scheduled.' end,
  '')
from public.method_version_stages s where s.version_id = pg_temp.d('diag_v2');
select public.link_method_application_element(pg_temp.d('mus_harbor'), 'b3000000-0000-4000-8000-000000000a01', 'examined', 'The council as it operates today.');
select public.link_method_application_element(pg_temp.d('mus_harbor'), 'b3000000-0000-4000-8000-000000000a02', 'examined', 'Demand research to date.');
select public.link_method_application_element(pg_temp.d('mus_harbor'), e.id, 'informed', 'Readiness findings went to the review.')
from public.architecture_elements e where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'review';
select public.complete_method_application(pg_temp.d('mus_harbor'),
  'Both capabilities judged ready for a third region, with the council''s authority still to be ratified.',
  'The group interview worked for a small council; the guide should allow it.');

-- Diagnostic 1.2 draft, learning from Harbor; DAM 1.2 draft ----------------------------------------------
insert into demo values ('diag_v3', public.create_method_asset_version(pg_temp.d('diag')));
select public.update_method_asset_version(pg_temp.d('diag_v3'), jsonb_build_object(
  'change_summary', 'Stage 2 allows group interviews for small leadership teams.'));
select public.add_method_version_learning_source(pg_temp.d('diag_v3'), pg_temp.d('mus_harbor'),
  'Harbor interviewed its council together without loss of candor.');
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
insert into demo values ('dam12', public.create_dam_release('1.2', 'Development Architecture Method™ 1.2',
  'In preparation.'));

-- Meridian: a Diagnostic application in progress (Architect), outside its DAM 1.0 release --------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');
insert into demo values ('mus_meridian', public.start_method_application('e0000000-0000-4000-8000-000000000001',
  pg_temp.d('diag_v2'), 'Readiness of the district operating capabilities',
  'The district plan assumes operating capabilities no one has yet assessed.',
  'Which district operating capabilities are ready for the first phase?',
  'Meridian remains on DAM 1.0; the Diagnostic first appears in 1.1.'));
select public.set_method_application_domains(pg_temp.d('mus_meridian'), array['capability']::public.architecture_domain[]);
select public.begin_method_application(pg_temp.d('mus_meridian'));
select public.link_method_application_element(pg_temp.d('mus_meridian'), 'b3000000-0000-4000-8000-000000000201', 'examined', '');

-- Harbor: two agreed acceptance criteria on the council stand-up -------------------------------------------
insert into demo select 'imp_harbor', e.id from public.architecture_elements e
where e.engagement_id = 'e0000000-0000-4000-8000-000000000003' and e.kind = 'implementation_initiative'
  and e.title = 'Expansion Council stand-up';
insert into demo values
  ('acr1', public.propose_acceptance_criterion(pg_temp.d('imp_harbor'),
    'The Expansion Council has a named, accountable chair and has met twice with quorum.',
    pg_temp.d('scale_v1'), 'accountable_owner')),
  ('acr2', public.propose_acceptance_criterion(pg_temp.d('imp_harbor'),
    'The council''s charter is signed by all three participating counties.'));
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');
select public.agree_acceptance_criterion(pg_temp.d('acr1'), 'Harbor Executive Sponsor', current_date - 7);
select public.agree_acceptance_criterion(pg_temp.d('acr2'), 'Harbor Executive Sponsor', current_date - 7);

-- -----------------------------------------------------------------------------
-- Phase 7A: the Development Edge demo (proposal §25.1)
--
-- Through real operations only, after everything above, so the Edge shows
-- one triggering change as one event:
--   1. Harbor: a substantive revision of the Regional Expansion Council
--      (summary and a statement) after the Expansion Readiness Review was
--      held; two initiatives implement it and the strategy deck documents it.
--   2. Harbor: a substantive revision of Regional service demand after the
--      demand study was validated.
--   3. Harbor: a decision on the council's membership, decided after the
--      council's latest version.
--   4. Harbor: a second Review, scheduled within the 14-day horizon, that
--      examines the council and its stand-up initiative.
--   5. Meridian: a substantive revision of the Acquisition Director, which
--      Commercial Acquisition requires.
-- The Meridian assumption on university land already carries attention high
-- (Phase 4 triage), which shows the D-35 merge.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');  -- Architect

-- 1. The council's membership widens.
update public.architecture_elements
set summary = 'The council that approves entry into each new service region, with district partners as voting members.'
where id = 'b3000000-0000-4000-8000-000000000a01';
select pg_temp.stmt('b3000000-0000-4000-8000-000000000a20', 'b3000000-0000-4000-8000-000000000a01', 'definition',
  'District partner organizations hold two voting seats alongside the Foundation''s trustees.', 'architect_judgment',
  true, 1);
select public.publish_element_version('b3000000-0000-4000-8000-000000000a01',
  'Membership extended to district partners.');

-- 2. The demand picture sharpens after the study was validated.
update public.architecture_elements
set summary = 'Demand for the Foundation''s programs in the three candidate regions, led by early-years services.'
where id = 'b3000000-0000-4000-8000-000000000a02';
select public.publish_element_version('b3000000-0000-4000-8000-000000000a02',
  'Early-years services identified as the leading demand.');

-- 3. A decision on seat allocation, decided after the council's revision.
select pg_temp.el('b3000000-0000-4000-8000-000000000a10', 'decision', 'Partner seat allocation',
  'How district partner seats on the council are allocated.', 'architect_judgment', 'client',
  'e0000000-0000-4000-8000-000000000003');
insert into public.decisions (element_id, context, needed_by, downstream_impact, decision_owner_user_id) values
  ('b3000000-0000-4000-8000-000000000a10',
   'The council''s widened membership needs a rule for which partners hold its two seats.',
   current_date + 10, 'Sets who votes on regional entry.', '30000000-0000-4000-8000-000000000001');
insert into public.decision_options (id, decision_element_id, title, description, tradeoffs, sort_order) values
  ('b3000000-0000-4000-8000-000000000a11', 'b3000000-0000-4000-8000-000000000a10', 'Rotating seats',
   'Partners rotate annually.', 'Broad voice; less continuity.', 1),
  ('b3000000-0000-4000-8000-000000000a12', 'b3000000-0000-4000-8000-000000000a10', 'Elected seats',
   'Partners elect two representatives.', 'Continuity; more process.', 2);
select pg_temp.rel('b3000000-0000-4000-8000-000000000a10', 'affects', 'b3000000-0000-4000-8000-000000000a01');
select public.publish_element_version('b3000000-0000-4000-8000-000000000a10', 'First published version');
select pg_temp.act_as('30000000-0000-4000-8000-000000000001');  -- Harbor sponsor decides in the portal
select public.decide_decision('b3000000-0000-4000-8000-000000000a10', 'b3000000-0000-4000-8000-000000000a11',
  'Rotating seats keep every district partner involved.');
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');  -- Principal Architect

-- 4. A second Review within the horizon, examining the council and its stand-up.
select public.create_review('e0000000-0000-4000-8000-000000000003', 'architecture_review',
  'Council Membership Review', current_timestamp + interval '7 days', null,
  'Architecture review of the council''s widened membership before the next regional entry.');
select pg_temp.rel(rev.id, 'examines', t.id, 'internal')
from public.architecture_elements rev, public.architecture_elements t
where rev.engagement_id = 'e0000000-0000-4000-8000-000000000003' and rev.kind = 'review'
  and rev.title = 'Council Membership Review'
  and t.engagement_id = 'e0000000-0000-4000-8000-000000000003'
  and (t.id = 'b3000000-0000-4000-8000-000000000a01'
       or (t.kind = 'implementation_initiative' and t.title = 'Expansion Council stand-up'));

-- 5. Meridian: the Acquisition Director's role is redefined.
select pg_temp.act_as('10000000-0000-4000-8000-000000000003');  -- Architect
update public.architecture_elements
set summary = 'Leads the acquisition team and holds delegated authority to commit to site options.'
where id = 'b3000000-0000-4000-8000-000000000204';
select public.publish_element_version('b3000000-0000-4000-8000-000000000204',
  'Delegated authority to commit to site options added.');

-- -----------------------------------------------------------------------------
-- Phase 7B.1: external processing authorizations (ADR-0061). Meridian and
-- Harbor are authorized for synthetic evaluation only, for every class, by
-- the Principal Architect: Meridian carries the Architecture Core seed and
-- Harbor the only Reviews and Implementation Initiatives. Meridian
-- Workforce stays unauthorized, so the refusal path has seed coverage.
-- -----------------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-4000-8000-000000000002');  -- Principal Architect
select public.set_engagement_ai_authorization(e, 'authorized',
  array['published_architecture', 'working_architecture', 'project_intelligence', 'evidence_metadata'],
  'openai', 'us', 'synthetic_evaluation', 'Seed evaluation: synthetic engagement',
  'All engagement data is made up; authorized for the 7B.1 evaluation harness only.', 25, current_date)
from unnest(array['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003']::uuid[]) e;

select set_config('request.jwt.claims', '', false);
