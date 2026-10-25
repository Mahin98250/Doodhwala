# Staging baseline and migration reconciliation

**Status as of 2026-10-25: a separate staging project exists and is healthy, but complete environment isolation and end-to-end acceptance are still pending.** Staging project ref: `jbcekiaiyxcatueixeqh` (`Doodhwala Staging`), region `ap-northeast-2`, PostgreSQL 17.11.0.003. API URL: `https://jbcekiaiyxcatueixeqh.supabase.co`. Do not run synthetic checkout/load tests against production.

## Known current state (read-only audit, 2026-10-24)

- Supabase production project: `hmiboyfcvtfawrwujslg` (`Doodhwala`, `ap-south-1`).
- Connected database engine: PostgreSQL 17.
- Live migration history contains 57 entries and currently ends at `20261013164921` (`doodhwala_revoke_provider_direct_writes`).
- The production project currently has only the `client-error-report` Edge Function deployed. The `doodhwala-pay` function is not deployed.
- Repository `main` contains newer migrations after the production history, including nearby search / order-capacity changes and payment foundations. A repository migration file is not proof that it was applied to a database.
- The most recent disposable PostgreSQL CI run passed for the repository's synthetic nearby-search and payment-audit fixtures. This is not a complete staging end-to-end test.


## Current no-cost blocker (checked 2026-10-25)

- The separate `Doodhwala Staging` project was subsequently provisioned and is currently reported `ACTIVE_HEALTHY`; it is in `ap-northeast-2`, not the production region `ap-south-1`. Account billing/plan details still need to be reviewed in the Supabase dashboard; do not infer that all future use is free.
- A previous development-branch quote returned `$0.01344/hour` (about `$9.81` for 30 days at that quoted rate). Do not create paid branches, upgrade plans, or accept additional charges without explicit approval.
- Do not delete, pause, or repurpose the existing Learner's Guide or production Doodhwala projects. Production remains off-limits for synthetic load or test-order writes.
- Full staging acceptance remains **blocked** until deployment environment binding is verified, migration/schema reconciliation is completed, and synthetic customer→seller order journeys pass. Disposable PostgreSQL CI and static contracts remain useful but do **not** replace live Supabase Auth/RLS/Realtime/E2E tests or prove capacity.

## Staging project and environment binding

A separate project now exists: `Doodhwala Staging` (`jbcekiaiyxcatueixeqh`), reported `ACTIVE_HEALTHY`, region `ap-northeast-2`. It is separate from production project `hmiboyfcvtfawrwujslg` in `ap-south-1`; the region difference should be noted when interpreting latency/load results. Do not assume the Vercel preview is connected to staging until the project owner verifies the preview's environment variables in Vercel. The connected integration returned 403 for environment-variable metadata, so that binding is not independently verified here.

Use synthetic users, providers, products, addresses and orders only. Never copy production customer PII into staging. Confirm the project’s plan and billing in Supabase before scaling tests; do not upgrade plans, create paid branches, or accept additional charges without explicit approval. Use the staging URL and publishable/anon key only in browser/client environments; never put a service-role key in browser code or repository files.

