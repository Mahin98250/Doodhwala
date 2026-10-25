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
