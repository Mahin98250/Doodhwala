-- Synthetic-only assertions. Run after the disposable PR #71 fixture and the
-- deferred inactive-plan preparation script (twice to verify idempotency).
-- These fixture rows are inactive; this is not a production configuration.

set role authenticated;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.admin', 'true', false);
do $$
begin
  if (select count(*) from public.provider_billing_plans where lower(trim(name)) = 'normal listing') <> 1
     or not exists (select 1 from public.provider_billing_plans
                    where name = 'Normal listing' and amount_paise = 200000
                      and billing_interval = 'month' and is_active = false) then
    raise exception 'inactive_normal_listing_fixture_invalid';
  end if;
  if (select count(*) from public.provider_billing_plans where lower(trim(name)) = 'recommended and in-app advertising') <> 1
     or not exists (select 1 from public.provider_billing_plans
                    where name = 'Recommended and in-app advertising' and amount_paise = 350000
                      and billing_interval = 'month' and is_active = false
                      and description like '%one total monthly price%'
                      and description like '%Sponsored%') then
    raise exception 'inactive_premium_listing_fixture_invalid';
  end if;
  if (select count(*) from public.provider_subscription_invoices) <> 2
     or (select count(*) from public.provider_subscription_payments) <> 1 then
    raise exception 'inactive_plan_preparation_modified_financial_records';
  end if;
end $$;
reset role;
select 'synthetic inactive seller plan preparation checks passed' as result;
