-- Customer order + payment choice must commit together. This is manual seller UPI
-- or COD only: it does not move money or independently verify settlement.
-- Apply only after reviewing the actual target's migration history and testing
-- the complete upgrade/rollback sequence in an isolated staging project.

do $$
begin
  if to_regprocedure('private.create_order_secure(uuid,uuid,jsonb,text,text)') is null
     or to_regprocedure('public.customer_set_order_payment_method(uuid,text)') is null
     or to_regprocedure('public.customer_order_payment_controls_ready()') is null then
    raise exception 'atomic_checkout_dependencies_missing';
  end if;
end;
$$;

-- The definer owns no independent pricing or authorization logic. The existing
-- hardened order creator derives the authenticated customer and server-side
-- price; the existing payment-choice RPC checks ownership and seller eligibility.
-- Any failure in either call aborts this entire transaction, including the order.
create or replace function public.customer_create_order_with_payment(
  p_provider_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_customer_note text,
  p_idempotency_key text,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := nullif(trim(p_idempotency_key), '');
  v_order_id uuid;
  v_payment jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if p_provider_id is null or p_address_id is null then
    raise exception 'invalid_order_request';
  end if;
  if v_key is null or length(v_key) < 16 or length(v_key) > 120 then
    raise exception 'invalid_idempotency_key';
  end if;
  if p_payment_method is null or p_payment_method not in ('direct_upi', 'cod') then
    raise exception 'invalid_payment_method';
  end if;
  if (public.customer_order_payment_controls_ready() ->> 'ready') is distinct from 'true' then
    raise exception 'payment_controls_not_ready';
  end if;

  v_order_id := private.create_order_secure(
    p_provider_id, p_address_id, p_items, p_customer_note, v_key
  );
  if v_order_id is null then
    raise exception 'order_creation_failed';
  end if;

  -- Also completes a same-customer legacy selection_pending order on a safe
  -- idempotent retry. A different already-selected method is rejected.
  v_payment := public.customer_set_order_payment_method(v_order_id, p_payment_method);
  if (v_payment ->> 'order_id') is distinct from v_order_id::text
     or (v_payment ->> 'payment_method') is distinct from p_payment_method
     or nullif(v_payment ->> 'status', '') is null
     or nullif(v_payment ->> 'payment_status', '') is null then
    raise exception 'order_payment_result_invalid';
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'status', v_payment ->> 'status',
    'payment_method', v_payment ->> 'payment_method',
    'payment_status', v_payment ->> 'payment_status'
  );
end;
$$;

revoke all on function public.customer_create_order_with_payment(uuid, uuid, jsonb, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_create_order_with_payment(uuid, uuid, jsonb, text, text, text)
  to authenticated;

comment on function public.customer_create_order_with_payment(uuid, uuid, jsonb, text, text, text) is
'Atomically creates/retrieves the authenticated customer order and records COD or direct-seller UPI choice. No funds move and no payment is bank-verified.';

-- Legacy order-creation entry points can leave selection_pending orders, and
-- the promo path bypasses the payment-choice gate. Revoke every existing
-- overload, including a private helper if present, so stale browsers cannot
-- bypass the new transaction. Scheduled jobs and integrations must be audited
-- on the target: callers that relied on these grants may stop working.
-- A later migration must not re-grant these functions without equivalent checks.
do $$
declare
  v_function text;
begin
  for v_function in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and (
        (n.nspname = 'public' and p.proname in ('create_order', 'create_order_with_promo'))
        or (n.nspname = 'private' and p.proname in ('create_order_secure', 'create_order_secure_with_promo'))
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', v_function);
  end loop;
end;
$$;

-- The new definer must still be able to invoke its dependencies after the
-- revocations above. Abort the migration rather than install a broken RPC if
-- the target uses different function owners or role grants.
do $$
declare
  v_owner oid;
  v_legacy record;
  v_role text;
begin
  select p.proowner into v_owner
  from pg_catalog.pg_proc p
  where p.oid = 'public.customer_create_order_with_payment(uuid,uuid,jsonb,text,text,text)'::regprocedure;
  if not coalesce(has_schema_privilege(v_owner, 'private', 'USAGE'), false)
     or not coalesce(has_function_privilege(v_owner, 'private.create_order_secure(uuid,uuid,jsonb,text,text)', 'EXECUTE'), false)
     or not coalesce(has_function_privilege(v_owner, 'public.customer_set_order_payment_method(uuid,text)', 'EXECUTE'), false)
     or not coalesce(has_function_privilege(v_owner, 'public.customer_order_payment_controls_ready()', 'EXECUTE'), false) then
    raise exception 'atomic_checkout_definer_missing_dependency_privileges';
  end if;
  if not has_function_privilege('authenticated', 'public.customer_create_order_with_payment(uuid,uuid,jsonb,text,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.customer_create_order_with_payment(uuid,uuid,jsonb,text,text,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.customer_create_order_with_payment(uuid,uuid,jsonb,text,text,text)', 'EXECUTE') then
    raise exception 'atomic_checkout_rpc_privileges_invalid';
  end if;

  -- Direct REVOKE is insufficient if a client role inherits an older grant.
  -- Fail closed rather than silently leave a legacy bypass in place.
  for v_legacy in
    select p.oid, n.nspname, p.proname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where p.prokind = 'f'
      and ((n.nspname = 'public' and p.proname in ('create_order', 'create_order_with_promo'))
        or (n.nspname = 'private' and p.proname in ('create_order_secure', 'create_order_secure_with_promo')))
  loop
    foreach v_role in array array['anon', 'authenticated', 'service_role'] loop
      if has_function_privilege(v_role, v_legacy.oid, 'EXECUTE') then
        raise exception 'atomic_checkout_legacy_privilege_remains: %.% for %', v_legacy.nspname, v_legacy.proname, v_role;
      end if;
    end loop;
  end loop;
end;
$$;
