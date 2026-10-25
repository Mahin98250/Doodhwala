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
