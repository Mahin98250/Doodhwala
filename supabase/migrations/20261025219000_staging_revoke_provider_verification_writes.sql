-- Verification status is server/admin controlled. Remove inherited column-level
-- writes from browser roles; SELECT remains limited to provider_id/status as granted
-- by the reviewed seller-private-field migration.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.provider_verifications
  FROM PUBLIC, anon, authenticated;

DO $assert$
BEGIN
  IF has_table_privilege('anon', 'public.provider_verifications', 'INSERT')
     OR has_table_privilege('anon', 'public.provider_verifications', 'UPDATE')
     OR has_table_privilege('anon', 'public.provider_verifications', 'DELETE')
     OR has_table_privilege('authenticated', 'public.provider_verifications', 'INSERT')
     OR has_table_privilege('authenticated', 'public.provider_verifications', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.provider_verifications', 'DELETE') THEN
    RAISE EXCEPTION 'provider_verifications_browser_write_privilege_remains';
  END IF;
END;
$assert$;
