-- Isolated synthetic schema for provider monthly-invoice idempotency migration validation.
-- This fixture contains no customer data, live secrets, or production objects.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema private;

create table auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function private.is_current_user_admin()
returns boolean
language sql
stable
as $$
  select case
    when current_setting('request.jwt.claim.admin', true) = 'null' then null::boolean
    else coalesce(current_setting('request.jwt.claim.admin', true), 'false') = 'true'
  end
$$;

create table public.provider_profiles (
  id uuid primary key,
  owner_user_id uuid,
  created_at timestamptz not null default now()
);

create table public.provider_billing_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_paise bigint not null check(amount_paise > 0),
  is_active boolean not null default true
);

create table public.provider_subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  plan_id uuid references public.provider_billing_plans(id) on delete set null,
  plan_name_snapshot text not null,
  amount_paise bigint not null check(amount_paise > 0),
  currency text not null default 'INR' check(currency = 'INR'),
  period_start date not null,
  period_end date not null,
  due_date date not null,
  status text not null default 'due' check(status in ('due','paid','void')),
  invoice_number text not null unique,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  voided_at timestamptz,
  check(period_end >= period_start),
  check((status='paid') = (paid_at is not null)),
  check((status='void') = (voided_at is not null))
);
