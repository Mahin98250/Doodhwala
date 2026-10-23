-- Disposable PostgreSQL fixture for validating the nearby-search migration.
-- This is synthetic data and does not connect to Supabase production.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'create role anon nologin';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'create role authenticated nologin';
  end if;
end;
$$;

create table public.provider_profiles (
  id uuid primary key,
  owner_user_id uuid,
  display_name text not null,
  owner_name text not null default 'Fixture Owner',
  phone text not null default '0000000000',
  primary_milk_type text not null,
  area_name text not null,
  city text not null,
  pin_code text not null,
  description text,
  delivery_from time,
  delivery_to time,
  service_radius_km numeric not null default 5,
  rating_avg numeric not null default 0,
  is_active boolean not null default true
);

create table public.provider_service_areas (
  provider_id uuid primary key references public.provider_profiles(id),
  latitude numeric not null,
  longitude numeric not null
);

create table public.provider_verifications (
  provider_id uuid primary key references public.provider_profiles(id),
  status text not null
);

create table public.milk_products (
  id uuid primary key,
  provider_id uuid not null references public.provider_profiles(id),
  name text not null,
  milk_type text not null,
  price_per_litre numeric not null,
  unit_label text not null default '1 L',
  stock boolean not null default true,
  daily_available boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- These mirror the supporting indexes already defined by the base migration.
create index provider_service_areas_lat_lng_idx
  on public.provider_service_areas(latitude, longitude);
create index milk_products_active_idx
  on public.milk_products(provider_id, is_active, stock);

insert into public.provider_profiles
  (id, display_name, primary_milk_type, area_name, city, pin_code, service_radius_km, rating_avg, is_active)
values
  ('00000000-0000-0000-0000-000000000001','Nearby Dairy','cow','Bhadaj','Ahmedabad','380060',5,4.8,true),
  ('00000000-0000-0000-0000-000000000002','Far Dairy','buffalo','South Mumbai','Mumbai','400001',5,4.5,true),
  ('00000000-0000-0000-0000-000000000003','Dateline Dairy','cow','Island Road','Dateline City','000001',10,4.2,true),
  ('00000000-0000-0000-0000-000000000004','Pending Dairy','cow','Bhadaj','Ahmedabad','380060',5,4.9,true),
  ('00000000-0000-0000-0000-000000000005','Inactive Dairy','cow','Bhadaj','Ahmedabad','380060',5,4.9,false);

insert into public.provider_service_areas(provider_id, latitude, longitude)
values
  ('00000000-0000-0000-0000-000000000001',23.0300,72.5800),
  ('00000000-0000-0000-0000-000000000002',19.0760,72.8777),
  ('00000000-0000-0000-0000-000000000003',10.0000,-179.9800),
  ('00000000-0000-0000-0000-000000000004',23.0300,72.5800),
  ('00000000-0000-0000-0000-000000000005',23.0300,72.5800);

insert into public.provider_verifications(provider_id, status)
values
  ('00000000-0000-0000-0000-000000000001','approved'),
  ('00000000-0000-0000-0000-000000000002','approved'),
  ('00000000-0000-0000-0000-000000000003','approved'),
  ('00000000-0000-0000-0000-000000000004','pending'),
  ('00000000-0000-0000-0000-000000000005','approved');

insert into public.milk_products
  (id, provider_id, name, milk_type, price_per_litre, stock, is_active)
values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Cow Milk','cow',70,true,true),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Buffalo Milk','buffalo',85,true,true),
  ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Hidden Product','cow',60,true,false),
  ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Out Of Stock','cow',65,false,true),
  ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000003','Island Milk','cow',75,true,true);

-- Minimal synthetic order table required by the order-capacity index migration.
-- No production/customer data is used.
create table public.orders (
  id uuid primary key,
  provider_id uuid not null,
  status text not null,
  created_at timestamptz not null default now()
);
