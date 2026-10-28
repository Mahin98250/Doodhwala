#!/usr/bin/env bash
# Only run on the disposable synthetic PostgreSQL database after the SQL assertions.
set -euo pipefail
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

request() {
  local key=$1 method=$2
  psql -X -qAt -v ON_ERROR_STOP=1 -v test_key="$key" -v test_method="$method" <<'SQL'
begin;
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select public.customer_create_order_with_payment(
  '30000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '[{"product_id":"40000000-0000-4000-8000-000000000001","quantity":2}]'::jsonb,
  null, :'test_key', :'test_method'
)->>'order_id';
-- Hold the transaction and its advisory/order locks while the other request runs.
select pg_sleep(1);
commit;
SQL
}

key='atomic-concurrent-same-method-001'
request "$key" direct_upi >"$work/a.out" 2>"$work/a.err" & a=$!
request "$key" direct_upi >"$work/b.out" 2>"$work/b.err" & b=$!
status_a=0; wait "$a" || status_a=$?
status_b=0; wait "$b" || status_b=$?
if [[ $status_a -ne 0 || $status_b -ne 0 ]]; then
  cat "$work/a.err" "$work/b.err" >&2; exit 1
fi
id_a=$(tr -d '[:space:]' <"$work/a.out")
id_b=$(tr -d '[:space:]' <"$work/b.out")
if [[ ! $id_a =~ ^[0-9a-f-]{36}$ || $id_a != "$id_b" ]]; then
  printf 'Concurrent identical requests returned different order IDs: %s / %s\n' "$id_a" "$id_b" >&2; exit 1
fi

key='atomic-concurrent-mixed-method-001'
request "$key" direct_upi >"$work/c.out" 2>"$work/c.err" & c=$!
request "$key" cod >"$work/d.out" 2>"$work/d.err" & d=$!
status_c=0; wait "$c" || status_c=$?
status_d=0; wait "$d" || status_d=$?
if [[ $status_c -eq 0 && $status_d -ne 0 ]]; then
  grep -Fq 'payment_method_already_selected' "$work/d.err" || { cat "$work/d.err" >&2; exit 1; }
elif [[ $status_d -eq 0 && $status_c -ne 0 ]]; then
  grep -Fq 'payment_method_already_selected' "$work/c.err" || { cat "$work/c.err" >&2; exit 1; }
else
  printf 'Expected exactly one winning payment method, statuses: %s / %s\n' "$status_c" "$status_d" >&2
  cat "$work/c.err" "$work/d.err" >&2; exit 1
fi

psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare v_order public.orders%rowtype;
begin
  if (select count(*) from public.orders where idempotency_key='atomic-concurrent-same-method-001') <> 1
     or (select count(*) from public.orders where idempotency_key='atomic-concurrent-mixed-method-001') <> 1 then
    raise exception 'concurrent_retry_created_duplicate';
  end if;
  for v_order in select * from public.orders where idempotency_key in
    ('atomic-concurrent-same-method-001','atomic-concurrent-mixed-method-001')
  loop
    if (select count(*) from public.order_items where order_id=v_order.id) <> 1
       or not ((v_order.payment_method='cod' and v_order.payment_status='cash_on_delivery')
         or (v_order.payment_method='direct_upi' and v_order.payment_status='payment_pending_verification')) then
      raise exception 'concurrent_retry_left_incomplete_order:%', v_order.id;
    end if;
  end loop;
end
$$;
SQL
printf 'Concurrent identical retries and competing payment choices passed.\n'
