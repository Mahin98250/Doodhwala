-- Disposable synthetic schema; never run this fixture against a live project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;

create schema auth;
create schema private;
grant usage on schema public, private, auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.provider_profiles (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id),
  is_active boolean not null default true,
  display_name text not null default 'Synthetic seller',
  area_name text not null default 'Test area',
  city text not null default 'Test city',
  pin_code text not null default '380001',
  description text not null default '',
  primary_milk_type text not null default 'Cow',
  rating_avg numeric default 0,
  delivery_from time,
  delivery_to time,
  service_radius_km numeric default 5,
  max_open_orders integer default 25,
  max_daily_litres numeric default 250
);
create table public.provider_verifications (
  provider_id uuid primary key references public.provider_profiles(id),
  status text not null
);
create table public.provider_service_areas (
  provider_id uuid primary key references public.provider_profiles(id),
  latitude numeric,
  longitude numeric,
  service_radius_km numeric
);
create table public.milk_products (
  id uuid primary key,
  provider_id uuid not null references public.provider_profiles(id),
  name text not null,
  milk_type text not null default 'Cow',
  price_per_litre numeric not null,
  unit_label text not null default 'L',
  stock boolean not null default true,
  daily_available numeric default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.addresses (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  recipient_name text,
  phone text,
  address_line text,
  area_name text,
  city text,
  pin_code text,
  latitude numeric,
  longitude numeric
);
create table public.orders (
  id uuid primary key,
  customer_id uuid not null references auth.users(id),
  provider_id uuid not null references public.provider_profiles(id),
  provider_owner_id uuid not null references auth.users(id),
  address_id uuid not null references public.addresses(id),
  status text not null default 'placed',
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  customer_note text,
  idempotency_key text,
  order_request_hash text,
  delivery_recipient_name text,
  delivery_phone text,
  delivery_address_line text,
  delivery_area_name text,
  delivery_city text,
  delivery_pin_code text,
  delivery_latitude numeric,
  delivery_longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index orders_customer_key_fixture on public.orders(customer_id,idempotency_key) where idempotency_key is not null;
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.milk_products(id),
  provider_id uuid not null references public.provider_profiles(id),
  product_name_snapshot text not null,
  unit_price numeric not null,
  quantity numeric not null
);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
grant select on public.orders, public.order_items to authenticated;
create policy order_participant_read on public.orders for select to authenticated
  using (customer_id=auth.uid() or provider_owner_id=auth.uid());
create policy order_items_customer_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));

-- Simulate historical public/anonymous grants and several old overloads. The
-- migration must revoke them all without assuming a particular live signature.
create function public.create_order(uuid,uuid,jsonb,text) returns uuid language plpgsql as $$ begin return null; end $$;
create function public.create_order(uuid,uuid,jsonb,text,text) returns uuid language plpgsql as $$ begin return null; end $$;
create function public.create_order_with_promo(uuid,uuid,jsonb,text,text,text) returns uuid language plpgsql as $$ begin return null; end $$;
create function public.create_order_with_promo(uuid,text) returns uuid language plpgsql as $$ begin return null; end $$;
create function private.create_order_secure_with_promo(uuid,uuid,jsonb,text,text,text) returns uuid language plpgsql as $$ begin return null; end $$;

grant execute on all functions in schema public, private to anon, authenticated, service_role;

insert into auth.users(id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');
insert into public.provider_profiles(id,owner_user_id,display_name) values
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Seller one'),
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Seller two');
insert into public.provider_verifications(provider_id,status) values
  ('30000000-0000-4000-8000-000000000001','approved'),
  ('30000000-0000-4000-8000-000000000002','approved');
insert into public.milk_products(id,provider_id,name,price_per_litre) values
  ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Cow milk',50),
  ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Buffalo milk',60);
insert into public.addresses(id,user_id,recipient_name,phone,address_line,area_name,city,pin_code) values
  ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Customer one','9999999999','Synthetic lane','Test','Test city','380001'),
  ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Customer two','9999999998','Synthetic lane','Test','Test city','380002');
