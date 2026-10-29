-- Phase 1 hardening: require an explicit seller attestation before publishing UPI details.
-- This is an ownership declaration, NOT an independent verification of the bank account.
-- Existing enabled settings without an attestation are disabled so customers cannot be
-- shown unconfirmed payment destinations after this migration is applied.

alter table public.provider_payment_settings
  add column if not exists upi_ownership_attested_at timestamptz,
  add column if not exists upi_ownership_attested_by uuid references auth.users(id) on delete set null;

update public.provider_payment_settings
set enabled = false,
    upi_ownership_attested_at = null,
    upi_ownership_attested_by = null
where enabled = true
  and (upi_ownership_attested_at is null or upi_ownership_attested_by is null);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_payment_settings'::regclass
      and conname = 'provider_payment_settings_enabled_requires_owner_attestation'
  ) then
    alter table public.provider_payment_settings
      add constraint provider_payment_settings_enabled_requires_owner_attestation
      check (
        not enabled
        or (upi_ownership_attested_at is not null and upi_ownership_attested_by is not null)
      );
  end if;
end;
$$;

-- Remove the legacy three-argument RPC. Older callers that omit the new required
-- attestation input resolve to the default false and cannot enable payment details.
drop function if exists public.provider_save_direct_upi(text, text, boolean);

