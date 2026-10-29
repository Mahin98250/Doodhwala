-- Enforce one Doodhwala subscription invoice per provider per calendar month.
-- This is a provider-to-Doodhwala fee only; customer order payments are separate.
-- Deliberately fail closed if prior invoices need data reconciliation before this rule can be added.
do $$
begin
  if exists (
    select 1
    from public.provider_subscription_invoices i
    where i.period_start <> date_trunc('month', i.period_start::timestamp)::date
       or i.period_end <> (
         date_trunc('month', i.period_start::timestamp)
         + interval '1 month' - interval '1 day'
       )::date
  ) then
    raise exception 'provider_invoice_period_reconciliation_required: existing invoices must cover complete calendar months';
  end if;

  if exists (
    select 1
    from public.provider_subscription_invoices i
    group by i.provider_id, i.period_start
    having count(*) > 1
  ) then
    raise exception 'provider_invoice_duplicate_period_reconciliation_required: duplicate provider/month invoices exist';
  end if;
end
$$;

-- Idempotent constraint creation also permits a staging environment to be
-- reconciled safely when this migration's SQL was previously applied under a
-- different migration name. Refuse a same-name constraint of the wrong type.
do $constraints$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_subscription_invoices'::regclass
      and conname = 'provider_subscription_invoices_calendar_month_check'
      and contype <> 'c'
  ) then
    raise exception 'provider_invoice_calendar_constraint_definition_conflict';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_subscription_invoices'::regclass
      and conname = 'provider_subscription_invoices_calendar_month_check'
  ) then
    alter table public.provider_subscription_invoices
      add constraint provider_subscription_invoices_calendar_month_check
      check (
        period_start = date_trunc('month', period_start::timestamp)::date
        and period_end = (
          date_trunc('month', period_start::timestamp)
          + interval '1 month' - interval '1 day'
        )::date
      );
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_subscription_invoices'::regclass
      and conname = 'provider_subscription_invoices_provider_month_unique'
      and contype <> 'u'
  ) then
    raise exception 'provider_invoice_unique_constraint_definition_conflict';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_subscription_invoices'::regclass
      and conname = 'provider_subscription_invoices_provider_month_unique'
  ) then
    alter table public.provider_subscription_invoices
      add constraint provider_subscription_invoices_provider_month_unique
      unique (provider_id, period_start);
  end if;
end
$constraints$;

comment on constraint provider_subscription_invoices_calendar_month_check
  on public.provider_subscription_invoices is
  'Monthly provider subscription invoices must cover a complete calendar month.';

comment on constraint provider_subscription_invoices_provider_month_unique
  on public.provider_subscription_invoices is
  'Prevents more than one Doodhwala subscription invoice for a provider in a calendar month.';

create or replace function public.admin_create_provider_subscription_invoice(
  p_provider_id uuid,
  p_plan_id uuid,
  p_period_start date,
  p_period_end date,
  p_due_date date,
  p_invoice_number text,
  p_notes text default ''
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_plan public.provider_billing_plans%rowtype;
  v_existing public.provider_subscription_invoices%rowtype;
  v_id uuid;
begin
  if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then
    raise exception 'admin_access_required';
  end if;

  if p_period_start is null or p_period_end is null or p_due_date is null
     or p_period_end < p_period_start then
    raise exception 'invalid_billing_period';
  end if;

  if p_period_start <> date_trunc('month', p_period_start::timestamp)::date
     or p_period_end <> (
       date_trunc('month', p_period_start::timestamp)
       + interval '1 month' - interval '1 day'
     )::date then
    raise exception 'monthly_period_must_cover_calendar_month';
  end if;

  if length(trim(coalesce(p_invoice_number, ''))) < 3
     or length(trim(p_invoice_number)) > 80 then
    raise exception 'invalid_invoice_number';
  end if;

  if not exists (
    select 1 from public.provider_profiles p where p.id = p_provider_id
  ) then
    raise exception 'provider_not_found';
  end if;

  -- Fast path for a repeated request: return the already-created invoice,
  -- even if the active plan was changed after the original request.
  select *
    into v_existing
    from public.provider_subscription_invoices i
   where i.provider_id = p_provider_id
     and i.period_start = p_period_start
   for update;

  if found then
    if v_existing.period_end <> p_period_end then
      raise exception 'provider_month_invoice_period_conflict';
    end if;
    return v_existing.id;
  end if;

  select *
    into v_plan
    from public.provider_billing_plans p
   where p.id = p_plan_id
     and p.is_active = true;

  if not found then
    raise exception 'active_billing_plan_not_found';
  end if;

  -- ON CONFLICT also handles two administrators creating the same invoice
  -- concurrently. No second invoice is inserted for the provider/month.
  insert into public.provider_subscription_invoices(
    provider_id, plan_id, plan_name_snapshot, amount_paise,
    period_start, period_end, due_date, invoice_number, notes, created_by
  )
  values (
    p_provider_id, v_plan.id, v_plan.name, v_plan.amount_paise,
    p_period_start, p_period_end, p_due_date, trim(p_invoice_number),
    left(coalesce(p_notes, ''), 1000), auth.uid()
  )
  on conflict (provider_id, period_start) do nothing
  returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  -- The conflicting transaction may have won after the fast-path SELECT.
  -- Use a fresh statement snapshot to retrieve its committed invoice ID.
  select *
    into v_existing
    from public.provider_subscription_invoices i
   where i.provider_id = p_provider_id
     and i.period_start = p_period_start
   for update;

  if not found then
    raise exception 'provider_month_invoice_retry_required';
  end if;

  if v_existing.period_end <> p_period_end then
    raise exception 'provider_month_invoice_period_conflict';
  end if;

  return v_existing.id;
end
$$;

revoke all on function public.admin_create_provider_subscription_invoice(uuid, uuid, date, date, date, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_create_provider_subscription_invoice(uuid, uuid, date, date, date, text, text)
  to authenticated;
