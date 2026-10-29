-- Isolated synthetic schema for provider monthly-invoice idempotency migration validation.
-- This fixture contains no customer data, live secrets, or production objects.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create schema private;

create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz
);

create table private.admin_allowlist (
  user_email text not null,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $func$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$func$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $func$
  select jsonb_build_object('email', nullif(current_setting('request.jwt.claim.email', true), ''))
$func$;

-- The custom "admin=null" claim is only a test seam for verifying SQL RPCs
-- reject an unexpected NULL helper result. The migration under test replaces
-- this fixture helper with its production confirmed-email implementation.
create or replace function private.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $func$
  select case
    when current_setting('request.jwt.claim.admin', true) = 'null' then null::boolean
    else exists (
      select 1
      from private.admin_allowlist as a
      join auth.users as u on u.id = auth.uid()
      where u.email_confirmed_at is not null
        and lower(trim(a.user_email)) = lower(u.email)
        and lower(u.email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  end
$func$;

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

create table public.provider_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.provider_subscription_invoices(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  amount_paise bigint not null check(amount_paise > 0),
  method text not null check(method in ('manual_upi','bank_transfer','cash')),
  reference text not null check(length(trim(reference)) between 3 and 120),
  received_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique(reference)
);
