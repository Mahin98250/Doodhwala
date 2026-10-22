-- Payment status is security-sensitive. Existing order-table grants/policies must not let a
-- customer or seller forge payment fields with a direct table UPDATE. Only the ownership-checked
-- SECURITY DEFINER RPCs below set a transaction-local capability before changing payment columns.
create or replace function public.doodhwala_guard_payment_field_writes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.payment_method is distinct from old.payment_method
      or new.payment_status is distinct from old.payment_status
      or new.payment_reference is distinct from old.payment_reference
      or new.payment_confirmed_by is distinct from old.payment_confirmed_by
      or new.payment_confirmed_at is distinct from old.payment_confirmed_at)
     and current_setting('doodhwala.payment_rpc', true) is distinct from 'on' then
    raise exception 'payment_fields_require_authorized_rpc';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_guard_payment_field_writes on public.orders;
create trigger orders_guard_payment_field_writes
before update of payment_method,payment_status,payment_reference,payment_confirmed_by,payment_confirmed_at
on public.orders for each row execute function public.doodhwala_guard_payment_field_writes();
revoke execute on function public.doodhwala_guard_payment_field_writes() from public,anon,authenticated;

create or replace function public.customer_set_order_payment_method(p_order_id uuid, p_method text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
declare v_ready boolean;
declare v_status text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_method not in ('direct_upi','cod') then raise exception 'invalid_payment_method'; end if;
  select * into v_order from public.orders where id=p_order_id and customer_id=auth.uid() for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.payment_method=p_method then
    if p_method='direct_upi' then v_status:='payment_pending_verification'; else v_status:='cash_on_delivery'; end if;
    return jsonb_build_object('order_id',p_order_id,'payment_method',p_method,'payment_status',v_order.payment_status,'status',v_order.status);
  end if;
  if v_order.status <> 'placed' then raise exception 'order_no_longer_payable'; end if;
  if v_order.payment_method <> 'selection_pending' then raise exception 'payment_method_already_selected'; end if;
  if p_method='direct_upi' then
    select exists(select 1 from public.provider_payment_settings s join public.provider_profiles p on p.id=s.provider_id
      where s.provider_id=v_order.provider_id and s.enabled=true and p.is_active=true) into v_ready;
    if not v_ready then raise exception 'seller_direct_upi_not_configured'; end if;
  end if;
  perform set_config('doodhwala.payment_rpc','on',true);
  if p_method='direct_upi' then
    update public.orders set payment_method='direct_upi',payment_status='payment_pending_verification',
      payment_reference=null,payment_confirmed_by=null,payment_confirmed_at=null where id=p_order_id;
    v_status:='payment_pending_verification';
  else
    update public.orders set payment_method='cod',payment_status='cash_on_delivery',
      payment_reference=null,payment_confirmed_by=null,payment_confirmed_at=null where id=p_order_id;
    v_status:='cash_on_delivery';
  end if;
  return jsonb_build_object('order_id',p_order_id,'payment_method',p_method,'payment_status',v_status,'status',v_order.status);
end;
$$;
revoke execute on function public.customer_set_order_payment_method(uuid,text) from public,anon;
grant execute on function public.customer_set_order_payment_method(uuid,text) to authenticated;

create or replace function public.provider_confirm_direct_upi_payment(p_order_id uuid, p_reference text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_order from public.orders where id=p_order_id and provider_owner_id=auth.uid() for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.payment_method <> 'direct_upi' then raise exception 'not_direct_upi_order'; end if;
  if v_order.payment_status <> 'payment_pending_verification' then raise exception 'payment_not_pending_verification'; end if;
  if v_order.status in ('rejected','cancelled') then raise exception 'order_not_payable'; end if;
  perform set_config('doodhwala.payment_rpc','on',true);
  update public.orders set payment_status='paid_direct_to_seller',
    payment_reference=nullif(left(trim(coalesce(p_reference,'')),120),''),
    payment_confirmed_by=auth.uid(),payment_confirmed_at=now() where id=p_order_id;
  return jsonb_build_object('order_id',p_order_id,'payment_status','paid_direct_to_seller');
end;
$$;
revoke execute on function public.provider_confirm_direct_upi_payment(uuid,text) from public,anon;
grant execute on function public.provider_confirm_direct_upi_payment(uuid,text) to authenticated;

create or replace function public.provider_confirm_cod_collected(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_order from public.orders where id=p_order_id and provider_owner_id=auth.uid() for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.payment_method <> 'cod' then raise exception 'not_cod_order'; end if;
  if v_order.payment_status <> 'cash_on_delivery' then raise exception 'cod_not_pending'; end if;
  if v_order.status <> 'delivered' then raise exception 'cash_can_only_be_confirmed_after_delivery'; end if;
  perform set_config('doodhwala.payment_rpc','on',true);
  update public.orders set payment_status='paid_cod',payment_confirmed_by=auth.uid(),payment_confirmed_at=now()
    where id=p_order_id;
  return jsonb_build_object('order_id',p_order_id,'payment_status','paid_cod');
end;
$$;
revoke execute on function public.provider_confirm_cod_collected(uuid) from public,anon;
grant execute on function public.provider_confirm_cod_collected(uuid) to authenticated;
