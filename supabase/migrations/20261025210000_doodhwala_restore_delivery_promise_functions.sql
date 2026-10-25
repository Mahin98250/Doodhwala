-- Restore the internal ETA/promise functions referenced by the hardened provider
-- order lifecycle. They are private implementation functions, not browser RPCs.
-- The calculations use the order's saved delivery coordinates and the provider's
-- service area; all writes remain in the calling order-status transaction.

CREATE OR REPLACE FUNCTION private.calculate_order_eta(p_order_id uuid)
RETURNS TABLE(
  eta_min integer,
  eta_max integer,
  promised_at timestamptz,
  late_after timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_area public.provider_service_areas%rowtype;
  v_distance numeric := null;
  v_travel integer := 20;
  v_queue integer := 0;
  v_open integer := 0;
  v_min integer;
  v_max integer;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  SELECT * INTO v_area
  FROM public.provider_service_areas
  WHERE provider_id = v_order.provider_id;

  IF v_order.delivery_latitude IS NOT NULL
     AND v_order.delivery_longitude IS NOT NULL
     AND v_area.latitude IS NOT NULL
     AND v_area.longitude IS NOT NULL THEN
    v_distance := 6371 * 2 * asin(sqrt(least(1,
      power(sin(radians(v_order.delivery_latitude - v_area.latitude) / 2), 2)
      + cos(radians(v_order.delivery_latitude)) * cos(radians(v_area.latitude))
      * power(sin(radians(v_order.delivery_longitude - v_area.longitude) / 2), 2)
    )));
    v_travel := greatest(8, least(75, ceil((v_distance / 22.0) * 60)::integer));
  END IF;

  SELECT count(*) INTO v_open
  FROM public.orders AS o
  WHERE o.provider_id = v_order.provider_id
    AND o.id <> v_order.id
    AND o.status IN ('accepted','preparing','ready','out_for_delivery');

  v_queue := least(45, v_open * 8);
  v_min := greatest(15, least(300, 15 + v_queue + v_travel));
  v_max := least(360, v_min + 20);

  RETURN QUERY
  SELECT v_min,
         v_max,
         now() + make_interval(mins => v_max),
         now() + make_interval(mins => (v_max + 10));
END;
$function$;

CREATE OR REPLACE FUNCTION private.set_order_delivery_promise(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_eta record;
BEGIN
  SELECT * INTO v_eta
  FROM private.calculate_order_eta(p_order_id);

  UPDATE public.orders
  SET estimated_delivery_min_minutes = v_eta.eta_min,
      estimated_delivery_max_minutes = v_eta.eta_max,
      promised_delivery_at = v_eta.promised_at,
      late_after_at = v_eta.late_after,
      updated_at = now()
  WHERE id = p_order_id;
END;
$function$;

-- These are private call-chain helpers. The SECURITY DEFINER lifecycle function
-- owns the call path; do not expose the implementation functions as API RPCs.
REVOKE ALL ON FUNCTION private.calculate_order_eta(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_order_delivery_promise(uuid) FROM PUBLIC, anon, authenticated;
