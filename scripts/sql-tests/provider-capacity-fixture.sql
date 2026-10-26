-- Isolated schema for compiling the secure provider-capacity checkout function.
-- No production credentials, data, or network connections are used.
do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then execute 'create role anon nologin'; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then execute 'create role authenticated nologin'; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then execute 'create role service_role nologin'; end if;
end $$;

create schema if not exists auth;
create schema if not exists private;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

-- Model the legacy four-argument function that prior migrations revoke from client roles.
-- The capacity migration must not accidentally restore client access to this overload.
create or replace function private.create_order_secure(
  p_provider_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_customer_note text default null
)
returns uuid language sql as $ select null::uuid $;

create table public.provider_profiles (
  id uuid primary key,
  owner_user_id uuid,
  max_open_orders integer not null default 25,
  max_daily_litres numeric(10,2) not null default 250,
  is_active boolean not null default true
);
create table public.provider_verifications (provider_id uuid, status text);
create table public.addresses (id uuid primary key, user_id uuid);
create table public.orders (
  id uuid primary key, customer_id uuid, provider_id uuid, provider_owner_id uuid,
  address_id uuid, status text, customer_note text, created_at timestamptz not null default now(),
  subtotal numeric(10,2), delivery_fee numeric(10,2), total numeric(10,2), updated_at timestamptz
);
create table public.order_items (
  order_id uuid, product_id uuid, provider_id uuid, product_name_snapshot text,
  unit_price numeric(10,2), quantity numeric(10,2)
);
create table public.milk_products (
  id uuid primary key, provider_id uuid, name text, price_per_litre numeric(10,2),
  stock boolean, is_active boolean
);
