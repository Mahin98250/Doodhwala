-- Doodhwala production security hardening: least privilege, safer definer functions, and role integrity.
-- This migration intentionally keeps existing row-scoped CRUD policies intact.

-- Row-level security does not apply to TRUNCATE, and API roles have no need to
-- create triggers or foreign keys. Remove these dangerous, non-application grants.
revoke truncate, references, trigger
on all tables in schema public
from public, anon, authenticated;

-- Future objects created by the migration role must fail closed until an
-- explicit grant is added in the migration that introduces the object.
alter default privileges for role postgres
revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres
revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres
revoke execute on functions from public, anon, authenticated;

-- The profile type is descriptive metadata, never a self-assigned permission.
-- Providers are authorized by an owned provider profile and owner approval;
-- admin is authorized by the private email allowlist, not profiles.account_type.
create or replace function private.protect_profile_account_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_current_user_admin() then
    if tg_op = 'INSERT' then
      new.account_type := 'customer';
    elsif new.account_type is distinct from old.account_type then
      raise exception 'account_type_managed_by_admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_account_type on public.profiles;
create trigger profiles_protect_account_type
before insert or update on public.profiles
for each row execute function private.protect_profile_account_type();

revoke execute on function private.protect_profile_account_type()
from public, anon, authenticated, service_role;

-- These helpers are internal implementation / trigger functions. They should
-- not be callable as generic PUBLIC/anonymous RPCs.
revoke execute on function private.ensure_customer_loyalty(uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.award_order_loyalty_points()
from public, anon, authenticated, service_role;
revoke execute on function private.force_new_provider_pending_inactive()
from public, anon, authenticated, service_role;
revoke execute on function private.handle_customer_loyalty_signup()
from public, anon, authenticated, service_role;

-- The public SECURITY INVOKER wrappers use these for signed-in customer/provider
-- flows, so grant only to authenticated users, not PUBLIC or anon.
revoke execute on function private.create_order_secure_with_promo(uuid, uuid, jsonb, text, text, text)
from public, anon;
grant execute on function private.create_order_secure_with_promo(uuid, uuid, jsonb, text, text, text)
to authenticated;

revoke execute on function private.provider_add_tracking_event_impl(uuid, numeric, numeric, integer, text)
from public, anon;
grant execute on function private.provider_add_tracking_event_impl(uuid, numeric, numeric, integer, text)
to authenticated;

revoke execute on function private.provider_get_performance_impl()
from public, anon;
grant execute on function private.provider_get_performance_impl()
to authenticated;

revoke execute on function private.submit_order_rating_impl(uuid, smallint, text)
from public, anon;
grant execute on function private.submit_order_rating_impl(uuid, smallint, text)
to authenticated;

-- All existing SECURITY DEFINER functions in API schemas use fully qualified
-- table/function references. Empty search_path prevents object shadowing through
-- public/temp schemas if future permissions or configuration change.
do $$
declare
  v_signature text;
begin
  for v_signature in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and p.prosecdef
      and n.nspname in ('public', 'private')
  loop
    execute format('alter function %s set search_path = %L', v_signature, '');
  end loop;
end;
$$;
