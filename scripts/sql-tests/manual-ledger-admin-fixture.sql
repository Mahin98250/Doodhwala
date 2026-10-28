-- Synthetic-only supplement to atomic-checkout-fixture.sql. Never use on a live DB.
-- The real private.is_current_user_admin() and deployed policies must be tested
-- independently in isolated staging; this stub exercises only the billing RPC
-- guards and separation of the two ledgers in a disposable PostgreSQL fixture.
alter table public.provider_profiles add column created_at timestamptz not null default now();
grant select on public.provider_profiles to authenticated;
create function private.is_current_user_admin() returns boolean language sql stable
as $$ select current_setting('request.jwt.claim.admin',true)='true' $$;
insert into auth.users(id) values('90000000-0000-4000-8000-000000000001');
