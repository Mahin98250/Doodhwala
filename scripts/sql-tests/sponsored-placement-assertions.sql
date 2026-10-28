-- SYNTHETIC-ONLY test. Run after the reviewed PR #71 fixture, plan-conflict
-- fix, inactive plan preparation, and billing-pilot sponsorship draft. It
-- changes disposable flags and creates fake records; never run on a real DB.

-- Default-off, no direct private table privileges, anonymous access limited to
-- the public eligibility reader. No plan or sponsored label is live by default.
do $$
begin
  if (select billing_ui_enabled or sponsored_ui_enabled from private.provider_billing_pilot_control where singleton) then
    raise exception 'pilot_not_disabled_by_default';
  end if;
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000001'::uuid])) then
    raise exception 'disabled_pilot_published_label';
  end if;
  if has_table_privilege('anon','private.provider_sponsored_placements','select')
     or has_table_privilege('authenticated','private.provider_billing_pilot_control','update')
     or has_function_privilege('anon','public.admin_set_sponsored_placement(uuid,boolean)','execute') then
    raise exception 'browser_can_modify_private_pilot_state';
  end if;
end $$;

insert into auth.users(id) values
 ('20000000-0000-4000-8000-000000000003'),
 ('20000000-0000-4000-8000-000000000004'),
 ('20000000-0000-4000-8000-000000000005'),
 ('20000000-0000-4000-8000-000000000006');
insert into public.provider_profiles(id,owner_user_id,display_name) values
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','Synthetic premium seller'),
 ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000004','Synthetic normal seller'),
 ('30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000005','Synthetic expired seller'),
 ('30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000006','Synthetic unpaid seller');
insert into public.provider_verifications(provider_id,status)
select id,'approved' from public.provider_profiles where id in (
 '30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004',
 '30000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000006');
insert into public.provider_service_areas(provider_id,latitude,longitude)
select id,23.02,72.57 from public.provider_profiles where id in (
 '30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004',
 '30000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000006');
-- Only in this independently verified disposable DB: make prepared fixture
-- plans selectable so their manual billing and promotion paths can be tested.
update public.provider_billing_plans set is_active=true where name in ('Normal listing','Recommended and in-app advertising');

set role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claim.admin','true',false);
do $$
declare
  normal_id uuid; premium_id uuid; premium_invoice uuid; normal_invoice uuid; expired_invoice uuid; unpaid_invoice uuid;
  start_date date := date_trunc('month',statement_timestamp() at time zone 'Asia/Kolkata')::date;
  end_date date := (date_trunc('month',statement_timestamp() at time zone 'Asia/Kolkata')+interval '1 month - 1 day')::date;
  old_start date := (date_trunc('month',statement_timestamp() at time zone 'Asia/Kolkata')-interval '1 month')::date;
  old_end date := (date_trunc('month',statement_timestamp() at time zone 'Asia/Kolkata')-interval '1 day')::date;
begin
  select id into strict normal_id from public.provider_billing_plans where name='Normal listing';
  select id into strict premium_id from public.provider_billing_plans where name='Recommended and in-app advertising';
  premium_invoice:=public.admin_create_provider_subscription_invoice('30000000-0000-4000-8000-000000000003',premium_id,start_date,end_date,end_date,'FIXTURE-PROMO-PAID','');
  normal_invoice:=public.admin_create_provider_subscription_invoice('30000000-0000-4000-8000-000000000004',normal_id,start_date,end_date,end_date,'FIXTURE-NORMAL-PAID','');
  expired_invoice:=public.admin_create_provider_subscription_invoice('30000000-0000-4000-8000-000000000005',premium_id,old_start,old_end,old_end,'FIXTURE-PROMO-EXPIRED','');
  unpaid_invoice:=public.admin_create_provider_subscription_invoice('30000000-0000-4000-8000-000000000006',premium_id,start_date,end_date,end_date,'FIXTURE-PROMO-UNPAID','');
  perform public.admin_record_provider_subscription_payment(premium_invoice,350000,'manual_upi','FIXTURE-PROMO-REF',now(),'synthetic only');
  perform public.admin_record_provider_subscription_payment(normal_invoice,200000,'manual_upi','FIXTURE-NORMAL-REF',now(),'synthetic only');
  perform public.admin_record_provider_subscription_payment(expired_invoice,350000,'manual_upi','FIXTURE-EXPIRED-REF',now(),'synthetic only');
  perform set_config('doodhwala.fixture_premium',premium_invoice::text,false);
  perform set_config('doodhwala.fixture_normal',normal_invoice::text,false);
  perform set_config('doodhwala.fixture_expired',expired_invoice::text,false);
  perform set_config('doodhwala.fixture_unpaid',unpaid_invoice::text,false);
  if (public.get_provider_billing_pilot_ui_state()->>'billing_ui_enabled')::boolean then
    raise exception 'billing_ui_enabled_before_owner_gate';
  end if;
  begin
    perform public.admin_set_sponsored_placement(premium_invoice,true);
    raise exception 'placement_enabled_before_rollout_approval';
  exception when others then if sqlerrm<>'sponsored_pilot_not_enabled' then raise; end if; end;
