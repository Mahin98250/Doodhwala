-- Keep seller identity/contact fields private to the seller and the admin RPC layer.
-- Approved seller rows are visible in the public marketplace, but public clients
-- should use explicit catalogue fields rather than reading owner_name / phone.
REVOKE SELECT
ON TABLE public.provider_profiles
FROM authenticated;

GRANT SELECT (
  id,
  owner_user_id,
  display_name,
  primary_milk_type,
  area_name,
  city,
  pin_code,
  description,
  delivery_from,
  delivery_to,
  service_radius_km,
  rating_avg,
  is_active,
  accepting_orders,
  max_open_orders,
  max_daily_litres,
  acceptance_timeout_minutes,
  created_at,
  updated_at
)
ON TABLE public.provider_profiles
TO authenticated;

-- Verification notes and review timestamps are moderator-side metadata.
-- The marketplace only needs provider_id/status for catalogue visibility.
REVOKE SELECT
ON TABLE public.provider_verifications
FROM authenticated;

GRANT SELECT (provider_id, status)
ON TABLE public.provider_verifications
TO authenticated;

-- This legacy RPC returns the seller's owner_name. The current application uses
-- find_nearby_providers_v2 instead, which returns only public catalogue fields.
-- Remove the unused legacy RPC from client access and keep its private helper
-- inaccessible to client roles. The wrapper owner can still call its helper.
REVOKE EXECUTE
ON FUNCTION public.find_nearby_providers(numeric, numeric, numeric)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE
ON FUNCTION private.find_nearby_providers_private(numeric, numeric, numeric)
FROM PUBLIC, anon, authenticated;
