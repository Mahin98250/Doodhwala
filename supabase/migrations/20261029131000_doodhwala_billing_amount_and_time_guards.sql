-- Enforce billing money bounds and prevent false/future manual payment timestamps.
-- One monthly subscription must be between ₹1 and ₹10,00,000, matching the owner UI.
-- Refuse rollout if existing rows require reconciliation; never silently rewrite billing data.

do $preflight$
begin
  if exists (select 1 from public.provider_billing_plans where amount_paise < 100 or amount_paise > 100000000) then
    raise exception 'provider_billing_plan_amount_reconciliation_required: price outside INR 1..1000000';
  end if;
  if exists (select 1 from public.provider_subscription_invoices where amount_paise < 100 or amount_paise > 100000000) then
    raise exception 'provider_invoice_amount_reconciliation_required: invoice amount outside INR 1..1000000';
  end if;
  if exists (select 1 from public.provider_subscription_payments where amount_paise < 100 or amount_paise > 100000000) then
    raise exception 'provider_payment_amount_reconciliation_required: payment amount outside INR 1..1000000';
  end if;
end
$preflight$;

do $constraints$
begin
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.provider_billing_plans'::regclass
      and c.conname = 'provider_billing_plans_amount_paise_range_check'
      and (c.contype <> 'c' or pg_get_constraintdef(c.oid) !~ 'amount_paise >= 100.*amount_paise <= 100000000')
  ) then raise exception 'provider_billing_plan_amount_constraint_definition_conflict'; end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.provider_billing_plans'::regclass
      and c.conname = 'provider_billing_plans_amount_paise_range_check'
  ) then
    alter table public.provider_billing_plans
      add constraint provider_billing_plans_amount_paise_range_check
      check (amount_paise between 100 and 100000000);
  end if;

  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.provider_subscription_invoices'::regclass
      and c.conname = 'provider_subscription_invoices_amount_paise_range_check'
      and (c.contype <> 'c' or pg_get_constraintdef(c.oid) !~ 'amount_paise >= 100.*amount_paise <= 100000000')
  ) then raise exception 'provider_invoice_amount_constraint_definition_conflict'; end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.provider_subscription_invoices'::regclass
      and c.conname = 'provider_subscription_invoices_amount_paise_range_check'
  ) then
    alter table public.provider_subscription_invoices
      add constraint provider_subscription_invoices_amount_paise_range_check
      check (amount_paise between 100 and 100000000);
  end if;

  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.provider_subscription_payments'::regclass
      and c.conname = 'provider_subscription_payments_amount_paise_range_check'
      and (c.contype <> 'c' or pg_get_constraintdef(c.oid) !~ 'amount_paise >= 100.*amount_paise <= 100000000')
  ) then raise exception 'provider_payment_amount_constraint_definition_conflict'; end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.provider_subscription_payments'::regclass
      and c.conname = 'provider_subscription_payments_amount_paise_range_check'
  ) then
    alter table public.provider_subscription_payments
      add constraint provider_subscription_payments_amount_paise_range_check
      check (amount_paise between 100 and 100000000);
  end if;
end
$constraints$;

create or replace function public.admin_upsert_provider_billing_plan(
  p_plan_id uuid,p_name text,p_amount_paise bigint,p_description text default '',p_is_active boolean default true
) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then
    raise exception 'admin_access_required';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 80 then
    raise exception 'invalid_plan_name';
  end if;
  if p_amount_paise is null or p_amount_paise < 100 or p_amount_paise > 100000000 then
    raise exception 'invalid_plan_amount';
  end if;

  if p_plan_id is null then
    insert into public.provider_billing_plans(name,amount_paise,description,is_active)
    values(trim(p_name),p_amount_paise,left(coalesce(p_description,''),1000),coalesce(p_is_active,true))
    returning id into v_id;
  else
    update public.provider_billing_plans set
      name=trim(p_name),amount_paise=p_amount_paise,
      description=left(coalesce(p_description,''),1000),
      is_active=coalesce(p_is_active,true),updated_at=now()
    where id=p_plan_id returning id into v_id;
    if v_id is null then raise exception 'billing_plan_not_found'; end if;
  end if;
  return v_id;
end
$$;
revoke all on function public.admin_upsert_provider_billing_plan(uuid,text,bigint,text,boolean)
  from public,anon,authenticated;
grant execute on function public.admin_upsert_provider_billing_plan(uuid,text,bigint,text,boolean)
  to authenticated;

create or replace function public.admin_record_provider_subscription_payment(
  p_invoice_id uuid,p_amount_paise bigint,p_method text,p_reference text,
  p_received_at timestamptz default now(),p_notes text default ''
) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  v_invoice public.provider_subscription_invoices%rowtype;
  v_payment_id uuid;
  v_received_at timestamptz := coalesce(p_received_at, now());
begin
  if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then
    raise exception 'admin_access_required';
  end if;
  if p_amount_paise is null or p_amount_paise < 100 or p_amount_paise > 100000000 then
    raise exception 'invalid_payment_amount';
  end if;
  if p_method is null or p_method not in ('manual_upi','bank_transfer','cash') then
    raise exception 'invalid_payment_method';
  end if;
  if length(trim(coalesce(p_reference,''))) < 3 or length(trim(p_reference)) > 120 then
    raise exception 'payment_reference_required';
  end if;
  if v_received_at > now() + interval '5 minutes' then
    raise exception 'payment_received_at_in_future';
  end if;

  select * into v_invoice
  from public.provider_subscription_invoices
  where id=p_invoice_id
  for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if v_invoice.status <> 'due' then raise exception 'invoice_not_due'; end if;
  if v_received_at < v_invoice.created_at - interval '5 minutes' then
    raise exception 'payment_received_before_invoice';
  end if;
  if p_amount_paise <> v_invoice.amount_paise then
    raise exception 'payment_amount_mismatch';
  end if;

  insert into public.provider_subscription_payments(
    invoice_id,provider_id,amount_paise,method,reference,received_at,recorded_by,notes
  ) values (
    v_invoice.id,v_invoice.provider_id,p_amount_paise,p_method,trim(p_reference),
    v_received_at,auth.uid(),left(coalesce(p_notes,''),1000)
  ) returning id into v_payment_id;

  update public.provider_subscription_invoices
  set status='paid',paid_at=v_received_at
  where id=v_invoice.id and status='due';
  if not found then raise exception 'invoice_state_changed'; end if;
  return v_payment_id;
end
$$;
revoke all on function public.admin_record_provider_subscription_payment(uuid,bigint,text,text,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.admin_record_provider_subscription_payment(uuid,bigint,text,text,timestamptz,text)
  to authenticated;

comment on constraint provider_billing_plans_amount_paise_range_check
  on public.provider_billing_plans is 'Monthly plan fees are bounded to INR 1 through INR 10,00,000.';
comment on constraint provider_subscription_invoices_amount_paise_range_check
  on public.provider_subscription_invoices is 'Invoice amounts are bounded to INR 1 through INR 10,00,000.';
comment on constraint provider_subscription_payments_amount_paise_range_check
  on public.provider_subscription_payments is 'Reconciled payment amounts are bounded to INR 1 through INR 10,00,000.';
comment on function public.admin_record_provider_subscription_payment(uuid,bigint,text,text,timestamptz,text) is
  'Owner-attested manual reconciliation. Rejects future/backdated timestamps and amount mismatches; it is not automated bank verification.';
