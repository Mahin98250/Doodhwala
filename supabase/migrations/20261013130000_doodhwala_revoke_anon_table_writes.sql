-- Reduce the anonymous API role to read-only access on existing application tables.
-- Live audit on 2026-10-13 found no anon/PUBLIC INSERT, UPDATE, DELETE RLS policies.
-- The public marketplace RPCs need SELECT, so keep SELECT grants and catalog RLS
-- boundaries intact while removing unnecessary direct-write privileges.
REVOKE INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
FROM anon;

-- Keep the least-privilege rule in place for future tables created by postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;
