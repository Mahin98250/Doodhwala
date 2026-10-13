# Security & Release Readiness

Last repository/security review: 2026-10-13. This document records implementation safeguards and remaining launch checks; it is not a certification that the application is secure or legally compliant.

## Security baseline

Doodhwala is a static GitHub Pages frontend backed by Supabase. The browser must use only a **publishable** Supabase key. Publishable keys are public by design; data isolation comes from Row Level Security (RLS), minimal database grants, and authenticated RPCs—not from hiding the project URL or publishable key.

The production database hardening migrations remove unnecessary TRUNCATE, REFERENCES, and TRIGGER privileges from public API roles, revoke direct INSERT/UPDATE/DELETE from `anon` on existing public tables, and set safer default privileges for objects created by the migration role. Public catalogue reads retain SELECT privileges and are still bounded by RLS. Security-definer functions in public/private use an empty search path and fully qualified database objects. The private owner allowlist is the admin authorization boundary; profile account_type is not an authorization source.

## Repository and live database review (2026-10-13)

- Live Supabase schema inspection found RLS enabled on the reviewed tables in the public and private schemas. Most public tables have row policies. This is a useful baseline, **not** proof that every policy is logically correct; cross-account and cross-role negative tests remain required.
- Live privilege verification after migration `20261013130000_doodhwala_revoke_anon_table_writes.sql` found zero effective anonymous INSERT, UPDATE, or DELETE grants across the 23 reviewed public tables; SELECT access needed by public catalogue RPCs remains unchanged. The pre-change policy audit found no anonymous/PUBLIC write policies.
- A read-only `SET ROLE anon` probe caught a permission mismatch where provider SELECT policies also called the admin-only helper. Migration `20261013140000_doodhwala_split_anon_provider_read_policies.sql` separates anonymous and authenticated policies. Afterward, the nearby-provider RPC succeeded as `anon`; a storefront RPC smoke call also completed without data changes.
- Migration `20261013150000_doodhwala_limit_anon_catalogue_columns.sql` removes table-level SELECT grants from `anon`, adds column-level grants only for the four tables used by the public catalogue RPCs, and narrows anonymous visibility to approved, active, order-accepting providers and available products. Live checks confirmed `anon` cannot read `profiles`, `addresses`, `customer_notifications`, seller owner names, seller phone numbers, or seller owner IDs directly; both public discovery and storefront RPC smoke probes still execute as `anon`.
- Read-only SET ROLE authenticated probes using two existing customer IDs confirmed that each customer sees only their own profile/address rows; requests for the other customer's profile, addresses, loyalty, favourites, notifications and support tickets returned zero visible rows. These are database-role simulations using the current production policies, not full browser/API login tests.
- A cross-role probe found a real privacy leak: the broad authenticated SELECT grant on public.provider_profiles let any signed-in customer read owner_name and phone for an approved seller. Migration 20261013160000_doodhwala_protect_seller_private_fields.sql now removes table-level SELECT from authenticated users and grants only the catalogue/operations columns used by the UI. It also hides verification notes/review timestamps and revokes the unused legacy find_nearby_providers RPC (which returned owner_name) plus its private helper. Live checks confirmed the other customer's view still includes the approved seller's public catalogue fields, hides owner_name/phone/moderator notes at the privilege layer, keeps the signed-in user's own provider row queryable, keeps the v2 public discovery RPC working, and denies execution of the legacy RPC.
- A further privilege probe found `provider_profiles.owner_user_id` still selectable by authenticated users. Migration `20261013170000_doodhwala_hide_provider_owner_uuid.sql` revokes that column grant and adds `provider_get_own_profile()`, which derives the seller from `auth.uid()` and returns only operational fields. Migration `20261013180000_doodhwala_secure_provider_profile_upsert.sql` replaces browser-side profile upserts with a validated owner-scoped write RPC. Live checks confirmed authenticated users cannot select the owner UUID, owner name or phone; the read RPC returns only the caller's own provider ID; anonymous execution is denied; and a valid write-path smoke test ran inside a transaction that was rolled back. The seller dashboard now uses these RPCs instead of filtering directly on the owner UUID.
- Migration `20261013200000_doodhwala_revoke_provider_direct_writes.sql` also revokes authenticated INSERT/UPDATE/DELETE privileges on `provider_profiles`, including any column-level DML grants. A rollback-only live RPC smoke test still returned the caller's provider ID, while privilege checks confirmed direct table DML and owner UUID SELECT are all denied.
- Migration `20261013190000_doodhwala_provider_rls_owner_helper.sql` replaces owner-ID subqueries in product, service-area, verification, subscription, rating and delivery-tracking RLS policies with `private.is_current_user_provider(provider_id)`. This keeps the owner UUID private without breaking policy evaluation. Live read-only role probes confirmed a seller can still read their own products, service areas and verification status, while another authenticated customer can see only catalogue products made public by the existing approval/stock rules. No owner UUID SELECT grant was restored.
- A simulated non-admin customer session returned false from the current-user admin allowlist check. Admin-only RPCs and cross-role denial still require a dedicated end-to-end API test with a real non-admin session before launch.
- Supabase Security Advisor reports an INFO finding for `private.admin_allowlist` (RLS enabled, no policies). This is intentional defense-in-depth only if the `private` schema is not exposed through the Data API and the table is accessible solely to the tightly scoped database authorization helper/owner. Do not add broad client policies to silence this finding.
- Supabase Security Advisor reports an INFO finding for `public.client_error_reports` (RLS enabled, no policies). The live privilege check showed table privileges only for `postgres` and `service_role`, not `anon` or `authenticated`. Keep it that way if error reports are managed through the intended restricted RPCs; verify the RPC authorization and payload scrubbing before release.
- Supabase Security Advisor reports **Leaked Password Protection Disabled**. The current Supabase plan does not make this dashboard feature available, so it has not been enabled. Track this as a known limitation; do not claim it is enabled. Keep password strength checks, email verification, rate-limit awareness and admin MFA where available.
- The application currently has no published customer support contact. The legal center is explicitly marked as a draft and must not be presented as final or as proof of compliance.
- No production order or account rows were created, updated, or deleted. This phase applied authorization/grant/function-execution migrations only.

