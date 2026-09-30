-- =============================================================================
-- DSA OS — Phase 2: Commercial Engagement System
--
-- Contracts, change orders, payment milestones, invoices (with lines), credit
-- notes, payments, payment allocations and refunds, with audit events, RLS and
-- the transactional operations that move money.
--
-- Design (docs/product/PHASE_2_PROPOSAL.md, ADR-0010..0012):
--   * Money is bigint minor units plus a currency; one currency per contract.
--   * Price (contracts, change orders), billing (milestones, invoices, credit
--     notes) and cash (payments, allocations, refunds) are separate.
--   * Issued / decided / completed records are never edited or deleted; a
--     correction is a new record (credit note, reversal, void with reason,
--     reversing change order).
--   * Payment, overdue and balance states are derived, never stored.
--   * Every child record belongs to the same contract, engagement and
--     currency, enforced with composite foreign keys.
--   * Payments, allocations, refunds and every status change are written only
--     by the SECURITY DEFINER operations below. Each one locks the contract
--     row first, so money operations on one contract are serialized, and a
--     deferred integrity check re-verifies every invariant at commit.
--   * Financial reads use view_financials; writes use manage_financials.
--     Neither grants any access to engagement or project content.
--   * Business dates (issue, due, overdue, invoice year) are supplied by the
--     server in BUSINESS_TIME_ZONE; the database never assumes a zone.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Capabilities
-- -----------------------------------------------------------------------------

create or replace function public.capability_side(capability public.engagement_capability)
returns public.member_side
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when capability in ('pay_invoices', 'approve_change_orders') then 'client'::public.member_side
    when capability = 'manage_financials' then 'internal'::public.member_side
    else null
  end;
$$;

create or replace function public.is_financial_capability(capability public.engagement_capability)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select capability in ('view_financials', 'pay_invoices', 'approve_change_orders', 'manage_financials');
$$;

insert into public.role_capability_defaults (role, capability) values
  ('system_administrator',  'manage_financials'),
  ('principal_architect',   'manage_financials'),
  ('finance_administrator', 'manage_financials');

-- Portfolio financial authority: System Administrators, Principal Architects
-- and Finance Administrators hold view_financials and manage_financials on
-- every engagement without assignment. This never grants engagement or
-- project content (can_access_engagement is unchanged).
create or replace function private.has_portfolio_financial_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_internal_role(
    array['system_administrator', 'principal_architect', 'finance_administrator']::public.app_role[]
  );
$$;

create or replace function private.has_engagement_capability(
  target_engagement_id uuid,
  target_capability public.engagement_capability
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.engagement_members em
    join public.engagements e on e.id = em.engagement_id
    where em.engagement_id = target_engagement_id
      and em.user_id = auth.uid()
      and em.status = 'active'
      and (
        (em.side = 'internal' and private.is_internal())
        or (em.side = 'client' and private.is_active_org_member(e.client_organization_id))
      )
      and private.member_has_capability(em.id, target_capability)
  )
  or (
    target_capability in ('view_financials', 'manage_financials')
    and private.has_portfolio_financial_access()
    and exists (select 1 from public.engagements where id = target_engagement_id)
  );
$$;

