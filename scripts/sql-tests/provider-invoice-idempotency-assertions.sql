-- Apply after the invoice-period idempotency migration in the disposable DB.
\set ON_ERROR_STOP on

insert into auth.users(id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.provider_profiles(id, owner_user_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.provider_billing_plans(id, name, amount_paise, is_active)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Standard Monthly', 200000, true);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
select set_config('request.jwt.claim.admin', 'true', false);

do $billing_test$
declare
  v_first uuid;
  v_second uuid;
  v_count integer;
  v_invoice_number text;
  v_bad_period_rejected boolean := false;
  v_duplicate_rejected boolean := false;
  v_non_admin_rejected boolean := false;
  v_null_admin_rejected boolean := false;
  v_unauthenticated_rejected boolean := false;
  v_plan_limit_rejected boolean := false;
  v_direct_plan_amount_rejected boolean := false;
  v_direct_invoice_amount_rejected boolean := false;
  v_direct_payment_amount_rejected boolean := false;
  v_future_payment_rejected boolean := false;
  v_pre_invoice_payment_rejected boolean := false;
  v_payment_amount_rejected boolean := false;
  v_guard_invoice_id uuid;
  v_guard_payment_id uuid;
  v_guard_status text;
  v_guard_paid_at timestamptz;
begin
  v_first := public.admin_create_provider_subscription_invoice(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    date '2026-10-01', date '2026-10-31', date '2026-11-07',
    'DW-2026-10-TEST-1', 'synthetic fixture'
  );

  -- Simulate a client retry with a fresh invoice number. It must return the
  -- first invoice id, not create another invoice for the same provider/month.
  v_second := public.admin_create_provider_subscription_invoice(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    date '2026-10-01', date '2026-10-31', date '2026-11-07',
    'DW-2026-10-TEST-2', 'synthetic retry'
  );

  if v_first is distinct from v_second then
    raise exception 'invoice_retry_returned_different_id';
  end if;

  select count(*) into v_count
    from public.provider_subscription_invoices
   where provider_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and period_start = date '2026-10-01';

  if v_count <> 1 then
    raise exception 'expected_one_invoice_per_provider_month_but_found_%', v_count;
  end if;

  select invoice_number into v_invoice_number
    from public.provider_subscription_invoices
   where id = v_first;

  if v_invoice_number <> 'DW-2026-10-TEST-1' then
    raise exception 'retry_mutated_original_invoice_number';
  end if;

  begin
    perform public.admin_create_provider_subscription_invoice(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      date '2026-10-02', date '2026-10-31', date '2026-11-07',
      'DW-2026-10-BAD-PERIOD', 'invalid synthetic period'
    );
  exception when others then
    if sqlerrm = 'monthly_period_must_cover_calendar_month' then
      v_bad_period_rejected := true;
    else
      raise;
    end if;
  end;

  if not v_bad_period_rejected then
    raise exception 'mid_month_invoice_period_was_not_rejected';
  end if;

  -- The unique constraint remains the final defense for concurrent callers
  -- and direct SQL paths, not only for the RPC's friendly retry behavior.
  begin
    insert into public.provider_subscription_invoices(
      provider_id, plan_id, plan_name_snapshot, amount_paise,
      period_start, period_end, due_date, invoice_number, notes
    ) values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'Standard Monthly', 200000,
      date '2026-10-01', date '2026-10-31', date '2026-11-07',
      'DW-2026-10-DIRECT-DUPLICATE', 'should be rejected'
    );
  exception when unique_violation then
    v_duplicate_rejected := true;
  end;

  if not v_duplicate_rejected then
    raise exception 'database_allowed_duplicate_provider_month_invoice';
  end if;

  -- Server-side plan amount limits must apply even if a caller bypasses the UI.
  begin
    perform public.admin_upsert_provider_billing_plan(
      null::uuid, 'Out of range plan', 100000001::bigint, 'synthetic invalid plan', true
    );
  exception when others then
    if sqlerrm = 'invalid_plan_amount' then v_plan_limit_rejected := true;
    else raise;
    end if;
  end;
  if not v_plan_limit_rejected then
    raise exception 'rpc_accepted_plan_price_above_limit';
  end if;

  -- Table constraints independently protect against accidental privileged SQL paths.
  begin
    insert into public.provider_billing_plans(name, amount_paise, is_active)
    values ('Direct invalid plan', 100000001, true);
  exception when check_violation then
    v_direct_plan_amount_rejected := true;
  end;
  if not v_direct_plan_amount_rejected then
    raise exception 'database_accepted_plan_price_above_limit';
  end if;

  begin
    insert into public.provider_subscription_invoices(
      provider_id, plan_id, plan_name_snapshot, amount_paise,
      period_start, period_end, due_date, invoice_number, notes
    ) values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'Standard Monthly', 100000001,
      date '2026-12-01', date '2026-12-31', date '2027-01-07',
      'DW-2026-12-INVALID-AMOUNT', 'invalid synthetic invoice'
    );
  exception when check_violation then
    v_direct_invoice_amount_rejected := true;
  end;
  if not v_direct_invoice_amount_rejected then
    raise exception 'database_accepted_invoice_amount_above_limit';
  end if;

  v_guard_invoice_id := public.admin_create_provider_subscription_invoice(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    date '2026-11-01', date '2026-11-30', date '2026-12-07',
    'DW-2026-11-GUARD', 'synthetic amount/time guard invoice'
  );

  begin
    perform public.admin_record_provider_subscription_payment(
      v_guard_invoice_id, 200000, 'manual_upi', 'FUTURE-UTR-001',
      now() + interval '1 day', 'future timestamp must be rejected'
    );
  exception when others then
    if sqlerrm = 'payment_received_at_in_future' then v_future_payment_rejected := true;
    else raise;
    end if;
  end;
  if not v_future_payment_rejected then
    raise exception 'future_dated_payment_was_not_rejected';
  end if;

  begin
    perform public.admin_record_provider_subscription_payment(
      v_guard_invoice_id, 200000, 'manual_upi', 'BACKDATE-UTR-001',
      now() - interval '1 day', 'before-invoice timestamp must be rejected'
    );
  exception when others then
    if sqlerrm = 'payment_received_before_invoice' then v_pre_invoice_payment_rejected := true;
    else raise;
    end if;
  end;
  if not v_pre_invoice_payment_rejected then
    raise exception 'payment_before_invoice_creation_was_not_rejected';
  end if;

  begin
    perform public.admin_record_provider_subscription_payment(
      v_guard_invoice_id, 199999, 'manual_upi', 'AMOUNT-UTR-001',
      now(), 'amount mismatch must be rejected'
    );
  exception when others then
    if sqlerrm = 'payment_amount_mismatch' then v_payment_amount_rejected := true;
    else raise;
    end if;
  end;
  if not v_payment_amount_rejected then
    raise exception 'payment_amount_mismatch_was_not_rejected';
  end if;

  begin
    insert into public.provider_subscription_payments(
      invoice_id, provider_id, amount_paise, method, reference, recorded_by, notes
    ) values (
      v_guard_invoice_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      100000001, 'manual_upi', 'DIRECT-INVALID-PAYMENT-001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'invalid synthetic payment'
    );
  exception when check_violation then
    v_direct_payment_amount_rejected := true;
  end;
  if not v_direct_payment_amount_rejected then
    raise exception 'database_accepted_payment_amount_above_limit';
  end if;

  v_guard_payment_id := public.admin_record_provider_subscription_payment(
    v_guard_invoice_id, 200000, 'manual_upi', 'VALID-UTR-001',
    now(), 'valid synthetic reconciliation'
  );
  select i.status, i.paid_at into v_guard_status, v_guard_paid_at
    from public.provider_subscription_invoices i where i.id=v_guard_invoice_id;
  if v_guard_payment_id is null or v_guard_status <> 'paid' or v_guard_paid_at > now() + interval '5 minutes' then
    raise exception 'valid_manual_reconciliation_did_not_complete_safely';
  end if;
  if (select count(*) from public.provider_subscription_payments where invoice_id=v_guard_invoice_id) <> 1 then
    raise exception 'failed_payment_attempt_left_a_payment_record';
  end if;

  perform set_config('request.jwt.claim.admin', 'false', false);
  begin
    perform public.admin_create_provider_subscription_invoice(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      date '2026-11-01', date '2026-11-30', date '2026-12-07',
      'DW-2026-11-NONADMIN', 'should be rejected'
    );
  exception when others then
    if sqlerrm = 'admin_access_required' then
      v_non_admin_rejected := true;
    else
      raise;
    end if;
  end;

  if not v_non_admin_rejected then
    raise exception 'non_admin_invoice_creation_was_not_rejected';
  end if;

  -- An unexpected NULL result from the admin helper must also fail closed.
  perform set_config('request.jwt.claim.admin', 'null', false);
  begin
    perform public.admin_create_provider_subscription_invoice(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      date '2026-12-01', date '2026-12-31', date '2027-01-07',
      'DW-2026-12-NULLADMIN', 'should be rejected'
    );
  exception when others then
    if sqlerrm = 'admin_access_required' then
      v_null_admin_rejected := true;
    else
      raise;
    end if;
  end;

  if not v_null_admin_rejected then
    raise exception 'null_admin_result_did_not_fail_closed';
  end if;

  -- A forged admin claim without a user subject must not pass the auth.uid()
  -- guard. This protects against anonymous/malformed JWT claim contexts.
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.admin', 'true', false);
  begin
    perform public.admin_create_provider_subscription_invoice(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      date '2027-01-01', date '2027-01-31', date '2027-02-07',
      'DW-2027-01-UNAUTHENTICATED', 'must be rejected without auth.uid()'
    );
  exception when others then
    if sqlerrm = 'admin_access_required' then
      v_unauthenticated_rejected := true;
    else
      raise;
    end if;
  end;

  if not v_unauthenticated_rejected then
    raise exception 'missing_user_subject_with_admin_claim_was_not_rejected';
  end if;
end
  $billing_test$;

select 'provider invoice monthly idempotency checks passed' as result;
