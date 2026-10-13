-- Replace browser-side provider_profiles upserts with a scoped RPC so the
-- private owner UUID never needs a client SELECT grant.
CREATE OR REPLACE FUNCTION private.provider_upsert_own_profile_impl(
  p_display_name text,
  p_owner_name text,
  p_phone text,
  p_primary_milk_type text,
  p_area_name text,
  p_city text,
  p_pin_code text,
  p_service_radius_km numeric,
  p_delivery_from time,
  p_delivery_to time,
  p_max_open_orders integer,
  p_max_daily_litres numeric,
  p_acceptance_timeout_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_provider_id uuid;
  v_display_name text := left(trim(coalesce(p_display_name, '')), 120);
  v_owner_name text := left(trim(coalesce(p_owner_name, '')), 120);
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_milk_type text := lower(trim(coalesce(p_primary_milk_type, '')));
  v_area text := left(trim(coalesce(p_area_name, '')), 120);
  v_city text := left(trim(coalesce(p_city, '')), 120);
  v_pin text := trim(coalesce(p_pin_code, ''));
  v_radius numeric := coalesce(p_service_radius_km, 5);
  v_open_orders integer := coalesce(p_max_open_orders, 25);
  v_daily_litres numeric := coalesce(p_max_daily_litres, 250);
  v_timeout integer := coalesce(p_acceptance_timeout_minutes, 10);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;
  IF v_display_name = '' OR v_owner_name = '' OR v_area = '' OR v_city = '' THEN
    RAISE EXCEPTION 'required_provider_fields_missing';
  END IF;
  IF v_phone !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'invalid_provider_phone';
  END IF;
  IF v_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'invalid_provider_pin';
  END IF;
  IF v_milk_type NOT IN ('cow', 'buffalo', 'a2', 'mixed') THEN
    RAISE EXCEPTION 'invalid_provider_milk_type';
  END IF;
  IF v_radius <= 0 OR v_radius > 25 THEN
    RAISE EXCEPTION 'invalid_provider_service_radius';
  END IF;
  IF v_open_orders < 1 OR v_open_orders > 500 THEN
    RAISE EXCEPTION 'invalid_provider_order_capacity';
  END IF;
  IF v_daily_litres <= 0 OR v_daily_litres > 100000 THEN
    RAISE EXCEPTION 'invalid_provider_daily_capacity';
  END IF;
  IF v_timeout < 1 OR v_timeout > 120 THEN
    RAISE EXCEPTION 'invalid_provider_acceptance_timeout';
  END IF;

  INSERT INTO public.provider_profiles (
    owner_user_id, display_name, owner_name, phone, primary_milk_type,
    area_name, city, pin_code, service_radius_km, delivery_from, delivery_to,
    max_open_orders, max_daily_litres, acceptance_timeout_minutes, updated_at
  )
  VALUES (
    v_uid, v_display_name, v_owner_name, v_phone, v_milk_type,
    v_area, v_city, v_pin, v_radius, p_delivery_from, p_delivery_to,
    v_open_orders, v_daily_litres, v_timeout, now()
  )
  ON CONFLICT (owner_user_id) DO UPDATE SET
    display_name = excluded.display_name,
    owner_name = excluded.owner_name,
    phone = excluded.phone,
    primary_milk_type = excluded.primary_milk_type,
    area_name = excluded.area_name,
    city = excluded.city,
    pin_code = excluded.pin_code,
    service_radius_km = excluded.service_radius_km,
    delivery_from = excluded.delivery_from,
    delivery_to = excluded.delivery_to,
    max_open_orders = excluded.max_open_orders,
    max_daily_litres = excluded.max_daily_litres,
    acceptance_timeout_minutes = excluded.acceptance_timeout_minutes,
    updated_at = now()
  RETURNING id INTO v_provider_id;

  RETURN jsonb_build_object('id', v_provider_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_upsert_own_profile(
  p_display_name text,
  p_owner_name text,
  p_phone text,
  p_primary_milk_type text,
  p_area_name text,
  p_city text,
  p_pin_code text,
  p_service_radius_km numeric,
  p_delivery_from time,
  p_delivery_to time,
  p_max_open_orders integer,
  p_max_daily_litres numeric,
  p_acceptance_timeout_minutes integer
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT private.provider_upsert_own_profile_impl(
    p_display_name, p_owner_name, p_phone, p_primary_milk_type,
    p_area_name, p_city, p_pin_code, p_service_radius_km,
    p_delivery_from, p_delivery_to, p_max_open_orders,
    p_max_daily_litres, p_acceptance_timeout_minutes
  )
$$;

REVOKE EXECUTE ON FUNCTION public.provider_upsert_own_profile(text,text,text,text,text,text,text,numeric,time,time,integer,numeric,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_upsert_own_profile(text,text,text,text,text,text,text,numeric,time,time,integer,numeric,integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION private.provider_upsert_own_profile_impl(text,text,text,text,text,text,text,numeric,time,time,integer,numeric,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.provider_upsert_own_profile_impl(text,text,text,text,text,text,text,numeric,time,time,integer,numeric,integer) TO authenticated;
