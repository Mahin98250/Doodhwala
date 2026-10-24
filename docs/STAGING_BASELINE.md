# Staging baseline and migration reconciliation

**Status: staging project not yet provisioned or validated.** This document is the first execution gate for the scalability roadmap. Do not run synthetic checkout/load tests against production.

## Known current state (read-only audit, 2026-10-24)

- Supabase production project: `hmiboyfcvtfawrwujslg` (`Doodhwala`, `ap-south-1`).
- Connected database engine: PostgreSQL 17.
- Live migration history contains 57 entries and currently ends at `20261013164921` (`doodhwala_revoke_provider_direct_writes`).
- The production project currently has only the `client-error-report` Edge Function deployed. The `doodhwala-pay` function is not deployed.
- Repository `main` contains newer migrations after the production history, including nearby search / order-capacity changes and payment foundations. A repository migration file is not proof that it was applied to a database.
- The most recent disposable PostgreSQL CI run passed for the repository's synthetic nearby-search and payment-audit fixtures. This is not a complete staging end-to-end test.

## Provision staging first

### Current blocker — no staging environment exists yet

The attempt to create `Doodhwala Staging` was rejected because the organization/user already reached the free-project limit. No new project was created. A development branch was quoted at a nonzero hourly cost and was not created because the budget rule is **no additional charges without approval**. Until a free slot or separately approved budget is available, continue with repository tests and disposable PostgreSQL CI only; do not point staging variables at production and do not claim a measured staging baseline.

Use a separate Supabase project in the same organization as Doodhwala, preferably in `ap-south-1` to match the production region and reduce regional differences in test results. Use synthetic users, providers, products, addresses and orders only. Never copy production customer PII into staging.

Before creating a project, confirm the organization and inspect the quoted cost. Do not accept a nonzero project/compute charge without explicit approval. Use separate staging URL and publishable key; never copy a service-role key into browser code or repository files.

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

- [ ] Organization and project cost confirmed.
- [ ] Separate staging project created and healthy.
- [ ] Staging project ref and URL saved as GitHub repository variables, anon key saved as a repository secret (not committed).
- [ ] Repository migration history reconciled against staging.
- [ ] RLS, function grants, payment gates and order-capacity constraints reviewed.
- [ ] Synthetic end-to-end order journey passes.
- [ ] Backup/restore or supported recovery procedure documented.
- [ ] Read-only discovery load test passes at baseline settings.
- [ ] Staging report records commit SHA, metrics, errors and limitations.

**No capacity claim** should be made until measured results exist for a named commit, database plan/region, data size, scenario mix and load-generator profile.
