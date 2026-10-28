-- Run only after the synthetic fixture and the listed real migrations.
-- These checks do not prove the target Supabase schema or any bank settlement.

do $privileges$
declare v_function record;
begin
  if not has_function_privilege('authenticated', 'public.customer_create_order_with_payment(uuid,uuid,jsonb,text,text,text)', 'EXECUTE') then
    raise exception 'authenticated_atomic_checkout_not_granted';
  end if;
  if has_function_privilege('anon', 'public.customer_create_order_with_payment(uuid,uuid,jsonb,text,text,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.customer_create_order_with_payment(uuid,uuid,jsonb,text,text,text)', 'EXECUTE') then
    raise exception 'atomic_checkout_granted_to_unintended_role';
  end if;
  for v_function in
    select p.oid, n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and ((n.nspname='public' and p.proname in ('create_order','create_order_with_promo'))
      or (n.nspname='private' and p.proname in ('create_order_secure','create_order_secure_with_promo')))
  loop
    if has_function_privilege('anon', v_function.oid, 'EXECUTE')
       or has_function_privilege('authenticated', v_function.oid, 'EXECUTE')
       or has_function_privilege('service_role', v_function.oid, 'EXECUTE') then
      raise exception 'legacy_checkout_still_executable: %.%', v_function.nspname, v_function.proname;
    end if;
  end loop;
end
$privileges$;

insert into public.provider_payment_settings(provider_id,upi_id,payee_name,enabled)
values ('30000000-0000-4000-8000-000000000001','seller@synthetic','Seller One',true);

set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
do $authentication$
begin
  begin
    perform public.customer_create_order_with_payment(
      '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
      '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
      null,'atomic-no-auth-key-00001','cod');
    raise exception 'missing_auth_was_accepted';
  exception when others then
    if sqlerrm <> 'authentication_required' then raise; end if;
  end;
end
$authentication$;
reset role;

-- Disable a real readiness guard to verify the server fails closed.
alter table public.orders disable trigger orders_guard_payment_field_writes;
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $readiness$
begin
  begin
    perform public.customer_create_order_with_payment(
      '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
      '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
      null,'atomic-not-ready-key-001','cod');
    raise exception 'unready_checkout_was_accepted';
  exception when others then
    if sqlerrm <> 'payment_controls_not_ready' then raise; end if;
  end;
  if exists(select 1 from public.orders) then raise exception 'unready_checkout_created_order'; end if;
end
$readiness$;
reset role;
alter table public.orders enable trigger orders_guard_payment_field_writes;

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $rollback_and_validation$
begin
  -- Seller two has no UPI settings. The real creator inserts the order and
  -- items first; the setter then raises, so the entire subtransaction must roll back.
  begin
    perform public.customer_create_order_with_payment(
      '30000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001',
      '[{"product_id":"40000000-0000-4000-8000-000000000002","quantity":1}]'::jsonb,
      null,'atomic-rollback-key-0001','direct_upi');
    raise exception 'unconfigured_upi_was_accepted';
  exception when others then
    if sqlerrm <> 'seller_direct_upi_not_configured' then raise; end if;
  end;
  if exists(select 1 from public.orders) then raise exception 'failed_choice_left_order'; end if;
  if exists(select 1 from public.order_items) then raise exception 'failed_choice_left_order_items'; end if;
  if exists(select 1 from public.order_payment_events) then raise exception 'failed_choice_left_payment_audit_event'; end if;

  begin
    perform public.customer_create_order_with_payment(
      '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',
      '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
      null,'atomic-wrong-address-001','cod');
    raise exception 'another_customer_address_was_accepted';
  exception when others then
    if sqlerrm <> 'address_not_owned' then raise; end if;
  end;
  begin
    perform public.customer_create_order_with_payment(
      '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
      '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
      null,'short','cod');
    raise exception 'short_idempotency_key_was_accepted';
  exception when others then
    if sqlerrm <> 'invalid_idempotency_key' then raise; end if;
  end;
  begin
    perform public.customer_create_order_with_payment(
      '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
      '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
      null,'atomic-invalid-method-001','bank_verified');
    raise exception 'invalid_payment_method_was_accepted';
  exception when others then
    if sqlerrm <> 'invalid_payment_method' then raise; end if;
  end;
  if exists(select 1 from public.orders) then raise exception 'validation_failure_left_order'; end if;
end
$rollback_and_validation$;

