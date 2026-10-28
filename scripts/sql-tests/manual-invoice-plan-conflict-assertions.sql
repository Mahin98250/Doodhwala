-- Synthetic-only acceptance test for the deferred PR #71 follow-up.
-- Apply on a disposable DB after manual-ledger-separation-assertions.sql and
-- supabase/deferred/20261028110000_provider_invoice_plan_conflict.sql.
-- This test does not approve, create, or charge any real seller plan.

set role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.admin', 'true', false);
do $$
declare
  v_normal_plan uuid;
  v_premium_plan uuid;
  v_normal_invoice uuid;
  v_premium_invoice uuid;
  v_retry uuid;
begin
  select id into strict v_normal_plan from public.provider_billing_plans where name = 'Synthetic normal listing';
  select id into strict v_premium_plan from public.provider_billing_plans where name = 'Synthetic recommended and in-app advertising';
  select id into strict v_normal_invoice from public.provider_subscription_invoices where invoice_number = 'TEST-NORMAL-001';
  select id into strict v_premium_invoice from public.provider_subscription_invoices where invoice_number = 'TEST-PREMIUM-001';

  -- A same-plan retry returns the original snapshot, even with a new client
  -- invoice number. The caller must read that invoice, not assume new inputs.
  v_retry := public.admin_create_provider_subscription_invoice(
    '30000000-0000-4000-8000-000000000001', v_premium_plan,
    '2026-10-01', '2026-10-31', '2026-11-05', 'TEST-PREMIUM-RETRY', 'retry'
  );
  if v_retry is distinct from v_premium_invoice then
    raise exception 'same_plan_retry_created_another_invoice';
  end if;

  -- A different plan for an already-invoiced month is NOT an upgrade or a
  -- second charge. It must be explicitly rejected in both price directions.
  begin
    perform public.admin_create_provider_subscription_invoice(
      '30000000-0000-4000-8000-000000000001', v_normal_plan,
      '2026-10-01', '2026-10-31', '2026-10-31', 'TEST-PREMIUM-TO-NORMAL', ''
    );
    raise exception 'premium_to_normal_was_silently_accepted';
  exception when others then
    if sqlerrm <> 'provider_month_invoice_plan_conflict' then raise; end if;
  end;
  begin
    perform public.admin_create_provider_subscription_invoice(
      '30000000-0000-4000-8000-000000000002', v_premium_plan,
      '2026-10-01', '2026-10-31', '2026-10-31', 'TEST-NORMAL-TO-PREMIUM', ''
    );
    raise exception 'normal_to_premium_was_silently_accepted';
  exception when others then
    if sqlerrm <> 'provider_month_invoice_plan_conflict' then raise; end if;
  end;
  begin
    perform public.admin_create_provider_subscription_invoice(
      '30000000-0000-4000-8000-000000000001', null,
      '2026-10-01', '2026-10-31', '2026-10-31', 'TEST-NULL-PLAN', ''
    );
    raise exception 'null_plan_was_accepted';
  exception when others then
    if sqlerrm <> 'active_billing_plan_not_found' then raise; end if;
  end;

  -- Disabling or changing the catalogue after issuing a bill must not alter an
  -- already-issued invoice or stop a genuine same-plan retry from recovering it.
  perform public.admin_upsert_provider_billing_plan(v_premium_plan, 'Synthetic recommended and in-app advertising', 351000, '', false);
  v_retry := public.admin_create_provider_subscription_invoice(
    '30000000-0000-4000-8000-000000000001', v_premium_plan,
    '2026-10-01', '2026-10-31', '2026-10-31', 'TEST-INACTIVE-RETRY', ''
  );
  if v_retry is distinct from v_premium_invoice
     or not exists (select 1 from public.provider_subscription_invoices
                    where id = v_premium_invoice and plan_id = v_premium_plan
                      and amount_paise = 350000 and status = 'paid'
                      and invoice_number = 'TEST-PREMIUM-001')
     or not exists (select 1 from public.provider_subscription_invoices
                    where id = v_normal_invoice and plan_id = v_normal_plan
                      and amount_paise = 200000 and status = 'due'
                      and invoice_number = 'TEST-NORMAL-001') then
    raise exception 'invoice_snapshot_changed_on_retry';
  end if;
  perform public.admin_upsert_provider_billing_plan(v_premium_plan, 'Synthetic recommended and in-app advertising', 350000, '', true);

  if (select count(*) from public.provider_subscription_invoices
      where provider_id = '30000000-0000-4000-8000-000000000001' and period_start = '2026-10-01') <> 1
     or (select count(*) from public.provider_subscription_invoices
         where provider_id = '30000000-0000-4000-8000-000000000002' and period_start = '2026-10-01') <> 1 then
    raise exception 'plan_conflict_created_duplicate_invoice';
  end if;

  perform set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
  perform set_config('request.jwt.claim.admin', 'false', false);
  begin
    perform public.admin_create_provider_subscription_invoice(
      '30000000-0000-4000-8000-000000000001', v_premium_plan,
      '2026-11-01', '2026-11-30', '2026-11-30', 'TEST-NONADMIN', ''
    );
    raise exception 'seller_created_invoice';
  exception when others then
    if sqlerrm <> 'admin_access_required' then raise; end if;
  end;
end $$;
reset role;

do $$
begin
  if has_function_privilege('anon', 'public.admin_create_provider_subscription_invoice(uuid,uuid,date,date,date,text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_create_provider_subscription_invoice(uuid,uuid,date,date,date,text,text)', 'EXECUTE') then
    raise exception 'invoice_rpc_grants_changed';
  end if;
end $$;
select 'synthetic invoice plan-conflict acceptance checks passed' as result;
