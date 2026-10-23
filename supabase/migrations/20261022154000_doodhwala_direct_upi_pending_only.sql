-- Do not issue a fresh UPI payment instruction after the seller has confirmed receipt
-- or the order has been rejected/cancelled. The order page can be stale, so enforce this server-side.
create or replace function public.customer_get_order_direct_upi(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select jsonb_build_object(
    'order_id',o.id,
    'amount',o.total,
    'payment_method',o.payment_method,
    'payment_status',o.payment_status,
    'payee_name',s.payee_name,
    'upi_id',s.upi_id
  ) into v_result
  from public.orders o
  join public.provider_payment_settings s on s.provider_id=o.provider_id and s.enabled=true
  join public.provider_profiles p on p.id=o.provider_id and p.is_active=true
  join public.provider_verifications v on v.provider_id=p.id and v.status='approved'
  where o.id=p_order_id
    and o.customer_id=auth.uid()
    and o.payment_method='direct_upi'
    and o.payment_status='payment_pending_verification'
    and o.status not in ('rejected','cancelled');
  if v_result is null then raise exception 'pending_direct_upi_order_not_found'; end if;
  return v_result;
end;
$$;
revoke execute on function public.customer_get_order_direct_upi(uuid) from public,anon;
grant execute on function public.customer_get_order_direct_upi(uuid) to authenticated;
