-- Disposable synthetic schema for in-app order notification migration tests.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users(id uuid primary key);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.orders (
  id uuid primary key,
  customer_id uuid not null references auth.users(id) on delete cascade,
  provider_owner_id uuid not null references auth.users(id) on delete cascade
);

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