create function public.provider_save_direct_upi(
  p_upi_id text,
  p_payee_name text,
  p_enabled boolean default false,
  p_ownership_confirmed boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider_id uuid;
  v_ownership_attested_at timestamptz;
  v_ownership_attested_by uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if length(trim(coalesce(p_upi_id, ''))) < 3
    or length(trim(p_upi_id)) > 255
    or p_upi_id !~ '^[A-Za-z0-9._-]{2,200}@[A-Za-z0-9.-]{2,100}$' then
    raise exception 'invalid_upi_id';
  end if;

  if length(trim(coalesce(p_payee_name, ''))) < 2
    or length(trim(p_payee_name)) > 120
    or p_payee_name ~ '[[:cntrl:]]' then
    raise exception 'invalid_payee_name';
  end if;

  if coalesce(p_enabled, false) and not coalesce(p_ownership_confirmed, false) then
    raise exception 'seller_upi_ownership_confirmation_required';
  end if;

  select p.id into v_provider_id
  from public.provider_profiles p
  where p.owner_user_id = auth.uid()
  limit 1;

  if v_provider_id is null then
    raise exception 'provider_not_found';
  end if;

  if coalesce(p_enabled, false) and not exists (
    select 1
    from public.provider_profiles p
    join public.provider_verifications v on v.provider_id = p.id
    where p.id = v_provider_id
      and p.is_active = true
      and v.status = 'approved'
  ) then
    raise exception 'provider_not_approved_for_direct_upi';
  end if;

  -- A fresh explicit attestation is recorded for every enabled save. Disabling the
  -- destination clears the attestation; re-enabling requires the seller to attest again.
  v_ownership_attested_at := case when coalesce(p_enabled, false) then now() else null end;
  v_ownership_attested_by := case when coalesce(p_enabled, false) then auth.uid() else null end;

  insert into public.provider_payment_settings (
    provider_id, upi_id, payee_name, enabled,
    upi_ownership_attested_at, upi_ownership_attested_by, updated_at
  )
  values (
    v_provider_id, trim(p_upi_id), trim(p_payee_name), coalesce(p_enabled, false),
    v_ownership_attested_at, v_ownership_attested_by, now()
  )
  on conflict (provider_id) do update set
    upi_id = excluded.upi_id,
    payee_name = excluded.payee_name,
    enabled = excluded.enabled,
    upi_ownership_attested_at = excluded.upi_ownership_attested_at,
    upi_ownership_attested_by = excluded.upi_ownership_attested_by,
    updated_at = now();

  return true;
end;
$$;

revoke execute on function public.provider_save_direct_upi(text, text, boolean, boolean) from public, anon;
grant execute on function public.provider_save_direct_upi(text, text, boolean, boolean) to authenticated;

create or replace function public.provider_get_direct_upi_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select jsonb_build_object(
    'upi_id', s.upi_id,
    'payee_name', s.payee_name,
    'enabled', s.enabled,
    'ownership_confirmed', (
      s.enabled
      and s.upi_ownership_attested_at is not null
      and s.upi_ownership_attested_by = p.owner_user_id
    ),
    'ownership_confirmed_at', s.upi_ownership_attested_at,
    'updated_at', s.updated_at
  )
  into v_result
  from public.provider_payment_settings s
  join public.provider_profiles p on p.id = s.provider_id
  where p.owner_user_id = auth.uid()
  limit 1;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke execute on function public.provider_get_direct_upi_settings() from public, anon;
grant execute on function public.provider_get_direct_upi_settings() to authenticated;

-- The constraint prevents any enabled setting without an attestation. This readiness
-- probe additionally verifies that the new RPC and guard are present before checkout.
create or replace function public.customer_order_payment_controls_ready()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ready boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select
    to_regclass('public.provider_payment_settings') is not null
    and to_regprocedure('public.customer_set_order_payment_method(uuid,text)') is not null
    and to_regprocedure('public.customer_check_provider_direct_upi(uuid)') is not null
    and to_regprocedure('public.customer_get_order_direct_upi(uuid)') is not null
    and to_regprocedure('public.provider_save_direct_upi(text,text,boolean,boolean)') is not null
    and to_regprocedure('public.provider_get_direct_upi_settings()') is not null
    and to_regprocedure('public.provider_confirm_direct_upi_payment(uuid,text)') is not null
    and to_regprocedure('public.provider_confirm_cod_collected(uuid)') is not null
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = to_regclass('public.orders')
        and a.attname = 'payment_method'
        and a.attnum > 0 and not a.attisdropped
    )
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = to_regclass('public.orders')
        and a.attname = 'payment_status'
        and a.attnum > 0 and not a.attisdropped
    )
    and exists (
      select 1 from pg_class c
      where c.oid = to_regclass('public.provider_payment_settings')
        and c.relrowsecurity
    )
    and exists (
      select 1 from pg_class c
      where c.oid = to_regclass('public.orders')
        and c.relrowsecurity
    )
    and exists (
      select 1 from pg_constraint c
      where c.conrelid = to_regclass('public.provider_payment_settings')
        and c.conname = 'provider_payment_settings_enabled_requires_owner_attestation'
        and c.contype = 'c' and c.convalidated
    )
    and exists (
      select 1 from pg_trigger t
      where t.tgrelid = to_regclass('public.orders')
        and t.tgname = 'orders_guard_payment_field_writes'
        and t.tgenabled in ('O', 'A') and not t.tgisinternal
    )
    and exists (
      select 1 from pg_trigger t
      where t.tgrelid = to_regclass('public.orders')
        and t.tgname = 'orders_require_payment_choice_before_acceptance'
        and t.tgenabled in ('O', 'A') and not t.tgisinternal
    )
  into v_ready;

  return jsonb_build_object('ready', coalesce(v_ready, false));
end;
$$;

revoke execute on function public.customer_order_payment_controls_ready() from public, anon;
grant execute on function public.customer_order_payment_controls_ready() to authenticated;

comment on column public.provider_payment_settings.upi_ownership_attested_at is
'Timestamp of the seller attestation that these UPI details belong to their business. Not independently verified by Doodhwala.';
comment on column public.provider_payment_settings.upi_ownership_attested_by is
'Authenticated seller user who declared ownership of the configured UPI destination.';
comment on function public.provider_save_direct_upi(text,text,boolean,boolean) is
'Seller-owned UPI configuration. Enabling requires explicit ownership attestation and seller approval; attestation is not bank verification.';
