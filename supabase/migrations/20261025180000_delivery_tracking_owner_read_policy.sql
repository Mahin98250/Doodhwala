-- Permit authenticated customers and the owning provider to read only tracking
-- events for their own orders. Event creation remains trusted-server/service-role only.
-- The provider_id match prevents a malformed event row from leaking across orders.
ALTER TABLE public.delivery_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_tracking_owner_read ON public.delivery_tracking_events;
CREATE POLICY delivery_tracking_owner_read
  ON public.delivery_tracking_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders AS o
      WHERE o.id = delivery_tracking_events.order_id
        AND o.provider_id = delivery_tracking_events.provider_id
        AND (
          o.customer_id = (SELECT auth.uid())
          OR o.provider_owner_id = (SELECT auth.uid())
        )
    )
  );

GRANT SELECT ON TABLE public.delivery_tracking_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.delivery_tracking_events FROM PUBLIC, anon, authenticated;
