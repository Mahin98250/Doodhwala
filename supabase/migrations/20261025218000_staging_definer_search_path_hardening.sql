-- Apply the hardened empty search_path intended by repository migration
-- 20261012084616 to every SECURITY DEFINER function currently present in staging.
-- Table and function references in these implementations are schema-qualified.
-- Missing older helper signatures are intentionally not recreated in staging.
DO $$
DECLARE
  v_signature text;
BEGIN
  FOR v_signature IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind = 'f'
      AND p.prosecdef
      AND n.nspname IN ('public', 'private')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = %L', v_signature, '');
  END LOOP;
END;
$$;

-- Runtime assertion: no SECURITY DEFINER function in the API schemas should
-- retain a non-empty, user-controllable search_path.
DO $assert$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind = 'f'
      AND p.prosecdef
      AND n.nspname IN ('public', 'private')
      AND NOT coalesce(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
  ) THEN
    RAISE EXCEPTION 'security_definer_search_path_hardening_incomplete';
  END IF;
END;
$assert$;