create function private.can_manage_engagement_financials(target_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_engagement_capability(target_engagement_id, 'manage_financials');
$$;

-- Client-side authority: a capability that also requires financial visibility.
create function private.has_client_financial_capability(
  target_engagement_id uuid,
  target_capability public.engagement_capability
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.is_internal()
    and private.has_engagement_capability(target_engagement_id, 'view_financials')
    and private.has_engagement_capability(target_engagement_id, target_capability);
$$;

create function private.is_executive_financial_authority()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_internal_role(array['system_administrator', 'principal_architect']::public.app_role[]);
$$;

revoke all on function private.can_manage_engagement_financials(uuid) from public, anon;
revoke all on function private.has_client_financial_capability(uuid, public.engagement_capability) from public, anon;
revoke all on function private.is_executive_financial_authority() from public, anon;
grant execute on function private.can_manage_engagement_financials(uuid) to authenticated;
grant execute on function private.has_client_financial_capability(uuid, public.engagement_capability) to authenticated;
grant execute on function private.is_executive_financial_authority() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------
create type public.contract_status as enum (
  'draft', 'executed', 'active', 'completed', 'terminated', 'superseded', 'void'
);
create type public.payment_structure as enum (
  'milestone', 'installments', 'percentage', 'retainer', 'custom'
);
create type public.change_order_status as enum ('draft', 'submitted', 'approved', 'rejected', 'void');
create type public.approval_source as enum ('client_portal', 'external_recorded_by_tplco');
create type public.external_approval_method as enum ('signed_document', 'email', 'letter', 'other');
create type public.milestone_trigger as enum ('on_signing', 'on_date', 'on_event', 'manual');
create type public.milestone_status as enum ('planned', 'ready_to_invoice', 'invoiced', 'cancelled');
create type public.invoice_status as enum ('draft', 'scheduled', 'issued', 'void');
create type public.credit_note_status as enum ('draft', 'issued', 'void');
create type public.payment_method as enum ('ach', 'wire', 'check', 'card_via_processor', 'other');
create type public.payment_status as enum ('recorded', 'reversed');
create type public.refund_status as enum ('completed', 'void');

-- -----------------------------------------------------------------------------
-- 3. Reference data and helpers
-- -----------------------------------------------------------------------------
create table public.currencies (
  code                 char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name                 text not null,
  minor_unit_exponent  smallint not null check (minor_unit_exponent between 0 and 4),
  enabled              boolean not null default false
);

insert into public.currencies (code, name, minor_unit_exponent, enabled) values
  ('USD', 'US dollar', 2, true),
  ('CAD', 'Canadian dollar', 2, false),
  ('EUR', 'Euro', 2, false),
  ('GBP', 'Pound sterling', 2, false);

-- Per-series, per-year document number counters. Incremented inside the
-- issuing transaction (not a sequence), so an aborted issuance does not
-- consume a number. Gaps are tolerated if they ever arise; numbers are
-- never reused.
create table public.document_number_counters (
  series      text not null check (series in ('invoice', 'credit_note')),
  year        int not null check (year between 2000 and 2999),
  last_value  int not null default 0 check (last_value >= 0),
  primary key (series, year)
);

-- Free-text payment references must never carry card or account numbers.
create function private.looks_like_account_number(value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text;
  run text;
  total int;
  d int;
  i int;
  len int;
begin
  if value is null then
    return false;
  end if;
  -- Any run of 12+ digits (spaces and dashes ignored inside the run).
  for run in
    select m[1] from regexp_matches(value, '([0-9][0-9 -]{10,}[0-9])', 'g') as m
  loop
    digits := regexp_replace(run, '[^0-9]', '', 'g');
    len := length(digits);
    if len >= 12 then
      return true;
    end if;
  end loop;
  -- Luhn-valid 13–19 digit numbers anywhere after removing separators.
  digits := regexp_replace(value, '[^0-9]', '', 'g');
  len := length(digits);
  if len between 13 and 19 then
    total := 0;
    for i in 0 .. len - 1 loop
      d := substr(digits, len - i, 1)::int;
      if i % 2 = 1 then
        d := d * 2;
        if d > 9 then d := d - 9; end if;
      end if;
      total := total + d;
    end loop;
    if total % 10 = 0 then
      return true;
    end if;
  end if;
  return false;
end;
$$;

create function private.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

-- Marks the current transaction as running inside a finance operation, so
-- guard triggers can tell an operation's status change from a direct edit.
create function private.begin_finance_operation()
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.finance_operation', 'on', true);
$$;

-- Cleared at the end of every operation, so the mark never outlives the
-- operation that set it, even when several run in one transaction.
create function private.end_finance_operation()
returns void
language sql
set search_path = ''
as $$
  select set_config('dsa.finance_operation', '', true);
$$;

create function private.in_finance_operation()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('dsa.finance_operation', true), '') = 'on';
$$;

revoke all on function private.looks_like_account_number(text) from public, anon;
revoke all on function private.try_uuid(text) from public, anon;
revoke all on function private.begin_finance_operation() from public, anon, authenticated;
revoke all on function private.end_finance_operation() from public, anon, authenticated;
revoke all on function private.in_finance_operation() from public, anon;
grant execute on function private.looks_like_account_number(text) to authenticated;
grant execute on function private.try_uuid(text) to authenticated;
grant execute on function private.in_finance_operation() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Tables
-- -----------------------------------------------------------------------------

-- Contracts: the price as signed. ------------------------------------------------
create table public.contracts (
  id                      uuid primary key default gen_random_uuid(),
  engagement_id           uuid not null references public.engagements (id) on delete restrict,
  title                   text not null check (char_length(title) between 1 and 200),
  currency                char(3) not null references public.currencies (code),
  original_value_minor    bigint not null check (original_value_minor >= 0),
  status                  public.contract_status not null default 'draft',
  payment_structure       public.payment_structure not null default 'milestone',
  payment_terms_days      int not null default 30 check (payment_terms_days between 0 and 180),
  deposit_minor           bigint check (deposit_minor >= 0),
  effective_date          date,
  start_date              date,
  end_date                date,
  executed_on             date,
  client_signatory_name   text check (char_length(client_signatory_name) <= 200),
  client_signatory_title  text check (char_length(client_signatory_title) <= 200),
  approved_by             uuid references public.profiles (id) on delete set null,
  approved_at             timestamptz,
  document_path           text check (char_length(document_path) <= 500),
  supersedes_contract_id  uuid references public.contracts (id) on delete restrict,
  notes                   text not null default '' check (char_length(notes) <= 2000),
  created_by              uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint contracts_dates check (end_date is null or start_date is null or end_date >= start_date),
  constraint contracts_executed_fields check (
    status in ('draft', 'void')
    or (executed_on is not null and client_signatory_name is not null and approved_by is not null)
  ),
  -- Targets for composite foreign keys: children share contract, engagement and currency.
  constraint contracts_context_key unique (id, engagement_id, currency)
);
create unique index contracts_one_current_per_engagement
  on public.contracts (engagement_id) where status in ('executed', 'active');
create index contracts_engagement_idx on public.contracts (engagement_id);

-- Change orders: agreed changes to price. ------------------------------------------
create table public.change_orders (
  id                        uuid primary key default gen_random_uuid(),
  contract_id               uuid not null,
  engagement_id             uuid not null,
  currency                  char(3) not null,
  number                    int check (number > 0),
  title                     text not null check (char_length(title) between 1 and 200),
  description               text not null default '' check (char_length(description) <= 5000),
  scope_impact              text not null default '' check (char_length(scope_impact) <= 5000),
  schedule_impact           text not null default '' check (char_length(schedule_impact) <= 5000),
  amount_minor              bigint not null check (amount_minor <> 0),
  status                    public.change_order_status not null default 'draft',
  submitted_at              timestamptz,
  submitted_by              uuid references public.profiles (id) on delete set null,
  decided_at                timestamptz,
  decision_note             text check (char_length(decision_note) <= 1000),
  approval_source           public.approval_source,
  approved_by_user_id       uuid references public.profiles (id) on delete set null,
  external_approver_name    text check (char_length(external_approver_name) <= 200),
  external_approver_title   text check (char_length(external_approver_title) <= 200),
  external_approved_on      date,
  external_approval_method  public.external_approval_method,
  evidence_path             text check (char_length(evidence_path) <= 500),
  evidence_reference        text check (char_length(evidence_reference) <= 500),
  recorded_by               uuid references public.profiles (id) on delete set null,
  recorded_at               timestamptz,
  created_by                uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint change_orders_contract_fk foreign key (contract_id, engagement_id, currency)
    references public.contracts (id, engagement_id, currency) on update cascade on delete restrict,
  constraint change_orders_number_unique unique (contract_id, number),
  constraint change_orders_context_key unique (id, contract_id),
  constraint change_orders_approval_shape check (
    (status <> 'approved' and approval_source is null)
    or (
      status = 'approved' and approval_source = 'client_portal'
      and approved_by_user_id is not null
      and external_approver_name is null and external_approved_on is null
      and external_approval_method is null and recorded_by is null
    )
    or (
      status = 'approved' and approval_source = 'external_recorded_by_tplco'
      and approved_by_user_id is null
      and external_approver_name is not null and external_approved_on is not null
      and external_approval_method is not null and recorded_by is not null and recorded_at is not null
      and (evidence_path is not null or evidence_reference is not null)
    )
  ),
  constraint change_orders_submitted_numbered check (status = 'draft' or number is not null),
  constraint change_orders_decision_note check (
    status not in ('rejected', 'void') or coalesce(char_length(decision_note), 0) > 0
  )
);
create index change_orders_engagement_idx on public.change_orders (engagement_id);

create table public.change_order_events (
  id                           uuid primary key default gen_random_uuid(),
  change_order_id              uuid not null references public.change_orders (id) on delete cascade,
  engagement_id                uuid not null references public.engagements (id) on delete cascade,
  from_status                  public.change_order_status,
  to_status                    public.change_order_status not null,
  actor_id                     uuid references public.profiles (id) on delete set null,
  actor_side                   public.member_side,
  approval_source              public.approval_source,
  note                         text,
  contract_value_before_minor  bigint,
  contract_value_after_minor   bigint,
  occurred_at                  timestamptz not null default now()
);
create index change_order_events_co_idx on public.change_order_events (change_order_id);

-- Payment milestones: the billing plan. ---------------------------------------------
create table public.payment_milestones (
  id             uuid primary key default gen_random_uuid(),
  contract_id    uuid not null,
  engagement_id  uuid not null,
  currency       char(3) not null,
  sequence       int not null check (sequence > 0),
  title          text not null check (char_length(title) between 1 and 200),
  description    text not null default '' check (char_length(description) <= 2000),
  amount_minor   bigint not null check (amount_minor > 0),
  due_date       date,
  trigger_type   public.milestone_trigger not null default 'on_date',
  -- A label only. Payment progress is never tied to architecture progress.
  stage_label    text check (char_length(stage_label) <= 200),
  status         public.milestone_status not null default 'planned',
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint payment_milestones_contract_fk foreign key (contract_id, engagement_id, currency)
    references public.contracts (id, engagement_id, currency) on update cascade on delete restrict,
  constraint payment_milestones_sequence_unique unique (contract_id, sequence) deferrable initially immediate,
  constraint payment_milestones_context_key unique (id, contract_id)
);
create index payment_milestones_engagement_idx on public.payment_milestones (engagement_id);

-- Invoices: bills actually sent. ------------------------------------------------------
create table public.invoices (
  id                    uuid primary key default gen_random_uuid(),
  contract_id           uuid not null,
  engagement_id         uuid not null,
  currency              char(3) not null,
  invoice_number        text unique check (invoice_number ~ '^TPL-[0-9]{4}-[0-9]{4,}$'),
  status                public.invoice_status not null default 'draft',
  scheduled_issue_date  date,
  issue_date            date,
  due_date              date,
  total_minor           bigint check (total_minor > 0),
  memo                  text not null default '' check (char_length(memo) <= 2000),
  document_path         text check (char_length(document_path) <= 500),
  issued_at             timestamptz,
  issued_by             uuid references public.profiles (id) on delete set null,
  voided_at             timestamptz,
  voided_by             uuid references public.profiles (id) on delete set null,
  void_reason           text check (char_length(void_reason) <= 1000),
  created_by            uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint invoices_contract_fk foreign key (contract_id, engagement_id, currency)
    references public.contracts (id, engagement_id, currency) on update cascade on delete restrict,
  constraint invoices_context_key unique (id, contract_id),
  constraint invoices_context_currency_key unique (id, contract_id, currency),
  constraint invoices_issued_shape check (
    (status in ('draft', 'scheduled') and invoice_number is null and total_minor is null and issued_at is null)
    or (
      status in ('issued', 'void') and invoice_number is not null and total_minor is not null
      and issue_date is not null and due_date is not null and due_date >= issue_date and issued_at is not null
    )
  ),
  constraint invoices_scheduled_shape check (status <> 'scheduled' or scheduled_issue_date is not null),
  constraint invoices_void_shape check (
    (status = 'void') = (voided_at is not null)
    and (status <> 'void' or coalesce(char_length(void_reason), 0) > 0)
  )
);
create index invoices_engagement_idx on public.invoices (engagement_id);
create index invoices_contract_idx on public.invoices (contract_id);

create table public.invoice_lines (
  id                    uuid primary key default gen_random_uuid(),
  invoice_id            uuid not null,
  contract_id           uuid not null,
  engagement_id         uuid not null,
  position              int not null default 1 check (position > 0),
  description           text not null check (char_length(description) between 1 and 500),
  amount_minor          bigint not null check (amount_minor > 0),
  payment_milestone_id  uuid,
  change_order_id       uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint invoice_lines_invoice_fk foreign key (invoice_id, contract_id)
    references public.invoices (id, contract_id) on delete cascade,
  constraint invoice_lines_milestone_fk foreign key (payment_milestone_id, contract_id)
    references public.payment_milestones (id, contract_id) on delete restrict,
  constraint invoice_lines_change_order_fk foreign key (change_order_id, contract_id)
    references public.change_orders (id, contract_id) on delete restrict,
  -- A line bills a milestone, a change order, or neither; never both.
  constraint invoice_lines_one_source check (payment_milestone_id is null or change_order_id is null)
);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);
create index invoice_lines_milestone_idx on public.invoice_lines (payment_milestone_id);
create index invoice_lines_change_order_idx on public.invoice_lines (change_order_id);

-- Payment links: kept apart from invoices so RLS decides who may see a link. --------
create table public.invoice_payment_links (
  invoice_id         uuid primary key references public.invoices (id) on delete cascade,
  engagement_id      uuid not null references public.engagements (id) on delete cascade,
  url                text not null check (url ~ '^https://[^\s]+$' and char_length(url) <= 2000),
  provider           text check (char_length(provider) <= 100),
  provider_reference text check (char_length(provider_reference) <= 200),
  created_by         uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Credit notes: reduce one issued invoice. -------------------------------------------
create table public.credit_notes (
  id                  uuid primary key default gen_random_uuid(),
  invoice_id          uuid not null,
  contract_id         uuid not null,
  engagement_id       uuid not null,
  currency            char(3) not null,
  credit_note_number  text unique check (credit_note_number ~ '^TPL-CN-[0-9]{4}-[0-9]{4,}$'),
  status              public.credit_note_status not null default 'draft',
  amount_minor        bigint not null check (amount_minor > 0),
  reason              text not null check (char_length(reason) between 1 and 1000),
  issue_date          date,
  issued_at           timestamptz,
  issued_by           uuid references public.profiles (id) on delete set null,
  voided_at           timestamptz,
  voided_by           uuid references public.profiles (id) on delete set null,
  void_reason         text check (char_length(void_reason) <= 1000),
  document_path       text check (char_length(document_path) <= 500),
  created_by          uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint credit_notes_invoice_fk foreign key (invoice_id, contract_id, currency)
    references public.invoices (id, contract_id, currency) on delete restrict,
  constraint credit_notes_contract_fk foreign key (contract_id, engagement_id, currency)
    references public.contracts (id, engagement_id, currency) on update cascade on delete restrict,
  constraint credit_notes_issued_shape check (
    (status = 'draft' and credit_note_number is null and issued_at is null)
    or (status in ('issued', 'void') and credit_note_number is not null and issue_date is not null and issued_at is not null)
  ),
  constraint credit_notes_void_shape check (
    (status = 'void') = (voided_at is not null)
    and (status <> 'void' or coalesce(char_length(void_reason), 0) > 0)
  )
);
create index credit_notes_invoice_idx on public.credit_notes (invoice_id);
create index credit_notes_engagement_idx on public.credit_notes (engagement_id);

-- Payments: cash received. -------------------------------------------------------------
create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  contract_id          uuid not null,
  engagement_id        uuid not null,
  currency             char(3) not null,
  amount_minor         bigint not null check (amount_minor > 0),
  received_on          date not null,
  method               public.payment_method not null,
  reference            text not null default '' check (char_length(reference) <= 120),
  payer_name           text not null default '' check (char_length(payer_name) <= 200),
  receipt_path         text check (char_length(receipt_path) <= 500),
  processor            text check (char_length(processor) <= 50),
  external_payment_id  text check (char_length(external_payment_id) <= 200),
  status               public.payment_status not null default 'recorded',
  recorded_by          uuid references public.profiles (id) on delete set null,
  reversed_at          timestamptz,
  reversed_by          uuid references public.profiles (id) on delete set null,
  reversal_reason      text check (char_length(reversal_reason) <= 1000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint payments_contract_fk foreign key (contract_id, engagement_id, currency)
    references public.contracts (id, engagement_id, currency) on update cascade on delete restrict,
  constraint payments_context_key unique (id, contract_id),
  constraint payments_no_account_numbers check (
    not private.looks_like_account_number(reference) and not private.looks_like_account_number(payer_name)
  ),
  constraint payments_processor_pair check ((processor is null) = (external_payment_id is null)),
  constraint payments_reversal_shape check (
    (status = 'reversed') = (reversed_at is not null)
    and (status <> 'reversed' or coalesce(char_length(reversal_reason), 0) > 0)
  )
);
create unique index payments_external_id_unique
  on public.payments (processor, external_payment_id) where external_payment_id is not null;
create index payments_engagement_idx on public.payments (engagement_id);
create index payments_contract_idx on public.payments (contract_id);

-- Payment allocations: which invoice each piece of cash paid. ----------------------------
create table public.payment_allocations (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null,
  invoice_id       uuid not null,
  contract_id      uuid not null,
  engagement_id    uuid not null,
  amount_minor     bigint not null check (amount_minor > 0),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  reversed_at      timestamptz,
  reversed_by      uuid references public.profiles (id) on delete set null,
  reversal_reason  text check (char_length(reversal_reason) <= 1000),
  constraint payment_allocations_payment_fk foreign key (payment_id, contract_id)
    references public.payments (id, contract_id) on delete restrict,
  constraint payment_allocations_invoice_fk foreign key (invoice_id, contract_id)
    references public.invoices (id, contract_id) on delete restrict,
  constraint payment_allocations_reversal_shape check (
    (reversed_at is null and reversal_reason is null)
    or (reversed_at is not null and coalesce(char_length(reversal_reason), 0) > 0)
  )
);
create index payment_allocations_payment_idx on public.payment_allocations (payment_id);
create index payment_allocations_invoice_idx on public.payment_allocations (invoice_id);
create index payment_allocations_contract_idx on public.payment_allocations (contract_id);

-- Refunds: cash returned from unapplied credit. -------------------------------------------
create table public.refunds (
  id                  uuid primary key default gen_random_uuid(),
  contract_id         uuid not null,
  engagement_id       uuid not null,
  currency            char(3) not null,
  payment_id          uuid,
  amount_minor        bigint not null check (amount_minor > 0),
  refunded_on         date not null,
  method              public.payment_method not null,
  reference           text not null default '' check (char_length(reference) <= 120),
  reason              text not null check (char_length(reason) between 1 and 1000),
  status              public.refund_status not null default 'completed',
  processor           text check (char_length(processor) <= 50),
  external_refund_id  text check (char_length(external_refund_id) <= 200),
  processed_by        uuid references public.profiles (id) on delete set null,
  processed_at        timestamptz not null default now(),
  voided_at           timestamptz,
  voided_by           uuid references public.profiles (id) on delete set null,
  void_reason         text check (char_length(void_reason) <= 1000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint refunds_contract_fk foreign key (contract_id, engagement_id, currency)
    references public.contracts (id, engagement_id, currency) on update cascade on delete restrict,
  constraint refunds_payment_fk foreign key (payment_id, contract_id)
    references public.payments (id, contract_id) on delete restrict,
  constraint refunds_no_account_numbers check (not private.looks_like_account_number(reference)),
  constraint refunds_processor_pair check ((processor is null) = (external_refund_id is null)),
  constraint refunds_void_shape check (
    (status = 'void') = (voided_at is not null)
    and (status <> 'void' or coalesce(char_length(void_reason), 0) > 0)
  )
);
create unique index refunds_external_id_unique
  on public.refunds (processor, external_refund_id) where external_refund_id is not null;
create index refunds_contract_idx on public.refunds (contract_id);
create index refunds_payment_idx on public.refunds (payment_id);

-- Financial history (append-only). ----------------------------------------------------------
create table public.financial_events (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements (id) on delete cascade,
  contract_id    uuid references public.contracts (id) on delete cascade,
  entity_type    text not null,
  entity_id      uuid not null,
  event_type     text not null,
  amount_minor   bigint,
  summary        text not null default '',
  client_visible boolean not null default false,
  actor_id       uuid references public.profiles (id) on delete set null,
  metadata       jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now()
);
create index financial_events_engagement_idx on public.financial_events (engagement_id, occurred_at desc);

-- Internal-only notes on financial records.
create table public.finance_notes (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.engagements (id) on delete cascade,
  entity_type    text not null check (entity_type in (
    'contract', 'change_order', 'payment_milestone', 'invoice', 'credit_note', 'payment', 'refund'
  )),
  entity_id      uuid not null,
  body           text not null check (char_length(body) between 1 and 5000),
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index finance_notes_entity_idx on public.finance_notes (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- 5. Balance helpers (definer: used by operations and integrity checks, which
--    must see every row regardless of the caller's visibility)
-- -----------------------------------------------------------------------------
create function private.invoice_credited_minor(target_invoice_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_minor), 0)::bigint
  from public.credit_notes
  where invoice_id = target_invoice_id and status = 'issued';
$$;

create function private.invoice_applied_minor(target_invoice_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_minor), 0)::bigint
  from public.payment_allocations
  where invoice_id = target_invoice_id and reversed_at is null;
$$;

-- Net invoice minus payments applied; 0 unless issued.
create function private.invoice_balance_minor(target_invoice_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when i.status = 'issued'
    then i.total_minor - private.invoice_credited_minor(i.id) - private.invoice_applied_minor(i.id)
    else 0 end
  from public.invoices i
  where i.id = target_invoice_id;
$$;

-- Payment amount minus active allocations minus completed refunds drawn from it.
create function private.payment_unapplied_minor(target_payment_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.status = 'recorded' then
    p.amount_minor
    - coalesce((select sum(a.amount_minor) from public.payment_allocations a
                where a.payment_id = p.id and a.reversed_at is null), 0)
    - coalesce((select sum(r.amount_minor) from public.refunds r
                where r.payment_id = p.id and r.status = 'completed'), 0)
    else 0 end::bigint
  from public.payments p
  where p.id = target_payment_id;
$$;

-- Contract-level unapplied credit: received − applied − refunded.
create function private.contract_unapplied_minor(target_contract_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((select sum(amount_minor) from public.payments
              where contract_id = target_contract_id and status = 'recorded'), 0)
    - coalesce((select sum(a.amount_minor) from public.payment_allocations a
                join public.payments p on p.id = a.payment_id
                where a.contract_id = target_contract_id and a.reversed_at is null and p.status = 'recorded'), 0)
    - coalesce((select sum(amount_minor) from public.refunds
                where contract_id = target_contract_id and status = 'completed'), 0)
  )::bigint;
$$;

-- Issued billing against a milestone or change order (void invoices excluded).
create function private.milestone_billed_minor(target_milestone_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.amount_minor), 0)::bigint
  from public.invoice_lines l
  join public.invoices i on i.id = l.invoice_id
  where l.payment_milestone_id = target_milestone_id and i.status = 'issued';
$$;

create function private.change_order_billed_minor(target_change_order_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.amount_minor), 0)::bigint
  from public.invoice_lines l
  join public.invoices i on i.id = l.invoice_id
  where l.change_order_id = target_change_order_id and i.status = 'issued';
$$;

create function private.contract_revised_value_minor(target_contract_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select c.original_value_minor + coalesce((
    select sum(co.amount_minor) from public.change_orders co
    where co.contract_id = c.id and co.status = 'approved'
  ), 0)
  from public.contracts c
  where c.id = target_contract_id;
$$;

revoke all on function private.invoice_credited_minor(uuid) from public, anon;
revoke all on function private.invoice_applied_minor(uuid) from public, anon;
revoke all on function private.invoice_balance_minor(uuid) from public, anon;
revoke all on function private.payment_unapplied_minor(uuid) from public, anon;
revoke all on function private.contract_unapplied_minor(uuid) from public, anon;
revoke all on function private.milestone_billed_minor(uuid) from public, anon;
revoke all on function private.change_order_billed_minor(uuid) from public, anon;
revoke all on function private.contract_revised_value_minor(uuid) from public, anon;
grant execute on function private.invoice_balance_minor(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Integrity: every money invariant for one contract. Raised as 23514.
--    Called at the end of each operation and by deferred constraint triggers.
-- -----------------------------------------------------------------------------
create function private.assert_contract_integrity(target_contract_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bad record;
begin
  if target_contract_id is null then
    return;
  end if;

  -- Payments: never over-applied; reversed payments carry nothing.
  select p.id, p.status into bad
  from public.payments p
  where p.contract_id = target_contract_id
    and (
      (p.status = 'recorded' and private.payment_unapplied_minor(p.id) < 0)
      or (p.status = 'reversed' and (
        exists (select 1 from public.payment_allocations a where a.payment_id = p.id and a.reversed_at is null)
        or exists (select 1 from public.refunds r where r.payment_id = p.id and r.status = 'completed')
      ))
    )
  limit 1;
  if found then
    raise exception 'Payment % would be over-applied or refunded beyond its amount', bad.id
      using errcode = '23514';
  end if;

  -- Contract: applied + refunded never exceeds cash received.
  if private.contract_unapplied_minor(target_contract_id) < 0 then
    raise exception 'Allocations and refunds would exceed the payments received on this contract'
      using errcode = '23514';
  end if;

  -- Invoices: credits and payments never exceed the invoice; only issued
  -- invoices carry credits or payments.
  select i.id, i.invoice_number into bad
  from public.invoices i
  where i.contract_id = target_contract_id
    and (
      (i.status = 'issued' and (
        private.invoice_credited_minor(i.id) > i.total_minor
        or private.invoice_balance_minor(i.id) < 0
      ))
      or (i.status <> 'issued' and (
        exists (select 1 from public.payment_allocations a where a.invoice_id = i.id and a.reversed_at is null)
        or exists (select 1 from public.credit_notes cn where cn.invoice_id = i.id and cn.status = 'issued')
      ))
    )
  limit 1;
  if found then
    raise exception 'Invoice % would be credited or paid beyond its amount', coalesce(bad.invoice_number, 'draft')
      using errcode = '23514';
  end if;

  -- Issued invoices: frozen total equals the sum of their lines.
  select i.id, i.invoice_number into bad
  from public.invoices i
  where i.contract_id = target_contract_id and i.status in ('issued', 'void')
    and i.total_minor <> coalesce((select sum(l.amount_minor) from public.invoice_lines l where l.invoice_id = i.id), 0)
  limit 1;
  if found then
    raise exception 'Invoice % total does not match its lines', bad.invoice_number using errcode = '23514';
  end if;

  -- Anti-double-billing: issued billing never exceeds the authorized source.
  select m.id, m.title into bad
  from public.payment_milestones m
  where m.contract_id = target_contract_id
    and private.milestone_billed_minor(m.id) > m.amount_minor
  limit 1;
  if found then
    raise exception 'Milestone "%" would be billed beyond its amount', bad.title using errcode = '23514';
  end if;

  select co.id, co.number into bad
  from public.change_orders co
  where co.contract_id = target_contract_id
    and private.change_order_billed_minor(co.id) > 0
    and (co.status <> 'approved' or co.amount_minor < private.change_order_billed_minor(co.id))
  limit 1;
  if found then
    raise exception 'Change order CO-% would be billed beyond its approved amount', bad.number
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_contract_integrity(uuid) from public, anon;
grant execute on function private.assert_contract_integrity(uuid) to authenticated;

create function private.check_contract_integrity_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_contract_integrity(
    case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'contract_id')::uuid
         else (to_jsonb(new) ->> 'contract_id')::uuid end
  );
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Row preparation and guards
-- -----------------------------------------------------------------------------

-- Children copy engagement and currency from their contract; the composite
-- foreign keys then prove they belong together.
create function private.inherit_contract_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select c.engagement_id, c.currency into new.engagement_id, new.currency
  from public.contracts c where c.id = new.contract_id;
  if not found then
    raise exception 'Contract not found' using errcode = '23503';
  end if;
  return new;
end;
$$;

create function private.inherit_invoice_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select i.contract_id, i.engagement_id into new.contract_id, new.engagement_id
  from public.invoices i where i.id = new.invoice_id;
  if not found then
    raise exception 'Invoice not found' using errcode = '23503';
  end if;
  return new;
end;
$$;

create function private.inherit_credit_note_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select i.contract_id, i.engagement_id, i.currency into new.contract_id, new.engagement_id, new.currency
  from public.invoices i where i.id = new.invoice_id;
  if not found then
    raise exception 'Invoice not found' using errcode = '23503';
  end if;
  return new;
end;
$$;

create function private.inherit_payment_link_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select i.engagement_id into new.engagement_id from public.invoices i where i.id = new.invoice_id;
  return new;
end;
$$;

-- Contracts: currency must be enabled; executed terms never change.
create function private.guard_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft contracts can be deleted' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' or new.currency is distinct from old.currency then
    if not exists (select 1 from public.currencies where code = new.currency and enabled) then
      raise exception 'Currency % is not enabled', new.currency using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.engagement_id <> old.engagement_id then
      raise exception 'A contract cannot move between engagements' using errcode = '23514';
    end if;
    if old.status <> 'draft' and (
      new.original_value_minor <> old.original_value_minor
      or new.currency <> old.currency
      or new.executed_on is distinct from old.executed_on
      or new.approved_by is distinct from old.approved_by
    ) then
      raise exception 'Executed contract terms cannot change; use a change order' using errcode = '23514';
    end if;
    if new.status <> old.status and not private.in_finance_operation() then
      raise exception 'Contract status changes only through contract operations' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Status columns change only inside finance operations; decided, issued and
-- completed records never change except by the operation that voids or
-- reverses them.
create function private.guard_change_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft change orders can be deleted' using errcode = '23514';
    end if;
    return old;
  end if;
  if new.contract_id <> old.contract_id then
    raise exception 'A change order cannot move between contracts' using errcode = '23514';
  end if;
  if old.status in ('approved', 'rejected', 'void') then
    raise exception 'Change order CO-% is final', old.number using errcode = '23514';
  end if;
  if not private.in_finance_operation() and (old.status <> 'draft' or new.status <> old.status) then
    raise exception 'Submitted change orders change only through change-order operations' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.guard_milestone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status not in ('planned', 'cancelled')
       or exists (select 1 from public.invoice_lines where payment_milestone_id = old.id) then
      raise exception 'Only unbilled planned milestones can be deleted' using errcode = '23514';
    end if;
    return old;
  end if;
  if new.contract_id <> old.contract_id then
    raise exception 'A milestone cannot move between contracts' using errcode = '23514';
  end if;
  if new.status <> old.status and not private.in_finance_operation() then
    raise exception 'Milestone status changes only through milestone operations' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.guard_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft invoices can be deleted; void an issued invoice instead' using errcode = '23514';
    end if;
    return old;
  end if;
  if new.contract_id <> old.contract_id then
    raise exception 'An invoice cannot move between contracts' using errcode = '23514';
  end if;
  if old.status = 'void' then
    raise exception 'Invoice % is void', old.invoice_number using errcode = '23514';
  end if;
  if old.status = 'issued' and not (
    private.in_finance_operation()
    and new.status = 'void'
    and new.invoice_number = old.invoice_number
    and new.total_minor = old.total_minor
    and new.issue_date = old.issue_date
    and new.due_date = old.due_date
    and new.memo = old.memo
  ) then
    raise exception 'Issued invoice % cannot be edited; issue a credit note or void it', old.invoice_number
      using errcode = '23514';
  end if;
  if new.status <> old.status and not private.in_finance_operation() then
    raise exception 'Invoice status changes only through invoice operations' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.guard_invoice_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_status public.invoice_status;
begin
  select status into parent_status from public.invoices
  where id = case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  -- Cascading deletes of a draft invoice find the parent already gone.
  if parent_status is not null and parent_status not in ('draft', 'scheduled') then
    raise exception 'Lines of an issued invoice cannot change' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.invoice_id <> old.invoice_id then
    raise exception 'A line cannot move between invoices' using errcode = '23514';
  end if;
  if tg_op <> 'DELETE' and new.change_order_id is not null and not exists (
    select 1 from public.change_orders
    where id = new.change_order_id and status = 'approved' and amount_minor > 0
  ) then
    raise exception 'Only approved change orders that increase the price can be billed' using errcode = '23514';
  end if;
  if tg_op <> 'DELETE' and new.payment_milestone_id is not null and exists (
    select 1 from public.payment_milestones where id = new.payment_milestone_id and status = 'cancelled'
  ) then
    raise exception 'A cancelled milestone cannot be billed' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function private.guard_credit_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Only draft credit notes can be deleted; void an issued one instead' using errcode = '23514';
    end if;
    return old;
  end if;
  if new.invoice_id <> old.invoice_id then
    raise exception 'A credit note cannot move between invoices' using errcode = '23514';
  end if;
  if old.status = 'void' then
    raise exception 'Credit note % is void', old.credit_note_number using errcode = '23514';
  end if;
  if old.status = 'issued' and not (
    private.in_finance_operation()
    and new.status = 'void'
    and new.amount_minor = old.amount_minor
    and new.credit_note_number = old.credit_note_number
    and new.reason = old.reason
  ) then
    raise exception 'Issued credit note % cannot be edited', old.credit_note_number using errcode = '23514';
  end if;
  if new.status <> old.status and not private.in_finance_operation() then
    raise exception 'Credit note status changes only through credit-note operations' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Cash records: written only by operations; never deleted; the only change
-- ever made is a one-time reversal or void.
create function private.guard_cash_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception '% records are never deleted', tg_table_name using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if not private.in_finance_operation() then
      raise exception '% are recorded only through finance operations', tg_table_name using errcode = '42501';
    end if;
    return new;
  end if;
  if not private.in_finance_operation() then
    raise exception '% change only through finance operations', tg_table_name using errcode = '42501';
  end if;
  case tg_table_name
    when 'payments' then
      if not (old.status = 'recorded' and new.status = 'reversed'
              and new.amount_minor = old.amount_minor and new.received_on = old.received_on
              and new.contract_id = old.contract_id) then
        raise exception 'A payment can only be reversed' using errcode = '23514';
      end if;
    when 'payment_allocations' then
      if not (old.reversed_at is null and new.reversed_at is not null
              and new.amount_minor = old.amount_minor and new.payment_id = old.payment_id
              and new.invoice_id = old.invoice_id) then
        raise exception 'An allocation can only be reversed, once' using errcode = '23514';
      end if;
    when 'refunds' then
      if not (old.status = 'completed' and new.status = 'void'
              and new.amount_minor = old.amount_minor and new.contract_id = old.contract_id
              and new.payment_id is not distinct from old.payment_id) then
        raise exception 'A refund can only be voided' using errcode = '23514';
      end if;
    else
      null;
  end case;
  return new;
end;
$$;

create function private.guard_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '23514';
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Audit: extend the activity log to every table carrying engagement_id.
-- -----------------------------------------------------------------------------
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb;
  org_id uuid;
  eng_id uuid;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  case tg_table_name
    when 'organizations' then
      org_id := (rec ->> 'id')::uuid;
    when 'organization_members' then
      org_id := (rec ->> 'organization_id')::uuid;
    when 'engagements' then
      org_id := (rec ->> 'client_organization_id')::uuid;
      eng_id := (rec ->> 'id')::uuid;
    else
      if rec ? 'engagement_id' then
        eng_id := (rec ->> 'engagement_id')::uuid;
        select client_organization_id into org_id from public.engagements where id = eng_id;
      end if;
  end case;

  if org_id is not null and not exists (select 1 from public.organizations where id = org_id) then
    org_id := null;
  end if;
  if eng_id is not null and not exists (select 1 from public.engagements where id = eng_id) then
    eng_id := null;
  end if;

  insert into public.activity_log (
    organization_id, engagement_id, actor_user_id, action_type, entity_type, entity_id, metadata_json
  ) values (
    org_id,
    eng_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce((rec ->> 'id')::uuid, (rec ->> 'invoice_id')::uuid),
    case
      when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      else jsonb_build_object('record', rec)
    end
  );

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Triggers
-- -----------------------------------------------------------------------------
create trigger contracts_set_updated_at before update on public.contracts
  for each row execute function private.set_updated_at();
create trigger contracts_set_created_by before insert on public.contracts
  for each row execute function private.set_created_by();
create trigger contracts_guard before insert or update or delete on public.contracts
  for each row execute function private.guard_contract();
create trigger contracts_log after insert or update or delete on public.contracts
  for each row execute function private.log_activity();

create trigger change_orders_inherit before insert or update of contract_id on public.change_orders
  for each row execute function private.inherit_contract_context();
create trigger change_orders_set_updated_at before update on public.change_orders
  for each row execute function private.set_updated_at();
create trigger change_orders_set_created_by before insert on public.change_orders
  for each row execute function private.set_created_by();
create trigger change_orders_guard before update or delete on public.change_orders
  for each row execute function private.guard_change_order();
create trigger change_orders_log after insert or update or delete on public.change_orders
  for each row execute function private.log_activity();
create constraint trigger change_orders_integrity after insert or update or delete on public.change_orders
  deferrable initially deferred for each row execute function private.check_contract_integrity_trigger();

create trigger change_order_events_append_only before update or delete on public.change_order_events
  for each row execute function private.guard_append_only();

create trigger payment_milestones_inherit before insert or update of contract_id on public.payment_milestones
  for each row execute function private.inherit_contract_context();
create trigger payment_milestones_set_updated_at before update on public.payment_milestones
  for each row execute function private.set_updated_at();
create trigger payment_milestones_set_created_by before insert on public.payment_milestones
  for each row execute function private.set_created_by();
create trigger payment_milestones_guard before update or delete on public.payment_milestones
  for each row execute function private.guard_milestone();
create trigger payment_milestones_log after insert or update or delete on public.payment_milestones
  for each row execute function private.log_activity();
create constraint trigger payment_milestones_integrity after insert or update or delete on public.payment_milestones
  deferrable initially deferred for each row execute function private.check_contract_integrity_trigger();

create trigger invoices_inherit before insert or update of contract_id on public.invoices
  for each row execute function private.inherit_contract_context();
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function private.set_updated_at();
create trigger invoices_set_created_by before insert on public.invoices
  for each row execute function private.set_created_by();
create trigger invoices_guard before update or delete on public.invoices
  for each row execute function private.guard_invoice();
create trigger invoices_log after insert or update or delete on public.invoices
  for each row execute function private.log_activity();
create constraint trigger invoices_integrity after insert or update or delete on public.invoices
  deferrable initially deferred for each row execute function private.check_contract_integrity_trigger();

create trigger invoice_lines_inherit before insert or update of invoice_id on public.invoice_lines
  for each row execute function private.inherit_invoice_context();
create trigger invoice_lines_set_updated_at before update on public.invoice_lines
  for each row execute function private.set_updated_at();
create trigger invoice_lines_guard before insert or update or delete on public.invoice_lines
  for each row execute function private.guard_invoice_line();
create trigger invoice_lines_log after insert or update or delete on public.invoice_lines
  for each row execute function private.log_activity();
create constraint trigger invoice_lines_integrity after insert or update or delete on public.invoice_lines
  deferrable initially deferred for each row execute function private.check_contract_integrity_trigger();

create trigger invoice_payment_links_inherit before insert or update of invoice_id on public.invoice_payment_links
  for each row execute function private.inherit_payment_link_context();
create trigger invoice_payment_links_set_updated_at before update on public.invoice_payment_links
  for each row execute function private.set_updated_at();
create trigger invoice_payment_links_set_created_by before insert on public.invoice_payment_links
  for each row execute function private.set_created_by();
create trigger invoice_payment_links_log after insert or update or delete on public.invoice_payment_links
  for each row execute function private.log_activity();

create trigger credit_notes_inherit before insert or update of invoice_id on public.credit_notes
  for each row execute function private.inherit_credit_note_context();
create trigger credit_notes_set_updated_at before update on public.credit_notes
  for each row execute function private.set_updated_at();
create trigger credit_notes_set_created_by before insert on public.credit_notes
  for each row execute function private.set_created_by();
create trigger credit_notes_guard before update or delete on public.credit_notes
  for each row execute function private.guard_credit_note();
create trigger credit_notes_log after insert or update or delete on public.credit_notes
  for each row execute function private.log_activity();
create constraint trigger credit_notes_integrity after insert or update or delete on public.credit_notes
  deferrable initially deferred for each row execute function private.check_contract_integrity_trigger();

create trigger payments_inherit before insert on public.payments
  for each row execute function private.inherit_contract_context();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();
create trigger payments_guard before insert or update or delete on public.payments
  for each row execute function private.guard_cash_record();
create trigger payments_log after insert or update or delete on public.payments
  for each row execute function private.log_activity();
create constraint trigger payments_integrity after insert or update or delete on public.payments
  deferrable initially deferred for each row execute function private.check_contract_integrity_trigger();

create trigger payment_allocations_guard before insert or update or delete on public.payment_allocations
  for each row execute function private.guard_cash_record();
create trigger payment_allocations_log after insert or update or delete on public.payment_allocations
  for each row execute function private.log_activity();
create constraint trigger payment_allocations_integrity after insert or update or delete on public.payment_allocations
  deferrable initially deferred for each row execute function private.check_contract_integrity_trigger();

create trigger refunds_inherit before insert on public.refunds
  for each row execute function private.inherit_contract_context();
create trigger refunds_set_updated_at before update on public.refunds
  for each row execute function private.set_updated_at();
create trigger refunds_guard before insert or update or delete on public.refunds
  for each row execute function private.guard_cash_record();
create trigger refunds_log after insert or update or delete on public.refunds
  for each row execute function private.log_activity();
create constraint trigger refunds_integrity after insert or update or delete on public.refunds
  deferrable initially deferred for each row execute function private.check_contract_integrity_trigger();

create trigger financial_events_append_only before update or delete on public.financial_events
  for each row execute function private.guard_append_only();
create trigger finance_notes_append_only before update or delete on public.finance_notes
  for each row execute function private.guard_append_only();
create trigger finance_notes_set_created_by before insert on public.finance_notes
  for each row execute function private.set_created_by();

-- -----------------------------------------------------------------------------
-- 10. Visibility helpers
-- -----------------------------------------------------------------------------
create function private.contract_is_client_visible(target_contract_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contracts where id = target_contract_id and status not in ('draft', 'void')
  );
$$;

create function private.invoice_is_client_visible(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.invoices where id = target_invoice_id and issued_at is not null);
$$;

create function private.finance_document_is_client_visible(object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.contracts where document_path = object_path and status not in ('draft', 'void'))
    or exists (select 1 from public.invoices where document_path = object_path and issued_at is not null)
    or exists (select 1 from public.credit_notes where document_path = object_path and issued_at is not null)
    or exists (select 1 from public.payments where receipt_path = object_path)
    or exists (select 1 from public.change_orders where evidence_path = object_path and submitted_at is not null);
$$;

revoke all on function private.contract_is_client_visible(uuid) from public, anon;
revoke all on function private.invoice_is_client_visible(uuid) from public, anon;
revoke all on function private.finance_document_is_client_visible(text) from public, anon;
grant execute on function private.contract_is_client_visible(uuid) to authenticated;
grant execute on function private.invoice_is_client_visible(uuid) to authenticated;
grant execute on function private.finance_document_is_client_visible(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 11. Privileges. Users write drafts directly (column-limited); everything
--     else, including every status change and all cash records, goes through
--     the operations in section 13.
-- -----------------------------------------------------------------------------
revoke all on
  public.currencies, public.document_number_counters, public.contracts, public.change_orders,
  public.change_order_events, public.payment_milestones, public.invoices, public.invoice_lines,
  public.invoice_payment_links, public.credit_notes, public.payments, public.payment_allocations,
  public.refunds, public.financial_events, public.finance_notes
from anon, authenticated;

grant select on
  public.currencies, public.contracts, public.change_orders, public.change_order_events,
  public.payment_milestones, public.invoices, public.invoice_lines, public.invoice_payment_links,
  public.credit_notes, public.payments, public.payment_allocations, public.refunds,
  public.financial_events, public.finance_notes
to authenticated;

grant insert (engagement_id, title, currency, original_value_minor, payment_structure, payment_terms_days,
              deposit_minor, effective_date, start_date, end_date, client_signatory_name,
              client_signatory_title, document_path, supersedes_contract_id, notes),
      update (title, currency, original_value_minor, payment_structure, payment_terms_days, deposit_minor,
              effective_date, start_date, end_date, client_signatory_name, client_signatory_title,
              document_path, supersedes_contract_id, notes),
      delete
  on public.contracts to authenticated;

grant insert (contract_id, title, description, scope_impact, schedule_impact, amount_minor),
      update (title, description, scope_impact, schedule_impact, amount_minor),
      delete
  on public.change_orders to authenticated;

grant insert (contract_id, sequence, title, description, amount_minor, due_date, trigger_type, stage_label),
      update (sequence, title, description, amount_minor, due_date, trigger_type, stage_label),
      delete
  on public.payment_milestones to authenticated;

grant insert (contract_id, memo, document_path),
      update (memo, document_path),
      delete
  on public.invoices to authenticated;

grant insert (invoice_id, position, description, amount_minor, payment_milestone_id, change_order_id),
      update (position, description, amount_minor, payment_milestone_id, change_order_id),
      delete
  on public.invoice_lines to authenticated;

grant insert (invoice_id, url, provider, provider_reference),
      update (url, provider, provider_reference),
      delete
  on public.invoice_payment_links to authenticated;

grant insert (invoice_id, amount_minor, reason, document_path),
      update (amount_minor, reason, document_path),
      delete
  on public.credit_notes to authenticated;

grant insert (engagement_id, entity_type, entity_id, body) on public.finance_notes to authenticated;

-- -----------------------------------------------------------------------------
-- 12. Row Level Security
--     Read: view_financials (assigned capability or portfolio authority);
--     clients see only client-facing states. Write: manage_financials, drafts only.
-- -----------------------------------------------------------------------------
alter table public.currencies enable row level security;
alter table public.document_number_counters enable row level security;
alter table public.contracts enable row level security;
alter table public.change_orders enable row level security;
alter table public.change_order_events enable row level security;
alter table public.payment_milestones enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_payment_links enable row level security;
alter table public.credit_notes enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.refunds enable row level security;
alter table public.financial_events enable row level security;
alter table public.finance_notes enable row level security;

create policy "currencies: readable reference data"
  on public.currencies for select to authenticated using (true);

-- contracts ---------------------------------------------------------------------
create policy "contracts: financial viewers; clients see executed contracts"
  on public.contracts for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and ((select private.is_internal()) or status not in ('draft', 'void'))
  );
create policy "contracts: financial managers create drafts"
  on public.contracts for insert to authenticated
  with check (private.can_manage_engagement_financials(engagement_id) and status = 'draft');
create policy "contracts: financial managers edit drafts"
  on public.contracts for update to authenticated
  using (private.can_manage_engagement_financials(engagement_id) and status = 'draft')
  with check (private.can_manage_engagement_financials(engagement_id) and status = 'draft');
create policy "contracts: financial managers delete drafts"
  on public.contracts for delete to authenticated
  using (private.can_manage_engagement_financials(engagement_id) and status = 'draft');

-- change orders -----------------------------------------------------------------
create policy "change orders: financial viewers; clients see submitted and later"
  on public.change_orders for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and ((select private.is_internal()) or submitted_at is not null)
  );
create policy "change orders: financial managers create drafts"
  on public.change_orders for insert to authenticated
  with check (private.can_manage_engagement_financials(engagement_id) and status = 'draft');
create policy "change orders: financial managers edit drafts"
  on public.change_orders for update to authenticated
  using (private.can_manage_engagement_financials(engagement_id) and status = 'draft')
  with check (private.can_manage_engagement_financials(engagement_id) and status = 'draft');
create policy "change orders: financial managers delete drafts"
  on public.change_orders for delete to authenticated
  using (private.can_manage_engagement_financials(engagement_id) and status = 'draft');

create policy "change order events: financial viewers; clients see events after submission"
  on public.change_order_events for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and (
      (select private.is_internal())
      or (from_status is not null and (from_status <> 'draft' or to_status = 'submitted'))
    )
  );

-- milestones --------------------------------------------------------------------
create policy "milestones: financial viewers; clients see milestones of executed contracts"
  on public.payment_milestones for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and ((select private.is_internal()) or private.contract_is_client_visible(contract_id))
  );
create policy "milestones: financial managers create"
  on public.payment_milestones for insert to authenticated
  with check (private.can_manage_engagement_financials(engagement_id) and status = 'planned');
create policy "milestones: financial managers edit"
  on public.payment_milestones for update to authenticated
  using (private.can_manage_engagement_financials(engagement_id) and status <> 'cancelled')
  with check (private.can_manage_engagement_financials(engagement_id));
create policy "milestones: financial managers delete"
  on public.payment_milestones for delete to authenticated
  using (private.can_manage_engagement_financials(engagement_id));

-- invoices ------------------------------------------------------------------------
create policy "invoices: financial viewers; clients see issued invoices"
  on public.invoices for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and ((select private.is_internal()) or issued_at is not null)
  );
create policy "invoices: financial managers create drafts"
  on public.invoices for insert to authenticated
  with check (private.can_manage_engagement_financials(engagement_id) and status = 'draft');
create policy "invoices: financial managers edit drafts"
  on public.invoices for update to authenticated
  using (private.can_manage_engagement_financials(engagement_id) and status in ('draft', 'scheduled'))
  with check (private.can_manage_engagement_financials(engagement_id) and status in ('draft', 'scheduled'));
create policy "invoices: financial managers delete drafts"
  on public.invoices for delete to authenticated
  using (private.can_manage_engagement_financials(engagement_id) and status = 'draft');

create policy "invoice lines: as their invoice"
  on public.invoice_lines for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and ((select private.is_internal()) or private.invoice_is_client_visible(invoice_id))
  );
create policy "invoice lines: financial managers write draft lines"
  on public.invoice_lines for insert to authenticated
  with check (private.can_manage_engagement_financials(engagement_id));
create policy "invoice lines: financial managers edit draft lines"
  on public.invoice_lines for update to authenticated
  using (private.can_manage_engagement_financials(engagement_id))
  with check (private.can_manage_engagement_financials(engagement_id));
create policy "invoice lines: financial managers delete draft lines"
  on public.invoice_lines for delete to authenticated
  using (private.can_manage_engagement_financials(engagement_id));

-- payment links: internal viewers; clients only for an issued invoice with a
-- balance, and only with pay_invoices.
create policy "payment links: internal viewers, and clients who may pay an open invoice"
  on public.invoice_payment_links for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and (
      (select private.is_internal())
      or (
        private.has_client_financial_capability(engagement_id, 'pay_invoices')
        and exists (select 1 from public.invoices i where i.id = invoice_id and i.status = 'issued')
        and private.invoice_balance_minor(invoice_id) > 0
      )
    )
  );
