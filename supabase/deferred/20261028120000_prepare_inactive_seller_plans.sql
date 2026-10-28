-- DISPOSABLE STAGING TEST ONLY. NOT AN AUTOMATIC MIGRATION. DO NOT RUN IN PRODUCTION.
-- Requires the reviewed PR #71 billing tables/RPC and an authenticated admin.
-- It only prepares INACTIVE plan rows; it does not create invoices, collect or
-- confirm payments, enable listings, create advertising, or grant entitlements.
-- Tax, due dates, plan changes and deliverables still need owner approval.
-- An explicit custom setting is an operator reminder, NOT proof that the
-- database is disposable. Verify the project/connection independently.
-- Run as one transaction with ON_ERROR_STOP, never during other plan edits.

do $prepare_inactive_seller_plans$
declare
  v_plan record;
  v_count integer;
begin
  if current_setting('doodhwala.disposable_pilot_fixture', true) is distinct from 'yes' then
    raise exception 'disposable_pilot_fixture_confirmation_required';
  end if;
  if to_regclass('public.provider_billing_plans') is null
     or to_regprocedure('public.admin_upsert_provider_billing_plan(uuid,text,bigint,text,boolean)') is null then
    raise exception 'reviewed_provider_billing_pr71_required';
  end if;
  if auth.uid() is null or not coalesce(private.is_current_user_admin(), false) then
    raise exception 'admin_access_required';
  end if;

  -- Serializes this script with itself. The billing table does not currently
  -- enforce unique plan names, so operators must also avoid concurrent UI edits.
  perform pg_advisory_xact_lock(hashtextextended('doodhwala.disposable_seller_plan_fixture', 0));

  for v_plan in
    select * from (values
      ('Normal listing', 200000::bigint,
       'DRAFT: normal app listing. Monthly terms and tax treatment are not yet approved.'),
      ('Recommended and in-app advertising', 350000::bigint,
       'DRAFT: normal listing plus recommended tag and in-app advertising, for one total monthly price. Paid placement requires a Sponsored disclosure; terms and tax treatment are not yet approved.')
    ) as expected(name, amount_paise, description)
  loop
    select count(*) into v_count from public.provider_billing_plans p
    where lower(trim(p.name)) = lower(v_plan.name);

    if v_count = 0 then
      perform public.admin_upsert_provider_billing_plan(
        null, v_plan.name, v_plan.amount_paise, v_plan.description, false
      );
    elsif v_count <> 1 or not exists (
      select 1 from public.provider_billing_plans p
      where p.name = v_plan.name
        and p.amount_paise = v_plan.amount_paise
        and p.billing_interval = 'month'
        and p.description = v_plan.description
        and p.is_active = false
    ) then
      -- Never silently change, duplicate or deactivate an existing plan.
      raise exception 'seller_plan_catalog_conflict_review_required';
    end if;
  end loop;
end
$prepare_inactive_seller_plans$;
