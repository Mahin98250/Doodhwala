-- Prevent the seller accepting an order in the tiny interval between order creation
-- and the customer saving their payment choice. This is a concurrency guard, not a payment verifier.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('selection_pending','direct_upi','cod'));
alter table public.orders alter column payment_method set default 'selection_pending';
alter table public.orders alter column payment_status set default 'unpaid';

create or replace function public.doodhwala_require_payment_choice_before_acceptance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.payment_method = 'selection_pending'
    and new.status in ('accepted','preparing','ready','out_for_delivery','delivered') then
    raise exception 'payment_method_selection_pending';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_require_payment_choice_before_acceptance on public.orders;
create trigger orders_require_payment_choice_before_acceptance
before update of status on public.orders
for each row execute function public.doodhwala_require_payment_choice_before_acceptance();
revoke execute on function public.doodhwala_require_payment_choice_before_acceptance() from public,anon,authenticated;

create or replace function public.customer_set_order_payment_method(p_order_id uuid, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype;
declare v_ready boolean;
declare v_status text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_method not in ('direct_upi','cod') then raise exception 'invalid_payment_method'; end if;
  select * into v_order from public.orders
    where id=p_order_id and customer_id=auth.uid()
    for update;
  if not found then raise exception 'order_not_found'; end if;

  -- Idempotent retry: if this exact choice was already saved, return it even if the
  -- seller has since accepted the order.
  if v_order.payment_method=p_method then
    if p_method='direct_upi' then v_status:='payment_pending_verification';
    else v_status:='cash_on_delivery'; end if;
    return jsonb_build_object('order_id',p_order_id,'payment_method',p_method,
      'payment_status',v_order.payment_status,'status',v_order.status);
  end if;

  if v_order.status <> 'placed' then raise exception 'order_no_longer_payable'; end if;
  if v_order.payment_method <> 'selection_pending' then raise exception 'payment_method_already_selected'; end if;

  if p_method='direct_upi' then
    select exists(
      select 1 from public.provider_payment_settings s
      join public.provider_profiles p on p.id=s.provider_id
      join public.provider_verifications v on v.provider_id=p.id and v.status='approved'
      where s.provider_id=v_order.provider_id and s.enabled=true and p.is_active=true
    ) into v_ready;
    if not v_ready then raise exception 'seller_direct_upi_not_configured'; end if;
    update public.orders set payment_method='direct_upi',payment_status='payment_pending_verification',
      payment_reference=null,payment_confirmed_by=null,payment_confirmed_at=null
      where id=p_order_id;
    v_status:='payment_pending_verification';
  else
    update public.orders set payment_method='cod',payment_status='cash_on_delivery',
      payment_reference=null,payment_confirmed_by=null,payment_confirmed_at=null
      where id=p_order_id;
    v_status:='cash_on_delivery';
  end if;
  return jsonb_build_object('order_id',p_order_id,'payment_method',p_method,
    'payment_status',v_status,'status',v_order.status);
end;
$$;
revoke execute on function public.customer_set_order_payment_method(uuid,text) from public,anon;
grant execute on function public.customer_set_order_payment_method(uuid,text) to authenticated;
