-- Consolidate the remaining owner/customer + admin SELECT policy pairs found
-- by the Supabase performance advisor. Keep anon visibility separate wherever it
-- existed previously so anonymous requests never need the private admin helper.

-- Orders: customer, seller owner, or allowlisted admin.
DROP POLICY IF EXISTS admin_realtime_select ON public.orders;
DROP POLICY IF EXISTS orders_customer_or_provider_select ON public.orders;
CREATE POLICY orders_customer_or_provider_select
  ON public.orders
  FOR SELECT TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR provider_owner_id = (SELECT auth.uid())
    OR (SELECT private.is_current_user_admin())
  );

-- Subscriptions: customer, seller owner, or allowlisted admin.
DROP POLICY IF EXISTS admin_realtime_select ON public.milk_subscriptions;
DROP POLICY IF EXISTS "Customers and providers can view milk subscriptions" ON public.milk_subscriptions;
CREATE POLICY milk_subscriptions_owner_or_admin_select
  ON public.milk_subscriptions
  FOR SELECT TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.provider_profiles AS pp
      WHERE pp.id = milk_subscriptions.provider_id
        AND pp.owner_user_id = (SELECT auth.uid())
    )
    OR (SELECT private.is_current_user_admin())
  );

-- Provider profiles: retain the original approved-public / owner visibility
-- for anon, and add admin visibility only to authenticated access.
DROP POLICY IF EXISTS admin_realtime_select ON public.provider_profiles;
DROP POLICY IF EXISTS provider_profiles_select_public_or_owner ON public.provider_profiles;
CREATE POLICY provider_profiles_select_anon
  ON public.provider_profiles
  FOR SELECT TO anon
  USING (
    (SELECT auth.uid()) = owner_user_id
    OR private.is_approved_provider(id)
  );
CREATE POLICY provider_profiles_select_authenticated
  ON public.provider_profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = owner_user_id
    OR private.is_approved_provider(id)
    OR (SELECT private.is_current_user_admin())
  );

-- Provider verification: preserve approved-public / owner visibility and fold
-- allowlisted-admin visibility into the authenticated policy.
DROP POLICY IF EXISTS admin_realtime_select ON public.provider_verifications;
DROP POLICY IF EXISTS provider_verifications_select_public_or_owner ON public.provider_verifications;
CREATE POLICY provider_verifications_select_anon
  ON public.provider_verifications
  FOR SELECT TO anon
  USING (
    private.is_approved_provider(provider_id)
    OR EXISTS (
      SELECT 1
      FROM public.provider_profiles AS pp
      WHERE pp.id = provider_verifications.provider_id
        AND pp.owner_user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY provider_verifications_select_authenticated
  ON public.provider_verifications
  FOR SELECT TO authenticated
  USING (
    private.is_approved_provider(provider_id)
    OR EXISTS (
      SELECT 1
      FROM public.provider_profiles AS pp
      WHERE pp.id = provider_verifications.provider_id
        AND pp.owner_user_id = (SELECT auth.uid())
    )
    OR (SELECT private.is_current_user_admin())
  );

-- Subscription deliveries: read only when related subscription belongs to the
-- customer or provider owner, unless the authenticated user is an allowlisted admin.
DROP POLICY IF EXISTS admin_realtime_select ON public.subscription_deliveries;
DROP POLICY IF EXISTS "Customers and providers can view subscription deliveries" ON public.subscription_deliveries;
CREATE POLICY subscription_deliveries_owner_or_admin_select
  ON public.subscription_deliveries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.milk_subscriptions AS ms
      WHERE ms.id = subscription_deliveries.subscription_id
        AND (
          ms.customer_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.provider_profiles AS pp
            WHERE pp.id = ms.provider_id
              AND pp.owner_user_id = (SELECT auth.uid())
          )
        )
    )
    OR (SELECT private.is_current_user_admin())
  );