-- Commit a real UPI choice, then repeat the exact request as after a lost response.
do $idempotency$
declare v_first jsonb; v_retry jsonb; v_order_id uuid;
begin
  v_first := public.customer_create_order_with_payment(
    '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
    '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
    null,'atomic-upi-same-key-0001','direct_upi');
  v_retry := public.customer_create_order_with_payment(
    '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
    '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
    null,'atomic-upi-same-key-0001','direct_upi');
  v_order_id := (v_first->>'order_id')::uuid;
  if v_retry->>'order_id' is distinct from v_first->>'order_id'
     or v_retry->>'status' <> 'placed'
     or v_retry->>'payment_method' <> 'direct_upi'
     or v_retry->>'payment_status' <> 'payment_pending_verification' then
    raise exception 'idempotent_upi_retry_wrong: % / %', v_first, v_retry;
  end if;
  if (select count(*) from public.orders where idempotency_key='atomic-upi-same-key-0001') <> 1
     or (select count(*) from public.order_items where order_id=v_order_id) <> 1 then
    raise exception 'idempotent_retry_created_duplicate';
  end if;
  if not exists(select 1 from public.orders where id=v_order_id and total=100 and payment_status='payment_pending_verification') then
    raise exception 'server_price_or_upi_status_wrong';
  end if;
  if not exists(select 1 from public.order_payment_events where order_id=v_order_id and event_type='payment_method_selected' and actor_role='customer' and amount_paise=10000) then
    raise exception 'payment_selection_audit_missing';
  end if;
  begin
    perform public.customer_create_order_with_payment(
      '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
      '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
      null,'atomic-upi-same-key-0001','cod');
    raise exception 'changed_method_on_retry_was_accepted';
  exception when others then
    if sqlerrm <> 'payment_method_already_selected' then raise; end if;
  end;
  begin
    perform public.customer_create_order_with_payment(
      '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
      '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":3}]'::jsonb,
      null,'atomic-upi-same-key-0001','direct_upi');
    raise exception 'changed_cart_on_retry_was_accepted';
  exception when others then
    if sqlerrm <> 'idempotency_key_reuse_conflict' then raise; end if;
  end;
  begin
    perform public.provider_confirm_direct_upi_payment(v_order_id, 'UTR123456789');
    raise exception 'customer_attested_to_seller_payment';
  exception when others then
    if sqlerrm <> 'order_not_found' then raise; end if;
  end;
end
$idempotency$;
reset role;

-- A seller disabling new UPI instructions must not prevent retrieving an
-- already committed idempotent request.
update public.provider_payment_settings set enabled=false where provider_id='30000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $disabled_seller_retry$
declare v_retry jsonb;
begin
  v_retry := public.customer_create_order_with_payment(
    '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
    '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
    null,'atomic-upi-same-key-0001','direct_upi');
  if v_retry->>'payment_status' <> 'payment_pending_verification' then raise exception 'disabled_seller_retry_failed'; end if;
end
$disabled_seller_retry$;
reset role;
update public.provider_payment_settings set enabled=true where provider_id='30000000-0000-4000-8000-000000000001';

-- Another customer cannot select a payment method or inspect UPI for this order.
select set_config('doodhwala.fixture_order_id', (select id::text from public.orders where idempotency_key='atomic-upi-same-key-0001'), false);
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
do $ownership$
declare v_id uuid;
begin
  -- The UUID is obtained via a fixed test query before RLS switches users, not
  -- from a client-readable list. The fixture's owner role supplies it below.
  v_id := current_setting('doodhwala.fixture_order_id')::uuid;
  begin
    perform public.customer_set_order_payment_method(v_id,'direct_upi');
    raise exception 'other_customer_selected_method';
  exception when others then
    if sqlerrm <> 'order_not_found' then raise; end if;
  end;
  begin
    perform public.customer_get_order_direct_upi(v_id);
    raise exception 'other_customer_read_upi';
  exception when others then
    if sqlerrm <> 'pending_direct_upi_order_not_found' then raise; end if;
  end;
end
$ownership$;
reset role;

-- Only the owning seller can attest; a reference is still not bank verification.
set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);
do $wrong_seller$
begin
  begin
    perform public.provider_confirm_direct_upi_payment(current_setting('doodhwala.fixture_order_id')::uuid,'UTR123456789');
    raise exception 'other_seller_confirmed_payment';
  exception when others then
    if sqlerrm <> 'order_not_found' then raise; end if;
  end;