Suggested GitHub Actions secrets/environment variables for a staging-only load workflow:
- `STAGING_PROJECT_REF` (exact 20-character ref; must not equal the production project ref)
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_PROJECT_REF` (must not equal the production project ref)

Do not add real secret values to this repository, README, logs or pull requests. Set them in GitHub Actions Environment secrets after staging is provisioned. Restrict the environment to maintainers and require an explicit staging confirmation input for any load test.

## Staging-only delivery-tracking policy (2026-10-25)

Migration `20261025180000_delivery_tracking_owner_read_policy.sql` was applied to staging project `jbcekiaiyxcatueixeqh` and verified from PostgreSQL catalogs.

- Authenticated SELECT is allowed only when the tracking event's `order_id` and `provider_id` match an order where the user is the customer (`customer_id = auth.uid()`) or the seller account owner (`provider_owner_id = auth.uid()`).
- Browser-role writes remain revoked; tracking-event creation must use the trusted server/service-role path.
- The staging Security Advisor no longer reports `public.delivery_tracking_events` as RLS-enabled-without-policy. Two intentional deny-by-default findings remain: `private.admin_allowlist` and `public.client_error_reports`.
- CI now includes `scripts/test-delivery-tracking-policy.mjs` to guard the policy's source contract.
- This verifies migration application and policy metadata only. Authenticated customer/provider isolation still needs staging-account E2E tests; it is not yet an acceptance-pass.

This change was applied to staging only. It is not evidence that production has this policy or that the Vercel preview is connected to staging.

## Payment controls staged (2026-10-25)

The eight existing payment migrations were applied sequentially to staging project `jbcekiaiyxcatueixeqh` after inspecting the source SQL and confirming the expected payment objects were absent. Recorded staging migration names are:

1. `doodhwala_pay_foundation`
2. `doodhwala_direct_seller_payments`
3. `doodhwala_direct_upi_settings_read`
4. `doodhwala_payment_choice_race_guard`
5. `doodhwala_guard_payment_field_writes`
6. `doodhwala_direct_upi_pending_only`
7. `doodhwala_payment_controls_readiness`
8. `doodhwala_recheck_seller_approval_for_upi`

Post-apply catalog checks confirmed the payment RPCs exist; authenticated execution is granted and `anon` execution is denied for the inspected customer/seller RPCs. The payment fields now exist on `public.orders`, and both the payment-field write guard and payment-choice-before-acceptance trigger are enabled. `public.payment_transactions` and `public.provider_payment_settings` have RLS enabled and table grants only to `service_role`; browser access is through owner-scoped RPCs.

A schema-readiness probe returned `{"ready":true}` when run in a rolled-back transaction with a synthetic non-null JWT subject. This verifies only that the readiness function sees the expected tables, functions, RLS and triggers; it does not test a real customer session, order creation, seller UPI setup, or payment settlement.

Migration `20261025190000_doodhwala_payment_fk_indexes.sql` was then applied to staging and added to this branch. It creates `orders_payment_confirmed_by_idx` and `payment_transactions_provider_id_idx` to cover the two payment-related foreign keys found by the performance advisor. No indexes were dropped; the larger unused-index list is not actionable without representative workload measurements.\n\nThe refreshed Security Advisor reports four RLS-enabled/no-policy informational findings (`private.admin_allowlist`, `public.client_error_reports`, `public.payment_transactions`, `public.provider_payment_settings`). The last two are intentionally service-role-only. It also reports eight authenticated-executable `SECURITY DEFINER` RPCs. These are intended API entry points with ownership/eligibility checks in their SQL, but must still be exercised with separate customer, seller and non-admin accounts before acceptance. Do not dismiss the warnings wholesale or broaden table grants to clear them.

**Still blocked:** live authenticated customer → COD order → seller status progression → delivery tracking tests, direct-UPI configuration/confirmation tests, and independent proof that the Vercel preview is wired only to staging. Production remains untouched.

## RLS SELECT-policy consolidation (2026-10-25)

The source migration `20261012090500_doodhwala_consolidate_admin_select_policies.sql` was applied to staging, followed by `20261025200000_doodhwala_consolidate_admin_select_policies_followup.sql` for the remaining affected tables. The changes consolidate admin access with the existing owner/customer visibility rules on `profiles`, `milk_products`, `provider_service_areas`, `orders`, `milk_subscriptions`, `provider_profiles`, `provider_verifications`, and `subscription_deliveries`.

Post-apply catalog checks confirmed the intended policy definitions are present. `provider_profiles` and `provider_verifications` now have separate anon and authenticated SELECT policies; the anonymous policies do not invoke `private.is_current_user_admin()`. Customer/provider ownership and approved-public catalogue visibility predicates were preserved. The performance advisor no longer reports the earlier eight `multiple_permissive_policies` warnings.

The performance advisor also no longer reports unindexed foreign keys after the two payment FK indexes were added. It currently lists 34 unused indexes in the latest advisor run; this count can change as smoke-test queries run and statistics change. Without representative production-like traffic and query plans, these are not safe candidates for deletion. No unused indexes were dropped.

## Order/RPC smoke tests and lifecycle dependency repairs (2026-10-25)

The full staging SQL smoke test was run inside one transaction with synthetic Auth users, profiles, a customer-owned address, an approved synthetic seller, a service area, a synthetic milk product, and generated orders. The transaction ended with `ROLLBACK`; follow-up catalog counts confirmed that **zero** synthetic Auth/profile/provider/product/order/tracking fixture rows persisted.

The smoke test returned `PASS` for these database/RPC scenarios:

- `customer_order_payment_controls_ready()` reported schema readiness.
- Real `public.create_order(...)` placed a synthetic COD order.
- The request included a deliberately forged client unit price of ₹0.01; the saved order and item used the database's seller price of ₹50.00.
- Repeating the same customer/idempotency key and request returned the same order ID and created exactly one order; changing the payload under the same key raised `idempotency_key_reuse_conflict`.
- Customer COD selection and exact-choice retry succeeded.
- Seller status flow `placed → accepted → preparing → ready → out_for_delivery → delivered` passed; COD collection confirmation succeeded only after delivery.
- Direct UPI failed closed while the approved synthetic seller had no enabled UPI settings.
- Customer cancellation from an eligible `placed` order passed.
- A different authenticated customer could not set the original customer's payment method (`order_not_found`).
- A second rollback-only direct-UPI happy-path test passed: an approved synthetic seller saved valid UPI details, malformed UPI input was rejected, the customer selected direct UPI, only that order's customer could retrieve payee/amount instructions, an unrelated user could not retrieve the instructions or confirm payment, and the seller could confirm the seller-owned pending order. After confirmation, pending UPI instructions were no longer returned. A follow-up catalog query confirmed zero synthetic Auth/profile/provider/payment-setting/product/order fixture rows persisted.
- An additional rollback-only admin authorization test passed: a normal authenticated synthetic user was denied by `public.admin_list_orders(1)` with `owner_access_required`, while a synthetic email temporarily inserted into `private.admin_allowlist` was recognized and could call the admin wrapper. The synthetic allowlist row and both synthetic Auth users were rolled back.
- The customer and provider owner could read the order's tracking event; an unrelated authenticated user could not.

Two missing staging dependencies were repaired after the smoke test exposed them:

1. `20261025210000_doodhwala_restore_delivery_promise_functions.sql` adds the private `calculate_order_eta(uuid)` and `set_order_delivery_promise(uuid)` helpers used by the existing provider status lifecycle migration. The helpers use a hardened empty search path and have browser-role EXECUTE revoked.
2. `20261025211000_grant_customer_cancel_order_implementation.sql` grants the authenticated role EXECUTE on the customer-owned SECURITY DEFINER cancellation implementation because the public wrapper remains SECURITY INVOKER. The implementation still checks `auth.uid()`, `customer_id`, and eligible status.

After applying these fixes, the entire transactional smoke test passed, including the acceptance ETA/promise path and cancellation. A later read-only query confirmed no synthetic fixture data persisted.

**Test scope:** this is a real PostgreSQL/RPC smoke test under the `authenticated` database role with synthetic JWT subject claims, within a rollback-only transaction. It proves core database/RPC logic and RLS behavior in staging; it is **not** a browser/UI test or a real Supabase Auth login session, and does not verify OAuth, phone OTP delivery, Vercel environment isolation, Realtime transport, or money settlement. Those remain release gates.

The missing-function and cancellation-grant discoveries are guarded by the static CI script `scripts/test-staging-order-security-dependencies.mjs`. Static validation run #1123 and Next.js app validation run #129 both passed for commit `cf03de3095d544c3852f805fd520baa8af420538`; check the current branch head's own CI status before any merge.

## Subscription lifecycle smoke test (2026-10-25)

A rollback-only transaction using synthetic customer/provider Auth identities **passed** the following subscription RPC journey on staging:

- Create a one-week milk plan and generate seven scheduled delivery rows.
- Verify the stored plan price comes from the active product's server price.
- Update quantity and delivery time; future scheduled rows are updated accordingly.
- Verify a different customer cannot edit, skip or cancel the plan.
- Skip one delivery before cutoff; pause the plan through a future date and verify upcoming in-window deliveries become skipped.
- Resume the plan; cancel it as the owner and verify future scheduled deliveries are cancelled.
- A follow-up read-only catalog query found zero synthetic Auth/profile/address/provider/product/subscription/delivery rows persisted.

This test uses the authenticated database role with synthetic JWT claims; it is not a browser/Auth-session test. It confirms core subscription RPC logic and database side effects only.

## Production migration snapshot and repository drift

### Focused live-schema check

A separate read-only catalog query was captured in [`supabase/audit/production-schema-check-2026-10-24.json`](../supabase/audit/production-schema-check-2026-10-24.json). The key findings are:

- `public.find_nearby_providers_v2` is present in production, although the observed migration-history snapshot does not show the exact repository migration version `20261023120000`.
- The provider latitude/longitude and active-product indexes are present.
- The two repository order-capacity indexes (`orders_provider_open_capacity_idx` and `orders_provider_daily_litres_idx`) are absent by those exact names in the observed catalog.
- `payment_transactions` and `order_payment_events` are absent from the observed catalog.

This is concrete evidence of **migration-history/schema mismatch**: some real schema objects exist without matching the exact repo migration history, while others added in Git are not present in production. The finding is why we must compare the actual schema and migration history, inspect definitions and privileges, then recreate and test the sequence in staging. Do not blindly replay files, rename timestamps to force a match, or apply any of these migrations in production based on this report.

Run `node scripts/test-production-schema-inventory.mjs` to validate the metadata snapshot's consistency in CI. This is an offline static test and does not query production.

The read-only snapshot at [`supabase/audit/production-migration-history-2026-10-24.json`](../supabase/audit/production-migration-history-2026-10-24.json) records the 57 migration versions observed in the live project on 2026-10-24. It contains migration identifiers and names only; it is not a database dump.

Run `node scripts/test-production-migration-manifest.mjs` (also executed by CI) to compare exact live version IDs with timestamped SQL files in `supabase/migrations/`. It reports:
- Production migration versions that have no exact matching local SQL filename.
- Local timestamped migration files absent from the observed production history (candidates for staging review, not auto-apply instructions).
- Whether the latest production version has an exact source file in Git.

Initial report result for the current audit branch (static CI, 2026-10-24): **10/57** live version IDs have an exact local SQL filename, **47/57** do not; **55** timestamped local SQL files are not present in the live snapshot; and the latest live version has no exact local filename. These are filename/history comparisons, not proof that 47 SQL changes are missing from the actual schema. Some local files may use different timestamps for identically named migrations. The audit now separates exact version matches from same-name/different-version clues; a name-match is investigatory evidence only and does not prove the SQL contents are equivalent. The mismatch has to be resolved from source history or a clean schema dump before replaying or applying migrations.

This check is deliberately diagnostic rather than an automatic deployment gate: historical file names may have drifted, and newer repository migrations must be reviewed in dependency order. **Never apply migrations or mark them as deployed based solely on the report.** Refresh this snapshot from the authorized read-only Supabase migration inventory when production changes; keep the source date visible.

## Migration reconciliation protocol

1. Capture the exact current staging migration list and schema before changing anything.
2. Compare migration version identifiers with the repository's `supabase/migrations/` directory. Record missing, duplicate, out-of-order and renamed migrations.
3. Review the SQL and dependencies for every migration missing from staging. Do not blindly run every repository migration against production.
4. Apply repository migrations to staging in a controlled order, then run the SQL validation and app contract tests.
5. Compare important functions, indexes, RLS policies and grants against expected definitions. The audit queries in `scripts/staging-schema-audit.sql` are read-only diagnostics and may need schema-specific additions as the project evolves.
6. Run browser-based customer → seller → customer order tracking with synthetic accounts, then run read-only load testing. Only after those pass, run bounded synthetic write tests against staging.
7. Save the commit SHA, migration list, load-test settings/results, query plans, failures and rollback steps in the staging report.
8. Production rollout is a separate reviewed change. No staging result automatically authorizes a production migration.

## Read-only database audit

Run `scripts/staging-schema-audit.sql` only after connecting your SQL client to the intended staging database. It does not modify schema or data. Verify the connection target before execution.

## First acceptance gates

- [x] Separate staging project exists and reports healthy (`jbcekiaiyxcatueixeqh`).
- [ ] Organization/project billing and plan confirmed before load testing.
- [ ] Vercel preview environment binding independently verified as staging-only.
- [ ] Staging project ref and URL configured in the appropriate protected GitHub environment; publishable/anon key stored as a secret (never committed).
- [ ] Repository migration history reconciled against staging.
- [ ] RLS, function grants, payment gates and order-capacity constraints reviewed.
- [ ] Synthetic end-to-end order journey passes.
- [ ] Backup/restore or supported recovery procedure documented.
- [ ] Read-only discovery load test passes at baseline settings.
- [ ] Staging report records commit SHA, metrics, errors and limitations.

**No capacity claim** should be made until measured results exist for a named commit, database plan/region, data size, scenario mix and load-generator profile.
