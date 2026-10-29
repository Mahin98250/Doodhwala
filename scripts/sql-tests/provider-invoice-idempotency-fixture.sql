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