## Required release checks

### Database and authorization
- Keep the Supabase private schema out of the Data API exposed-schema list. Confirm this in the Supabase dashboard; the SQL inspection tool could not read the PostgREST schema configuration.
- Confirm every exposed table has RLS enabled and narrowly scoped policies. A policy does not replace SQL grants; both layers matter.
- Test customer A cannot read or mutate customer B's profile, addresses, orders, subscriptions, favourites, loyalty records or support tickets.
- Test a provider can access only its own private seller data and only the customer/order fields needed to fulfil its own orders.
- Test non-admin accounts cannot access admin RPCs, reports, audit logs, or the private allowlist even if client-side account metadata is manipulated.
- Review every SECURITY DEFINER function, exposed RPC, execute grant, storage bucket and Edge Function whenever changed.
- Do not create fake production orders to test authorization. Use an isolated staging project/accounts or a genuine, authorized order.
- Run Supabase Security Advisors after schema changes and inspect logs for unexpected RPC errors, auth failures and report-volume spikes.

### Authentication and browser security
- Never place Supabase secret or service-role keys in browser files, GitHub Pages, HTML, or client-side environment variables.
- Require email verification where configured; review password policy, recovery redirects, allowed OAuth redirect URLs, session revocation and admin MFA.
- Keep account roles and ownership enforced by server/database checks, never by hidden buttons or browser-supplied role fields.
- Minimise sensitive information in logs and error reports. Never log passwords, OTPs, access tokens, full payment credentials or unnecessary delivery details.
- Pin third-party dependencies; review whether externally loaded scripts can be self-hosted or given Subresource Integrity where supported. Changes must be tested against the current application.
- GitHub Pages does not provide this repository with a general custom response-header configuration. Review hosting options for appropriate security headers before commercial launch; do not add a restrictive Content Security Policy blindly because the current pages use inline code and third-party assets.
- Test keyboard navigation, accessible error feedback, mobile layouts and offline/PWA cache updates.

### Legal, privacy and consumer protection
- `legal.html` is a draft, not a final contract. Have qualified Indian counsel review it and verify the current commencement and applicability of relevant laws before launch.
- Confirm the exact legal operator name, address, seller relationship, data flows, retention schedule and support/grievance contacts. Do not invent these details.
- Publish operationally accurate cancellation/refund and subscription rules; do not promise remedies or response times the business cannot honour.
- Implement and test user requests for data correction/deletion/withdrawal where applicable, including a way to verify the requester and document the outcome.
- Verify which food-business registrations, licences, product disclosures and seller checks apply. Never show a verified/compliant badge without the corresponding completed review.
- Only collect agreement to the final, approved policy versions. Do not ask users to accept a draft as though it were binding.

## Dashboard actions requiring an owner

The current Supabase Security Advisor reports **Leaked Password Protection Disabled**. This is an Auth project setting, not a SQL/RLS setting, and the feature is unavailable on the current plan. It cannot be enabled through the repository. Also require MFA for the admin/owner account where practical, review allowed auth redirect URLs, and confirm the private schema is not in the Data API's exposed-schema list. These dashboard settings must be verified by an owner when the relevant controls are available.

## Incident response

If a Supabase secret/service-role key may have leaked, revoke or rotate it immediately in Supabase, update only server-side consumers, review access and Edge Function logs, and invalidate affected sessions where appropriate. A leaked publishable key alone is not a secret incident, but any associated RLS/grant gap must be treated seriously. Establish and publish a real security-reporting channel before the legal/security policy is finalised.
