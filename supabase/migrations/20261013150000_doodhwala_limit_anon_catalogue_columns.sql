-- Anonymous clients use the public catalogue RPCs; they do not need broad
-- SELECT grants on customer/account tables or every column of seller records.
-- Keep only the columns read by the invoker catalogue RPCs.
REVOKE SELECT
ON ALL TABLES IN SCHEMA public
FROM anon;

GRANT SELECT (
  id, display_name, area_name, city, pin_code, description,
  primary_milk_type, rating_avg, delivery_from, delivery_to,
  service_radius_km, is_active, accepting_orders
)
ON public.provider_profiles
TO anon;

GRANT SELECT (provider_id, latitude, longitude)
ON public.provider_service_areas
TO anon;

GRANT SELECT (provider_id, status)
ON public.provider_verifications
TO anon;

GRANT SELECT (
  id, provider_id, name, milk_type, price_per_litre, unit_label,
  stock, daily_available, is_active, created_at
)
ON public.milk_products
TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE SELECT ON TABLES FROM anon;

-- Anonymous catalogue policies must not rely on owner data or admin-only checks.
DROP POLICY IF EXISTS provider_profiles_select_anon
ON public.provider_profiles;
CREATE POLICY provider_profiles_select_anon
ON public.provider_profiles
FOR SELECT
TO anon
USING (
  is_active
  AND accepting_orders
  AND private.is_approved_provider(id)
);

DROP POLICY IF EXISTS provider_verifications_select_anon
ON public.provider_verifications;
CREATE POLICY provider_verifications_select_anon
ON public.provider_verifications
FOR SELECT
TO anon
USING (
  private.is_approved_provider(provider_id)
  AND EXISTS (
    SELECT 1
    FROM public.provider_profiles pp
    WHERE pp.id = provider_verifications.provider_id
      AND pp.is_active
      AND pp.accepting_orders
  )
);

DROP POLICY IF EXISTS service_area_select_anon
ON public.provider_service_areas;
CREATE POLICY service_area_select_anon
ON public.provider_service_areas
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.provider_profiles pp
    WHERE pp.id = provider_service_areas.provider_id
      AND pp.is_active
      AND pp.accepting_orders
      AND private.is_approved_provider(pp.id)
  )
);

DROP POLICY IF EXISTS milk_products_select_anon
ON public.milk_products;
CREATE POLICY milk_products_select_anon
ON public.milk_products
FOR SELECT
TO anon
USING (
  is_active
  AND stock
  AND private.is_approved_provider(provider_id)
  AND EXISTS (
    SELECT 1
    FROM public.provider_profiles pp
    WHERE pp.id = milk_products.provider_id
      AND pp.is_active
      AND pp.accepting_orders
  )
);
