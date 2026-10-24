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
