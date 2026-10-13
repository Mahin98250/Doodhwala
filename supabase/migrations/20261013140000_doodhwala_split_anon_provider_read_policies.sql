-- Keep the approved-provider read path usable anonymously without granting
-- anonymous callers permission to execute the admin authorization helper.
-- A policy shared by anon/authenticated must not reference functions that anon
-- cannot execute, even behind an OR branch.
DROP POLICY IF EXISTS provider_profiles_select_public_or_owner
ON public.provider_profiles;

CREATE POLICY provider_profiles_select_anon
ON public.provider_profiles
FOR SELECT
TO anon
USING (private.is_approved_provider(id));

CREATE POLICY provider_profiles_select_authenticated
ON public.provider_profiles
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = owner_user_id
  OR private.is_approved_provider(id)
  OR (SELECT private.is_current_user_admin())
);

DROP POLICY IF EXISTS provider_verifications_select_public_or_owner
ON public.provider_verifications;

CREATE POLICY provider_verifications_select_anon
ON public.provider_verifications
FOR SELECT
TO anon
USING (private.is_approved_provider(provider_id));

CREATE POLICY provider_verifications_select_authenticated
ON public.provider_verifications
FOR SELECT
TO authenticated
USING (
  private.is_approved_provider(provider_id)
  OR EXISTS (
    SELECT 1
    FROM public.provider_profiles pp
    WHERE pp.id = provider_verifications.provider_id
      AND pp.owner_user_id = (SELECT auth.uid())
  )
  OR (SELECT private.is_current_user_admin())
);
