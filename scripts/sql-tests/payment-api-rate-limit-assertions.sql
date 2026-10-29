-- Shared payment API rate-limit tests. Run only on the disposable billing fixture.
\set ON_ERROR_STOP on

insert into auth.users(id)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
on conflict (id) do nothing;

do $rate_limit_test$
declare
  v_allowed boolean;
  v_count bigint;
  v_i integer;
  v_rls_enabled boolean;
begin
  for v_i in 1..30 loop
    v_allowed := public.doodhwala_payment_api_allow_request('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    if v_allowed is distinct from true then
      raise exception 'rate_limiter_denied_request_%_before_limit', v_i;
    end if;
  end loop;

  v_allowed := public.doodhwala_payment_api_allow_request('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  if v_allowed is distinct from false then
    raise exception 'rate_limiter_did_not_block_request_31';
  end if;

  select request_count into v_count
    from public.doodhwala_payment_api_rate_limits
   where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  if v_count <> 31 then
    raise exception 'rate_limiter_count_mismatch_expected_31_found_%', v_count;
  end if;

  -- Simulate an elapsed window without sleeping in CI; the next request resets atomically.
  update public.doodhwala_payment_api_rate_limits
     set window_started_at = clock_timestamp() - interval '61 seconds',
         last_seen_at = clock_timestamp() - interval '61 seconds'
   where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  v_allowed := public.doodhwala_payment_api_allow_request('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  if v_allowed is distinct from true then
    raise exception 'rate_limiter_failed_to_reset_elapsed_window';
  end if;

  select request_count into v_count
    from public.doodhwala_payment_api_rate_limits
   where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  if v_count <> 1 then
    raise exception 'rate_limiter_window_reset_count_expected_1_found_%', v_count;
  end if;

  if has_function_privilege('anon', 'public.doodhwala_payment_api_allow_request(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.doodhwala_payment_api_allow_request(uuid)', 'EXECUTE') then
    raise exception 'browser_role_can_execute_shared_rate_limiter';
  end if;
  if not has_function_privilege('service_role', 'public.doodhwala_payment_api_allow_request(uuid)', 'EXECUTE') then
    raise exception 'service_role_cannot_execute_shared_rate_limiter';
  end if;

  select c.relrowsecurity into v_rls_enabled
    from pg_class c where c.oid = 'public.doodhwala_payment_api_rate_limits'::regclass;
  if v_rls_enabled is distinct from true then
    raise exception 'shared_rate_limit_table_rls_not_enabled';
  end if;
  if has_table_privilege('anon', 'public.doodhwala_payment_api_rate_limits', 'SELECT')
     or has_table_privilege('authenticated', 'public.doodhwala_payment_api_rate_limits', 'SELECT') then
    raise exception 'browser_role_can_read_shared_rate_limit_counters';
  end if;
  if not has_table_privilege('service_role', 'public.doodhwala_payment_api_rate_limits', 'UPDATE') then
    raise exception 'service_role_cannot_access_shared_rate_limit_table';
  end if;
end
$rate_limit_test$;

select 'shared payment API rate-limit checks passed' as result;
