# Doodhwala staging migration reconciliation

Date checked: 2026-10-25  
Target database: `jbcekiaiyxcatueixeqh` (`Doodhwala Staging`)  
Production database is out of scope.

## Stop rule

**Do not run `supabase db push`, reset, or promote migrations to production until this document's reconciliation is completed and reviewed.** The staging SQL migration API recorded several manually applied SQL files under execution-time version strings, whereas repository files have their own filename timestamp versions. The applied SQL is present in staging, but that does not automatically mean the CLI considers the corresponding repository filenames applied.

Do not edit `supabase_migrations.schema_migrations` directly with SQL. Use the official Supabase migration workflow after independently verifying each local file's contents match the corresponding applied staging change. Preserve the before/after migration list in the release record and require a second review before any repair operation. No migration-history repair or production write has been performed as part of this audit.

## Manually applied staging migrations and source files

The `staging recorded version` column comes from the staging project's `supabase_migrations.schema_migrations` table. The `repository source filename` column is the tracked file on `security/staging-db-hardening`. A mismatch is a bookkeeping mismatch to reconcile, not permission to re-run the SQL.

| Change | Repository source filename | Staging recorded version | Staging recorded name |
|---|---|---:|---|
| Initial staging security hardening | `20261025170000_staging_security_hardening.sql` | `20261025104745` | `staging_security_hardening` |
| Remove obsolete order RPC overload | `20261025171000_remove_legacy_create_order_overload.sql` | `20261025104834` | `remove_legacy_create_order_overload` |
| Tracking owner-read policy | `20261025180000_delivery_tracking_owner_read_policy.sql` | `20261025105829` | `delivery_tracking_owner_read_policy` |
| Payment foundation | `20261022120000_doodhwala_pay_foundation.sql` | `20261025110436` | `doodhwala_pay_foundation` |
| Seller direct payments | `20261022150000_doodhwala_direct_seller_payments.sql` | `20261025110439` | `doodhwala_direct_seller_payments` |
| Seller UPI settings read | `20261022151000_doodhwala_direct_upi_settings_read.sql` | `20261025110443` | `doodhwala_direct_upi_settings_read` |
| Payment-choice race guard | `20261022152000_doodhwala_payment_choice_race_guard.sql` | `20261025110447` | `doodhwala_payment_choice_race_guard` |
| Guard direct payment-field writes | `20261022153000_doodhwala_guard_payment_field_writes.sql` | `20261025110450` | `doodhwala_guard_payment_field_writes` |
| Pending-only UPI instructions | `20261022154000_doodhwala_direct_upi_pending_only.sql` | `20261025110453` | `doodhwala_direct_upi_pending_only` |
| Payment controls readiness | `20261023050000_doodhwala_payment_controls_readiness.sql` | `20261025110456` | `doodhwala_payment_controls_readiness` |
| Re-check seller approval for UPI | `20261023100000_doodhwala_recheck_seller_approval_for_upi.sql` | `20261025110500` | `doodhwala_recheck_seller_approval_for_upi` |
| Payment foreign-key indexes | `20261025190000_doodhwala_payment_fk_indexes.sql` | `20261025110636` | `doodhwala_payment_fk_indexes` |
| Consolidate admin SELECT policies | `20261012090500_doodhwala_consolidate_admin_select_policies.sql` | `20261025110904` | `doodhwala_consolidate_admin_select_policies` |
| Consolidate remaining admin SELECT policies | `20261025200000_doodhwala_consolidate_admin_select_policies_followup.sql` | `20261025110930` | `doodhwala_consolidate_admin_select_policies_followup` |
| Restore private delivery-promise functions | `20261025210000_doodhwala_restore_delivery_promise_functions.sql` | `20261025111833` | `doodhwala_restore_delivery_promise_functions` |
| Grant authenticated cancellation implementation access | `20261025211000_grant_customer_cancel_order_implementation.sql` | `20261025111956` | `grant_customer_cancel_order_implementation` |
| Revoke default public table/sequence/function grants | `20261012084800_doodhwala_security_default_privileges.sql` | `20261025114129` | `doodhwala_security_default_privileges` |
| Revoke anonymous table writes | `20261013130000_doodhwala_revoke_anon_table_writes.sql` | `20261025114133` | `doodhwala_revoke_anon_table_writes` |
| Limit anonymous catalogue columns and approved visibility | `20261013150000_doodhwala_limit_anon_catalogue_columns.sql` | `20261025114137` | `doodhwala_limit_anon_catalogue_columns` |
| Staging least-privilege guards (compatibility version; see notes) | `20261025214000_staging_least_privilege_role_guards.sql` | `20261025114231` | `staging_least_privilege_role_guards` |
| Staging seller private-field grants (compatibility version) | `20261025215000_staging_protect_seller_private_fields.sql` | `20261025114245` | `staging_protect_seller_private_fields` |
| Hide provider owner UUID | `20261013170000_doodhwala_hide_provider_owner_uuid.sql` | `20261025114258` | `doodhwala_hide_provider_owner_uuid` |
| Add owner-scoped provider profile RPCs | `20261013180000_doodhwala_secure_provider_profile_upsert.sql` | `20261025114301` | `doodhwala_secure_provider_profile_upsert` |
| Add provider-owner RLS helper | `20261013190000_doodhwala_provider_rls_owner_helper.sql` | `20261025114305` | `doodhwala_provider_rls_owner_helper` |
| Revoke direct provider writes | `20261013200000_doodhwala_revoke_provider_direct_writes.sql` | `20261025114308` | `doodhwala_revoke_provider_direct_writes` |
| Re-consolidate owner SELECT policies after helper migration | `20261025216000_staging_reconsolidate_security_select_policies.sql` | `20261025114323` | `staging_reconsolidate_security_select_policies` |
| Bounded nearby-provider query | `20261023120000_doodhwala_bounded_nearby_provider_search.sql` | `20261025114528` | `doodhwala_bounded_nearby_provider_search` |
| Provider order-capacity indexes | `20261023130000_doodhwala_order_capacity_query_indexes.sql` | `20261025114532` | `doodhwala_order_capacity_query_indexes` |
| Payment provider event ledger and state guard | `20261022133000_doodhwala_pay_event_ledger.sql` | `20261025114535` | `doodhwala_pay_event_ledger` |
| Immutable order payment audit/reference guard | `20261023150000_doodhwala_payment_audit_and_reference_guard.sql` | `20261025114539` | `doodhwala_payment_audit_and_reference_guard` |
| Payment audit actor FK index | `20261025217000_order_payment_events_actor_index.sql` | `20261025114619` | `order_payment_events_actor_index` |
| SECURITY DEFINER empty search-path sweep | `20261025218000_staging_definer_search_path_hardening.sql` | `20261025114924` | `staging_definer_search_path_hardening` |

