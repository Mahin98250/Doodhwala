-- Return only the operational fields a signed-in seller needs for dashboard routing.
-- The implementation derives ownership from auth.uid(); no owner ID is accepted from the caller.
CREATE OR REPLACE FUNCTION private.provider_get_own_profile_impl()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT jsonb_build_object(
    'id', pp.id,
    'accepting_orders', pp.accepting_orders,
    'acceptance_timeout_minutes', pp.acceptance_timeout_minutes,
    'max_open_orders', pp.max_open_orders,
    'max_daily_litres', pp.max_daily_litres
  )
  INTO v_result
  FROM public.provider_profiles pp
  WHERE pp.owner_user_id = v_uid
  LIMIT 1;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'provider_not_found';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_get_own_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $$ SELECT private.provider_get_own_profile_impl() $$;

REVOKE EXECUTE ON FUNCTION public.provider_get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_get_own_profile() TO authenticated;

REVOKE EXECUTE ON FUNCTION private.provider_get_own_profile_impl() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.provider_get_own_profile_impl() TO authenticated;

-- owner_user_id is internal linkage, not public marketplace data. Provider
-- lookups now use provider_get_own_profile() instead of selecting this column.
REVOKE SELECT (owner_user_id)
ON TABLE public.provider_profiles
FROM authenticated;
