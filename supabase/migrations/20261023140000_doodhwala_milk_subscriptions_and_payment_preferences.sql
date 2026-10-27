-- Doodhwala recurring milk plans and payment preferences.
-- Schema-only migration: no payment provider is activated and no existing orders are changed.
create extension if not exists pgcrypto;

create table if not exists public.milk_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null,
  provider_owner_id uuid not null references auth.users(id) on delete cascade,
  milk_product_id uuid,
  milk_name text not null check (length(trim(milk_name)) between 1 and 120),
  quantity_litres_per_day numeric(8,3) not null check (quantity_litres_per_day > 0 and quantity_litres_per_day <= 1000),
  delivery_time time not null,
  start_date date not null,
  end_date date not null,
  duration_kind text not null check (duration_kind in ('month','year','custom')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','active','paused','completed','cancelled')),
  rejection_reason text,
  customer_note text,
  seller_note text,
  payment_method text not null
    check (payment_method in ('cod','upi_direct','pay_full_online','pay_per_delivery','pay_weekly','pay_monthly')),
  payment_timing text not null default 'after_delivery'
    check (payment_timing in ('advance_full','per_delivery','weekly','monthly')),
  price_per_litre numeric(10,2) not null check (price_per_litre >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check ((status <> 'rejected') or (rejection_reason is not null and length(trim(rejection_reason)) > 0))
);

create index if not exists milk_subscriptions_customer_recent_idx
  on public.milk_subscriptions (customer_id, created_at desc);
create index if not exists milk_subscriptions_provider_status_dates_idx
  on public.milk_subscriptions (provider_id, status, start_date, end_date);
create index if not exists milk_subscriptions_owner_pending_idx
  on public.milk_subscriptions (provider_owner_id, created_at desc)
  where status = 'pending';

create table if not exists public.milk_subscription_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.milk_subscriptions(id) on delete cascade,
  delivery_date date not null,
  planned_quantity_litres numeric(8,3) not null check (planned_quantity_litres > 0),
  status text not null default 'scheduled'
    check (status in ('scheduled','delivered','missed','skipped','cancelled')),
  delivered_at timestamptz,
  delivery_note text,
  created_at timestamptz not null default now(),
  unique (subscription_id, delivery_date)
);
create index if not exists milk_subscription_deliveries_date_status_idx
  on public.milk_subscription_deliveries (delivery_date, status);
create index if not exists milk_subscription_deliveries_subscription_date_idx
  on public.milk_subscription_deliveries (subscription_id, delivery_date);

create table if not exists public.milk_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.milk_subscriptions(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  provider_owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  payment_method text not null
    check (payment_method in ('cod','upi_direct','pay_full_online','pay_per_delivery','pay_weekly','pay_monthly')),
  status text not null default 'pending'
    check (status in ('pending','awaiting_confirmation','paid','failed','refunded','cancelled')),
  period_start date,
  period_end date,
  external_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start)
);
create index if not exists milk_subscription_payments_customer_recent_idx
  on public.milk_subscription_payments (customer_id, created_at desc);
create index if not exists milk_subscription_payments_provider_recent_idx
  on public.milk_subscription_payments (provider_owner_id, created_at desc);

alter table public.milk_subscriptions enable row level security;
alter table public.milk_subscription_deliveries enable row level security;
alter table public.milk_subscription_payments enable row level security;

drop policy if exists "Customers and assigned sellers read milk subscriptions" on public.milk_subscriptions;
create policy "Customers and assigned sellers read milk subscriptions"
  on public.milk_subscriptions for select to authenticated
  using ((select auth.uid()) = customer_id or (select auth.uid()) = provider_owner_id);

drop policy if exists "Customers create own pending milk subscriptions" on public.milk_subscriptions;
create policy "Customers create own pending milk subscriptions"
  on public.milk_subscriptions for insert to authenticated
  with check ((select auth.uid()) = customer_id and status = 'pending'
    and approved_at is null and rejected_at is null and rejection_reason is null);

-- Approval/rejection must go through a trusted RPC/service after atomic capacity checks.
-- Direct customer/seller updates are deliberately not granted by this migration.

drop policy if exists "Participants read subscription deliveries" on public.milk_subscription_deliveries;
create policy "Participants read subscription deliveries"
  on public.milk_subscription_deliveries for select to authenticated
  using (exists (
    select 1 from public.milk_subscriptions s
    where s.id = subscription_id
      and ((select auth.uid()) = s.customer_id or (select auth.uid()) = s.provider_owner_id)
  ));

drop policy if exists "Participants read subscription payments" on public.milk_subscription_payments;
create policy "Participants read subscription payments"
  on public.milk_subscription_payments for select to authenticated
  using ((select auth.uid()) = customer_id or (select auth.uid()) = provider_owner_id);

-- Payment rows must only be written by a trusted server/RPC. No client insert/update policy.
