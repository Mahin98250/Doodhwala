-- Checkout safety gate for databases where the payment migrations are not yet installed.
-- This does not mean an online payment provider is configured or bank settlement is verified.
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
    and to_regprocedure('public.provider_save_direct_upi(text,text,boolean)') is not null
    and to_regprocedure('public.provider_get_direct_upi_settings()') is not null
    and to_regprocedure('public.provider_confirm_direct_upi_payment(uuid,text)') is not null
    and to_regprocedure('public.provider_confirm_cod_collected(uuid)') is not null
    and exists (
      select 1
      from pg_attribute a
      where a.attrelid = to_regclass('public.orders')
        and a.attname = 'payment_method'
        and a.attnum > 0
        and not a.attisdropped
    )
    and exists (
      select 1
      from pg_attribute a
      where a.attrelid = to_regclass('public.orders')
        and a.attname = 'payment_status'
        and a.attnum > 0
        and not a.attisdropped
    )
    and exists (
      select 1
      from pg_class c
      where c.oid = to_regclass('public.provider_payment_settings')
        and c.relrowsecurity
    )
    and exists (
      select 1
      from pg_trigger t
      where t.tgrelid = to_regclass('public.orders')
        and t.tgname = 'orders_guard_payment_field_writes'
        and t.tgenabled in ('O', 'A')
        and not t.tgisinternal
    )
    and exists (
      select 1
      from pg_trigger t
      where t.tgrelid = to_regclass('public.orders')
        and t.tgname = 'orders_require_payment_choice_before_acceptance'
        and t.tgenabled in ('O', 'A')
        and not t.tgisinternal
    )
  into v_ready;

  return jsonb_build_object('ready', coalesce(v_ready, false));
end;
$$;

revoke execute on function public.customer_order_payment_controls_ready() from public, anon;
grant execute on function public.customer_order_payment_controls_ready() to authenticated;

comment on function public.customer_order_payment_controls_ready() is
'Fails checkout closed when payment-choice schema, owner-scoped RPCs, RLS, or payment-write guards are missing. Does not assert that a PSP is configured, that UPI ownership is verified, or that any money moved.';
