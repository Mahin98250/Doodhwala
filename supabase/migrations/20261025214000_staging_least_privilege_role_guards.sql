-- Staging-focused subset of the repository least-privilege baseline.
-- This guards API/table privileges and profile role metadata while absent legacy
-- helper functions remain absent. The global SECURITY DEFINER search_path sweep
-- is deliberately not included here; it requires a separate dependency audit.
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.protect_profile_account_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.is_current_user_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.account_type := 'customer';
    ELSIF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      RAISE EXCEPTION 'account_type_managed_by_admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_protect_account_type ON public.profiles;
CREATE TRIGGER profiles_protect_account_type
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.protect_profile_account_type();

REVOKE EXECUTE ON FUNCTION private.protect_profile_account_type()
  FROM PUBLIC, anon, authenticated, service_role;

-- Revoke generic EXECUTE on internal helper functions only when the helper
-- exists in this staging schema; older production-era migrations refer to
-- helpers not present in this staging snapshot.
DO $block$
BEGIN
  IF to_regprocedure('private.ensure_customer_loyalty(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.ensure_customer_loyalty(uuid) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
  IF to_regprocedure('private.award_order_loyalty_points()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.award_order_loyalty_points() FROM PUBLIC, anon, authenticated, service_role';
  END IF;
  IF to_regprocedure('private.force_new_provider_pending_inactive()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.force_new_provider_pending_inactive() FROM PUBLIC, anon, authenticated, service_role';
  END IF;
  IF to_regprocedure('private.handle_customer_loyalty_signup()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.handle_customer_loyalty_signup() FROM PUBLIC, anon, authenticated, service_role';
  END IF;
  IF to_regprocedure('private.submit_order_rating_impl(uuid,smallint,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.submit_order_rating_impl(uuid,smallint,text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION private.submit_order_rating_impl(uuid,smallint,text) TO authenticated';
  END IF;
  IF to_regprocedure('private.create_order_secure_with_promo(uuid,uuid,jsonb,text,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.create_order_secure_with_promo(uuid,uuid,jsonb,text,text,text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION private.create_order_secure_with_promo(uuid,uuid,jsonb,text,text,text) TO authenticated';
  END IF;
  IF to_regprocedure('private.provider_add_tracking_event_impl(uuid,numeric,numeric,integer,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.provider_add_tracking_event_impl(uuid,numeric,numeric,integer,text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION private.provider_add_tracking_event_impl(uuid,numeric,numeric,integer,text) TO authenticated';
  END IF;
  IF to_regprocedure('private.provider_get_performance_impl()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.provider_get_performance_impl() FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION private.provider_get_performance_impl() TO authenticated';
  END IF;
END;
$block$;
