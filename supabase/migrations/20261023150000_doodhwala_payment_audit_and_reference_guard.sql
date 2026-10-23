-- Doodhwala payment audit: immutable trail for payment choice and manual collection.
-- Direct UPI remains seller-attested, not independently bank-verified.
-- This migration does not activate a payment gateway or touch production by itself.

create table if not exists public.order_payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  provider_owner_id uuid not null references auth.users(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('customer','seller','system')),
  event_type text not null check (event_type in (
    'payment_method_selected',
    'payment_status_changed',
    'direct_upi_seller_attested',
    'cod_collection_confirmed',
    'payment_reference_changed'
  )),
  previous_method text,
  payment_method text not null,
  previous_status text,
  payment_status text not null,
  amount_paise bigint not null check (amount_paise >= 0),
  payment_reference text,
  created_at timestamptz not null default now()
);

create index if not exists order_payment_events_order_recent_idx
  on public.order_payment_events(order_id, created_at desc);
create index if not exists order_payment_events_seller_recent_idx
  on public.order_payment_events(provider_owner_id, created_at desc);
create index if not exists order_payment_events_customer_recent_idx
  on public.order_payment_events(customer_id, created_at desc);

alter table public.order_payment_events enable row level security;
revoke all on public.order_payment_events from anon, authenticated;
grant select on public.order_payment_events to authenticated;
grant select, insert, update, delete on public.order_payment_events to service_role;

drop policy if exists "Order participants read payment audit" on public.order_payment_events;
create policy "Order participants read payment audit"
  on public.order_payment_events for select to authenticated
  using ((select auth.uid()) = customer_id or (select auth.uid()) = provider_owner_id);

create or replace function public.doodhwala_log_order_payment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := 'system';
  v_event_type text;
  v_previous_method text;
  v_previous_status text;
  v_amount_paise bigint;
begin
  if tg_op = 'UPDATE'
     and new.payment_method is not distinct from old.payment_method
     and new.payment_status is not distinct from old.payment_status
     and new.payment_reference is not distinct from old.payment_reference
     and new.payment_confirmed_by is not distinct from old.payment_confirmed_by
     and new.payment_confirmed_at is not distinct from old.payment_confirmed_at then
    return new;
  end if;

  if v_actor is not null then
    if v_actor = new.customer_id then
      v_role := 'customer';
    elsif v_actor = new.provider_owner_id then
      v_role := 'seller';
    else
      v_role := 'system';
    end if;
  end if;

  v_amount_paise := greatest(0, round(coalesce(new.total, 0) * 100)::bigint);

  if tg_op = 'INSERT' then
    v_event_type := 'payment_status_changed';
    v_previous_method := null;
    v_previous_status := null;
  else
    v_previous_method := old.payment_method;
    v_previous_status := old.payment_status;
    if old.payment_method is distinct from new.payment_method then
      v_event_type := 'payment_method_selected';
    elsif new.payment_status = 'paid_direct_to_seller'
      and old.payment_status is distinct from new.payment_status then
      v_event_type := 'direct_upi_seller_attested';
    elsif new.payment_status = 'paid_cod'
      and old.payment_status is distinct from new.payment_status then
      v_event_type := 'cod_collection_confirmed';
    elsif old.payment_reference is distinct from new.payment_reference
      and old.payment_status is not distinct from new.payment_status then
      v_event_type := 'payment_reference_changed';
    else
      v_event_type := 'payment_status_changed';
    end if;
  end if;

  insert into public.order_payment_events(
    order_id, customer_id, provider_owner_id, actor_user_id, actor_role,
    event_type, previous_method, payment_method, previous_status, payment_status,
    amount_paise, payment_reference
  ) values (
    new.id, new.customer_id, new.provider_owner_id, v_actor, v_role,
    v_event_type, v_previous_method, new.payment_method, v_previous_status, new.payment_status,
    v_amount_paise, nullif(left(trim(coalesce(new.payment_reference, '')), 120), '')
  );

  return new;
end;
$$;

revoke execute on function public.doodhwala_log_order_payment_event() from public, anon, authenticated;
drop trigger if exists orders_log_payment_audit_event on public.orders;
create trigger orders_log_payment_audit_event
after insert or update of payment_method, payment_status, payment_reference, payment_confirmed_by, payment_confirmed_at
on public.orders
for each row execute function public.doodhwala_log_order_payment_event();

create or replace function public.doodhwala_order_payment_event_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'payment_audit_events_are_immutable';
end;
$$;
revoke execute on function public.doodhwala_order_payment_event_immutable() from public, anon, authenticated;

drop trigger if exists order_payment_events_no_mutation on public.order_payment_events;
create trigger order_payment_events_no_mutation
before update or delete on public.order_payment_events
for each row execute function public.doodhwala_order_payment_event_immutable();

-- Require a seller-entered transaction reference before asserting direct-UPI receipt.
-- This improves reconciliation but remains a manual seller attestation.
create or replace function public.provider_confirm_direct_upi_payment(p_order_id uuid, p_reference text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_reference text := nullif(trim(coalesce(p_reference, '')), '');
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if v_reference is null or length(v_reference) < 6 or length(v_reference) > 120
     or v_reference !~ '^[A-Za-z0-9/_-]{6,120}$' then
    raise exception 'payment_reference_required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and provider_owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.payment_method <> 'direct_upi' then
    raise exception 'not_direct_upi_order';
  end if;
  if v_order.payment_status <> 'payment_pending_verification' then
    raise exception 'payment_not_pending_verification';
  end if;
  if v_order.status in ('rejected', 'cancelled') then
    raise exception 'order_not_payable';
  end if;

  perform set_config('doodhwala.payment_rpc', 'on', true);
  update public.orders
  set payment_status = 'paid_direct_to_seller',
      payment_reference = v_reference,
      payment_confirmed_by = auth.uid(),
      payment_confirmed_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'payment_status', 'paid_direct_to_seller',
    'payment_reference_recorded', true,
    'bank_settlement_verified_by_doodhwala', false
  );
end;
$$;
revoke execute on function public.provider_confirm_direct_upi_payment(uuid, text) from public, anon;
grant execute on function public.provider_confirm_direct_upi_payment(uuid, text) to authenticated;

comment on table public.order_payment_events is
'Append-only audit trail for payment method selection and COD/direct-UPI confirmation. This ledger records actor claims and references; it is not independent proof of bank settlement.';
comment on function public.provider_confirm_direct_upi_payment(uuid, text) is
'Seller-owned manual confirmation requiring a transaction reference. Seller attestation only; Doodhwala does not independently verify UPI settlement.';
