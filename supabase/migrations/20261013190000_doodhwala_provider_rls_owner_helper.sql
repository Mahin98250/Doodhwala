-- RLS policies must not depend on client SELECT access to provider_profiles.owner_user_id.
-- This boolean-only SECURITY DEFINER helper derives the owner from auth.uid().
CREATE OR REPLACE FUNCTION private.is_current_user_provider(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.provider_profiles pp
       WHERE pp.id = p_provider_id
         AND pp.owner_user_id = auth.uid()
     )
$$;

REVOKE EXECUTE ON FUNCTION private.is_current_user_provider(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_current_user_provider(uuid) TO authenticated;

DROP POLICY IF EXISTS milk_products_delete_own ON public.milk_products;
CREATE POLICY milk_products_delete_own
ON public.milk_products FOR DELETE TO authenticated
USING (private.is_current_user_provider(provider_id));

DROP POLICY IF EXISTS milk_products_insert_own ON public.milk_products;
CREATE POLICY milk_products_insert_own
ON public.milk_products FOR INSERT TO authenticated
WITH CHECK (private.is_current_user_provider(provider_id));

DROP POLICY IF EXISTS milk_products_update_own ON public.milk_products;
CREATE POLICY milk_products_update_own
ON public.milk_products FOR UPDATE TO authenticated
USING (private.is_current_user_provider(provider_id))
WITH CHECK (private.is_current_user_provider(provider_id));

DROP POLICY IF EXISTS milk_products_select_authenticated ON public.milk_products;
CREATE POLICY milk_products_select_authenticated
ON public.milk_products FOR SELECT TO authenticated
USING (
  private.is_current_user_provider(provider_id)
  OR EXISTS (
    SELECT 1
    FROM public.provider_profiles pp
    WHERE pp.id = milk_products.provider_id
      AND pp.is_active
      AND milk_products.is_active
      AND milk_products.stock
      AND private.is_approved_provider(pp.id)
  )
  OR private.is_current_user_admin()
);

DROP POLICY IF EXISTS service_area_insert_own ON public.provider_service_areas;
CREATE POLICY service_area_insert_own
ON public.provider_service_areas FOR INSERT TO authenticated
WITH CHECK (private.is_current_user_provider(provider_id));

DROP POLICY IF EXISTS service_area_update_own ON public.provider_service_areas;
CREATE POLICY service_area_update_own
ON public.provider_service_areas FOR UPDATE TO authenticated
USING (private.is_current_user_provider(provider_id))
WITH CHECK (private.is_current_user_provider(provider_id));

DROP POLICY IF EXISTS service_area_select_authenticated ON public.provider_service_areas;
CREATE POLICY service_area_select_authenticated
ON public.provider_service_areas FOR SELECT TO authenticated
USING (
  private.is_current_user_provider(provider_id)
  OR private.is_approved_provider(provider_id)
  OR private.is_current_user_admin()
);

DROP POLICY IF EXISTS provider_verifications_select_authenticated ON public.provider_verifications;
CREATE POLICY provider_verifications_select_authenticated
ON public.provider_verifications FOR SELECT TO authenticated
USING (
  private.is_approved_provider(provider_id)
  OR private.is_current_user_provider(provider_id)
  OR private.is_current_user_admin()
);

DROP POLICY IF EXISTS delivery_tracking_select_own ON public.delivery_tracking_events;
CREATE POLICY delivery_tracking_select_own
ON public.delivery_tracking_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = delivery_tracking_events.order_id
      AND o.customer_id = (SELECT auth.uid())
  )
  OR private.is_current_user_provider(provider_id)
);

DROP POLICY IF EXISTS "Customers and providers can view milk subscriptions" ON public.milk_subscriptions;
CREATE POLICY "Customers and providers can view milk subscriptions"
ON public.milk_subscriptions FOR SELECT TO authenticated
USING (
  customer_id = (SELECT auth.uid())
  OR private.is_current_user_provider(provider_id)
  OR private.is_current_user_admin()
);

DROP POLICY IF EXISTS order_ratings_select_visible_to_parties ON public.order_ratings;
CREATE POLICY order_ratings_select_visible_to_parties
ON public.order_ratings FOR SELECT TO authenticated
USING (
  customer_id = (SELECT auth.uid())
  OR private.is_current_user_provider(provider_id)
);

DROP POLICY IF EXISTS "Customers and providers can view subscription deliveries" ON public.subscription_deliveries;
CREATE POLICY "Customers and providers can view subscription deliveries"
ON public.subscription_deliveries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.milk_subscriptions ms
    WHERE ms.id = subscription_deliveries.subscription_id
      AND (
        ms.customer_id = (SELECT auth.uid())
        OR private.is_current_user_provider(ms.provider_id)
      )
  )
  OR private.is_current_user_admin()
);
