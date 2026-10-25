-- The exposed customer_cancel_order wrapper is SECURITY INVOKER and delegates
-- to this ownership-checking SECURITY DEFINER implementation. The caller role must
-- have EXECUTE on the implementation for the wrapper to work; authorization remains
-- enforced inside the implementation by auth.uid() and the customer_id predicate.
GRANT EXECUTE ON FUNCTION private.customer_cancel_order_impl(uuid, text) TO authenticated;