end
$wrong_seller$;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', false);
do $seller_attestation$
declare v_result jsonb;
begin
  v_result := public.provider_confirm_direct_upi_payment(current_setting('doodhwala.fixture_order_id')::uuid,'UTR123456789');
  if v_result->>'payment_status' <> 'paid_direct_to_seller' then raise exception 'seller_attestation_failed'; end if;
  if not exists(select 1 from public.order_payment_events where order_id=current_setting('doodhwala.fixture_order_id')::uuid
    and event_type='direct_upi_seller_attested' and actor_role='seller'
    and actor_user_id='20000000-0000-4000-8000-000000000001' and amount_paise=10000) then
    raise exception 'seller_attestation_audit_missing';
  end if;
end
$seller_attestation$;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $paid_retry$
declare v_result jsonb;
begin
  v_result := public.customer_create_order_with_payment(
    '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
    '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
    null,'atomic-upi-same-key-0001','direct_upi');
  if v_result->>'payment_status' <> 'paid_direct_to_seller' then raise exception 'paid_retry_did_not_report_actual_status'; end if;
  begin
    perform public.customer_get_order_direct_upi(current_setting('doodhwala.fixture_order_id')::uuid);
    raise exception 'payment_instruction_available_after_attestation';
  exception when others then
    if sqlerrm <> 'pending_direct_upi_order_not_found' then raise; end if;
  end;
end
$paid_retry$;

-- COD is a separate unpaid choice, not a Doodhwala-held payment.
do $cod$
declare v_result jsonb;
begin
  v_result := public.customer_create_order_with_payment(
    '30000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001',
    '[{"product_id":"40000000-0000-4000-8000-000000000002","quantity":1}]'::jsonb,
    null,'atomic-cod-same-key-0001','cod');
  if v_result->>'payment_status' <> 'cash_on_delivery' or v_result->>'payment_method' <> 'cod' then
    raise exception 'cod_choice_wrong';
  end if;
end
$cod$;
reset role;
update public.orders set status='cancelled' where idempotency_key='atomic-cod-same-key-0001';
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $terminal_retry$
declare v_result jsonb;
begin
  v_result := public.customer_create_order_with_payment(
    '30000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001',
    '[{"product_id":"40000000-0000-4000-8000-000000000002","quantity":1}]'::jsonb,
    null,'atomic-cod-same-key-0001','cod');
  if v_result->>'status' <> 'cancelled' then raise exception 'terminal_status_not_returned'; end if;
  if (select count(*) from public.orders where idempotency_key='atomic-cod-same-key-0001') <> 1 then
    raise exception 'terminal_retry_created_duplicate';
  end if;
end
$terminal_retry$;
reset role;

-- A pre-existing unselected order with the same customer/key may be completed
-- atomically, without creating a second order.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
select private.create_order_secure(
  '30000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001',
  '[{"product_id":"40000000-0000-4000-8000-000000000002","quantity":1}]'::jsonb,
  null,'atomic-legacy-key-000001');
set role authenticated;
do $legacy_recovery$
declare v_result jsonb;
begin
  v_result := public.customer_create_order_with_payment(
    '30000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001',
    '[{"product_id":"40000000-0000-4000-8000-000000000002","quantity":1}]'::jsonb,
    null,'atomic-legacy-key-000001','cod');
  if v_result->>'payment_method' <> 'cod' or v_result->>'payment_status' <> 'cash_on_delivery' then
    raise exception 'legacy_unselected_order_not_recovered';
  end if;
  if (select count(*) from public.orders where idempotency_key='atomic-legacy-key-000001') <> 1 then
    raise exception 'legacy_recovery_created_duplicate';
  end if;
end
$legacy_recovery$;

-- Idempotency is customer-scoped: the same key must not reveal or reuse another
-- customer's order, and a foreign address cannot be used to create one.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
do $customer_scope$
declare v_result jsonb;
begin
  begin
    perform public.customer_create_order_with_payment(
      '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
      '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
      null,'atomic-upi-same-key-0001','direct_upi');
    raise exception 'cross_customer_key_revealed_order';
  exception when others then
    if sqlerrm <> 'address_not_owned' then raise; end if;
  end;
  v_result := public.customer_create_order_with_payment(
    '30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002',
    '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
    null,'atomic-upi-same-key-0001','cod');
  if v_result->>'order_id'=current_setting('doodhwala.fixture_order_id') then raise exception 'customer_scoped_key_reused_other_order'; end if;
end
$customer_scope$;
reset role;

select 'atomic checkout migration assertions passed' as result;