create policy "payment links: financial managers attach to issued invoices"
  on public.invoice_payment_links for insert to authenticated
  with check (
    private.can_manage_engagement_financials(engagement_id)
    and exists (select 1 from public.invoices i where i.id = invoice_id and i.status = 'issued')
  );
create policy "payment links: financial managers edit"
  on public.invoice_payment_links for update to authenticated
  using (private.can_manage_engagement_financials(engagement_id))
  with check (private.can_manage_engagement_financials(engagement_id));
create policy "payment links: financial managers remove"
  on public.invoice_payment_links for delete to authenticated
  using (private.can_manage_engagement_financials(engagement_id));

-- credit notes ------------------------------------------------------------------
create policy "credit notes: financial viewers; clients see issued credit notes"
  on public.credit_notes for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and ((select private.is_internal()) or issued_at is not null)
  );
create policy "credit notes: financial managers create drafts"
  on public.credit_notes for insert to authenticated
  with check (private.can_manage_engagement_financials(engagement_id) and status = 'draft');
create policy "credit notes: financial managers edit drafts"
  on public.credit_notes for update to authenticated
  using (private.can_manage_engagement_financials(engagement_id) and status = 'draft')
  with check (private.can_manage_engagement_financials(engagement_id) and status = 'draft');
create policy "credit notes: financial managers delete drafts"
  on public.credit_notes for delete to authenticated
  using (private.can_manage_engagement_financials(engagement_id) and status = 'draft');

