-- Remove the legacy non-idempotent implementation.
-- The only application wrapper (public.create_order) calls the 5-argument version
-- explicitly. The legacy 4-argument overload was executable only by postgres and
-- duplicated checkout logic without idempotency protection.
DROP FUNCTION IF EXISTS private.create_order_secure(uuid, uuid, jsonb, text);
