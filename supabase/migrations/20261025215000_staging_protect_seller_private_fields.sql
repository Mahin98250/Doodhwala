-- Apply the seller private-field boundary from migration 20261013160000.
-- This staging database does not contain the legacy private nearby-search helper
-- mentioned by that original migration, so its revoke is conditional.
REVOKE SELECT ON TABLE public.provider_profiles FROM authenticated;

GRANT SELECT (
  id, owner_user_id, display_name, primary_milk_type, area_name, city, pin_code,
  description, delivery_from, delivery_to, service_radius_km, rating_avg,
  is_active, accepting_orders, max_open_orders, max_daily_litres,
  acceptance_timeout_minutes, created_at, updated_at
) ON TABLE public.provider_profiles TO authenticated;

REVOKE SELECT ON TABLE public.provider_verifications FROM authenticated;
GRANT SELECT (provider_id, status)
ON TABLE public.provider_verifications TO authenticated;

REVOKE EXECUTE ON FUNCTION public.find_nearby_providers(numeric, numeric, numeric)
FROM PUBLIC, anon, authenticated;

DO $block$
BEGIN
  IF to_regprocedure('private.find_nearby_providers_private(numeric,numeric,numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.find_nearby_providers_private(numeric,numeric,numeric) FROM PUBLIC, anon, authenticated';
  END IF;
END;
$block$;