end $$;
reset role;

-- Toggle only the synthetic rollout switches, as a database owner in this
-- disposable fixture. This is not an owner approval for any real environment.
update private.provider_billing_pilot_control set billing_ui_enabled=true,sponsored_ui_enabled=true where singleton;

set role authenticated;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claim.admin','true',false);
do $$ begin
  begin
    perform public.admin_set_sponsored_placement(current_setting('doodhwala.fixture_premium')::uuid,true);
    raise exception 'missing_identity_approved_placement';
  exception when others then if sqlerrm<>'admin_access_required' then raise; end if; end;
  begin
    perform public.get_provider_billing_pilot_ui_state();
    raise exception 'missing_identity_read_pilot_state';
  exception when others then if sqlerrm<>'authentication_required' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',false);
select set_config('request.jwt.claim.admin','false',false);
do $$
declare bill jsonb;
begin
  if not (public.get_provider_billing_pilot_ui_state()->>'billing_ui_enabled')::boolean then raise exception 'fixture_pilot_not_enabled'; end if;
  bill:=public.provider_get_billing_for_dashboard('30000000-0000-4000-8000-000000000003');
  if jsonb_array_length(bill->'invoices')<>1 or bill->'invoices'->0->>'invoice_number'<>'FIXTURE-PROMO-PAID' then
    raise exception 'seller_invoice_read_scope_invalid';
  end if;
  begin
    perform public.provider_get_billing_for_dashboard('30000000-0000-4000-8000-000000000004');
    raise exception 'other_seller_billing_was_visible';
  exception when others then if sqlerrm<>'provider_not_found_or_not_owner' then raise; end if; end;
  begin
    perform public.admin_set_sponsored_placement(current_setting('doodhwala.fixture_premium')::uuid,true);
    raise exception 'seller_self_approved_placement';
  exception when others then if sqlerrm<>'admin_access_required' then raise; end if; end;
  begin
    perform * from private.provider_sponsored_placements;
    raise exception 'private_placement_table_visible_to_seller';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Ambiguous multi-profile owners fail closed rather than seeing the wrong seller.
insert into public.provider_profiles(id,owner_user_id,display_name) values
 ('30000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000003','Synthetic second profile');
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',false);
do $$ begin
  begin
    perform public.provider_get_billing_for_dashboard('30000000-0000-4000-8000-000000000003');
    raise exception 'ambiguous_multi_profile_billing_returned';
  exception when others then if sqlerrm<>'billing_provider_scope_requires_review' then raise; end if; end;
end $$;
reset role;
delete from public.provider_profiles where id='30000000-0000-4000-8000-000000000007';

set role anon;
do $$ begin
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000003'::uuid])) then
    raise exception 'paid_invoice_auto_published_without_admin_approval';
  end if;
  begin
    perform * from public.get_sponsored_provider_cards(array_fill('30000000-0000-4000-8000-000000000003'::uuid,array[101]));
    raise exception 'unbounded_sponsored_query_accepted';
  exception when others then if sqlerrm<>'too_many_provider_ids' then raise; end if; end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claim.admin','true',false);
do $$
declare invoice uuid;
begin
  foreach invoice in array array[current_setting('doodhwala.fixture_normal')::uuid,current_setting('doodhwala.fixture_expired')::uuid,current_setting('doodhwala.fixture_unpaid')::uuid] loop
    begin
      perform public.admin_set_sponsored_placement(invoice,true);
      raise exception 'ineligible_invoice_activated_sponsored_label';
    exception when others then if sqlerrm<>'paid_premium_invoice_required' then raise; end if; end;
  end loop;
  perform public.admin_set_sponsored_placement(current_setting('doodhwala.fixture_premium')::uuid,true);
  -- Idempotent retries do not manufacture another approval event.
  perform public.admin_set_sponsored_placement(current_setting('doodhwala.fixture_premium')::uuid,true);
