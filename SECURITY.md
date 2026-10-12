# Security

## Security baseline

Doodhwala is a static GitHub Pages frontend backed by Supabase. The browser must use only a **publishable** Supabase key. Publishable keys are public by design; data isolation comes from Row Level Security (RLS), minimal database grants, and authenticated RPCs—not from hiding the project URL or publishable key.

The production database hardening migration keeps existing row-scoped customer/provider CRUD grants intact while removing unnecessary TRUNCATE, REFERENCES, and TRIGGER privileges from public API roles. New database objects created by the migration role default to no grants for PUBLIC, anon, or authenticated until a migration explicitly grants what is required. Security-definer functions in public and private use an empty search path and fully qualified database objects.

The private owner allowlist remains the admin authorization boundary. The profile account_type column is not an authorization source; regular users cannot set it to impersonate a privileged role.

## Required release checks

- Keep the Supabase private schema out of the Data API's exposed schemas. Expose only schemas required by the application (normally public and graphql_public).
- Confirm every exposed table has RLS enabled and narrowly scoped policies. A policy does not replace SQL grants; both layers matter.
- Never place Supabase secret or service-role keys in browser files, GitHub Pages, HTML, or a client-side environment variable.
- Apply database migrations through review and CI. New functions need explicit EXECUTE grants to exactly the roles that need them.
- Do not create fake production orders to test authorization. Use isolated staging accounts/project or a genuine, authorized order.
- Run Supabase Security Advisors after schema changes and inspect logs for unexpected RPC errors, auth failures, and report-volume spikes.

## Dashboard actions (manual)

The current Supabase Security Advisor reports **Leaked Password Protection Disabled**. Enable it in the Supabase Dashboard under **Authentication → Attack Protection → Leaked Password Protection**. This is an Auth project setting, not a SQL/RLS setting; the connected project-management tools available to this repository workflow do not expose a safe Auth-settings update action.

Also require MFA for the admin/owner account where practical, review allowed auth redirect URLs, and confirm the private schema is not in the Data API's exposed-schema list. These Dashboard settings must be verified by an owner.

## Incident response

If a service-role/secret key may have leaked, revoke or rotate it immediately in Supabase, update only server-side consumers, review access and Edge Function logs, and invalidate affected sessions where appropriate. A leaked publishable key alone is not a secret incident, but any associated RLS/grant gap must be treated seriously.
