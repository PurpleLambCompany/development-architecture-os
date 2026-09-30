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
-- Engagements
-- -----------------------------------------------------------------------------
insert into public.engagements (
  id, client_organization_id, title, slug, engagement_type, objective, description,
  status, current_phase, start_date, target_end_date, created_by
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
    '10000000-0000-4000-8000-000000000002'
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
    '10000000-0000-4000-8000-000000000002'
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
    '10000000-0000-4000-8000-000000000002'
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
insert into public.method_assets (title, category, methodology_domain, version, status, description, owner_user_id) values
  (
    'Capability Readiness Diagnostic',
    'diagnostic_framework',
    'capability',
    'DAM 1.0',
    'active',
    'Structured diagnostic for assessing capability readiness across leadership, talent and operating infrastructure.',
    '10000000-0000-4000-8000-000000000002'
  ),
  (
    'Strategic Model Library Index',
    'strategic_model',
    'strategic_model',
    'DAM 1.0',
    'draft',
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

select set_config('request.jwt.claims', '', false);