end $$;
reset role;

do $$ begin
  if (select count(*) from private.provider_sponsored_placement_events where invoice_id=current_setting('doodhwala.fixture_premium')::uuid)<>1 then
    raise exception 'placement_approval_event_not_idempotent';
  end if;
end $$;
set role anon;
do $$
declare expiry timestamptz;
begin
  select expires_at into strict expiry from public.get_sponsored_provider_cards(array[
    '30000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000004'::uuid]);
  if expiry <> ((date_trunc('month',statement_timestamp() at time zone 'Asia/Kolkata')+interval '1 month') at time zone 'Asia/Kolkata') then
    raise exception 'sponsored_expiry_not_india_month_boundary';
  end if;
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000004'::uuid])) then
    raise exception 'unrequested_or_normal_provider_published';
  end if;
end $$;
reset role;

-- Status, plan drift, and rollout flag changes immediately fail closed on the
-- server. The browser also rechecks and clears at expiry/visibility/network loss.
savepoint plan_drift;
update public.provider_billing_plans set amount_paise=350001 where name='Recommended and in-app advertising';
do $$ begin
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000003'::uuid])) then raise exception 'changed_plan_still_sponsored'; end if;
end $$;
rollback to savepoint plan_drift;
release savepoint plan_drift;
savepoint void_invoice;
update public.provider_subscription_invoices set status='void',paid_at=null,voided_at=now() where id=current_setting('doodhwala.fixture_premium')::uuid;
do $$ begin
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000003'::uuid])) then raise exception 'void_invoice_still_sponsored'; end if;
end $$;
rollback to savepoint void_invoice;
release savepoint void_invoice;
savepoint missing_payment;
delete from public.provider_subscription_payments where invoice_id=current_setting('doodhwala.fixture_premium')::uuid;
do $$ begin
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000003'::uuid])) then raise exception 'missing_payment_still_sponsored'; end if;
end $$;
rollback to savepoint missing_payment;
release savepoint missing_payment;
savepoint future_receipt;
update public.provider_subscription_payments set received_at=now()+interval '1 day' where invoice_id=current_setting('doodhwala.fixture_premium')::uuid;
do $$ begin
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000003'::uuid])) then raise exception 'future_receipt_still_sponsored'; end if;
end $$;
rollback to savepoint future_receipt;
release savepoint future_receipt;
savepoint unapproved_provider;
update public.provider_verifications set status='pending' where provider_id='30000000-0000-4000-8000-000000000003';
do $$ begin
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000003'::uuid])) then raise exception 'unapproved_provider_still_sponsored'; end if;
end $$;
rollback to savepoint unapproved_provider;
release savepoint unapproved_provider;
savepoint inactive_provider;
update public.provider_profiles set is_active=false where id='30000000-0000-4000-8000-000000000003';
do $$ begin
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000003'::uuid])) then raise exception 'inactive_provider_still_sponsored'; end if;
end $$;
rollback to savepoint inactive_provider;
release savepoint inactive_provider;
savepoint missing_service_area;
delete from public.provider_service_areas where provider_id='30000000-0000-4000-8000-000000000003';
do $$ begin
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000003'::uuid])) then raise exception 'seller_without_area_still_sponsored'; end if;
end $$;
rollback to savepoint missing_service_area;
release savepoint missing_service_area;
update private.provider_billing_pilot_control set sponsored_ui_enabled=false where singleton;
do $$ begin
  if exists(select 1 from public.get_sponsored_provider_cards(array['30000000-0000-4000-8000-000000000003'::uuid])) then raise exception 'disabled_pilot_still_sponsored'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claim.admin','true',false);
select public.admin_set_sponsored_placement(current_setting('doodhwala.fixture_premium')::uuid,false);
reset role;
do $$ begin
  if (select count(*) from private.provider_sponsored_placement_events where invoice_id=current_setting('doodhwala.fixture_premium')::uuid)<>2
     or exists(select 1 from private.provider_sponsored_placements where invoice_id=current_setting('doodhwala.fixture_premium')::uuid and enabled) then
    raise exception 'placement_disable_not_recorded';
  end if;
end $$;
select 'synthetic sponsored placement and billing UI guards passed' as result;
