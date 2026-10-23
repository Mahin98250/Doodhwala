-- Re-check seller eligibility in the final payment-choice RPC definition.
-- A previous migration replaced the approval-aware version with a check that only
-- verified an enabled setting and active profile. Keep direct UPI unavailable unless
-- the seller is still active and approved at the moment a new choice is saved.
-- This is an eligibility check only; it does not verify settlement or move money.

create or replace function public.customer_set_order_payment_method(p_order_id uuid, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_ready boolean;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if p_method is null or p_method not in ('direct_upi','cod') then
    raise exception 'invalid_payment_method';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
    and customer_id = auth.uid()
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  -- Idempotent retry after a lost response remains safe. No payment fields are
  -- changed on this path; the order-scoped UPI-details RPC independently re-checks
  -- active/approved seller status before exposing payment instructions.
  if v_order.payment_method = p_method then
    return jsonb_build_object(
      'order_id', p_order_id,
      'payment_method', p_method,
      'payment_status', v_order.payment_status,
      'status', v_order.status
    );
  end if;

  if v_order.status <> 'placed' then
    raise exception 'order_no_longer_payable';
  end if;

  if v_order.payment_method <> 'selection_pending' then
    raise exception 'payment_method_already_selected';
  end if;

  if p_method = 'direct_upi' then
    select exists (
      select 1
      from public.provider_payment_settings s
      join public.provider_profiles p
        on p.id = s.provider_id
       and p.is_active = true
      join public.provider_verifications v
        on v.provider_id = p.id
       and v.status = 'approved'
      where s.provider_id = v_order.provider_id
        and s.enabled = true
    )
    into v_ready;

    if not coalesce(v_ready, false) then
      raise exception 'seller_direct_upi_not_configured';
    end if;
  end if;

  -- Required by orders_guard_payment_field_writes. This transaction-local flag
  -- only permits the update inside this ownership-checked SECURITY DEFINER RPC.
  perform set_config('doodhwala.payment_rpc', 'on', true);

  if p_method = 'direct_upi' then
    update public.orders
    set payment_method = 'direct_upi',
        payment_status = 'payment_pending_verification',
        payment_reference = null,
        payment_confirmed_by = null,
        payment_confirmed_at = null
    where id = p_order_id;

    v_status := 'payment_pending_verification';
  else
    update public.orders
    set payment_method = 'cod',
        payment_status = 'cash_on_delivery',
        payment_reference = null,
        payment_confirmed_by = null,
        payment_confirmed_at = null
    where id = p_order_id;

    v_status := 'cash_on_delivery';
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'payment_method', p_method,
    'payment_status', v_status,
    'status', v_order.status
  );
end;
$$;

revoke execute on function public.customer_set_order_payment_method(uuid,text) from public, anon;
grant execute on function public.customer_set_order_payment_method(uuid,text) to authenticated;

comment on function public.customer_set_order_payment_method(uuid,text) is
'Customer-owned payment choice. Direct UPI requires an enabled setting and an active, approved seller; this records intent only and does not verify payment settlement.';
