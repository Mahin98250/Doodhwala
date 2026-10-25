-- Staging security hardening: deny direct client access until narrow policies are reviewed.
-- The admin allowlist is queried by trusted SECURITY DEFINER authorization functions.
-- Keep direct browser roles away from the underlying allowlist table.
ALTER TABLE private.admin_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.admin_allowlist FROM PUBLIC, anon, authenticated;

-- This function is an event-trigger handler, not an application RPC. It should not
-- be executable by API-facing roles. The existing ensure_rls event trigger remains.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Delivery tracking currently has RLS enabled but no policies. Remove broad client
-- table grants until an explicit customer/provider ownership policy is implemented.
REVOKE ALL ON TABLE public.delivery_tracking_events FROM PUBLIC, anon, authenticated;
