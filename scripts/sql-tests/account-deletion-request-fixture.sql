-- Synthetic auth/private schema for account-deletion request migration tests.
-- No production secrets, accounts or customer records are used.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create schema private;

create table auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function private.is_current_user_admin()
returns boolean
language sql
stable
as $$
  select case
    when current_setting('request.jwt.claim.admin', true) = 'null' then null::boolean
    else coalesce(current_setting('request.jwt.claim.admin', true), 'false') = 'true'
  end
$$;
