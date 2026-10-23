-- Disposable, synthetic Supabase-like schema for the payment audit migration.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;

create schema if not exists auth;
create table auth.users (
  id uuid primary key
);
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.orders (
  id uuid primary key,
  customer_id uuid not null references auth.users(id),
  provider_owner_id uuid not null references auth.users(id),
  status text not null default 'placed',
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null,
  payment_status text not null,
  payment_reference text,
  payment_confirmed_by uuid references auth.users(id),
  payment_confirmed_at timestamptz
);

insert into auth.users(id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');
insert into public.orders(
  id, customer_id, provider_owner_id, status, total,
  payment_method, payment_status
) values (
  '30000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'placed', 68.00, 'direct_upi', 'payment_pending_verification'
);