## Repository migrations not applied verbatim / deferred dependencies

These local source files are intentionally **not** represented as an applied version of the same filename:

- `20261012084616_doodhwala_security_least_privilege.sql`: its desired protections were applied in staging through the default-privilege source migration plus staging-compatible role guards and the SECURITY DEFINER search-path sweep. The source's static revokes include multiple helper signatures that are absent from this staging schema; it was not run wholesale.
- `20261013090000_doodhwala_lock_admin_allowlist_rls.sql`: its only DDL effect (enabling RLS on `private.admin_allowlist`) was already applied by `staging_security_hardening`. Verify the state rather than replaying it for bookkeeping.
- `20261013140000_doodhwala_split_anon_provider_read_policies.sql`: the later `20261013150000_doodhwala_limit_anon_catalogue_columns.sql` source migration establishes separate public/authenticated catalogue policies and stricter allowed columns; the earlier migration was not run separately due policy-name overlap.
- `20261013160000_doodhwala_protect_seller_private_fields.sql`: staging-compatible equivalent is `20261025215000_staging_protect_seller_private_fields.sql`; the repository source refers to a private nearby-search helper absent from the current staging catalog.
- `20261022203000_doodhwala_support_operations.sql`: **deferred**. It returns/uses `public.support_tickets`, but that table does not exist in the staging schema and this migration does not create it. Do not apply until a separately reviewed table/schema/auth/RLS migration exists.
- Other missing historical filename versions remain a migration-history bookkeeping problem. An applied SQL effect or an equivalent compatibility migration is not proof that the CLI considers the original file version applied.

## Required reconciliation procedure

1. Freeze all schema writes to staging while preparing the release candidate.
2. Check out the exact candidate commit and run `supabase migration list` against staging without applying or resetting anything. Save the full local/remote list as a release artifact.
3. For every row above, compare the source file byte-for-byte with the SQL submitted to the staging migration API. The SQL in the audit notes is not a substitute for the tracked file.
4. Have a second reviewer verify the proposed CLI migration-history repair plan. Do not use `db push` as a way to “see what happens”; it may try to replay files whose filename versions are absent from remote history.
5. Use the officially supported migration-history workflow to align version records only after the byte-for-byte audit; do not edit migration metadata tables directly. Verify the local/remote migration list has no pending duplicates after repair.
6. Run the transactional smoke tests again, verify all fixture counts are zero, re-run Security/Performance Advisors, and require Static + Next.js CI to pass on the final candidate.
7. Repeat the reconciliation independently for production only after explicit release approval; never copy the staging's recorded versions or apply staging changes to production as part of this staging PR.

## Other release blockers

- The Vercel preview's Supabase URL/key binding remains **unverified** because environment-variable metadata access returned a permission error. Confirm the preview environment in Vercel project settings before browser tests.
- Database/RPC smoke tests ran with synthetic Auth rows and JWT claims inside rollback-only SQL transactions. Browser sessions, Google OAuth, phone OTP, Realtime transport and actual money settlement are not yet tested.
- Direct-UPI seller confirmation only records a seller attestation; it is not bank settlement evidence.

No production writes, resets, migration-history edits, or traffic cutover were made during this audit.
