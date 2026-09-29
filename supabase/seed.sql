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
