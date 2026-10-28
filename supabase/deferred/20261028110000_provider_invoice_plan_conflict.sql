-- DEFERRED FOLLOW-UP, NOT AN AUTOMATIC MIGRATION. DO NOT RUN IN PRODUCTION.
-- Requires review and integration of PR #71 at head 18fc96802e001d5b4d98b84ffe400cca2a5fbc70.
-- Does not create billing records, plans, prices, advertising or entitlements.
-- On same-provider/month retries, preserve the existing invoice for the SAME
-- plan; reject a DIFFERENT requested plan rather than silently returning it.
-- It intentionally does not implement upgrades, cancellation or proration.
-- Before promoting this into migrations, reconcile PR #71, review the current
-- function, update the admin UI's error handling, and run staging/rollback tests.
-- Run the entire file in a transaction with ON_ERROR_STOP in disposable staging.
-- This exact-source guard detects drift; it is not a security/auth mechanism.
do $preflight$
declare
  v_fn oid := to_regprocedure('public.admin_create_provider_subscription_invoice(uuid,uuid,date,date,date,text,text)');
  v_fingerprint text;
  v_security_definer boolean;
  v_config text[];
begin
  if v_fn is null then
    raise exception 'reviewed_provider_billing_pr71_required';
  end if;
  select md5(prosrc), prosecdef, proconfig
    into v_fingerprint, v_security_definer, v_config
    from pg_proc where oid = v_fn;
  if v_fingerprint not in ('6445b5a8ed1b2bb10a1eaead753ab734', 'bfbc4978f2810a252c35de1ab554e9fd') then
    raise exception 'provider_invoice_function_drift_review_required';
  end if;
  if not v_security_definer or v_config is distinct from array['search_path=""']::text[] then
    raise exception 'provider_invoice_function_security_review_required';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.provider_subscription_invoices')
      and conname = 'provider_subscription_invoices_provider_month_unique'
      and contype = 'u'
      and not condeferrable
      and pg_get_constraintdef(oid) = 'UNIQUE (provider_id, period_start)'
  ) then
    raise exception 'provider_invoice_month_constraint_review_required';
  end if;
  if not has_function_privilege('authenticated', v_fn, 'EXECUTE')
     or has_function_privilege('anon', v_fn, 'EXECUTE') then
    raise exception 'provider_invoice_function_grants_review_required';
  end if;
end
$preflight$;

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

  if p_plan_id is null then
    raise exception 'active_billing_plan_not_found';
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
    if v_existing.plan_id is distinct from p_plan_id then
      raise exception 'provider_month_invoice_plan_conflict';
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

  if v_existing.plan_id is distinct from p_plan_id then
    raise exception 'provider_month_invoice_plan_conflict';
  end if;

  return v_existing.id;
end
$$;

revoke all on function public.admin_create_provider_subscription_invoice(uuid, uuid, date, date, date, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_create_provider_subscription_invoice(uuid, uuid, date, date, date, text, text)
  to authenticated;
