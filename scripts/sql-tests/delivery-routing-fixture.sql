create extension if not exists pgcrypto;
create role anon;
create role authenticated;
create schema auth;
create schema private;
create schema realtime;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table realtime.messages(id bigserial primary key, topic text not null, extension text not null, payload jsonb not null);
create function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.realtime_topic', true), '') $$;
create function realtime.send(payload jsonb,event text,topic text,private boolean default true)
returns void language sql security definer set search_path='' as $$
 insert into realtime.messages(topic,extension,payload) values(topic,'broadcast',jsonb_build_object('event',event,'private',private,'payload',payload))
$$;

create table public.profiles(
 id uuid primary key default gen_random_uuid(),
 full_name text,
 phone text
);
create table public.provider_profiles(
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null unique references public.profiles(id)
);
create table public.provider_service_areas(
 provider_id uuid primary key references public.provider_profiles(id) on delete cascade,
 label text not null,
 latitude numeric not null,
 longitude numeric not null,
 service_radius_km numeric not null default 5
);
create table public.orders(
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id),
 provider_id uuid not null references public.provider_profiles(id),
 provider_owner_id uuid not null references public.profiles(id),
 status text not null default 'placed',
 status_reason text,
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
create table public.order_items(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 quantity numeric(8,2) not null default 1
);

insert into public.profiles(id,full_name) values
 ('00000000-0000-4000-8000-000000000001','First customer'),
 ('00000000-0000-4000-8000-000000000002','Provider owner'),
 ('00000000-0000-4000-8000-000000000003','Delivery driver'),
 ('00000000-0000-4000-8000-000000000004','Other customer');
insert into public.provider_profiles(id,owner_user_id) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
insert into public.provider_service_areas(provider_id,label,latitude,longitude,service_radius_km) values
 ('10000000-0000-4000-8000-000000000001','Test dairy base',23.0200,72.4900,5);
insert into public.orders(
 id,customer_id,provider_id,provider_owner_id,status,
 delivery_recipient_name,delivery_phone,delivery_address_line,delivery_area_name,delivery_city,delivery_pin_code,
 delivery_latitude,delivery_longitude
) values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','ready',
  'Customer One','9999990001','1 Test Street','Bhadaj','Ahmedabad','380060',23.0300,72.5000),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','ready',
  'Customer Two','9999990002','2 Test Street','Bhadaj','Ahmedabad','380060',23.0350,72.5050);
insert into public.order_items(order_id,quantity) values
 ('20000000-0000-4000-8000-000000000001',1.5),
 ('20000000-0000-4000-8000-000000000002',2);
