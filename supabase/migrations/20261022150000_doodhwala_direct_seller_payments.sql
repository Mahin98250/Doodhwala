-- Direct-to-seller UPI + COD MVP.
-- Doodhwala does not collect, hold, or settle seller funds. This migration stores
-- order payment instructions and seller-entered confirmations only; it does not verify bank settlement.
alter table public.orders
  add column if not exists payment_method text not null default 'cod'
    check (payment_method in ('direct_upi','cod')),
  add column if not exists payment_status text not null default 'cash_on_delivery'
    check (payment_status in ('unpaid','payment_pending_verification','paid_direct_to_seller','cash_on_delivery','paid_cod','payment_failed','refund_or_reversal_review')),
  add column if not exists payment_reference text,
  add column if not exists payment_confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists payment_confirmed_at timestamptz;

create table if not exists public.provider_payment_settings (
  provider_id uuid primary key references public.provider_profiles(id) on delete cascade,
  upi_id text not null check (length(trim(upi_id)) between 3 and 255),
  payee_name text not null check (length(trim(payee_name)) between 2 and 120),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.provider_payment_settings enable row level security;
revoke all on public.provider_payment_settings from anon, authenticated;
grant select, insert, update, delete on public.provider_payment_settings to service_role;

create or replace function public.provider_save_direct_upi(p_upi_id text, p_payee_name text, p_enabled boolean default true)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_provider_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if length(trim(coalesce(p_upi_id,''))) < 3 or length(trim(p_upi_id)) > 255
    or p_upi_id !~ '^[A-Za-z0-9._-]{2,200}@[A-Za-z0-9.-]{2,100}$' then
    raise exception 'invalid_upi_id';
  end if;
  if length(trim(coalesce(p_payee_name,''))) < 2 or length(trim(p_payee_name)) > 120 then
    raise exception 'invalid_payee_name';
  end if;
  select id into v_provider_id from public.provider_profiles
    where owner_user_id = auth.uid() limit 1;
  if v_provider_id is null then raise exception 'provider_not_found'; end if;
  if coalesce(p_enabled,false) and not exists (
    select 1
    from public.provider_profiles p
    join public.provider_verifications v on v.provider_id=p.id
    where p.id=v_provider_id and p.is_active=true and v.status='approved'
  ) then
    raise exception 'provider_not_approved_for_direct_upi';
  end if;

  insert into public.provider_payment_settings(provider_id,upi_id,payee_name,enabled,updated_at)
  values(v_provider_id,trim(p_upi_id),trim(p_payee_name),coalesce(p_enabled,false),now())
  on conflict(provider_id) do update set
    upi_id=excluded.upi_id,
    payee_name=excluded.payee_name,
    enabled=excluded.enabled,
    updated_at=now();
  return true;
end;
$$;
revoke execute on function public.provider_save_direct_upi(text,text,boolean) from public,anon;
grant execute on function public.provider_save_direct_upi(text,text,boolean) to authenticated;

create or replace function public.customer_check_provider_direct_upi(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.provider_payment_settings s
    join public.provider_profiles p on p.id=s.provider_id
    join public.provider_verifications v on v.provider_id=p.id and v.status='approved'
    where s.provider_id=p_provider_id and s.enabled=true and p.is_active=true
  );
$$;
revoke execute on function public.customer_check_provider_direct_upi(uuid) from public,anon;
grant execute on function public.customer_check_provider_direct_upi(uuid) to authenticated;

create or replace function public.customer_set_order_payment_method(p_order_id uuid, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype;
declare v_ready boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_method not in ('direct_upi','cod') then raise exception 'invalid_payment_method'; end if;
  select * into v_order from public.orders
    where id=p_order_id and customer_id=auth.uid()
    for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status <> 'placed' then raise exception 'order_no_longer_payable'; end if;

  if p_method='direct_upi' then
    select exists(select 1 from public.provider_payment_settings s
      where s.provider_id=v_order.provider_id and s.enabled=true) into v_ready;
    if not v_ready then raise exception 'seller_direct_upi_not_configured'; end if;
    update public.orders set payment_method='direct_upi',payment_status='payment_pending_verification',
      payment_reference=null,payment_confirmed_by=null,payment_confirmed_at=null
      where id=p_order_id;
  else
    update public.orders set payment_method='cod',payment_status='cash_on_delivery',
      payment_reference=null,payment_confirmed_by=null,payment_confirmed_at=null
      where id=p_order_id;
  end if;
  return jsonb_build_object('order_id',p_order_id,'payment_method',p_method,
    'payment_status',case when p_method='direct_upi' then 'payment_pending_verification' else 'cash_on_delivery' end);
end;
$$;
revoke execute on function public.customer_set_order_payment_method(uuid,text) from public,anon;
grant execute on function public.customer_set_order_payment_method(uuid,text) to authenticated;

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
  left join public.provider_payment_settings s on s.provider_id=o.provider_id and s.enabled=true
  where o.id=p_order_id and o.customer_id=auth.uid() and o.payment_method='direct_upi';
  if v_result is null then raise exception 'order_or_direct_upi_details_not_found'; end if;
  return v_result;
end;
$$;
revoke execute on function public.customer_get_order_direct_upi(uuid) from public,anon;
grant execute on function public.customer_get_order_direct_upi(uuid) to authenticated;

create or replace function public.provider_confirm_direct_upi_payment(p_order_id uuid, p_reference text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_order from public.orders
    where id=p_order_id and provider_owner_id=auth.uid()
    for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.payment_method <> 'direct_upi' then raise exception 'not_direct_upi_order'; end if;
  if v_order.payment_status <> 'payment_pending_verification' then raise exception 'payment_not_pending_verification'; end if;
  if v_order.status in ('rejected','cancelled') then raise exception 'order_not_payable'; end if;
  update public.orders set payment_status='paid_direct_to_seller',
    payment_reference=nullif(left(trim(coalesce(p_reference,'')),120),''),
    payment_confirmed_by=auth.uid(),payment_confirmed_at=now()
  where id=p_order_id;
  return jsonb_build_object('order_id',p_order_id,'payment_status','paid_direct_to_seller');
end;
$$;
revoke execute on function public.provider_confirm_direct_upi_payment(uuid,text) from public,anon;
grant execute on function public.provider_confirm_direct_upi_payment(uuid,text) to authenticated;

create or replace function public.provider_confirm_cod_collected(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_order from public.orders
    where id=p_order_id and provider_owner_id=auth.uid()
    for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.payment_method <> 'cod' then raise exception 'not_cod_order'; end if;
  if v_order.payment_status <> 'cash_on_delivery' then raise exception 'cod_not_pending'; end if;
  if v_order.status <> 'delivered' then raise exception 'cash_can_only_be_confirmed_after_delivery'; end if;
  update public.orders set payment_status='paid_cod',
    payment_confirmed_by=auth.uid(),payment_confirmed_at=now()
  where id=p_order_id;
  return jsonb_build_object('order_id',p_order_id,'payment_status','paid_cod');
end;
$$;
revoke execute on function public.provider_confirm_cod_collected(uuid) from public,anon;
grant execute on function public.provider_confirm_cod_collected(uuid) to authenticated;

comment on table public.provider_payment_settings is
'Seller-owned UPI instructions. Customers may view these only through an order-scoped RPC. Does not verify payment settlement.';
comment on column public.orders.payment_status is
'Manual payment status. paid_direct_to_seller is seller-attested only, not bank-verified by Doodhwala.';