-- cash (read-only here; written by operations) ------------------------------------
create policy "payments: financial viewers"
  on public.payments for select to authenticated
  using (private.can_view_engagement_financials(engagement_id));
create policy "allocations: financial viewers; clients see active allocations"
  on public.payment_allocations for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and ((select private.is_internal()) or reversed_at is null)
  );
create policy "refunds: financial viewers"
  on public.refunds for select to authenticated
  using (private.can_view_engagement_financials(engagement_id));

-- history and notes -----------------------------------------------------------------
create policy "financial events: financial viewers; clients see client-facing events"
  on public.financial_events for select to authenticated
  using (
    private.can_view_engagement_financials(engagement_id)
    and ((select private.is_internal()) or client_visible)
  );
create policy "finance notes: internal financial viewers"
  on public.finance_notes for select to authenticated
  using ((select private.is_internal()) and private.can_view_engagement_financials(engagement_id));
create policy "finance notes: internal financial managers"
  on public.finance_notes for insert to authenticated
  with check ((select private.is_internal()) and private.can_manage_engagement_financials(engagement_id));

-- Storage: private bucket, paths {engagement_id}/{kind}/{file}.
insert into storage.buckets (id, name, public)
values ('finance-documents', 'finance-documents', false)
on conflict (id) do nothing;

