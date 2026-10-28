-- Synthetic-only integration assertions. Requires the checkout fixture and the
-- exact reviewed PR #71 billing migrations on the same disposable database.
-- The admin helper is stubbed; real bank, Supabase and deployed RLS are not tested.
-- Creating test plans/invoices here does NOT configure or activate production.

insert into public.provider_payment_settings(provider_id, upi_id, payee_name, enabled)
values ('30000000-0000-4000-8000-000000000001', 'seller@synthetic', 'Seller One', true);

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.admin', 'false', false);
do $$
declare v_order jsonb;
begin
  v_order := public.customer_create_order_with_payment(
    '30000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
    null, 'synthetic-cross-ledger-key-001', 'direct_upi'
  );
  perform set_config('doodhwala.test_order', v_order->>'order_id', false);
end $$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.admin', 'true', false);
do $$
declare
  v_normal_plan uuid;
  v_premium_plan uuid;
  v_normal_invoice uuid;
  v_premium_invoice uuid;
begin
  -- These are alternative monthly plans, not cumulative fees. The descriptions
  -- are fixture labels only: no advertising or entitlement is implemented here.
  v_normal_plan := public.admin_upsert_provider_billing_plan(null, 'Synthetic normal listing', 200000, '', true);
  v_premium_plan := public.admin_upsert_provider_billing_plan(null, 'Synthetic recommended and in-app advertising', 350000, '', true);
  v_premium_invoice := public.admin_create_provider_subscription_invoice(
    '30000000-0000-4000-8000-000000000001', v_premium_plan,
    '2026-10-01', '2026-10-31', '2026-10-31', 'TEST-PREMIUM-001', ''
  );
  v_normal_invoice := public.admin_create_provider_subscription_invoice(
    '30000000-0000-4000-8000-000000000002', v_normal_plan,
    '2026-10-01', '2026-10-31', '2026-10-31', 'TEST-NORMAL-001', ''
  );
  perform set_config('doodhwala.normal_plan', v_normal_plan::text, false);
  perform set_config('doodhwala.premium_plan', v_premium_plan::text, false);
  perform set_config('doodhwala.normal_invoice', v_normal_invoice::text, false);
  perform set_config('doodhwala.premium_invoice', v_premium_invoice::text, false);

  if not exists (select 1 from public.provider_subscription_invoices
                 where id = v_normal_invoice and plan_id = v_normal_plan
                   and amount_paise = 200000 and currency = 'INR' and status = 'due')
     or not exists (select 1 from public.provider_subscription_invoices
                    where id = v_premium_invoice and plan_id = v_premium_plan
                      and amount_paise = 350000 and currency = 'INR' and status = 'due') then
    raise exception 'alternative_monthly_plan_amounts_incorrect';
  end if;

  begin
    -- The normal plan's amount must not settle the premium invoice.
    perform public.admin_record_provider_subscription_payment(v_premium_invoice, 200000, 'manual_upi', 'TEST-WRONG-AMOUNT', now(), '');
    raise exception 'wrong_amount_accepted';
  exception when others then
    if sqlerrm <> 'payment_amount_mismatch' then raise; end if;
  end;
  if exists (select 1 from public.provider_subscription_payments where invoice_id = v_premium_invoice) then
    raise exception 'wrong_amount_created_payment';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.admin', 'false', false);
do $$
begin
  begin
    perform public.admin_record_provider_subscription_payment(
      current_setting('doodhwala.premium_invoice')::uuid, 350000, 'manual_upi', 'TEST-REF-001', now(), ''
    );
    raise exception 'seller_self_confirmed_invoice';
  exception when others then
    if sqlerrm <> 'admin_access_required' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.admin', 'true', false);
do $$
begin
  perform public.admin_record_provider_subscription_payment(
    current_setting('doodhwala.premium_invoice')::uuid, 350000, 'manual_upi', 'TEST-REF-001', now(), ''
  );
  if not exists (select 1 from public.provider_subscription_invoices
                 where id = current_setting('doodhwala.premium_invoice')::uuid and status = 'paid')
     or not exists (select 1 from public.provider_subscription_invoices
                    where id = current_setting('doodhwala.normal_invoice')::uuid and status = 'due') then
    raise exception 'subscription_payment_mutated_other_invoice';
  end if;
  perform set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
  if not exists (select 1 from public.orders
                 where id = current_setting('doodhwala.test_order')::uuid
                   and payment_status = 'payment_pending_verification') then
    raise exception 'invoice_mutated_customer_order';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claim.admin', 'false', false);
do $$
declare v_billing jsonb;
begin
  v_billing := public.provider_get_my_billing();
  if jsonb_array_length(v_billing->'invoices') <> 1
     or v_billing->'invoices'->0->>'id' <> current_setting('doodhwala.normal_invoice')
     or (v_billing->'invoices'->0->>'amount_paise')::bigint <> 200000
     or v_billing->'invoices'->0->>'status' <> 'due'
     or exists (select 1 from public.provider_subscription_invoices
                where id = current_setting('doodhwala.premium_invoice')::uuid) then
    raise exception 'other_seller_invoice_isolation_failed';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
do $$
declare v_billing jsonb;
begin
  v_billing := public.provider_get_my_billing();
  if jsonb_array_length(v_billing->'invoices') <> 1
     or v_billing->'invoices'->0->>'id' <> current_setting('doodhwala.premium_invoice')
     or (v_billing->'invoices'->0->>'amount_paise')::bigint <> 350000
     or v_billing->'invoices'->0->>'status' <> 'paid' then
    raise exception 'seller_premium_invoice_not_visible';
  end if;
  perform public.provider_confirm_direct_upi_payment(current_setting('doodhwala.test_order')::uuid, 'UTR123456789');
  if not exists (select 1 from public.provider_subscription_invoices
                 where id = current_setting('doodhwala.premium_invoice')::uuid and status = 'paid') then
    raise exception 'order_attestation_mutated_invoice';
  end if;
end $$;
reset role;
select 'synthetic PR71/checkout alternative pricing and ledger separation passed' as result;
