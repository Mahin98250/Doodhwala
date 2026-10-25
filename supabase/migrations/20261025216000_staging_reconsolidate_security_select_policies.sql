-- Keep the stricter order-verified delivery tracking policy and one SELECT
-- policy per owner/customer read path after applying the provider-owner helper.
DROP POLICY IF EXISTS delivery_tracking_select_own
  ON public.delivery_tracking_events;

DROP POLICY IF EXISTS milk_subscriptions_owner_or_admin_select
  ON public.milk_subscriptions;

DROP POLICY IF EXISTS subscription_deliveries_owner_or_admin_select
  ON public.subscription_deliveries;
