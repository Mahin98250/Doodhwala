create extension if not exists pgcrypto;
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.profiles(id uuid primary key default gen_random_uuid());
create table public.provider_profiles(id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.profiles(id));
create table public.orders(
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id),
 provider_id uuid references public.provider_profiles(id),
 provider_owner_id uuid references public.profiles(id),
 status text not null default 'placed'
);

insert into public.profiles(id) values
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003');
insert into public.provider_profiles(id,owner_user_id) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
insert into public.orders(id,customer_id,provider_id,provider_owner_id) values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