create policy "finance documents: financial viewers; clients only for client-facing records"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'finance-documents'
    and private.can_view_engagement_financials(private.try_uuid((storage.foldername(name))[1]))
    and ((select private.is_internal()) or private.finance_document_is_client_visible(name))
  );
create policy "finance documents: internal financial managers upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'finance-documents'
    and (select private.is_internal())
    and private.can_manage_engagement_financials(private.try_uuid((storage.foldername(name))[1]))
  );

-- -----------------------------------------------------------------------------
-- 13. Operations. Each: marks the transaction as a finance operation, locks
--     the contract row (serializing money operations per contract), checks
--     permission with the RLS helpers, validates the transition, writes the
--     change and its event, and re-checks every invariant.
--     Errors: 42501 permission, 23514 rule, P0002 not found.
-- -----------------------------------------------------------------------------
create function private.lock_contract(target_contract_id uuid)
returns public.contracts
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contracts;
begin
  select * into c from public.contracts where id = target_contract_id for update;
  if not found then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;
  return c;
end;
$$;

create function private.require_financial_manager(target_engagement_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_engagement_financials(target_engagement_id) then
    raise exception 'You do not have permission to manage this engagement''s finances' using errcode = '42501';
  end if;
end;
$$;

create function private.record_financial_event(
  p_engagement_id uuid,
  p_contract_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_amount_minor bigint,
  p_summary text,
  p_client_visible boolean,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.financial_events (
    engagement_id, contract_id, entity_type, entity_id, event_type, amount_minor, summary,
    client_visible, actor_id, metadata
  ) values (
    p_engagement_id, p_contract_id, p_entity_type, p_entity_id, p_event_type, p_amount_minor, p_summary,
    p_client_visible, auth.uid(), p_metadata
  );
$$;

create function private.next_document_number(p_series text, p_year int)
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.document_number_counters as c (series, year, last_value)
  values (p_series, p_year, 1)
  on conflict (series, year) do update set last_value = c.last_value + 1
  returning last_value;
$$;

revoke all on function private.lock_contract(uuid) from public, anon, authenticated;
revoke all on function private.require_financial_manager(uuid) from public, anon, authenticated;
revoke all on function private.record_financial_event(uuid, uuid, text, uuid, text, bigint, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function private.next_document_number(text, int) from public, anon, authenticated;

-- Contracts ----------------------------------------------------------------------
create function public.execute_contract(
  p_contract_id uuid,
  p_executed_on date,
  p_client_signatory_name text,
  p_client_signatory_title text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contracts;
  prior public.contracts;
begin
  perform private.begin_finance_operation();
  c := private.lock_contract(p_contract_id);
  perform private.require_financial_manager(c.engagement_id);
  if not private.is_executive_financial_authority() then
    raise exception 'Only a Principal Architect or System Administrator can execute a contract'
      using errcode = '42501';
  end if;
  if c.status <> 'draft' then
    raise exception 'Only a draft contract can be executed' using errcode = '23514';
  end if;
  if p_executed_on is null or coalesce(btrim(p_client_signatory_name), '') = '' then
    raise exception 'Execution date and client signatory are required' using errcode = '23514';
  end if;

  if c.supersedes_contract_id is not null then
    prior := private.lock_contract(c.supersedes_contract_id);
    if prior.engagement_id <> c.engagement_id or prior.status not in ('executed', 'active') then
      raise exception 'Only a current contract on the same engagement can be superseded' using errcode = '23514';
    end if;
    update public.contracts set status = 'superseded' where id = prior.id;
    perform private.record_financial_event(prior.engagement_id, prior.id, 'contract', prior.id,
      'contract_superseded', null, 'Contract superseded by ' || c.title, true);
  end if;

  update public.contracts
  set status = 'executed',
      executed_on = p_executed_on,
      client_signatory_name = btrim(p_client_signatory_name),
      client_signatory_title = nullif(btrim(coalesce(p_client_signatory_title, '')), ''),
      approved_by = auth.uid(),
      approved_at = now()
  where id = c.id;

  perform private.record_financial_event(c.engagement_id, c.id, 'contract', c.id, 'contract_executed',
    c.original_value_minor, 'Contract executed: ' || c.title, true);
  perform private.assert_contract_integrity(c.id);
  perform private.end_finance_operation();
end;
$$;

create function public.set_contract_status(p_contract_id uuid, p_status public.contract_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contracts;
begin
  perform private.begin_finance_operation();
  c := private.lock_contract(p_contract_id);
  perform private.require_financial_manager(c.engagement_id);

  if not (
    (c.status = 'executed' and p_status = 'active')
    or (c.status in ('executed', 'active') and p_status in ('completed', 'terminated'))
    or (c.status = 'draft' and p_status = 'void')
  ) then
    raise exception 'A % contract cannot become %', c.status, p_status using errcode = '23514';
  end if;
  if p_status = 'terminated' and not private.is_executive_financial_authority() then
    raise exception 'Only a Principal Architect or System Administrator can terminate a contract'
      using errcode = '42501';
  end if;

  update public.contracts set status = p_status where id = c.id;
  perform private.record_financial_event(c.engagement_id, c.id, 'contract', c.id,
    'contract_' || p_status::text, null, 'Contract ' || p_status::text, p_status <> 'void');
  perform private.end_finance_operation();
end;
$$;

-- Change orders ----------------------------------------------------------------------
create function private.lock_change_order(p_change_order_id uuid)
returns public.change_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  co public.change_orders;
  contract_row public.contracts;
begin
  select * into co from public.change_orders where id = p_change_order_id;
  if not found then
    raise exception 'Change order not found' using errcode = 'P0002';
  end if;
  contract_row := private.lock_contract(co.contract_id);
  select * into co from public.change_orders where id = p_change_order_id for update;
  return co;
end;
$$;
revoke all on function private.lock_change_order(uuid) from public, anon, authenticated;

create function private.write_change_order_event(
  co public.change_orders,
  p_from public.change_order_status,
  p_to public.change_order_status,
  p_note text,
  p_before bigint,
  p_after bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.change_order_events (
    change_order_id, engagement_id, from_status, to_status, actor_id, actor_side, approval_source,
    note, contract_value_before_minor, contract_value_after_minor
  ) values (
    co.id, co.engagement_id, p_from, p_to, auth.uid(),
    case when private.is_internal() then 'internal'::public.member_side else 'client'::public.member_side end,
    (select approval_source from public.change_orders where id = co.id),
    p_note, p_before, p_after
  );
$$;
revoke all on function private.write_change_order_event(public.change_orders, public.change_order_status, public.change_order_status, text, bigint, bigint) from public, anon, authenticated;

create function public.submit_change_order(p_change_order_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  co public.change_orders;
  next_number int;
begin
  perform private.begin_finance_operation();
  co := private.lock_change_order(p_change_order_id);
  perform private.require_financial_manager(co.engagement_id);
  if co.status <> 'draft' then
    raise exception 'Only a draft change order can be submitted' using errcode = '23514';
  end if;
  if not exists (select 1 from public.contracts where id = co.contract_id and status in ('executed', 'active')) then
    raise exception 'Change orders can be submitted only against a current contract' using errcode = '23514';
  end if;

  select coalesce(max(number), 0) + 1 into next_number from public.change_orders where contract_id = co.contract_id;
  update public.change_orders
  set status = 'submitted', number = next_number, submitted_at = now(), submitted_by = auth.uid()
  where id = co.id;

  perform private.write_change_order_event(co, 'draft', 'submitted', null, null, null);
  perform private.record_financial_event(co.engagement_id, co.contract_id, 'change_order', co.id,
    'change_order_submitted', co.amount_minor, 'CO-' || next_number || ' submitted: ' || co.title, true);
  perform private.end_finance_operation();
  return next_number;
end;
$$;

create function private.approve_change_order_common(co public.change_orders)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_value bigint;
begin
  if co.status <> 'submitted' then
    raise exception 'Only a submitted change order can be approved' using errcode = '23514';
  end if;
  if not exists (select 1 from public.contracts where id = co.contract_id and status in ('executed', 'active')) then
    raise exception 'Change orders can be approved only against a current contract' using errcode = '23514';
  end if;
  before_value := private.contract_revised_value_minor(co.contract_id);
  if before_value + co.amount_minor < 0 then
    raise exception 'The contract value cannot become negative' using errcode = '23514';
  end if;
end;
$$;
revoke all on function private.approve_change_order_common(public.change_orders) from public, anon, authenticated;

create function public.approve_change_order(p_change_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  co public.change_orders;
  before_value bigint;
begin
  perform private.begin_finance_operation();
  co := private.lock_change_order(p_change_order_id);
  if not private.has_client_financial_capability(co.engagement_id, 'approve_change_orders') then
    raise exception 'You do not have permission to approve change orders on this engagement'
      using errcode = '42501';
  end if;
  perform private.approve_change_order_common(co);
  before_value := private.contract_revised_value_minor(co.contract_id);

  update public.change_orders
  set status = 'approved', decided_at = now(), approval_source = 'client_portal', approved_by_user_id = auth.uid()
  where id = co.id;

  perform private.write_change_order_event(co, 'submitted', 'approved', null, before_value, before_value + co.amount_minor);
  perform private.record_financial_event(co.engagement_id, co.contract_id, 'change_order', co.id,
    'change_order_approved', co.amount_minor, 'CO-' || co.number || ' approved in the portal', true,
    jsonb_build_object('contract_value_before_minor', before_value,
                       'contract_value_after_minor', before_value + co.amount_minor));
  perform private.assert_contract_integrity(co.contract_id);
  perform private.end_finance_operation();
end;
$$;

create function public.record_external_change_order_approval(
  p_change_order_id uuid,
  p_approver_name text,
  p_approver_title text,
  p_approved_on date,
  p_method public.external_approval_method,
  p_evidence_path text,
  p_evidence_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  co public.change_orders;
  before_value bigint;
begin
  perform private.begin_finance_operation();
  co := private.lock_change_order(p_change_order_id);
  perform private.require_financial_manager(co.engagement_id);
  if not private.is_executive_financial_authority() then
    raise exception 'Only a Principal Architect or System Administrator can record an external approval'
      using errcode = '42501';
  end if;
  perform private.approve_change_order_common(co);
  if coalesce(btrim(p_approver_name), '') = '' or p_approved_on is null or p_method is null
     or (coalesce(btrim(p_evidence_path), '') = '' and coalesce(btrim(p_evidence_reference), '') = '') then
    raise exception 'The approver, approval date, method and evidence are required' using errcode = '23514';
  end if;
  before_value := private.contract_revised_value_minor(co.contract_id);

  update public.change_orders
  set status = 'approved',
      decided_at = now(),
      approval_source = 'external_recorded_by_tplco',
      external_approver_name = btrim(p_approver_name),
      external_approver_title = nullif(btrim(coalesce(p_approver_title, '')), ''),
      external_approved_on = p_approved_on,
      external_approval_method = p_method,
      evidence_path = nullif(btrim(coalesce(p_evidence_path, '')), ''),
      evidence_reference = nullif(btrim(coalesce(p_evidence_reference, '')), ''),
      recorded_by = auth.uid(),
      recorded_at = now()
  where id = co.id;

  perform private.write_change_order_event(co, 'submitted', 'approved',
    'External approval by ' || btrim(p_approver_name) || ' (' || p_method::text || ', ' || p_approved_on::text || ') recorded by TPLCo',
    before_value, before_value + co.amount_minor);
  perform private.record_financial_event(co.engagement_id, co.contract_id, 'change_order', co.id,
    'change_order_approved', co.amount_minor,
    'CO-' || co.number || ' approved by ' || btrim(p_approver_name) || '; recorded by TPLCo', true,
    jsonb_build_object('contract_value_before_minor', before_value,
                       'contract_value_after_minor', before_value + co.amount_minor,
                       'approval_source', 'external_recorded_by_tplco'));
  perform private.assert_contract_integrity(co.contract_id);
  perform private.end_finance_operation();
end;
$$;

create function public.reject_change_order(p_change_order_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  co public.change_orders;
begin
  perform private.begin_finance_operation();
  co := private.lock_change_order(p_change_order_id);
  if not private.has_client_financial_capability(co.engagement_id, 'approve_change_orders') then
    raise exception 'You do not have permission to decide change orders on this engagement'
      using errcode = '42501';
  end if;
  if co.status <> 'submitted' then
    raise exception 'Only a submitted change order can be rejected' using errcode = '23514';
  end if;
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  update public.change_orders set status = 'rejected', decided_at = now(), decision_note = btrim(p_note)
  where id = co.id;
  perform private.write_change_order_event(co, 'submitted', 'rejected', btrim(p_note), null, null);
  perform private.record_financial_event(co.engagement_id, co.contract_id, 'change_order', co.id,
    'change_order_rejected', co.amount_minor, 'CO-' || co.number || ' rejected', true);
  perform private.end_finance_operation();
end;
$$;

create function public.void_change_order(p_change_order_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  co public.change_orders;
begin
  perform private.begin_finance_operation();
  co := private.lock_change_order(p_change_order_id);
  perform private.require_financial_manager(co.engagement_id);
  if co.status not in ('draft', 'submitted') then
    raise exception 'Only a draft or submitted change order can be voided; correct an approved one with a new change order'
      using errcode = '23514';
  end if;
  if coalesce(btrim(p_note), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  update public.change_orders set status = 'void', decided_at = now(), decision_note = btrim(p_note)
  where id = co.id;
  perform private.write_change_order_event(co, co.status, 'void', btrim(p_note), null, null);
  perform private.record_financial_event(co.engagement_id, co.contract_id, 'change_order', co.id,
    'change_order_voided', co.amount_minor, coalesce('CO-' || co.number, 'Draft change order') || ' withdrawn',
    co.status = 'submitted');
  perform private.end_finance_operation();
end;
$$;

-- Milestones --------------------------------------------------------------------------
create function public.set_milestone_status(p_milestone_id uuid, p_status public.milestone_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.payment_milestones;
  contract_row public.contracts;
begin
  perform private.begin_finance_operation();
  select * into m from public.payment_milestones where id = p_milestone_id;
  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;
  contract_row := private.lock_contract(m.contract_id);
  perform private.require_financial_manager(m.engagement_id);
  select * into m from public.payment_milestones where id = p_milestone_id for update;

  if not (
    (m.status = 'planned' and p_status in ('ready_to_invoice', 'cancelled'))
    or (m.status = 'ready_to_invoice' and p_status in ('planned', 'cancelled'))
  ) then
    raise exception 'A % milestone cannot become %', m.status, p_status using errcode = '23514';
  end if;
  if p_status = 'cancelled' and exists (select 1 from public.invoice_lines where payment_milestone_id = m.id) then
    raise exception 'A milestone that has been billed cannot be cancelled' using errcode = '23514';
  end if;
  update public.payment_milestones set status = p_status where id = m.id;
  perform private.record_financial_event(m.engagement_id, m.contract_id, 'payment_milestone', m.id,
    'milestone_' || p_status::text, m.amount_minor, m.title || ': ' || replace(p_status::text, '_', ' '), true);
  perform private.end_finance_operation();
end;
$$;

-- Milestones become invoiced when fully billed, and ready again if a void
-- leaves them under-billed.
create function private.sync_milestone_billing_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  for m in
    select distinct pm.id, pm.amount_minor, pm.status
    from public.invoice_lines l
    join public.payment_milestones pm on pm.id = l.payment_milestone_id
    where l.invoice_id = p_invoice_id
  loop
    if private.milestone_billed_minor(m.id) >= m.amount_minor and m.status <> 'invoiced' then
      update public.payment_milestones set status = 'invoiced' where id = m.id;
    elsif private.milestone_billed_minor(m.id) < m.amount_minor and m.status = 'invoiced' then
      update public.payment_milestones set status = 'ready_to_invoice' where id = m.id;
    end if;
  end loop;
end;
$$;
revoke all on function private.sync_milestone_billing_status(uuid) from public, anon, authenticated;

-- Invoices ------------------------------------------------------------------------------
create function private.lock_invoice(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  contract_row public.contracts;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  contract_row := private.lock_contract(inv.contract_id);
  select * into inv from public.invoices where id = p_invoice_id for update;
  return inv;
end;
$$;
revoke all on function private.lock_invoice(uuid) from public, anon, authenticated;

create function public.schedule_invoice(p_invoice_id uuid, p_scheduled_issue_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
begin
  perform private.begin_finance_operation();
  inv := private.lock_invoice(p_invoice_id);
  perform private.require_financial_manager(inv.engagement_id);
  if inv.status not in ('draft', 'scheduled') then
    raise exception 'Only a draft invoice can be scheduled' using errcode = '23514';
  end if;
  update public.invoices
  set status = case when p_scheduled_issue_date is null then 'draft' else 'scheduled' end::public.invoice_status,
      scheduled_issue_date = p_scheduled_issue_date
  where id = inv.id;
  perform private.end_finance_operation();
end;
$$;

create function public.issue_invoice(p_invoice_id uuid, p_issue_date date, p_due_date date default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  c public.contracts;
  total bigint;
  number_value int;
  formatted text;
  due date;
begin
  perform private.begin_finance_operation();
  inv := private.lock_invoice(p_invoice_id);
  perform private.require_financial_manager(inv.engagement_id);
  select * into c from public.contracts where id = inv.contract_id;

  if inv.status not in ('draft', 'scheduled') then
    raise exception 'Invoice % has already been issued', inv.invoice_number using errcode = '23514';
  end if;
  if c.status not in ('executed', 'active') then
    raise exception 'Invoices can be issued only against a current contract' using errcode = '23514';
  end if;
  if p_issue_date is null then
    raise exception 'An issue date is required' using errcode = '23514';
  end if;
  select coalesce(sum(amount_minor), 0) into total from public.invoice_lines where invoice_id = inv.id;
  if total <= 0 then
    raise exception 'An invoice needs at least one line' using errcode = '23514';
  end if;
  due := coalesce(p_due_date, p_issue_date + c.payment_terms_days);
  if due < p_issue_date then
    raise exception 'The due date cannot be before the issue date' using errcode = '23514';
  end if;

  number_value := private.next_document_number('invoice', extract(year from p_issue_date)::int);
  formatted := 'TPL-' || extract(year from p_issue_date)::int || '-' || lpad(number_value::text, 4, '0');

  update public.invoices
  set status = 'issued', invoice_number = formatted, total_minor = total, issue_date = p_issue_date,
      due_date = due, issued_at = now(), issued_by = auth.uid(), scheduled_issue_date = null
  where id = inv.id;

  perform private.sync_milestone_billing_status(inv.id);
  perform private.record_financial_event(inv.engagement_id, inv.contract_id, 'invoice', inv.id,
    'invoice_issued', total, 'Invoice ' || formatted || ' issued', true);
  -- Anti-double-billing and every other invariant, before the number is visible.
  perform private.assert_contract_integrity(inv.contract_id);
  perform private.end_finance_operation();
  return formatted;
end;
$$;

create function public.void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
begin
  perform private.begin_finance_operation();
  inv := private.lock_invoice(p_invoice_id);
  perform private.require_financial_manager(inv.engagement_id);
  if inv.status <> 'issued' then
    raise exception 'Only an issued invoice can be voided; delete a draft instead' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  if private.invoice_applied_minor(inv.id) > 0 then
    raise exception 'Invoice % has payments applied; reverse them or issue a credit note instead', inv.invoice_number
      using errcode = '23514';
  end if;
  if private.invoice_credited_minor(inv.id) > 0 then
    raise exception 'Invoice % has credit notes; correct it with further credit notes instead', inv.invoice_number
      using errcode = '23514';
  end if;

  update public.invoices
  set status = 'void', voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = inv.id;
  perform private.sync_milestone_billing_status(inv.id);
  perform private.record_financial_event(inv.engagement_id, inv.contract_id, 'invoice', inv.id,
    'invoice_voided', inv.total_minor, 'Invoice ' || inv.invoice_number || ' voided: ' || btrim(p_reason), true);
  perform private.assert_contract_integrity(inv.contract_id);
  perform private.end_finance_operation();
end;
$$;

-- Credit notes ------------------------------------------------------------------------------
create function public.issue_credit_note(p_credit_note_id uuid, p_issue_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  cn public.credit_notes;
  inv public.invoices;
  number_value int;
  formatted text;
begin
  perform private.begin_finance_operation();
  select * into cn from public.credit_notes where id = p_credit_note_id;
  if not found then
    raise exception 'Credit note not found' using errcode = 'P0002';
  end if;
  inv := private.lock_invoice(cn.invoice_id);
  perform private.require_financial_manager(cn.engagement_id);
  select * into cn from public.credit_notes where id = p_credit_note_id for update;

  if cn.status <> 'draft' then
    raise exception 'Credit note % has already been issued', cn.credit_note_number using errcode = '23514';
  end if;
  if inv.status <> 'issued' then
    raise exception 'Only an issued invoice can be credited' using errcode = '23514';
  end if;
  if p_issue_date is null then
    raise exception 'An issue date is required' using errcode = '23514';
  end if;
  if cn.amount_minor > private.invoice_balance_minor(inv.id) then
    raise exception 'The credit exceeds the invoice balance; reverse excess payment allocations first'
      using errcode = '23514';
  end if;

  number_value := private.next_document_number('credit_note', extract(year from p_issue_date)::int);
  formatted := 'TPL-CN-' || extract(year from p_issue_date)::int || '-' || lpad(number_value::text, 4, '0');

  update public.credit_notes
  set status = 'issued', credit_note_number = formatted, issue_date = p_issue_date,
      issued_at = now(), issued_by = auth.uid()
  where id = cn.id;

  perform private.record_financial_event(cn.engagement_id, cn.contract_id, 'credit_note', cn.id,
    'credit_note_issued', cn.amount_minor, 'Credit note ' || formatted || ' issued against ' || inv.invoice_number, true);
  perform private.assert_contract_integrity(cn.contract_id);
  perform private.end_finance_operation();
  return formatted;
end;
$$;

create function public.void_credit_note(p_credit_note_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cn public.credit_notes;
  inv public.invoices;
begin
  perform private.begin_finance_operation();
  select * into cn from public.credit_notes where id = p_credit_note_id;
  if not found then
    raise exception 'Credit note not found' using errcode = 'P0002';
  end if;
  inv := private.lock_invoice(cn.invoice_id);
  perform private.require_financial_manager(cn.engagement_id);
  select * into cn from public.credit_notes where id = p_credit_note_id for update;
  if cn.status <> 'issued' then
    raise exception 'Only an issued credit note can be voided; delete a draft instead' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  update public.credit_notes set status = 'void', voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = cn.id;
  perform private.record_financial_event(cn.engagement_id, cn.contract_id, 'credit_note', cn.id,
    'credit_note_voided', cn.amount_minor, 'Credit note ' || cn.credit_note_number || ' voided: ' || btrim(p_reason), true);
  perform private.assert_contract_integrity(cn.contract_id);
  perform private.end_finance_operation();
end;
$$;

-- Payments and allocations ---------------------------------------------------------------------
create function private.allocate_locked(p_payment public.payments, p_invoice_id uuid, p_amount bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  new_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'An allocation must be a positive amount' using errcode = '23514';
  end if;
  if p_payment.status <> 'recorded' then
    raise exception 'A reversed payment cannot be allocated' using errcode = '23514';
  end if;
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found or inv.contract_id <> p_payment.contract_id then
    raise exception 'The invoice must belong to the same contract as the payment' using errcode = '23514';
  end if;
  if inv.status <> 'issued' then
    raise exception 'Payments can be applied only to issued invoices' using errcode = '23514';
  end if;
  if p_amount > private.payment_unapplied_minor(p_payment.id) then
    raise exception 'The allocation exceeds the payment''s unapplied amount' using errcode = '23514';
  end if;
  if p_amount > private.contract_unapplied_minor(p_payment.contract_id) then
    raise exception 'The allocation exceeds the unapplied credit on this contract' using errcode = '23514';
  end if;
  if p_amount > private.invoice_balance_minor(inv.id) then
    raise exception 'The allocation exceeds the balance of invoice %', inv.invoice_number using errcode = '23514';
  end if;

  insert into public.payment_allocations (payment_id, invoice_id, contract_id, engagement_id, amount_minor, created_by)
  values (p_payment.id, inv.id, inv.contract_id, inv.engagement_id, p_amount, auth.uid())
  returning id into new_id;

  perform private.record_financial_event(inv.engagement_id, inv.contract_id, 'payment_allocation', new_id,
    'payment_applied', p_amount, 'Payment applied to ' || inv.invoice_number, true,
    jsonb_build_object('payment_id', p_payment.id, 'invoice_id', inv.id));
  return new_id;
end;
$$;
revoke all on function private.allocate_locked(public.payments, uuid, bigint) from public, anon, authenticated;

create function public.record_payment(
  p_contract_id uuid,
  p_amount_minor bigint,
  p_received_on date,
  p_method public.payment_method,
  p_reference text default '',
  p_payer_name text default '',
  p_receipt_path text default null,
  p_processor text default null,
  p_external_payment_id text default null,
  p_allocations jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contracts;
  p public.payments;
  alloc jsonb;
begin
  perform private.begin_finance_operation();
  c := private.lock_contract(p_contract_id);
  perform private.require_financial_manager(c.engagement_id);
  if c.status in ('draft', 'void') then
    raise exception 'Payments can be recorded only against an executed contract' using errcode = '23514';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'A payment must be a positive amount' using errcode = '23514';
  end if;
  if p_received_on is null or p_method is null then
    raise exception 'The date received and method are required' using errcode = '23514';
  end if;
  if private.looks_like_account_number(p_reference) or private.looks_like_account_number(p_payer_name) then
    raise exception 'Do not enter card or bank account numbers; use a check number or confirmation reference'
      using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) <> 'array' then
    raise exception 'Allocations must be a list' using errcode = '22023';
  end if;

  insert into public.payments (
    contract_id, amount_minor, received_on, method, reference, payer_name, receipt_path, processor,
    external_payment_id, recorded_by
  ) values (
    c.id, p_amount_minor, p_received_on, p_method, coalesce(btrim(p_reference), ''),
    coalesce(btrim(p_payer_name), ''), nullif(btrim(coalesce(p_receipt_path, '')), ''),
    nullif(btrim(coalesce(p_processor, '')), ''), nullif(btrim(coalesce(p_external_payment_id, '')), ''),
    auth.uid()
  )
  returning * into p;

  perform private.record_financial_event(c.engagement_id, c.id, 'payment', p.id, 'payment_recorded',
    p.amount_minor, 'Payment received (' || p.method::text || ')', true);

  for alloc in select * from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb))
  loop
    perform private.allocate_locked(p, (alloc ->> 'invoice_id')::uuid, (alloc ->> 'amount_minor')::bigint);
  end loop;

  perform private.assert_contract_integrity(c.id);
  perform private.end_finance_operation();
  return p.id;
end;
$$;

create function public.allocate_payment(p_payment_id uuid, p_invoice_id uuid, p_amount_minor bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  c public.contracts;
  new_id uuid;
begin
  perform private.begin_finance_operation();
  select * into p from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  c := private.lock_contract(p.contract_id);
  perform private.require_financial_manager(p.engagement_id);
  select * into p from public.payments where id = p_payment_id for update;
  new_id := private.allocate_locked(p, p_invoice_id, p_amount_minor);
  perform private.assert_contract_integrity(c.id);
  perform private.end_finance_operation();
  return new_id;
end;
$$;

create function public.reverse_allocation(p_allocation_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.payment_allocations;
  c public.contracts;
  inv_number text;
begin
  perform private.begin_finance_operation();
  select * into a from public.payment_allocations where id = p_allocation_id;
  if not found then
    raise exception 'Allocation not found' using errcode = 'P0002';
  end if;
  c := private.lock_contract(a.contract_id);
  perform private.require_financial_manager(a.engagement_id);
  select * into a from public.payment_allocations where id = p_allocation_id for update;
  if a.reversed_at is not null then
    raise exception 'This allocation has already been reversed' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  update public.payment_allocations
  set reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason)
  where id = a.id;
  select invoice_number into inv_number from public.invoices where id = a.invoice_id;
  perform private.record_financial_event(a.engagement_id, a.contract_id, 'payment_allocation', a.id,
    'payment_unapplied', a.amount_minor, 'Payment removed from ' || inv_number || ': ' || btrim(p_reason), true,
    jsonb_build_object('payment_id', a.payment_id, 'invoice_id', a.invoice_id));
  perform private.assert_contract_integrity(c.id);
  perform private.end_finance_operation();
end;
$$;

create function public.reverse_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  c public.contracts;
begin
  perform private.begin_finance_operation();
  select * into p from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  c := private.lock_contract(p.contract_id);
  perform private.require_financial_manager(p.engagement_id);
  select * into p from public.payments where id = p_payment_id for update;
  if p.status <> 'recorded' then
    raise exception 'This payment has already been reversed' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  if exists (select 1 from public.refunds where payment_id = p.id and status = 'completed') then
    raise exception 'Refunds were made from this payment; void them before reversing it' using errcode = '23514';
  end if;

  update public.payment_allocations
  set reversed_at = now(), reversed_by = auth.uid(), reversal_reason = 'Payment reversed: ' || btrim(p_reason)
  where payment_id = p.id and reversed_at is null;
  update public.payments
  set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = btrim(p_reason)
  where id = p.id;

  perform private.record_financial_event(p.engagement_id, p.contract_id, 'payment', p.id, 'payment_reversed',
    p.amount_minor, 'Payment reversed: ' || btrim(p_reason), true);
  -- Fails if contract-level refunds now exceed the cash that remains.
  perform private.assert_contract_integrity(c.id);
  perform private.end_finance_operation();
end;
$$;

-- Refunds ---------------------------------------------------------------------------------------
create function public.record_refund(
  p_contract_id uuid,
  p_amount_minor bigint,
  p_refunded_on date,
  p_method public.payment_method,
  p_reason text,
  p_payment_id uuid default null,
  p_reference text default '',
  p_processor text default null,
  p_external_refund_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contracts;
  p public.payments;
  new_id uuid;
begin
  perform private.begin_finance_operation();
  c := private.lock_contract(p_contract_id);
  perform private.require_financial_manager(c.engagement_id);
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'A refund must be a positive amount' using errcode = '23514';
  end if;
  if p_refunded_on is null or p_method is null or coalesce(btrim(p_reason), '') = '' then
    raise exception 'The refund date, method and reason are required' using errcode = '23514';
  end if;
  if private.looks_like_account_number(p_reference) then
    raise exception 'Do not enter card or bank account numbers; use a confirmation reference'
      using errcode = '23514';
  end if;
  if p_payment_id is not null then
    select * into p from public.payments where id = p_payment_id for update;
    if not found or p.contract_id <> c.id then
      raise exception 'The originating payment must belong to this contract' using errcode = '23514';
    end if;
    if p.status <> 'recorded' then
      raise exception 'A reversed payment cannot be refunded' using errcode = '23514';
    end if;
    if p_amount_minor > private.payment_unapplied_minor(p.id) then
      raise exception 'The refund exceeds the unapplied amount of that payment' using errcode = '23514';
    end if;
  end if;
  if p_amount_minor > private.contract_unapplied_minor(c.id) then
    raise exception 'The refund exceeds the unapplied credit on this contract' using errcode = '23514';
  end if;

  insert into public.refunds (
    contract_id, payment_id, amount_minor, refunded_on, method, reference, reason, processor,
    external_refund_id, processed_by
  ) values (
    c.id, p_payment_id, p_amount_minor, p_refunded_on, p_method, coalesce(btrim(p_reference), ''),
    btrim(p_reason), nullif(btrim(coalesce(p_processor, '')), ''),
    nullif(btrim(coalesce(p_external_refund_id, '')), ''), auth.uid()
  )
  returning id into new_id;

  perform private.record_financial_event(c.engagement_id, c.id, 'refund', new_id, 'refund_completed',
    p_amount_minor, 'Refund issued: ' || btrim(p_reason), true);
  perform private.assert_contract_integrity(c.id);
  perform private.end_finance_operation();
  return new_id;
end;
$$;

create function public.void_refund(p_refund_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.refunds;
  c public.contracts;
begin
  perform private.begin_finance_operation();
  select * into r from public.refunds where id = p_refund_id;
  if not found then
    raise exception 'Refund not found' using errcode = 'P0002';
  end if;
  c := private.lock_contract(r.contract_id);
  perform private.require_financial_manager(r.engagement_id);
  select * into r from public.refunds where id = p_refund_id for update;
  if r.status <> 'completed' then
    raise exception 'This refund has already been voided' using errcode = '23514';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  update public.refunds set status = 'void', voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  where id = r.id;
  perform private.record_financial_event(r.engagement_id, r.contract_id, 'refund', r.id, 'refund_voided',
    r.amount_minor, 'Refund voided: ' || btrim(p_reason), true);
  perform private.assert_contract_integrity(c.id);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.execute_contract(uuid, date, text, text)',
    'public.set_contract_status(uuid, public.contract_status)',
    'public.submit_change_order(uuid)',
    'public.approve_change_order(uuid)',
    'public.record_external_change_order_approval(uuid, text, text, date, public.external_approval_method, text, text)',
    'public.reject_change_order(uuid, text)',
    'public.void_change_order(uuid, text)',
    'public.set_milestone_status(uuid, public.milestone_status)',
    'public.schedule_invoice(uuid, date)',
    'public.issue_invoice(uuid, date, date)',
    'public.void_invoice(uuid, text)',
    'public.issue_credit_note(uuid, date)',
    'public.void_credit_note(uuid, text)',
    'public.record_payment(uuid, bigint, date, public.payment_method, text, text, text, text, text, jsonb)',
    'public.allocate_payment(uuid, uuid, bigint)',
    'public.reverse_allocation(uuid, text)',
    'public.reverse_payment(uuid, text)',
    'public.record_refund(uuid, bigint, date, public.payment_method, text, uuid, text, text, text)',
    'public.void_refund(uuid, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
  perform private.end_finance_operation();
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. Read models. SECURITY INVOKER, so row-level security decides what each
--     figure is built from: a client's summary is computed only from records
--     the client may see. as_of is the business date, supplied by the server
--     in BUSINESS_TIME_ZONE (America/Chicago).
-- -----------------------------------------------------------------------------

-- Engagement names for people with financial access but no project access
-- (Finance Administrators). Returns identifying fields only.
create function public.finance_engagement_directory()
returns table (
  engagement_id    uuid,
  title            text,
  slug             text,
  status           public.engagement_status,
  client_name      text,
  start_date       date,
  target_end_date  date
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.slug, e.status, o.name, e.start_date, e.target_end_date
  from public.engagements e
  join public.organizations o on o.id = e.client_organization_id
  where private.can_view_engagement_financials(e.id)
  order by o.name, e.title;
$$;

-- The contract an engagement's figures are built from: the current one,
-- otherwise the most recent visible one.
create function public.engagement_primary_contract_id(p_engagement_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id
  from public.contracts c
  where c.engagement_id = p_engagement_id and c.status <> 'void'
  order by (c.status in ('executed', 'active')) desc,
           (c.status <> 'draft') desc,
           c.created_at desc
  limit 1;
$$;

create function public.invoice_balances(p_engagement_id uuid, p_as_of date)
returns table (
  invoice_id      uuid,
  contract_id     uuid,
  invoice_number  text,
  status          public.invoice_status,
  issue_date      date,
  due_date        date,
  total_minor     bigint,
  credited_minor  bigint,
  applied_minor   bigint,
  balance_minor   bigint,
  payment_state   text,
  days_overdue    int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with figures as (
    select
      i.*,
      coalesce((select sum(cn.amount_minor) from public.credit_notes cn
                where cn.invoice_id = i.id and cn.status = 'issued'), 0)::bigint as credited,
      coalesce((select sum(a.amount_minor) from public.payment_allocations a
                where a.invoice_id = i.id and a.reversed_at is null), 0)::bigint as applied
    from public.invoices i
    where i.engagement_id = p_engagement_id
  )
  select
    f.id, f.contract_id, f.invoice_number, f.status, f.issue_date, f.due_date, f.total_minor,
    f.credited, f.applied,
    case when f.status = 'issued' then f.total_minor - f.credited - f.applied end,
    case
      when f.status <> 'issued' then f.status::text
      when f.total_minor - f.credited - f.applied = 0 then 'paid'
      when f.due_date < p_as_of then 'overdue'
      when f.applied > 0 then 'partially_paid'
      else 'open'
    end,
    case when f.status = 'issued' and f.total_minor - f.credited - f.applied > 0 and f.due_date < p_as_of
         then (p_as_of - f.due_date) else 0 end
  from figures f
  order by f.issue_date nulls last, f.invoice_number nulls last, f.created_at;
$$;

create function public.contract_financial_summary(p_contract_id uuid, p_as_of date)
returns table (
  contract_id                  uuid,
  engagement_id                uuid,
  currency                     char(3),
  contract_status              public.contract_status,
  original_value_minor         bigint,
  approved_changes_minor       bigint,
  revised_value_minor          bigint,
  pending_changes_minor        bigint,
  gross_invoiced_minor         bigint,
  credits_issued_minor         bigint,
  net_invoiced_minor           bigint,
  remaining_to_invoice_minor   bigint,
  payments_received_minor      bigint,
  refunds_minor                bigint,
  net_cash_received_minor      bigint,
  payments_applied_minor       bigint,
  unapplied_credit_minor       bigint,
  outstanding_balance_minor    bigint,
  currently_due_minor          bigint,
  past_due_minor               bigint,
  not_yet_due_minor            bigint,
  remaining_contract_balance_minor bigint,
  net_remaining_to_collect_minor   bigint,
  scheduled_minor              bigint,
  unscheduled_minor            bigint,
  next_payment_kind            text,
  next_payment_id              uuid,
  next_payment_label           text,
  next_payment_amount_minor    bigint,
  next_payment_date            date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with c as (
    select * from public.contracts where id = p_contract_id
  ),
  co as (
    select
      coalesce(sum(amount_minor) filter (where status = 'approved'), 0)::bigint as approved,
      coalesce(sum(amount_minor) filter (where status = 'submitted'), 0)::bigint as pending
    from public.change_orders where contract_id = p_contract_id
  ),
  inv as (
    select
      i.id, i.invoice_number, i.due_date, i.total_minor,
      i.total_minor
        - coalesce((select sum(cn.amount_minor) from public.credit_notes cn
                    where cn.invoice_id = i.id and cn.status = 'issued'), 0)
        - coalesce((select sum(a.amount_minor) from public.payment_allocations a
                    where a.invoice_id = i.id and a.reversed_at is null), 0) as balance
    from public.invoices i
    where i.contract_id = p_contract_id and i.status = 'issued'
  ),
  billed as (
    select
      coalesce(sum(total_minor), 0)::bigint as gross,
      coalesce(sum(balance), 0)::bigint as outstanding,
      coalesce(sum(balance) filter (where due_date <= p_as_of), 0)::bigint as currently_due,
      coalesce(sum(balance) filter (where due_date < p_as_of), 0)::bigint as past_due,
      coalesce(sum(balance) filter (where due_date > p_as_of), 0)::bigint as not_yet_due
    from inv
  ),
  credits as (
    select coalesce(sum(amount_minor), 0)::bigint as issued
    from public.credit_notes where contract_id = p_contract_id and status = 'issued'
  ),
  cash as (
    select
      coalesce((select sum(amount_minor) from public.payments
                where contract_id = p_contract_id and status = 'recorded'), 0)::bigint as received,
      coalesce((select sum(amount_minor) from public.refunds
                where contract_id = p_contract_id and status = 'completed'), 0)::bigint as refunded,
      coalesce((select sum(amount_minor) from public.payment_allocations
                where contract_id = p_contract_id and reversed_at is null), 0)::bigint as applied
  ),
  plan as (
    select coalesce(sum(amount_minor), 0)::bigint as scheduled
    from public.payment_milestones where contract_id = p_contract_id and status <> 'cancelled'
  ),
  next_invoice as (
    select 'invoice'::text as kind, id, invoice_number as label, balance as amount, due_date as on_date
    from inv where balance > 0
    order by due_date, invoice_number
    limit 1
  ),
  next_milestone as (
    select 'milestone'::text as kind, m.id, m.title as label,
           m.amount_minor - m.billed as amount, m.due_date as on_date
    from (
      select pm.*,
             coalesce((select sum(l.amount_minor) from public.invoice_lines l
                       join public.invoices i on i.id = l.invoice_id and i.status = 'issued'
                       where l.payment_milestone_id = pm.id), 0) as billed
      from public.payment_milestones pm
      where pm.contract_id = p_contract_id and pm.status in ('planned', 'ready_to_invoice')
    ) m
    where m.amount_minor > m.billed
    order by m.sequence
    limit 1
  ),
  next_payment as (
    select * from next_invoice
    union all
    select * from next_milestone where not exists (select 1 from next_invoice)
  )
  select
    c.id, c.engagement_id, c.currency, c.status,
    c.original_value_minor,
    co.approved,
    c.original_value_minor + co.approved,
    co.pending,
    billed.gross,
    credits.issued,
    billed.gross - credits.issued,
    c.original_value_minor + co.approved - (billed.gross - credits.issued),
    cash.received,
    cash.refunded,
    cash.received - cash.refunded,
    cash.applied,
    cash.received - cash.applied - cash.refunded,
    billed.outstanding,
    billed.currently_due,
    billed.past_due,
    billed.not_yet_due,
    c.original_value_minor + co.approved - cash.applied,
    c.original_value_minor + co.approved - (cash.received - cash.refunded),
    plan.scheduled,
    greatest(c.original_value_minor + co.approved - plan.scheduled, 0),
    np.kind, np.id, np.label, np.amount, np.on_date
  from c
  cross join co
  cross join billed
  cross join credits
  cross join cash
  cross join plan
  left join next_payment np on true;
$$;

-- The payment plan with derived billing state. Payment state is never typed
-- in: it comes from the invoices that bill each milestone.
create function public.milestone_billing(p_contract_id uuid, p_as_of date)
returns table (
  milestone_id   uuid,
  sequence       int,
  title          text,
  description    text,
  amount_minor   bigint,
  due_date       date,
  trigger_type   public.milestone_trigger,
  stage_label    text,
  status         public.milestone_status,
  billed_minor   bigint,
  open_balance_minor bigint,
  payment_state  text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with lines as (
    select
      l.payment_milestone_id as milestone_id,
      l.amount_minor,
      i.id as invoice_id,
      i.due_date,
      i.total_minor
        - coalesce((select sum(cn.amount_minor) from public.credit_notes cn
                    where cn.invoice_id = i.id and cn.status = 'issued'), 0)
        - coalesce((select sum(a.amount_minor) from public.payment_allocations a
                    where a.invoice_id = i.id and a.reversed_at is null), 0) as invoice_balance
    from public.invoice_lines l
    join public.invoices i on i.id = l.invoice_id and i.status = 'issued'
    where l.contract_id = p_contract_id and l.payment_milestone_id is not null
  ),
  per_milestone as (
    select
      milestone_id,
      sum(amount_minor)::bigint as billed,
      coalesce(sum(distinct_balance), 0)::bigint as open_balance,
      bool_or(invoice_balance > 0 and due_date < p_as_of) as any_overdue
    from (
      select milestone_id, amount_minor, invoice_balance, due_date,
             case when row_number() over (partition by milestone_id, invoice_id order by invoice_id) = 1
                  then invoice_balance else 0 end as distinct_balance
      from lines
    ) x
    group by milestone_id
  )
  select
    m.id, m.sequence, m.title, m.description, m.amount_minor, m.due_date, m.trigger_type,
    m.stage_label, m.status,
    coalesce(pm.billed, 0),
    coalesce(pm.open_balance, 0),
    case
      when m.status = 'cancelled' then 'cancelled'
      when coalesce(pm.billed, 0) = 0 then
        case when m.status = 'ready_to_invoice' then 'ready_to_invoice' else 'upcoming' end
      when pm.any_overdue then 'overdue'
      when pm.open_balance > 0 then 'invoiced'
      when pm.billed < m.amount_minor then 'partially_billed'
      else 'paid'
    end
  from public.payment_milestones m
  left join per_milestone pm on pm.milestone_id = m.id
  where m.contract_id = p_contract_id
  order by m.sequence;
$$;

-- One row per engagement the caller may see financially, built from its
-- primary contract. Engagements without a contract still appear.
create function public.portfolio_financial_summary(p_as_of date)
returns table (
  engagement_id     uuid,
  engagement_title  text,
  engagement_slug   text,
  client_name       text,
  summary           jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.engagement_id, d.title, d.slug, d.client_name,
    (select to_jsonb(s)
     from public.contract_financial_summary(public.engagement_primary_contract_id(d.engagement_id), p_as_of) s)
  from public.finance_engagement_directory() d;
$$;

-- Awaiting-approval counts for the portfolio (submitted change orders).
create function public.pending_change_order_count(p_engagement_id uuid)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int from public.change_orders
  where engagement_id = p_engagement_id and status = 'submitted';
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.finance_engagement_directory()',
    'public.engagement_primary_contract_id(uuid)',
    'public.invoice_balances(uuid, date)',
    'public.contract_financial_summary(uuid, date)',
    'public.milestone_billing(uuid, date)',
    'public.portfolio_financial_summary(date)',
    'public.pending_change_order_count(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
