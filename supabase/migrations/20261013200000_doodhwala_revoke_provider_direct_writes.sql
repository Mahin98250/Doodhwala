-- Seller profile changes must go through owner-scoped SECURITY DEFINER RPCs.
-- Direct table writes could otherwise alter moderation or rating fields.
REVOKE INSERT, UPDATE, DELETE
ON TABLE public.provider_profiles
FROM authenticated;

-- Explicitly remove any column-level DML grants as a second layer of defense.
REVOKE INSERT (
  id, owner_user_id, display_name, owner_name, phone, primary_milk_type,
  area_name, city, pin_code, description, delivery_from, delivery_to,
  service_radius_km, rating_avg, is_active, created_at, updated_at,
  max_open_orders, max_daily_litres, acceptance_timeout_minutes, accepting_orders
)
ON TABLE public.provider_profiles
FROM authenticated;

REVOKE UPDATE (
  id, owner_user_id, display_name, owner_name, phone, primary_milk_type,
  area_name, city, pin_code, description, delivery_from, delivery_to,
  service_radius_km, rating_avg, is_active, created_at, updated_at,
  max_open_orders, max_daily_litres, acceptance_timeout_minutes, accepting_orders
)
ON TABLE public.provider_profiles
FROM authenticated;