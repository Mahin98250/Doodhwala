-- Accelerate the two capacity guards in private.create_order_secure.
-- This migration adds lookup indexes only; it does not alter order limits or live data.
--
-- Open-order guard:
--   WHERE provider_id = ... AND status IN (...)
-- Daily-volume guard:
--   WHERE provider_id = ...
--     AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = ...
--     AND status NOT IN (...)
--
-- The expression index deliberately mirrors the current Kolkata-local-date predicate.
-- Keeping these indexes on the order row makes each checkout's capacity check avoid
-- scanning unrelated sellers' orders. The existing order_items(order_id) index serves
-- the join to quantities.

create index if not exists orders_provider_open_capacity_idx
  on public.orders (provider_id)
  where status in ('placed','accepted','preparing','ready','out_for_delivery');

create index if not exists orders_provider_daily_litres_idx
  on public.orders (
    provider_id,
    ((created_at at time zone 'Asia/Kolkata')::date)
  )
  where status not in ('rejected','cancelled');

comment on index public.orders_provider_open_capacity_idx is
  'Supports per-provider open-order capacity checks during atomic order creation.';
comment on index public.orders_provider_daily_litres_idx is
  'Supports per-provider Kolkata-local-day litre-capacity checks during atomic order creation.';
